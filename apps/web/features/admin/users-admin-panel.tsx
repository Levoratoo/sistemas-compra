'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Plus, Shield, SquarePen } from 'lucide-react';
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
import { listProjects } from '@/services/projects-service';
import {
  createUser,
  listUsers,
  type CreateUserPayload,
  updateUser,
  type UpdateUserPayload,
} from '@/services/users-admin-service';
import type { AuthUser, ProjectListItem, UserRole } from '@/types/api';

const emptyFormValues = {
  email: '',
  password: '',
  name: '',
  role: 'USER' as UserRole,
  isActive: true,
  releasedProjectIds: [] as string[],
};

function buildUserSchema(isEdit: boolean) {
  return z
    .object({
      email: z.string().trim().email('Informe um e-mail válido.'),
      password: z.string().optional(),
      name: z.string().trim().min(1, 'Informe o nome.'),
      role: z.enum(['ADMIN', 'USER', 'APPROVER', 'SUPERVISOR']),
      isActive: z.boolean(),
      releasedProjectIds: z.array(z.string()),
    })
    .superRefine((data, context) => {
      if (!isEdit && (!data.password || data.password.length < 8)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Senha deve ter pelo menos 8 caracteres.',
          path: ['password'],
        });
      }

      if (isEdit && data.password && data.password.length > 0 && data.password.length < 8) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Senha deve ter pelo menos 8 caracteres.',
          path: ['password'],
        });
      }
    });
}

type UserFormValues = z.infer<ReturnType<typeof buildUserSchema>>;

function releasedProjectsSummary(user: AuthUser) {
  if (user.role !== 'SUPERVISOR') {
    return '-';
  }

  if (!user.releasedProjects.length) {
    return 'Nenhum projeto liberado';
  }

  if (user.releasedProjects.length <= 2) {
    return user.releasedProjects.map((project) => project.name).join(', ');
  }

  return `${user.releasedProjects[0]?.name}, ${user.releasedProjects[1]?.name} +${user.releasedProjects.length - 2}`;
}

function normalizeUserPayload(values: UserFormValues, isEdit: boolean): CreateUserPayload | UpdateUserPayload {
  const basePayload: CreateUserPayload | UpdateUserPayload = {
    email: values.email.trim().toLowerCase(),
    name: values.name.trim(),
    role: values.role,
    isActive: values.isActive,
  };

  if (values.role === 'SUPERVISOR') {
    basePayload.releasedProjectIds = values.releasedProjectIds;
  }

  if (!isEdit || values.password) {
    basePayload.password = values.password?.trim() ?? '';
  }

  return basePayload;
}

