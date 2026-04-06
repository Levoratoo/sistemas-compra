import type { BudgetLineCandidate } from './implementation-map-pdf.js';

function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

const PDF_NOISE_LINE =
  /^(--\s*\d+\s+of\s+\d+\s+--|P[aá]gina\s+\d+\s+de\s+\d+|Termo\s+de\s+Refer[êe]ncia\s*-\s*SEI|SEI\s+\d[\d.\s/\-]*\/\d+|Edital\s+de\s+licita|Site:\s*www\.|Sede\s+Administrativa|Atualiza[cç][ãa]o:|Documento\s+assinado\s+eletronicamente|A autenticidade deste documento|file:\/\/|CNPJ:\s*\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\s*\|)/i;

const TABLE_HEADER_LINE =
  /^(TIPO\s*\/\s*QTD|TIPO\s+QTD|ITEM\s+QTDE?\.?|ITEM\s+DE\s+UNIFORME|TIPO\s+ESPECIFICA[CÇ][AÃ]O|POSTO\s+DE\s+TRABALHO\s+EPI|FEMININO\s*\/\s*MASCULINO|FUN[CÇ][AÃ]O\s+EQUIPAMENTO\s+DE\s+PROTE[CÇ][AÃ]O)/i;

const SECTION_STOP_LINE =
  /^(\d+(?:\.\d+){1,5}\.?|ANEXO\s+[IVXLCDM]+|OBSERVA[CÇ][ÕO]ES?\s+GERAIS|Procedimentos\s+de\s+transi[cç][aã]o|DO\s+CONTRATO|Do\s+recebimento|Equipe\s+de\s+Planejamento|Documento\s+assinado|_{8,}|={8,})/i;

const KNOWN_UNIFORM_OR_GEAR_ITEMS = [
  'Distintivo da brigada',
  'Rádio Comunicador',
  'Apito com Cordão',
  'Bastão de Ronda',
  'Cinto Tático',
  'Cinto Gisnástico',
  'Capa de Colete',
  'Capa de Chuva',
  'Porta Cassetete',
  'Tonfa de Defesa',
  'Placa Balística',
  'Camisa Social',
  'Calça ou Saia ou Vestido',
  'Camisa Pólo',
  'Camiseta polo',
  'Camiseta Pólo',
  'Meia/Meia Calça',
  'Distintivo',
  'Balaclava',
  'Coturno',
  'Paletó',
  'Jaqueta',
  'Gandola',
  'Casaco',
  'Jaleco',
  'Calça',
  'Camisa',
  'Sapato',
  'Sapatos',
  'Bota',
  'Botas',
  'Boné',
  'Cinto',
  'Meias',
  'Meia',
  'Lanterna',
  'Coldre',
  'Algema',
  'Revólver',
  'Munição',
  'Crachá',
  'Colete',
].sort((a, b) => b.length - a.length);

const ROLE_HINT_LINE =
  /^(Arquivista|Auxiliar(?:\s+de\s+[A-Za-zÀ-ÿ]+)?|Apoio\s+operacional\s+administrativo|Almoxarife|Carregador|Bombeiro(?:\s+Civil)?|Recepcionista(?:\s+Vigia)?|Vigia|Vigilante|Secret[aá]rio(?:\s+Executivo)?|T[eé]cnico(?:\s+em\s+Secretariado)?|Maqueiro|Porteiro|Agente\s+de\s+portaria|Controlador|Cont[ií]nuo|Digitador|Encarregado|Auxiliar\s+de\s+farm[aá]cia|Recep[cç][aã]o)\b/i;

const INLINE_ROLE_PREFIXES = [
  'Recepcionista com insalubridade',
  'Apoio operacional administrativo',
  'Agente de portaria',
  'Auxiliar de farmácia',
  'Secretário Executivo',
  'Técnico em Secretariado',
  'Bombeiro Civil',
  'Recepcionista Vigia',
  'Recepcionista e Vigia',
  'Recepcionista',
  'Vigilante',
  'Bombeiro',
  'Vigia',
].sort((a, b) => b.length - a.length);

const INLINE_QTY_RE =
  /^(.+?)\s+(\d{1,3}(?:\s+\([^)]+\))?\s*(?:unidades?|pares?|par|conjuntos?|kits?|caixas?|livros?|cofres?|arm[aá]rios?|pe[cç]as?))\s+(.+)$/i;

