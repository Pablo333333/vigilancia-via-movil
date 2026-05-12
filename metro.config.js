const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Agrega soporte para imágenes .avif
config.resolver.assetExts.push('avif');

module.exports = config;
