import { Router } from 'express';

import { budgetItemController } from '../../controllers/budget-item.controller.js';
import { validateRequest } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  budgetItemIdParamsSchema,
  budgetItemProjectParamsSchema,
  createBudgetItemSchema,
  updateBudgetItemSchema,
} from './budget-item.schemas.js';

export const budgetItemRouter = Router();

budgetItemRouter.post(
  '/projects/:id/budget-items',
  validateRequest({ params: budgetItemProjectParamsSchema, body: createBudgetItemSchema }),
  asyncHandler((request, response) => budgetItemController.create(request, response)),
);

budgetItemRouter.get(
  '/projects/:id/budget-items',
  validateRequest({ params: budgetItemProjectParamsSchema }),
  asyncHandler((request, response) => budgetItemController.listByProject(request, response)),
);

budgetItemRouter.put(
  '/budget-items/:id',
  validateRequest({ params: budgetItemIdParamsSchema, body: updateBudgetItemSchema }),
  asyncHandler((request, response) => budgetItemController.update(request, response)),
);

budgetItemRouter.delete(
  '/budget-items/:id',
  validateRequest({ params: budgetItemIdParamsSchema }),
  asyncHandler((request, response) => budgetItemController.delete(request, response)),
);
