import { ChevronRightIcon, CircleAlertIcon, ListXIcon, RefreshCwIcon } from 'lucide-react-native';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';

import type { WaitlistEntry } from '@/api/types';
import { ChipRow, FilterChip } from '@/components/filter-chip';
import type { ListState } from '@/components/layout/master-detail';
import { SearchField } from '@/components/search-field';
import { StateView } from '@/components/state-view';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { usePacks } from '@/features/daily-sale/queries';
import { usePreferences } from '@/features/preferences/preferences-provider';
import {
  compatibleWith,
  statusOfView,
  useWaitlist,
  useWaitlistSettings,
  waitlistErrorKey,
  WAITLIST_VIEWS,
  type FreedSpot,
  type WaitlistView,
} from '@/features/waitlist/waitlist';
import { formatDayLabel } from '@/lib/calendar';
import { localizedText } from '@/lib/i18n-text';
import { cn } from '@/lib/utils';

import { WaitlistStatusBadge } from './waitlist-badges';

/**
 * The waitlist in priority order (spec 03, panel "Lista d'attesa"): queue,
 * open offers or every entry, search by customer. Opened for a freed spot,
 * it first shows the compatible requests. Online only (not cached).
 */
export function WaitlistList({
  spot,
  selectedId,
  onSelect,
  onListState,
}: {
  spot?: FreedSpot;
  selectedId?: string;
  onSelect: (entry: WaitlistEntry) => void;
  /** What the list shows, for the detail beside it (MasterDetail). */
  onListState?: (state: ListState) => void;
}) {
  const { t } = useTranslation();
  const { locale } = usePreferences();
  const [view, setView] = useState<WaitlistView>('waiting');
  const [onlyCompatible, setOnlyCompatible] = useState(!!spot);
  const [search, setSearch] = useState('');
  const query = useWaitlist({ status: statusOfView(view), q: search }, true);
  const settings = useWaitlistSettings(true);
  const packs = usePacks();
  const packName = (id: string) => {
    const p = packs.data?.find((x) => x.id === id);
    return p ? localizedText(p.name, locale) : undefined;
  };
  const entries = query.data ?? [];
  const shown = spot && onlyCompatible ? compatibleWith(entries, spot, spot.date) : entries;

  const narrowed = !!search.trim() || view !== 'waiting' || (!!spot && onlyCompatible);
  const listState: ListState = query.data
    ? shown.length > 0
      ? 'items'
      : narrowed
        ? 'noMatch'
        : 'empty'
    : query.isError
      ? 'empty'
      : 'loading';
  useEffect(() => onListState?.(listState), [listState, onListState]);

  const header = (
    <View className="gap-3 border-b border-border px-4 pb-3 pt-4">
      {settings.data && !settings.data.enabled ? (
        <Alert icon={CircleAlertIcon}>
          <AlertTitle>{t('waitlist.disabled.title')}</AlertTitle>
          <AlertDescription>{t('waitlist.disabled.description')}</AlertDescription>
        </Alert>
      ) : null}
      {spot ? (
        <Text className="font-semibold">
          {t('waitlist.freed', { label: spot.label, day: formatDayLabel(spot.date, locale) })}
        </Text>
      ) : null}
      <SearchField
        value={search}
        onChangeText={setSearch}
        label={t('waitlist.search')}
        placeholder={t('waitlist.searchPlaceholder')}
      />
      {spot ? (
        <ChipRow bleed label={t('waitlist.scope')}>
          <FilterChip
            label={t('waitlist.compatible')}
            selected={onlyCompatible}
            onPress={() => setOnlyCompatible(true)}
          />
          <FilterChip
            label={t('waitlist.everyone')}
            selected={!onlyCompatible}
            onPress={() => setOnlyCompatible(false)}
          />
        </ChipRow>
      ) : null}
      {!spot || !onlyCompatible ? (
        <ChipRow bleed label={t('waitlist.filter')}>
          {WAITLIST_VIEWS.map((v) => (
            <FilterChip
              key={v}
              label={t(`waitlist.views.${v}`)}
              selected={view === v}
              onPress={() => setView(v)}
            />
          ))}
        </ChipRow>
      ) : null}
      {query.data ? (
        <Text variant="muted" accessibilityLiveRegion="polite">
          {t('waitlist.results', { count: shown.length })}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View className="flex-1 bg-background">
      {header}
      {query.isError && !query.data ? (
        <StateView
          align="top"
          icon={CircleAlertIcon}
          tone="destructive"
          title={t(waitlistErrorKey(query.error))}
        >
          <Button variant="outline" onPress={() => void query.refetch()}>
            <Icon as={RefreshCwIcon} size={16} />
            <Text>{t('common.retry')}</Text>
          </Button>
        </StateView>
      ) : (
        <FlatList
          className="flex-1"
          data={shown}
          keyExtractor={(e) => e.id}
          contentContainerClassName="grow pb-safe"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => void query.refetch()}
            />
          }
          ListEmptyComponent={
            query.isPending ? (
              <StateView align="top" busy title={t('common.loading')} />
            ) : (
              <StateView
                align="top"
                icon={ListXIcon}
                title={t(spot && onlyCompatible ? 'waitlist.emptyCompatible' : 'waitlist.empty')}
              />
            )
          }
          renderItem={({ item }) => (
            <WaitlistRow
              entry={item}
              pack={packName(item.pack_id)}
              selected={item.id === selectedId}
              onPress={onSelect}
            />
          )}
        />
      )}
    </View>
  );
}

const WaitlistRow = memo(function WaitlistRow({
  entry: e,
  pack,
  selected,
  onPress,
}: {
  entry: WaitlistEntry;
  pack?: string;
  selected: boolean;
  onPress: (entry: WaitlistEntry) => void;
}) {
  const { t } = useTranslation();
  const { locale } = usePreferences();
  const period =
    e.starts_on === e.ends_on
      ? formatDayLabel(e.starts_on, locale)
      : t('bookings.stay', {
          from: formatDayLabel(e.starts_on, locale),
          to: formatDayLabel(e.ends_on, locale),
        });
  const request = [
    period,
    t(`dayMap.slot.${e.slots}`),
    pack,
    e.quantity > 1 ? `×${e.quantity}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const position = e.status === 'waiting' ? t('waitlist.position', { position: e.position }) : null;
  return (
    <Pressable
      role="button"
      accessibilityState={{ selected }}
      accessibilityLabel={[
        position,
        e.customer_display_name,
        request,
        t(`waitlist.status.${e.status}`),
      ]
        .filter(Boolean)
        .join(', ')}
      onPress={() => onPress(e)}
      className={cn(
        'min-h-16 flex-row items-center gap-3 border-b border-border px-4 py-3 active:bg-accent',
        selected && 'bg-accent',
      )}
    >
      {position ? (
        <Text className="w-10 text-center font-semibold tabular-nums" numberOfLines={1}>
          {position}
        </Text>
      ) : (
        <View className="w-10" />
      )}
      <View className="flex-1 gap-1">
        <Text className="font-semibold" numberOfLines={1}>
          {e.customer_display_name}
        </Text>
        <Text variant="muted" numberOfLines={2}>
          {request}
        </Text>
        <View className="flex-row flex-wrap gap-1">
          <WaitlistStatusBadge status={e.status} />
        </View>
      </View>
      <Icon as={ChevronRightIcon} size={18} className="text-muted-foreground" />
    </Pressable>
  );
});
