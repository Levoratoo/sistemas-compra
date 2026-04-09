import { Router } from 'express';

import { replenishmentController } from '../../controllers/replenishment.controller.js';
import { OPERATIONAL_USER_ROLES, requireRole } from '../../middlewares/auth.js';
import { validateRequest } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  budgetItemReplenishmentParamsSchema,
  createReplenishmentRuleSchema,
  projectReplenishmentParamsSchema,
} from './replenishment.schemas.js';

export const replenishmentRouter = Router();

replenishmentRouter.use(requireRole(...OPERATIONAL_USER_ROLES));

replenishmentRouter.post(
  '/budget-items/:id/replenishment-rule',
  validateRequest({
    params: budgetItemReplenishmentParamsSchema,
    body: createReplenishmentRuleSchema,
  }),
  asyncHandler((request, response) => replenishmentController.createOrReplaceRule(request, response)),
);

replenishmentRouter.get(
  '/projects/:id/replenishments',
  validateRequest({ params: projectReplenishmentParamsSchema }),
  asyncHandler((request, response) => replenishmentController.listByProject(request, response)),
);
