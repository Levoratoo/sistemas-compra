import type { EditalMateriaisProfile } from './edital-materiais-profiles.js';
import { EDITAL_MATERIAIS_PROFILE_ORDER } from './edital-materiais-profiles.js';
import {
  extractBudgetLinesFromGenericRoleTables,
  extractBudgetLinesFromPostoEpiTables,
  extractBudgetLinesFromUniformKitTables,
} from './edital-anexo-materiais.js';
import { extractBudgetLinesFromRoraimaTipoQtd } from './edital-roraima-tipo-qtd.js';
import { parseEditalSecao8UniformesEpi } from './edital-secao8-uniformes-epi.js';
import type { BudgetLineCandidate } from './implementation-map-pdf.js';

const HEADER_LINE =
  /^(?:ITEM|ÍTEM|ITENS|N[º°]?)\b.*(?:DESCRI|QTD|QUANT)/i;

/** Rodapés / repetição de cabeçalho do edital no meio da tabela (quebram linhas “1 por 1”). */
const PDF_NOISE_LINE =
  /^(--\s*\d+\s+of\s+\d+\s+--|P[aá]gina\s+\d+\s+de\s+\d+|EDITAL\s*-\s*PREG|Processo\s+Administrativo|Edital\s+de\s+licita|Site:\s*www\.|Sede\s+Administrativa|Atualiza[cç][aã]o:|Bairro\s+Alto\s+Alegre|CEP\s+\d)/i;

const MAX_MERGE_LINES = 45;

const MAX_SLICE = 90_000;

export type EditalMateriaisMatchedProfile =
  | 'parana'
  | 'roraima'
  | 'roraima_tr_tabelas'
  | 'annex_role_tables'
  | 'juiz_uniforme_epi'
  | 'sec8_uniformes'
  | null;

export type EditalMateriaisParse = {
  anchorFound: boolean;
  subsectionFound: boolean;
  budgetLines: BudgetLineCandidate[];
  /** Itens da secção 8 (uniformes / referências 8.x.y + listas EPI). */
  secao8UniformesCount?: number;
  /** Perfil cujo âncora venceu na ordem automática, ou só seção 8. */
  matchedProfile: EditalMateriaisMatchedProfile;
};

