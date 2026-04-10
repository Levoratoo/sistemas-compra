/** Data prevista de reposição: campo explícito ou entrega + 6 meses (calendário). */
export function effectiveNextReplenishmentDate(item: {
  nextReplenishmentExpectedAt: Date | null;
  opDeliveredAt: Date | null;
}): Date | null {
  if (item.nextReplenishmentExpectedAt) {
    return item.nextReplenishmentExpectedAt;
  }
  if (item.opDeliveredAt) {
    const d = new Date(item.opDeliveredAt);
    d.setMonth(d.getMonth() + 6);
    return d;
  }
  return null;
}

export function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Reposição já deveria ter ocorrido (antes de hoje, comparando por dia UTC). */
export function isReplenishmentOverdue(effective: Date): boolean {
  const today = utcDayStart(new Date());
  return utcDayStart(effective).getTime() < today.getTime();
}

/** Entre amanhã e hoje+N dias (inclusive), por dia UTC — alerta “em breve”. */
export function isWithinDaysBeforeReplenishment(effective: Date, days: number): boolean {
  const today = utcDayStart(new Date());
  const eff = utcDayStart(effective);
  const horizon = new Date(today);
  horizon.setUTCDate(horizon.getUTCDate() + days);
  return eff > today && eff <= horizon;
}