const QTY_LINE_RE =
  /^\s*(\d{1,3}(?:\s+\([^)]+\))?\s*(?:unidades?|pares?|par|conjuntos?|kits?|caixas?|livros?|cofres?|arm[aá]rios?|pe[cç]as?))\b/i;

const TRAILING_QTY_RE = /^(.+?)\s+(\d{1,3})\s*$/;

function isNoise(line: string) {
  const t = line.trim();
  return !t || PDF_NOISE_LINE.test(t);
}

function isRoleLine(line: string): string | null {
  const t = normalizeSpaces(line);
  if (!t || TABLE_HEADER_LINE.test(t) || SECTION_STOP_LINE.test(t)) return null;

  const cargo = /^CARGO:\s*(.+)$/i.exec(t);
  if (cargo) {
    return normalizeSpaces(cargo[1].replace(/\s*-\s*G[ÊE]NERO:.*$/i, ''));
  }

  const recepcao = /servi[cç]o\s+de\s+Recep[cç][aã]o/i.test(t);
  if (recepcao) {
    return 'Recepção';
  }

  if (/:\s*$/.test(t)) {
    const role = t.replace(/:\s*$/, '').trim();
    if (role.length >= 3 && role.length <= 120 && ROLE_HINT_LINE.test(role) && !/\bcom$/i.test(role)) {
      return role;
    }
  }

  if (t.length <= 60 && ROLE_HINT_LINE.test(t) && !/[0-9]/.test(t) && !/\bcom$/i.test(t)) {
    return t;
  }

  return null;
}

function isLikelyItemName(line: string) {
  const t = normalizeSpaces(line);
  if (!t || isNoise(t) || TABLE_HEADER_LINE.test(t) || SECTION_STOP_LINE.test(t)) return false;
  if (isRoleLine(t)) return false;
  if (QTY_LINE_RE.test(t)) return false;
  if (/^(Observa[cç][aã]o|Obs\.?:|Modelo\s+(feminino|masculino)|A defini[cç][aã]o estabelecida|Cor\s+|Tipo\s+|Tecido\s+|Adequado\s+|Material\s+:|Filtro\s+:|Efici[eê]ncia\s+:)/i.test(t)) {
    return false;
  }
  if (KNOWN_UNIFORM_OR_GEAR_ITEMS.some((item) => new RegExp(`^${item.replace(/\s+/g, '\\s+')}(?:\\b|\\s)`, 'i').test(t))) {
    return true;
  }
  return t.length >= 3 && t.length <= 80 && /^[A-ZÀ-ÿ0-9][A-Za-zÀ-ÿ0-9\s\/().-]+$/.test(t);
}

function splitItemAndDescription(line: string) {
  const normalized = normalizeSpaces(line);
  for (const item of KNOWN_UNIFORM_OR_GEAR_ITEMS) {
    const re = new RegExp(`^(${item.replace(/\s+/g, '\\s+')})(?:\\s+(.+))?$`, 'i');
    const match = re.exec(normalized);
    if (match) {
      return {
        item: normalizeSpaces(match[1]),
        description: normalizeSpaces(match[2] ?? ''),
      };
    }
  }

  const inline = INLINE_QTY_RE.exec(normalized);
  if (inline) {
    return {
      item: normalizeSpaces(inline[1]),
      description: `${normalizeSpaces(inline[2])} ${normalizeSpaces(inline[3])}`.trim(),
    };
  }

  return {
    item: normalized,
    description: '',
  };
}

function extractInlineRolePrefix(line: string) {
  const normalized = normalizeSpaces(line);
  for (const prefix of INLINE_ROLE_PREFIXES) {
    const re = new RegExp(`^(${prefix.replace(/\s+/g, '\\s+')})\\s+(.+)$`, 'i');
    const match = re.exec(normalized);
    if (!match) continue;
    return {
      role: normalizeSpaces(match[1]),
      rest: normalizeSpaces(match[2]),
    };
  }
  return null;
}

