import { DocumentsPanel } from '@/features/documents/documents-panel';
import { STATIC_EXPORT_PROJECT_ID } from '@/lib/static-export-placeholders';

export async function generateStaticParams() {
  return [{ projectId: STATIC_EXPORT_PROJECT_ID }];
}

type ProjectPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectDocumentsPage({ params }: ProjectPageProps) {
  const { projectId } = await params;

  return <DocumentsPanel projectId={projectId} />;
}
