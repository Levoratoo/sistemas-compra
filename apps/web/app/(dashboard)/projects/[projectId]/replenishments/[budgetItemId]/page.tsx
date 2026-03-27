import dynamic from 'next/dynamic';

import { ProjectModuleSkeleton } from '@/components/common/project-module-skeleton';
import { STATIC_EXPORT_BUDGET_ITEM_ID, STATIC_EXPORT_PROJECT_ID } from '@/lib/static-export-placeholders';

const ReplenishmentItemDetailPanel = dynamic(
  () =>
    import('@/features/replenishments/replenishment-item-detail-panel').then((m) => ({
      default: m.ReplenishmentItemDetailPanel,
    })),
  { loading: () => <ProjectModuleSkeleton /> },
);

export async function generateStaticParams() {
  return [{ projectId: STATIC_EXPORT_PROJECT_ID, budgetItemId: STATIC_EXPORT_BUDGET_ITEM_ID }];
}

type PageProps = {
  params: Promise<{ projectId: string; budgetItemId: string }>;
};

export default async function ProjectReplenishmentItemPage({ params }: PageProps) {
  const { projectId, budgetItemId } = await params;

  return <ReplenishmentItemDetailPanel projectId={projectId} budgetItemId={budgetItemId} />;
}
