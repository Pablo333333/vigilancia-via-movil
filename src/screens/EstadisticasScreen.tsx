/**
 * EstadisticasScreen — Dashboard de estadísticas de reportes.
 *
 * Roles RESPONSABLE / SUPERVISOR: ven métricas completas + gráficos.
 * Rol REPORTANTE: pantalla motivacional sobre la importancia de reportar.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BarChart, PieChart } from 'react-native-chart-kit';
import { useAuth } from '../hooks/useAuth';
import { ReportsService } from '../services/reports.service';
import { EstadoReporte, Reporte, Rol, TIPO_PROBLEMA_LABELS, TipoProblema } from '../types';

// ─── Constantes ────────────────────────────────────────────────────────────────

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 32;

type Filtro = 'todo' | '30d' | '7d';

const FILTROS: { key: Filtro; label: string }[] = [
  { key: '7d', label: '7 días' },
  { key: '30d', label: '30 días' },
  { key: 'todo', label: 'Todo' },
];

const PIE_COLORS = ['#1a73e8', '#ef4444', '#f59e0b', '#16a34a', '#8b5cf6', '#ec4899'];

const CHART_CONFIG = {
  backgroundColor: '#ffffff',
  backgroundGradientFrom: '#ffffff',
  backgroundGradientTo: '#f8faff',
  color: (opacity = 1) => `rgba(26, 115, 232, ${opacity})`,
  labelColor: () => '#6b7280',
  barPercentage: 0.6,
  propsForLabels: { fontSize: 11 },
};

const DAY_ABBR = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// ─── Pantalla motivacional (REPORTANTE) ────────────────────────────────────────

function PantallaMotivadora() {
  return (
    <View style={styles.motivContainer}>
      <Text style={styles.motivEmoji}>🌟</Text>
      <Text style={styles.motivTitle}>¡Tu aporte importa!</Text>
      <Text style={styles.motivText}>
        Cada reporte que enviás ayuda a identificar peligros reales en la vía y
        permite que el equipo de mantenimiento actúe más rápido.
      </Text>
      <View style={styles.motivCard}>
        <Text style={styles.motivCardIcon}>📍</Text>
        <Text style={styles.motivCardText}>Reportá problemas con foto y GPS exacto</Text>
      </View>
      <View style={styles.motivCard}>
        <Text style={styles.motivCardIcon}>🗺️</Text>
        <Text style={styles.motivCardText}>Revisá el mapa para ver el estado en tiempo real</Text>
      </View>
      <View style={styles.motivCard}>
        <Text style={styles.motivCardIcon}>🔧</Text>
        <Text style={styles.motivCardText}>El equipo técnico trabaja en base a tus reportes</Text>
      </View>
      <Text style={styles.motivFooter}>
        Juntos construimos vías más seguras para todos.
      </Text>
    </View>
  );
}

// ─── Pantalla de estadísticas completa ────────────────────────────────────────

export default function EstadisticasScreen() {
  const { user } = useAuth();
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('7d');

  const loadData = useCallback(async (force = false) => {
    if (!force) setIsLoading(true);
    try {
      const data = await ReportsService.getAll(undefined, force);
      setReportes(data);
    } catch {
      // Error silencioso — dejamos los datos existentes
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // REPORTANTE no tiene acceso al dashboard — evitar la llamada a la API
    if (user?.rol !== Rol.REPORTANTE) {
      loadData();
    }
  }, [loadData, user?.rol]);

  // ── Filtro de fecha ──────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    if (filtro === 'todo') return reportes;
    const days = filtro === '7d' ? 7 : 30;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return reportes.filter(r => new Date(r.fechaCreacion).getTime() >= cutoff);
  }, [reportes, filtro]);

  // ── Indicadores rápidos ──────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = filtered.length;
    const pendiente = filtered.filter(r => r.estado === EstadoReporte.PENDIENTE).length;
    const enProceso = filtered.filter(r => r.estado === EstadoReporte.EN_PROCESO).length;
    const solucionado = filtered.filter(r => r.estado === EstadoReporte.SOLUCIONADO).length;

    const solucionados = filtered.filter(
      r => r.estado === EstadoReporte.SOLUCIONADO && r.updatedAt,
    );
    let tiempoPromedio: string | null = null;
    if (solucionados.length > 0) {
      const totalMs = solucionados.reduce((sum, r) => {
        const created = new Date(r.fechaCreacion).getTime();
        const solved = new Date(r.updatedAt).getTime();
        return sum + Math.max(0, solved - created);
      }, 0);
      const avgMs = totalMs / solucionados.length;
      const dias = avgMs / (1000 * 60 * 60 * 24);
      tiempoPromedio = dias < 1 ? `${Math.round(dias * 24)}h` : `${dias.toFixed(1)} días`;
    }

    return { total, pendiente, enProceso, solucionado, tiempoPromedio };
  }, [filtered]);

  // ── Datos para gráfico de torta (por tipo) ──────────────────────────────────

  const pieData = useMemo(() => {
    const counts = Object.values(TipoProblema)
      .map(tipo => ({
        tipo,
        count: filtered.filter(r => r.tipoProblema === tipo).length,
      }))
      .filter(x => x.count > 0)
      .sort((a, b) => b.count - a.count);

    const top = counts.slice(0, 5);
    const otrosCount = counts.slice(5).reduce((s, x) => s + x.count, 0);

    // Preparamos los items para el gráfico (Top 5 + Otros si existe)
    const chartItems = top.map(x => ({
      label: TIPO_PROBLEMA_LABELS[x.tipo],
      count: x.count,
    }));

    if (otrosCount > 0) {
      chartItems.push({
        label: 'Otros',
        count: otrosCount,
      });
    }

    const totalCount = chartItems.reduce((acc, curr) => acc + curr.count, 0);

    // 1. Calcular porcentajes como enteros (redondeo hacia abajo)
    let finalData = chartItems.map(item => ({
      ...item,
      percentage: totalCount > 0 ? Math.floor((item.count / totalCount) * 100) : 0,
    }));

    // 2. Ajustar para que la suma sea exactamente 100
    if (totalCount > 0 && finalData.length > 0) {
      const currentSum = finalData.reduce((acc, curr) => acc + curr.percentage, 0);
      const diff = 100 - currentSum;
      if (diff !== 0) {
        // Buscamos el de mayor valor para aplicar el ajuste
        let maxIdx = 0;
        for (let i = 1; i < finalData.length; i++) {
          if (finalData[i].count > finalData[maxIdx].count) maxIdx = i;
        }
        finalData[maxIdx].percentage += diff;
      }
    }

    // 3. Formatear para el componente PieChart
    return finalData.map((x, i) => {
      // Truncar etiquetas largas
      const short = x.label.length > 18 ? x.label.slice(0, 16) + '…' : x.label;
      return {
        name: `${short}: ${x.count}`, // Leyenda: "Nombre: 5"
        population: x.percentage,      // El dibujo usa el porcentaje corregido
        color: x.label === 'Otros' ? '#9ca3af' : (PIE_COLORS[i] ?? '#9ca3af'),
        legendFontColor: '#374151',
        legendFontSize: 11,
      };
    });
  }, [filtered]);

  // ── Datos para gráfico de barras (últimos 7 días — siempre fijo) ─────────────

  const barData = useMemo(() => {
    const today = new Date();
    const labels: string[] = [];
    const values: number[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      labels.push(DAY_ABBR[d.getDay()]);

      const dayStart = new Date(d).setHours(0, 0, 0, 0);
      const dayEnd = new Date(d).setHours(23, 59, 59, 999);

      const count = reportes.filter(r => {
        const t = new Date(r.fechaCreacion).getTime();
        return t >= dayStart && t <= dayEnd;
      }).length;
      values.push(count);
    }
    return {
      labels,
      datasets: [{ data: values.map(v => Math.max(v, 0)) }],
    };
  }, [reportes]);

  // ── Render ───────────────────────────────────────────────────────────────────

  if (user?.rol === Rol.REPORTANTE) {
    return <PantallaMotivadora />;
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1a73e8" />
        <Text style={styles.loadingText}>Cargando estadísticas…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); loadData(/* force */ true); }}
          colors={['#1a73e8']}
        />
      }
    >
      {/* Filtro de rango */}
      <View style={styles.filterRow}>
        {FILTROS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterBtn, filtro === f.key && styles.filterBtnActive]}
            onPress={() => setFiltro(f.key)}
          >
            <Text style={[styles.filterLabel, filtro === f.key && styles.filterLabelActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Cards de indicadores ── */}
      <Text style={styles.sectionTitle}>Indicadores rápidos</Text>

      <View style={styles.cardsRow}>
        <StatCard label="Total" value={String(stats.total)} color="#1a73e8" emoji="📋" />
        <StatCard label="Pendiente" value={String(stats.pendiente)} color="#ef4444" emoji="🔴" />
        <StatCard label="En proceso" value={String(stats.enProceso)} color="#f59e0b" emoji="🟡" />
      </View>

      <View style={styles.cardsRow}>
        <StatCard label="Solucionado" value={String(stats.solucionado)} color="#16a34a" emoji="🟢" />
        <View style={[styles.card, styles.cardWide]}>
          <Text style={styles.cardEmoji}>⏱️</Text>
          <Text style={[styles.cardValue, { color: '#6b7280', fontSize: 18 }]}>
            {stats.tiempoPromedio ?? 'N/D'}
          </Text>
          <Text style={styles.cardLabel}>Tiempo prom. atención</Text>
        </View>
      </View>

      {/* ── Gráfico de torta ── */}
      <Text style={styles.sectionTitle}>Distribución por tipo de problema</Text>

      {pieData.length === 0 ? (
        <EmptyChart message="Sin reportes en el período seleccionado" />
      ) : (
        <View style={styles.chartCard}>
          <PieChart
            data={pieData}
            width={CHART_WIDTH - 16}
            height={200}
            chartConfig={CHART_CONFIG}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="0"
            hasLegend
            avoidFalseZero
          />
        </View>
      )}

      {/* ── Gráfico de barras ── */}
      <Text style={styles.sectionTitle}>Reportes por día (últimos 7 días)</Text>

      <View style={styles.chartCard}>
        {barData.datasets[0].data.every(v => v === 0) ? (
          <EmptyChart message="Sin actividad en los últimos 7 días" />
        ) : (
          <BarChart
            data={barData}
            width={CHART_WIDTH - 16}
            height={200}
            chartConfig={CHART_CONFIG}
            style={{ borderRadius: 8 }}
            showValuesOnTopOfBars
            fromZero
            yAxisLabel=""
            yAxisSuffix=""
          />
        )}
      </View>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

// ─── Sub-componentes ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
  emoji,
}: {
  label: string;
  value: string;
  color: string;
  emoji: string;
}) {
  return (
    <View style={[styles.card, { borderTopColor: color }]}>
      <Text style={styles.cardEmoji}>{emoji}</Text>
      <Text style={[styles.cardValue, { color }]}>{value}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
    </View>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <View style={styles.emptyChart}>
      <Text style={styles.emptyChartText}>{message}</Text>
    </View>
  );
}

