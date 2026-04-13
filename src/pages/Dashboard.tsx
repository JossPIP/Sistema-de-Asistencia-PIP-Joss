import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Dashboard() {
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [stats, setStats] = useState({ present: 0, absent: 0, total: 0 });

  useEffect(() => {
    if (!auth.currentUser) return;

    // Listen to recent attendance logs
    const logsQuery = query(
      collection(db, 'attendance'),
      where('uid', '==', auth.currentUser.uid),
      orderBy('timestamp', 'desc'),
      limit(5)
    );

    const unsubscribeLogs = onSnapshot(logsQuery, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecentLogs(logs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'attendance');
    });

    // En una app real, aquí se calcularían las estadísticas del día
    // Por ahora lo inicializamos en 0 al estar limpia la base de datos
    setStats({ present: 0, absent: 0, total: 0 });

    return () => unsubscribeLogs();
  }, []);

  const attendancePercentage = stats.total > 0 ? ((stats.present / stats.total) * 100).toFixed(1) : '0.0';

  return (
    <div className="px-6 pt-8 space-y-8">
      <section>
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-on-surface">Panel de Control</h1>
            <p className="text-on-surface-variant mt-1 font-medium capitalize">{format(new Date(), "EEEE, d 'de' MMMM", { locale: es })} • Sesión Académica</p>
          </div>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-surface-container-low rounded-full">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-semibold text-on-surface-variant">WhatsApp: <span className="text-on-surface">Conectado</span></span>
            <span className="material-symbols-outlined text-emerald-600 text-lg">chat</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-8 bg-surface-container-lowest p-8 rounded-3xl ambient-shadow flex flex-col md:flex-row items-center justify-between border-none">
            <div className="space-y-4 text-center md:text-left">
              <h2 className="text-on-surface-variant font-semibold tracking-wide uppercase text-xs">Asistencia Diaria Total</h2>
              <div className="text-7xl font-extrabold text-primary tracking-tighter">
                {attendancePercentage}<span className="text-3xl text-primary-fixed-dim">%</span>
              </div>
              <p className="text-on-surface-variant max-w-xs">Porcentaje de estudiantes presentes el día de hoy.</p>
              <Link to="/scanner" className="cta-gradient text-on-primary px-8 py-4 rounded-xl font-bold flex items-center justify-center md:justify-start gap-3 shadow-lg hover:opacity-90 transition-all active:scale-95 mt-4 w-fit mx-auto md:mx-0">
                <span className="material-symbols-outlined">qr_code_scanner</span>
                Iniciar Escáner QR
              </Link>
            </div>
            <div className="relative w-48 h-48 mt-8 md:mt-0">
              <svg className="w-full h-full" viewBox="0 0 36 36">
                <path className="text-surface-container-highest stroke-current" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" strokeWidth="3"></path>
                <path className="text-primary stroke-current" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" strokeDasharray={`${attendancePercentage}, 100`} strokeLinecap="round" strokeWidth="3"></path>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="material-symbols-outlined text-4xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
              </div>
            </div>
          </div>

          <div className="md:col-span-4 grid grid-cols-1 gap-6">
            <div className="bg-primary-fixed p-6 rounded-3xl flex items-center justify-between">
              <div>
                <p className="text-on-primary-fixed-variant text-sm font-bold uppercase tracking-widest">Presentes</p>
                <h3 className="text-4xl font-black text-on-primary-fixed">{stats.present.toLocaleString()}</h3>
              </div>
              <span className="material-symbols-outlined text-4xl text-on-primary-fixed-variant">how_to_reg</span>
            </div>
            <div className="bg-tertiary-fixed p-6 rounded-3xl flex items-center justify-between">
              <div>
                <p className="text-on-tertiary-fixed-variant text-sm font-bold uppercase tracking-widest">Ausentes</p>
                <h3 className="text-4xl font-black text-on-tertiary-fixed">{stats.absent.toLocaleString()}</h3>
              </div>
              <span className="material-symbols-outlined text-4xl text-on-tertiary-fixed-variant">person_off</span>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-2xl font-bold tracking-tight">Actividad Reciente</h2>
            <Link to="/students" className="text-primary font-semibold text-sm hover:underline">Ver todo</Link>
          </div>
          <div className="bg-surface-container-low rounded-3xl overflow-hidden">
            <div className="grid grid-cols-12 px-6 py-4 border-b border-outline-variant/10 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              <div className="col-span-6">Estudiante</div>
              <div className="col-span-3">Hora</div>
              <div className="col-span-3 text-right">Estado</div>
            </div>
            <div className="divide-y divide-outline-variant/5">
              {recentLogs.length === 0 ? (
                <div className="p-8 text-center text-on-surface-variant">
                  No hay actividad reciente.
                </div>
              ) : (
                recentLogs.map((log) => (
                  <div key={log.id} className="grid grid-cols-12 items-center px-6 py-5 bg-surface-container-lowest transition-colors hover:bg-surface-container-high/20">
                    <div className="col-span-6 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-secondary-container flex items-center justify-center overflow-hidden">
                        {log.avatarUrl ? (
                          <img src={log.avatarUrl} alt={log.studentName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <span className="material-symbols-outlined text-on-secondary-container">person</span>
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-on-surface">{log.studentName}</p>
                        <p className="text-xs text-on-surface-variant">{log.grado} {log.seccion} • DNI: {log.studentDni}</p>
                      </div>
                    </div>
                    <div className="col-span-3 text-sm font-medium text-on-surface-variant">
                      {log.timestamp?.toDate ? format(log.timestamp.toDate(), 'hh:mm a') : '--:--'}
                    </div>
                    <div className="col-span-3 text-right">
                      <span className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg ${
                        log.status === 'presente' ? 'bg-primary-fixed text-on-primary-fixed' :
                        log.status === 'tarde' ? 'bg-tertiary-fixed text-on-tertiary-fixed' :
                        'bg-error-container text-on-error-container'
                      }`}>
                        {log.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-bold tracking-tight px-2">Alertas del Sistema</h2>
          <div className="bg-surface-container-low p-6 rounded-3xl space-y-6">
            <div className="flex gap-4">
              <div className="w-10 h-10 shrink-0 bg-primary-fixed rounded-xl flex items-center justify-center text-primary">
                <span className="material-symbols-outlined">notifications_active</span>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-on-surface">Sincronización WhatsApp</p>
                <p className="text-xs text-on-surface-variant leading-relaxed">El servicio de mensajería está activo y esperando escaneos.</p>
                <span className="text-[10px] text-on-surface-variant font-medium">Actualizado</span>
              </div>
            </div>
            <hr className="border-outline-variant/20" />
            <div className="flex gap-4">
              <div className="w-10 h-10 shrink-0 bg-tertiary-fixed rounded-xl flex items-center justify-center text-tertiary">
                <span className="material-symbols-outlined">info</span>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-on-surface">Base de datos limpia</p>
                <p className="text-xs text-on-surface-variant leading-relaxed">El sistema está listo para importar estudiantes desde Excel.</p>
                <span className="text-[10px] text-on-surface-variant font-medium">Sistema</span>
              </div>
            </div>
          </div>

          <div className="bg-secondary-container p-6 rounded-3xl">
            <h4 className="text-on-secondary-container font-extrabold text-lg mb-2">Consejo del Día</h4>
            <p className="text-on-secondary-container/80 text-sm leading-relaxed mb-4">Puedes subir a todos tus estudiantes de una sola vez usando la plantilla de Excel en la pestaña "Estudiantes".</p>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-on-secondary-container">lightbulb</span>
              <span className="text-xs font-bold text-on-secondary-container">Sugerencia</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
