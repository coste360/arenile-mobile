// Validation of the block dialog of the spot sheet. Messages are i18n keys.
// Same limit as the contract (SpotBlockCreate.reason, 200 characters).
import { z } from 'zod';

export const blockSchema = z.object({
  reason: z.string().trim().max(200, 'dayMap.block.tooLong'),
});

export type BlockValues = z.infer<typeof blockSchema>;
