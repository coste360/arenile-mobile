import { ChevronRightIcon, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

/**
 * One figure of "Oggi": a number with its label (and an optional detail
 * such as an amount); the whole card is a button that opens the filtered list.
 */
export function FigureCard({
  icon,
  label,
  value,
  detail,
  onPress,
  testID,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail?: string;
  onPress: () => void;
  testID?: string;
}) {
  const { t } = useTranslation();
  const spoken = t('today.figureLabel', { label, value });
  return (
    <Pressable
      role="button"
      accessibilityLabel={detail ? `${spoken}, ${detail}` : spoken}
      accessibilityHint={t('today.figureHint')}
      onPress={onPress}
      testID={testID}
      className="min-h-28 flex-1 gap-2 rounded-xl border border-border bg-card p-4 active:bg-accent"
    >
      <View className="flex-row items-center justify-between">
        <Icon as={icon} size={20} className="text-primary" />
        <Icon as={ChevronRightIcon} size={18} className="text-muted-foreground" />
      </View>
      <Text className="text-3xl font-semibold text-card-foreground">{value}</Text>
      <Text className="text-sm font-medium text-card-foreground">{label}</Text>
      {detail ? <Text variant="muted">{detail}</Text> : null}
    </Pressable>
  );
}
