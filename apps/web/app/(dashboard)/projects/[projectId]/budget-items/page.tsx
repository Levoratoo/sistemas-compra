import { BudgetItemsPanel } from '@/features/budget-items/budget-items-panel';
import { STATIC_EXPORT_PROJECT_ID } from '@/lib/static-export-placeholders';

export async function generateStaticParams() {
  return [{ projectId: STATIC_EXPORT_PROJECT_ID }];
}

type ProjectPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectBudgetItemsPage({ params }: ProjectPageProps) {
  const { projectId } = await params;

  return <BudgetItemsPanel projectId={projectId} />;
}
