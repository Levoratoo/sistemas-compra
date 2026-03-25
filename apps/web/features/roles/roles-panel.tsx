'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Plus, SquarePen, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/common/empty-state';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useProjectRolesMutations, useProjectRolesQuery } from '@/hooks/use-roles';
import type { ProjectRole } from '@/types/api';

const formSchema = z.object({
  roleName: z.string().trim().min(1, 'Informe o cargo.'),
  workRegime: z.string().trim().optional(),
  workloadLabel: z.string().trim().optional(),
  allocationSector: z.string().trim().optional(),
  plannedPositions: z.coerce.number().int().nonnegative().optional(),
  employeesPerPosition: z.coerce.number().int().nonnegative().optional(),
  plannedHeadcount: z.coerce.number().int().nonnegative(),
  notes: z.string().trim().optional(),
});

type FormValues = z.input<typeof formSchema>;
type FormSubmitValues = z.output<typeof formSchema>;

function RoleDialog({
  open,
  onOpenChange,
  projectId,
  role,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  role?: ProjectRole | null;
}) {
  const { createRole, updateRole } = useProjectRolesMutations(projectId);
  const form = useForm<FormValues, undefined, FormSubmitValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      roleName: role?.roleName ?? '',
      workRegime: role?.workRegime ?? '',
      workloadLabel: role?.workloadLabel ?? '',
      allocationSector: role?.allocationSector ?? '',
      plannedPositions: role?.plannedPositions ?? 0,
      employeesPerPosition: role?.employeesPerPosition ?? 1,
      plannedHeadcount: role?.plannedHeadcount ?? 0,
      notes: role?.notes ?? '',
    },
  });

  useEffect(() => {
    form.reset({
      roleName: role?.roleName ?? '',
      workRegime: role?.workRegime ?? '',
      workloadLabel: role?.workloadLabel ?? '',
      allocationSector: role?.allocationSector ?? '',
      plannedPositions: role?.plannedPositions ?? 0,
      employeesPerPosition: role?.employeesPerPosition ?? 1,
      plannedHeadcount: role?.plannedHeadcount ?? 0,
      notes: role?.notes ?? '',
    });
  }, [form, role]);

  async function onSubmit(values: FormSubmitValues) {
    try {
      if (role) {
        await updateRole.mutateAsync({
          id: role.id,
          payload: values,
        });
        toast.success('Cargo atualizado.');
      } else {
        await createRole.mutateAsync(values);
        toast.success('Cargo criado.');
      }

      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar o cargo.';
      toast.error(message);
    }
  }

  const submitting = createRole.isPending || updateRole.isPending;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{role ? 'Editar cargo' : 'Novo cargo'}</DialogTitle>
          <DialogDescription>Registre postos, jornadas e quantitativos previstos.</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="roleName">Cargo</Label>
              <Input id="roleName" {...form.register('roleName')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workRegime">Regime</Label>
              <Input id="workRegime" {...form.register('workRegime')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workloadLabel">Jornada</Label>
              <Input id="workloadLabel" {...form.register('workloadLabel')} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="allocationSector">Lotação</Label>
              <Input id="allocationSector" {...form.register('allocationSector')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plannedPositions">Postos</Label>
              <Input id="plannedPositions" type="number" {...form.register('plannedPositions')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="employeesPerPosition">Colaboradores por posto</Label>
              <Input id="employeesPerPosition" type="number" {...form.register('employeesPerPosition')} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="plannedHeadcount">Total planejado</Label>
              <Input id="plannedHeadcount" type="number" {...form.register('plannedHeadcount')} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea id="notes" {...form.register('notes')} />
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} type="button" variant="ghost">
              Cancelar
            </Button>
            <Button disabled={submitting} type="submit">
              {submitting ? 'Salvando...' : role ? 'Salvar alterações' : 'Criar cargo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RolesPanel({ projectId }: { projectId: string }) {
  const { data, isLoading, isError } = useProjectRolesQuery(projectId);
  const { deleteRole } = useProjectRolesMutations(projectId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<ProjectRole | null>(null);

  async function handleDelete(roleId: string) {
    const confirmed = window.confirm('Deseja excluir este cargo?');

    if (!confirmed) {
      return;
    }

    try {
      await deleteRole.mutateAsync(roleId);
      toast.success('Cargo excluído.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível excluir o cargo.';
      toast.error(message);
    }
  }

  return (
    <div className="page-sections">
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle>Cargos do projeto</CardTitle>
            <CardDescription>Controle básico dos papéis, lotações e quantitativos previstos.</CardDescription>
          </div>
          <Button
            onClick={() => {
              setEditingRole(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            Novo cargo
          </Button>
        </CardHeader>
      </Card>

      {isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-20" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState description="Erro ao carregar os cargos do projeto." title="Falha na consulta de cargos" />
      ) : !data || data.length === 0 ? (
        <EmptyState
          actionLabel="Cadastrar cargo"
          description="Adicione os cargos previstos para iniciar a estrutura operacional."
          onAction={() => {
            setEditingRole(null);
            setDialogOpen(true);
          }}
          title="Nenhum cargo cadastrado"
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow variant="header">
                  <TableHead>Cargo</TableHead>
                  <TableHead>Regime</TableHead>
                  <TableHead>Jornada</TableHead>
                  <TableHead>Lotação</TableHead>
                  <TableHead>Postos</TableHead>
                  <TableHead>Colaboradores</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-semibold">{role.roleName}</TableCell>
                    <TableCell>{role.workRegime || '-'}</TableCell>
                    <TableCell>{role.workloadLabel || '-'}</TableCell>
                    <TableCell>{role.allocationSector || '-'}</TableCell>
                    <TableCell>{role.plannedPositions ?? '-'}</TableCell>
                    <TableCell>{role.plannedHeadcount}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          onClick={() => {
                            setEditingRole(role);
                            setDialogOpen(true);
                          }}
                          size="sm"
                          variant="ghost"
                        >
                          <SquarePen className="size-4" />
                        </Button>
                        <Button onClick={() => handleDelete(role.id)} size="sm" variant="ghost">
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <RoleDialog onOpenChange={setDialogOpen} open={dialogOpen} projectId={projectId} role={editingRole} />
    </div>
  );
}
