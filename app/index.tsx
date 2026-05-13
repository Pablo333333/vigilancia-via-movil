import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Image, ImageBackground, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ROAD_IMAGE = require('../assets/ilustracion-dibujos-animados-carretera-arboles-sol-fondo_135595-118851.avif');
const LOGO_IMAGE = require('../assets/icon.png');

export default function WelcomeScreen() {
  return (
    <ImageBackground source={ROAD_IMAGE} style={styles.bg} resizeMode="cover">
      <StatusBar style="light" />
      <View style={styles.overlay} />
      <SafeAreaView style={styles.safe}>
        {/* Logo OrganizaDoor */}
        <View style={styles.logoWrap}>
          <Image source={LOGO_IMAGE} style={styles.logo} resizeMode="contain" />
        </View>

        {/* App name */}
        <View style={styles.titleWrap}>
          <Text style={styles.appName}>Vigilancia{'\n'}de la Vía</Text>
        </View>

        {/* Action buttons */}
        <View style={styles.buttonsWrap}>
          <Pressable
            style={({ pressed }) => [styles.btnEmpezar, pressed && styles.btnPressed]}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.btnEmpezarText}>Empezar</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.btnGuest, pressed && styles.btnPressed]}
            onPress={() => router.push('/reporte')}
          >
            <Text style={styles.btnGuestText}>Reportar sin registro</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  safe: {
    flex: 1,
  },
  logoWrap: {
    alignItems: 'center',
    marginTop: Platform.OS === 'ios' ? 20 : 36,
  },
  logo: {
    width: 110,
    height: 110,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  orgName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 10,
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  titleWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  appName: {
    fontSize: 52,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 62,
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 12,
  },
  buttonsWrap: {
    paddingHorizontal: 28,
    paddingBottom: 40,
    gap: 14,
  },
  btnEmpezar: {
    backgroundColor: '#E67E22',
    borderRadius: 30,
    paddingVertical: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 7,
  },
  btnEmpezarText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  btnGuest: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 30,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.65)',
  },
  btnGuestText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  btnPressed: { opacity: 0.8 },
});
