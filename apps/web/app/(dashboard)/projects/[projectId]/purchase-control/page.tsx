import { PurchaseControlPanel } from '@/features/purchase-control/purchase-control-panel';
import { STATIC_EXPORT_PROJECT_ID } from '@/lib/static-export-placeholders';

export async function generateStaticParams() {
  return [{ projectId: STATIC_EXPORT_PROJECT_ID }];
}

type PageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function PurchaseControlPage({ params }: PageProps) {
  const { projectId } = await params;
  return <PurchaseControlPanel projectId={projectId} />;
}
