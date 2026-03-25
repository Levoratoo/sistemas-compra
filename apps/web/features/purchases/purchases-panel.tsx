'use client';

import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ClipboardList, FileText, PackagePlus, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/common/empty-state';
import { DeliveryStatusBadge, PurchaseStatusBadge } from '@/components/common/status-badge';
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
import { deliveryStatusOptions, getItemCategoryLabel, purchaseStatusOptions } from '@/lib/constants';
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/lib/format';
import { useBudgetItemsMutations } from '@/hooks/use-budget-items';
import { usePurchasesMutations, usePurchasesQuery } from '@/hooks/use-purchases';
import { useProjectQuery } from '@/hooks/use-projects';
import { useSuppliersQuery } from '@/hooks/use-suppliers';
import type { BudgetItemPayload } from '@/services/budget-items-service';

const purchaseOrderSchema = z.object({
  supplierId: z.string().optional(),
  purchaseStatus: z.enum([
    'TO_START',
    'QUOTING',
    'UNDER_REVIEW',
    'APPROVAL_PENDING',
    'APPROVED',
    'PAYMENT_PENDING',
    'COMPLETED',
    'CANCELLED',
  ]),
  purchaseDate: z.string().optional(),
  internalReference: z.string().trim().optional(),
  glpiNumber: z.string().trim().optional(),
  paymentSentAt: z.string().optional(),
  notes: z.string().trim().optional(),
});

const purchaseItemSchema = z.object({
  budgetItemId: z.string().optional(),
  quantityPurchased: z.coerce.number().positive(),
  realUnitValue: z.coerce.number().nonnegative(),
  expectedDeliveryDate: z.string().optional(),
  deliveredAt: z.string().optional(),
  deliveryStatus: z.enum([
    'NOT_SCHEDULED',
    'SCHEDULED',
    'PARTIALLY_DELIVERED',
    'DELIVERED',
    'DELAYED',
    'CANCELLED',
  ]),
  notes: z.string().trim().optional(),
  createManualBudgetItem: z.boolean().default(false),
  manualItemCategory: z.enum(['UNIFORM', 'EPI', 'EQUIPMENT', 'CONSUMABLE', 'OTHER']).default('OTHER'),
  manualItemName: z.string().trim().optional(),
  manualItemUnit: z.string().trim().optional(),
  manualItemQuantity: z.coerce.number().nonnegative().optional(),
  manualHasBidReference: z.boolean().default(false),
});

type PurchaseOrderFormValues = z.input<typeof purchaseOrderSchema>;
type PurchaseOrderSubmitValues = z.output<typeof purchaseOrderSchema>;
type PurchaseItemFormValues = z.input<typeof purchaseItemSchema>;
type PurchaseItemSubmitValues = z.output<typeof purchaseItemSchema>;