function maybeMergeBrokenItemLine(lines: string[], index: number) {
  const current = normalizeSpaces(lines[index] ?? '');
  const next = normalizeSpaces(lines[index + 1] ?? '');
  if (!current || !next) return { line: current, consumedNext: false };
  if (TABLE_HEADER_LINE.test(next) || SECTION_STOP_LINE.test(next) || isRoleLine(next) || QTY_LINE_RE.test(next)) {
    return { line: current, consumedNext: false };
  }

  const combined = normalizeSpaces(`${current} ${next}`);
  const combinedLooksKnown = KNOWN_UNIFORM_OR_GEAR_ITEMS.some((item) =>
    new RegExp(`^${item.replace(/\s+/g, '\\s+')}(?:\\b|\\s)`, 'i').test(combined),
  );

  if (combinedLooksKnown && !isLikelyItemName(current)) {
    return { line: combined, consumedNext: true };
  }

  if (
    /^(Apito\s+com|Bast[aã]o\s+de|R[aá]dio|Capa\s+de|Porta|Distintivo\s+da|Bon[eé]\s+\(item\s+opcional\))$/i.test(
      current,
    )
  ) {
    return { line: combined, consumedNext: true };
  }

  return { line: current, consumedNext: false };
}

function pushUniqueBudgetLine(
  rows: BudgetLineCandidate[],
  seen: Set<string>,
  payload: Record<string, unknown>,
  recordGroupKey: string | null,
  fieldKey: string,
  sourceExcerpt: string,
) {
  const fp = `${recordGroupKey ?? ''}|${JSON.stringify(payload)}`;
  if (seen.has(fp)) return;
  seen.add(fp);
  rows.push({
    recordGroupKey,
    fieldKey,
    proposedValue: JSON.stringify(payload),
    sourceExcerpt: sourceExcerpt.slice(0, 400),
  });
}

function dedupeRowsBySemanticItem(rows: BudgetLineCandidate[]) {
  const bestByKey = new Map<string, BudgetLineCandidate>();

  for (const row of rows) {
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(row.proposedValue) as Record<string, unknown>;
    } catch {
      parsed = null;
    }

    if (!parsed) {
      bestByKey.set(`${bestByKey.size}`, row);
      continue;
    }

    const item = String(parsed.item ?? parsed.description ?? '').trim();
    const quantity = String(parsed.quantity ?? '').trim();
    const source = String(parsed.source ?? '').trim();
    const key = `${row.recordGroupKey ?? ''}|${item}|${quantity}|${source}`;
    const existing = bestByKey.get(key);

    if (!existing) {
      bestByKey.set(key, row);
      continue;
    }

    let existingParsed: Record<string, unknown> | null = null;
    try {
      existingParsed = JSON.parse(existing.proposedValue) as Record<string, unknown>;
    } catch {
      existingParsed = null;
    }

    const currentDetail = String(parsed.detail ?? parsed.description ?? '').trim();
    const existingDetail = String(existingParsed?.detail ?? existingParsed?.description ?? '').trim();
    if (!existingDetail || (currentDetail && currentDetail.length < existingDetail.length)) {
      bestByKey.set(key, row);
    }
  }

  return Array.from(bestByKey.values());
}

function findNearbyKitQuantity(lines: string[], startIndex: number): string | null {
  const slice = lines
    .slice(Math.max(0, startIndex - 10), Math.min(lines.length, startIndex + 20))
    .join(' ');

  if (
    /02\s*\(?dois\)?\s+conjuntos?\s+completos?.*in[ií]cio/i.test(slice) &&
    /01\s*\(?um\)?\s+conjunto/i.test(slice)
  ) {
    if (/06\s*\(?seis\)?\s+meses/i.test(slice)) {
      return '02 conjuntos iniciais / 01 conjunto a cada 06 meses';
    }
    if (/anualmente/i.test(slice)) {
      return '02 conjuntos iniciais / 01 conjunto anual';
    }
    return '02 conjuntos iniciais / 01 conjunto de reposição';
  }

  return null;
}

function cleanupDescriptionParts(parts: string[]) {
  return normalizeSpaces(
    parts
      .filter((part) => part && !TABLE_HEADER_LINE.test(part) && !isRoleLine(part))
      .join(' ')
      .replace(/\bOU\b/gi, 'OU'),
  );
}

