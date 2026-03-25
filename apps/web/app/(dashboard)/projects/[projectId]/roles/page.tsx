import { RolesPanel } from '@/features/roles/roles-panel';
import { STATIC_EXPORT_PROJECT_ID } from '@/lib/static-export-placeholders';

export async function generateStaticParams() {
  return [{ projectId: STATIC_EXPORT_PROJECT_ID }];
}

type ProjectPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectRolesPage({ params }: ProjectPageProps) {
  const { projectId } = await params;

  return <RolesPanel projectId={projectId} />;
}
