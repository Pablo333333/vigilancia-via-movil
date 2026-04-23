/**
 * Pantalla de Gestión de Soluciones
 *
 * Accesible solo para RESPONSABLE y SUPERVISOR.
 * Muestra reportes PENDIENTES y EN_PROCESO con dos acciones:
 *
 *  - "Tomar en mano" (PENDIENTE → EN_PROCESO) — acción inmediata, sin formulario.
 *  - "Resolver"      (cualquier → SOLUCIONADO) — abre formulario con foto de
 *    evidencia y comentario técnico. Dispara PATCH /reports/:id/status.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { PhotoPreviewModal } from '../components/PhotoPreviewModal';
import { useCamera } from '../hooks/useCamera';
import { useAuth } from '../hooks/useAuth';
import { ReportsService } from '../services/reports.service';
import {
  EstadoReporte,
  Rol,
  TIPO_PROBLEMA_LABELS,
  type FotoSeleccionada,
  type Reporte,
} from '../types';

// ─── Constantes ────────────────────────────────────────────────────────────────

const ESTADO_COLORS: Record<string, string> = {
  PENDIENTE: '#f59e0b',
  EN_PROCESO: '#3b82f6',
};

const ESTADO_LABELS: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso',
};

// ─── Componente principal ──────────────────────────────────────────────────────

export default function SolucionesScreen() {
  const { user } = useAuth();

  // ── Acceso denegado para REPORTANTE ──────────────────────────────────────────
  if (user && user.rol === Rol.REPORTANTE) {
    return (
      <View style={styles.center}>
        <Text style={styles.lockIcon}>🔒</Text>
        <Text style={styles.lockTitle}>Acceso restringido</Text>
        <Text style={styles.lockSubtitle}>
          Esta sección está disponible solo para Responsables y Supervisores.
        </Text>
      </View>
    );
  }

  // SUPERVISOR puede ver pero NO intervenir
  const canEdit = user?.rol === Rol.RESPONSABLE;
  return <SolucionesList canEdit={canEdit} />;
}

// ─── Lista de reportes ────────────────────────────────────────────────────────

function SolucionesList({ canEdit }: { canEdit: boolean }) {
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tomarEnManoId, setTomarEnManoId] = useState<string | null>(null);
  const [resolviendo, setResolviendo] = useState<Reporte | null>(null);

  const fetchReportes = useCallback(async () => {
    try {
      const data = await ReportsService.getAll();
      setReportes(
        data.filter(
          (r) => r.estado === EstadoReporte.PENDIENTE || r.estado === EstadoReporte.EN_PROCESO,
        ),
      );
    } catch {
      Alert.alert('Error', 'No se pudieron cargar los reportes.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchReportes(); }, [fetchReportes]);

  const headerSummary = useMemo(() => {
    const pendientes = reportes.filter((r) => r.estado === EstadoReporte.PENDIENTE).length;
    const enProceso = reportes.filter((r) => r.estado === EstadoReporte.EN_PROCESO).length;
    const total = reportes.length;

    if (total === 0) return '';

    const parts: string[] = [];
    if (pendientes > 0) parts.push(`${pendientes} pendiente${pendientes !== 1 ? 's' : ''}`);
    if (enProceso > 0) parts.push(`${enProceso} en proceso`);

    return `${total} reporte${total !== 1 ? 's' : ''} activo${total !== 1 ? 's' : ''} — ${parts.join(' y ')}`;
  }, [reportes]);

  const handleTomarEnMano = async (reporte: Reporte) => {
    setTomarEnManoId(reporte.id);
    try {
      await ReportsService.updateStatus(reporte.id, EstadoReporte.EN_PROCESO);
      await fetchReportes();
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el estado.');
    } finally {
      setTomarEnManoId(null);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1a73e8" />
        <Text style={styles.loadingText}>Cargando reportes…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <FlatList
        data={reportes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={reportes.length === 0 ? styles.emptyContainer : styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchReportes(); }}
            colors={['#1a73e8']}
          />
        }
        ListHeaderComponent={
          headerSummary ? (
            <Text style={styles.listHeader}>{headerSummary}</Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyTitle}>Todo al día</Text>
            <Text style={styles.emptySubtitle}>No hay reportes pendientes.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <ReporteCard
            reporte={item}
            canEdit={canEdit}
            isTomarEnManoLoading={tomarEnManoId === item.id}
            onTomarEnMano={() => handleTomarEnMano(item)}
            onResolver={() => setResolviendo(item)}
          />
        )}
      />

      {/* Modal de resolución */}
      <ResolucionModal
        reporte={resolviendo}
        onClose={() => setResolviendo(null)}
        onSuccess={() => {
          setResolviendo(null);
          fetchReportes();
        }}
      />
    </View>
  );
}

