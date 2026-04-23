import { Tabs } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/hooks/useAuth';
import { Rol } from '../../src/types';

export default function TabsLayout() {
  const { user, isGuest, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Salir',
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
  }, [logout]);

  const logoutButton = useCallback(
    () => (
      <Pressable onPress={handleLogout} disabled={loggingOut} style={styles.logoutBtn}>
        {loggingOut ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.logoutIcon}>🚪</Text>
        )}
      </Pressable>
    ),
    [handleLogout, loggingOut],
  );

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#1a73e8' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '600' },
        tabBarActiveTintColor: '#1a73e8',
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle: {
          paddingBottom: Math.max(insets.bottom, 6),
          height: 56 + Math.max(insets.bottom, 6),
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
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
          href: !isGuest && (user?.rol === Rol.RESPONSABLE || user?.rol === Rol.SUPERVISOR)
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
          // REPORTANTE no tiene acceso al Dashboard
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
    marginRight: 12,
    padding: 6,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutIcon: { fontSize: 22 },
});
