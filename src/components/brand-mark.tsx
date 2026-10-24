import { useColorScheme } from 'nativewind';
import { Image } from 'react-native';

import { cn } from '@/lib/utils';

// Official Arenile symbol (core assets/brand, ADR 0018 of the core; not
// covered by the code licence, see assets/brand/NOTICE.md): navy "A" on light
// surfaces, sand "A" on dark ones.
const SYMBOL = {
  light: require('@/assets/brand/symbol-light.png'),
  dark: require('@/assets/brand/symbol-dark.png'),
};

export function BrandMark({ className }: { className?: string }) {
  const { colorScheme } = useColorScheme();
  return (
    <Image
      source={colorScheme === 'dark' ? SYMBOL.dark : SYMBOL.light}
      className={cn('h-20 w-20', className)}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
      accessible={false}
    />
  );
}
