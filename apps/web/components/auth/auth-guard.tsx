'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { Skeleton } from '@/components/ui/skeleton';
import { getRestrictedPathRedirect } from '@/lib/role-access';

import { useAuth } from './auth-context';

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const restrictedRedirect = user ? getRestrictedPathRedirect(user.role, pathname) : null;

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      const next = pathname ? `?next=${encodeURIComponent(pathname)}` : '';
      router.replace(`/login${next}`);
      return;
    }

    if (restrictedRedirect) {
      router.replace(restrictedRedirect);
    }
  }, [user, isLoading, router, pathname, restrictedRedirect]);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full max-w-md rounded-2xl" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (restrictedRedirect) {
    return null;
  }

  return <>{children}</>;
}
