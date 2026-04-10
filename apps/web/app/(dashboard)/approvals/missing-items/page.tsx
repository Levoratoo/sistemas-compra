import dynamic from 'next/dynamic';

import { RoleGuard } from '@/components/auth/role-guard';
import { ProjectModuleSkeleton } from '@/components/common/project-module-skeleton';

const PendingMissingItemsApprovalsPanel = dynamic(
  () =>
    import('@/features/missing-items/pending-missing-items-approvals-panel').then((m) => ({
      default: m.PendingMissingItemsApprovalsPanel,
    })),
  { loading: () => <ProjectModuleSkeleton /> },
);

export default function ApprovalsMissingItemsPage() {
  return (
    <RoleGuard roles={['APPROVER', 'ADMIN']}>
      <PendingMissingItemsApprovalsPanel />
    </RoleGuard>
  );
}
