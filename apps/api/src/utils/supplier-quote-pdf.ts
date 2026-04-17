import path from 'node:path';

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
  'entrega',
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
  'dados da venda',
  'entrega',
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
  'qtd',
  'quantidade',
  'valor',
  'total',
  'combinar',
  'definir',
  'informar',
  'consumidor',
  'mercadorias',
  'romaneio',
  'situacao',
  'aberto',
  'frete',
  'cif',
  'pagto',
  'pagamento',
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

  if (cleaned.includes(',') && cleaned.includes('.')) {
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    cleaned = lastDot > lastComma ? cleaned.replace(/,/g, '') : cleaned.replace(/\./g, '').replace(',', '.');
  } else if ((cleaned.match(/,/g) ?? []).length > 1 && !cleaned.includes('.')) {
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

  while (
    filtered.length > 2 &&
    isLeadingCodeToken(filtered[0]) &&
    parseNumericToken(filtered[1]) !== null &&
    isUnitToken(filtered[2])
  ) {
    filtered.shift();
    filtered.shift();
    filtered.shift();
  }

  while (
    filtered.length > 1 &&
    isUnitToken(filtered[filtered.length - 1]) &&
    parseNumericToken(filtered[filtered.length - 2]) === null &&
    !['UNIDADE', 'CAIXA', 'PACOTE', 'PARES'].includes(stripAccents(filtered[filtered.length - 1] ?? '').toUpperCase())
  ) {
    filtered.pop();
  }

  const compact = filtered.filter((token) => !isInlineProductCodeToken(token));
  return normalizeWhitespace(compact.join(' ')).replace(/[.,:;-]+$/g, '').trim();
}

