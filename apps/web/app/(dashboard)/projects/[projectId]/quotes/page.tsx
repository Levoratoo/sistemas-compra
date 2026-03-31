import dynamic from 'next/dynamic';

import { ProjectModuleSkeleton } from '@/components/common/project-module-skeleton';
import { STATIC_EXPORT_PROJECT_ID } from '@/lib/static-export-placeholders';

const QuotesPanel = dynamic(
  () =>
    import('@/features/quotes/quotes-panel').then((module) => ({
      default: module.QuotesPanel,
    })),
  { loading: () => <ProjectModuleSkeleton /> },
);

export async function generateStaticParams() {
  return [{ projectId: STATIC_EXPORT_PROJECT_ID }];
}

type QuotesPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectQuotesPage({ params }: QuotesPageProps) {
  const { projectId } = await params;

  return <QuotesPanel projectId={projectId} />;
}
