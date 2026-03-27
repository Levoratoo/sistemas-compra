import dynamic from 'next/dynamic';

import { ProjectModuleSkeleton } from '@/components/common/project-module-skeleton';
import { STATIC_EXPORT_PROJECT_ID } from '@/lib/static-export-placeholders';

const ProjectOverview = dynamic(
  () =>
    import('@/features/projects/project-overview').then((m) => ({
      default: m.ProjectOverview,
    })),
  { loading: () => <ProjectModuleSkeleton /> },
);

export async function generateStaticParams() {
  return [{ projectId: STATIC_EXPORT_PROJECT_ID }];
}

type ProjectPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectOverviewPage({ params }: ProjectPageProps) {
  const { projectId } = await params;

  return <ProjectOverview projectId={projectId} />;
}
