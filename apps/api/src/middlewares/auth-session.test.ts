import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveAuthFromDbUser } from './auth-session.js';

describe('resolveAuthFromDbUser (papel sempre do banco, nao do JWT)', () => {
  it('devolve SUPERVISOR quando o registo no banco e supervisora (JWT antigo com USER seria ignorado)', () => {
    const r = resolveAuthFromDbUser({
      id: 'u1',
      email: 's@test.com',
      role: 'SUPERVISOR',
      isActive: true,
    });
    assert.ok(r.ok);
    if (r.ok) assert.equal(r.auth.role, 'SUPERVISOR');
  });

  it('rejeita utilizador inativo', () => {
    const r = resolveAuthFromDbUser({
      id: 'u1',
      email: 'x@test.com',
      role: 'ADMIN',
      isActive: false,
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'inactive');
  });

  it('rejeita utilizador inexistente', () => {
    const r = resolveAuthFromDbUser(null);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'missing');
  });
});
