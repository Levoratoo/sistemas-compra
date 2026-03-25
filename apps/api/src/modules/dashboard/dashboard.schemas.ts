import { z } from 'zod';

export const projectDashboardParamsSchema = z.object({
  id: z.string().min(1),
});
