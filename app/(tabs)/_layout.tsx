import { Tabs } from 'expo-router';
import { LogOut } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/hooks/useAuth';
import { Rol } from '../../src/types';
import { BrandHeader } from '../../src/components/BrandHeader';

export default function TabsLayout() {
  const { user, isGuest, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = useCallback(() => {
    if (isGuest) {
      // Invitado: volver a portada sin confirmación
      logout();
      return;
    }
    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro de que querés salir?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            try {
              await logout();
            } finally {
              setLoggingOut(false);
            }
          },
        },
      ],
    );
  }, [logout, isGuest]);

  const logoutButton = useCallback(
    () => (
      <Pressable
        onPress={handleLogout}
        disabled={loggingOut}
        style={styles.logoutBtn}
      >
        {loggingOut ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <LogOut size={15} color="#fff" strokeWidth={2.5} />
            <Text style={styles.logoutText}>Salir</Text>
          </>
        )}
      </Pressable>
    ),
    [handleLogout, loggingOut],
  );

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerTintColor: '#1B4F72',
        headerTitle: () => <BrandHeader />,
        headerTitleAlign: 'left',
        headerRight: logoutButton,
        headerShadowVisible: true,
        tabBarActiveTintColor: '#E67E22',
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle: {
          paddingBottom: Math.max(insets.bottom, 6),
          height: 56 + Math.max(insets.bottom, 6),
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        detachPreviousScreen: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Nuevo Reporte',
          tabBarIcon: ({ color }) => <TabIcon icon="📍" color={color} />,
        }}
      />
      <Tabs.Screen
        name="mapa"
        options={{
          title: 'Mapa',
          tabBarIcon: ({ color }) => <TabIcon icon="🗺️" color={color} />,
          href: isGuest ? null : '/(tabs)/mapa',
        }}
      />
      <Tabs.Screen
        name="soluciones"
        options={{
          title: 'Soluciones',
          tabBarIcon: ({ color }) => <TabIcon icon="🔧" color={color} />,
          href:
            !isGuest && (user?.rol === Rol.RESPONSABLE || user?.rol === Rol.SUPERVISOR)
              ? '/(tabs)/soluciones'
              : null,
        }}
      />
      <Tabs.Screen
        name="comunicados"
        options={{
          title: 'Comunicados',
          tabBarIcon: ({ color }) => <TabIcon icon="📢" color={color} />,
          href: isGuest ? null : '/(tabs)/comunicados',
        }}
      />
      <Tabs.Screen
        name="estadisticas"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <TabIcon icon="📊" color={color} />,
          href: !isGuest && user?.rol !== Rol.REPORTANTE ? '/(tabs)/estadisticas' : null,
        }}
      />
      <Tabs.Screen
        name="ajustes"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color }) => <TabIcon icon="⚙️" color={color} />,
        }}
      />
    </Tabs>
  );
}

function TabIcon({ icon, color }: { icon: string; color: string }) {
  return <Text style={{ fontSize: 20, color }}>{icon}</Text>;
}

const styles = StyleSheet.create({
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginRight: 14,
    backgroundColor: '#DC2626',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  logoutText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
