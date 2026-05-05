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
  TouchableOpacity,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useAuth } from '../hooks/useAuth';
import { useLocation } from '../hooks/useLocation';
import { ReportsService } from '../services/reports.service';
import {
  EstadoReporte,
  Rol,
  TIPO_PROBLEMA_LABELS,
  type Reporte,
} from '../types';

import * as Location from 'expo-location';
import {
  MapPin,
  Clock,
  AlertTriangle,
  X,
  CheckCircle2,
  Calendar,
  Info,
  Navigation,
  RefreshCcw
} from 'lucide-react-native';
import { THEME } from '../constants/theme';

// ─── Constantes y Utilidades ──────────────────────────────────────────────────

const MARKER_COLORS: Record<string, string> = {
  PENDIENTE: '#FF3B30', // Rojo vibrante
  EN_PROCESO: '#FFCC00', // Amarillo vibrante
  SOLUCIONADO: '#34C759', // Verde vibrante
};

const ESTADO_LABELS: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso',
  SOLUCIONADO: 'Solucionado',
};

const FALLBACK_COLOR = '#9ca3af';

/** Normaliza el estado que viene de la API a mayúsculas. */
const normalizeEstado = (estado: string): string => {
  return estado?.toUpperCase() || 'PENDIENTE';
};

/** Fuerza coordenadas a número para evitar strings que llegan de la API. */
function safeCoord(value: unknown): number {
  return typeof value === 'number' ? value : parseFloat(String(value)) || 0;
}

// ─── Componente principal ──────────────────────────────────────────────────────

