import { Router } from 'express';
import multer from 'multer';

import { quoteController } from '../../controllers/quote.controller.js';
import { validateRequest } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  applyQuoteWinnerSchema,
  applyQuoteImportSchema,
  createQuotePurchaseSchema,
  generateQuotePurchaseOrderSchema,
  quoteImportDocumentParamsSchema,
  quoteProjectParamsSchema,
  quotePurchaseItemParamsSchema,
  quotePurchaseParamsSchema,
  quotePurchaseSlotItemParamsSchema,
  quotePurchaseSlotParamsSchema,
  updateQuoteItemSchema,
  updateQuotePurchaseSchema,
  updateQuotePurchaseItemsSchema,
  updateQuoteSupplierSchema,
} from './quote.schemas.js';

export const quoteRouter = Router();

const uploadSupplierQuotePdf = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, _file, cb) => {
    cb(null, true);
  },
});

quoteRouter.get(
  '/projects/:id/quotes',
  validateRequest({ params: quoteProjectParamsSchema }),
  asyncHandler((request, response) => quoteController.listByProject(request, response)),
);

quoteRouter.post(
  '/projects/:id/quotes/purchases',
  validateRequest({ params: quoteProjectParamsSchema, body: createQuotePurchaseSchema }),
  asyncHandler((request, response) => quoteController.createPurchase(request, response)),
);

quoteRouter.put(
  '/projects/:id/quotes/purchases/:purchaseId',
  validateRequest({ params: quotePurchaseParamsSchema, body: updateQuotePurchaseSchema }),
  asyncHandler((request, response) => quoteController.updatePurchase(request, response)),
);

quoteRouter.delete(
  '/projects/:id/quotes/purchases/:purchaseId',
  validateRequest({ params: quotePurchaseParamsSchema }),
  asyncHandler((request, response) => quoteController.deletePurchase(request, response)),
);

quoteRouter.post(
  '/projects/:id/quotes/purchases/:purchaseId/items',
  validateRequest({ params: quotePurchaseParamsSchema, body: updateQuotePurchaseItemsSchema }),
  asyncHandler((request, response) => quoteController.addPurchaseItems(request, response)),
);

quoteRouter.delete(
  '/projects/:id/quotes/purchases/:purchaseId/items/:budgetItemId',
  validateRequest({ params: quotePurchaseItemParamsSchema }),
  asyncHandler((request, response) => quoteController.removePurchaseItem(request, response)),
);

quoteRouter.put(
  '/projects/:id/quotes/purchases/:purchaseId/slots/:slotNumber/supplier',
  validateRequest({ params: quotePurchaseSlotParamsSchema, body: updateQuoteSupplierSchema }),
  asyncHandler((request, response) => quoteController.updateSupplier(request, response)),
);

quoteRouter.put(
  '/projects/:id/quotes/purchases/:purchaseId/slots/:slotNumber/items/:budgetItemId',
  validateRequest({ params: quotePurchaseSlotItemParamsSchema, body: updateQuoteItemSchema }),
  asyncHandler((request, response) => quoteController.updateItem(request, response)),
);

quoteRouter.post(
  '/projects/:id/quotes/purchases/:purchaseId/slots/:slotNumber/import-pdf',
  uploadSupplierQuotePdf.single('file'),
  validateRequest({ params: quotePurchaseSlotParamsSchema }),
  asyncHandler((request, response) => quoteController.importPdf(request, response)),
);

quoteRouter.post(
  '/projects/:id/quotes/purchases/:purchaseId/slots/:slotNumber/import-pdf/:documentId/apply',
  validateRequest({ params: quoteImportDocumentParamsSchema, body: applyQuoteImportSchema }),
  asyncHandler((request, response) => quoteController.applyImportedPdf(request, response)),
);

quoteRouter.post(
  '/projects/:id/quotes/purchases/:purchaseId/apply-winner',
  validateRequest({ params: quotePurchaseParamsSchema, body: applyQuoteWinnerSchema }),
  asyncHandler((request, response) => quoteController.applyWinner(request, response)),
);

quoteRouter.post(
  '/projects/:id/quotes/purchases/:purchaseId/comparison-report',
  validateRequest({ params: quotePurchaseParamsSchema }),
  asyncHandler((request, response) => quoteController.generateComparisonReport(request, response)),
);

quoteRouter.post(
  '/projects/:id/quotes/purchases/:purchaseId/generate-purchase-orders',
  validateRequest({ params: quotePurchaseParamsSchema, body: generateQuotePurchaseOrderSchema }),
  asyncHandler((request, response) => quoteController.generatePurchaseOrders(request, response)),
);
