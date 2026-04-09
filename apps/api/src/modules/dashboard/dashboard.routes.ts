import { Router } from 'express';

import { dashboardController } from '../../controllers/dashboard.controller.js';
import { OPERATIONAL_USER_ROLES, requireRole } from '../../middlewares/auth.js';
import { validateRequest } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { projectDashboardParamsSchema } from './dashboard.schemas.js';

export const dashboardRouter = Router();

dashboardRouter.use(requireRole(...OPERATIONAL_USER_ROLES));

dashboardRouter.get(
  '/dashboard/consolidated',
  asyncHandler((request, response) => dashboardController.getConsolidatedDashboard(request, response)),
);

dashboardRouter.get(
  '/projects/:id/dashboard',
  validateRequest({ params: projectDashboardParamsSchema }),
  asyncHandler((request, response) => dashboardController.getProjectDashboard(request, response)),
);
