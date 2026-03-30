'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { Skeleton } from '@/components/ui/skeleton';
import type { UserRole } from '@/types/api';

import { useAuth } from './auth-context';

export function RoleGuard({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (!user || !roles.includes(user.role)) {
      router.replace('/');
    }
  }, [user, isLoading, roles, router]);

  if (isLoading) {
    return (
      <div className="space-y-4 py-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!user || !roles.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}
