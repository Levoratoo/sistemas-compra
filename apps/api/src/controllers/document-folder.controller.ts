import type { Request, Response } from 'express';

import { documentFolderService } from '../services/document-folder.service.js';
import type {
  CreateDocumentFolderBody,
  UpdateDocumentFolderBody,
} from '../modules/document/document.schemas.js';

class DocumentFolderController {
  async list(request: Request, response: Response) {
    const result = await documentFolderService.listFolders(String(request.params.id));
    response.json(result);
  }

  async create(request: Request, response: Response) {
    const body = request.body as CreateDocumentFolderBody;
    const result = await documentFolderService.createFolder(String(request.params.id), {
      name: body.name,
      parentId: body.parentId ?? null,
      colorHex: body.colorHex,
      iconEmoji: body.iconEmoji,
    });
    response.status(201).json(result);
  }

  async update(request: Request, response: Response) {
    const projectId = String(request.params.id);
    const folderId = String(request.params.folderId);
    const body = request.body as UpdateDocumentFolderBody;
    const result = await documentFolderService.updateFolder(projectId, folderId, {
      name: body.name,
      parentId: body.parentId,
      colorHex: body.colorHex,
      iconEmoji: body.iconEmoji,
    });
    response.json(result);
  }

  async delete(request: Request, response: Response) {
    const projectId = String(request.params.id);
    const folderId = String(request.params.folderId);
    await documentFolderService.deleteFolder(projectId, folderId);
    response.status(204).send();
  }
}

export const documentFolderController = new DocumentFolderController();
