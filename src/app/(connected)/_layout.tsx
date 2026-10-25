import { Redirect, router, Stack, usePathname } from 'expo-router';
import { HouseIcon, MapIcon, SettingsIcon, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { BrandMark } from '@/components/brand-mark';
import { ConnectionIndicator } from '@/components/connection-indicator';
import { useDeviceLayout } from '@/components/layout/use-device-layout';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/session/session-provider';
import { cn } from '@/lib/utils';

const NAV: {
  href: '/home' | '/map' | '/settings';
  label: 'nav.home' | 'nav.map' | 'nav.settings';
  icon: LucideIcon;
}[] = [
  { href: '/home', label: 'nav.home', icon: HouseIcon },
  { href: '/map', label: 'nav.map', icon: MapIcon },
  { href: '/settings', label: 'nav.settings', icon: SettingsIcon },
];

/**
 * Area for paired devices. Guards the session (a revoked token lands on
 * "Collega" with the reason) and picks the layout: a stack on phones, a
 * master/detail split with a navigation pane on tablets. The connection
 * indicator is always visible: in every phone header, in the tablet pane.
 */
export default function ConnectedLayout() {
  const { t } = useTranslation();
  const { state } = useSession();
  const layout = useDeviceLayout();

  if (state.status !== 'paired') {
    return (
      <Redirect
        href={
          state.reason ? { pathname: '/connect', params: { reason: state.reason } } : '/connect'
        }
      />
    );
  }

  if (layout === 'tablet') {
    return (
      <View className="flex-1 flex-row bg-background">
        <Sidebar />
        <View className="flex-1">
          <Stack screenOptions={{ animation: 'none', headerBackVisible: false }}>
            <Stack.Screen name="home" options={{ title: t('nav.home') }} />
            <Stack.Screen name="map" options={{ title: t('nav.map') }} />
            <Stack.Screen name="settings" options={{ title: t('nav.settings') }} />
            <Stack.Screen name="pending" options={{ title: t('nav.pending') }} />
          </Stack>
        </View>
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerBackButtonDisplayMode: 'minimal',
        headerRight: () => <ConnectionIndicator />,
      }}
    >
      <Stack.Screen
        name="home"
        options={{
          title: t('nav.home'),
          headerRight: () => (
            <View className="flex-row items-center">
              <ConnectionIndicator />
              <Button
                variant="ghost"
                size="icon"
                accessibilityLabel={t('nav.map')}
                onPress={() => router.push('/map')}
              >
                <Icon as={MapIcon} size={22} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                accessibilityLabel={t('nav.settings')}
                onPress={() => router.push('/settings')}
              >
                <Icon as={SettingsIcon} size={22} />
              </Button>
            </View>
          ),
        }}
      />
      <Stack.Screen name="map" options={{ title: t('nav.map') }} />
      <Stack.Screen name="settings" options={{ title: t('nav.settings') }} />
      <Stack.Screen name="pending" options={{ title: t('nav.pending') }} />
    </Stack>
  );
}

/** Navigation pane of the tablet layout. */
function Sidebar() {
  const { t } = useTranslation();
  const pathname = usePathname();
  return (
    <View
      className="pb-safe pt-safe w-72 gap-1 border-r border-border bg-card px-3"
      role="navigation"
    >
      <View className="flex-row items-center gap-3 px-3 py-6">
        <BrandMark className="h-10 w-10" />
        <Text variant="large">{t('common.appName')}</Text>
      </View>
      <View className="mb-2 rounded-md border border-border">
        <ConnectionIndicator variant="full" />
      </View>
      {NAV.map((item) => {
        const active = pathname === item.href;
        return (
          <Pressable
            key={item.href}
            role="link"
            accessibilityState={{ selected: active }}
            onPress={() => router.replace(item.href)}
            className={cn(
              'min-h-12 flex-row items-center gap-3 rounded-md px-3 active:bg-accent',
              active && 'bg-accent',
            )}
          >
            <Icon
              as={item.icon}
              size={20}
              className={active ? 'text-accent-foreground' : 'text-muted-foreground'}
            />
            <Text className={cn(active && 'font-semibold text-accent-foreground')}>
              {t(item.label)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
