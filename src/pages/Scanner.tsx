import React, { useEffect, useState, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Scanner() {
  const [scanMode, setScanMode] = useState<'entrada' | 'salida'>('entrada');
  const [lastScan, setLastScan] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(true);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (!isScanning) return;

    if (!scannerRef.current) {
      scannerRef.current = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );
      scannerRef.current.render(onScanSuccess, onScanFailure);
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
        scannerRef.current = null;
      }
    };
  }, [isScanning, scanMode]);

  const sendWhatsAppMessage = async (studentData: any, mode: 'entrada' | 'salida') => {
    if (!studentData.callMeBotApiKey || !studentData.celular) {
      console.log("WhatsApp no configurado para este estudiante.");
      return;
    }

    const timeString = format(new Date(), 'hh:mm a');
    const studentName = `${studentData.nombres} ${studentData.apellidoPaterno} ${studentData.apellidoMaterno}`;
    const message = mode === 'entrada' 
      ? `Hola, ${studentName} ha ingresado a la escuela exitosamente a las ${timeString}.`
      : `Aviso: ${studentName} ha salido de las instalaciones escolares a las ${timeString}.`;

    try {
      const url = `https://api.callmebot.com/whatsapp.php?phone=${studentData.celular}&text=${encodeURIComponent(message)}&apikey=${studentData.callMeBotApiKey}`;
      await fetch(url, { mode: 'no-cors' });
      console.log("WhatsApp message request sent");
    } catch (error) {
      console.error("Error sending WhatsApp message:", error);
    }
  };

  const onScanSuccess = async (decodedText: string) => {
    if (!auth.currentUser) return;
    
    // Pause scanning to prevent multiple triggers
    if (scannerRef.current) {
      try {
        scannerRef.current.pause(true);
      } catch (e) {
        console.warn("Could not pause scanner", e);
      }
    }

    try {
      // Find student by DNI
      const q = query(collection(db, 'students'), where('dni', '==', decodedText));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        alert("¡Estudiante no encontrado!");
        if (scannerRef.current) {
          try {
            scannerRef.current.resume();
          } catch (e) {}
        }
        return;
      }

      const studentDoc = querySnapshot.docs[0];
      const studentData = studentDoc.data();

      // Determine status (simple logic: before 8:30 AM is present, after is late)
      const now = new Date();
      const isLate = now.getHours() > 8 || (now.getHours() === 8 && now.getMinutes() > 30);
      const status = scanMode === 'entrada' ? (isLate ? 'tarde' : 'presente') : 'presente';

      // Log attendance
      await addDoc(collection(db, 'attendance'), {
        uid: auth.currentUser.uid,
        studentRef: studentDoc.id,
        studentName: `${studentData.nombres} ${studentData.apellidoPaterno} ${studentData.apellidoMaterno}`,
        studentDni: studentData.dni,
        grado: studentData.grado,
        seccion: studentData.seccion,
        avatarUrl: studentData.avatarUrl || null,
        timestamp: serverTimestamp(),
        type: scanMode,
        status: status
      });

      // Intentar enviar WhatsApp
      await sendWhatsAppMessage(studentData, scanMode);

      setLastScan({
        ...studentData,
        status,
        time: new Date()
      });

      // Resume scanning after 3 seconds
      setTimeout(() => {
        setLastScan(null);
        if (scannerRef.current) {
          try {
            scannerRef.current.resume();
          } catch (e) {}
        }
      }, 3000);

    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'attendance');
      if (scannerRef.current) {
        try {
          scannerRef.current.resume();
        } catch (e) {}
      }
    }
  };

  const onScanFailure = (error: any) => {
    // Ignore frequent scan failures
  };

  return (
    <div className="relative min-h-[calc(100vh-144px)] flex flex-col items-center justify-center p-4 bg-slate-900 overflow-hidden">
      <div className="absolute inset-0 z-0 overflow-hidden">
        <img 
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuAn7PXkGAyRMmnh4VeYvO4-h_Oq8EQoYlB_rz4wR_iF73oGvLXStbizB8cPHRwNy4byYtMoP4RsJUYOAjI8OjVmcR-aRXp4XKhLyTrev5AaIN70FXzEh3WCATj8GwC3oB5csLLcLyWRoxW9p4ap9YuUHAWyhRd7L0SLTtKaMfclUTqozoxNNUs2u_UufW7SsqC30FsvGVogvwonzQ1NKSoGykTLwV5abSzJGVYiqb1JInuFNYSOOHN2Hyg13KWdstjrNbokbAeJOJY" 
          alt="Classroom background" 
          className="w-full h-full object-cover opacity-40"
          referrerPolicy="no-referrer"
        />
      </div>

      <div className="relative z-10 w-full max-w-md flex flex-col items-center gap-6 mb-8">
        <div className="bg-surface/10 backdrop-blur-xl px-6 py-3 rounded-xl flex items-center gap-4 border border-white/10">
          <h2 className="text-white text-2xl font-bold tracking-tight">Escáner</h2>
          <div className="h-6 w-[1px] bg-white/20"></div>
          <div className="flex bg-black/20 rounded-lg p-1">
            <button 
              onClick={() => setScanMode('entrada')}
              className={`px-4 py-1 rounded-md text-sm font-medium transition-colors ${scanMode === 'entrada' ? 'bg-primary text-white' : 'text-white/70 hover:text-white'}`}
            >
              Entrada
            </button>
            <button 
              onClick={() => setScanMode('salida')}
              className={`px-4 py-1 rounded-md text-sm font-medium transition-colors ${scanMode === 'salida' ? 'bg-primary text-white' : 'text-white/70 hover:text-white'}`}
            >
              Salida
            </button>
          </div>
        </div>
      </div>

      <div className="relative z-10 w-72 h-72 md:w-96 md:h-96 scanner-frame group mx-auto mt-4">
        <div className="absolute inset-0 bg-primary/5 rounded-xl"></div>
        <div className="scan-line"></div>
        <div id="reader" className="w-full h-full rounded-xl overflow-hidden [&>div]:border-none [&>div]:shadow-none"></div>
      </div>

      {lastScan && (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 w-full max-w-[320px] bg-surface-container-lowest rounded-xl p-4 shadow-[0_12px_32px_rgba(25,28,29,0.1)] flex items-center gap-4 border-l-4 border-primary z-20 animate-in slide-in-from-bottom-10">
          <div className="w-14 h-14 rounded-full overflow-hidden bg-surface-container">
            {lastScan.avatarUrl ? (
              <img src={lastScan.avatarUrl} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span className="material-symbols-outlined text-on-surface-variant w-full h-full flex items-center justify-center">person</span>
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-on-surface">{lastScan.nombres}</p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary-fixed text-on-primary-fixed-variant uppercase">{lastScan.status}</span>
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5">DNI: {lastScan.dni}</p>
            <p className="text-[10px] text-outline mt-1 italic">Escaneo exitoso • {format(lastScan.time, 'hh:mm a')}</p>
          </div>
        </div>
      )}

      <div className="relative z-10 mt-8 w-full max-w-md flex flex-col items-center gap-4">
        <div className="bg-surface-container-lowest/10 backdrop-blur-md text-white p-4 rounded-xl border border-white/20 w-full">
          <h4 className="font-bold text-sm mb-2 flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">info</span>
            Instrucciones para Códigos QR
          </h4>
          <ul className="text-xs text-white/80 space-y-1 list-disc list-inside">
            <li>El código QR debe contener <strong>únicamente el DNI</strong> del estudiante.</li>
            <li>Asegúrate de que el DNI coincida con el registrado en el sistema.</li>
            <li>Alinea el código QR dentro del marco para registrar la asistencia.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
