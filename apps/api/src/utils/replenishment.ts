import type {
  IntervalUnit,
  ReplenishmentRule,
  ReplenishmentTriggerType,
} from '@prisma/client';

type ReplenishmentContext = {
  deliveredAt?: Date | null;
  projectStartDate?: Date | null;
  lastReplenishmentDate?: Date | null;
};

function addInterval(date: Date, intervalUnit: IntervalUnit, intervalValue: number) {
  const nextDate = new Date(date);

  switch (intervalUnit) {
    case 'DAY':
      nextDate.setDate(nextDate.getDate() + intervalValue);
      break;
    case 'WEEK':
      nextDate.setDate(nextDate.getDate() + intervalValue * 7);
      break;
    case 'MONTH':
      nextDate.setMonth(nextDate.getMonth() + intervalValue);
      break;
    case 'YEAR':
      nextDate.setFullYear(nextDate.getFullYear() + intervalValue);
      break;
  }

  return nextDate;
}

export function resolveReplenishmentBaseDate(
  triggerType: ReplenishmentTriggerType,
  baseDate: Date | null | undefined,
  context: ReplenishmentContext,
) {
  switch (triggerType) {
    case 'FROM_DELIVERY':
      return context.deliveredAt ?? null;
    case 'FROM_PROJECT_START':
      return context.projectStartDate ?? null;
    case 'FROM_LAST_REPLENISHMENT':
      return context.lastReplenishmentDate ?? null;
    case 'MANUAL':
      return baseDate ?? null;
    default:
      return null;
  }
}

export function calculateNextReplenishmentDate(
  rule: Pick<ReplenishmentRule, 'triggerType' | 'intervalUnit' | 'intervalValue' | 'baseDate'>,
  context: ReplenishmentContext,
) {
  const baseDate = resolveReplenishmentBaseDate(rule.triggerType, rule.baseDate, context);

  if (!baseDate) {
    return null;
  }

  return {
    baseDateUsed: baseDate,
    plannedDate: addInterval(baseDate, rule.intervalUnit, rule.intervalValue),
  };
}
