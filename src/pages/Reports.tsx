import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';

export default function Reports() {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [grado, setGrado] = useState('');
  const [seccion, setSeccion] = useState('');
  const [reportData, setReportData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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

  const generateReport = async (useCurrentState = false) => {
    setIsLoading(true);
    try {
      let q;
      
      if (date) {
        // Start and end of the selected day
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);

        q = query(
          collection(db, 'attendance'),
          where('timestamp', '>=', startDate),
          where('timestamp', '<=', endDate),
          orderBy('timestamp', 'desc')
        );
      } else {
        // No date filter, get all records ordered by timestamp
        q = query(
          collection(db, 'attendance'),
          orderBy('timestamp', 'desc')
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

      setReportData(logs);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'attendance');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadExcel = () => {
    if (reportData.length === 0) return;

    const dataToExport = reportData.map(log => ({
      'Fecha': format(log.timestamp.toDate(), 'dd/MM/yyyy'),
      'Hora': format(log.timestamp.toDate(), 'HH:mm:ss'),
      'Estudiante': log.studentName,
      'DNI': log.studentDni,
      'Grado': log.grado || '-',
      'Sección': log.seccion || '-',
      'Tipo': log.type === 'entrada' ? 'Entrada' : 'Salida',
      'Estado': log.status
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
      </div>

      <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/20 shadow-sm">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">filter_alt</span>
          Filtros de Reporte
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Fecha (Opcional)</label>
            <input 
              type="date" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-surface-container-highest border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Grado (Opcional)</label>
            <select 
              value={grado}
              onChange={(e) => setGrado(e.target.value)}
              className="w-full bg-surface-container-highest border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
            >
              <option value="">Todos los grados</option>
              {gradosOptions.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Sección (Opcional)</label>
            <select 
              value={seccion}
              onChange={(e) => setSeccion(e.target.value)}
              className="w-full bg-surface-container-highest border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
            >
              <option value="">Todas las secciones</option>
              {seccionesOptions.map(s => <option key={s} value={s}>{s}</option>)}
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
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    Generando reporte...
                  </td>
                </tr>
              ) : reportData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant">
                    <span className="material-symbols-outlined text-4xl mb-2 opacity-50">search_off</span>
                    <p>No se encontraron registros para los filtros seleccionados.</p>
                  </td>
                </tr>
              ) : (
                reportData.map((log) => (
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
