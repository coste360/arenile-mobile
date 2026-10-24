// Validation of the manual pairing form (address + code). Messages are i18n
// keys, translated where they are shown. Same rules as the QR path.
import { z } from 'zod';

import { normalizeInstanceUrl, normalizePairingCode } from './target';

export const manualPairingSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, 'manual.errors.urlRequired')
    .superRefine((value, ctx) => {
      if (value === '') return;
      const r = normalizeInstanceUrl(value);
      if (!r.ok) {
        ctx.addIssue({
          code: 'custom',
          message:
            r.error === 'insecure_url' ? 'manual.errors.urlInsecure' : 'manual.errors.urlInvalid',
        });
      }
    }),
  code: z
    .string()
    .refine((value) => normalizePairingCode(value) !== null, 'manual.errors.codeInvalid'),
});

export type ManualPairingValues = z.infer<typeof manualPairingSchema>;
