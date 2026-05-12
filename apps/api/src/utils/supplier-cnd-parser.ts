import path from 'node:path';

import { PDFParse } from 'pdf-parse';

import { repairUtf8MisinterpretedAsLatin1 } from './encoding.js';
import { extractTextFromImageBuffer } from './image-ocr.js';
import { extractPdfTextViaOcr } from './pdf-ocr.js';

export type SupplierCndExtractionMode = 'DIRECT_TEXT' | 'OCR';

export interface SupplierCndParsedMetadata {
  fullText: string;
  extractionMode: SupplierCndExtractionMode;
  holderName: string | null;
  holderDocumentNumber: string | null;
  issuedAt: Date | null;
  validUntil: Date | null;
  controlCode: string | null;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function stripDiacritics(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeForSearch(value: string) {
  return stripDiacritics(repairUtf8MisinterpretedAsLatin1(value))
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function normalizeLinesForSearch(value: string) {
  return repairUtf8MisinterpretedAsLatin1(value)
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => stripDiacritics(line).replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean);
}

function parseBrazilianDate(value: string): Date | null {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    return null;
  }

  const [, day, month, year] = match;
  return new Date(`${year}-${month}-${day}T12:00:00-03:00`);
}

function parseBrazilianDateTime(dateValue: string, timeValue: string): Date | null {
  const dateMatch = dateValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const timeMatch = timeValue.match(/^(\d{2}):(\d{2}):(\d{2})$/);
  if (!dateMatch || !timeMatch) {
    return null;
  }

  const [, day, month, year] = dateMatch;
  const [, hour, minute, second] = timeMatch;
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}-03:00`);
}

/** Dias no mês (1–12) em ano calendário, para somar meses sem depender do fuso do servidor. */
function daysInGregorianMonth(year: number, month1to12: number) {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

/**
 * Soma meses a uma data brasileira (dia/mês/ano) devolvendo validade ao meio-dia em Brasília —
 * mesmo critério de `parseBrazilianDate` na CND federal.
 */
export function validUntilCalendarMonthsAfterBrazilianIssue(
  day: number,
  month1to12: number,
  year: number,
  monthsToAdd: number,
): Date | null {
  if (!Number.isFinite(monthsToAdd) || monthsToAdd <= 0 || monthsToAdd > 120) {
    return null;
  }

  let m = month1to12 + monthsToAdd;
  let y = year + Math.floor((m - 1) / 12);
  m = ((m - 1) % 12) + 1;
  const dim = daysInGregorianMonth(y, m);
  const d = Math.min(day, dim);
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');

  return new Date(`${y}-${mm}-${dd}T12:00:00-03:00`);
}

/** Ex.: SPF "6 (seis) meses, contados da data de sua expedição." (sem "Válida até DD/MM/AAAA"). */
function tryParseStateCndRelativeValidity(normalizedText: string) {
  const relMatch = normalizedText.match(
    /(\d+)\s*\([^)]+\)\s+mes(?:es)?,\s*contad[oa]s?\s+d[ae]\s+data\s+d[ae]\s+sua\s+expedicao/i,
  );
  if (!relMatch) {
    return null;
  }

  const monthsToAdd = Number(relMatch[1] ?? '');
  const relIndex = relMatch.index ?? 0;

  const emissions = [...normalizedText.matchAll(/(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}:\d{2})/g)];
  if (emissions.length === 0) {
    return null;
  }

  let chosen: RegExpMatchArray | null = null;

  let bestLead = -1;
  for (const m of emissions) {
    const idx = m.index ?? 0;
    if (idx < relIndex && idx > bestLead) {
      bestLead = idx;
      chosen = m;
    }
  }

  chosen ??= emissions[0];

  const datePart = chosen[1];
  const timePart = chosen[2];
  if (!datePart || !timePart) {
    return null;
  }

  const dm = datePart.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!dm) {
    return null;
  }

  const day = Number(dm[1]);
  const month1to12 = Number(dm[2]);
  const year = Number(dm[3]);
  const issuedAt = parseBrazilianDateTime(datePart, timePart);
  if (!issuedAt) {
    return null;
  }

  const validUntil = validUntilCalendarMonthsAfterBrazilianIssue(day, month1to12, year, monthsToAdd);
  if (!validUntil) {
    return null;
  }

  const spCert = normalizedText.match(/\b(\d{11}-\d{2})\b/);

  return {
    issuedAt,
    validUntil,
    /** Nº da certidão (SP costuma usar 11 dígitos + traço + 2 dígitos). */
    certificateNumber: spCert ? normalizeWhitespace(spCert[1] ?? '') || null : null,
  };
}

function findFirstMatchingLine(
  lines: string[],
  startIndex: number,
  maxLinesAhead: number,
  patterns: RegExp[],
) {
  const end = Math.min(lines.length, startIndex + maxLinesAhead + 1);
  for (const pattern of patterns) {
    for (let i = startIndex + 1; i < end; i += 1) {
      const line = lines[i];
      if (!line) {
        continue;
      }
      const match = line.match(pattern);
      if (match) {
        return match;
      }
    }
  }
  return null;
}

/**
 * Alguns layouts estaduais saem do OCR como tabela: os rótulos ficam em linhas
 * separadas e os valores aparecem nas linhas seguintes.
 */
function tryParseStateCndTabularValidity(originalText: string) {
  const lines = normalizeLinesForSearch(originalText);
  if (lines.length === 0) {
    return null;
  }

  const validityLabelIndex = lines.findIndex((line) => /\bvalidade\b/i.test(line));
  const issueLabelIndex = lines.findIndex((line) => /\bemissao\b/i.test(line));
  const certificateLabelIndex = lines.findIndex((line) => /\bcertidao\b/i.test(line));

  const validityMatch =
    validityLabelIndex >= 0
      ? findFirstMatchingLine(lines, validityLabelIndex, 6, [/^(\d{2}\/\d{2}\/\d{4})$/, /^(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}:\d{2}$/])
      : null;
  const issuedMatch =
    issueLabelIndex >= 0
      ? findFirstMatchingLine(lines, issueLabelIndex, 6, [/^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}:\d{2})$/, /^(\d{2}\/\d{2}\/\d{4})$/])
      : null;
  const certificateMatch =
    certificateLabelIndex >= 0
      ? findFirstMatchingLine(lines, certificateLabelIndex, 6, [/\b((?=[A-Z0-9.-]*\d)[A-Z0-9.-]{8,}|[0-9]{11}-[0-9]{2})\b/i])
      : null;

  const validityDate = validityMatch?.[1] ?? null;
  const issuedDate = issuedMatch?.[1] ?? null;
  const issuedTime = issuedMatch?.[2] ?? null;

  return {
    issuedAt: issuedDate ? (issuedTime ? parseBrazilianDateTime(issuedDate, issuedTime) : parseBrazilianDate(issuedDate)) : null,
    validUntil: validityDate ? parseBrazilianDate(validityDate) : null,
    certificateNumber: certificateMatch ? normalizeWhitespace(certificateMatch[1] ?? '') || null : null,
  };
}

export function inferSupplierCndScopeFromText(
  text: string,
  originalFileName?: string | null,
): 'FEDERAL' | 'STATE' | null {
  const normalizedText = normalizeForSearch(text).toLowerCase();
  const normalizedFileName = normalizeForSearch(originalFileName ?? '').toLowerCase();

  const federalSignals = [
    /receita federal do brasil/,
    /procuradoria-geral da fazenda nacional/,
    /tributos federais/,
    /divida ativa da uniao/,
    /portaria conjunta rfb\/pgfn/,
  ];
  const stateSignals = [
    /secretaria da fazenda/,
    /estado de [a-z]/,
    /divida ativa do estado/,
    /nao inscritos na divida ativa/,
    /fazenda e planejamento/,
    /\bsefaz\b/,
  ];

  const federalScore = federalSignals.reduce((score, pattern) => score + (pattern.test(normalizedText) ? 1 : 0), 0);
  const stateScore = stateSignals.reduce((score, pattern) => score + (pattern.test(normalizedText) ? 1 : 0), 0);

  if (federalScore > stateScore) {
    return 'FEDERAL';
  }
  if (stateScore > federalScore) {
    return 'STATE';
  }

  if (/\bfederal\b|\buniao\b/.test(normalizedFileName)) {
    return 'FEDERAL';
  }
  if (/\bestadual\b|\bestado\b|\bsefaz\b/.test(normalizedFileName)) {
    return 'STATE';
  }

  return null;
}

export function extractSupplierCndMetadataFromText(
  text: string,
): Omit<SupplierCndParsedMetadata, 'fullText' | 'extractionMode'> {
  const originalText = repairUtf8MisinterpretedAsLatin1(text).replace(/\r/g, '').trim();
  const normalizedText = normalizeForSearch(originalText);

  const holderNameMatch = originalText.match(/(?:^|\n)\s*Nome:\s*(.+)$/im);
  const holderDocumentMatch = originalText.match(/(?:^|\n)\s*CNPJ:\s*([0-9./-]+)$/im);
  const issuedMatch = normalizedText.match(/Emitida as\s*(\d{2}:\d{2}:\d{2})\s*do dia\s*(\d{2}\/\d{2}\/\d{4})/i);
  const validUntilMatch = normalizedText.match(/Valida ate\s*(\d{2}\/\d{2}\/\d{4})/i);
  const controlCodeMatch = normalizedText.match(/Codigo de controle da certidao:\s*([A-Z0-9.]+)/i);

  let holderName = holderNameMatch ? normalizeWhitespace(holderNameMatch[1] ?? '') || null : null;
  let holderDocumentNumber = holderDocumentMatch ? normalizeWhitespace(holderDocumentMatch[1] ?? '') || null : null;
  let issuedAt = issuedMatch ? parseBrazilianDateTime(issuedMatch[2] ?? '', issuedMatch[1] ?? '') : null;
  let validUntil = validUntilMatch ? parseBrazilianDate(validUntilMatch[1] ?? '') : null;
  let controlCode = controlCodeMatch ? normalizeWhitespace(controlCodeMatch[1] ?? '') || null : null;

  const stateRelative = validUntil === null ? tryParseStateCndRelativeValidity(normalizedText) : null;
  const stateTabular = validUntil === null ? tryParseStateCndTabularValidity(originalText) : null;

  if (stateRelative) {
    issuedAt ??= stateRelative.issuedAt;
    validUntil = validUntil ?? stateRelative.validUntil;
    controlCode ??= stateRelative.certificateNumber ?? null;
  }

  if (stateTabular) {
    issuedAt ??= stateTabular.issuedAt;
    validUntil = validUntil ?? stateTabular.validUntil;
    controlCode ??= stateTabular.certificateNumber ?? null;
  }

  return {
    holderName,
    holderDocumentNumber,
    issuedAt,
    validUntil,
    controlCode,
  };
}

function extractionScore(metadata: Omit<SupplierCndParsedMetadata, 'fullText' | 'extractionMode'>) {
  return (
    (metadata.validUntil ? 10 : 0) +
    (metadata.issuedAt ? 5 : 0) +
    (metadata.controlCode ? 3 : 0) +
    (metadata.holderDocumentNumber ? 2 : 0) +
    (metadata.holderName ? 1 : 0)
  );
}

async function extractDirectPdfText(buffer: Buffer) {
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    return repairUtf8MisinterpretedAsLatin1((result.text ?? '').trim());
  } catch {
    return '';
  }
}

function isImageLikeFile(fileName: string, mimeType?: string | null) {
  if (mimeType?.startsWith('image/')) {
    return true;
  }

  const ext = path.extname(fileName).toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tif', '.tiff'].includes(ext);
}

function isPdfLikeFile(fileName: string, mimeType?: string | null) {
  if (mimeType === 'application/pdf') {
    return true;
  }

  return path.extname(fileName).toLowerCase() === '.pdf';
}

export async function extractSupplierCndMetadataFromFile(
  buffer: Buffer,
  originalFileName: string,
  mimeType?: string | null,
): Promise<SupplierCndParsedMetadata | null> {
  if (isImageLikeFile(originalFileName, mimeType)) {
    const ocrText = repairUtf8MisinterpretedAsLatin1((await extractTextFromImageBuffer(buffer)).trim());
    const parsed = extractSupplierCndMetadataFromText(ocrText);
    return extractionScore(parsed) > 0 || ocrText.trim().length > 0 ? { ...parsed, fullText: ocrText, extractionMode: 'OCR' } : null;
  }

  if (!isPdfLikeFile(originalFileName, mimeType)) {
    return null;
  }

  const directText = await extractDirectPdfText(buffer);
  const directParsed = extractSupplierCndMetadataFromText(directText);
  const directScore = extractionScore(directParsed);

  if (directParsed.validUntil && directParsed.controlCode && directScore >= 13) {
    return { ...directParsed, fullText: directText, extractionMode: 'DIRECT_TEXT' };
  }

  const ocrText = repairUtf8MisinterpretedAsLatin1((await extractPdfTextViaOcr(buffer)).trim());
  const ocrParsed = extractSupplierCndMetadataFromText(ocrText);
  const ocrScore = extractionScore(ocrParsed);

  const best =
    ocrScore > directScore
      ? { ...ocrParsed, fullText: ocrText, extractionMode: 'OCR' as const }
      : { ...directParsed, fullText: directText, extractionMode: 'DIRECT_TEXT' as const };

  return extractionScore(best) > 0 || best.fullText.trim().length > 0 ? best : null;
}
