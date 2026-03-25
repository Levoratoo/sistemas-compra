import { ExtractionReviewLoader } from '@/features/projects/extraction-review-loader';

type PageProps = {
  params: Promise<{ projectId: string; documentId: string }>;
};

export default async function ProjectDocumentExtractionReviewPage({ params }: PageProps) {
  const { projectId, documentId } = await params;

  return <ExtractionReviewLoader documentId={documentId} projectId={projectId} />;
}
