'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import { implementationStatusOptions, projectStatusOptions } from '@/lib/constants';
import { toDateInputValue } from '@/lib/format';
import { useProjectMutations } from '@/hooks/use-projects';
import type { Project, ProjectStatus, ImplementationStatus } from '@/types/api';

const formSchema = z.object({
  code: z.string().trim().min(1, 'Informe o código do projeto.'),
  name: z.string().trim().min(1, 'Informe o nome do projeto.'),
  organizationName: z.string().trim().min(1, 'Informe o órgão.'),
  procurementProcessNumber: z.string().trim().optional(),
  bidNumber: z.string().trim().optional(),
  contractNumber: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  objectSummary: z.string().trim().optional(),
  projectStatus: z.string().default('DRAFT'),
  implementationStatus: z.string().default('NOT_STARTED'),
  plannedSignatureDate: z.string().optional(),
  plannedStartDate: z.string().optional(),
  actualStartDate: z.string().optional(),
  contractDurationMonths: z.coerce.number().int().positive().max(120).default(12),
  monthlyContractValue: z.union([z.coerce.number().nonnegative(), z.nan()]).optional(),
  notes: z.string().trim().optional(),
});

type FormValues = z.input<typeof formSchema>;
type FormSubmitValues = z.output<typeof formSchema>;

function getDefaultValues(project?: Project | null): FormValues {
  return {
    code: project?.code ?? '',
    name: project?.name ?? '',
    organizationName: project?.organizationName ?? '',
    procurementProcessNumber: project?.procurementProcessNumber ?? '',
    bidNumber: project?.bidNumber ?? '',
    contractNumber: project?.contractNumber ?? '',
    city: project?.city ?? '',
    state: project?.state ?? '',
    objectSummary: project?.objectSummary ?? '',
    projectStatus: project?.projectStatus ?? 'DRAFT',
    implementationStatus: project?.implementationStatus ?? 'NOT_STARTED',
    plannedSignatureDate: toDateInputValue(project?.plannedSignatureDate),
    plannedStartDate: toDateInputValue(project?.plannedStartDate),
    actualStartDate: toDateInputValue(project?.actualStartDate),
    contractDurationMonths: project?.contractDurationMonths ?? 12,
    monthlyContractValue: project?.monthlyContractValue ?? Number.NaN,
    notes: project?.notes ?? '',
  };
}

function normalizeDate(value?: string) {
  return value ? `${value}T00:00:00.000Z` : null;
}

function normalizePayload(values: FormSubmitValues) {
  return {
    code: values.code,
    name: values.name,
    organizationName: values.organizationName,
    procurementProcessNumber: values.procurementProcessNumber || null,
    bidNumber: values.bidNumber || null,
    contractNumber: values.contractNumber || null,
    city: values.city || null,
    state: values.state || null,
    objectSummary: values.objectSummary || null,
    projectStatus: values.projectStatus as ProjectStatus,
    implementationStatus: values.implementationStatus as ImplementationStatus,
    plannedSignatureDate: normalizeDate(values.plannedSignatureDate),
    plannedStartDate: normalizeDate(values.plannedStartDate),
    actualStartDate: normalizeDate(values.actualStartDate),
    contractDurationMonths: values.contractDurationMonths,
    monthlyContractValue: Number.isNaN(values.monthlyContractValue) ? null : values.monthlyContractValue,
    notes: values.notes || null,
  };
}

export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project | null;
}) {
  const { createProject, updateProject } = useProjectMutations(project?.id);
  const isEditing = Boolean(project);
  const form = useForm<FormValues, undefined, FormSubmitValues>({
    resolver: zodResolver(formSchema),
    defaultValues: getDefaultValues(project),
  });

  useEffect(() => {
    form.reset(getDefaultValues(project));
  }, [form, project]);

  async function onSubmit(values: FormSubmitValues) {
    try {
      if (isEditing && project) {
        await updateProject.mutateAsync({
          id: project.id,
          payload: normalizePayload(values),
        });
        toast.success('Projeto atualizado com sucesso.');
      } else {
        await createProject.mutateAsync(normalizePayload(values));
        toast.success('Projeto criado com sucesso.');
      }

      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar o projeto. Tente novamente.';
      toast.error(message);
    }
  }

  const submitting = createProject.isPending || updateProject.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar projeto' : 'Novo projeto'}</DialogTitle>
          <DialogDescription>
            Cadastre os dados principais do contrato para começar a gestão operacional.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="code">Código</Label>
              <Input id="code" {...form.register('code')} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="name">Nome do projeto</Label>
              <Input id="name" {...form.register('name')} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="organizationName">Órgão</Label>
              <Input id="organizationName" {...form.register('organizationName')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Cidade</Label>
              <Input id="city" {...form.register('city')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="procurementProcessNumber">Processo</Label>
              <Input id="procurementProcessNumber" {...form.register('procurementProcessNumber')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bidNumber">Pregão</Label>
              <Input id="bidNumber" {...form.register('bidNumber')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contractNumber">Contrato</Label>
              <Input id="contractNumber" {...form.register('contractNumber')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">UF</Label>
              <Input id="state" maxLength={2} {...form.register('state')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="projectStatus">Status do projeto</Label>
              <Select id="projectStatus" {...form.register('projectStatus')}>
                {projectStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="implementationStatus">Implantação</Label>
              <Select id="implementationStatus" {...form.register('implementationStatus')}>
                {implementationStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contractDurationMonths">Duração (meses)</Label>
              <Input id="contractDurationMonths" type="number" {...form.register('contractDurationMonths')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthlyContractValue">Valor mensal</Label>
              <Input id="monthlyContractValue" type="number" step="0.01" {...form.register('monthlyContractValue')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plannedSignatureDate">Assinatura prevista</Label>
              <Input id="plannedSignatureDate" type="date" {...form.register('plannedSignatureDate')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plannedStartDate">Início previsto</Label>
              <Input id="plannedStartDate" type="date" {...form.register('plannedStartDate')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="actualStartDate">Início real</Label>
              <Input id="actualStartDate" type="date" {...form.register('actualStartDate')} />
            </div>
            <div className="space-y-2 md:col-span-3">
              <Label htmlFor="objectSummary">Resumo do objeto</Label>
              <Textarea id="objectSummary" {...form.register('objectSummary')} />
            </div>
            <div className="space-y-2 md:col-span-3">
              <Label htmlFor="notes">Observações</Label>
              <Textarea id="notes" {...form.register('notes')} />
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} type="button" variant="ghost">
              Cancelar
            </Button>
            <Button disabled={submitting} type="submit">
              {submitting ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Criar projeto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
