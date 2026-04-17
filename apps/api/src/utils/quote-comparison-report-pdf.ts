import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN = 36;
/** Topo visual do cartão do cabeçalho (coordenada Y superior do retângulo). */
const HEADER_CARD_TOP_Y = PAGE_HEIGHT - 26;
const ITEM_TABLE_COLUMNS = {
  description: 176,
  quantity: 38,
  slot1: 64,
  slot2: 64,
  slot3: 64,
  winner: 93,
};

/** Paleta alinhada a um visual “dashboard” profissional (teal + slots distintos). */
const C = {
  brand: rgb(0.0, 0.55, 0.62),
  brandDeep: rgb(0.04, 0.22, 0.26),
  headerBar: rgb(0.06, 0.42, 0.48),
  tableHeader: rgb(0.07, 0.36, 0.42),
  text: rgb(0.06, 0.09, 0.12),
  textMuted: rgb(0.38, 0.42, 0.48),
  borderLight: rgb(0.86, 0.9, 0.93),
  cardBg: rgb(0.97, 0.99, 0.99),
  winText: rgb(0.02, 0.42, 0.3),
  tieText: rgb(0.55, 0.32, 0.06),
  pendingText: rgb(0.42, 0.44, 0.48),
};

const SLOT_BG: Record<1 | 2 | 3, { soft: RGB; win: RGB; accent: RGB }> = {
  1: {
    soft: rgb(0.93, 0.96, 1),
    win: rgb(0.78, 0.93, 0.86),
    accent: rgb(0.15, 0.45, 0.88),
  },
  2: {
    soft: rgb(0.9, 0.98, 0.96),
    win: rgb(0.76, 0.94, 0.9),
    accent: rgb(0.05, 0.62, 0.52),
  },
  3: {
    soft: rgb(1, 0.96, 0.91),
    win: rgb(0.94, 0.9, 0.82),
    accent: rgb(0.92, 0.48, 0.12),
  },
};

const TIE_CELL = rgb(0.99, 0.93, 0.82);
const ROW_STRIPE = rgb(0.995, 0.997, 1);

export type QuoteComparisonReportPdfInput = {
  issuerName: string;
  issuerCity: string | null;
  issuerState: string | null;
  projectCode: string;
  projectName: string;
  purchaseTitle: string;
  purchaseNotes: string | null;
  issuedAtLabel: string;
  analysis: {
    headline: string;
    summaryLines: string[];
    bestSlotNumbers: number[];
    bestSupplierNames: string[];
    bestTotalValue: number | null;
    secondBestTotalValue: number | null;
    savingsValue: number | null;
    savingsPercent: number | null;
    completeSlotCount: number;
    itemWinnerCounts: Array<{
      slotNumber: number;
      supplierId: string | null;
      supplierName: string | null;
      totalValue: number | null;
      itemCount: number;
      filledItemCount: number;
      isComplete: boolean;
      uniqueWinCount: number;
      tieCount: number;
    }>;
  };
  slotTotals: Array<{
    slotNumber: number;
    supplierId: string | null;
    supplierName: string | null;
    totalValue: number | null;
    itemCount: number;
    filledItemCount: number;
    isComplete: boolean;
  }>;
  rows: Array<{
    description: string;
    quantity: number | null;
    slotTotals: Array<{
      slotNumber: number;
      totalValue: number | null;
    }>;
    winnerStatus: 'NONE' | 'UNIQUE' | 'TIE';
    winnerSlotNumbers: number[];
    winnerLabel: string;
  }>;
};

function formatCurrency(value: number | null | undefined) {
  return value == null
    ? '-'
    : new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(value);
}

function formatNumber(value: number | null | undefined) {
  return value == null ? '-' : new Intl.NumberFormat('pt-BR').format(value);
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) {
    return [''];
  }

  const words = clean.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate;
      continue;
    }

    lines.push(current);
    current = word;
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function drawSectionTitle(page: PDFPage, boldFont: PDFFont, y: number, title: string) {
  const barH = 14;
  page.drawRectangle({
    x: PAGE_MARGIN,
    y: y - barH + 2,
    width: 3,
    height: barH,
    color: C.brand,
  });
  page.drawText(title, {
    x: PAGE_MARGIN + 10,
    y,
    size: 11.5,
    font: boldFont,
    color: C.brandDeep,
  });
}

