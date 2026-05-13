import assert from 'node:assert/strict';
import test from 'node:test';

import { createSupplierSchema, updateSupplierSchema } from './supplier.schemas.js';

test('supplier schemas load and validate create/update payloads with OUTROS', () => {
  const createResult = createSupplierSchema.safeParse({
    legalName: 'Fornecedor Teste',
    offeringCategories: ['OUTROS'],
    offeringCategoriesOtherDetail: 'Item especial',
  });
  assert.equal(createResult.success, true);

  const updateResult = updateSupplierSchema.safeParse({
    offeringCategories: ['OUTROS'],
    offeringCategoriesOtherDetail: 'Complemento',
  });
  assert.equal(updateResult.success, true);
});

test('update supplier schema exige detalhe quando OUTROS vier sem descricao', () => {
  const result = updateSupplierSchema.safeParse({
    offeringCategories: ['OUTROS'],
    offeringCategoriesOtherDetail: '',
  });
  assert.equal(result.success, false);
});