function PurchaseOrderDialog({
  onOpenChange,
  open,
  projectId,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  projectId: string;
}) {
  const { data: suppliers } = useSuppliersQuery();
  const { createOrder } = usePurchasesMutations(projectId);
  const form = useForm<PurchaseOrderFormValues, undefined, PurchaseOrderSubmitValues>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: {
      supplierId: '',
      purchaseStatus: 'TO_START',
      purchaseDate: '',
      internalReference: '',
      glpiNumber: '',
      paymentSentAt: '',
      notes: '',
    },
  });

  async function onSubmit(values: PurchaseOrderSubmitValues) {
    try {
      await createOrder.mutateAsync({
        supplierId: values.supplierId || null,
        purchaseStatus: values.purchaseStatus,
        purchaseDate: values.purchaseDate ? `${values.purchaseDate}T00:00:00.000Z` : null,
        internalReference: values.internalReference || null,
        glpiNumber: values.glpiNumber || null,
        paymentSentAt: values.paymentSentAt ? `${values.paymentSentAt}T00:00:00.000Z` : null,
        notes: values.notes || null,
      });

      toast.success('Compra registrada com sucesso.');
      onOpenChange(false);
      form.reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível registrar a compra. Tente novamente.');
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova compra</DialogTitle>
          <DialogDescription>Crie o pedido antes de adicionar os itens reais.</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="supplierId">Fornecedor</Label>
            <Select id="supplierId" {...form.register('supplierId')}>
              <option value="">Selecionar depois</option>
              {suppliers?.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.legalName}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="purchaseStatus">Status</Label>
              <Select id="purchaseStatus" {...form.register('purchaseStatus')}>
                {purchaseStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchaseDate">Data</Label>
              <Input id="purchaseDate" type="date" {...form.register('purchaseDate')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="internalReference">Referência interna</Label>
              <Input id="internalReference" {...form.register('internalReference')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="glpiNumber">GLPI</Label>
              <Input id="glpiNumber" {...form.register('glpiNumber')} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="paymentSentAt">Pagamento enviado em</Label>
              <Input id="paymentSentAt" type="date" {...form.register('paymentSentAt')} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" {...form.register('notes')} />
          </div>

          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} type="button" variant="ghost">
              Cancelar
            </Button>
            <Button disabled={createOrder.isPending} type="submit">
              {createOrder.isPending ? 'Salvando...' : 'Criar pedido'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PurchaseItemDialog({
  onOpenChange,
  open,
  projectId,
  purchaseOrderId,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  projectId: string;
  purchaseOrderId: string | null;
}) {
  const { data: project } = useProjectQuery(projectId);
  const budgetItems = project?.budgetItems ?? [];
  const linkableBudgetItems = useMemo(
    () => budgetItems.filter((i) => !i.contextOnly),
    [budgetItems],
  );
  const { createOrderItem } = usePurchasesMutations(projectId);
  const form = useForm<PurchaseItemFormValues, undefined, PurchaseItemSubmitValues>({
    resolver: zodResolver(purchaseItemSchema),
    defaultValues: {
      budgetItemId: '',
      quantityPurchased: 1,
      realUnitValue: 0,
      expectedDeliveryDate: '',
      deliveredAt: '',
      deliveryStatus: 'NOT_SCHEDULED',
      notes: '',
      createManualBudgetItem: false,
      manualItemCategory: 'OTHER',
      manualItemName: '',
      manualItemUnit: '',
      manualItemQuantity: 1,
      manualHasBidReference: false,
    },
  });

  const createManual = form.watch('createManualBudgetItem');
  const totalPreview = useMemo(() => {
    const quantity = Number(form.watch('quantityPurchased')) || 0;
    const unitValue = Number(form.watch('realUnitValue')) || 0;
    return quantity * unitValue;
  }, [form]);

  async function onSubmit(values: PurchaseItemSubmitValues) {
    if (!purchaseOrderId) {
      toast.error('Selecione uma compra válida.');
      return;
    }

    if (values.createManualBudgetItem && !values.manualItemName) {
      toast.error('Informe o nome do item manual.');
      return;
    }

    try {
      await createOrderItem.mutateAsync({
        purchaseOrderId,
        payload: {
          budgetItemId: values.createManualBudgetItem ? null : values.budgetItemId || null,
          quantityPurchased: values.quantityPurchased,
          realUnitValue: values.realUnitValue,
          expectedDeliveryDate: values.expectedDeliveryDate ? `${values.expectedDeliveryDate}T00:00:00.000Z` : null,
          deliveredAt: values.deliveredAt ? `${values.deliveredAt}T00:00:00.000Z` : null,
          deliveryStatus: values.deliveryStatus,
          notes: values.notes || null,
          manualBudgetItem: values.createManualBudgetItem
            ? {
                itemCategory: values.manualItemCategory,
                name: values.manualItemName || 'Item manual',
                unit: values.manualItemUnit || null,
                plannedQuantity: values.manualItemQuantity ?? 1,
                hasBidReference: values.manualHasBidReference,
              }
            : undefined,
        },
      });

      toast.success('Item adicionado à compra com sucesso.');
      onOpenChange(false);
      form.reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o item. Tente novamente.');
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Novo item da compra</DialogTitle>
          <DialogDescription>Vincule um item orçado ou crie um item manual sem rubrica.</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <label className="flex items-center gap-3 rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm text-card-foreground">
            <input type="checkbox" {...form.register('createManualBudgetItem')} />
            Criar item manual nesta compra
          </label>

          {createManual ? (
            <div className="grid gap-4 rounded-3xl border border-border bg-muted/30 p-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="manualItemCategory">Categoria</Label>
                <Select id="manualItemCategory" {...form.register('manualItemCategory')}>
                  {['UNIFORM', 'EPI', 'EQUIPMENT', 'CONSUMABLE', 'OTHER'].map((value) => (
                    <option key={value} value={value}>
                      {getItemCategoryLabel(value as never)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="manualItemName">Nome do item</Label>
                <Input id="manualItemName" {...form.register('manualItemName')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manualItemUnit">Unidade</Label>
                <Input id="manualItemUnit" {...form.register('manualItemUnit')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manualItemQuantity">Quantidade planejada</Label>
                <Input id="manualItemQuantity" type="number" {...form.register('manualItemQuantity')} />
              </div>
              <label className="md:col-span-2 flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-card-foreground">
                <input type="checkbox" {...form.register('manualHasBidReference')} />
                Item manual possui referência de rubrica
              </label>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="budgetItemId">Item orçado</Label>
              <Select id="budgetItemId" {...form.register('budgetItemId')}>
                <option value="">Selecione um item</option>
                {linkableBudgetItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="quantityPurchased">Quantidade</Label>
              <Input id="quantityPurchased" type="number" {...form.register('quantityPurchased')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="realUnitValue">Valor unitário real</Label>
              <Input id="realUnitValue" step="0.01" type="number" {...form.register('realUnitValue')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deliveryStatus">Status da entrega</Label>
              <Select id="deliveryStatus" {...form.register('deliveryStatus')}>
                {deliveryStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="expectedDeliveryDate">Entrega prevista</Label>
              <Input id="expectedDeliveryDate" type="date" {...form.register('expectedDeliveryDate')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deliveredAt">Entregue em</Label>
              <Input id="deliveredAt" type="date" {...form.register('deliveredAt')} />
            </div>
            <div className="rounded-2xl border border-border bg-secondary px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Total calculado</p>
              <p className="mt-2 text-xl font-black text-card-foreground">{formatCurrency(totalPreview)}</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" {...form.register('notes')} />
          </div>

          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} type="button" variant="ghost">
              Cancelar
            </Button>
            <Button disabled={createOrderItem.isPending} type="submit">
              {createOrderItem.isPending ? 'Salvando...' : 'Adicionar item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PurchasesPanel({ projectId }: { projectId: string }) {
  const { data: project, isLoading: projectLoading, isError: projectError } = useProjectQuery(projectId);
  const { data, isLoading, isError } = usePurchasesQuery(projectId);
  const { updateItem: updateBudgetItem } = useBudgetItemsMutations(projectId);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const budgetItems = project?.budgetItems ?? [];
  const purchasableBudgetItems = useMemo(
    () => budgetItems.filter((i) => !i.contextOnly),
    [budgetItems],
  );
  const hasBudgetItems = budgetItems.length > 0;
  const orderCount = data?.length ?? 0;

  const totalPurchasedRecorded = useMemo(() => {
    return purchasableBudgetItems.reduce((sum, item) => {
      if (item.purchasedValue == null) return sum;
      return sum + item.purchasedValue;
    }, 0);
  }, [purchasableBudgetItems]);

  const markedCount = useMemo(
    () => purchasableBudgetItems.filter((i) => i.purchasedValue != null).length,
    [purchasableBudgetItems],
  );

  async function patchPurchasedValue(id: string, payload: Partial<BudgetItemPayload>) {
    try {
      await updateBudgetItem.mutateAsync({ id, payload });
    } catch {
      toast.error('Não foi possível salvar.');
    }
  }

  return (
    <div className="page-sections">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Compras Reais</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Marque o que já foi comprado e informe o valor pago por linha.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setOrderDialogOpen(true)} type="button" variant="outline">
            <ShoppingCart className="size-4" aria-hidden />
            Novo pedido
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href={`/projects/${projectId}/documents`}>
              <FileText className="size-4" aria-hidden />
              Documentos
            </Link>
          </Button>
        </div>
      </section>

      {/* Checklist: comprado + valor */}
      <section aria-labelledby="purchases-items-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3
              className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground"
              id="purchases-items-heading"
            >
              <ClipboardList className="size-5 text-primary" aria-hidden />
              Checklist de compras
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Itens com compra prevista no projeto (referências só de edital não aparecem aqui).
            </p>
          </div>
          <Button asChild size="sm" variant="secondary">
            <Link href={`/projects/${projectId}/budget-items`}>Itens orçados</Link>
          </Button>
        </div>

        {projectLoading ? (
          <Card className="border-2 border-primary/20">
            <CardContent className="p-6">
              <Skeleton className="h-10 w-2/3 max-w-md" />
              <Skeleton className="mt-4 h-56 w-full" />
            </CardContent>
          </Card>
        ) : projectError ? (
          <Card>
            <CardContent className="p-8 text-center text-sm font-medium text-muted-foreground">
              Não foi possível carregar os itens do projeto.
            </CardContent>
          </Card>
        ) : hasBudgetItems ? (
          <Card className="overflow-hidden border border-border/80 shadow-sm">
            <CardHeader className="border-b border-border/80 bg-muted/30 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base font-semibold">Execução</CardTitle>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <span className="text-muted-foreground">
                    <span className="font-medium text-foreground">{markedCount}</span> de{' '}
                    <span className="font-medium text-foreground">{purchasableBudgetItems.length}</span> marcados
                  </span>
                  <span className="tabular-nums text-foreground">
                    Total informado: <strong>{formatCurrency(totalPurchasedRecorded)}</strong>
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow variant="header">
                    <TableHead className="w-10 text-center">Ok</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="w-[72px] text-right">Qtd</TableHead>
                    <TableHead className="w-[120px] text-right">Rubrica (R$)</TableHead>
                    <TableHead className="w-[100px]">Categoria</TableHead>
                    <TableHead className="w-[120px] text-right" title="Taxa administrativa (percentual sobre a compra)">
                      Taxa adm. (%)
                    </TableHead>
                    <TableHead className="w-[140px] text-right">Valor comprado (R$)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchasableBudgetItems.length === 0 ? (
                    <TableRow>
                      <TableCell className="text-muted-foreground" colSpan={7}>
                        Nenhum item com compra prevista — apenas referências normativas no edital.
                      </TableCell>
                    </TableRow>
                  ) : (
                    purchasableBudgetItems.map((item) => {
                      const purchased = item.purchasedValue != null;
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="text-center align-middle">
                            <input
                              aria-label={`Comprado: ${item.name}`}
                              checked={purchased}
                              className="size-4 cursor-pointer rounded border-neutral-300 text-primary accent-primary"
                              type="checkbox"
                              onChange={(e) => {
                                if (e.target.checked) {
                                  void patchPurchasedValue(item.id, {
                                    purchasedValue: item.purchasedValue ?? 0,
                                  });
                                } else {
                                  void patchPurchasedValue(item.id, { purchasedValue: null });
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <p className="font-medium text-foreground">{item.name}</p>
                            {item.description ? (
                              <p className="line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm text-foreground">
                            {item.plannedQuantity != null ? formatNumber(item.plannedQuantity) : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm text-foreground">
                            {item.rubricMaxValue != null ? formatCurrency(item.rubricMaxValue) : '—'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {getItemCategoryLabel(item.itemCategory)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              key={`${item.id}-af-${item.updatedAt ?? ''}`}
                              aria-label={`Taxa administrativa (%): ${item.name}`}
                              className="h-9 max-w-[120px] tabular-nums text-right"
                              defaultValue={
                                item.administrativeFeePercent != null
                                  ? String(item.administrativeFeePercent)
                                  : ''
                              }
                              disabled={!purchased || updateBudgetItem.isPending}
                              inputMode="decimal"
                              min={0}
                              placeholder="0"
                              step="any"
                              type="number"
                              onBlur={(e) => {
                                if (!purchased) return;
                                const raw = e.target.value.trim();
                                if (raw === '') {
                                  void patchPurchasedValue(item.id, { administrativeFeePercent: null });
                                  return;
                                }
                                const n = Number(raw);
                                if (Number.isNaN(n)) return;
                                void patchPurchasedValue(item.id, { administrativeFeePercent: n });
                              }}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              key={`${item.id}-pv-${item.updatedAt ?? ''}`}
                              aria-label={`Valor comprado: ${item.name}`}
                              className="h-9 max-w-[140px] tabular-nums text-right"
                              defaultValue={purchased && item.purchasedValue != null ? String(item.purchasedValue) : ''}
                              disabled={!purchased || updateBudgetItem.isPending}
                              inputMode="decimal"
                              min={0}
                              placeholder="0"
                              step="any"
                              type="number"
                              onBlur={(e) => {
                                if (!purchased) return;
                                const raw = e.target.value.trim();
                                const n = raw === '' ? 0 : Number(raw);
                                if (Number.isNaN(n)) return;
                                void patchPurchasedValue(item.id, { purchasedValue: n });
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-2 border-dashed border-primary/30 bg-muted/30">
            <CardContent className="space-y-4 p-8">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15">
                  <ClipboardList className="size-7 text-primary" aria-hidden />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">Ainda não há itens de compra neste projeto</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Para a lista aparecer aqui automaticamente, envie o mapa em{' '}
                    <Link className="font-semibold text-primary underline-offset-4 hover:underline" href={`/projects/${projectId}/documents`}>
                      Documentos
                    </Link>
                    , conclua a <strong className="font-medium text-foreground">revisão da extração</strong> e clique em{' '}
                    <strong className="font-medium text-foreground">Aplicar ao projeto</strong>. Também é possível
                    cadastrar itens manualmente em{' '}
                    <Link className="font-semibold text-primary underline-offset-4 hover:underline" href={`/projects/${projectId}/budget-items`}>
                      Itens orçados
                    </Link>
                    .
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      {/* 2 — Execução: pedidos reais (mantido) */}
      <section aria-labelledby="purchases-orders-heading" className="space-y-4">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-foreground md:text-2xl" id="purchases-orders-heading">
            Pedidos de compra (execução)
          </h3>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Registre fornecedor, valores executados e entregas. Cada linha pode vincular a um item da lista acima.
          </p>
        </div>

      {isLoading ? (
        <div className="grid gap-5">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="p-6">
                <Skeleton className="h-40 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="p-8 text-center text-sm font-medium text-muted-foreground">
            Não foi possível carregar as compras deste projeto.
          </CardContent>
        </Card>
      ) : !data || data.length === 0 ? (
        <EmptyState
          actionLabel="Registrar primeira compra"
          description={
            hasBudgetItems
              ? 'Os materiais e suprimentos já estão listados acima. Aqui entram apenas os pedidos reais (fornecedor, valores executados) para comparar com o orçamento.'
              : 'As compras aparecem aqui com fornecedor, valores e itens — base para comparar com o orçamento.'
          }
          icon={ShoppingCart}
          onAction={() => setOrderDialogOpen(true)}
          title="Nenhum pedido de compra registrado"
        />
      ) : (
        <div className="space-y-5">
          {data.map((order) => (
            <Card key={order.id}>
              <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <PurchaseStatusBadge value={order.purchaseStatus} />
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {order.internalReference || 'Sem referência'}
                    </span>
                  </div>
                  <div>
                    <CardTitle>{order.supplier?.legalName || 'Fornecedor ainda não definido'}</CardTitle>
                    <CardDescription>
                      Compra em {formatDate(order.purchaseDate)} • GLPI {order.glpiNumber || '-'}
                    </CardDescription>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="rounded-2xl bg-secondary px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Total real</p>
                    <p className="mt-1 font-black text-card-foreground">{formatCurrency(order.totalRealValue)}</p>
                  </div>
                  <Button
                    onClick={() => {
                      setSelectedOrderId(order.id);
                      setItemDialogOpen(true);
                    }}
                    variant="outline"
                  >
                    <PackagePlus className="size-4" />
                    Adicionar item
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow variant="header">
                      <TableHead>Item</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Qtd</TableHead>
                      <TableHead>Valor unitário</TableHead>
                      <TableHead>Total real</TableHead>
                      <TableHead>Entrega</TableHead>
                      <TableHead>Entregue em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.items.length === 0 ? (
                      <TableRow>
                        <TableCell className="text-muted-foreground" colSpan={7}>
                          Nenhum item lançado ainda.
                        </TableCell>
                      </TableRow>
                    ) : (
                      order.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <p className="font-semibold">{item.budgetItem.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.budgetItem.hasBidReference ? 'Com rubrica' : 'Sem rubrica'}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>{getItemCategoryLabel(item.budgetItem.itemCategory)}</TableCell>
                          <TableCell>{item.quantityPurchased}</TableCell>
                          <TableCell>{formatCurrency(item.realUnitValue)}</TableCell>
                          <TableCell>{formatCurrency(item.realTotalValue)}</TableCell>
                          <TableCell>
                            <DeliveryStatusBadge value={item.deliveryStatus} />
                          </TableCell>
                          <TableCell>{formatDateTime(item.deliveredAt)}</TableCell>
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
      </section>

      <PurchaseOrderDialog onOpenChange={setOrderDialogOpen} open={orderDialogOpen} projectId={projectId} />
      <PurchaseItemDialog
        onOpenChange={setItemDialogOpen}
        open={itemDialogOpen}
        projectId={projectId}
        purchaseOrderId={selectedOrderId}
      />
    </div>
  );
}
