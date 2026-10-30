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
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatDayLabel, fromPickerDate, toPickerDate, type CalendarDate } from '@/lib/calendar';

/**
 * One calendar date in a form (first and last day of a stay): a button with
 * the date that opens the native calendar, as the day picker does (on iOS
 * inside an AlertDialog without the window overlay, where SwiftUI draws).
 */
export function DateField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  locale,
  disabled,
  testID,
}: {
  label: string;
  value: CalendarDate;
  onChange: (value: CalendarDate) => void;
  minimumDate?: CalendarDate;
  maximumDate?: CalendarDate;
  locale: string;
  disabled?: boolean;
  testID?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { colorScheme } = useColorScheme();

  const picker = (
    <DateTimePicker
      value={toPickerDate(value)}
      mode="date"
      display="inline"
      locale={locale.replace('-', '_')}
      themeVariant={colorScheme === 'dark' ? 'dark' : 'light'}
      minimumDate={minimumDate ? toPickerDate(minimumDate) : undefined}
      maximumDate={maximumDate ? toPickerDate(maximumDate) : undefined}
      onValueChange={(_, picked) => {
        setOpen(false);
        onChange(fromPickerDate(picked));
      }}
      onDismiss={() => setOpen(false)}
      testID={testID ? `${testID}-calendar` : undefined}
    />
  );

  return (
    <View className="flex-1 gap-1">
      <Text variant="small">{label}</Text>
      <Button
        variant="outline"
        size="lg"
        disabled={disabled}
        accessibilityLabel={`${label}, ${formatDayLabel(value, locale)}`}
        accessibilityHint={t('dayPicker.title')}
        onPress={() => {
          Keyboard.dismiss();
          setOpen(true);
        }}
        testID={testID}
        className="justify-start"
      >
        <Icon as={CalendarDaysIcon} size={16} />
        <Text>{formatDayLabel(value, locale)}</Text>
      </Button>
      {open && Platform.OS === 'android' ? picker : null}
      {Platform.OS !== 'android' ? (
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogContent windowOverlay={false}>
            <AlertDialogHeader>
              <AlertDialogTitle>{label}</AlertDialogTitle>
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
