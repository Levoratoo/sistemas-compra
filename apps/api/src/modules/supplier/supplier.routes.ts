import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import multer from 'multer';

import { supplierController } from '../../controllers/supplier.controller.js';
import { validateRequest } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { supplierIdParamsSchema } from './supplier.schemas.js';

export const supplierRouter = Router();

const uploadCnd = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 30 },
});

function maybeMultipartSupplier(request: Request, response: Response, next: NextFunction) {
  if (request.is('multipart/form-data')) {
    return uploadCnd.array('cndFiles', 20)(request, response, next);
  }
  next();
}

supplierRouter.post(
  '/suppliers',
  maybeMultipartSupplier,
  asyncHandler((request, response) => supplierController.create(request, response)),
);

supplierRouter.get(
  '/suppliers',
  asyncHandler((request, response) => supplierController.list(request, response)),
);

supplierRouter.get(
  '/suppliers/:id',
  validateRequest({ params: supplierIdParamsSchema }),
  asyncHandler((request, response) => supplierController.getById(request, response)),
);

supplierRouter.put(
  '/suppliers/:id',
  maybeMultipartSupplier,
  validateRequest({ params: supplierIdParamsSchema }),
  asyncHandler((request, response) => supplierController.update(request, response)),
);

supplierRouter.delete(
  '/suppliers/:id',
  validateRequest({ params: supplierIdParamsSchema }),
  asyncHandler((request, response) => supplierController.delete(request, response)),
);
