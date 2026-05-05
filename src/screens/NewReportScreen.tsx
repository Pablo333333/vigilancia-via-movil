/**
 * Pantalla de Nuevo Reporte de Incidente
 *
 * Flujo:
 *  1. Al montar → solicita permisos de cámara y ubicación; inicia GPS en vivo.
 *  2. Usuario toma foto con la cámara (o elige de galería).
 *  3. Selecciona el tipo de problema desde un modal picker.
 *  4. (Opcional) Escribe un comentario.
 *  5. Al presionar "Enviar" → construye FormData y hace POST /reports.
 *     El estado inicial PENDIENTE se asigna por defecto en el backend.
 */
import { AxiosError } from 'axios';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { API_CONFIG } from '../config/api.config';
import { PhotoPreviewModal } from '../components/PhotoPreviewModal';
import { useCamera } from '../hooks/useCamera';
import { useLocation } from '../hooks/useLocation';
import apiClient from '../services/api.client';
import { OfflineQueueService } from '../services/offline-queue.service';
import {
  TIPO_PROBLEMA_LABELS,
  TipoProblema,
  type ApiError,
  type Reporte,
} from '../types';

import {
  AlertTriangle,
  Droplets,
  Construction,
  Zap,
  Trash2,
  Trees,
  Camera,
  MessageSquare,
  Image as ImageIcon,
  ChevronDown,
  Navigation,
  Check
} from 'lucide-react-native';
import { THEME } from '../constants/theme';

const TIPOS = Object.values(TipoProblema);

const TIPO_ICONS: Record<TipoProblema, any> = {
  [TipoProblema.PIEDRAS_VIA]: AlertTriangle,
  [TipoProblema.BACHE]: AlertTriangle,
  [TipoProblema.INUNDACION]: Droplets,
  [TipoProblema.OBRA_SIN_SENAL]: Construction,
  [TipoProblema.CABLE_SUELTO]: Zap,
  [TipoProblema.BASURA_ACUMULADA]: Trash2,
  [TipoProblema.ARBOL_CAIDO]: Trees,
  [TipoProblema.SEMAFORO_FALLA]: Zap,
  [TipoProblema.OTRO]: MessageSquare,
};

