import axios from 'axios';

// Obtener la URL del Backend desde las variables de entorno de Vite o fallback a /api/v1 para proxy local
const API_BASE = import.meta.env.VITE_API_URL || '';

export const apiClient = axios.create({
  baseURL: API_BASE ? `${API_BASE}/api/v1` : '/api/v1',
  withCredentials: true, // Transporte seguro de Cookies HttpOnly (JWT)
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para manejo global de errores de la API
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 404 && !import.meta.env.VITE_API_URL) {
      console.error(
        '[Asuntia API 404] El frontend en Vercel no encuentra la API Backend.\n' +
        'Debes configurar la variable de entorno VITE_API_URL en Vercel apuntando a tu servidor FastAPI (o a tu tunnel de ngrok/localtunnel).'
      );
    }
    if (error.response?.status === 401) {
      console.warn('Sesión expirada o no autorizada');
    }
    return Promise.reject(error);
  }
);
