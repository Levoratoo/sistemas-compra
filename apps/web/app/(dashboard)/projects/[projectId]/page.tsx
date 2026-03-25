import { ProjectOverview } from '@/features/projects/project-overview';

type ProjectPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectOverviewPage({ params }: ProjectPageProps) {
  const { projectId } = await params;

  return <ProjectOverview projectId={projectId} />;
}
