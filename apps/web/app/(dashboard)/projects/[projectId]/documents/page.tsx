import dynamic from 'next/dynamic';

import { ProjectModuleSkeleton } from '@/components/common/project-module-skeleton';
import { STATIC_EXPORT_PROJECT_ID } from '@/lib/static-export-placeholders';

const DocumentsPanel = dynamic(
  () =>
    import('@/features/documents/documents-panel').then((m) => ({
      default: m.DocumentsPanel,
    })),
  { loading: () => <ProjectModuleSkeleton /> },
);

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
