import { randomBytes } from 'node:crypto';

import {
  DocumentType,
  ExtractedFieldReviewStatus,
  ExtractedTargetType,
} from '@prisma/client';
import type { Express } from 'express';
import { PDFParse } from 'pdf-parse';
import * as XLSX from 'xlsx';

import { documentService, type CreateProjectDocumentServiceInput } from './document.service.js';
import { validateFolderForProject } from './document-folder.service.js';
import { logger } from '../config/logger.js';
import { projectRepository } from '../repositories/project.repository.js';
import { projectService } from './project.service.js';
import {
  deriveHintsFromSpreadsheetRows,
  guessBidNumberFromText,
  guessProcessNumberFromText,
  MAX_PROJECT_NAME_CHARS,
  mergeHintsFromPlainText,
  mergeProjectHints,
  type ProjectHints,
} from '../utils/document-extraction-hints.js';
import { parseEditalMateriaisDisponibilizados } from '../utils/edital-materiais-section.js';
import type { BudgetLineCandidate } from '../utils/implementation-map-pdf.js';
import {
  extractImplementationMapPdfText,
  parseImplementationMapContent,
} from '../utils/implementation-map-pdf.js';
import { AppError } from '../utils/app-error.js';
import { normalizeImportedFileName, repairUtf8MisinterpretedAsLatin1 } from '../utils/encoding.js';
import type { CreateProjectInput } from '../modules/project/project.schemas.js';

const MAX_TEXT = 48_000;
/** Editais longos: a seção 7 pode estar além da página 40 — precisamos de mais texto que o limite genérico. */
const MAX_PDF_TEXT_EDITAL = Math.min(
  Math.max(120_000, Number(process.env.EDITAL_PDF_MAX_CHARS ?? 420_000)),
  500_000,
);
const MAX_PDF_OCR_SOURCE_TEXT_CHARS = Math.min(
  Math.max(60_000, Number(process.env.EDITAL_PDF_OCR_MAX_SOURCE_CHARS ?? 120_000)),
  250_000,
);
const MAX_PDF_OCR_EDITAL_PAGES = Math.min(
  Math.max(24, Number(process.env.EDITAL_PDF_OCR_MAX_PAGES ?? 60)),
  80,
);
/**
 * Timeout do OCR para editais. No Render free tier (0.1 CPU compartilhado) cada página
 * pode demorar 2-4 s; 18 s garante que a requisição total termine bem antes do timeout
 * de 100 s do servidor, evitando conexão fechada sem resposta (que o browser reporta
 * como erro de CORS / "Failed to fetch").
 */
const MAX_PDF_OCR_EDITAL_DURATION_MS = Math.min(
  Math.max(10_000, Number(process.env.EDITAL_PDF_OCR_MAX_DURATION_MS ?? 18_000)),
  120_000,
);
const MAX_SHEET_ROWS = 12_000;

function hasLateAnnexOrTableHints(text: string) {
  return /ANEXO\s+I[\s-]*[BC]|DETALHAMENTO\s+DOS\s+UNIFORMES|DETALHAMENTO\s+DO\s+EQUIPAMENTOS?\s+DE\s+PROTE\w+|TIPO\s*\/\s*QTD|ITEM\s+QTDE?\.?|POSTO\s+DE\s+TRABALHO\s+EPI/i.test(
    text,
  );
}

type EditalOcrDecisionInput = {
  anchorFound: boolean;
  budgetLineCount: number;
};

