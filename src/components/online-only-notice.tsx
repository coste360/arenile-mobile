import { CloudOffIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useOnlineOnly } from '@/features/offline/offline-provider';

/**
 * Shown in place of (or next to the disabled) create/move booking actions
 * while the instance is not reachable (spec 21.2: they need the server's
 * availability guarantees and are never queued). Renders nothing online.
 */
export function OnlineOnlyNotice() {
  const { t } = useTranslation();
  const { available } = useOnlineOnly();
  if (available) return null;
  return (
    <Alert icon={CloudOffIcon} accessibilityLiveRegion="polite">
      <AlertTitle>{t('offline.onlineOnly.title')}</AlertTitle>
      <AlertDescription>{t('offline.onlineOnly.description')}</AlertDescription>
    </Alert>
  );
}
