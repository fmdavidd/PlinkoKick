// src/utils/KickAuthService.js
import axios from 'axios';

/**
 * Servicio simplificado para autenticación con Kick
 * Compatible con componentes existentes
 */
class KickAuthService {
  constructor() {
    this.clientId = import.meta.env.VITE_KICK_CLIENT_ID || '';
    this.clientSecret = import.meta.env.VITE_KICK_CLIENT_SECRET || '';
    this.redirectUri = import.meta.env.VITE_KICK_REDIRECT_URI || 'https://plinko-kick.vercel.app/auth/callback';
    
    // URLs para OAuth
    this.baseUrl = 'https://id.kick.com';
    this.authUrl = `${this.baseUrl}/oauth/authorize`;
    this.tokenUrl = `${this.baseUrl}/oauth/token`;
    
    // API base
    this.apiBaseUrl = 'https://kick.com/api/v2';
    
    // Estado de autenticación
    this.accessToken = localStorage.getItem('kick_access_token') || null;
    this.refreshToken = localStorage.getItem('kick_refresh_token') || null;
    this.expiresAt = localStorage.getItem('kick_expires_at') || null;
    this.user = JSON.parse(localStorage.getItem('kick_user') || 'null');
  }

  /**
   * Genera un string aleatorio
   */
  generateRandomString(length) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let text = '';
    for (let i = 0; i < length; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  /**
   * Genera un code_challenge a partir del code_verifier
   */
  async generateCodeChallenge(codeVerifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashBase64 = btoa(String.fromCharCode.apply(null, hashArray));
    
    return hashBase64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /**
   * Inicia el flujo de autenticación
   */
  async initiateAuthFlow() {
    try {
      console.log("Iniciando flujo de autenticación con Kick");
      
      // Generar code_verifier
      const codeVerifier = this.generateRandomString(128);
      localStorage.setItem('kick_code_verifier', codeVerifier);
      
      // Generar code_challenge
      const codeChallenge = await this.generateCodeChallenge(codeVerifier);
      
      // Generar state
      const state = this.generateRandomString(32);
      localStorage.setItem('kick_auth_state', state);
      
      // Construir URL con scopes correctos según la documentación
      const params = new URLSearchParams({
        client_id: this.clientId,
        redirect_uri: this.redirectUri,
        response_type: 'code',
        scope: 'user:read chat:write chat:read',  // Scopes corregidos
        state: state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256'
      });
      
      const fullUrl = `${this.authUrl}?${params.toString()}`;
      console.log("URL de autorización:", fullUrl);
      
      // Redirigir al usuario a la página de autorización de Kick
      window.location.href = fullUrl;
      
      return true;
    } catch (error) {
      console.error('Error al iniciar autenticación:', error);
      return false;
    }
  }

  /**
   * Procesa el código de autorización
   * Mantiene el nombre original para compatibilidad
   */
  async exchangeCodeForToken(code, state) {
    // Verificar state
    const savedState = localStorage.getItem('kick_auth_state');
    if (state !== savedState) {
      console.error('Error: Estado no coincide');
      return false;
    }
    
    // Recuperar code_verifier
    const codeVerifier = localStorage.getItem('kick_code_verifier');
    if (!codeVerifier) {
      console.error('Error: Code verifier no encontrado');
      return false;
    }
    
    try {
      console.log("Intercambiando código por token...");
      
      // Formar datos para solicitud de token
      const formData = new URLSearchParams();
      formData.append('grant_type', 'authorization_code');
      formData.append('client_id', this.clientId);
      formData.append('client_secret', this.clientSecret);
      formData.append('redirect_uri', this.redirectUri);
      formData.append('code', code);
      formData.append('code_verifier', codeVerifier);
      
      console.log("URL de token:", this.tokenUrl);
      console.log("Datos de solicitud:", {
        grant_type: 'authorization_code',
        client_id: this.clientId,
        redirect_uri: this.redirectUri,
        code: code,
        code_verifier: codeVerifier
      });
      
      // Solicitar token
      const response = await axios.post(this.tokenUrl, formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      console.log("Respuesta de token:", response.data);
      
      if (response.data && response.data.access_token) {
        // Guardar token y configurar sesión
        this.setSession(response.data);
        
        // Limpiar valores temporales
        localStorage.removeItem('kick_auth_state');
        localStorage.removeItem('kick_code_verifier');
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error al obtener token:', error);
      console.error('Detalles:', error.response ? error.response.data : 'No hay detalles');
      return false;
    }
  }

  /**
   * Configura la sesión con la información de autenticación
   */
  setSession(authResult) {
    // Calcular tiempo de expiración
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + authResult.expires_in);

    // Guardar datos
    localStorage.setItem('kick_access_token', authResult.access_token);
    localStorage.setItem('kick_refresh_token', authResult.refresh_token);
    localStorage.setItem('kick_expires_at', expiresAt.toISOString());

    // Actualizar estado
    this.accessToken = authResult.access_token;
    this.refreshToken = authResult.refresh_token;
    this.expiresAt = expiresAt.toISOString();

    // Obtener info del usuario
    this.fetchUserInfo();
  }

  /**
   * Verifica si hay una sesión activa
   */
  isAuthenticated() {
    if (!this.accessToken) return false;
    
    if (this.expiresAt) {
      const now = new Date().getTime();
      const expiresTime = new Date(this.expiresAt).getTime();
      if (now >= expiresTime) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Obtiene información del usuario
   */
  async fetchUserInfo() {
    if (!this.accessToken) return null;

    try {
      const response = await axios.get(`${this.apiBaseUrl}/user`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`
        }
      });

      if (response.data) {
        localStorage.setItem('kick_user', JSON.stringify(response.data));
        this.user = response.data;
        return response.data;
      }
      return null;
    } catch (error) {
      console.error('Error al obtener información del usuario:', error);
      return null;
    }
  }

  /**
   * Cierra la sesión
   */
  logout() {
    localStorage.removeItem('kick_access_token');
    localStorage.removeItem('kick_refresh_token');
    localStorage.removeItem('kick_expires_at');
    localStorage.removeItem('kick_user');

    this.accessToken = null;
    this.refreshToken = null;
    this.expiresAt = null;
    this.user = null;
  }

  /**
   * Obtiene el token de acceso
   */
  getAccessToken() {
    return this.accessToken;
  }

  /**
   * Obtiene la información del usuario autenticado
   */
  getUser() {
    return this.user;
  }
}

// Exportar instancia
const kickAuthService = new KickAuthService();
export default kickAuthService;