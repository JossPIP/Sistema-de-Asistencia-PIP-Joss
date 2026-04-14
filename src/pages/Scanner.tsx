import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Scanner() {
  const [scanMode, setScanMode] = useState<'entrada' | 'salida'>('entrada');
  const [lastScan, setLastScan] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(true);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isScanning) return;

    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode("reader");
      
      const config = { fps: 10, qrbox: { width: 250, height: 250 } };
      
      // Request camera permissions and start scanning
      Html5Qrcode.getCameras().then(devices => {
        if (devices && devices.length) {
          // Use the environment camera (back camera) if available
          scannerRef.current?.start(
            { facingMode: "environment" },
            config,
            onScanSuccess,
            onScanFailure
          ).catch(err => {
            console.error("Error starting camera:", err);
          });
        }
      }).catch(err => {
        console.error("Error getting cameras:", err);
      });
    }

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().then(() => {
          scannerRef.current?.clear();
          scannerRef.current = null;
        }).catch(console.error);
      } else if (scannerRef.current) {
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    };
  }, [isScanning, scanMode]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && scannerRef.current) {
      const file = e.target.files[0];
      try {
        const decodedText = await scannerRef.current.scanFile(file, true);
        onScanSuccess(decodedText);
      } catch (err) {
        alert("No se pudo leer un código QR en la imagen.");
        console.error("Error scanning file:", err);
      }
      // Reset input so the same file can be selected again
      e.target.value = '';
    }
  };

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
      // CallMeBot expects phone number without '+' sign, just country code and number
      const formattedPhone = studentData.celular.replace(/\D/g, '');
      const url = `https://api.callmebot.com/whatsapp.php?phone=${formattedPhone}&text=${encodeURIComponent(message)}&apikey=${studentData.callMeBotApiKey}`;
      await fetch(url, { mode: 'no-cors' });
      console.log("WhatsApp message request sent to", formattedPhone);
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
          className="w-full h-full object-cover opacity-30"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/80 via-slate-900/40 to-slate-900"></div>
      </div>

      <div className="relative z-10 w-full max-w-md flex flex-col items-center gap-6 mb-8">
        <div className="text-center mb-2">
          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-1">Registro de Asistencia</h1>
          <p className="text-white/70 text-sm font-medium">IE 51027 Juan de la Cruz Montes Salas</p>
        </div>
        
        <div className="bg-white/10 backdrop-blur-xl p-1.5 rounded-2xl flex items-center gap-1 border border-white/20 shadow-xl">
          <button 
            onClick={() => setScanMode('entrada')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 ${scanMode === 'entrada' ? 'bg-primary text-white shadow-lg scale-105' : 'text-white/70 hover:text-white hover:bg-white/5'}`}
          >
            <span className="material-symbols-outlined text-sm">login</span>
            Entrada
          </button>
          <button 
            onClick={() => setScanMode('salida')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 ${scanMode === 'salida' ? 'bg-secondary text-white shadow-lg scale-105' : 'text-white/70 hover:text-white hover:bg-white/5'}`}
          >
            <span className="material-symbols-outlined text-sm">logout</span>
            Salida
          </button>
        </div>
      </div>

      <div className="relative z-10 w-72 h-72 md:w-96 md:h-96 scanner-frame group mx-auto mt-2 bg-black/40 rounded-3xl p-2 backdrop-blur-sm border border-white/10 shadow-2xl">
        <div className="absolute inset-0 bg-primary/5 rounded-3xl pointer-events-none"></div>
        <div className="scan-line pointer-events-none"></div>
        <div id="reader" className="w-full h-full rounded-2xl overflow-hidden [&>div]:border-none [&>div]:shadow-none bg-black"></div>
        
        {/* Corner Accents */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-3xl pointer-events-none"></div>
        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-3xl pointer-events-none"></div>
      </div>

      <div className="relative z-10 mt-6 flex justify-center">
        <input 
          type="file" 
          accept="image/*" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          className="hidden" 
          id="qr-upload"
        />
        <label 
          htmlFor="qr-upload" 
          className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 cursor-pointer border border-white/20 shadow-lg backdrop-blur-sm"
        >
          <span className="material-symbols-outlined text-sm">image</span>
          Examinar
        </label>
      </div>

      {lastScan && (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 w-full max-w-[340px] bg-white rounded-2xl p-4 shadow-[0_20px_40px_rgba(0,0,0,0.3)] flex items-center gap-4 border-l-8 border-primary z-20 animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-100 border-2 border-white shadow-sm shrink-0">
            {lastScan.avatarUrl ? (
              <img src={lastScan.avatarUrl} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span className="material-symbols-outlined text-slate-400 w-full h-full flex items-center justify-center text-3xl">person</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-base font-extrabold text-slate-800 truncate leading-tight">{lastScan.nombres} {lastScan.apellidoPaterno}</p>
              <span className={`text-[10px] font-extrabold px-2 py-1 rounded-md uppercase tracking-wider shrink-0 ${lastScan.status === 'tarde' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {lastScan.status}
              </span>
            </div>
            <p className="text-xs font-mono text-slate-500 mt-1">DNI: {lastScan.dni}</p>
            <div className="flex items-center gap-1 mt-2 text-[11px] font-medium text-slate-400">
              <span className="material-symbols-outlined text-[14px] text-emerald-500">check_circle</span>
              <span>Registrado a las {format(lastScan.time, 'hh:mm a')}</span>
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 mt-10 w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-md text-white p-5 rounded-2xl border border-white/20 shadow-lg">
          <h4 className="font-bold text-sm mb-3 flex items-center gap-2 text-primary-200">
            <span className="material-symbols-outlined">qr_code_scanner</span>
            Instrucciones de Uso
          </h4>
          <ul className="text-sm text-white/80 space-y-2">
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-[16px] mt-0.5 text-white/50">looks_one</span>
              <span>Selecciona el modo: <strong>Entrada</strong> o <strong>Salida</strong>.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-[16px] mt-0.5 text-white/50">looks_two</span>
              <span>Alinea el código QR del estudiante dentro del marco.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-[16px] mt-0.5 text-white/50">looks_3</span>
              <span>El código QR debe contener <strong>únicamente el DNI</strong> (ej: 12345678).</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
