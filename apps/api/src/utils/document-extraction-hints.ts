import { repairUtf8MisinterpretedAsLatin1 } from './encoding.js';

export type ProjectHints = {
  name?: string;
  organizationName?: string;
  objectSummary?: string;
  bidNumber?: string;
  procurementProcessNumber?: string;
  contractNumber?: string;
  city?: string;
  state?: string;
};

const MAX_CELL = 2000;
const MAX_SUMMARY = 4000;

function cellStr(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v).trim();
  if (!s) return '';
  return repairUtf8MisinterpretedAsLatin1(s).slice(0, MAX_CELL);
}

/** Pregão / instrumento: 90.030/2025, 14.133/2021 */
export function guessBidNumberFromText(text: string): string | null {
  const compact = text.replace(/\s+/g, ' ');
  const m = compact.match(/\b(\d{1,2}\.\d{3}\s*\/\s*\d{4})\b/);
  return m ? m[1].replace(/\s/g, '') : null;
}

export function guessProcessNumberFromText(text: string): string | null {
  const m = text.match(/\d{5}\.\d{6}\/\d{4}-\d{2}/);
  if (m) return m[0];
  const m2 = text.match(/\d{6}\.\d{6}\/\d{4}-\d{2}/);
  return m2 ? m2[0] : null;
}

export function guessContractNumberFromText(text: string): string | null {
  const m = text.match(
    /\b(?:contrato|termo)\s*(?:n[ºo°]?|número)?\s*[:\-]?\s*([A-Z0-9./\-]{4,40})\b/i,
  );
  if (m?.[1]) return m[1].trim().slice(0, 80);
  const m2 = text.match(/\b(CTR[-\s]?[\d./A-Z-]{3,30})\b/i);
  return m2 ? m2[1].trim().slice(0, 80) : null;
}

function looksLikeOrgName(s: string): boolean {
  const t = s.trim();
  if (t.length < 4 || t.length > MAX_PROJECT_NAME_CHARS) return false;
  if (/^\d+([.,]\d+)?$/.test(t)) return false;
  if (/^R\$/i.test(t)) return false;
  return true;
}

/** Nome de órgão/projeto extraído de PDF/planilha (Prisma String sem limite rígido). */
export const MAX_PROJECT_NAME_CHARS = 500;

const orgLabel =
  /^(órgão|orgao|contratante|raz[aã]o\s*social|unidade\s*gestora|u\.?g\.?|ente\s*federativ|cliente|empresa|institui[cç][aã]o)\s*:?$/i;
const objetoLabel = /^(objeto|nome\s*do\s*projeto|denomina[cç][aã]o|descri[cç][aã]o\s*do\s*objeto|sum[aá]rio)\s*:?$/i;
const pregLabel = /^(preg[aã]o|preg\.|instrumento)\s*:?$/i;
const procLabel = /^(processo|proc\.?\s*licitat[óo]rio)\s*:?$/i;
const contrLabel = /^(contrato|termo\s*de\s*contrato)\s*:?$/i;
const cidadeLabel = /^(cidade|munic[íi]pio)\s*:?$/i;
const ufLabel = /^(uf|estado)\s*:?$/i;

/** Linha parece cortada no meio do nome (PDF quebra antes do complemento). */
export function lineLooksIncompleteForOrgName(line: string): boolean {
  const t = line.trim();
  if (t.length < 8) return true;
  if (/\b(DE|DA|DO|DOS|DAS|E|EM|NA|NO|NOS|NAS)\s*$/i.test(t)) return true;
  if (/[—\-]\s*$/.test(t)) return true;
  return false;
}

export function nextLineLooksLikeOrgContinuation(line: string): boolean {
  const t = line.trim();
  if (t.length < 2 || t.length > 220) return false;
  if (
    /^(EDITAL|PROCESSO|PREG(ÃO|AO)|LEI|PORTARIA|CAPÍTULO|CAPITULO|OBJETO|SUMÁRIO|SUMARIO|ÍNDICE|INDICE)\b/i.test(t)
  ) {
    return false;
  }
  if (/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/.test(t)) return false;
  if (/^\d{5}\.\d{6}\/\d{4}-\d{2}/.test(t)) return false;
  return true;
}

/**
 * Junta linhas iniciais do PDF quando o nome do órgão foi quebrado (ex.: termina em "DO").
 */
export function mergeOrgNameLinesFromPdfLines(lines: string[]): string | undefined {
  const filtered = lines.map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < Math.min(filtered.length, 120); i++) {
    const line = filtered[i];
    if (!line || line.length < 12) continue;
    if (line.length > 260) continue;
    if (line.startsWith('[') || /^\[[^\]]+\]\s*$/.test(line)) continue;
    if (/^\d[\d.,\s/%-]+$/.test(line)) continue;
    if (/^(folha|sheet|aba|total|subtotal)/i.test(line)) continue;
    let merged = line;
    let j = i + 1;
    while (
      j < filtered.length &&
      merged.length < MAX_PROJECT_NAME_CHARS &&
      lineLooksIncompleteForOrgName(merged) &&
      nextLineLooksLikeOrgContinuation(filtered[j]!)
    ) {
      merged = `${merged} ${filtered[j]!}`.trim();
      j++;
    }
    merged = merged.slice(0, MAX_PROJECT_NAME_CHARS);
    if (merged.length >= 12) return merged;
  }
  return undefined;
}

const ORG_NAME_FROM_TEXT_LINE =
  /CONS[ÓO]RCIO|PREFEITURA|SECRETARIA|MUNIC[ÍI]PIOS|ESTADO\s+D[EO]|MINIST[ÉE]RIO|C[ÂA]MARA|HOSPITAL|EBSERH|UNI[ÃA]O|FUNDAÇ/i;

