import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import GameControls from './components/GameControls';
import usePlinkoGame from './components/PlinkoGame';
import KickLoginButton from './components/KickLoginButton';
import AuthCallback from './pages/AuthCallback';
import kickAuthService from './utils/KickAuthService';
import './App.css';

// Página principal con el juego Plinko
const PlinkoGame = () => {
  // Referencias y estado del juego de Plinko
  const [ballCount, setBallCount] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('fmdavid');
  const [profileImage, setProfileImage] = useState(null);
  
  // Verificar autenticación al cargar
  useEffect(() => {
    const checkAuth = async () => {
      const auth = kickAuthService.isAuthenticated();
      setIsAuthenticated(auth);
      
      if (auth) {
        // Establecer nombre de usuario y obtener imagen de perfil si está disponible
        setUsername('fmdavid');
        const savedProfileImage = kickAuthService.getProfileImage();
        if (savedProfileImage) {
          setProfileImage(savedProfileImage);
        }
        
        // También intentar obtener información del canal para la foto de perfil
        try {
          const channelInfo = await kickAuthService.getChannelInfo();
          console.log('Información del canal:', channelInfo);
          
          // Actualizar la imagen de perfil si se obtuvo
          const newProfileImage = kickAuthService.getProfileImage();
          if (newProfileImage) {
            setProfileImage(newProfileImage);
          }
        } catch (error) {
          console.error('Error al obtener información del canal:', error);
        }
      }
    };
    
    checkAuth();
  }, []);
  
  // Inicializar el juego con un ref creado directamente
  const { sceneRef, canDrop, dropBall } = usePlinkoGame({
    onBallChange: () => setBallCount(prev => prev + 1)
  });

  // Cerrar sesión
  const handleLogout = () => {
    console.log('Cerrando sesión...');
    try {
      kickAuthService.logout();
      setIsAuthenticated(false);
      setProfileImage(null);
      console.log('Sesión cerrada correctamente');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  // Obtener la primera letra del nombre de usuario para el avatar
  const getInitial = () => {
    return username.charAt(0).toUpperCase();
  };

  return (
    <div className="plinko-container">
      <header className="game-header">
        <h1>Plinko con Kick</h1>
        <div className="auth-container">
          {isAuthenticated ? (
            <div className="user-info">
              <span>¡Hola, {username}!</span>
              {profileImage ? (
                <img 
                  src={profileImage} 
                  alt="Perfil" 
                  className="profile-image"
                  onError={(e) => {
                    console.error('Error al cargar la imagen de perfil');
                    e.target.style.display = 'none';
                    // Mostrar el círculo con la inicial si hay error
                    const avatarCircle = document.createElement('div');
                    avatarCircle.className = 'avatar-circle';
                    avatarCircle.textContent = getInitial();
                    e.target.parentNode.insertBefore(avatarCircle, e.target);
                  }}
                />
              ) : (
                <div className="avatar-circle">
                  {getInitial()}
                </div>
              )}
              <button 
                className="logout-button" 
                onClick={handleLogout}
              >
                Cerrar sesión
              </button>
            </div>
          ) : (
            <KickLoginButton />
          )}
        </div>
      </header>
      
      <div className="game-board" ref={sceneRef}></div>
      
      <GameControls 
        onDropBall={dropBall}
        canDrop={canDrop}
      />
      
      <div className="instructions">
        <h3>Instrucciones</h3>
        <p>
          1. Inicia sesión con tu cuenta de Kick<br />
          2. Pulsa "Drop Ball" para soltar una bola<br />
          3. Los espectadores pueden escribir !unirme en el chat para participar
        </p>
      </div>
    </div>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<PlinkoGame />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
      </Routes>
    </Router>
  );
}

export default App;