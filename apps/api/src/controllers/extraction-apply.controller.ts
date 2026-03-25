import type { Request, Response } from 'express';

import { applyExtractionToProject } from '../services/extraction-apply.service.js';
import type { ApplyExtractionBody } from '../modules/extraction-apply/extraction-apply.schemas.js';

class ExtractionApplyController {
  async apply(request: Request, response: Response) {
    const { projectId, documentId } = request.params as {
      projectId: string;
      documentId: string;
    };
    const body = request.body as ApplyExtractionBody;

    const result = await applyExtractionToProject(projectId, documentId, body);
    response.json(result);
  }
}

export const extractionApplyController = new ExtractionApplyController();
