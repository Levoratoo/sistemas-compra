import { ProjectOverview } from '@/features/projects/project-overview';
import { STATIC_EXPORT_PROJECT_ID } from '@/lib/static-export-placeholders';

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
