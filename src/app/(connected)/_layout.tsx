import { Redirect, router, Stack, usePathname } from 'expo-router';
import {
  CalendarDaysIcon,
  ChartColumnIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  HouseIcon,
  LifeBuoyIcon,
  ListOrderedIcon,
  MapIcon,
  MenuIcon,
  SearchCheckIcon,
  SettingsIcon,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, Pressable, View } from 'react-native';
import { FadeIn, FadeOut, ReduceMotion, SlideInLeft } from 'react-native-reanimated';

import { BrandMark } from '@/components/brand-mark';
import { ConnectionIndicator } from '@/components/connection-indicator';
import { NavPaneProvider, useNavPane } from '@/components/layout/nav-pane';
import { OPAQUE_HEADER, orientationFor } from '@/components/layout/stack-options';
import { useDeviceLayout, useFormFactor } from '@/components/layout/use-device-layout';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { NativeOnlyAnimatedView } from '@/components/ui/native-only-animated-view';
import { Text } from '@/components/ui/text';
import { canCreateBooking } from '@/features/new-booking/new-booking';
import type { Abilities } from '@/features/permissions/permissions';
import { useAbilities } from '@/features/permissions/use-abilities';
import { useSession } from '@/features/session/session-provider';
import { cn } from '@/lib/utils';

interface NavItem {
  href:
    | '/home'
    | '/map'
    | '/operations'
    | '/waitlist'
    | '/reports'
    | '/settings'
    | '/today'
    | '/bookings'
    | '/lifeguard'
    | '/availability';
  label:
    | 'nav.home'
    | 'nav.map'
    | 'nav.operations'
    | 'nav.waitlist'
    | 'nav.reports'
    | 'nav.settings'
    | 'nav.today'
    | 'nav.bookings'
    | 'nav.lifeguard'
    | 'nav.availability';
  icon: LucideIcon;
  /** Shown only when the role may open it (hidden, the server stays the judge). */
  visible?: (abilities: Abilities) => boolean;
}

const NAV: NavItem[] = [
  { href: '/home', label: 'nav.home', icon: HouseIcon },
  { href: '/today', label: 'nav.today', icon: CalendarDaysIcon },
  { href: '/bookings', label: 'nav.bookings', icon: ClipboardListIcon },
  { href: '/map', label: 'nav.map', icon: MapIcon },
  {
    href: '/availability',
    label: 'nav.availability',
    icon: SearchCheckIcon,
    visible: canCreateBooking,
  },
  {
    href: '/lifeguard',
    label: 'nav.lifeguard',
    icon: LifeBuoyIcon,
    visible: (a) => a.canViewBookings,
  },
  { href: '/operations', label: 'nav.operations', icon: ClipboardCheckIcon },
  {
    href: '/waitlist',
    label: 'nav.waitlist',
    icon: ListOrderedIcon,
    visible: (a) => a.canViewBookings,
  },
  {
    href: '/reports',
    label: 'nav.reports',
    icon: ChartColumnIcon,
    visible: (a) => a.canSeeReports,
  },
  { href: '/settings', label: 'nav.settings', icon: SettingsIcon },
];

/** Day screens (Oggi, bookings, spots, lifeguard list, spot calendar) declared once for both layouts. */
function dayScreens(
  t: (
    key:
      | 'nav.today'
      | 'nav.bookings'
      | 'nav.booking'
      | 'nav.spots'
      | 'nav.lifeguard'
      | 'spotCalendar.title',
  ) => string,
) {
  return [
    <Stack.Screen key="today" name="today" options={{ title: t('nav.today') }} />,
    <Stack.Screen key="bookings" name="bookings/index" options={{ title: t('nav.bookings') }} />,
    <Stack.Screen
      key="booking"
      name="bookings/[bookingId]"
      options={{ title: t('nav.booking') }}
    />,
    <Stack.Screen key="spots" name="spots" options={{ title: t('nav.spots') }} />,
    <Stack.Screen key="lifeguard" name="lifeguard" options={{ title: t('nav.lifeguard') }} />,
    <Stack.Screen
      key="spot-calendar"
      name="spot-calendar/[spotId]"
      options={{ title: t('spotCalendar.title') }}
    />,
  ];
}

