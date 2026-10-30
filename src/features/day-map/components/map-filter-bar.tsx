import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { FilterChip } from '@/components/filter-chip';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';

import { CAPTION_PARTS, type CaptionPart } from '../model';
import { sameFilter, type FilterOption, type QuickFilter } from '../quick-filters';

/**
 * One scrolling row under the day toolbar (spec 30.4): the quick filters
 * (arrivals, departures, to collect, present, each agreement and group of
 * the day; one at a time, pressed again to clear) and the caption parts
 * drawn under the taken spots (customer, end of stay, setup; any
 * combination). Two groups for screen readers, one row on screen so the map
 * keeps its room on phones.
 */
export function MapFilterBar({
  options,
  filter,
  onFilter,
  parts,
  onParts,
}: {
  options: readonly FilterOption[];
  filter: QuickFilter | null;
  onFilter: (filter: QuickFilter | null) => void;
  parts: readonly CaptionPart[];
  onParts: (parts: CaptionPart[]) => void;
}) {
  const { t } = useTranslation();
  const nameOf = (o: FilterOption) => {
    switch (o.filter.kind) {
      case 'agreement':
        return { label: o.name ?? '', a11y: t('mapFilters.agreement', { name: o.name }) };
      case 'group':
        return { label: o.name ?? '', a11y: t('mapFilters.group', { name: o.name }) };
      default: {
        const label = t(`mapFilters.${o.filter.kind}`);
        return { label, a11y: label };
      }
    }
  };
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="-mx-4"
      contentContainerClassName="items-center gap-2 px-4"
      keyboardShouldPersistTaps="handled"
      testID="map-filter-bar"
    >
      <View
        className="flex-row items-center gap-2"
        role="group"
        accessibilityLabel={t('mapFilters.label')}
      >
        <Text variant="muted">{t('mapFilters.label')}</Text>
        {options.map((o) => {
          const { label, a11y } = nameOf(o);
          const selected = sameFilter(filter, o.filter);
          return (
            <FilterChip
              key={`${o.filter.kind}:${o.filter.value ?? ''}`}
              label={label}
              count={o.count}
              accessibilityLabel={t('mapFilters.chip', { label: a11y, count: o.count })}
              selected={selected}
              onPress={() => onFilter(selected ? null : o.filter)}
            />
          );
        })}
      </View>
      <Separator orientation="vertical" className="mx-1 h-8" />
      <View
        className="flex-row items-center gap-2"
        role="group"
        accessibilityLabel={t('mapFilters.labels')}
      >
        <Text variant="muted">{t('mapFilters.labels')}</Text>
        {CAPTION_PARTS.map((p) => {
          const selected = parts.includes(p);
          const label = t(`mapFilters.${p}`);
          return (
            <FilterChip
              key={p}
              label={label}
              accessibilityLabel={t('mapFilters.labelChip', { label })}
              selected={selected}
              onPress={() => onParts(selected ? parts.filter((x) => x !== p) : [...parts, p])}
            />
          );
        })}
      </View>
    </ScrollView>
  );
}
