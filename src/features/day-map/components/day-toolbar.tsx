import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { DayPicker } from '@/components/day-picker';
import { ChoiceGroup } from '@/components/segmented-choice';
import type { Slots } from '@/api/types';
import type { CalendarDate, DaySelection } from '@/lib/calendar';
import { cn } from '@/lib/utils';

/**
 * Day and slot of the map: today and tomorrow (the offline window) or any
 * other day from the calendar (online only, ADR 0014).
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
  day: DaySelection;
  onDay: (d: DaySelection) => void;
  dates: { today: CalendarDate; tomorrow: CalendarDate };
  slot: Slots;
  onSlot: (s: Slots) => void;
  locale: string;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <View className={cn('flex-row flex-wrap items-center gap-x-3 gap-y-2', className)}>
      <DayPicker value={day} onChange={onDay} days={dates} locale={locale} />
      <ChoiceGroup<Slots>
        segmented
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