/** Titles of the operations screens (the booking and spot screens set their own). */
function operationsScreens(t: (key: 'nav.operations' | 'operations.hub.scan') => string) {
  return [
    <Stack.Screen key="ops" name="operations/index" options={{ title: t('nav.operations') }} />,
    <Stack.Screen
      key="scan"
      name="operations/scan"
      options={{ title: t('operations.hub.scan') }}
    />,
    <Stack.Screen key="booking" name="operations/booking/[bookingId]" options={{ title: '' }} />,
    <Stack.Screen key="spot" name="operations/spot/[spotId]" options={{ title: '' }} />,
  ];
}

/** Phase 2 screens (spec 03) and the new booking, online only, declared once for both layouts. */
function phase2Screens(
  t: (
    key:
      | 'nav.sale'
      | 'nav.move'
      | 'nav.waitlist'
      | 'nav.waitlistEntry'
      | 'nav.newBooking'
      | 'nav.availability',
  ) => string,
) {
  return [
    <Stack.Screen key="sale" name="sale" options={{ title: t('nav.sale') }} />,
    <Stack.Screen key="new-booking" name="new-booking" options={{ title: t('nav.newBooking') }} />,
    <Stack.Screen
      key="availability"
      name="availability"
      options={{ title: t('nav.availability') }}
    />,
    <Stack.Screen key="move" name="move/[bookingId]" options={{ title: t('nav.move') }} />,
    <Stack.Screen key="waitlist" name="waitlist/index" options={{ title: t('nav.waitlist') }} />,
    <Stack.Screen
      key="waitlist-entry"
      name="waitlist/[entryId]"
      options={{ title: t('nav.waitlistEntry') }}
    />,
  ];
}

/**
 * Area for paired devices. Guards the session (a revoked token lands on
 * "Collega" with the reason) and picks the layout: a stack on phones, a
 * master/detail split with a collapsible navigation pane on tablets. The connection
 * indicator is always visible: in every phone header, in the tablet pane.
 */
