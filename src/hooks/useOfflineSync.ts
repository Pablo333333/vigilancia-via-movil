/**
 * Hook de sincronización offline.
 *
 * Escucha cambios de conectividad con @react-native-community/netinfo.
 * Cuando el dispositivo recupera internet, procesa la cola de reportes
 * pendientes y los envía al backend automáticamente.
 *
 * Debe usarse UNA sola vez en el layout raíz para estar activo en toda la app.
 */
import NetInfo from '@react-native-community/netinfo';
import { useCallback, useEffect, useRef, useState } from 'react';
import { API_CONFIG } from '../config/api.config';
import apiClient from '../services/api.client';
import { OfflineQueueService } from '../services/offline-queue.service';

export function useOfflineSync() {
  const isSyncingRef = useRef(false);
  const [pendingCount, setPendingCount] = useState(0);

  const refreshCount = useCallback(async () => {
    const count = await OfflineQueueService.count();
    setPendingCount(count);
  }, []);

  const syncQueue = useCallback(async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    try {
      const queue = await OfflineQueueService.getQueue();
      if (queue.length === 0) return;

      for (const item of queue) {
        try {
          const formData = new FormData();
          formData.append('tipoProblema', item.tipoProblema);
          formData.append('latitud', item.latitud.toString());
          formData.append('longitud', item.longitud.toString());
          formData.append('esOffline', 'true');

          if (item.comentario) {
            formData.append('comentario', item.comentario);
          }

          if (item.fotoUri) {
            formData.append('foto', {
              uri: item.fotoUri,
              type: item.fotoType ?? 'image/jpeg',
              name: item.fotoName ?? 'foto.jpg',
            } as unknown as Blob);
          }

          await apiClient.post(
            API_CONFIG.ENDPOINTS.REPORTS.BASE,
            formData,
            { headers: { 'Content-Type': 'multipart/form-data' } },
          );

          await OfflineQueueService.remove(item.localId);
        } catch {
          // Este ítem falla aún — lo dejamos en cola para el próximo ciclo
        }
      }
    } finally {
      isSyncingRef.current = false;
      await refreshCount();
    }
  }, [refreshCount]);

  useEffect(() => {
    // Carga inicial del contador
    refreshCount();

    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable) {
        syncQueue();
      }
    });

    return () => unsubscribe();
  }, [syncQueue, refreshCount]);

  return { pendingCount, syncQueue, refreshCount };
}
