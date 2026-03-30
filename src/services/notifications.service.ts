/**
 * Servicio de Notificaciones Push.
 *
 * Flujo:
 *  1. Al hacer login → registerForPushNotifications() obtiene el Expo Push Token.
 *  2. Si el permiso fue otorgado → savePushToken() lo envía al backend (PATCH /users/push-token).
 *  3. El backend guarda el token en la tabla usuarios.pushToken.
 *  4. Cuando se crea un reporte, el backend notifica a todos los RESPONSABLE.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { API_CONFIG } from '../config/api.config';
import apiClient from './api.client';

// Configuración global: cómo mostrar las notificaciones cuando la app está en primer plano
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const NotificationsService = {
  /**
   * Solicita permiso y obtiene el Expo Push Token del dispositivo.
   * Devuelve null si el permiso fue denegado o el entorno no soporta push
   * (simuladores sin configuración, web, etc.).
   */
  async registerForPushNotifications(): Promise<string | null> {
    if (Platform.OS === 'web') return null;

    try {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;

      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') return null;

      const tokenData = await Notifications.getExpoPushTokenAsync();
      return tokenData.data;
    } catch {
      // Dispositivos sin configuración FCM/APNs (emuladores sin Google Play, etc.)
      return null;
    }
  },

  /**
   * Persiste el push token en el backend para el usuario autenticado.
   * Es silencioso ante errores para no bloquear el login.
   */
  async savePushToken(token: string): Promise<void> {
    try {
      await apiClient.patch(API_CONFIG.ENDPOINTS.USERS.PUSH_TOKEN, {
        pushToken: token,
      });
    } catch {
      // No crítico — se reintentará en el próximo login
    }
  },
};
