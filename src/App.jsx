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
  
  // Verificar autenticación al cargar
  useEffect(() => {
    const checkAuth = async () => {
      const auth = kickAuthService.isAuthenticated();
      setIsAuthenticated(auth);
      
      if (auth) {
        const userData = kickAuthService.getUser();
        console.log('Datos del usuario:', userData); // Para depuración
        setUser(userData);
        
        // Si no hay datos de usuario, intentar obtenerlos
        if (!userData) {
          try {
            const freshUserData = await kickAuthService.fetchUserInfo();
            console.log('Nuevos datos de usuario:', freshUserData);
            setUser(freshUserData);
          } catch (error) {
            console.error('Error al obtener datos del usuario:', error);
          }
        }
      }
    };
    
    checkAuth();
  }, []);
  
  // Inicializar el juego con un ref creado directamente
  const { sceneRef, canDrop, dropBall } = usePlinkoGame({
    onBallChange: () => setBallCount(prev => prev + 1)
  });

  // Cerrar sesión (simplificado)
  const handleLogout = () => {
    console.log('Cerrando sesión...');
    try {
      // Primero intentamos revocar el token
      kickAuthService.logout();
      // Luego actualizamos el estado local
      setIsAuthenticated(false);
      setUser(null);
      console.log('Sesión cerrada correctamente');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  return (
    <div className="plinko-container">
      <header className="game-header">
        <h1>Plinko con Kick</h1>
        <div className="auth-container">
          {isAuthenticated ? (
            <div className="user-info">
              {user && (
                <>
                  <span>¡Hola, {user.username || 'usuario'}!</span>
                  {/* Prueba con diferentes propiedades de imagen posibles */}
                  <img 
                    src={user.avatar_url || user.profile_image || user.profile_picture || 'https://via.placeholder.com/40'} 
                    alt="Avatar" 
                    className="user-avatar" 
                    onError={(e) => {
                      console.log('Error al cargar la imagen de perfil');
                      e.target.src = 'https://via.placeholder.com/40';
                    }}
                  />
                </>
              )}
              <button 
                className="logout-button" 
                onClick={handleLogout}
                style={{
                  backgroundColor: '#333',
                  color: 'white',
                  padding: '8px 12px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginLeft: '10px'
                }}
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