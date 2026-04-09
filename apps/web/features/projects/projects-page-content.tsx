'use client';

import Link from 'next/link';
import { useDeferredValue, useMemo, useState } from 'react';
import { Plus, Search, SquarePen, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/components/auth/auth-context';
import { EmptyState } from '@/components/common/empty-state';
import { ImplementationStatusBadge, ProjectStatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDate } from '@/lib/format';
import { projectStatusOptions } from '@/lib/constants';
import { useProjectMutations, useProjectsQuery } from '@/hooks/use-projects';
import type { ProjectListItem, ProjectStatus } from '@/types/api';

import { NewProjectFlowDialog } from './new-project-flow-dialog';
import { ProjectFormDialog } from './project-form-dialog';

const supervisorOpenStatuses: ProjectStatus[] = ['DRAFT', 'PLANNED', 'ACTIVE', 'ON_HOLD'];

export function ProjectsPageContent() {
  const { user } = useAuth();
  const isSupervisor = user?.role === 'SUPERVISOR';
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [status, setStatus] = useState<ProjectStatus | ''>('');
  const [flowOpen, setFlowOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectListItem | null>(null);
  const { data, isLoading, isError } = useProjectsQuery({
    search: deferredSearch || undefined,
    projectStatus: status || undefined,
  });
  const { deleteProject } = useProjectMutations();

  const statusOptions = useMemo(
    () =>
      isSupervisor
        ? projectStatusOptions.filter((option) => supervisorOpenStatuses.includes(option.value))
        : projectStatusOptions,
    [isSupervisor],
  );

  const projects = useMemo(() => {
    const projectList = data ?? [];

    if (!isSupervisor) {
      return projectList;
    }

    return projectList.filter((project) => supervisorOpenStatuses.includes(project.projectStatus));
  }, [data, isSupervisor]);

  async function handleDelete(projectId: string) {
    const confirmed = window.confirm('Deseja excluir este projeto?');

    if (!confirmed) {
      return;
    }

    try {
      await deleteProject.mutateAsync(projectId);
      toast.success('Projeto removido com sucesso.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível excluir o projeto. Tente novamente.';
      toast.error(message);
    }
  }

  return (
    <div className="page-sections">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm font-medium leading-relaxed text-muted-foreground">
          {isSupervisor
            ? 'Consulte a carteira e abra diretamente o relatório de itens faltantes de cada projeto.'
            : 'Cadastre contratos, filtre a carteira e acesse compras, documentos e reposições por projeto.'}
        </p>
        {!isSupervisor ? (
          <Button
            className="shrink-0 shadow-glow"
            onClick={() => {
              setEditingProject(null);
              setFlowOpen(true);
            }}
            size="lg"
          >
            <Plus className="size-4" />
            Novo projeto
          </Button>
        ) : null}
      </div>

      <Card>
        <CardContent className="grid gap-4 p-6 md:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-10"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, código, órgão ou pregão"
              value={search}
            />
          </div>
          <Select onChange={(event) => setStatus(event.target.value as ProjectStatus | '')} value={status}>
            <option value="">{isSupervisor ? 'Todos os projetos abertos' : 'Todos os status'}</option>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : isError ? (
        <EmptyState
          description="Verifique se a API está rodando e tente novamente."
          title="Não foi possível carregar os projetos"
        />
      ) : projects.length === 0 ? (
        <EmptyState
          actionLabel={isSupervisor ? undefined : 'Criar primeiro projeto'}
          description={
            isSupervisor
              ? 'Nenhum projeto aberto encontrado com os filtros atuais.'
              : 'Comece cadastrando um contrato para acompanhar compras, orçamento e reposições em um só lugar.'
          }
          onAction={
            isSupervisor
              ? undefined
              : () => {
                  setEditingProject(null);
                  setFlowOpen(true);
                }
          }
          title={isSupervisor ? 'Nenhum projeto aberto encontrado' : 'Nenhum projeto encontrado'}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow variant="header">
                  <TableHead>Projeto</TableHead>
                  <TableHead>Órgão</TableHead>
                  <TableHead>Pregão</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Implantação</TableHead>
                  <TableHead>Início previsto</TableHead>
                  <TableHead className="text-right">Valor mensal</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="max-w-[240px]">
                      <div>
                        <p className="font-semibold text-foreground">{project.name}</p>
                        <p className="text-xs font-medium text-muted-foreground">{project.code}</p>
                      </div>
                    </TableCell>
                    <TableCell>{project.organizationName}</TableCell>
                    <TableCell>{project.bidNumber || '-'}</TableCell>
                    <TableCell>{project.contractNumber || '-'}</TableCell>
                    <TableCell>
                      <ProjectStatusBadge value={project.projectStatus} />
                    </TableCell>
                    <TableCell>
                      <ImplementationStatusBadge value={project.implementationStatus} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(project.plannedStartDate)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{formatCurrency(project.monthlyContractValue)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link href={isSupervisor ? `/projects/${project.id}/missing-items` : `/projects/${project.id}`}>
                            {isSupervisor ? 'Abrir relatório' : 'Abrir'}
                          </Link>
                        </Button>
                        {!isSupervisor ? (
                          <>
                            <Button
                              onClick={() => {
                                setEditingProject(project);
                                setDialogOpen(true);
                              }}
                              size="sm"
                              variant="ghost"
                            >
                              <SquarePen className="size-4" />
                            </Button>
                            <Button onClick={() => handleDelete(project.id)} size="sm" variant="ghost">
                              <Trash2 className="size-4" />
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {!isSupervisor ? (
        <>
          <NewProjectFlowDialog
            onOpenChange={setFlowOpen}
            onOpenManualForm={() => {
              setEditingProject(null);
              setDialogOpen(true);
            }}
            open={flowOpen}
          />

          <ProjectFormDialog
            onOpenChange={setDialogOpen}
            open={dialogOpen}
            project={editingProject}
          />
        </>
      ) : null}
    </div>
  );
}
