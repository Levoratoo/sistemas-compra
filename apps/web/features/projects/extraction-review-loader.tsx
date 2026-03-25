'use client';

import dynamic from 'next/dynamic';

import { Skeleton } from '@/components/ui/skeleton';

const ExtractionReviewPage = dynamic(() => import('@/features/projects/extraction-review-page'), {
  ssr: false,
  loading: () => (
    <div className="space-y-6">
      <Skeleton className="h-10 w-2/3 max-w-md" />
      <Skeleton className="h-64 w-full" />
    </div>
  ),
});

type Props = {
  projectId: string;
  documentId: string;
};

export function ExtractionReviewLoader({ projectId, documentId }: Props) {
  return <ExtractionReviewPage documentId={documentId} projectId={projectId} />;
}
