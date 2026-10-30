import { SearchIcon, XIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * The search field of every list and of the map: the magnifier inside the
 * field, so the field starts on the same gutter as the chips under it, and
 * the same clear button on iOS and Android.
 */
export function SearchField({
  value,
  onChangeText,
  label,
  placeholder,
  className,
}: {
  value: string;
  onChangeText: (text: string) => void;
  /** Accessible name (the placeholder disappears while typing). */
  label: string;
  placeholder: string;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <View className={cn('justify-center', className)}>
      <Input
        value={value}
        onChangeText={onChangeText}
        accessibilityLabel={label}
        placeholder={placeholder}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        className="pl-9 pr-11"
      />
      <View className="absolute bottom-0 left-3 top-0 justify-center" pointerEvents="none">
        <Icon as={SearchIcon} size={16} className="text-muted-foreground" />
      </View>
      {value ? (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-0"
          accessibilityLabel={t('common.clearSearch')}
          onPress={() => onChangeText('')}
        >
          <Icon as={XIcon} size={16} className="text-muted-foreground" />
        </Button>
      ) : null}
    </View>
  );
}
