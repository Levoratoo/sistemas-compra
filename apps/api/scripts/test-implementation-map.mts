/**
 * Testa extração de mapa de implantação (texto embutido + OCR opcional).
 *
 * Uso:
 *   npx tsx scripts/test-implementation-map.mts [caminho.pdf]
 *
 * Aceita:
 * - PDF binário válido (texto embutido e/ou OCR);
 * - Arquivo JSON de simulação (uploads/simulated/*.pdf com contentText) — só analisa o texto.
 *
 * Variáveis: PDF_OCR_FORCE=true PDF_OCR_MAX_PAGES=6 PDF_OCR_ENABLED=true
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  extractImplementationMapPdfText,
  parseImplementationMapContent,
} from '../src/utils/implementation-map-pdf.js';

function isSimulatedJson(buf: Buffer): boolean {
  const s = buf.slice(0, 200).toString('utf8').trimStart();
  return s.startsWith('{') && s.includes('"contentText"');
}

async function main() {
  const pdfPath = resolve(process.argv[2] ?? 'uploads/simulated/mapa-de-implementacao.pdf');
  const buf = await readFile(pdfPath);

  console.log('Arquivo:', pdfPath);
  console.log('Tamanho:', buf.length, 'bytes');
  console.log('---');

  if (isSimulatedJson(buf)) {
    const j = JSON.parse(buf.toString('utf8')) as { contentText?: string };
    const text = (j.contentText ?? '').trim();
    console.log('Modo: JSON simulado (sem PDF binário — OCR não aplicável)');
    console.log('texto (chars):', text.length);
    const parsed = parseImplementationMapContent(text);
    console.log('âncora contentAnchorIndex:', parsed.contentAnchorIndex);
    console.log('sectionsFound:', parsed.sectionsFound);
    console.log('cnpj:', parsed.cnpj ?? null);
    console.log('budgetLines:', parsed.budgetLines.length);
    const sample = parsed.budgetLines.slice(0, 10);
    for (const row of sample) {
      const o = JSON.parse(row.proposedValue) as { description?: string };
      console.log('-', row.recordGroupKey ?? '(sem cargo)', '|', (o.description ?? '').slice(0, 80));
    }
    if (parsed.budgetLines.length > 10) {
      console.log(`... e mais ${parsed.budgetLines.length - 10} linhas`);
    }
    console.log('---');
    console.log('Trecho (início):');
    console.log(text.slice(0, 900).replace(/\r/g, ''));
    return;
  }

  const { text, ocrUsed, extractionMode } = await extractImplementationMapPdfText(buf);
  const parsed = parseImplementationMapContent(text);

  console.log('Modo: PDF binário');
  console.log('extractionMode:', extractionMode);
  console.log('ocrUsed:', ocrUsed ?? false);
  console.log('texto total (chars):', text.length);
  console.log('âncora contentAnchorIndex:', parsed.contentAnchorIndex);
  console.log('sectionsFound:', parsed.sectionsFound);
  console.log('cnpj:', parsed.cnpj ?? null);
  console.log('budgetLines:', parsed.budgetLines.length);
  console.log('---');

  const sample = parsed.budgetLines.slice(0, 8);
  for (const row of sample) {
    const o = JSON.parse(row.proposedValue) as { description?: string };
    console.log('-', row.recordGroupKey ?? '(sem cargo)', '|', (o.description ?? '').slice(0, 72));
  }
  if (parsed.budgetLines.length > 8) {
    console.log(`... e mais ${parsed.budgetLines.length - 8} linhas`);
  }

  console.log('---');
  console.log('Trecho (início do texto, 800 chars):');
  console.log(text.slice(0, 800).replace(/\r/g, ''));
  if (text.includes('OCR')) {
    const ocrIdx = text.indexOf('--- Texto reconhecido por OCR');
    if (ocrIdx >= 0) {
      console.log('---');
      console.log('Trecho OCR (500 chars após marcador):');
      console.log(text.slice(ocrIdx, ocrIdx + 500));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
