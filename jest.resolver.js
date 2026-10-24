// Jest resolver: React Native's (from the jest-expo preset) composed with the
// one Reanimated 4 / Worklets ship for Jest, which picks their web
// implementations instead of the native modules.
const { resolver: rnResolverPath } = require('jest-expo/jest-preset');
const rnResolver = require(rnResolverPath);
const reanimatedResolver = require('react-native-reanimated/jest/resolver');

module.exports = (request, options) => {
  const original = options.defaultResolver;
  const viaReactNative = (req, opts) => rnResolver(req, { ...opts, defaultResolver: original });
  return reanimatedResolver(request, { ...options, defaultResolver: viaReactNative });
};
