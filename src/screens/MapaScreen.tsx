/**
 * Pantalla de Mapa Interactivo
 *
 * Muestra TODOS los reportes de la base de datos sobre un mapa para que
 * cualquier rol (incluido REPORTANTE) pueda ver dónde ya se reportó un
 * problema y así evitar duplicados.
 *
 * Reglas de colores:
 *   🔴 Rojo    → PENDIENTE
 *   🟡 Amarillo → EN_PROCESO
 *   🟢 Verde   → SOLUCIONADO
 *
 * Al tocar un marcador se abre un panel con foto, tipo de problema y comentario.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useAuth } from '../hooks/useAuth';
import { ReportsService } from '../services/reports.service';
import {
  EstadoReporte,
  Rol,
  TIPO_PROBLEMA_LABELS,
  type Reporte,
} from '../types';

// ─── Constantes ────────────────────────────────────────────────────────────────

const MARKER_COLORS: Record<string, string> = {
  PENDIENTE: '#ef4444',
  EN_PROCESO: '#f59e0b',
  SOLUCIONADO: '#16a34a',
};

const ESTADO_LABELS: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso',
  SOLUCIONADO: 'Solucionado',
};

const FALLBACK_COLOR = '#9ca3af';

const INITIAL_REGION = {
  latitude: -31.4,
  longitude: -64.2,
  latitudeDelta: 8,
  longitudeDelta: 8,
};

/** Normaliza el estado que viene de la API a mayúsculas. */
function normalizeEstado(raw: string): string {
  return (raw ?? '').toUpperCase().trim();
}

/** Fuerza coordenadas a número para evitar strings que llegan de la API. */
function safeCoord(value: unknown): number {
  return typeof value === 'number' ? value : parseFloat(String(value)) || 0;
}

// ─── Componente principal ──────────────────────────────────────────────────────