function sanitizeUniformDescription(description: string) {
  return normalizeSpaces(
    description
      .replace(/\b\d+(?:\.\d+){1,5}\..*$/i, '')
      .replace(/\bEPI['’`]?s?.*$/i, ''),
  );
}

export function extractBudgetLinesFromGenericRoleTables(fullText: string): BudgetLineCandidate[] {
  const lines = fullText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => normalizeSpaces(line))
    .filter((line) => line.length > 0 && !isNoise(line));

  const rows: BudgetLineCandidate[] = [];
  const seen = new Set<string>();
  let currentRole: string | null = null;
  let tableMode: 'tipo_qtd' | 'item_qtde' | null = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;

    const role = isRoleLine(line);
    if (role) {
      currentRole = role;
      continue;
    }

    if (/^TIPO\s*\/\s*QTD|^TIPO\s+QTD/i.test(line)) {
      tableMode = 'tipo_qtd';
      continue;
    }

    if (/^ITEM\s+QTDE?\.?/i.test(line)) {
      tableMode = 'item_qtde';
      continue;
    }

    if (!tableMode) {
      continue;
    }

    if (SECTION_STOP_LINE.test(line) && !/^OBSERVA[CÇ][ÕO]ES?\s+GERAIS/i.test(line)) {
      tableMode = null;
      continue;
    }

    if (tableMode === 'item_qtde') {
      const match = TRAILING_QTY_RE.exec(line);
      if (!match) continue;
      if (Number.isNaN(Number(match[2]))) continue;

      const item = normalizeSpaces(match[1]);
      if (!item || item.length < 3) continue;

      pushUniqueBudgetLine(
        rows,
        seen,
        {
          description: item,
          item,
          quantity: match[2],
          role: currentRole,
          source: 'edital_epi_item_qtde',
          sectionLabel: 'Anexo / tabela ITEM QTDE',
        },
        currentRole,
        `edital_annex_item_qtde_${rows.length}`,
        `${item} | ${match[2]}`,
      );
      continue;
    }

    const inline = INLINE_QTY_RE.exec(line);
    let itemLine = '';
    let quantity = '';
    let descParts: string[] = [];

    if (inline) {
      itemLine = normalizeSpaces(inline[1]);
      quantity = normalizeSpaces(inline[2]);
      descParts = [normalizeSpaces(inline[3])];
    } else if (isLikelyItemName(line) && QTY_LINE_RE.test(lines[i + 1] ?? '')) {
      itemLine = line;
      quantity = normalizeSpaces((QTY_LINE_RE.exec(lines[i + 1] ?? '')?.[1] ?? '').trim());
      i += 1;
    } else {
      continue;
    }

    for (let cursor = i + 1; cursor < lines.length; cursor += 1) {
      const next = lines[cursor]!;
      if (!next || isNoise(next)) continue;
      if (/^TIPO\s*\/\s*QTD|^TIPO\s+QTD|^ITEM\s+QTDE?\.?/i.test(next)) break;
      if (isRoleLine(next)) break;
      if (SECTION_STOP_LINE.test(next)) break;
      if (isLikelyItemName(next) && QTY_LINE_RE.test(lines[cursor + 1] ?? '')) break;
      if (INLINE_QTY_RE.test(next)) break;
      descParts.push(next);
      i = cursor;
    }

    const item = normalizeSpaces(itemLine);
    const description = sanitizeUniformDescription(cleanupDescriptionParts(descParts));
    if (!item || !quantity) continue;

    pushUniqueBudgetLine(
      rows,
      seen,
      {
        description: currentRole ? `${currentRole} — ${item}` : item,
        detail: description || '(ver edital)',
        quantity,
        role: currentRole,
        item,
        source: 'edital_anexo_tipo_qtd',
        sectionLabel: 'Anexo / tabela TIPO QTD',
      },
      currentRole,
      `edital_annex_tipo_qtd_${rows.length}`,
      `${item} | ${quantity} | ${description || '(ver edital)'}`,
    );
  }

  return dedupeRowsBySemanticItem(rows);
}

