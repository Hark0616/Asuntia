import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

export const apiClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
  withCredentials: true, // Transporte seguro de Cookies HttpOnly (JWT)
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para manejo global de errores de la API
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn('Sesión expirada o no autorizada');
    }
    return Promise.reject(error);
  }
);
