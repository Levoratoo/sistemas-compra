import { Router } from 'express';

import { quoteController } from '../../controllers/quote.controller.js';
import { validateRequest } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  applyQuoteWinnerSchema,
  quoteItemParamsSchema,
  quoteProjectParamsSchema,
  quoteSlotParamsSchema,
  updateQuoteItemSchema,
  updateQuoteSupplierSchema,
} from './quote.schemas.js';

export const quoteRouter = Router();

quoteRouter.get(
  '/projects/:id/quotes',
  validateRequest({ params: quoteProjectParamsSchema }),
  asyncHandler((request, response) => quoteController.listByProject(request, response)),
);

quoteRouter.put(
  '/projects/:id/quotes/:slotNumber/supplier',
  validateRequest({ params: quoteSlotParamsSchema, body: updateQuoteSupplierSchema }),
  asyncHandler((request, response) => quoteController.updateSupplier(request, response)),
);

quoteRouter.put(
  '/projects/:id/quotes/:slotNumber/items/:budgetItemId',
  validateRequest({ params: quoteItemParamsSchema, body: updateQuoteItemSchema }),
  asyncHandler((request, response) => quoteController.updateItem(request, response)),
);

quoteRouter.post(
  '/projects/:id/quotes/apply-winner',
  validateRequest({ params: quoteProjectParamsSchema, body: applyQuoteWinnerSchema }),
  asyncHandler((request, response) => quoteController.applyWinner(request, response)),
);
