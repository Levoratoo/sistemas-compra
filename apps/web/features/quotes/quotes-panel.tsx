'use client';

import { type ChangeEvent, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpFromLine,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Dices,
  ExternalLink,
  FilePlus2,
  FileText,
  LayoutGrid,
  Search,
  SquarePen,
  Store,
  Trash2,
  Trophy,
} from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/common/empty-state';
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
import { Textarea } from '@/components/ui/textarea';
import { SupplierDialog } from '@/features/suppliers/supplier-dialog';
import { useBudgetItemsMutations } from '@/hooks/use-budget-items';
import { useProjectQuery } from '@/hooks/use-projects';
import { useProjectQuotesMutations, useProjectQuotesQuery } from '@/hooks/use-project-quotes';
import { useSuppliersQuery } from '@/hooks/use-suppliers';
import { getItemCategoryLabel, itemCategoryOptions } from '@/lib/constants';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { openProjectDocumentInNewTab } from '@/services/documents-service';
import type {
  BudgetItem,
  ItemCategory,
  ProjectQuoteImportAction,
  ProjectQuoteImportApplyPayload,
  ProjectQuoteImportPreview,
  ProjectQuoteImportRow,
  ProjectQuoteRow,
  ProjectQuoteState,
  ProjectQuoteSlot,
} from '@/types/api';

type QuoteView = 'slot-1' | 'slot-2' | 'slot-3' | 'comparison';

const viewTabs: Array<{ value: QuoteView; label: string }> = [
  { value: 'slot-1', label: 'Orcamento 1' },
  { value: 'slot-2', label: 'Orcamento 2' },
  { value: 'slot-3', label: 'Orcamento 3' },
  { value: 'comparison', label: 'Mapa comparativo' },
];

type QuoteImportDecisionMap = Record<
  number,
  {
    action: ProjectQuoteImportAction;
    matchedBudgetItemId: string | null;
  }
>;

function buildInitialQuoteImportDecisions(preview: ProjectQuoteImportPreview | null): QuoteImportDecisionMap {
  if (!preview) {
    return {};
  }

  return Object.fromEntries(
    preview.rows.map((row) => [
      row.rowIndex,
      {
        action: row.suggestedAction,
        matchedBudgetItemId: row.matchedBudgetItemId,
      },
    ]),
  );
}

function currencyOrDash(value: number | null | undefined) {
  return value == null ? '-' : formatCurrency(value);
}

function percentOrDash(value: number | null | undefined) {
  return value == null
    ? '-'
    : `${new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(value)}%`;
}

function slotDisplayName(slot: ProjectQuoteSlot) {
  return slot.supplier?.tradeName || slot.supplier?.legalName || `Orcamento ${slot.slotNumber}`;
}

function generateRandomQuoteUnitPrice() {
  const rawValue = Math.random() * 490 + 10;
  return Number(rawValue.toFixed(2));
}

function getQuoteFillProgress(filledItemCount: number, itemCount: number) {
  if (itemCount <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((filledItemCount / itemCount) * 100));
}

function SlotStatusBadge({ slot }: { slot: ProjectQuoteSlot }) {
  if (slot.isComplete) {
    return <Badge variant="success">Completo</Badge>;
  }
  if (slot.supplierId) {
    return <Badge variant="warning">Em preenchimento</Badge>;
  }
  return <Badge variant="neutral">Sem fornecedor</Badge>;
}

function QuoteLineRow({
  row,
  slotNumber,
  disabled,
  onSave,
}: {
  row: ProjectQuoteRow;
  slotNumber: number;
  disabled: boolean;
  onSave: (budgetItemId: string, payload: { unitPrice?: number | null; notes?: string | null }) => Promise<void>;
}) {
  const value = row.values.find((entry) => entry.slotNumber === slotNumber);
  const [unitPriceText, setUnitPriceText] = useState(value?.unitPrice != null ? String(value.unitPrice) : '');
  const [notes, setNotes] = useState(value?.notes ?? '');

  useEffect(() => {
    setUnitPriceText(value?.unitPrice != null ? String(value.unitPrice) : '');
    setNotes(value?.notes ?? '');
  }, [value?.notes, value?.unitPrice]);

  const parsedPreviewUnitPrice = useMemo(() => {
    const normalized = unitPriceText.trim().replace(',', '.');
    if (!normalized) {
      return null;
    }
    const numeric = Number(normalized);
    return Number.isFinite(numeric) && numeric >= 0 ? numeric : value?.unitPrice ?? null;
  }, [unitPriceText, value?.unitPrice]);

  const totalPreview =
    row.quantity != null && parsedPreviewUnitPrice != null ? row.quantity * parsedPreviewUnitPrice : value?.totalValue ?? null;

  async function commitUnitPrice() {
    const normalized = unitPriceText.trim().replace(',', '.');
    const parsed = normalized === '' ? null : Number(normalized);

    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
      setUnitPriceText(value?.unitPrice != null ? String(value.unitPrice) : '');
      return;
    }

    if ((value?.unitPrice ?? null) === parsed) {
      return;
    }

    try {
      await onSave(row.budgetItemId, { unitPrice: parsed });
    } catch {
      setUnitPriceText(value?.unitPrice != null ? String(value.unitPrice) : '');
    }
  }

  async function commitNotes() {
    const nextNotes = notes.trim() || null;
    const previousNotes = value?.notes ?? null;

    if (previousNotes === nextNotes) {
      return;
    }

    try {
      await onSave(row.budgetItemId, { notes: nextNotes });
    } catch {
      setNotes(value?.notes ?? '');
    }
  }

  return (
    <tr
      className={cn(
        'border-b border-border/70 transition-colors hover:bg-muted/20',
        row.supplierQuoteExtraItem && 'bg-amber-50/70 hover:bg-amber-100/70',
      )}
    >
      <td className="px-3 py-3 align-top">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-foreground">{row.description}</p>
            {row.supplierQuoteExtraItem ? (
              <Badge className="border-amber-300/80 bg-amber-100 text-amber-950" variant="warning">
                Item extra
              </Badge>
            ) : null}
          </div>
          {row.specification ? <p className="text-xs leading-relaxed text-muted-foreground">{row.specification}</p> : null}
          <p className="text-xs text-muted-foreground">{getItemCategoryLabel(row.itemCategory)}</p>
        </div>
      </td>
      <td className="px-3 py-3 text-center align-top tabular-nums text-foreground">{formatNumber(row.quantity)}</td>
      <td className="px-3 py-3 align-top">
        <Input
          className="h-10 tabular-nums text-right"
          disabled={disabled}
          inputMode="decimal"
          min={0}
          placeholder="0,00"
          step="any"
          type="number"
          value={unitPriceText}
          onBlur={() => void commitUnitPrice()}
          onChange={(event) => setUnitPriceText(event.target.value)}
        />
      </td>
      <td className="px-3 py-3 align-top text-right tabular-nums font-semibold text-foreground">
        {currencyOrDash(totalPreview)}
      </td>
      <td className="px-3 py-3 align-top">
        <Input
          className="h-10"
          disabled={disabled}
          placeholder="Observacoes do orcamento"
          value={notes}
          onBlur={() => void commitNotes()}
          onChange={(event) => setNotes(event.target.value)}
        />
      </td>
    </tr>
  );
}

