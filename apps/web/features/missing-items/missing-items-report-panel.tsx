'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  ChevronDown,
  ClipboardList,
  Dices,
  Download,
  FileText,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
  Upload,
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
import {
  getMissingItemUrgencyLabel,
  getOwnerApprovalStatusLabel,
  missingItemUrgencyOptions,
  ownerApprovalStatusOptions,
} from '@/lib/constants';
import { formatDate, formatDateTime, formatFileSize } from '@/lib/format';
import { cn } from '@/lib/utils';
import { projectDocumentPublicFileUrl } from '@/lib/project-document-url';
import { useMissingItemReportsMutations, useMissingItemReportsQuery } from '@/hooks/use-missing-item-reports';
import { ApiError } from '@/services/api-client';
import type { MissingItemReportPayload, MissingItemReportUpdatePayload } from '@/services/missing-item-reports-service';
import type { MissingItemReport, MissingItemReportAttachment, MissingItemUrgency, OwnerApprovalStatus } from '@/types/api';

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

const RANDOM_MISSING_ITEM_NAMES = [
  'Luvas nitrílica procedimento — tamanho M',
  'Máscara PFF2 com válvula (caixa 50)',
  'Óculos de proteção incolor — antiembaçante',
  'Protetor auricular tipo concha 23 dB',
  'Macacão de brim branco com fecho',
  'Sapato de segurança biqueira composite nº 40',
  'Avental descartável TNT — pacote 100',
  'Álcool gel 70% frasco 500 ml',
  'Bolsa coletora para resíduos infectantes',
  'Termômetro infravermelho clínico',
];

const RANDOM_APPROVAL_ROTATION: OwnerApprovalStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];

