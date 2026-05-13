import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Image, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEME } from '../src/constants/theme';

const ROAD_IMAGE = require('../assets/ilustracion-dibujos-animados-carretera-arboles-sol-fondo_135595-118851.avif');
const LOGO_IMAGE = require('../assets/icon.png');

export default function WelcomeScreen() {
  return (
    <ImageBackground source={ROAD_IMAGE} style={styles.bg} resizeMode="cover">
      <StatusBar style="light" />
      <View style={styles.overlay} />
      <SafeAreaView style={styles.safe}>
        {/* Header imitado (BrandHeader) */}
        <View style={styles.fakeHeader}>
          <Image source={LOGO_IMAGE} style={styles.fakeLogo} resizeMode="contain" />
          <Text style={styles.brandText}>
            <Text style={styles.brandBold}>ORGANIZA</Text>
            <Text style={styles.brandAccent}>DOOR</Text>
          </Text>
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
  fakeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    ...THEME.shadows.soft,
  },
  fakeLogo: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  brandText: {
    fontSize: 18,
    letterSpacing: 0.5,
  },
  brandBold: {
    fontWeight: '900',
    color: THEME.colors.primary,
  },
  brandAccent: {
    fontWeight: '900',
    color: '#E67E22',
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
