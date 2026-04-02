'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, Building2, FileBadge2, Pencil } from 'lucide-react';
import { useState } from 'react';

import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { supplierCndBadgeVariant, supplierCndStatusDescription, supplierCndStatusLabel } from '@/features/suppliers/cnd-status';
import { SupplierDialog } from '@/features/suppliers/supplier-dialog';
import { useSupplierQuery } from '@/hooks/use-suppliers';
import { formatDate, formatDateTime } from '@/lib/format';

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-border/50 py-3 last:border-b-0 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)] sm:gap-6">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm leading-relaxed text-foreground">{children}</dd>
    </div>
  );
}

function displayOrDash(value: string | null | undefined) {
  if (!value?.trim()) {
    return <span className="text-muted-foreground">-</span>;
  }

  return value;
}

export function SupplierDetailPage({ supplierId }: { supplierId: string }) {
  const { data: supplier, isLoading, isError } = useSupplierQuery(supplierId);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="page-sections">
        <Skeleton className="h-10 w-80" />
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !supplier) {
    return (
      <EmptyState
        actionLabel="Voltar para fornecedores"
        description="O fornecedor nao foi encontrado ou houve falha ao carregar os dados."
        onAction={() => {
          window.location.assign('/suppliers');
        }}
        title="Fornecedor indisponivel"
      />
    );
  }

  const displayName = supplier.tradeName?.trim() || supplier.legalName;

  return (
    <div className="page-sections">
      <PageHeader
        actions={
          <>
            <Button asChild type="button" variant="outline">
              <Link className="inline-flex items-center gap-2" href="/suppliers">
                <ArrowLeft className="size-4" aria-hidden />
                Fornecedores
              </Link>
            </Button>
            <Button className="gap-2" type="button" variant="outline" onClick={() => setDialogOpen(true)}>
              <Pencil className="size-4" aria-hidden />
              Editar fornecedor
            </Button>
          </>
        }
        breadcrumbs={[{ label: 'Fornecedores', href: '/suppliers' }, { label: displayName }]}
        description="Visao consolidada do cadastro, contato e situacao da CND deste fornecedor."
        title={displayName}
      />

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="overflow-hidden border-primary/15 shadow-sm">
          <CardHeader className="border-b border-border/70 bg-muted/35 py-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="size-4 text-primary" aria-hidden />
              Dados do fornecedor
            </CardTitle>
            <CardDescription>Informacoes principais de cadastro e contato.</CardDescription>
          </CardHeader>
          <CardContent className="p-0 px-4 sm:px-6">
            <dl>
              <DetailRow label="Razao social">{displayOrDash(supplier.legalName)}</DetailRow>
              <DetailRow label="Nome fantasia">{displayOrDash(supplier.tradeName)}</DetailRow>
              <DetailRow label="CNPJ / Documento">{displayOrDash(supplier.documentNumber)}</DetailRow>
              <DetailRow label="Contato">{displayOrDash(supplier.contactName)}</DetailRow>
              <DetailRow label="Telefone">{displayOrDash(supplier.phone)}</DetailRow>
              <DetailRow label="E-mail">{displayOrDash(supplier.email)}</DetailRow>
              <DetailRow label="Endereco">{displayOrDash(supplier.address)}</DetailRow>
              <DetailRow label="Observacoes">{displayOrDash(supplier.notes)}</DetailRow>
            </dl>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-primary/15 shadow-sm">
          <CardHeader className="border-b border-border/70 bg-muted/35 py-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileBadge2 className="size-4 text-primary" aria-hidden />
              CND e conformidade
            </CardTitle>
            <CardDescription>Status automatico calculado a partir do PDF enviado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 p-5">
            <div className="rounded-2xl border border-border/70 bg-muted/15 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={supplierCndBadgeVariant(supplier)}>{supplierCndStatusLabel(supplier)}</Badge>
                {supplier.cndValidUntil ? (
                  <span className="text-sm font-medium text-foreground">Valida ate {formatDate(supplier.cndValidUntil)}</span>
                ) : null}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{supplierCndStatusDescription(supplier)}</p>
            </div>

            <dl>
              <DetailRow label="Emissao">{supplier.cndIssuedAt ? formatDateTime(supplier.cndIssuedAt) : <span className="text-muted-foreground">-</span>}</DetailRow>
              <DetailRow label="Validade">{supplier.cndValidUntil ? formatDate(supplier.cndValidUntil) : <span className="text-muted-foreground">-</span>}</DetailRow>
              <DetailRow label="Codigo de controle">{displayOrDash(supplier.cndControlCode)}</DetailRow>
              <DetailRow label="Arquivo lido">{displayOrDash(supplier.cndSourceFileName)}</DetailRow>
              <DetailRow label="Observacao manual">{displayOrDash(supplier.cnd)}</DetailRow>
              <DetailRow label="Ultima atualizacao">{supplier.updatedAt ? formatDateTime(supplier.updatedAt) : <span className="text-muted-foreground">-</span>}</DetailRow>
            </dl>
          </CardContent>
        </Card>
      </div>

      <SupplierDialog onOpenChange={setDialogOpen} open={dialogOpen} supplier={supplier} />
    </div>
  );
}
