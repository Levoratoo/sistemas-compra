import { Router } from 'express';

import { documentController } from '../../controllers/document.controller.js';
import { validateRequest } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { createProjectDocumentSchema, projectDocumentParamsSchema } from './document.schemas.js';

export const documentRouter = Router();

documentRouter.post(
  '/projects/:id/documents',
  validateRequest({ params: projectDocumentParamsSchema, body: createProjectDocumentSchema }),
  asyncHandler((request, response) => documentController.create(request, response)),
);

documentRouter.get(
  '/projects/:id/documents',
  validateRequest({ params: projectDocumentParamsSchema }),
  asyncHandler((request, response) => documentController.listByProject(request, response)),
);
