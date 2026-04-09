import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldRunPdfOcrForEdital } from './project-from-document.service.js';

test('shouldRunPdfOcrForEdital skips OCR for text-rich edital to avoid long-running requests', () => {
  const richText = `${'ANEXO I-B DETALHAMENTO DOS UNIFORMES '.repeat(4_000)} fim`;

  const decision = shouldRunPdfOcrForEdital(richText, {
    anchorFound: false,
    budgetLineCount: 0,
  });

  assert.equal(decision, false);
});

test('shouldRunPdfOcrForEdital allows OCR for short edital text with weak extraction', () => {
  const shortText = 'Termo de referencia digitalizado sem texto suficiente para extracao.';

  const decision = shouldRunPdfOcrForEdital(shortText, {
    anchorFound: false,
    budgetLineCount: 0,
  });

  assert.equal(decision, true);
});

test('shouldRunPdfOcrForEdital skips OCR when extraction already found enough budget lines', () => {
  const text = 'ANEXO I-C DETALHAMENTO DOS EPI';

  const decision = shouldRunPdfOcrForEdital(text, {
    anchorFound: true,
    budgetLineCount: 12,
  });

  assert.equal(decision, false);
});
