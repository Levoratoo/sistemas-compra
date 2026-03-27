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
  Home,
  Pencil,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/common/empty-state';
import { DocumentProcessingBadge } from '@/components/common/status-badge';
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
import {
  DEFAULT_FOLDER_COLOR_HEX,
  DEFAULT_FOLDER_COLOR_HEX_2,
  DEFAULT_FOLDER_SURFACE_STYLE,
  FOLDER_COLOR_SWATCHES,
  FOLDER_SURFACE_OPTIONS,
  FOLDER_WORK_EMOJIS,
  type FolderSurfaceStyle,
  folderCardSurfaceStyle,
  normalizeFolderHex,
  parseFolderSurfaceStyle,
} from '@/lib/folder-appearance';
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

function dragLeaveUnlessEnteringChild(e: DragEvent<HTMLElement>, onLeave: () => void) {
  const next = e.relatedTarget as Node | null;
  if (next && e.currentTarget.contains(next)) return;
  onLeave();
}

function FolderGlyph({
  colorHex,
  iconEmoji,
  className,
  size = 'md',
}: {
  colorHex: string;
  iconEmoji: string | null;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const emojiClass =
    size === 'sm' ? 'min-w-[1.125rem] text-base leading-none' : 'min-w-[1.25rem] text-lg leading-none';
  const iconClass = size === 'sm' ? 'size-4' : 'size-5';
  if (iconEmoji) {
    return (
      <span aria-hidden className={cn('flex shrink-0 items-center justify-center', emojiClass, className)}>
        {iconEmoji}
      </span>
    );
  }
  return (
    <Folder
      aria-hidden
      className={cn(iconClass, 'shrink-0', className)}
      style={{ color: normalizeFolderHex(colorHex) }}
    />
  );
}

function FolderAppearanceFields({
  colorHex,
  colorHex2,
  iconEmoji,
  surfaceStyle,
  onColorChange,
  onColorChange2,
  onEmojiChange,
  onSurfaceStyleChange,
  idPrefix,
}: {
  colorHex: string;
  colorHex2: string;
  iconEmoji: string | null;
  surfaceStyle: FolderSurfaceStyle;
  onColorChange: (hex: string) => void;
  onColorChange2: (hex: string) => void;
  onEmojiChange: (emoji: string | null) => void;
  onSurfaceStyleChange: (style: FolderSurfaceStyle) => void;
  idPrefix: string;
}) {
  const normalized = normalizeFolderHex(colorHex);
  const normalized2 = normalizeFolderHex(colorHex2);
  const style = parseFolderSurfaceStyle(surfaceStyle);
  const showSecondColor = style === 'GRADIENT' || style === 'RADIAL';
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <span className="text-sm font-medium leading-none" id={`${idPrefix}-surface-label`}>
          Estilo do fundo
        </span>
        <div className="grid gap-2 sm:grid-cols-3" role="group" aria-labelledby={`${idPrefix}-surface-label`}>
          {FOLDER_SURFACE_OPTIONS.map((opt) => (
            <button
              className={cn(
                'flex flex-col gap-1 rounded-xl border px-3 py-2.5 text-left text-sm transition hover:scale-[1.02] hover:shadow-sm',
                style === opt.value
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
              key={opt.value}
              onClick={() => onSurfaceStyleChange(opt.value)}
              type="button"
            >
              <span className="font-semibold">{opt.label}</span>
              <span className="text-xs leading-snug opacity-90">{opt.description}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-color`}>{showSecondColor ? 'Primeira cor' : 'Cor da pasta'}</Label>
        <div className="flex flex-wrap gap-2">
          {FOLDER_COLOR_SWATCHES.map((hex) => (
            <button
              aria-label={`Cor ${hex}`}
              className={cn(
                'size-8 shrink-0 rounded-full border-2 border-transparent shadow-sm ring-offset-2 ring-offset-background transition hover:scale-110',
                normalized === hex && 'ring-2 ring-primary',
              )}
              key={hex}
              onClick={() => onColorChange(normalizeFolderHex(hex))}
              style={{ backgroundColor: hex }}
              type="button"
            />
          ))}
        </div>
        <div className="flex items-center gap-3 pt-1">
          <input
            aria-label={showSecondColor ? 'Primeira cor personalizada' : 'Cor personalizada'}
            className="h-11 w-16 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-border bg-transparent p-0 shadow-inner"
            id={`${idPrefix}-color`}
            onChange={(e) => onColorChange(normalizeFolderHex(e.target.value))}
            type="color"
            value={normalized}
          />
          <span className="font-mono text-xs text-muted-foreground">{normalized}</span>
        </div>
      </div>
      {showSecondColor ? (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-color2`}>Segunda cor</Label>
          <div className="flex flex-wrap gap-2">
            {FOLDER_COLOR_SWATCHES.map((hex) => (
              <button
                aria-label={`Segunda cor ${hex}`}
                className={cn(
                  'size-8 shrink-0 rounded-full border-2 border-transparent shadow-sm ring-offset-2 ring-offset-background transition hover:scale-110',
                  normalized2 === hex && 'ring-2 ring-primary',
                )}
                key={`2-${hex}`}
                onClick={() => onColorChange2(normalizeFolderHex(hex))}
                style={{ backgroundColor: hex }}
                type="button"
              />
            ))}
          </div>
          <div className="flex items-center gap-3 pt-1">
            <input
              aria-label="Segunda cor personalizada"
              className="h-11 w-16 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-border bg-transparent p-0 shadow-inner"
              id={`${idPrefix}-color2`}
              onChange={(e) => onColorChange2(normalizeFolderHex(e.target.value))}
              type="color"
              value={normalized2}
            />
            <span className="font-mono text-xs text-muted-foreground">{normalized2}</span>
          </div>
        </div>
      ) : null}
      <div
        className="rounded-xl border border-border/60 p-4 shadow-sm transition duration-200 ease-out hover:scale-[1.02] hover:shadow-md hover:shadow-black/10"
        style={folderCardSurfaceStyle(normalized, style, normalized2)}
      >
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Pré-visualização</p>
        <div className="flex flex-wrap items-center gap-3">
          <FolderGlyph colorHex={normalized} iconEmoji={iconEmoji} />
          <span className="font-medium text-foreground">Assim ficará o cartão da pasta</span>
        </div>
      </div>
      <div className="space-y-2">
        <span className="text-sm font-medium leading-none" id={`${idPrefix}-emoji-label`}>
          Ícone
        </span>
        <div className="flex flex-wrap gap-1.5">
          <button
            aria-label="Sem emoji — usar ícone de pasta"
            className={cn(
              'rounded-lg border px-2 py-1.5 text-xs font-medium transition',
              iconEmoji === null
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted',
            )}
            onClick={() => onEmojiChange(null)}
            type="button"
          >
            Padrão
          </button>
        </div>
        <div
          aria-labelledby={`${idPrefix}-emoji-label`}
          className="max-h-36 overflow-y-auto rounded-xl border border-border/80 bg-muted/20 p-2"
          role="group"
        >
          <div className="flex flex-wrap gap-1">
            {FOLDER_WORK_EMOJIS.map((emoji) => (
              <button
                aria-label={`Emoji ${emoji}`}
                className={cn(
                  'flex size-9 items-center justify-center rounded-lg text-lg transition hover:bg-background',
                  iconEmoji === emoji && 'bg-primary/15 ring-2 ring-primary/40',
                )}
                key={emoji}
                onClick={() => onEmojiChange(emoji)}
                type="button"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
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
  const [colorHex, setColorHex] = useState(DEFAULT_FOLDER_COLOR_HEX);
  const [colorHex2, setColorHex2] = useState(DEFAULT_FOLDER_COLOR_HEX_2);
  const [surfaceStyle, setSurfaceStyle] = useState<FolderSurfaceStyle>(DEFAULT_FOLDER_SURFACE_STYLE);
  const [iconEmoji, setIconEmoji] = useState<string | null>(null);
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
      await createProjectDocumentFolder(projectId, {
        name: trimmed,
        parentId,
        colorHex: normalizeFolderHex(colorHex),
        colorHex2: normalizeFolderHex(colorHex2),
        iconEmoji,
        surfaceStyle,
      });
      toast.success('Pasta criada.');
      setName('');
      setColorHex(DEFAULT_FOLDER_COLOR_HEX);
      setColorHex2(DEFAULT_FOLDER_COLOR_HEX_2);
      setSurfaceStyle(DEFAULT_FOLDER_SURFACE_STYLE);
      setIconEmoji(null);
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
        if (!next) {
          setName('');
          setColorHex(DEFAULT_FOLDER_COLOR_HEX);
          setColorHex2(DEFAULT_FOLDER_COLOR_HEX_2);
          setSurfaceStyle(DEFAULT_FOLDER_SURFACE_STYLE);
          setIconEmoji(null);
        }
        onOpenChange(next);
      }}
      open={open}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
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
          <FolderAppearanceFields
            colorHex={colorHex}
            colorHex2={colorHex2}
            iconEmoji={iconEmoji}
            idPrefix="new-folder"
            onColorChange={setColorHex}
            onColorChange2={setColorHex2}
            onEmojiChange={setIconEmoji}
            onSurfaceStyleChange={setSurfaceStyle}
            surfaceStyle={surfaceStyle}
          />
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
  const [renameColor, setRenameColor] = useState(DEFAULT_FOLDER_COLOR_HEX);
  const [renameColor2, setRenameColor2] = useState(DEFAULT_FOLDER_COLOR_HEX_2);
  const [renameSurfaceStyle, setRenameSurfaceStyle] = useState<FolderSurfaceStyle>(DEFAULT_FOLDER_SURFACE_STYLE);
  const [renameEmoji, setRenameEmoji] = useState<string | null>(null);
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
      await updateProjectDocumentFolder(projectId, renameFolder.id, {
        name: trimmed,
        colorHex: normalizeFolderHex(renameColor),
        colorHex2: normalizeFolderHex(renameColor2),
        iconEmoji: renameEmoji,
        surfaceStyle: renameSurfaceStyle,
      });
      toast.success('Pasta atualizada.');
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
      <Card className="overflow-hidden border-border/80 shadow-md shadow-black/10">
        <CardHeader className="border-b border-border/60 bg-gradient-to-br from-card via-card to-muted/25 pb-6 sm:pb-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
            <div className="min-w-0 space-y-2">
              <CardTitle className="font-heading text-xl tracking-tight text-foreground sm:text-2xl">
                Documentos do projeto
              </CardTitle>
              <CardDescription className="max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground">
                Armazenamento do contrato. Use a alça para arrastar arquivos entre pastas ou solte na trilha abaixo.
                Envios registram a data de hoje.
              </CardDescription>
            </div>
            <div className="flex shrink-0 flex-row flex-wrap gap-2 sm:pt-0.5">
              <Button className="min-h-11" onClick={openNewFolder} type="button" variant="secondary">
                <FolderPlus className="size-4 shrink-0" />
                Nova pasta
              </Button>
              <Button className="min-h-11 shadow-md shadow-primary/15" onClick={openUpload} type="button">
                <FileUp className="size-4 shrink-0" />
                Enviar documento
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <nav
        aria-label="Pasta atual"
        className="flex flex-wrap items-center gap-1 rounded-2xl border border-border/70 bg-muted/25 px-3 py-2.5 shadow-inner shadow-black/5 backdrop-blur-[2px] sm:gap-1.5 sm:px-4 sm:py-3"
      >
        <button
          className={cn(
            'inline-flex min-h-9 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition',
            'text-muted-foreground hover:bg-background/80 hover:text-foreground',
            !currentFolderId && 'pointer-events-none bg-primary/10 text-foreground ring-1 ring-primary/25',
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
          <Home className="size-4 shrink-0 opacity-80" aria-hidden />
          Raiz
        </button>
        {breadcrumb.map((segment) => (
          <span className="flex items-center gap-1 sm:gap-1.5" key={segment.id}>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground/70" aria-hidden />
            <button
              className={cn(
                'inline-flex min-h-9 max-w-[min(100%,16rem)] items-center truncate rounded-lg px-3 py-1.5 text-left text-sm font-medium transition',
                'text-muted-foreground hover:bg-background/80 hover:text-foreground',
                currentFolderId === segment.id &&
                  'pointer-events-none bg-primary/10 text-foreground ring-1 ring-primary/25',
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
              <span className="inline-flex min-w-0 items-center gap-2">
                <FolderGlyph
                  colorHex={normalizeFolderHex(segment.colorHex ?? DEFAULT_FOLDER_COLOR_HEX)}
                  iconEmoji={segment.iconEmoji}
                  size="sm"
                />
                <span className="truncate">{segment.name}</span>
              </span>
            </button>
          </span>
        ))}
      </nav>

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
                      'group flex items-center justify-between gap-2 rounded-xl border border-border/60 px-3 py-3 shadow-sm',
                      'transition duration-200 ease-out will-change-transform',
                      'hover:scale-[1.02] hover:shadow-md hover:shadow-black/10',
                      'active:scale-[0.99]',
                      dropTarget === folder.id && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                    )}
                    key={folder.id}
                    style={folderCardSurfaceStyle(
                      folder.colorHex ?? DEFAULT_FOLDER_COLOR_HEX,
                      parseFolderSurfaceStyle(folder.surfaceStyle),
                      normalizeFolderHex(folder.colorHex2 ?? DEFAULT_FOLDER_COLOR_HEX_2),
                    )}
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
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left font-medium text-foreground transition hover:text-primary"
                      onClick={() => setCurrentFolderId(folder.id)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        setDropTarget(folder.id);
                      }}
                      onDrop={(e) => handleDropDocument(e, folder.id)}
                      type="button"
                    >
                      <FolderGlyph
                        colorHex={normalizeFolderHex(folder.colorHex ?? DEFAULT_FOLDER_COLOR_HEX)}
                        iconEmoji={folder.iconEmoji}
                      />
                      <span className="truncate">{folder.name}</span>
                    </button>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        aria-label="Renomear pasta"
                        className="size-8 p-0"
                        onClick={() => {
                          setRenameFolder(folder);
                          setRenameName(folder.name);
                          setRenameColor(normalizeFolderHex(folder.colorHex ?? DEFAULT_FOLDER_COLOR_HEX));
                          setRenameColor2(normalizeFolderHex(folder.colorHex2 ?? DEFAULT_FOLDER_COLOR_HEX_2));
                          setRenameSurfaceStyle(parseFolderSurfaceStyle(folder.surfaceStyle));
                          setRenameEmoji(folder.iconEmoji);
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar pasta</DialogTitle>
            <DialogDescription>Nome, estilo do fundo, cor e ícone podem ser alterados a qualquer momento.</DialogDescription>
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
            {renameFolder ? (
              <FolderAppearanceFields
                colorHex={renameColor}
                colorHex2={renameColor2}
                iconEmoji={renameEmoji}
                idPrefix="edit-folder"
                onColorChange={setRenameColor}
                onColorChange2={setRenameColor2}
                onEmojiChange={setRenameEmoji}
                onSurfaceStyleChange={setRenameSurfaceStyle}
                surfaceStyle={renameSurfaceStyle}
              />
            ) : null}
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
