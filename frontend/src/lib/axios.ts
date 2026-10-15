import axios, { CanceledError } from 'axios';
import { currentSessionGeneration, SESSION_EXPIRED_EVENT } from './session';

declare module 'axios' {
  interface AxiosRequestConfig {
    asuntiaSessionGeneration?: number;
  }
}

// Obtener la URL del Backend desde las variables de entorno de Vite o fallback a /api/v1 para proxy local
const API_BASE = import.meta.env.VITE_API_URL || '';

export const apiClient = axios.create({
  baseURL: API_BASE ? `${API_BASE}/api/v1` : '/api/v1',
  withCredentials: true, // Transporte seguro de Cookies HttpOnly (JWT)
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(config => {
  config.asuntiaSessionGeneration = currentSessionGeneration();
  return config;
});

const isPreviousSession = (generation: number | undefined) =>
  generation !== undefined && generation !== currentSessionGeneration();

// Las respuestas tardías de otra sesión no pueden repoblar la caché ni ejecutar onSuccess.
apiClient.interceptors.response.use(
  (response) => {
    if (isPreviousSession(response.config.asuntiaSessionGeneration)) throw new CanceledError('La sesión cambió');
    return response;
  },
  (error) => {
    if (isPreviousSession(error.config?.asuntiaSessionGeneration)) return Promise.reject(new CanceledError('La sesión cambió'));
    if (error.response?.status === 404 && !import.meta.env.VITE_API_URL) {
      console.error(
        '[Asuntia API 404] El frontend en Vercel no encuentra la API Backend.\n' +
        'Debes configurar la variable de entorno VITE_API_URL en Vercel apuntando a tu servidor FastAPI (o a tu tunnel de ngrok/localtunnel).'
      );
    }
    if (error.response?.status === 401) {
      console.warn('Sesión expirada o no autorizada');
      const url = error.config?.url || '';
      if (!/^\/auth\/(login|otp\/|equipo\/activar|logout)/.test(url)) {
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      }
    }
    return Promise.reject(error);
  }
);