function extractQuantityFromInlineEpiText(line: string) {
  const normalized = normalizeSpaces(line);
  const annualMonthly = normalized.match(/\bpor\s+ano\b.*\(\s*ou\s+uma\s+m[aá]scara\s+por\s+m[eê]s\s*\)/i);
  if (annualMonthly) {
    return {
      quantity: 'anual / 01 por mês',
      description: normalizeSpaces(
        normalized
          .replace(annualMonthly[0], '')
          .replace(/\(\s*ou\s+uma\s+m[aá]scara\s+por\s+m[eê]s\s*\)/i, ''),
      ),
    };
  }

  const explicit = normalized.match(/(\d{1,3}\s+(?:pares?|par|caixas?|unidades?|m[aá]scaras?))(?:\s+cada)?(?:\s+por\s+(?:ano|m[eê]s|trimestre))?/i);
  if (explicit) {
    const quantity = explicit[0].replace(/\s+/g, ' ').trim();
    const description = normalizeSpaces(
      normalized
        .replace(explicit[0], '')
        .replace(/\(\s*ou\s+uma\s+m[aá]scara\s+por\s+m[eê]s\s*\)/i, '')
        .replace(/\bpor\s+ano\b/gi, '')
        .replace(/\bpor\s+m[eê]s\b/gi, ''),
    );
    return {
      quantity,
      description: description || normalized,
    };
  }

  const monthly = normalized.match(/\buma\s+m[aá]scara\s+por\s+m[eê]s\b/i);
  if (monthly) {
    return {
      quantity: '01 por mês',
      description: normalizeSpaces(normalized.replace(monthly[0], '').replace(/[()]/g, '')),
    };
  }

  if (/\bpor\s+ano\b/i.test(normalized)) {
    return {
      quantity: 'anual',
      description: normalizeSpaces(normalized.replace(/\bpor\s+ano\b/gi, '')),
    };
  }

  return {
    quantity: '—',
    description: normalized,
  };
}

function mergeWrappedPostoEpiLines(inputLines: string[]) {
  const merged: string[] = [];
  for (let i = 0; i < inputLines.length; i += 1) {
    let current = inputLines[i] ?? '';
    while (
      i + 1 < inputLines.length &&
      (
        /\(\s*ou\s+uma\s+m[aá]scara\s+por$/i.test(current) ||
        /\bpor$/i.test(current) ||
        (current.includes('(') && !current.includes(')'))
      ) &&
      !TABLE_HEADER_LINE.test(inputLines[i + 1] ?? '') &&
      !SECTION_STOP_LINE.test(inputLines[i + 1] ?? '') &&
      !isRoleLine(inputLines[i + 1] ?? '')
    ) {
      current = normalizeSpaces(`${current} ${inputLines[i + 1] ?? ''}`);
      i += 1;
    }
    merged.push(current);
  }
  return merged;
}

export function extractBudgetLinesFromPostoEpiTables(fullText: string): BudgetLineCandidate[] {
  const baseLines = fullText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => normalizeSpaces(line))
    .filter((line) => line.length > 0 && !isNoise(line));
  const lines = mergeWrappedPostoEpiLines(baseLines);

  const rows: BudgetLineCandidate[] = [];
  const seen = new Set<string>();
  let inTable = false;
  let currentRole: string | null = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;

    if (/^POSTO\s+DE\s+TRABALHO\s+EPI/i.test(line)) {
      inTable = true;
      currentRole = null;
      continue;
    }

    if (!inTable) continue;
    if (SECTION_STOP_LINE.test(line)) break;

    const inlineRoleItem = extractInlineRolePrefix(line);
    if (inlineRoleItem) {
      const possibleRole = isRoleLine(inlineRoleItem.role);
      if (
        possibleRole &&
        /máscara|luva|óculos|protetor|capacete|balaclava|coturno|vestimenta|cinto|respirador/i.test(
          inlineRoleItem.rest,
        )
      ) {
        currentRole = possibleRole;
        const parsed = extractQuantityFromInlineEpiText(inlineRoleItem.rest);
        const description = normalizeSpaces(parsed.description);
        if (description.length >= 3) {
          pushUniqueBudgetLine(
            rows,
            seen,
            {
              description: `${currentRole} — ${description}`,
              item: description,
              quantity: parsed.quantity,
              role: currentRole,
              source: 'edital_epi_posto_lista',
              sectionLabel: 'Tabela POSTO DE TRABALHO / EPI',
            },
            currentRole,
            `edital_posto_epi_${rows.length}`,
            `${currentRole} | ${description} | ${parsed.quantity}`,
          );
        }
        continue;
      }
    }

    const role = isRoleLine(line);
    if (role && !/máscara|luva|óculos|protetor|capacete|balaclava|coturno|vestimenta|cinto|respirador/i.test(role)) {
      currentRole = role;
      continue;
    }

    if (!currentRole) continue;
    if (!line || TABLE_HEADER_LINE.test(line)) continue;

    const parsed = extractQuantityFromInlineEpiText(line);
    const description = normalizeSpaces(parsed.description);
    if (!description || description.length < 3) continue;

    pushUniqueBudgetLine(
      rows,
      seen,
      {
        description: currentRole ? `${currentRole} — ${description}` : description,
        item: description,
        quantity: parsed.quantity,
        role: currentRole,
        source: 'edital_epi_posto_lista',
        sectionLabel: 'Tabela POSTO DE TRABALHO / EPI',
      },
      currentRole,
      `edital_posto_epi_${rows.length}`,
      `${currentRole} | ${description} | ${parsed.quantity}`,
    );
  }

  return dedupeRowsBySemanticItem(rows);
}

