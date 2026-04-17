const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';
const EXPIRING_SOON_DAYS = 30;

export type SupplierCndStatus = 'MISSING' | 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';

function getSaoPauloIsoDate(referenceDate = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: SAO_PAULO_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(referenceDate);
  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';

  return `${year}-${month}-${day}`;
}

function isoDateToDayNumber(isoDate: string) {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  return Math.floor(Date.UTC(Number(year), Number(month) - 1, Number(day)) / 86_400_000);
}

function dateToIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

const statusRank: Record<SupplierCndStatus, number> = {
  MISSING: 1,
  VALID: 2,
  EXPIRING_SOON: 3,
  EXPIRED: 4,
};

function pickWorseCndDerived(
  a: { status: SupplierCndStatus; daysUntilExpiration: number | null },
  b: { status: SupplierCndStatus; daysUntilExpiration: number | null },
) {
  if (statusRank[a.status] !== statusRank[b.status]) {
    return statusRank[a.status] > statusRank[b.status] ? a : b;
  }

  if (a.daysUntilExpiration === null) {
    return b;
  }

  if (b.daysUntilExpiration === null) {
    return a;
  }

  return a.daysUntilExpiration <= b.daysUntilExpiration ? a : b;
}

/** Consolida Federal + estadual: expirada se qualquer uma expirada; próxima do vencimento se qualquer uma na janela; válida só se ambas válidas (ou só uma existir com validade e for válida). */
export function deriveDualSupplierCndStatus(
  federalValidUntil: Date | null | undefined,
  stateValidUntil: Date | null | undefined,
  referenceDate = new Date(),
): {
  status: SupplierCndStatus;
  daysUntilExpiration: number | null;
} {
  const dFederal = deriveSupplierCndStatus(federalValidUntil ?? null, referenceDate);
  const dState = deriveSupplierCndStatus(stateValidUntil ?? null, referenceDate);

  if (!federalValidUntil && !stateValidUntil) {
    return dFederal;
  }

  if (federalValidUntil && !stateValidUntil) {
    return dFederal;
  }

  if (!federalValidUntil && stateValidUntil) {
    return dState;
  }

  return pickWorseCndDerived(dFederal, dState);
}

export function deriveSupplierCndStatus(
  validUntil: Date | null | undefined,
  referenceDate = new Date(),
): {
  status: SupplierCndStatus;
  daysUntilExpiration: number | null;
} {
  if (!validUntil) {
    return {
      status: 'MISSING',
      daysUntilExpiration: null,
    };
  }

  const validUntilDay = isoDateToDayNumber(dateToIsoDate(validUntil));
  const currentDay = isoDateToDayNumber(getSaoPauloIsoDate(referenceDate));

  if (validUntilDay === null || currentDay === null) {
    return {
      status: 'MISSING',
      daysUntilExpiration: null,
    };
  }

  const daysUntilExpiration = validUntilDay - currentDay;

  if (daysUntilExpiration < 0) {
    return {
      status: 'EXPIRED',
      daysUntilExpiration,
    };
  }

  if (daysUntilExpiration <= EXPIRING_SOON_DAYS) {
    return {
      status: 'EXPIRING_SOON',
      daysUntilExpiration,
    };
  }

  return {
    status: 'VALID',
    daysUntilExpiration,
  };
}
