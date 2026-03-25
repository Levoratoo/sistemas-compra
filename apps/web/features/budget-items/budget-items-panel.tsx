'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { BookMarked, Plus, SquarePen, Trash2 } from 'lucide-react';
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
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { itemCategoryOptions, getItemCategoryLabel } from '@/lib/constants';
import { formatCurrency, formatNumber } from '@/lib/format';
import { useBudgetItemsMutations, useBudgetItemsQuery } from '@/hooks/use-budget-items';
import type { BudgetItem, ItemCategory } from '@/types/api';

const formSchema = z.object({
  itemCategory: z.enum(['UNIFORM', 'EPI', 'EQUIPMENT', 'CONSUMABLE', 'OTHER']),
  name: z.string().trim().min(1, 'Informe o nome do item.'),
  unit: z.string().trim().optional(),
  plannedQuantity: z.coerce.number().nonnegative().optional(),
  bidUnitValue: z.coerce.number().nonnegative().optional(),
  rubricMaxValue: z.coerce.number().nonnegative().optional().nullable(),
  purchasedValue: z.coerce.number().nonnegative().optional().nullable(),
  specification: z.string().trim().optional(),
  roleReference: z.string().trim().optional(),
  allocationSector: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

type FormValues = z.input<typeof formSchema>;
type FormSubmitValues = z.output<typeof formSchema>;

function BudgetItemDialog({
  item,
  onOpenChange,
  open,
  projectId,
}: {
  item?: BudgetItem | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  projectId: string;
}) {
  const { createItem, updateItem } = useBudgetItemsMutations(projectId);
  const form = useForm<FormValues, undefined, FormSubmitValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      itemCategory: item?.itemCategory ?? 'UNIFORM',
      name: item?.name ?? '',
      unit: item?.unit ?? '',
      plannedQuantity: item?.plannedQuantity ?? 0,
      bidUnitValue: item?.bidUnitValue ?? 0,
      rubricMaxValue: item?.rubricMaxValue ?? null,
      purchasedValue: item?.purchasedValue ?? null,
      specification: item?.specification ?? '',
      roleReference: item?.roleReference ?? '',
      allocationSector: item?.allocationSector ?? '',
      notes: item?.notes ?? '',
    },
  });

  useEffect(() => {
    form.reset({
      itemCategory: item?.itemCategory ?? 'UNIFORM',
      name: item?.name ?? '',
      unit: item?.unit ?? '',
      plannedQuantity: item?.plannedQuantity ?? 0,
      bidUnitValue: item?.bidUnitValue ?? 0,
      rubricMaxValue: item?.rubricMaxValue ?? null,
      purchasedValue: item?.purchasedValue ?? null,
      specification: item?.specification ?? '',
      roleReference: item?.roleReference ?? '',
      allocationSector: item?.allocationSector ?? '',
      notes: item?.notes ?? '',
    });
  }, [form, item]);

  async function onSubmit(values: FormSubmitValues) {
    const payload = {
      ...values,
      hasBidReference: item?.contextOnly ? false : (values.rubricMaxValue ?? 0) > 0,
      contextOnly: item?.contextOnly ?? false,
    };
    try {
      if (item) {
        await updateItem.mutateAsync({
          id: item.id,
          payload,
        });
        toast.success('Item orçado atualizado.');
      } else {
        await createItem.mutateAsync(payload);
        toast.success('Item orçado criado.');
      }

      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar o item.';
      toast.error(message);
    }
  }

  const submitting = createItem.isPending || updateItem.isPending;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? 'Editar item orçado' : 'Novo item orçado'}</DialogTitle>
          <DialogDescription>Registre a rubrica prevista e a origem operacional do item.</DialogDescription>
        </DialogHeader>

        {item?.contextOnly ? (
          <div className="flex items-start gap-2 rounded-lg border border-border/80 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            <BookMarked className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <span>
              Trecho de referência do edital (sem compra). Ajuste nome e categoria; valores ficam desativados.
            </span>
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="itemCategory">Categoria</Label>
            <Select id="itemCategory" {...form.register('itemCategory')}>
              {itemCategoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" {...form.register('name')} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="unit">Unidade</Label>
              <Input id="unit" {...form.register('unit')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plannedQuantity">Quantidade prevista</Label>
              <Input
                disabled={item?.contextOnly}
                id="plannedQuantity"
                type="number"
                {...form.register('plannedQuantity')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bidUnitValue">Valor unitário licitado</Label>
              <Input
                disabled={item?.contextOnly}
                id="bidUnitValue"
                step="0.01"
                type="number"
                {...form.register('bidUnitValue')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rubricMaxValue">Rubrica máxima (R$)</Label>
              <Input
                disabled={item?.contextOnly}
                id="rubricMaxValue"
                step="0.01"
                type="number"
                {...form.register('rubricMaxValue')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchasedValue">Valor comprado (R$)</Label>
              <Input
                disabled={item?.contextOnly}
                id="purchasedValue"
                step="0.01"
                type="number"
                {...form.register('purchasedValue')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="roleReference">Referência de cargo</Label>
              <Input id="roleReference" {...form.register('roleReference')} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="allocationSector">Lotação</Label>
            <Input id="allocationSector" {...form.register('allocationSector')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="specification">Especificação</Label>
            <Textarea id="specification" {...form.register('specification')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" {...form.register('notes')} />
          </div>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} type="button" variant="ghost">
              Cancelar
            </Button>
            <Button disabled={submitting} type="submit">
              {submitting ? 'Salvando...' : item ? 'Salvar alterações' : 'Criar item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function BudgetItemsPanel({ projectId }: { projectId: string }) {
  const { data, isLoading, isError } = useBudgetItemsQuery(projectId);
  const { deleteItem } = useBudgetItemsMutations(projectId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);

  async function handleDelete(itemId: string) {
    const confirmed = window.confirm('Deseja excluir este item orçado?');

    if (!confirmed) {
      return;
    }

    try {
      await deleteItem.mutateAsync(itemId);
      toast.success('Item orçado excluído.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível excluir o item.';
      toast.error(message);
    }
  }

  return (
    <div className="page-sections">
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle>Itens orçados</CardTitle>
            <CardDescription>Compare rubrica, origem e custo real ao longo da operação.</CardDescription>
          </div>
          <Button
            onClick={() => {
              setEditingItem(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            Novo item
          </Button>
        </CardHeader>
      </Card>

      {isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-20" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState description="Erro ao carregar os itens orçados." title="Falha na consulta de itens" />
      ) : !data || data.length === 0 ? (
        <EmptyState
          actionLabel="Cadastrar item"
          description="Os itens previstos de uniforme, EPI e equipamento aparecerão aqui."
          onAction={() => {
            setEditingItem(null);
            setDialogOpen(true);
          }}
          title="Nenhum item orçado cadastrado"
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow variant="header">
                  <TableHead>Categoria</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Qtd prevista</TableHead>
                  <TableHead>Valor licitado</TableHead>
                  <TableHead>Rubrica máx.</TableHead>
                  <TableHead>Valor comprado</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item) => (
                  <TableRow
                    key={item.id}
                    className={item.contextOnly ? 'bg-muted/30' : undefined}
                  >
                    <TableCell>{getItemCategoryLabel(item.itemCategory as ItemCategory)}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-semibold">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.contextOnly ? 'Referência do edital' : item.unit || 'sem unidade'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{item.contextOnly ? '—' : formatNumber(item.plannedQuantity)}</TableCell>
                    <TableCell>{item.contextOnly ? '—' : formatCurrency(item.bidUnitValue)}</TableCell>
                    <TableCell>{item.contextOnly ? '—' : formatCurrency(item.rubricMaxValue)}</TableCell>
                    <TableCell>{item.contextOnly ? '—' : formatCurrency(item.purchasedValue)}</TableCell>
                    <TableCell>{item.sourceType === 'MANUAL' ? 'Manual' : 'Documento'}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          onClick={() => {
                            setEditingItem(item);
                            setDialogOpen(true);
                          }}
                          size="sm"
                          variant="ghost"
                        >
                          <SquarePen className="size-4" />
                        </Button>
                        <Button onClick={() => handleDelete(item.id)} size="sm" variant="ghost">
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

      <BudgetItemDialog item={editingItem} onOpenChange={setDialogOpen} open={dialogOpen} projectId={projectId} />
    </div>
  );
}
