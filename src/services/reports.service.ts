/**
 * Servicio de Reportes.
 *
 * Flujo principal para enviar un reporte con foto y GPS:
 *
 *   1. ReportsService.submitReport()
 *      ├── 2. Si hay foto → UploadService.uploadPhoto() → obtiene fotoUrl
 *      └── 3. POST /reports con { tipoProblema, comentario, fotoUrl, latitud, longitud }
 *
 * Todos los endpoints requieren JWT (se inyecta automáticamente en api.client.ts).
 */
import { API_CONFIG } from '../config/api.config';
import type {
  Coordenadas,
  CreateReportPayload,
  EstadoReporte,
  FotoSeleccionada,
  Reporte,
  TipoProblema,
} from '../types';
import apiClient from './api.client';
import { UploadService } from './upload.service';

// ─── Caché en memoria para getAll ──────────────────────────────────────────────

const CACHE_TTL_MS = 60_000; // 1 minuto

let _cachedReportes: Reporte[] | null = null;
let _cachedEstado: EstadoReporte | undefined;
let _cacheTimestamp = 0;

function isCacheValid(estado?: EstadoReporte): boolean {
  return (
    _cachedReportes !== null &&
    _cachedEstado === estado &&
    Date.now() - _cacheTimestamp < CACHE_TTL_MS
  );
}

// ─── Parámetros del formulario de nuevo reporte ────────────────────────────────

export interface NuevoReporteParams {
  tipoProblema: TipoProblema;
  comentario?: string;
  /** Foto tomada o seleccionada desde el dispositivo */
  foto?: FotoSeleccionada;
  /** Coordenadas GPS (obtenidas por useLocation) */
  coordenadas: Coordenadas;
  /** Callback de progreso de subida de foto (0–100) */
  onUploadProgress?: (percent: number) => void;
}

export const ReportsService = {
  /**
   * Envía un reporte completo:
   *  - Sube la foto si existe y obtiene la URL pública.
   *  - Crea el reporte en el backend con todos los datos.
   *
   * @returns El reporte creado con su ID y estado PENDIENTE.
   */
  async submitReport(params: NuevoReporteParams): Promise<Reporte> {
    let fotoUrl: string | undefined;

    // Paso 1: subir la foto si el usuario la adjuntó
    if (params.foto) {
      fotoUrl = await UploadService.uploadPhoto(
        params.foto,
        params.onUploadProgress,
      );
    }

    // Paso 2: construir el payload y crear el reporte
    const payload: CreateReportPayload = {
      tipoProblema: params.tipoProblema,
      comentario: params.comentario,
      fotoUrl,
      latitud: params.coordenadas.latitud,
      longitud: params.coordenadas.longitud,
    };

    const { data } = await apiClient.post<Reporte>(
      API_CONFIG.ENDPOINTS.REPORTS.BASE,
      payload,
    );

    this.invalidateCache();
    return data;
  },

  /**
   * Obtiene todos los reportes visibles para el usuario autenticado.
   * Opcionalmente filtra por estado.
   * Usa caché en memoria (TTL = 1 min). Pasar `force = true` para forzar refetch.
   */
  async getAll(estado?: EstadoReporte, force = false): Promise<Reporte[]> {
    if (!force && isCacheValid(estado)) {
      return _cachedReportes!;
    }

    const params = estado ? { estado } : undefined;
    const { data } = await apiClient.get<Reporte[]>(
      API_CONFIG.ENDPOINTS.REPORTS.BASE,
      { params },
    );

    _cachedReportes = data;
    _cachedEstado = estado;
    _cacheTimestamp = Date.now();

    return data;
  },

  /** Invalida la caché manualmente (p.ej. después de crear un reporte). */
  invalidateCache() {
    _cachedReportes = null;
    _cacheTimestamp = 0;
  },

  /**
   * Obtiene solo los reportes creados por el usuario autenticado (REPORTANTE).
   */
  async getMine(): Promise<Reporte[]> {
    const { data } = await apiClient.get<Reporte[]>(
      API_CONFIG.ENDPOINTS.REPORTS.MINE,
    );
    return data;
  },

  /**
   * Obtiene el detalle de un reporte por su ID.
   */
  async getById(id: string): Promise<Reporte> {
    const { data } = await apiClient.get<Reporte>(
      `${API_CONFIG.ENDPOINTS.REPORTS.BASE}/${id}`,
    );
    return data;
  },

  /**
   * Cambio rápido de estado sin evidencia (p.ej. PENDIENTE → EN_PROCESO).
   */
  async updateStatus(id: string, estado: EstadoReporte): Promise<Reporte> {
    const { data } = await apiClient.patch<Reporte>(
      API_CONFIG.ENDPOINTS.REPORTS.STATUS(id),
      { estado },
    );
    this.invalidateCache();
    return data;
  },

  /**
   * Marca un reporte como SOLUCIONADO adjuntando foto de evidencia y comentario técnico.
   * Envía multipart/form-data al mismo endpoint PATCH /reports/:id/status.
   */
  async resolveReport(
    id: string,
    params: {
      comentarioResolucion?: string;
      foto?: FotoSeleccionada;
      onUploadProgress?: (percent: number) => void;
    },
  ): Promise<Reporte> {
    const formData = new FormData();
    formData.append('estado', 'SOLUCIONADO');

    if (params.comentarioResolucion?.trim()) {
      formData.append('comentarioResolucion', params.comentarioResolucion.trim());
    }

    if (params.foto) {
      formData.append('fotoEvidencia', {
        uri: params.foto.uri,
        type: params.foto.type,
        name: params.foto.name,
      } as unknown as Blob);
    }

    const { data } = await apiClient.patch<Reporte>(
      API_CONFIG.ENDPOINTS.REPORTS.STATUS(id),
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (event) => {
          if (params.onUploadProgress && event.total) {
            params.onUploadProgress(Math.round((event.loaded * 100) / event.total));
          }
        },
      },
    );
    this.invalidateCache();
    return data;
  },
};
