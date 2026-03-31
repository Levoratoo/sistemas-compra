import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN = 32;
const TABLE_COLUMNS = {
  description: 250,
  quantity: 56,
  unitPrice: 92,
  totalPrice: 102,
};
const LEGAL_NOTES = [
  'ATENCAO:',
  '- Sob pena de devolucao da nota fiscal, esta devera vir com os dados bancarios para pagamento no corpo da nota.',
  '- Em se tratando de pessoa juridica: a conta corrente devera pertencer ao mesmo CNPJ do favorecido.',
  '- Em se tratando de pessoa fisica: a conta corrente devera pertencer ao mesmo CPF do favorecido.',
  '- Os pagamentos nao serao efetuados, em hipotese alguma, em conta poupanca.',
  '- Mencionar na nota fiscal: numero do GLPI e da Ordem de Compra.',
  '- A copia da ordem de compra devera vir anexa a NF.',
];

export type PurchaseOrderPdfItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string | null;
};

export type PurchaseOrderPdfInput = {
  issuerName: string;
  issuerCity: string | null;
  issuerState: string | null;
  projectCode: string;
  projectName: string;
  supplierName: string;
  supplierDocumentNumber: string | null;
  supplierAddress: string | null;
  supplierContactName: string | null;
  supplierPhone: string | null;
  glpiNumber: string;
  internalReference: string | null;
  issuedAtLabel: string;
  expectedDeliveryDateLabel: string | null;
  deliveryAddress: string | null;
  freightType: string | null;
  paymentTerms: string | null;
  responsibleName: string | null;
  responsiblePhone: string | null;
  notes: string | null;
  items: PurchaseOrderPdfItem[];
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR').format(value);
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
    const candidateWidth = font.widthOfTextAtSize(candidate, fontSize);

    if (candidateWidth <= maxWidth || !current) {
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

function drawLabelValue(
  page: PDFPage,
  labelFont: PDFFont,
  valueFont: PDFFont,
  x: number,
  y: number,
  label: string,
  value: string,
) {
  page.drawText(label, {
    x,
    y,
    size: 8,
    font: labelFont,
    color: rgb(0.2, 0.2, 0.2),
  });
  page.drawText(value || '-', {
    x,
    y: y - 11,
    size: 9,
    font: valueFont,
    color: rgb(0, 0, 0),
  });
}

function drawTableHeader(page: PDFPage, boldFont: PDFFont, startY: number) {
  const left = PAGE_MARGIN;
  const headerHeight = 18;
  const totalWidth =
    TABLE_COLUMNS.description +
    TABLE_COLUMNS.quantity +
    TABLE_COLUMNS.unitPrice +
    TABLE_COLUMNS.totalPrice;

  page.drawRectangle({
    x: left,
    y: startY - headerHeight,
    width: totalWidth,
    height: headerHeight,
    borderColor: rgb(0.3, 0.3, 0.3),
    borderWidth: 0.8,
    color: rgb(0.96, 0.96, 0.96),
  });

  page.drawText('Descricao', {
    x: left + 6,
    y: startY - 12,
    size: 8,
    font: boldFont,
  });
  page.drawText('Qtde.', {
    x: left + TABLE_COLUMNS.description + 8,
    y: startY - 12,
    size: 8,
    font: boldFont,
  });
  page.drawText('Preco Un.', {
    x: left + TABLE_COLUMNS.description + TABLE_COLUMNS.quantity + 8,
    y: startY - 12,
    size: 8,
    font: boldFont,
  });
  page.drawText('Preco Total', {
    x: left + TABLE_COLUMNS.description + TABLE_COLUMNS.quantity + TABLE_COLUMNS.unitPrice + 8,
    y: startY - 12,
    size: 8,
    font: boldFont,
  });

  const boundaries = [
    left + TABLE_COLUMNS.description,
    left + TABLE_COLUMNS.description + TABLE_COLUMNS.quantity,
    left + TABLE_COLUMNS.description + TABLE_COLUMNS.quantity + TABLE_COLUMNS.unitPrice,
  ];
  for (const boundary of boundaries) {
    page.drawLine({
      start: { x: boundary, y: startY },
      end: { x: boundary, y: startY - headerHeight },
      thickness: 0.8,
      color: rgb(0.3, 0.3, 0.3),
    });
  }

  return startY - headerHeight;
}

function drawPageHeader(
  page: PDFPage,
  regularFont: PDFFont,
  boldFont: PDFFont,
  input: PurchaseOrderPdfInput,
) {
  page.drawRectangle({
    x: PAGE_MARGIN,
    y: PAGE_HEIGHT - 88,
    width: PAGE_WIDTH - PAGE_MARGIN * 2,
    height: 56,
    borderColor: rgb(0.2, 0.2, 0.2),
    borderWidth: 1,
  });

  page.drawText(input.issuerName, {
    x: PAGE_MARGIN + 14,
    y: PAGE_HEIGHT - 56,
    size: 12,
    font: boldFont,
    color: rgb(0.05, 0.35, 0.18),
  });
  page.drawText(`Projeto: ${input.projectCode} - ${input.projectName}`, {
    x: PAGE_MARGIN + 14,
    y: PAGE_HEIGHT - 72,
    size: 8,
    font: regularFont,
  });

  page.drawText(`Ordem de Compra Avulsa`, {
    x: PAGE_MARGIN + 205,
    y: PAGE_HEIGHT - 56,
    size: 12,
    font: boldFont,
  });
  page.drawText(`GLPI/NF: ${input.glpiNumber}`, {
    x: PAGE_MARGIN + 235,
    y: PAGE_HEIGHT - 72,
    size: 9,
    font: boldFont,
  });

  page.drawText(`Emissao: ${input.issuedAtLabel}`, {
    x: PAGE_WIDTH - PAGE_MARGIN - 120,
    y: PAGE_HEIGHT - 52,
    size: 8,
    font: regularFont,
  });
  page.drawText(`Prev. entrega: ${input.expectedDeliveryDateLabel ?? '-'}`, {
    x: PAGE_WIDTH - PAGE_MARGIN - 120,
    y: PAGE_HEIGHT - 66,
    size: 8,
    font: regularFont,
  });

  page.drawLine({
    start: { x: PAGE_MARGIN + 180, y: PAGE_HEIGHT - 88 },
    end: { x: PAGE_MARGIN + 180, y: PAGE_HEIGHT - 32 },
    thickness: 0.8,
    color: rgb(0.2, 0.2, 0.2),
  });
  page.drawLine({
    start: { x: PAGE_WIDTH - PAGE_MARGIN - 130, y: PAGE_HEIGHT - 88 },
    end: { x: PAGE_WIDTH - PAGE_MARGIN - 130, y: PAGE_HEIGHT - 32 },
    thickness: 0.8,
    color: rgb(0.2, 0.2, 0.2),
  });
}

async function createBasePdf(input: PurchaseOrderPdfInput) {
  const pdfDoc = await PDFDocument.create();
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const addPage = () => {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawPageHeader(page, regularFont, boldFont, input);
    return page;
  };

  return {
    pdfDoc,
    regularFont,
    boldFont,
    addPage,
  };
}

export function buildPurchaseOrderSearchText(input: PurchaseOrderPdfInput) {
  const itemLines = input.items.map((item) =>
    [
      item.description,
      `Quantidade: ${formatNumber(item.quantity)}`,
      `Valor unitario: ${formatCurrency(item.unitPrice)}`,
      `Valor total: ${formatCurrency(item.totalPrice)}`,
      item.notes ? `Observacao do item: ${item.notes}` : null,
    ]
      .filter(Boolean)
      .join(' | '),
  );

  return [
    'Ordem de Compra',
    `Projeto: ${input.projectCode} - ${input.projectName}`,
    `Orgao: ${input.issuerName}`,
    `Fornecedor: ${input.supplierName}`,
    input.supplierDocumentNumber ? `Documento do fornecedor: ${input.supplierDocumentNumber}` : null,
    input.supplierAddress ? `Endereco do fornecedor: ${input.supplierAddress}` : null,
    `GLPI: ${input.glpiNumber}`,
    input.internalReference ? `Referencia interna: ${input.internalReference}` : null,
    input.deliveryAddress ? `Entrega: ${input.deliveryAddress}` : null,
    input.freightType ? `Frete: ${input.freightType}` : null,
    input.paymentTerms ? `Pagamento: ${input.paymentTerms}` : null,
    input.responsibleName ? `Responsavel: ${input.responsibleName}` : null,
    input.responsiblePhone ? `Telefone: ${input.responsiblePhone}` : null,
    input.expectedDeliveryDateLabel ? `Previsao de entrega: ${input.expectedDeliveryDateLabel}` : null,
    input.notes ? `Observacoes: ${input.notes}` : null,
    ...itemLines,
    ...LEGAL_NOTES,
  ]
    .filter(Boolean)
    .join('\n');
}

export async function buildPurchaseOrderPdf(input: PurchaseOrderPdfInput) {
  const { pdfDoc, regularFont, boldFont, addPage } = await createBasePdf(input);
  let page = addPage();
  let cursorY = PAGE_HEIGHT - 118;

  page.drawText('Fornecedor', {
    x: PAGE_MARGIN,
    y: cursorY,
    size: 10,
    font: boldFont,
  });
  cursorY -= 16;

  drawLabelValue(page, boldFont, regularFont, PAGE_MARGIN, cursorY, 'Nome', input.supplierName);
  drawLabelValue(
    page,
    boldFont,
    regularFont,
    PAGE_MARGIN + 260,
    cursorY,
    'Documento',
    input.supplierDocumentNumber ?? '-',
  );
  cursorY -= 28;

  drawLabelValue(page, boldFont, regularFont, PAGE_MARGIN, cursorY, 'Endereco', input.supplierAddress ?? '-');
  cursorY -= 28;

  drawLabelValue(page, boldFont, regularFont, PAGE_MARGIN, cursorY, 'Contato', input.supplierContactName ?? '-');
  drawLabelValue(page, boldFont, regularFont, PAGE_MARGIN + 260, cursorY, 'Telefone', input.supplierPhone ?? '-');
  cursorY -= 36;

  page.drawLine({
    start: { x: PAGE_MARGIN, y: cursorY + 10 },
    end: { x: PAGE_WIDTH - PAGE_MARGIN, y: cursorY + 10 },
    thickness: 0.8,
    color: rgb(0.3, 0.3, 0.3),
  });

  drawLabelValue(page, boldFont, regularFont, PAGE_MARGIN, cursorY, 'Entrega', input.deliveryAddress ?? '-');
  drawLabelValue(page, boldFont, regularFont, PAGE_MARGIN + 260, cursorY, 'Frete', input.freightType ?? '-');
  cursorY -= 28;

  drawLabelValue(page, boldFont, regularFont, PAGE_MARGIN, cursorY, 'Pagamento', input.paymentTerms ?? '-');
  drawLabelValue(page, boldFont, regularFont, PAGE_MARGIN + 260, cursorY, 'Responsavel', input.responsibleName ?? '-');
  cursorY -= 28;

  drawLabelValue(
    page,
    boldFont,
    regularFont,
    PAGE_MARGIN,
    cursorY,
    'Telefone responsavel',
    input.responsiblePhone ?? '-',
  );
  drawLabelValue(
    page,
    boldFont,
    regularFont,
    PAGE_MARGIN + 260,
    cursorY,
    'Referencia interna',
    input.internalReference ?? '-',
  );
  cursorY -= 40;

  cursorY = drawTableHeader(page, boldFont, cursorY);

  const totalValue = input.items.reduce((sum, item) => sum + item.totalPrice, 0);

  for (const item of input.items) {
    const descriptionLines = wrapText(item.description, regularFont, 8.5, TABLE_COLUMNS.description - 12);
    const noteLines =
      item.notes && item.notes.trim()
        ? wrapText(`Obs.: ${item.notes.trim()}`, regularFont, 7.2, TABLE_COLUMNS.description - 12)
        : [];
    const lineHeight = 10;
    const rowHeight = Math.max(18, (descriptionLines.length + noteLines.length) * lineHeight + 8);

    if (cursorY - rowHeight < 230) {
      page = addPage();
      cursorY = PAGE_HEIGHT - 118;
      cursorY = drawTableHeader(page, boldFont, cursorY);
    }

    const rowTop = cursorY;
    const rowBottom = cursorY - rowHeight;
    const totalWidth =
      TABLE_COLUMNS.description +
      TABLE_COLUMNS.quantity +
      TABLE_COLUMNS.unitPrice +
      TABLE_COLUMNS.totalPrice;

    page.drawRectangle({
      x: PAGE_MARGIN,
      y: rowBottom,
      width: totalWidth,
      height: rowHeight,
      borderColor: rgb(0.7, 0.7, 0.7),
      borderWidth: 0.5,
    });

    const boundaries = [
      PAGE_MARGIN + TABLE_COLUMNS.description,
      PAGE_MARGIN + TABLE_COLUMNS.description + TABLE_COLUMNS.quantity,
      PAGE_MARGIN + TABLE_COLUMNS.description + TABLE_COLUMNS.quantity + TABLE_COLUMNS.unitPrice,
    ];
    for (const boundary of boundaries) {
      page.drawLine({
        start: { x: boundary, y: rowTop },
        end: { x: boundary, y: rowBottom },
        thickness: 0.5,
        color: rgb(0.7, 0.7, 0.7),
      });
    }

    let textY = rowTop - 12;
    for (const line of descriptionLines) {
      page.drawText(line, {
        x: PAGE_MARGIN + 6,
        y: textY,
        size: 8.5,
        font: regularFont,
      });
      textY -= lineHeight;
    }
    for (const line of noteLines) {
      page.drawText(line, {
        x: PAGE_MARGIN + 6,
        y: textY,
        size: 7.2,
        font: regularFont,
        color: rgb(0.35, 0.35, 0.35),
      });
      textY -= lineHeight;
    }

    page.drawText(formatNumber(item.quantity), {
      x: PAGE_MARGIN + TABLE_COLUMNS.description + 6,
      y: rowTop - 12,
      size: 8.5,
      font: regularFont,
    });
    page.drawText(formatCurrency(item.unitPrice), {
      x: PAGE_MARGIN + TABLE_COLUMNS.description + TABLE_COLUMNS.quantity + 6,
      y: rowTop - 12,
      size: 8.5,
      font: regularFont,
    });
    page.drawText(formatCurrency(item.totalPrice), {
      x: PAGE_MARGIN + TABLE_COLUMNS.description + TABLE_COLUMNS.quantity + TABLE_COLUMNS.unitPrice + 6,
      y: rowTop - 12,
      size: 8.5,
      font: regularFont,
    });

    cursorY = rowBottom;
  }

  if (cursorY < 260) {
    page = addPage();
    cursorY = PAGE_HEIGHT - 118;
  }

  cursorY -= 18;

  page.drawRectangle({
    x: PAGE_MARGIN,
    y: cursorY - 86,
    width: 360,
    height: 86,
    borderColor: rgb(0.3, 0.3, 0.3),
    borderWidth: 0.8,
  });
  page.drawText('Observacoes', {
    x: PAGE_MARGIN + 8,
    y: cursorY - 14,
    size: 9,
    font: boldFont,
  });
  const noteLines = wrapText(input.notes ?? 'Sem observacoes adicionais.', regularFont, 8.4, 344);
  let noteY = cursorY - 30;
  for (const line of noteLines.slice(0, 5)) {
    page.drawText(line, {
      x: PAGE_MARGIN + 8,
      y: noteY,
      size: 8.4,
      font: regularFont,
    });
    noteY -= 11;
  }

  page.drawRectangle({
    x: PAGE_MARGIN + 360,
    y: cursorY - 86,
    width: 171,
    height: 86,
    borderColor: rgb(0.3, 0.3, 0.3),
    borderWidth: 0.8,
  });
  page.drawText('Resumo', {
    x: PAGE_MARGIN + 370,
    y: cursorY - 14,
    size: 9,
    font: boldFont,
  });
  page.drawText(`Itens: ${formatNumber(input.items.length)}`, {
    x: PAGE_MARGIN + 370,
    y: cursorY - 32,
    size: 8.5,
    font: regularFont,
  });
  page.drawText(`Valor total: ${formatCurrency(totalValue)}`, {
    x: PAGE_MARGIN + 370,
    y: cursorY - 48,
    size: 8.5,
    font: boldFont,
  });
  page.drawText(`Entrega: ${input.expectedDeliveryDateLabel ?? '-'}`, {
    x: PAGE_MARGIN + 370,
    y: cursorY - 64,
    size: 8.2,
    font: regularFont,
  });

  cursorY -= 116;
  page.drawText('Condicoes e observacoes legais', {
    x: PAGE_MARGIN,
    y: cursorY,
    size: 9,
    font: boldFont,
  });
  cursorY -= 16;
  for (const line of LEGAL_NOTES) {
    page.drawText(line, {
      x: PAGE_MARGIN,
      y: cursorY,
      size: 7.6,
      font: regularFont,
    });
    cursorY -= 11;
  }

  page.drawText(`Usuario de criacao: sistema`, {
    x: PAGE_MARGIN,
    y: 36,
    size: 8,
    font: regularFont,
  });

  return pdfDoc.save();
}
