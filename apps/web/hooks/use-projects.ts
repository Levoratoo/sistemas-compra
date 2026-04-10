'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/components/auth/auth-context';
import {
  applyExtractionToProject,
  createProject,
  deleteProject,
  getProject,
  getProjectSummary,
  listProjects,
  type ApplyExtractionPayload,
  type ProjectPayload,
  updateProject,
} from '@/services/projects-service';
import type { ProjectStatus } from '@/types/api';

export function useProjectsQuery(filters?: { search?: string; projectStatus?: ProjectStatus }) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['projects', user?.id ?? 'anonymous', user?.role ?? 'anonymous', filters],
    queryFn: () => listProjects(filters),
  });
}

export function useProjectQuery(projectId: string, enabled = true) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
    enabled: Boolean(projectId) && enabled,
  });
}

export function useProjectSummaryQuery(projectId: string, enabled = true) {
  return useQuery({
    queryKey: ['project-summary', projectId],
    queryFn: () => getProjectSummary(projectId),
    enabled: Boolean(projectId) && enabled,
  });
}

export function useProjectMutations(projectId?: string) {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['projects'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'consolidated'] }),
      projectId ? queryClient.invalidateQueries({ queryKey: ['project', projectId] }) : Promise.resolve(),
      projectId
        ? queryClient.invalidateQueries({ queryKey: ['dashboard', 'project', projectId] })
        : Promise.resolve(),
    ]);
  };

  return {
    createProject: useMutation({
      mutationFn: (payload: ProjectPayload) => createProject(payload),
      onSuccess: invalidate,
    }),
    updateProject: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: Partial<ProjectPayload> }) =>
        updateProject(id, payload),
      onSuccess: invalidate,
    }),
    deleteProject: useMutation({
      mutationFn: (id: string) => deleteProject(id),
      onSuccess: invalidate,
    }),
    applyExtraction: useMutation({
      mutationFn: ({
        projectId: pid,
        documentId: did,
        payload,
      }: {
        projectId: string;
        documentId: string;
        payload: ApplyExtractionPayload;
      }) => applyExtractionToProject(pid, did, payload),
      onSuccess: invalidate,
    }),
  };
}
