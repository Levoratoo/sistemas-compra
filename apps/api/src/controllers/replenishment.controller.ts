import type { Request, Response } from 'express';

import { replenishmentService } from '../services/replenishment.service.js';
import type { CreateReplenishmentRuleInput } from '../modules/replenishment/replenishment.schemas.js';

class ReplenishmentController {
  async createOrReplaceRule(request: Request, response: Response) {
    const result = await replenishmentService.createOrReplaceRule(
      String(request.params.id),
      request.body as CreateReplenishmentRuleInput,
    );
    response.status(201).json(result);
  }

  async listByProject(request: Request, response: Response) {
    const result = await replenishmentService.listProjectReplenishments(String(request.params.id));
    response.json(result);
  }
}

export const replenishmentController = new ReplenishmentController();