/**
 * Cabeçalho com quebra de linha para nomes longos (órgão, compra, projeto).
 * Retorna a coordenada Y mais baixa do conteúdo (para posicionar o corpo do relatório).
 */
function drawPageHeader(page: PDFPage, regularFont: PDFFont, boldFont: PDFFont, input: QuoteComparisonReportPdfInput): number {
  const padX = PAGE_MARGIN + 14;
  const innerW = PAGE_WIDTH - PAGE_MARGIN * 2 - 28;
  const colW = Math.floor((innerW - 16) / 2);
  const emitX = padX + colW + 16;

  const projectLine = `${input.projectCode}  |  ${input.projectName}`;
  const projectLines = wrapText(projectLine, regularFont, 9, innerW);
  const compraLines = wrapText((input.purchaseTitle ?? '').trim() || '-', regularFont, 9.5, colW);
  const emitidoLines = wrapText((input.issuedAtLabel ?? '').trim() || '-', regularFont, 9.5, colW);
  const issuerText = [input.issuerName, [input.issuerCity, input.issuerState].filter(Boolean).join('/')].filter(Boolean).join(' - ') || '-';
  const orgLines = wrapText(issuerText, regularFont, 9.5, innerW);

  const titleY = PAGE_HEIGHT - 44;
  let y = titleY - 18;
  for (const _ of projectLines) {
    y -= 11;
  }
  y -= 8;
  const metaLabelY = y;
  const maxMeta = Math.max(compraLines.length, emitidoLines.length);
  const metaBottom = metaLabelY - 11 * maxMeta;
  const orgLabelY = metaBottom - 14;
  const lowestY = orgLabelY - 11 * orgLines.length;
  const cardBottomY = lowestY - 12;
  const cardHeight = HEADER_CARD_TOP_Y - cardBottomY;

  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 4,
    width: PAGE_WIDTH,
    height: 4,
    color: C.headerBar,
  });

  page.drawRectangle({
    x: PAGE_MARGIN,
    y: cardBottomY,
    width: PAGE_WIDTH - PAGE_MARGIN * 2,
    height: cardHeight,
    color: C.cardBg,
    borderColor: C.borderLight,
    borderWidth: 0.75,
  });

  page.drawText('Relatório do mapa comparativo', {
    x: padX,
    y: titleY,
    size: 16,
    font: boldFont,
    color: C.brandDeep,
  });

  y = titleY - 18;
  for (const line of projectLines) {
    page.drawText(line, {
      x: padX,
      y,
      size: 9,
      font: regularFont,
      color: C.textMuted,
    });
    y -= 11;
  }
  y -= 8;

  page.drawText('Compra', {
    x: padX,
    y,
    size: 7.5,
    font: boldFont,
    color: C.textMuted,
  });
  page.drawText('Emitido em', {
    x: emitX,
    y,
    size: 7.5,
    font: boldFont,
    color: C.textMuted,
  });
  const metaLabelBaseline = y;
  for (let i = 0; i < maxMeta; i += 1) {
    if (i < compraLines.length) {
      page.drawText(compraLines[i]!, {
        x: padX,
        y: metaLabelBaseline - 11 - i * 11,
        size: 9.5,
        font: regularFont,
        color: C.text,
      });
    }
    if (i < emitidoLines.length) {
      page.drawText(emitidoLines[i]!, {
        x: emitX,
        y: metaLabelBaseline - 11 - i * 11,
        size: 9.5,
        font: regularFont,
        color: C.text,
      });
    }
  }

  page.drawText('Órgão / base', {
    x: padX,
    y: orgLabelY,
    size: 7.5,
    font: boldFont,
    color: C.textMuted,
  });
  for (let i = 0; i < orgLines.length; i += 1) {
    page.drawText(orgLines[i]!, {
      x: padX,
      y: orgLabelY - 11 - i * 11,
      size: 9.5,
      font: regularFont,
      color: C.text,
    });
  }

  return lowestY - 18;
}

