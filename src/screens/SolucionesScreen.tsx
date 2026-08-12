/**
 * Pantalla de Gestión de Soluciones — solo para RESPONSABLE y SUPERVISOR.
 *
 * El responsable NO reporta. Su función exclusiva es gestionar reportes:
 *  - Filtrar por estado y texto libre
 *  - Tomar en mano (PENDIENTE → EN_PROCESO)
 *  - Resolver con foto de evidencia (→ SOLUCIONADO)
 *
 * Navegación inferior prominente: Mapa y Estadísticas como accesos directos.
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
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
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
  ChartBar,
  Check,
  ChevronRight,
  Clock,
  Lock,
  Map,
  Search,
  Wrench,
} from 'lucide-react-native';
import { THEME } from '../constants/theme';

// ─── Tipos de filtro ────────────────────────────────────────────────────────────

type FiltroEstado = 'TODOS' | 'PENDIENTE' | 'EN_PROCESO' | 'SOLUCIONADO';

const FILTRO_LABELS: Record<FiltroEstado, string> = {
  TODOS: 'Todos',
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso',
  SOLUCIONADO: 'Solucionado',
};

const ESTADO_COLORS: Record<string, string> = {
  PENDIENTE: '#FADBD8',
  EN_PROCESO: THEME.colors.warning,
  SOLUCIONADO: THEME.colors.success,
};

const ESTADO_LABELS: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso',
  SOLUCIONADO: 'Solucionado',
};

// ─── Componente principal ──────────────────────────────────────────────────────

export default function SolucionesScreen() {
  const { user } = useAuth();

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

  const canEdit = user?.rol === Rol.RESPONSABLE;
  return (
    <View style={styles.root}>
      <GestionList canEdit={canEdit} />
    </View>
  );
}

// ─── Lista con filtros ─────────────────────────────────────────────────────────

function GestionList({ canEdit }: { canEdit: boolean }) {
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tomarEnManoId, setTomarEnManoId] = useState<string | null>(null);
  const [resolviendo, setResolviendo] = useState<Reporte | null>(null);

  // ── Filtros ─────────────────────────────────────────────────────────────────
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('TODOS');

  const fetchReportes = useCallback(async () => {
    try {
      const data = await ReportsService.getAll();
      setReportes(data);
    } catch {
      Alert.alert('Error', 'No se pudieron cargar los reportes.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchReportes();
  }, [fetchReportes]);

  const reportesFiltrados = useMemo(() => {
    return reportes.filter((r) => {
      const matchEstado =
        filtroEstado === 'TODOS' || r.estado === filtroEstado;
      const query = busqueda.trim().toLowerCase();
      const matchBusqueda =
        !query ||
        TIPO_PROBLEMA_LABELS[r.tipoProblema]?.toLowerCase().includes(query) ||
        r.comentario?.toLowerCase().includes(query) ||
        r.estado.toLowerCase().includes(query);
      return matchEstado && matchBusqueda;
    });
  }, [reportes, filtroEstado, busqueda]);

  const resumen = useMemo(() => {
    const pendientes = reportes.filter((r) => r.estado === EstadoReporte.PENDIENTE).length;
    const enProceso = reportes.filter((r) => r.estado === EstadoReporte.EN_PROCESO).length;
    const total = reportes.length;
    if (total === 0) return 'Sin reportes activos';
    const parts: string[] = [];
    if (pendientes > 0) parts.push(`${pendientes} pendiente${pendientes !== 1 ? 's' : ''}`);
    if (enProceso > 0) parts.push(`${enProceso} en proceso`);
    return `${total} reporte${total !== 1 ? 's' : ''} — ${parts.join(' · ')}`;
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
      {/* ── Resumen rápido ──────────────────────────────────────── */}
      <View style={styles.resumenBar}>
        <Wrench size={16} color={THEME.colors.primary} />
        <Text style={styles.resumenText}>{resumen}</Text>
      </View>

      {/* ── Barra de búsqueda ───────────────────────────────────── */}
      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <Search size={16} color={THEME.colors.textLight} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por tipo, comentario…"
            placeholderTextColor={THEME.colors.textLight}
            value={busqueda}
            onChangeText={setBusqueda}
            returnKeyType="search"
          />
        </View>
      </View>

      {/* ── Filtros de estado ───────────────────────────────────── */}
      <View style={styles.filtrosRow}>
        {(Object.keys(FILTRO_LABELS) as FiltroEstado[]).map((f) => (
          <Pressable
            key={f}
            style={[styles.filtroChip, filtroEstado === f && styles.filtroChipActive]}
            onPress={() => setFiltroEstado(f)}
          >
            <Text
              style={[styles.filtroChipText, filtroEstado === f && styles.filtroChipTextActive]}
            >
              {FILTRO_LABELS[f]}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── Lista de reportes ───────────────────────────────────── */}
      <FlatList
        style={styles.list}
        data={reportesFiltrados}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          reportesFiltrados.length === 0 ? styles.emptyContainer : styles.listContent
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchReportes();
            }}
            colors={[THEME.colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyTitle}>
              {busqueda || filtroEstado !== 'TODOS' ? 'Sin resultados' : 'Todo al día'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {busqueda || filtroEstado !== 'TODOS'
                ? 'Probá con otros filtros.'
                : 'No hay reportes pendientes.'}
            </Text>
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

      {/* ── Navegación inferior prominente ─────────────────────── */}
      <View style={styles.navBar}>
        <Pressable style={styles.navBtn} onPress={() => router.push('/(tabs)/mapa')}>
          <Map size={28} color={THEME.colors.white} />
          <Text style={styles.navBtnText}>Mapa</Text>
        </Pressable>

        <View style={styles.navBtnActive}>
          <Wrench size={28} color={THEME.colors.white} />
          <Text style={styles.navBtnText}>Soluciones</Text>
        </View>

        <Pressable style={styles.navBtn} onPress={() => router.push('/(tabs)/estadisticas')}>
          <ChartBar size={28} color={THEME.colors.white} />
          <Text style={styles.navBtnText}>Estadísticas</Text>
        </Pressable>
      </View>

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
      activeOpacity={0.75}
    >
      <View style={styles.cardRow}>
        <View style={[styles.checkCircle, { borderColor: statusColor }]}>
          {reporte.estado === EstadoReporte.EN_PROCESO ? (
            <Clock size={18} color={THEME.colors.warning} />
          ) : (
            <Check size={18} color={statusColor} />
          )}
        </View>

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
              day: '2-digit',
              month: 'short',
            })}{' '}
            · {reporte.comentario || 'Sin descripción'}
          </Text>
        </View>

        <ChevronRight size={20} color={THEME.colors.borderBlue} />
      </View>

      {/* Acción rápida: tomar en mano (solo PENDIENTE + canEdit) */}
      {canEdit && reporte.estado === EstadoReporte.PENDIENTE && (
        <Pressable
          style={styles.tomarBtn}
          onPress={(e) => {
            e.stopPropagation?.();
            onTomarEnMano();
          }}
          disabled={isTomarEnManoLoading}
        >
          {isTomarEnManoLoading ? (
            <ActivityIndicator size="small" color={THEME.colors.white} />
          ) : (
            <Text style={styles.tomarBtnText}>⚡ Tomar en mano</Text>
          )}
        </Pressable>
      )}
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
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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

              <Text style={styles.fieldLabel}>Foto de evidencia</Text>
              {foto ? (
                <View style={styles.fotoPreviewWrap}>
                  <Image
                    source={{ uri: foto.uri }}
                    style={styles.fotoPreview}
                    resizeMode="cover"
                  />
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

              {errorMsg ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{errorMsg}</Text>
                </View>
              ) : null}

              {isSubmitting && progress > 0 && progress < 100 ? (
                <View style={styles.progressWrap}>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressBar, { width: `${progress}%` }]} />
                  </View>
                  <Text style={styles.progressText}>Subiendo… {progress}%</Text>
                </View>
              ) : null}

              <View style={styles.modalActions}>
                <Pressable style={styles.cancelBtn} onPress={onClose} disabled={isSubmitting}>
                  <Text style={styles.cancelBtnText}>Cerrar</Text>
                </Pressable>
                <Pressable
                  style={[styles.submitBtn, isSubmitting && styles.btnDisabled]}
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.submitBtnText}>Marcar Solucionado</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>

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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.colors.background,
    padding: 32,
  },
  loadingText: { marginTop: 12, color: THEME.colors.textLight, fontSize: 17, fontWeight: '600' },

  // Resumen
  resumenBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  resumenText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textLight,
  },

  // Búsqueda
  searchRow: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: THEME.colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.colors.borderBlue,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    ...THEME.shadows.soft,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: THEME.colors.text,
  },

  // Filtros de estado
  filtrosRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  filtroChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: THEME.colors.cardYellow,
    borderWidth: 1,
    borderColor: THEME.colors.borderBlue,
  },
  filtroChipActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  filtroChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  filtroChipTextActive: {
    color: THEME.colors.white,
  },

  // Lista
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 12 },
  emptyContainer: { flex: 1 },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyIcon: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: THEME.colors.primary },
  emptySubtitle: { fontSize: 15, color: THEME.colors.textLight, marginTop: 6, textAlign: 'center' },

  // Card
  card: {
    backgroundColor: THEME.colors.white,
    borderRadius: THEME.sizes.radius,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: THEME.colors.borderBlue,
    ...THEME.shadows.soft,
    gap: 10,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.white,
  },
  cardMainContent: { flex: 1, gap: 3 },
  titleBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTipo: { fontSize: 17, fontWeight: '800', color: THEME.colors.primary, flexShrink: 1 },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: {
    color: THEME.colors.primary,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  cardDate: { fontSize: 13, color: THEME.colors.textLight, fontWeight: '600' },
  tomarBtn: {
    backgroundColor: THEME.colors.accent,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tomarBtnText: { color: THEME.colors.white, fontSize: 14, fontWeight: '800' },

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

  // ── Barra de navegación inferior prominente ──────────────────
  navBar: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    gap: 10,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    ...THEME.shadows.medium,
  },
  navBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  navBtnActive: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: THEME.colors.accent,
    gap: 8,
    ...THEME.shadows.soft,
  },
  navBtnText: {
    color: THEME.colors.white,
    fontSize: 14,
    fontWeight: '800',
  },

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
    width: 50,
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 24, fontWeight: '800', color: THEME.colors.primary, marginBottom: 4 },
  modalSubtitle: {
    fontSize: 18,
    color: THEME.colors.textLight,
    marginBottom: 24,
    fontWeight: '600',
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 20,
    marginBottom: 10,
  },
  fieldLabelOptional: {
    fontWeight: '400',
    textTransform: 'none',
    color: THEME.colors.textLight,
  },
  fotoBtns: { flexDirection: 'row', gap: 12 },
  fotoBtnPrimary: {
    flex: 1,
    backgroundColor: THEME.colors.accent,
    borderRadius: THEME.sizes.radius,
    paddingVertical: 16,
    alignItems: 'center',
    ...THEME.shadows.soft,
  },
  fotoBtnText: { color: THEME.colors.white, fontSize: 17, fontWeight: '800' },
  fotoBtnSecondary: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: THEME.sizes.radius,
    borderWidth: 2,
    borderColor: THEME.colors.borderBlue,
    backgroundColor: THEME.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fotoBtnSecondaryText: { color: THEME.colors.primary, fontSize: 16, fontWeight: '700' },
  fotoPreviewWrap: { position: 'relative' },
  fotoPreview: {
    width: '100%',
    height: 200,
    borderRadius: THEME.sizes.radius,
    borderWidth: 1,
    borderColor: THEME.colors.borderBlue,
  },
  fotoRemoveBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  fotoRemoveText: { color: THEME.colors.white, fontSize: 14, fontWeight: '700' },
  textArea: {
    backgroundColor: THEME.colors.cardYellow,
    borderRadius: THEME.sizes.radius,
    borderWidth: 1,
    borderColor: THEME.colors.borderBlue,
    padding: 16,
    fontSize: 17,
    color: THEME.colors.text,
    minHeight: 100,
    ...THEME.shadows.soft,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: THEME.sizes.radius,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: { color: THEME.colors.danger, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  progressWrap: { marginTop: 16, gap: 6 },
  progressTrack: { height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: THEME.colors.success },
  progressText: { fontSize: 14, color: THEME.colors.textLight, textAlign: 'right', fontWeight: '700' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 32 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: THEME.sizes.radius,
    borderWidth: 2,
    borderColor: THEME.colors.borderBlue,
    alignItems: 'center',
  },
  cancelBtnText: { color: THEME.colors.primary, fontSize: 18, fontWeight: '700' },
  submitBtn: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: THEME.sizes.radius,
    backgroundColor: THEME.colors.success,
    alignItems: 'center',
    ...THEME.shadows.medium,
  },
  btnDisabled: { opacity: 0.6 },
  submitBtnText: { color: THEME.colors.white, fontSize: 18, fontWeight: '800' },
});
