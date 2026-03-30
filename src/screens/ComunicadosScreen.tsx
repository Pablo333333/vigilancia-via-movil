import { Ionicons } from '@expo/vector-icons';
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
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { API_CONFIG } from '../config/api.config';
import apiClient from '../services/api.client';
import { Rol, type Comunicado } from '../types';

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
        <ActivityIndicator size="large" color="#1a73e8" />
        <Text style={styles.loadingText}>Cargando comunicados…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {errorMsg ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <Pressable onPress={fetchComunicados}>
            <Text style={styles.retryText}>Reintentar</Text>
          </Pressable>
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
            colors={['#1a73e8']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📢</Text>
            <Text style={styles.emptyTitle}>Sin comunicados</Text>
            <Text style={styles.emptySubtitle}>No hay comunicados publicados aún.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.mensaje}>{item.mensaje}</Text>

            {item.duracionRestriccion ? (
              <View style={styles.restriccionBadge}>
                <Text style={styles.restriccionText}>
                  ⏱ Restricción: {item.duracionRestriccion} min
                </Text>
              </View>
            ) : null}

            <Text style={styles.date}>
              {new Date(item.fechaPublicacion).toLocaleDateString('es-AR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        )}
      />

      {canCreate && (
        <Pressable style={styles.fab} onPress={() => setShowModal(true)}>
          <Ionicons name="add" size={28} color="#fff" />
        </Pressable>
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
                placeholderTextColor="#9ca3af"
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
                placeholderTextColor="#9ca3af"
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
                <Pressable style={styles.cancelBtn} onPress={onClose} disabled={isSubmitting}>
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[styles.submitBtn, isSubmitting && styles.btnDisabled]}
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.submitBtnText}>Publicar</Text>
                  )}
                </Pressable>
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
  container: { flex: 1, backgroundColor: '#f0f4ff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f4ff' },
  loadingText: { marginTop: 12, color: '#6b7280', fontSize: 14 },
  list: { padding: 16, paddingBottom: 80 },

  errorBox: {
    backgroundColor: '#fee2e2',
    padding: 12,
    margin: 16,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: { color: '#dc2626', fontSize: 13, flex: 1 },
  retryText: { color: '#1a73e8', fontWeight: '600', fontSize: 13, marginLeft: 12 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  mensaje: { fontSize: 15, color: '#111827', lineHeight: 22, marginBottom: 10 },
  restriccionBadge: {
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  restriccionText: { fontSize: 12, color: '#92400e', fontWeight: '500' },
  date: { fontSize: 11, color: '#9ca3af' },

  emptyContainer: { flex: 1 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#374151' },
  emptySubtitle: { fontSize: 14, color: '#6b7280', marginTop: 4 },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1a73e8',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 6,
  },

  // Modal
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
    width: 40,
    height: 4,
    backgroundColor: '#d1d5db',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 2 },
  modalSubtitle: { fontSize: 13, color: '#6b7280', marginBottom: 16 },

  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  fieldLabelOptional: { fontWeight: '400', textTransform: 'none' },

  textArea: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    padding: 12,
    fontSize: 14,
    color: '#111827',
    minHeight: 110,
  },
  inputField: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
  },

  modalErrorBox: { backgroundColor: '#fee2e2', borderRadius: 8, padding: 10, marginTop: 12 },
  modalErrorText: { color: '#dc2626', fontSize: 13 },

  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  cancelBtnText: { color: '#374151', fontSize: 15, fontWeight: '600' },
  submitBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#1a73e8',
    alignItems: 'center',
  },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
});
