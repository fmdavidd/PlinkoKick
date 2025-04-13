// src/utils/KickAuthService.js
import axios from 'axios';

/**
 * Servicio para manejar la autenticación con Kick
 */
class KickAuthService {
  constructor() {
    this.clientId = import.meta.env.VITE_KICK_CLIENT_ID || '';
    this.clientSecret = import.meta.env.VITE_KICK_CLIENT_SECRET || '';
    this.redirectUri = import.meta.env.VITE_KICK_REDIRECT_URI || 'https://plinko-kick.vercel.app/auth/callback';
    
    // Siguiendo exactamente la documentación 
    this.baseUrl = 'https://id.kick.com';
    this.authUrl = `${this.baseUrl}/oauth/authorize`;
    this.tokenUrl = `${this.baseUrl}/oauth/token`;
    this.revokeUrl = `${this.baseUrl}/oauth/revoke`;
    
    this.apiBaseUrl = 'https://kick.com/api/v2';
    this.accessToken = localStorage.getItem('kick_access_token') || null;
    this.refreshToken = localStorage.getItem('kick_refresh_token') || null;
    this.expiresAt = localStorage.getItem('kick_expires_at') || null;
    this.user = JSON.parse(localStorage.getItem('kick_user') || 'null');
    this.codeVerifier = localStorage.getItem('kick_code_verifier') || null;
  }

  /**
   * Genera un string aleatorio para code_verifier
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
   * Genera un code_challenge a partir del code_verifier usando S256
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
   * Inicia el flujo de autenticación de Kick
   */
  async initiateAuthFlow() {
    try {
      console.log("Iniciando flujo de autenticación con Kick");
      
      // Generar code_verifier y guardarlo
      const codeVerifier = this.generateRandomString(128);
      localStorage.setItem('kick_code_verifier', codeVerifier);
      this.codeVerifier = codeVerifier;
      
      // Generar code_challenge
      const codeChallenge = await this.generateCodeChallenge(codeVerifier);
      
      // Generar state aleatorio
      const state = this.generateRandomString(32);
      localStorage.setItem('kick_auth_state', state);
      
      // Construir URL para la autenticación OAuth
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
      console.log("Redirigiendo a:", fullUrl);
      
      // Redirigir al usuario a la página de autorización de Kick
      window.location.href = fullUrl;
      return true;
    } catch (error) {
      console.error('Error al iniciar el flujo de autenticación:', error);
      return false;
    }
  }

  /**
   * Verifica si el usuario está autenticado
   */
  isAuthenticated() {
    if (!this.accessToken) return false;
    
    // Comprobar si el token ha expirado
    if (this.expiresAt) {
      const now = new Date().getTime();
      const expiresTime = new Date(this.expiresAt).getTime();
      if (now >= expiresTime) {
        // Token expirado, limpiar y devolver false
        this.logout();
        return false;
      }
    }
    
    return true;
  }

  /**
   * Procesa el código de autorización
   */
  async exchangeCodeForToken(code, state) {
    // Verificar state para protección contra CSRF
    const savedState = localStorage.getItem('kick_auth_state');
    if (state !== savedState) {
      console.error('Estado no coincide. Posible ataque CSRF.');
      return false;
    }
    
    // Recuperar code_verifier
    const codeVerifier = localStorage.getItem('kick_code_verifier');
    if (!codeVerifier) {
      console.error('Code verifier no encontrado.');
      return false;
    }
    
    try {
      console.log("Intercambiando código por token...");
      
      // Crear FormData para enviar como application/x-www-form-urlencoded
      const formData = new URLSearchParams();
      formData.append('grant_type', 'authorization_code');
      formData.append('client_id', this.clientId);
      formData.append('client_secret', this.clientSecret);
      formData.append('redirect_uri', this.redirectUri);
      formData.append('code', code);
      formData.append('code_verifier', codeVerifier);
      
      console.log("URL de token:", this.tokenUrl);
      
      const response = await axios.post(this.tokenUrl, formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      console.log("Respuesta de token:", response.data);

      if (response.data && response.data.access_token) {
        this.setSession(response.data);
        // Limpiar variables de estado y code_verifier
        localStorage.removeItem('kick_auth_state');
        localStorage.removeItem('kick_code_verifier');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error al intercambiar código por token:', error);
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

    // Guardar datos en localStorage
    localStorage.setItem('kick_access_token', authResult.access_token);
    localStorage.setItem('kick_refresh_token', authResult.refresh_token);
    localStorage.setItem('kick_expires_at', expiresAt.toISOString());

    // Actualizar el estado del servicio
    this.accessToken = authResult.access_token;
    this.refreshToken = authResult.refresh_token;
    this.expiresAt = expiresAt.toISOString();

    // Obtener información del usuario
    this.fetchUserInfo();
  }

  /**
   * Refresca el token de acceso
   */
  async refreshAccessToken() {
    if (!this.refreshToken) return false;

    try {
      // Crear FormData para enviar como application/x-www-form-urlencoded
      const formData = new URLSearchParams();
      formData.append('grant_type', 'refresh_token');
      formData.append('client_id', this.clientId);
      formData.append('client_secret', this.clientSecret);
      formData.append('refresh_token', this.refreshToken);
      
      const response = await axios.post(this.tokenUrl, formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (response.data && response.data.access_token) {
        this.setSession(response.data);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error al refrescar token:', error);
      this.logout();
      return false;
    }
  }

  /**
   * Revoca el token de acceso actual
   */
  async revokeToken() {
    if (!this.accessToken) return true;
    
    try {
      console.log("Intentando revocar token:", this.accessToken);
      
      await axios.post(`${this.revokeUrl}?token=${this.accessToken}&token_hint_type=access_token`, {}, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      console.log("Token revocado exitosamente");
      this.logout();
      return true;
    } catch (error) {
      console.error('Error al revocar token:', error);
      // Aún así, limpiamos la sesión local
      this.logout();
      return false;
    }
  }

  /**
   * Obtiene información del usuario actual
   */
  async fetchUserInfo() {
    if (!this.accessToken) return null;

    try {
      console.log("Obteniendo información del usuario...");
      console.log("URL:", `${this.apiBaseUrl}/user`);
      console.log("Token:", this.accessToken);
      
      const response = await axios.get(`${this.apiBaseUrl}/user`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`
        }
      });

      console.log("Información del usuario obtenida:", response.data);

      if (response.data) {
        // Guardar información del usuario
        localStorage.setItem('kick_user', JSON.stringify(response.data));
        this.user = response.data;
        return response.data;
      }
      return null;
    } catch (error) {
      console.error('Error al obtener información del usuario:', error);
      console.error('Detalles:', error.response ? error.response.data : 'No hay detalles');
      return null;
    }
  }

  /**
   * Cierra la sesión actual
   */
  logout() {
    console.log("Cerrando sesión y limpiando datos locales");
    
    // Limpiar localStorage
    localStorage.removeItem('kick_access_token');
    localStorage.removeItem('kick_refresh_token');
    localStorage.removeItem('kick_expires_at');
    localStorage.removeItem('kick_user');

    // Limpiar estado del servicio
    this.accessToken = null;
    this.refreshToken = null;
    this.expiresAt = null;
    this.user = null;
    
    console.log("Sesión cerrada correctamente");
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

// Exportar una única instancia del servicio
const kickAuthService = new KickAuthService();
export default kickAuthService;