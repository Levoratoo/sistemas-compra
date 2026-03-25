import { IntervalUnit, ReplenishmentTriggerType } from '@prisma/client';
import { z } from 'zod';

export const budgetItemReplenishmentParamsSchema = z.object({
  id: z.string().min(1),
});

export const projectReplenishmentParamsSchema = z.object({
  id: z.string().min(1),
});

export const createReplenishmentRuleSchema = z.object({
  triggerType: z.nativeEnum(ReplenishmentTriggerType),
  intervalUnit: z.nativeEnum(IntervalUnit),
  intervalValue: z.coerce.number().int().positive(),
  warningDays: z.coerce.number().int().nonnegative().optional(),
  baseDate: z.string().trim().optional().nullable(),
  isEnabled: z.boolean().optional(),
  notes: z.string().trim().optional(),
}).superRefine((value, context) => {
  if (value.triggerType === ReplenishmentTriggerType.MANUAL && !value.baseDate) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['baseDate'],
      message: 'baseDate is required when triggerType is MANUAL',
    });
  }
});

export type CreateReplenishmentRuleInput = z.infer<typeof createReplenishmentRuleSchema>;
