import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { FormField } from '@/components/form-field';
import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { manualPairingSchema, type ManualPairingValues } from '@/features/pairing/manual-form';
import { usePairingIntent } from '@/features/pairing/pairing-intent';
import { targetFromManual } from '@/features/pairing/target';

/** Pairing by hand: instance address + pairing code shown by the panel. */
export default function ManualScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ url?: string }>();
  const intent = usePairingIntent();
  const { control, handleSubmit, formState } = useForm<ManualPairingValues>({
    resolver: zodResolver(manualPairingSchema),
    defaultValues: { url: params.url ?? '', code: '' },
    mode: 'onTouched',
  });

  const onSubmit = () =>
    void handleSubmit((values) => {
      intent.set(targetFromManual(values.url, values.code));
      router.replace('/pair');
    })();

  return (
    <Screen className="max-w-lg self-center">
      <Text className="text-muted-foreground">{t('manual.description')}</Text>
      <FormField
        control={control}
        name="url"
        label={t('manual.url.label')}
        placeholder={t('manual.url.placeholder')}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="url"
        keyboardType="url"
        textContentType="URL"
        returnKeyType="next"
      />
      <FormField
        control={control}
        name="code"
        label={t('manual.code.label')}
        hint={t('manual.code.hint')}
        placeholder={t('manual.code.placeholder')}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        returnKeyType="go"
        onSubmitEditing={onSubmit}
      />
      <Button size="lg" onPress={onSubmit} disabled={formState.isSubmitting}>
        <Text>{t('manual.submit')}</Text>
      </Button>
    </Screen>
  );
}
