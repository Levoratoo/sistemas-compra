import { ExtractionReviewLoader } from '@/features/projects/extraction-review-loader';
import {
  STATIC_EXPORT_DOCUMENT_ID,
  STATIC_EXPORT_PROJECT_ID,
} from '@/lib/static-export-placeholders';

export async function generateStaticParams() {
  return [{ projectId: STATIC_EXPORT_PROJECT_ID, documentId: STATIC_EXPORT_DOCUMENT_ID }];
}

type PageProps = {
  params: Promise<{ projectId: string; documentId: string }>;
};

export default async function ProjectDocumentExtractionReviewPage({ params }: PageProps) {
  const { projectId, documentId } = await params;

  return <ExtractionReviewLoader documentId={documentId} projectId={projectId} />;
}
