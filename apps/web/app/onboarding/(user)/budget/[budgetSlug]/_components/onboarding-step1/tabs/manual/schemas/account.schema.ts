import { z } from 'zod';

export const manualAccountFormSchema = z.object({
  attachments: z.array(z.union([z.instanceof(File), z.string()])).default([]),
});
