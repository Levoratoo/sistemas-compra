import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { toIsoString } from './date.js';

describe('date utils', () => {
  it('serializa datas validas em ISO', () => {
    assert.equal(toIsoString(new Date('2026-04-09T12:34:56.000Z')), '2026-04-09T12:34:56.000Z');
    assert.equal(toIsoString('2026-04-09T12:34:56.000Z'), '2026-04-09T12:34:56.000Z');
  });

  it('retorna null para datas invalidas em vez de derrubar a API', () => {
    assert.equal(toIsoString(new Date('invalid')), null);
    assert.equal(toIsoString('not-a-date'), null);
    assert.equal(toIsoString(null), null);
    assert.equal(toIsoString(undefined), null);
  });
});
