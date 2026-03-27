'use client';

import { useCallback, useId, useRef, useState } from 'react';
import { ClipboardPaste, Copy, ImageIcon, Loader2 } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { recognizeImageFile, type OcrTableRow } from '@/services/ocr-service';
import { cn } from '@/lib/utils';

const ACCEPT = 'image/png,image/jpeg,image/jpg,image/gif,image/webp';

async function fileFromClipboardDataTransfer(items: DataTransferItemList): Promise<File | null> {
  for (const item of Array.from(items)) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const f = item.getAsFile();
      if (f) return f;
    }
  }
  return null;
}

async function fileFromClipboardApi(): Promise<File | null> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.read) {
    return null;
  }
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      for (const type of item.types) {
        if (type.startsWith('image/')) {
          const blob = await item.getType(type);
          return new File([blob], `clipboard.${type.split('/')[1] ?? 'png'}`, { type });
        }
      }
    }
  } catch {
    /* permissão negada ou não suportado */
  }
  return null;
}

type ImageOcrDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ImageOcrDialog({ open, onOpenChange }: ImageOcrDialogProps) {
  const inputId = useId();
  const pasteRef = useRef<HTMLDivElement>(null);
  const [resultText, setResultText] = useState('');
  const [tableRows, setTableRows] = useState<OcrTableRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const runOcr = useCallback(async (file: File) => {
    setBusy(true);
    setResultText('');
    setTableRows([]);
    try {
      const res = await recognizeImageFile(file);
      setResultText(res.text || '');
      setTableRows(Array.isArray(res.tableRows) ? res.tableRows : []);
      if (!res.text?.trim()) {
        toast.message('Nenhum texto reconhecido', {
          description: 'Tente uma imagem mais nítida ou com melhor contraste.',
        });
      } else {
        toast.success('Texto extraído da imagem.');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha no OCR.');
    } finally {
      setBusy(false);
    }
  }, []);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        toast.error('Selecione um arquivo de imagem (PNG, JPEG, GIF ou WebP).');
        return;
      }
      void runOcr(file);
    },
    [runOcr],
  );

  const onPaste = useCallback(
    async (e: React.ClipboardEvent) => {
      e.preventDefault();
      const dt = e.clipboardData;
      let file = await fileFromClipboardDataTransfer(dt.items);
      if (!file) {
        file = await fileFromClipboardApi();
      }
      if (file) {
        void runOcr(file);
        return;
      }
      toast.message('Cole uma imagem (print)', {
        description: 'Use Ctrl+V com captura de tela na área tracejada, ou escolha um arquivo.',
      });
    },
    [runOcr],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  async function copyResult() {
    if (!resultText.trim()) return;
    try {
      await navigator.clipboard.writeText(resultText);
      toast.success('Copiado para a área de transferência.');
    } catch {
      toast.error('Não foi possível copiar.');
    }
  }

  return (
    <Dialog
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setResultText('');
          setTableRows([]);
          setBusy(false);
        }
      }}
      open={open}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 pb-4 pt-6">
          <DialogTitle>Texto a partir de imagem (OCR)</DialogTitle>
          <DialogDescription>
            Quando o PDF não permite copiar o texto, use um print da tela ou foto do trecho. Arraste a imagem, escolha
            arquivo ou cole com <kbd className="rounded border border-border bg-muted px-1 font-mono text-xs">Ctrl</kbd>+
            <kbd className="rounded border border-border bg-muted px-1 font-mono text-xs">V</kbd> na área abaixo. O
            reconhecimento roda no servidor (idiomas: português + inglês).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto px-6 py-4">
          <input
            accept={ACCEPT}
            className="sr-only"
            id={inputId}
            onChange={(e) => handleFiles(e.target.files)}
            type="file"
          />

          <div className="flex flex-wrap gap-2">
            <Button asChild className="gap-2" disabled={busy} type="button" variant="secondary">
              <label className="cursor-pointer" htmlFor={inputId}>
                <ImageIcon className="size-4" aria-hidden />
                Escolher imagem
              </label>
            </Button>
          </div>

          <div
            ref={pasteRef}
            className={cn(
              'relative min-h-[140px] rounded-lg border-2 border-dashed p-4 transition-colors',
              dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 bg-muted/30',
              busy && 'pointer-events-none opacity-60',
            )}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDrop={onDrop}
            onPaste={onPaste}
            role="textbox"
            tabIndex={0}
            aria-label="Área para colar imagem ou soltar arquivo"
          >
            {busy ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
                <p className="text-sm font-medium">Reconhecendo texto…</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-6 text-center text-sm text-muted-foreground">
                <ClipboardPaste className="size-8 opacity-50" aria-hidden />
                <p>
                  Arraste uma imagem aqui ou clique nesta área e use{' '}
                  <strong className="text-foreground">Ctrl+V</strong> para colar um print.
                </p>
              </div>
            )}
          </div>

          {tableRows.length > 0 ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Itens detectados (quantidade + descrição)
                </span>
                <Button
                  className="gap-1.5"
                  disabled={busy}
                  onClick={() => void copyTableTsv()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Copy className="size-3.5" aria-hidden />
                  Copiar tabela
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow variant="header">
                    <TableHead className="w-[22%]">Item</TableHead>
                    <TableHead className="w-[18%]">Qtd.</TableHead>
                    <TableHead>Descrição</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableRows.map((row, i) => (
                    <TableRow key={`${row.item}-${i}`}>
                      <TableCell className="whitespace-nowrap font-medium">{row.item}</TableCell>
                      <TableCell className="text-muted-foreground">{row.quantity}</TableCell>
                      <TableCell className="text-sm leading-relaxed">{row.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Texto bruto (OCR)</span>
              <Button
                className="gap-1.5"
                disabled={!resultText.trim() || busy}
                onClick={() => void copyResult()}
                size="sm"
                type="button"
                variant="outline"
              >
                <Copy className="size-3.5" aria-hidden />
                Copiar
              </Button>
            </div>
            <Textarea
              className="min-h-[200px] font-mono text-sm"
              placeholder="O resultado do OCR aparecerá aqui…"
              readOnly
              value={resultText}
            />
          </div>
        </div>

        <DialogFooter className="border-t border-border px-6 py-4">
          <Button onClick={() => onOpenChange(false)} type="button" variant="secondary">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
