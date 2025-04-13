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
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('Jugador');
  
  // Verificar autenticación al cargar
  useEffect(() => {
    const checkAuth = async () => {
      const auth = kickAuthService.isAuthenticated();
      setIsAuthenticated(auth);
      
      if (auth) {
        const userData = kickAuthService.getUser();
        console.log('DATOS DE USUARIO:', JSON.stringify(userData, null, 2));
        
        if (userData) {
          setUser(userData);
          // Intentar extraer el nombre de usuario de los datos
          if (userData.username) {
            setUsername(userData.username);
            localStorage.setItem('kick_username', userData.username);
          } else if (userData.user && userData.user.username) {
            setUsername(userData.user.username);
            localStorage.setItem('kick_username', userData.user.username);
          }
        }
        
        // Intentar obtener datos frescos
        try {
          const freshUserData = await kickAuthService.fetchUserInfo();
          console.log('DATOS FRESCOS:', JSON.stringify(freshUserData, null, 2));
          if (freshUserData) {
            setUser(freshUserData);
            // Intentar extraer el nombre de usuario de los datos frescos
            if (freshUserData.username) {
              setUsername(freshUserData.username);
              localStorage.setItem('kick_username', freshUserData.username);
            } else if (freshUserData.user && freshUserData.user.username) {
              setUsername(freshUserData.user.username);
              localStorage.setItem('kick_username', freshUserData.user.username);
            }
          }
        } catch (error) {
          console.error('Error al obtener datos frescos:', error);
        }
        
        // Usar nombre guardado si no se pudo obtener de la API
        const savedUsername = localStorage.getItem('kick_username');
        if (savedUsername && username === 'Jugador') {
          setUsername(savedUsername);
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
      setUser(null);
      setUsername('Jugador');
      localStorage.removeItem('kick_username');
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
              <div className="avatar-circle">
                {getInitial()}
              </div>
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