function slotRowTint(slotNumber: number): RGB {
  const s = SLOT_BG[slotNumber as 1 | 2 | 3] ?? SLOT_BG[1];
  return rgb(
    s.soft.red * 0.55 + 1 * 0.45,
    s.soft.green * 0.55 + 1 * 0.45,
    s.soft.blue * 0.55 + 1 * 0.45,
  );
}

function drawSlotSummaryTable(
  page: PDFPage,
  regularFont: PDFFont,
  boldFont: PDFFont,
  startY: number,
  input: QuoteComparisonReportPdfInput,
) {
  const left = PAGE_MARGIN;
  const colWidths = [66, 166, 74, 72, 66, 58];
  const headers = ['Orçamento', 'Fornecedor', 'Status', 'Total', 'Vitórias', 'Empates'];
  const headerHeight = 20;
  const totalWidth = colWidths.reduce((sum, width) => sum + width, 0);

  page.drawRectangle({
    x: left,
    y: startY - headerHeight,
    width: totalWidth,
    height: headerHeight,
    color: C.tableHeader,
    borderWidth: 0,
  });

  let currentX = left;
  headers.forEach((header, index) => {
    page.drawText(header, {
      x: currentX + 6,
      y: startY - 13,
      size: 8.5,
      font: boldFont,
      color: rgb(1, 1, 1),
    });
    currentX += colWidths[index] ?? 0;
  });

  currentX = left;
  for (let index = 0; index < colWidths.length - 1; index += 1) {
    currentX += colWidths[index] ?? 0;
    page.drawLine({
      start: { x: currentX, y: startY },
      end: { x: currentX, y: startY - headerHeight },
      thickness: 0.35,
      color: rgb(0.25, 0.45, 0.48),
    });
  }

  let y = startY - headerHeight;

  for (let ri = 0; ri < input.analysis.itemWinnerCounts.length; ri += 1) {
    const slot = input.analysis.itemWinnerCounts[ri]!;
    const status = slot.isComplete ? 'Completo' : 'Em aberto';
    const values = [
      `Orc. ${slot.slotNumber}`,
      slot.supplierName || 'Não definido',
      status,
      formatCurrency(slot.totalValue),
      String(slot.uniqueWinCount),
      String(slot.tieCount),
    ];
    const rowHeight = 26;
    const stripe = ri % 2 === 0 ? rgb(1, 1, 1) : ROW_STRIPE;
    const rowTint = slotRowTint(slot.slotNumber);

    page.drawRectangle({
      x: left,
      y: y - rowHeight,
      width: totalWidth,
      height: rowHeight,
      color: stripe,
      borderColor: C.borderLight,
      borderWidth: 0.4,
    });

    page.drawRectangle({
      x: left,
      y: y - rowHeight,
      width: 5,
      height: rowHeight,
      color: (SLOT_BG[slot.slotNumber as 1 | 2 | 3] ?? SLOT_BG[1]).accent,
    });

    page.drawRectangle({
      x: left + 5,
      y: y - rowHeight,
      width: (colWidths[0] ?? 0) - 5,
      height: rowHeight,
      color: rowTint,
    });

    let cellX = left;
    values.forEach((value, index) => {
      const lines = wrapText(value, regularFont, 8, (colWidths[index] ?? 0) - 10);
      const textColor = index === 2 && status === 'Completo' ? C.winText : C.text;
      lines.slice(0, 2).forEach((line, lineIndex) => {
        page.drawText(line, {
          x: cellX + (index === 0 ? 8 : 6),
          y: y - 15 - lineIndex * 9,
          size: 8,
          font: regularFont,
          color: textColor,
        });
      });
      cellX += colWidths[index] ?? 0;
    });

    y -= rowHeight;
  }

  return y;
}

