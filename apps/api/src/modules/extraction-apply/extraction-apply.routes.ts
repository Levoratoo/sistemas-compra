import { Router } from 'express';

import { extractionApplyController } from '../../controllers/extraction-apply.controller.js';
import { OPERATIONAL_USER_ROLES, requireRole } from '../../middlewares/auth.js';
import { validateRequest } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  applyExtractionBodySchema,
  applyExtractionParamsSchema,
} from './extraction-apply.schemas.js';

export const extractionApplyRouter = Router();

extractionApplyRouter.use(requireRole(...OPERATIONAL_USER_ROLES));

extractionApplyRouter.post(
  '/projects/:projectId/documents/:documentId/apply-extraction',
  validateRequest({
    params: applyExtractionParamsSchema,
    body: applyExtractionBodySchema,
  }),
  asyncHandler((request, response) => extractionApplyController.apply(request, response)),
);
