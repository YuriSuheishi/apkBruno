// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Adicionar extensões para resolver módulos do socket.io-client
config.resolver.sourceExts.push('cjs', 'mjs');

module.exports = config;