export default function MapaScreen() {
  const mapRef = useRef<MapView>(null);
  const { user } = useAuth();

  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Reporte | null>(null);

  const fetchReportes = useCallback(async () => {
    try {
      const data = await ReportsService.getAll();
      setReportes(data);
    } catch {
      // Error silencioso — el usuario verá el mapa vacío
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchReportes();
  }, [fetchReportes]);

  // REPORTANTE solo ve PENDIENTE y EN_PROCESO (el backend ya filtra, esto es una segunda capa)
  const visibles = useMemo(
    () =>
      user?.rol === Rol.REPORTANTE
        ? reportes.filter((r) => normalizeEstado(r.estado) !== EstadoReporte.SOLUCIONADO)
        : reportes,
    [reportes, user?.rol],
  );

  // Conteo por estado (normalizado) para la leyenda dinámica
  const estadoCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of visibles) {
      const key = normalizeEstado(r.estado);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [visibles]);

  // Auto-ajuste de cámara para mostrar todos los marcadores
  useEffect(() => {
    if (visibles.length === 0 || !mapRef.current) return;

    const coords = visibles
      .map((r) => ({
        latitude: safeCoord(r.latitud),
        longitude: safeCoord(r.longitud),
      }))
      .filter((c) => c.latitude !== 0 && c.longitude !== 0);

    if (coords.length === 0) return;

    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 60, bottom: 80, left: 40, right: 40 },
      animated: true,
    });
  }, [visibles]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchReportes();
  };

  // ─── Splash de carga ─────────────────────────────────────────────────────────
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
      {/* ─── Mapa ─────────────────────────────────────────────────────── */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={INITIAL_REGION}
        scrollEnabled
        zoomEnabled
        rotateEnabled
        pitchEnabled
        showsUserLocation
        showsMyLocationButton
      >
        {visibles.map((reporte) => {
          const estado = normalizeEstado(reporte.estado);
          return (
            <Marker
              key={reporte.id}
              coordinate={{
                latitude: safeCoord(reporte.latitud),
                longitude: safeCoord(reporte.longitud),
              }}
              pinColor={MARKER_COLORS[estado] ?? FALLBACK_COLOR}
              onPress={() => setSelected(reporte)}
            />
          );
        })}
      </MapView>

      {/* ─── Botón de refresco flotante ───────────────────────────────── */}
      <Pressable
        style={styles.refreshBtn}
        onPress={handleRefresh}
        disabled={refreshing}
      >
        {refreshing ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.refreshBtnText}>↻</Text>
        )}
      </Pressable>

      {/* ─── Leyenda dinámica (muestra cada color si hay reportes) ──── */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Referencias</Text>
        {(estadoCounts.PENDIENTE ?? 0) > 0 && (
          <LegendDot color="#ef4444" label={`Pendiente (${estadoCounts.PENDIENTE})`} />
        )}
        {(estadoCounts.EN_PROCESO ?? 0) > 0 && (
          <LegendDot color="#f59e0b" label={`En proceso (${estadoCounts.EN_PROCESO})`} />
        )}
        {(estadoCounts.SOLUCIONADO ?? 0) > 0 && (
          <LegendDot color="#16a34a" label={`Solucionado (${estadoCounts.SOLUCIONADO})`} />
        )}
      </View>

      {/* ─── Contador ─────────────────────────────────────────────────── */}
      <View style={styles.counter}>
        <Text style={styles.counterText}>{visibles.length} reporte{visibles.length !== 1 ? 's' : ''}</Text>
      </View>

      {/* ─── Modal de detalle ─────────────────────────────────────────── */}
      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelected(null)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            {selected && (
              <DetailPanel reporte={selected} onClose={() => setSelected(null)} />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Panel de detalle ──────────────────────────────────────────────────────────

function DetailPanel({ reporte, onClose }: { reporte: Reporte; onClose: () => void }) {
  const estado = normalizeEstado(reporte.estado);
  const lat = safeCoord(reporte.latitud);
  const lng = safeCoord(reporte.longitud);

  return (
    <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
      {/* Handle */}
      <View style={styles.handle} />

      {/* Header */}
      <View style={styles.detailHeader}>
        <View style={styles.detailHeaderText}>
          <Text style={styles.detailTipo}>
            {TIPO_PROBLEMA_LABELS[reporte.tipoProblema] ?? reporte.tipoProblema}
          </Text>
          <View style={[styles.estadoBadge, { backgroundColor: MARKER_COLORS[estado] ?? FALLBACK_COLOR }]}>
            <Text style={styles.estadoBadgeText}>{ESTADO_LABELS[estado] ?? estado}</Text>
          </View>
        </View>
        <Pressable style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>
      </View>

      {/* Foto del incidente */}
      {reporte.fotoUrl ? (
        <Image source={{ uri: reporte.fotoUrl }} style={styles.detailFoto} resizeMode="cover" />
      ) : (
        <View style={styles.noFoto}>
          <Text style={styles.noFotoText}>📷 Sin foto adjunta</Text>
        </View>
      )}

      {/* Comentario del reportante */}
      {reporte.comentario ? (
        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>Descripción</Text>
          <Text style={styles.infoValue}>{reporte.comentario}</Text>
        </View>
      ) : null}

      {/* Coordenadas */}
      <View style={styles.infoBlock}>
        <Text style={styles.infoLabel}>Coordenadas</Text>
        <Text style={[styles.infoValue, styles.coords]}>
          {lat.toFixed(6)}, {lng.toFixed(6)}
        </Text>
      </View>

      {/* Fecha */}
      <View style={styles.infoBlock}>
        <Text style={styles.infoLabel}>Fecha</Text>
        <Text style={styles.infoValue}>
          {new Date(reporte.fechaCreacion).toLocaleDateString('es-AR', {
            day: '2-digit', month: 'long', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
        </Text>
      </View>

      {/* Resolución (si existe) */}
      {(reporte.comentarioResolucion || reporte.fotoEvidenciaUrl) ? (
        <View style={styles.resolucionBlock}>
          <Text style={styles.resolucionTitle}>✅ Resolución</Text>
          {reporte.fotoEvidenciaUrl ? (
            <Image
              source={{ uri: reporte.fotoEvidenciaUrl }}
              style={styles.detailFotoEvidencia}
              resizeMode="cover"
            />
          ) : null}
          {reporte.comentarioResolucion ? (
            <Text style={styles.resolucionComment}>{reporte.comentarioResolucion}</Text>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

// ─── Sub-componente leyenda ────────────────────────────────────────────────────

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  map: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f4ff' },
  loadingText: { marginTop: 12, color: '#6b7280', fontSize: 14 },

  // Leyenda
  legend: {
    position: 'absolute',
    bottom: 24,
    left: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    padding: 10,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
  },
  legendTitle: { fontSize: 11, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 12, color: '#374151' },

  // Botón de refresco
  refreshBtn: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(26,115,232,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  refreshBtnText: { fontSize: 20, color: '#fff', fontWeight: '700' },

  // Contador
  counter: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(26,115,232,0.9)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  counterText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 36,
    maxHeight: '75%',
  },
  handle: {
    width: 40, height: 4, backgroundColor: '#d1d5db',
    borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 14,
  },

  // Header
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  detailHeaderText: { flex: 1, gap: 6 },
  detailTipo: { fontSize: 17, fontWeight: '700', color: '#111827' },
  estadoBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  estadoBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 18, color: '#6b7280' },

  // Foto
  detailFoto: { width: '100%', height: 180, borderRadius: 12, marginBottom: 14 },
  detailFotoEvidencia: { width: '100%', height: 150, borderRadius: 10, marginBottom: 8 },
  noFoto: {
    height: 80, borderRadius: 12, backgroundColor: '#f3f4f6',
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },
  noFotoText: { color: '#9ca3af', fontSize: 14 },

  // Info
  infoBlock: { marginBottom: 12 },
  infoLabel: { fontSize: 11, fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  infoValue: { fontSize: 14, color: '#374151', lineHeight: 20 },
  coords: { fontFamily: 'monospace', fontSize: 13 },

  // Resolución
  resolucionBlock: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  resolucionTitle: { fontSize: 14, fontWeight: '700', color: '#15803d', marginBottom: 8 },
  resolucionComment: { fontSize: 13, color: '#374151', lineHeight: 20 },
});
