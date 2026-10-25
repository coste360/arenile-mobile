// Form schemas of the booking operations (zod + react-hook-form, like the
// pairing form). Messages are i18n keys, translated by FormField.
import { z } from 'zod';

import type { Cents } from '@/lib/money';

import { NOTE_MAX_LENGTH, validateCashAmount } from './rules';

export const noteSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, 'operations.note.errors.note_empty')
    .max(NOTE_MAX_LENGTH, 'operations.note.errors.note_too_long'),
});

export type NoteValues = z.infer<typeof noteSchema>;

/** The typed amount (as text, parsed without floats) against the balance due. */
export function cashSchema(balanceDue: Cents) {
  return z.object({
    amount: z.string().superRefine((value, ctx) => {
      const result = validateCashAmount(value, balanceDue);
      if (!result.ok)
        ctx.addIssue({ code: 'custom', message: `operations.cash.errors.${result.error}` });
    }),
  });
}

export type CashValues = z.infer<ReturnType<typeof cashSchema>>;
