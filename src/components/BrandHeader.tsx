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
      <Text style={styles.brandText}>ORGANIZADOOR</Text>
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
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  brandText: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
});
