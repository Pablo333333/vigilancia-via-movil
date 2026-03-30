/**
 * Cola de reportes offline.
 *
 * Cuando el dispositivo no tiene conexión, los reportes se guardan aquí
 * usando AsyncStorage. El hook useOfflineSync los envía automáticamente
 * cuando la conexión se recupera.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TipoProblema } from '../types';

const QUEUE_KEY = '@vigilancia:offline_queue';

export interface PendingReport {
  /** Identificador local generado en el dispositivo */
  localId: string;
  tipoProblema: TipoProblema;
  latitud: number;
  longitud: number;
  comentario?: string;
  /** URI local de la foto (file:// path en el dispositivo) */
  fotoUri?: string;
  fotoType?: string;
  fotoName?: string;
  /** Fecha en que se intentó enviar por primera vez */
  creadoEn: string;
}

export const OfflineQueueService = {
  /**
   * Agrega un reporte a la cola local.
   * @returns El localId asignado al reporte.
   */
  async enqueue(
    data: Omit<PendingReport, 'localId' | 'creadoEn'>,
  ): Promise<string> {
    const queue = await OfflineQueueService.getQueue();
    const localId = `offline_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const item: PendingReport = {
      ...data,
      localId,
      creadoEn: new Date().toISOString(),
    };
    queue.push(item);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    return localId;
  },

  /** Devuelve todos los reportes pendientes de sincronizar. */
  async getQueue(): Promise<PendingReport[]> {
    try {
      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as PendingReport[];
    } catch {
      return [];
    }
  },

  /** Elimina un reporte de la cola por su localId. */
  async remove(localId: string): Promise<void> {
    const queue = await OfflineQueueService.getQueue();
    const updated = queue.filter((r) => r.localId !== localId);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
  },

  /** Devuelve la cantidad de reportes pendientes. */
  async count(): Promise<number> {
    const queue = await OfflineQueueService.getQueue();
    return queue.length;
  },

  /** Limpia toda la cola (usar solo en tests o logout). */
  async clear(): Promise<void> {
    await AsyncStorage.removeItem(QUEUE_KEY);
  },
};