/**
 * Varre linhas de planilha procurando rótulos em PT-BR (célula ao lado ou abaixo).
 */
export function deriveHintsFromSpreadsheetRows(rows: string[][]): ProjectHints {
  const hints: ProjectHints = {};

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    if (!row?.length) continue;

    const a = cellStr(row[0]);
    const b = cellStr(row[1]);

    if (a && b) {
      if (orgLabel.test(a) && looksLikeOrgName(b)) hints.organizationName = b.slice(0, MAX_PROJECT_NAME_CHARS);
      if (objetoLabel.test(a) && b.length > 8) {
        hints.objectSummary = b.slice(0, MAX_SUMMARY);
        if (!hints.name) hints.name = b.slice(0, MAX_PROJECT_NAME_CHARS);
      }
      if (pregLabel.test(a)) {
        const bid = guessBidNumberFromText(b) ?? b.replace(/\s/g, '').replace(/[^\d./]/g, '').slice(0, 40);
        if (bid) hints.bidNumber = bid;
      }
      if (procLabel.test(a)) {
        const p = guessProcessNumberFromText(b) ?? b.replace(/\s+/g, ' ').trim().slice(0, 80);
        if (p.length > 5) hints.procurementProcessNumber = p;
      }
      if (contrLabel.test(a)) hints.contractNumber = b.slice(0, 80);
      if (cidadeLabel.test(a) && b.length > 1) hints.city = b.slice(0, 80);
      if (ufLabel.test(a) && /^[A-Za-z]{2}$/.test(b.trim())) {
        hints.state = b.trim().toUpperCase();
      }
    }

    for (let j = 0; j < row.length; j++) {
      const label = cellStr(row[j]).replace(/\s+/g, ' ');
      const right = cellStr(row[j + 1]);
      const below = row[j] !== undefined ? cellStr(rows[ri + 1]?.[j]) : '';

      if (!label) continue;

      if (orgLabel.test(label) && looksLikeOrgName(right)) {
        hints.organizationName = right.slice(0, MAX_PROJECT_NAME_CHARS);
      }
      if (objetoLabel.test(label) && right.length > 8) {
        hints.objectSummary = hints.objectSummary ?? right.slice(0, MAX_SUMMARY);
        if (!hints.name) hints.name = right.slice(0, MAX_PROJECT_NAME_CHARS);
      }
      if (pregLabel.test(label) && right) {
        const bid = guessBidNumberFromText(right) ?? right.replace(/\s/g, '').replace(/[^\d./]/g, '').slice(0, 40);
        if (bid) hints.bidNumber = bid;
      }
      if (procLabel.test(label) && right) {
        const p = guessProcessNumberFromText(right) ?? right.replace(/\s+/g, ' ').trim().slice(0, 80);
        if (p.length > 5) hints.procurementProcessNumber = p;
      }
      if (contrLabel.test(label) && right) hints.contractNumber = right.slice(0, 80);
      if (cidadeLabel.test(label) && right.length > 1) hints.city = right.slice(0, 80);
      if (ufLabel.test(label) && /^[A-Za-z]{2}$/.test(right.trim())) {
        hints.state = right.trim().toUpperCase();
      }

      if (orgLabel.test(label) && !right && looksLikeOrgName(below)) {
        hints.organizationName = below.slice(0, MAX_PROJECT_NAME_CHARS);
      }
    }
  }

  return hints;
}

export function mergeHintsFromPlainText(text: string, baseTitle: string): ProjectHints {
  const excerpt = text.replace(/\s+/g, ' ').trim();
  const hints: ProjectHints = {};

  const bid = guessBidNumberFromText(excerpt);
  if (bid) hints.bidNumber = bid;

  const proc = guessProcessNumberFromText(excerpt);
  if (proc) hints.procurementProcessNumber = proc;

  const ctr = guessContractNumberFromText(excerpt);
  if (ctr) hints.contractNumber = ctr;

  if (excerpt.length > 40) {
    hints.objectSummary = excerpt.slice(0, MAX_SUMMARY);
  }

  const lines = text.split(/[\n|]/).map((l) => l.trim()).filter(Boolean);
  const mergedName = mergeOrgNameLinesFromPdfLines(lines);
  if (mergedName) {
    hints.name = mergedName;
    if (ORG_NAME_FROM_TEXT_LINE.test(mergedName)) {
      hints.organizationName = mergedName;
    }
  } else {
    for (const line of lines) {
      if (line.length < 12 || line.length > 260) continue;
      if (line.startsWith('[') || /^\[[^\]]+\]\s*$/.test(line)) continue;
      if (/^\d[\d.,\s/%-]+$/.test(line)) continue;
      if (/^(folha|sheet|aba|total|subtotal)/i.test(line)) continue;
      hints.name = line.slice(0, MAX_PROJECT_NAME_CHARS);
      if (ORG_NAME_FROM_TEXT_LINE.test(line)) {
        hints.organizationName = line.slice(0, MAX_PROJECT_NAME_CHARS);
      }
      break;
    }
  }

  if (!hints.name) hints.name = baseTitle.slice(0, MAX_PROJECT_NAME_CHARS);

  return hints;
}

export function mergeProjectHints(
  ...parts: (ProjectHints | undefined | null)[]
): ProjectHints {
  const out: ProjectHints = {};
  for (const p of parts) {
    if (!p) continue;
    for (const [k, v] of Object.entries(p)) {
      if (v === undefined || v === null) continue;
      const key = k as keyof ProjectHints;
      const s = typeof v === 'string' ? v.trim() : String(v);
      if (!s) continue;
      if (!out[key]) out[key] = s;
    }
  }
  return out;
}