export function shouldRunPdfOcrForEdital(text: string, parsed: EditalOcrDecisionInput) {
  if (process.env.PDF_OCR_ENABLED === 'false') return false;
  if (process.env.PDF_OCR_FORCE === 'true') return true;
  if (parsed.budgetLineCount >= 8) return false;
  if (parsed.anchorFound && parsed.budgetLineCount >= 3) return false;
  if (text.length >= MAX_PDF_OCR_SOURCE_TEXT_CHARS) return false;
  if (text.length < 1200) return true;
  if (/ANEXO\s+I[\s-]*[BC]|DETALHAMENTO\s+DOS\s+UNIFORMES|DETALHAMENTO\s+DO\s+EQUIPAMENTOS?\s+DE\s+PROTE[CÇ][AÃ]O|TIPO\s*\/\s*QTD|ITEM\s+QTDE?\.?|POSTO\s+DE\s+TRABALHO\s+EPI/i.test(text)) {
    return true;
  }
  return !parsed.anchorFound;
}

function detectComplementaryAnnexReferences(text: string) {
  const hints: string[] = [];

  if (/ANEXO\s+I[\s-]*B|DETALHAMENTO\s+DOS\s+UNIFORMES/i.test(text)) {
    hints.push('Anexo I-B — detalhamento dos uniformes');
  }

  if (/ANEXO\s+I[\s-]*C|DETALHAMENTO\s+DO\s+EQUIPAMENTOS?\s+DE\s+PROTE[CÇ][AÃ]O/i.test(text)) {
    hints.push('Anexo I-C — detalhamento dos EPI');
  }

  if (/ANEXO\s+I[\s-]*I|EQUIPAMENTOS\s+A\s+SEREM\s+FORNECIDOS\s+PELA\s+CONTRATADA/i.test(text)) {
    hints.push('Anexo I-I — equipamentos a serem fornecidos');
  }

  if (/MODELO\s+PARA\s+APRESENTA[CÇ][AÃ]O\s+DA\s+PROPOSTA\s+DE\s+PRE[CÇ]O|PLANILHAS?/i.test(text)) {
    hints.push('Planilhas anexas da proposta');
  }

  return hints;
}

function buildEditalPreviewJson(
  text: string,
  editalMateriais: ReturnType<typeof parseEditalMateriaisDisponibilizados>,
  ocrUsed: boolean,
) {
  const annexReferenceHints = detectComplementaryAnnexReferences(text);
  return {
    editalMateriais: {
      anchorFound: editalMateriais.anchorFound,
      subsectionFound: editalMateriais.subsectionFound,
      rowCount: editalMateriais.budgetLines.length,
      secao8UniformesCount: editalMateriais.secao8UniformesCount ?? 0,
      matchedProfile: editalMateriais.matchedProfile,
      ocrUsed,
      requiresComplementaryAnnexUpload:
        editalMateriais.budgetLines.length === 0 && annexReferenceHints.length > 0,
      annexReferenceHints,
    },
  };
}

function stripExtension(name: string) {
  return name.replace(/\.[^/.]+$/, '').trim() || 'Novo projeto';
}

