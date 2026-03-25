import { PDFParse } from 'pdf-parse';

import { logger } from '../config/logger.js';
import {
  lineLooksIncompleteForOrgName,
  MAX_PROJECT_NAME_CHARS,
  nextLineLooksLikeOrgContinuation,
  type ProjectHints,
} from './document-extraction-hints.js';
import { repairUtf8MisinterpretedAsLatin1 } from './encoding.js';

/** Limite de caracteres do texto completo (PDFs muito grandes). */
function getMaxPdfChars(): number {
  const n = Number(process.env.IMPLEMENTATION_MAP_PDF_MAX_CHARS ?? 120_000);
  return Number.isFinite(n) && n > 10_000 ? Math.min(n, 500_000) : 120_000;
}

export async function extractImplementationMapPdfText(buffer: Buffer): Promise<{
  text: string;
  extractionMode: 'full_document';
  ocrUsed?: boolean;
}> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const raw = repairUtf8MisinterpretedAsLatin1((result.text ?? '').trim());
    let text = raw.slice(0, getMaxPdfChars());
    const mapParse = parseImplementationMapContent(text);

    if (shouldRunPdfOcrForImplementationMap(text, mapParse)) {
      try {
        const { extractPdfTextViaOcr } = await import('./pdf-ocr.js');
        const ocrText = await extractPdfTextViaOcr(buffer);
        if (ocrText.trim().length > 40) {
          text = `${text}\n\n--- Texto reconhecido por OCR (trechos em imagem no PDF) ---\n\n${ocrText}`.slice(
            0,
            getMaxPdfChars(),
          );
          return {
            text,
            extractionMode: 'full_document',
            ocrUsed: true,
          };
        }
      } catch (err) {
        logger.warn('PDF OCR (mapa de implantação) falhou; mantendo só o texto extraído do PDF.', err);
      }
    }

    return {
      text,
      extractionMode: 'full_document',
      ocrUsed: false,
    };
  } finally {
    await parser.destroy();
  }
}

export type BudgetLineCandidate = {
  recordGroupKey: string | null;
  fieldKey: string;
  proposedValue: string;
  sourceExcerpt: string;
};

export type ImplementationMapParse = {
  hints: ProjectHints;
  sectionsFound: string[];
  cnpj?: string;
  budgetLines: BudgetLineCandidate[];
  /** Índice no texto completo onde começou o primeiro bloco reconhecível (0 = do início). */
  contentAnchorIndex: number;
};

function shouldRunPdfOcrForImplementationMap(
  text: string,
  parsed: ImplementationMapParse,
): boolean {
  if (process.env.PDF_OCR_ENABLED === 'false') return false;
  if (process.env.PDF_OCR_FORCE === 'true') return true;
  if (parsed.budgetLines.length > 0) return false;
  if (text.length < 1200) return true;
  if (parsed.sectionsFound.length > 0) return true;
  if (/EQUIPAMENTO|UNIFORME|COMPRAS|SUPRIMENTOS|R\$/i.test(text)) return true;
  return false;
}

/** Trechos típicos de mapas de implantação / compras (variam de página; usamos só para classificar e âncora). */
const SECTION_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /MAPA\s+DE\s+IMPLANTA[CÇ][AÃ]O/i, label: 'Mapa de implantação' },
  { re: /COMPRAS\s*\/\s*SUPRIMENTOS/i, label: 'COMPRAS / SUPRIMENTOS' },
  { re: /UNIFORME\s*\/\s*EPIs?\s*\/\s*EQUIPAMENTOS/i, label: 'Uniforme / EPI / Equipamentos' },
  { re: /UNIFORME|EPIs?|EQUIPAMENTO\s+DE\s+PROTE[CÇ][AÃ]O/i, label: 'Uniformes / EPI' },
  { re: /VALORES\s+M[AÁ]XIMOS/i, label: 'Valores máximos' },
  { re: /\bEPIs?\s*:/i, label: 'EPIs' },
  { re: /\bEquipamentos?\s*:/i, label: 'Equipamentos' },
  { re: /\bUniforme\s*:/i, label: 'Uniforme' },
  { re: /SERVI[CÇ]OS\s+DE\s+LIMPEZA/i, label: 'Serviços de limpeza' },
  { re: /MANUTEN[CÇ][AÃ]O\s+PREDIAL/i, label: 'Manutenção predial' },
  { re: /DESCRIC[AÃ]O\s*\(\s*conforme\s+edital\s*\)/i, label: 'Tabela (conforme edital)' },
  { re: /Quantidade.*Valor.*Mensal/i, label: 'Quadro quantidade/valor' },
  { re: /Valor\s+Unit[aá]rio|Valor\s+total/i, label: 'Valores unitário/total' },
];

