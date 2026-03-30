import dynamic from 'next/dynamic';

import { RoleGuard } from '@/components/auth/role-guard';
import { ProjectModuleSkeleton } from '@/components/common/project-module-skeleton';

const UsersAdminPanel = dynamic(
  () => import('@/features/admin/users-admin-panel').then((m) => ({ default: m.UsersAdminPanel })),
  { loading: () => <ProjectModuleSkeleton /> },
);

export default function AdminUsersPage() {
  return (
    <RoleGuard roles={['ADMIN']}>
      <UsersAdminPanel />
    </RoleGuard>
  );
}
