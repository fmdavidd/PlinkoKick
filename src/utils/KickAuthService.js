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
    this.publicApiBaseUrl = 'https://api.kick.com/public/v1';
    
    this.accessToken = localStorage.getItem('kick_access_token') || null;
    this.refreshToken = localStorage.getItem('kick_refresh_token') || null;
    this.expiresAt = localStorage.getItem('kick_expires_at') || null;
    this.user = JSON.parse(localStorage.getItem('kick_user') || 'null');
    this.codeVerifier = localStorage.getItem('kick_code_verifier') || null;
    
    // Información de perfil
    this.profileImage = localStorage.getItem('kick_profile_image') || null;
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
        scope: 'user:read channel:read chat:write chat:read',  // Incluyendo channel:read
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
   * Obtiene información del token actual mediante introspección
   */
  async introspectToken() {
    if (!this.accessToken) return null;

    try {
      console.log("Introspectando token...");
      
      const response = await axios.post(`${this.publicApiBaseUrl}/token/introspect`, {}, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`
        }
      });

      console.log("Información del token:", response.data);

      if (response.data) {
        // Guardar información relevante
        if (response.data.username) {
          localStorage.setItem('kick_username', response.data.username);
        }
        
        return response.data;
      }
      return null;
    } catch (error) {
      console.error('Error al introspeccionar token:', error);
      console.error('Detalles:', error.response ? error.response.data : 'No hay detalles');
      return null;
    }
  }

  /**
   * Obtiene información del canal del usuario
   */
  async getChannelInfo() {
    if (!this.accessToken) return null;

    try {
      console.log("Obteniendo información del canal...");
      
      // Llamar al endpoint de canales sin parámetros para obtener el canal del usuario autenticado
      const response = await axios.get(`${this.publicApiBaseUrl}/channels`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`
        }
      });

      console.log("Información del canal:", response.data);

      if (response.data && response.data.data && response.data.data.length > 0) {
        const channelInfo = response.data.data[0]; // Tomar el primer canal
        
        return channelInfo;
      }
      return null;
    } catch (error) {
      console.error('Error al obtener información del canal:', error);
      console.error('Detalles:', error.response ? error.response.data : 'No hay detalles');
      return null;
    }
  }

  /**
   * Obtiene información del usuario
   */
  async getUserInfo() {
    if (!this.accessToken) return null;

    try {
      console.log("Obteniendo información del usuario...");
      
      const response = await axios.get(`${this.publicApiBaseUrl}/users`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`
        }
      });

      console.log("Información del usuario:", response.data);

      if (response.data && response.data.data && response.data.data.length > 0) {
        const userData = response.data.data[0];
        
        // Guardar la URL de la imagen de perfil
        if (userData.profile_picture) {
          localStorage.setItem('kick_profile_image', userData.profile_picture);
          this.profileImage = userData.profile_picture;
        }
        
        // Guardar el nombre de usuario
        if (userData.name) {
          localStorage.setItem('kick_username', userData.name);
        }
        
        // Guardar información de usuario
        localStorage.setItem('kick_user', JSON.stringify(userData));
        this.user = userData;
        
        return userData;
      }
      return null;
    } catch (error) {
      console.error('Error al obtener información del usuario:', error);
      console.error('Detalles:', error.response ? error.response.data : 'No hay detalles');
      return null;
    }
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
        
        // Obtener información del usuario para guardar nombre e imagen de perfil
        await this.getUserInfo();
        
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
  }

  /**
   * Cierra la sesión actual
   */
  logout() {
    console.log("Cerrando sesión y limpiando datos locales");
    
    // Intentar revocar el token si está disponible
    if (this.accessToken) {
      try {
        axios.post(`${this.revokeUrl}?token=${this.accessToken}&token_hint_type=access_token`, {}, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }).catch(error => {
          console.log("Error al revocar token, continuando con el cierre de sesión local:", error);
        });
      } catch (error) {
        console.error("Error al revocar token:", error);
      }
    }
    
    // Limpiar localStorage
    localStorage.removeItem('kick_access_token');
    localStorage.removeItem('kick_refresh_token');
    localStorage.removeItem('kick_expires_at');
    localStorage.removeItem('kick_user');
    localStorage.removeItem('kick_profile_image');
    // Mantener kick_username para mejor experiencia de usuario

    // Limpiar estado del servicio
    this.accessToken = null;
    this.refreshToken = null;
    this.expiresAt = null;
    this.user = null;
    this.profileImage = null;
    
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
  
  /**
   * Obtiene el nombre de usuario guardado
   */
  getUsername() {
    return localStorage.getItem('kick_username') || 'fmdavid';
  }
  
  /**
   * Obtiene la URL de la imagen de perfil
   */
  getProfileImage() {
    return localStorage.getItem('kick_profile_image');
  }
}

// Exportar una única instancia del servicio
const kickAuthService = new KickAuthService();
export default kickAuthService;