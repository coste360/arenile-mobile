import { zodResolver } from '@hookform/resolvers/zod';
import { NotebookPenIcon } from 'lucide-react-native';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { BookingRef } from '@/features/booking-actions/booking-ref';
import { noteSchema, type NoteValues } from '@/features/booking-actions/forms';
import { useBookingOperations } from '@/features/booking-actions/hooks';

import { QueuedNotice, useQueuedFeedback } from './queued-feedback';

/**
 * Internal notes of a booking: the existing ones (known from the detail)
 * and a new one, queued (bookings.write, checked by the caller).
 */
export function NoteForm({ booking }: { booking: BookingRef }) {
  const { t } = useTranslation();
  const { addNote } = useBookingOperations(booking);
  const [outcome, report, clear] = useQueuedFeedback();
  const { control, handleSubmit, reset, formState } = useForm<NoteValues>({
    resolver: zodResolver(noteSchema),
    defaultValues: { text: '' },
  });

  const onSubmit = () =>
    void handleSubmit(async ({ text }) => {
      await addNote(text);
      reset({ text: '' });
      report();
    })();

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading">{t('operations.note.title')}</CardTitle>
      </CardHeader>
      <CardContent className="gap-4">
        {booking.notesInternal !== undefined ? (
          <Text selectable className={booking.notesInternal ? undefined : 'text-muted-foreground'}>
            {booking.notesInternal || t('operations.note.none')}
          </Text>
        ) : null}
        <FormField
          control={control}
          name="text"
          label={t('operations.note.label')}
          hint={t('operations.note.hint')}
          placeholder={t('operations.note.placeholder')}
          multiline
          className="h-24 py-2"
          textAlignVertical="top"
          onFocus={clear}
        />
        <Button variant="outline" onPress={onSubmit} disabled={formState.isSubmitting}>
          <Icon as={NotebookPenIcon} size={16} />
          <Text>{t('operations.note.submit')}</Text>
        </Button>
        <QueuedNotice outcome={outcome} />
      </CardContent>
    </Card>
  );
}
