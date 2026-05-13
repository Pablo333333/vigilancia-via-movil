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
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthProvider, useAuth } from '../src/hooks/useAuth';
import { useOfflineSync } from '../src/hooks/useOfflineSync';
import { registerUnauthorizedHandler } from '../src/services';
import { BrandHeader } from '../src/components/BrandHeader';
import { X } from 'lucide-react-native';

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
    const inPublic = onRoot || seg0 === 'login' || seg0 === 'reporte';

    if (!user && !isGuest && !inPublic) {
      // No autenticado y no en ruta pública: forzar vuelta a portada
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

  const publicExitButton = () => (
    <Pressable
      onPress={() => router.replace('/')}
      style={styles.exitBtn}
    >
      <X size={16} color="#fff" />
      <Text style={styles.exitText}>Salir</Text>
    </Pressable>
  );

  return (
    <>
      {pendingCount > 0 && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            {pendingCount} reporte{pendingCount > 1 ? 's' : ''} pendiente{pendingCount > 1 ? 's' : ''} — sincronizando…
          </Text>
        </View>
      )}
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTitle: () => <BrandHeader />,
          headerTitleAlign: 'left',
          headerShadowVisible: true,
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerRight: undefined }} />
        <Stack.Screen name="reporte" options={{ headerRight: publicExitButton }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
  exitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginRight: 14,
    backgroundColor: '#DC2626',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  exitText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
