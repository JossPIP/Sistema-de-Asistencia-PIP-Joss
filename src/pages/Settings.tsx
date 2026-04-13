import React, { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType, logout } from '../firebase';

export default function Settings() {
  const [settings, setSettings] = useState({
    whatsappApiKey: '••••••••••••••••',
    whatsappInstanceId: 'REG-4492-WA',
    entryTemplate: 'Hola, [Alumno] ha ingresado a la escuela exitosamente a las [Hora]. ¡Que tenga un excelente día!',
    exitTemplate: 'Aviso: [Alumno] ha salido de las instalaciones escolares a las [Hora].'
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;
    
    const docRef = doc(db, 'settings', auth.currentUser.uid);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setSettings(prev => ({ ...prev, ...docSnap.data() }));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings');
    });

    return () => unsubscribe();
  }, []);

  const handleSave = async () => {
    if (!auth.currentUser) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'settings', auth.currentUser.uid), {
        uid: auth.currentUser.uid,
        ...settings
      }, { merge: true });
      alert("Ajustes guardados correctamente.");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="px-6 py-8 space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-on-surface mb-2">Ajustes</h1>
          <p className="text-on-surface-variant text-lg">Gestiona las comunicaciones y la sincronización del sistema.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={logout}
            className="px-6 py-2.5 bg-surface-container-highest text-on-surface-variant font-semibold rounded-lg shadow-sm hover:bg-surface-variant transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">logout</span>
            Cerrar Sesión
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 cta-gradient text-on-primary font-semibold rounded-lg shadow-sm hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm">save</span>
            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-8 bg-surface-container-low rounded-xl p-6 border-0">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined">hub</span>
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Puerta de Enlace WhatsApp</h2>
              <p className="text-sm text-on-surface-variant">Configura la conexión API para alertas automáticas.</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-surface-container-lowest p-6 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-on-surface">Estado de Conexión</label>
                <span className="px-3 py-1 bg-primary-fixed text-on-primary-fixed-variant text-xs font-bold rounded-full uppercase tracking-wider">Conectado</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-widest text-on-surface-variant">API Key</label>
                  <input 
                    type="password" 
                    value={settings.whatsappApiKey}
                    onChange={e => setSettings({...settings, whatsappApiKey: e.target.value})}
                    className="w-full bg-surface-container-highest border-0 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-widest text-on-surface-variant">ID de Instancia</label>
                  <input 
                    type="text" 
                    value={settings.whatsappInstanceId}
                    onChange={e => setSettings({...settings, whatsappInstanceId: e.target.value})}
                    className="w-full bg-surface-container-highest border-0 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all" 
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between bg-surface-container-lowest p-4 rounded-xl">
              <div className="flex gap-3">
                <span className="material-symbols-outlined text-on-surface-variant">notifications_active</span>
                <div>
                  <p className="font-medium text-sm">Reportes de Entrega en Tiempo Real</p>
                  <p className="text-xs text-on-surface-variant">Registra el estado del mensaje directamente en los registros del estudiante.</p>
                </div>
              </div>
              <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                <input type="checkbox" name="toggle" id="toggle1" className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer right-0 border-primary" defaultChecked />
                <label htmlFor="toggle1" className="toggle-label block overflow-hidden h-6 rounded-full bg-primary-fixed cursor-pointer"></label>
              </div>
            </div>
          </div>
        </section>

        <section className="lg:col-span-4 bg-surface-container-low rounded-xl p-6 flex flex-col">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined">sync</span>
            </div>
            <h2 className="text-lg font-bold tracking-tight">Sincronización de BD</h2>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-5 mb-6 flex-grow">
            <div className="space-y-4">
              <div className="p-3 bg-surface-container rounded-lg">
                <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Última Sincronización</p>
                <p className="text-sm font-semibold">Hoy, 08:42 AM</p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-on-surface-variant">Intervalo automático</span>
                  <span className="font-medium">15 min</span>
                </div>
                <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
                  <div className="bg-primary h-full w-3/4"></div>
                </div>
              </div>
              <button className="w-full py-3 bg-secondary-container text-on-secondary-container rounded-lg font-bold text-sm hover:brightness-95 transition-all">
                Forzar Sincronización
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Copia de Seguridad en la Nube</span>
              <div className="relative inline-block w-10 align-middle select-none transition duration-200 ease-in">
                <input type="checkbox" name="toggle" id="toggle2" className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer right-0 border-primary" defaultChecked />
                <label htmlFor="toggle2" className="toggle-label block overflow-hidden h-6 rounded-full bg-primary-fixed cursor-pointer"></label>
              </div>
            </div>
          </div>
        </section>

        <section className="lg:col-span-12 bg-surface-container-low rounded-xl p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-tertiary/10 flex items-center justify-center text-tertiary">
                <span className="material-symbols-outlined">description</span>
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight">Plantillas de Mensajes</h2>
                <p className="text-sm text-on-surface-variant">Personaliza lo que reciben los padres al registrar entrada/salida.</p>
              </div>
            </div>
            <button className="text-primary font-bold text-sm flex items-center gap-1 hover:underline">
              <span className="material-symbols-outlined text-sm">add</span>
              Nueva Plantilla
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4 bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/10 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-xl">login</span>
                  Notificación de Entrada
                </h3>
                <span className="text-[10px] bg-tertiary-container/10 text-tertiary px-2 py-0.5 rounded font-bold uppercase">Activo</span>
              </div>
              <div className="relative">
                <textarea 
                  className="w-full bg-surface-container-low border-0 rounded-xl p-4 text-sm resize-none focus:ring-2 focus:ring-primary/20" 
                  rows={4}
                  value={settings.entryTemplate}
                  onChange={e => setSettings({...settings, entryTemplate: e.target.value})}
                />
                <div className="absolute bottom-3 right-3 flex gap-2">
                  <span className="px-2 py-1 bg-surface-container-highest text-[10px] font-mono rounded text-on-surface-variant">[Alumno]</span>
                  <span className="px-2 py-1 bg-surface-container-highest text-[10px] font-mono rounded text-on-surface-variant">[Hora]</span>
                </div>
              </div>
            </div>

            <div className="space-y-4 bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/10 shadow-sm opacity-80">
              <div className="flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-on-surface-variant text-xl">logout</span>
                  Notificación de Salida
                </h3>
                <span className="text-[10px] bg-outline-variant/20 text-on-surface-variant px-2 py-0.5 rounded font-bold uppercase">Borrador</span>
              </div>
              <div className="relative">
                <textarea 
                  className="w-full bg-surface-container-low border-0 rounded-xl p-4 text-sm resize-none focus:ring-2 focus:ring-primary/20" 
                  rows={4}
                  value={settings.exitTemplate}
                  onChange={e => setSettings({...settings, exitTemplate: e.target.value})}
                />
                <div className="absolute bottom-3 right-3 flex gap-2">
                  <span className="px-2 py-1 bg-surface-container-highest text-[10px] font-mono rounded text-on-surface-variant">[Alumno]</span>
                  <span className="px-2 py-1 bg-surface-container-highest text-[10px] font-mono rounded text-on-surface-variant">[Hora]</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
