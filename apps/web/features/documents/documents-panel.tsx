'use client';

import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import type { DragEvent, FormEvent } from 'react';
import { useMemo, useState } from 'react';
import {
  ChevronRight,
  Download,
  FileUp,
  Folder,
  FolderPlus,
  GripVertical,
  Pencil,
  Sparkles,
  Trash2,
} from 'lucide-react';
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
import { getDocumentTypeLabel } from '@/lib/constants';
import { formatDate, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useProjectDocumentFoldersQuery, useProjectDocumentsQuery } from '@/hooks/use-documents';
import {
  createProjectDocumentFolder,
  deleteProjectDocumentFolder,
  getProjectDocumentDownloadUrl,
  moveProjectDocumentToFolder,
  updateProjectDocumentFolder,
} from '@/services/documents-service';
import { importProjectDocumentFromUpload } from '@/services/projects-service';
import type { ProjectDocument, ProjectDocumentFolder } from '@/types/api';

/** Data de postagem no fuso local (evita trocar o dia perto da meia-noite UTC). */
function postingDateIsoLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function folderPathLabels(folders: ProjectDocumentFolder[]) {
  const byId = new Map(folders.map((f) => [f.id, f]));
  return function labelFor(folderId: string): string {
    const parts: string[] = [];
    let id: string | null | undefined = folderId;
    while (id) {
      const f = byId.get(id);
      if (!f) break;
      parts.unshift(f.name);
      id = f.parentId;
    }
    return parts.join(' / ');
  };
}

function dragLeaveUnlessEnteringChild(e: DragEvent<HTMLElement>, onLeave: () => void) {
  const next = e.relatedTarget as Node | null;
  if (next && e.currentTarget.contains(next)) return;
  onLeave();
}

function buildBreadcrumbPath(
  folders: ProjectDocumentFolder[],
  currentFolderId: string | null,
): ProjectDocumentFolder[] {
  if (!currentFolderId) return [];
  const byId = new Map(folders.map((f) => [f.id, f]));
  const path: ProjectDocumentFolder[] = [];
  let id: string | null | undefined = currentFolderId;
  while (id) {
    const f = byId.get(id);
    if (!f) break;
    path.unshift(f);
    id = f.parentId;
  }
  return path;
}

