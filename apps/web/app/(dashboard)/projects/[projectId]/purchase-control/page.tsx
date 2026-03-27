import dynamic from 'next/dynamic';

import { ProjectModuleSkeleton } from '@/components/common/project-module-skeleton';
import { STATIC_EXPORT_PROJECT_ID } from '@/lib/static-export-placeholders';

const PurchaseControlPanel = dynamic(
  () =>
    import('@/features/purchase-control/purchase-control-panel').then((m) => ({
      default: m.PurchaseControlPanel,
    })),
  { loading: () => <ProjectModuleSkeleton /> },
);

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