function drawItemTableHeader(page: PDFPage, boldFont: PDFFont, y: number) {
  const totalWidth = Object.values(ITEM_TABLE_COLUMNS).reduce((sum, width) => sum + width, 0);
  let currentX = PAGE_MARGIN;
  const headerHeight = 22;
  const headers = ['Descrição', 'Qtd.', 'Orc. 1', 'Orc. 2', 'Orc. 3', 'Melhor / situação'];
  const widths = Object.values(ITEM_TABLE_COLUMNS);

  page.drawRectangle({
    x: PAGE_MARGIN,
    y: y - headerHeight,
    width: totalWidth,
    height: headerHeight,
    color: C.tableHeader,
    borderWidth: 0,
  });

  headers.forEach((header, index) => {
    page.drawText(header, {
      x: currentX + 5,
      y: y - 14,
      size: 8.5,
      font: boldFont,
      color: rgb(1, 1, 1),
    });
    currentX += widths[index] ?? 0;
  });

  currentX = PAGE_MARGIN;
  for (let slot = 1; slot <= 3; slot += 1) {
    const colIndex = slot + 1;
    let x0 = PAGE_MARGIN;
    for (let i = 0; i < colIndex; i += 1) {
      x0 += widths[i] ?? 0;
    }
    const w = widths[colIndex] ?? 0;
    page.drawRectangle({
      x: x0,
      y: y - headerHeight,
      width: w,
      height: 4,
      color: (SLOT_BG[slot as 1 | 2 | 3] ?? SLOT_BG[1]).accent,
    });
  }

  currentX = PAGE_MARGIN;
  for (let index = 0; index < widths.length - 1; index += 1) {
    currentX += widths[index] ?? 0;
    page.drawLine({
      start: { x: currentX, y },
      end: { x: currentX, y: y - headerHeight },
      thickness: 0.35,
      color: rgb(0.2, 0.42, 0.46),
    });
  }

  return y - headerHeight;
}

function slotCellBackground(
  slotNumber: 1 | 2 | 3,
  row: QuoteComparisonReportPdfInput['rows'][number],
): { fill: RGB; valueBold: boolean; valueColor: RGB } {
  const palette = SLOT_BG[slotNumber];
  if (row.winnerStatus === 'UNIQUE' && row.winnerSlotNumbers[0] === slotNumber) {
    return { fill: palette.win, valueBold: true, valueColor: C.winText };
  }
  if (row.winnerStatus === 'TIE' && row.winnerSlotNumbers.includes(slotNumber)) {
    return { fill: TIE_CELL, valueBold: true, valueColor: C.tieText };
  }
  return { fill: palette.soft, valueBold: false, valueColor: C.text };
}

function winnerColumnStyle(row: QuoteComparisonReportPdfInput['rows'][number]): { fill: RGB; text: RGB } {
  if (row.winnerStatus === 'UNIQUE') {
    return { fill: rgb(0.88, 0.97, 0.92), text: C.winText };
  }
  if (row.winnerStatus === 'TIE') {
    return { fill: rgb(0.98, 0.94, 0.88), text: C.tieText };
  }
  return { fill: rgb(0.96, 0.97, 0.98), text: C.pendingText };
}

