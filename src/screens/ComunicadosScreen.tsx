import { AxiosError } from 'axios';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
  TouchableOpacity,
} from 'react-native';
import { 
  Megaphone, 
  Plus, 
  Clock, 
  ChevronRight, 
  AlertCircle,
  Calendar,
  MessageSquare
} from 'lucide-react-native';
import { useAuth } from '../hooks/useAuth';
import { API_CONFIG } from '../config/api.config';
import apiClient from '../services/api.client';
import { Rol, type Comunicado } from '../types';
import { THEME } from '../constants/theme';

// ─── Componente principal ───────────────────────────────────────────────────────

export default function ComunicadosScreen() {
  const { user } = useAuth();
  const [comunicados, setComunicados] = useState<Comunicado[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Solo RESPONSABLE puede publicar comunicados; SUPERVISOR es solo lectura
  const canCreate = user?.rol === Rol.RESPONSABLE;

  const fetchComunicados = useCallback(async () => {
    try {
      setErrorMsg(null);
      const { data } = await apiClient.get<Comunicado[]>(API_CONFIG.ENDPOINTS.COMUNICADOS.BASE);
      setComunicados(data);
    } catch {
      setErrorMsg('No se pudieron cargar los comunicados.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchComunicados();
  }, [fetchComunicados]);

  const handleCreated = () => {
    setShowModal(false);
    fetchComunicados();
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={THEME.colors.primary} />
        <Text style={styles.loadingText}>Cargando comunicados…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Encabezado con acción */}
      <View style={styles.header}>
        <View />
        {canCreate && (
          <TouchableOpacity 
            style={styles.headerAddBtn} 
            onPress={() => setShowModal(true)}
          >
            <Plus size={20} color={THEME.colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {errorMsg ? (
        <View style={styles.errorBox}>
          <AlertCircle size={20} color={THEME.colors.danger} />
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity onPress={fetchComunicados}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <FlatList
        data={comunicados}
        keyExtractor={(item) => item.id}
        contentContainerStyle={comunicados.length === 0 ? styles.emptyContainer : styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchComunicados(); }}
            colors={[THEME.colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Megaphone size={64} color={THEME.colors.textLight} />
            <Text style={styles.emptyTitle}>Sin comunicados</Text>
            <Text style={styles.emptySubtitle}>No hay comunicados publicados aún.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <View style={styles.iconCircle}>
                <Megaphone size={20} color={THEME.colors.primary} />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.mensaje} numberOfLines={3}>{item.mensaje}</Text>
                
                <View style={styles.cardFooter}>
                  <View style={styles.footerItem}>
                    <Calendar size={12} color={THEME.colors.textLight} />
                    <Text style={styles.date}>
                      {new Date(item.fechaPublicacion).toLocaleDateString('es-AR', {
                        day: '2-digit', month: 'short'
                      })}
                    </Text>
                  </View>
                  
                  {item.duracionRestriccion ? (
                    <View style={styles.restriccionBadge}>
                      <Clock size={12} color={THEME.colors.primary} />
                      <Text style={styles.restriccionText}>
                        {item.duracionRestriccion} min
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <ChevronRight size={18} color={THEME.colors.borderBlue} />
            </View>
          </View>
        )}
      />

      {/* Botón Principal Inferior */}
      {canCreate && (
        <View style={styles.footerAction}>
          <TouchableOpacity 
            style={styles.mainBtn} 
            onPress={() => setShowModal(true)}
          >
            <Plus size={24} color={THEME.colors.white} />
            <Text style={styles.mainBtnText}>Nuevo registro</Text>
          </TouchableOpacity>
        </View>
      )}

      <CrearComunicadoModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleCreated}
      />
    </View>
  );
}

// ─── Modal de creación ──────────────────────────────────────────────────────────

function CrearComunicadoModal({
  visible,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [mensaje, setMensaje] = useState('');
  const [duracion, setDuracion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setMensaje('');
      setDuracion('');
      setErrorMsg(null);
    }
  }, [visible]);

  const handleSubmit = async () => {
    const trimmed = mensaje.trim();
    if (!trimmed) {
      setErrorMsg('El contenido del comunicado no puede estar vacío.');
      return;
    }
    if (trimmed.length < 10) {
      setErrorMsg('El mensaje debe tener al menos 10 caracteres.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const body: { mensaje: string; duracionRestriccion?: number } = { mensaje: trimmed };
      const mins = parseInt(duracion, 10);
      if (!isNaN(mins) && mins > 0) {
        body.duracionRestriccion = mins;
      }

      await apiClient.post(API_CONFIG.ENDPOINTS.COMUNICADOS.BASE, body);
      Alert.alert('Éxito', 'Comunicado publicado correctamente.');
      onSuccess();
    } catch (err) {
      let detail = 'Error desconocido al publicar el comunicado.';
      if (err instanceof AxiosError) {
        const data = err.response?.data;
        const msg = data?.message;
        if (Array.isArray(msg)) detail = msg.join('\n');
        else if (typeof msg === 'string') detail = msg;
        else if (err.code === 'ECONNREFUSED' || err.code === 'ERR_NETWORK')
          detail = 'No se pudo conectar con el servidor. Verificá tu conexión.';
      }
      setErrorMsg(detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalKbWrapper}
        >
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />

            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Nuevo Comunicado</Text>
              <Text style={styles.modalSubtitle}>
                Este mensaje será visible para todos los usuarios de la app.
              </Text>

              <Text style={styles.fieldLabel}>Contenido</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Escribí el mensaje del comunicado…"
                placeholderTextColor={THEME.colors.textLight}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                value={mensaje}
                onChangeText={setMensaje}
              />

              <Text style={styles.fieldLabel}>
                Duración de restricción (min){' '}
                <Text style={styles.fieldLabelOptional}>(opcional)</Text>
              </Text>
              <TextInput
                style={styles.inputField}
                placeholder="Ej: 30"
                placeholderTextColor={THEME.colors.textLight}
                keyboardType="numeric"
                value={duracion}
                onChangeText={setDuracion}
              />

              {errorMsg ? (
                <View style={styles.modalErrorBox}>
                  <Text style={styles.modalErrorText}>{errorMsg}</Text>
                </View>
              ) : null}

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={isSubmitting}>
                  <Text style={styles.cancelBtnText}>Cerrar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitBtn, isSubmitting && styles.btnDisabled]}
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color={THEME.colors.white} />
                  ) : (
                    <Text style={styles.submitBtnText}>Publicar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

// ─── Estilos ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: THEME.colors.background },
  loadingText: { marginTop: 12, color: THEME.colors.textLight, fontSize: 17, fontWeight: '600' },
  
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: THEME.colors.primary,
  },
  headerAddBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...THEME.shadows.soft,
    borderWidth: 1,
    borderColor: THEME.colors.borderBlue,
  },

  list: { padding: 20, paddingBottom: 100 },

  errorBox: {
    backgroundColor: '#fee2e2',
    padding: 16,
    marginHorizontal: 20,
    borderRadius: THEME.sizes.radius,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: { color: THEME.colors.danger, fontSize: 15, flex: 1, fontWeight: '600' },
  retryText: { color: THEME.colors.primary, fontWeight: '700', fontSize: 15 },

  card: {
    backgroundColor: THEME.colors.white,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: THEME.colors.borderBlue,
    ...THEME.shadows.soft,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.colors.cardYellow,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.borderBlue,
  },
  cardContent: {
    flex: 1,
    gap: 6,
  },
  mensaje: { 
    fontSize: 16, 
    color: THEME.colors.text, 
    lineHeight: 22, 
    fontWeight: '600' 
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  restriccionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.cardYellow,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: THEME.colors.borderBlue,
  },
  restriccionText: { fontSize: 12, color: THEME.colors.primary, fontWeight: '700' },
  date: { fontSize: 12, color: THEME.colors.textLight, fontWeight: '500' },

  emptyContainer: { flex: 1 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: THEME.colors.primary, marginTop: 16 },
  emptySubtitle: { fontSize: 16, color: THEME.colors.textLight, marginTop: 8, textAlign: 'center' },

  // Botón Principal Inferior
  footerAction: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: 'transparent',
  },
  mainBtn: {
    backgroundColor: THEME.colors.accent,
    borderRadius: THEME.sizes.radius,
    paddingVertical: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    ...THEME.shadows.medium,
  },
  mainBtnText: {
    color: THEME.colors.white,
    fontSize: 20,
    fontWeight: '800',
  },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalKbWrapper: { justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: THEME.colors.white,
    borderTopLeftRadius: THEME.sizes.radius,
    borderTopRightRadius: THEME.sizes.radius,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '85%',
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
  modalSubtitle: { fontSize: 16, color: THEME.colors.textLight, marginBottom: 24, fontWeight: '600' },

  fieldLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 20,
    marginBottom: 10,
  },
  fieldLabelOptional: { fontWeight: '400', textTransform: 'none', color: THEME.colors.textLight },

  textArea: {
    backgroundColor: THEME.colors.cardYellow,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME.colors.borderBlue,
    padding: 16,
    fontSize: 17,
    color: THEME.colors.text,
    minHeight: 120,
    ...THEME.shadows.soft,
  },
  inputField: {
    backgroundColor: THEME.colors.cardYellow,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: THEME.colors.borderBlue,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    color: THEME.colors.text,
    ...THEME.shadows.soft,
  },

  modalErrorBox: { backgroundColor: '#fee2e2', borderRadius: 12, padding: 12, marginTop: 16, borderWidth: 1, borderColor: '#fecaca' },
  modalErrorText: { color: THEME.colors.danger, fontSize: 15, fontWeight: '700' },

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
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    ...THEME.shadows.medium,
  },
  submitBtnText: { color: THEME.colors.white, fontSize: 18, fontWeight: '800' },
  btnDisabled: { opacity: 0.5 },
});
