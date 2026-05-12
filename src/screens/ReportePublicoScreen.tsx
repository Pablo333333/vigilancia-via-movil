/**
 * Pantalla pública de reporte — accesible sin registro.
 *
 * Diseño en una sola pantalla sin scroll:
 *  - Header con título y botón Salir (→ portada)
 *  - Botón de cámara + estado GPS (fila compacta)
 *  - Grilla 4 × 2 de tipos de problema (iconos pequeños)
 *  - Input de comentario de una línea
 *  - Botón grande "Enviar Reporte" fijo al fondo
 */
import { AxiosError } from 'axios';
import { router } from 'expo-router';
import {
  AlertCircle,
  AlertTriangle,
  Camera,
  Clock,
  Construction,
  GitBranch,
  MapPin,
  Navigation,
  TrendingUp,
  Truck,
  X,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_CONFIG } from '../config/api.config';
import { useCamera } from '../hooks/useCamera';
import { useLocation } from '../hooks/useLocation';
import apiClient from '../services/api.client';
import { OfflineQueueService } from '../services/offline-queue.service';
import { THEME } from '../constants/theme';
import {
  TIPO_PROBLEMA_LABELS,
  TipoProblema,
  type ApiError,
  type Reporte,
} from '../types';

const TIPOS = Object.values(TipoProblema);

const TIPO_ICONS: Record<TipoProblema, React.ComponentType<{ size: number; color: string }>> = {
  [TipoProblema.PIEDRAS_VIA]: AlertTriangle,
  [TipoProblema.VIA_SIN_AFIRMADO]: Construction,
  [TipoProblema.VOLQUETES]: Truck,
  [TipoProblema.MUCHA_PENDIENTE]: TrendingUp,
  [TipoProblema.SENALIZACION]: AlertCircle,
  [TipoProblema.TIEMPO_ESPERA]: Clock,
  [TipoProblema.DERRUMBE]: MapPin,
  [TipoProblema.CAMBIO_TRAZO]: GitBranch,
};

