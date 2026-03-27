import dynamic from 'next/dynamic';

import { ProjectModuleSkeleton } from '@/components/common/project-module-skeleton';
import { STATIC_EXPORT_PROJECT_ID } from '@/lib/static-export-placeholders';

const PurchasesPanel = dynamic(
  () =>
    import('@/features/purchases/purchases-panel').then((m) => ({
      default: m.PurchasesPanel,
    })),
  { loading: () => <ProjectModuleSkeleton /> },
);

export async function generateStaticParams() {
  return [{ projectId: STATIC_EXPORT_PROJECT_ID }];
}

type ProjectPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectPurchasesPage({ params }: ProjectPageProps) {
  const { projectId } = await params;

  return <PurchasesPanel projectId={projectId} />;
}