/** Primeira ocorrência de qualquer âncora: reduz ruído de capas, mas se não achar, usa o texto todo. */
const START_ANCHOR_RES: RegExp[] = [
  /MAPA\s+DE\s+IMPLANTA[CÇ][AÃ]O/i,
  /COMPRAS\s*\/\s*SUPRIMENTOS/i,
  /UNIFORME\s*\/\s*EPIs?\s*\/\s*EQUIPAMENTOS/i,
  /VALORES\s+M[AÁ]XIMOS\s+PARA\s+COMPRA/i,
  /\b8\.\s*UNIFORMES?\b/i,
  /\b8\.\d+\s+UNIFORME/i,
  /\bEQUIPAMENTO\s+DE\s+PROTE[CÇ][AÃ]O\s+INDIVIDUAL/i,
  /DESCRIC[AÃ]O\s*\(\s*conforme\s+edital\s*\)/i,
];

function findFirstAnchorIndex(text: string): number {
  let best = Infinity;
  for (const re of START_ANCHOR_RES) {
    const m = re.exec(text);
    if (m?.index !== undefined) {
      best = Math.min(best, m.index);
    }
  }
  return best === Infinity ? 0 : best;
}

const ROLE_LINE =
  /^(Auxiliar|Copeir[ao]|Encarregad[oa]|Controlador|Recepcionista|Camareir[ao]|Manuten[cç][aã]o)/i;

/** Dois valores monetários na mesma linha (ex.: unitário + mensal). */
const TABLE_ROW_DOUBLE =
  /^(.+?)\s+(\d+)\s+R\$\s*([\d]{1,3}(?:\.\d{3})*,\d{2})\s+R\$\s*([\d]{1,3}(?:\.\d{3})*,\d{2})\s*$/u;

/** Um valor + opcional total na mesma linha (planilhas mais simples). */
const TABLE_ROW_SINGLE = /^(.+?)\s+(\d+)\s+R\$\s*([\d]{1,3}(?:\.\d{3})*,\d{2})\s*$/u;

/** Linha só com item e valores (sem qtd isolada) — ex.: totais, subtotais */
const LINE_MONEY_TAIL = /^(.+?)\s+R\$\s*([\d]{1,3}(?:\.\d{3})*,\d{2})\s*$/u;

function guessCnpj(text: string): string | undefined {
  const m = text.match(/\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/);
  return m?.[1];
}

function guessCityUf(text: string): string | undefined {
  const m = text.match(/\b([A-Za-zÀ-ú\s\-]{4,50})\s*[-–]\s*([A-Z]{2})\b/);
  if (m && m[2].length === 2) {
    return `${m[1].trim()} - ${m[2]}`;
  }
  return undefined;
}

function guessOrgFromMap(text: string): string | undefined {
  const head = text.slice(0, 12_000);
  const lines = head.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < Math.min(lines.length, 50); i++) {
    const line = lines[i];
    if (
      /IDEAS|LTDA|S\.A\.|SERVI[cç]OS|CONS[ÓO]RCIO|HOSPITAL|EBSERH|MUNIC[ÍI]PIOS/i.test(line) &&
      line.length > 6 &&
      line.length < 220
    ) {
      let org = line;
      let j = i + 1;
      while (
        j < lines.length &&
        org.length < MAX_PROJECT_NAME_CHARS &&
        lineLooksIncompleteForOrgName(org) &&
        nextLineLooksLikeOrgContinuation(lines[j]!)
      ) {
        org = `${org} ${lines[j]!}`.trim();
        j++;
      }
      return org.slice(0, MAX_PROJECT_NAME_CHARS);
    }
  }
  const m = head.match(
    /\b([A-ZÁÉÍÓÚÃÕÇ][A-Za-zÀ-ú0-9\s\.\-]{8,80}(?:LTDA|S\.A\.|ME|EPP))\b/u,
  );
  return m?.[1]?.trim().slice(0, MAX_PROJECT_NAME_CHARS);
}

