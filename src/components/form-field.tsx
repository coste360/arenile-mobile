import type { ComponentProps } from 'react';
import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

/**
 * Labelled text input bound to react-hook-form. Validation messages are i18n
 * keys (zod schemas next to the form) translated here.
 */
export function FormField<T extends FieldValues>({
  control,
  name,
  label,
  hint,
  className,
  ...inputProps
}: {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  hint?: string;
} & Omit<ComponentProps<typeof Input>, 'value' | 'onChangeText' | 'onBlur'>) {
  const { t } = useTranslation();
  const { field, fieldState } = useController({ control, name });
  const error = fieldState.error?.message;
  const nativeID = `field-${name}`;
  return (
    <View className="gap-2">
      <Label nativeID={nativeID}>{label}</Label>
      <Input
        {...inputProps}
        value={field.value ?? ''}
        onChangeText={field.onChange}
        onBlur={field.onBlur}
        accessibilityLabelledBy={nativeID}
        accessibilityLabel={label}
        aria-invalid={!!error}
        className={cn(className, error && 'border-destructive')}
      />
      {error ? (
        <Text variant="small" className="text-destructive" accessibilityLiveRegion="polite">
          {/* zod messages are keys of the locale files */}
          {t(error as never)}
        </Text>
      ) : hint ? (
        <Text variant="muted">{hint}</Text>
      ) : null}
    </View>
  );
}