function DocumentUploadDialog({
  open,
  onOpenChange,
  projectId,
  folderId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  folderId: string | null;
}) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [pending, setPending] = useState(false);

  const acceptExtensions =
    '.pdf,.xlsx,.xls,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv,.zip,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*';

  function reset() {
    setFile(null);
    setNotes('');
    setPending(false);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.error('Selecione um arquivo.');
      return;
    }

    setPending(true);
    try {
      await importProjectDocumentFromUpload(projectId, file, 'OTHER_ATTACHMENT', {
        documentDate: postingDateIsoLocal(),
        notes: notes.trim() || null,
        folderId: folderId ?? null,
        storeOnly: true,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['project-documents', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['project-document-folders', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
      ]);
      onOpenChange(false);
      reset();
      toast.success('Arquivo guardado no repositório do projeto.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível enviar o arquivo.';
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar documento</DialogTitle>
          <DialogDescription>
            Armazenamento na pasta atual, <strong>sem extração automática</strong>. A data do registro é a data de
            envio. Formatos: PDF, Office, imagens, CSV, TXT, ZIP.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={(ev) => void onSubmit(ev)}>
          <div className="space-y-2">
            <Label htmlFor="file">Arquivo</Label>
            <Input
              accept={acceptExtensions}
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
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea id="notes" onChange={(e) => setNotes(e.target.value)} value={notes} />
          </div>

          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} type="button" variant="ghost">
              Cancelar
            </Button>
            <Button disabled={pending} type="submit">
              {pending ? 'Enviando…' : 'Guardar arquivo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewFolderDialog({
  open,
  onOpenChange,
  projectId,
  parentId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  parentId: string | null;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Informe o nome da pasta.');
      return;
    }
    setPending(true);
    try {
      await createProjectDocumentFolder(projectId, { name: trimmed, parentId });
      toast.success('Pasta criada.');
      setName('');
      onOpenChange(false);
      onCreated();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível criar a pasta.';
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) setName('');
        onOpenChange(next);
      }}
      open={open}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova pasta</DialogTitle>
          <DialogDescription>A pasta será criada no local em que você está navegando.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(ev) => void onSubmit(ev)}>
          <div className="space-y-2">
            <Label htmlFor="folderName">Nome</Label>
            <Input
              autoFocus
              id="folderName"
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Contratos, Editais arquivados…"
              value={name}
            />
          </div>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} type="button" variant="ghost">
              Cancelar
            </Button>
            <Button disabled={pending} type="submit">
              {pending ? 'Criando…' : 'Criar pasta'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DocumentsPanel({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [renameFolder, setRenameFolder] = useState<ProjectDocumentFolder | null>(null);
  const [renameName, setRenameName] = useState('');
  const [dropTarget, setDropTarget] = useState<'root' | string | null>(null);

  function openNewFolder() {
    setUploadOpen(false);
    setNewFolderOpen(true);
  }

  function openUpload() {
    setNewFolderOpen(false);
    setUploadOpen(true);
  }

  const folderScope = currentFolderId === null ? 'root' : currentFolderId;
  const { data: documents, isLoading: loadingDocs, isError: errorDocs } = useProjectDocumentsQuery(
    projectId,
    folderScope,
  );
  const { data: folders, isLoading: loadingFolders, isError: errorFolders } =
    useProjectDocumentFoldersQuery(projectId);

  const loading = loadingDocs || loadingFolders;
  const isError = errorDocs || errorFolders;

  const subfolders = useMemo(() => {
    if (!folders) return [];
    return folders.filter((f) => (f.parentId ?? null) === (currentFolderId ?? null));
  }, [folders, currentFolderId]);

  const breadcrumb = useMemo(() => buildBreadcrumbPath(folders ?? [], currentFolderId), [folders, currentFolderId]);

  const pathLabel = useMemo(() => folderPathLabels(folders ?? []), [folders]);

  async function refreshAll() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['project-documents', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['project-document-folders', projectId] }),
    ]);
  }

  async function handleDeleteFolder(folder: ProjectDocumentFolder) {
    const ok = window.confirm(
      `Excluir a pasta "${folder.name}"? Ela precisa estar vazia (sem subpastas nem arquivos).`,
    );
    if (!ok) return;
    try {
      await deleteProjectDocumentFolder(projectId, folder.id);
      toast.success('Pasta excluída.');
      if (currentFolderId === folder.id) {
        setCurrentFolderId(folder.parentId);
      }
      await refreshAll();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível excluir a pasta.';
      toast.error(message);
    }
  }

  async function submitRename(e: FormEvent) {
    e.preventDefault();
    if (!renameFolder) return;
    const trimmed = renameName.trim();
    if (!trimmed) {
      toast.error('Informe o nome.');
      return;
    }
    try {
      await updateProjectDocumentFolder(projectId, renameFolder.id, { name: trimmed });
      toast.success('Pasta renomeada.');
      setRenameFolder(null);
      await refreshAll();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível renomear.';
      toast.error(message);
    }
  }

  async function handleMoveDocument(document: ProjectDocument, targetFolderId: string | null) {
    if ((document.folderId ?? null) === targetFolderId) return;
    try {
      await moveProjectDocumentToFolder(projectId, document.id, targetFolderId);
      toast.success('Documento movido.');
      await refreshAll();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível mover o documento.';
      toast.error(message);
    }
  }

  function handleDropDocument(ev: DragEvent, targetFolderId: string | null) {
    ev.preventDefault();
    setDropTarget(null);
    const docId = ev.dataTransfer.getData('text/plain');
    if (!docId || !documents) return;
    const doc = documents.find((d) => d.id === docId);
    if (!doc) return;
    void handleMoveDocument(doc, targetFolderId);
  }

  const hasContent =
    (documents && documents.length > 0) || (subfolders && subfolders.length > 0);

  return (
    <div className="page-sections">
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle>Documentos do projeto</CardTitle>
            <CardDescription>
              Repositório central do contrato: organize em pastas, baixe o arquivo original e arraste pelo ícone de alça
              para soltar em outra pasta (ou na trilha). Os envios são armazenados com a data do dia.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={openNewFolder} type="button" variant="secondary">
              <FolderPlus className="size-4" />
              Nova pasta
            </Button>
            <Button onClick={openUpload} type="button">
              <FileUp className="size-4" />
              Enviar documento
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        <button
          className={cn(
            'rounded-md px-2 py-1 font-medium text-primary transition hover:bg-primary/10',
            !currentFolderId && 'pointer-events-none text-foreground',
            dropTarget === 'root' && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
          )}
          onClick={() => setCurrentFolderId(null)}
          onDragLeave={(e) =>
            dragLeaveUnlessEnteringChild(e, () => {
              setDropTarget(null);
            })
          }
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setDropTarget('root');
          }}
          onDrop={(e) => handleDropDocument(e, null)}
          type="button"
        >
          Raiz
        </button>
        {breadcrumb.map((segment) => (
          <span className="flex items-center gap-1" key={segment.id}>
            <ChevronRight className="size-4 shrink-0 opacity-60" />
            <button
              className={cn(
                'rounded-md px-2 py-1 font-medium text-primary transition hover:bg-primary/10',
                currentFolderId === segment.id && 'pointer-events-none text-foreground',
                dropTarget === segment.id && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
              )}
              onClick={() => setCurrentFolderId(segment.id)}
              onDragLeave={(e) =>
                dragLeaveUnlessEnteringChild(e, () => {
                  setDropTarget(null);
                })
              }
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDropTarget(segment.id);
              }}
              onDrop={(e) => handleDropDocument(e, segment.id)}
              type="button"
            >
              {segment.name}
            </button>
          </span>
        ))}
      </div>

      {loading ? (
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
      ) : !hasContent ? (
        <EmptyState
          actionLabel="Nova pasta"
          description="Crie uma pasta para organizar por tema ou envie arquivos para armazenamento (sem extração automática)."
          onAction={openNewFolder}
          onSecondaryAction={openUpload}
          secondaryActionLabel="Enviar documento"
          title="Esta pasta está vazia"
        />
      ) : (
        <div className="grid gap-6">
          {subfolders.length > 0 ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Pastas</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {subfolders.map((folder) => (
                  <div
                    className={cn(
                      'flex items-center justify-between gap-2 rounded-xl border border-border bg-card/60 px-3 py-3 transition',
                      dropTarget === folder.id && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                    )}
                    key={folder.id}
                    onDragLeave={(e) =>
                      dragLeaveUnlessEnteringChild(e, () => {
                        setDropTarget(null);
                      })
                    }
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      setDropTarget(folder.id);
                    }}
                    onDrop={(e) => handleDropDocument(e, folder.id)}
                  >
                    <button
                      className="flex min-w-0 flex-1 items-center gap-2 text-left font-medium text-foreground transition hover:text-primary"
                      onClick={() => setCurrentFolderId(folder.id)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        setDropTarget(folder.id);
                      }}
                      onDrop={(e) => handleDropDocument(e, folder.id)}
                      type="button"
                    >
                      <Folder className="size-5 shrink-0 text-primary" />
                      <span className="truncate">{folder.name}</span>
                    </button>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        aria-label="Renomear pasta"
                        className="size-8 p-0"
                        onClick={() => {
                          setRenameFolder(folder);
                          setRenameName(folder.name);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          setDropTarget(folder.id);
                        }}
                        onDrop={(e) => handleDropDocument(e, folder.id)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        aria-label="Excluir pasta"
                        className="size-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => void handleDeleteFolder(folder)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          setDropTarget(folder.id);
                        }}
                        onDrop={(e) => handleDropDocument(e, folder.id)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {documents && documents.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow variant="header">
                      <TableHead className="w-12 pr-0" />
                      <TableHead>Tipo</TableHead>
                      <TableHead>Arquivo</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Processamento</TableHead>
                      <TableHead>Revisão</TableHead>
                      <TableHead>Campos extraídos</TableHead>
                      <TableHead className="w-[200px]">Mover para</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map((document) => (
                      <TableRow key={document.id}>
                        <TableCell className="w-12 pr-0 align-middle">
                          <span
                            className="inline-flex cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
                            draggable
                            onDragEnd={() => setDropTarget(null)}
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', document.id);
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            title="Arrastar para mover para outra pasta"
                          >
                            <GripVertical className="size-5" />
                          </span>
                        </TableCell>
                        <TableCell>{getDocumentTypeLabel(document.documentType)}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-semibold">{document.originalFileName}</p>
                            <p className="text-xs text-muted-foreground">{document.mimeType || 'Tipo não informado'}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                              <a
                                className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
                                href={getProjectDocumentDownloadUrl(projectId, document.id)}
                                rel="noopener noreferrer"
                                target="_blank"
                              >
                                <Download className="size-3.5" />
                                Baixar original
                              </a>
                              {document.extractedFields.length > 0 ? (
                                <Link
                                  className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                                  href={`/projects/${projectId}/documents/${document.id}/review`}
                                >
                                  Revisão da extração
                                </Link>
                              ) : null}
                            </div>
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
                        <TableCell>
                          <Select
                            aria-label="Mover documento"
                            className="text-xs"
                            onChange={(e) => {
                              const v = e.target.value;
                              void handleMoveDocument(document, v === '__root__' ? null : v);
                            }}
                            value={document.folderId ?? '__root__'}
                          >
                            <option value="__root__">Raiz</option>
                            {(folders ?? []).map((f) => (
                              <option key={f.id} value={f.id}>
                                {pathLabel(f.id)}
                              </option>
                            ))}
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}

      {uploadOpen ? (
        <DocumentUploadDialog
          folderId={currentFolderId}
          onOpenChange={(next) => {
            setUploadOpen(next);
            if (next) setNewFolderOpen(false);
          }}
          open={uploadOpen}
          projectId={projectId}
        />
      ) : null}

      {newFolderOpen ? (
        <NewFolderDialog
          onCreated={() => void refreshAll()}
          onOpenChange={(next) => {
            setNewFolderOpen(next);
            if (next) setUploadOpen(false);
          }}
          open={newFolderOpen}
          parentId={currentFolderId}
          projectId={projectId}
        />
      ) : null}

      <Dialog
        onOpenChange={(open) => {
          if (!open) setRenameFolder(null);
        }}
        open={Boolean(renameFolder)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear pasta</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(ev) => void submitRename(ev)}>
            <div className="space-y-2">
              <Label htmlFor="renameFolder">Nome</Label>
              <Input
                id="renameFolder"
                onChange={(e) => setRenameName(e.target.value)}
                value={renameName}
              />
            </div>
            <DialogFooter>
              <Button onClick={() => setRenameFolder(null)} type="button" variant="ghost">
                Cancelar
              </Button>
              <Button type="submit">Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
