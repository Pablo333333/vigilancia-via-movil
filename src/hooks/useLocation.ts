/**
 * Hook de GPS.
 *
 * Funcionalidades:
 *  - Solicita permiso de ubicación al montar (solo una vez).
 *  - getCurrentLocation(): captura la posición actual con alta precisión.
 *  - startWatching() / stopWatching(): modo de seguimiento en tiempo real.
 *  - hasPermission / isLoading / error: estados para el UI.
 */
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Coordenadas } from '../types';

interface UseLocationReturn {
  coordenadas: Coordenadas | null;
  hasPermission: boolean;
  isLoading: boolean;
  error: string | null;
  getCurrentLocation: () => Promise<Coordenadas>;
  startWatching: () => Promise<void>;
  stopWatching: () => void;
}

export function useLocation(): UseLocationReturn {
  const [coordenadas, setCoordenadas] = useState<Coordenadas | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  // Solicita permisos al montar el componente
  useEffect(() => {
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      setHasPermission(status === 'granted');
      if (status !== 'granted') {
        setError('Permiso de ubicación denegado. Actívalo en la configuración.');
      }
    });

    return () => {
      subscriptionRef.current?.remove();
    };
  }, []);

  /**
   * Obtiene la posición GPS actual con alta precisión.
   * Lanza un error si el permiso no fue concedido.
   */
  const getCurrentLocation = useCallback(async (): Promise<Coordenadas> => {
    if (!hasPermission) {
      throw new Error('Permiso de ubicación no concedido');
    }

    setIsLoading(true);
    setError(null);

    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });

      const coords: Coordenadas = {
        latitud: location.coords.latitude,
        longitud: location.coords.longitude,
        precision: location.coords.accuracy ?? 0,
      };

      setCoordenadas(coords);
      return coords;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error obteniendo la ubicación';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [hasPermission]);

  /**
   * Inicia el seguimiento en tiempo real de la posición.
   * Útil para mostrar la ubicación actual mientras se llena el formulario.
   */
  const startWatching = useCallback(async (): Promise<void> => {
    if (!hasPermission || subscriptionRef.current) return;

    subscriptionRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 10,
      },
      (location) => {
        setCoordenadas({
          latitud: location.coords.latitude,
          longitud: location.coords.longitude,
          precision: location.coords.accuracy ?? 0,
        });
      },
    );
  }, [hasPermission]);

  const stopWatching = useCallback((): void => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
  }, []);

  return {
    coordenadas,
    hasPermission,
    isLoading,
    error,
    getCurrentLocation,
    startWatching,
    stopWatching,
  };
}
