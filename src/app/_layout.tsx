import '../global.css';

import { type ErrorBoundaryProps } from 'expo-router';
import { getLocales } from 'expo-localization';
import * as SplashScreen from 'expo-splash-screen';
import { TriangleAlertIcon } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import { RootNavigator } from '@/components/root-navigator';
import { StateView } from '@/components/state-view';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { createI18n, resolveLocale } from '@/i18n';
import { AppProviders } from '@/providers/app-providers';
import { createDefaultDependencies } from '@/providers/dependencies';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [dependencies] = useState(createDefaultDependencies);
  const onReady = useCallback(() => {
    void SplashScreen.hideAsync();
  }, []);
  return (
    <AppProviders dependencies={dependencies} onReady={onReady}>
      <RootNavigator />
    </AppProviders>
  );
}

/** Last-resort error screen; providers may be unavailable here, so it builds its own i18n. */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  const t = useMemo(
    () =>
      createI18n(
        resolveLocale(
          'system',
          getLocales().map((l) => l.languageTag),
        ),
      ).t,
    [],
  );
  return (
    <View className="flex-1 bg-background px-6">
      <StateView
        icon={TriangleAlertIcon}
        tone="destructive"
        title={t('errorBoundary.title')}
        description={t('errorBoundary.description')}
      >
        <Button size="lg" onPress={() => void retry()}>
          <Text>{t('errorBoundary.retry')}</Text>
        </Button>
      </StateView>
    </View>
  );
}
