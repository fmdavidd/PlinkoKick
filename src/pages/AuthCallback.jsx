// src/pages/AuthCallback.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import kickAuthService from '../utils/KickAuthService';

/**
 * Página de callback para procesar la autenticación con Kick
 */
const AuthCallback = () => {
  const [status, setStatus] = useState('Procesando...');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const processAuth = async () => {
      // Obtener parámetros de la URL
      const urlParams = new URLSearchParams(location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const error = urlParams.get('error');
      const errorDescription = urlParams.get('error_description');

      if (error) {
        setStatus(`Error: ${error}${errorDescription ? ` - ${errorDescription}` : ''}`);
        setTimeout(() => navigate('/'), 3000);
        return;
      }

      if (!code || !state) {
        setStatus('Faltan parámetros de autenticación');
        setTimeout(() => navigate('/'), 3000);
        return;
      }

      try {
        // Intercambiar código por token
        const success = await kickAuthService.exchangeCodeForToken(code, state);
        
        if (success) {
          setStatus('¡Autenticación exitosa! Redirigiendo...');
          setTimeout(() => navigate('/'), 1500);
        } else {
          setStatus('Error al procesar la autenticación');
          setTimeout(() => navigate('/'), 3000);
        }
      } catch (error) {
        console.error('Error en el proceso de autenticación:', error);
        setStatus(`Error en el proceso de autenticación: ${error.message || 'Error desconocido'}`);
        setTimeout(() => navigate('/'), 3000);
      }
    };

    processAuth();
  }, [navigate, location.search]);

  return (
    <div className="auth-callback-container">
      <h2>Autenticación con Kick</h2>
      <div className="auth-status">{status}</div>
      <div className="loading-spinner"></div>
    </div>
  );
};

export default AuthCallback;