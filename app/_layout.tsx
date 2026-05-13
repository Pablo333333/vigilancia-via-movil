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
  if (isLoading) return;

  // 1. Identificamos si estamos en una pantalla pública
  //segments[0] será 'login' o 'reporte' si estamos ahí. 
  //Si segments está vacío, estamos en la raíz (index).
  const isPublic = segments.length === 0 || segments[0] === 'login' || segments[0] === 'reporte';

  // 2. Si NO hay usuario y NO estamos en una pública -> A la carretera (Welcome)
  if (!user && !isGuest) {
    if (!isPublic) {
      router.replace('/'); 
    }
    return;
  }

  // 3. Si HAY usuario y estamos en la Welcome o Login -> Al Mapa
  if ((user || isGuest) && (segments.length === 0 || segments[0] === 'login')) {
    router.replace('/(tabs)/mapa');
  }
}, [user, isGuest, isLoading, segments]);

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
  {/* 1. La raíz absoluta (app/index.tsx) */}
  <Stack.Screen name="index" options={{ headerShown: false }} />
  
  {/* 2. Pantallas públicas */}
  <Stack.Screen name="login" options={{ headerRight: undefined }} />
  <Stack.Screen name="reporte" options={{ headerRight: publicExitButton }} />
  
  {/* 3. El grupo de pestañas */}
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
