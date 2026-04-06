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
  BASE_URL: process.env.NEXT_PUBLIC_API_URL,

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
