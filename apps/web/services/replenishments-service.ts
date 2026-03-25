import { apiRequest } from '@/services/api-client';
import type { IntervalUnit, ReplenishmentRule, ReplenishmentTriggerType } from '@/types/api';

export type ReplenishmentRulePayload = {
  triggerType: ReplenishmentTriggerType;
  intervalUnit: IntervalUnit;
  intervalValue: number;
  warningDays?: number;
  baseDate?: string | null;
  isEnabled?: boolean;
  notes?: string | null;
};

export function listProjectReplenishments(projectId: string) {
  return apiRequest<ReplenishmentRule[]>(`projects/${projectId}/replenishments`);
}

export function upsertReplenishmentRule(budgetItemId: string, payload: ReplenishmentRulePayload) {
  return apiRequest<ReplenishmentRule>(`budget-items/${budgetItemId}/replenishment-rule`, {
    method: 'POST',
    body: payload,
  });
}