function SupplierPickerDialog({
  open,
  onOpenChange,
  slot,
  onSelectSupplier,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot: ProjectQuoteSlot | null;
  onSelectSupplier: (supplierId: string | null) => Promise<void>;
}) {
  const { data: suppliers, isLoading, isError } = useSuppliersQuery();
  const [search, setSearch] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setCreateDialogOpen(false);
    }
  }, [open]);

  const filteredSuppliers = useMemo(() => {
    const source = suppliers ?? [];
    const query = deferredSearch.trim().toLowerCase();

    if (!query) {
      return source;
    }

    return source.filter((supplier) =>
      [supplier.legalName, supplier.tradeName, supplier.documentNumber, supplier.contactName]
        .filter(Boolean)
        .some((field) => field?.toLowerCase().includes(query)),
    );
  }, [deferredSearch, suppliers]);

  async function handleSelect(supplierId: string | null) {
    await onSelectSupplier(supplierId);
    onOpenChange(false);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b border-border/70 px-6 py-5">
            <DialogTitle>Selecionar fornecedor</DialogTitle>
            <DialogDescription>Escolha o fornecedor deste orcamento ou cadastre um novo sem sair da tela.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto px-6 py-5">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Buscar por razao social, fantasia, documento ou contato"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <Button className="shrink-0" type="button" variant="secondary" onClick={() => setCreateDialogOpen(true)}>
                <FilePlus2 className="size-4" aria-hidden />
                Novo fornecedor
              </Button>
            </div>

            {slot?.supplier ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Atual</p>
                  <p className="font-medium text-foreground">{slotDisplayName(slot)}</p>
                </div>
                <Button type="button" variant="ghost" onClick={() => void handleSelect(null)}>
                  Remover fornecedor
                </Button>
              </div>
            ) : null}

            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-20 w-full rounded-2xl" />
                ))}
              </div>
            ) : isError ? (
              <EmptyState description="Nao foi possivel carregar os fornecedores." title="Erro ao consultar fornecedores" />
            ) : filteredSuppliers.length === 0 ? (
              <EmptyState
                actionLabel="Cadastrar fornecedor"
                description="Nenhum fornecedor encontrado para a busca atual."
                onAction={() => setCreateDialogOpen(true)}
                title="Lista vazia"
              />
            ) : (
              <div className="grid gap-3">
                {filteredSuppliers.map((supplier) => {
                  const selected = slot?.supplierId === supplier.id;

                  return (
                    <button
                      key={supplier.id}
                      className={cn(
                        'rounded-2xl border px-4 py-4 text-left transition',
                        selected
                          ? 'border-primary bg-primary/8 shadow-md shadow-primary/10'
                          : 'border-border/70 bg-card hover:border-primary/35 hover:bg-muted/15',
                      )}
                      type="button"
                      onClick={() => void handleSelect(supplier.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="font-semibold text-foreground">{supplier.legalName}</p>
                          {supplier.tradeName ? <p className="text-sm text-muted-foreground">{supplier.tradeName}</p> : null}
                          <p className="text-xs text-muted-foreground">
                            {[supplier.documentNumber, supplier.contactName, supplier.phone].filter(Boolean).join(' | ') || 'Sem dados complementares'}
                          </p>
                        </div>
                        {selected ? <Badge variant="success">Selecionado</Badge> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <SupplierDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSaved={(supplier) => {
          setCreateDialogOpen(false);
          void onSelectSupplier(supplier.id);
          onOpenChange(false);
        }}
      />
    </>
  );
}

function NewQuoteItemDialog({
  open,
  onOpenChange,
  projectId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onCreated?: (item: BudgetItem) => Promise<void> | void;
}) {
  const { createItem } = useBudgetItemsMutations(projectId);
  const [itemCategory, setItemCategory] = useState<ItemCategory>('OTHER');
  const [name, setName] = useState('');
  const [plannedQuantity, setPlannedQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [specification, setSpecification] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) {
      setItemCategory('OTHER');
      setName('');
      setPlannedQuantity('');
      setUnit('');
      setSpecification('');
      setNotes('');
    }
  }, [open]);

  async function handleSubmit() {
    const quantity = Number(plannedQuantity);
    if (!name.trim()) {
      toast.error('Informe a descricao do item.');
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error('Informe uma quantidade valida maior que zero.');
      return;
    }

    try {
      const created = await createItem.mutateAsync({
        itemCategory,
        name: name.trim(),
        plannedQuantity: quantity,
        unit: unit.trim() || null,
        specification: specification.trim() || null,
        notes: notes.trim() || null,
        hasBidReference: false,
        sourceType: 'MANUAL',
        contextOnly: false,
      });
      if (onCreated) {
        await onCreated(created);
      }
      toast.success('Novo item adicionado ao projeto.');
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel criar o item.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo item para orcamento</DialogTitle>
          <DialogDescription>
            Este item sera criado no projeto inteiro e podera ser incluido na compra ativa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <Label htmlFor="quote-item-category">Categoria</Label>
              <Select
                id="quote-item-category"
                value={itemCategory}
                onChange={(event) => setItemCategory(event.target.value as ItemCategory)}
              >
                {itemCategoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-3">
              <Label htmlFor="quote-item-quantity">Quantidade</Label>
              <Input
                id="quote-item-quantity"
                min={0}
                step="any"
                type="number"
                value={plannedQuantity}
                onChange={(event) => setPlannedQuantity(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quote-item-name">Descricao</Label>
            <Input id="quote-item-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quote-item-unit">Unidade</Label>
            <Input id="quote-item-unit" value={unit} onChange={(event) => setUnit(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quote-item-specification">Especificacao</Label>
            <Textarea
              id="quote-item-specification"
              rows={3}
              value={specification}
              onChange={(event) => setSpecification(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quote-item-notes">Observacoes</Label>
            <Textarea id="quote-item-notes" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={createItem.isPending} type="button" onClick={() => void handleSubmit()}>
            {createItem.isPending ? 'Salvando...' : 'Criar item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuotePurchaseDialog({
  open,
  onOpenChange,
  purchase,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchase?: Pick<ProjectQuoteState, 'id' | 'title' | 'notes'> | null;
  pending: boolean;
  onSubmit: (payload: { title: string; notes?: string | null }) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const isEditing = Boolean(purchase);

  useEffect(() => {
    if (!open) {
      setTitle('');
      setNotes('');
      return;
    }

    setTitle(purchase?.title ?? '');
    setNotes(purchase?.notes ?? '');
  }, [open, purchase]);

  async function handleSubmit() {
    if (!title.trim()) {
      toast.error('Informe o nome da compra.');
      return;
    }

    await onSubmit({
      title: title.trim(),
      notes: notes.trim() || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar compra do orcamento' : 'Nova compra para orcamento'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize o nome e as observacoes desta compra sem perder os itens e orcamentos ja vinculados.'
              : 'Cada compra tera seus proprios itens, 3 fornecedores e mapa comparativo.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quote-purchase-title">Nome da compra</Label>
            <Input
              id="quote-purchase-title"
              placeholder="Ex.: Uniformes implantacao"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quote-purchase-notes">Observacoes</Label>
            <Textarea
              id="quote-purchase-notes"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={pending} type="button" onClick={() => void handleSubmit()}>
            {pending ? 'Salvando...' : isEditing ? 'Salvar alteracoes' : 'Criar compra'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManageQuotePurchaseItemsDialog({
  open,
  onOpenChange,
  items,
  selectedItemIds,
  onAdd,
  onRemove,
  pendingBudgetItemId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: BudgetItem[];
  selectedItemIds: string[];
  onAdd: (budgetItemId: string) => Promise<void>;
  onRemove: (budgetItemId: string) => Promise<void>;
  pendingBudgetItemId: string | null;
}) {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const selectedSet = useMemo(() => new Set(selectedItemIds), [selectedItemIds]);

  useEffect(() => {
    if (!open) {
      setSearch('');
    }
  }, [open]);

  const filteredItems = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) {
      return items;
    }

    return items.filter((item) =>
      [item.name, item.specification, item.unit, item.notes]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(query)),
    );
  }, [deferredSearch, items]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-border/70 px-6 py-5">
          <DialogTitle>Gerenciar itens da compra</DialogTitle>
          <DialogDescription>
            Inclua ou remova itens do projeto nesta compra. O mesmo item pode aparecer em compras diferentes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto px-6 py-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar item por descricao, especificacao, unidade ou observacao"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {filteredItems.length === 0 ? (
            <EmptyState description="Nenhum item encontrado para a busca atual." title="Lista vazia" />
          ) : (
            <div className="grid gap-3">
              {filteredItems.map((item) => {
                const selected = selectedSet.has(item.id);
                const busy = pendingBudgetItemId === item.id;

                return (
                  <div
                    key={item.id}
                    className={cn(
                      'rounded-2xl border px-4 py-4',
                      selected ? 'border-primary/35 bg-primary/5' : 'border-border/70 bg-card',
                    )}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-foreground">{item.name}</p>
                          <Badge variant={selected ? 'success' : 'neutral'}>
                            {selected ? 'Na compra' : 'Fora da compra'}
                          </Badge>
                        </div>
                        {item.specification ? <p className="text-sm text-muted-foreground">{item.specification}</p> : null}
                        <p className="text-xs text-muted-foreground">
                          {getItemCategoryLabel(item.itemCategory)} | Qtd. {formatNumber(item.plannedQuantity)} | Unidade {item.unit || '-'}
                        </p>
                      </div>
                      <Button
                        disabled={busy}
                        type="button"
                        variant={selected ? 'outline' : 'secondary'}
                        onClick={() => void (selected ? onRemove(item.id) : onAdd(item.id))}
                      >
                        {busy ? 'Salvando...' : selected ? 'Remover' : 'Adicionar'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GeneratePurchaseOrderDialog({
  open,
  onOpenChange,
  purchase,
  projectName,
  onSubmit,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchase: ProjectQuoteState | null;
  projectName: string;
  onSubmit: (payload: {
    glpiNumber: string;
    internalReference?: string | null;
    deliveryAddress?: string | null;
    freightType?: string | null;
    paymentTerms?: string | null;
    responsibleName?: string | null;
    responsiblePhone?: string | null;
    expectedDeliveryDate?: string | null;
    notes?: string | null;
  }) => Promise<void>;
  pending: boolean;
}) {
  const [glpiNumber, setGlpiNumber] = useState('');
  const [internalReference, setInternalReference] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [freightType, setFreightType] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [responsibleName, setResponsibleName] = useState('');
  const [responsiblePhone, setResponsiblePhone] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) {
      setGlpiNumber('');
      setInternalReference('');
      setDeliveryAddress('');
      setFreightType('');
      setPaymentTerms('');
      setResponsibleName('');
      setResponsiblePhone('');
      setExpectedDeliveryDate('');
      setNotes('');
    }
  }, [open]);

  async function handleSubmit() {
    if (!glpiNumber.trim()) {
      toast.error('Informe o GLPI para gerar os pedidos.');
      return;
    }

    await onSubmit({
      glpiNumber: glpiNumber.trim(),
      internalReference: internalReference.trim() || null,
      deliveryAddress: deliveryAddress.trim() || null,
      freightType: freightType.trim() || null,
      paymentTerms: paymentTerms.trim() || null,
      responsibleName: responsibleName.trim() || null,
      responsiblePhone: responsiblePhone.trim() || null,
      expectedDeliveryDate: expectedDeliveryDate || null,
      notes: notes.trim() || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Gerar pedidos por fornecedor</DialogTitle>
          <DialogDescription>
            O sistema vai gerar um pedido separado por fornecedor vencedor para a compra {purchase?.title || 'selecionada'} de {projectName}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="quote-order-glpi">GLPI</Label>
            <Input
              id="quote-order-glpi"
              placeholder="206021607"
              value={glpiNumber}
              onChange={(event) => setGlpiNumber(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quote-order-reference">Referencia interna</Label>
            <Input
              id="quote-order-reference"
              value={internalReference}
              onChange={(event) => setInternalReference(event.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="quote-order-delivery-address">Endereco de entrega</Label>
            <Textarea
              id="quote-order-delivery-address"
              rows={3}
              value={deliveryAddress}
              onChange={(event) => setDeliveryAddress(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quote-order-freight-type">Tipo de frete</Label>
            <Input
              id="quote-order-freight-type"
              value={freightType}
              onChange={(event) => setFreightType(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quote-order-payment-terms">Condicao de pagamento</Label>
            <Input
              id="quote-order-payment-terms"
              value={paymentTerms}
              onChange={(event) => setPaymentTerms(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quote-order-responsible-name">Responsavel</Label>
            <Input
              id="quote-order-responsible-name"
              value={responsibleName}
              onChange={(event) => setResponsibleName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quote-order-responsible-phone">Telefone do responsavel</Label>
            <Input
              id="quote-order-responsible-phone"
              value={responsiblePhone}
              onChange={(event) => setResponsiblePhone(event.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="quote-order-expected-delivery-date">Previsao de entrega</Label>
            <Input
              id="quote-order-expected-delivery-date"
              type="date"
              value={expectedDeliveryDate}
              onChange={(event) => setExpectedDeliveryDate(event.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="quote-order-notes">Observacoes</Label>
            <Textarea id="quote-order-notes" rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={pending} type="button" onClick={() => void handleSubmit()}>
            {pending ? 'Gerando...' : 'Gerar pedidos'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SupplierQuoteImportDialog({
  open,
  onOpenChange,
  slot,
  budgetRows,
  preview,
  uploadPending,
  applyPending,
  onUpload,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot: ProjectQuoteSlot | null;
  budgetRows: ProjectQuoteRow[];
  preview: ProjectQuoteImportPreview | null;
  uploadPending: boolean;
  applyPending: boolean;
  onUpload: (file: File) => Promise<void>;
  onApply: (payload: ProjectQuoteImportApplyPayload) => Promise<void>;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [decisions, setDecisions] = useState<QuoteImportDecisionMap>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      setSelectedFile(null);
      setDecisions({});
      return;
    }

    setDecisions(buildInitialQuoteImportDecisions(preview));
  }, [open, preview]);

  const budgetItemOptions = useMemo(
    () =>
      budgetRows.map((row) => ({
        id: row.budgetItemId,
        label: row.specification ? `${row.description} | ${row.specification}` : row.description,
      })),
    [budgetRows],
  );

  async function handleUpload() {
    if (!selectedFile) {
      toast.error('Selecione um PDF do fornecedor.');
      return;
    }

    await onUpload(selectedFile);
  }

  async function handleApply() {
    if (!preview) {
      return;
    }

    await onApply({
      rows: preview.rows.map((row) => ({
        rowIndex: row.rowIndex,
        action: decisions[row.rowIndex]?.action ?? row.suggestedAction,
        matchedBudgetItemId: decisions[row.rowIndex]?.matchedBudgetItemId ?? row.matchedBudgetItemId,
      })),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="shrink-0 border-b border-border/70 px-6 py-5">
          <DialogTitle>Importar PDF do fornecedor</DialogTitle>
          <DialogDescription>
            Envie o PDF do fornecedor para o orcamento {slot?.slotNumber ?? 'selecionado'} e revise o casamento dos itens antes de aplicar.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
            <p className="text-sm font-medium text-foreground">
              {slot?.supplierId ? `Fornecedor: ${slotDisplayName(slot)}` : 'Selecione um fornecedor primeiro'}
            </p>
          </div>

          {!preview ? (
            <div className="space-y-4">
              <Input
                ref={fileInputRef}
                accept="application/pdf,.pdf"
                type="file"
                onChange={(event: ChangeEvent<HTMLInputElement>) => setSelectedFile(event.target.files?.[0] ?? null)}
              />
              <div className="flex justify-end">
                <Button disabled={!slot?.supplierId || !selectedFile || uploadPending} type="button" onClick={() => void handleUpload()}>
                  {uploadPending ? 'Lendo PDF...' : 'Ler PDF'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="success">{preview.summary.highConfidenceCount} alta confianca</Badge>
                <Badge variant="warning">{preview.summary.reviewCount} revisar</Badge>
                <Badge variant="neutral">{preview.summary.unmatchedCount} sem match</Badge>
              </div>
              <div className="grid gap-3">
                {preview.rows.map((row) => {
                  const decision = decisions[row.rowIndex] ?? {
                    action: row.suggestedAction,
                    matchedBudgetItemId: row.matchedBudgetItemId,
                  };

                  return (
                    <div key={row.rowIndex} className="rounded-2xl border border-border/70 p-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-foreground">{row.description}</p>
                          <Badge variant={row.confidence === 'HIGH' ? 'success' : row.confidence === 'REVIEW' ? 'warning' : 'neutral'}>
                            {row.confidence}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Qtd. fornecedor: {formatNumber(row.quantity)} | Total: {currencyOrDash(row.totalValue)}
                        </p>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Acao</Label>
                            <Select
                              value={decision.action}
                              onChange={(event) =>
                                setDecisions((current) => ({
                                  ...current,
                                  [row.rowIndex]: {
                                    action: event.target.value as ProjectQuoteImportAction,
                                    matchedBudgetItemId: current[row.rowIndex]?.matchedBudgetItemId ?? row.matchedBudgetItemId,
                                  },
                                }))
                              }
                            >
                              <option value="APPLY">Aplicar</option>
                              <option value="IGNORE">Ignorar</option>
                              <option value="CREATE_EXTRA">Criar item extra</option>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Item do projeto</Label>
                            <Select
                              disabled={decision.action !== 'APPLY'}
                              value={decision.matchedBudgetItemId ?? ''}
                              onChange={(event) =>
                                setDecisions((current) => ({
                                  ...current,
                                  [row.rowIndex]: {
                                    action: current[row.rowIndex]?.action ?? row.suggestedAction,
                                    matchedBudgetItemId: event.target.value || null,
                                  },
                                }))
                              }
                            >
                              <option value="">Selecionar item</option>
                              {budgetItemOptions.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.label}
                                </option>
                              ))}
                            </Select>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border/70 bg-card/95 px-1 pt-4 backdrop-blur">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                  Fechar
                </Button>
                <Button disabled={applyPending} type="button" onClick={() => void handleApply()}>
                  {applyPending ? 'Aplicando...' : 'Aplicar importacao'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ComparisonTable({
  rows,
  slots,
}: {
  rows: ProjectQuoteRow[];
  slots: ProjectQuoteSlot[];
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border/70">
      <table className="w-full min-w-[980px] border-collapse text-sm">
        <thead className="bg-muted/35">
          <tr>
            <th className="border-b border-border/70 px-3 py-3 text-left font-semibold text-foreground">Descricao</th>
            <th className="border-b border-border/70 px-3 py-3 text-center font-semibold text-foreground">Qtd.</th>
            {slots.map((slot) => (
              <th key={slot.slotNumber} className="border-b border-border/70 px-3 py-3 text-left font-semibold text-foreground">
                Orcamento {slot.slotNumber}
              </th>
            ))}
            <th className="border-b border-border/70 px-3 py-3 text-left font-semibold text-foreground">Vencedor</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.budgetItemId} className="border-b border-border/60 align-top hover:bg-muted/15">
              <td className="px-3 py-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{row.description}</p>
                    {row.supplierQuoteExtraItem ? <Badge variant="warning">Extra</Badge> : null}
                  </div>
                  {row.specification ? <p className="text-xs text-muted-foreground">{row.specification}</p> : null}
                </div>
              </td>
              <td className="px-3 py-3 text-center tabular-nums text-foreground">{formatNumber(row.quantity)}</td>
              {slots.map((slot) => {
                const value = row.values.find((entry) => entry.slotNumber === slot.slotNumber);

                return (
                  <td key={slot.slotNumber} className="px-3 py-3">
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{currencyOrDash(value?.unitPrice)}</p>
                      <p className="text-xs text-muted-foreground">{currencyOrDash(value?.totalValue)}</p>
                    </div>
                  </td>
                );
              })}
              <td className="px-3 py-3">
                {row.winner.status === 'UNIQUE' ? (
                  <div className="space-y-1">
                    <Badge variant="success">Menor valor</Badge>
                    <p className="text-sm font-medium text-foreground">
                      {slots.find((slot) => slot.slotNumber === row.winner.slotNumbers[0])?.supplier?.tradeName ||
                        slots.find((slot) => slot.slotNumber === row.winner.slotNumbers[0])?.supplier?.legalName ||
                        `Orcamento ${row.winner.slotNumbers[0]}`}
                    </p>
                    <p className="text-xs text-muted-foreground">{currencyOrDash(row.winner.totalValue)}</p>
                  </div>
                ) : row.winner.status === 'TIE' ? (
                  <div className="space-y-1">
                    <Badge variant="warning">Empate</Badge>
                    <p className="text-xs text-muted-foreground">
                      {row.winner.slotNumbers.map((slotNumber) => `Orcamento ${slotNumber}`).join(' | ')}
                    </p>
                  </div>
                ) : (
                  <Badge variant="neutral">Pendente</Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function QuotesPanel({ projectId }: { projectId: string }) {
  const projectQuery = useProjectQuery(projectId);
  const quotesQuery = useProjectQuotesQuery(projectId);
  const quoteMutations = useProjectQuotesMutations(projectId);
  const [activeView, setActiveView] = useState<QuoteView>('slot-1');
  const [activePurchaseId, setActivePurchaseId] = useState<string | null>(null);
  const [supplierPickerSlot, setSupplierPickerSlot] = useState<ProjectQuoteSlot | null>(null);
  const [newItemDialogOpen, setNewItemDialogOpen] = useState(false);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<ProjectQuoteState | null>(null);
  const [manageItemsDialogOpen, setManageItemsDialogOpen] = useState(false);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<ProjectQuoteImportPreview | null>(null);
  const [isGeneratingRandomValues, setIsGeneratingRandomValues] = useState(false);
  const [pendingBudgetItemId, setPendingBudgetItemId] = useState<string | null>(null);

  const loading = projectQuery.isLoading || quotesQuery.isLoading;
  const project = projectQuery.data;
  const quotesState = quotesQuery.data;
  const purchases = quotesState?.purchases ?? [];

  useEffect(() => {
    if (purchases.length === 0) {
      setActivePurchaseId(null);
      return;
    }

    if (!activePurchaseId || !purchases.some((purchase) => purchase.id === activePurchaseId)) {
      setActivePurchaseId(purchases[0]?.id ?? null);
    }
  }, [activePurchaseId, purchases]);

  const activePurchase = useMemo(
    () => purchases.find((purchase) => purchase.id === activePurchaseId) ?? null,
    [activePurchaseId, purchases],
  );
  const slots = activePurchase?.slots ?? [];
  const rows = activePurchase?.rows ?? [];
  const comparison = activePurchase?.comparison ?? null;
  const comparisonAnalysis = comparison?.analysis ?? null;
  const availableBudgetItems = useMemo(
    () => (project?.budgetItems ?? []).filter((item) => !item.contextOnly),
    [project?.budgetItems],
  );
  const selectedBudgetItemIds = useMemo(() => rows.map((row) => row.budgetItemId), [rows]);

  const activeSlotNumber =
    activeView === 'slot-1' ? 1 : activeView === 'slot-2' ? 2 : activeView === 'slot-3' ? 3 : null;
  const activeSlot = activeSlotNumber ? slots.find((slot) => slot.slotNumber === activeSlotNumber) ?? null : null;
  const activeSlotPricedCount = activeSlot
    ? rows.filter(
        (row) =>
          row.values.find((entry) => entry.slotNumber === activeSlot.slotNumber)?.unitPrice != null &&
          (row.quantity ?? 0) > 0,
      ).length
    : 0;
  const purchaseDialogPending = quoteMutations.createPurchase.isPending || quoteMutations.updatePurchase.isPending;
  const purchaseDeletePending = quoteMutations.deletePurchase.isPending;

  useEffect(() => {
    setImportPreview(null);
  }, [activePurchase?.id, activeSlotNumber]);

  function handlePurchaseDialogChange(open: boolean) {
    setPurchaseDialogOpen(open);
    if (!open) {
      setEditingPurchase(null);
    }
  }

  function openCreatePurchaseDialog() {
    setEditingPurchase(null);
    setPurchaseDialogOpen(true);
  }

  function openEditPurchaseDialog(purchase: ProjectQuoteState) {
    setEditingPurchase(purchase);
    setPurchaseDialogOpen(true);
  }

  async function handleCreatePurchase(payload: { title: string; notes?: string | null }) {
    try {
      const result = await quoteMutations.createPurchase.mutateAsync(payload);
      setActivePurchaseId(result.purchases[0]?.id ?? null);
      handlePurchaseDialogChange(false);
      toast.success('Compra criada com sucesso.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel criar a compra.');
    }
  }

  async function handleUpdatePurchase(payload: { title: string; notes?: string | null }) {
    if (!editingPurchase) {
      return;
    }

    try {
      await quoteMutations.updatePurchase.mutateAsync({
        purchaseId: editingPurchase.id,
        payload,
      });
      setActivePurchaseId(editingPurchase.id);
      handlePurchaseDialogChange(false);
      toast.success('Compra atualizada com sucesso.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel atualizar a compra.');
    }
  }

  async function handleDeletePurchase(purchase: ProjectQuoteState) {
    const confirmed = window.confirm(
      `Deseja excluir a compra "${purchase.title}"? Os itens do projeto serao mantidos, mas os 3 orcamentos, o mapa comparativo e os vinculos desta compra serao removidos.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      const result = await quoteMutations.deletePurchase.mutateAsync(purchase.id);
      if (activePurchaseId === purchase.id) {
        setActivePurchaseId(result.purchases[0]?.id ?? null);
      }
      if (editingPurchase?.id === purchase.id) {
        handlePurchaseDialogChange(false);
      }
      toast.success('Compra excluida com sucesso.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel excluir a compra.');
    }
  }

  async function handleAddPurchaseItem(budgetItemId: string) {
    if (!activePurchase) {
      toast.error('Crie ou selecione uma compra antes de adicionar itens.');
      return;
    }

    setPendingBudgetItemId(budgetItemId);
    try {
      await quoteMutations.addPurchaseItems.mutateAsync({
        purchaseId: activePurchase.id,
        payload: { budgetItemIds: [budgetItemId] },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel adicionar o item a compra.');
    } finally {
      setPendingBudgetItemId(null);
    }
  }

  async function handleRemovePurchaseItem(budgetItemId: string) {
    if (!activePurchase) {
      return;
    }

    const row = rows.find((entry) => entry.budgetItemId === budgetItemId) ?? null;
    const hasFilledData =
      row?.values.some((value) => value.unitPrice != null || Boolean(value.notes?.trim())) ?? false;

    if (
      hasFilledData &&
      !window.confirm('Remover este item apaga os valores ja lancados nos 3 orcamentos desta compra. Deseja continuar?')
    ) {
      return;
    }

    setPendingBudgetItemId(budgetItemId);
    try {
      await quoteMutations.removePurchaseItem.mutateAsync({
        purchaseId: activePurchase.id,
        budgetItemId,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel remover o item da compra.');
    } finally {
      setPendingBudgetItemId(null);
    }
  }

  async function handleSelectSupplier(slot: ProjectQuoteSlot, supplierId: string | null) {
    if (!activePurchase) {
      return;
    }

    const isChanging = slot.supplierId !== supplierId;
    const needsReset = isChanging && slot.filledItemCount > 0;
    let confirmReset = false;

    if (needsReset) {
      const confirmed = window.confirm(
        'Trocar o fornecedor deste orcamento limpa os valores e observacoes ja preenchidos. Deseja continuar?',
      );
      if (!confirmed) {
        return;
      }
      confirmReset = true;
    }

    await quoteMutations.updateSupplier.mutateAsync({
      purchaseId: activePurchase.id,
      slotNumber: slot.slotNumber,
      payload: { supplierId, confirmReset },
    });
  }

  async function handleSaveRow(
    slotNumber: number,
    budgetItemId: string,
    payload: { unitPrice?: number | null; notes?: string | null },
  ) {
    if (!activePurchase) {
      return;
    }

    await quoteMutations.updateItem.mutateAsync({
      purchaseId: activePurchase.id,
      slotNumber,
      budgetItemId,
      payload,
    });
  }

  async function handleGeneratePurchaseOrders(payload: {
    glpiNumber: string;
    internalReference?: string | null;
    deliveryAddress?: string | null;
    freightType?: string | null;
    paymentTerms?: string | null;
    responsibleName?: string | null;
    responsiblePhone?: string | null;
    expectedDeliveryDate?: string | null;
    notes?: string | null;
  }) {
    if (!activePurchase) {
      return;
    }

    try {
      const result = await quoteMutations.generatePurchaseOrders.mutateAsync({
        purchaseId: activePurchase.id,
        payload,
      });
      toast.success(
        `${result.generatedOrders.length} pedido(s) gerado(s) para ${result.purchaseTitle}.${result.skippedItems > 0 ? ` ${result.skippedItems} item(ns) ficaram pendentes.` : ''}`,
      );
      setGenerateDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel gerar os pedidos.');
    }
  }

  async function handleGenerateRandomValues() {
    if (!activePurchase || !activeSlot) {
      return;
    }

    if (!activeSlot.supplierId) {
      toast.error('Selecione um fornecedor antes de gerar valores de exemplo.');
      return;
    }

    setIsGeneratingRandomValues(true);

    try {
      for (const row of rows) {
        const rowValue = row.values.find((entry) => entry.slotNumber === activeSlot.slotNumber);
        if (rowValue?.unitPrice != null) {
          continue;
        }

        await quoteMutations.updateItem.mutateAsync({
          purchaseId: activePurchase.id,
          slotNumber: activeSlot.slotNumber,
          budgetItemId: row.budgetItemId,
          payload: { unitPrice: generateRandomQuoteUnitPrice() },
        });
      }

      toast.success('Valores de exemplo gerados para o orcamento ativo.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel gerar valores aleatorios.');
    } finally {
      setIsGeneratingRandomValues(false);
    }
  }

  async function handleUploadSupplierQuotePdf(file: File) {
    if (!activePurchase || !activeSlotNumber) {
      return;
    }

    try {
      const preview = await quoteMutations.uploadImportPdf.mutateAsync({
        purchaseId: activePurchase.id,
        slotNumber: activeSlotNumber,
        file,
      });
      setImportPreview(preview);
      toast.success('PDF lido com sucesso. Revise os itens antes de aplicar.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel importar o PDF.');
    }
  }

  async function handleApplySupplierQuotePdf(payload: ProjectQuoteImportApplyPayload) {
    if (!activePurchase || !activeSlotNumber || !importPreview) {
      return;
    }

    const hasExistingValues = importPreview.summary.hasExistingValues;
    if (
      hasExistingValues &&
      !window.confirm(
        'Este orcamento ja possui valores preenchidos. Aplicar a importacao vai substituir os dados atuais desta compra. Deseja continuar?',
      )
    ) {
      return;
    }

    try {
      await quoteMutations.applyImportPdf.mutateAsync({
        purchaseId: activePurchase.id,
        slotNumber: activeSlotNumber,
        documentId: importPreview.document.id,
        payload: {
          ...payload,
          confirmReplace: hasExistingValues ? true : undefined,
        },
      });
      setImportPreview(null);
      setImportDialogOpen(false);
      toast.success('Importacao aplicada ao orcamento.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel aplicar a importacao.');
    }
  }

  async function handleApply() {
    if (!activePurchase) {
      return;
    }

    try {
      const result = await quoteMutations.applyWinner.mutateAsync({
        purchaseId: activePurchase.id,
        mode: 'PER_ITEM',
      });
      toast.success(
        `${result.updatedItems} item(ns) aplicados na compra ${activePurchase.title}.${result.skippedItems > 0 ? ` ${result.skippedItems} item(ns) ficaram sem vencedor unico.` : ''}`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel aplicar os vencedores.');
    }
  }

  async function handleGenerateComparisonReport() {
    if (!activePurchase) {
      return;
    }

    try {
      const result = await quoteMutations.generateComparisonReport.mutateAsync({
        purchaseId: activePurchase.id,
      });
      toast.success(
        `Relatorio do mapa gerado para ${result.purchaseTitle}${result.folderPathLabel ? ` em ${result.folderPathLabel}` : ''}.`,
      );
      await openProjectDocumentInNewTab(projectId, result.documentId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel gerar o relatorio do mapa comparativo.');
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-3xl" />
        <div className="grid gap-3 md:grid-cols-3">
          <Skeleton className="h-28 w-full rounded-3xl" />
          <Skeleton className="h-28 w-full rounded-3xl" />
          <Skeleton className="h-28 w-full rounded-3xl" />
        </div>
        <Skeleton className="h-[480px] w-full rounded-3xl" />
      </div>
    );
  }

  if (projectQuery.isError || quotesQuery.isError || !project) {
    return (
      <EmptyState
        description="Nao foi possivel carregar a estrutura de compras e orcamentos deste projeto."
        icon={CircleDollarSign}
        title="Erro ao carregar orcamentos"
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-border/70">
        <CardHeader className="gap-4 border-b border-border/70 bg-muted/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="neutral">Modulo de compras por orcamento</Badge>
                <Badge variant="warning">3 fornecedores por compra</Badge>
              </div>
              <CardTitle className="text-2xl">Orcamentos por compra</CardTitle>
              <CardDescription className="max-w-3xl text-sm leading-relaxed">
                Cada compra possui seus proprios itens, ate 3 fornecedores, mapa comparativo proprio e pedidos separados
                por fornecedor vencedor.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={openCreatePurchaseDialog}>
                <LayoutGrid className="size-4" aria-hidden />
                Nova compra
              </Button>
              <Button type="button" onClick={() => setManageItemsDialogOpen(true)} disabled={!activePurchase}>
                <FileText className="size-4" aria-hidden />
                Gerenciar itens
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 py-5 md:grid-cols-4">
          <div className="rounded-2xl border border-border/70 bg-card px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Projeto</p>
            <p className="mt-2 font-semibold text-foreground">{project.name}</p>
            <p className="text-sm text-muted-foreground">{project.code}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-card px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Compras</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{purchases.length}</p>
            <p className="text-sm text-muted-foreground">Cada compra tem 3 orcamentos fixos</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-card px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Itens no projeto</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{availableBudgetItems.length}</p>
            <p className="text-sm text-muted-foreground">Itens disponiveis para vincular em compras</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-card px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Compra ativa</p>
            <p className="mt-2 font-semibold text-foreground">{activePurchase?.title || 'Nenhuma selecionada'}</p>
            <p className="text-sm text-muted-foreground">
              {activePurchase ? `${rows.length} item(ns) nesta compra` : 'Crie a primeira compra para comecar'}
            </p>
          </div>
        </CardContent>
      </Card>

      {purchases.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {purchases.map((purchase) => {
            const selected = purchase.id === activePurchaseId;
            const purchaseTotal =
              purchase.comparison.slotTotals.find((slotTotal) => slotTotal.slotNumber === purchase.comparison.overallWinner.slotNumbers[0])
                ?.totalValue ?? purchase.comparison.overallWinner.totalValue;

            return (
              <div
                key={purchase.id}
                className={cn(
                  'rounded-3xl border p-4 text-left transition',
                  selected
                    ? 'border-primary bg-primary/8 shadow-lg shadow-primary/10'
                    : 'border-border/70 bg-card hover:border-primary/35 hover:bg-muted/20',
                )}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{purchase.title}</p>
                      <p className="text-sm text-muted-foreground">{purchase.rows.length} item(ns) vinculados</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {selected ? <Badge variant="success">Ativa</Badge> : <Badge variant="neutral">Compra</Badge>}
                      <Button
                        aria-label={`Editar compra ${purchase.title}`}
                        disabled={purchaseDialogPending || purchaseDeletePending}
                        size="icon"
                        type="button"
                        variant="ghost"
                        onClick={() => openEditPurchaseDialog(purchase)}
                      >
                        <SquarePen className="size-4" aria-hidden />
                      </Button>
                      <Button
                        aria-label={`Excluir compra ${purchase.title}`}
                        disabled={purchaseDeletePending || purchaseDialogPending}
                        size="icon"
                        type="button"
                        variant="ghost"
                        onClick={() => void handleDeletePurchase(purchase)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </div>
                  <button className="block w-full space-y-3 text-left" type="button" onClick={() => setActivePurchaseId(purchase.id)}>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-2xl bg-muted/25 px-3 py-2">
                        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Resolvidos</p>
                        <p className="mt-1 font-semibold text-foreground">{purchase.comparison.resolvedRowCount}</p>
                      </div>
                      <div className="rounded-2xl bg-muted/25 px-3 py-2">
                        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Pendentes</p>
                        <p className="mt-1 font-semibold text-foreground">{purchase.comparison.unresolvedRowCount}</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {purchaseTotal != null ? `Melhor total atual: ${formatCurrency(purchaseTotal)}` : 'Mapa ainda sem total vencedor'}
                    </p>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          actionLabel="Criar primeira compra"
          description="Divida o projeto em compras independentes. Cada compra tera seus itens, seus 3 fornecedores e o proprio mapa comparativo."
          icon={LayoutGrid}
          onAction={openCreatePurchaseDialog}
          title="Nenhuma compra cadastrada"
        />
      )}

      {activePurchase ? (
        <Card className="border-border/70">
          <CardHeader className="gap-4 border-b border-border/70 bg-card/70">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="neutral">Compra ativa</Badge>
                  <Badge variant="warning">{rows.length} item(ns)</Badge>
                </div>
                <CardTitle className="text-xl">{activePurchase.title}</CardTitle>
                <CardDescription className="max-w-3xl">
                  {activePurchase.notes?.trim() || 'Defina os itens desta compra e preencha os 3 orcamentos para comparar por item.'}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={purchaseDialogPending || purchaseDeletePending}
                  onClick={() => openEditPurchaseDialog(activePurchase)}
                >
                  <SquarePen className="size-4" aria-hidden />
                  Editar compra
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={purchaseDeletePending || purchaseDialogPending}
                  onClick={() => void handleDeletePurchase(activePurchase)}
                >
                  <Trash2 className="size-4" aria-hidden />
                  Excluir compra
                </Button>
                <Button type="button" variant="secondary" onClick={() => setManageItemsDialogOpen(true)}>
                  <FileText className="size-4" aria-hidden />
                  Itens da compra
                </Button>
                <Button type="button" variant="secondary" onClick={() => setNewItemDialogOpen(true)}>
                  <FilePlus2 className="size-4" aria-hidden />
                  Novo item no projeto
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 py-6">
            <div className="flex flex-wrap gap-2">
              {viewTabs.map((tab) => (
                <Button
                  key={tab.value}
                  type="button"
                  variant={activeView === tab.value ? 'default' : 'secondary'}
                  onClick={() => setActiveView(tab.value)}
                >
                  {tab.label}
                </Button>
              ))}
            </div>
            {activeView === 'comparison' ? (
              <div className="space-y-4">
                <div className="flex flex-wrap justify-end gap-2 rounded-2xl border border-border/70 bg-card/50 px-4 py-3 shadow-sm">
                  <Button
                    disabled={quoteMutations.generateComparisonReport.isPending || rows.length === 0}
                    type="button"
                    variant="secondary"
                    onClick={() => void handleGenerateComparisonReport()}
                  >
                    <FileText className="size-4" aria-hidden />
                    {quoteMutations.generateComparisonReport.isPending ? 'Gerando relatorio...' : 'Gerar relatorio do mapa'}
                  </Button>
                  <Button
                    disabled={quoteMutations.applyWinner.isPending || (comparison?.resolvedRowCount ?? 0) === 0}
                    type="button"
                    variant="secondary"
                    onClick={() => void handleApply()}
                  >
                    <Trophy className="size-4" aria-hidden />
                    {quoteMutations.applyWinner.isPending ? 'Aplicando...' : 'Aplicar vencedor por item'}
                  </Button>
                  <Button
                    disabled={quoteMutations.generatePurchaseOrders.isPending || (comparison?.resolvedRowCount ?? 0) === 0}
                    type="button"
                    onClick={() => setGenerateDialogOpen(true)}
                  >
                    <ArrowUpFromLine className="size-4" aria-hidden />
                    Gerar pedidos por fornecedor
                  </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="size-4" aria-hidden />
                      <p className="text-xs font-semibold uppercase tracking-[0.14em]">Itens resolvidos</p>
                    </div>
                    <p className="mt-3 text-3xl font-semibold text-foreground">{comparison?.resolvedRowCount ?? 0}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Trophy className="size-4" aria-hidden />
                      <p className="text-xs font-semibold uppercase tracking-[0.14em]">Empates</p>
                    </div>
                    <p className="mt-3 text-3xl font-semibold text-foreground">{comparison?.tieRowCount ?? 0}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CircleDollarSign className="size-4" aria-hidden />
                      <p className="text-xs font-semibold uppercase tracking-[0.14em]">Pendentes</p>
                    </div>
                    <p className="mt-3 text-3xl font-semibold text-foreground">{comparison?.unresolvedRowCount ?? 0}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Store className="size-4" aria-hidden />
                      <p className="text-xs font-semibold uppercase tracking-[0.14em]">Melhor total</p>
                    </div>
                    <p className="mt-3 text-lg font-semibold text-foreground">
                      {currencyOrDash(comparison?.overallWinner.totalValue)}
                    </p>
                  </div>
                </div>

                {comparisonAnalysis ? (
                  <div className="rounded-3xl border border-primary/20 bg-primary/5 p-5">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="success">Analise automatica</Badge>
                          <Badge variant="neutral">{comparisonAnalysis.completeSlotCount} orcamento(s) completos</Badge>
                        </div>
                        <div className="space-y-2">
                          <p className="text-lg font-semibold text-foreground">{comparisonAnalysis.headline}</p>
                          <div className="space-y-1.5">
                            {comparisonAnalysis.summaryLines.map((line, index) => (
                              <p key={`${index}-${line}`} className="text-sm leading-relaxed text-muted-foreground">
                                {line}
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[320px]">
                        <div className="rounded-2xl border border-border/70 bg-card px-4 py-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Melhor fechado</p>
                          <p className="mt-2 text-lg font-semibold text-foreground">{currencyOrDash(comparisonAnalysis.bestTotalValue)}</p>
                          <p className="text-xs text-muted-foreground">
                            {comparisonAnalysis.bestSupplierNames.length > 0
                              ? comparisonAnalysis.bestSupplierNames.join(' | ')
                              : 'Aguardando orcamentos completos'}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-card px-4 py-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Economia vs 2o melhor</p>
                          <p className="mt-2 text-lg font-semibold text-foreground">{currencyOrDash(comparisonAnalysis.savingsValue)}</p>
                          <p className="text-xs text-muted-foreground">{percentOrDash(comparisonAnalysis.savingsPercent)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-3 md:grid-cols-3">
                  {comparison?.slotTotals.map((slotTotal) => {
                    const slotAnalysis =
                      comparisonAnalysis?.itemWinnerCounts.find((entry) => entry.slotNumber === slotTotal.slotNumber) ?? null;

                    return (
                      <div key={slotTotal.slotNumber} className="rounded-2xl border border-border/70 bg-card px-4 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-foreground">Orcamento {slotTotal.slotNumber}</p>
                          <SlotStatusBadge slot={slots.find((slot) => slot.slotNumber === slotTotal.slotNumber) ?? slots[0]!} />
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{slotTotal.supplierName || 'Fornecedor nao definido'}</p>
                        <p className="mt-4 text-xl font-semibold text-foreground">{currencyOrDash(slotTotal.totalValue)}</p>
                        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                          <p>
                            {slotTotal.filledItemCount}/{slotTotal.itemCount} item(ns) precificados
                          </p>
                          <p>Vitorias por item: {slotAnalysis?.uniqueWinCount ?? 0}</p>
                          <p>Empates compartilhados: {slotAnalysis?.tieCount ?? 0}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {rows.length === 0 ? (
                  <EmptyState
                    actionLabel="Abrir orcamento 1"
                    description="A compra ainda nao possui itens comparaveis, mas voce ja pode abrir um orcamento, escolher o fornecedor e importar o PDF."
                    icon={ArrowUpFromLine}
                    onAction={() => setActiveView('slot-1')}
                    secondaryActionLabel="Adicionar itens"
                    onSecondaryAction={() => setManageItemsDialogOpen(true)}
                    title="Mapa comparativo sem itens"
                  />
                ) : (
                  <ComparisonTable rows={rows} slots={slots} />
                )}
              </div>
            ) : activeSlot ? (
              <div className="space-y-4">
                <div className="rounded-3xl border border-border/70 bg-muted/20 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="neutral">Orcamento {activeSlot.slotNumber}</Badge>
                        <SlotStatusBadge slot={activeSlot} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-lg font-semibold text-foreground">{slotDisplayName(activeSlot)}</p>
                        <p className="text-sm text-muted-foreground">
                          {activeSlot.supplierId
                            ? `${activeSlot.filledItemCount}/${activeSlot.itemCount} item(ns) preenchidos`
                            : 'Nenhum fornecedor definido para este orcamento'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span>Progresso: {getQuoteFillProgress(activeSlot.filledItemCount, activeSlot.itemCount)}%</span>
                        <span>Total atual: {currencyOrDash(activeSlot.totalValue)}</span>
                        <span>Itens com preco: {activeSlotPricedCount}</span>
                      </div>
                      {activeSlot.latestImportedDocument ? (
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <Building2 className="size-4" aria-hidden />
                          <span>Ultimo PDF importado em {formatDate(activeSlot.latestImportedDocument.createdAt)}</span>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                            onClick={() =>
                              void openProjectDocumentInNewTab(projectId, activeSlot.latestImportedDocument!.id).catch(
                                (err) =>
                                  toast.error(err instanceof Error ? err.message : 'Nao foi possivel abrir o arquivo.'),
                              )
                            }
                          >
                            Abrir arquivo
                            <ExternalLink className="size-3.5" aria-hidden />
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="secondary" onClick={() => setSupplierPickerSlot(activeSlot)}>
                        <Store className="size-4" aria-hidden />
                        {activeSlot.supplierId ? 'Trocar fornecedor' : 'Selecionar fornecedor'}
                      </Button>
                      <Button
                        disabled={!activeSlot.supplierId}
                        type="button"
                        variant="secondary"
                        onClick={() => setImportDialogOpen(true)}
                      >
                        <ArrowUpFromLine className="size-4" aria-hidden />
                        Importar PDF
                      </Button>
                      <Button
                        disabled={!activeSlot.supplierId || isGeneratingRandomValues || rows.length === 0}
                        type="button"
                        variant="secondary"
                        onClick={() => void handleGenerateRandomValues()}
                      >
                        <Dices className="size-4" aria-hidden />
                        {isGeneratingRandomValues ? 'Gerando...' : 'Preencher exemplo'}
                      </Button>
                    </div>
                  </div>
                </div>

                {!activeSlot.supplierId ? (
                  <EmptyState
                    actionLabel="Selecionar fornecedor"
                    description="Defina o fornecedor deste orcamento antes de preencher valores ou importar o PDF."
                    icon={Store}
                    onAction={() => setSupplierPickerSlot(activeSlot)}
                    title="Fornecedor nao selecionado"
                  />
                ) : rows.length === 0 ? (
                  <EmptyState
                    actionLabel="Importar PDF"
                    description="Voce pode importar o PDF do fornecedor mesmo sem itens vinculados. Na aplicacao, os itens do PDF poderao entrar como itens extras desta compra."
                    icon={ArrowUpFromLine}
                    onAction={() => setImportDialogOpen(true)}
                    secondaryActionLabel="Adicionar itens"
                    onSecondaryAction={() => setManageItemsDialogOpen(true)}
                    title="Compra sem itens vinculados"
                  />
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-border/70">
                    <table className="w-full min-w-[980px] border-collapse text-sm">
                      <thead className="bg-muted/35">
                        <tr>
                          <th className="border-b border-border/70 px-3 py-3 text-left font-semibold text-foreground">
                            Descricao
                          </th>
                          <th className="border-b border-border/70 px-3 py-3 text-center font-semibold text-foreground">
                            Qtd.
                          </th>
                          <th className="border-b border-border/70 px-3 py-3 text-right font-semibold text-foreground">
                            Valor unitario
                          </th>
                          <th className="border-b border-border/70 px-3 py-3 text-right font-semibold text-foreground">
                            Total
                          </th>
                          <th className="border-b border-border/70 px-3 py-3 text-left font-semibold text-foreground">
                            Observacoes
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <QuoteLineRow
                            key={`${activeSlot.slotNumber}-${row.budgetItemId}`}
                            disabled={quoteMutations.updateItem.isPending}
                            row={row}
                            slotNumber={activeSlot.slotNumber}
                            onSave={(budgetItemId, payload) => handleSaveRow(activeSlot.slotNumber, budgetItemId, payload)}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <SupplierPickerDialog
        open={Boolean(supplierPickerSlot)}
        slot={supplierPickerSlot}
        onOpenChange={(open) => {
          if (!open) {
            setSupplierPickerSlot(null);
          }
        }}
        onSelectSupplier={(supplierId) => handleSelectSupplier(supplierPickerSlot!, supplierId)}
      />

      <QuotePurchaseDialog
        open={purchaseDialogOpen}
        purchase={editingPurchase}
        pending={purchaseDialogPending}
        onOpenChange={handlePurchaseDialogChange}
        onSubmit={editingPurchase ? handleUpdatePurchase : handleCreatePurchase}
      />

      <ManageQuotePurchaseItemsDialog
        open={manageItemsDialogOpen}
        items={availableBudgetItems}
        pendingBudgetItemId={pendingBudgetItemId}
        selectedItemIds={selectedBudgetItemIds}
        onOpenChange={setManageItemsDialogOpen}
        onAdd={handleAddPurchaseItem}
        onRemove={handleRemovePurchaseItem}
      />

      <GeneratePurchaseOrderDialog
        open={generateDialogOpen}
        pending={quoteMutations.generatePurchaseOrders.isPending}
        projectName={project.name}
        purchase={activePurchase}
        onOpenChange={setGenerateDialogOpen}
        onSubmit={handleGeneratePurchaseOrders}
      />

      <SupplierQuoteImportDialog
        open={importDialogOpen}
        applyPending={quoteMutations.applyImportPdf.isPending}
        budgetRows={rows}
        preview={importPreview}
        slot={activeSlot}
        uploadPending={quoteMutations.uploadImportPdf.isPending}
        onOpenChange={(open) => {
          setImportDialogOpen(open);
          if (!open) {
            setImportPreview(null);
          }
        }}
        onApply={handleApplySupplierQuotePdf}
        onUpload={handleUploadSupplierQuotePdf}
      />

      <NewQuoteItemDialog
        open={newItemDialogOpen}
        projectId={projectId}
        onOpenChange={setNewItemDialogOpen}
        onCreated={async (item) => {
          if (activePurchase) {
            await handleAddPurchaseItem(item.id);
          }
        }}
      />
    </div>
  );
}
