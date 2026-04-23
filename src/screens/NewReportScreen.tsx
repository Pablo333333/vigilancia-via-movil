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

const TIPOS = Object.values(TipoProblema);

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
                <Text style={styles.fotoActionText}>📷 Retomar</Text>
              </Pressable>
              <Pressable style={[styles.fotoActionBtn, styles.fotoActionRemove]} onPress={clearFoto}>
                <Text style={[styles.fotoActionText, { color: '#dc2626' }]}>✕ Quitar</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.fotoBtns}>
            <Pressable style={styles.fotoBtnPrimary} onPress={handleTomarFoto}>
              <Text style={styles.fotoBtnIcon}>📷</Text>
              <Text style={styles.fotoBtnPrimaryText}>Tomar foto</Text>
            </Pressable>
            <Pressable style={styles.fotoBtnSecondary} onPress={handleGaleria}>
              <Text style={styles.fotoBtnSecondaryText}>🖼 Galería</Text>
            </Pressable>
          </View>
        )}

        {/* ─── GPS (Sin feedback visual según pedido) ────────────────── */}
        {locationError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{locationError}</Text>
          </View>
        ) : null}

        {/* ─── Tipo de problema ─────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Tipo de problema</Text>
        <Pressable style={styles.pickerTrigger} onPress={() => setPickerVisible(true)}>
          <Text style={styles.pickerTriggerText}>
            {TIPO_PROBLEMA_LABELS[tipoSeleccionado]}
          </Text>
          <Text style={styles.pickerChevron}>▾</Text>
        </Pressable>

        {/* ─── Comentario ───────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Comentario <Text style={styles.optional}>(opcional)</Text></Text>
        <TextInput
          style={styles.textArea}
          placeholder="Describí el problema con más detalle…"
          placeholderTextColor="#9ca3af"
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

        {/* ─── Progreso de subida ───────────────────────────────────── */}
        {isSubmitting && uploadProgress > 0 && uploadProgress < 100 ? (
          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressBar, { width: `${uploadProgress}%` }]} />
            </View>
            <Text style={styles.progressText}>Enviando… {uploadProgress}%</Text>
          </View>
        ) : null}

        {/* ─── Botón enviar ─────────────────────────────────────────── */}
        <Pressable
          style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>📍 Enviar Reporte</Text>
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
  root: { flex: 1, backgroundColor: '#f0f4ff' },
  content: { padding: 20, paddingBottom: 48 },

  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 20,
    marginBottom: 8,
  },
  optional: { fontWeight: '400', textTransform: 'none' },

  // ─── Foto
  fotoBtns: { flexDirection: 'row', gap: 10 },
  fotoBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1a73e8',
    borderRadius: 12,
    paddingVertical: 16,
  },
  fotoBtnIcon: { fontSize: 26 },
  fotoBtnPrimaryText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  fotoBtnSecondary: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fotoBtnSecondaryText: { color: '#374151', fontSize: 17 },

  fotoPreviewContainer: { gap: 8 },
  fotoPreview: { width: '100%', height: 200, borderRadius: 12 },
  fotoActions: { flexDirection: 'row', gap: 8 },
  fotoActionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  fotoActionRemove: { backgroundColor: '#fee2e2' },
  fotoActionText: { fontSize: 16, fontWeight: '500', color: '#374151' },

  // ─── GPS
  gpsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  gpsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gpsDot: { fontSize: 14 },
  gpsCoords: { fontSize: 16, color: '#111827', fontFamily: 'monospace' },
  gpsPrecision: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  gpsLoading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gpsLoadingText: { fontSize: 16, color: '#6b7280' },
  gpsError: { fontSize: 16, color: '#dc2626' },

  // ─── Picker trigger
  pickerTrigger: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerTriggerText: { fontSize: 18, color: '#111827' },
  pickerChevron: { fontSize: 17, color: '#6b7280' },

  // ─── Comentario
  textArea: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    padding: 14,
    fontSize: 18,
    color: '#111827',
    minHeight: 100,
  },

  // ─── Error
  errorBox: {
    backgroundColor: '#fee2e2',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  errorText: { color: '#dc2626', fontSize: 16 },

  // ─── Progreso
  progressWrap: { marginTop: 12, gap: 4 },
  progressTrack: { height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: '#1a73e8' },
  progressText: { fontSize: 14, color: '#6b7280', textAlign: 'right' },

  // ─── Submit
  submitBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 19, fontWeight: '700' },

  // ─── Modal picker
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#d1d5db',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalOptionSelected: { backgroundColor: '#eff6ff', marginHorizontal: -4, paddingHorizontal: 8, borderRadius: 8 },
  modalOptionText: { fontSize: 18, color: '#374151' },
  modalOptionTextSelected: { color: '#1a73e8', fontWeight: '600' },
  modalCheck: { color: '#1a73e8', fontSize: 19, fontWeight: '700' },
  modalCloseBtn: {
    marginTop: 16,
    paddingVertical: 14,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
});
