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
        // Intentar extraer información de usuario del token si es posible
        try {
          // Extraer el payload del JWT (la parte central)
          const tokenParts = response.data.access_token.split('.');
          if (tokenParts.length >= 2) {
            const payload = JSON.parse(atob(tokenParts[1]));
            console.log("Información del token JWT:", payload);
            
            // Si el token contiene información de usuario, guardarla
            if (payload.user_id || payload.sub) {
              const username = payload.username || payload.preferred_username || payload.name;
              if (username) {
                localStorage.setItem('kick_username', username);
              }
            }
          }
        } catch (error) {
          console.log("El token no parece ser un JWT válido o no contiene información de usuario");
        }
        
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
   * Obtiene información del usuario actual
   */
  async fetchUserInfo() {
    if (!this.accessToken) return null;

    try {
      console.log("Obteniendo información del usuario...");
      console.log("URL:", `${this.apiBaseUrl}/user`);
      
      const response = await axios.get(`${this.apiBaseUrl}/user`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`
        }
      });

      console.log("Tipo de respuesta:", typeof response.data);
      
      // Si la respuesta es un string (probablemente HTML), devolver null
      if (typeof response.data === 'string') {
        console.error('La API está devolviendo un string en lugar de JSON');
        return null;
      }

      console.log("Información del usuario obtenida:", response.data);

      if (response.data) {
        // Extraer nombre de usuario si está disponible
        if (response.data.username) {
          localStorage.setItem('kick_username', response.data.username);
        } else if (response.data.user && response.data.user.username) {
          localStorage.setItem('kick_username', response.data.user.username);
        }
        
        // Guardar información del usuario
        localStorage.setItem('kick_user', JSON.stringify(response.data));
        this.user = response.data;
        return response.data;
      }
      return null;
    } catch (error) {
      console.error('Error al obtener información del usuario:', error);
      console.error('Detalles:', error.response ? error.response.data : 'No hay detalles');
      
      // Intentar con un endpoint alternativo si el principal falla
      try {
        console.log("Intentando endpoint alternativo...");
        const alternativeResponse = await axios.get(`${this.apiBaseUrl}/users/me`, {
          headers: {
            Authorization: `Bearer ${this.accessToken}`
          }
        });
        
        if (alternativeResponse.data) {
          console.log("Datos del endpoint alternativo:", alternativeResponse.data);
          localStorage.setItem('kick_user', JSON.stringify(alternativeResponse.data));
          this.user = alternativeResponse.data;
          
          // Extraer nombre de usuario
          if (alternativeResponse.data.username) {
            localStorage.setItem('kick_username', alternativeResponse.data.username);
          }
          
          return alternativeResponse.data;
        }
      } catch (altError) {
        console.error("Error en endpoint alternativo:", altError);
      }
      
      return null;
    }
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
    // No eliminamos kick_username para mantener una mejor experiencia de usuario

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