function shouldSkipLine(line: string) {
  const normalized = normalizeSupplierQuoteMatchText(line);
  if (!normalized) {
    return true;
  }
  if (normalized.length < 4) {
    return true;
  }
  const hasDigit = /\d/.test(normalized);
  if (!hasDigit) {
    return true;
  }
  const hasLetter = /[a-z]/i.test(normalized);
  if (!hasLetter) {
    /** Linhas só com quantidade + valores (ex.: `03 R$ 1.670,00 R$ 5.010,00`) — antes eram ignoradas. */
    if (countMoneyTokens(line) >= 2 && /^\d+/.test(normalized.trim())) {
      return false;
    }
    return true;
  }
  if (HEADER_SKIP_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    return true;
  }
  if (/\b(?:qtd|atd|ata)\s*[:.]?\s*\d/i.test(stripAccents(line))) {
    return true;
  }
  /** Só ignora cabeçalhos "Valor:" / "Total:" sem valores monetários na linha (evita esconder resumos com R$). */
  if (
    (/\bvalor\s*[:.]/i.test(stripAccents(line)) || /\btotal\s*[:.]/i.test(stripAccents(line))) &&
    countMoneyTokens(line) === 0
  ) {
    return true;
  }
  /** Linha só com subtotal "Total: 20,00" (CamScanner) — não é item; resumos longos com "Valor unitário" seguem parseando. */
  const trimmedForTotal = normalizeLine(line).trim();
  if (/^Total\s*:\s*R?\$?\s*[\d.,]+\s*$/i.test(trimmedForTotal) || /^Total\s*:\s*[\d.,]+\s*$/i.test(trimmedForTotal)) {
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
  if (startsWithProductLabel(line)) {
    return true;
  }

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

function resolveUnitPriceAndTotalFromMoneyValues(quantityRaw: string | null | undefined, values: number[]) {
  const candidates = uniqueNumbers(values.filter((value) => Number.isFinite(value) && value > 0));
  if (candidates.length < 2) {
    return null;
  }

  const quantity = parseNumericToken(quantityRaw);
  const combinations: Array<{ unitPrice: number; totalValue: number; delta: number }> = [];

  for (let unitIndex = 0; unitIndex < candidates.length; unitIndex += 1) {
    for (let totalIndex = 0; totalIndex < candidates.length; totalIndex += 1) {
      if (unitIndex === totalIndex) {
        continue;
      }

      const unitPrice = candidates[unitIndex] ?? null;
      const totalValue = candidates[totalIndex] ?? null;
      if (unitPrice === null || totalValue === null || unitPrice <= 0 || totalValue <= 0) {
        continue;
      }

      const stabilizedQuantity =
        quantity === null ? inferQuantityFromPrices(unitPrice, totalValue) : stabilizeQuantity(quantity, unitPrice, totalValue);
      const expectedTotal =
        stabilizedQuantity !== null && stabilizedQuantity > 0 ? stabilizedQuantity * unitPrice : unitPrice;
      const delta = Math.abs(expectedTotal - totalValue) / Math.max(totalValue, 1);

      combinations.push({
        unitPrice,
        totalValue,
        delta: delta + (totalValue + 0.001 < unitPrice ? 0.5 : 0),
      });
    }
  }

  return combinations.sort((left, right) => left.delta - right.delta || left.unitPrice - right.unitPrice)[0] ?? null;
}

function tryParseQuantityFirstCatalogPattern(line: string): ParsedCandidate | null {
  const normalized = normalizeBrokenPriceText(line);
  const match = normalized.match(
    /^(?<qty>\d{1,4}(?:[.,]\d{1,3})?)\s+(?<unit>[A-Z]{1,6})\s+(?<description>.+?)\s+(?<money1>\d{1,4}(?:[.,]\d{3})*[.,]\d{2,4})\s+(?<money2>\d{1,4}(?:[.,]\d{3})*[.,]\d{2,4})(?:\s+(?<money3>\d{1,4}(?:[.,]\d{3})*[.,]\d{2,4}))?(?:\s+\d{1,8})?\s*$/i,
  );

  if (!match?.groups || !isUnitToken(match.groups.unit)) {
    return null;
  }

  const description = cleanupDescriptionTokens(match.groups.description.split(/\s+/));
  const pricing = resolveUnitPriceAndTotalFromMoneyValues(match.groups.qty, [
    parseMoneyToken(match.groups.money1) ?? NaN,
    parseMoneyToken(match.groups.money2) ?? NaN,
    parseMoneyToken(match.groups.money3) ?? NaN,
  ]);

  if (!description || !pricing) {
    return null;
  }

  return {
    rawText: line,
    description,
    quantity: parseQuantityValue(match.groups.qty, pricing.unitPrice, pricing.totalValue),
    unit: stripAccents(match.groups.unit).toUpperCase(),
    unitPrice: pricing.unitPrice,
    totalValue: pricing.totalValue,
  };
}

function tryParseCodeFirstCatalogPattern(line: string): ParsedCandidate | null {
  const normalized = normalizeBrokenPriceText(line);
  const match = normalized.match(
    /^(?<code>[A-Z0-9/-]{1,16})\s+(?<description>.+?)\s+(?<unit>[A-Z]{1,6})\s+(?<qty>\d{1,4}(?:[.,]\d{1,3})?)\s+(?<money1>\d{1,4}(?:[.,]\d{3})*[.,]\d{2,4})\s+(?<money2>\d{1,4}(?:[.,]\d{3})*[.,]\d{2,4})(?:\s+(?<money3>\d{1,4}(?:[.,]\d{3})*[.,]\d{2,4}))?\s*$/i,
  );

  if (!match?.groups || !isUnitToken(match.groups.unit)) {
    return null;
  }

  const description = cleanupDescriptionTokens(match.groups.description.split(/\s+/));
  const pricing = resolveUnitPriceAndTotalFromMoneyValues(match.groups.qty, [
    parseMoneyToken(match.groups.money1) ?? NaN,
    parseMoneyToken(match.groups.money2) ?? NaN,
    parseMoneyToken(match.groups.money3) ?? NaN,
  ]);

  if (!description || !pricing) {
    return null;
  }

  return {
    rawText: line,
    description,
    quantity: parseQuantityValue(match.groups.qty, pricing.unitPrice, pricing.totalValue),
    unit: stripAccents(match.groups.unit).toUpperCase(),
    unitPrice: pricing.unitPrice,
    totalValue: pricing.totalValue,
  };
}

function tryParseItemCodeQuantityUnitPattern(line: string): ParsedCandidate | null {
  const normalized = normalizeBrokenPriceText(line);
  const match = normalized.match(
    /^(?:(?<itemNo>\d{1,3})\s+)?(?<code>[A-Z0-9/-]{3,})\s+['’]?\s*(?<qty>\d{1,4}(?:[.,]\d{1,3})?)\s+(?<unit>[A-Z]{1,6})\s+(?<description>.+?)\s+(?:[|"'`Oo\s]{0,16})?(?<unitPrice>\d{1,4}(?:[.,]\d{3})*[.,]\d{2,4})\s*[—-]?\s*(?<total>\d{1,4}(?:[.,]\d{3})*[.,]\d{2,4})\s*$/i,
  );

  if (!match?.groups || !isUnitToken(match.groups.unit)) {
    return null;
  }

  const description = cleanupDescriptionTokens(match.groups.description.split(/\s+/));
  const unitPrice = parseMoneyToken(match.groups.unitPrice);
  const totalValue = parseMoneyToken(match.groups.total);
  if (!description || unitPrice === null || totalValue === null) {
    return null;
  }

  return {
    rawText: line,
    description,
    quantity: parseQuantityValue(match.groups.qty, unitPrice, totalValue),
    unit: stripAccents(match.groups.unit).toUpperCase(),
    unitPrice,
    totalValue,
  };
}

function tryParseLeadingQuantityProposalPattern(line: string): ParsedCandidate | null {
  const normalized = normalizeBrokenPriceText(line);
  const match = normalized.match(
    /^(?<qty>\d{1,4}(?:[.,]\d{1,3})?)\s+(?:C[OÓ]D:\s*[A-Z0-9/-]+\s*-\s*)?(?<description>.+?)\s+(?:R\$?\s*)?(?<unitPrice>\d{1,4}(?:[.,]\d{3})*[.,]\d{2,4})\s+(?:R\$?\s*)?(?<total>\d{1,4}(?:[.,]\d{3})*[.,]\d{2,4})(?:\s+R\$?)?\s*$/i,
  );

  if (!match?.groups) {
    return null;
  }

  const description = cleanupDescriptionTokens(match.groups.description.split(/\s+/));
  const unitPrice = parseMoneyToken(match.groups.unitPrice);
  const totalValue = parseMoneyToken(match.groups.total);
  if (!description || unitPrice === null || totalValue === null) {
    return null;
  }

  return {
    rawText: line,
    description,
    quantity: parseQuantityValue(match.groups.qty, unitPrice, totalValue),
    unit: null,
    unitPrice,
    totalValue,
  };
}

function tryParseDescriptionQuantityProposalPattern(line: string): ParsedCandidate | null {
  const normalized = normalizeBrokenPriceText(line);
  const match = normalized.match(
    /^(?<description>[A-ZÀ-ÿ0-9].+?)\s+(?<qty>\d{1,4}(?:[.,]\d{1,3})?)\s+(?:R\$?\s*)?(?<unitPrice>\d{1,4}(?:[.,]\d{3})*[.,]\d{2,4})\s+(?:R\$?\s*)?(?<total>\d{1,4}(?:[.,]\d{3})*[.,]\d{2,4})(?:\s+R\$?)?\s*$/i,
  );

  if (!match?.groups) {
    return null;
  }

  const description = cleanupDescriptionTokens(match.groups.description.split(/\s+/));
  const unitPrice = parseMoneyToken(match.groups.unitPrice);
  const totalValue = parseMoneyToken(match.groups.total);
  if (!description || unitPrice === null || totalValue === null) {
    return null;
  }

  return {
    rawText: line,
    description,
    quantity: parseQuantityValue(match.groups.qty, unitPrice, totalValue),
    unit: null,
    unitPrice,
    totalValue,
  };
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
  const productLabeledCandidate = parseProductLabeledInlineRow(normalizedText);
  if (productLabeledCandidate) {
    return {
      candidate: productLabeledCandidate,
      score: buildCandidateScore(productLabeledCandidate, normalizedText, linesUsed) + 80,
    };
  }

  const prioritizedStructuredCandidate =
    tryParseItemCodeQuantityUnitPattern(normalizedText) ??
    tryParseQuantityFirstCatalogPattern(normalizedText) ??
    tryParseCodeFirstCatalogPattern(normalizedText) ??
    tryParseLeadingQuantityProposalPattern(normalizedText) ??
    tryParseDescriptionQuantityProposalPattern(normalizedText);

  if (prioritizedStructuredCandidate) {
    return {
      candidate: prioritizedStructuredCandidate,
      score: buildCandidateScore(prioritizedStructuredCandidate, normalizedText, linesUsed) + 80,
    };
  }

  const structuredCandidates = [
    tryParseQuantityFirstCatalogPattern(normalizedText),
    tryParseCodeFirstCatalogPattern(normalizedText),
    tryParseLeadingQuantityProposalPattern(normalizedText),
    tryParseDescriptionQuantityProposalPattern(normalizedText),
  ].filter((candidate): candidate is ParsedCandidate => candidate !== null && Boolean(candidate.description) && candidate.unitPrice !== null);

  if (structuredCandidates.length > 0) {
    const scoredStructured = structuredCandidates.map((candidate) => ({
      candidate,
      score: buildCandidateScore(candidate, normalizedText, linesUsed) + 60,
    }));

    return (
      scoredStructured.sort(
        (left, right) => right.score - left.score || right.candidate.description.length - left.candidate.description.length,
      )[0] ?? null
    );
  }

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

/**
 * Orçamentos em prosa (ex.: Cirúrgica Medpar): bloco "Valor unitário" + "Quantidade cotada … Valor total"
 * espalhado no texto, sem uma única linha tabular.
 */
function parseProseCommercialQuoteSummaryRows(text: string): SupplierQuoteParsedRow[] {
  const normalizedText = text.replace(/\r/g, '\n');
  const results: SupplierQuoteParsedRow[] = [];
  const seen = new Set<string>();

  const blockRe =
    /Valor\s+unit[aá]rio\s*:\s*R\$\s*([\d.]+,\d{2})[\s\S]{0,2000}?Quantidade\s+cotada,?\s*(\d+)\s*unidade\s*-\s*Valor\s+total\s*:\s*R\$\s*([\d.]+,\d{2})/gi;

  let match: RegExpExecArray | null;
  for (;;) {
    match = blockRe.exec(normalizedText);
    if (!match) {
      break;
    }

    const unitPrice = parseMoneyToken(match[1]);
    const quantity = Number.parseInt(match[2] ?? '', 10);
    const totalValue = parseMoneyToken(match[3]);
    if (unitPrice === null || totalValue === null || !Number.isFinite(quantity) || quantity <= 0) {
      continue;
    }

    const before = normalizedText.slice(Math.max(0, match.index - 1200), match.index);
    const lines = before
      .split('\n')
      .map((line) => normalizeLine(line))
      .filter((line) => line.length > 12 && !shouldSkipLine(line));
    const description =
      lines
        .slice(-4)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 480) || 'Itens cotados (resumo do fornecedor)';

    const key = `${normalizeSupplierQuoteMatchText(description)}|${unitPrice}|${totalValue}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    results.push({
      rowIndex: results.length,
      rawText: match[0].slice(0, 800),
      description,
      quantity,
      unit: 'UN',
      unitPrice,
      totalValue,
    });
  }

  return results;
}

/** Linha só com quantidade + R$ unitário + R$ total (ex.: Ideas/Carrinho), sem descrição na mesma linha — junta linhas anteriores como descrição. */
const BARE_QTY_TWO_MONEY_LINE_RE =
  /^(\d+(?:[.,]\d+)?)\s+R\$\s*([\d.]+,\d{2})\s+R\$\s*([\d.]+,\d{2})\s*$/i;

function collectLinesForBareQtyTwoMoney(sourceLines: string[], bareIndex: number): string[] {
  const parts: string[] = [];
  const maxLookback = 32;

  for (let j = bareIndex - 1; j >= 0 && j >= bareIndex - maxLookback; j -= 1) {
    const pl = sourceLines[j] ?? '';
    const trimmed = normalizeLine(pl).trim();
    if (!trimmed) {
      continue;
    }
    if (BARE_QTY_TWO_MONEY_LINE_RE.test(trimmed)) {
      break;
    }

    const normalized = normalizeSupplierQuoteMatchText(pl);
    if (!normalized || normalized.length < 2) {
      continue;
    }
    if (HEADER_SKIP_PATTERNS.some((pattern) => normalized.includes(pattern))) {
      continue;
    }
    if (/^Total\s*:\s*R?\$?\s*[\d.,]+\s*$/i.test(trimmed) || /^Total\s*:\s*[\d.,]+\s*$/i.test(trimmed)) {
      continue;
    }
    if (/^\d+\s+of\s+\d+$/i.test(normalized) || normalized.startsWith('pagina ') || normalized.startsWith('pag ')) {
      continue;
    }

    const hasLetter = /[a-z]/i.test(pl);
    const isSpecBullet = /^::/.test(trimmed);
    if (!hasLetter && !isSpecBullet) {
      continue;
    }

    parts.unshift(pl);
  }

  return parts;
}

function parseBareQtyTwoMoneyRows(text: string): SupplierQuoteParsedRow[] {
  const sourceLines = text
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => normalizeLine(line))
    .filter(Boolean);

  const results: SupplierQuoteParsedRow[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < sourceLines.length; index += 1) {
    const line = sourceLines[index] ?? '';
    const trimmed = line.trim();
    const match = trimmed.match(BARE_QTY_TWO_MONEY_LINE_RE);
    if (!match) {
      continue;
    }

    const unitPrice = parseMoneyToken(match[2]);
    const totalValue = parseMoneyToken(match[3]);
    const quantity = parseQuantityValue(match[1], unitPrice, totalValue);
    if (unitPrice === null || totalValue === null || quantity === null) {
      continue;
    }

    const descParts = collectLinesForBareQtyTwoMoney(sourceLines, index);
    const description =
      cleanupQuoteDescription(descParts) || 'Item (orçamento com valores em linha isolada)';

    const rawText = [...descParts, trimmed].join(' ').slice(0, 1200);
    const key = `${normalizeSupplierQuoteMatchText(description)}|${unitPrice}|${totalValue}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    results.push({
      rowIndex: results.length,
      rawText,
      description,
      quantity,
      unit: null,
      unitPrice,
      totalValue,
    });
  }

  return results;
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

    if (startsWithProductLabel(line)) {
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
    mergeParsedRows(
      mergeParsedRows(
        mergeParsedRows(
          mergeParsedRows(mergeParsedRows(results, parseProductLabeledRows(text)), parseQtdValorBlockRows(text)),
          parseNumberedBlockRows(text),
        ),
        parseUnnumberedBlockRows(text),
      ),
      parseProseCommercialQuoteSummaryRows(text),
    ),
    parseBareQtyTwoMoneyRows(text),
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

function startsWithProductLabel(line: string) {
  return /^(?:prod(?:uto|utos)?|produ)\s*:/i.test(line);
}

function stripProductLabelPrefix(value: string) {
  return value.replace(/^(?:prod(?:uto|utos)?|produ)\s*:\s*/i, '');
}

function cleanupQuoteDescription(parts: string[]) {
  return normalizeWhitespace(
    parts
      .map((part) => stripProductLabelPrefix(stripLeadingItemNumberSegment(part)))
      .join(' ')
      .replace(/\s*[-â€“â€”]+\s*/g, ' ')
      .replace(/\s+,/g, ',')
      .replace(/\s+\./g, '.')
      .replace(/\s+:/g, ':')
      .replace(/^[:.-]+\s*/, ''),
  );
}

function isMoneyOnlyLine(line: string) {
  return !/[a-z]/i.test(line) && parseMoneyToken(line) !== null;
}

function isQuantityOnlyLine(line: string) {
  return !/[a-z]/i.test(line) && /^[0-9]{1,4}(?:[.,][0-9]{1,3})?$/.test(line.trim());
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

function parseProductLabeledInlineParts(line: string) {
  const normalized = normalizeBrokenPriceText(line);
  const match = normalized.match(
    /^(?:prod(?:uto|utos)?|produ)\s*:\s*(?<description>.+?)\s+(?:R\$?\s*)?(?<unitPrice>\d{1,4}(?:[.,]\d{3})*[.,]\d{2,4})\s+(?<qty>\d{1,4}(?:[.,]\d{1,3})?)\s+(?:R\$?\s*)?(?<total>\d{1,4}(?:[.,]\d{3})*[.,]\d{2,4})\s*$/i,
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
    descriptionPart: match.groups.description,
    unitPrice,
    totalValue,
    quantity,
  };
}

function parseProductLabeledInlineRow(line: string) {
  const parts = parseProductLabeledInlineParts(line);
  if (!parts) {
    return null;
  }

  const description = cleanupQuoteDescription([parts.descriptionPart]);
  if (!description) {
    return null;
  }

  return {
    rawText: line,
    description,
    unit: null,
    unitPrice: parts.unitPrice,
    totalValue: parts.totalValue,
    quantity: parts.quantity,
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

function isLikelyProductDescriptionContinuationLine(line: string) {
  const normalized = normalizeSupplierQuoteMatchText(line);
  if (!normalized || isPageMarkerNormalized(normalized) || isLikelyTabularHeaderNormalized(normalized)) {
    return false;
  }

  if (startsWithProductLabel(line) || isLikelyNumberedDescriptionStart(line)) {
    return false;
  }

  if (isMoneyOnlyLine(line) || isQuantityOnlyLine(line) || parseSeparatedPriceLine(line)) {
    return false;
  }

  if (
    /^(?:boa vista|av(?:enida)?\b|endereco\b|documento assinado\b|govbr\b|cnpj\b|total\b|obs\b)/i.test(normalized) ||
    /^[a-z\s.-]+-\s*[a-z]{2}\s+\d{4}$/i.test(normalized)
  ) {
    return false;
  }

  return /[a-z]/i.test(line);
}

function parseProductLabeledRows(text: string) {
  const lines = text
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => normalizeLine(line))
    .filter(Boolean);

  const results: SupplierQuoteParsedRow[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < lines.length; index += 1) {
    const startLine = lines[index] ?? '';
    if (!startsWithProductLabel(startLine)) {
      continue;
    }

    const inlineParts = parseProductLabeledInlineParts(startLine);
    if (inlineParts) {
      const descriptionParts = [inlineParts.descriptionPart];
      const rawParts = [startLine];
      let linesUsed = 1;

      for (let offset = 1; offset <= 2 && index + offset < lines.length; offset += 1) {
        const nextLine = lines[index + offset] ?? '';
        if (!isLikelyProductDescriptionContinuationLine(nextLine)) {
          break;
        }

        descriptionParts.push(nextLine);
        rawParts.push(nextLine);
        linesUsed = offset + 1;
      }

      const description = cleanupQuoteDescription(descriptionParts);
      const key = `${normalizeSupplierQuoteMatchText(description)}|${inlineParts.unitPrice}|${inlineParts.totalValue}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({
          rowIndex: results.length,
          rawText: rawParts.join(' '),
          description,
          quantity: inlineParts.quantity,
          unit: null,
          unitPrice: inlineParts.unitPrice,
          totalValue: inlineParts.totalValue,
        });
      }

      index += Math.max(0, linesUsed - 1);
      continue;
    }

    const descriptionParts = [startLine];
    const rawParts = [startLine];
    let priceParsed: { unitPrice: number; totalValue: number; quantity: number | null } | null = null;
    let linesUsed = 1;

    for (let offset = 1; offset <= 5 && index + offset < lines.length; offset += 1) {
      const nextLine = lines[index + offset] ?? '';

      if (startsWithProductLabel(nextLine) || isLikelyNumberedDescriptionStart(nextLine)) {
        break;
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

        for (let tailOffset = linesUsed; tailOffset <= linesUsed + 1 && index + tailOffset < lines.length; tailOffset += 1) {
          const tailLine = lines[index + tailOffset] ?? '';
          if (!isLikelyProductDescriptionContinuationLine(tailLine)) {
            break;
          }

          descriptionParts.push(tailLine);
          rawParts.push(tailLine);
          linesUsed = tailOffset;
        }
        break;
      }

      if (!isLikelyProductDescriptionContinuationLine(nextLine)) {
        break;
      }

      descriptionParts.push(nextLine);
      rawParts.push(nextLine);
    }

    const description = cleanupQuoteDescription(descriptionParts);
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

function parseProductDescriptionOnlyRows(text: string) {
  const lines = text
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => normalizeLine(line))
    .filter(Boolean)
    .filter((line) => !/^---\s*pagina\b/i.test(line));

  const results: SupplierQuoteParsedRow[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < lines.length; index += 1) {
    const startLine = lines[index] ?? '';
    if (!startsWithProductLabel(startLine) || parseProductLabeledInlineParts(startLine)) {
      continue;
    }

    const descriptionParts = [startLine];
    const rawParts = [startLine];
    let linesUsed = 1;

    for (let offset = 1; offset <= 2 && index + offset < lines.length; offset += 1) {
      const nextLine = lines[index + offset] ?? '';
      if (!isLikelyProductDescriptionContinuationLine(nextLine)) {
        break;
      }

      descriptionParts.push(nextLine);
      rawParts.push(nextLine);
      linesUsed = offset + 1;
    }

    const description = cleanupQuoteDescription(descriptionParts);
    if (!description) {
      continue;
    }

    const key = normalizeSupplierQuoteMatchText(description);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    results.push({
      rowIndex: results.length,
      rawText: rawParts.join(' '),
      description,
      quantity: null,
      unit: null,
      unitPrice: null,
      totalValue: null,
    });

    index += Math.max(0, linesUsed - 1);
  }

  return results;
}

function parseQdtLineQuantity(line: string, unitPrice: number | null, totalValue: number | null) {
  const match = stripAccents(line).match(/\b(?:QTD|ATD|ATA)\s*[:.]?\s*(\d{1,4}(?:[.,]\d{1,3})?)/i);
  if (!match?.[1]) {
    return null;
  }
  return parseQuantityValue(match[1], unitPrice, totalValue);
}

function parseValueLine(line: string) {
  const normalized = normalizeBrokenPriceText(line);
  const match = normalized.match(/^(?<description>.+?)\s+Valor\s*[:.]?\s*(?<unitPrice>\d{1,4}(?:[.,]\d{3})*[.,]\d{2,4})/i);
  if (!match?.groups) {
    return null;
  }

  const description = cleanupDescriptionTokens(match.groups.description.split(/\s+/));
  const unitPrice = parseMoneyToken(match.groups.unitPrice);
  if (!description || unitPrice === null) {
    return null;
  }

  return {
    description,
    unitPrice,
  };
}

function parseTotalLine(line: string) {
  const match = normalizeBrokenPriceText(line).match(/Total\s*[:.]?\s*(?<total>\d{1,4}(?:[.,]\d{3})*[.,]\d{2,4})/i);
  return parseMoneyToken(match?.groups?.total);
}

function parseQtdValorBlockRows(text: string) {
  const lines = text
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => normalizeLine(line))
    .filter(Boolean)
    .filter((line) => !/^---\s*pagina\b/i.test(line));

  const results: SupplierQuoteParsedRow[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < lines.length; index += 1) {
    const valueLine = lines[index] ?? '';
    const valueLineParsed = parseValueLine(valueLine);
    if (!valueLineParsed) {
      continue;
    }

    let totalLineIndex = -1;
    let totalValue: number | null = null;
    for (let offset = 1; offset <= 2 && index + offset < lines.length; offset += 1) {
      totalValue = parseTotalLine(lines[index + offset] ?? '');
      if (totalValue !== null) {
        totalLineIndex = index + offset;
        break;
      }
    }

    if (totalValue === null) {
      continue;
    }

    const quantityLine =
      index > 0 && /\b(?:qtd|atd|ata)\s*[:.]?\s*\d/i.test(stripAccents(lines[index - 1] ?? '')) ? lines[index - 1] ?? '' : '';
    const quantity =
      parseQdtLineQuantity(quantityLine, valueLineParsed.unitPrice, totalValue) ??
      inferQuantityFromPrices(valueLineParsed.unitPrice, totalValue);
    const key = `${normalizeSupplierQuoteMatchText(valueLineParsed.description)}|${valueLineParsed.unitPrice}|${totalValue}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const trailingUnitLine =
      totalLineIndex >= 0
        ? lines
            .slice(totalLineIndex + 1, Math.min(lines.length, totalLineIndex + 4))
            .find((line) => /\bUN\s*:\s*[A-Z]{1,6}\b/i.test(stripAccents(line))) ?? null
        : null;
    const unitMatch = trailingUnitLine ? stripAccents(trailingUnitLine).match(/\bUN\s*:\s*([A-Z]{1,6})\b/i) : null;

    results.push({
      rowIndex: results.length,
      rawText: [quantityLine, valueLine, totalLineIndex >= 0 ? lines[totalLineIndex] ?? '' : ''].join(' ').trim(),
      description: valueLineParsed.description,
      quantity,
      unit: unitMatch?.[1]?.toUpperCase() ?? null,
      unitPrice: valueLineParsed.unitPrice,
      totalValue,
    });

    index = totalLineIndex >= 0 ? totalLineIndex : index;
  }

  return results;
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
    (row.unit ? 28 : 0) +
    (row.totalValue && row.totalValue > 0 ? 20 : 0) +
    (row.quantity && row.quantity >= 1 ? 18 : 0) +
    (Number.isInteger(row.quantity ?? Number.NaN) ? 10 : 0) -
    (/^[A-Z0-9/-]{3,}\s+\d+(?:[.,]\d+)?\s+[A-Z]{1,6}\b/.test(row.description) ? 40 : 0);

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

      if (startsWithProductLabel(nextLine) || isLikelyNumberedDescriptionStart(nextLine)) {
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
    if (startsWithProductLabel(startLine)) {
      continue;
    }

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

      if (startsWithProductLabel(nextLine) || isLikelyNumberedDescriptionStart(nextLine)) {
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
    /proposta\s*n(?:ro|o)?\.?\s*[:.]?\s*([a-z0-9./-]+)/i,
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

function parseHeaderQuoteDate(lines: string[]) {
  const normalizedLines = lines.map((line) => stripAccents(line).replace(/\s+/g, ' ').trim());
  const labeledPatterns = [
    /\b(?:data|emissao|lancamento|impresso em)\s*[:.]?\s*(\d{2}\/\d{2}\/\d{2,4})\b/i,
  ];

  for (const line of normalizedLines) {
    for (const pattern of labeledPatterns) {
      const match = line.match(pattern);
      if (match?.[1]) {
        return parseDateToIso(match[1]);
      }
    }
  }

  const fallbackMatch = normalizedLines.join(' ').match(/\b\d{2}\/\d{2}\/\d{2,4}\b/);
  return fallbackMatch ? parseDateToIso(fallbackMatch[0]) : null;
}

function sanitizeSupplierHeaderLine(line: string) {
  const sanitized = normalizeWhitespace(
    line
      .replace(/^\d+\s*[-.:]\s*/, '')
      .replace(/\bOR[CÇ]AMENTO.*$/i, '')
      .replace(/\bCNPJ:.*$/i, '')
      .replace(/\bCPF\/CNPJ:.*$/i, ''),
  );

  const asciiSanitized = stripAccents(sanitized);

  const emailAliasMatch = asciiSanitized.match(/([A-Z0-9._%+-]{3,})(?:@|Q)(?:GMAIL|HOTMAIL|OUTLOOK|YAHOO)\.COM/i);
  if (emailAliasMatch?.[1]) {
    return normalizeWhitespace(emailAliasMatch[1]).toUpperCase();
  }

  const legalEntityMatch = asciiSanitized.match(/([A-Z][A-Z0-9.&'/-]*(?:\s+[A-Z0-9.&'/-]+){1,10}\s+(?:LTDA|ME|EPP|S\/A)\b)/i);
  if (legalEntityMatch?.[1]) {
    return normalizeWhitespace(legalEntityMatch[1]).toUpperCase();
  }

  return sanitized;
}

function looksLikeCompactSupplierName(value: string, options?: { allowSingleToken?: boolean }) {
  const sanitized = normalizeWhitespace(value);
  if (!sanitized || /\d/.test(sanitized)) {
    return false;
  }

  const tokens = sanitized.split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens.length > 5) {
    return false;
  }

  const normalized = normalizeSupplierQuoteMatchText(sanitized);
  if (!normalized || HEADER_SUPPLIER_SKIP_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    return false;
  }

  if (tokens.some((token) => token.length === 1)) {
    return false;
  }

  if (tokens.length === 1) {
    return Boolean(options?.allowSingleToken) && tokens[0]!.length >= 3;
  }

  if (!tokens.some((token) => token.length >= 4)) {
    if (options?.allowSingleToken && tokens.length <= 2 && tokens.every((token) => token.length >= 2)) {
      return tokens.every((token) => /^[A-Z][A-Z0-9&.'/-]*$/i.test(token));
    }
    return false;
  }

  return tokens.every((token) => /^[A-Z][A-Z0-9&.'/-]*$/i.test(token));
}

function scoreSupplierLine(line: string) {
  const emailAliasMatch = stripAccents(line).match(/\b([A-Z0-9._%+-]{3,})(?:@|Q)(?:GMAIL|HOTMAIL|OUTLOOK|YAHOO)\.COM\b/i);
  if (emailAliasMatch?.[1]) {
    return 45 + emailAliasMatch[1].length;
  }

  const sanitized = sanitizeSupplierHeaderLine(line);
  const normalized = normalizeSupplierQuoteMatchText(sanitized);
  if (!normalized || HEADER_SUPPLIER_SKIP_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    return Number.NEGATIVE_INFINITY;
  }

  const compactSupplierName = looksLikeCompactSupplierName(sanitized);
  if (countMoneyTokens(line) >= 2) {
    return Number.NEGATIVE_INFINITY;
  }

  if (parseCandidateText(line, 1)?.candidate?.unitPrice !== null && !compactSupplierName) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 0;

  if (compactSupplierName) {
    score += 14;
  }

  if (/(?:ltda|me|epp|s\/a|comercio|ferragens|suprimentos|hospitalares|produtos|medicos|distribuidora)/i.test(sanitized)) {
    score += 18;
  }

  if (!/\d{4,}/.test(sanitized)) {
    score += 5;
  }

  if (!/@/.test(sanitized) && !/www\./i.test(sanitized)) {
    score += 2;
  }

  if (/gmail|hotmail|outlook|yahoo|\.com/i.test(sanitized)) {
    score -= 12;
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

  if (/rua|avenida|rodovia|hospital|retaguarda/i.test(sanitized)) {
    score -= 12;
  }

  if (/instituto|desenvolvimento|ensino|assistencia|saude/i.test(sanitized)) {
    score -= 12;
  }

  if (/\d{2}\/\d{2}\/\d{2,4}/.test(sanitized)) {
    score -= 6;
  }

  return score;
}

function inferSupplierNameFromFileName(originalFileName: string) {
  const baseName = normalizeWhitespace(stripAccents(path.parse(originalFileName).name).replace(/[´`]/g, "'"));
  const normalizedBaseName = normalizeSupplierQuoteMatchText(baseName);
  if (!/^(?:orc|orcamento|or camento|orcamento|cot|cotacao|proposta)\b/.test(normalizedBaseName)) {
    return null;
  }

  let candidate = normalizeWhitespace(baseName.replace(/\(\d+\)/g, ' '));
  candidate = candidate.replace(/\b(?:orc(?:amento)?|cot(?:acao)?|proposta)\b[:\s-]*/gi, ' ').trim();

  if (candidate.includes(' - ')) {
    candidate = candidate.split(' - ')[0]!.trim();
  }

  candidate = normalizeWhitespace(
    candidate
      .replace(/\b(?:assinado|assinada|assinatura|scan(?:ner)?|camscanner)\b/gi, ' ')
      .replace(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/gi, ' ')
      .replace(/\b\d{1,2}[a-z]{3}\d{2,4}\b/gi, ' ')
      .replace(/[_-]+/g, ' '),
  );

  const compactDateIndex = candidate.search(/\b\d{1,2}[a-z]{3}\d{2,4}\b/i);
  if (compactDateIndex >= 0) {
    candidate = candidate.slice(0, compactDateIndex).trim();
  }

  candidate = normalizeWhitespace(candidate.replace(/\b\d{4,}\b/g, ' ').replace(/\s{2,}/g, ' '));
  if (!looksLikeCompactSupplierName(candidate, { allowSingleToken: true })) {
    return null;
  }

  return candidate.toUpperCase();
}

