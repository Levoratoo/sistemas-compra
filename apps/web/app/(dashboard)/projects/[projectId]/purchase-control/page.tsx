import { PurchaseControlPanel } from '@/features/purchase-control/purchase-control-panel';

type PageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function PurchaseControlPage({ params }: PageProps) {
  const { projectId } = await params;
  return <PurchaseControlPanel projectId={projectId} />;
}
