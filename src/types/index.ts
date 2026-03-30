// ─── Enums (espejados del backend) ────────────────────────────────────────────

export const Rol = {
  REPORTANTE: 'REPORTANTE',
  RESPONSABLE: 'RESPONSABLE',
  SUPERVISOR: 'SUPERVISOR',
} as const;
export type Rol = (typeof Rol)[keyof typeof Rol];

export const TipoProblema = {
  PIEDRAS_VIA: 'PIEDRAS_VIA',
  VIA_SIN_AFIRMADO: 'VIA_SIN_AFIRMADO',
  VOLQUETES: 'VOLQUETES',
  MUCHA_PENDIENTE: 'MUCHA_PENDIENTE',
  SENALIZACION: 'SENALIZACION',
  TIEMPO_ESPERA: 'TIEMPO_ESPERA',
  DERRUMBE: 'DERRUMBE',
  CAMBIO_TRAZO: 'CAMBIO_TRAZO',
} as const;
export type TipoProblema = (typeof TipoProblema)[keyof typeof TipoProblema];

export const TIPO_PROBLEMA_LABELS: Record<TipoProblema, string> = {
  PIEDRAS_VIA: 'Piedras en la vía',
  VIA_SIN_AFIRMADO: 'Vía sin afirmado',
  VOLQUETES: 'Volquetes no dan pase',
  MUCHA_PENDIENTE: 'Mucha pendiente',
  SENALIZACION: 'Deficiente señalización',
  TIEMPO_ESPERA: 'Mucho tiempo de espera',
  DERRUMBE: 'Derrumbe',
  CAMBIO_TRAZO: 'Cambio de trazo',
};

export const EstadoReporte = {
  PENDIENTE: 'PENDIENTE',
  EN_PROCESO: 'EN_PROCESO',
  SOLUCIONADO: 'SOLUCIONADO',
} as const;
export type EstadoReporte = (typeof EstadoReporte)[keyof typeof EstadoReporte];

// ─── Auth ──────────────────────────────────────────────────────────────────────

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  rol: Rol;
}

export interface AuthResponse {
  accessToken: string;
}

export interface JwtUser {
  sub: string;
  email: string;
  rol: Rol;
  iat: number;
  exp: number;
}

// ─── Reporte ───────────────────────────────────────────────────────────────────

export interface CreateReportPayload {
  tipoProblema: TipoProblema;
  comentario?: string;
  /** URL pública de la foto (obtenida tras subir la imagen) */
  fotoUrl?: string;
  latitud: number;
  longitud: number;
}

export interface Reporte {
  id: string;
  tipoProblema: TipoProblema;
  comentario?: string;
  fotoUrl?: string;
  latitud: number;
  longitud: number;
  fechaCreacion: string;
  updatedAt: string;
  estado: EstadoReporte;
  reportanteId: string;
  comentarioResolucion?: string;
  fotoEvidenciaUrl?: string;
}

// ─── Comunicado ────────────────────────────────────────────────────────────────

export interface Comunicado {
  id: string;
  mensaje: string;
  fechaPublicacion: string;
  duracionRestriccion?: number;
  responsableId: string;
}

// ─── GPS ───────────────────────────────────────────────────────────────────────

export interface Coordenadas {
  latitud: number;
  longitud: number;
  precision: number;
}

// ─── Foto ──────────────────────────────────────────────────────────────────────

export interface FotoSeleccionada {
  uri: string;
  type: string;
  name: string;
  base64?: string;
}

// ─── Error de API ──────────────────────────────────────────────────────────────

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error: string;
}
