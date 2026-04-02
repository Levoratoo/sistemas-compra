'use client';

import { type ChangeEvent, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpFromLine,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Dices,
  ExternalLink,
  FileText,
  FilePlus2,
  LayoutGrid,
  LoaderCircle,
  Search,
  Store,
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
import { getProjectDocumentDownloadUrl } from '@/services/documents-service';
import type {
  ItemCategory,
  ProjectQuoteImportAction,
  ProjectQuoteImportApplyPayload,
  ProjectQuoteImportPreview,
  ProjectQuoteImportRow,
  ProjectQuoteRow,
  ProjectQuoteSlot,
} from '@/types/api';

type QuoteView = 'slot-1' | 'slot-2' | 'slot-3' | 'comparison';

const viewTabs: Array<{ value: QuoteView; label: string }> = [
  { value: 'slot-1', label: 'Orçamento 1' },
  { value: 'slot-2', label: 'Orçamento 2' },
  { value: 'slot-3', label: 'Orçamento 3' },
  { value: 'comparison', label: 'Mapa comparativo' },
];

type QuoteImportDecisionMap = Record<
  number,
  {
    action: ProjectQuoteImportAction;
    matchedBudgetItemId: string | null;
    validationChoice: 'YES' | 'NO' | null;
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
        validationChoice: row.requiresNameValidation ? null : 'YES',
      },
    ]),
  );
}

function isReviewValidationResolved(
  row: ProjectQuoteImportRow,
  decision: QuoteImportDecisionMap[number] | undefined,
) {
  if (!row.requiresNameValidation) {
    return true;
  }

  const action = decision?.action ?? row.suggestedAction;
  const matchedBudgetItemId = decision?.matchedBudgetItemId ?? row.matchedBudgetItemId;

  if (action === 'CREATE_EXTRA' || action === 'IGNORE') {
    return true;
  }

  if (action !== 'APPLY' || !matchedBudgetItemId) {
    return false;
  }

  if (matchedBudgetItemId !== row.matchedBudgetItemId) {
    return true;
  }

  return decision?.validationChoice === 'YES';
}

function currencyOrDash(value: number | null | undefined) {
  return value == null ? '—' : formatCurrency(value);
}

