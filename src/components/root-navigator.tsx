import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { useTranslation } from 'react-i18next';

import { useSession } from '@/features/session/session-provider';
import { WidgetSync } from '@/features/widget/widget-sync';
import { NAV_THEME } from '@/lib/theme';
import { OPAQUE_HEADER, orientationFor } from '@/components/layout/stack-options';
import { useFormFactor } from '@/components/layout/use-device-layout';

/**
 * Root stack of the app (also rendered by the screen tests, with fake
 * dependencies). Protected groups drop the screens of the other session state
 * from the history: after pairing, "back" never returns to "Collega", and
 * after a sign-out never to the connected area.
 */
export function RootNavigator() {
  const { colorScheme } = useColorScheme();
  const { t } = useTranslation();
  const { state } = useSession();
  const formFactor = useFormFactor();
  const paired = state.status === 'paired';
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  return (
    <ThemeProvider value={NAV_THEME[scheme]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <WidgetSync />
      <Stack
        screenOptions={{
          ...OPAQUE_HEADER,
          headerBackButtonDisplayMode: 'minimal',
          orientation: orientationFor(formFactor),
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen
          name="pair"
          options={{ title: t('pair.title'), headerBackVisible: false, gestureEnabled: false }}
        />
        <Stack.Protected guard={!paired}>
          <Stack.Screen name="connect" options={{ headerShown: false }} />
          <Stack.Screen name="scan" options={{ title: t('scan.title') }} />
          <Stack.Screen name="manual" options={{ title: t('manual.title') }} />
        </Stack.Protected>
        <Stack.Protected guard={paired}>
          <Stack.Screen name="(connected)" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}
