import React, { useState, useEffect, useRef } from 'react';
import { collection, query, onSnapshot, addDoc, serverTimestamp, writeBatch, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import * as XLSX from 'xlsx';

export default function Students() {
  const [students, setStudents] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newStudent, setNewStudent] = useState({
    dni: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    nombres: '',
    genero: 'M',
    celular: '',
    grado: '',
    seccion: '',
    callMeBotApiKey: ''
  });

  useEffect(() => {
    if (!auth.currentUser) return;
    
    const q = query(collection(db, 'students'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const studentData = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      const myStudents = studentData.filter(s => s.uid === auth.currentUser?.uid);
      setStudents(myStudents);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'students');
    });

    return () => unsubscribe();
  }, []);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    try {
      await addDoc(collection(db, 'students'), {
        uid: auth.currentUser.uid,
        ...newStudent,
        avatarUrl: `https://api.dicebear.com/9.x/avataaars/svg?seed=${newStudent.dni}`,
        createdAt: serverTimestamp()
      });
      setIsAdding(false);
      setNewStudent({ dni: '', apellidoPaterno: '', apellidoMaterno: '', nombres: '', genero: 'M', celular: '', grado: '', seccion: '', callMeBotApiKey: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'students');
    }
  };

  const startEditing = (student: any) => {
    setEditingId(student.id);
    setEditFormData({
      dni: student.dni || '',
      apellidoPaterno: student.apellidoPaterno || '',
      apellidoMaterno: student.apellidoMaterno || '',
      nombres: student.nombres || '',
      grado: student.grado || '',
      seccion: student.seccion || '',
      celular: student.celular || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    try {
      await updateDoc(doc(db, 'students', editingId), {
        dni: editFormData.dni,
        apellidoPaterno: editFormData.apellidoPaterno,
        apellidoMaterno: editFormData.apellidoMaterno,
        nombres: editFormData.nombres,
        grado: editFormData.grado,
        seccion: editFormData.seccion,
        celular: editFormData.celular,
      });
      setEditingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'students');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([{
      DNI: '12345678',
      'Apellido Paterno': 'Perez',
      'Apellido Materno': 'Gomez',
      Nombres: 'Juan Carlos',
      Genero: 'M',
      Celular: '+51987654321',
      Grado: '1ro Secundaria',
      Seccion: 'A',
      'CallMeBot API Key': '123456'
    }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
    XLSX.writeFile(wb, "Plantilla_Estudiantes.xlsx");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !auth.currentUser) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        // Batch write to Firestore
        let batch = writeBatch(db);
        let count = 0;

        for (const row of data as any[]) {
          const docRef = doc(collection(db, 'students'));
          batch.set(docRef, {
            uid: auth.currentUser!.uid,
            dni: String(row['DNI'] || ''),
            apellidoPaterno: String(row['Apellido Paterno'] || ''),
            apellidoMaterno: String(row['Apellido Materno'] || ''),
            nombres: String(row['Nombres'] || ''),
            genero: String(row['Genero'] || 'M'),
            celular: String(row['Celular'] || ''),
            grado: String(row['Grado'] || ''),
            seccion: String(row['Seccion'] || ''),
            callMeBotApiKey: String(row['CallMeBot API Key'] || ''),
            avatarUrl: `https://api.dicebear.com/9.x/avataaars/svg?seed=${row['DNI']}`,
            createdAt: serverTimestamp()
          });

          count++;
          if (count === 400) { // Firestore batch limit is 500
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        }

        if (count > 0) {
          await batch.commit();
        }

        alert("¡Estudiantes importados correctamente!");
      } catch (error) {
        console.error(error);
        alert("Error al importar el archivo.");
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDownloadReport = () => {
    const exportData = filteredStudents.map(s => ({
      DNI: s.dni,
      'Apellido Paterno': s.apellidoPaterno,
      'Apellido Materno': s.apellidoMaterno,
      Nombres: s.nombres,
      Genero: s.genero,
      Celular: s.celular,
      Grado: s.grado,
      Seccion: s.seccion
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Estudiantes");
    XLSX.writeFile(wb, "Reporte_Estudiantes.xlsx");
  };

  const handleDeleteSelected = async () => {
    if (selectedStudents.size === 0) return;
    if (!window.confirm(`¿Estás seguro de eliminar ${selectedStudents.size} estudiante(s)?`)) return;

    try {
      let batch = writeBatch(db);
      let count = 0;

      for (const id of selectedStudents) {
        batch.delete(doc(db, 'students', id));
        count++;
        if (count === 400) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
      
      if (count > 0) {
        await batch.commit();
      }
      
      setSelectedStudents(new Set());
      alert("Estudiantes eliminados correctamente.");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'students');
    }
  };

  const toggleStudentSelection = (id: string) => {
    const newSelection = new Set(selectedStudents);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedStudents(newSelection);
  };

  const toggleAllSelection = () => {
    if (selectedStudents.size === filteredStudents.length && filteredStudents.length > 0) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(filteredStudents.map(s => s.id)));
    }
  };

  const filteredStudents = students.filter(s => 
    s.nombres.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.apellidoPaterno.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.dni.includes(searchTerm) ||
    s.grado.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="px-6 pt-8 pb-24 space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-on-surface">Directorio de Estudiantes</h1>
          <p className="text-on-surface-variant font-medium mt-1">{students.length} estudiantes registrados</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button 
            onClick={handleDownloadTemplate}
            className="px-4 py-2 bg-surface-container-highest text-on-surface-variant font-semibold rounded-lg text-sm hover:bg-surface-variant transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Plantilla
          </button>
          
          <input 
            type="file" 
            accept=".xlsx, .xls" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-4 py-2 bg-secondary-container text-on-secondary-container font-semibold rounded-lg text-sm hover:brightness-95 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm">upload</span>
            {isUploading ? 'Subiendo...' : 'Subir Excel'}
          </button>
          
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="px-4 py-2 cta-gradient text-on-primary font-semibold rounded-lg text-sm hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">{isAdding ? 'close' : 'add'}</span>
            {isAdding ? 'Cancelar' : 'Nuevo Estudiante'}
          </button>
        </div>
      </div>

      {isAdding && (
        <div className="bg-surface-container-lowest p-6 rounded-3xl ambient-shadow animate-in slide-in-from-top-4">
          <h2 className="text-xl font-bold mb-4">Añadir Nuevo Estudiante</h2>
          <form onSubmit={handleAddStudent} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input required placeholder="DNI" value={newStudent.dni} onChange={e => setNewStudent({...newStudent, dni: e.target.value})} className="bg-surface-container-highest border-0 rounded-xl px-4 py-3 text-sm" />
            <input required placeholder="Nombres" value={newStudent.nombres} onChange={e => setNewStudent({...newStudent, nombres: e.target.value})} className="bg-surface-container-highest border-0 rounded-xl px-4 py-3 text-sm" />
            <input required placeholder="Apellido Paterno" value={newStudent.apellidoPaterno} onChange={e => setNewStudent({...newStudent, apellidoPaterno: e.target.value})} className="bg-surface-container-highest border-0 rounded-xl px-4 py-3 text-sm" />
            <input required placeholder="Apellido Materno" value={newStudent.apellidoMaterno} onChange={e => setNewStudent({...newStudent, apellidoMaterno: e.target.value})} className="bg-surface-container-highest border-0 rounded-xl px-4 py-3 text-sm" />
            <select value={newStudent.genero} onChange={e => setNewStudent({...newStudent, genero: e.target.value})} className="bg-surface-container-highest border-0 rounded-xl px-4 py-3 text-sm">
              <option value="M">Masculino</option>
              <option value="F">Femenino</option>
            </select>
            <input required placeholder="Celular (ej: +51987654321)" value={newStudent.celular} onChange={e => setNewStudent({...newStudent, celular: e.target.value})} className="bg-surface-container-highest border-0 rounded-xl px-4 py-3 text-sm" />
            <input required placeholder="Grado" value={newStudent.grado} onChange={e => setNewStudent({...newStudent, grado: e.target.value})} className="bg-surface-container-highest border-0 rounded-xl px-4 py-3 text-sm" />
            <input required placeholder="Sección" value={newStudent.seccion} onChange={e => setNewStudent({...newStudent, seccion: e.target.value})} className="bg-surface-container-highest border-0 rounded-xl px-4 py-3 text-sm" />
            <input placeholder="CallMeBot API Key (Opcional)" value={newStudent.callMeBotApiKey} onChange={e => setNewStudent({...newStudent, callMeBotApiKey: e.target.value})} className="bg-surface-container-highest border-0 rounded-xl px-4 py-3 text-sm md:col-span-2" />
            <div className="md:col-span-2 flex justify-end mt-2">
              <button type="submit" className="px-6 py-3 bg-primary text-on-primary rounded-xl font-bold hover:bg-primary/90 transition-colors">Guardar Estudiante</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-surface-container-lowest rounded-3xl ambient-shadow overflow-hidden flex flex-col h-[600px]">
        <div className="p-4 border-b border-outline-variant/10 flex flex-col sm:flex-row gap-4 justify-between items-center bg-surface/50 backdrop-blur-sm">
          <div className="relative w-full sm:max-w-md">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
            <input 
              type="text" 
              placeholder="Buscar por nombre, DNI o grado..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-surface-container-high border-0 rounded-full pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
          <div className="flex gap-2">
            {selectedStudents.size > 0 && (
              <button 
                onClick={handleDeleteSelected}
                className="px-4 py-2 bg-error-container text-on-error-container font-semibold rounded-full text-sm hover:brightness-95 transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
                Eliminar ({selectedStudents.size})
              </button>
            )}
            <button 
              onClick={handleDownloadReport}
              className="px-4 py-2 bg-surface-container-high text-on-surface font-semibold rounded-full text-sm hover:bg-surface-variant transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-sm">description</span>
              Descargar
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="bg-surface-container-low/50 text-xs font-bold uppercase tracking-widest text-on-surface-variant sticky top-0 z-10 backdrop-blur-md">
              <tr>
                <th className="px-6 py-4 w-12 text-center">
                  <input 
                    type="checkbox" 
                    checked={selectedStudents.size === filteredStudents.length && filteredStudents.length > 0}
                    onChange={toggleAllSelection}
                    className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary cursor-pointer"
                  />
                </th>
                <th className="px-6 py-4">Estudiante</th>
                <th className="px-6 py-4 w-32">DNI</th>
                <th className="px-6 py-4 w-48">Grado / Sección</th>
                <th className="px-6 py-4 w-32 text-right">Contacto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-on-surface-variant">
                    <div className="flex flex-col items-center justify-center">
                      <span className="material-symbols-outlined text-6xl mb-4 opacity-50">search_off</span>
                      <p>No se encontraron estudiantes.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr key={student.id} className={`hover:bg-surface-container-high/20 transition-colors group ${selectedStudents.has(student.id) ? 'bg-primary/5' : ''}`}>
                    <td className="px-6 py-4 text-center">
                      <input 
                        type="checkbox" 
                        checked={selectedStudents.has(student.id)}
                        onChange={() => toggleStudentSelection(student.id)}
                        className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary cursor-pointer"
                      />
                    </td>
                    {editingId === student.id ? (
                      <>
                        <td className="px-6 py-4">
                          <div className="flex gap-2 mb-2">
                            <input value={editFormData.nombres} onChange={e => setEditFormData({...editFormData, nombres: e.target.value})} className="bg-surface-container-highest border text-sm border-outline-variant/30 rounded px-2 py-1 w-1/3" placeholder="Nombres" />
                            <input value={editFormData.apellidoPaterno} onChange={e => setEditFormData({...editFormData, apellidoPaterno: e.target.value})} className="bg-surface-container-highest border text-sm border-outline-variant/30 rounded px-2 py-1 w-1/3" placeholder="Paterno" />
                            <input value={editFormData.apellidoMaterno} onChange={e => setEditFormData({...editFormData, apellidoMaterno: e.target.value})} className="bg-surface-container-highest border text-sm border-outline-variant/30 rounded px-2 py-1 w-1/3" placeholder="Materno" />
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-mono">
                          <input value={editFormData.dni} onChange={e => setEditFormData({...editFormData, dni: e.target.value})} className="bg-surface-container-highest border border-outline-variant/30 rounded px-2 py-1 w-full" placeholder="DNI" />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <input value={editFormData.grado} onChange={e => setEditFormData({...editFormData, grado: e.target.value})} className="bg-surface-container-highest border text-sm border-outline-variant/30 rounded px-2 py-1 w-1/2" placeholder="Grado" />
                            <input value={editFormData.seccion} onChange={e => setEditFormData({...editFormData, seccion: e.target.value})} className="bg-surface-container-highest border text-sm border-outline-variant/30 rounded px-2 py-1 w-1/2" placeholder="Sección" />
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right flex flex-col gap-2 relative">
                          <input value={editFormData.celular} onChange={e => setEditFormData({...editFormData, celular: e.target.value})} className="bg-surface-container-highest border text-sm border-outline-variant/30 rounded px-2 py-1 w-full" placeholder="Celular" />
                          <div className="flex justify-end gap-2 mt-2">
                            <button onClick={handleSaveEdit} className="p-1 bg-primary text-on-primary rounded hover:opacity-90">
                              <span className="material-symbols-outlined text-sm">check</span>
                            </button>
                            <button onClick={handleCancelEdit} className="p-1 bg-surface-container-high text-on-surface rounded hover:bg-surface-variant">
                              <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-secondary-container overflow-hidden shrink-0 cursor-pointer" onClick={() => startEditing(student)}>
                              <img src={student.avatarUrl} alt={student.nombres} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            </div>
                            <div>
                              <p className="text-sm text-on-surface cursor-pointer hover:text-primary transition-colors" onClick={() => startEditing(student)}>{student.apellidoPaterno} {student.apellidoMaterno}, {student.nombres}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-on-surface-variant font-mono cursor-pointer" onClick={() => startEditing(student)}>
                          {student.dni}
                        </td>
                        <td className="px-6 py-4 cursor-pointer" onClick={() => startEditing(student)}>
                          <span className="px-2.5 py-1 bg-surface-container-highest rounded-md text-xs font-medium text-on-surface-variant whitespace-nowrap">
                            {student.grado} - {student.seccion}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right cursor-pointer">
                          <a 
                            href={`https://wa.me/${student.celular.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 rounded-lg transition-colors text-sm font-semibold"
                          >
                            <span className="material-symbols-outlined text-sm">chat</span>
                            WhatsApp
                          </a>
                        </td>
                      </>
                    )}
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
