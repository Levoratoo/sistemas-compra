import { Router } from 'express';
import multer from 'multer';

import { projectController } from '../../controllers/project.controller.js';
import { validateRequest } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  createProjectSchema,
  listProjectsQuerySchema,
  projectIdParamsSchema,
  updateProjectSchema,
} from './project.schemas.js';

export const projectRouter = Router();

const uploadFromDocument = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, _file, cb) => {
    cb(null, true);
  },
});

projectRouter.post(
  '/projects/from-document',
  uploadFromDocument.single('file'),
  asyncHandler((request, response) => projectController.createFromDocument(request, response)),
);

projectRouter.post(
  '/projects/:id/documents/from-upload',
  uploadFromDocument.single('file'),
  validateRequest({ params: projectIdParamsSchema }),
  asyncHandler((request, response) => projectController.importDocumentFromUpload(request, response)),
);

projectRouter.post(
  '/projects',
  validateRequest({ body: createProjectSchema }),
  asyncHandler((request, response) => projectController.create(request, response)),
);

projectRouter.get(
  '/projects',
  validateRequest({ query: listProjectsQuerySchema }),
  asyncHandler((request, response) => projectController.list(request, response)),
);

projectRouter.get(
  '/projects/:id',
  validateRequest({ params: projectIdParamsSchema }),
  asyncHandler((request, response) => projectController.getById(request, response)),
);

projectRouter.put(
  '/projects/:id',
  validateRequest({ params: projectIdParamsSchema, body: updateProjectSchema }),
  asyncHandler((request, response) => projectController.update(request, response)),
);

projectRouter.delete(
  '/projects/:id',
  validateRequest({ params: projectIdParamsSchema }),
  asyncHandler((request, response) => projectController.delete(request, response)),
);