export function extractBudgetLinesFromUniformKitTables(fullText: string): BudgetLineCandidate[] {
  const lines = fullText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => normalizeSpaces(line))
    .filter((line) => line.length > 0 && !isNoise(line));

  const rows: BudgetLineCandidate[] = [];
  const seen = new Set<string>();
  let currentRole: string | null = null;
  let currentKitQuantity: string | null = null;
  let inUniformTable = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;

    const role = isRoleLine(line);
    if (role) {
      currentRole = role;
    }

    if (/02\s*\(?dois\)?\s+conjuntos?\s+completos?.*(01\s*\(?um\)?\s+conjunto)/i.test(line)) {
      currentKitQuantity = findNearbyKitQuantity(lines, i) ?? currentKitQuantity;
      continue;
    }

    if (/^ITEM\s+DE\s+UNIFORME/i.test(line) || /^Tipo\s+Especifica[cç][aã]o/i.test(line)) {
      inUniformTable = true;
      currentKitQuantity = currentKitQuantity ?? findNearbyKitQuantity(lines, i);
      continue;
    }

    if (!inUniformTable) continue;
    if (SECTION_STOP_LINE.test(line) || /^FUN[CÇ][AÃ]O\s+Equipamento/i.test(line)) {
      inUniformTable = false;
      continue;
    }
    if (TABLE_HEADER_LINE.test(line)) continue;

    const mergedLine = maybeMergeBrokenItemLine(lines, i);
    const { item, description: inlineDescription } = splitItemAndDescription(mergedLine.line);
    if (!item || !isLikelyItemName(item)) continue;
    if (mergedLine.consumedNext) {
      i += 1;
    }

    const descParts = inlineDescription ? [inlineDescription] : [];
    for (let cursor = i + 1; cursor < lines.length; cursor += 1) {
      const next = lines[cursor]!;
      if (!next || isNoise(next)) continue;
      if (TABLE_HEADER_LINE.test(next) || SECTION_STOP_LINE.test(next)) break;
      if (isRoleLine(next)) break;
      const split = splitItemAndDescription(next);
      if (split.item && split.item !== next && isLikelyItemName(split.item)) break;
      if (isLikelyItemName(next) && !inlineDescription) break;
      descParts.push(next);
      i = cursor;
    }

    const description = cleanupDescriptionParts(descParts);
    pushUniqueBudgetLine(
      rows,
      seen,
      {
        description: currentRole ? `${currentRole} — ${item}` : item,
        detail: description || '(ver edital)',
        quantity: currentKitQuantity ?? '02 conjuntos completos',
        role: currentRole,
        item,
        source: 'edital_uniforme_kit_table',
        sectionLabel: 'Tabela de uniformes / equipamentos',
      },
      currentRole,
      `edital_uniforme_kit_${rows.length}`,
      `${item} | ${currentKitQuantity ?? '02 conjuntos completos'} | ${description || '(ver edital)'}`,
    );
  }

  return dedupeRowsBySemanticItem(rows);
}
