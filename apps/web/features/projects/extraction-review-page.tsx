'use client';

import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Dices, FileText, FileUp, LoaderCircle, Plus, ShoppingCart, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useProjectMutations, useProjectQuery } from '@/hooks/use-projects';
import { formatApiValidationToastMessage } from '@/lib/format-validation-error';
import { getDocumentTypeLabel } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { DocumentType, ExtractedField, ItemCategory, ProjectDetail } from '@/types/api';
import { importProjectDocumentFromUpload, type ApplyExtractionPayload } from '@/services/projects-service';

import {
  formatBudgetLinePreview,
  guessItemCategory,
  isEditalBudgetLineContextOnly,
  parseBudgetLineJson,
  parseQuantity,
  pickBidUnitValue,
} from '@/features/projects/extraction-review/extraction-helpers';

const MIN_BUDGET_COL_PX = 40;
const BUDGET_COL_STORAGE_KEY = 'sitecompras:extraction-review:budget-cols';
/** Larguras padrão (px): descrição, função/cargo, cat, orig, qtd, vlr unit., vlr total */
const DEFAULT_BUDGET_COL_WIDTHS = [360, 148, 72, 48, 52, 110, 110] as const;
const BUDGET_COL_COUNT = DEFAULT_BUDGET_COL_WIDTHS.length;

function loadBudgetColWidths(): number[] {
  if (typeof window === 'undefined') {
    return [...DEFAULT_BUDGET_COL_WIDTHS];
  }
  try {
    const raw = localStorage.getItem(BUDGET_COL_STORAGE_KEY);
    if (!raw) return [...DEFAULT_BUDGET_COL_WIDTHS];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [...DEFAULT_BUDGET_COL_WIDTHS];
    }
    /** Migração: 6 colunas (layout antigo) → insere coluna Função. */
    if (parsed.length === 6) {
      const nums = parsed.map((n) =>
        typeof n === 'number' && Number.isFinite(n) ? Math.max(MIN_BUDGET_COL_PX, Math.round(n)) : MIN_BUDGET_COL_PX,
      );
      const [desc, cat, orig, qtd, vu, vt] = nums;
      return [
        Math.max(MIN_BUDGET_COL_PX, desc - 48),
        148,
        cat,
        orig,
        qtd,
        vu,
        vt,
      ];
    }
    if (parsed.length !== BUDGET_COL_COUNT) {
      return [...DEFAULT_BUDGET_COL_WIDTHS];
    }
    return parsed.map((n) =>
      typeof n === 'number' && Number.isFinite(n) ? Math.max(MIN_BUDGET_COL_PX, Math.round(n)) : MIN_BUDGET_COL_PX,
    );
  } catch {
    return [...DEFAULT_BUDGET_COL_WIDTHS];
  }
}

const ITEM_CATEGORY_OPTIONS: { value: ItemCategory; label: string }[] = [
  { value: 'UNIFORM', label: 'Uniforme' },
  { value: 'EPI', label: 'EPI' },
  { value: 'EQUIPMENT', label: 'Equipamento' },
  { value: 'CONSUMABLE', label: 'Consumo' },
  { value: 'OTHER', label: 'Outro' },
];

type BudgetDraft = {
  id: string;
  name: string;
  itemCategory: ItemCategory;
  plannedQuantity: number | null;
  bidUnitValue: number | null;
  /** Teto da rubrica (valor máximo permitido). */
  rubricMaxValue: number | null;
  /** Valor efetivamente comprado. */
  purchasedValue: number | null;
  roleReference: string | null;
  sourcePage: number | null;
  sourceExcerpt: string | null;
  /** Presente só na revisão logo após extração (antes de aplicar ao projeto). */
  extractedSource?: 'edital' | 'edital8' | 'editalRr' | 'map';
  /** Trecho normativo do edital (ex. cláusulas 8.7.x) — sem previsão de compra/valores. */
  contextOnly: boolean;
};

function budgetSourceAbbrev(b: BudgetDraft): string {
  if (b.contextOnly) return 'Ref.';
  if (b.extractedSource === 'edital') return 'S7';
  if (b.extractedSource === 'edital8') return 'S8';
  if (b.extractedSource === 'editalRr') return 'TR';
  if (b.extractedSource === 'map') return 'Mapa';
  if (b.sourceExcerpt) return 'Doc';
  return '—';
}

