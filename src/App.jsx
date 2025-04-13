// src/App.jsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import kickAuthService from './utils/KickAuthService';
import KickLoginButton from './components/KickLoginButton';
import AuthCallback from './pages/AuthCallback';
import Plinko from './pages/Plinko'; // Tu componente principal del juego

// Componente para el Avatar/Icono del usuario
const UserAvatar = ({ user, onLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  
  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };
  
  return (
    <div className="user-avatar-container">
      <div className="user-avatar" onClick={toggleMenu}>
        {user?.profile_image ? (
          <img 
            src={user.profile_image} 
            alt={user.username} 
            className="avatar-image" 
          />
        ) : (
          <div className="avatar-placeholder">
            {user?.username?.charAt(0)?.toUpperCase() || 'U'}
          </div>
        )}
      </div>
      
      {menuOpen && (
        <div className="user-menu">
          <div className="user-info">
            <p className="username">{user?.username || 'Usuario'}</p>
            <p className="email">{user?.email || ''}</p>
          </div>
          <button className="logout-button" onClick={onLogout}>
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Verificar estado de autenticación al cargar
  useEffect(() => {
    const checkAuth = async () => {
      const isAuth = kickAuthService.isAuthenticated();
      setIsAuthenticated(isAuth);
      
      if (isAuth) {
        const userData = kickAuthService.getUser();
        setUser(userData);
        
        // Si no hay datos de usuario, intentar obtenerlos
        if (!userData) {
          const newUserData = await kickAuthService.fetchUserInfo();
          setUser(newUserData);
        }
      }
      
      setLoading(false);
    };
    
    checkAuth();
  }, []);
  
  const handleLogout = () => {
    kickAuthService.logout();
    setIsAuthenticated(false);
    setUser(null);
    // Redirigir a la página principal
    window.location.href = '/';
  };
  
  if (loading) {
    return <div className="loading">Cargando...</div>;
  }
  
  return (
    <Router>
      <div className="app">
        <header className="app-header">
          <div className="logo">PlinkoKick</div>
          <div className="auth-section">
            {isAuthenticated ? (
              <UserAvatar user={user} onLogout={handleLogout} />
            ) : (
              <KickLoginButton onLogin={() => {}} />
            )}
          </div>
        </header>
        
        <main className="main-content">
          <Routes>
            {/* Ruta para la página principal - el juego Plinko */}
            <Route path="/" element={<Plinko user={user} isAuthenticated={isAuthenticated} />} />
            
            {/* Ruta para el callback de autenticación */}
            <Route path="/auth/callback" element={<AuthCallback />} />
            
            {/* Redirigir cualquier otra ruta a la página principal */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;