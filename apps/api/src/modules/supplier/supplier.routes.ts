import { Router } from 'express';

import { supplierController } from '../../controllers/supplier.controller.js';
import { validateRequest } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { createSupplierSchema, supplierIdParamsSchema, updateSupplierSchema } from './supplier.schemas.js';

export const supplierRouter = Router();

supplierRouter.post(
  '/suppliers',
  validateRequest({ body: createSupplierSchema }),
  asyncHandler((request, response) => supplierController.create(request, response)),
);

supplierRouter.get(
  '/suppliers',
  asyncHandler((request, response) => supplierController.list(request, response)),
);

supplierRouter.put(
  '/suppliers/:id',
  validateRequest({ params: supplierIdParamsSchema, body: updateSupplierSchema }),
  asyncHandler((request, response) => supplierController.update(request, response)),
);

supplierRouter.delete(
  '/suppliers/:id',
  validateRequest({ params: supplierIdParamsSchema }),
  asyncHandler((request, response) => supplierController.delete(request, response)),
);