export default function NewReportScreen() {
  const { getCurrentLocation, startWatching, stopWatching, coordenadas, hasPermission: hasLocationPermission, error: locationError } = useLocation();
  const { foto, hasCameraPermission, takePhoto, pickFromGallery, clearFoto, setFoto } = useCamera();

  const [fotoTemp, setFotoTemp] = useState<FotoSeleccionada | null>(null);
  const [tipoSeleccionado, setTipoSeleccionado] = useState<TipoProblema>(TipoProblema.PIEDRAS_VIA);
  const [comentario, setComentario] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);

  useEffect(() => {
    startWatching();
    return () => stopWatching();
  }, [startWatching, stopWatching]);

  const handleTomarFoto = useCallback(async () => {
    if (!hasCameraPermission) {
      Alert.alert(
        'Permiso requerido',
        'Activá el permiso de cámara en la configuración del dispositivo.',
      );
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

    if (!hasLocationPermission) {
      setErrorMsg('Se necesita permiso de ubicación para enviar el reporte.');
      return;
    }
    if (!coordenadas) {
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
      if (comentario.trim()) {
        formData.append('comentario', comentario.trim());
      }
      if (foto) {
        formData.append('foto', {
          uri: foto.uri,
          type: foto.type,
          name: foto.name,
        } as unknown as Blob);
      }

      await apiClient.post<Reporte>(
        API_CONFIG.ENDPOINTS.REPORTS.BASE,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (event) => {
            if (event.total) {
              setUploadProgress(Math.round((event.loaded * 100) / event.total));
            }
          },
        },
      );

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
        // Sin conexión → guardar en cola offline
        try {
          const ubicacion = coordenadas ?? { latitud: 0, longitud: 0, precision: 0 };
          await OfflineQueueService.enqueue({
            tipoProblema: tipoSeleccionado,
            latitud: ubicacion.latitud,
            longitud: ubicacion.longitud,
            comentario: comentario.trim() || undefined,
            fotoUri: foto?.uri,
            fotoType: foto?.type,
            fotoName: foto?.name,
          });

          Alert.alert(
            'Sin conexión — Guardado',
            'No hay internet. Tu reporte fue guardado en el dispositivo y se enviará automáticamente cuando recuperes la señal.',
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
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* ─── Foto ─────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Foto del incidente</Text>

        {foto ? (
          <View style={styles.fotoPreviewContainer}>
            <Image source={{ uri: foto.uri }} style={styles.fotoPreview} resizeMode="cover" />
            <View style={styles.fotoActions}>
              <Pressable style={styles.fotoActionBtn} onPress={handleTomarFoto}>
                <Camera size={20} color={THEME.colors.primary} />
                <Text style={styles.fotoActionText}>Retomar</Text>
              </Pressable>
              <Pressable style={[styles.fotoActionBtn, styles.fotoActionRemove]} onPress={clearFoto}>
                <Text style={[styles.fotoActionText, { color: THEME.colors.danger }]}>✕ Quitar</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.fotoBtns}>
            <Pressable style={styles.fotoBtnPrimary} onPress={handleTomarFoto}>
              <Camera size={32} color={THEME.colors.white} />
              <Text style={styles.fotoBtnPrimaryText}>Tomar foto</Text>
            </Pressable>
            <Pressable style={styles.fotoBtnSecondary} onPress={handleGaleria}>
              <ImageIcon size={24} color={THEME.colors.primary} />
              <Text style={styles.fotoBtnSecondaryText}>Galería</Text>
            </Pressable>
          </View>
        )}

        {/* ─── Tipo de problema (Grilla 2 columnas) ─────────────────── */}
        <Text style={styles.sectionLabel}>¿Qué problema ves?</Text>
        <View style={styles.grid}>
          {TIPOS.map((tipo) => {
            const Icon = TIPO_ICONS[tipo] || AlertTriangle;
            const isSelected = tipo === tipoSeleccionado;
            return (
              <Pressable
                key={tipo}
                style={[
                  styles.gridCard,
                  isSelected && styles.gridCardSelected
                ]}
                onPress={() => setTipoSeleccionado(tipo)}
              >
                <View style={[styles.gridIconCircle, isSelected && styles.gridIconCircleSelected]}>
                  <Icon 
                    size={28} 
                    color={isSelected ? THEME.colors.white : THEME.colors.primary} 
                  />
                </View>
                <Text style={[styles.gridText, isSelected && styles.gridTextSelected]}>
                  {TIPO_PROBLEMA_LABELS[tipo]}
                </Text>
                {isSelected && (
                  <View style={styles.checkBadge}>
                    <Check size={12} color={THEME.colors.white} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* ─── Comentario ───────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Comentario <Text style={styles.optional}>(opcional)</Text></Text>
        <TextInput
          style={styles.textArea}
          placeholder="Describí el problema con más detalle…"
          placeholderTextColor={THEME.colors.textLight}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          value={comentario}
          onChangeText={setComentario}
        />

        {/* ─── Error ────────────────────────────────────────────────── */}
        {errorMsg ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        {/* ─── Submit ─────────────────────────────────────────── */}
        <Pressable
          style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color={THEME.colors.white} />
          ) : (
            <>
              <Navigation size={24} color={THEME.colors.white} />
              <Text style={styles.submitBtnText}>Enviar Reporte</Text>
            </>
          )}
        </Pressable>
      </ScrollView>

      {/* ─── Previsualización de Foto ─────────────────────────────── */}
      <PhotoPreviewModal
        visible={!!fotoTemp}
        uri={fotoTemp?.uri ?? null}
        onConfirm={() => {
          setFoto(fotoTemp);
          setFotoTemp(null);
        }}
        onCancel={() => setFotoTemp(null)}
      />

      {/* ─── Modal picker de tipo ─────────────────────────────────── */}
      <Modal
        visible={pickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setPickerVisible(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Tipo de problema</Text>
            {TIPOS.map((tipo) => {
              const selected = tipo === tipoSeleccionado;
              return (
                <Pressable
                  key={tipo}
                  style={[styles.modalOption, selected && styles.modalOptionSelected]}
                  onPress={() => {
                    setTipoSeleccionado(tipo);
                    setPickerVisible(false);
                  }}
                >
                  <Text style={[styles.modalOptionText, selected && styles.modalOptionTextSelected]}>
                    {TIPO_PROBLEMA_LABELS[tipo]}
                  </Text>
                  {selected && <Text style={styles.modalCheck}>✓</Text>}
                </Pressable>
              );
            })}
            <Pressable
              style={styles.modalCloseBtn}
              onPress={() => setPickerVisible(false)}
            >
              <Text style={styles.modalCloseBtnText}>Cerrar</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.colors.background },
  header: {
    backgroundColor: THEME.colors.primary,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 25,
    paddingHorizontal: 20,
    borderBottomLeftRadius: THEME.sizes.radius,
    borderBottomRightRadius: THEME.sizes.radius,
    ...THEME.shadows.medium,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: THEME.colors.white,
    textAlign: 'center',
  },
  content: { padding: 20, paddingBottom: 48 },

  sectionLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.primary,
    marginTop: 24,
    marginBottom: 12,
  },
  optional: { fontWeight: '400', color: THEME.colors.textLight },

  // ─── Foto
  fotoBtns: { flexDirection: 'row', gap: 12 },
  fotoBtnPrimary: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: THEME.colors.accent,
    borderRadius: THEME.sizes.radius,
    paddingVertical: 18,
    ...THEME.shadows.soft,
  },
  fotoBtnPrimaryText: { color: THEME.colors.white, fontSize: 18, fontWeight: '700' },
  fotoBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: THEME.sizes.radius,
    borderWidth: 2,
    borderColor: THEME.colors.borderBlue,
    backgroundColor: THEME.colors.white,
    paddingVertical: 18,
  },
  fotoBtnSecondaryText: { color: THEME.colors.primary, fontSize: 16, fontWeight: '600' },

  fotoPreviewContainer: { gap: 12 },
  fotoPreview: { width: '100%', height: 220, borderRadius: THEME.sizes.radius, borderWidth: 1, borderColor: THEME.colors.borderBlue },
  fotoActions: { flexDirection: 'row', gap: 12 },
  fotoActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: THEME.sizes.radius,
    backgroundColor: THEME.colors.cardYellow,
    borderWidth: 1,
    borderColor: THEME.colors.borderBlue,
  },
  fotoActionRemove: { backgroundColor: '#FEE2E2', borderColor: '#FECACA' },
  fotoActionText: { fontSize: 16, fontWeight: '600', color: THEME.colors.primary },

  // ─── Grilla de tipos
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  gridCard: {
    width: '48%',
    backgroundColor: THEME.colors.cardYellow,
    borderRadius: THEME.sizes.radius,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.borderBlue,
    aspectRatio: 1.1,
    ...THEME.shadows.soft,
  },
  gridCardSelected: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  gridIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: THEME.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: THEME.colors.borderBlue,
  },
  gridIconCircleSelected: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'transparent',
  },
  gridText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.primary,
    textAlign: 'center',
  },
  gridTextSelected: {
    color: THEME.colors.white,
  },
  checkBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: THEME.colors.accent,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Comentario
  textArea: {
    backgroundColor: THEME.colors.white,
    borderRadius: THEME.sizes.radius,
    borderWidth: 1,
    borderColor: THEME.colors.borderBlue,
    padding: 16,
    fontSize: 16,
    color: THEME.colors.text,
    minHeight: 120,
    ...THEME.shadows.soft,
  },

  // ─── Error
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: THEME.sizes.radius,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: { color: THEME.colors.danger, fontSize: 15, fontWeight: '600', textAlign: 'center' },

  // ─── Submit
  submitBtn: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.accent,
    borderRadius: THEME.sizes.radius,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 32,
    ...THEME.shadows.medium,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: THEME.colors.white, fontSize: 20, fontWeight: '800' },
});
