import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, loginWithCredentials } from './firebase';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Navigation, TopBar } from './components/Navigation';
import Dashboard from './pages/Dashboard';
import Scanner from './pages/Scanner';
import Students from './pages/Students';
import Settings from './pages/Settings';

export default function App() {
  const [user, setUser] = useState(auth.currentUser);
  const [loading, setLoading] = useState(true);
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
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
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="animate-pulse flex flex-col items-center">
          <span className="material-symbols-outlined text-primary text-4xl mb-4">account_balance</span>
          <p className="text-on-surface-variant font-medium">Cargando El Registrador Digital...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface p-6">
        <div className="bg-surface-container-lowest p-8 rounded-3xl shadow-lg max-w-md w-full text-center">
          <span className="material-symbols-outlined text-primary text-6xl mb-6">account_balance</span>
          <h1 className="text-2xl font-bold text-on-surface mb-2">El Registrador Digital</h1>
          <p className="text-on-surface-variant mb-8">Inicia sesión para gestionar los registros.</p>
          
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
              className="w-full py-4 mt-4 cta-gradient text-on-primary rounded-xl font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-70"
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
          <TopBar />
          <main className="max-w-7xl mx-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/scanner" element={<Scanner />} />
              <Route path="/students" element={<Students />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <Navigation />
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