/** Só para testes manuais — preenche qtd e valores de rubrica sem alterar descrição/categoria. */
function fillRandomBudgetDrafts(items: BudgetDraft[]): BudgetDraft[] {
  return items.map((b) => {
    if (b.contextOnly) return b;
    const q = Math.floor(Math.random() * 25) + 1;
    const unit = Math.round((Math.random() * 480 + 5) * 100) / 100;
    const total = Math.round(q * unit * 100) / 100;
    return {
      ...b,
      plannedQuantity: q,
      bidUnitValue: unit,
      rubricMaxValue: total,
    };
  });
}

function budgetRowTooltip(b: BudgetDraft): string | undefined {
  const parts: string[] = [];
  if (b.roleReference) parts.push(`Contexto: ${b.roleReference}`);
  if (b.sourceExcerpt) parts.push(`Trecho: ${b.sourceExcerpt}`);
  if (b.sourcePage != null) parts.push(`Página: ${b.sourcePage}`);
  return parts.length ? parts.join('\n\n') : undefined;
}

function buildBudgetDrafts(
  documentId: string,
  data: ProjectDetail,
  budgetFields: ExtractedField[],
): BudgetDraft[] {
  const existing = data.budgetItems.filter((b) => b.sourceDocumentId === documentId);
  if (existing.length) {
    return existing
      .map((b) => ({
        id: b.id,
        name: b.name,
        itemCategory: b.itemCategory,
        plannedQuantity: b.plannedQuantity,
        bidUnitValue: b.bidUnitValue,
        rubricMaxValue: b.rubricMaxValue ?? null,
        purchasedValue: b.purchasedValue ?? null,
        roleReference: b.roleReference,
        sourcePage: b.sourcePage,
        sourceExcerpt: b.sourceExcerpt,
        contextOnly: b.contextOnly ?? false,
      }))
      .filter((b) => !b.contextOnly);
  }
  return budgetFields.map((f) => {
    const j = parseBudgetLineJson(f.proposedValue);
    const rawDesc = j?.description ?? '';
    const d =
      rawDesc && j?.itemRef
        ? `${j.itemRef} — ${rawDesc}`
        : (j?.description ?? formatBudgetLinePreview(f.proposedValue));
    const bid = pickBidUnitValue(j ?? {});
    const src = j?.source;
    const fromEdital7 =
      src === 'edital_secao_7' ||
      src === 'edital_uniforme_kit_table' ||
      src === 'edital_anexo_tipo_qtd' ||
      src === 'edital_cuiaba_uniforme_anexo' ||
      src === 'edital_cuiaba_epi_anexo' ||
      src === 'edital_cuiaba_equipamentos_anexo';
    const fromEdital8 =
      src === 'edital_secao_8_uniforme_epi' || src === 'edital_secao_8_epi_lista';
    const fromEditalRr =
      src === 'edital_secao_7_roraima' ||
      src === 'edital_tr_tipo_qtd_roraima' ||
      src === 'edital_epi_item_qtde' ||
      src === 'edital_epi_posto_lista';
    const fromEdital = fromEdital7 || fromEdital8 || fromEditalRr;
    const contextOnly = isEditalBudgetLineContextOnly(j);
    let extractedSource: BudgetDraft['extractedSource'];
    if (fromEdital7) extractedSource = 'edital';
    else if (fromEdital8) extractedSource = 'edital8';
    else if (fromEditalRr) extractedSource = 'editalRr';
    else if (j?.description) extractedSource = 'map';
    else extractedSource = undefined;
    const roleRef = (j?.role && String(j.role).trim()) || f.recordGroupKey || null;
    return {
      id: f.id,
      name: d.slice(0, 500),
      itemCategory: guessItemCategory(rawDesc || d, roleRef, src),
      plannedQuantity: contextOnly ? null : parseQuantity(j ?? {}),
      bidUnitValue: contextOnly ? null : bid,
      rubricMaxValue: null,
      purchasedValue: null,
      roleReference: roleRef,
      sourcePage: f.sourcePage,
      sourceExcerpt: f.sourceExcerpt,
      contextOnly,
      extractedSource,
    };
  }).filter((b) => !b.contextOnly);
}

