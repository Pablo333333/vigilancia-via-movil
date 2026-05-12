/**
 * Layout raíz de Expo Router.
 *
 * Rutas públicas (sin autenticación):
 *  - /         → Pantalla de bienvenida (index)
 *  - /login    → Login
 *  - /reporte  → Reporte rápido sin registro
 *
 * Rutas protegidas:
 *  - /(tabs)/* → Requieren user autenticado o isGuest
 */
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
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

  // Handler 401 — registrado una sola vez
  const handlerRegistered = useRef(false);
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    if (handlerRegistered.current) return;
    handlerRegistered.current = true;
    registerUnauthorizedHandler(() => routerRef.current.replace('/'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!navigationState?.key) return;

    const onRoot = segments.length === 0;              // pantalla de bienvenida /
    const seg0 = segments[0] as string | undefined;
    const inTabs = seg0 === '(tabs)';

    if (inTabs && !user && !isGuest) {
      // Sesión cerrada o expirada: limpiar stack y volver a portada
      router.dismissAll();
      router.replace('/');
    } else if (onRoot && (user || isGuest)) {
      // Autenticado en portada → ir directo a tabs
      router.replace('/(tabs)');
    } else if (seg0 === 'login' && user) {
      // Ya logueado, saltar login
      router.replace('/(tabs)');
    }
  }, [user, isGuest, isLoading, segments, navigationState?.key, router]);

  if (isLoading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={THEME_PRIMARY} />
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
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="reporte" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}

const THEME_PRIMARY = '#1B4F72';

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FDFEFE',
  },
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
