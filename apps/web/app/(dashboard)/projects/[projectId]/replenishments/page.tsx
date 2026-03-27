import dynamic from 'next/dynamic';

import { ProjectModuleSkeleton } from '@/components/common/project-module-skeleton';
import { STATIC_EXPORT_PROJECT_ID } from '@/lib/static-export-placeholders';

const ReplenishmentsPanel = dynamic(
  () =>
    import('@/features/replenishments/replenishments-panel').then((m) => ({
      default: m.ReplenishmentsPanel,
    })),
  { loading: () => <ProjectModuleSkeleton /> },
);

export async function generateStaticParams() {
  return [{ projectId: STATIC_EXPORT_PROJECT_ID }];
}

type ProjectPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectReplenishmentsPage({ params }: ProjectPageProps) {
  const { projectId } = await params;

  return <ReplenishmentsPanel projectId={projectId} />;
}
