import { MinusIcon, PlusIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

/**
 * Quantity of one extra (0 … max) with − and + buttons of 44 pt. Announced
 * as an adjustable value, so screen readers can change it by swiping.
 */
export function ExtraStepper({
  name,
  quantity,
  max,
  onChange,
}: {
  name: string;
  quantity: number;
  max: number;
  onChange: (quantity: number) => void;
}) {
  const { t } = useTranslation();
  const dec = () => onChange(Math.max(0, quantity - 1));
  const inc = () => onChange(Math.min(max, quantity + 1));
  return (
    <View
      className="min-h-11 flex-row items-center gap-3"
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={name}
      accessibilityValue={{ min: 0, max, now: quantity, text: String(quantity) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'increment' ? inc() : dec())}
    >
      <Text className="flex-1">{name}</Text>
      <Button
        variant="outline"
        size="icon"
        className="h-11 w-11"
        disabled={quantity <= 0}
        accessibilityLabel={t('sale.extraLess', { name })}
        onPress={dec}
      >
        <Icon as={MinusIcon} size={18} />
      </Button>
      <Text className="w-6 text-center tabular-nums">{quantity}</Text>
      <Button
        variant="outline"
        size="icon"
        className="h-11 w-11"
        disabled={quantity >= max}
        accessibilityLabel={t('sale.extraMore', { name })}
        onPress={inc}
      >
        <Icon as={PlusIcon} size={18} />
      </Button>
    </View>
  );
}
