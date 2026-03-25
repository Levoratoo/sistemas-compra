import type { BudgetLineCandidate } from './implementation-map-pdf.js';

const RECORD_GROUP = '8. Uniformes e EPI (edital)';

const PDF_NOISE_LINE =
  /^(--\s*\d+\s+of\s+\d+\s+--|P[aá]gina\s+\d+\s+de\s+\d+|EDITAL\s*-\s*PREG|Processo\s+Administrativo|Edital\s+de\s+licita|Site:\s*www\.|Sede\s+Administrativa|Atualiza[cç][aã]o:|Bairro\s+Alto\s+Alegre|CEP\s+\d)/i;

function normalizeSpaces(s: string) {
  return s.replace(/\s+/g, ' ').trim();
}

/** Início da secção 8 (uniformes); não confundir com "8 DISPOSIÇÕES" de outros capítulos. */
const ANCHOR_SEC8 = /(?:^|\n)\s*8\s+UNIFORMES\b/i;

/** Fim: capítulo 9 (gestão do contrato) ou equivalente. */
const STOP_SEC8 =
  /\n\s*(?:9\s+MODELO\s+DE\s+GEST|9\s*\.\s*MODELO|MODELO\s+DE\s+GEST[AÃ]O\s+DO\s+CONTRATO|9\s+DO\s+OBJETO|CAP[ÍI]TULO\s*9\b)/i;

/** Subitens numerados tipo 8.3.1, 8.6.2 (descrição pode vir após : ou espaço). */
const LINE_SUBITEM = /^(\d{1,2}\.\d{1,2}\.\d{1,2})\s*[:\s]\s*(.+)$/;

/** Linha só com número e descrição sem dois-pontos (menos comum). */
const LINE_SUBITEM_TIGHT = /^(\d{1,2}\.\d{1,2}\.\d{1,2})\s+(.+)$/;

const HEADER_ONLY_DESC =
  /^(UNIFORME\s+PARA|UNIFORME\s+DE|UNIFORME\s+CONTROLADOR|EQUIPAMENTO\s+DE\s+PROTE|EPIs?\s+para|AUXILIAR\s+DE\s+MANUTEN|AUXILIAR\s+DE\s+LIMPEZA)/i;

export type EditalSecao8Parse = {
  anchorFound: boolean;
  budgetLines: BudgetLineCandidate[];
};

/**
 * Uniformes (8.x.y) e listas de EPI sob 8.7 — sem quantidade no PDF quando não existir;
 * compras preenche quantidade e valor unitário na revisão (mesmo fluxo da secção 7).
 */
export function parseEditalSecao8UniformesEpi(fullText: string): EditalSecao8Parse {
  const text = fullText.replace(/\r\n/g, '\n');
  const m = ANCHOR_SEC8.exec(text);
  if (m?.index === undefined) {
    return { anchorFound: false, budgetLines: [] };
  }

  let slice = text.slice(m.index);
  const stop = STOP_SEC8.exec(slice);
  if (stop?.index !== undefined && stop.index > 200) {
    slice = slice.slice(0, stop.index);
  } else if (slice.length > 180_000) {
    slice = slice.slice(0, 180_000);
  }

  const rawLines = slice
    .split('\n')
    .map((l) => normalizeSpaces(l))
    .filter((l) => l.length > 0 && !PDF_NOISE_LINE.test(l));

  const budgetLines: BudgetLineCandidate[] = [];
  const seen = new Set<string>();

  for (const line of rawLines) {
    const sub = parseSubitemLine(line);
    if (!sub) continue;
    const { ref, description } = sub;
    if (description.length < 5 || description.length > 500) continue;
    if (HEADER_ONLY_DESC.test(description) && description.length < 120) continue;

    const fp = `${ref}|${description}`;
    if (seen.has(fp)) continue;
    seen.add(fp);

    const payload = {
      description,
      itemRef: ref,
      source: 'edital_secao_8_uniforme_epi',
      sectionLabel: RECORD_GROUP,
    };

    budgetLines.push({
      recordGroupKey: RECORD_GROUP,
      fieldKey: `edital_s8_${ref.replace(/\./g, '_')}_${budgetLines.length}`,
      proposedValue: JSON.stringify(payload),
      sourceExcerpt: line.slice(0, 400),
    });

    if (budgetLines.length >= 500) break;
  }

  extractEpiBulletBlocks(rawLines, budgetLines, seen);

  return {
    anchorFound: true,
    budgetLines,
  };
}

function parseSubitemLine(line: string): { ref: string; description: string } | null {
  let m = LINE_SUBITEM.exec(line);
  if (!m) m = LINE_SUBITEM_TIGHT.exec(line);
  if (!m) return null;

  const ref = m[1];
  let description = normalizeSpaces(m[2]);
  description = description.replace(/[.;:]+$/g, '').trim();
  if (!description) return null;

  const parts = ref.split('.').map((x) => Number.parseInt(x, 10));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  if (parts[0] !== 8) return null;

  return { ref, description };
}

/**
 * Listas com traço/bullet sob 8.7 (EPIs por função), sem subnúmero 8.7.x.y.
 */
function extractEpiBulletBlocks(
  lines: string[],
  budgetLines: BudgetLineCandidate[],
  seen: Set<string>,
): void {
  const bulletRe = /^\s*[-–—•·]\s*(.+)$/;
  let inEpiBlock = false;
  let blockParent = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^8\.7\.\d+\s+/i.test(line) && /EPI/i.test(line)) {
      inEpiBlock = true;
      const mh = /^8\.7\.(\d+)\s+(.+)$/.exec(line);
      blockParent = mh ? `8.7.${mh[1]}` : '8.7';
      continue;
    }

    if (/^8\.8\s+/i.test(line) || /^9\s+/i.test(line)) {
      inEpiBlock = false;
      blockParent = '';
      continue;
    }

    if (!inEpiBlock) continue;

    const bm = bulletRe.exec(line);
    if (!bm) continue;

    let description = normalizeSpaces(bm[1]);
    description = description.replace(/[.;:]+$/g, '').trim();
    if (description.length < 4 || description.length > 500) continue;
    if (/^EPIs?\s+para/i.test(description)) continue;

    const fp = `bullet|${blockParent}|${description}`;
    if (seen.has(fp)) continue;
    seen.add(fp);

    const payload = {
      description,
      itemRef: blockParent || '8.7',
      source: 'edital_secao_8_epi_lista',
      sectionLabel: RECORD_GROUP,
    };

    budgetLines.push({
      recordGroupKey: RECORD_GROUP,
      fieldKey: `edital_s8_epi_${budgetLines.length}`,
      proposedValue: JSON.stringify(payload),
      sourceExcerpt: line.slice(0, 400),
    });

    if (budgetLines.length >= 500) return;
  }
}
