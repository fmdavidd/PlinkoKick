import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
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
        setUser(userData);
      }
    };
    
    checkAuth();
  }, []);
  
  // Inicializar el juego con un ref creado directamente
  const { sceneRef, canDrop, dropBall } = usePlinkoGame({
    onBallChange: () => setBallCount(prev => prev + 1)
  });

  // Cerrar sesión
  const handleLogout = async () => {
    await kickAuthService.revokeToken();
    setIsAuthenticated(false);
    setUser(null);
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
                  <span>¡Hola, {user.username}!</span>
                  <img 
                    src={user.profile_picture || '/default-avatar.png'} 
                    alt="Avatar" 
                    className="user-avatar" 
                  />
                </>
              )}
              <button className="logout-button" onClick={handleLogout}>
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