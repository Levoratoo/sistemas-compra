/**
 * Pós-processamento do texto vindo do OCR (tabelas tipo edital: item + quantidade + descrição).
 * O Tesseract costuma fundir colunas; aqui reagrupamos por nomes de itens conhecidos e padrões de quantidade.
 *
 * Não incluir palavras que aparecem no meio de frases (ex.: "paletó" em "tecido do paletó").
 * "Cinto" só como item se não for "para cinto" (lookbehind).
 */

export type OcrTableRow = {
  item: string;
  quantity: string;
  description: string;
};

const KNOWN_ITEM_NAMES = [
  'Camisa Social',
  'Camisa',
  'Casaco',
  'Calça',
  'Sapatos',
  'Cinto',
  'Meias',
  'Jaqueta',
  'Botas',
  'Bota',
  'Uniforme',
  'Colete',
  'Gravata',
] as const;

function escapeToken(w: string): string {
  return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Nome do item como regex: "Camisa Social" → Camisa\s+Social\b (não casa prefixo de "calçado"). */
function itemNamePattern(name: string): string {
  const parts = name.trim().split(/\s+/).map(escapeToken);
  return `${parts.join('\\s+')}\\b`;
}

function buildItemAlternation(): string {
  const sorted = [...KNOWN_ITEM_NAMES].sort((a, b) => b.length - a.length);
  return sorted.map(itemNamePattern).join('|');
}

/**
 * Lookahead de início de item. Não incluir "Cinto" na lista base — senão divide em "para cinto".
 * Só quebra em "Cinto" quando não é "para cinto" / "Para cinto".
 * Usar \\b para não cortar "Calça" dentro de "calçado".
 */
function buildItemSplitSource(): string {
  const withoutCinto = KNOWN_ITEM_NAMES.filter((x) => x !== 'Cinto');
  const sorted = [...withoutCinto].sort((a, b) => b.length - a.length);
  const alt = sorted.map(itemNamePattern).join('|');
  return `(?:${alt}|(?<!para\\s)(?<!Para\\s)${itemNamePattern('Cinto')})`;
}

const ITEM_SPLIT_RE = new RegExp(`(?=${buildItemSplitSource()})`, 'i');
const ITEM_HEADER_RE = new RegExp(`^\\s*(${buildItemAlternation()})\\s*(.*)$`, 'is');
const ORPHAN_QTY_ONLY_RE = /^\s*(\d{1,2}\s+(?:unidades?|pares?|par))\s*\.?\s*$/i;

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function normalizeOcrNoise(text: string): string {
  let s = text.replace(/\r\n/g, '\n');
  s = s.replace(/\bgee\s+com\b/gi, 'com');
  s = s.replace(/\bjanet\b/gi, '');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s;
}

/** OCR costuma repetir o nome da peça (coluna 1 + início da descrição). */
function collapseDuplicateItemHeaders(flat: string): string {
  let s = flat;
  s = s.replace(/\bCalça\s+Calça\b/gi, 'Calça');
  s = s.replace(/\bCamisa\s+Social\s+Camisa\s+social\b/gi, 'Camisa Social');
  return s;
}

function pickQuantity(body: string): { quantity: string; description: string } {
  const re = /(\d{1,2}\s+(?:unidades?|pares?|par))\b/i;
  const head = body.slice(0, 220);
  let m = head.match(re);
  let idx = m?.index ?? -1;
  if (idx < 0) {
    m = body.match(re);
    idx = m?.index ?? -1;
  }
  if (!m || idx < 0) {
    return { quantity: '—', description: normalizeWhitespace(body) };
  }
  const qty = m[1].trim();
  const description = normalizeWhitespace(body.slice(0, idx) + body.slice(idx + m[0].length));
  return { quantity: qty, description };
}

function stripDuplicateLeadingItem(body: string, item: string): string {
  const esc = item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  const re = new RegExp(`^\\s*(?:${esc}\\s*)+`, 'i');
  return body.replace(re, '').trim();
}

/**
 * Extrai linhas item | quantidade | descrição para tabelas de uniformes / materiais.
 */
export function parseOcrSupplyTable(text: string): OcrTableRow[] {
  const raw = normalizeOcrNoise(text);
  let flat = raw.replace(/\n+/g, ' ');
  flat = collapseDuplicateItemHeaders(flat);
  const parts = flat.split(ITEM_SPLIT_RE).filter((p) => normalizeWhitespace(p).length > 0);

  const rows: OcrTableRow[] = [];

  for (const part of parts) {
    const m = part.match(ITEM_HEADER_RE);
    if (!m) {
      const orphan = part.match(ORPHAN_QTY_ONLY_RE);
      if (orphan && rows.length > 0) {
        const prev = rows[rows.length - 1];
        if (prev.quantity === '—') {
          prev.quantity = orphan[1].trim();
        }
      }
      continue;
    }

    const item = normalizeWhitespace(m[1]);
    let body = m[2] ?? '';
    body = stripDuplicateLeadingItem(body, item);
    body = normalizeWhitespace(body);

    if (!body) {
      rows.push({ item, quantity: '—', description: '' });
      continue;
    }

    const { quantity, description } = pickQuantity(body);
    rows.push({ item, quantity, description });
  }

  return rows;
}
