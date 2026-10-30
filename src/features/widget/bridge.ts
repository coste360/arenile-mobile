// Side effect of publishing the widget, injected through Dependencies so that
// screens and tests never touch the native module. The production bridge
// writes to the app group (iOS) / shared preferences (Android) through
// expo-widgets; nothing leaves the device.
import { requireOptionalNativeModule } from 'expo';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import { errorKind } from '@/lib/log';
import type { DaySummaryWidget } from '@/widgets/day-summary-widget';

import type { WidgetEntry } from './types';

export interface WidgetBridge {
  /** Replaces what the home screen widget shows (entries in date order). */
  publish(entries: readonly WidgetEntry[]): void;
}

export const noopWidgetBridge: WidgetBridge = { publish: () => {} };

/**
 * Bridge to the DaySummary widget. The widget module is loaded lazily and
 * only on iOS and Android: in Expo Go or on a build without the widget
 * extension the native module is missing, and the app must keep working
 * without a widget. In Expo Go the module is never even looked up: its
 * native check is not reliable there and a failed load is a red screen in
 * development. iOS gets the timeline (now, then "yesterday's data" at
 * midnight); Android, which has no timelines, the current entry.
 */
export function createExpoWidgetBridge(
  load: () => DaySummaryWidget | null = loadDaySummaryWidget,
  os: string = Platform.OS,
  expoGo: boolean = Constants.executionEnvironment === ExecutionEnvironment.StoreClient,
): WidgetBridge {
  if (expoGo || (os !== 'ios' && os !== 'android')) return noopWidgetBridge;
  let widget: DaySummaryWidget | null | undefined;
  const get = () => {
    if (widget === undefined) {
      try {
        widget = load();
      } catch (e) {
        console.warn('widget: not available on this build', errorKind(e));
        widget = null;
      }
    }
    return widget;
  };
  return {
    publish(entries) {
      const first = entries[0];
      const w = get();
      if (!w || !first) return;
      try {
        if (os === 'ios') w.updateTimeline(entries.map((e) => ({ date: e.date, props: e.props })));
        else w.updateSnapshot(first.props);
      } catch (e) {
        console.warn('widget: update failed', errorKind(e));
      }
    },
  };
}

/**
 * Loads the widget module only when its native module is in the build. In
 * development Metro reports a module that throws while loading as a fatal
 * error (red screen in Expo Go) even inside a try/catch, so the check comes
 * before the require.
 */
export function loadDaySummaryWidget(
  hasNativeModule: () => boolean = () => requireOptionalNativeModule('ExpoWidgets') != null,
  requireWidget: () => DaySummaryWidget | null = requireDaySummaryWidget,
): DaySummaryWidget | null {
  return hasNativeModule() ? requireWidget() : null;
}

function requireDaySummaryWidget(): DaySummaryWidget | null {
  // Lazy on purpose (see above): a static import would load the native module at start.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@/widgets/day-summary-widget') as { default: DaySummaryWidget | null };
  return mod.default;
}
