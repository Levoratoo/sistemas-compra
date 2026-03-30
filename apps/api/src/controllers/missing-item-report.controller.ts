import type { Request, Response } from 'express';

import type {
  CreateMissingItemReportInput,
  UpdateMissingItemReportInput,
} from '../modules/missing-item-report/missing-item-report.schemas.js';
import { missingItemReportService } from '../services/missing-item-report.service.js';

class MissingItemReportController {
  async create(request: Request, response: Response) {
    const result = await missingItemReportService.create(
      String(request.params.id),
      request.body as CreateMissingItemReportInput,
    );
    response.status(201).json(result);
  }

  async listByProject(request: Request, response: Response) {
    const result = await missingItemReportService.listByProject(String(request.params.id));
    response.json(result);
  }

  async update(request: Request, response: Response) {
    const result = await missingItemReportService.update(
      String(request.params.id),
      request.body as UpdateMissingItemReportInput,
    );
    response.json(result);
  }

  async delete(request: Request, response: Response) {
    await missingItemReportService.delete(String(request.params.id));
    response.status(204).send();
  }

  async addAttachment(request: Request, response: Response) {
    const result = await missingItemReportService.addAttachment(String(request.params.id), request.file);
    response.status(201).json(result);
  }

  async deleteAttachment(request: Request, response: Response) {
    const result = await missingItemReportService.deleteAttachment(String(request.params.id));
    response.json(result);
  }
}

export const missingItemReportController = new MissingItemReportController();
