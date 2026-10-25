import { View } from 'react-native';

import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Text } from '@/components/ui/text';

/** Labelled radio group (one choice among few), each row a 44pt target. */
export function ChoiceGroup<V extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: {
  /** Unique on the screen: prefixes the native ids of the labels. */
  id: string;
  label: string;
  value: V;
  options: readonly { value: V; label: string }[];
  onChange: (value: V) => void;
}) {
  return (
    <View className="gap-1">
      <Text variant="small">{label}</Text>
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as V)}
        accessibilityLabel={label}
        className="gap-0"
      >
        {options.map((o) => (
          <View key={o.value} className="min-h-11 flex-row items-center gap-3">
            <RadioGroupItem value={o.value} aria-labelledby={`${id}-${o.value}`} />
            <Label nativeID={`${id}-${o.value}`} onPress={() => onChange(o.value)}>
              {o.label}
            </Label>
          </View>
        ))}
      </RadioGroup>
    </View>
  );
}
