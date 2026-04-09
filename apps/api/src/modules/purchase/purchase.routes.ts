import { Router } from 'express';

import { purchaseController } from '../../controllers/purchase.controller.js';
import { OPERATIONAL_USER_ROLES, requireRole } from '../../middlewares/auth.js';
import { validateRequest } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  createPurchaseOrderItemSchema,
  createPurchaseOrderSchema,
  projectPurchaseParamsSchema,
  purchaseOrderParamsSchema,
} from './purchase.schemas.js';

export const purchaseRouter = Router();

purchaseRouter.use(requireRole(...OPERATIONAL_USER_ROLES));

purchaseRouter.post(
  '/projects/:id/purchases',
  validateRequest({ params: projectPurchaseParamsSchema, body: createPurchaseOrderSchema }),
  asyncHandler((request, response) => purchaseController.createOrder(request, response)),
);

purchaseRouter.get(
  '/projects/:id/purchases',
  validateRequest({ params: projectPurchaseParamsSchema }),
  asyncHandler((request, response) => purchaseController.listOrders(request, response)),
);

purchaseRouter.post(
  '/purchases/:id/items',
  validateRequest({ params: purchaseOrderParamsSchema, body: createPurchaseOrderItemSchema }),
  asyncHandler((request, response) => purchaseController.createOrderItem(request, response)),
);
