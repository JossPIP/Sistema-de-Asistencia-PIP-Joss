import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, getCountFromServer, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, startOfWeek, startOfMonth, parseISO, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#e83e8c', '#6f42c1', '#fd7e14', '#20c997'];

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    totalLogs: 0,
  });
  const [attendanceByGrade, setAttendanceByGrade] = useState<any[]>([]);
  const [availableGrades, setAvailableGrades] = useState<string[]>([]);
  const [attendanceByType, setAttendanceByType] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // Fetch attendance logs for charts (only last 30 days to prevent slow loading)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      thirtyDaysAgo.setHours(0, 0, 0, 0);

      // Fetch totals and attendance data in parallel for performance
      const [studentsCountSnap, teachersCountSnap, logsCountSnap, attendanceSnap] = await Promise.all([
        getCountFromServer(collection(db, 'students')),
        getCountFromServer(query(collection(db, 'users'), where('role', '==', 'teacher'))),
        getCountFromServer(collection(db, 'attendance')),
        getDocs(query(collection(db, 'attendance'), where('timestamp', '>=', thirtyDaysAgo)))
      ]);

      const totalStudents = studentsCountSnap.data().count;
      const totalTeachers = teachersCountSnap.data().count;
      const totalLogs = logsCountSnap.data().count;

      // Process attendance data for charts
      let temprano = 0;
      let tardanza = 0;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const attendedStudentIds = new Set<string>();
      
      // For Line Chart
      const rawDateData: Record<string, Record<string, number>> = {};
      const gradesSet = new Set<string>();

      attendanceSnap.forEach(doc => {
        const data = doc.data();
        
        if (data.type === 'entrada') {
          // Only count today's stats for the pie chart
          if (data.timestamp && data.timestamp.toDate() >= today) {
            if (data.status === 'presente') temprano++;
            if (data.status === 'tarde') tardanza++;
            if (data.status !== 'faltante') {
              attendedStudentIds.add(data.studentRef);
            }
          }

          // Group by date for Line Chart (last 30 days)
          if (data.timestamp) {
            const date = data.timestamp.toDate();
            const dateString = format(date, 'yyyy-MM-dd');
            const grado = data.grado || 'Sin Grado';
            
            if (!rawDateData[dateString]) {
              rawDateData[dateString] = {};
            }
            rawDateData[dateString][grado] = (rawDateData[dateString][grado] || 0) + 1;
            gradesSet.add(grado);
          }
        }
      });

      const faltantes = Math.max(0, totalStudents - attendedStudentIds.size);

      // Process Line Chart Data (Dynamic Grouping)
      const sortedDates = Object.keys(rawDateData).sort();
      let groupedData: Record<string, Record<string, number>> = {};
      
      if (sortedDates.length > 14) {
        // Group by Week
        sortedDates.forEach(dateStr => {
          const date = parseISO(dateStr);
          const weekStr = `Semana ${format(startOfWeek(date, { weekStartsOn: 1 }), 'dd MMM', { locale: es })}`;
          if (!groupedData[weekStr]) groupedData[weekStr] = {};
          
          Object.keys(rawDateData[dateStr]).forEach(grado => {
            groupedData[weekStr][grado] = (groupedData[weekStr][grado] || 0) + rawDateData[dateStr][grado];
          });
        });
      } else {
        // Group by Day
        sortedDates.forEach(dateStr => {
          const date = parseISO(dateStr);
          const dayStr = format(date, 'dd MMM', { locale: es });
          if (!groupedData[dayStr]) groupedData[dayStr] = {};
          
          Object.keys(rawDateData[dateStr]).forEach(grado => {
            groupedData[dayStr][grado] = (groupedData[dayStr][grado] || 0) + rawDateData[dateStr][grado];
          });
        });
      }

      const finalLineData = Object.keys(groupedData).map(timeKey => {
        const entry: any = { name: timeKey };
        gradesSet.forEach(grado => {
          entry[grado] = groupedData[timeKey][grado] || 0;
        });
        return entry;
      });

      const typeData = [
        { name: 'Temprano', value: temprano },
        { name: 'Tardanza', value: tardanza },
        { name: 'Faltantes (Hoy)', value: faltantes }
      ];

      setStats({ totalStudents, totalTeachers, totalLogs });
      setAttendanceByGrade(finalLineData);
      setAvailableGrades(Array.from(gradesSet));
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
            <span className="material-symbols-outlined text-primary">show_chart</span>
            Asistencia por Grado (Evolución)
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={attendanceByGrade} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#666' }} />
                <YAxis tick={{ fill: '#666' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Legend />
                {availableGrades.map((grado, index) => (
                  <Line 
                    key={grado}
                    type="monotone" 
                    dataKey={grado} 
                    stroke={COLORS[index % COLORS.length]} 
                    strokeWidth={3}
                    activeDot={{ r: 8 }} 
                  />
                ))}
              </LineChart>
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