export default function ReportePublicoScreen() {
  const {
    getCurrentLocation,
    startWatching,
    stopWatching,
    coordenadas,
    hasPermission: hasLocationPermission,
  } = useLocation();
  const { foto, hasCameraPermission, takePhoto } = useCamera();

  const [tipoSeleccionado, setTipoSeleccionado] = useState<TipoProblema>(TipoProblema.PIEDRAS_VIA);
  const [comentario, setComentario] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    startWatching();
    return () => stopWatching();
  }, [startWatching, stopWatching]);

  const handleTomarFoto = useCallback(async () => {
    if (!hasCameraPermission) {
      Alert.alert('Permiso requerido', 'Activá el permiso de cámara en la configuración.');
      return;
    }
    try {
      await takePhoto();
    } catch {
      Alert.alert('Error', 'No se pudo acceder a la cámara.');
    }
  }, [hasCameraPermission, takePhoto]);

  const handleSubmit = async () => {
    setErrorMsg(null);
    if (!hasLocationPermission || !coordenadas) {
      setErrorMsg('Esperando GPS. Intentá en un lugar con mejor cobertura.');
      return;
    }
    setIsSubmitting(true);
    try {
      const ubicacion = await getCurrentLocation();
      const formData = new FormData();
      formData.append('tipoProblema', tipoSeleccionado);
      formData.append('latitud', ubicacion.latitud.toString());
      formData.append('longitud', ubicacion.longitud.toString());
      if (comentario.trim()) formData.append('comentario', comentario.trim());
      if (foto) {
        formData.append('foto', {
          uri: foto.uri,
          type: foto.type,
          name: foto.name,
        } as unknown as Blob);
      }

      await apiClient.post<Reporte>(API_CONFIG.ENDPOINTS.REPORTS.BASE, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      Alert.alert(
        '¡Reporte enviado!',
        'Tu reporte fue registrado. El equipo responsable lo atenderá pronto.',
        [{ text: 'OK', onPress: () => router.replace('/') }],
      );
    } catch (err) {
      const isNetwork =
        err instanceof AxiosError &&
        (err.code === 'ERR_NETWORK' ||
          err.code === 'ECONNABORTED' ||
          err.code === 'ECONNREFUSED' ||
          !err.response);

      if (isNetwork) {
        try {
          const ub = coordenadas ?? { latitud: 0, longitud: 0, precision: 0 };
          await OfflineQueueService.enqueue({
            tipoProblema: tipoSeleccionado,
            latitud: ub.latitud,
            longitud: ub.longitud,
            comentario: comentario.trim() || undefined,
            fotoUri: foto?.uri,
            fotoType: foto?.type,
            fotoName: foto?.name,
          });
          Alert.alert(
            'Sin conexión — Guardado',
            'Se enviará automáticamente cuando recuperes la señal.',
            [{ text: 'OK', onPress: () => router.replace('/') }],
          );
        } catch {
          setErrorMsg('No se pudo guardar el reporte. Intentá de nuevo.');
        }
      } else if (err instanceof AxiosError) {
        const data = err.response?.data as ApiError | undefined;
        setErrorMsg(
          Array.isArray(data?.message)
            ? data.message.join('\n')
            : (data?.message ?? 'Error al enviar el reporte.'),
        );
      } else {
        setErrorMsg('Error inesperado. Verificá tu conexión.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      {/* ─── Header ──────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Nuevo Reporte</Text>
          <Text style={styles.headerSubtitle}>Sin registro</Text>
        </View>
        <Pressable style={styles.salirBtn} onPress={() => router.replace('/')}>
          <X size={16} color={THEME.colors.white} />
          <Text style={styles.salirText}>Salir</Text>
        </Pressable>
      </View>

      {/* ─── Body ────────────────────────────────────────────── */}
      <View style={styles.body}>
        {/* Foto + GPS row */}
        <View style={styles.statusRow}>
          <Pressable
            style={[styles.fotoBtn, !!foto && styles.fotoBtnActive]}
            onPress={handleTomarFoto}
          >
            <Camera size={18} color={foto ? THEME.colors.success : THEME.colors.white} />
            <Text style={[styles.fotoBtnText, !!foto && styles.fotoBtnTextActive]}>
              {foto ? 'Foto lista ✓' : 'Tomar foto'}
            </Text>
          </Pressable>

          <View style={[styles.gpsPill, coordenadas ? styles.gpsPillOk : styles.gpsPillWaiting]}>
            <Navigation size={13} color={coordenadas ? '#fff' : THEME.colors.textLight} />
            <Text style={[styles.gpsText, coordenadas ? styles.gpsTextOk : styles.gpsTextWaiting]}>
              {coordenadas ? 'GPS listo' : 'Obteniendo GPS…'}
            </Text>
          </View>
        </View>

        {/* Tipo de problema */}
        <Text style={styles.sectionLabel}>¿Qué problema ves?</Text>
        <View style={styles.grid}>
          {TIPOS.map((tipo) => {
            const Icon = TIPO_ICONS[tipo] ?? AlertTriangle;
            const isSelected = tipo === tipoSeleccionado;
            return (
              <Pressable
                key={tipo}
                style={[styles.gridCard, isSelected && styles.gridCardSelected]}
                onPress={() => setTipoSeleccionado(tipo)}
              >
                <Icon
                  size={18}
                  color={isSelected ? THEME.colors.white : THEME.colors.primary}
                />
                <Text
                  style={[styles.gridText, isSelected && styles.gridTextSelected]}
                  numberOfLines={2}
                >
                  {TIPO_PROBLEMA_LABELS[tipo]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Comentario */}
        <TextInput
          style={styles.commentInput}
          placeholder="Comentario adicional (opcional)…"
          placeholderTextColor={THEME.colors.textLight}
          value={comentario}
          onChangeText={setComentario}
          returnKeyType="done"
        />

        {/* Error inline */}
        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
      </View>

      {/* ─── Footer: botón de envío grande y prominente ───────── */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color={THEME.colors.white} size="large" />
          ) : (
            <>
              <Navigation size={26} color={THEME.colors.white} />
              <Text style={styles.submitBtnText}>Enviar Reporte</Text>
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },

  // ─── Header
  header: {
    backgroundColor: THEME.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    ...THEME.shadows.medium,
  },
  headerLeft: { gap: 2 },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: THEME.colors.white,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  salirBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  salirText: {
    color: THEME.colors.white,
    fontSize: 14,
    fontWeight: '700',
  },

  // ─── Body
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 10,
  },

  // Status row
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.colors.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flex: 1,
  },
  fotoBtnActive: {
    backgroundColor: THEME.colors.success,
  },
  fotoBtnText: {
    color: THEME.colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  fotoBtnTextActive: {
    color: THEME.colors.white,
  },
  gpsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flex: 1,
    borderWidth: 1,
  },
  gpsPillOk: {
    backgroundColor: THEME.colors.success,
    borderColor: THEME.colors.success,
  },
  gpsPillWaiting: {
    backgroundColor: THEME.colors.cardYellow,
    borderColor: THEME.colors.borderBlue,
  },
  gpsText: { fontSize: 13, fontWeight: '600' },
  gpsTextOk: { color: THEME.colors.white },
  gpsTextWaiting: { color: THEME.colors.textLight },

  // Section label
  sectionLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ─── Grilla 4 columnas × 2 filas (iconos pequeños)
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gridCard: {
    width: '22.5%',
    aspectRatio: 0.9,
    backgroundColor: THEME.colors.cardYellow,
    borderRadius: 14,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.borderBlue,
    gap: 4,
    ...THEME.shadows.soft,
  },
  gridCardSelected: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  gridText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.primary,
    textAlign: 'center',
    lineHeight: 13,
  },
  gridTextSelected: {
    color: THEME.colors.white,
  },

  // ─── Comentario
  commentInput: {
    backgroundColor: THEME.colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.colors.borderBlue,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 15,
    color: THEME.colors.text,
    ...THEME.shadows.soft,
  },

  // ─── Error
  errorText: {
    color: THEME.colors.danger,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    padding: 10,
  },

  // ─── Footer / Submit
  footer: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 8 : 16,
    paddingTop: 12,
  },
  submitBtn: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.accent,
    borderRadius: 30,
    paddingVertical: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    ...THEME.shadows.medium,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: {
    color: THEME.colors.white,
    fontSize: 22,
    fontWeight: '800',
  },
});
