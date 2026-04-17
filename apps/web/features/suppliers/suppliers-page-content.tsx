'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, SquarePen, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/common/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supplierCndBadgeVariant, supplierCndStatusDescription, supplierCndStatusLabel } from '@/features/suppliers/cnd-status';
import { SupplierDialog } from '@/features/suppliers/supplier-dialog';
import { useSuppliersMutations, useSuppliersQuery } from '@/hooks/use-suppliers';
import { formatDate } from '@/lib/format';
import type { Supplier } from '@/types/api';

export function SuppliersPageContent() {
  const router = useRouter();
  const { data, isLoading, isError } = useSuppliersQuery();
  const { deleteSupplier } = useSuppliersMutations();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  async function handleDelete(supplierId: string) {
    const confirmed = window.confirm('Deseja excluir este fornecedor?');

    if (!confirmed) {
      return;
    }

    try {
      await deleteSupplier.mutateAsync(supplierId);
      toast.success('Fornecedor removido com sucesso.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível excluir o fornecedor.';
      toast.error(message);
    }
  }

  function openSupplierDetail(supplierId: string) {
    router.push(`/suppliers/${supplierId}`);
  }

  return (
    <div className="page-sections">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm font-medium leading-relaxed text-muted-foreground">
          Cadastro compartilhado entre projetos. Use ao registrar compras, manter rastreabilidade e acompanhar a validade da CND.
        </p>
        <Button
          className="shrink-0 shadow-glow"
          onClick={() => {
            setEditingSupplier(null);
            setDialogOpen(true);
          }}
          size="lg"
        >
          <Plus className="size-4" />
          Novo fornecedor
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : isError ? (
        <EmptyState
          description="Verifique o backend e tente novamente."
          title="Não foi possível carregar os fornecedores"
        />
      ) : !data || data.length === 0 ? (
        <EmptyState
          actionLabel="Cadastrar fornecedor"
          description="Os fornecedores aparecerao aqui para serem utilizados nos pedidos."
          onAction={() => {
            setEditingSupplier(null);
            setDialogOpen(true);
          }}
          title="Nenhum fornecedor cadastrado"
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow variant="header">
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Endereco</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>CND</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((supplier) => (
                  <TableRow
                    key={supplier.id}
                    className="cursor-pointer focus-visible:bg-muted/45 focus-visible:outline-none"
                    role="button"
                    tabIndex={0}
                    onClick={() => openSupplierDetail(supplier.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openSupplierDetail(supplier.id);
                      }
                    }}
                  >
                    <TableCell>
                      <div>
                        <p className="font-semibold">{supplier.legalName}</p>
                        {supplier.tradeName ? <p className="text-xs text-muted-foreground">{supplier.tradeName}</p> : null}
                        <p className="text-xs text-muted-foreground line-clamp-2">{supplier.notes || '-'}</p>
                      </div>
                    </TableCell>
                    <TableCell>{supplier.documentNumber || '-'}</TableCell>
                    <TableCell className="max-w-[200px] text-sm text-muted-foreground">{supplier.address || '-'}</TableCell>
                    <TableCell>{supplier.phone || '-'}</TableCell>
                    <TableCell>{supplier.email || '-'}</TableCell>
                    <TableCell className="min-w-[240px] max-w-[280px]">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={supplierCndBadgeVariant(supplier)}>{supplierCndStatusLabel(supplier)}</Badge>
                          {supplier.cndValidUntil ? (
                            <span className="text-xs font-medium text-foreground">
                              restrita ate {formatDate(supplier.cndValidUntil)}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">{supplierCndStatusDescription(supplier)}</p>
                        {supplier.cndFederal?.validUntil ? (
                          <p className="text-xs text-muted-foreground">
                            Federal ate {formatDate(supplier.cndFederal.validUntil)}
                          </p>
                        ) : null}
                        {supplier.cndState?.validUntil ? (
                          <p className="text-xs text-muted-foreground">
                            Estadual ate {formatDate(supplier.cndState.validUntil)}
                          </p>
                        ) : null}
                        {supplier.cndIssuedAt ? (
                          <p className="text-xs text-muted-foreground">Emitida (ref.): {formatDate(supplier.cndIssuedAt)}</p>
                        ) : null}
                        {supplier.cndControlCode ? (
                          <p className="text-xs text-muted-foreground">Controle (ref.): {supplier.cndControlCode}</p>
                        ) : null}
                        {supplier.cnd ? <p className="text-xs text-muted-foreground line-clamp-2">{supplier.cnd}</p> : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          onClick={(event) => {
                            event.stopPropagation();
                            setEditingSupplier(supplier);
                            setDialogOpen(true);
                          }}
                          size="sm"
                          variant="ghost"
                        >
                          <SquarePen className="size-4" />
                        </Button>
                        <Button
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleDelete(supplier.id);
                          }}
                          size="sm"
                          variant="ghost"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <SupplierDialog onOpenChange={setDialogOpen} open={dialogOpen} supplier={editingSupplier} />
    </div>
  );
}
