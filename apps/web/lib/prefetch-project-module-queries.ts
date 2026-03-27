import type { QueryClient } from '@tanstack/react-query';

import { listBudgetItems } from '@/services/budget-items-service';
import { listProjectDocumentFolders, listProjectDocuments } from '@/services/documents-service';
import { getProjectDashboard } from '@/services/dashboard-service';
import { listProjectPurchases } from '@/services/purchases-service';
import { listProjectReplenishments } from '@/services/replenishments-service';

/**
 * Pré-carrega as mesmas queries usadas pelas páginas do projeto (hover no nav).
 * Falhas são ignoradas para não poluir o console em cenários edge.
 */
export function prefetchProjectModuleQueries(queryClient: QueryClient, projectId: string, tabHref: string) {
  const run = (p: Promise<unknown>) => p.catch(() => undefined);

  switch (tabHref) {
    case '':
      return Promise.all([
        run(
          queryClient.prefetchQuery({
            queryKey: ['dashboard', 'project', projectId],
            queryFn: () => getProjectDashboard(projectId),
          }),
        ),
        run(
          queryClient.prefetchQuery({
            queryKey: ['purchases', projectId],
            queryFn: () => listProjectPurchases(projectId),
          }),
        ),
        run(
          queryClient.prefetchQuery({
            queryKey: ['project-replenishments', projectId],
            queryFn: () => listProjectReplenishments(projectId),
          }),
        ),
      ]);
    case '/purchase-control':
      return run(
        queryClient.prefetchQuery({
          queryKey: ['budget-items', projectId],
          queryFn: () => listBudgetItems(projectId),
        }),
      );
    case '/purchases':
      return run(
        queryClient.prefetchQuery({
          queryKey: ['purchases', projectId],
          queryFn: () => listProjectPurchases(projectId),
        }),
      );
    case '/replenishments':
      return run(
        queryClient.prefetchQuery({
          queryKey: ['project-replenishments', projectId],
          queryFn: () => listProjectReplenishments(projectId),
        }),
      );
    case '/documents':
      return Promise.all([
        run(
          queryClient.prefetchQuery({
            queryKey: ['project-documents', projectId, 'root'],
            queryFn: () => listProjectDocuments(projectId, { folderScope: 'root' }),
          }),
        ),
        run(
          queryClient.prefetchQuery({
            queryKey: ['project-document-folders', projectId],
            queryFn: () => listProjectDocumentFolders(projectId),
          }),
        ),
      ]);
    default:
      return Promise.resolve();
  }
}