export default function ConnectedLayout() {
  const { t } = useTranslation();
  const { state } = useSession();
  const layout = useDeviceLayout();
  const formFactor = useFormFactor();

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
      <NavPaneProvider>
        <TabletShell>
          <Stack
            screenOptions={({ navigation }) => ({
              ...OPAQUE_HEADER,
              animation: 'none',
              // The pane replaces the stack, so its screens have nothing under
              // them and get the ≡ toggle; a screen opened from another one
              // (spot, booking, scanner, move) keeps the back button.
              ...(navigation.canGoBack()
                ? { headerBackButtonDisplayMode: 'minimal' as const }
                : { headerBackVisible: false, headerLeft: () => <NavToggle /> }),
            })}
          >
            <Stack.Screen name="home" options={{ title: t('nav.home') }} />
            <Stack.Screen name="map" options={{ title: t('nav.map') }} />
            <Stack.Screen name="settings" options={{ title: t('nav.settings') }} />
            <Stack.Screen name="pending" options={{ title: t('nav.pending') }} />
            {dayScreens(t)}
            {operationsScreens(t)}
            {phase2Screens(t)}
            <Stack.Screen name="reports" options={{ title: t('nav.reports') }} />
          </Stack>
        </TabletShell>
      </NavPaneProvider>
    );
  }

  return (
    <Stack
      screenOptions={{
        ...OPAQUE_HEADER,
        headerBackButtonDisplayMode: 'minimal',
        orientation: orientationFor(formFactor),
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
              <ReportsHeaderButton />
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
                accessibilityLabel={t('nav.operations')}
                onPress={() => router.push('/operations')}
              >
                <Icon as={ClipboardCheckIcon} size={22} />
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
      {dayScreens(t)}
      {operationsScreens(t)}
      {phase2Screens(t)}
      <Stack.Screen name="reports" options={{ title: t('nav.reports') }} />
    </Stack>
  );
}

/** Phone header shortcut to the reports, only for the roles that may read them. */
function ReportsHeaderButton() {
  const { t } = useTranslation();
  const abilities = useAbilities();
  if (!abilities.canSeeReports) return null;
  return (
    <Button
      variant="ghost"
      size="icon"
      accessibilityLabel={t('nav.reports')}
      onPress={() => router.push('/reports')}
    >
      <Icon as={ChartColumnIcon} size={22} />
    </Button>
  );
}

/** The ≡ button of every tablet header: collapses or expands the navigation pane. */
function NavToggle() {
  const { t } = useTranslation();
  const pane = useNavPane();
  if (!pane) return null;
  return (
    <Button
      variant="ghost"
      size="icon"
      accessibilityLabel={t('nav.toggleMenu')}
      accessibilityState={{ expanded: pane.mode !== 'rail' }}
      onPress={pane.toggle}
    >
      <Icon as={MenuIcon} size={22} />
    </Button>
  );
}

/**
 * Tablet layout: the navigation and the screens. Navigation is an icon rail
 * when collapsed; expanded, a pane beside the content when it fits,
 * otherwise a drawer over it (the content keeps its width) with a scrim that
 * closes it, as does the Android back button. While the drawer is open it is
 * the only thing screen readers reach.
 */
function TabletShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const pane = useNavPane();
  const mode = pane?.mode ?? 'beside';
  const drawer = mode === 'drawer';
  const close = pane?.close;

  useEffect(() => {
    if (!drawer || !close) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [drawer, close]);

  const hidden = {
    accessibilityElementsHidden: drawer,
    importantForAccessibility: drawer ? ('no-hide-descendants' as const) : ('auto' as const),
  };
  return (
    <View className="flex-1 flex-row bg-background">
      {mode === 'beside' ? (
        <NavList expanded />
      ) : (
        <View {...hidden}>
          <NavList expanded={false} />
        </View>
      )}
      <View className="flex-1" {...hidden}>
        {children}
      </View>
      {drawer ? (
        <NativeOnlyAnimatedView
          entering={FadeIn.duration(150).reduceMotion(ReduceMotion.System)}
          exiting={FadeOut.duration(150).reduceMotion(ReduceMotion.System)}
          className="absolute inset-0 z-10 flex-row"
          accessibilityViewIsModal
        >
          <NativeOnlyAnimatedView
            entering={SlideInLeft.duration(200).reduceMotion(ReduceMotion.System)}
          >
            <NavList expanded onNavigate={close} />
          </NativeOnlyAnimatedView>
          <Pressable
            className="flex-1 bg-foreground/30"
            accessibilityLabel={t('nav.closeMenu')}
            role="button"
            onPress={close}
          />
        </NativeOnlyAnimatedView>
      ) : null}
    </View>
  );
}

/** The navigation items, with their labels (pane, drawer) or icons only (rail). */
function NavList({ expanded, onNavigate }: { expanded: boolean; onNavigate?: () => void }) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const abilities = useAbilities();
  return (
    <View
      className={cn(
        'pb-safe pt-safe h-full gap-1 border-r border-border bg-card',
        expanded ? 'w-72 px-3' : 'w-16 items-center px-2',
      )}
      role="navigation"
    >
      <View className={cn('flex-row items-center gap-3 py-6', expanded && 'px-3')}>
        <BrandMark className={expanded ? 'h-10 w-10' : 'h-8 w-8'} />
        {expanded ? <Text variant="large">{t('common.appName')}</Text> : null}
      </View>
      <View className={cn('mb-2 rounded-md border border-border', !expanded && 'self-center')}>
        <ConnectionIndicator variant={expanded ? 'full' : 'rail'} />
      </View>
      {NAV.filter((item) => !item.visible || item.visible(abilities)).map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Pressable
            key={item.href}
            role="link"
            accessibilityLabel={t(item.label)}
            accessibilityState={{ selected: active }}
            onPress={() => {
              onNavigate?.();
              router.replace(item.href);
            }}
            className={cn(
              'min-h-12 flex-row items-center rounded-md active:bg-accent',
              expanded ? 'gap-3 px-3' : 'w-12 justify-center',
              active && 'bg-accent',
            )}
          >
            <Icon
              as={item.icon}
              size={20}
              className={active ? 'text-accent-foreground' : 'text-muted-foreground'}
            />
            {expanded ? (
              <Text className={cn(active && 'font-semibold text-accent-foreground')}>
                {t(item.label)}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