async function extractPlainText(
  file: Express.Multer.File,
  documentType: DocumentType,
): Promise<{
  text: string;
  previewJson?: Record<string, unknown>;
  gridRows?: string[][];
  implementationMap?: ReturnType<typeof parseImplementationMapContent> & {
    extractionMode: 'full_document';
  };
  editalMateriais?: ReturnType<typeof parseEditalMateriaisDisponibilizados>;
}> {
  const mime = file.mimetype || '';
  const name = normalizeImportedFileName(file.originalname).toLowerCase();

  try {
    if (mime === 'application/pdf' || name.endsWith('.pdf')) {
      if (documentType === DocumentType.IMPLEMENTATION_MAP) {
        const { text, extractionMode, ocrUsed } = await extractImplementationMapPdfText(file.buffer);
        const mapParse = parseImplementationMapContent(text);
        return {
          text,
          previewJson: {
            implementationMap: {
              extractionMode,
              ocrUsed: ocrUsed ?? false,
              contentAnchorIndex: mapParse.contentAnchorIndex,
              sectionsFound: mapParse.sectionsFound,
              budgetLineCount: mapParse.budgetLines.length,
              cnpj: mapParse.cnpj ?? null,
            },
          },
          implementationMap: {
            ...mapParse,
            extractionMode,
          },
        };
      }

      const maxPdfChars =
        documentType === DocumentType.NOTICE || documentType === DocumentType.TERMS_OF_REFERENCE
          ? MAX_PDF_TEXT_EDITAL
          : MAX_TEXT;

      const parser = new PDFParse({ data: file.buffer });
      try {
        const result = await parser.getText();
        const raw = repairUtf8MisinterpretedAsLatin1((result.text ?? '').trim());
        let text = raw.slice(0, maxPdfChars);

        if (documentType === DocumentType.NOTICE || documentType === DocumentType.TERMS_OF_REFERENCE) {
          let editalMateriais = parseEditalMateriaisDisponibilizados(text);
          let ocrUsed = false;
          const shouldRunOcr = shouldRunPdfOcrForEdital(text, {
            anchorFound: editalMateriais.anchorFound,
            budgetLineCount: editalMateriais.budgetLines.length,
          });
          const shouldUseExtendedOcr =
            shouldRunOcr &&
            hasLateAnnexOrTableHints(text) &&
            text.length < MAX_PDF_OCR_SOURCE_TEXT_CHARS / 2 &&
            editalMateriais.budgetLines.length < 3;

          if (shouldRunOcr) {
            try {
              const { extractPdfTextViaOcr } = await import('../utils/pdf-ocr.js');
              const ocrText = await extractPdfTextViaOcr(file.buffer, {
                maxPages: shouldUseExtendedOcr ? MAX_PDF_OCR_EDITAL_PAGES : 24,
                maxDurationMs: MAX_PDF_OCR_EDITAL_DURATION_MS,
              });
              if (ocrText.trim().length > 40) {
                const combinedText = `${text}\n\n--- Texto reconhecido por OCR (trechos em imagem no PDF) ---\n\n${ocrText}`.slice(
                  0,
                  maxPdfChars,
                );
                const ocrParsed = parseEditalMateriaisDisponibilizados(combinedText);
                if (ocrParsed.budgetLines.length > editalMateriais.budgetLines.length) {
                  text = combinedText;
                  editalMateriais = ocrParsed;
                  ocrUsed = true;
                }
              }
            } catch (error) {
              logger.warn('PDF OCR (edital / TR) falhou; mantendo somente o texto extraído do PDF.', error);
            }
          } else if (hasLateAnnexOrTableHints(text) && text.length >= MAX_PDF_OCR_SOURCE_TEXT_CHARS) {
            logger.info(
              `PDF OCR (edital / TR) ignorado para evitar timeout em documento rico em texto (${text.length} chars).`,
            );
          }

          return {
            text,
            previewJson: buildEditalPreviewJson(text, editalMateriais, ocrUsed),
            editalMateriais,
          };
        }

        return { text };
      } finally {
        await parser.destroy();
      }
    }

    if (
      mime.includes('spreadsheet') ||
      mime.includes('excel') ||
      name.endsWith('.xlsx') ||
      name.endsWith('.xls')
    ) {
      const workbook = XLSX.read(file.buffer, { type: 'buffer', codepage: 65001 });
      const sheetSnapshots: Array<{ name: string; rows: string[][] }> = [];
      const allGridRows: string[][] = [];
      const textChunks: string[] = [];

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: '',
          raw: false,
        }) as unknown[][];
        const capped = rows.slice(0, MAX_SHEET_ROWS);
        const stringRows = capped.map((row) =>
          (row as unknown[]).map((cell) => repairUtf8MisinterpretedAsLatin1(String(cell ?? ''))),
        );
        allGridRows.push(...stringRows);
        const flat = stringRows
          .flat()
          .filter((c) => c && String(c).trim().length > 0)
          .join(' | ');
        textChunks.push(`[${repairUtf8MisinterpretedAsLatin1(sheetName)}] ${flat}`);
        sheetSnapshots.push({
          name: repairUtf8MisinterpretedAsLatin1(sheetName),
          rows: stringRows.slice(0, 100),
        });
      }

      const text = repairUtf8MisinterpretedAsLatin1(textChunks.join('\n\n')).slice(0, MAX_TEXT);

      return {
        text,
        gridRows: allGridRows,
        previewJson: { sheets: sheetSnapshots },
      };
    }
  } catch {
    /* leitura best-effort */
  }

  return {
    text: repairUtf8MisinterpretedAsLatin1(file.buffer.toString('utf8').slice(0, MAX_TEXT)),
  };
}

