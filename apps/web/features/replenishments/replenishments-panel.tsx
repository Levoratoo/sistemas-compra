'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { CalendarClock, CirclePlus } from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/common/empty-state';
import { ReplenishmentStatusBadge } from '@/components/common/status-badge';
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
import { Textarea } from '@/components/ui/textarea';
import { intervalUnitOptions, replenishmentTriggerOptions } from '@/lib/constants';
import { formatDate, formatDateTime } from '@/lib/format';
import { useBudgetItemsQuery } from '@/hooks/use-budget-items';
import { useReplenishmentsMutations, useReplenishmentsQuery } from '@/hooks/use-replenishments';
import type { ReplenishmentRule } from '@/types/api';

const formSchema = z.object({
  budgetItemId: z.string().min(1, 'Selecione o item.'),
  triggerType: z.enum(['FROM_DELIVERY', 'FROM_PROJECT_START', 'FROM_LAST_REPLENISHMENT', 'MANUAL']),
  intervalUnit: z.enum(['DAY', 'WEEK', 'MONTH', 'YEAR']),
  intervalValue: z.coerce.number().int().positive(),
  warningDays: z.coerce.number().int().nonnegative().default(30),
  baseDate: z.string().optional(),
  isEnabled: z.boolean().default(true),
  notes: z.string().trim().optional(),
});

type FormValues = z.input<typeof formSchema>;
type FormSubmitValues = z.output<typeof formSchema>;

