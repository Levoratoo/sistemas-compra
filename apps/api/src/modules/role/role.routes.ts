import { Router } from 'express';

import { roleController } from '../../controllers/role.controller.js';
import { validateRequest } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  createProjectRoleSchema,
  projectRoleParamsSchema,
  roleIdParamsSchema,
  updateProjectRoleSchema,
} from './role.schemas.js';

export const roleRouter = Router();

roleRouter.post(
  '/projects/:id/roles',
  validateRequest({ params: projectRoleParamsSchema, body: createProjectRoleSchema }),
  asyncHandler((request, response) => roleController.create(request, response)),
);

roleRouter.get(
  '/projects/:id/roles',
  validateRequest({ params: projectRoleParamsSchema }),
  asyncHandler((request, response) => roleController.listByProject(request, response)),
);

roleRouter.put(
  '/roles/:id',
  validateRequest({ params: roleIdParamsSchema, body: updateProjectRoleSchema }),
  asyncHandler((request, response) => roleController.update(request, response)),
);

roleRouter.delete(
  '/roles/:id',
  validateRequest({ params: roleIdParamsSchema }),
  asyncHandler((request, response) => roleController.delete(request, response)),
);
