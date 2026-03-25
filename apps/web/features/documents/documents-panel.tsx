'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { FileUp, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/common/empty-state';
import { DocumentProcessingBadge, DocumentReviewBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { documentTypeOptions, getDocumentTypeLabel } from '@/lib/constants';
import { formatDate, formatDateTime } from '@/lib/format';
import { useProjectDocumentsQuery } from '@/hooks/use-documents';
import { importProjectDocumentFromUpload } from '@/services/projects-service';
import type { DocumentType } from '@/types/api';

function DocumentUploadDialog({
  open,
  onOpenChange,
  projectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [documentType, setDocumentType] = useState<DocumentType>('NOTICE');
  const [file, setFile] = useState<File | null>(null);
  const [documentDate, setDocumentDate] = useState('');
  const [notes, setNotes] = useState('');
  const [pending, setPending] = useState(false);

  function reset() {
    setDocumentType('NOTICE');
    setFile(null);
    setDocumentDate('');
    setNotes('');
    setPending(false);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.error('Selecione um arquivo PDF ou Excel (.pdf, .xlsx, .xls).');
      return;
    }

    setPending(true);
    try {
      const { project, documentId } = await importProjectDocumentFromUpload(projectId, file, documentType, {
        documentDate: documentDate.trim() || null,
        notes: notes.trim() || null,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['project-documents', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
      ]);
      toast.success('Documento processado. Abrindo a revisão dos dados extraídos…');
      onOpenChange(false);
      reset();
      router.push(`/projects/${project.id}/documents/${documentId}/review`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível processar o documento.';
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo documento</DialogTitle>
          <DialogDescription>
            O arquivo é enviado ao servidor e <strong>lido de verdade</strong> (PDF/Excel): em <strong>Edital</strong>, a
            seção 7 (materiais a disponibilizar) é localizada automaticamente quando existir no texto; em{' '}
            <strong>Mapa de implantação</strong>, usa-se o fluxo de linhas do mapa. Ajuste o tipo conforme o documento.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={(ev) => void onSubmit(ev)}>
          <div className="space-y-2">
            <Label htmlFor="documentType">Tipo</Label>
            <Select
              id="documentType"
              onChange={(e) => setDocumentType(e.target.value as DocumentType)}
              value={documentType}
            >
              {documentTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="file">Arquivo</Label>
            <Input
              accept=".pdf,.xlsx,.xls,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              id="file"
              onChange={(ev) => {
                const next = ev.target.files?.[0];
                setFile(next ?? null);
              }}
              required
              type="file"
            />
            {file ? <p className="text-xs text-muted-foreground">{file.name}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="documentDate">Data do documento (opcional)</Label>
            <Input
              id="documentDate"
              onChange={(e) => setDocumentDate(e.target.value)}
              type="date"
              value={documentDate}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea id="notes" onChange={(e) => setNotes(e.target.value)} value={notes} />
          </div>

          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} type="button" variant="ghost">
              Cancelar
            </Button>
            <Button disabled={pending} type="submit">
              {pending ? 'Processando documento…' : 'Processar e revisar extração'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DocumentsPanel({ projectId }: { projectId: string }) {
  const { data, isLoading, isError } = useProjectDocumentsQuery(projectId);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="page-sections">
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle>Documentos do projeto</CardTitle>
            <CardDescription>
              Envie PDF ou Excel: o backend interpreta o arquivo e gera campos para revisão (incluindo mapa de
              implantação).
            </CardDescription>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <FileUp className="size-4" />
            Enviar documento
          </Button>
        </CardHeader>
      </Card>

      {isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-20" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          description="Não foi possível carregar os documentos do projeto."
          title="Erro ao consultar documentos"
        />
      ) : !data || data.length === 0 ? (
        <EmptyState
          actionLabel="Enviar documento"
          description="Envie edital, TR, mapa ou planilha para começar a estruturar o projeto."
          onAction={() => setDialogOpen(true)}
          title="Nenhum documento cadastrado"
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow variant="header">
                  <TableHead>Tipo</TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Processamento</TableHead>
                  <TableHead>Revisão</TableHead>
                  <TableHead>Campos extraídos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((document) => (
                  <TableRow key={document.id}>
                    <TableCell>{getDocumentTypeLabel(document.documentType)}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-semibold">{document.originalFileName}</p>
                        <p className="text-xs text-muted-foreground">{document.mimeType || 'Tipo não informado'}</p>
                        {document.extractedFields.length > 0 ? (
                          <Link
                            className="mt-2 inline-block text-xs font-medium text-primary underline-offset-4 hover:underline"
                            href={`/projects/${projectId}/documents/${document.id}/review`}
                          >
                            Abrir revisão da extração
                          </Link>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p>{formatDate(document.documentDate)}</p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(document.createdAt)}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <DocumentProcessingBadge value={document.processingStatus} />
                    </TableCell>
                    <TableCell>
                      <DocumentReviewBadge value={document.reviewStatus} />
                    </TableCell>
                    <TableCell>
                      <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                        <Sparkles className="size-3.5" />
                        {document.extractedFields.length} campo(s)
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <DocumentUploadDialog onOpenChange={setDialogOpen} open={dialogOpen} projectId={projectId} />
    </div>
  );
}
