import { Router } from 'express';

import { dashboardController } from '../../controllers/dashboard.controller.js';
import { validateRequest } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { projectDashboardParamsSchema } from './dashboard.schemas.js';

export const dashboardRouter = Router();

dashboardRouter.get(
  '/dashboard/consolidated',
  asyncHandler((request, response) => dashboardController.getConsolidatedDashboard(request, response)),
);

dashboardRouter.get(
  '/projects/:id/dashboard',
  validateRequest({ params: projectDashboardParamsSchema }),
  asyncHandler((request, response) => dashboardController.getProjectDashboard(request, response)),
);
