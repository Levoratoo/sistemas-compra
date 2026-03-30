'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Plus, Shield } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getUserRoleLabel, userRoleOptions } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';
import { createUser, listUsers, type CreateUserPayload, updateUser } from '@/services/users-admin-service';
import type { AuthUser, UserRole } from '@/types/api';

const createSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8, 'Mínimo 8 caracteres.'),
  name: z.string().trim().min(1),
  role: z.enum(['ADMIN', 'USER', 'APPROVER']),
});

type CreateForm = z.infer<typeof createSchema>;

export function UsersAdminPanel() {
  const queryClient = useQueryClient();
  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => listUsers(),
  });

  const [open, setOpen] = useState(false);

  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      email: '',
      password: '',
      name: '',
      role: 'USER',
    },
  });

  const createMut = useMutation({
    mutationFn: (payload: CreateUserPayload) => createUser(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Usuário criado.');
      setOpen(false);
      form.reset({ email: '', password: '', name: '', role: 'USER' });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onCreate(values: CreateForm) {
    await createMut.mutateAsync({
      email: values.email,
      password: values.password,
      name: values.name,
      role: values.role as UserRole,
      isActive: true,
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Usuários</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Perfis: <strong>Administrador</strong> (gerencia acessos), <strong>Usuário</strong> (operacional) e{' '}
            <strong>Aprovador</strong> (ex.: aprovações de itens faltantes). Apenas administradores veem esta tela.
          </p>
        </div>
        <Button className="gap-2" onClick={() => setOpen(true)} type="button">
          <Plus className="size-4" aria-hidden />
          Novo usuário
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="size-5 text-primary" aria-hidden />
            Contas cadastradas
          </CardTitle>
          <CardDescription>Lista de todos os usuários do sistema.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead>Criado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users?.map((u) => (
                    <UserRow key={u.id} user={u} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo usuário</DialogTitle>
            <DialogDescription>Defina e-mail, senha inicial e perfil de acesso.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={form.handleSubmit(onCreate)}>
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" {...form.register('name')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" {...form.register('email')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha inicial</Label>
              <Input id="password" type="password" {...form.register('password')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Perfil</Label>
              <Select id="role" {...form.register('role')}>
                {userRoleOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            <DialogFooter>
              <Button onClick={() => setOpen(false)} type="button" variant="ghost">
                Cancelar
              </Button>
              <Button disabled={createMut.isPending} type="submit">
                {createMut.isPending ? 'Salvando...' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UserRow({ user }: { user: AuthUser }) {
  const queryClient = useQueryClient();

  const toggleMut = useMutation({
    mutationFn: (isActive: boolean) => updateUser(user.id, { isActive }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Usuário atualizado.');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <TableRow>
      <TableCell className="font-medium">{user.name}</TableCell>
      <TableCell className="text-muted-foreground">{user.email}</TableCell>
      <TableCell>
        <Badge variant="secondary">{getUserRoleLabel(user.role)}</Badge>
      </TableCell>
      <TableCell>
        <Button
          disabled={toggleMut.isPending}
          onClick={() => toggleMut.mutate(!user.isActive)}
          size="sm"
          type="button"
          variant={user.isActive ? 'outline' : 'secondary'}
        >
          {user.isActive ? 'Desativar' : 'Ativar'}
        </Button>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{formatDateTime(user.createdAt)}</TableCell>
    </TableRow>
  );
}
