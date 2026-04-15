import React, { useState, useEffect } from 'react';
import { collection, getDocs, setDoc, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, secondaryAuth, handleFirestoreError, OperationType, logout } from '../firebase';

export default function Settings() {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [newTeacher, setNewTeacher] = useState({ username: '', password: '', name: '' });
  const [editingTeacher, setEditingTeacher] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  
  const [attendanceRules, setAttendanceRules] = useState({ lateTime: '08:30', absentTime: '10:00' });
  const [isSavingRules, setIsSavingRules] = useState(false);
  const [rulesMessage, setRulesMessage] = useState('');

  useEffect(() => {
    fetchTeachers();
    fetchAttendanceRules();
  }, []);

  const fetchAttendanceRules = async () => {
    try {
      const docRef = doc(db, 'settings', 'attendanceRules');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setAttendanceRules(docSnap.data() as any);
      }
    } catch (error) {
      console.error("Error fetching rules:", error);
    }
  };

  const handleSaveRules = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingRules(true);
    setRulesMessage('');
    try {
      await setDoc(doc(db, 'settings', 'attendanceRules'), attendanceRules);
      setRulesMessage('Reglas guardadas correctamente.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings');
      setRulesMessage('Error al guardar.');
    } finally {
      setIsSavingRules(false);
      setTimeout(() => setRulesMessage(''), 3000);
    }
  };

  const fetchTeachers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const teacherData = querySnapshot.docs
        .map(doc => ({ id: doc.id, ...(doc.data() as any) }))
        .filter((user: any) => user.role === 'teacher');
      setTeachers(teacherData);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'users');
    }
  };

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage('');
    
    try {
      if (editingTeacher) {
        // Update existing teacher in Firestore
        await setDoc(doc(db, 'users', editingTeacher.id), {
          ...editingTeacher,
          username: newTeacher.username,
          name: newTeacher.name,
        }, { merge: true });
        setMessage('Profesor actualizado correctamente.');
      } else {
        const email = `${newTeacher.username}@digitalregistrar.app`;
        // Create user in secondary auth instance so current admin doesn't get logged out
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, newTeacher.password);
        
        // Save to users collection
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          uid: userCredential.user.uid,
          username: newTeacher.username,
          name: newTeacher.name,
          role: 'teacher'
        });
        setMessage('Profesor registrado correctamente.');
      }

      setNewTeacher({ username: '', password: '', name: '' });
      setEditingTeacher(null);
      fetchTeachers();
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/email-already-in-use') {
        setMessage('El usuario ya existe.');
      } else {
        setMessage(editingTeacher ? 'Error al actualizar profesor.' : 'Error al registrar profesor.');
      }
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleEditClick = (teacher: any) => {
    setEditingTeacher(teacher);
    setNewTeacher({ username: teacher.username, password: '', name: teacher.name });
  };

  const handleCancelEdit = () => {
    setEditingTeacher(null);
    setNewTeacher({ username: '', password: '', name: '' });
  };

  const handleDeleteTeacher = async (uid: string) => {
    if (!window.confirm('¿Estás seguro de eliminar a este profesor? (Solo se eliminará de la base de datos, no de Auth)')) return;
    try {
      await deleteDoc(doc(db, 'users', uid));
      fetchTeachers();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'users');
    }
  };

  return (
    <div className="px-6 py-8 space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-on-surface mb-2">Ajustes</h1>
          <p className="text-on-surface-variant text-lg">Configura las reglas de asistencia y gestiona accesos.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={logout}
            className="px-6 py-2.5 bg-surface-container-highest text-on-surface-variant font-semibold rounded-lg shadow-sm hover:bg-surface-variant transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">logout</span>
            Cerrar Sesión
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-12 bg-surface-container-low rounded-xl p-6 border-0 h-fit">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-tertiary/10 flex items-center justify-center text-tertiary">
              <span className="material-symbols-outlined">schedule</span>
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Reglas de Asistencia</h2>
              <p className="text-sm text-on-surface-variant">Define los horarios para tardanzas y faltas automáticas.</p>
            </div>
          </div>

          <form onSubmit={handleSaveRules} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Hora Límite (Temprano)</label>
              <input 
                type="time" 
                value={attendanceRules.lateTime}
                onChange={(e) => setAttendanceRules({...attendanceRules, lateTime: e.target.value})}
                className="w-full bg-surface-container-highest border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Hora Límite (Tardanza)</label>
              <input 
                type="time" 
                value={attendanceRules.absentTime}
                onChange={(e) => setAttendanceRules({...attendanceRules, absentTime: e.target.value})}
                className="w-full bg-surface-container-highest border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                required
              />
            </div>
            <div>
              <button 
                type="submit"
                disabled={isSavingRules}
                className="w-full py-3 bg-tertiary text-on-primary font-semibold rounded-xl shadow-sm hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">save</span>
                {isSavingRules ? 'Guardando...' : 'Guardar Reglas'}
              </button>
            </div>
          </form>
          {rulesMessage && (
            <div className="mt-4 p-3 bg-tertiary-container text-on-tertiary-container rounded-lg text-sm font-medium">
              {rulesMessage}
            </div>
          )}
        </section>

        <section className="lg:col-span-5 bg-surface-container-low rounded-xl p-6 border-0 h-fit">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined">{editingTeacher ? 'edit' : 'person_add'}</span>
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">{editingTeacher ? 'Editar Profesor' : 'Nuevo Profesor'}</h2>
              <p className="text-sm text-on-surface-variant">{editingTeacher ? 'Modifica los datos del acceso.' : 'Crea un acceso para escanear.'}</p>
            </div>
          </div>

          <form onSubmit={handleAddTeacher} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Nombre Completo</label>
              <input 
                type="text" 
                value={newTeacher.name}
                onChange={(e) => setNewTeacher({...newTeacher, name: e.target.value})}
                className="w-full bg-surface-container-highest border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="Ej: Juan Pérez"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Usuario</label>
              <input 
                type="text" 
                value={newTeacher.username}
                onChange={(e) => setNewTeacher({...newTeacher, username: e.target.value})}
                className="w-full bg-surface-container-highest border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="Ej: juanperez"
                required
              />
            </div>
            {!editingTeacher && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Contraseña</label>
                <input 
                  type="password" 
                  value={newTeacher.password}
                  onChange={(e) => setNewTeacher({...newTeacher, password: e.target.value})}
                  className="w-full bg-surface-container-highest border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                />
              </div>
            )}
            
            {message && (
              <div className="p-3 bg-primary-container text-on-primary-container rounded-lg text-sm font-medium">
                {message}
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button 
                type="submit"
                disabled={isSaving}
                className="flex-1 py-3 cta-gradient text-on-primary font-semibold rounded-xl shadow-sm hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">{editingTeacher ? 'save' : 'add'}</span>
                {isSaving ? (editingTeacher ? 'Guardando...' : 'Registrando...') : (editingTeacher ? 'Guardar Cambios' : 'Registrar Profesor')}
              </button>
              {editingTeacher && (
                <button 
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-4 py-3 bg-surface-container-highest text-on-surface-variant font-semibold rounded-xl shadow-sm hover:bg-surface-variant transition-all flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="lg:col-span-7 bg-surface-container-low rounded-xl p-6 flex flex-col">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined">badge</span>
            </div>
            <h2 className="text-lg font-bold tracking-tight">Profesores Registrados</h2>
          </div>

          <div className="bg-surface-container-lowest rounded-xl flex-grow overflow-hidden border border-outline-variant/10">
            {teachers.length === 0 ? (
              <div className="p-8 text-center text-on-surface-variant flex flex-col items-center">
                <span className="material-symbols-outlined text-4xl mb-2 opacity-50">group_off</span>
                <p>No hay profesores registrados aún.</p>
              </div>
            ) : (
              <div className="divide-y divide-outline-variant/10">
                {teachers.map(teacher => (
                  <div key={teacher.id} className="p-4 flex items-center justify-between hover:bg-surface-container-highest/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold">
                        {teacher.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-on-surface">{teacher.name}</p>
                        <p className="text-xs text-on-surface-variant font-mono">Usuario: {teacher.username}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => handleEditClick(teacher)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-primary hover:bg-primary/10 transition-colors"
                        title="Editar acceso"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                      <button 
                        onClick={() => handleDeleteTeacher(teacher.id)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-error hover:bg-error/10 transition-colors"
                        title="Eliminar acceso"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
