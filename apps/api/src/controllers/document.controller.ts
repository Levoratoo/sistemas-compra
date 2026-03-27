import type { Request, Response } from 'express';

import { documentService } from '../services/document.service.js';
import type { CreateProjectDocumentInput } from '../modules/document/document.schemas.js';

function parseFolderScope(folderId: string | undefined) {
  if (folderId === undefined || folderId === 'all') {
    return 'all' as const;
  }
  if (folderId === 'root') {
    return { folderId: null as string | null };
  }
  return { folderId: folderId };
}

class DocumentController {
  async create(request: Request, response: Response) {
    const result = await documentService.createProjectDocument(
      String(request.params.id),
      request.body as CreateProjectDocumentInput,
    );
    response.status(201).json(result);
  }

  async listByProject(request: Request, response: Response) {
    const folderScope = parseFolderScope(request.query.folderId as string | undefined);
    const result = await documentService.listProjectDocuments(String(request.params.id), {
      folderScope,
    });
    response.json(result);
  }

  async moveDocument(request: Request, response: Response) {
    const projectId = String(request.params.id);
    const documentId = String(request.params.documentId);
    const { folderId } = request.body as { folderId: string | null };
    const result = await documentService.moveProjectDocument(projectId, documentId, folderId);
    response.json(result);
  }

  async download(request: Request, response: Response) {
    const projectId = String(request.params.id);
    const documentId = String(request.params.documentId);
    const file = await documentService.getDocumentFileForDownload(projectId, documentId);
    response.download(file.absolutePath, file.downloadName);
  }
}

export const documentController = new DocumentController();
