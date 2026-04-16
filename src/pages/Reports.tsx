import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, addDoc, serverTimestamp, getDoc, doc, limit } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';

export default function Reports() {
  const [date, setDate] = useState('');
  const [grado, setGrado] = useState('');
  const [seccion, setSeccion] = useState('');
  const [estado, setEstado] = useState('');
  const [registrarRole, setRegistrarRole] = useState('');
  const [reportData, setReportData] = useState<any[]>([]);
  const [visibleCount, setVisibleCount] = useState(20);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingFaltas, setIsProcessingFaltas] = useState(false);
  const [gradosOptions, setGradosOptions] = useState<string[]>([]);
  const [seccionesOptions, setSeccionesOptions] = useState<string[]>([]);

  useEffect(() => {
    fetchFilterOptions();
    // Fetch initial data for today
    generateReport(true);
  }, []);

  const fetchFilterOptions = async () => {
    try {
      const q = query(collection(db, 'students'));
      const querySnapshot = await getDocs(q);
      const grados = new Set<string>();
      const secciones = new Set<string>();
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.grado) grados.add(data.grado);
        if (data.seccion) secciones.add(data.seccion);
      });
      
      setGradosOptions(Array.from(grados).sort());
      setSeccionesOptions(Array.from(secciones).sort());
    } catch (error) {
      console.error("Error fetching filter options:", error);
    }
  };

  const procesarFaltas = async () => {
    if (!window.confirm('¿Estás seguro de procesar las faltas para el día de hoy? Esto marcará como "faltante" a todos los estudiantes que no hayan registrado entrada hoy.')) return;
    
    setIsProcessingFaltas(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      // 1. Get all students
      const studentsSnap = await getDocs(collection(db, 'students'));
      const allStudents = studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      // 2. Get all attendances for today
      const attendanceQ = query(
        collection(db, 'attendance'),
        where('timestamp', '>=', today),
        where('timestamp', '<=', endOfDay),
        where('type', '==', 'entrada')
      );
      const attendanceSnap = await getDocs(attendanceQ);
      
      const attendedStudentIds = new Set();
      attendanceSnap.forEach(doc => {
        attendedStudentIds.add(doc.data().studentRef);
      });

      // 3. Find missing students and create "faltante" records
      let addedCount = 0;
      for (const student of allStudents) {
        if (!attendedStudentIds.has(student.id)) {
          await addDoc(collection(db, 'attendance'), {
            uid: auth.currentUser?.uid || 'system',
            studentRef: student.id,
            studentName: `${student.nombres} ${student.apellidoPaterno} ${student.apellidoMaterno}`,
            studentDni: student.dni,
            grado: student.grado,
            seccion: student.seccion,
            avatarUrl: student.avatarUrl || null,
            timestamp: serverTimestamp(),
            type: 'entrada',
            status: 'faltante'
          });
          addedCount++;
        }
      }

      alert(`Se han registrado ${addedCount} faltas para el día de hoy.`);
      generateReport(); // Refresh report
    } catch (error) {
      console.error("Error procesando faltas:", error);
      alert("Hubo un error al procesar las faltas.");
    } finally {
      setIsProcessingFaltas(false);
    }
  };

  const generateReport = async (useCurrentState = false) => {
    setIsLoading(true);
    try {
      let q;
      
      if (date) {
        // Start and end of the selected day in local time
        const [year, month, day] = date.split('-').map(Number);
        const startDate = new Date(year, month - 1, day);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(year, month - 1, day);
        endDate.setHours(23, 59, 59, 999);

        q = query(
          collection(db, 'attendance'),
          where('timestamp', '>=', startDate),
          where('timestamp', '<=', endDate),
          orderBy('timestamp', 'desc'),
          limit(1000)
        );
      } else {
        // No date filter, get all records ordered by timestamp
        q = query(
          collection(db, 'attendance'),
          orderBy('timestamp', 'desc'),
          limit(1000)
        );
      }

      const querySnapshot = await getDocs(q);
      let logs = querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));

      // Filter by grado and seccion if selected
      if (grado) {
        logs = logs.filter(log => log.grado === grado);
      }
      if (seccion) {
        logs = logs.filter(log => log.seccion === seccion);
      }
      if (estado) {
        logs = logs.filter(log => {
          if (estado === 'A') return log.status === 'presente';
          if (estado === 'T') return log.status === 'tarde';
          if (estado === 'F') return log.status === 'faltante' || log.status === 'ausente';
          return true;
        });
      }
      if (registrarRole) {
        logs = logs.filter(log => log.registrarRole === registrarRole);
      }

      setReportData(logs);
      setVisibleCount(20);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'attendance');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadExcel = () => {
    if (reportData.length === 0) return;

    const getStatusInitial = (status: string) => {
      if (status === 'presente') return '(A)';
      if (status === 'tarde') return '(T)';
      if (status === 'faltante' || status === 'ausente') return '(F)';
      return status;
    };

    const dataToExport = reportData.map(log => ({
      'Fecha': format(log.timestamp.toDate(), 'dd/MM/yyyy'),
      'Hora': format(log.timestamp.toDate(), 'HH:mm:ss'),
      'Estudiante': log.studentName,
      'DNI': log.studentDni,
      'Grado': log.grado || '-',
      'Sección': log.seccion || '-',
      'Tipo': log.type === 'entrada' ? 'Entrada' : 'Salida',
      'Estado': getStatusInitial(log.status),
      'Registrado Por': log.registrarName || 'Desconocido',
      'Rol': log.registrarRole === 'admin' ? 'Administrador' : (log.registrarRole === 'teacher' ? 'Profesor' : 'Desconocido')
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Asistencia");
    XLSX.writeFile(wb, `Reporte_Asistencia_${date || 'Todos'}.xlsx`);
  };

  return (
    <div className="px-6 py-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-on-surface mb-2">Reportes</h1>
          <p className="text-on-surface-variant text-lg">Genera reportes de asistencia para control interno.</p>
        </div>
        <div>
          <button 
            onClick={procesarFaltas}
            disabled={isProcessingFaltas}
            className="px-6 py-3 bg-error text-on-error font-bold rounded-xl shadow-sm hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm">rule</span>
            {isProcessingFaltas ? 'Procesando...' : 'Procesar Faltas de Hoy'}
          </button>
        </div>
      </div>

      <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/20 shadow-sm">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">filter_alt</span>
          Filtros de Reporte
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Fecha</label>
            <input 
              type="date" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-surface-container-highest border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Grado</label>
            <select 
              value={grado}
              onChange={(e) => setGrado(e.target.value)}
              className="w-full bg-surface-container-highest border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
            >
              <option value="">Todos</option>
              {gradosOptions.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Sección</label>
            <select 
              value={seccion}
              onChange={(e) => setSeccion(e.target.value)}
              className="w-full bg-surface-container-highest border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
            >
              <option value="">Todas</option>
              {seccionesOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Estado</label>
            <select 
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="w-full bg-surface-container-highest border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
            >
              <option value="">Todos</option>
              <option value="A">(A) Temprano</option>
              <option value="T">(T) Tardanza</option>
              <option value="F">(F) Falto</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Registrado Por</label>
            <select 
              value={registrarRole}
              onChange={(e) => setRegistrarRole(e.target.value)}
              className="w-full bg-surface-container-highest border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
            >
              <option value="">Todos</option>
              <option value="admin">Administrador</option>
              <option value="teacher">Profesor</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => generateReport()}
              disabled={isLoading}
              className="flex-1 py-3 bg-primary text-on-primary font-bold rounded-xl shadow-sm hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm">search</span>
              Generar
            </button>
            <button 
              onClick={downloadExcel}
              disabled={reportData.length === 0}
              className="py-3 px-4 bg-secondary-container text-on-secondary-container font-bold rounded-xl shadow-sm hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              title="Descargar Excel"
            >
              <span className="material-symbols-outlined text-sm">download</span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-low/50">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">list_alt</span>
            Resultados del Reporte
          </h3>
          <span className="text-sm font-medium text-on-surface-variant bg-surface-container-highest px-3 py-1 rounded-full">
            {reportData.length} registros
          </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-on-surface-variant uppercase bg-surface-container-low/30">
              <tr>
                <th className="px-6 py-4 font-bold tracking-wider">Fecha</th>
                <th className="px-6 py-4 font-bold tracking-wider">Hora</th>
                <th className="px-6 py-4 font-bold tracking-wider">Estudiante</th>
                <th className="px-6 py-4 font-bold tracking-wider">DNI</th>
                <th className="px-6 py-4 font-bold tracking-wider">Grado/Sección</th>
                <th className="px-6 py-4 font-bold tracking-wider">Tipo</th>
                <th className="px-6 py-4 font-bold tracking-wider">Estado</th>
                <th className="px-6 py-4 font-bold tracking-wider">Registrado Por</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-on-surface-variant">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    Generando reporte...
                  </td>
                </tr>
              ) : reportData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-on-surface-variant">
                    <span className="material-symbols-outlined text-4xl mb-2 opacity-50">search_off</span>
                    <p>No se encontraron registros para los filtros seleccionados.</p>
                  </td>
                </tr>
              ) : (
                reportData.slice(0, visibleCount).map((log) => (
                  <tr key={log.id} className="hover:bg-surface-container-highest/20 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs">
                      {format(log.timestamp.toDate(), 'dd/MM/yyyy')}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">
                      {format(log.timestamp.toDate(), 'HH:mm:ss')}
                    </td>
                    <td className="px-6 py-4 font-medium text-on-surface">
                      {log.studentName}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-on-surface-variant">
                      {log.studentDni}
                    </td>
                    <td className="px-6 py-4">
                      {log.grado || '-'} / {log.seccion || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        log.type === 'entrada' 
                          ? 'bg-primary-container text-on-primary-container' 
                          : 'bg-secondary-container text-on-secondary-container'
                      }`}>
                        <span className="material-symbols-outlined text-[12px]">
                          {log.type === 'entrada' ? 'login' : 'logout'}
                        </span>
                        {log.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${
                        log.status === 'presente' ? 'bg-green-100 text-green-700' :
                        log.status === 'tarde' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {log.status === 'presente' ? 'A' : log.status === 'tarde' ? 'T' : 'F'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-on-surface">{log.registrarName || 'Desconocido'}</span>
                        <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">
                          {log.registrarRole === 'admin' ? 'Administrador' : (log.registrarRole === 'teacher' ? 'Profesor' : 'Desconocido')}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          
          {reportData.length > visibleCount && (
            <div className="p-4 flex justify-center bg-surface-container-low/30 border-t border-outline-variant/10">
              <button
                onClick={() => setVisibleCount(prev => prev + 20)}
                className="px-6 py-2.5 bg-secondary-container text-on-secondary-container font-semibold rounded-lg shadow-sm hover:opacity-90 transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">expand_more</span>
                Cargar más registros ({reportData.length - visibleCount} restantes)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
