'use client';

import { useState } from 'react';
import { Plus, SquarePen, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSuppliersMutations, useSuppliersQuery } from '@/hooks/use-suppliers';
import { SupplierDialog } from '@/features/suppliers/supplier-dialog';
import type { Supplier } from '@/types/api';

export function SuppliersPageContent() {
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

  return (
    <div className="page-sections">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm font-medium leading-relaxed text-muted-foreground">
          Cadastro compartilhado entre projetos — use ao registrar compras e manter rastreabilidade.
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
          description="Os fornecedores aparecerão aqui para serem utilizados nos pedidos."
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
                  <TableHead>Endereço</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>CND</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell>
                      <div>
                        <p className="font-semibold">{supplier.legalName}</p>
                        {supplier.tradeName ? (
                          <p className="text-xs text-muted-foreground">{supplier.tradeName}</p>
                        ) : null}
                        <p className="text-xs text-muted-foreground line-clamp-2">{supplier.notes || '—'}</p>
                      </div>
                    </TableCell>
                    <TableCell>{supplier.documentNumber || '-'}</TableCell>
                    <TableCell className="max-w-[200px] text-sm text-muted-foreground">
                      {supplier.address || '—'}
                    </TableCell>
                    <TableCell>{supplier.phone || '-'}</TableCell>
                    <TableCell>{supplier.email || '—'}</TableCell>
                    <TableCell className="max-w-[140px] truncate text-sm">{supplier.cnd || '—'}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          onClick={() => {
                            setEditingSupplier(supplier);
                            setDialogOpen(true);
                          }}
                          size="sm"
                          variant="ghost"
                        >
                          <SquarePen className="size-4" />
                        </Button>
                        <Button onClick={() => handleDelete(supplier.id)} size="sm" variant="ghost">
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
