import { router, type Href } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import { useEffect, type ReactNode } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import { StateView } from '@/components/state-view';
import { cn } from '@/lib/utils';

import { useContentWidth } from './nav-pane';
import { detailFitsBeside } from './panes';
import { useDeviceLayout } from './use-device-layout';

/** What a list shows: still loading, rows, rows filtered out, or nothing (empty day, error). */
export type ListState = 'loading' | 'items' | 'noMatch' | 'empty';

/**
 * Whether a list screen shows its detail beside the list (tablet with room
 * for both) or behaves as on phones (a row pushes the detail route).
 */
export function useSplitView(): boolean {
  const layout = useDeviceLayout();
  const content = useContentWidth();
  return layout === 'tablet' && detailFitsBeside(content);
}

/**
 * List and detail side by side (tablets, `useSplitView()`): the list pane of
 * LIST_PANE (w-80), one divider, the detail region. Without a selection the
 * detail shows `placeholder` when there are rows to choose; while loading or
 * with a search or filter matching nothing it stays blank, and with
 * nothing at all (empty day, error) the list takes the whole width, so its
 * own state is the only one on screen. Typing never resizes the panes.
 */
export function MasterDetail({
  list,
  detail,
  listState,
  detailLabel,
  placeholder,
}: {
  list: ReactNode;
  /** The selected item's view, or null without a selection. */
  detail: ReactNode | null;
  listState: ListState;
  /** Accessible name of the detail region. */
  detailLabel: string;
  placeholder: { icon: LucideIcon; title: string; description?: string };
}) {
  const showDetail = detail !== null || listState !== 'empty';
  return (
    <View className="flex-1 flex-row bg-background">
      <View className={cn(showDetail ? 'w-80 border-r border-border' : 'flex-1')}>{list}</View>
      {showDetail ? (
        <View className="flex-1" role="region" accessibilityLabel={detailLabel}>
          {detail ??
            (listState === 'items' ? (
              <StateView
                icon={placeholder.icon}
                title={placeholder.title}
                description={placeholder.description}
              />
            ) : null)}
        </View>
      ) : null}
    </View>
  );
}

/** Scrolling body of a detail beside its list: the readable column of `Screen`. */
export function DetailScroll({
  children,
  refreshing = false,
  onRefresh,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="grow px-6 pt-6 pb-safe"
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined
      }
    >
      <View className="w-full max-w-2xl gap-4 self-center pb-6">{children}</View>
    </ScrollView>
  );
}

/**
 * Rendered by a detail route (`[id]`) when the split fits: goes back to the
 * list already in the stack, with the item selected, instead of stacking a
 * second list (after a rotation the back gesture would show a stale one);
 * opened directly (a link), there is no list to go back to and it replaces.
 */
export function ToSplit({ href }: { href: Href }) {
  useEffect(() => {
    router.dismissTo(href);
  }, [href]);
  return null;
}
