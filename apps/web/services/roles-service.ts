import { apiRequest } from '@/services/api-client';
import type { DataOriginType, ProjectRole } from '@/types/api';

export type RolePayload = {
  roleName: string;
  cboCode?: string | null;
  workRegime?: string | null;
  workloadLabel?: string | null;
  allocationSector?: string | null;
  plannedPositions?: number | null;
  employeesPerPosition?: number | null;
  plannedHeadcount: number;
  sourceType?: DataOriginType;
  sourceDocumentId?: string | null;
  sourceSheetName?: string | null;
  sourceCellRef?: string | null;
  sourcePage?: number | null;
  sourceExcerpt?: string | null;
  notes?: string | null;
};

export function listProjectRoles(projectId: string) {
  return apiRequest<ProjectRole[]>(`projects/${projectId}/roles`);
}

export function createProjectRole(projectId: string, payload: RolePayload) {
  return apiRequest<ProjectRole>(`projects/${projectId}/roles`, {
    method: 'POST',
    body: payload,
  });
}

export function updateProjectRole(roleId: string, payload: Partial<RolePayload>) {
  return apiRequest<ProjectRole>(`roles/${roleId}`, {
    method: 'PUT',
    body: payload,
  });
}

export function deleteProjectRole(roleId: string) {
  return apiRequest<null>(`roles/${roleId}`, {
    method: 'DELETE',
  });
}
