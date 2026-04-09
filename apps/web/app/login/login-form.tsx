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
import { getApiBaseUrl } from '@/services/api-client';

const schema = z.object({
  email: z.string().trim().email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe a senha.'),
});

type FormValues = z.infer<typeof schema>;

const demoCredentials = [
  {
    label: 'Administrador',
    email: 'admin@sitecompras.local',
    password: 'Admin@123',
  },
  {
    label: 'Usuario operacional',
    email: 'usuario@sitecompras.local',
    password: 'Usuario@123',
  },
  {
    label: 'Aprovador',
    email: 'aprovador@sitecompras.local',
    password: 'Aprovador@123',
  },
  {
    label: 'Supervisora',
    email: 'supervisora@sitecompras.local',
    password: 'Supervisora@123',
  },
] as const;

function isLocalDemoCredentialsTarget(apiBaseUrl: string) {
  try {
    const { hostname } = new URL(apiBaseUrl);

    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return true;
    }

    if (hostname.endsWith('.local')) {
      return true;
    }

    if (/^10\.\d+\.\d+\.\d+$/.test(hostname)) {
      return true;
    }

    if (/^192\.168\.\d+\.\d+$/.test(hostname)) {
      return true;
    }

    const private172 = /^172\.(\d+)\.\d+\.\d+$/.exec(hostname);
    if (private172) {
      const secondOctet = Number(private172[1]);
      return secondOctet >= 16 && secondOctet <= 31;
    }

    return false;
  } catch {
    return false;
  }
}

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
  const showDemoCredentials = isLocalDemoCredentialsTarget(getApiBaseUrl());

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
      <CardContent className="space-y-6">
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
        {showDemoCredentials ? (
          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Credenciais de acesso</p>
              <p className="text-xs text-muted-foreground">
                Perfis demo disponiveis para entrar rapidamente neste ambiente local.
              </p>
            </div>
            <div className="mt-3 space-y-3">
              {demoCredentials.map((credential) => (
                <div
                  key={credential.email}
                  className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-background/90 p-3"
                >
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-foreground">{credential.label}</p>
                    <p className="text-xs text-muted-foreground">
                      E-mail:{' '}
                      <span className="font-mono text-foreground">{credential.email}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Senha:{' '}
                      <span className="font-mono text-foreground">{credential.password}</span>
                    </p>
                  </div>
                  <Button
                    className="shrink-0"
                    onClick={() => {
                      form.setValue('email', credential.email, { shouldDirty: true, shouldValidate: true });
                      form.setValue('password', credential.password, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                      form.clearErrors();
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Usar
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 text-xs text-muted-foreground">
            Este ambiente usa usuarios reais cadastrados pelo administrador. As credenciais demo aparecem apenas
            quando a tela esta ligada a uma API local de desenvolvimento.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