export default function MapaScreen() {
  const mapRef = useRef<MapView>(null);
  const { user } = useAuth();
  const { 
    coordenadas, 
    hasPermission, 
    getCurrentLocation, 
    startWatching, 
    stopWatching,
    isLoading: isLocationLoading,
    error: locationError 
  } = useLocation();

  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Reporte | null>(null);
  const [region, setRegion] = useState<{
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null>(null);

  const fetchReportes = useCallback(async () => {
    try {
      const data = await ReportsService.getAll();
      setReportes(data);
    } catch {
      // Error silencioso
    } finally {
      setIsLoadingData(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchReportes();
  }, [fetchReportes]);

  // Lógica de geolocalización forzada y seguimiento real
  useEffect(() => {
    let isMounted = true;

    const initLocation = async () => {
      if (hasPermission) {
        try {
          // Carga forzada: Obtener ubicación inicial con precisión máxima
          const coords = await getCurrentLocation();
          if (isMounted) {
            setRegion({
              latitude: coords.latitud,
              longitude: coords.longitud,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            });
          }
          // Iniciar seguimiento real
          await startWatching();
        } catch (err) {
          console.error("Error inicializando ubicación:", err);
        }
      }
    };

    initLocation();

    return () => {
      isMounted = false;
      stopWatching();
    };
  }, [hasPermission, getCurrentLocation, startWatching, stopWatching]);

  // Actualizar región cuando cambian las coordenadas (seguimiento real)
  useEffect(() => {
    if (coordenadas && !selected) {
      setRegion(prev => ({
        latitude: coordenadas.latitud,
        longitude: coordenadas.longitud,
        latitudeDelta: prev?.latitudeDelta ?? 0.01,
        longitudeDelta: prev?.longitudeDelta ?? 0.01,
      }));
    }
  }, [coordenadas, selected]);

  // REPORTANTE solo ve PENDIENTE y EN_PROCESO
  const visibles = useMemo(
    () =>
      user?.rol === Rol.REPORTANTE
        ? reportes.filter((r) => normalizeEstado(r.estado) !== EstadoReporte.SOLUCIONADO)
        : reportes,
    [reportes, user?.rol],
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchReportes();
  };

  // ─── Splash de carga (Forzado hasta tener ubicación y datos) ───────────────────
  if (isLoadingData || (!region && !locationError)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={THEME.colors.primary} />
        <Text style={styles.loadingText}>
          {!region ? 'Obteniendo ubicación precisa…' : 'Cargando reportes…'}
        </Text>
      </View>
    );
  }

  // Error de ubicación
  if (locationError && !region) {
    return (
      <View style={styles.center}>
        <AlertTriangle size={64} color={THEME.colors.danger} />
        <Text style={styles.errorTitle}>GPS Requerido</Text>
        <Text style={styles.errorSubtitle}>{locationError}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => getCurrentLocation()}>
          <Text style={styles.retryBtnText}>Activar GPS manualmente</Text>
        </TouchableOpacity>
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
        region={region || undefined}
        onRegionChangeComplete={setRegion}
        showsUserLocation
        showsMyLocationButton
        followsUserLocation
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
      <TouchableOpacity
        style={styles.refreshBtn}
        onPress={handleRefresh}
        disabled={refreshing}
      >
        {refreshing ? (
          <ActivityIndicator size="small" color={THEME.colors.white} />
        ) : (
          <RefreshCcw size={24} color={THEME.colors.white} />
        )}
      </TouchableOpacity>

      {/* ─── Botón de centrar ubicación ──────────────────────────────── */}
      <TouchableOpacity
        style={styles.locationBtn}
        onPress={async () => {
          const coords = await getCurrentLocation();
          mapRef.current?.animateToRegion({
            latitude: coords.latitud,
            longitude: coords.longitud,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
        }}
      >
        <Navigation size={24} color={THEME.colors.white} />
      </TouchableOpacity>

      {/* ─── Leyenda dinámica (muestra cada color si hay reportes) ──── */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Referencias</Text>
        <LegendDot color={MARKER_COLORS.PENDIENTE} label="Pendiente" />
        <LegendDot color={MARKER_COLORS.EN_PROCESO} label="En proceso" />
        <LegendDot color={MARKER_COLORS.SOLUCIONADO} label="Solucionado" />
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
  const statusColor = MARKER_COLORS[estado] || FALLBACK_COLOR;

  return (
    <View style={styles.detailContainer}>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
        {/* Handle */}
        <View style={styles.handle} />

        {/* Header con Título y Badge */}
        <View style={styles.detailHeader}>
          <View style={styles.detailHeaderText}>
            <Text style={styles.detailTipo}>
              {TIPO_PROBLEMA_LABELS[reporte.tipoProblema] ?? reporte.tipoProblema}
            </Text>
            <View style={[styles.estadoBadge, { backgroundColor: statusColor }]}>
              <Text style={styles.estadoBadgeText}>{ESTADO_LABELS[estado] ?? estado}</Text>
            </View>
          </View>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <X size={24} color={THEME.colors.textLight} />
          </Pressable>
        </View>

        {/* Imagen Destacada */}
        <View style={styles.fotoWrapper}>
          {reporte.fotoUrl ? (
            <Image source={{ uri: reporte.fotoUrl }} style={styles.detailFoto} resizeMode="cover" />
          ) : (
            <View style={styles.noFoto}>
              <AlertTriangle size={48} color={THEME.colors.textLight} />
              <Text style={styles.noFotoText}>Sin foto adjunta</Text>
            </View>
          )}
        </View>

        {/* Cuerpo de Información (Sección OrganizaDoor) */}
        <View style={styles.infoCard}>
          {/* Fila: Tipo */}
          <View style={styles.infoRow}>
            <AlertTriangle size={20} color={THEME.colors.primary} />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Tipo de problema</Text>
              <Text style={styles.infoValueBold}>
                {TIPO_PROBLEMA_LABELS[reporte.tipoProblema] ?? reporte.tipoProblema}
              </Text>
            </View>
          </View>
          <View style={styles.separator} />

          {/* Fila: Ubicación */}
          <View style={styles.infoRow}>
            <MapPin size={20} color={THEME.colors.primary} />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Ubicación</Text>
              <Text style={styles.infoValueBold}>Registrada mediante GPS</Text>
            </View>
          </View>
          <View style={styles.separator} />

          {/* Fila: Hora/Fecha */}
          <View style={styles.infoRow}>
            <Clock size={20} color={THEME.colors.primary} />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Fecha y Hora</Text>
              <Text style={styles.infoValueBold}>
                {new Date(reporte.fechaCreacion).toLocaleDateString('es-AR', {
                  day: '2-digit', month: 'long', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </Text>
            </View>
          </View>

          {/* Fila: Descripción (si existe) */}
          {reporte.comentario && (
            <>
              <View style={styles.separator} />
              <View style={styles.infoRow}>
                <Info size={20} color={THEME.colors.primary} />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Descripción</Text>
                  <Text style={styles.infoValue}>{reporte.comentario}</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Resolución (si existe) */}
        {(reporte.comentarioResolucion || reporte.fotoEvidenciaUrl) ? (
          <View style={styles.resolucionBlock}>
            <View style={styles.resolucionHeader}>
              <CheckCircle2 size={20} color={THEME.colors.success} />
              <Text style={styles.resolucionTitle}>Resolución</Text>
            </View>
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
    </View>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: THEME.colors.background, padding: 32 },
  loadingText: { marginTop: 16, color: THEME.colors.primary, fontSize: 17, fontWeight: '700', textAlign: 'center' },

  errorTitle: { fontSize: 22, fontWeight: '800', color: THEME.colors.primary, marginTop: 20 },
  errorSubtitle: { fontSize: 16, color: THEME.colors.textLight, textAlign: 'center', marginTop: 8, marginBottom: 24 },
  retryBtn: {
    backgroundColor: THEME.colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: THEME.sizes.radius,
    ...THEME.shadows.soft,
  },
  retryBtnText: { color: THEME.colors.white, fontSize: 16, fontWeight: '800' },

  // Leyenda
  legend: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    backgroundColor: THEME.colors.white,
    borderRadius: 20,
    padding: 15,
    gap: 10,
    ...THEME.shadows.medium,
    zIndex: 10,
    borderWidth: 1,
    borderColor: THEME.colors.borderBlue,
  },
  legendTitle: { fontSize: 12, fontWeight: '800', color: THEME.colors.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  legendDot: { width: 14, height: 14, borderRadius: 7 },
  legendLabel: { fontSize: 14, color: THEME.colors.text, fontWeight: '700' },

  // Botones flotantes
  refreshBtn: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: THEME.colors.accent, // Naranja vibrante
    justifyContent: 'center',
    alignItems: 'center',
    ...THEME.shadows.medium,
    zIndex: 10,
  },
  locationBtn: {
    position: 'absolute',
    top: 110,
    left: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: THEME.colors.accent, // Naranja vibrante
    justifyContent: 'center',
    alignItems: 'center',
    ...THEME.shadows.medium,
    zIndex: 10,
  },

  // Contador
  counter: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: THEME.colors.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    ...THEME.shadows.soft,
    zIndex: 10,
  },
  counterText: { color: THEME.colors.white, fontSize: 14, fontWeight: '800' },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: {
    backgroundColor: THEME.colors.background, // Usar fondo del tema
    borderTopLeftRadius: THEME.sizes.radius,
    borderTopRightRadius: THEME.sizes.radius,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  detailContainer: {
    flex: 1,
  },
  handle: {
    width: 50, height: 6, backgroundColor: '#E5E7EB',
    borderRadius: 3, alignSelf: 'center', marginTop: 12, marginBottom: 20,
  },

  // Header
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  detailHeaderText: { flex: 1, gap: 4 },
  detailTipo: { fontSize: 22, fontWeight: '800', color: THEME.colors.primary },
  estadoBadge: { borderRadius: 15, paddingHorizontal: 12, paddingVertical: 4, alignSelf: 'flex-start' },
  estadoBadgeText: { color: THEME.colors.white, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  closeBtn: { padding: 8, backgroundColor: THEME.colors.white, borderRadius: 20, ...THEME.shadows.soft },

  // Foto Destacada (Estética OrganizaDoor)
  fotoWrapper: {
    ...THEME.shadows.medium,
    marginBottom: 24,
  },
  detailFoto: { 
    width: '100%', 
    height: 220, 
    borderRadius: 25, // Bordes muy redondeados
    borderWidth: 3,
    borderColor: THEME.colors.white,
  },
  noFoto: {
    height: 200, 
    borderRadius: 25, 
    backgroundColor: THEME.colors.cardYellow,
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 2,
    borderColor: THEME.colors.borderBlue,
    borderStyle: 'dashed',
  },
  noFotoText: { color: THEME.colors.textLight, fontSize: 16, fontWeight: '600', marginTop: 8 },

  // Cuerpo de Información (Tarjeta Blanca)
  infoCard: {
    backgroundColor: THEME.colors.white,
    borderRadius: THEME.sizes.radius,
    padding: 20,
    ...THEME.shadows.soft,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 16,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: { 
    fontSize: 12, 
    fontWeight: '600', 
    color: THEME.colors.textLight, 
    textTransform: 'uppercase', 
    letterSpacing: 0.5,
    marginBottom: 2 
  },
  infoValue: { fontSize: 16, color: THEME.colors.text, lineHeight: 22 },
  infoValueBold: { fontSize: 17, color: THEME.colors.primary, fontWeight: '800', lineHeight: 22 },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6', // Línea divisoria tenue
    marginHorizontal: 0,
  },

  // Resolución
  resolucionBlock: {
    backgroundColor: '#F0FDF4',
    borderRadius: THEME.sizes.radius,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    ...THEME.shadows.soft,
  },
  resolucionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  resolucionTitle: { fontSize: 18, fontWeight: '800', color: '#15803D' },
  detailFotoEvidencia: { width: '100%', height: 180, borderRadius: 20, marginBottom: 12, borderWidth: 2, borderColor: THEME.colors.white },
  resolucionComment: { fontSize: 16, color: '#374151', lineHeight: 22, fontWeight: '500' },
});
