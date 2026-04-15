import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, loginWithCredentials, db } from './firebase';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Navigation, TopBar } from './components/Navigation';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
import Scanner from './pages/Scanner';
import Students from './pages/Students';
import Settings from './pages/Settings';

export default function App() {
  const [user, setUser] = useState<any>(auth.currentUser);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | undefined;
    
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        unsubscribeDoc = onSnapshot(doc(db, 'users', currentUser.uid), (userDoc) => {
          if (userDoc.exists()) {
            setUserRole(userDoc.data().role);
            setIsLoggingIn(false);
          } else {
            setUserRole(null);
          }
          setLoading(false);
        }, (error) => {
          console.error("Error fetching user role:", error);
          setLoading(false);
          setIsLoggingIn(false);
        });
      } else {
        setUserRole(null);
        setLoading(false);
        setIsLoggingIn(false);
        if (unsubscribeDoc) unsubscribeDoc();
      }
    });
    
    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      await loginWithCredentials(username, password);
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/operation-not-allowed') {
        setLoginError('El inicio de sesión por correo/contraseña no está habilitado en Firebase.');
      } else {
        setLoginError('Usuario o contraseña incorrectos.');
      }
      setIsLoggingIn(false);
    }
  };

  useEffect(() => {
    if (!loading && user && !userRole && !isLoggingIn) {
      console.warn("User has no role document, signing out.");
      signOut(auth);
    }
  }, [loading, user, userRole, isLoggingIn]);

  if (loading || (user && !userRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="animate-pulse flex flex-col items-center">
          <span className="material-symbols-outlined text-primary text-4xl mb-4">account_balance</span>
          <p className="text-on-surface-variant font-medium">Cargando Sistema de Asistencia - JCMS...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface p-6">
        <div className="bg-surface-container-lowest p-8 rounded-3xl shadow-lg max-w-md w-full text-center border border-outline-variant/20">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-on-surface uppercase tracking-wide">IE 51027 Juan de la Cruz Montes Salas</h2>
            <p className="text-sm text-on-surface-variant font-medium">Inicial - Primaria - Secundaria</p>
          </div>
          
          {/* Logo Placeholder */}
          <div className="w-24 h-24 mx-auto mb-6 bg-surface-container-highest rounded-full flex items-center justify-center border-4 border-surface overflow-hidden shadow-sm">
            {/* Reemplaza este span con tu etiqueta <img> cuando tengas el logo */}
            <span className="material-symbols-outlined text-primary text-5xl">school</span>
          </div>
          
          <h1 className="text-2xl font-extrabold text-primary mb-2">Sistema de Asistencia - JCMS</h1>
          <p className="text-on-surface-variant mb-8 text-sm">Inicia sesión para gestionar los registros.</p>
          
          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">Usuario</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-surface-container-highest border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="Ej: 41916759"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">Contraseña</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface-container-highest border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="••••••••"
                required
              />
            </div>
            
            {loginError && (
              <div className="p-3 bg-error-container text-on-error-container rounded-lg text-sm font-medium">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-4 mt-4 cta-gradient text-on-primary rounded-xl font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-70 shadow-md"
            >
              <span className="material-symbols-outlined">login</span>
              {isLoggingIn ? 'Iniciando...' : 'Iniciar Sesión'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <div className="min-h-screen bg-background text-on-surface pb-24 md:pb-0">
          <TopBar userRole={userRole} />
          <main className="max-w-7xl mx-auto">
            <Routes>
              {userRole === 'admin' ? (
                <>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/scanner" element={<Scanner userRole={userRole} />} />
                  <Route path="/students" element={<Students />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </>
              ) : (
                <>
                  <Route path="/scanner" element={<Scanner userRole={userRole} />} />
                  <Route path="*" element={<Navigate to="/scanner" replace />} />
                </>
              )}
            </Routes>
          </main>
          <Navigation userRole={userRole} />
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
