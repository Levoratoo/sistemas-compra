'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createProjectRole,
  deleteProjectRole,
  listProjectRoles,
  type RolePayload,
  updateProjectRole,
} from '@/services/roles-service';

export function useProjectRolesQuery(projectId: string) {
  return useQuery({
    queryKey: ['project-roles', projectId],
    queryFn: () => listProjectRoles(projectId),
    enabled: Boolean(projectId),
  });
}

export function useProjectRolesMutations(projectId: string) {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['project-roles', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
    ]);
  };

  return {
    createRole: useMutation({
      mutationFn: (payload: RolePayload) => createProjectRole(projectId, payload),
      onSuccess: invalidate,
    }),
    updateRole: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: Partial<RolePayload> }) =>
        updateProjectRole(id, payload),
      onSuccess: invalidate,
    }),
    deleteRole: useMutation({
      mutationFn: (id: string) => deleteProjectRole(id),
      onSuccess: invalidate,
    }),
  };
}
