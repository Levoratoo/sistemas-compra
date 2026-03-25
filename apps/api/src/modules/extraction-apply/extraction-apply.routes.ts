import { Router } from 'express';

import { extractionApplyController } from '../../controllers/extraction-apply.controller.js';
import { validateRequest } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  applyExtractionBodySchema,
  applyExtractionParamsSchema,
} from './extraction-apply.schemas.js';

export const extractionApplyRouter = Router();

extractionApplyRouter.post(
  '/projects/:projectId/documents/:documentId/apply-extraction',
  validateRequest({
    params: applyExtractionParamsSchema,
    body: applyExtractionBodySchema,
  }),
  asyncHandler((request, response) => extractionApplyController.apply(request, response)),
);
