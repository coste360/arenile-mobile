import {
  CircleAlertIcon,
  CircleCheckIcon,
  ClockIcon,
  RefreshCwIcon,
  SendIcon,
  Trash2Icon,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Screen } from '@/components/layout/screen';
import { StateView } from '@/components/state-view';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { operationErrorKey } from '@/features/offline/labels';
import { useOfflineQueue, useOfflineStatus } from '@/features/offline/offline-provider';
import type { OfflineOperation, QueuedStatus } from '@/features/offline/types';
import { usePreferences } from '@/features/preferences/preferences-provider';
import { formatDayLabel } from '@/lib/calendar';
import { formatCents } from '@/lib/money';

const STATUS_ICON: Record<QueuedStatus, LucideIcon> = {
  pending: ClockIcon,
  sending: RefreshCwIcon,
  conflict: CircleAlertIcon,
  failed: CircleAlertIcon,
};

/**
 * Operations recorded offline (spec 21.2): what waits, in send order, and
 * what the instance refused, with the reason (from the problem slug) and the
 * user's choice to retry or delete. Nothing leaves this list silently.
 */
export default function PendingScreen() {
  const { t } = useTranslation();
  const { operations, retry, discard, flush } = useOfflineQueue();
  const status = useOfflineStatus();
  const [discarding, setDiscarding] = useState<OfflineOperation | null>(null);
  const canSend =
    status.pending > 0 &&
    !status.paused &&
    status.connection !== 'offline' &&
    status.connection !== 'syncing';

  if (operations.length === 0) {
    return (
      <Screen>
        <StateView
          icon={CircleCheckIcon}
          title={t('offline.pending.emptyTitle')}
          description={t('offline.pending.emptyDescription')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text className="text-muted-foreground">{t('offline.pending.description')}</Text>
      {status.paused ? (
        <Alert icon={CircleAlertIcon} variant="destructive">
          <AlertDescription>{t('offline.pending.paused')}</AlertDescription>
        </Alert>
      ) : null}
      {status.pending > 0 ? (
        <Button size="lg" variant="outline" disabled={!canSend} onPress={() => void flush()}>
          <Icon as={SendIcon} size={18} />
          <Text>{t('offline.pending.sendNow')}</Text>
        </Button>
      ) : null}
      <View className="gap-3" role="list">
        {operations.map((op) => (
          <OperationCard
            key={op.id}
            op={op}
            onRetry={() => void retry(op.id)}
            onDiscard={() => setDiscarding(op)}
          />
        ))}
      </View>
      <AlertDialog open={!!discarding} onOpenChange={(open) => !open && setDiscarding(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('offline.pending.discardConfirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('offline.pending.discardConfirm.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Text>{t('common.cancel')}</Text>
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onPress={() => {
                if (discarding) void discard(discarding.id);
                setDiscarding(null);
              }}
            >
              <Text>{t('offline.pending.discardConfirm.confirm')}</Text>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Screen>
  );
}

function OperationCard({
  op,
  onRetry,
  onDiscard,
}: {
  op: OfflineOperation;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  const { t } = useTranslation();
  const { locale } = usePreferences();
  const refused = op.status === 'conflict' || op.status === 'failed';
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(
    new Date(op.createdAt),
  );
  const title = (() => {
    switch (op.kind) {
      case 'check_in':
        return t('offline.pending.kinds.check_in');
      case 'note':
        return t('offline.pending.kinds.note');
      case 'cash_payment':
        return t('offline.pending.kinds.cash_payment', { amount: formatCents(op.amount) });
      case 'day_release':
        return t('offline.pending.kinds.day_release', { date: formatDayLabel(op.date, locale) });
    }
  })();

  return (
    <Card role="listitem" testID={`pending-${op.id}`}>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1">
          <CardTitle>{title}</CardTitle>
          <Text variant="muted">{op.label}</Text>
        </View>
        <View className="flex-row items-center gap-1" accessible>
          <Icon
            as={STATUS_ICON[op.status]}
            size={16}
            className={refused ? 'text-destructive' : 'text-muted-foreground'}
          />
          <Text className={refused ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
            {t(`offline.pending.status.${op.status}`)}
          </Text>
        </View>
      </CardHeader>
      <CardContent className="gap-3">
        <Text variant="muted">{t('offline.pending.queuedAt', { time })}</Text>
        {refused && op.error ? (
          <Text className="text-destructive" accessibilityLiveRegion="polite">
            {t(operationErrorKey(op.error))}
          </Text>
        ) : null}
        {refused ? (
          <View className="flex-row flex-wrap gap-2">
            {op.error?.type !== 'other_establishment' ? (
              <Button variant="outline" onPress={onRetry}>
                <Icon as={RefreshCwIcon} size={16} />
                <Text>{t('offline.pending.retry')}</Text>
              </Button>
            ) : null}
            <Button variant="ghost" onPress={onDiscard}>
              <Icon as={Trash2Icon} size={16} className="text-destructive" />
              <Text className="text-destructive">{t('offline.pending.discard')}</Text>
            </Button>
          </View>
        ) : null}
      </CardContent>
    </Card>
  );
}