function UserFormDialog({
  editingUser,
  onOpenChange,
  open,
  projects,
}: {
  editingUser: AuthUser | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  projects: ProjectListItem[];
}) {
  const queryClient = useQueryClient();
  const [projectSearch, setProjectSearch] = useState('');
  const isEdit = Boolean(editingUser);
  const schema = useMemo(() => buildUserSchema(isEdit), [isEdit]);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyFormValues,
  });

  useEffect(() => {
    if (!open) {
      setProjectSearch('');
      return;
    }

    if (editingUser) {
      form.reset({
        email: editingUser.email,
        password: '',
        name: editingUser.name,
        role: editingUser.role,
        isActive: editingUser.isActive,
        releasedProjectIds: editingUser.releasedProjects.map((project) => project.id),
      });
      return;
    }

    form.reset(emptyFormValues);
  }, [editingUser, form, open]);

  const createMut = useMutation({
    mutationFn: (payload: CreateUserPayload) => createUser(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Usuário criado.');
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateUserPayload }) => updateUser(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Usuário atualizado.');
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const selectedRole = form.watch('role');
  const selectedReleasedProjectIds = form.watch('releasedProjectIds') ?? [];
  const isSupervisor = selectedRole === 'SUPERVISOR';

  const filteredProjects = useMemo(() => {
    const term = projectSearch.trim().toLowerCase();
    if (!term) {
      return projects;
    }

    return projects.filter((project) => {
      const haystack = [project.name, project.code, project.organizationName].join(' ').toLowerCase();
      return haystack.includes(term);
    });
  }, [projectSearch, projects]);

  const selectedProjects = useMemo(
    () => projects.filter((project) => selectedReleasedProjectIds.includes(project.id)),
    [projects, selectedReleasedProjectIds],
  );

  function toggleReleasedProject(projectId: string) {
    const currentIds = form.getValues('releasedProjectIds') ?? [];
    const nextIds = currentIds.includes(projectId)
      ? currentIds.filter((id) => id !== projectId)
      : [...currentIds, projectId];

    form.setValue('releasedProjectIds', nextIds, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  async function onSubmit(values: UserFormValues) {
    const payload = normalizeUserPayload(values, isEdit);

    if (isEdit && editingUser) {
      await updateMut.mutateAsync({ id: editingUser.id, payload });
      return;
    }

    await createMut.mutateAsync(payload as CreateUserPayload);
  }

  const pending = createMut.isPending || updateMut.isPending;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[92vh] flex flex-col overflow-hidden p-0 sm:max-w-2xl">
        <div className="border-b border-border/60 px-6 py-5">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle>{isEdit ? 'Editar usuário' : 'Novo usuário'}</DialogTitle>
            <DialogDescription>
              Defina os dados de acesso e, para supervisoras, escolha os projetos liberados.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form className="flex flex-1 flex-col overflow-hidden" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-5 overflow-y-auto px-6 py-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" {...form.register('name')} />
                {form.formState.errors.name ? (
                  <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" {...form.register('email')} />
                {form.formState.errors.email ? (
                  <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="password">{isEdit ? 'Nova senha' : 'Senha inicial'}</Label>
                <Input id="password" type="password" {...form.register('password')} />
                <p className="text-xs text-muted-foreground">
                  {isEdit ? 'Deixe em branco para manter a senha atual.' : 'Minimo de 8 caracteres.'}
                </p>
                {form.formState.errors.password ? (
                  <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Perfil</Label>
                <Select id="role" {...form.register('role')}>
                  {userRoleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/15 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="text-sm font-medium" htmlFor="isActive">
                    Usuário ativo
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Se desativado, o login passa a ser bloqueado imediatamente.
                  </p>
                </div>
                <input
                  id="isActive"
                  checked={form.watch('isActive')}
                  className="size-4 accent-primary"
                  onChange={(event) =>
                    form.setValue('isActive', event.target.checked, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  type="checkbox"
                />
              </div>
            </div>

            {isSupervisor ? (
              <div className="space-y-4 rounded-2xl border border-border/70 bg-muted/10 p-4">
                <div className="space-y-1">
                  <Label htmlFor="released-project-search">Liberar projetos</Label>
                  <p className="text-xs text-muted-foreground">
                    Selecione os projetos que devem aparecer para esta supervisora.
                  </p>
                </div>

                <Input
                  id="released-project-search"
                  onChange={(event) => setProjectSearch(event.target.value)}
                  placeholder="Buscar projeto por nome, código ou órgão"
                  value={projectSearch}
                />

                {projects.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
                    Nenhum projeto cadastrado ainda.
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto rounded-xl border border-border/70 bg-background/80">
                    {filteredProjects.length === 0 ? (
                      <div className="px-4 py-6 text-sm text-muted-foreground">
                        Nenhum projeto encontrado para este filtro.
                      </div>
                    ) : (
                      <ul className="divide-y divide-border/60">
                        {filteredProjects.map((project) => {
                          const checked = selectedReleasedProjectIds.includes(project.id);

                          return (
                            <li key={project.id} className="px-4 py-3">
                              <label className="flex cursor-pointer items-start gap-3">
                                <input
                                  checked={checked}
                                  className="mt-1 size-4 accent-primary"
                                  onChange={() => toggleReleasedProject(project.id)}
                                  type="checkbox"
                                />
                                <span className="min-w-0">
                                  <span className="block font-medium text-foreground">{project.name}</span>
                                  <span className="block text-xs text-muted-foreground">
                                    {project.code} · {project.organizationName}
                                  </span>
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {selectedProjects.length} projeto(s) liberado(s)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedProjects.length > 0 ? (
                      selectedProjects.map((project) => (
                        <Badge key={project.id} variant="secondary">
                          {project.name}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">Nenhum projeto liberado.</span>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter className="border-t border-border/60 px-6 py-4">
            <Button onClick={() => onOpenChange(false)} type="button" variant="ghost">
              Cancelar
            </Button>
            <Button disabled={pending} type="submit">
              {pending ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar usuário'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UserRow({
  onEdit,
  user,
}: {
  onEdit: (user: AuthUser) => void;
  user: AuthUser;
}) {
  const queryClient = useQueryClient();

  const toggleMut = useMutation({
    mutationFn: (isActive: boolean) => updateUser(user.id, { isActive }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Usuário atualizado.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <TableRow>
      <TableCell className="font-medium">{user.name}</TableCell>
      <TableCell className="text-muted-foreground">{user.email}</TableCell>
      <TableCell>
        <Badge variant="secondary">{getUserRoleLabel(user.role)}</Badge>
      </TableCell>
      <TableCell className="max-w-[320px] text-sm text-muted-foreground">{releasedProjectsSummary(user)}</TableCell>
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
      <TableCell className="text-right">
        <Button onClick={() => onEdit(user)} size="sm" type="button" variant="ghost">
          <SquarePen className="size-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function UsersAdminPanel() {
  const { data: users, isLoading: isUsersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => listUsers(),
  });

  const { data: projects, isLoading: isProjectsLoading } = useQuery({
    queryKey: ['admin-user-project-options'],
    queryFn: () => listProjects(),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);

  const sortedProjects = useMemo(
    () =>
      [...(projects ?? [])].sort((left, right) =>
        `${left.name} ${left.code}`.localeCompare(`${right.name} ${right.code}`, 'pt-BR'),
      ),
    [projects],
  );

  function openCreateDialog() {
    setEditingUser(null);
    setDialogOpen(true);
  }

  function openEditDialog(user: AuthUser) {
    setEditingUser(user);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Usuários</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Perfis: <strong>Administrador</strong>, <strong>Usuário</strong>, <strong>Aprovador</strong> e{' '}
            <strong>Supervisora</strong>. Para supervisoras, o administrador libera quais projetos podem aparecer na
            carteira.
          </p>
        </div>
        <Button className="gap-2" onClick={openCreateDialog} type="button">
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
          <CardDescription>Lista de usuários e projetos liberados para cada supervisora.</CardDescription>
        </CardHeader>
        <CardContent>
          {isUsersLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Projetos liberados</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users?.map((user) => (
                    <UserRow key={user.id} onEdit={openEditDialog} user={user} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <UserFormDialog
        editingUser={editingUser}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingUser(null);
          }
        }}
        open={dialogOpen}
        projects={sortedProjects}
      />

      {isProjectsLoading ? (
        <div className="rounded-xl border border-dashed border-border/60 px-4 py-3 text-sm text-muted-foreground">
          Carregando projetos para liberacao...
        </div>
      ) : null}
    </div>
  );
}
