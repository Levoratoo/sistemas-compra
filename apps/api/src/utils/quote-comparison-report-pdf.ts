import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN = 32;
const HEADER_BOTTOM_Y = PAGE_HEIGHT - 108;
const ITEM_TABLE_COLUMNS = {
  description: 176,
  quantity: 38,
  slot1: 64,
  slot2: 64,
  slot3: 64,
  winner: 93,
};

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

function drawLabelValue(page: PDFPage, labelFont: PDFFont, valueFont: PDFFont, x: number, y: number, label: string, value: string) {
  page.drawText(label, {
    x,
    y,
    size: 8,
    font: labelFont,
    color: rgb(0.35, 0.35, 0.35),
  });
  page.drawText(value || '-', {
    x,
    y: y - 12,
    size: 10,
    font: valueFont,
    color: rgb(0.08, 0.08, 0.08),
  });
}

function drawSectionTitle(page: PDFPage, font: PDFFont, y: number, title: string) {
  page.drawText(title, {
    x: PAGE_MARGIN,
    y,
    size: 12,
    font,
    color: rgb(0.09, 0.32, 0.52),
  });
}

function drawPageHeader(page: PDFPage, regularFont: PDFFont, boldFont: PDFFont, input: QuoteComparisonReportPdfInput) {
  page.drawRectangle({
    x: PAGE_MARGIN,
    y: PAGE_HEIGHT - 84,
    width: PAGE_WIDTH - PAGE_MARGIN * 2,
    height: 52,
    borderColor: rgb(0.2, 0.2, 0.2),
    borderWidth: 1,
    color: rgb(0.97, 0.98, 0.99),
  });

  page.drawText('Relatorio do mapa comparativo de orcamentos', {
    x: PAGE_MARGIN + 12,
    y: PAGE_HEIGHT - 55,
    size: 15,
    font: boldFont,
    color: rgb(0.08, 0.08, 0.08),
  });

  page.drawText(`${input.projectCode} | ${input.projectName}`, {
    x: PAGE_MARGIN + 12,
    y: PAGE_HEIGHT - 72,
    size: 9,
    font: regularFont,
    color: rgb(0.25, 0.25, 0.25),
  });

  drawLabelValue(page, boldFont, regularFont, PAGE_MARGIN, HEADER_BOTTOM_Y, 'Compra', input.purchaseTitle);
  drawLabelValue(page, boldFont, regularFont, PAGE_MARGIN + 200, HEADER_BOTTOM_Y, 'Emitido em', input.issuedAtLabel);
  drawLabelValue(
    page,
    boldFont,
    regularFont,
    PAGE_MARGIN + 330,
    HEADER_BOTTOM_Y,
    'Orgao / base',
    [input.issuerName, [input.issuerCity, input.issuerState].filter(Boolean).join('/')].filter(Boolean).join(' - '),
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
  const headers = ['Slot', 'Fornecedor', 'Status', 'Total', 'Vitorias', 'Empates'];
  const headerHeight = 18;
  const totalWidth = colWidths.reduce((sum, width) => sum + width, 0);

  page.drawRectangle({
    x: left,
    y: startY - headerHeight,
    width: totalWidth,
    height: headerHeight,
    borderColor: rgb(0.3, 0.3, 0.3),
    borderWidth: 0.8,
    color: rgb(0.95, 0.96, 0.98),
  });

  let currentX = left;
  headers.forEach((header, index) => {
    page.drawText(header, {
      x: currentX + 5,
      y: startY - 12,
      size: 8,
      font: boldFont,
      color: rgb(0.18, 0.18, 0.18),
    });
    currentX += colWidths[index] ?? 0;
  });

  currentX = left;
  for (let index = 0; index < colWidths.length - 1; index += 1) {
    currentX += colWidths[index] ?? 0;
    page.drawLine({
      start: { x: currentX, y: startY },
      end: { x: currentX, y: startY - headerHeight },
      thickness: 0.8,
      color: rgb(0.3, 0.3, 0.3),
    });
  }

  let y = startY - headerHeight;

  for (const slot of input.analysis.itemWinnerCounts) {
    const status = slot.isComplete ? 'Completo' : 'Em aberto';
    const values = [
      `Orc. ${slot.slotNumber}`,
      slot.supplierName || 'Fornecedor nao definido',
      status,
      formatCurrency(slot.totalValue),
      String(slot.uniqueWinCount),
      String(slot.tieCount),
    ];
    const rowHeight = 24;

    page.drawRectangle({
      x: left,
      y: y - rowHeight,
      width: totalWidth,
      height: rowHeight,
      borderColor: rgb(0.82, 0.84, 0.88),
      borderWidth: 0.6,
    });

    let cellX = left;
    values.forEach((value, index) => {
      const lines = wrapText(value, regularFont, 8, (colWidths[index] ?? 0) - 8);
      lines.slice(0, 2).forEach((line, lineIndex) => {
        page.drawText(line, {
          x: cellX + 5,
          y: y - 14 - lineIndex * 9,
          size: 8,
          font: regularFont,
          color: rgb(0.08, 0.08, 0.08),
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
  const headerHeight = 18;
  const headers = ['Descricao', 'Qtd.', 'Orc. 1', 'Orc. 2', 'Orc. 3', 'Vencedor'];
  const widths = Object.values(ITEM_TABLE_COLUMNS);

  page.drawRectangle({
    x: PAGE_MARGIN,
    y: y - headerHeight,
    width: totalWidth,
    height: headerHeight,
    borderColor: rgb(0.3, 0.3, 0.3),
    borderWidth: 0.8,
    color: rgb(0.95, 0.96, 0.98),
  });

  headers.forEach((header, index) => {
    page.drawText(header, {
      x: currentX + 5,
      y: y - 12,
      size: 8,
      font: boldFont,
      color: rgb(0.18, 0.18, 0.18),
    });
    currentX += widths[index] ?? 0;
  });

  currentX = PAGE_MARGIN;
  for (let index = 0; index < widths.length - 1; index += 1) {
    currentX += widths[index] ?? 0;
    page.drawLine({
      start: { x: currentX, y },
      end: { x: currentX, y: y - headerHeight },
      thickness: 0.8,
      color: rgb(0.3, 0.3, 0.3),
    });
  }

  return y - headerHeight;
}

function drawItemRow(
  page: PDFPage,
  regularFont: PDFFont,
  y: number,
  row: QuoteComparisonReportPdfInput['rows'][number],
) {
  const descriptionLines = wrapText(row.description, regularFont, 8, ITEM_TABLE_COLUMNS.description - 8);
  const winnerLines = wrapText(row.winnerLabel, regularFont, 8, ITEM_TABLE_COLUMNS.winner - 8);
  const lineCount = Math.max(descriptionLines.length, winnerLines.length, 1);
  const rowHeight = 8 + lineCount * 9;
  const totalWidth = Object.values(ITEM_TABLE_COLUMNS).reduce((sum, width) => sum + width, 0);
  const slotMap = new Map(row.slotTotals.map((slot) => [slot.slotNumber, slot.totalValue]));

  page.drawRectangle({
    x: PAGE_MARGIN,
    y: y - rowHeight,
    width: totalWidth,
    height: rowHeight,
    borderColor: rgb(0.85, 0.87, 0.9),
    borderWidth: 0.6,
  });

  const cells = [
    descriptionLines,
    [formatNumber(row.quantity)],
    [formatCurrency(slotMap.get(1) ?? null)],
    [formatCurrency(slotMap.get(2) ?? null)],
    [formatCurrency(slotMap.get(3) ?? null)],
    winnerLines,
  ];
  const widths = Object.values(ITEM_TABLE_COLUMNS);

  let currentX = PAGE_MARGIN;
  cells.forEach((lines, index) => {
    lines.forEach((line, lineIndex) => {
      page.drawText(line, {
        x: currentX + 5,
        y: y - 12 - lineIndex * 9,
        size: 8,
        font: regularFont,
        color: rgb(0.08, 0.08, 0.08),
      });
    });
    currentX += widths[index] ?? 0;
  });

  currentX = PAGE_MARGIN;
  for (let index = 0; index < widths.length - 1; index += 1) {
    currentX += widths[index] ?? 0;
    page.drawLine({
      start: { x: currentX, y },
      end: { x: currentX, y: y - rowHeight },
      thickness: 0.6,
      color: rgb(0.85, 0.87, 0.9),
    });
  }

  return y - rowHeight;
}

function addPage(document: PDFDocument, regularFont: PDFFont, boldFont: PDFFont, input: QuoteComparisonReportPdfInput) {
  const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  drawPageHeader(page, regularFont, boldFont, input);
  return {
    page,
    y: HEADER_BOTTOM_Y - 34,
  };
}

export function buildQuoteComparisonReportSearchText(input: QuoteComparisonReportPdfInput) {
  return [
    'Relatorio do mapa comparativo de orcamentos',
    `Projeto: ${input.projectCode} - ${input.projectName}`,
    `Compra: ${input.purchaseTitle}`,
    `Emitido em: ${input.issuedAtLabel}`,
    `Analise: ${input.analysis.headline}`,
    ...input.analysis.summaryLines,
    ...input.slotTotals.map(
      (slot) =>
        `Orcamento ${slot.slotNumber}: ${slot.supplierName || 'Fornecedor nao definido'} | Total ${formatCurrency(slot.totalValue)} | ${slot.filledItemCount}/${slot.itemCount} itens`,
    ),
    ...input.rows.map(
      (row) =>
        `${row.description} | Qtd ${formatNumber(row.quantity)} | O1 ${formatCurrency(row.slotTotals.find((slot) => slot.slotNumber === 1)?.totalValue)} | O2 ${formatCurrency(row.slotTotals.find((slot) => slot.slotNumber === 2)?.totalValue)} | O3 ${formatCurrency(row.slotTotals.find((slot) => slot.slotNumber === 3)?.totalValue)} | ${row.winnerLabel}`,
    ),
  ].join('\n');
}

export async function buildQuoteComparisonReportPdf(input: QuoteComparisonReportPdfInput) {
  const document = await PDFDocument.create();
  const regularFont = await document.embedFont(StandardFonts.Helvetica);
  const boldFont = await document.embedFont(StandardFonts.HelveticaBold);

  let { page, y } = addPage(document, regularFont, boldFont, input);

  drawSectionTitle(page, boldFont, y, 'Analise executiva');
  y -= 18;

  const headlineLines = wrapText(input.analysis.headline, boldFont, 11, PAGE_WIDTH - PAGE_MARGIN * 2);
  for (const line of headlineLines) {
    page.drawText(line, {
      x: PAGE_MARGIN,
      y,
      size: 11,
      font: boldFont,
      color: rgb(0.08, 0.08, 0.08),
    });
    y -= 13;
  }

  y -= 4;
  for (const summaryLine of input.analysis.summaryLines) {
    const lines = wrapText(`- ${summaryLine}`, regularFont, 9, PAGE_WIDTH - PAGE_MARGIN * 2);
    for (const line of lines) {
      page.drawText(line, {
        x: PAGE_MARGIN,
        y,
        size: 9,
        font: regularFont,
        color: rgb(0.18, 0.18, 0.18),
      });
      y -= 11;
    }
  }

  if (input.purchaseNotes) {
    y -= 6;
    drawSectionTitle(page, boldFont, y, 'Observacoes da compra');
    y -= 18;
    for (const line of wrapText(input.purchaseNotes, regularFont, 9, PAGE_WIDTH - PAGE_MARGIN * 2)) {
      page.drawText(line, {
        x: PAGE_MARGIN,
        y,
        size: 9,
        font: regularFont,
        color: rgb(0.18, 0.18, 0.18),
      });
      y -= 11;
    }
  }

  y -= 10;
  drawSectionTitle(page, boldFont, y, 'Resumo por orcamento');
  y -= 16;
  y = drawSlotSummaryTable(page, regularFont, boldFont, y, input) - 18;

  drawSectionTitle(page, boldFont, y, 'Mapa detalhado por item');
  y -= 16;
  y = drawItemTableHeader(page, boldFont, y) - 2;

  for (const row of input.rows) {
    const previewDescriptionLines = wrapText(row.description, regularFont, 8, ITEM_TABLE_COLUMNS.description - 8);
    const previewWinnerLines = wrapText(row.winnerLabel, regularFont, 8, ITEM_TABLE_COLUMNS.winner - 8);
    const previewHeight = 8 + Math.max(previewDescriptionLines.length, previewWinnerLines.length, 1) * 9;

    if (y - previewHeight < PAGE_MARGIN + 24) {
      ({ page, y } = addPage(document, regularFont, boldFont, input));
      drawSectionTitle(page, boldFont, y, 'Mapa detalhado por item');
      y -= 16;
      y = drawItemTableHeader(page, boldFont, y) - 2;
    }

    y = drawItemRow(page, regularFont, y, row) - 2;
  }

  return document.save();
}
