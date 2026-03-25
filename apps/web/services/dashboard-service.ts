import { apiRequest } from '@/services/api-client';
import type { ConsolidatedDashboard, ProjectDashboard } from '@/types/api';

export function getConsolidatedDashboard() {
  return apiRequest<ConsolidatedDashboard>('dashboard/consolidated');
}

export function getProjectDashboard(projectId: string) {
  return apiRequest<ProjectDashboard>(`projects/${projectId}/dashboard`);
}
