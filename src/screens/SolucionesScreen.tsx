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
  TouchableOpacity
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

import {
  AlertCircle,
  Clock,
  CheckCircle2,
  Lock,
  RefreshCcw,
  MapPin,
  Calendar,
  ChevronRight,
  Eye,
  Check,
  Plus
} from 'lucide-react-native';
import { THEME } from '../constants/theme';

// ─── Constantes ────────────────────────────────────────────────────────────────

const ESTADO_COLORS: Record<string, string> = {
  PENDIENTE: '#FADBD8', // Rojo suave
  EN_PROCESO: THEME.colors.warning, // Naranja/Amarillo
  SOLUCIONADO: THEME.colors.success, // Verde
};

const ESTADO_LABELS: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso',
  SOLUCIONADO: 'Solucionado',
};

// ─── Componente principal ──────────────────────────────────────────────────────

export default function SolucionesScreen() {
  const { user } = useAuth();

  // ── Acceso denegado para REPORTANTE ──────────────────────────────────────────
  if (user && user.rol === Rol.REPORTANTE) {
    return (
      <View style={styles.center}>
        <View style={styles.lockCircle}>
          <Lock size={48} color={THEME.colors.primary} />
        </View>
        <Text style={styles.lockTitle}>Acceso restringido</Text>
        <Text style={styles.lockSubtitle}>
          Esta sección está disponible solo para Responsables y Supervisores.
        </Text>
      </View>
    );
  }

  // SUPERVISOR puede ver pero NO intervenir
  const canEdit = user?.rol === Rol.RESPONSABLE;
  return (
    <View style={styles.root}>
      <SolucionesList canEdit={canEdit} />
    </View>
  );
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
        <ActivityIndicator size="large" color={THEME.colors.primary} />
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
            colors={[THEME.colors.primary]}
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
  const statusColor = ESTADO_COLORS[reporte.estado] || THEME.colors.textLight;
  
  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={canEdit ? onResolver : undefined}
      activeOpacity={0.7}
    >
      <View style={styles.cardRow}>
        {/* Icono Check Circular a la izquierda */}
        <View style={[styles.checkCircle, { borderColor: statusColor }]}>
          {reporte.estado === EstadoReporte.EN_PROCESO ? (
            <Clock size={18} color={statusColor} />
          ) : (
            <Check size={18} color={statusColor} />
          )}
        </View>

        {/* Contenido Central: Título y Badge */}
        <View style={styles.cardMainContent}>
          <View style={styles.titleBadgeRow}>
            <Text style={styles.cardTipo} numberOfLines={1}>
              {TIPO_PROBLEMA_LABELS[reporte.tipoProblema] ?? reporte.tipoProblema}
            </Text>
            <View style={[styles.badge, { backgroundColor: statusColor }]}>
              <Text style={styles.badgeText}>
                {ESTADO_LABELS[reporte.estado] ?? reporte.estado}
              </Text>
            </View>
          </View>
          
          <Text style={styles.cardDate}>
            {new Date(reporte.fechaCreacion).toLocaleDateString('es-AR', {
              day: '2-digit', month: 'short'
            })} • {reporte.comentario || 'Sin descripción'}
          </Text>
        </View>

        <ChevronRight size={20} color={THEME.colors.borderBlue} />
      </View>
    </TouchableOpacity>
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
                  <Text style={styles.cancelBtnText}>Cerrar</Text>
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
  root: { flex: 1, backgroundColor: THEME.colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: THEME.colors.background, padding: 32 },
  loadingText: { marginTop: 12, color: THEME.colors.textLight, fontSize: 17, fontWeight: '600' },
  list: { padding: 16, paddingBottom: 32 },

  listHeader: { fontSize: 16, color: THEME.colors.textLight, fontWeight: '700', marginBottom: 16, textAlign: 'center' },

  // Acceso denegado
  lockCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: THEME.colors.cardYellow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: THEME.colors.borderBlue,
  },
  lockTitle: { fontSize: 24, fontWeight: '800', color: THEME.colors.primary, marginBottom: 12 },
  lockSubtitle: { fontSize: 17, color: THEME.colors.textLight, textAlign: 'center', lineHeight: 24 },

  // Card
  card: {
    backgroundColor: THEME.colors.white,
    borderRadius: THEME.sizes.radius,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.colors.borderBlue,
    ...THEME.shadows.soft,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  checkCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.white,
  },
  cardMainContent: {
    flex: 1,
    gap: 4,
  },
  titleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTipo: { 
    fontSize: 18, 
    fontWeight: '800', 
    color: THEME.colors.primary, 
    flexShrink: 1 
  },
  badge: { 
    borderRadius: 20, 
    paddingHorizontal: 10, 
    paddingVertical: 4,
  },
  badgeText: { 
    color: THEME.colors.primary, 
    fontSize: 11, 
    fontWeight: '800', 
    textTransform: 'uppercase' 
  },
  cardDate: { 
    fontSize: 14, 
    color: THEME.colors.textLight, 
    fontWeight: '600' 
  },

  // Empty
  emptyContainer: { flex: 1 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 24, fontWeight: '800', color: THEME.colors.primary },
  emptySubtitle: { fontSize: 17, color: THEME.colors.textLight, marginTop: 8, textAlign: 'center' },

  // Modal resolución
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalKbWrapper: { justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: THEME.colors.white,
    borderTopLeftRadius: THEME.sizes.radius,
    borderTopRightRadius: THEME.sizes.radius,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  modalHandle: {
    width: 50, height: 6, backgroundColor: '#E5E7EB',
    borderRadius: 3, alignSelf: 'center', marginBottom: 20,
  },
  modalTitle: { fontSize: 24, fontWeight: '800', color: THEME.colors.primary, marginBottom: 4 },
  modalSubtitle: { fontSize: 18, color: THEME.colors.textLight, marginBottom: 24, fontWeight: '600' },

  fieldLabel: { fontSize: 14, fontWeight: '800', color: THEME.colors.primary, textTransform: 'uppercase', letterSpacing: 1, marginTop: 20, marginBottom: 10 },
  fieldLabelOptional: { fontWeight: '400', textTransform: 'none', color: THEME.colors.textLight },

  // Foto evidencia
  fotoBtns: { flexDirection: 'row', gap: 12 },
  fotoBtnPrimary: {
    flex: 1, backgroundColor: THEME.colors.accent, borderRadius: THEME.sizes.radius,
    paddingVertical: 16, alignItems: 'center', ...THEME.shadows.soft,
  },
  fotoBtnText: { color: THEME.colors.white, fontSize: 17, fontWeight: '800' },
  fotoBtnSecondary: {
    paddingHorizontal: 20, paddingVertical: 16, borderRadius: THEME.sizes.radius,
    borderWidth: 2, borderColor: THEME.colors.borderBlue, backgroundColor: THEME.colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  fotoBtnSecondaryText: { color: THEME.colors.primary, fontSize: 16, fontWeight: '700' },
  fotoPreviewWrap: { position: 'relative' },
  fotoPreview: { width: '100%', height: 200, borderRadius: THEME.sizes.radius, borderWidth: 1, borderColor: THEME.colors.borderBlue },
  fotoRemoveBtn: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  fotoRemoveText: { color: THEME.colors.white, fontSize: 14, fontWeight: '700' },

  // TextArea
  textArea: {
    backgroundColor: THEME.colors.cardYellow, borderRadius: THEME.sizes.radius, borderWidth: 1,
    borderColor: THEME.colors.borderBlue, padding: 16, fontSize: 17,
    color: THEME.colors.text, minHeight: 100, ...THEME.shadows.soft,
  },

  // Error / Progress
  errorBox: { backgroundColor: '#FEE2E2', borderRadius: THEME.sizes.radius, padding: 16, marginTop: 16, borderWidth: 1, borderColor: '#FECACA' },
  errorText: { color: THEME.colors.danger, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  progressWrap: { marginTop: 16, gap: 6 },
  progressTrack: { height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: THEME.colors.success },
  progressText: { fontSize: 14, color: THEME.colors.textLight, textAlign: 'right', fontWeight: '700' },

  // Acciones modal
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 32 },
  cancelBtn: {
    flex: 1, paddingVertical: 16, borderRadius: THEME.sizes.radius,
    borderWidth: 2, borderColor: THEME.colors.borderBlue, alignItems: 'center',
  },
  cancelBtnText: { color: THEME.colors.primary, fontSize: 18, fontWeight: '700' },
  submitBtn: {
    flex: 2, paddingVertical: 16, borderRadius: THEME.sizes.radius,
    backgroundColor: THEME.colors.success, alignItems: 'center', ...THEME.shadows.medium,
  },
  submitBtnText: { color: THEME.colors.white, fontSize: 18, fontWeight: '800' },
});
