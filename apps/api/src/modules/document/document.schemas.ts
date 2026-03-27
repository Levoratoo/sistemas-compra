import {
  DocumentProcessingStatus,
  DocumentReviewStatus,
  DocumentType,
  ExtractedFieldReviewStatus,
  ExtractedTargetType,
} from '@prisma/client';
import { z } from 'zod';

export const projectDocumentParamsSchema = z.object({
  id: z.string().min(1),
});

export const projectDocumentIdParamsSchema = z.object({
  id: z.string().min(1),
  documentId: z.string().min(1),
});

export const listProjectDocumentsQuerySchema = z.object({
  folderId: z.union([z.literal('all'), z.literal('root'), z.string().min(1)]).optional(),
});

export const moveProjectDocumentBodySchema = z.object({
  folderId: z.union([z.string().min(1), z.null()]),
});

export const createDocumentFolderBodySchema = z.object({
  name: z.string().trim().min(1),
  parentId: z.string().min(1).optional().nullable(),
});

export const updateDocumentFolderBodySchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    parentId: z.union([z.string().min(1), z.null()]).optional(),
  })
  .refine((data) => data.name !== undefined || data.parentId !== undefined, {
    message: 'Informe nome ou pasta pai.',
  });

export const documentFolderParamsSchema = z.object({
  id: z.string().min(1),
  folderId: z.string().min(1),
});

const extractedFieldSchema = z.object({
  targetType: z.nativeEnum(ExtractedTargetType),
  recordGroupKey: z.string().trim().optional(),
  fieldKey: z.string().trim().min(1),
  proposedValue: z.string().trim().min(1),
  confirmedValue: z.string().trim().optional().nullable(),
  sourcePage: z.coerce.number().int().nonnegative().optional().nullable(),
  sourceSheetName: z.string().trim().optional().nullable(),
  sourceCellRef: z.string().trim().optional().nullable(),
  sourceExcerpt: z.string().trim().optional().nullable(),
  confidenceScore: z.coerce.number().min(0).max(1).optional().nullable(),
  reviewStatus: z
    .nativeEnum(ExtractedFieldReviewStatus)
    .default(ExtractedFieldReviewStatus.PENDING_REVIEW),
  reviewNote: z.string().trim().optional().nullable(),
});

export const createProjectDocumentSchema = z.object({
  documentType: z.nativeEnum(DocumentType),
  folderId: z.string().min(1).optional().nullable(),
  originalFileName: z.string().trim().min(1),
  storagePath: z.string().trim().optional(),
  mimeType: z.string().trim().optional(),
  checksum: z.string().trim().optional(),
  documentDate: z.string().trim().optional().nullable(),
  contentText: z.string().optional(),
  previewJson: z.unknown().optional(),
  processingStatus: z.nativeEnum(DocumentProcessingStatus).optional(),
  reviewStatus: z.nativeEnum(DocumentReviewStatus).optional(),
  processingError: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  extractedFields: z.array(extractedFieldSchema).optional(),
});

export type CreateProjectDocumentInput = z.infer<typeof createProjectDocumentSchema>;
export type CreateDocumentFolderBody = z.infer<typeof createDocumentFolderBodySchema>;
export type UpdateDocumentFolderBody = z.infer<typeof updateDocumentFolderBodySchema>;