function slotDisplayName(slot: ProjectQuoteSlot) {
  return slot.supplier?.tradeName || slot.supplier?.legalName || `Orçamento ${slot.slotNumber}`;
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
                Item extra do fornecedor
              </Badge>
            ) : null}
          </div>
          {row.specification ? <p className="text-xs leading-relaxed text-muted-foreground">{row.specification}</p> : null}
          <p className="text-xs text-muted-foreground">{getItemCategoryLabel(row.itemCategory)}</p>
          {row.supplierQuoteExtraItem ? (
            <p className="text-xs font-medium text-amber-900">
              Nao encontrada no edital, mas presente no orcamento
            </p>
          ) : null}
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
          placeholder="Observações do orçamento"
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
  projectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot: ProjectQuoteSlot | null;
  onSelectSupplier: (supplierId: string | null) => Promise<void>;
  projectId: string;
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
            <DialogDescription>
              Escolha o fornecedor deste orçamento ou cadastre um novo sem sair da tela.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto px-6 py-5">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Buscar por razão social, fantasia, documento ou contato"
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
              <EmptyState
                description="Não foi possível carregar os fornecedores."
                title="Erro ao consultar fornecedores"
              />
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
        documentationProjectId={projectId}
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
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
      toast.error('Informe a descrição do item.');
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error('Informe uma quantidade válida maior que zero.');
      return;
    }

    try {
      await createItem.mutateAsync({
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
      toast.success('Novo item adicionado ao projeto e aos orçamentos.');
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível criar o item.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo item para orçamento</DialogTitle>
          <DialogDescription>
            Este item será criado no projeto inteiro e aparecerá também no controle de compras e no checklist.
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
            <Label htmlFor="quote-item-name">Descrição</Label>
            <Input id="quote-item-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quote-item-unit">Unidade</Label>
            <Input id="quote-item-unit" value={unit} onChange={(event) => setUnit(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quote-item-specification">Especificação</Label>
            <Textarea
              id="quote-item-specification"
              rows={3}
              value={specification}
              onChange={(event) => setSpecification(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quote-item-notes">Observações</Label>
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

function GeneratePurchaseOrderDialog({
  open,
  onOpenChange,
  slot,
  projectName,
  onSubmit,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot: ProjectQuoteSlot | null;
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
      toast.error('Informe o GLPI para gerar a ordem de compra.');
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
          <DialogTitle>Gerar ordem de compra</DialogTitle>
          <DialogDescription>
            O PDF será gerado para {slot ? `o orçamento ${slot.slotNumber}` : 'o orçamento selecionado'} de{' '}
            {projectName}.
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
            <Label htmlFor="quote-order-reference">Referência interna</Label>
            <Input
              id="quote-order-reference"
              value={internalReference}
              onChange={(event) => setInternalReference(event.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="quote-order-delivery-address">Endereço de entrega</Label>
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
            <Label htmlFor="quote-order-payment-terms">Condição de pagamento</Label>
            <Input
              id="quote-order-payment-terms"
              value={paymentTerms}
              onChange={(event) => setPaymentTerms(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quote-order-responsible-name">Responsável</Label>
            <Input
              id="quote-order-responsible-name"
              value={responsibleName}
              onChange={(event) => setResponsibleName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quote-order-responsible-phone">Telefone do responsável</Label>
            <Input
              id="quote-order-responsible-phone"
              value={responsiblePhone}
              onChange={(event) => setResponsiblePhone(event.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="quote-order-expected-delivery-date">Previsão de entrega</Label>
            <Input
              id="quote-order-expected-delivery-date"
              type="date"
              value={expectedDeliveryDate}
              onChange={(event) => setExpectedDeliveryDate(event.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="quote-order-notes">Observações</Label>
            <Textarea id="quote-order-notes" rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={pending} type="button" onClick={() => void handleSubmit()}>
            {pending ? 'Gerando PDF...' : 'Gerar ordem de compra'}
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
  projectId,
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
  projectId: string;
  budgetRows: ProjectQuoteRow[];
  preview: ProjectQuoteImportPreview | null;
  uploadPending: boolean;
  applyPending: boolean;
  onUpload: (file: File) => Promise<void>;
  onApply: (payload: ProjectQuoteImportApplyPayload) => Promise<void>;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [decisions, setDecisions] = useState<QuoteImportDecisionMap>({});
  const [reviewPopupOpen, setReviewPopupOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      setSelectedFile(null);
      setDecisions({});
      setReviewPopupOpen(false);
      return;
    }

    if (preview) {
      setDecisions(buildInitialQuoteImportDecisions(preview));
      setSelectedFile(null);
      setReviewPopupOpen(preview.rows.some((row) => row.requiresNameValidation));
    } else {
      setDecisions({});
      setReviewPopupOpen(false);
    }
  }, [open, preview]);

  const itemOptions = useMemo(
    () =>
      budgetRows.map((row) => ({
        id: row.budgetItemId,
        label: row.description,
        detail: row.specification,
      })),
    [budgetRows],
  );
  const reviewRows = useMemo(() => preview?.rows.filter((row) => row.requiresNameValidation) ?? [], [preview]);
  const unresolvedReviewRows = useMemo(
    () => reviewRows.filter((row) => !isReviewValidationResolved(row, decisions[row.rowIndex])),
    [decisions, reviewRows],
  );
  const unresolvedReviewCount = unresolvedReviewRows.length;

  function getDecision(row: ProjectQuoteImportRow) {
    return (
      decisions[row.rowIndex] ?? {
        action: row.suggestedAction,
        matchedBudgetItemId: row.matchedBudgetItemId,
        validationChoice: row.requiresNameValidation ? null : 'YES',
      }
    );
  }

  function updateDecision(row: ProjectQuoteImportRow, updates: Partial<QuoteImportDecisionMap[number]>) {
    setDecisions((current) => ({
      ...current,
      [row.rowIndex]: {
        ...(current[row.rowIndex] ?? {
          action: row.suggestedAction,
          matchedBudgetItemId: row.matchedBudgetItemId,
          validationChoice: row.requiresNameValidation ? null : 'YES',
        }),
        ...updates,
      },
    }));
  }

  function approveAllSuggestedReviewRows() {
    if (!preview) {
      return;
    }

    setDecisions((current) => {
      const next = { ...current };
      for (const row of preview.rows.filter((entry) => entry.requiresNameValidation && entry.matchedBudgetItemId)) {
        next[row.rowIndex] = {
          action: 'APPLY',
          matchedBudgetItemId: row.matchedBudgetItemId,
          validationChoice: 'YES',
        };
      }
      return next;
    });
  }

  function openFilePicker() {
    if (!slot?.supplierId || uploadPending) {
      return;
    }

    fileInputRef.current?.click();
  }

  async function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);

    if (!file) {
      return;
    }

    try {
      await onUpload(file);
    } finally {
      event.target.value = '';
    }
  }

  async function handleApply() {
    if (!preview) {
      toast.error('Importe um PDF antes de aplicar a revisao.');
      return;
    }

    if (unresolvedReviewCount > 0) {
      toast.error('Valide os nomes parecidos antes de aplicar a importacao.');
      setReviewPopupOpen(true);
      return;
    }

    await onApply({
      rows: preview.rows.map((row) => ({
        rowIndex: row.rowIndex,
        action: getDecision(row).action,
        matchedBudgetItemId: getDecision(row).matchedBudgetItemId,
      })),
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Importar PDF do fornecedor</DialogTitle>
          <DialogDescription>
            Envie o PDF do fornecedor para o orcamento {slot?.slotNumber ?? 'selecionado'} e revise o casamento dos itens antes de aplicar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-[30px] border border-primary/15 bg-[linear-gradient(135deg,rgba(236,253,245,0.95),rgba(255,255,255,0.98)_42%,rgba(239,246,255,0.92))] p-5 shadow-sm shadow-primary/10">
            <input
              ref={fileInputRef}
              accept="application/pdf,.pdf"
              className="hidden"
              disabled={!slot?.supplierId || uploadPending}
              type="file"
              onChange={(event) => void handleFileSelection(event)}
            />

            <div className="flex flex-col gap-5 xl:flex-row xl:items-stretch xl:justify-between">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Upload</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={slot?.supplierId ? 'secondary' : 'warning'}>
                    {slot?.supplierId ? `Fornecedor: ${slotDisplayName(slot)}` : 'Selecione um fornecedor primeiro'}
                  </Badge>
                  {uploadPending ? (
                    <Badge variant="warning">
                      <LoaderCircle className="mr-1 size-3 animate-spin" aria-hidden />
                      Analisando PDF
                    </Badge>
                  ) : null}
                  {preview ? (
                    <Badge variant={preview.extractionMode === 'OCR' ? 'warning' : 'success'}>
                      {preview.extractionMode === 'OCR' ? 'Lido com OCR' : 'Texto direto'}
                    </Badge>
                  ) : null}
                  {reviewRows.length > 0 ? (
                    <Badge variant={unresolvedReviewCount > 0 ? 'warning' : 'success'}>
                      {unresolvedReviewCount > 0
                        ? `${unresolvedReviewCount} nome(s) parecidos pendentes`
                        : 'Nomes parecidos validados'}
                    </Badge>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground">
                  O arquivo fica salvo em Documentos e o sistema sugere o casamento dos itens com o orcamento atual.
                </p>
              </div>

              <button
                className={cn(
                  'group flex min-h-[152px] w-full flex-col justify-between rounded-[28px] border border-white/70 bg-white/80 p-5 text-left shadow-[0_18px_45px_-28px_rgba(15,23,42,0.35)] transition-all xl:max-w-[440px]',
                  slot?.supplierId && !uploadPending && 'hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_24px_50px_-26px_rgba(13,148,136,0.38)]',
                  (!slot?.supplierId || uploadPending) && 'cursor-not-allowed opacity-85',
                )}
                disabled={!slot?.supplierId || uploadPending}
                type="button"
                onClick={openFilePicker}
              >
                <div className="flex items-start gap-4">
                  <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                    {uploadPending ? <LoaderCircle className="size-6 animate-spin" aria-hidden /> : <ArrowUpFromLine className="size-6" aria-hidden />}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-base font-semibold text-foreground">
                      {uploadPending
                        ? 'Lendo o PDF do fornecedor'
                        : selectedFile
                          ? 'Trocar PDF e importar novamente'
                          : 'Clique para escolher o PDF'}
                    </p>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {slot?.supplierId
                        ? uploadPending
                          ? 'O sistema esta extraindo os itens, conferindo os valores e montando a previa automaticamente.'
                          : 'Upload em 1 clique. Escolha o arquivo e a leitura comeca na hora, sem precisar confirmar em outro botao.'
                        : 'Defina o fornecedor deste orcamento para habilitar a importacao do PDF.'}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Arquivo</p>
                    <p className="truncate text-sm font-medium text-foreground">
                      {selectedFile?.name ?? (preview?.document.originalFileName || 'Nenhum PDF selecionado ainda')}
                    </p>
                  </div>
                  <span className="inline-flex items-center rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {uploadPending ? 'Processando' : '1 clique'}
                  </span>
                </div>
              </button>
            </div>

            {preview ? (
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-border/70 bg-white/80 px-4 py-3">
                <FileText className="size-4 text-primary" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{preview.document.originalFileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {preview.document.folderPathLabel || 'Documentos'}
                    {preview.quoteNumber ? ` | Orcamento ${preview.quoteNumber}` : ''}
                  </p>
                </div>
                <a
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
                  href={getProjectDocumentDownloadUrl(projectId, preview.document.id)}
                  rel="noreferrer"
                  target="_blank"
                >
                  Abrir PDF
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              </div>
            ) : null}

            {!preview && selectedFile && !uploadPending ? (
              <p className="mt-3 text-xs text-muted-foreground">Arquivo pronto para leitura: {selectedFile.name}</p>
            ) : null}
          </div>

          {uploadPending ? (
            <div className="rounded-[30px] border border-primary/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,253,250,0.88))] px-8 py-14 shadow-sm">
              <div className="mx-auto flex max-w-xl flex-col items-center text-center">
                <div className="flex size-20 items-center justify-center rounded-[28px] bg-primary/12 text-primary shadow-inner">
                  <LoaderCircle className="size-10 animate-spin" aria-hidden />
                </div>
                <p className="mt-6 text-xl font-semibold text-foreground">Importando e analisando o PDF</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Estamos lendo o arquivo, extraindo os itens do fornecedor e comparando com os itens do projeto para montar a revisao.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                  <Badge variant="secondary">{slot?.supplierId ? slotDisplayName(slot) : 'Fornecedor'}</Badge>
                  {selectedFile ? <Badge variant="neutral">{selectedFile.name}</Badge> : null}
                </div>
              </div>
            </div>
          ) : preview ? (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-2xl border border-border/70 bg-card px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Itens lidos</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{preview.summary.rowCount}</p>
                </div>
                <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/70 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800/80">Alta confianca</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{preview.summary.highConfidenceCount}</p>
                </div>
                <div className="rounded-2xl border border-amber-200/70 bg-amber-50/80 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-900/80">Revisar</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{preview.summary.reviewCount}</p>
                </div>
                <div className="rounded-2xl border border-sky-200/70 bg-sky-50/80 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-900/80">Itens extras</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{preview.summary.extraCandidateCount}</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-card px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Data / fornecedor</p>
                  <p className="mt-2 text-sm font-medium text-foreground">{preview.detectedSupplierName || preview.supplierName}</p>
                  <p className="text-xs text-muted-foreground">{preview.quoteDate ? formatDate(preview.quoteDate) : 'Sem data'}</p>
                </div>
              </div>

              {preview.summary.hasExistingValues ? (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <p>Este slot ja possui valores preenchidos. Ao aplicar a importacao, os valores atuais serao substituidos mediante confirmacao.</p>
                </div>
              ) : null}

              {reviewRows.length > 0 ? (
                <div className="flex flex-col gap-3 rounded-2xl border border-sky-200/80 bg-sky-50/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-sky-950">Validacao de nomes parecidos</p>
                    <p className="text-xs text-sky-900/85">
                      Confirme os itens similares do edital antes de aplicar a importacao.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={unresolvedReviewCount > 0 ? 'warning' : 'success'}>
                      {unresolvedReviewCount > 0 ? `${unresolvedReviewCount} pendente(s)` : 'Validacao concluida'}
                    </Badge>
                    <Button className="rounded-2xl" size="sm" type="button" variant="outline" onClick={() => setReviewPopupOpen(true)}>
                      Validar nomes parecidos
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="overflow-x-auto rounded-2xl border border-border/70">
                <table className="w-full min-w-[1200px] border-collapse text-sm">
                  <thead className="bg-muted/35">
                    <tr>
                      <th className="border-b border-border/70 px-3 py-3 text-left font-semibold text-foreground">Linha do PDF</th>
                      <th className="border-b border-border/70 px-3 py-3 text-left font-semibold text-foreground">Valores</th>
                      <th className="border-b border-border/70 px-3 py-3 text-left font-semibold text-foreground">Confianca</th>
                      <th className="border-b border-border/70 px-3 py-3 text-left font-semibold text-foreground">Acao</th>
                      <th className="border-b border-border/70 px-3 py-3 text-left font-semibold text-foreground">Item do projeto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => {
                      const decision = getDecision(row);
                      const validationResolved = isReviewValidationResolved(row, decision);

                      return (
                        <tr
                          key={row.rowIndex}
                          className={cn(
                            'border-b border-border/60 align-top',
                            row.confidence === 'HIGH' && 'bg-emerald-500/[0.04]',
                            row.confidence === 'REVIEW' && 'bg-amber-500/[0.06]',
                            row.confidence === 'UNMATCHED' && 'bg-sky-500/[0.05]',
                          )}
                        >
                          <td className="px-3 py-3">
                            <div className="space-y-1">
                              <p className="font-medium text-foreground">{row.description}</p>
                              <p className="text-xs leading-relaxed text-muted-foreground">{row.rawText}</p>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="space-y-1 text-sm">
                              <p className="font-medium text-foreground">{currencyOrDash(row.unitPrice)}</p>
                              <p className="text-xs text-muted-foreground">
                                Qtd. fornecedor: {formatNumber(row.quantity)} | Total: {currencyOrDash(row.totalValue)}
                              </p>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-2">
                              <Badge variant={row.confidence === 'HIGH' ? 'success' : row.confidence === 'REVIEW' ? 'warning' : 'neutral'}>
                                {row.confidence === 'HIGH' ? 'Alta' : row.confidence === 'REVIEW' ? 'Revisar' : 'Nao encontrado'}
                              </Badge>
                              {row.quantityConflict ? <Badge variant="warning">Qtd. divergente</Badge> : null}
                              {row.requiresNameValidation ? (
                                <Badge variant={validationResolved ? 'success' : 'warning'}>
                                  {validationResolved ? 'Validado' : 'Validacao pendente'}
                                </Badge>
                              ) : null}
                            </div>
                            {row.matchScore != null ? (
                              <p className="mt-2 text-xs text-muted-foreground">Score: {(row.matchScore * 100).toFixed(0)}%</p>
                            ) : null}
                            {row.requiresNameValidation && !validationResolved ? (
                              <p className="mt-2 text-xs font-medium text-amber-900">
                                Abra o popup de nomes parecidos para confirmar este item.
                              </p>
                            ) : null}
                          </td>
                          <td className="px-3 py-3">
                            <Select
                              className="min-w-[180px]"
                              value={decision.action}
                              onChange={(event) =>
                                updateDecision(row, {
                                  action: event.target.value as ProjectQuoteImportAction,
                                })
                              }
                            >
                              <option value="APPLY">Aplicar no item</option>
                              <option value="CREATE_EXTRA">Criar item extra</option>
                              <option value="IGNORE">Ignorar linha</option>
                            </Select>
                          </td>
                          <td className="px-3 py-3">
                            <Select
                              className="min-w-[320px]"
                              disabled={decision.action !== 'APPLY'}
                              value={decision.matchedBudgetItemId ?? ''}
                              onChange={(event) =>
                                updateDecision(row, {
                                  matchedBudgetItemId: event.target.value || null,
                                  ...(row.requiresNameValidation && event.target.value && event.target.value !== row.matchedBudgetItemId
                                    ? { validationChoice: 'NO' as const }
                                    : {}),
                                })
                              }
                            >
                              <option value="">Selecionar item do projeto</option>
                              {itemOptions.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.label}
                                  {item.detail ? ` | ${item.detail}` : ''}
                                </option>
                              ))}
                            </Select>
                            {decision.action === 'CREATE_EXTRA' ? (
                              <p className="mt-2 text-xs font-medium text-amber-900">Nao encontrada no edital, mas presente no orcamento</p>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="rounded-[30px] border border-dashed border-primary/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] px-8 py-14 shadow-sm">
              <div className="mx-auto flex max-w-xl flex-col items-center text-center">
                <div className="flex size-20 items-center justify-center rounded-[28px] bg-primary/10 text-primary">
                  <FileText className="size-10" aria-hidden />
                </div>
                <p className="mt-6 text-xl font-semibold text-foreground">Nenhum PDF importado ainda</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Escolha o PDF do fornecedor e a previa sera gerada automaticamente para voce revisar os itens antes de aplicar.
                </p>
                <Button
                  className="mt-6 rounded-2xl px-5"
                  disabled={!slot?.supplierId}
                  type="button"
                  onClick={openFilePicker}
                >
                  <ArrowUpFromLine className="size-4" aria-hidden />
                  {slot?.supplierId ? 'Escolher PDF agora' : 'Selecione um fornecedor primeiro'}
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button disabled={!preview || applyPending || unresolvedReviewCount > 0} type="button" onClick={() => void handleApply()}>
            {applyPending ? 'Aplicando...' : 'Aplicar importacao'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
      <Dialog open={reviewPopupOpen} onOpenChange={setReviewPopupOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Validar nomes parecidos</DialogTitle>
            <DialogDescription>
              Compare o nome vindo do PDF com a sugestao do edital e marque sim ou nao antes de aplicar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="warning">{reviewRows.length} linha(s) para validar</Badge>
                <Badge variant={unresolvedReviewCount > 0 ? 'warning' : 'success'}>
                  {unresolvedReviewCount > 0 ? `${unresolvedReviewCount} pendente(s)` : 'Tudo validado'}
                </Badge>
              </div>
              <Button
                disabled={reviewRows.length === 0}
                type="button"
                variant="secondary"
                onClick={() => approveAllSuggestedReviewRows()}
              >
                Selecionar todos os parecidos
              </Button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border/70">
              <table className="w-full min-w-[980px] border-collapse text-sm">
                <thead className="bg-muted/35">
                  <tr>
                    <th className="border-b border-border/70 px-3 py-3 text-left font-semibold text-foreground">Nome do orcamento / PDF</th>
                    <th className="border-b border-border/70 px-3 py-3 text-left font-semibold text-foreground">Sugestao do edital</th>
                    <th className="border-b border-border/70 px-3 py-3 text-left font-semibold text-foreground">Flag</th>
                    <th className="border-b border-border/70 px-3 py-3 text-left font-semibold text-foreground">Escolha manual</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewRows.map((row) => {
                    const decision = getDecision(row);
                    const candidateIds = new Set(row.candidateMatches.map((candidate) => candidate.budgetItemId));
                    const prioritizedOptions = row.candidateMatches.map((candidate) => {
                      const item = itemOptions.find((option) => option.id === candidate.budgetItemId);
                      return {
                        id: candidate.budgetItemId,
                        label: item?.label ?? candidate.name,
                        detail: item?.detail ?? candidate.specification,
                        score: candidate.score,
                      };
                    });
                    const remainingOptions = itemOptions
                      .filter((item) => !candidateIds.has(item.id))
                      .map((item) => ({
                        ...item,
                        score: null as number | null,
                      }));
                    const orderedOptions = [...prioritizedOptions, ...remainingOptions];

                    return (
                      <tr key={`review-${row.rowIndex}`} className="border-b border-border/60 align-top">
                        <td className="px-3 py-3">
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">{row.description}</p>
                            <p className="text-xs text-muted-foreground">{row.rawText}</p>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="space-y-2">
                            <p className="font-medium text-foreground">{row.matchedBudgetItemName || 'Sem sugestao automatica'}</p>
                            <div className="flex flex-wrap gap-2">
                              {row.matchScore != null ? (
                                <Badge variant="warning">Score {(row.matchScore * 100).toFixed(0)}%</Badge>
                              ) : null}
                              {row.candidateMatches.map((candidate) => (
                                <Badge key={`${row.rowIndex}-${candidate.budgetItemId}`} variant="secondary">
                                  {candidate.name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              className="rounded-2xl"
                              size="sm"
                              type="button"
                              variant={decision.validationChoice === 'YES' ? 'default' : 'outline'}
                              onClick={() =>
                                updateDecision(row, {
                                  action: 'APPLY',
                                  matchedBudgetItemId: row.matchedBudgetItemId,
                                  validationChoice: 'YES',
                                })
                              }
                            >
                              Sim
                            </Button>
                            <Button
                              className="rounded-2xl"
                              size="sm"
                              type="button"
                              variant={decision.validationChoice === 'NO' ? 'default' : 'outline'}
                              onClick={() =>
                                updateDecision(row, {
                                  action: 'APPLY',
                                  matchedBudgetItemId: null,
                                  validationChoice: 'NO',
                                })
                              }
                            >
                              Nao
                            </Button>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <Select
                            className="min-w-[320px]"
                            disabled={decision.validationChoice !== 'NO'}
                            value={decision.validationChoice === 'NO' ? decision.matchedBudgetItemId ?? '' : ''}
                            onChange={(event) =>
                              updateDecision(row, {
                                action: 'APPLY',
                                matchedBudgetItemId: event.target.value || null,
                                validationChoice: 'NO',
                              })
                            }
                          >
                            <option value="">Escolher outro item do edital</option>
                            {orderedOptions.map((item) => (
                              <option key={`${row.rowIndex}-${item.id}`} value={item.id}>
                                {item.label}
                                {item.detail ? ` | ${item.detail}` : ''}
                                {'score' in item && item.score != null ? ` | ${(item.score * 100).toFixed(0)}%` : ''}
                              </option>
                            ))}
                          </Select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setReviewPopupOpen(false)}>
              Voltar para a revisao
            </Button>
            <Button disabled={unresolvedReviewCount > 0} type="button" onClick={() => setReviewPopupOpen(false)}>
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
            <th className="border-b border-border/70 px-3 py-3 text-left font-semibold text-foreground">Descrição</th>
            <th className="border-b border-border/70 px-3 py-3 text-center font-semibold text-foreground">Qtd.</th>
            {slots.map((slot) => (
              <th key={slot.slotNumber} className="border-b border-border/70 px-3 py-3 text-left font-semibold text-foreground">
                Orçamento {slot.slotNumber}
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
                    {row.supplierQuoteExtraItem ? (
                      <Badge className="border-amber-300/80 bg-amber-100 text-amber-950" variant="warning">
                        Extra
                      </Badge>
                    ) : null}
                  </div>
                  {row.specification ? <p className="text-xs text-muted-foreground">{row.specification}</p> : null}
                  {row.supplierQuoteExtraItem ? (
                    <p className="text-xs font-medium text-amber-900">
                      Nao encontrada no edital, mas presente no orcamento
                    </p>
                  ) : null}
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
                        `Orçamento ${row.winner.slotNumbers[0]}`}
                    </p>
                    <p className="text-xs text-muted-foreground">{currencyOrDash(row.winner.totalValue)}</p>
                  </div>
                ) : row.winner.status === 'TIE' ? (
                  <div className="space-y-1">
                    <Badge variant="warning">Empate</Badge>
                    <p className="text-xs text-muted-foreground">
                      {row.winner.slotNumbers.map((slotNumber) => `Orçamento ${slotNumber}`).join(' | ')}
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
  const [supplierPickerSlot, setSupplierPickerSlot] = useState<ProjectQuoteSlot | null>(null);
  const [newItemDialogOpen, setNewItemDialogOpen] = useState(false);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<ProjectQuoteImportPreview | null>(null);
  const [isGeneratingRandomValues, setIsGeneratingRandomValues] = useState(false);

  const loading = projectQuery.isLoading || quotesQuery.isLoading;
  const project = projectQuery.data;
  const quotesState = quotesQuery.data;
  const slots = quotesState?.slots ?? [];
  const rows = quotesState?.rows ?? [];
  const comparison = quotesState?.comparison;

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

  useEffect(() => {
    setImportPreview(null);
  }, [activeSlotNumber]);

  async function handleSelectSupplier(slot: ProjectQuoteSlot, supplierId: string | null) {
    const isChanging = slot.supplierId !== supplierId;
    const needsReset = isChanging && slot.filledItemCount > 0;
    let confirmReset = false;

    if (needsReset) {
      const confirmed = window.confirm(
        'Trocar o fornecedor deste orçamento limpa os valores e observações já preenchidos. Deseja continuar?',
      );
      if (!confirmed) {
        return;
      }
      confirmReset = true;
    }

    try {
      await quoteMutations.updateSupplier.mutateAsync({
        slotNumber: slot.slotNumber,
        payload: { supplierId, confirmReset },
      });
      toast.success(
        supplierId ? `Fornecedor definido no orçamento ${slot.slotNumber}.` : `Fornecedor removido do orçamento ${slot.slotNumber}.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar o fornecedor do orçamento.');
      throw error;
    }
  }

  async function handleSaveRow(
    slotNumber: number,
    budgetItemId: string,
    payload: { unitPrice?: number | null; notes?: string | null },
  ) {
    try {
      await quoteMutations.updateItem.mutateAsync({
        slotNumber,
        budgetItemId,
        payload,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar a linha do orçamento.');
      throw error;
    }
  }

  async function handleSelectQuoteSlot(slotNumber: number) {
    try {
      await quoteMutations.selectSlot.mutateAsync(slotNumber);
      toast.success(`Orçamento ${slotNumber} selecionado para gerar a ordem de compra.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível selecionar o orçamento.');
    }
  }

  async function handleGeneratePurchaseOrder(payload: {
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
    try {
      const result = await quoteMutations.generatePurchaseOrder.mutateAsync(payload);
      toast.success(`PDF gerado em ${result.folderPathLabel || 'Ordens de compra'}.`);
      setGenerateDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível gerar a ordem de compra.');
    }
  }

  async function handleGenerateRandomValues() {
    if (!activeSlot?.supplierId) {
      toast.error('Selecione um fornecedor antes de gerar valores aleatórios.');
      return;
    }

    if (rows.length === 0) {
      toast.error('Não existem itens disponíveis para preencher neste orçamento.');
      return;
    }

    if (
      activeSlotPricedCount > 0 &&
      !window.confirm('Isso vai substituir os valores unitários já preenchidos neste orçamento. Deseja continuar?')
    ) {
      return;
    }

    setIsGeneratingRandomValues(true);

    try {
      for (const row of rows) {
        await quoteMutations.updateItem.mutateAsync({
          slotNumber: activeSlot.slotNumber,
          budgetItemId: row.budgetItemId,
          payload: { unitPrice: generateRandomQuoteUnitPrice() },
        });
      }

      toast.success(`Valores aleatórios gerados em ${rows.length} item(ns).`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível gerar os valores aleatórios.');
    } finally {
      setIsGeneratingRandomValues(false);
    }
  }

  async function handleUploadSupplierQuotePdf(file: File) {
    if (!activeSlot) {
      toast.error('Selecione um orcamento antes de importar o PDF.');
      return;
    }

    try {
      const nextPreview = await quoteMutations.uploadImportPdf.mutateAsync({
        slotNumber: activeSlot.slotNumber,
        file,
      });
      setImportPreview(nextPreview);
      toast.success(`PDF lido com ${nextPreview.rows.length} linha(s) para revisao.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel importar o PDF do fornecedor.');
      throw error;
    }
  }

  async function handleApplySupplierQuotePdf(payload: ProjectQuoteImportApplyPayload) {
    if (!activeSlot || !importPreview) {
      toast.error('Importe um PDF antes de aplicar a revisao.');
      return;
    }

    let nextPayload = payload;
    if (importPreview.summary.hasExistingValues) {
      const confirmed = window.confirm(
        'Aplicar este PDF vai substituir os valores ja preenchidos neste orcamento. Deseja continuar?',
      );

      if (!confirmed) {
        return;
      }

      nextPayload = {
        ...payload,
        confirmReplace: true,
      };
    }

    try {
      await quoteMutations.applyImportPdf.mutateAsync({
        slotNumber: activeSlot.slotNumber,
        documentId: importPreview.document.id,
        payload: nextPayload,
      });
      toast.success('PDF aplicado ao orcamento com sucesso.');
      setImportDialogOpen(false);
      setImportPreview(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel aplicar a importacao do PDF.');
      throw error;
    }
  }

  async function handleApply(mode: 'OVERALL' | 'PER_ITEM') {
    const confirmed = window.confirm(
      mode === 'OVERALL'
        ? 'Aplicar o vencedor geral atualizará fornecedor aprovado, valor unitário e valor total dos itens do projeto. Continuar?'
        : 'Aplicar os vencedores por item atualizará fornecedor aprovado, valor unitário e valor total de cada item resolvido. Continuar?',
    );

    if (!confirmed) {
      return;
    }

    try {
      const result = await quoteMutations.applyWinner.mutateAsync(mode);
      toast.success(
        mode === 'OVERALL'
          ? `Vencedor geral aplicado em ${result.updatedItems} item(ns).`
          : `Vencedores por item aplicados em ${result.updatedItems} item(ns).`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível aplicar o vencedor.');
    }
  }

  if (loading) {
    return (
      <div className="page-sections">
        <Card>
          <CardContent className="space-y-4 p-6">
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-4 w-full max-w-2xl" />
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-[480px] w-full rounded-2xl" />
      </div>
    );
  }

  if (projectQuery.isError || quotesQuery.isError || !project || !quotesState) {
    return (
      <EmptyState
        description="Não foi possível carregar o módulo de orçamento deste projeto."
        title="Falha ao abrir orçamento"
      />
    );
  }

  const canApplyOverall = comparison?.overallWinner.status === 'UNIQUE';
  const canApplyPerItem = (comparison?.resolvedRowCount ?? 0) > 0;
  const canGeneratePurchaseOrder = Boolean(activeSlot?.isSelected && activeSlot?.supplierId && activeSlotPricedCount > 0);
  const completedSlotsCount = slots.filter((slot) => slot.isComplete).length;
  const selectedSlotNumber = slots.find((slot) => slot.isSelected)?.slotNumber ?? null;
  const activeSlotProgress = activeSlot ? getQuoteFillProgress(activeSlot.filledItemCount, activeSlot.itemCount) : 0;

  return (
    <div className="page-sections">
      <Card className="relative overflow-hidden border-primary/15 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.18),transparent_36%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.14),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] shadow-xl shadow-slate-950/5">
        <div className="pointer-events-none absolute inset-x-10 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <CardHeader className="relative border-b border-white/70 pb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/12 text-primary shadow-sm shadow-primary/10 ring-1 ring-primary/15">
                  <CircleDollarSign className="size-5" aria-hidden />
                </div>
                Orçamentos do projeto
              </CardTitle>
              <CardDescription className="max-w-3xl text-[15px] leading-7">
                Cada orçamento representa um fornecedor para toda a lista do projeto. Os itens vêm automaticamente do mesmo conjunto usado em Controle de compras e Checklist.
              </CardDescription>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="bg-white/90 px-3 py-1 text-slate-700 ring-slate-200/90">
                  3 orçamentos fixos
                </Badge>
                <Badge variant="success" className="px-3 py-1">
                  {completedSlotsCount} completo(s)
                </Badge>
                <Badge variant="neutral" className="px-3 py-1">
                  {selectedSlotNumber ? `Orçamento ${selectedSlotNumber} selecionado` : 'Nenhum orçamento selecionado'}
                </Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <Button className="h-11 rounded-2xl px-5 shadow-sm shadow-primary/10" type="button" variant="secondary" onClick={() => setNewItemDialogOpen(true)}>
                <FilePlus2 className="size-4" aria-hidden />
                Novo item
              </Button>
              {activeView === 'comparison' ? (
                <>
                  <Button
                    className="h-11 rounded-2xl px-5"
                    disabled={!canApplyOverall || quoteMutations.applyWinner.isPending}
                    type="button"
                    variant="outline"
                    onClick={() => void handleApply('OVERALL')}
                  >
                    <Trophy className="size-4" aria-hidden />
                    Aplicar vencedor geral
                  </Button>
                  <Button
                    className="h-11 rounded-2xl px-5 shadow-sm shadow-primary/15"
                    disabled={!canApplyPerItem || quoteMutations.applyWinner.isPending}
                    type="button"
                    onClick={() => void handleApply('PER_ITEM')}
                  >
                    <CheckCircle2 className="size-4" aria-hidden />
                    Aplicar vencedores por item
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {viewTabs.map((tab) => {
          const slot = tab.value.startsWith('slot-')
            ? slots.find((entry) => entry.slotNumber === Number(tab.value.replace('slot-', ''))) ?? null
            : null;
          const active = activeView === tab.value;
          const slotProgress = slot ? getQuoteFillProgress(slot.filledItemCount, slot.itemCount) : 0;

          return (
            <button
              key={tab.value}
              className={cn(
                'relative overflow-hidden rounded-[28px] border px-5 py-5 text-left transition duration-200',
                active
                  ? 'border-primary/35 bg-[linear-gradient(180deg,rgba(20,184,166,0.14),rgba(255,255,255,0.96))] shadow-xl shadow-primary/10'
                  : 'border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-lg hover:shadow-slate-950/5',
              )}
              type="button"
              onClick={() => setActiveView(tab.value)}
            >
              <div
                className={cn(
                  'absolute inset-x-5 top-0 h-1 rounded-b-full transition-opacity',
                  active ? 'bg-gradient-to-r from-primary via-teal-400 to-sky-400 opacity-100' : 'bg-gradient-to-r from-primary/60 to-sky-300/70 opacity-0',
                )}
              />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-3">
                  <p className="text-base font-semibold text-foreground">{tab.label}</p>
                  {slot ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">{slotDisplayName(slot)}</p>
                      {slot.isSelected ? <Badge variant="secondary">Selecionado</Badge> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{slot.filledItemCount}/{slot.itemCount} itens</span>
                      <span>{slotProgress}% concluído</span>
                      <span>{currencyOrDash(slot.totalValue)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200/80">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          active ? 'bg-gradient-to-r from-primary to-sky-400' : 'bg-gradient-to-r from-primary/80 to-sky-300',
                        )}
                        style={{ width: `${slotProgress}%` }}
                      />
                    </div>
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">Comparação entre os 3 orçamentos</p>
                  )}
                </div>
                {slot ? <SlotStatusBadge slot={slot} /> : <Badge variant="secondary">Resumo</Badge>}
              </div>
            </button>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          actionLabel="Criar item"
          description="Ainda não existem itens de compra neste projeto. Cadastre um item manual para começar os orçamentos."
          icon={LayoutGrid}
          onAction={() => setNewItemDialogOpen(true)}
          title="Nenhum item disponível para orçamento"
        />
      ) : activeView === 'comparison' ? (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            {slots.map((slot) => {
              const isOverallWinner = comparison?.overallWinner.slotNumbers.includes(slot.slotNumber) ?? false;

              return (
                <Card
                  key={slot.slotNumber}
                  className={cn(
                    'border-border/70 shadow-sm',
                    isOverallWinner && comparison?.overallWinner.status === 'UNIQUE' && 'border-emerald-400/70 bg-emerald-500/[0.06]',
                    isOverallWinner && comparison?.overallWinner.status === 'TIE' && 'border-amber-300/80 bg-amber-500/[0.06]',
                  )}
                >
                  <CardHeader className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">Orçamento {slot.slotNumber}</CardTitle>
                        <CardDescription>{slotDisplayName(slot)}</CardDescription>
                      </div>
                      <SlotStatusBadge slot={slot} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-muted/25 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Total</p>
                        <p className="mt-2 text-lg font-semibold text-foreground">{currencyOrDash(slot.totalValue)}</p>
                      </div>
                      <div className="rounded-2xl bg-muted/25 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Preenchido</p>
                        <p className="mt-2 text-lg font-semibold text-foreground">
                          {slot.filledItemCount}/{slot.itemCount}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-lg">Mapa comparativo</CardTitle>
                <CardDescription>Menor valor por item e total geral do fornecedor.</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="success">{comparison?.resolvedRowCount ?? 0} item(ns) resolvidos</Badge>
                <Badge variant="warning">{comparison?.tieRowCount ?? 0} empate(s)</Badge>
                <Badge variant="neutral">{comparison?.unresolvedRowCount ?? 0} pendente(s)</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Vencedor geral</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {comparison?.overallWinner.status === 'UNIQUE' ? (
                    <>
                      <Badge variant="success">Menor total geral</Badge>
                      <span className="font-medium text-foreground">
                        {slots.find((slot) => slot.slotNumber === comparison.overallWinner.slotNumbers[0])?.supplier?.tradeName ||
                          slots.find((slot) => slot.slotNumber === comparison.overallWinner.slotNumbers[0])?.supplier?.legalName ||
                          `Orçamento ${comparison.overallWinner.slotNumbers[0]}`}
                      </span>
                      <span className="tabular-nums text-muted-foreground">{currencyOrDash(comparison.overallWinner.totalValue)}</span>
                    </>
                  ) : comparison?.overallWinner.status === 'TIE' ? (
                    <>
                      <Badge variant="warning">Empate geral</Badge>
                      <span className="text-muted-foreground">
                        {comparison.overallWinner.slotNumbers.map((slotNumber) => `Orçamento ${slotNumber}`).join(' | ')}
                      </span>
                    </>
                  ) : (
                    <>
                      <Badge variant="neutral">Sem vencedor geral</Badge>
                      <span className="text-muted-foreground">Preencha integralmente os 3 orçamentos para comparar o total.</span>
                    </>
                  )}
                </div>
              </div>

              <ComparisonTable rows={rows} slots={slots} />
            </CardContent>
          </Card>
        </>
      ) : activeSlot ? (
        <>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)]">
            <Card className="relative overflow-hidden border-primary/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(240,253,250,0.9))] shadow-xl shadow-slate-950/5">
              <CardHeader className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4 rounded-[28px] border border-white/70 bg-white/60 p-5 backdrop-blur-sm">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Store className="size-5 text-primary" aria-hidden />
                      <CardTitle className="text-lg">Fornecedor do orçamento {activeSlot.slotNumber}</CardTitle>
                    </div>
                    <CardDescription>
                      Se trocar o fornecedor depois de preencher valores, o sistema limpa o orçamento deste slot mediante confirmação.
                    </CardDescription>
                  </div>
                  <SlotStatusBadge slot={activeSlot} />
                </div>

                <div className="rounded-[28px] border border-primary/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(236,253,245,0.88))] p-6 shadow-inner shadow-primary/5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Fornecedor atual</p>
                      <p className="text-xl font-semibold text-foreground">{slotDisplayName(activeSlot)}</p>
                      {activeSlot.supplier ? (
                        <p className="text-sm text-muted-foreground">
                          {[activeSlot.supplier.documentNumber, activeSlot.supplier.phone, activeSlot.supplier.email]
                            .filter(Boolean)
                            .join(' | ') || 'Sem dados complementares'}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">Selecione um fornecedor para habilitar a tabela.</p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <Button
                        className="h-11 rounded-2xl px-5"
                        disabled={quoteMutations.selectSlot.isPending || activeSlot.isSelected}
                        type="button"
                        onClick={() => void handleSelectQuoteSlot(activeSlot.slotNumber)}
                        variant={activeSlot.isSelected ? 'secondary' : 'outline'}
                      >
                        {activeSlot.isSelected ? 'Orçamento selecionado' : 'Selecionar orçamento'}
                      </Button>
                      <Button className="h-11 rounded-2xl px-5 shadow-sm shadow-primary/15" type="button" onClick={() => setSupplierPickerSlot(activeSlot)}>
                        <Building2 className="size-4" aria-hidden />
                        {activeSlot.supplier ? 'Trocar fornecedor' : 'Selecionar fornecedor'}
                      </Button>
                      <Button
                        className="h-11 rounded-2xl px-5"
                        disabled={!activeSlot.supplierId}
                        type="button"
                        variant="outline"
                        onClick={() => setImportDialogOpen(true)}
                      >
                        <ArrowUpFromLine className="size-4" aria-hidden />
                        Importar PDF do fornecedor
                      </Button>
                    </div>
                  </div>
                  {activeSlot.latestImportedDocument ? (
                    <a
                      className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-900 transition-colors hover:bg-sky-100"
                      href={getProjectDocumentDownloadUrl(projectId, activeSlot.latestImportedDocument.id)}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <FileText className="size-3.5" aria-hidden />
                      Ultimo PDF importado
                      <ExternalLink className="size-3.5" aria-hidden />
                    </a>
                  ) : null}
                </div>
                {activeSlot.latestImportedDocument ? (
                  <div className="rounded-2xl border border-sky-200/70 bg-sky-50/70 px-4 py-3 text-sm text-sky-950">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{activeSlot.latestImportedDocument.originalFileName}</p>
                        <p className="text-xs text-sky-900/80">
                          {activeSlot.latestImportedDocument.folderPathLabel || 'Documentos'}
                          {activeSlot.latestImportedDocument.documentDate
                            ? ` | ${formatDate(activeSlot.latestImportedDocument.documentDate)}`
                            : ''}
                        </p>
                      </div>
                      <a
                        className="inline-flex items-center gap-1 text-xs font-semibold text-sky-900 underline-offset-4 hover:underline"
                        href={getProjectDocumentDownloadUrl(projectId, activeSlot.latestImportedDocument.id)}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Abrir PDF
                        <ExternalLink className="size-3.5" aria-hidden />
                      </a>
                    </div>
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  {activeSlot.isSelected ? <Badge variant="secondary">Este é o orçamento selecionado</Badge> : null}
                  <Badge variant={activeSlotPricedCount > 0 ? 'success' : 'neutral'}>
                    {activeSlotPricedCount} item(ns) com preço
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    className="hidden"
                    disabled={quoteMutations.selectSlot.isPending || activeSlot.isSelected}
                    type="button"
                    variant="outline"
                    onClick={() => void handleSelectQuoteSlot(activeSlot.slotNumber)}
                  >
                    Selecionar orçamento
                  </Button>
                  <Button
                    className="h-11 rounded-2xl px-5 shadow-sm shadow-primary/15"
                    disabled={!canGeneratePurchaseOrder || quoteMutations.generatePurchaseOrder.isPending}
                    type="button"
                    onClick={() => setGenerateDialogOpen(true)}
                  >
                    Gerar ordem de compra
                  </Button>
                </div>
              </CardHeader>
            </Card>

            <Card className="relative overflow-hidden border-sky-200/60 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.16),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.99),rgba(241,245,249,0.93))] shadow-xl shadow-slate-950/5">
              <CardHeader className="space-y-5">
                <div className="flex items-start justify-between gap-4 rounded-[28px] border border-white/70 bg-white/70 px-5 py-4 backdrop-blur-sm">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700/80">Preenchimento</p>
                    <p className="text-sm text-muted-foreground">Acompanhe a evolução deste orçamento em tempo real.</p>
                  </div>
                  <div className="rounded-2xl bg-sky-50 px-4 py-3 text-right ring-1 ring-sky-100">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700/80">Progresso</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{activeSlotProgress}%</p>
                  </div>
                </div>
                <CardTitle className="text-lg">Resumo deste orçamento</CardTitle>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200/80">
                  <div className="h-full rounded-full bg-gradient-to-r from-sky-400 via-primary to-teal-400 transition-all" style={{ width: `${activeSlotProgress}%` }} />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[24px] bg-white/80 px-4 py-4 ring-1 ring-slate-200/80">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Itens</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{activeSlot.itemCount}</p>
                  </div>
                  <div className="rounded-[24px] bg-emerald-50/80 px-4 py-4 ring-1 ring-emerald-100">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Preenchidos</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{activeSlot.filledItemCount}</p>
                  </div>
                  <div className="rounded-[24px] bg-sky-50/80 px-4 py-4 ring-1 ring-sky-100">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Total</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{currencyOrDash(activeSlot.totalValue)}</p>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </div>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-lg">Linhas do orçamento</CardTitle>
                <CardDescription>
                  Descrição e quantidade vêm automaticamente do projeto. Preencha o valor unitário e observações deste fornecedor.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  className="h-auto min-h-7 max-w-[min(100%,18rem)] shrink-0 gap-1.5 whitespace-normal rounded-xl px-2 py-1 text-center text-[10px] font-semibold leading-tight normal-case"
                  disabled={!activeSlot.supplierId || quoteMutations.uploadImportPdf.isPending}
                  size="sm"
                  type="button"
                  title="Importa um PDF do fornecedor, interpreta os valores e abre a revisao antes de aplicar."
                  variant="secondary"
                  onClick={() => setImportDialogOpen(true)}
                >
                  <ArrowUpFromLine className="size-3.5 shrink-0" aria-hidden />
                  <span>{quoteMutations.uploadImportPdf.isPending ? 'Lendo PDF...' : 'Importar PDF do fornecedor'}</span>
                </Button>
                <Button
                  className="h-auto min-h-7 max-w-[min(100%,18rem)] shrink-0 gap-1.5 whitespace-normal rounded-xl px-2 py-1 text-center text-[10px] font-semibold leading-tight normal-case"
                  disabled={!activeSlot.supplierId || isGeneratingRandomValues || rows.length === 0}
                  size="sm"
                  type="button"
                  title="Preenche os valores unitários deste orçamento com dados aleatórios para testes."
                  variant="secondary"
                  onClick={() => void handleGenerateRandomValues()}
                >
                  <Dices className="size-3.5 shrink-0" aria-hidden />
                  <span>{isGeneratingRandomValues ? 'Gerando valores...' : 'Gerar informações aleatórias'}</span>
                </Button>
                <Badge variant={activeSlot.supplierId ? 'secondary' : 'warning'}>
                  {activeSlot.supplierId ? 'Tabela habilitada' : 'Selecione um fornecedor'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-2xl border border-border/70">
                <table className="w-full min-w-[880px] border-collapse text-sm">
                  <thead className="bg-muted/35">
                    <tr>
                      <th className="border-b border-border/70 px-3 py-3 text-left font-semibold text-foreground">Descrição</th>
                      <th className="border-b border-border/70 px-3 py-3 text-center font-semibold text-foreground">Qtd.</th>
                      <th className="border-b border-border/70 px-3 py-3 text-left font-semibold text-foreground">Valor unitário</th>
                      <th className="border-b border-border/70 px-3 py-3 text-left font-semibold text-foreground">Valor total</th>
                      <th className="border-b border-border/70 px-3 py-3 text-left font-semibold text-foreground">Observações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <QuoteLineRow
                        key={`${activeSlot.slotNumber}-${row.budgetItemId}`}
                        disabled={!activeSlot.supplierId || isGeneratingRandomValues}
                        row={row}
                        slotNumber={activeSlot.slotNumber}
                        onSave={(budgetItemId, payload) => handleSaveRow(activeSlot.slotNumber, budgetItemId, payload)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}

      <SupplierPickerDialog
        open={Boolean(supplierPickerSlot)}
        projectId={projectId}
        slot={supplierPickerSlot}
        onOpenChange={(next) => {
          if (!next) {
            setSupplierPickerSlot(null);
          }
        }}
        onSelectSupplier={async (supplierId) => {
          if (!supplierPickerSlot) {
            return;
          }
          await handleSelectSupplier(supplierPickerSlot, supplierId);
          setSupplierPickerSlot(null);
        }}
      />

      <GeneratePurchaseOrderDialog
        open={generateDialogOpen}
        slot={activeSlot}
        projectName={project.name}
        pending={quoteMutations.generatePurchaseOrder.isPending}
        onOpenChange={setGenerateDialogOpen}
        onSubmit={handleGeneratePurchaseOrder}
      />

      <SupplierQuoteImportDialog
        open={importDialogOpen}
        slot={activeSlot}
        projectId={projectId}
        budgetRows={rows}
        preview={importPreview}
        uploadPending={quoteMutations.uploadImportPdf.isPending}
        applyPending={quoteMutations.applyImportPdf.isPending}
        onOpenChange={(next) => {
          setImportDialogOpen(next);
          if (!next) {
            setImportPreview(null);
          }
        }}
        onUpload={handleUploadSupplierQuotePdf}
        onApply={handleApplySupplierQuotePdf}
      />

      <NewQuoteItemDialog open={newItemDialogOpen} onOpenChange={setNewItemDialogOpen} projectId={projectId} />
    </div>
  );
}
