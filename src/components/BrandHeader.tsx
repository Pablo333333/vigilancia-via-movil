import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../constants/theme';

export const BrandHeader = () => {
  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/icon.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.brandText}>
        <Text style={styles.brandBold}>ORGANIZA</Text>
        <Text style={styles.brandAccent}>DOOR</Text>
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  brandText: {
    fontSize: 17,
    letterSpacing: 0.3,
  },
  brandBold: {
    fontWeight: '900',
    color: COLORS.primary,
  },
  brandAccent: {
    fontWeight: '900',
    color: '#E67E22',
  },
});