// ─── Estilos ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4ff' },
  content: { padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#6b7280', fontSize: 14 },

  // Filtros
  filterRow: {
    flexDirection: 'row',
    backgroundColor: '#e8edf8',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    gap: 4,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: 'center',
  },
  filterBtnActive: { backgroundColor: '#1a73e8', shadowColor: '#1a73e8', shadowOpacity: 0.3, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 3 },
  filterLabel: { fontSize: 13, fontWeight: '500', color: '#6b7280' },
  filterLabelActive: { color: '#fff' },

  // Sección
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 12, marginTop: 4 },

  // Cards
  cardsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderTopWidth: 3,
    borderTopColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  cardWide: { flex: 2 },
  cardEmoji: { fontSize: 22, marginBottom: 4 },
  cardValue: { fontSize: 28, fontWeight: '800', lineHeight: 32 },
  cardLabel: { fontSize: 11, color: '#6b7280', fontWeight: '500', textAlign: 'center', marginTop: 2 },

  // Gráficos
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 8,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  emptyChart: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyChartText: { color: '#9ca3af', fontSize: 13 },

  // Motivacional
  motivContainer: {
    flex: 1,
    backgroundColor: '#f0f4ff',
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  motivEmoji: { fontSize: 64, marginBottom: 16 },
  motivTitle: { fontSize: 24, fontWeight: '800', color: '#1a73e8', textAlign: 'center', marginBottom: 12 },
  motivText: { fontSize: 14, color: '#4b5563', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  motivCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    gap: 12,
    width: '100%',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  motivCardIcon: { fontSize: 24 },
  motivCardText: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 19 },
  motivFooter: {
    marginTop: 24,
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
