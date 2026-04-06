/**
 * TR EBSERH / HU-UFRR (Roraima): tabelas com colunas TIPO/QTD | ESPECIFICAÇÃO,
 * uniformes por função (ex.: Agente de Portaria, Bombeiro Civil).
 * O texto do PDF costuma vir como: nome da peça, linha seguinte com "02 unidades", depois a especificação.
 * Diferente da seção 7 CONSAMU (ITEM + descrição + qtd num único padrão "1 ... 2").
 */

import type { BudgetLineCandidate } from './implementation-map-pdf.js';
import type { EditalMateriaisProfile } from './edital-materiais-profiles.js';

function normalizeSpaces(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

const PDF_NOISE_LINE =
  /^(--\s*\d+\s+of\s+\d+\s+--|P[aá]gina\s+\d+\s+de\s+\d+|EDITAL\s*-\s*PREG|Processo\s+Administrativo|Edital\s+de\s+licita|Site:\s*www\.|Sede\s+Administrativa|Atualiza[cç][aã]o:|Bairro\s+Alto\s+Alegre|CEP\s+\d)/i;

/** Rodapé / carimbo SEI comum nos TR Roraima. */
const RORAIMA_TR_FOOTER =
  /^(Termo\s+de\s+Referência\s*-\s*SEI|SEI\s+\d[\d.\s/\-]*\/\d+|pg\.\s*\d+)/i;

const QTY_LINE = /^\s*\d{1,2}\s+(unid(?:ades?)?\.?|unidades?|pares?|par)\b/i;

/** Linha única: "Casaco 02 unidades Tipo pulôver..." */
const SINGLE_LINE_ROW =
  /^(.+?)\s+(\d{1,2}\s+(?:unid(?:ades?)?\.?|unidades?|pares?|par))\s+(.+)$/i;

const KNOWN_MATERIAL_ITEM_PREFIXES = [
  'Camiseta de algodão com identificação',
  'Meias de cano alto de algodão',
  'Botas Táticas de cano alto',
  'Gandola com identificação',
  'Calça ou Saia ou Vestido',
  'Camisa Social',
  'Calça Tática',
  'Cinto tático',
  'Camiseta',
  'Paletó',
  'Casaco',
  'Sapatos',
  'Sapato',
  'Calça',
  'Camisa',
  'Cinto',
  'Meias',
  'Boné',
  'Jaqueta',
  'Jaleco',
  'Coturno',
  'Balaclava',
  'Óculos',
  'Luva',
  'Capacete',
  'Vestimenta',
  'Respirador',
  'Crachá',
  'Apito',
  'Rádio',
  'Bastão',
].sort((a, b) => b.length - a.length);

function splitQuantityAndRemainder(line: string) {
  const match = /^\s*(\d{1,2}\s+(?:unid(?:ades?)?\.?|unidades?|pares?|par))\b\s*(.*)$/i.exec(line);
  if (!match) {
    return {
      quantity: normalizeSpaces(line),
      remainder: '',
    };
  }

  return {
    quantity: normalizeSpaces(match[1]),
    remainder: normalizeSpaces(match[2] ?? ''),
  };
}

function shouldMergeWrappedItemLine(previous: string, current: string): boolean {
  const prev = normalizeSpaces(previous);
  const curr = normalizeSpaces(current);
  if (!prev || !curr) return false;
  if (isHeaderOrNoise(prev) || isHeaderOrNoise(curr)) return false;
  if (parseRoleLine(prev) || parseRoleLine(curr)) return false;
  if (QTY_LINE.test(prev) || QTY_LINE.test(curr)) return false;
  if (/^(Obs\.?:|Observação\b)/i.test(prev) || /^(Obs\.?:|Observação\b)/i.test(curr)) return false;
  if (/^Conforme\s+especifica[cç][aã]o\b/i.test(prev) || /^Conforme\s+especifica[cç][aã]o\b/i.test(curr)) {
    return false;
  }
  if (/Termo de Referência|Brigada de Incêndio|Corpo de Bombeiros/i.test(prev)) return false;
  if (/[.:;]\s*$/.test(prev)) return false;
  if (/\b(de|da|do|com|ou|e)\s*$/i.test(prev)) return true;
  if (/^[a-záàãâéêíóôõúç]/i.test(curr)) return true;
  return false;
}

function sanitizeDetectedItemLine(line: string) {
  const normalized = normalizeSpaces(line);
  const lowered = normalized.toLowerCase();
  for (const item of KNOWN_MATERIAL_ITEM_PREFIXES) {
    const idx = lowered.lastIndexOf(item.toLowerCase());
    if (idx >= 0) {
      return normalized.slice(idx).trim();
    }
  }
  return normalized;
}

function resolveWrappedItemLine(lines: string[], itemIdx: number) {
  const current = normalizeSpaces(lines[itemIdx] ?? '');
  if (!current) return null;

  if (itemIdx > 0) {
    const previous = normalizeSpaces(lines[itemIdx - 1] ?? '');
    const prevPrev = itemIdx > 1 ? normalizeSpaces(lines[itemIdx - 2] ?? '') : '';
    if (shouldMergeWrappedItemLine(previous, current)) {
      const merged = normalizeSpaces(`${previous} ${current}`);
      if (prevPrev && shouldMergeWrappedItemLine(prevPrev, previous)) {
        return {
          item: normalizeSpaces(`${prevPrev} ${merged}`),
          startIndex: itemIdx - 2,
        };
      }
      return {
        item: merged,
        startIndex: itemIdx - 1,
      };
    }
  }

  return {
    item: current,
    startIndex: itemIdx,
  };
}

function isHeaderOrNoise(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (PDF_NOISE_LINE.test(t) || RORAIMA_TR_FOOTER.test(t)) return true;
  if (/^(TIPO|ÍTEM|ITEM)\s*\/\s*QTD\b/i.test(t)) return true;
  if (/^ESPECIFICA[CÇ][AÃ]O\s*$/i.test(t)) return true;
  if (/^FEMININO\s*\/\s*MASCULINO\s*$/i.test(t)) return true;
  if (/^SOLU[CÇ][AÃ]O\s+[ÚU]NICA\s*$/i.test(t)) return true;
  return false;
}

/** Função / cargo antes da tabela (termina em dois-pontos). Aceita "Secretário(a) Executivo(a):" etc. */
function parseRoleLine(line: string): string | null {
  const t = line.trim();
  if (t.length < 4 || t.length > 140) return null;
  if (!/:\s*$/.test(t)) return null;
  const head = t.replace(/:\s*$/, '').trim();
  if (/^(TIPO|ESPECIFICA|FEMININO|SOLU|ITEM|OBS)/i.test(head)) return null;
  /** Subtítulos de coluna do PDF, não são cargo. */
  if (/^(MASCULINO|FEMININO)(\s*\/\s*(MASCULINO|FEMININO))?\s*$/i.test(head)) return null;
  if (!/[a-záàãâéêíóôõúç]/i.test(head)) return null;
  return head;
}

function isPlausibleItemLine(line: string, prevLine: string): boolean {
  const t = line.trim();
  if (!t || t.length < 2 || t.length > 140) return false;
  if (isHeaderOrNoise(t)) return false;
  if (QTY_LINE.test(t)) return false;
  if (/^Obs\.?:/i.test(t)) return false;
  if (/^Conforme\s+especifica[cç][aã]o\b/i.test(t)) return false;
  if (parseRoleLine(t)) return false;
  if (/^\d{1,3}\s+[A-Za-zÀ-ú]/.test(t) && /ITEM|DESCRI/i.test(prevLine)) return false;
  return true;
}

function shouldStopDescription(line: string, nextLine: string, nextNextLine: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (isHeaderOrNoise(t)) return true;
  if (parseRoleLine(t)) return true;
  if (/^(MODELO\s+(feminino|masculino)|A DEFINI[CÇ][ÃA]O ESTABELECIDA)/i.test(t)) {
    return false;
  }
  if (/^(OBSERVA[CÇ][ÃA]O|Obs\.?:)/i.test(t)) return true;
  if (/^(TIPO|ITEM)\s*\/?\s*QTD\b/i.test(t)) return true;
  if (isPlausibleItemLine(t, '') && QTY_LINE.test(nextLine.trim())) return true;
  if (
    isPlausibleItemLine(t, '') &&
    shouldMergeWrappedItemLine(t, nextLine.trim()) &&
    QTY_LINE.test(nextNextLine.trim())
  ) {
    return true;
  }
  return false;
}

/**
 * Extrai linhas a partir do texto após a âncora TIPO/QTD ou SOLUÇÃO ÚNICA.
 */
export function extractBudgetLinesFromRoraimaTipoQtd(
  fullSlice: string,
  profile: EditalMateriaisProfile,
): BudgetLineCandidate[] {
  let slice = fullSlice;
  const stop = profile.sectionStop.exec(slice);
  if (stop?.index !== undefined && stop.index > 400) {
    slice = slice.slice(0, stop.index);
  } else if (slice.length > 120_000) {
    slice = slice.slice(0, 120_000);
  }

  const rawLines = slice
    .split('\n')
    .map((l) => normalizeSpaces(l))
    .filter((l) => l.length > 0 && !PDF_NOISE_LINE.test(l));

  const lines: string[] = [];
  for (const raw of rawLines) {
    if (RORAIMA_TR_FOOTER.test(raw)) continue;
    const sm = SINGLE_LINE_ROW.exec(raw);
    if (sm && sm[1].trim().length >= 3 && sm[3].trim().length >= 8) {
      lines.push(sm[1].trim());
      lines.push(sm[2].trim());
      lines.push(sm[3].trim());
      continue;
    }
    lines.push(raw);
  }

  const budgetLines: BudgetLineCandidate[] = [];
  const seen = new Set<string>();
  let lineIndex = 0;

  const qtyIndices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (QTY_LINE.test(lines[i])) qtyIndices.push(i);
  }

  for (let k = 0; k < qtyIndices.length; k++) {
    const qi = qtyIndices[k];
    const itemIdx = qi - 1;
    if (itemIdx < 0) continue;

    let roleForRow: string | null = null;
    for (let r = 0; r < qi; r++) {
      const maybe = parseRoleLine(lines[r] ?? '');
      if (maybe) roleForRow = maybe;
    }

    const resolvedItem = resolveWrappedItemLine(lines, itemIdx);
    if (!resolvedItem) continue;
    const itemLine = sanitizeDetectedItemLine(resolvedItem.item);
    const prevPrev = resolvedItem.startIndex > 0 ? lines[resolvedItem.startIndex - 1]! : '';
    if (!isPlausibleItemLine(itemLine, prevPrev)) continue;

    const { quantity, remainder } = splitQuantityAndRemainder(lines[qi]);

    const nextQi = k + 1 < qtyIndices.length ? qtyIndices[k + 1]! : lines.length;
    const descParts: string[] = remainder ? [remainder] : [];
    for (let cursor = qi + 1; cursor < nextQi; cursor += 1) {
      const candidate = lines[cursor] ?? '';
      const next = lines[cursor + 1] ?? '';
      const nextNext = lines[cursor + 2] ?? '';
      if (shouldStopDescription(candidate, next, nextNext)) {
        break;
      }
      if (!isHeaderOrNoise(candidate)) {
        descParts.push(candidate);
      }
    }
    let description = normalizeSpaces(descParts.join(' '));
    if (description.length > 900) {
      description = `${description.slice(0, 897)}…`;
    }

    const descLower = description.toLowerCase();
    const itemLower = itemLine.toLowerCase();
    if (descLower.startsWith(itemLower)) {
      description = normalizeSpaces(description.slice(itemLine.length));
    }

    if (description.length < 3) {
      description = '(ver edital)';
    }

    const title = roleForRow ? `${roleForRow} — ${itemLine}` : itemLine;
    const fp = `${roleForRow ?? ''}|${itemLine}|${quantity}|${description.slice(0, 200)}`;
    if (seen.has(fp)) continue;
    seen.add(fp);

    const payload = {
      description: title,
      detail: description,
      quantity,
      role: roleForRow,
      item: itemLine,
      source: profile.payloadSource,
      sectionLabel: profile.recordGroup,
    };

    budgetLines.push({
      recordGroupKey: roleForRow ?? profile.recordGroup,
      fieldKey: `edital_rr_tq_${profile.id}_${lineIndex}_${budgetLines.length}`,
      proposedValue: JSON.stringify(payload),
      sourceExcerpt: `${itemLine} | ${quantity} | ${description}`.slice(0, 400),
    });
    lineIndex++;
    if (budgetLines.length >= 500) break;
  }

  return budgetLines;
}
