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
