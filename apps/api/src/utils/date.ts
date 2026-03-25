export function parseOptionalDate(value: string | Date | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export function toIsoString(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}
