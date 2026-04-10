import dynamic from 'next/dynamic';

import { RoleGuard } from '@/components/auth/role-guard';
import { ProjectModuleSkeleton } from '@/components/common/project-module-skeleton';
import { STATIC_EXPORT_PROJECT_ID } from '@/lib/static-export-placeholders';

const PendingMissingItemsApprovalsPanel = dynamic(
  () =>
    import('@/features/missing-items/pending-missing-items-approvals-panel').then((m) => ({
      default: m.PendingMissingItemsApprovalsPanel,
    })),
  { loading: () => <ProjectModuleSkeleton /> },
);

export async function generateStaticParams() {
  return [{ projectId: STATIC_EXPORT_PROJECT_ID }];
}

type ProjectPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectApprovalPage({ params }: ProjectPageProps) {
  const { projectId } = await params;

  return (
    <RoleGuard roles={['APPROVER', 'ADMIN']}>
      <PendingMissingItemsApprovalsPanel scopeProjectId={projectId} />
    </RoleGuard>
  );
}
