import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { quoteImportMatchingForTests } from './quote.service.js';

function createBudgetItem(name: string) {
  return {
    id: name,
    name,
    specification: null,
    unit: null,
    itemCategory: 'OTHER',
    plannedQuantity: null,
    supplierQuoteExtraItem: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  } as Parameters<typeof quoteImportMatchingForTests.scoreQuoteImportMatch>[1];
}

function scoreRow(description: string, itemName: string) {
  return quoteImportMatchingForTests.scoreQuoteImportMatch(
    {
      description,
      quantity: null,
    },
    createBudgetItem(itemName),
  ).score;
}

describe('quote import matching', () => {
  it('reconhece sinonimo auricular como protetor auditivo', () => {
    const score = scoreRow(
      'PROTETOR AURICULAR CA 5745',
      'Protetor auditivo de inserção reutilizável (par)',
    );

    assert.ok(score >= 0.48, `score esperado >= 0.48, obtido ${score}`);
  });

  it('mantem mascara generica como revisao valida', () => {
    const score = scoreRow('MASCARAS DE PROTEÇÃO CA: 30592', 'Máscara PFF2/N95');

    assert.ok(score >= 0.48, `score esperado >= 0.48, obtido ${score}`);
  });

  it('nao promove item inexistente so por compartilhar token generico', () => {
    const score = scoreRow('LANTERNA TATICA PARA USO DE BOMBEIROS', 'Cotoveleira tática (par)');

    assert.ok(score < 0.48, `score esperado < 0.48, obtido ${score}`);
  });

  it('mantem calca operacional como correspondencia revisavel', () => {
    const score = scoreRow('CALÇA ATLAS CREME (44)', 'Calça Tática');

    assert.ok(score >= 0.48, `score esperado >= 0.48, obtido ${score}`);
  });
});
