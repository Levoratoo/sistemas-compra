import { Router } from 'express';

import { documentController } from '../../controllers/document.controller.js';
import { documentFolderController } from '../../controllers/document-folder.controller.js';
import { validateRequest } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  createDocumentFolderBodySchema,
  createProjectDocumentSchema,
  documentFolderParamsSchema,
  listProjectDocumentsQuerySchema,
  moveProjectDocumentBodySchema,
  projectDocumentIdParamsSchema,
  projectDocumentParamsSchema,
  updateDocumentFolderBodySchema,
} from './document.schemas.js';

export const documentRouter = Router();

documentRouter.patch(
  '/projects/:id/documents/:documentId',
  validateRequest({
    params: projectDocumentIdParamsSchema,
    body: moveProjectDocumentBodySchema,
  }),
  asyncHandler((request, response) => documentController.moveDocument(request, response)),
);

documentRouter.post(
  '/projects/:id/documents',
  validateRequest({ params: projectDocumentParamsSchema, body: createProjectDocumentSchema }),
  asyncHandler((request, response) => documentController.create(request, response)),
);

documentRouter.get(
  '/projects/:id/documents',
  validateRequest({
    params: projectDocumentParamsSchema,
    query: listProjectDocumentsQuerySchema,
  }),
  asyncHandler((request, response) => documentController.listByProject(request, response)),
);

documentRouter.get(
  '/projects/:id/document-folders',
  validateRequest({ params: projectDocumentParamsSchema }),
  asyncHandler((request, response) => documentFolderController.list(request, response)),
);

documentRouter.post(
  '/projects/:id/document-folders',
  validateRequest({
    params: projectDocumentParamsSchema,
    body: createDocumentFolderBodySchema,
  }),
  asyncHandler((request, response) => documentFolderController.create(request, response)),
);

documentRouter.patch(
  '/projects/:id/document-folders/:folderId',
  validateRequest({
    params: documentFolderParamsSchema,
    body: updateDocumentFolderBodySchema,
  }),
  asyncHandler((request, response) => documentFolderController.update(request, response)),
);

documentRouter.delete(
  '/projects/:id/document-folders/:folderId',
  validateRequest({ params: documentFolderParamsSchema }),
  asyncHandler((request, response) => documentFolderController.delete(request, response)),
);
