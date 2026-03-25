import type { Request, Response } from 'express';

import { documentService } from '../services/document.service.js';
import type { CreateProjectDocumentInput } from '../modules/document/document.schemas.js';

class DocumentController {
  async create(request: Request, response: Response) {
    const result = await documentService.createProjectDocument(
      String(request.params.id),
      request.body as CreateProjectDocumentInput,
    );
    response.status(201).json(result);
  }

  async listByProject(request: Request, response: Response) {
    const result = await documentService.listProjectDocuments(String(request.params.id));
    response.json(result);
  }
}

export const documentController = new DocumentController();
