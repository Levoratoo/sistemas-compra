import { PurchasesPanel } from '@/features/purchases/purchases-panel';

type ProjectPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectPurchasesPage({ params }: ProjectPageProps) {
  const { projectId } = await params;

  return <PurchasesPanel projectId={projectId} />;
}