function normalizeSpaces(s: string) {
  return s.replace(/\s+/g, ' ').trim();
}

/** Detecta valor em real no texto da linha (formato brasileiro típico em editais). */
const BRL_VALUE = /R\$\s*[\d]{1,3}(?:\.\d{3})*,\d{2}/;

function hasCurrencyLine(line: string): boolean {
  return BRL_VALUE.test(line);
}

/** Nova linha numerada tipo 8.3.1 ou 12.4 — costuma iniciar outro item (evita colar dois itens). */
function looksLikeNewNumberedItem(line: string): boolean {
  return /^\d+\.\d+(\.\d+)?\s+[A-Za-zÀ-úÁÉÍÓÚÃÕÇ]/.test(line.trim());
}

/**
 * PDFs de licitação quebram descrições em várias linhas antes do preço.
 * Junta linhas sem valor até aparecer uma linha com R$; então forma um único texto lógico.
 */
function mergeLinesUntilCurrency(
  rawLines: string[],
  options?: { maxBufferChars?: number; maxBufferLines?: number },
): string[] {
  const maxBufferChars = options?.maxBufferChars ?? 2_000;
  const maxBufferLines = options?.maxBufferLines ?? 10;
  const merged: string[] = [];
  let buffer = '';
  let bufferLineCount = 0;

  const flushBuffer = () => {
    if (!buffer) return;
    merged.push(normalizeSpaces(buffer));
    buffer = '';
    bufferLineCount = 0;
  };

  for (const raw of rawLines) {
    const line = normalizeSpaces(raw);
    if (!line) continue;

    /** Cargo / título de bloco: não colar com descrição do item seguinte. */
    if (ROLE_LINE.test(line) && line.length < 120 && !hasCurrencyLine(line)) {
      flushBuffer();
      merged.push(line);
      continue;
    }

    if (!hasCurrencyLine(line)) {
      if (buffer && looksLikeNewNumberedItem(line)) {
        flushBuffer();
        buffer = line;
        bufferLineCount = 1;
        continue;
      }

      const next = buffer ? `${buffer} ${line}` : line;
      const nextLines = bufferLineCount + 1;

      if (next.length > maxBufferChars || nextLines > maxBufferLines) {
        flushBuffer();
        buffer = line;
        bufferLineCount = 1;
      } else {
        buffer = next;
        bufferLineCount = nextLines;
      }
      continue;
    }

    const fullLine = buffer ? `${buffer} ${line}` : line;
    merged.push(normalizeSpaces(fullLine));
    buffer = '';
    bufferLineCount = 0;
  }

  flushBuffer();

  return merged;
}

function pushBudgetLine(
  budgetLines: BudgetLineCandidate[],
  lineIndex: number,
  currentRole: string | null,
  payload: Record<string, unknown>,
  sourceLine: string,
) {
  const key = `map_row_${lineIndex}_${budgetLines.length}`;
  budgetLines.push({
    recordGroupKey: currentRole,
    fieldKey: key,
    proposedValue: JSON.stringify(payload),
    sourceExcerpt: sourceLine.slice(0, 400),
  });
}

/**
 * Varre o texto completo do PDF: âncoras de seção, CNPJ, linhas com quantidade e R$.
 * Não depende de número de página — o padrão é identificado no conteúdo.
 */