function buildExtractedFields(
  text: string,
  baseTitle: string,
  hints: ProjectHints,
  budgetLines?: BudgetLineCandidate[],
): NonNullable<CreateProjectDocumentServiceInput['extractedFields']> {
  const excerpt = text.replace(/\s+/g, ' ').trim();
  const shortExcerpt = excerpt.slice(0, 320);
  const bid = hints.bidNumber ?? guessBidNumberFromText(text);
  const processNo = hints.procurementProcessNumber ?? guessProcessNumberFromText(text);

  const name = hints.name ?? baseTitle.slice(0, MAX_PROJECT_NAME_CHARS);
  const org =
    hints.organizationName ?? 'Confirmar órgão responsável (revisar células do documento)';

  const fields: NonNullable<CreateProjectDocumentServiceInput['extractedFields']> = [
    {
      targetType: ExtractedTargetType.PROJECT,
      fieldKey: 'name',
      proposedValue: name.slice(0, MAX_PROJECT_NAME_CHARS),
      sourceExcerpt: shortExcerpt ? shortExcerpt.slice(0, 240) : null,
      confidenceScore: hints.name ? 0.75 : 0.55,
      reviewStatus: ExtractedFieldReviewStatus.PENDING_REVIEW,
    },
    {
      targetType: ExtractedTargetType.PROJECT,
      fieldKey: 'organizationName',
      proposedValue: org.slice(0, MAX_PROJECT_NAME_CHARS),
      sourceExcerpt: shortExcerpt ? shortExcerpt.slice(0, 200) : null,
      confidenceScore: hints.organizationName ? 0.72 : 0.35,
      reviewStatus: ExtractedFieldReviewStatus.PENDING_REVIEW,
    },
  ];

  const summary = hints.objectSummary ?? (excerpt.length > 40 ? excerpt.slice(0, 1500) : '');
  if (summary) {
    fields.push({
      targetType: ExtractedTargetType.PROJECT,
      fieldKey: 'objectSummary',
      proposedValue: summary.slice(0, 1500),
      sourceExcerpt: shortExcerpt.slice(0, 280),
      confidenceScore: hints.objectSummary ? 0.65 : 0.45,
      reviewStatus: ExtractedFieldReviewStatus.PENDING_REVIEW,
    });
  }

  if (bid) {
    fields.push({
      targetType: ExtractedTargetType.PROJECT,
      fieldKey: 'bidNumber',
      proposedValue: bid,
      sourceExcerpt: excerpt.includes(bid) ? bid : shortExcerpt.slice(0, 120),
      confidenceScore: 0.72,
      reviewStatus: ExtractedFieldReviewStatus.PENDING_REVIEW,
    });
  }

  if (processNo) {
    fields.push({
      targetType: ExtractedTargetType.PROJECT,
      fieldKey: 'procurementProcessNumber',
      proposedValue: processNo,
      sourceExcerpt: processNo,
      confidenceScore: 0.68,
      reviewStatus: ExtractedFieldReviewStatus.PENDING_REVIEW,
    });
  }

  if (hints.contractNumber) {
    fields.push({
      targetType: ExtractedTargetType.PROJECT,
      fieldKey: 'contractNumber',
      proposedValue: hints.contractNumber,
      sourceExcerpt: hints.contractNumber,
      confidenceScore: 0.6,
      reviewStatus: ExtractedFieldReviewStatus.PENDING_REVIEW,
    });
  }

  if (hints.city) {
    fields.push({
      targetType: ExtractedTargetType.PROJECT,
      fieldKey: 'city',
      proposedValue: hints.city,
      sourceExcerpt: hints.city,
      confidenceScore: 0.55,
      reviewStatus: ExtractedFieldReviewStatus.PENDING_REVIEW,
    });
  }

  if (hints.state) {
    fields.push({
      targetType: ExtractedTargetType.PROJECT,
      fieldKey: 'state',
      proposedValue: hints.state,
      sourceExcerpt: hints.state,
      confidenceScore: 0.55,
      reviewStatus: ExtractedFieldReviewStatus.PENDING_REVIEW,
    });
  }

  for (const bl of budgetLines ?? []) {
    fields.push({
      targetType: ExtractedTargetType.BUDGET_ITEM,
      recordGroupKey: bl.recordGroupKey ?? undefined,
      fieldKey: bl.fieldKey.slice(0, 120),
      proposedValue: bl.proposedValue.slice(0, 4000),
      sourceExcerpt: bl.sourceExcerpt.slice(0, 500),
      confidenceScore: 0.48,
      reviewStatus: ExtractedFieldReviewStatus.PENDING_REVIEW,
    });
  }

  return fields;
}

