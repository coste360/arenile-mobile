import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { CalendarDaysIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, Platform, View } from 'react-native';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Text } from '@/components/ui/text';
import { ChoiceGroup } from '@/components/segmented-choice';
import {
  addDays,
  formatDayLabel,
  fromPickerDate,
  resolveDay,
  selectionOf,
  toPickerDate,
  type CalendarDate,
  type DaySelection,
} from '@/lib/calendar';

/** How far from today the calendar reaches, both ways (a season and some). */
const RANGE_DAYS = 400;

type Choice = 'today' | 'tomorrow' | 'other';

/**
 * Day of the map and of the bookings list: today and tomorrow one tap away
 * (the offline window, ADR 0007), any other day from the native calendar
 * (ADR 0014; online only). The calendar button shows the chosen date.
 */
export function DayPicker({
  value,
  onChange,
  days,
  locale,
}: {
  value: DaySelection;
  onChange: (value: DaySelection) => void;
  days: { today: CalendarDate; tomorrow: CalendarDate };
  locale: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  // The in-app theme may differ from the system's: the native calendar follows it.
  const { colorScheme } = useColorScheme();
  const date = resolveDay(value, days);
  const choice: Choice = value === 'today' || value === 'tomorrow' ? value : 'other';

  const pick = (picked: Date) => {
    setOpen(false);
    onChange(selectionOf(fromPickerDate(picked), days));
  };
  const picker = (
    <DateTimePicker
      value={toPickerDate(date)}
      mode="date"
      display="inline"
      locale={locale.replace('-', '_')}
      themeVariant={colorScheme === 'dark' ? 'dark' : 'light'}
      minimumDate={toPickerDate(addDays(days.today, -RANGE_DAYS))}
      maximumDate={toPickerDate(addDays(days.today, RANGE_DAYS))}
      onValueChange={(_, picked) => pick(picked)}
      onDismiss={() => setOpen(false)}
      testID="day-picker-calendar"
    />
  );

  return (
    <View>
      <ChoiceGroup<Choice>
        segmented
        label={t('dayPicker.label')}
        value={choice}
        onChange={(c) => {
          if (c === 'other') {
            // A focused search field would keep the keyboard over the calendar.
            Keyboard.dismiss();
            setOpen(true);
          } else onChange(c);
        }}
        choices={[
          {
            value: 'today',
            label: t('dayPicker.today'),
            hint: formatDayLabel(days.today, locale),
          },
          {
            value: 'tomorrow',
            label: t('dayPicker.tomorrow'),
            hint: formatDayLabel(days.tomorrow, locale),
          },
          choice === 'other'
            ? {
                value: 'other',
                label: formatDayLabel(date, locale),
                hint: t('dayPicker.change'),
                actionHint: t('dayPicker.title'),
              }
            : {
                value: 'other',
                label: t('dayPicker.other'),
                icon: CalendarDaysIcon,
                actionHint: t('dayPicker.title'),
              },
        ]}
      />
      {open && Platform.OS === 'android' ? picker : null}
      {Platform.OS !== 'android' ? (
        <AlertDialog open={open} onOpenChange={setOpen}>
          {/* SwiftUI views do not draw inside FullWindowOverlay: the calendar would be blank. */}
          <AlertDialogContent windowOverlay={false}>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('dayPicker.title')}</AlertDialogTitle>
            </AlertDialogHeader>
            {picker}
            <AlertDialogFooter>
              <AlertDialogCancel>
                <Text>{t('common.cancel')}</Text>
              </AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </View>
  );
}