function buildApplyPayload(budgetDrafts: BudgetDraft[]): ApplyExtractionPayload {
  return {
    roles: [],
    budgetItems: budgetDrafts
      .filter((b) => b.name.trim())
      .map((b) => ({
        itemCategory: b.itemCategory,
        name: b.name.trim(),
        plannedQuantity: b.plannedQuantity,
        bidUnitValue: b.bidUnitValue,
        rubricMaxValue: b.rubricMaxValue,
        purchasedValue: b.purchasedValue,
        contextOnly: b.contextOnly,
        hasBidReference: b.contextOnly ? false : b.rubricMaxValue != null && b.rubricMaxValue > 0,
        roleReference: b.roleReference,
        sourcePage: b.sourcePage,
        sourceExcerpt: b.sourceExcerpt,
      })),
    tasks: [],
  };
}

type EditalPreviewInfo = {
  rowCount: number;
  matchedProfile: string | null;
  ocrUsed: boolean;
  requiresComplementaryAnnexUpload: boolean;
  annexReferenceHints: string[];
};

function parseEditalPreviewInfo(document: ProjectDetail['documents'][number] | undefined): EditalPreviewInfo | null {
  const raw = document?.previewJson;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const preview = raw as { editalMateriais?: unknown };
  if (!preview.editalMateriais || typeof preview.editalMateriais !== 'object' || Array.isArray(preview.editalMateriais)) {
    return null;
  }

  const editalMateriais = preview.editalMateriais as Record<string, unknown>;
  const annexReferenceHints = Array.isArray(editalMateriais.annexReferenceHints)
    ? editalMateriais.annexReferenceHints.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : [];

  return {
    rowCount:
      typeof editalMateriais.rowCount === 'number' && Number.isFinite(editalMateriais.rowCount)
        ? editalMateriais.rowCount
        : 0,
    matchedProfile: typeof editalMateriais.matchedProfile === 'string' ? editalMateriais.matchedProfile : null,
    ocrUsed: editalMateriais.ocrUsed === true,
    requiresComplementaryAnnexUpload: editalMateriais.requiresComplementaryAnnexUpload === true,
    annexReferenceHints,
  };
}

type ExtractionReviewPageProps = {
  projectId: string;
  documentId: string;
};