// ─── Tarjeta de reporte ────────────────────────────────────────────────────────

function ReporteCard({
  reporte,
  canEdit,
  isTomarEnManoLoading,
  onTomarEnMano,
  onResolver,
}: {
  reporte: Reporte;
  canEdit: boolean;
  isTomarEnManoLoading: boolean;
  onTomarEnMano: () => void;
  onResolver: () => void;
}) {
  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <Text style={styles.cardTipo} numberOfLines={1}>
          {TIPO_PROBLEMA_LABELS[reporte.tipoProblema] ?? reporte.tipoProblema}
        </Text>
        <View style={[styles.badge, { backgroundColor: ESTADO_COLORS[reporte.estado] ?? '#6b7280' }]}>
          <Text style={styles.badgeText}>{ESTADO_LABELS[reporte.estado] ?? reporte.estado}</Text>
        </View>
      </View>

      {/* Foto del incidente (si existe) */}
      {reporte.fotoUrl ? (
        <Image source={{ uri: reporte.fotoUrl }} style={styles.cardFoto} resizeMode="cover" />
      ) : null}

      {/* Comentario */}
      {reporte.comentario ? (
        <Text style={styles.cardComment} numberOfLines={3}>{reporte.comentario}</Text>
      ) : null}

      {/* Coordenadas */}
      <Text style={styles.cardCoords}>
        📍 {reporte.latitud.toFixed(5)}, {reporte.longitud.toFixed(5)}
      </Text>

      {/* Fecha */}
      <Text style={styles.cardDate}>
        {new Date(reporte.fechaCreacion).toLocaleDateString('es-AR', {
          day: '2-digit', month: 'short', year: 'numeric',
        })}
      </Text>

      {/* Acciones — solo RESPONSABLE puede intervenir; SUPERVISOR es solo lectura */}
      {canEdit ? (
        <View style={styles.cardActions}>
          {reporte.estado === EstadoReporte.PENDIENTE && (
            <Pressable
              style={[styles.actionBtnSecondary, isTomarEnManoLoading && styles.btnDisabled]}
              onPress={onTomarEnMano}
              disabled={isTomarEnManoLoading}
            >
              {isTomarEnManoLoading
                ? <ActivityIndicator size="small" color="#1a73e8" />
                : <Text style={styles.actionBtnSecondaryText}>🔵 Tomar en mano</Text>
              }
            </Pressable>
          )}
          <Pressable style={styles.actionBtnPrimary} onPress={onResolver}>
            <Text style={styles.actionBtnPrimaryText}>✅ Resolver</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.readOnlyBadge}>
          <Text style={styles.readOnlyText}>👁 Modo auditoría — sin acciones</Text>
        </View>
      )}
    </View>
  );
}

// ─── Modal de resolución ──────────────────────────────────────────────────────

