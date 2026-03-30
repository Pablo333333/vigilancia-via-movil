/**
 * Configuración central de la API.
 *
 * En desarrollo: apunta al servidor NestJS local.
 * En producción: reemplazar BASE_URL con la URL del servidor desplegado.
 *
 * Para probar en dispositivo físico con el backend en la misma red:
 *   BASE_URL = 'http://<IP-de-tu-PC>:3000'
 */
export const API_CONFIG = {
  BASE_URL: __DEV__
    ? 'http://192.168.1.205:3000'  // Android Emulator → localhost del PC
    : 'https://api.vigilancia-via.com',

  TIMEOUT_MS: 15_000,

  ENDPOINTS: {
    AUTH: {
      LOGIN: '/auth/login',
      REGISTER: '/auth/register',
    },
    REPORTS: {
      BASE: '/reports',
      MINE: '/reports/mine',
      STATUS: (id: string) => `/reports/${id}/status`,
    },
    COMUNICADOS: {
      BASE: '/comunicados',
    },
    UPLOAD: {
      PHOTO: '/upload/photo',
    },
    USERS: {
      PUSH_TOKEN: '/users/push-token',
    },
  },
} as const;