function dedupeBudgetLines(lines: BudgetLineCandidate[]): BudgetLineCandidate[] {
  const seen = new Set<string>();
  const deduped: BudgetLineCandidate[] = [];

  for (const line of lines) {
    const key = `${line.recordGroupKey ?? ''}|${line.proposedValue}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(line);
  }

  return deduped;
}

function normalizeSpaces(s: string) {
  return s.replace(/\s+/g, ' ').trim();
}

function findAnchorInText(text: string, profile: EditalMateriaisProfile): {
  anchorIdx: number;
  subsectionFound: boolean;
} {
  let anchorIdx = -1;
  let subsectionFound = false;

  const mMain = profile.anchorMain.exec(text);
  if (mMain?.index !== undefined) {
    anchorIdx = mMain.index;
  }

  if (anchorIdx < 0) {
    const mSub = profile.anchorSub.exec(text);
    if (mSub?.index !== undefined) {
      anchorIdx = mSub.index;
      subsectionFound = true;
    }
  } else {
    subsectionFound = profile.anchorSub.test(text.slice(anchorIdx, anchorIdx + 12_000));
  }

  return { anchorIdx, subsectionFound };
}

function extractBudgetLinesFromSection7(
  fullSlice: string,
  profile: EditalMateriaisProfile,
): BudgetLineCandidate[] {
  let slice = fullSlice;
  const stop = profile.sectionStop.exec(slice);
  if (stop?.index !== undefined && stop.index > 400) {
    slice = slice.slice(0, stop.index);
  } else if (slice.length > MAX_SLICE) {
    slice = slice.slice(0, MAX_SLICE);
  }

  const rawLines = slice
    .split('\n')
    .map((l) => normalizeSpaces(l))
    .filter((l) => l.length > 0 && !PDF_NOISE_LINE.test(l));

  const tableBodyStart = findEditalMateriaisTableBodyStart(rawLines);
  const bodyLines = tableBodyStart >= 0 ? rawLines.slice(tableBodyStart) : rawLines;

  const merged = mergeEditalMateriaisBlocks(bodyLines);
  const budgetLines: BudgetLineCandidate[] = [];
  const seen = new Set<string>();
  let lineIndex = 0;

  for (const line of merged) {
    if (HEADER_LINE.test(line) || /^ITEM\s*$/i.test(line) || /^DESCRI/i.test(line)) {
      continue;
    }

    const row = parseTableRowLine(line);
    if (!row) continue;

    const { itemNo, description, quantity } = row;
    if (description.length < 3 || description.length > 500) continue;
    if (/^(total|subtotal|valor|observa)/i.test(description)) continue;
    if (/MATERIAIS\s+A\s+SEREM\s+DISPONIBILIZADOS/i.test(description)) continue;
    if (/CONTRATADO\s+dever[aá]/i.test(description)) continue;

    const fp = `${itemNo}|${description}|${quantity}`;
    if (seen.has(fp)) continue;
    seen.add(fp);

    const payload = {
      description,
      quantity: String(quantity),
      source: profile.payloadSource,
      sectionLabel: profile.recordGroup,
    };

    budgetLines.push({
      recordGroupKey: profile.recordGroup,
      fieldKey: `edital_mat_${profile.id}_${lineIndex}_${budgetLines.length}`,
      proposedValue: JSON.stringify(payload),
      sourceExcerpt: line.slice(0, 400),
    });
    lineIndex++;
    if (budgetLines.length >= 400) break;
  }

  return budgetLines;
}

function extractBudgetLinesForProfile(
  slice: string,
  profile: EditalMateriaisProfile,
): BudgetLineCandidate[] {
  if (profile.id === 'roraima_tr_tabelas') {
    return extractBudgetLinesFromRoraimaTipoQtd(slice, profile);
  }
  return extractBudgetLinesFromSection7(slice, profile);
}

/** Linhas antes de TIPO/QTD (cargo, SOLUÇÃO ÚNICA) ficam fora do slice que começa na âncora — reanexam o trecho. */
const TIPO_QTD_LOOKBACK_CHARS = 4000;
const TIPO_QTD_LOOKBACK_LINES = 45;

function sliceWithTipoQtdRoleContext(fullText: string, anchorIdx: number): string {
  const head = fullText.slice(Math.max(0, anchorIdx - TIPO_QTD_LOOKBACK_CHARS), anchorIdx);
  const lines = head.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const prefix = lines.slice(-TIPO_QTD_LOOKBACK_LINES).join('\n');
  const rest = fullText.slice(anchorIdx);
  return prefix ? `${prefix}\n${rest}` : rest;
}

/**
 * Extrai linhas ITEM + descrição + quantidade da seção 7 conforme perfis (Paraná, Roraima, …).
 * Ordem automática: primeiro perfil cuja âncora for encontrada.
 */
export function parseEditalMateriaisDisponibilizados(fullText: string): EditalMateriaisParse {
  const text = fullText.replace(/\r\n/g, '\n');
  const sec8 = parseEditalSecao8UniformesEpi(text);
  const annexRoleTables = extractBudgetLinesFromGenericRoleTables(text);
  const postoEpiTables = extractBudgetLinesFromPostoEpiTables(text);
  const uniformeKitTables = extractBudgetLinesFromUniformKitTables(text);
  const annexRows = dedupeBudgetLines([...annexRoleTables, ...postoEpiTables, ...uniformeKitTables]);

  for (const profile of EDITAL_MATERIAIS_PROFILE_ORDER) {
    const { anchorIdx, subsectionFound } = findAnchorInText(text, profile);
    if (anchorIdx < 0) {
      continue;
    }

    let slice = text.slice(anchorIdx);
    if (profile.id === 'roraima_tr_tabelas') {
      slice = sliceWithTipoQtdRoleContext(text, anchorIdx);
    }
    const budgetLines7 = extractBudgetLinesForProfile(slice, profile);
    const mergedLines = dedupeBudgetLines([...budgetLines7, ...annexRows, ...sec8.budgetLines]);

    return {
      anchorFound: true,
      subsectionFound,
      budgetLines: mergedLines,
      secao8UniformesCount: sec8.budgetLines.length,
      matchedProfile: profile.id,
    };
  }

  if (annexRows.length > 0) {
    return {
      anchorFound: true,
      subsectionFound: false,
      budgetLines: dedupeBudgetLines([...annexRows, ...sec8.budgetLines]),
      secao8UniformesCount: sec8.budgetLines.length,
      matchedProfile:
        uniformeKitTables.length > 0 || postoEpiTables.length > 0
          ? 'juiz_uniforme_epi'
          : 'annex_role_tables',
    };
  }

  if (!sec8.anchorFound) {
    return {
      anchorFound: false,
      subsectionFound: false,
      budgetLines: [],
      matchedProfile: null,
    };
  }

  return {
    anchorFound: true,
    subsectionFound: false,
    budgetLines: sec8.budgetLines,
    secao8UniformesCount: sec8.budgetLines.length,
    matchedProfile: 'sec8_uniformes',
  };
}

function isCompleteMateriaisRow(s: string): boolean {
  return /^(\d{1,3})\s+(.+?)\s+(\d{1,6})\s*$/.test(normalizeSpaces(s));
}

/**
 * Ignora o texto das cláusulas 7.1 / 7.2 e começa na linha de cabeçalho da tabela ou no primeiro item "1 ...".
 */
function findEditalMateriaisTableBodyStart(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^ITEM\b/i.test(l) && /DESCRI/i.test(l)) {
      return i + 1;
    }
    if (/^ÍTEM\b/i.test(l) && /DESCRI/i.test(l)) {
      return i + 1;
    }
  }
  for (let i = 0; i < lines.length; i++) {
    if (/^1\s+.+/.test(lines[i])) {
      return i;
    }
  }
  return 0;
}

/**
 * PDFs quebram itens em várias linhas (ex.: "22" + bloco + "1"; "27 Jogo..." + continuação + "1").
 * Junta até formar uma única linha "nº descrição qtd".
 */
function mergeEditalMateriaisBlocks(lines: string[]): string[] {
  const out: string[] = [];
  let buffer = '';
  let mergeCount = 0;

  const flushIfComplete = () => {
    const t = normalizeSpaces(buffer);
    if (!t) return;
    if (isCompleteMateriaisRow(t)) {
      out.push(t);
      buffer = '';
      mergeCount = 0;
    }
  };

  for (const raw of lines) {
    const line = normalizeSpaces(raw);
    if (!line || HEADER_LINE.test(line) || /^ITEM\s*$/i.test(line) || /^DESCRI/i.test(line)) {
      continue;
    }

    if (!buffer) {
      // "1" sozinho costuma ser quantidade no fim do item anterior, não o ítem nº 1 em linha isolada.
      if (/^(\d{1,3})$/.test(line) && line === '1') {
        continue;
      }
      if (/^(\d{1,3})$/.test(line) || /^(\d{1,3})\s+/.test(line)) {
        buffer = line;
        mergeCount = 1;
        flushIfComplete();
      }
      continue;
    }

    mergeCount++;
    buffer = normalizeSpaces(`${buffer} ${line}`);

    if (mergeCount > MAX_MERGE_LINES) {
      buffer = '';
      mergeCount = 0;
      if (/^(\d{1,3})$/.test(line) || /^(\d{1,3})\s+/.test(line)) {
        buffer = line;
        mergeCount = 1;
      }
      continue;
    }

    flushIfComplete();
  }

  if (buffer && isCompleteMateriaisRow(buffer)) {
    out.push(normalizeSpaces(buffer));
  }

  return out;
}

/**
 * Uma linha de tabela: ítem (1–3 algarismos), descrição, quantidade (inteiro no fim).
 * Ex.: "1 Alicate de bico curva 1"
 */
function parseTableRowLine(line: string): { itemNo: number; description: string; quantity: number } | null {
  const m = /^(\d{1,3})\s+(.+?)\s+(\d{1,6})\s*$/.exec(line);
  if (!m) return null;

  const itemNo = Number.parseInt(m[1], 10);
  const quantity = Number.parseInt(m[3], 10);
  let description = normalizeSpaces(m[2]);

  if (!Number.isFinite(itemNo) || !Number.isFinite(quantity)) return null;
  if (itemNo < 1 || itemNo > 999) return null;
  if (quantity < 0 || quantity > 99_999) return null;

  const qtyStr = String(quantity);
  const dupTail = new RegExp(`\\s+${qtyStr}\\s*$`);
  if (dupTail.test(description)) {
    description = description.replace(dupTail, '').trim();
  }

  if (description.length < 3) return null;

  return { itemNo, description, quantity };
}