export async function bootstrapProjectFromUpload(
  file: Express.Multer.File,
  documentType: DocumentType,
) {
  const safeOriginalName = normalizeImportedFileName(file.originalname);
  const { text, previewJson, gridRows, implementationMap, editalMateriais } = await extractPlainText(
    { ...file, originalname: safeOriginalName },
    documentType,
  );
  const baseTitle = stripExtension(safeOriginalName);

  const gridHints = gridRows?.length ? deriveHintsFromSpreadsheetRows(gridRows) : {};
  const textHints = mergeHintsFromPlainText(text, baseTitle);
  const mapHints = implementationMap?.hints ?? {};
  const merged = mergeProjectHints(gridHints, textHints, mapHints);

  const code = `AUTO-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;

  const projectPayload: CreateProjectInput = {
    code,
    name: (merged.name ?? textHints.name ?? baseTitle).slice(0, MAX_PROJECT_NAME_CHARS),
    organizationName: (merged.organizationName ?? 'Órgão — confirmar na revisão').slice(0, MAX_PROJECT_NAME_CHARS),
    objectSummary: merged.objectSummary ?? (text ? text.slice(0, 2000) : undefined),
    procurementProcessNumber: merged.procurementProcessNumber ?? guessProcessNumberFromText(text) ?? undefined,
    bidNumber: merged.bidNumber ?? guessBidNumberFromText(text) ?? undefined,
    contractNumber: merged.contractNumber ?? undefined,
    city: merged.city ?? undefined,
    state: merged.state ?? undefined,
    projectStatus: 'DRAFT',
    implementationStatus: 'NOT_STARTED',
  };

  const createdProject = await projectService.createProject(projectPayload);

  const budgetLines =
    documentType === DocumentType.IMPLEMENTATION_MAP
      ? implementationMap?.budgetLines
      : documentType === DocumentType.NOTICE || documentType === DocumentType.TERMS_OF_REFERENCE
        ? editalMateriais?.budgetLines
        : undefined;

  const extractedFields = buildExtractedFields(text, baseTitle, merged, budgetLines);

  const docPayload: CreateProjectDocumentServiceInput = {
    documentType,
    originalFileName: safeOriginalName,
    mimeType: file.mimetype || undefined,
    contentText: text.slice(0, 50_000),
    previewJson: previewJson ?? undefined,
    extractedFields,
    originalFileBuffer: file.buffer,
  };

  const documentResult = await documentService.createProjectDocument(createdProject.id, docPayload);
  return {
    projectId: createdProject.id,
    documentId: documentResult.id,
  };
}

const EXTRACTION_FILE_EXT = /\.(pdf|xlsx|xls)$/i;
const STORAGE_FILE_EXT =
  /\.(pdf|xlsx|xls|doc|docx|ppt|pptx|png|jpg|jpeg|gif|webp|txt|csv|zip)$/i;

export type ImportDocumentOptions = {
  documentDate?: string | null;
  notes?: string | null;
  folderId?: string | null;
  storeOnly?: boolean;
};

/**
 * Mesmo pipeline de leitura de {@link bootstrapProjectFromUpload}, mas vincula o documento a um projeto já existente.
 * Usado pelo upload na tela de documentos do projeto (multipart), não pelo fluxo “novo projeto”.
 */
export async function importDocumentToExistingProject(
  projectId: string,
  file: Express.Multer.File,
  documentType: DocumentType,
  options?: ImportDocumentOptions,
) {
  const projectExists = await projectRepository.exists(projectId);
  if (!projectExists) {
    throw new AppError('Projeto não encontrado.', 404);
  }

  await validateFolderForProject(projectId, options?.folderId ?? null);

  const safeOriginalName = normalizeImportedFileName(file.originalname);

  if (options?.storeOnly) {
    if (!STORAGE_FILE_EXT.test(safeOriginalName.toLowerCase())) {
      throw new AppError(
        'Tipo de arquivo não permitido para armazenamento. Use PDF, Office, imagem, CSV, TXT ou ZIP.',
        400,
      );
    }

    const docPayload: CreateProjectDocumentServiceInput = {
      documentType,
      originalFileName: safeOriginalName,
      mimeType: file.mimetype || undefined,
      extractedFields: [],
      originalFileBuffer: file.buffer,
      processingStatus: 'PROCESSED',
      reviewStatus: 'REVIEWED',
      documentDate: options.documentDate?.trim() || undefined,
      notes: options.notes?.trim() || undefined,
      folderId: options.folderId ?? null,
    };

    const documentResult = await documentService.createProjectDocument(projectId, docPayload);
    return {
      projectId,
      documentId: documentResult.id,
    };
  }

  if (!EXTRACTION_FILE_EXT.test(safeOriginalName.toLowerCase())) {
    throw new AppError('Envie um arquivo PDF ou Excel (.pdf, .xlsx, .xls).', 400);
  }

  const { text, previewJson, gridRows, implementationMap, editalMateriais } = await extractPlainText(
    { ...file, originalname: safeOriginalName },
    documentType,
  );
  const baseTitle = stripExtension(safeOriginalName);

  const gridHints = gridRows?.length ? deriveHintsFromSpreadsheetRows(gridRows) : {};
  const textHints = mergeHintsFromPlainText(text, baseTitle);
  const mapHints = implementationMap?.hints ?? {};
  const merged = mergeProjectHints(gridHints, textHints, mapHints);

  const budgetLines =
    documentType === DocumentType.IMPLEMENTATION_MAP
      ? implementationMap?.budgetLines
      : documentType === DocumentType.NOTICE || documentType === DocumentType.TERMS_OF_REFERENCE
        ? editalMateriais?.budgetLines
        : undefined;

  const extractedFields = buildExtractedFields(text, baseTitle, merged, budgetLines);

  const docPayload: CreateProjectDocumentServiceInput = {
    documentType,
    originalFileName: safeOriginalName,
    mimeType: file.mimetype || undefined,
    contentText: text.slice(0, 50_000),
    previewJson: previewJson ?? undefined,
    extractedFields,
    documentDate: options?.documentDate?.trim() || undefined,
    notes: options?.notes?.trim() || undefined,
    originalFileBuffer: file.buffer,
    folderId: options?.folderId ?? null,
  };

  const documentResult = await documentService.createProjectDocument(projectId, docPayload);
  return {
    projectId,
    documentId: documentResult.id,
  };
}
