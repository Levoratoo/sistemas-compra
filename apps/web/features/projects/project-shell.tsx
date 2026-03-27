'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Banknote, ClipboardList, Download, FileText, Landmark, Pencil, ShoppingCart } from 'lucide-react';

import { PageHeader } from '@/components/common/page-header';
import { StatCard } from '@/components/common/stat-card';
import { ImplementationStatusBadge, ProjectStatusBadge } from '@/components/common/status-badge';
import { ProjectNav } from '@/components/layout/project-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNumber } from '@/lib/format';
import { computePurchasePipelineMetrics } from '@/lib/purchase-pipeline-metrics';
import {
  isLikelyPdfDocument,
  pickPrimaryEditalDocument,
  projectDocumentPublicFileUrl,
} from '@/lib/project-document-url';
import { useProjectQuery } from '@/hooks/use-projects';

import { ProjectFormDialog } from './project-form-dialog';

export function ProjectShell({
  children,
  projectId,
}: {
  children: ReactNode;
  projectId: string;
}) {
  const pathname = usePathname();
  const isExtractionReview = /\/documents\/[^/]+\/review\/?$/.test(pathname);
  const { data: project, isPending, isError } = useProjectQuery(projectId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [objectSummaryOpen, setObjectSummaryOpen] = useState(false);

  if (isPending && !project) {
    return (
      <div className="page-sections">
        <Card>
          <CardContent className="space-y-4 p-6">
            <Skeleton className="h-8 w-2/3 max-w-md" />
            <Skeleton className="h-4 w-full max-w-xl" />
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="p-6">
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="min-h-[320px] w-full" />
      </div>
    );
  }

  if (isError || !project) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm font-medium text-muted-foreground">
          Não foi possível carregar o projeto selecionado.
        </CardContent>
      </Card>
    );
  }

  if (isExtractionReview) {
    return (
      <div className="page-sections">
        <PageHeader
          actions={
            <Button onClick={() => setDialogOpen(true)} variant="outline">
              <Pencil className="size-4" />
              Editar projeto
            </Button>
          }
          breadcrumbs={[
            { label: 'Projetos', href: '/projects' },
            { label: project.code, href: `/projects/${projectId}` },
            { label: 'Revisão de extração' },
          ]}
          description="Confira e ajuste os valores sugeridos a partir do documento enviado."
          title="Revisão da extração"
        />
        {children}
        <ProjectFormDialog onOpenChange={setDialogOpen} open={dialogOpen} project={project} />
      </div>
    );
  }

  const hasObjectSummary = Boolean(project.objectSummary?.trim());
  const displayName = (project.organizationName || project.name).trim() || project.code;
  const pipeline = computePurchasePipelineMetrics(project.budgetItems);
  const editalDoc = pickPrimaryEditalDocument(project.documents);
  const editalDownloadHref = editalDoc ? projectDocumentPublicFileUrl(editalDoc.storagePath) : null;
  const editalDownloadLabel = editalDoc && isLikelyPdfDocument(editalDoc) ? 'Baixar edital' : 'Baixar documento';

  return (
    <div className="page-sections">
      <PageHeader
        breadcrumbs={[{ label: 'Projetos', href: '/projects' }, { label: displayName }]}
        title={displayName}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {editalDownloadHref ? (
              <Button asChild className="gap-2" variant="outline">
                <a
                  download={editalDoc?.originalFileName}
                  href={editalDownloadHref}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <Download className="size-4 shrink-0" aria-hidden />
                  {editalDownloadLabel}
                </a>
              </Button>
            ) : null}
            {hasObjectSummary ? (
              <Button
                className="gap-2"
                onClick={() => setObjectSummaryOpen(true)}
                type="button"
                variant="outline"
              >
                <FileText className="size-4 shrink-0" aria-hidden />
                Objeto do edital
              </Button>
            ) : null}
            <Button className="gap-2" onClick={() => setDialogOpen(true)} type="button" variant="outline">
              <Pencil className="size-4 shrink-0" aria-hidden />
              Editar projeto
            </Button>
          </div>
        }
      />

      <Dialog onOpenChange={setObjectSummaryOpen} open={objectSummaryOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-6 pb-4 pt-6">
            <DialogTitle>Objeto e escopo (edital)</DialogTitle>
            <DialogDescription>
              Texto de referência extraído ou cadastrado para este projeto. Use &quot;Editar projeto&quot; para alterar.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[min(70vh,720px)] overflow-y-auto px-6 pb-6">
            <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground">
              {project.objectSummary?.trim() || '—'}
            </pre>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="overflow-hidden">
        <CardContent className="space-y-8 p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <ProjectStatusBadge value={project.projectStatus} />
            <ImplementationStatusBadge value={project.implementationStatus} />
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              helper={project.bidNumber || 'Sem pregão informado'}
              icon={Landmark}
              title="Órgão contratante"
              value={project.organizationName}
            />
            <StatCard
              helper="Sem compra registrada no checklist"
              icon={ShoppingCart}
              title="Total de itens pendentes compra"
              value={formatNumber(pipeline.pendingCompra)}
            />
            <StatCard
              helper="Comprado, aguardando envio para pagamento"
              icon={Banknote}
              title="Total itens pendentes de pagamento"
              value={formatNumber(pipeline.pendingPagamento)}
            />
            <StatCard
              helper="Itens em acompanhamento até entrega na unidade"
              icon={ClipboardList}
              title="Total de pendências conduzidas"
              value={formatNumber(pipeline.pendenciasConduzidas)}
            />
          </div>

          <ProjectNav projectId={projectId} />
        </CardContent>
      </Card>

      {children}

      <ProjectFormDialog onOpenChange={setDialogOpen} open={dialogOpen} project={project} />
    </div>
  );
}
