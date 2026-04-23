/**
 * Layout raíz de Expo Router.
 *
 * Responsabilidades:
 *  - Envuelve toda la app en <AuthProvider> para estado de sesión compartido.
 *  - Registra UNA SOLA VEZ el handler de sesión expirada (401 → /login).
 *  - Espera a que el árbol de navegación esté listo antes de redirigir.
 *  - Muestra ActivityIndicator mientras useAuth verifica la sesión.
 */
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AuthProvider, useAuth } from '../src/hooks/useAuth';
import { useOfflineSync } from '../src/hooks/useOfflineSync';
import { registerUnauthorizedHandler } from '../src/services';

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

function RootNavigator() {
  const { user, isGuest, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  const { pendingCount } = useOfflineSync();

  // ── Handler de 401 — se registra una sola vez ─────────────────────────────────
  const handlerRegistered = useRef(false);
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    if (handlerRegistered.current) return;
    handlerRegistered.current = true;
    registerUnauthorizedHandler(() => routerRef.current.replace('/login'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Redirección de sesión — sólo cuando navegación y auth estén listos ────────
  useEffect(() => {
    if (isLoading) return;
    if (!navigationState?.key) return;

    const inLogin = segments[0] === 'login';

    if (!user && !isGuest && !inLogin) {
      router.replace('/login');
    } else if (user && inLogin) {
      router.replace('/(tabs)');
    }
  }, [user, isGuest, isLoading, segments, navigationState?.key, router]);

  // ── Pantalla de carga inicial ─────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    );
  }

  return (
    <>
      {pendingCount > 0 && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            {pendingCount} reporte{pendingCount > 1 ? 's' : ''} pendiente{pendingCount > 1 ? 's' : ''} — sincronizando…
          </Text>
        </View>
      )}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f4ff' },
  offlineBanner: {
    backgroundColor: '#f59e0b',
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  offlineBannerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
