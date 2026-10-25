import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { ComparisonAlign } from '@/api/types';
import { REPORT_RANGES, type ReportPeriod, type ReportRange } from '@/features/reports/period';
import { formatDayLabel } from '@/lib/calendar';

const ALIGNS: readonly ComparisonAlign[] = ['calendar', 'weekday'];

/** A row of mutually exclusive choices, announced as a radio group. */
function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
  optionLabel,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  optionLabel: (value: T) => string;
}) {
  return (
    <View className="gap-2">
      <Text variant="muted">{label}</Text>
      <View className="flex-row flex-wrap gap-2" role="radiogroup" accessibilityLabel={label}>
        {options.map((option) => {
          const selected = option === value;
          return (
            <Button
              key={option}
              variant={selected ? 'default' : 'outline'}
              role="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(option)}
            >
              <Text>{optionLabel(option)}</Text>
            </Button>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Period of the reports: day or week, previous / next (never past the
 * current one) and the alignment of the previous year (same date or same
 * weekday, like the panel).
 */
export function PeriodPicker({
  range,
  onRangeChange,
  period,
  current,
  canGoForward,
  onShift,
  align,
  onAlignChange,
  locale,
}: {
  range: ReportRange;
  onRangeChange: (range: ReportRange) => void;
  period: ReportPeriod;
  current: boolean;
  canGoForward: boolean;
  onShift: (direction: -1 | 1) => void;
  align: ComparisonAlign;
  onAlignChange: (align: ComparisonAlign) => void;
  locale: string;
}) {
  const { t } = useTranslation();
  const from = formatDayLabel(period.from, locale);
  const label =
    range === 'day'
      ? from
      : t('reports.periodLabel.week', { from, to: formatDayLabel(period.to, locale) });
  const badge = current ? t(range === 'day' ? 'reports.today' : 'reports.thisWeek') : null;

  return (
    <View className="gap-4">
      <Choice
        label={t('reports.range.label')}
        options={REPORT_RANGES}
        value={range}
        onChange={onRangeChange}
        optionLabel={(r) => t(`reports.range.${r}`)}
      />
      <View className="flex-row items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          accessibilityLabel={t(`reports.previous.${range}`)}
          onPress={() => onShift(-1)}
        >
          <Icon as={ChevronLeftIcon} size={20} />
        </Button>
        <View className="flex-1 items-center" accessible accessibilityLiveRegion="polite">
          <Text className="text-center font-semibold" role="heading">
            {label}
          </Text>
          {badge ? <Text variant="muted">{badge}</Text> : null}
        </View>
        <Button
          variant="outline"
          size="icon"
          accessibilityLabel={t(`reports.next.${range}`)}
          disabled={!canGoForward}
          accessibilityState={{ disabled: !canGoForward }}
          onPress={() => onShift(1)}
        >
          <Icon as={ChevronRightIcon} size={20} />
        </Button>
      </View>
      <Choice
        label={t('reports.align.label')}
        options={ALIGNS}
        value={align}
        onChange={onAlignChange}
        optionLabel={(a) => t(`reports.align.${a}`)}
      />
    </View>
  );
}
