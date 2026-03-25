import { ReplenishmentsPanel } from '@/features/replenishments/replenishments-panel';

type ProjectPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectReplenishmentsPage({ params }: ProjectPageProps) {
  const { projectId } = await params;

  return <ReplenishmentsPanel projectId={projectId} />;
}
