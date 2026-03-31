'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createProjectDocument,
  listProjectDocumentFolders,
  listProjectDocuments,
  type DocumentPayload,
  type ListProjectDocumentsFolderScope,
} from '@/services/documents-service';

export function useProjectDocumentsQuery(
  projectId: string,
  folderScope: ListProjectDocumentsFolderScope = 'all',
  search?: string | null,
) {
  return useQuery({
    queryKey: ['project-documents', projectId, folderScope, search?.trim() || ''],
    queryFn: () => listProjectDocuments(projectId, { folderScope, search }),
    enabled: Boolean(projectId),
  });
}

export function useProjectDocumentFoldersQuery(projectId: string) {
  return useQuery({
    queryKey: ['project-document-folders', projectId],
    queryFn: () => listProjectDocumentFolders(projectId),
    enabled: Boolean(projectId),
  });
}

export function useProjectDocumentsMutations(projectId: string) {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['project-documents', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['project-document-folders', projectId] }),
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