function drawItemRow(
  page: PDFPage,
  regularFont: PDFFont,
  boldFont: PDFFont,
  y: number,
  row: QuoteComparisonReportPdfInput['rows'][number],
  rowIndex: number,
) {
  const descriptionLines = wrapText(row.description, regularFont, 8, ITEM_TABLE_COLUMNS.description - 8);
  const winnerLines = wrapText(row.winnerLabel, boldFont, 8, ITEM_TABLE_COLUMNS.winner - 8);
  const lineCount = Math.max(descriptionLines.length, winnerLines.length, 1);
  const rowHeight = 10 + lineCount * 9;
  const widths = Object.values(ITEM_TABLE_COLUMNS);
  const totalWidth = widths.reduce((a, b) => a + b, 0);
  const slotMap = new Map(row.slotTotals.map((slot) => [slot.slotNumber, slot.totalValue]));

  const baseStripe = rowIndex % 2 === 0 ? rgb(1, 1, 1) : ROW_STRIPE;

  let x = PAGE_MARGIN;
  const cellsBg: Array<{ x: number; w: number; fill: RGB }> = [
    { x, w: widths[0]!, fill: baseStripe },
  ];
  x += widths[0]!;
  cellsBg.push({ x, w: widths[1]!, fill: rgb(0.97, 0.98, 0.99) });
  x += widths[1]!;
  for (const sn of [1, 2, 3] as const) {
    const { fill } = slotCellBackground(sn, row);
    cellsBg.push({ x, w: widths[sn + 1]!, fill });
    x += widths[sn + 1]!;
  }
  const wStyle = winnerColumnStyle(row);
  cellsBg.push({ x, w: widths[5]!, fill: wStyle.fill });

  page.drawRectangle({
    x: PAGE_MARGIN,
    y: y - rowHeight,
    width: totalWidth,
    height: rowHeight,
    color: baseStripe,
    borderColor: C.borderLight,
    borderWidth: 0.45,
  });

  for (const cell of cellsBg) {
    page.drawRectangle({
      x: cell.x,
      y: y - rowHeight,
      width: cell.w,
      height: rowHeight,
      color: cell.fill,
    });
  }

  const qtyText = formatNumber(row.quantity);
  page.drawText(qtyText, {
    x: PAGE_MARGIN + widths[0]! + 5,
    y: y - 13,
    size: 8,
    font: regularFont,
    color: C.text,
  });

  for (let si = 0; si < 3; si += 1) {
    const slotNumber = (si + 1) as 1 | 2 | 3;
    const colIndex = si + 2;
    let colX = PAGE_MARGIN;
    for (let j = 0; j < colIndex; j += 1) {
      colX += widths[j] ?? 0;
    }
    const style = slotCellBackground(slotNumber, row);
    const val = formatCurrency(slotMap.get(slotNumber) ?? null);
    page.drawText(val, {
      x: colX + 5,
      y: y - 13,
      size: 8,
      font: style.valueBold ? boldFont : regularFont,
      color: style.valueColor,
    });
  }

  descriptionLines.forEach((line, lineIndex) => {
    page.drawText(line, {
      x: PAGE_MARGIN + 5,
      y: y - 13 - lineIndex * 9,
      size: 8,
      font: regularFont,
      color: C.text,
    });
  });

  winnerLines.forEach((line, lineIndex) => {
    let wx = PAGE_MARGIN;
    for (let j = 0; j < 5; j += 1) {
      wx += widths[j] ?? 0;
    }
    page.drawText(line, {
      x: wx + 5,
      y: y - 13 - lineIndex * 9,
      size: 8,
      font: boldFont,
      color: wStyle.text,
    });
  });

  let lineX = PAGE_MARGIN;
  for (let index = 0; index < widths.length - 1; index += 1) {
    lineX += widths[index] ?? 0;
    page.drawLine({
      start: { x: lineX, y },
      end: { x: lineX, y: y - rowHeight },
      thickness: 0.35,
      color: C.borderLight,
    });
  }

  return y - rowHeight;
}

function addPage(document: PDFDocument, regularFont: PDFFont, boldFont: PDFFont, input: QuoteComparisonReportPdfInput) {
  const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const yBelowHeader = drawPageHeader(page, regularFont, boldFont, input);
  return {
    page,
    y: yBelowHeader,
  };
}

export function buildQuoteComparisonReportSearchText(input: QuoteComparisonReportPdfInput) {
  return [
    'Relatório do mapa comparativo de orçamentos',
    `Projeto: ${input.projectCode} - ${input.projectName}`,
    `Compra: ${input.purchaseTitle}`,
    `Emitido em: ${input.issuedAtLabel}`,
    `Análise: ${input.analysis.headline}`,
    ...input.analysis.summaryLines,
    ...input.slotTotals.map(
      (slot) =>
        `Orçamento ${slot.slotNumber}: ${slot.supplierName || 'Fornecedor não definido'} | Total ${formatCurrency(slot.totalValue)} | ${slot.filledItemCount}/${slot.itemCount} itens`,
    ),
    ...input.rows.map(
      (row) =>
        `${row.description} | Qtd ${formatNumber(row.quantity)} | O1 ${formatCurrency(row.slotTotals.find((slot) => slot.slotNumber === 1)?.totalValue)} | O2 ${formatCurrency(row.slotTotals.find((slot) => slot.slotNumber === 2)?.totalValue)} | O3 ${formatCurrency(row.slotTotals.find((slot) => slot.slotNumber === 3)?.totalValue)} | ${row.winnerLabel}`,
    ),
  ].join('\n');
}

