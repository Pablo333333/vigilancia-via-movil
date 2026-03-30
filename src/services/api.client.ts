/**
 * Cliente Axios central.
 *
 * Responsabilidades:
 *  - Adjunta automáticamente el Bearer token en cada request.
 *  - Intercepta respuestas 401 para limpiar la sesión.
 *  - Transforma los errores de NestJS al formato ApiError tipado.
 */
import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from 'axios';
import { API_CONFIG } from '../config/api.config';
import type { ApiError } from '../types';
import { StorageService } from './storage.service';

// Función callback para navegar al login cuando expire la sesión.
// Se registra desde el componente raíz (app/_layout.tsx).
let onUnauthorizedCallback: (() => void) | null = null;

export function registerUnauthorizedHandler(cb: () => void): void {
  onUnauthorizedCallback = cb;
}

// ─── Instancia base ────────────────────────────────────────────────────────────

const apiClient: AxiosInstance = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ─── Interceptor de request: inyecta el JWT ────────────────────────────────────

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await StorageService.getToken();
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error: unknown) => Promise.reject(error),
);

// ─── Interceptor de response: maneja errores globales ─────────────────────────

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    if (error.response?.status === 401) {
      await StorageService.removeToken();
      onUnauthorizedCallback?.();
    }

    // Re-lanza el error enriquecido para que cada servicio lo capture
    return Promise.reject(error);
  },
);

export default apiClient;
