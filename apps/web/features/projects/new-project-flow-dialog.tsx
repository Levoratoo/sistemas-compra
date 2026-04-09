'use client';

import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { ArrowLeft, FileSpreadsheet, FileText, Loader2, PenLine, Sparkles, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { bootstrapProjectFromDocument } from '@/services/projects-service';
import type { DocumentType } from '@/types/api';
import { cn } from '@/lib/utils';

/** Fluxo de criação por upload assume sempre edital (leitura seções 7/8, etc.). */
const BOOTSTRAP_DOCUMENT_TYPE = 'NOTICE' as const;

type Step = 'choice' | 'upload';

type NewProjectFlowDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenManualForm: () => void;
};

export function NewProjectFlowDialog({ open, onOpenChange, onOpenManualForm }: NewProjectFlowDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('choice');
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<DocumentType>('NOTICE');
  const [processing, setProcessing] = useState(false);

  const reset = useCallback(() => {
    setStep('choice');
    setFile(null);
    setDocumentType('NOTICE');
    setProcessing(false);
  }, []);

  const handleClose = (next: boolean) => {
    if (!next) {
      reset();
    }
    onOpenChange(next);
  };

  const handleManual = () => {
    handleClose(false);
    onOpenManualForm();
  };

  const handleProcess = async () => {
    if (!file) {
      toast.error('Selecione um arquivo PDF ou Excel.');
      return;
    }

    setProcessing(true);
    try {
      const { projectId, documentId } = await bootstrapProjectFromDocument(file, BOOTSTRAP_DOCUMENT_TYPE);
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Documento processado. Revise os dados extraídos.');
      handleClose(false);
      router.push(`/projects/${projectId}/documents/${documentId}/review`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível processar o documento.';
      toast.error(message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg border-border/80 bg-card p-0 sm:max-w-xl">
        {step === 'choice' ? (
          <div className="p-6 sm:p-8">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="font-heading text-2xl">Novo projeto</DialogTitle>
              <DialogDescription className="text-base">
                Escolha como deseja começar. O fluxo recomendado usa inteligência de leitura para montar o cadastro a
                partir do seu arquivo.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-8 space-y-4">
              <button
                type="button"
                onClick={() => setStep('upload')}
                className={cn(
                  'group relative w-full overflow-hidden rounded-2xl border border-primary/35 bg-gradient-to-br from-primary/15 via-card to-card p-6 text-left shadow-md shadow-primary/10 transition duration-300',
                  'hover:border-primary/55 hover:shadow-lg hover:shadow-primary/20',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                )}
              >
                <div className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-primary/10 blur-2xl transition group-hover:bg-primary/15" />
                <div className="relative flex flex-col gap-3">
                  <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                    <Sparkles className="size-3.5" aria-hidden />
                    Recomendado
                  </span>
                  <span className="flex items-center gap-2 text-lg font-semibold text-foreground">
                    <span className="text-2xl" aria-hidden>
                      📄
                    </span>
                    Criar a partir de documento
                  </span>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Envie o edital (PDF ou Excel) para gerar automaticamente o projeto. O sistema interpreta o arquivo
                    e sugere campos para você revisar.
                  </p>
                  <span className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-primary">
                    <Upload className="size-4 transition group-hover:translate-y-[-2px]" aria-hidden />
                    Continuar para upload
                  </span>
                </div>
              </button>

              <div className="flex justify-center pt-2">
                <Button
                  className="gap-2 text-muted-foreground hover:text-foreground"
                  onClick={handleManual}
                  type="button"
                  variant="ghost"
                >
                  <PenLine className="size-4" aria-hidden />
                  Criar manualmente
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 sm:p-8">
            <button
              type="button"
              onClick={() => setStep('choice')}
              className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Voltar
            </button>

            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="font-heading text-xl">Enviar documento</DialogTitle>
              <DialogDescription>
                PDF ou Excel (até 20 MB). Escolha o tipo do documento para orientar a leitura automática.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="project-doc-file">Arquivo</Label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <label
                    htmlFor="project-doc-file"
                    className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/40 px-4 py-8 text-sm font-medium text-muted-foreground transition hover:border-primary/40 hover:bg-muted/60 hover:text-foreground"
                  >
                    <FileText className="size-5 shrink-0 text-primary" aria-hidden />
                    <FileSpreadsheet className="size-5 shrink-0 text-primary" aria-hidden />
                    <span className="text-center">
                      {file ? file.name : 'Clique para escolher PDF ou Excel'}
                    </span>
                  </label>
                  <input
                    accept=".pdf,.xlsx,.xls,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="sr-only"
                    id="project-doc-file"
                    onChange={(e) => {
                      const next = e.target.files?.[0];
                      setFile(next ?? null);
                    }}
                    type="file"
                  />
                </div>
              </div>

              <Button
                className="w-full gap-2 shadow-glow sm:w-auto"
                disabled={processing}
                onClick={() => void handleProcess()}
                size="lg"
                type="button"
              >
                {processing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Processando documento…
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" aria-hidden />
                    Processar documento
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
