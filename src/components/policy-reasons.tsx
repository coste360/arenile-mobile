import { useTranslation } from 'react-i18next';

import { AlertDescription } from '@/components/ui/alert';
import { policyViolationKeys } from '@/features/booking-actions/errors';

/** The booking rules a refusal broke (422 policy_violation), one sentence per line, inside an Alert. */
export function PolicyReasons({ error }: { error: unknown }) {
  const { t } = useTranslation();
  return policyViolationKeys(error).map((key) => (
    <AlertDescription key={key}>{t(key)}</AlertDescription>
  ));
}
