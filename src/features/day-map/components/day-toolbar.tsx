import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import type { Slots } from '@/api/types';
import { formatDayLabel, type CalendarDate } from '@/lib/calendar';
import { cn } from '@/lib/utils';

export interface Choice<T extends string> {
  value: T;
  label: string;
  /** Extra text for screen readers (e.g. the full date). */
  hint?: string;
}

/** A row of mutually exclusive buttons (radio group): day, slot, map. */
export function ChoiceGroup<T extends string>({
  label,
  choices,
  value,
  onChange,
  scroll = false,
}: {
  label: string;
  choices: readonly Choice<T>[];
  value: T;
  onChange: (value: T) => void;
  scroll?: boolean;
}) {
  const buttons = choices.map((c) => {
    const selected = c.value === value;
    return (
      <Button
        key={c.value}
        size="sm"
        variant={selected ? 'default' : 'outline'}
        className="min-h-11 px-3"
        role="radio"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={c.hint ? `${c.label}, ${c.hint}` : c.label}
        onPress={() => onChange(c.value)}
      >
        <Text>{c.label}</Text>
      </Button>
    );
  });
  return (
    <View role="radiogroup" accessibilityLabel={label}>
      {scroll ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2"
        >
          {buttons}
        </ScrollView>
      ) : (
        <View className="flex-row flex-wrap gap-2">{buttons}</View>
      )}
    </View>
  );
}

export type DayChoice = 'today' | 'tomorrow';

/**
 * Day and slot of the map. Only today and tomorrow: the offline window of
 * the app (spec 21.2); other days stay in the panel.
 */
export function DayToolbar({
  day,
  onDay,
  dates,
  slot,
  onSlot,
  locale,
  className,
}: {
  day: DayChoice;
  onDay: (d: DayChoice) => void;
  dates: { today: CalendarDate; tomorrow: CalendarDate };
  slot: Slots;
  onSlot: (s: Slots) => void;
  locale: string;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <View className={cn('flex-row flex-wrap items-center gap-x-4 gap-y-2', className)}>
      <ChoiceGroup<DayChoice>
        label={t('dayMap.day.label')}
        value={day}
        onChange={onDay}
        choices={[
          {
            value: 'today',
            label: t('dayMap.day.today'),
            hint: formatDayLabel(dates.today, locale),
          },
          {
            value: 'tomorrow',
            label: t('dayMap.day.tomorrow'),
            hint: formatDayLabel(dates.tomorrow, locale),
          },
        ]}
      />
      <ChoiceGroup<Slots>
        label={t('dayMap.slot.label')}
        value={slot}
        onChange={onSlot}
        choices={(['FULL', 'AM', 'PM'] as const).map((s) => ({
          value: s,
          label: t(`dayMap.slot.${s}`),
        }))}
      />
    </View>
  );
}
