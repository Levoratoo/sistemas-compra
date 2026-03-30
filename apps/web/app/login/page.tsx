import { Suspense } from 'react';

import { LoginForm } from '@/app/login/login-form';
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-muted/40 to-background px-4 py-12">
      <Suspense fallback={<LoginFallback />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