export function parseImplementationMapContent(fullText: string): ImplementationMapParse {
  const sectionsFound: string[] = [];
  const seen = new Set<string>();

  for (const { re, label } of SECTION_PATTERNS) {
    if (re.test(fullText) && !seen.has(label)) {
      seen.add(label);
      sectionsFound.push(label);
    }
  }

  const contentAnchorIndex = findFirstAnchorIndex(fullText);
  const focused =
    contentAnchorIndex > 0 ? fullText.slice(contentAnchorIndex) : fullText;

  const cnpj = guessCnpj(fullText);
  const cityLine = guessCityUf(fullText);

  const hints: ProjectHints = {};

  if (cnpj) {
    hints.objectSummary = [
      `CNPJ identificado: ${cnpj}.`,
      cityLine ? ` Localidade: ${cityLine}.` : '',
      sectionsFound.length ? ` Trechos: ${sectionsFound.slice(0, 10).join('; ')}.` : '',
    ]
      .join('')
      .trim();
  } else if (sectionsFound.length) {
    hints.objectSummary = `Trechos detectados: ${sectionsFound.join('; ')}.`.slice(0, 4000);
  }

  const org = guessOrgFromMap(fullText);
  if (org) hints.organizationName = org;

  const rawLines = focused.split(/\r?\n/).map((l) => normalizeSpaces(l)).filter((l) => l.length > 0);
  const lines = mergeLinesUntilCurrency(rawLines);

  let currentRole: string | null = null;
  const budgetLines: BudgetLineCandidate[] = [];
  let lineIndex = 0;
  const seenFingerprints = new Set<string>();

  for (const line of lines) {
    if (ROLE_LINE.test(line) && line.length < 120 && !/R\$/.test(line)) {
      currentRole = line.slice(0, 120);
    }

    let m = line.match(TABLE_ROW_DOUBLE);
    if (m) {
      const desc = m[1].trim();
      if (desc.length >= 3 && desc.length <= 500) {
        const fp = `${desc}|${m[2]}|${m[3]}|${m[4]}`;
        if (!seenFingerprints.has(fp)) {
          seenFingerprints.add(fp);
          pushBudgetLine(
            budgetLines,
            lineIndex,
            currentRole,
            {
              description: desc,
              quantity: m[2],
              valueOrUnit: m[3],
              monthlyOrTotal: m[4],
              role: currentRole,
            },
            line,
          );
        }
      }
      lineIndex++;
      continue;
    }

    m = line.match(TABLE_ROW_SINGLE);
    if (m) {
      const desc = m[1].trim();
      if (desc.length >= 3 && desc.length <= 500 && !/^total|subtotal|valor\s+mensal/i.test(desc)) {
        const fp = `${desc}|${m[2]}|${m[3]}`;
        if (!seenFingerprints.has(fp)) {
          seenFingerprints.add(fp);
          pushBudgetLine(
            budgetLines,
            lineIndex,
            currentRole,
            {
              description: desc,
              quantity: m[2],
              value: m[3],
              role: currentRole,
            },
            line,
          );
        }
      }
      lineIndex++;
      continue;
    }

    const rCount = (line.match(/R\$/gi) ?? []).length;
    if (rCount !== 1) {
      lineIndex++;
      continue;
    }

    const mt = line.match(LINE_MONEY_TAIL);
    if (mt && mt[1].length > 15) {
      const desc = mt[1].trim();
      if (!/^valor\s+total|mensal|total\b/i.test(desc)) {
        const fp = `${desc}|${mt[2]}`;
        if (!seenFingerprints.has(fp)) {
          seenFingerprints.add(fp);
          pushBudgetLine(
            budgetLines,
            lineIndex,
            currentRole,
            { description: desc, totalOrUnit: mt[2], role: currentRole },
            line,
          );
        }
      }
    }

    lineIndex++;
  }

  const excerpt = focused.replace(/\s+/g, ' ').trim();
  if (excerpt.length > 60) {
    if (!hints.objectSummary) {
      hints.objectSummary = excerpt.slice(0, 4000);
    } else {
      hints.objectSummary = `${hints.objectSummary} ${excerpt.slice(0, 2200)}`.slice(0, 4000);
    }
  }

  return {
    hints,
    sectionsFound,
    cnpj,
    budgetLines: budgetLines.slice(0, 250),
    contentAnchorIndex,
  };
}