function ReplenishmentDialog({
  open,
  onOpenChange,
  projectId,
  rule,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  rule?: ReplenishmentRule | null;
}) {
  const { data: budgetItems } = useBudgetItemsQuery(projectId);
  const { upsertRule } = useReplenishmentsMutations(projectId);
  const form = useForm<FormValues, undefined, FormSubmitValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      budgetItemId: rule?.budgetItemId ?? '',
      triggerType: rule?.triggerType ?? 'FROM_DELIVERY',
      intervalUnit: rule?.intervalUnit ?? 'MONTH',
      intervalValue: rule?.intervalValue ?? 6,
      warningDays: rule?.warningDays ?? 30,
      baseDate: rule?.baseDate ? rule.baseDate.slice(0, 10) : '',
      isEnabled: rule?.isEnabled ?? true,
      notes: rule?.notes ?? '',
    },
  });

  const triggerType = form.watch('triggerType');

  useEffect(() => {
    form.reset({
      budgetItemId: rule?.budgetItemId ?? '',
      triggerType: rule?.triggerType ?? 'FROM_DELIVERY',
      intervalUnit: rule?.intervalUnit ?? 'MONTH',
      intervalValue: rule?.intervalValue ?? 6,
      warningDays: rule?.warningDays ?? 30,
      baseDate: rule?.baseDate ? rule.baseDate.slice(0, 10) : '',
      isEnabled: rule?.isEnabled ?? true,
      notes: rule?.notes ?? '',
    });
  }, [form, rule]);

  async function onSubmit(values: FormSubmitValues) {
    try {
      await upsertRule.mutateAsync({
        budgetItemId: values.budgetItemId,
        payload: {
          triggerType: values.triggerType,
          intervalUnit: values.intervalUnit,
          intervalValue: values.intervalValue,
          warningDays: values.warningDays,
          baseDate: values.baseDate ? `${values.baseDate}T00:00:00.000Z` : null,
          isEnabled: values.isEnabled,
          notes: values.notes || null,
        },
      });

      toast.success(rule ? 'Regra de reposição atualizada com sucesso.' : 'Regra de reposição criada com sucesso.');
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar a regra. Tente novamente.');
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{rule ? 'Editar reposição' : 'Nova reposição'}</DialogTitle>
          <DialogDescription>Defina como a próxima reposição deve ser calculada no MVP.</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="budgetItemId">Item orçado</Label>
            <Select id="budgetItemId" {...form.register('budgetItemId')}>
              <option value="">Selecione um item</option>
              {budgetItems?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="triggerType">Gatilho</Label>
              <Select id="triggerType" {...form.register('triggerType')}>
                {replenishmentTriggerOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="intervalUnit">Unidade</Label>
              <Select id="intervalUnit" {...form.register('intervalUnit')}>
                {intervalUnitOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="intervalValue">Intervalo</Label>
              <Input id="intervalValue" type="number" {...form.register('intervalValue')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="warningDays">Janela de alerta (dias)</Label>
              <Input id="warningDays" type="number" {...form.register('warningDays')} />
            </div>
            {triggerType === 'MANUAL' ? (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="baseDate">Data base</Label>
                <Input id="baseDate" type="date" {...form.register('baseDate')} />
              </div>
            ) : null}
          </div>
          <label className="flex items-center gap-3 rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm text-card-foreground">
            <input type="checkbox" {...form.register('isEnabled')} />
            Regra ativa
          </label>
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" {...form.register('notes')} />
          </div>

          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} type="button" variant="ghost">
              Cancelar
            </Button>
            <Button disabled={upsertRule.isPending} type="submit">
              {upsertRule.isPending ? 'Salvando...' : rule ? 'Salvar alterações' : 'Criar regra'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ReplenishmentsPanel({ projectId }: { projectId: string }) {
  const { data, isLoading, isError } = useReplenishmentsQuery(projectId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ReplenishmentRule | null>(null);

  const summary = useMemo(
    () => ({
      upcoming: data?.filter((rule) => rule.status === 'UPCOMING').length ?? 0,
      overdue: data?.filter((rule) => rule.status === 'OVERDUE').length ?? 0,
      scheduled: data?.filter((rule) => rule.status === 'SCHEDULED').length ?? 0,
    }),
    [data],
  );

  return (
    <div className="page-sections">
      <Card>
        <CardHeader className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <CardTitle>Reposições</CardTitle>
            <CardDescription>Defina periodicidade por item e acompanhe o histórico de eventos planejados.</CardDescription>
          </div>
          <Button
            className="shadow-glow"
            onClick={() => {
              setEditingRule(null);
              setDialogOpen(true);
            }}
            size="lg"
          >
            <CirclePlus className="size-4" />
            Nova regra
          </Button>
        </CardHeader>
      </Card>

      <div className="grid gap-5 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Agendadas</p>
            <p className="mt-2 text-3xl font-black text-card-foreground">{summary.scheduled}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Próximas</p>
            <p className="mt-2 text-3xl font-black text-card-foreground">{summary.upcoming}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Vencidas</p>
            <p className="mt-2 text-3xl font-black text-card-foreground">{summary.overdue}</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="p-6">
                <Skeleton className="h-28 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="p-8 text-center text-sm font-medium text-muted-foreground">
            Não foi possível carregar as reposições.
          </CardContent>
        </Card>
      ) : !data || data.length === 0 ? (
        <EmptyState
          actionLabel="Criar primeira regra"
          description="Associe regras aos itens orçados para gerar lembretes e histórico de reposições."
          icon={CirclePlus}
          onAction={() => {
            setEditingRule(null);
            setDialogOpen(true);
          }}
          title="Nenhuma regra de reposição"
        />
      ) : (
        <div className="space-y-4">
          {data.map((rule) => (
            <Card key={rule.id}>
              <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <ReplenishmentStatusBadge value={rule.status} />
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {rule.intervalValue} {rule.intervalUnit.toLowerCase()}
                    </span>
                  </div>
                  <div>
                    <CardTitle>{rule.budgetItem.name}</CardTitle>
                    <CardDescription>{rule.notes || 'Regra sem observações adicionais.'}</CardDescription>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="rounded-2xl bg-secondary px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Próxima</p>
                    <p className="mt-1 font-black text-card-foreground">{formatDate(rule.nextEvent?.plannedDate)}</p>
                  </div>
                  <Button
                    onClick={() => {
                      setEditingRule(rule);
                      setDialogOpen(true);
                    }}
                    variant="outline"
                  >
                    <CalendarClock className="size-4" />
                    Editar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow variant="header">
                      <TableHead>Data base</TableHead>
                      <TableHead>Planejada</TableHead>
                      <TableHead>Concluída</TableHead>
                      <TableHead>Pedido vinculado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rule.events.length === 0 ? (
                      <TableRow>
                        <TableCell className="text-muted-foreground" colSpan={4}>
                          Nenhum evento gerado ainda.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rule.events.map((event) => (
                        <TableRow key={event.id}>
                          <TableCell>{formatDateTime(event.baseDateUsed)}</TableCell>
                          <TableCell>{formatDateTime(event.plannedDate)}</TableCell>
                          <TableCell>{formatDateTime(event.completedDate)}</TableCell>
                          <TableCell>{event.purchaseOrderItemId || '-'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ReplenishmentDialog
        onOpenChange={setDialogOpen}
        open={dialogOpen}
        projectId={projectId}
        rule={editingRule}
      />
    </div>
  );
}
