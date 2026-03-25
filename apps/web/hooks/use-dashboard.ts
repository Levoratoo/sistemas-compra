'use client';

import { useQuery } from '@tanstack/react-query';

import { getConsolidatedDashboard, getProjectDashboard } from '@/services/dashboard-service';

export function useConsolidatedDashboardQuery() {
  return useQuery({
    queryKey: ['dashboard', 'consolidated'],
    queryFn: getConsolidatedDashboard,
  });
}

export function useProjectDashboardQuery(projectId: string) {
  return useQuery({
    queryKey: ['dashboard', 'project', projectId],
    queryFn: () => getProjectDashboard(projectId),
    enabled: Boolean(projectId),
  });
}
