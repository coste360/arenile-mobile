const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// inlineRem 16: the rem value React Native Reusables components are designed for.
module.exports = withNativeWind(config, { input: './src/global.css', inlineRem: 16 });
