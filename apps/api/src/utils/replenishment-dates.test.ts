import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  canConfirmReplenishmentCycle,
  effectiveNextReplenishmentDate,
  isReplenishmentOverdue,
  isWithinDaysBeforeReplenishment,
} from './replenishment-dates.js';

describe('replenishment-dates', () => {
  it('prefere nextReplenishmentExpectedAt ao cálculo pela entrega', () => {
    const explicit = new Date('2026-08-15T12:00:00.000Z');
    const d = effectiveNextReplenishmentDate({
      nextReplenishmentExpectedAt: explicit,
      opDeliveredAt: new Date('2025-01-01T12:00:00.000Z'),
    });
    assert.equal(d?.toISOString(), explicit.toISOString());
  });

  it('em atraso quando data efetiva é antes de hoje (UTC)', () => {
    const past = new Date('2020-01-01T12:00:00.000Z');
    assert.equal(isReplenishmentOverdue(past), true);
  });

  it('janela de 30 dias: futuro dentro do horizonte', () => {
    const today = new Date();
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 10));
    assert.equal(isWithinDaysBeforeReplenishment(d, 30), true);
  });

  it('canConfirmReplenishmentCycle: dentro de 30 dias ou em atraso', () => {
    const today = new Date();
    const in20 = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 20));
    const past = new Date('2019-06-01T12:00:00.000Z');
    const far = new Date(Date.UTC(today.getUTCFullYear() + 2, 0, 1));
    assert.equal(canConfirmReplenishmentCycle(in20, 30), true);
    assert.equal(canConfirmReplenishmentCycle(past, 30), true);
    assert.equal(canConfirmReplenishmentCycle(far, 30), false);
  });
});
