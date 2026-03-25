import type { Request, Response } from 'express';

import { dashboardService } from '../services/dashboard.service.js';

class DashboardController {
  async getConsolidatedDashboard(_request: Request, response: Response) {
    const result = await dashboardService.getConsolidatedDashboard();
    response.json(result);
  }

  async getProjectDashboard(request: Request, response: Response) {
    const result = await dashboardService.getProjectDashboard(String(request.params.id));
    response.json(result);
  }
}

export const dashboardController = new DashboardController();
