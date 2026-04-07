import { PDFParse } from 'pdf-parse';

import { repairUtf8MisinterpretedAsLatin1 } from './encoding.js';
import { extractPdfTextViaOcr } from './pdf-ocr.js';

const UNIT_TOKENS = new Set([
  'UN',
  'UND',
  'UNID',
  'UNIDADE',
  'UNI',
  'PC',
  'PCT',
  'CX',
  'PAR',
  'PR',
  'KIT',
  'JG',
  'RL',
  'ROLO',
  'FD',
  'SC',
  'SACO',
  'LT',
  'L',
  'GL',
  'ML',
  'KG',
  'G',
  'M',
  'CM',
  'MM',
  'PARES',
  'CAIXA',
  'PACOTE',
  'PACO',
]);

const STOP_TOKENS = new Set([
  'de',
  'da',
  'do',
  'das',
  'dos',
  'com',
  'sem',
  'para',
  'por',
  'em',
  'no',
  'na',
  'nos',
  'nas',
  'e',
  'ou',
  'a',
  'o',
  'as',
  'os',
]);

const HEADER_SKIP_PATTERNS = [
  'orcamento',
  'pedido',
  'cliente',
  'endereco',
  'cidade',
  'bairro',
  'fone',
  'telefone',
  'forma de pagto',
  'forma de negociacao',
  'condicoes',
  'condicao',
  'frete',
  'totais',
  'sub total',
  'subtotal',
  'preco total',
  'preco uni',
  'total geral',
  'total do orcamento',
  'total liquido',
  'total produtos',
  'total item',
  'vendedor',
  'validade',
  'itens',
  'produto descricao',
  'num orcamento',
  'data orcamento',
  'observacoes',
  'mensagem',
  'vencimentos',
  'tipo de frete',
  'prazo de entrega',
  'cobranca',
  'atenciosamente',
  'consulte nosso catalogo',
  'emitir orcamento',
  'page of',
];

const HEADER_SUPPLIER_SKIP_PATTERNS = [
  'emitir orcamento',
  'orcamento',
  'pedido',
  'cliente',
  'endereco',
  'cidade',
  'bairro',
  'fone',
  'telefone',
  'contato',
  'validade',
  'prazo',
  'condicao',
  'cobranca',
  'vendedor',
  'email',
  'whatsapp',
  'cnpj',
  'cpf',
  'cep',
  'data',
  'hora',
  'page of',
  'pagina',
];

const DIRECT_TEXT_MIN_LENGTH = 40;
const CONTINUATION_MAX_LINES = 3;

export type SupplierQuoteExtractionMode = 'DIRECT_TEXT' | 'OCR';

export type SupplierQuoteParsedRow = {
  rowIndex: number;
  rawText: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  totalValue: number | null;
};

export type SupplierQuotePdfPreview = {
  extractionMode: SupplierQuoteExtractionMode;
  fullText: string;
  supplierNameDetected: string | null;
  quoteNumber: string | null;
  quoteDate: string | null;
  rows: SupplierQuoteParsedRow[];
};

type ParsedCandidate = Omit<SupplierQuoteParsedRow, 'rowIndex'>;

type ParsedCandidateWithMeta = {
  candidate: ParsedCandidate;
  score: number;
};

