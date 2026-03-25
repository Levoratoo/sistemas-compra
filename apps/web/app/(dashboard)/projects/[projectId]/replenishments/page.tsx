import { ReplenishmentsPanel } from '@/features/replenishments/replenishments-panel';
import { STATIC_EXPORT_PROJECT_ID } from '@/lib/static-export-placeholders';

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