export function ExtractionReviewPage({ projectId, documentId }: ExtractionReviewPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useProjectQuery(projectId);
  const { applyExtraction } = useProjectMutations(projectId);

  const document = useMemo(() => data?.documents.find((d) => d.id === documentId), [data, documentId]);
  const editalPreview = useMemo(() => parseEditalPreviewInfo(document), [document]);

  const initKey = useRef<string | null>(null);
  const annexInputRef = useRef<HTMLInputElement | null>(null);
  const [budgetItems, setBudgetItems] = useState<BudgetDraft[]>([]);
  const [budgetColWidths, setBudgetColWidths] = useState<number[]>(loadBudgetColWidths);
  const [annexDocumentType, setAnnexDocumentType] = useState<DocumentType>('NOTICE');
  const [annexUploading, setAnnexUploading] = useState(false);
  const [annexFileName, setAnnexFileName] = useState<string | null>(null);
  const budgetColWidthsRef = useRef(budgetColWidths);
  budgetColWidthsRef.current = budgetColWidths;

  function handleBudgetColumnResizeStart(e: React.PointerEvent, boundaryIndex: number) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const start = [...budgetColWidthsRef.current];
    const i = boundaryIndex;
    if (i < 0 || i >= start.length - 1) return;

    const onMove = (ev: PointerEvent) => {
      const delta = ev.clientX - startX;
      const next = [...start];
      if (next[i]! + delta < MIN_BUDGET_COL_PX || next[i + 1]! - delta < MIN_BUDGET_COL_PX) return;
      next[i] = Math.round(start[i]! + delta);
      next[i + 1] = Math.round(start[i + 1]! - delta);
      budgetColWidthsRef.current = next;
      setBudgetColWidths(next);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      try {
        localStorage.setItem(BUDGET_COL_STORAGE_KEY, JSON.stringify(budgetColWidthsRef.current));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  useEffect(() => {
    if (!data || !document) return;
    if (initKey.current === `${projectId}:${documentId}`) return;
    initKey.current = `${projectId}:${documentId}`;
    const budgetExtracted = document.extractedFields.filter((f) => f.targetType === 'BUDGET_ITEM');
    setBudgetItems(buildBudgetDrafts(documentId, data, budgetExtracted));
  }, [data, document, documentId, projectId]);

  useEffect(() => {
    if (!document) return;
    if (document.documentType === 'NOTICE' || document.documentType === 'TERMS_OF_REFERENCE') {
      setAnnexDocumentType(document.documentType);
      return;
    }
    setAnnexDocumentType('NOTICE');
  }, [document]);

  const summary = useMemo(() => ({ items: budgetItems.length }), [budgetItems]);
  const isEditalDoc = document?.documentType === 'NOTICE' || document?.documentType === 'TERMS_OF_REFERENCE';
  const shouldSuggestComplementaryAnnexUpload =
    Boolean(isEditalDoc) &&
    (budgetItems.length === 0 || editalPreview?.requiresComplementaryAnnexUpload === true);

  const budgetColPercents = useMemo(() => {
    const total = budgetColWidths.reduce((s, w) => s + w, 0);
    if (total <= 0 || budgetColWidths.length === 0) {
      const n = Math.max(1, budgetColWidths.length);
      return budgetColWidths.map(() => 100 / n);
    }
    const percents = budgetColWidths.map((w) => (w / total) * 100);
    const drift = 100 - percents.reduce((a, b) => a + b, 0);
    percents[percents.length - 1]! += drift;
    return percents;
  }, [budgetColWidths]);

  async function handleApply() {
    if (!data) return;
    const payload = buildApplyPayload(budgetItems);
    try {
      await applyExtraction.mutateAsync({ projectId, documentId, payload });
      toast.success('Itens aplicados. Abrindo controle de compras…');
      router.push(`/projects/${projectId}/purchase-control`);
    } catch (error) {
      toast.error(
        formatApiValidationToastMessage(error, 'Não foi possível aplicar os dados.'),
      );
    }
  }

  async function handleComplementaryAnnexUpload(file: File) {
    if (!document) return;

    setAnnexUploading(true);
    setAnnexFileName(file.name);

    try {
      const result = await importProjectDocumentFromUpload(projectId, file, annexDocumentType, {
        notes: `Anexo complementar importado a partir da revisão de ${document.originalFileName}`,
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['project-documents', projectId] }),
      ]);

      toast.success('Anexo importado. Abrindo a revisão do arquivo complementar...');
      router.push(`/projects/${projectId}/documents/${result.documentId}/review`);
    } catch (error) {
      toast.error(formatApiValidationToastMessage(error, 'Não foi possível importar o anexo complementar.'));
    } finally {
      setAnnexUploading(false);
      if (annexInputRef.current) {
        annexInputRef.current.value = '';
      }
    }
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-2/3 max-w-md" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !document) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Documento não encontrado</CardTitle>
          <CardDescription>Volte à lista de projetos e tente novamente.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/projects">Projetos</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const purchaseBlockTitle = isEditalDoc
    ? 'Itens do edital (mat. a disponibilizar)'
    : 'Itens de compra (mapa de implantação)';
  const purchaseBlockDesc = isEditalDoc
    ? 'Descrição e quantidade extraídas das seções 7 e 8 do edital. Ajuste categoria e valores de rubrica (unitário e total) conforme o texto do PDF — nesta etapa só o que consta no edital.'
    : 'Uniformes, EPIs e equipamentos com quantidade e valores (R$) lidos do PDF — revise categoria e rubrica.';

  return (
    <div className="space-y-8">
      <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-primary/[0.06] to-transparent shadow-sm">
        <CardHeader className="border-b border-border/60 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="size-5 text-primary" aria-hidden />
                Revisão inteligente do documento
              </CardTitle>
              <CardDescription className="max-w-3xl text-sm leading-relaxed">
                Encontramos <strong>{summary.items} itens de compra</strong> neste documento. Os dados abaixo foram
                interpretados automaticamente — ajuste o que for necessário e aplique ao projeto.
              </CardDescription>
            </div>
            <Badge className="shrink-0" variant="default">
              <FileText className="mr-1 inline size-3.5" aria-hidden />
              {document.originalFileName}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Tipo: {getDocumentTypeLabel(document.documentType)} ·{' '}
            {isEditalDoc
              ? 'Seções 7 (materiais a disponibilizar) e 8 (uniformes / EPI) quando encontradas no texto do PDF'
              : 'Leitura com âncoras e linhas do mapa consolidadas'}
          </p>
        </CardHeader>
      </Card>

      {shouldSuggestComplementaryAnnexUpload ? (
        <Card className="overflow-hidden border-amber-500/25 bg-gradient-to-br from-amber-500/[0.08] via-background to-background shadow-sm">
          <CardHeader className="border-b border-amber-500/15 pb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="size-4.5 text-amber-600" aria-hidden />
                  Subir anexo complementar
                </CardTitle>
                <CardDescription className="max-w-3xl text-sm leading-relaxed">
                  Este {getDocumentTypeLabel(document.documentType).toLowerCase()} não trouxe a tabela detalhada de materiais
                  no próprio arquivo. Envie o anexo complementar para o sistema ler e abrir a revisão dele automaticamente.
                </CardDescription>
              </div>
              <Badge className="shrink-0" variant="secondary">
                {editalPreview?.ocrUsed ? 'OCR já testado' : 'Leitura direta'}
              </Badge>
            </div>
            {editalPreview?.annexReferenceHints?.length ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {editalPreview.annexReferenceHints.map((hint) => (
                  <Badge className="bg-amber-500/10 text-amber-900 hover:bg-amber-500/15" key={hint} variant="secondary">
                    {hint}
                  </Badge>
                ))}
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid gap-4 sm:grid-cols-[220px_minmax(0,1fr)] lg:max-w-3xl lg:flex-1">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground" htmlFor="annex-document-type">
                  Tipo do anexo
                </label>
                <Select
                  className="h-10"
                  id="annex-document-type"
                  onChange={(e) => setAnnexDocumentType(e.target.value as DocumentType)}
                  value={annexDocumentType}
                >
                  <option value="NOTICE">Edital / anexo do edital</option>
                  <option value="TERMS_OF_REFERENCE">TR / anexo do TR</option>
                </Select>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Arquivo complementar</p>
                <div className="rounded-2xl border border-dashed border-amber-500/30 bg-background/80 p-4 shadow-sm">
                  <input
                    accept=".pdf,.xlsx,.xls"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file || annexUploading) return;
                      void handleComplementaryAnnexUpload(file);
                    }}
                    ref={annexInputRef}
                    type="file"
                  />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {annexFileName && annexUploading ? `Importando ${annexFileName}...` : 'PDF ou Excel do anexo'}
                      </p>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        O arquivo será salvo no projeto, lido pelo extrator e a próxima revisão abrirá sozinha.
                      </p>
                    </div>
                    <Button
                      className="min-w-[220px] gap-2"
                      disabled={annexUploading}
                      onClick={() => annexInputRef.current?.click()}
                      type="button"
                    >
                      {annexUploading ? (
                        <>
                          <LoaderCircle className="size-4 animate-spin" aria-hidden />
                          Lendo anexo...
                        </>
                      ) : (
                        <>
                          <FileUp className="size-4" aria-hidden />
                          Enviar anexo complementar
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Bloco C — grade estilo planilha (premium) */}
      <Card className="border-border/80 shadow-md shadow-black/[0.04] ring-1 ring-black/[0.04]">
        <CardHeader className="border-b border-border/50 bg-gradient-to-b from-muted/30 to-transparent py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <ShoppingCart className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <div>
                <CardTitle className="text-base font-semibold tracking-tight">{purchaseBlockTitle}</CardTitle>
                <CardDescription className="text-xs leading-snug text-muted-foreground">{purchaseBlockDesc}</CardDescription>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button
                className="h-8 gap-1 text-xs font-medium"
                disabled={budgetItems.length === 0}
                onClick={() => {
                  setBudgetItems((prev) => fillRandomBudgetDrafts(prev));
                  toast.message('Valores aleatórios de teste aplicados (qtd e rubrica).');
                }}
                size="sm"
                title="Preenche quantidade e valores de rubrica em todas as linhas para agilizar testes."
                type="button"
                variant="outline"
              >
                <Dices className="size-3.5" aria-hidden />
                Aleatório (teste)
              </Button>
              <Button
                className="h-8 gap-1 text-xs font-medium shadow-sm"
                onClick={() =>
                  setBudgetItems((prev) => [
                    ...prev,
                    {
                      id: crypto.randomUUID(),
                      name: '',
                      itemCategory: 'OTHER',
                      plannedQuantity: null,
                      bidUnitValue: null,
                      rubricMaxValue: null,
                      purchasedValue: null,
                      roleReference: null,
                      sourcePage: null,
                      sourceExcerpt: null,
                      contextOnly: false,
                    },
                  ])
                }
                size="sm"
                type="button"
                variant="default"
              >
                <Plus className="size-3.5" aria-hidden />
                Item
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-3">
          {budgetItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-5 py-8 text-center">
              <div className="mx-auto flex max-w-xl flex-col items-center gap-3">
                <div className="rounded-2xl bg-primary/10 p-3">
                  <FileUp className="size-6 text-primary" aria-hidden />
                </div>
                <p className="text-sm font-medium text-foreground">Nenhuma linha de compra detectada neste documento.</p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {shouldSuggestComplementaryAnnexUpload
                    ? 'O PDF principal parece apontar para anexos com o detalhamento dos materiais. Use o bloco acima para enviar o anexo complementar.'
                    : 'Se este arquivo deveria conter os materiais, revise o PDF original ou importe um anexo complementar com a tabela detalhada.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="w-full min-w-0 overflow-x-auto rounded-md border border-border bg-card shadow-sm ring-1 ring-border/60">
              <table className="w-full table-fixed border-collapse text-[13px] leading-normal antialiased">
                <colgroup>
                  {budgetColPercents.map((pct, idx) => (
                    <col key={idx} style={{ width: `${pct}%` }} />
                  ))}
                </colgroup>
                <thead>
                  <tr className="bg-muted/80">
                    <th className="relative border-b border-border/90 border-r border-border px-2 py-2 pr-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground/90">
                      Descrição
                      <button
                        aria-label="Ajustar largura entre Descrição e Função"
                        className="absolute right-0 top-0 z-10 h-full w-2 cursor-col-resize touch-none border-0 bg-transparent p-0 hover:bg-primary/20 active:bg-primary/30"
                        type="button"
                        onPointerDown={(ev) => handleBudgetColumnResizeStart(ev, 0)}
                      />
                    </th>
                    <th className="relative border-b border-border/90 border-r border-border px-1.5 py-2 pr-3 text-left text-[10px] font-semibold tracking-[0.06em] text-foreground/90">
                      Função / cargo
                      <button
                        aria-label="Ajustar largura entre Função e Cat."
                        className="absolute right-0 top-0 z-10 h-full w-2 cursor-col-resize touch-none border-0 bg-transparent p-0 hover:bg-primary/20 active:bg-primary/30"
                        type="button"
                        onPointerDown={(ev) => handleBudgetColumnResizeStart(ev, 1)}
                      />
                    </th>
                    <th className="relative border-b border-border/90 border-r border-border px-1.5 py-2 pr-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground/90">
                      Cat.
                      <button
                        aria-label="Ajustar largura entre Cat. e Orig."
                        className="absolute right-0 top-0 z-10 h-full w-2 cursor-col-resize touch-none border-0 bg-transparent p-0 hover:bg-primary/20 active:bg-primary/30"
                        type="button"
                        onPointerDown={(ev) => handleBudgetColumnResizeStart(ev, 2)}
                      />
                    </th>
                    <th className="relative border-b border-border/90 border-r border-border px-1 py-2 pr-3 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground/90">
                      Orig.
                      <button
                        aria-label="Ajustar largura entre Orig. e Qtd"
                        className="absolute right-0 top-0 z-10 h-full w-2 cursor-col-resize touch-none border-0 bg-transparent p-0 hover:bg-primary/20 active:bg-primary/30"
                        type="button"
                        onPointerDown={(ev) => handleBudgetColumnResizeStart(ev, 3)}
                      />
                    </th>
                    <th className="relative border-b border-border/90 border-r border-border px-1 py-2 pr-3 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground/90">
                      Qtd
                      <button
                        aria-label="Ajustar largura entre Qtd e Vlr unit. rubrica"
                        className="absolute right-0 top-0 z-10 h-full w-2 cursor-col-resize touch-none border-0 bg-transparent p-0 hover:bg-primary/20 active:bg-primary/30"
                        type="button"
                        onPointerDown={(ev) => handleBudgetColumnResizeStart(ev, 4)}
                      />
                    </th>
                    <th className="relative border-b border-border/90 border-r border-border px-1.5 py-2 pr-3 text-right text-[10px] font-semibold uppercase tracking-[0.06em] text-foreground/90">
                      Vlr unit. rubrica (R$)
                      <button
                        aria-label="Ajustar largura entre Vlr unit. rubrica e Vlr total rubrica"
                        className="absolute right-0 top-0 z-10 h-full w-2 cursor-col-resize touch-none border-0 bg-transparent p-0 hover:bg-primary/20 active:bg-primary/30"
                        type="button"
                        onPointerDown={(ev) => handleBudgetColumnResizeStart(ev, 5)}
                      />
                    </th>
                    <th className="border-b border-border px-1.5 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.06em] text-foreground/90">
                      Vlr total rubrica (R$)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {budgetItems.map((b) => {
                    const tip = budgetRowTooltip(b);
                    return (
                      <tr
                        key={b.id}
                        className="align-top transition-colors hover:bg-muted/50"
                        title={tip}
                      >
                        <td className="min-w-0 border-b border-r border-border bg-card p-0 align-top">
                          <div className="px-2 pt-1.5">
                            <textarea
                              className={cn(
                                'box-border min-h-[2.25rem] w-full resize-y border-0 bg-transparent py-1.5 text-[13px] leading-snug text-foreground outline-none',
                                'placeholder:text-muted-foreground focus:bg-muted focus:ring-1 focus:ring-inset focus:ring-primary/25',
                              )}
                              onChange={(e) =>
                                setBudgetItems((prev) =>
                                  prev.map((x) => (x.id === b.id ? { ...x, name: e.target.value } : x)),
                                )
                              }
                              rows={2}
                              spellCheck={false}
                              value={b.name}
                            />
                          </div>
                        </td>
                        <td className="min-w-0 border-b border-r border-border bg-muted/25 p-0 align-top">
                          <div className="px-1.5 pt-1.5">
                            <textarea
                              className={cn(
                                'box-border min-h-[2.25rem] w-full resize-y border-0 bg-transparent py-1.5 text-[12px] leading-snug text-foreground outline-none',
                                'placeholder:text-muted-foreground focus:bg-muted focus:ring-1 focus:ring-inset focus:ring-primary/25',
                              )}
                              onChange={(e) =>
                                setBudgetItems((prev) =>
                                  prev.map((x) =>
                                    x.id === b.id ? { ...x, roleReference: e.target.value.trim() || null } : x,
                                  ),
                                )
                              }
                              placeholder="Cargo no edital (ex.: Secretário…)"
                              rows={2}
                              spellCheck={false}
                              title="Função/cargo acima da tabela TIPO/QTD no PDF — distingue peças com o mesmo nome."
                              value={b.roleReference ?? ''}
                            />
                          </div>
                        </td>
                        <td className="border-b border-r border-border bg-card p-0 align-top">
                          <Select
                            className={cn(
                              'h-auto min-h-[1.75rem] w-full cursor-pointer rounded-none border-0 bg-transparent px-1.5 py-1.5 text-[12px] text-foreground shadow-none',
                              'focus:bg-muted focus:ring-1 focus:ring-inset focus:ring-primary/25',
                            )}
                            onChange={(e) =>
                              setBudgetItems((prev) =>
                                prev.map((x) =>
                                  x.id === b.id ? { ...x, itemCategory: e.target.value as ItemCategory } : x,
                                ),
                              )
                            }
                            value={b.itemCategory}
                          >
                            {ITEM_CATEGORY_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </Select>
                        </td>
                        <td className="border-b border-r border-border bg-muted/50 px-1 py-1.5 text-center align-middle text-[11px] font-medium tabular-nums text-foreground">
                          {budgetSourceAbbrev(b)}
                        </td>
                        <td className="border-b border-r border-border bg-card p-0 align-top">
                          <Input
                            className={cn(
                              'h-8 rounded-none border-0 bg-transparent px-1 py-0 text-center text-[13px] tabular-nums text-foreground shadow-none',
                              'focus:bg-muted focus:ring-1 focus:ring-inset focus:ring-primary/25',
                            )}
                            min={0}
                            onChange={(e) =>
                              setBudgetItems((prev) =>
                                prev.map((x) =>
                                  x.id === b.id
                                    ? {
                                        ...x,
                                        plannedQuantity: e.target.value === '' ? null : Number(e.target.value),
                                      }
                                    : x,
                                ),
                              )
                            }
                            step="any"
                            type="number"
                            value={b.plannedQuantity ?? ''}
                          />
                        </td>
                        <td className="border-b border-r border-border bg-card p-0 align-top">
                          <Input
                            className={cn(
                              'h-8 rounded-none border-0 bg-transparent px-1.5 py-0 text-right text-[13px] tabular-nums text-foreground shadow-none',
                              'focus:bg-muted focus:ring-1 focus:ring-inset focus:ring-primary/25',
                            )}
                            min={0}
                            onChange={(e) =>
                              setBudgetItems((prev) =>
                                prev.map((x) =>
                                  x.id === b.id
                                    ? { ...x, bidUnitValue: e.target.value === '' ? null : Number(e.target.value) }
                                    : x,
                                ),
                              )
                            }
                            placeholder="—"
                            step="any"
                            title="Valor unitário da rubrica no edital"
                            type="number"
                            value={b.bidUnitValue ?? ''}
                          />
                        </td>
                        <td className="border-b border-border bg-card p-0 align-top">
                          <Input
                            className={cn(
                              'h-8 rounded-none border-0 bg-transparent px-1.5 py-0 text-right text-[13px] tabular-nums text-foreground shadow-none',
                              'focus:bg-muted focus:ring-1 focus:ring-inset focus:ring-primary/25',
                            )}
                            min={0}
                            onChange={(e) =>
                              setBudgetItems((prev) =>
                                prev.map((x) =>
                                  x.id === b.id
                                    ? {
                                        ...x,
                                        rubricMaxValue: e.target.value === '' ? null : Number(e.target.value),
                                      }
                                    : x,
                                ),
                              )
                            }
                            placeholder="—"
                            step="any"
                            title="Valor total da rubrica (teto da linha no edital)"
                            type="number"
                            value={b.rubricMaxValue ?? ''}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {budgetItems.length > 0 ? (
            <p className="mt-2 text-[11px] leading-relaxed text-foreground/90">
              <span className="font-medium">Legenda:</span> S7 = seção 7 · S8 = lista com traço (EPI) ·
              Mapa = implantação · TR = tabela TIPO/QTD (Roraima) · Função = cargo no PDF acima da tabela · Parágrafos
              8.7.x só normativos (sem rubrica) não entram nesta lista ·{' '}
              <span className="text-foreground/85">Vlr unit. / total rubrica</span> = conforme o edital. Arraste entre
              colunas no cabeçalho para ajustar larguras (preferência salva no navegador). Passe o cursor na linha para
              ver trecho do PDF.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button
          className="gap-2 shadow-glow"
          disabled={applyExtraction.isPending}
          onClick={() => void handleApply()}
          size="lg"
          type="button"
        >
          <CheckCircle2 className="size-4" aria-hidden />
          Aplicar ao projeto
        </Button>
      </div>
    </div>
  );
}

export default ExtractionReviewPage;
