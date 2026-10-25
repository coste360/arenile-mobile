import {
  CircleAlertIcon,
  CircleCheckIcon,
  CloudOffIcon,
  LoaderIcon,
  PrinterIcon,
  RotateCcwIcon,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useOnlineOnly } from '@/features/offline/offline-provider';
import { useAbilities } from '@/features/permissions/use-abilities';
import {
  printErrorKey,
  printPhase,
  unreadyReasonKey,
  usePrintJob,
  usePrintTicket,
  useRetryPrintJob,
  useTicketPrintRoute,
  type PrintErrorKey,
} from '@/features/printing/printing';

/**
 * "Stampa il biglietto" (spec 03): asks the instance to print the ticket on
 * the ESC/POS printer routed in the panel and follows the job. Shown only to
 * roles with cash.operate; when no printer is ready it says why instead of
 * offering the button (the panel prints from the browser).
 */
export function TicketPrint(props: TicketPrintProps) {
  const abilities = useAbilities();
  if (!abilities.canCollectCash) return null;
  return <TicketPrintInner {...props} />;
}

interface TicketPrintProps {
  ticketId: string;
  ticketLabel: string;
  /** Print once as soon as a printer is ready (the panel's "stampa automatica"). */
  autoPrint?: boolean;
}

function TicketPrintInner({ ticketId, ticketLabel, autoPrint = false }: TicketPrintProps) {
  const { t } = useTranslation();
  const { available: online } = useOnlineOnly();
  const { route, registerId } = useTicketPrintRoute(online);
  const print = usePrintTicket(registerId);
  const retry = useRetryPrintJob();
  const [jobId, setJobId] = useState<string>();
  const [error, setError] = useState<PrintErrorKey | null>(null);
  const job = usePrintJob(jobId);
  const autoSent = useRef(false);
  const ready = !!route.data && !unreadyReasonKey(route.data);

  const send = async () => {
    setError(null);
    try {
      setJobId((await print.mutateAsync(ticketId)).id);
    } catch (e) {
      setError(printErrorKey(e));
    }
  };

  useEffect(() => {
    if (!autoPrint || !ready || autoSent.current) return;
    autoSent.current = true;
    void send();
    // `send` changes on every render; the ref makes this run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPrint, ready]);

  if (!online) {
    return (
      <Status icon={CloudOffIcon} text={t('printing.onlineOnly')} testID="ticket-print-offline" />
    );
  }
  if (route.isPending) return null;
  if (route.error || !route.data) {
    return <Status icon={CircleAlertIcon} text={t(printErrorKey(route.error))} />;
  }
  const reason = unreadyReasonKey(route.data);
  if (reason) return <Status icon={PrinterIcon} text={t(reason)} testID="ticket-print-unready" />;

  const printerName = route.data.printer?.name ?? '';
  const phase = job.data ? printPhase(job.data.status) : jobId ? 'sending' : null;
  const busy = print.isPending || retry.isPending || phase === 'sending';

  const again = async () => {
    if (!jobId) return;
    setError(null);
    try {
      await retry.mutateAsync(jobId);
    } catch (e) {
      setError(printErrorKey(e));
    }
  };

  return (
    <View className="gap-2" testID="ticket-print">
      <Button
        size="lg"
        variant="outline"
        disabled={busy}
        accessibilityLabel={t('printing.printOn', { label: ticketLabel, printer: printerName })}
        onPress={() => void send()}
      >
        <Icon as={PrinterIcon} size={18} />
        <Text>{phase === 'printed' ? t('printing.reprint') : t('printing.print')}</Text>
      </Button>
      <Text variant="muted">{t('printing.printer', { printer: printerName })}</Text>
      {error ? <Status icon={CircleAlertIcon} text={t(error)} tone="error" /> : null}
      {!error && phase === 'sending' ? (
        <Status icon={LoaderIcon} text={t('printing.sending', { printer: printerName })} />
      ) : null}
      {!error && phase === 'printed' ? (
        <Status icon={CircleCheckIcon} text={t('printing.printed', { label: ticketLabel })} />
      ) : null}
      {!error && phase === 'failed' ? (
        <View className="gap-2">
          <Status
            icon={CircleAlertIcon}
            tone="error"
            text={t('printing.failed', { printer: printerName })}
          />
          <Button variant="outline" disabled={busy} onPress={() => void again()}>
            <Icon as={RotateCcwIcon} size={16} />
            <Text>{t('printing.retry')}</Text>
          </Button>
        </View>
      ) : null}
    </View>
  );
}

function Status({
  icon,
  text,
  tone = 'default',
  testID,
}: {
  icon: typeof PrinterIcon;
  text: string;
  tone?: 'default' | 'error';
  testID?: string;
}) {
  return (
    <View
      className="flex-row items-center gap-2"
      accessible
      accessibilityLiveRegion="polite"
      testID={testID}
    >
      <Icon
        as={icon}
        size={16}
        className={tone === 'error' ? 'text-destructive' : 'text-muted-foreground'}
      />
      <Text variant="muted" className={tone === 'error' ? 'flex-1 text-destructive' : 'flex-1'}>
        {text}
      </Text>
    </View>
  );
}
