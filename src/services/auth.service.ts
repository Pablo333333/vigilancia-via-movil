/**
 * Servicio de autenticación.
 *
 * Expone:
 *  - login()    → llama a POST /auth/login y persiste el token.
 *  - register() → llama a POST /auth/register.
 *  - logout()   → elimina el token almacenado.
 *  - getMe()    → decodifica el JWT local sin llamada a la red.
 */
import { jwtDecode } from 'jwt-decode';
import { API_CONFIG } from '../config/api.config';
import type { AuthResponse, JwtUser, LoginPayload, RegisterPayload } from '../types';
import apiClient from './api.client';
import { StorageService } from './storage.service';

export const AuthService = {
  /**
   * Inicia sesión con email y contraseña.
   * Guarda el accessToken en el almacenamiento seguro.
   * @returns El token de acceso JWT.
   */
  async login(payload: LoginPayload): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>(
      API_CONFIG.ENDPOINTS.AUTH.LOGIN,
      payload,
    );
    await StorageService.saveToken(data.accessToken);
    return data;
  },

  /**
   * Registra un nuevo usuario en el sistema.
   * Guarda el accessToken recibido tras el registro.
   */
  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>(
      API_CONFIG.ENDPOINTS.AUTH.REGISTER,
      payload,
    );
    await StorageService.saveToken(data.accessToken);
    return data;
  },

  /**
   * Cierra la sesión eliminando el token almacenado.
   */
  async logout(): Promise<void> {
    await StorageService.removeToken();
  },

  /**
   * Decodifica el JWT almacenado localmente para obtener los datos del usuario.
   * No realiza ninguna llamada a la red.
   * @returns El payload del JWT o null si no hay sesión activa.
   */
  async getMe(): Promise<JwtUser | null> {
    const token = await StorageService.getToken();
    if (!token) return null;

    try {
      const decoded = jwtDecode<JwtUser>(token);
      // Verifica que el token no haya expirado
      const isExpired = decoded.exp * 1000 < Date.now();
      if (isExpired) {
        await StorageService.removeToken();
        return null;
      }
      return decoded;
    } catch {
      await StorageService.removeToken();
      return null;
    }
  },

  /**
   * Verifica si hay una sesión válida activa.
   */
  async isAuthenticated(): Promise<boolean> {
    const user = await this.getMe();
    return user !== null;
  },
};
