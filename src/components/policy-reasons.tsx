import { useTranslation } from 'react-i18next';

import { AlertDescription } from '@/components/ui/alert';
import { policyViolationKeys, violationKeys } from '@/features/booking-actions/errors';

/**
 * The booking rules broken, one sentence per line, inside an Alert: those of
 * a refusal (422 policy_violation) or those listed by a quote.
 */
export function PolicyReasons({
  error,
  violations,
}: {
  error?: unknown;
  violations?: readonly { code: string }[];
}) {
  const { t } = useTranslation();
  const keys = violations ? violationKeys(violations) : policyViolationKeys(error);
  return keys.map((key) => <AlertDescription key={key}>{t(key)}</AlertDescription>);
}
