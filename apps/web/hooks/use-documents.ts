'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createProjectDocument, listProjectDocuments, type DocumentPayload } from '@/services/documents-service';

export function useProjectDocumentsQuery(projectId: string) {
  return useQuery({
    queryKey: ['project-documents', projectId],
    queryFn: () => listProjectDocuments(projectId),
    enabled: Boolean(projectId),
  });
}

export function useProjectDocumentsMutations(projectId: string) {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['project-documents', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
    ]);
  };

  return {
    createDocument: useMutation({
      mutationFn: (payload: DocumentPayload) => createProjectDocument(projectId, payload),
      onSuccess: invalidate,
    }),
  };
}