type LineCandidate = {
  text: string;
  linesUsed: number;
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeLine(value: string) {
  return normalizeWhitespace(
    value
      .replace(/\t/g, ' ')
      .replace(/[|]+/g, ' ')
      .replace(/[“”]/g, '"')
      .replace(/[’]/g, "'")
      .replace(/[–—]/g, ' '),
  );
}

function stripAccents(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizeSupplierQuoteMatchText(value: string) {
  return stripAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeSupplierQuoteMatchText(value: string) {
  return normalizeSupplierQuoteMatchText(value)
    .split(' ')
    .filter((token) => token.length > 1 && !STOP_TOKENS.has(token) && !/^\d+$/.test(token));
}

function parsePtBrNumber(raw: string | null | undefined): number | null {
  if (!raw) {
    return null;
  }

  let cleaned = raw.replace(/[R$\s]/g, '');

  if ((cleaned.match(/,/g) ?? []).length > 1 && !cleaned.includes('.')) {
    const lastComma = cleaned.lastIndexOf(',');
    cleaned = `${cleaned.slice(0, lastComma).replace(/,/g, '')}.${cleaned.slice(lastComma + 1)}`;
  } else {
    cleaned = cleaned.replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseNumericToken(raw: string | null | undefined): number | null {
  if (!raw) {
    return null;
  }

  const cleaned = raw.replace(/[^\d,.-]/g, '');
  if (!cleaned) {
    return null;
  }
  return parsePtBrNumber(cleaned);
}

function parseMoneyToken(raw: string | null | undefined): number | null {
  if (!raw) {
    return null;
  }

  if (!/\d/.test(raw)) {
    return null;
  }

  if (/(?:[.,]\d{2,4})$/.test(raw)) {
    return parsePtBrNumber(raw);
  }

  return null;
}

function roundCandidate(value: number) {
  return Number(value.toFixed(4));
}

function uniqueNumbers(values: number[]) {
  return [...new Set(values.map((value) => roundCandidate(value)))];
}

function parseFlexibleNumericCandidates(raw: string | null | undefined, mode: 'quantity' | 'price') {
  if (!raw) {
    return [] as number[];
  }

  const directMoney = parseMoneyToken(raw);
  if (directMoney !== null && directMoney >= 0) {
    return [directMoney];
  }

  const numeric = parseNumericToken(raw);
  if (numeric === null || numeric < 0) {
    return [] as number[];
  }

  const cleaned = raw.replace(/[^\d]/g, '');
  if (!cleaned || !/^\d+$/.test(cleaned)) {
    return [roundCandidate(numeric)];
  }

  const base = Number(cleaned);
  if (!Number.isFinite(base) || base < 0) {
    return [] as number[];
  }

  const divisors = mode === 'quantity' ? [1, 10, 100, 1000] : [1, 10, 100, 1000];
  return uniqueNumbers(
    divisors
      .map((divisor) => base / divisor)
      .filter((value) => Number.isFinite(value) && value >= 0),
  );
}

function isUnitToken(token: string | undefined) {
  if (!token) {
    return false;
  }
  return UNIT_TOKENS.has(stripAccents(token).toUpperCase());
}

function isLeadingCodeToken(token: string | undefined) {
  if (!token) {
    return false;
  }

  const normalized = stripAccents(token).toUpperCase();
  return /^(?:\d{4,}|\d{3,}\/\d+|[A-Z]{0,3}\d{4,}[A-Z]{0,3})$/.test(normalized);
}

function isInlineProductCodeToken(token: string | undefined) {
  if (!token) {
    return false;
  }

  const normalized = stripAccents(token).toUpperCase();
  return /^(?:\d{6,}|\d{3,}\/\d+|[A-Z]{0,3}\d{6,}[A-Z]{0,3})$/.test(normalized);
}

function isLineNumberToken(token: string | undefined) {
  return Boolean(token && /^\d{1,3}$/.test(token));
}

function isStrictNumericToken(token: string | undefined) {
  return Boolean(token && /^\d+(?:[.,]\d+)?$/.test(token));
}

function isPureNoiseToken(token: string | undefined) {
  if (!token) {
    return true;
  }
  return /^(?:[-_/\\.,:;()[\]{}]+|R\$|RS)$/i.test(token);
}

function cleanupDescriptionTokens(tokens: string[]) {
  const filtered = tokens
    .map((token) => normalizeWhitespace(token))
    .filter(Boolean)
    .filter((token) => !isPureNoiseToken(token));

  if (filtered.length > 1 && isLineNumberToken(filtered[0]) && isLeadingCodeToken(filtered[1])) {
    filtered.shift();
  }

  while (filtered.length > 0 && (isLineNumberToken(filtered[0]) || isLeadingCodeToken(filtered[0]))) {
    filtered.shift();
  }

  while (filtered.length > 0 && isUnitToken(filtered[0]) && filtered.length > 2) {
    filtered.shift();
  }

  while (filtered.length > 0 && /^\d{3,}$/.test(filtered[filtered.length - 1] ?? '') && filtered.length > 2) {
    filtered.pop();
  }

  const compact = filtered.filter((token) => !isInlineProductCodeToken(token));
  return normalizeWhitespace(compact.join(' '));
}

function shouldSkipLine(line: string) {
  const normalized = normalizeSupplierQuoteMatchText(line);
  if (!normalized) {
    return true;
  }
  if (normalized.length < 4) {
    return true;
  }
  if (!/[a-z]/i.test(normalized) || !/\d/.test(normalized)) {
    return true;
  }
  if (HEADER_SKIP_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    return true;
  }
  if (/^\d+\s+of\s+\d+$/i.test(normalized)) {
    return true;
  }
  if (normalized.startsWith('pagina ') || normalized.startsWith('pag ')) {
    return true;
  }
  if (/^[-_/\\\s.]+$/.test(line)) {
    return true;
  }
  return false;
}

function countMoneyTokens(line: string) {
  return line
    .split(/\s+/)
    .map((token) => parseMoneyToken(token))
    .filter((value): value is number => value !== null).length;
}

function isLikelyNewItemStart(line: string) {
  const tokens = line.split(/\s+/).filter(Boolean);
  if (tokens.length < 3) {
    return false;
  }

  if (isLeadingCodeToken(tokens[0]) || (isLineNumberToken(tokens[0]) && isLeadingCodeToken(tokens[1]))) {
    return true;
  }

  return countMoneyTokens(line) >= 2 && /\b(?:UNI(?:DADE)?|UN|UND|CX|PC|PCT|LT|GL|KG|PAR)\b/i.test(line);
}

function isLikelyContinuationLine(line: string) {
  return !shouldSkipLine(line) && !isLikelyNewItemStart(line);
}

function parseQuantityValue(raw: string | null | undefined, unitPrice: number | null, totalValue: number | null) {
  const quantity = parseNumericToken(raw);
  if (quantity === null) {
    return null;
  }
  return stabilizeQuantity(quantity, unitPrice, totalValue);
}

function stabilizeQuantity(quantity: number | null, unitPrice: number | null, totalValue: number | null) {
  if (quantity === null || unitPrice === null || totalValue === null || quantity === 0) {
    return quantity;
  }

  const matches = (value: number) => Math.abs(value * unitPrice - totalValue) <= Math.max(1, totalValue * 0.06);

  if (matches(quantity)) {
    return quantity;
  }

  if (Number.isInteger(quantity) && quantity >= 10) {
    for (const divisor of [10, 100, 1000]) {
      const scaled = quantity / divisor;
      if (matches(scaled)) {
        return scaled;
      }
    }
  }

  return quantity;
}

function buildCandidateScore(candidate: ParsedCandidate, rawText: string, linesUsed: number) {
  const descriptionWords = candidate.description.split(/\s+/).filter(Boolean).length;
  const normalizedDescription = normalizeSupplierQuoteMatchText(candidate.description);
  const longCodePenalty = (candidate.description.match(/\b\d{6,}\b/g) ?? []).length * 20;
  const duplicateSymbolPenalty = /(?:\b0{3,}\b|\b17\b\s+\b0[,.]0{3,4}\b)/.test(rawText) ? 4 : 0;
  const trailingMoneyPenalty = /\b\d+(?:[.,]\d{2,4})$/.test(candidate.description) ? 26 : 0;
  const trailingNumericPenalty = /\b\d{3,}\s+\d+(?:[.,]\d{2,4})$/.test(candidate.description) ? 12 : 0;
  const integerQuantityBonus =
    candidate.quantity !== null && Math.abs(candidate.quantity - Math.round(candidate.quantity)) <= 0.001 ? 12 : 0;
  const fractionalQuantityPenalty =
    candidate.quantity !== null && Math.abs(candidate.quantity - Math.round(candidate.quantity)) > 0.001 ? 8 : 0;
  let numericConsistencyScore = 0;

  if (candidate.quantity !== null && candidate.unitPrice !== null && candidate.totalValue !== null && candidate.totalValue > 0) {
    const expectedTotal = candidate.quantity * candidate.unitPrice;
    const relativeDelta = Math.abs(expectedTotal - candidate.totalValue) / Math.max(candidate.totalValue, 1);
    numericConsistencyScore = Math.max(0, 40 * (1 - Math.min(relativeDelta, 1)));
  }

  return (
    descriptionWords * 8 +
    Math.min(candidate.description.length, 120) +
    (candidate.quantity !== null ? 14 : 0) +
    (candidate.totalValue !== null ? 10 : 0) +
    (candidate.unit ? 4 : 0) +
    linesUsed * 3 +
    (normalizedDescription.length >= 12 ? 6 : 0) -
    longCodePenalty -
    duplicateSymbolPenalty -
    trailingMoneyPenalty -
    trailingNumericPenalty -
    fractionalQuantityPenalty +
    integerQuantityBonus +
    numericConsistencyScore
  );
}

function tryParseTrailingQuantityPattern(line: string): ParsedCandidate | null {
  const match = line.match(
    /^(?<description>.+?)\s+(?<unitPrice>\d{1,3}(?:\.\d{3})*,\d{2,4}|\d+\.\d{2,4})\s+(?<total>R?\$?\s*\d{1,3}(?:\.\d{3})*,\d{2,4}|\d+\.\d{2,4})\s+(?<qty>\d+(?:[.,]\d+)?)\s+(?<unit>[A-Z]{1,10})$/i,
  );

  if (!match?.groups) {
    return null;
  }

  const description = cleanupDescriptionTokens(match.groups.description.split(/\s+/));
  const unitPrice = parseMoneyToken(match.groups.unitPrice);
  const totalValue = parseMoneyToken(match.groups.total);
  const quantity = parseQuantityValue(match.groups.qty, unitPrice, totalValue);
  const unit = stripAccents(match.groups.unit).toUpperCase();

  if (!description || unitPrice === null || !isUnitToken(unit)) {
    return null;
  }

  return {
    rawText: line,
    description,
    quantity,
    unit,
    unitPrice,
    totalValue,
  };
}

function findLastMoneyIndex(tokens: string[]) {
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    const value = parseMoneyToken(tokens[index]);
    if (value !== null) {
      return { index, value };
    }
  }
  return null;
}

function findLastUnitNearTail(tokens: string[], totalIndex: number) {
  for (let index = totalIndex - 1; index >= Math.max(0, totalIndex - 5); index -= 1) {
    if (isUnitToken(tokens[index])) {
      return index;
    }
  }
  return null;
}

function findLastNumericIndex(tokens: string[], fromIndex: number, minIndex: number, strict = false) {
  for (let index = fromIndex; index >= minIndex; index -= 1) {
    if ((!strict || isStrictNumericToken(tokens[index])) && parseNumericToken(tokens[index]) !== null) {
      return index;
    }
  }
  return -1;
}

function findFirstNumericIndex(tokens: string[], fromIndex: number, maxIndex: number, strict = false) {
  for (let index = fromIndex; index <= maxIndex; index += 1) {
    if ((!strict || isStrictNumericToken(tokens[index])) && parseNumericToken(tokens[index]) !== null) {
      return index;
    }
  }
  return -1;
}

function findLeadingUnitIndex(tokens: string[], quantityIndex: number) {
  for (let index = 0; index < Math.min(quantityIndex, 3); index += 1) {
    if (isUnitToken(tokens[index])) {
      return index;
    }
  }
  return null;
}

function resolveBestUnitPriceValue(raw: string | null | undefined, quantityRaw: string | null | undefined, totalValue: number) {
  const candidates = parseFlexibleNumericCandidates(raw, 'price').filter((value) => value > 0);
  if (candidates.length === 0) {
    return null;
  }

  const quantity = parseNumericToken(quantityRaw);
  if (quantity === null) {
    return candidates[0] ?? null;
  }

  const scored = candidates.map((candidate) => {
    const stabilizedQuantity = stabilizeQuantity(quantity, candidate, totalValue) ?? quantity;
    const delta = Math.abs(stabilizedQuantity * candidate - totalValue);
    return {
      value: candidate,
      delta,
    };
  });

  return scored.sort((left, right) => left.delta - right.delta || left.value - right.value)[0]?.value ?? null;
}

function resolveUnitPriceFromTail(
  tokens: string[],
  startIndex: number,
  totalIndex: number,
  quantityRaw: string | null | undefined,
  totalValue: number,
) {
  for (let index = startIndex; index < totalIndex; index += 1) {
    const value = resolveBestUnitPriceValue(tokens[index], quantityRaw, totalValue);
    if (value !== null) {
      return { index, value };
    }
  }
  return null;
}

function resolveTotalFromTail(
  tokens: string[],
  unitPriceIndex: number,
  lastMoneyIndex: number,
  unitPrice: number,
  quantityRaw: string | null | undefined,
) {
  const laterEntries: Array<{ index: number; value: number }> = [];
  for (let index = unitPriceIndex + 1; index <= lastMoneyIndex; index += 1) {
    const value = parseMoneyToken(tokens[index]);
    if (value !== null && value > 0) {
      laterEntries.push({ index, value });
    }
  }

  if (laterEntries.length === 0) {
    const quantity = parseNumericToken(quantityRaw);
    if (quantity === null) {
      return { index: unitPriceIndex, value: unitPrice };
    }

    const stabilizedQuantity = stabilizeQuantity(quantity, unitPrice, quantity * unitPrice) ?? quantity;
    return {
      index: unitPriceIndex,
      value: roundCandidate(stabilizedQuantity * unitPrice),
    };
  }

  const quantity = parseNumericToken(quantityRaw);
  if (quantity === null) {
    return laterEntries[laterEntries.length - 1] ?? null;
  }

  return (
    laterEntries
      .map((entry) => {
        const stabilizedQuantity = stabilizeQuantity(quantity, unitPrice, entry.value) ?? quantity;
        const expectedTotal = stabilizedQuantity * unitPrice;
        let relativeDelta = Math.abs(expectedTotal - entry.value) / Math.max(entry.value, 1);

        if (Math.abs(entry.value - unitPrice) <= 0.0001 && laterEntries.length > 1) {
          relativeDelta += 0.25;
        }

        return {
          ...entry,
          relativeDelta,
        };
      })
      .sort((left, right) => left.relativeDelta - right.relativeDelta || left.index - right.index)[0] ?? null
  );
}

function tryParseGenericTailPattern(line: string): ParsedCandidate | null {
  const tokens = line.split(/\s+/).filter(Boolean);
  if (tokens.length < 5) {
    return null;
  }

  const lastMoneyEntry = findLastMoneyIndex(tokens);
  if (!lastMoneyEntry) {
    return null;
  }

  const candidates: ParsedCandidate[] = [];

  const tailUnitIndex = findLastUnitNearTail(tokens, lastMoneyEntry.index);
  if (tailUnitIndex !== null) {
    const quantityBeforeIndex = findLastNumericIndex(tokens, tailUnitIndex - 1, Math.max(0, tailUnitIndex - 3), true);
    if (quantityBeforeIndex !== -1) {
      const beforeUnitPrice = resolveUnitPriceFromTail(
        tokens,
        tailUnitIndex + 1,
        lastMoneyEntry.index,
        tokens[quantityBeforeIndex] ?? null,
        lastMoneyEntry.value,
      );

      if (beforeUnitPrice && beforeUnitPrice.value !== null) {
        const totalEntry = resolveTotalFromTail(
          tokens,
          beforeUnitPrice.index,
          lastMoneyEntry.index,
          beforeUnitPrice.value,
          tokens[quantityBeforeIndex] ?? null,
        );
        const description = cleanupDescriptionTokens(tokens.slice(0, quantityBeforeIndex));
        if (description && totalEntry) {
          candidates.push({
            rawText: line,
            description,
            quantity: parseQuantityValue(tokens[quantityBeforeIndex] ?? null, beforeUnitPrice.value, totalEntry.value),
            unit: stripAccents(tokens[tailUnitIndex] ?? '').toUpperCase() || null,
            unitPrice: beforeUnitPrice.value,
            totalValue: totalEntry.value,
          });
        }
      }
    }

    const quantityAfterIndex = findFirstNumericIndex(
      tokens,
      tailUnitIndex + 1,
      Math.min(lastMoneyEntry.index - 1, tailUnitIndex + 2),
      true,
    );
    if (quantityAfterIndex !== -1) {
      const afterUnitPrice = resolveUnitPriceFromTail(
        tokens,
        quantityAfterIndex + 1,
        lastMoneyEntry.index,
        tokens[quantityAfterIndex] ?? null,
        lastMoneyEntry.value,
      );

      if (afterUnitPrice && afterUnitPrice.value !== null) {
        const totalEntry = resolveTotalFromTail(
          tokens,
          afterUnitPrice.index,
          lastMoneyEntry.index,
          afterUnitPrice.value,
          tokens[quantityAfterIndex] ?? null,
        );
        const description = cleanupDescriptionTokens(tokens.slice(0, tailUnitIndex));
        if (description && totalEntry) {
          candidates.push({
            rawText: line,
            description,
            quantity: parseQuantityValue(tokens[quantityAfterIndex] ?? null, afterUnitPrice.value, totalEntry.value),
            unit: stripAccents(tokens[tailUnitIndex] ?? '').toUpperCase() || null,
            unitPrice: afterUnitPrice.value,
            totalValue: totalEntry.value,
          });
        }
      }
    }
  } else {
    const unitPriceIndex = lastMoneyEntry.index - 1;
    if (unitPriceIndex < 0) {
      return null;
    }

    const unitPrice = resolveBestUnitPriceValue(tokens[unitPriceIndex] ?? null, tokens[unitPriceIndex - 1] ?? null, lastMoneyEntry.value);
    if (unitPrice === null) {
      return null;
    }

    const quantityIndex = findLastNumericIndex(tokens, unitPriceIndex - 1, Math.max(0, unitPriceIndex - 3), true);
    if (quantityIndex === -1) {
      return null;
    }
    const unitIndex = findLeadingUnitIndex(tokens, quantityIndex);
    const totalEntry = resolveTotalFromTail(tokens, unitPriceIndex, lastMoneyEntry.index, unitPrice, tokens[quantityIndex] ?? null);
    if (!totalEntry) {
      return null;
    }

    const totalValue = totalEntry.value;
    const descriptionTokens = tokens.slice(0, quantityIndex).filter((_, index) => index !== unitIndex);
    const description = cleanupDescriptionTokens(descriptionTokens);
    if (!description) {
      return null;
    }

    candidates.push({
      rawText: line,
      description,
      quantity: parseQuantityValue(tokens[quantityIndex] ?? null, unitPrice, totalValue),
      unit: unitIndex !== null ? stripAccents(tokens[unitIndex] ?? '').toUpperCase() || null : null,
      unitPrice,
      totalValue,
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  return (
    candidates.sort(
      (left, right) =>
        buildCandidateScore(right, line, 1) - buildCandidateScore(left, line, 1) ||
        right.description.length - left.description.length,
    )[0] ?? null
  );
}

function tryParseTabularPattern(line: string): ParsedCandidate | null {
  const tokens = line.split(/\s+/).filter(Boolean);
  if (tokens.length < 5) {
    return null;
  }

  const candidates: ParsedCandidate[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    if (!isUnitToken(tokens[index])) {
      continue;
    }

    const quantityIndex = findLastNumericIndex(tokens, index - 1, Math.max(0, index - 2), true);
    if (quantityIndex === -1) {
      continue;
    }

    const totalEntry = findLastMoneyIndex(tokens);
    const unitPriceEntry = totalEntry
      ? resolveUnitPriceFromTail(tokens, index + 1, totalEntry.index, tokens[quantityIndex] ?? null, totalEntry.value)
      : null;
    const description = cleanupDescriptionTokens(tokens.slice(0, quantityIndex));
    if (!description || !totalEntry || !unitPriceEntry || unitPriceEntry.value === null) {
      continue;
    }

    candidates.push({
      rawText: line,
      description,
      quantity: parseQuantityValue(tokens[quantityIndex] ?? null, unitPriceEntry.value, totalEntry.value),
      unit: stripAccents(tokens[index] ?? '').toUpperCase() || null,
      unitPrice: unitPriceEntry.value,
      totalValue: totalEntry.value,
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  return (
    candidates.sort(
      (left, right) =>
        buildCandidateScore(right, line, 1) - buildCandidateScore(left, line, 1) ||
        right.description.length - left.description.length,
    )[0] ?? null
  );
}

function parseCandidateText(text: string, linesUsed: number): ParsedCandidateWithMeta | null {
  const normalizedText = normalizeLine(text);
  const candidates = [
    tryParseTrailingQuantityPattern(normalizedText),
    tryParseGenericTailPattern(normalizedText),
    tryParseTabularPattern(normalizedText),
  ].filter((candidate): candidate is ParsedCandidate => candidate !== null && Boolean(candidate.description) && candidate.unitPrice !== null);

  if (candidates.length === 0) {
    return null;
  }

  const scored = candidates.map((candidate) => ({
    candidate,
    score: buildCandidateScore(candidate, normalizedText, linesUsed),
  }));

  return scored.sort((left, right) => right.score - left.score || right.candidate.description.length - left.candidate.description.length)[0] ?? null;
}

function buildLineCandidates(lines: string[], index: number) {
  const current = lines[index] ?? '';
  const next = lines[index + 1] ?? null;
  const next2 = lines[index + 2] ?? null;
  const candidates: LineCandidate[] = [{ text: current, linesUsed: 1 }];

  if (!next || shouldSkipLine(next)) {
    return candidates;
  }

  const currentParses = Boolean(parseCandidateText(current, 1));
  const nextLooksLikeContinuation = isLikelyContinuationLine(next);

  if (!currentParses || nextLooksLikeContinuation) {
    candidates.push({
      text: `${current} ${next}`,
      linesUsed: 2,
    });
  }

  if (
    next2 &&
    !shouldSkipLine(next2) &&
    (!currentParses || (nextLooksLikeContinuation && isLikelyContinuationLine(next2)))
  ) {
    candidates.push({
      text: `${current} ${next} ${next2}`,
      linesUsed: 3,
    });
  }

  return candidates;
}

export function parseSupplierQuoteRows(text: string) {
  const sourceLines = text
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => normalizeLine(line))
    .filter(Boolean);

  const results: SupplierQuoteParsedRow[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < sourceLines.length; index += 1) {
    const line = sourceLines[index] ?? '';
    if (shouldSkipLine(line)) {
      continue;
    }

    const parsedCandidates = buildLineCandidates(sourceLines, index)
      .map((candidate) => {
        const parsed = parseCandidateText(candidate.text, candidate.linesUsed);
        return parsed ? { ...parsed, linesUsed: candidate.linesUsed } : null;
      })
      .filter(
        (
          candidate,
        ): candidate is ParsedCandidateWithMeta & {
          linesUsed: number;
        } => candidate !== null,
      );

    if (parsedCandidates.length === 0) {
      continue;
    }

    const best =
      parsedCandidates.sort(
        (left, right) =>
          right.score - left.score ||
          right.candidate.description.length - left.candidate.description.length ||
          right.linesUsed - left.linesUsed,
      )[0] ?? null;

    if (!best?.candidate?.description || best.candidate.unitPrice === null) {
      continue;
    }

    const key = `${normalizeSupplierQuoteMatchText(best.candidate.description)}|${best.candidate.unitPrice}|${best.candidate.totalValue ?? 'n'}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    results.push({
      rowIndex: results.length,
      rawText: best.candidate.rawText,
      description: best.candidate.description,
      quantity: best.candidate.quantity,
      unit: best.candidate.unit,
      unitPrice: best.candidate.unitPrice,
      totalValue: best.candidate.totalValue,
    });

    index += Math.max(0, Math.min(best.linesUsed, CONTINUATION_MAX_LINES) - 1);
  }

  return mergeParsedRows(
    mergeParsedRows(results, parseNumberedBlockRows(text)),
    parseUnnumberedBlockRows(text),
  );
}

function normalizeBrokenPriceText(text: string) {
  return normalizeWhitespace(
    text
      .replace(/(\d{1,3}(?:[.,]\d{3})*,\d)\s+(\d{1,2})(?=\s)/g, '$1$2')
      .replace(/(\d)\s+([.,]\d{2,4}\b)/g, '$1$2'),
  );
}

function parseSeparatedPriceLine(text: string) {
  const normalized = normalizeBrokenPriceText(text);
  const match = normalized.match(
    /(?:R\$?\s*)?(?<unitPrice>\d{1,4}(?:[.,]\d{3})*[.,]\d{2,4})\s+(?<qty>\d{1,4}(?:[.,]\d{1,3})?)\s+(?:R\$?\s*)?(?<total>\d{1,4}(?:[.,]\d{3})*[.,]\d{2,4})/i,
  );

  if (!match?.groups) {
    return null;
  }

  const unitPrice = parseMoneyToken(match.groups.unitPrice);
  const totalValue = parseMoneyToken(match.groups.total);
  const quantity = parseQuantityValue(match.groups.qty, unitPrice, totalValue);

  if (unitPrice === null || totalValue === null) {
    return null;
  }

  return {
    unitPrice,
    totalValue,
    quantity,
  };
}

function parseExplicitCurrencyInlineRow(line: string) {
  const normalized = normalizeBrokenPriceText(line);
  const match = normalized.match(
    /^\d{1,3}\s*[:.-]?\s*(?<description>.+?)\s+R\$?\s*(?<unitPrice>\d{1,4}(?:[.,]\d{3})*[.,]\d{2,4})\s+(?<qty>\d{1,4}(?:[.,]\d{1,3})?)\s+R\$?\s*(?<total>\d{1,4}(?:[.,]\d{3})*[.,]\d{2,4})\s*$/i,
  );

  if (!match?.groups) {
    return null;
  }

  const description = cleanupNumberedBlockDescription([match.groups.description]);
  const unitPrice = parseMoneyToken(match.groups.unitPrice);
  const totalValue = parseMoneyToken(match.groups.total);
  const quantity = parseQuantityValue(match.groups.qty, unitPrice, totalValue);

  if (!description || unitPrice === null || totalValue === null) {
    return null;
  }

  return {
    description,
    unitPrice,
    totalValue,
    quantity,
  };
}

function parseExplicitCurrencyInlineUnnumberedRow(line: string) {
  const normalized = normalizeBrokenPriceText(line);
  const match = normalized.match(
    /^(?<description>[A-ZÀ-ÿ].+?)\s+R\$?\s*(?<unitPrice>\d{1,4}(?:[.,]\d{3})*[.,]\d{2,4})\s+(?<qty>\d{1,4}(?:[.,]\d{1,3})?)\s+R\$?\s*(?<total>\d{1,4}(?:[.,]\d{3})*[.,]\d{2,4})\s*$/i,
  );

  if (!match?.groups) {
    return null;
  }

  const description = cleanupNumberedBlockDescription([match.groups.description]);
  const unitPrice = parseMoneyToken(match.groups.unitPrice);
  const totalValue = parseMoneyToken(match.groups.total);
  const quantity = parseQuantityValue(match.groups.qty, unitPrice, totalValue);

  if (!description || unitPrice === null || totalValue === null) {
    return null;
  }

  return {
    description,
    unitPrice,
    totalValue,
    quantity,
  };
}

function isLikelyNumberedDescriptionStart(line: string) {
  if (!/^\d{1,3}\b/.test(line) || !/[a-z]/i.test(line)) {
    return false;
  }

  const normalized = normalizeSupplierQuoteMatchText(line);
  return (
    normalized.length >= 4 &&
    !isPageMarkerNormalized(normalized) &&
    !HEADER_SKIP_PATTERNS.some((pattern) => normalized.includes(pattern))
  );
}

function stripLeadingItemNumberSegment(value: string) {
  return value.replace(/^\d{1,3}(?:\s*[:.-])?\s+(?=[^\d])/u, '');
}

function isPageMarkerNormalized(normalized: string) {
  return (
    /^\d+\s+of\s+\d+$/i.test(normalized) ||
    /^pagina\s+\d+$/i.test(normalized) ||
    /^pag\s+\d+$/i.test(normalized)
  );
}

function isLikelyTabularHeaderNormalized(normalized: string) {
  if (!normalized) {
    return false;
  }

  if (
    [
      'cod produto qtde',
      'codigo descricao',
      'cod descricao',
      'cod un produto',
      'descricao un quantidade',
      'qtde unid valor unit',
      'quantidade unitario total',
      'valor unit',
      'valor total',
      'preco c desc',
      'pco c desc',
      'vi total',
      'p liquido',
    ].some((pattern) => normalized.includes(pattern))
  ) {
    return true;
  }

  const headerTokenCount = normalized
    .split(' ')
    .filter((token) =>
      new Set([
        'cod',
        'codigo',
        'descricao',
        'qtde',
        'quantidade',
        'unid',
        'unitario',
        'valor',
        'total',
        'produto',
        'embalagem',
      ]).has(token),
    ).length;

  return headerTokenCount >= 4;
}

function cleanupNumberedDescriptionStart(line: string) {
  return normalizeWhitespace(stripLeadingItemNumberSegment(line).replace(/^[:.-]+\s*/, ''));
}

function cleanupNumberedBlockDescription(parts: string[]) {
  return normalizeWhitespace(
    parts
      .map((part) => stripLeadingItemNumberSegment(part))
      .join(' ')
      .replace(/\s*[-–—]+\s*/g, ' ')
      .replace(/\s+,/g, ',')
      .replace(/\s+\./g, '.')
      .replace(/\s+:/g, ':')
      .replace(/^[:.-]+\s*/, ''),
  );
}

function buildParsedRowMergeKey(row: Pick<SupplierQuoteParsedRow, 'description' | 'quantity' | 'unitPrice' | 'totalValue'>) {
  return [
    normalizeSupplierQuoteMatchText(row.description),
    row.quantity ?? 'q:null',
    row.unitPrice ?? 'u:null',
    row.totalValue ?? 't:null',
  ].join('|');
}

function mergeParsedRows(primary: SupplierQuoteParsedRow[], secondary: SupplierQuoteParsedRow[]) {
  const merged = new Map<string, SupplierQuoteParsedRow>();

  for (const row of [...primary, ...secondary]) {
    const key = buildParsedRowMergeKey(row);
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, {
        ...row,
        rowIndex: merged.size,
      });
      continue;
    }

    const keepCurrent =
      row.description.length > existing.description.length ||
      (existing.unit == null && row.unit != null) ||
      (existing.quantity == null && row.quantity != null);

    if (keepCurrent) {
      merged.set(key, {
        ...row,
        rowIndex: existing.rowIndex,
      });
    }
  }

  const scoreRow = (row: SupplierQuoteParsedRow) =>
    row.description.trim().length +
    (row.unit ? 12 : 0) +
    (row.totalValue && row.totalValue > 0 ? 20 : 0) +
    (row.quantity && row.quantity >= 1 ? 12 : 0) +
    (Number.isInteger(row.quantity ?? Number.NaN) ? 6 : 0);

  const dedupedByRawText = new Map<string, SupplierQuoteParsedRow>();
  for (const row of merged.values()) {
    const rawKey = normalizeWhitespace(row.rawText);
    const existing = dedupedByRawText.get(rawKey);
    if (!existing || scoreRow(row) > scoreRow(existing)) {
      dedupedByRawText.set(rawKey, row);
    }
  }

  return [...dedupedByRawText.values()]
    .filter((row) => row.description.trim().length > 0)
    .sort((left, right) => left.rowIndex - right.rowIndex)
    .map((row, index) => ({
      ...row,
      rowIndex: index,
    }));
}

function parseNumberedBlockRows(text: string) {
  const lines = text
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => normalizeLine(line))
    .filter(Boolean);

  const results: SupplierQuoteParsedRow[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < lines.length; index += 1) {
    const startLine = lines[index] ?? '';
    if (!isLikelyNumberedDescriptionStart(startLine)) {
      continue;
    }

    const inlineCurrencyRow = parseExplicitCurrencyInlineRow(startLine);
    if (inlineCurrencyRow) {
      const key = `${normalizeSupplierQuoteMatchText(inlineCurrencyRow.description)}|${inlineCurrencyRow.unitPrice}|${inlineCurrencyRow.totalValue}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({
          rowIndex: results.length,
          rawText: startLine,
          description: inlineCurrencyRow.description,
          quantity: inlineCurrencyRow.quantity,
          unit: null,
          unitPrice: inlineCurrencyRow.unitPrice,
          totalValue: inlineCurrencyRow.totalValue,
        });
      }
      continue;
    }

    const descriptionParts = [cleanupNumberedDescriptionStart(startLine)];
    const rawParts = [startLine];
    let priceParsed: { unitPrice: number; totalValue: number; quantity: number | null } | null = null;
    let linesUsed = 1;

    for (let offset = 1; offset <= 5 && index + offset < lines.length; offset += 1) {
      const nextLine = lines[index + offset] ?? '';

      if (isLikelyNumberedDescriptionStart(nextLine)) {
        break;
      }

      const hasPriceSignal = /R\$/i.test(nextLine) || countMoneyTokens(nextLine) > 0;
      if (!hasPriceSignal) {
        const normalizedNext = normalizeSupplierQuoteMatchText(nextLine);
        if (
          normalizedNext &&
          !HEADER_SKIP_PATTERNS.some((pattern) => normalizedNext.includes(pattern)) &&
          !isPageMarkerNormalized(normalizedNext)
        ) {
          descriptionParts.push(nextLine);
          rawParts.push(nextLine);
        }
        continue;
      }

      const singlePrice = parseSeparatedPriceLine(nextLine);
      const combinedPrice =
        !singlePrice && offset < 5 && index + offset + 1 < lines.length
          ? parseSeparatedPriceLine(`${nextLine} ${lines[index + offset + 1] ?? ''}`)
          : null;

      if (singlePrice || combinedPrice) {
        priceParsed = singlePrice ?? combinedPrice;
        rawParts.push(nextLine);
        linesUsed = offset + 1;
        if (!singlePrice && combinedPrice && index + offset + 1 < lines.length) {
          rawParts.push(lines[index + offset + 1] ?? '');
          linesUsed = offset + 2;
        }
        break;
      }

      const normalizedNext = normalizeSupplierQuoteMatchText(nextLine);
      if (
        normalizedNext &&
        !HEADER_SKIP_PATTERNS.some((pattern) => normalizedNext.includes(pattern)) &&
        !isPageMarkerNormalized(normalizedNext)
      ) {
        descriptionParts.push(nextLine);
        rawParts.push(nextLine);
      }
    }

    const description = cleanupNumberedBlockDescription(descriptionParts);
    if (!description || !priceParsed) {
      continue;
    }

    const key = `${normalizeSupplierQuoteMatchText(description)}|${priceParsed.unitPrice}|${priceParsed.totalValue}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    results.push({
      rowIndex: results.length,
      rawText: rawParts.join(' '),
      description,
      quantity: priceParsed.quantity,
      unit: null,
      unitPrice: priceParsed.unitPrice,
      totalValue: priceParsed.totalValue,
    });

    index += Math.max(0, linesUsed - 1);
  }

  return results;
}

function isLikelyStandaloneDescriptionLine(line: string) {
  if (!/[a-z]/i.test(line) || /R\$/i.test(line) || countMoneyTokens(line) > 0) {
    return false;
  }

  const normalized = normalizeSupplierQuoteMatchText(line);
  if (!normalized || normalized.length < 5 || isPageMarkerNormalized(normalized) || isLikelyTabularHeaderNormalized(normalized)) {
    return false;
  }

  return ![
    ...HEADER_SKIP_PATTERNS,
    'prezados',
    'objeto',
    'trata se',
    'cotacao comercial',
    'prestacao de servico',
    'forne imento',
    'validade de 30 dias',
    'proposta',
    'boa vista',
    'roraimed',
    'seguranca do trabalho',
    'cnpj',
    'item quant preco',
    'preco uni',
  ].some((pattern) => normalized.includes(pattern));
}

function isLikelyDescriptionContinuationLine(line: string, previousDescriptionParts: string[]) {
  if (isLikelyStandaloneDescriptionLine(line)) {
    return true;
  }

  const normalized = normalizeSupplierQuoteMatchText(line);
  if (!normalized) {
    return false;
  }

  if (/^[a-z]{1,3}$/.test(normalized) || /^[a-z]{1,3}\s+[a-z]{1,3}$/.test(normalized)) {
    return true;
  }

  if (/^ca[: ]?\d{3,6}$/i.test(normalized) || /^c a \d{3,6}$/i.test(normalized)) {
    return true;
  }

  if (/^\d{4,6}$/.test(normalized) && previousDescriptionParts.some((part) => /\bC\.?A\b/i.test(part))) {
    return true;
  }

  return false;
}

function parseUnnumberedBlockRows(text: string) {
  const lines = text
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => normalizeLine(line))
    .filter(Boolean);

  const results: SupplierQuoteParsedRow[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < lines.length; index += 1) {
    const startLine = lines[index] ?? '';
    const inlineCurrencyRow = parseExplicitCurrencyInlineUnnumberedRow(startLine);
    if (inlineCurrencyRow) {
      const key = `${normalizeSupplierQuoteMatchText(inlineCurrencyRow.description)}|${inlineCurrencyRow.unitPrice}|${inlineCurrencyRow.totalValue}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({
          rowIndex: results.length,
          rawText: startLine,
          description: inlineCurrencyRow.description,
          quantity: inlineCurrencyRow.quantity,
          unit: null,
          unitPrice: inlineCurrencyRow.unitPrice,
          totalValue: inlineCurrencyRow.totalValue,
        });
      }
      continue;
    }

    if (!isLikelyStandaloneDescriptionLine(startLine)) {
      continue;
    }

    const descriptionParts = [startLine];
    const rawParts = [startLine];
    let priceParsed: { unitPrice: number; totalValue: number; quantity: number | null } | null = null;
    let linesUsed = 1;

    for (let offset = 1; offset <= 5 && index + offset < lines.length; offset += 1) {
      const nextLine = lines[index + offset] ?? '';

      if (isLikelyNumberedDescriptionStart(nextLine)) {
        break;
      }

      const hasPriceSignal = /R\$/i.test(nextLine) || countMoneyTokens(nextLine) > 0;
      if (!hasPriceSignal) {
        if (!isLikelyDescriptionContinuationLine(nextLine, descriptionParts)) {
          break;
        }

        descriptionParts.push(nextLine);
        rawParts.push(nextLine);
        continue;
      }

      const singlePrice = parseSeparatedPriceLine(nextLine);
      const combinedPrice =
        !singlePrice && offset < 5 && index + offset + 1 < lines.length
          ? parseSeparatedPriceLine(`${nextLine} ${lines[index + offset + 1] ?? ''}`)
          : null;

      if (singlePrice || combinedPrice) {
        priceParsed = singlePrice ?? combinedPrice;
        rawParts.push(nextLine);
        linesUsed = offset + 1;
        if (!singlePrice && combinedPrice && index + offset + 1 < lines.length) {
          rawParts.push(lines[index + offset + 1] ?? '');
          linesUsed = offset + 2;
        }
      }
      break;
    }

    const description = cleanupNumberedBlockDescription(descriptionParts);
    if (!description || !priceParsed) {
      continue;
    }

    const key = `${normalizeSupplierQuoteMatchText(description)}|${priceParsed.unitPrice}|${priceParsed.totalValue}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    results.push({
      rowIndex: results.length,
      rawText: rawParts.join(' '),
      description,
      quantity: priceParsed.quantity,
      unit: null,
      unitPrice: priceParsed.unitPrice,
      totalValue: priceParsed.totalValue,
    });

    index += Math.max(0, linesUsed - 1);
  }

  return results;
}

function parseDateToIso(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
  if (!match) {
    return null;
  }

  const [, dd, mm, yy] = match;
  const year = yy.length === 2 ? `20${yy}` : yy;
  return `${year}-${mm}-${dd}`;
}

function parseHeaderQuoteNumber(lines: string[]) {
  const normalizedLines = lines.map((line) => stripAccents(line).replace(/\s+/g, ' ').trim());
  const patterns = [
    /orcamento\s+nr\.?\s*[:.]?\s*([0-9./-]+)/i,
    /orcamento\s+n(?:ro|o)?\.?\s*[:.]?\s*([0-9./-]+)/i,
    /orcamento[^0-9]{0,12}([0-9][0-9./-]{2,})/i,
    /num(?:ero)?\.?\s*orcamento\s*[:.]?\s*([a-z0-9./-]+)/i,
    /num[^0-9]{0,20}([0-9./-]{3,})/i,
    /pedido\s*n[^a-z0-9]{0,3}\s*[:.]?\s*([a-z0-9./-]+)/i,
    /romaneio\s*[:.]?\s*([a-z0-9./-]+)/i,
  ];

  for (const line of normalizedLines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      const value = match?.[1]?.trim();
      if (
        value &&
        !['CLIENTE', 'DE', 'ENDERECO', 'NUM', 'DATA'].includes(value.toUpperCase()) &&
        !/^\d{2}\/\d{2}\/\d{2,4}$/.test(value)
      ) {
        return value.toUpperCase();
      }
    }
  }

  return null;
}

function sanitizeSupplierHeaderLine(line: string) {
  const sanitized = normalizeWhitespace(
    line
      .replace(/^\d+\s*[-.:]\s*/, '')
      .replace(/\bOR[CÇ]AMENTO.*$/i, '')
      .replace(/\bCNPJ:.*$/i, '')
      .replace(/\bCPF\/CNPJ:.*$/i, ''),
  );

  const legalEntityMatch = sanitized.match(/([A-Z][A-Z0-9.&'/-]*(?:\s+[A-Z0-9.&'/-]+){1,10}\s+(?:LTDA|ME|EPP|S\/A))/i);
  if (legalEntityMatch?.[1]) {
    return normalizeWhitespace(legalEntityMatch[1]);
  }

  return sanitized;
}

function scoreSupplierLine(line: string) {
  const sanitized = sanitizeSupplierHeaderLine(line);
  const normalized = normalizeSupplierQuoteMatchText(sanitized);
  if (!normalized || HEADER_SUPPLIER_SKIP_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 0;

  if (/(?:ltda|me|epp|s\/a|comercio|ferragens|suprimentos|hospitalares|produtos|medicos|distribuidora)/i.test(sanitized)) {
    score += 10;
  }

  if (!/\d{4,}/.test(sanitized)) {
    score += 5;
  }

  if (!/@/.test(sanitized) && !/www\./i.test(sanitized)) {
    score += 2;
  }

  if (sanitized === sanitized.toUpperCase()) {
    score += 3;
  }

  if (sanitized.length >= 10 && sanitized.length <= 90) {
    score += 3;
  }

  if (/cnpj|cpf|cep|fone|telefone|cliente|endereco|cidade|bairro/i.test(sanitized)) {
    score -= 8;
  }

  if (/\d{2}\/\d{2}\/\d{2,4}/.test(sanitized)) {
    score -= 6;
  }

  return score;
}

export function extractHeaderInfo(text: string) {
  const lines = text
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => normalizeLine(line))
    .filter(Boolean)
    .slice(0, 60);

  const quoteNumber = parseHeaderQuoteNumber(lines);
  const dateMatch = lines.join(' ').match(/\b\d{2}\/\d{2}\/\d{2,4}\b/);
  const supplierLines = lines.slice(0, 8);

  let supplierNameDetected: string | null = null;
  const topSupplierLine =
    [...supplierLines]
      .sort((left, right) => scoreSupplierLine(right) - scoreSupplierLine(left))
      .find((line) => scoreSupplierLine(line) > 0) ?? null;

  if (topSupplierLine) {
    supplierNameDetected = sanitizeSupplierHeaderLine(topSupplierLine);
  } else {
    supplierNameDetected = sanitizeSupplierHeaderLine(lines[0] ?? '');
  }

  return {
    supplierNameDetected: supplierNameDetected ? normalizeWhitespace(supplierNameDetected) : null,
    quoteNumber,
    quoteDate: dateMatch ? parseDateToIso(dateMatch[0]) : null,
  };
}

type SupplierQuoteHeaderInfo = ReturnType<typeof extractHeaderInfo>;

function scoreSupplierHeaderName(value: string | null | undefined) {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = value.trim().length;
  if (/(?:LTDA|ME|EPP|S\/A|COMERCIO|DISTRIBUIDORA|FERRAGENS|SUPRIMENTOS|HOSPITALARES)/i.test(value)) {
    score += 18;
  }
  if (!/\bME\b/i.test(value) && value.length > 20) {
    score += 8;
  }
  if (/[A-Z&.'/-]{4,}/.test(value)) {
    score += 4;
  }
  return score;
}

function scoreQuoteNumber(value: string | null | undefined) {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = value.length;
  if (/^\d+$/.test(value.replace(/[./-]/g, ''))) {
    score += 12;
  }
  if (/^\d{3,}$/.test(value.replace(/[./-]/g, ''))) {
    score += 8;
  }
  if (/[./-]/.test(value)) {
    score += 4;
  }
  if (value.length > 18) {
    score -= 20;
  }
  return score;
}

function mergeQuoteHeaderInfos(primary: SupplierQuoteHeaderInfo, secondary: SupplierQuoteHeaderInfo | null | undefined): SupplierQuoteHeaderInfo {
  if (!secondary) {
    return primary;
  }

  return {
    supplierNameDetected:
      scoreSupplierHeaderName(secondary.supplierNameDetected) > scoreSupplierHeaderName(primary.supplierNameDetected)
        ? secondary.supplierNameDetected
        : primary.supplierNameDetected,
    quoteNumber: scoreQuoteNumber(secondary.quoteNumber) > scoreQuoteNumber(primary.quoteNumber) ? secondary.quoteNumber : primary.quoteNumber,
    quoteDate: primary.quoteDate ?? secondary.quoteDate,
  };
}

function inferQuantityFromPrices(unitPrice: number | null, totalValue: number | null) {
  if (unitPrice === null || totalValue === null || unitPrice <= 0) {
    return null;
  }

  const rawQuantity = totalValue / unitPrice;
  if (!Number.isFinite(rawQuantity) || rawQuantity <= 0) {
    return null;
  }

  const roundedInteger = Math.round(rawQuantity);
  if (Math.abs(rawQuantity - roundedInteger) <= 0.06) {
    return roundedInteger;
  }

  return Number(rawQuantity.toFixed(2));
}

function parseSparseTablePriceLine(line: string) {
  const priceMatches = [...line.matchAll(/(?:R\$?\s*)?(\d{1,3}(?:\.\d{3})*,\d{2,4}|\d+\.\d{2,4})/gi)]
    .map((match) => parseMoneyToken(match[1]))
    .filter((value): value is number => value !== null);

  if (priceMatches.length < 2) {
    return null;
  }

  return {
    unitPrice: priceMatches[0] ?? null,
    totalValue: priceMatches[1] ?? null,
  };
}

function isSparseDescriptionLine(line: string) {
  if (!/[a-z]/i.test(line) || countMoneyTokens(line) > 0 || /r\$\s*\d/i.test(line)) {
    return false;
  }

  const normalized = normalizeSupplierQuoteMatchText(line);
  if (!normalized || normalized.length < 8) {
    return false;
  }

  const alphaTokens = normalized.split(' ').filter((token) => /[a-z]/.test(token));
  if (alphaTokens.length < 2 || alphaTokens.filter((token) => token.length >= 4).length < 2) {
    return false;
  }

  return ![
    'pagina',
    'table sparse',
    'regiao',
    'descricao',
    'codigo',
    'qtde',
    'subtotal',
    'total',
    'observacoes',
    'forma de negociacao',
    'cliente',
    'endereco',
    'cidade',
    'bairro',
    'referencia',
    'keferencia',
    'marca',
    'descri',
    'negocia',
    'vir unit',
    'lotal unit',
  ].some((pattern) => normalized.includes(pattern));
}

function parseSparseTableRows(text: string) {
  const lines = text
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => normalizeLine(line))
    .filter(Boolean);

  const descriptions = lines.filter(isSparseDescriptionLine);
  const prices = lines
    .filter((line) => !/subtotal|total\s*:|desconto/i.test(line))
    .map((line) => ({
      line,
      parsed: parseSparseTablePriceLine(line),
    }))
    .filter((entry) => entry.parsed !== null);

  const limit = Math.min(descriptions.length, prices.length);
  const results: SupplierQuoteParsedRow[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < limit; index += 1) {
    const description = cleanupDescriptionTokens((descriptions[index] ?? '').split(/\s+/));
    const parsedPrice = prices[index]?.parsed;
    const unitPrice = parsedPrice?.unitPrice ?? null;
    const totalValue = parsedPrice?.totalValue ?? null;

    if (!description || unitPrice === null) {
      continue;
    }

    const key = `${normalizeSupplierQuoteMatchText(description)}|${unitPrice}|${totalValue ?? 'n'}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    results.push({
      rowIndex: results.length,
      rawText: `${descriptions[index] ?? ''} ${prices[index]?.line ?? ''}`.trim(),
      description,
      quantity: inferQuantityFromPrices(unitPrice, totalValue),
      unit: null,
      unitPrice,
      totalValue,
    });
  }

  return results;
}

async function extractSparseTableRowsViaOcr(buffer: Buffer) {
  const sparseText = repairUtf8MisinterpretedAsLatin1(
    (
      await extractPdfTextViaOcr(buffer, {
        maxPages: 1,
        renderScale: 400,
        pageSegMode: 3,
        regions: [
          {
            pageNumber: 1,
            xRatio: 0,
            yRatio: 0.22,
            widthRatio: 1,
            heightRatio: 0.09,
            label: 'table-sparse-primary',
          },
        ],
      })
    ).trim(),
  );

  return {
    text: sparseText,
    rows: parseSparseTableRows(sparseText),
  };
}

function countMeaningfulLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => normalizeLine(line))
    .filter(Boolean).length;
}

function shouldAttemptOcr(directText: string, directRows: SupplierQuoteParsedRow[]) {
  if (directText.trim().length < DIRECT_TEXT_MIN_LENGTH) {
    return true;
  }

  if (/^--\s*\d+\s+of\s+\d+\s*--/i.test(directText.trim())) {
    return true;
  }

  if (directRows.length === 0) {
    return true;
  }

  if (directRows.length < 2 && countMeaningfulLines(directText) > 12) {
    return true;
  }

  return false;
}

function scoreExtraction(rows: SupplierQuoteParsedRow[], header: ReturnType<typeof extractHeaderInfo>) {
  return rows.reduce(
    (total, row) =>
      total +
      row.description.split(/\s+/).filter(Boolean).length * 4 +
      (row.quantity !== null ? 10 : 0) +
      (row.totalValue !== null ? 8 : 0),
    0,
  ) +
    (header.supplierNameDetected ? 12 : 0) +
    (header.quoteNumber ? 8 : 0) +
    (header.quoteDate ? 6 : 0);
}

async function extractDirectText(buffer: Buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return repairUtf8MisinterpretedAsLatin1((result.text ?? '').trim());
  } finally {
    await parser.destroy();
  }
}

export async function extractSupplierQuotePdfPreview(buffer: Buffer, originalFileName: string): Promise<SupplierQuotePdfPreview> {
  const directText = await extractDirectText(buffer);
  const directRows = parseSupplierQuoteRows(directText);
  const directHeader = extractHeaderInfo(directText);

  let bestPreview: SupplierQuotePdfPreview | null =
    directRows.length > 0
      ? {
          extractionMode: 'DIRECT_TEXT',
          fullText: directText,
          supplierNameDetected: directHeader.supplierNameDetected,
          quoteNumber: directHeader.quoteNumber,
          quoteDate: directHeader.quoteDate,
          rows: directRows,
        }
      : null;

  let lastOcrText: string | null = null;
  let lastOcrHeader: ReturnType<typeof extractHeaderInfo> | null = null;
  if (shouldAttemptOcr(directText, directRows)) {
    const ocrText = repairUtf8MisinterpretedAsLatin1((await extractPdfTextViaOcr(buffer)).trim());
    const ocrRows = parseSupplierQuoteRows(ocrText);
    const ocrHeader = extractHeaderInfo(ocrText);
    lastOcrText = ocrText;
    lastOcrHeader = ocrHeader;

    if (ocrRows.length > 0) {
      const ocrPreview: SupplierQuotePdfPreview = {
        extractionMode: 'OCR',
        fullText: ocrText,
        supplierNameDetected: mergeQuoteHeaderInfos(ocrHeader, directHeader).supplierNameDetected,
        quoteNumber: mergeQuoteHeaderInfos(ocrHeader, directHeader).quoteNumber,
        quoteDate: mergeQuoteHeaderInfos(ocrHeader, directHeader).quoteDate,
        rows: ocrRows,
      };

      if (!bestPreview || ocrRows.length > directRows.length || scoreExtraction(ocrRows, ocrHeader) > scoreExtraction(directRows, directHeader)) {
        bestPreview = ocrPreview;
      }
    }
  }

  if (!bestPreview) {
    const sparseFallback = await extractSparseTableRowsViaOcr(buffer);
    if (sparseFallback.rows.length > 0) {
      const header = mergeQuoteHeaderInfos(lastOcrHeader ?? directHeader, directHeader);
      return {
        extractionMode: 'OCR',
        fullText: [lastOcrText, sparseFallback.text].filter(Boolean).join('\n\n'),
        supplierNameDetected: header.supplierNameDetected,
        quoteNumber: header.quoteNumber,
        quoteDate: header.quoteDate,
        rows: sparseFallback.rows,
      };
    }
  }

  if (bestPreview) {
    return bestPreview;
  }

  throw new Error(`Nao foi possivel identificar linhas de orcamento no PDF ${originalFileName}.`);
}
