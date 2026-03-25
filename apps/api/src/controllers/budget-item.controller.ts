import type { Request, Response } from 'express';

import { budgetItemService } from '../services/budget-item.service.js';
import type {
  CreateBudgetItemInput,
  UpdateBudgetItemInput,
} from '../modules/budget-item/budget-item.schemas.js';

class BudgetItemController {
  async create(request: Request, response: Response) {
    const result = await budgetItemService.createBudgetItem(
      String(request.params.id),
      request.body as CreateBudgetItemInput,
    );
    response.status(201).json(result);
  }

  async listByProject(request: Request, response: Response) {
    const result = await budgetItemService.listBudgetItems(String(request.params.id));
    response.json(result);
  }

  async update(request: Request, response: Response) {
    const result = await budgetItemService.updateBudgetItem(
      String(request.params.id),
      request.body as UpdateBudgetItemInput,
    );
    response.json(result);
  }

  async delete(request: Request, response: Response) {
    await budgetItemService.deleteBudgetItem(String(request.params.id));
    response.status(204).send();
  }
}

export const budgetItemController = new BudgetItemController();
