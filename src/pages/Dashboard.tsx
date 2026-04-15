import React, { useState, useEffect } from 'react';
import { collection, query, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    totalLogs: 0,
  });
  const [attendanceByGrade, setAttendanceByGrade] = useState<any[]>([]);
  const [attendanceByType, setAttendanceByType] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // Fetch students
      const studentsSnap = await getDocs(collection(db, 'students'));
      const totalStudents = studentsSnap.size;

      // Fetch teachers
      const usersSnap = await getDocs(query(collection(db, 'users')));
      const totalTeachers = usersSnap.docs.filter(doc => doc.data().role === 'teacher').length;

      // Fetch attendance logs
      const attendanceSnap = await getDocs(collection(db, 'attendance'));
      const totalLogs = attendanceSnap.size;

      // Process attendance data for charts
      const gradeCounts: Record<string, number> = {};
      let temprano = 0;
      let tardanza = 0;
      
      // We need to track unique students who attended today to calculate absentees
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const attendedStudentIds = new Set<string>();

      attendanceSnap.forEach(doc => {
        const data = doc.data();
        
        // By Grade
        const grado = data.grado || 'Sin Grado';
        gradeCounts[grado] = (gradeCounts[grado] || 0) + 1;

        // By Type (Temprano vs Tardanza) - only counting 'entrada' for this metric
        if (data.type === 'entrada') {
          if (data.status === 'presente') temprano++;
          if (data.status === 'tarde') tardanza++;
          
          // Check if it's today's record to calculate absentees
          // Only count as attended if status is not 'faltante'
          if (data.timestamp && data.timestamp.toDate() >= today && data.status !== 'faltante') {
            attendedStudentIds.add(data.studentRef);
          }
        }
      });

      const faltantes = Math.max(0, totalStudents - attendedStudentIds.size);

      const gradeData = Object.keys(gradeCounts).map(key => ({
        name: key,
        Asistencias: gradeCounts[key]
      })).sort((a, b) => b.Asistencias - a.Asistencias);

      const typeData = [
        { name: 'Temprano', value: temprano },
        { name: 'Tardanza', value: tardanza },
        { name: 'Faltantes (Hoy)', value: faltantes }
      ];

      setStats({ totalStudents, totalTeachers, totalLogs });
      setAttendanceByGrade(gradeData);
      setAttendanceByType(typeData);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-on-surface-variant font-medium">Cargando Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight text-on-surface mb-2">Dashboard</h1>
        <p className="text-on-surface-variant text-lg">Resumen gráfico de la asistencia y registros.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/20 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-3xl">group</span>
          </div>
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">Estudiantes</p>
            <p className="text-3xl font-extrabold text-on-surface">{stats.totalStudents}</p>
          </div>
        </div>
        <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/20 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
            <span className="material-symbols-outlined text-3xl">badge</span>
          </div>
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">Profesores</p>
            <p className="text-3xl font-extrabold text-on-surface">{stats.totalTeachers}</p>
          </div>
        </div>
        <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/20 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-tertiary/10 flex items-center justify-center text-tertiary">
            <span className="material-symbols-outlined text-3xl">fact_check</span>
          </div>
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">Registros Totales</p>
            <p className="text-3xl font-extrabold text-on-surface">{stats.totalLogs}</p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/20 shadow-sm">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">bar_chart</span>
            Asistencia por Grado
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendanceByGrade} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#666' }} />
                <YAxis tick={{ fill: '#666' }} />
                <Tooltip 
                  cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="Asistencias" fill="#0088FE" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/20 shadow-sm">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">pie_chart</span>
            Estado de Asistencia
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={attendanceByType}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {attendanceByType.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
