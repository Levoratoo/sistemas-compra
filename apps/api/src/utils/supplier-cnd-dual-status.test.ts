import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { deriveDualSupplierCndStatus } from './supplier-cnd-status.js';

describe('deriveDualSupplierCndStatus', () => {
  const ref = new Date('2026-04-10T12:00:00.000Z');

  it('retorna MISSING quando nenhuma validade existe', () => {
    const r = deriveDualSupplierCndStatus(null, null, ref);
    assert.equal(r.status, 'MISSING');
  });

  it('usa apenas federal quando estadual ausente', () => {
    const fed = new Date('2026-08-01T12:00:00.000Z');
    const r = deriveDualSupplierCndStatus(fed, null, ref);
    assert.equal(r.status, 'VALID');
  });

  it('marca EXPIRED se a estadual estiver vencida mesmo com federal valida', () => {
    const fed = new Date('2027-01-01T12:00:00.000Z');
    const st = new Date('2026-01-01T12:00:00.000Z');
    const r = deriveDualSupplierCndStatus(fed, st, ref);
    assert.equal(r.status, 'EXPIRED');
  });

  it('marca EXPIRING_SOON se qualquer uma estiver na janela e nenhuma expirada', () => {
    const fed = new Date('2026-05-01T12:00:00.000Z');
    const st = new Date('2027-01-01T12:00:00.000Z');
    const r = deriveDualSupplierCndStatus(fed, st, ref);
    assert.equal(r.status, 'EXPIRING_SOON');
  });
});