function randomInt(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** Data da solicitação entre hoje e 50 dias atrás (yyyy-mm-dd). */
function randomRequestDateYmd(): string {
  const d = new Date();
  d.setDate(d.getDate() - randomInt(0, 50));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildRandomMissingItemPayload(index: number): MissingItemReportPayload {
  const urgencyLevels: MissingItemUrgency[] = ['HIGH', 'MEDIUM', 'LOW'];
  return {
    requesterName: `Resp. teste ${randomInt(1, 99)} · Almox.`,
    requestDate: randomRequestDateYmd(),
    itemToAcquire: RANDOM_MISSING_ITEM_NAMES[randomInt(0, RANDOM_MISSING_ITEM_NAMES.length - 1)]!,
    estimatedQuantity: `${randomInt(1, 80)} ${['un.', 'cx', 'pct.', 'par', 'kit'][randomInt(0, 4)]}`,
    necessityReason: `Demanda automática de teste (#${index + 1}): reposição de uso contínuo / troca de lote ou novo colaborador na unidade.`,
    urgencyLevel: urgencyLevels[index % 3]!,
  };
}

type ApprovalFilter = 'all' | MissingItemReport['ownerApprovalStatus'];

const approvalFilterOptions: Array<{ value: ApprovalFilter; label: string }> = [
  { value: 'all', label: 'Todos os status' },
  { value: 'PENDING', label: 'Aguardando aprovação' },
  { value: 'APPROVED', label: 'Aprovadas' },
  { value: 'REJECTED', label: 'Rejeitadas' },
];

const formSchema = z.object({
  requesterName: z.string().trim().min(1, 'Informe o responsável.'),
  requestDate: z.string().min(1, 'Informe a data.'),
  itemToAcquire: z.string().trim().min(1, 'Descreva o item.'),
  estimatedQuantity: z.string().trim().min(1, 'Informe a quantidade estimada.'),
  necessityReason: z.string().trim().min(1, 'Explique a necessidade.'),
  urgencyLevel: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  ownerApprovalStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
});

type FormValues = z.input<typeof formSchema>;
type FormSubmitValues = z.output<typeof formSchema>;

function urgencyBadgeVariant(level: MissingItemReport['urgencyLevel']) {
  if (level === 'HIGH') return 'danger' as const;
  if (level === 'MEDIUM') return 'warning' as const;
  return 'secondary' as const;
}

function approvalBadgeVariant(status: MissingItemReport['ownerApprovalStatus']) {
  if (status === 'APPROVED') return 'success' as const;
  if (status === 'REJECTED') return 'danger' as const;
  return 'warning' as const;
}

function attachmentHref(storagePath: string) {
  return projectDocumentPublicFileUrl(storagePath);
}

function addFilesFromList(files: FileList | null, onAdd: (files: File[]) => void) {
  if (!files?.length) return;
  const accepted: File[] = [];
  for (const f of Array.from(files)) {
    if (f.size > MAX_ATTACHMENT_BYTES) {
      toast.error(`${f.name} excede o limite de 20 MB.`);
      continue;
    }
    accepted.push(f);
  }
  if (accepted.length) onAdd(accepted);
}

function AttachmentList({
  attachments,
  onRequestRemove,
  disabled,
}: {
  attachments: MissingItemReportAttachment[];
  onRequestRemove: (attachment: MissingItemReportAttachment) => void;
  disabled?: boolean;
}) {
  if (!attachments.length) return null;

  return (
    <ul className="flex flex-col gap-2">
      {attachments.map((att) => (
        <li
          key={att.id}
          className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/80 px-3 py-2 text-sm shadow-sm transition-colors hover:border-primary/25"
        >
          <FileText className="size-4 shrink-0 text-primary/90" aria-hidden />
          <div className="min-w-0 flex-1">
            <a
              className="block truncate font-medium text-foreground underline-offset-2 hover:underline"
              href={attachmentHref(att.storagePath)}
              rel="noopener noreferrer"
              target="_blank"
            >
              {att.originalFileName}
            </a>
            <span className="text-xs text-muted-foreground">{formatFileSize(att.fileSizeBytes)}</span>
          </div>
          <Button
            aria-label="Baixar"
            className="h-9 w-9 shrink-0"
            disabled={disabled}
            size="icon"
            type="button"
            variant="ghost"
            asChild
          >
            <a download={att.originalFileName} href={attachmentHref(att.storagePath)} rel="noopener noreferrer">
              <Download className="size-[18px]" />
            </a>
          </Button>
          <Button
            aria-label="Remover anexo"
            className="h-9 w-9 shrink-0 text-destructive hover:text-destructive"
            disabled={disabled}
            onClick={() => onRequestRemove(att)}
            size="icon"
            type="button"
            variant="ghost"
          >
            <Trash2 className="size-[18px]" />
          </Button>
        </li>
      ))}
    </ul>
  );
}

function ConfirmDestructiveDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  pending?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button disabled={pending} onClick={() => onOpenChange(false)} type="button" variant="ghost">
            Cancelar
          </Button>
          <Button
            disabled={pending}
            onClick={() => void onConfirm()}
            type="button"
            variant="destructive"
          >
            {pending ? 'Aguarde…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReportDialog({
  open,
  onOpenChange,
  projectId,
  report,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  report?: MissingItemReport | null;
}) {
  const { createReport, updateReport, uploadAttachment, deleteAttachment } = useMissingItemReportsMutations(projectId);
  const isEdit = Boolean(report);
  const fileCreateRef = useRef<HTMLInputElement>(null);
  const fileEditRef = useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [removeAttachmentId, setRemoveAttachmentId] = useState<string | null>(null);

  const form = useForm<FormValues, undefined, FormSubmitValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      requesterName: '',
      requestDate: '',
      itemToAcquire: '',
      estimatedQuantity: '',
      necessityReason: '',
      urgencyLevel: 'MEDIUM',
      ownerApprovalStatus: 'PENDING',
    },
  });

  useEffect(() => {
    if (!open) {
      setPendingFiles([]);
    }
  }, [open]);

  useEffect(() => {
    if (!report) {
      form.reset({
        requesterName: '',
        requestDate: '',
        itemToAcquire: '',
        estimatedQuantity: '',
        necessityReason: '',
        urgencyLevel: 'MEDIUM',
        ownerApprovalStatus: 'PENDING',
      });
      return;
    }

    form.reset({
      requesterName: report.requesterName,
      requestDate: report.requestDate ? report.requestDate.slice(0, 10) : '',
      itemToAcquire: report.itemToAcquire,
      estimatedQuantity: report.estimatedQuantity,
      necessityReason: report.necessityReason,
      urgencyLevel: report.urgencyLevel,
      ownerApprovalStatus: report.ownerApprovalStatus,
    });
  }, [form, report]);

  async function onSubmit(values: FormSubmitValues) {
    const requestDateIso = `${values.requestDate}T12:00:00.000Z`;

    try {
      if (isEdit && report) {
        const payload: MissingItemReportUpdatePayload = {
          requesterName: values.requesterName,
          requestDate: requestDateIso,
          itemToAcquire: values.itemToAcquire,
          estimatedQuantity: values.estimatedQuantity,
          necessityReason: values.necessityReason,
          urgencyLevel: values.urgencyLevel,
          ownerApprovalStatus: values.ownerApprovalStatus,
        };

        await updateReport.mutateAsync({ id: report.id, payload });
        toast.success('Solicitação atualizada.');
      } else {
        const created = await createReport.mutateAsync({
          requesterName: values.requesterName,
          requestDate: requestDateIso,
          itemToAcquire: values.itemToAcquire,
          estimatedQuantity: values.estimatedQuantity,
          necessityReason: values.necessityReason,
          urgencyLevel: values.urgencyLevel,
        });

        for (const file of pendingFiles) {
          await uploadAttachment.mutateAsync({ reportId: created.id, file });
        }

        toast.success(
          pendingFiles.length
            ? `Solicitação registrada com ${pendingFiles.length} anexo(s).`
            : 'Solicitação registrada.',
        );
      }

      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar.');
    }
  }

  const removeAttachmentLabel =
    removeAttachmentId && report
      ? report.attachments.find((a) => a.id === removeAttachmentId)?.originalFileName
      : undefined;

  async function confirmRemoveAttachment() {
    if (!removeAttachmentId) return;

    try {
      await deleteAttachment.mutateAsync(removeAttachmentId);
      toast.success('Anexo removido.');
      setRemoveAttachmentId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível remover o anexo.');
    }
  }

  async function handleEditAddFiles(files: FileList | null) {
    if (!report || !files?.length) return;
    const f = files[0];
    if (f.size > MAX_ATTACHMENT_BYTES) {
      toast.error('O arquivo excede 20 MB.');
      return;
    }
    try {
      await uploadAttachment.mutateAsync({ reportId: report.id, file: f });
      toast.success('Anexo enviado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha no envio.');
    }
  }

  const pending = createReport.isPending || updateReport.isPending || uploadAttachment.isPending;
  const editAttachments = report?.attachments ?? [];

  return (
    <>
      <ConfirmDestructiveDialog
        confirmLabel="Remover anexo"
        description={
          removeAttachmentLabel
            ? `O arquivo "${removeAttachmentLabel}" será removido desta solicitação.`
            : 'O anexo será removido desta solicitação.'
        }
        onConfirm={confirmRemoveAttachment}
        onOpenChange={(next) => {
          if (!next) setRemoveAttachmentId(null);
        }}
        open={removeAttachmentId !== null}
        pending={deleteAttachment.isPending}
        title="Remover anexo?"
      />
      <Dialog
        onOpenChange={(next) => {
          if (!next) setRemoveAttachmentId(null);
          onOpenChange(next);
        }}
        open={open}
      >
      <DialogContent className="max-h-[min(92vh,760px)] flex flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <div className="border-b border-border/60 bg-muted/20 px-6 py-5">
          <DialogHeader className="space-y-1.5 text-left">
            <DialogTitle className="text-xl">
              {isEdit ? 'Editar solicitação' : 'Nova solicitação de item'}
            </DialogTitle>
            <DialogDescription>
              Dados preenchidos manualmente. Inclua anexos (orçamentos, fotos, etc.) para apoiar a solicitação.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form className="flex flex-1 flex-col overflow-hidden" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-4 overflow-y-auto px-6 py-5">
            <div className="space-y-2">
              <Label htmlFor="requesterName">Nome do responsável pela solicitação</Label>
              <Input id="requesterName" {...form.register('requesterName')} autoComplete="name" />
              {form.formState.errors.requesterName ? (
                <p className="text-sm text-destructive">{form.formState.errors.requesterName.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="requestDate">Data</Label>
              <Input id="requestDate" type="date" {...form.register('requestDate')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="itemToAcquire">Qual item precisa ser adquirido?</Label>
              <Input id="itemToAcquire" {...form.register('itemToAcquire')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimatedQuantity">Quantidade estimada</Label>
              <Input id="estimatedQuantity" {...form.register('estimatedQuantity')} placeholder="Ex.: 10 unidades" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="necessityReason">Por que esse item é necessário?</Label>
              <Textarea id="necessityReason" rows={4} {...form.register('necessityReason')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="urgencyLevel">Qual o nível de urgência?</Label>
              <Select id="urgencyLevel" {...form.register('urgencyLevel')}>
                {missingItemUrgencyOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} — {opt.hint}
                  </option>
                ))}
              </Select>
            </div>

            {isEdit ? (
              <div className="space-y-2 rounded-xl border border-border/70 bg-muted/15 p-4">
                <Label htmlFor="ownerApprovalStatus">Aprovado pelo dono da empresa</Label>
                <Select id="ownerApprovalStatus" {...form.register('ownerApprovalStatus')}>
                  {ownerApprovalStatusOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
                {report?.ownerApprovedAt ? (
                  <p className="text-xs text-muted-foreground">
                    Última resposta registrada em {formatDateTime(report.ownerApprovedAt)}.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Paperclip className="size-4 text-primary" aria-hidden />
                Anexos
              </div>

              {isEdit && report ? (
                <div className="space-y-3">
                  <AttachmentList
                    attachments={editAttachments}
                    disabled={deleteAttachment.isPending}
                    onRequestRemove={(att) => setRemoveAttachmentId(att.id)}
                  />
                  <input
                    ref={fileEditRef}
                    className="sr-only"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip"
                    onChange={(e) => {
                      void handleEditAddFiles(e.target.files);
                      e.target.value = '';
                    }}
                    type="file"
                  />
                  <Button
                    className="w-full gap-2 border-dashed"
                    disabled={uploadAttachment.isPending}
                    onClick={() => fileEditRef.current?.click()}
                    type="button"
                    variant="outline"
                  >
                    <Upload className="size-4" aria-hidden />
                    {uploadAttachment.isPending ? 'Enviando...' : 'Adicionar arquivo'}
                  </Button>
                </div>
              ) : (
                <div>
                  <input
                    ref={fileCreateRef}
                    className="sr-only"
                    multiple
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip"
                    onChange={(e) => {
                      addFilesFromList(e.target.files, (next) => setPendingFiles((p) => [...p, ...next]));
                      e.target.value = '';
                    }}
                    type="file"
                  />
                  <button
                    className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-6 text-center transition-colors hover:border-primary/35 hover:bg-muted/35"
                    onClick={() => fileCreateRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      addFilesFromList(e.dataTransfer.files, (next) => setPendingFiles((p) => [...p, ...next]));
                    }}
                    type="button"
                  >
                    <Upload className="size-8 text-muted-foreground" aria-hidden />
                    <span className="text-sm font-medium text-foreground">Solte arquivos aqui ou clique para escolher</span>
                    <span className="text-xs text-muted-foreground">Até 20 MB por arquivo · enviados após salvar a solicitação</span>
                  </button>
                  {pendingFiles.length > 0 ? (
                    <ul className="mt-3 space-y-2">
                      {pendingFiles.map((f, idx) => (
                        <li
                          key={`${f.name}-${idx}`}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-background px-3 py-2 text-sm"
                        >
                          <span className="truncate font-medium">{f.name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{formatFileSize(f.size)}</span>
                          <Button
                            className="size-8 shrink-0"
                            onClick={() => setPendingFiles((p) => p.filter((_, i) => i !== idx))}
                            size="icon"
                            type="button"
                            variant="ghost"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="border-t border-border/60 bg-muted/10 px-6 py-4">
            <Button onClick={() => onOpenChange(false)} type="button" variant="ghost">
              Cancelar
            </Button>
            <Button disabled={pending} type="submit">
              {pending ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Registrar solicitação'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
}

const RANDOM_FILL_COUNT = 6;

function formatMutationErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

export function MissingItemsReportPanel({ projectId }: { projectId: string }) {
  const { data: reports, isLoading, isError } = useMissingItemReportsQuery(projectId);
  const { createReport, updateReport, deleteReport, uploadAttachment, deleteAttachment } =
    useMissingItemReportsMutations(projectId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MissingItemReport | null>(null);
  const [approvalFilter, setApprovalFilter] = useState<ApprovalFilter>('all');
  const [randomFillBusy, setRandomFillBusy] = useState(false);
  /** IDs das solicitações com detalhes expandidos. */
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [deleteReportTarget, setDeleteReportTarget] = useState<MissingItemReport | null>(null);
  const [removeAttachmentConfirm, setRemoveAttachmentConfirm] = useState<{
    id: string;
    fileName: string;
  } | null>(null);

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filteredReports = useMemo(() => {
    if (!reports?.length) return [];
    if (approvalFilter === 'all') return reports;
    return reports.filter((r) => r.ownerApprovalStatus === approvalFilter);
  }, [reports, approvalFilter]);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(row: MissingItemReport) {
    setEditing(row);
    setDialogOpen(true);
  }

  async function confirmDeleteReport() {
    if (!deleteReportTarget) return;

    try {
      await deleteReport.mutateAsync(deleteReportTarget.id);
      toast.success('Solicitação excluída.');
      setDeleteReportTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível excluir.');
    }
  }

  async function confirmCardRemoveAttachment() {
    if (!removeAttachmentConfirm) return;

    try {
      await deleteAttachment.mutateAsync(removeAttachmentConfirm.id);
      toast.success('Anexo removido.');
      setRemoveAttachmentConfirm(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível remover.');
    }
  }

  async function handleCardAddFile(reportId: string, files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (f.size > MAX_ATTACHMENT_BYTES) {
      toast.error('O arquivo excede 20 MB.');
      return;
    }
    try {
      await uploadAttachment.mutateAsync({ reportId, file: f });
      toast.success('Anexo enviado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha no envio.');
    }
  }

  async function fillRandomMissingItemReports() {
    setRandomFillBusy(true);
    try {
      let ok = 0;
      let firstError: unknown;
      for (let index = 0; index < RANDOM_FILL_COUNT; index++) {
        try {
          const payload = buildRandomMissingItemPayload(index);
          const created = await createReport.mutateAsync(payload);
          const status = RANDOM_APPROVAL_ROTATION[index % RANDOM_APPROVAL_ROTATION.length]!;
          if (status !== 'PENDING') {
            await updateReport.mutateAsync({
              id: created.id,
              payload: { ownerApprovalStatus: status },
            });
          }
          ok++;
        } catch (error) {
          if (!firstError) {
            firstError = error;
          }
        }
      }

      if (ok < RANDOM_FILL_COUNT) {
        const detail = formatMutationErrorMessage(firstError, 'Erro desconhecido.');
        const failed = RANDOM_FILL_COUNT - ok;
        toast.error(
          ok === 0
            ? `${failed} solicitação(ões) falharam: ${detail}`
            : `${failed} de ${RANDOM_FILL_COUNT} falharam (${ok} criada(s)): ${detail}`,
        );
      } else {
        toast.success(
          `${RANDOM_FILL_COUNT} solicitações de teste criadas (urgências e status de aprovação variados).`,
        );
      }
    } catch (error) {
      toast.error(`Falha ao gerar solicitações de teste: ${formatMutationErrorMessage(error, 'tente de novo.')}`);
    } finally {
      setRandomFillBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Relatório de Itens Faltantes</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Cadastro manual das solicitações de itens em falta neste contrato, com urgência, status de aprovação e anexos
            opcionais. Use o filtro para ver o que está pendente ou já foi aprovado.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Button
            className="gap-2"
            disabled={randomFillBusy}
            onClick={() => void fillRandomMissingItemReports()}
            title="Cria várias solicitações fictícias com urgências e status de aprovação variados — apenas para testes."
            type="button"
            variant="secondary"
          >
            <Dices className="size-4 shrink-0" aria-hidden />
            Gerar solicitações aleatórias
          </Button>
          <Button className="gap-2" onClick={openCreate} type="button">
            <Plus className="size-4" aria-hidden />
            Nova solicitação
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-4 pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ClipboardList className="size-5 text-primary" aria-hidden />
                Itens solicitados
              </CardTitle>
              <CardDescription className="mt-1.5">
                Clique numa linha para ver quantidade, motivo e anexos; clique de novo para recolher.
              </CardDescription>
            </div>
            <div className="flex w-full shrink-0 flex-col gap-1.5 sm:w-[min(100%,280px)]">
              <Label className="text-xs font-medium text-muted-foreground" htmlFor="approval-filter">
                Filtrar por status de aprovação
              </Label>
              <Select
                id="approval-filter"
                onChange={(e) => setApprovalFilter(e.target.value as ApprovalFilter)}
                value={approvalFilter}
              >
                {approvalFilterOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {reports && reports.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Exibindo {filteredReports.length} de {reports.length}{' '}
              {reports.length === 1 ? 'solicitação' : 'solicitações'}
              {approvalFilter !== 'all'
                ? ` (${approvalFilterOptions.find((o) => o.value === approvalFilter)?.label})`
                : ''}
              .
            </p>
          ) : null}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
            </div>
          ) : isError ? (
            <p className="text-sm text-destructive">Não foi possível carregar o relatório.</p>
          ) : !reports?.length ? (
            <EmptyState
              description="Registre a primeira solicitação de item em falta para este contrato."
              icon={ClipboardList}
              title="Nenhuma solicitação ainda"
            />
          ) : !filteredReports.length ? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 px-6 py-10 text-center">
              <p className="text-sm font-medium text-foreground">Nenhuma solicitação com este status</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Altere o filtro acima ou cadastre novas solicitações com o status desejado.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
              {filteredReports.map((row) => {
                const open = expandedIds.has(row.id);
                return (
                  <div
                    key={row.id}
                    className="border-b border-border/60 last:border-b-0"
                  >
                    <div className="flex w-full items-stretch">
                      <button
                        aria-expanded={open}
                        aria-label={`${open ? 'Recolher' : 'Expandir'} detalhes: ${row.itemToAcquire}`}
                        className={cn(
                          'flex min-w-0 flex-1 items-start gap-2 px-3 py-2.5 text-left transition-colors sm:gap-3 sm:px-4 sm:py-3',
                          'hover:bg-muted/50',
                          open && 'bg-muted/30',
                        )}
                        type="button"
                        onClick={() => toggleExpanded(row.id)}
                      >
                        <ChevronDown
                          aria-hidden
                          className={cn(
                            'mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-200',
                            open && 'rotate-180',
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] text-muted-foreground">
                            <span className="font-medium text-foreground/90">
                              {row.requestDate ? formatDate(row.requestDate) : '—'}
                            </span>
                            <span> · </span>
                            {row.requesterName}
                          </p>
                          <p className="truncate text-sm font-semibold text-foreground sm:text-[15px]">
                            {row.itemToAcquire}
                          </p>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            <Badge className="text-[10px] font-normal" variant={urgencyBadgeVariant(row.urgencyLevel)}>
                              {getMissingItemUrgencyLabel(row.urgencyLevel)}
                            </Badge>
                            <Badge
                              className="text-[10px] font-normal"
                              variant={approvalBadgeVariant(row.ownerApprovalStatus)}
                            >
                              {getOwnerApprovalStatusLabel(row.ownerApprovalStatus)}
                            </Badge>
                          </div>
                        </div>
                      </button>
                      <div className="flex shrink-0 items-center gap-1 border-l border-border/40 px-1 py-2 sm:px-1.5 sm:py-2.5">
                        <Button
                          aria-label="Editar solicitação"
                          className="h-10 w-10 text-muted-foreground sm:h-11 sm:w-11"
                          onClick={() => openEdit(row)}
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <Pencil className="size-[18px] sm:size-5" />
                        </Button>
                        <Button
                          aria-label="Excluir solicitação"
                          className="h-10 w-10 text-destructive hover:text-destructive sm:h-11 sm:w-11"
                          disabled={deleteReport.isPending}
                          onClick={() => setDeleteReportTarget(row)}
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <Trash2 className="size-[18px] sm:size-5" />
                        </Button>
                      </div>
                    </div>

                    {open ? (
                      <div className="border-t border-border/50 bg-muted/20 px-3 py-3 pl-9 sm:px-5 sm:py-4 sm:pl-12">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-8">
                          <div className="shrink-0 sm:w-28">
                            <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                              Qtd. estimada
                            </p>
                            <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                              {row.estimatedQuantity}
                            </p>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                              Motivo / necessidade
                            </p>
                            <p className="mt-0.5 text-sm leading-relaxed text-foreground">{row.necessityReason}</p>
                          </div>
                        </div>
                        {row.ownerApprovedAt ? (
                          <p className="mt-3 text-[11px] text-muted-foreground">
                            Resposta do dono: {formatDateTime(row.ownerApprovedAt)}
                          </p>
                        ) : null}

                        <div className="mt-4 border-t border-border/40 pt-3">
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                              <Paperclip className="size-3.5 text-primary/90" aria-hidden />
                              Anexos
                              <span className="rounded-md bg-background px-1.5 py-px text-[11px] font-semibold text-muted-foreground ring-1 ring-border/60">
                                {row.attachments?.length ?? 0}
                              </span>
                            </span>
                            <input
                              className="sr-only"
                              id={`card-attach-${row.id}`}
                              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip"
                              onChange={(e) => {
                                void handleCardAddFile(row.id, e.target.files);
                                e.target.value = '';
                              }}
                              type="file"
                            />
                            <Button
                              className="h-7 gap-1 text-[11px]"
                              disabled={uploadAttachment.isPending}
                              onClick={() => document.getElementById(`card-attach-${row.id}`)?.click()}
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              <Plus className="size-3" />
                              Adicionar
                            </Button>
                          </div>
                          {row.attachments?.length ? (
                            <AttachmentList
                              attachments={row.attachments}
                              disabled={deleteAttachment.isPending}
                              onRequestRemove={(att) =>
                                setRemoveAttachmentConfirm({ id: att.id, fileName: att.originalFileName })
                              }
                            />
                          ) : (
                            <p className="text-[11px] leading-snug text-muted-foreground">
                              Nenhum anexo — use Adicionar para enviar fotos, PDFs ou planilhas.
                            </p>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDestructiveDialog
        confirmLabel="Excluir solicitação"
        description="Esta ação não pode ser desfeita. Todos os anexos desta solicitação serão removidos."
        onConfirm={confirmDeleteReport}
        onOpenChange={(next) => {
          if (!next) setDeleteReportTarget(null);
        }}
        open={deleteReportTarget !== null}
        pending={deleteReport.isPending}
        title="Excluir esta solicitação?"
      />

      <ConfirmDestructiveDialog
        confirmLabel="Remover anexo"
        description={
          removeAttachmentConfirm
            ? `O arquivo "${removeAttachmentConfirm.fileName}" será removido desta solicitação.`
            : 'O anexo será removido.'
        }
        onConfirm={confirmCardRemoveAttachment}
        onOpenChange={(next) => {
          if (!next) setRemoveAttachmentConfirm(null);
        }}
        open={removeAttachmentConfirm !== null}
        pending={deleteAttachment.isPending}
        title="Remover anexo?"
      />

      <ReportDialog
        onOpenChange={(next) => {
          setDialogOpen(next);
          if (!next) setEditing(null);
        }}
        open={dialogOpen}
        projectId={projectId}
        report={editing}
      />
    </div>
  );
}