function ResolucionModal({
  reporte,
  onClose,
  onSuccess,
}: {
  reporte: Reporte | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { foto, hasCameraPermission, takePhoto, pickFromGallery, clearFoto, setFoto } = useCamera();
  const [fotoTemp, setFotoTemp] = useState<FotoSeleccionada | null>(null);
  const [comentario, setComentario] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reset al abrir/cerrar
  useEffect(() => {
    if (!reporte) {
      setComentario('');
      clearFoto();
      setErrorMsg(null);
      setProgress(0);
    }
  }, [reporte, clearFoto]);

  const handleTomarFoto = async () => {
    if (!hasCameraPermission) {
      Alert.alert('Permiso requerido', 'Activá el permiso de cámara en la configuración.');
      return;
    }
    const res = await takePhoto();
    if (res) setFotoTemp(res);
  };

  const handleGaleria = async () => {
    const res = await pickFromGallery();
    if (res) setFotoTemp(res);
  };

  const handleSubmit = async () => {
    if (!reporte) return;
    setErrorMsg(null);
    setIsSubmitting(true);
    setProgress(0);

    try {
      await ReportsService.resolveReport(reporte.id, {
        comentarioResolucion: comentario,
        foto: foto as FotoSeleccionada | undefined,
        onUploadProgress: setProgress,
      });
      onSuccess();
    } catch {
      setErrorMsg('No se pudo guardar la resolución. Verificá tu conexión.');
    } finally {
      setIsSubmitting(false);
      setProgress(0);
    }
  };

  return (
    <Modal
      visible={!!reporte}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalKbWrapper}
        >
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />

            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Registrar Resolución</Text>

              {reporte && (
                <Text style={styles.modalSubtitle}>
                  {TIPO_PROBLEMA_LABELS[reporte.tipoProblema] ?? reporte.tipoProblema}
                </Text>
              )}

              {/* ─── Foto de evidencia ──────────────────────────────── */}
              <Text style={styles.fieldLabel}>Foto de evidencia</Text>
              {foto ? (
                <View style={styles.fotoPreviewWrap}>
                  <Image source={{ uri: foto.uri }} style={styles.fotoPreview} resizeMode="cover" />
                  <Pressable style={styles.fotoRemoveBtn} onPress={clearFoto}>
                    <Text style={styles.fotoRemoveText}>✕ Quitar</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.fotoBtns}>
                  <Pressable style={styles.fotoBtnPrimary} onPress={handleTomarFoto}>
                    <Text style={styles.fotoBtnText}>📷 Cámara</Text>
                  </Pressable>
                  <Pressable style={styles.fotoBtnSecondary} onPress={handleGaleria}>
                    <Text style={styles.fotoBtnSecondaryText}>🖼 Galería</Text>
                  </Pressable>
                </View>
              )}

              {/* ─── Comentario técnico ─────────────────────────────── */}
              <Text style={styles.fieldLabel}>
                Comentario técnico{' '}
                <Text style={styles.fieldLabelOptional}>(opcional)</Text>
              </Text>
              <TextInput
                style={styles.textArea}
                placeholder="Describí la solución implementada…"
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={comentario}
                onChangeText={setComentario}
              />

              {/* ─── Error ─────────────────────────────────────────── */}
              {errorMsg ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{errorMsg}</Text>
                </View>
              ) : null}

              {/* ─── Progreso ──────────────────────────────────────── */}
              {isSubmitting && progress > 0 && progress < 100 ? (
                <View style={styles.progressWrap}>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressBar, { width: `${progress}%` }]} />
                  </View>
                  <Text style={styles.progressText}>Subiendo… {progress}%</Text>
                </View>
              ) : null}

              {/* ─── Botones ───────────────────────────────────────── */}
              <View style={styles.modalActions}>
                <Pressable style={styles.cancelBtn} onPress={onClose} disabled={isSubmitting}>
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[styles.submitBtn, isSubmitting && styles.btnDisabled]}
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.submitBtnText}>Marcar Solucionado</Text>
                  }
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>

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
    </Modal>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0f4ff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f4ff', padding: 32 },
  loadingText: { marginTop: 12, color: '#6b7280', fontSize: 17 },
  list: { padding: 16, paddingBottom: 32 },

  listHeader: { fontSize: 16, color: '#6b7280', fontWeight: '500', marginBottom: 12 },

  // Acceso denegado
  lockIcon: { fontSize: 52, marginBottom: 14 },
  lockTitle: { fontSize: 22, fontWeight: '700', color: '#374151', marginBottom: 8 },
  lockSubtitle: { fontSize: 17, color: '#6b7280', textAlign: 'center', lineHeight: 22 },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardTipo: { fontSize: 18, fontWeight: '700', color: '#111827', flex: 1, marginRight: 8 },
  badge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  cardFoto: { width: '100%', height: 140, borderRadius: 10, marginBottom: 10 },
  cardComment: { fontSize: 16, color: '#374151', marginBottom: 8, lineHeight: 20 },
  cardCoords: { fontSize: 14, color: '#6b7280', fontFamily: 'monospace', marginBottom: 4 },
  cardDate: { fontSize: 13, color: '#9ca3af', marginBottom: 12 },

  cardActions: { flexDirection: 'row', gap: 10 },
  readOnlyBadge: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  readOnlyText: { fontSize: 14, color: '#6b7280', fontWeight: '500' },
  actionBtnSecondary: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#1a73e8',
    alignItems: 'center', justifyContent: 'center',
  },
  actionBtnSecondaryText: { color: '#1a73e8', fontSize: 16, fontWeight: '600' },
  actionBtnPrimary: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center',
  },
  actionBtnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },

  // Empty
  emptyContainer: { flex: 1 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 22, fontWeight: '600', color: '#374151' },
  emptySubtitle: { fontSize: 17, color: '#6b7280', marginTop: 4 },

  // Modal resolución
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalKbWrapper: { justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    paddingBottom: 36,
    maxHeight: '85%',
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: '#d1d5db',
    borderRadius: 2, alignSelf: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 2 },
  modalSubtitle: { fontSize: 16, color: '#6b7280', marginBottom: 16 },

  fieldLabel: { fontSize: 14, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 },
  fieldLabelOptional: { fontWeight: '400', textTransform: 'none' },

  // Foto evidencia
  fotoBtns: { flexDirection: 'row', gap: 10 },
  fotoBtnPrimary: {
    flex: 1, backgroundColor: '#1a73e8', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  fotoBtnText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  fotoBtnSecondary: {
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#d1d5db', backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  fotoBtnSecondaryText: { color: '#374151', fontSize: 16 },
  fotoPreviewWrap: { position: 'relative' },
  fotoPreview: { width: '100%', height: 160, borderRadius: 12 },
  fotoRemoveBtn: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 14,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  fotoRemoveText: { color: '#fff', fontSize: 14 },

  // TextArea
  textArea: {
    backgroundColor: '#f9fafb', borderRadius: 10, borderWidth: 1,
    borderColor: '#d1d5db', padding: 12, fontSize: 17,
    color: '#111827', minHeight: 90,
  },

  // Error / Progress
  errorBox: { backgroundColor: '#fee2e2', borderRadius: 8, padding: 10, marginTop: 10 },
  errorText: { color: '#dc2626', fontSize: 16 },
  progressWrap: { marginTop: 10, gap: 4 },
  progressTrack: { height: 5, backgroundColor: '#e5e7eb', borderRadius: 3, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: '#16a34a' },
  progressText: { fontSize: 13, color: '#6b7280', textAlign: 'right' },

  // Acciones modal
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#d1d5db', alignItems: 'center',
  },
  cancelBtnText: { color: '#374151', fontSize: 18, fontWeight: '600' },
  submitBtn: {
    flex: 2, paddingVertical: 13, borderRadius: 12,
    backgroundColor: '#16a34a', alignItems: 'center',
  },
  submitBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
