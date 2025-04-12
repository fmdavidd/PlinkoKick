// src/components/KickLoginButton.jsx
import React from 'react';
import kickAuthService from '../utils/KickAuthService';

/**
 * Componente para el botón de inicio de sesión con Kick
 */
const KickLoginButton = ({ onLogin }) => {
  // Manejar click en el botón
  const handleLogin = async () => {
    try {
      await kickAuthService.initiateAuthFlow();
      if (onLogin) onLogin();
    } catch (error) {
      console.error('Error al iniciar sesión con Kick:', error);
    }
  };

  return (
    <button 
      className="kick-login-button"
      onClick={handleLogin}
    >
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        style={{ marginRight: '8px' }}
      >
        <path d="M4 5l7 7-7 7"></path>
        <path d="M12 5l7 7-7 7"></path>
      </svg>
      Iniciar sesión con Kick
    </button>
  );
};

export default KickLoginButton;