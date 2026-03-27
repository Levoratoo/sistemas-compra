import { Prisma } from '@prisma/client';

export function toDecimal(value: number | string | Prisma.Decimal | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return new Prisma.Decimal(value);
}

/** Para PATCH parcial: `undefined` não altera o campo; `null` zera. */
export function optionalToDecimal(value: number | null | undefined): Prisma.Decimal | null | undefined {
  if (value === undefined) return undefined;
  return toDecimal(value);
}

export function decimalToNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Prisma.Decimal) {
    return value.toNumber();
  }

  const numeric = Number(value);
  return Number.isNaN(numeric) ? null : numeric;
}
