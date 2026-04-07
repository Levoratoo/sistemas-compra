import { Suspense } from 'react';

import { LoginForm } from '@/app/login/login-form';
import { FloatingBackdrop } from '@/components/common/floating-backdrop';
import { Skeleton } from '@/components/ui/skeleton';

function LoginFallback() {
  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <Skeleton className="mx-auto h-10 w-48" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-muted/40 to-background px-4 py-12">
      <FloatingBackdrop />
      <div className="relative z-10 w-full max-w-md">
        <Suspense fallback={<LoginFallback />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