function drawExecutiveBlock(
  page: PDFPage,
  regularFont: PDFFont,
  boldFont: PDFFont,
  startY: number,
  input: QuoteComparisonReportPdfInput,
) {
  let y = startY;
  const pad = 12;
  const headlineLines = wrapText(input.analysis.headline, boldFont, 11, PAGE_WIDTH - PAGE_MARGIN * 2 - pad * 2);
  let summaryHeight = 0;
  for (const summaryLine of input.analysis.summaryLines) {
    const lines = wrapText(summaryLine, regularFont, 9, PAGE_WIDTH - PAGE_MARGIN * 2 - pad * 2 - 8);
    summaryHeight += lines.length * 11 + 2;
  }
  const boxH = 16 + headlineLines.length * 13 + 8 + summaryHeight + pad;

  page.drawRectangle({
    x: PAGE_MARGIN,
    y: y - boxH,
    width: PAGE_WIDTH - PAGE_MARGIN * 2,
    height: boxH,
    color: rgb(0.96, 0.99, 0.99),
    borderColor: C.borderLight,
    borderWidth: 0.6,
  });

  let innerY = y - pad - 4;
  for (const line of headlineLines) {
    page.drawText(line, {
      x: PAGE_MARGIN + pad,
      y: innerY,
      size: 11,
      font: boldFont,
      color: C.brandDeep,
    });
    innerY -= 13;
  }
  innerY -= 4;
  for (const summaryLine of input.analysis.summaryLines) {
    const lines = wrapText(summaryLine, regularFont, 9, PAGE_WIDTH - PAGE_MARGIN * 2 - pad * 2 - 12);
    for (const line of lines) {
      page.drawCircle({
        x: PAGE_MARGIN + pad + 2,
        y: innerY + 2.5,
        size: 2,
        color: C.brand,
      });
      page.drawText(line, {
        x: PAGE_MARGIN + pad + 10,
        y: innerY,
        size: 9,
        font: regularFont,
        color: C.text,
      });
      innerY -= 11;
    }
    innerY -= 2;
  }

  return y - boxH - 10;
}

export async function buildQuoteComparisonReportPdf(input: QuoteComparisonReportPdfInput) {
  const document = await PDFDocument.create();
  const regularFont = await document.embedFont(StandardFonts.Helvetica);
  const boldFont = await document.embedFont(StandardFonts.HelveticaBold);

  let { page, y } = addPage(document, regularFont, boldFont, input);

  drawSectionTitle(page, boldFont, y, 'Análise executiva');
  y -= 18;
  y = drawExecutiveBlock(page, regularFont, boldFont, y, input);

  if (input.purchaseNotes) {
    drawSectionTitle(page, boldFont, y, 'Observações da compra');
    y -= 18;
    for (const line of wrapText(input.purchaseNotes, regularFont, 9, PAGE_WIDTH - PAGE_MARGIN * 2)) {
      page.drawText(line, {
        x: PAGE_MARGIN,
        y,
        size: 9,
        font: regularFont,
        color: C.text,
      });
      y -= 11;
    }
    y -= 8;
  }

  drawSectionTitle(page, boldFont, y, 'Resumo por orçamento');
  y -= 18;
  y = drawSlotSummaryTable(page, regularFont, boldFont, y, input) - 18;

  drawSectionTitle(page, boldFont, y, 'Mapa detalhado por item');
  y -= 18;
  y = drawItemTableHeader(page, boldFont, y) - 2;

  let globalRowIndex = 0;
  for (const row of input.rows) {
    const previewDescriptionLines = wrapText(row.description, regularFont, 8, ITEM_TABLE_COLUMNS.description - 8);
    const previewWinnerLines = wrapText(row.winnerLabel, boldFont, 8, ITEM_TABLE_COLUMNS.winner - 8);
    const previewHeight = 10 + Math.max(previewDescriptionLines.length, previewWinnerLines.length, 1) * 9;

    if (y - previewHeight < PAGE_MARGIN + 28) {
      ({ page, y } = addPage(document, regularFont, boldFont, input));
      drawSectionTitle(page, boldFont, y, 'Mapa detalhado por item (continuacao)');
      y -= 18;
      y = drawItemTableHeader(page, boldFont, y) - 2;
    }

    y = drawItemRow(page, regularFont, boldFont, y, row, globalRowIndex) - 2;
    globalRowIndex += 1;
  }

  return document.save();
}
