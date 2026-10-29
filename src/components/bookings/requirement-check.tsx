import {
  BadgeCheckIcon,
  CircleAlertIcon,
  CloudOffIcon,
  ShieldAlertIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { RequirementView } from '@/features/bookings/detail';
import {
  canVerifyRequirement,
  useVerifyRequirement,
  verifyErrorKey,
} from '@/features/bookings/sheet-actions';
import { useOnlineOnly } from '@/features/offline/offline-provider';
import { useAbilities } from '@/features/permissions/use-abilities';
import { usePreferences } from '@/features/preferences/preferences-provider';
import { useEstablishment } from '@/features/session/queries';
import { formatInstant } from '@/lib/datetime';

/**
 * Requirement of the booking's agreement (e.g. residents, spec 30.2.2):
 * checked, or still to check with a "Verificato" button for the roles that
 * write bookings (online only). Shown on the booking sheet and at check-in;
 * it never blocks the check-in, as in the core.
 */
export function RequirementCheck({
  bookingId,
  version,
  requirement,
}: {
  bookingId: string;
  version: number;
  requirement: RequirementView;
}) {
  const { t } = useTranslation();
  const { locale } = usePreferences();
  const timeZone = useEstablishment().data?.timezone;
  const abilities = useAbilities();
  const { available: online } = useOnlineOnly();
  const verify = useVerifyRequirement();
  const v = requirement.verified;

  if (v) {
    const when = formatInstant(v.at, locale, timeZone);
    const done = v.by
      ? t('bookings.agreement.verifiedBy', { when, name: v.by })
      : t('bookings.agreement.verifiedAt', { when });
    return (
      <View
        className="flex-row items-start gap-2"
        accessible
        accessibilityLabel={[requirement.text, done, v.note].filter(Boolean).join(', ')}
      >
        <Icon as={BadgeCheckIcon} size={20} className="text-success" />
        <View className="flex-1 gap-0.5">
          <Text className="font-medium">{requirement.text}</Text>
          <Text variant="muted">{done}</Text>
          {v.note ? <Text variant="muted">{v.note}</Text> : null}
        </View>
      </View>
    );
  }

  const allowed = canVerifyRequirement(abilities);
  return (
    <View className="gap-3">
      <Alert icon={ShieldAlertIcon}>
        <AlertTitle>{t('bookings.agreement.toVerify')}</AlertTitle>
        <AlertDescription>{requirement.text}</AlertDescription>
      </Alert>
      {allowed ? (
        <Button
          size="lg"
          variant="outline"
          disabled={!online || verify.isPending}
          accessibilityHint={t('bookings.agreement.verifyHint')}
          onPress={() => verify.mutate({ bookingId, version })}
        >
          <Icon as={BadgeCheckIcon} size={18} />
          <Text>{t('bookings.agreement.verify')}</Text>
        </Button>
      ) : null}
      {allowed && !online ? (
        <View className="flex-row items-center gap-2" accessibilityLiveRegion="polite">
          <Icon as={CloudOffIcon} size={16} className="text-muted-foreground" />
          <Text variant="muted" className="flex-1">
            {t('bookings.agreement.onlineOnly')}
          </Text>
        </View>
      ) : null}
      {verify.error ? (
        <Alert icon={CircleAlertIcon} variant="destructive" accessibilityLiveRegion="assertive">
          <AlertDescription>{t(verifyErrorKey(verify.error))}</AlertDescription>
        </Alert>
      ) : null}
    </View>
  );
}
