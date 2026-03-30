/**
 * Pantalla de Login
 *
 * Flujo:
 *  1. Usuario ingresa email y contraseña.
 *  2. useAuth.login() → AuthService.login() → guarda JWT → navega al home.
 *  3. Si hay error, lo muestra inline (sin librerías externas de toast).
 */
import { Ionicons } from '@expo/vector-icons';
import { AxiosError } from 'axios';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { NotificationsService } from '../services/notifications.service';
import type { ApiError } from '../types';

export default function LoginScreen() {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const extractErrorMessage = (error: unknown): string => {
    if (error instanceof AxiosError) {
      const data = error.response?.data as ApiError | undefined;
      if (Array.isArray(data?.message)) return data.message.join('\n');
      if (typeof data?.message === 'string') return data.message;
      if (error.code === 'ECONNREFUSED') return 'No se pudo conectar con el servidor. Verifica tu conexión.';
    }
    return 'Error inesperado. Inténtalo de nuevo.';
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Completá todos los campos.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      await login({ email: email.trim(), password });

      // Registrar el token push en segundo plano — no bloquea la navegación
      NotificationsService.registerForPushNotifications()
        .then((token) => {
          if (token) NotificationsService.savePushToken(token);
        })
        .catch(() => null);

      router.replace('/(tabs)');
    } catch (err) {
      setErrorMsg(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Vigilancia de la Vía</Text>
        <Text style={styles.subtitle}>Iniciá sesión para continuar</Text>

        <TextInput
          style={styles.input}
          placeholder="Correo electrónico"
          placeholderTextColor="#9ca3af"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
        />

        <View style={styles.passwordWrap}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Contraseña"
            placeholderTextColor="#9ca3af"
            secureTextEntry={!showPassword}
            autoComplete="password"
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={handleLogin}
            returnKeyType="done"
          />
          <Pressable
            onPress={() => setShowPassword((v) => !v)}
            style={styles.eyeBtn}
            hitSlop={8}
          >
            <Ionicons
              name={showPassword ? 'eye-off' : 'eye'}
              size={22}
              color="#6b7280"
            />
          </Pressable>
        </View>

        {errorMsg ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        <Pressable
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Ingresar</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a73e8',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    marginBottom: 12,
  },
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    marginBottom: 12,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  eyeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
  },
  button: {
    backgroundColor: '#1a73e8',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
