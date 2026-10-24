import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { useTranslation } from 'react-i18next';

import { NAV_THEME } from '@/lib/theme';

/** Root stack of the app (also rendered by the screen tests, with fake dependencies). */
export function RootNavigator() {
  const { colorScheme } = useColorScheme();
  const { t } = useTranslation();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  return (
    <ThemeProvider value={NAV_THEME[scheme]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="connect" options={{ headerShown: false }} />
        <Stack.Screen name="scan" options={{ title: t('scan.title') }} />
        <Stack.Screen name="manual" options={{ title: t('manual.title') }} />
        <Stack.Screen
          name="pair"
          options={{ title: t('pair.title'), headerBackVisible: false, gestureEnabled: false }}
        />
        <Stack.Screen name="(connected)" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}
