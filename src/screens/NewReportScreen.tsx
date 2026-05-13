/**
 * Pantalla de Nuevo Reporte — para usuarios autenticados e invitados.
 *
 * Diseño en una sola pantalla sin scroll (por defecto):
 *  - Fila compacta: cámara + galería + estado GPS
 *  - Grilla 4 × 2 de tipos de problema (iconos pequeños)
 *  - Input de comentario de una línea
 *  - Botón "Enviar Reporte" gigante fijo al fondo
 *
 * Incluye KeyboardAvoidingView y ScrollView para que el input sea visible al escribir.
 * Diferencia con ReportePublicoScreen: redirige a /(tabs)/mapa al finalizar.
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
  Image as ImageIcon,
  MapPin,
  Navigation,
  TrendingUp,
  Truck,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { PhotoPreviewModal } from '../components/PhotoPreviewModal';
import { API_CONFIG } from '../config/api.config';
import { THEME } from '../constants/theme';
import { useCamera } from '../hooks/useCamera';
import { useLocation } from '../hooks/useLocation';
import apiClient from '../services/api.client';
import { OfflineQueueService } from '../services/offline-queue.service';
import {
  TIPO_PROBLEMA_LABELS,
  TipoProblema,
  type ApiError,
  type FotoSeleccionada,
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

export default function NewReportScreen() {
  const {
    getCurrentLocation,
    startWatching,
    stopWatching,
    coordenadas,
    hasPermission: hasLocationPermission,
  } = useLocation();
  const { foto, hasCameraPermission, takePhoto, pickFromGallery, clearFoto, setFoto } = useCamera();

  const [fotoTemp, setFotoTemp] = useState<FotoSeleccionada | null>(null);
  const [tipoSeleccionado, setTipoSeleccionado] = useState<TipoProblema>(TipoProblema.PIEDRAS_VIA);
  const [comentario, setComentario] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    startWatching();
    return () => stopWatching();
  }, [startWatching, stopWatching]);

  const handleTomarFoto = useCallback(async () => {
    if (!hasCameraPermission) {
      Alert.alert('Permiso requerido', 'Activá el permiso de cámara en la configuración del dispositivo.');
      return;
    }
    try {
      const res = await takePhoto();
      if (res) setFotoTemp(res);
    } catch {
      Alert.alert('Error', 'No se pudo acceder a la cámara.');
    }
  }, [hasCameraPermission, takePhoto]);

  const handleGaleria = useCallback(async () => {
    try {
      const res = await pickFromGallery();
      if (res) setFotoTemp(res);
    } catch {
      Alert.alert('Error', 'No se pudo acceder a la galería.');
    }
  }, [pickFromGallery]);

  const handleSubmit = async () => {
    setErrorMsg(null);

    if (!hasLocationPermission || !coordenadas) {
      setErrorMsg('Esperando señal GPS. Intentá en un lugar con mejor cobertura.');
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);

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
        onUploadProgress: (event) => {
          if (event.total) setUploadProgress(Math.round((event.loaded * 100) / event.total));
        },
      });

      Alert.alert(
        '¡Reporte enviado!',
        'Tu reporte fue registrado con estado Pendiente. El equipo responsable lo atenderá pronto.',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)/mapa') }],
      );
    } catch (err) {
      const isNetworkError =
        err instanceof AxiosError &&
        (err.code === 'ERR_NETWORK' ||
          err.code === 'ECONNABORTED' ||
          err.code === 'ECONNREFUSED' ||
          !err.response);

      if (isNetworkError) {
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
            'No hay internet. Tu reporte fue guardado y se enviará al recuperar la señal.',
            [{ text: 'OK', onPress: () => router.replace('/(tabs)/mapa') }],
          );
        } catch {
          setErrorMsg('No se pudo guardar el reporte. Intentá nuevamente.');
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
      setUploadProgress(0);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Body ────────────────────────────────────────────── */}
        <View style={styles.body}>
          {/* Foto + GPS row */}
          <View style={styles.statusRow}>
            <Pressable
              style={[styles.fotoBtn, !!foto && styles.fotoBtnActive]}
              onPress={handleTomarFoto}
            >
              <Camera size={18} color={THEME.colors.white} />
              <Text style={styles.fotoBtnText}>
                {foto ? 'Foto lista ✓' : 'Tomar foto'}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.galleryBtn, !!foto && styles.galleryBtnActive]}
              onPress={foto ? clearFoto : handleGaleria}
            >
              <ImageIcon size={16} color={foto ? THEME.colors.danger : THEME.colors.primary} />
              <Text style={[styles.galleryBtnText, !!foto && styles.galleryBtnTextActive]}>
                {foto ? 'Quitar' : 'Galería'}
              </Text>
            </Pressable>

            <View style={[styles.gpsPill, coordenadas ? styles.gpsPillOk : styles.gpsPillWaiting]}>
              <Navigation size={13} color={coordenadas ? '#fff' : THEME.colors.textLight} />
              <Text style={[styles.gpsText, coordenadas ? styles.gpsTextOk : styles.gpsTextWaiting]}>
                {coordenadas ? 'GPS OK' : 'GPS…'}
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
                  <Icon size={18} color={isSelected ? THEME.colors.white : THEME.colors.primary} />
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

          {/* Progreso de subida */}
          {isSubmitting && uploadProgress > 0 && uploadProgress < 100 ? (
            <View style={styles.progressWrap}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressBar, { width: `${uploadProgress}%` }]} />
              </View>
              <Text style={styles.progressText}>Subiendo… {uploadProgress}%</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* ─── Footer: botón gigante fijo al fondo ─────────────── */}
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

      {/* ─── Modal de previsualización de foto ───────────────── */}
      <PhotoPreviewModal
        visible={!!fotoTemp}
        uri={fotoTemp?.uri ?? null}
        onConfirm={() => {
          setFoto(fotoTemp);
          setFotoTemp(null);
        }}
        onCancel={() => setFotoTemp(null)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  // ─── Body
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 10,
  },

  // ─── Status row: cámara + galería + GPS
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.colors.primary,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flex: 2,
  },
  fotoBtnActive: {
    backgroundColor: THEME.colors.success,
  },
  fotoBtnText: {
    color: THEME.colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  galleryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: THEME.colors.borderBlue,
    backgroundColor: THEME.colors.white,
    flex: 1,
    justifyContent: 'center',
  },
  galleryBtnActive: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  galleryBtnText: {
    color: THEME.colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  galleryBtnTextActive: {
    color: THEME.colors.danger,
  },
  gpsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
  },
  gpsPillOk: {
    backgroundColor: THEME.colors.success,
    borderColor: THEME.colors.success,
  },
  gpsPillWaiting: {
    backgroundColor: THEME.colors.cardYellow,
    borderColor: THEME.colors.borderBlue,
  },
  gpsText: { fontSize: 12, fontWeight: '700' },
  gpsTextOk: { color: THEME.colors.white },
  gpsTextWaiting: { color: THEME.colors.textLight },

  // ─── Section label
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

  // ─── Progreso de subida
  progressWrap: { gap: 4 },
  progressTrack: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: THEME.colors.success,
  },
  progressText: {
    fontSize: 12,
    color: THEME.colors.textLight,
    textAlign: 'right',
    fontWeight: '600',
  },

  // ─── Footer / Submit
  footer: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 20 : 16,
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
