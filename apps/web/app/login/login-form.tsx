'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { LogIn } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/components/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { getDefaultPathForRole } from '@/lib/role-access';

const schema = z.object({
  email: z.string().trim().email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe a senha.'),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, user } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const nextPath = searchParams.get('next');
  const redirectPath = nextPath?.startsWith('/') ? nextPath : getDefaultPathForRole(user?.role);

  useEffect(() => {
    if (user) {
      router.replace(redirectPath);
    }
  }, [user, router, redirectPath]);

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const authenticatedUser = await login(values.email, values.password);
      toast.success('Login realizado.');
      router.replace(nextPath?.startsWith('/') ? nextPath : getDefaultPathForRole(authenticatedUser.role));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível entrar.');
    } finally {
      setSubmitting(false);
    }
  }

  if (user) {
    return <Skeleton className="h-64 w-full max-w-md rounded-2xl" />;
  }

  return (
    <Card className="w-full max-w-md border-border/80 shadow-xl">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="font-heading text-2xl">Entrar</CardTitle>
        <CardDescription>Use o e-mail e a senha fornecidos pelo administrador.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              autoComplete="email"
              id="email"
              inputMode="email"
              placeholder="nome@empresa.com"
              type="email"
              {...form.register('email')}
            />
            {form.formState.errors.email ? (
              <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input autoComplete="current-password" id="password" type="password" {...form.register('password')} />
            {form.formState.errors.password ? (
              <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
            ) : null}
          </div>
          <Button className="w-full gap-2" disabled={submitting} type="submit">
            <LogIn className="size-4" aria-hidden />
            {submitting ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
