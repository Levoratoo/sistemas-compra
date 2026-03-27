import type { BudgetItem } from '@/types/api';

function addCalendarMonthsToDateInputIso(v: string, months: number): string | null {
  if (!v) return null;
  const d = new Date(`${v}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

/** Mesma regra do controle de compras: entrega na unidade + 6 meses. */
function nextReplenishmentIsoFromDelivered(opDeliveredAtIso: string): string | null {
  const base = opDeliveredAtIso.slice(0, 10);
  if (!base) return null;
  return addCalendarMonthsToDateInputIso(base, 6);
}

/**
 * Data prevista de reposição efetiva: campo gravado ou, na falta dele, cálculo a partir da entrega na unidade.
 */
export function effectiveNextReplenishmentIso(item: BudgetItem): string | null {
  if (item.nextReplenishmentExpectedAt) return item.nextReplenishmentExpectedAt;
  if (item.opDeliveredAt) return nextReplenishmentIsoFromDelivered(item.opDeliveredAt);
  return null;
}
