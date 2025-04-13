// src/utils/KickAuthService.js
import axios from 'axios';

/**
 * Servicio para manejar la autenticación con Kick
 */
class KickAuthService {
  constructor() {
    this.clientId = import.meta.env.VITE_KICK_CLIENT_ID || '';
    this.clientSecret = import.meta.env.VITE_KICK_CLIENT_SECRET || '';
    
    // Use a local redirect URI for handling the callback
    this.redirectUri = 'http://localhost:8080';
    
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
    
    // Store for callback server
    this.callbackServer = null;
  }

  /**
   * Genera un string aleatorio para code_verifier
   * @param {number} length - Longitud del string
   * @returns {string} - String aleatorio
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
   * @param {string} codeVerifier - El code_verifier
   * @returns {Promise<string>} - El code_challenge generado
   */
  async generateCodeChallenge(codeVerifier) {
    // Convertir code_verifier a ArrayBuffer
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    
    // Hash usando SHA-256
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    // Convertir ArrayBuffer a string base64url
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashBase64 = btoa(String.fromCharCode.apply(null, hashArray));
    
    // Convertir base64 a base64url (reemplazar caracteres no URL-safe)
    return hashBase64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /**
   * Configura un servidor local para manejar la redirección OAuth
   * @returns {Promise<string>} - Promesa que se resuelve con el código de autorización
   */
  setupCallbackServer() {
    return new Promise((resolve, reject) => {
      // Implementación simplificada de un servidor HTTP local
      // Nota: Esto solo funcionará en un entorno de desarrollo
      
      if (!window.location.protocol.includes('http')) {
        reject(new Error('El protocolo debe ser HTTP para usar el servidor local'));
        return;
      }
      
      // Crear un iframe oculto para actuar como nuestro "servidor"
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
      
      // Escuchar mensajes del iframe (simulando nuestro servidor)
      const messageHandler = (event) => {
        // Solo procesar mensajes de nuestro origen
        if (event.origin !== window.location.origin) return;
        
        try {
          const data = event.data;
          if (data && data.type === 'kick_auth_callback' && data.code) {
            // Código recibido, limpiar y resolver
            window.removeEventListener('message', messageHandler);
            document.body.removeChild(iframe);
            resolve(data.code);
          }
        } catch (error) {
          reject(error);
        }
      };
      
      window.addEventListener('message', messageHandler);
      
      // Simular el servidor en el iframe
      iframe.srcdoc = `
        <html>
          <body>
            <script>
              // Escuchar cambios en la URL (redirecciones)
              function checkUrl() {
                const url = window.location.href;
                if (url.includes('code=')) {
                  // Extraer el código de la URL
                  const code = new URLSearchParams(window.location.search).get('code');
                  if (code) {
                    // Enviar mensaje al padre
                    window.parent.postMessage({ type: 'kick_auth_callback', code: code }, window.location.origin);
                    document.body.innerHTML = '<h1>Autenticación exitosa. Puedes cerrar esta ventana.</h1>';
                  }
                }
              }
              
              // Verificar constantemente la URL
              setInterval(checkUrl, 100);
              document.body.innerHTML = '<h1>Esperando redirección de OAuth...</h1>';
            </script>
          </body>
        </html>
      `;
      
      // Almacenar referencia al iframe
      this.callbackServer = iframe;
    });
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
      
      // Configurar servidor local para manejar callback
      const codePromise = this.setupCallbackServer();
      
      // Construir URL para la autenticación OAuth
      const params = new URLSearchParams({
        client_id: this.clientId,
        redirect_uri: this.redirectUri,
        response_type: 'code',
        scope: 'channel_read chat_read',  // Ajusta los scopes según tus necesidades
        state: state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256'
      });
      
      const fullUrl = `${this.authUrl}?${params.toString()}`;
      console.log("URL de autorización:", fullUrl);
      
      // Abrir una nueva ventana para la autorización
      const authWindow = window.open(fullUrl, 'KickAuth', 'width=600,height=700');
      
      if (!authWindow) {
        throw new Error('El navegador bloqueó la ventana emergente. Por favor, permite ventanas emergentes para este sitio.');
      }
      
      // Esperar a que se complete la autorización
      try {
        const code = await codePromise;
        console.log("Código de autorización recibido:", code);
        
        // Intercambiar código por token
        const success = await this.exchangeCodeForToken(code, state);
        return success;
      } catch (error) {
        console.error("Error en el proceso de autorización:", error);
        return false;
      }
    } catch (error) {
      console.error('Error al iniciar el flujo de autenticación:', error);
      return false;
    }
  }

  /**
   * Procesa el código de autorización
   * @param {string} code - Código de autorización recibido de Kick
   * @param {string} state - Estado recibido en la respuesta
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
      console.log("Datos de solicitud:", {
        grant_type: 'authorization_code',
        client_id: this.clientId,
        redirect_uri: this.redirectUri,
        code: code,
        code_verifier: codeVerifier
      });
      
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
   * @private
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

  // Resto de métodos igual que antes (isAuthenticated, refreshAccessToken, etc.)
  
  /**
   * Intenta obtener un token de aplicación (App Access Token)
   */
  async getAppAccessToken() {
    try {
      console.log("Obteniendo token de aplicación...");
      
      // Crear FormData para enviar como application/x-www-form-urlencoded
      const formData = new URLSearchParams();
      formData.append('grant_type', 'client_credentials');
      formData.append('client_id', this.clientId);
      formData.append('client_secret', this.clientSecret);
      
      const response = await axios.post(this.tokenUrl, formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      console.log("Respuesta de token de aplicación:", response.data);

      if (response.data && response.data.access_token) {
        // Guardar token pero no como sesión de usuario
        localStorage.setItem('kick_app_token', response.data.access_token);
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + response.data.expires_in);
        localStorage.setItem('kick_app_token_expires', expiresAt.toISOString());
        
        return response.data.access_token;
      }
      return null;
    } catch (error) {
      console.error('Error al obtener token de aplicación:', error);
      console.error('Detalles:', error.response ? error.response.data : 'No hay detalles');
      return null;
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
        // Token expirado, intentar refrescar
        this.refreshAccessToken();
        return false;
      }
    }
    
    return true;
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
   * Obtiene información del usuario actual
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
        // Guardar información del usuario
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
   * Cierra la sesión actual
   */
  logout() {
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
  }

  /**
   * Test function to try getting an app access token directly
   */
  async tryAppAccessToken() {
    try {
      const token = await this.getAppAccessToken();
      console.log("App token obtained:", token ? "Success" : "Failed");
      return token;
    } catch (error) {
      console.error("Error getting app token:", error);
      return null;
    }
  }
}

// Exportar una única instancia del servicio
const kickAuthService = new KickAuthService();
export default kickAuthService;