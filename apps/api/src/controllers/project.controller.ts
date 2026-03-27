import type { Request, Response } from 'express';
import { DocumentType } from '@prisma/client';
import { z } from 'zod';

import { projectService } from '../services/project.service.js';
import {
  bootstrapProjectFromUpload,
  importDocumentToExistingProject,
} from '../services/project-from-document.service.js';
import { AppError } from '../utils/app-error.js';
import { normalizeImportedFileName } from '../utils/encoding.js';
import type { CreateProjectInput, ListProjectsQuery, UpdateProjectInput } from '../modules/project/project.schemas.js';

const fromDocumentBodySchema = z.object({
  documentType: z.nativeEnum(DocumentType),
});

const importDocumentBodySchema = z.object({
  documentType: z.nativeEnum(DocumentType),
  documentDate: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  folderId: z
    .union([z.string().min(1), z.literal('')])
    .optional()
    .transform((v) => (v === '' || v == null ? null : v)),
  storeOnly: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((v) => v === true || v === 'true' || v === '1'),
});

class ProjectController {
  async createFromDocument(request: Request, response: Response) {
    const file = request.file;

    if (!file) {
      throw new AppError('Envie um arquivo PDF ou Excel (.pdf, .xlsx, .xls).', 400);
    }

    const safeName = normalizeImportedFileName(file.originalname);
    if (!/\.(pdf|xlsx|xls)$/i.test(safeName)) {
      throw new AppError('Envie um arquivo PDF ou Excel (.pdf, .xlsx, .xls).', 400);
    }

    const parsed = fromDocumentBodySchema.safeParse(request.body);

    if (!parsed.success) {
      throw new AppError('Tipo de documento inválido.', 422, parsed.error.flatten());
    }

    const result = await bootstrapProjectFromUpload(file, parsed.data.documentType);
    response.status(201).json(result);
  }

  async importDocumentFromUpload(request: Request, response: Response) {
    const file = request.file;

    if (!file) {
      throw new AppError('Envie um arquivo PDF ou Excel (.pdf, .xlsx, .xls).', 400);
    }

    const parsed = importDocumentBodySchema.safeParse(request.body);

    if (!parsed.success) {
      throw new AppError('Dados do formulário inválidos.', 422, parsed.error.flatten());
    }

    const projectId = String(request.params.id);
    const { documentType, documentDate, notes, folderId, storeOnly } = parsed.data;

    const result = await importDocumentToExistingProject(projectId, file, documentType, {
      documentDate: documentDate ?? null,
      notes: notes ?? null,
      folderId: folderId ?? null,
      storeOnly: Boolean(storeOnly),
    });
    response.status(201).json(result);
  }

  async create(request: Request, response: Response) {
    const result = await projectService.createProject(request.body as CreateProjectInput);
    response.status(201).json(result);
  }

  async list(request: Request, response: Response) {
    const result = await projectService.listProjects(request.query as ListProjectsQuery);
    response.json(result);
  }

  async getById(request: Request, response: Response) {
    const result = await projectService.getProjectById(String(request.params.id));
    response.json(result);
  }

  async update(request: Request, response: Response) {
    const result = await projectService.updateProject(
      String(request.params.id),
      request.body as UpdateProjectInput,
    );
    response.json(result);
  }

  async delete(request: Request, response: Response) {
    await projectService.deleteProject(String(request.params.id));
    response.status(204).send();
  }
}

export const projectController = new ProjectController();
