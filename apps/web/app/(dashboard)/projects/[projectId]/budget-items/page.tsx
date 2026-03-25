import { BudgetItemsPanel } from '@/features/budget-items/budget-items-panel';

type ProjectPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectBudgetItemsPage({ params }: ProjectPageProps) {
  const { projectId } = await params;

  return <BudgetItemsPanel projectId={projectId} />;
}
