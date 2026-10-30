import { CalendarOffIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { CalendarDate } from '@/lib/calendar';
import { formatLongDay } from '@/lib/datetime';

/**
 * "Stabilimento chiuso": the same notice on "Oggi" and the day map when the
 * operational day is a closure day or out of season.
 */
export function ClosedDayNotice({
  date,
  days,
  locale,
}: {
  date: CalendarDate;
  days: { today: CalendarDate; tomorrow: CalendarDate };
  locale: string;
}) {
  const { t } = useTranslation();
  const description =
    date === days.today
      ? t('closedDay.today')
      : date === days.tomorrow
        ? t('closedDay.tomorrow')
        : t('closedDay.other', { date: formatLongDay(date, locale) });
  return (
    <Alert icon={CalendarOffIcon}>
      <AlertTitle>{t('closedDay.title')}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  );
}
