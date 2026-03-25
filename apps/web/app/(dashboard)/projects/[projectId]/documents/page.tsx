import { DocumentsPanel } from '@/features/documents/documents-panel';

type ProjectPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectDocumentsPage({ params }: ProjectPageProps) {
  const { projectId } = await params;

  return <DocumentsPanel projectId={projectId} />;
}
