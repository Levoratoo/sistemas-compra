import { RolesPanel } from '@/features/roles/roles-panel';

type ProjectPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectRolesPage({ params }: ProjectPageProps) {
  const { projectId } = await params;

  return <RolesPanel projectId={projectId} />;
}