export function extractHeaderInfo(text: string) {
  const lines = text
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => normalizeLine(line))
    .filter(Boolean)
    .slice(0, 80);

  const quoteNumber = parseHeaderQuoteNumber(lines);
  const quoteDate = parseHeaderQuoteDate(lines);
  const supplierLines = lines
    .slice(0, 28)
    .filter((line) => {
      const normalized = normalizeSupplierQuoteMatchText(line);
      return (
        Boolean(normalized) &&
        !/^---\s*pagina\b/i.test(line) &&
        !/^--\s*\d+\s+of\s+\d+\s*--/i.test(line) &&
        !/^\d{2}\/\d{2}\/\d{2,4}$/.test(normalized)
      );
    });

  let supplierNameDetected: string | null = null;
  const topSupplierLine =
    [...supplierLines]
      .sort((left, right) => scoreSupplierLine(right) - scoreSupplierLine(left))
      .find((line) => scoreSupplierLine(line) > 0) ??
    supplierLines.find((line) => looksLikeCompactSupplierName(sanitizeSupplierHeaderLine(line))) ??
    null;

  if (topSupplierLine) {
    supplierNameDetected = sanitizeSupplierHeaderLine(topSupplierLine);
  }

  return {
    supplierNameDetected: supplierNameDetected ? normalizeWhitespace(supplierNameDetected) : null,
    quoteNumber,
    quoteDate,
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

function mergeDescriptionOnlyRows(primary: SupplierQuoteParsedRow[], secondary: SupplierQuoteParsedRow[]) {
  const merged = [...primary];
  const pricedDescriptions = new Set(
    primary
      .filter((row) => row.unitPrice !== null || row.totalValue !== null)
      .map((row) => normalizeSupplierQuoteMatchText(row.description)),
  );

  for (const row of secondary) {
    if (row.unitPrice !== null || row.totalValue !== null) {
      continue;
    }

    const normalizedDescription = normalizeSupplierQuoteMatchText(row.description);
    if (!normalizedDescription || pricedDescriptions.has(normalizedDescription)) {
      continue;
    }

    if (merged.some((entry) => normalizeSupplierQuoteMatchText(entry.description) === normalizedDescription)) {
      continue;
    }

    merged.push({
      ...row,
      rowIndex: merged.length,
    });
  }

  return merged;
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

async function extractTargetedProductRowsViaOcr(buffer: Buffer) {
  const text = repairUtf8MisinterpretedAsLatin1(
    (
      await extractPdfTextViaOcr(buffer, {
        maxPages: 2,
        renderScale: 400,
        pageSegMode: 6,
        regions: [
          {
            pageNumber: 2,
            xRatio: 0.02,
            yRatio: 0.03,
            widthRatio: 0.96,
            heightRatio: 0.28,
            label: 'product-table-upper',
          },
        ],
      })
    ).trim(),
  );

  const sanitizedText = text.replace(/^---[^\n]+---\s*/gim, '').trim();
  if (!sanitizedText) {
    return {
      text,
      rows: [] as SupplierQuoteParsedRow[],
    };
  }

  return {
    text: sanitizedText,
    rows: mergeDescriptionOnlyRows(parseSupplierQuoteRows(sanitizedText), parseProductDescriptionOnlyRows(sanitizedText)),
  };
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

async function extractRotatedRowsViaOcr(buffer: Buffer, rotationDegrees: number) {
  const rotatedText = repairUtf8MisinterpretedAsLatin1(
    (
      await extractPdfTextViaOcr(buffer, {
        maxPages: 2,
        rotationDegrees,
      })
    ).trim(),
  );

  if (!rotatedText) {
    return {
      text: '',
      header: extractHeaderInfo(''),
      rows: [] as SupplierQuoteParsedRow[],
    };
  }

  return {
    text: rotatedText,
    header: extractHeaderInfo(rotatedText),
    rows: mergeDescriptionOnlyRows(parseSupplierQuoteRows(rotatedText), parseProductDescriptionOnlyRows(rotatedText)),
  };
}

function countMeaningfulLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => normalizeLine(line))
    .filter(Boolean).length;
}

function shouldAttemptOcr(directText: string, directRows: SupplierQuoteParsedRow[]) {
  const meaningfulLineCount = countMeaningfulLines(directText);
  const normalizedLines = directText
    .split(/\r?\n/)
    .map((line) => normalizeLine(line))
    .filter(Boolean);
  const productLabelLineCount = normalizedLines.filter((line) => startsWithProductLabel(line)).length;
  const suspiciousMergedRowCount = directRows.filter(
    (row) => (row.rawText.match(/\bprod(?:uto|utos)?\s*:/gi) ?? []).length > 1,
  ).length;

  if (directText.trim().length < DIRECT_TEXT_MIN_LENGTH) {
    return true;
  }

  if (/^--\s*\d+\s+of\s+\d+\s*--/i.test(directText.trim())) {
    return true;
  }

  if (directRows.length === 0) {
    return true;
  }

  if (directRows.length < 2 && meaningfulLineCount > 12) {
    return true;
  }

  if (productLabelLineCount >= 4 && directRows.length + 2 < productLabelLineCount) {
    return true;
  }

  if (suspiciousMergedRowCount > 0) {
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

const ARITHMETIC_TOLERANCE_REL = 0.06;

function rowArithmeticIsConsistent(row: SupplierQuoteParsedRow): boolean | null {
  const q = row.quantity;
  const u = row.unitPrice;
  const t = row.totalValue;
  if (q === null || u === null || t === null || q <= 0) {
    return null;
  }
  const expected = q * u;
  if (Math.abs(expected - t) <= Math.max(0.01, Math.abs(t) * ARITHMETIC_TOLERANCE_REL)) {
    return true;
  }
  return false;
}

export type SupplierQuoteRowPriceIntegrity = 'consistent' | 'inconsistent' | 'insufficient_data';

/** Alinhado a {@link buildSupplierQuoteExtractionDiagnostics} — para exibir filtro “conferir total” na importação. */
export function classifySupplierQuoteRowPriceIntegrity(row: SupplierQuoteParsedRow): SupplierQuoteRowPriceIntegrity {
  const ar = rowArithmeticIsConsistent(row);
  if (ar === null) {
    return 'insufficient_data';
  }
  return ar ? 'consistent' : 'inconsistent';
}

/** Metadados para filtros e revisão (não altera o parse). */
export type SupplierQuoteExtractionDiagnostics = {
  fullTextCharCount: number;
  nonEmptyLineCount: number;
  linesWithLetterAndDigitCount: number;
  parsedRowCount: number;
  /** Contagem por unidade informada (ex.: UN, CX). */
  unitBreakdown: Record<string, number>;
  rowsWithConsistentArithmetic: number;
  rowsWithInconsistentArithmetic: number;
  rowsWithInsufficientDataForArithmetic: number;
};

/**
 * Agrega estatísticas sobre o texto bruto e as linhas já parseadas — útil para filtros na UI e para perceber PDFs “vazios” no texto direto.
 */
export function buildSupplierQuoteExtractionDiagnostics(
  fullText: string,
  rows: SupplierQuoteParsedRow[],
): SupplierQuoteExtractionDiagnostics {
  const lines = fullText.split(/\r?\n/).map((line) => normalizeLine(line)).filter(Boolean);
  const linesWithLetterAndDigitCount = lines.filter((line) => /[a-z]/i.test(line) && /\d/.test(line)).length;

  let consistent = 0;
  let inconsistent = 0;
  let insufficient = 0;
  const unitBreakdown: Record<string, number> = {};

  for (const row of rows) {
    const unitKey = row.unit?.trim() ? row.unit.trim().toUpperCase() : '(sem unidade)';
    unitBreakdown[unitKey] = (unitBreakdown[unitKey] ?? 0) + 1;
    const ar = rowArithmeticIsConsistent(row);
    if (ar === null) {
      insufficient += 1;
    } else if (ar) {
      consistent += 1;
    } else {
      inconsistent += 1;
    }
  }

  return {
    fullTextCharCount: fullText.length,
    nonEmptyLineCount: lines.length,
    linesWithLetterAndDigitCount,
    parsedRowCount: rows.length,
    unitBreakdown,
    rowsWithConsistentArithmetic: consistent,
    rowsWithInconsistentArithmetic: inconsistent,
    rowsWithInsufficientDataForArithmetic: insufficient,
  };
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
          supplierNameDetected: directHeader.supplierNameDetected ?? inferSupplierNameFromFileName(originalFileName),
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
    const targetedProductOcr = await extractTargetedProductRowsViaOcr(buffer);
    const targetedPricedRows = targetedProductOcr.rows.filter(
      (row) => (row.unitPrice !== null || row.totalValue !== null) && startsWithProductLabel(row.rawText),
    );
    const mergedOcrRows =
      ocrRows.length > 0 || targetedProductOcr.rows.length > 0
        ? mergeDescriptionOnlyRows(
            mergeParsedRows(ocrRows.length > 0 ? ocrRows : directRows, targetedPricedRows),
            targetedProductOcr.rows,
          )
        : ocrRows;
    lastOcrText = ocrText;
    lastOcrHeader = ocrHeader;

    if (mergedOcrRows.length > 0) {
      const ocrPreview: SupplierQuotePdfPreview = {
        extractionMode: 'OCR',
        fullText: [ocrText, targetedProductOcr.text].filter(Boolean).join('\n\n'),
        supplierNameDetected:
          mergeQuoteHeaderInfos(ocrHeader, directHeader).supplierNameDetected ?? inferSupplierNameFromFileName(originalFileName),
        quoteNumber: mergeQuoteHeaderInfos(ocrHeader, directHeader).quoteNumber,
        quoteDate: mergeQuoteHeaderInfos(ocrHeader, directHeader).quoteDate,
        rows: mergedOcrRows,
      };

      if (
        !bestPreview ||
        mergedOcrRows.length > directRows.length ||
        scoreExtraction(mergedOcrRows, ocrHeader) > scoreExtraction(directRows, directHeader)
      ) {
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
        supplierNameDetected: header.supplierNameDetected ?? inferSupplierNameFromFileName(originalFileName),
        quoteNumber: header.quoteNumber,
        quoteDate: header.quoteDate,
        rows: sparseFallback.rows,
      };
    }
  }

  if (!bestPreview) {
    const rotatedCandidates = await Promise.all([extractRotatedRowsViaOcr(buffer, 90), extractRotatedRowsViaOcr(buffer, 270)]);
    const bestRotated =
      rotatedCandidates
        .filter((candidate) => candidate.rows.length > 0)
        .sort(
          (left, right) =>
            scoreExtraction(right.rows, right.header) - scoreExtraction(left.rows, left.header) ||
            right.rows.length - left.rows.length,
        )[0] ?? null;

    if (bestRotated) {
      const header = mergeQuoteHeaderInfos(bestRotated.header, mergeQuoteHeaderInfos(lastOcrHeader ?? directHeader, directHeader));
      return {
        extractionMode: 'OCR',
        fullText: [lastOcrText, bestRotated.text].filter(Boolean).join('\n\n'),
        supplierNameDetected: header.supplierNameDetected ?? inferSupplierNameFromFileName(originalFileName),
        quoteNumber: header.quoteNumber,
        quoteDate: header.quoteDate,
        rows: bestRotated.rows,
      };
    }
  }

  if (bestPreview) {
    return bestPreview;
  }

  /** Última tentativa: OCR em alta resolução (scan fraco, texto embutido inútil, ou primeira OCR sem linhas). */
  try {
    const hiResText = repairUtf8MisinterpretedAsLatin1(
      (await extractPdfTextViaOcr(buffer, { maxPages: 6, renderScale: 420, pageSegMode: 6 })).trim(),
    );
    const hiResRows = parseSupplierQuoteRows(hiResText);
    if (hiResRows.length > 0) {
      const hiHeader = extractHeaderInfo(hiResText);
      return {
        extractionMode: 'OCR',
        fullText: hiResText,
        supplierNameDetected: hiHeader.supplierNameDetected ?? inferSupplierNameFromFileName(originalFileName),
        quoteNumber: hiHeader.quoteNumber,
        quoteDate: hiHeader.quoteDate,
        rows: hiResRows,
      };
    }
  } catch {
    /* ignorar — mantém erro abaixo */
  }

  throw new Error(`Não foi possível identificar linhas de orçamento no PDF ${originalFileName}.`);
}
