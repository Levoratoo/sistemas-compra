'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Banknote, ClipboardList, Download, FileText, Landmark, Pencil, ScanText, ShoppingCart } from 'lucide-react';

import { useAuth } from '@/components/auth/auth-context';
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
import { useProjectQuery, useProjectSummaryQuery } from '@/hooks/use-projects';

import { ImageOcrDialog } from './image-ocr-dialog';
import { ProjectFormDialog } from './project-form-dialog';

export function ProjectShell({
  children,
  projectId,
}: {
  children: ReactNode;
  projectId: string;
}) {
  const pathname = usePathname();
  const { isSupervisor } = useAuth();
  const isExtractionReview = /\/documents\/[^/]+\/review\/?$/.test(pathname);
  const projectDetailQuery = useProjectQuery(projectId, !isSupervisor);
  const projectSummaryQuery = useProjectSummaryQuery(projectId, isSupervisor);
  const projectDetail = projectDetailQuery.data;
  const projectSummary = projectSummaryQuery.data;
  const project = isSupervisor ? projectSummary : projectDetail;
  const isPending = isSupervisor ? projectSummaryQuery.isPending : projectDetailQuery.isPending;
  const isError = isSupervisor ? projectSummaryQuery.isError : projectDetailQuery.isError;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [objectSummaryOpen, setObjectSummaryOpen] = useState(false);
  const [imageOcrOpen, setImageOcrOpen] = useState(false);

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
            <div className="flex flex-wrap items-center gap-2">
              <Button className="gap-2" onClick={() => setImageOcrOpen(true)} type="button" variant="outline">
                <ScanText className="size-4 shrink-0" aria-hidden />
                OCR de imagem
              </Button>
              <Button className="gap-2" onClick={() => setDialogOpen(true)} type="button" variant="outline">
                <Pencil className="size-4 shrink-0" aria-hidden />
                Editar projeto
              </Button>
            </div>
          }
          breadcrumbs={[
            { label: 'Projetos', href: '/projects' },
            { label: projectDetail?.code ?? projectId, href: `/projects/${projectId}` },
            { label: 'Revisão de extração' },
          ]}
          description="Confira e ajuste os valores sugeridos a partir do documento enviado."
          title="Revisão da extração"
        />
        {children}
        <ImageOcrDialog onOpenChange={setImageOcrOpen} open={imageOcrOpen} />
        {projectDetail ? <ProjectFormDialog onOpenChange={setDialogOpen} open={dialogOpen} project={projectDetail} /> : null}
      </div>
    );
  }

  const hasObjectSummary = Boolean(project.objectSummary?.trim());
  const displayName = (project.organizationName || project.name).trim() || project.code;

  if (isSupervisor) {
    return (
      <div className="page-sections">
        <PageHeader
          breadcrumbs={[
            { label: 'Projetos', href: '/projects' },
            { label: displayName },
            { label: 'Relatório de Itens Faltantes' },
          ]}
          description="Acompanhe apenas as solicitações adicionais e aprovações deste projeto."
          title={displayName}
        />

        <Card className="overflow-hidden">
          <CardContent className="space-y-8 p-6 md:p-8">
            <div className="flex flex-wrap items-center gap-3">
              <ProjectStatusBadge value={project.projectStatus} />
              <ImplementationStatusBadge value={project.implementationStatus} />
            </div>

            <ProjectNav projectId={projectId} />
          </CardContent>
        </Card>

        {children}
      </div>
    );
  }

  if (!projectDetail) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm font-medium text-muted-foreground">
          Não foi possível carregar o projeto selecionado.
        </CardContent>
      </Card>
    );
  }

  const pipeline = computePurchasePipelineMetrics(projectDetail.budgetItems);
  const editalDoc = pickPrimaryEditalDocument(projectDetail.documents);
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
            <Button className="gap-2" onClick={() => setImageOcrOpen(true)} type="button" variant="outline">
              <ScanText className="size-4 shrink-0" aria-hidden />
              OCR de imagem
            </Button>
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
              {projectDetail.objectSummary?.trim() || '—'}
            </pre>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="overflow-hidden">
        <CardContent className="space-y-8 p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <ProjectStatusBadge value={projectDetail.projectStatus} />
            <ImplementationStatusBadge value={projectDetail.implementationStatus} />
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              helper={projectDetail.bidNumber || 'Sem pregão informado'}
              icon={Landmark}
              title="Órgão contratante"
              value={projectDetail.organizationName}
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

      <ImageOcrDialog onOpenChange={setImageOcrOpen} open={imageOcrOpen} />
      <ProjectFormDialog onOpenChange={setDialogOpen} open={dialogOpen} project={projectDetail} />
    </div>
  );
}
