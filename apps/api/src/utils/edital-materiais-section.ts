import { parseEditalSecao8UniformesEpi } from './edital-secao8-uniformes-epi.js';
import type { BudgetLineCandidate } from './implementation-map-pdf.js';

/** Âncora típica de editais de pregão (ex.: CONSAMU 18/2025). */
const ANCHOR_MAIN =
  /(?:^|\n|\r)\s*7\s*[\.\)]?\s*MATERIAIS\s+A\s+SEREM\s+DISPONIBILIZADOS\b/i;

const ANCHOR_SUB =
  /MATERIAIS\s+A\s+SEREM\s+DISPONIBILIZADOS\s+PARA\s+SERVI[CÇ]OS\s+DE\s+MANUTEN[CÇ][AÃ]O\s+PREDIAL/i;

/**
 * Fim da tabela: próximo bloco claramente fora da lista (evitar parar em "8 Alicate..." — item 8 da tabela).
 * Preferimos "8." / "8)" seguido de DISPOS ou título de anexo/capítulo.
 */
const SECTION_STOP =
  /\n\s*(?:8\s*[\.\)]\s*DISPOS|8\s+DISPOSI[CÇ]|ANEXO\s+[IVXLCDM0-9]+|CAP[ÍI]TULO\s+\d+)/i;

const HEADER_LINE =
  /^(?:ITEM|ÍTEM|ITENS)\b.*(?:DESCRI|QTD|QUANT)/i;

/** Rodapés / repetição de cabeçalho do edital no meio da tabela (quebram linhas “1 por 1”). */
const PDF_NOISE_LINE =
  /^(--\s*\d+\s+of\s+\d+\s+--|P[aá]gina\s+\d+\s+de\s+\d+|EDITAL\s*-\s*PREG|Processo\s+Administrativo|Edital\s+de\s+licita|Site:\s*www\.|Sede\s+Administrativa|Atualiza[cç][aã]o:|Bairro\s+Alto\s+Alegre|CEP\s+\d)/i;

const RECORD_GROUP = '7. Materiais a disponibilizar (edital)';

const MAX_MERGE_LINES = 45;

export type EditalMateriaisParse = {
  anchorFound: boolean;
  subsectionFound: boolean;
  budgetLines: BudgetLineCandidate[];
  /** Itens da secção 8 (uniformes / referências 8.x.y + listas EPI). */
  secao8UniformesCount?: number;
};

function normalizeSpaces(s: string) {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Extrai linhas ITEM + descrição + quantidade da seção 7 de editais.
 * O texto costuma vir de PDF com colunas quebradas em uma linha: "1 Alicate ... 1".
 */
export function parseEditalMateriaisDisponibilizados(fullText: string): EditalMateriaisParse {
  const text = fullText.replace(/\r\n/g, '\n');
  let anchorIdx = -1;
  let subsectionFound = false;

  const mMain = ANCHOR_MAIN.exec(text);
  if (mMain?.index !== undefined) {
    anchorIdx = mMain.index;
  }

  if (anchorIdx < 0) {
    const mSub = ANCHOR_SUB.exec(text);
    if (mSub?.index !== undefined) {
      anchorIdx = mSub.index;
      subsectionFound = true;
    }
  } else {
    subsectionFound = ANCHOR_SUB.test(text.slice(anchorIdx, anchorIdx + 12_000));
  }

  const sec8 = parseEditalSecao8UniformesEpi(text);

  if (anchorIdx < 0) {
    if (!sec8.anchorFound) {
      return { anchorFound: false, subsectionFound: false, budgetLines: [] };
    }
    return {
      anchorFound: true,
      subsectionFound: false,
      budgetLines: sec8.budgetLines,
      secao8UniformesCount: sec8.budgetLines.length,
    };
  }

  let slice = text.slice(anchorIdx);
  const stop = SECTION_STOP.exec(slice);
  if (stop?.index !== undefined && stop.index > 400) {
    slice = slice.slice(0, stop.index);
  } else if (slice.length > 90_000) {
    slice = slice.slice(0, 90_000);
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
      source: 'edital_secao_7',
      sectionLabel: RECORD_GROUP,
    };

    budgetLines.push({
      recordGroupKey: RECORD_GROUP,
      fieldKey: `edital_mat_${lineIndex}_${budgetLines.length}`,
      proposedValue: JSON.stringify(payload),
      sourceExcerpt: line.slice(0, 400),
    });
    lineIndex++;
    if (budgetLines.length >= 400) break;
  }

  return {
    anchorFound: true,
    subsectionFound,
    budgetLines: [...budgetLines, ...sec8.budgetLines],
    secao8UniformesCount: sec8.budgetLines.length,
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
