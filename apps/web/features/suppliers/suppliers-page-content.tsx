'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Plus, SquarePen, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useSuppliersMutations, useSuppliersQuery } from '@/hooks/use-suppliers';
import type { Supplier } from '@/types/api';

const formSchema = z.object({
  legalName: z.string().trim().min(1, 'Informe o nome do fornecedor.'),
  documentNumber: z.string().trim().optional(),
  contactName: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email('Informe um e-mail válido.').optional().or(z.literal('')),
  notes: z.string().trim().optional(),
});

type FormValues = z.input<typeof formSchema>;
type FormSubmitValues = z.output<typeof formSchema>;

function SupplierDialog({
  open,
  onOpenChange,
  supplier,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: Supplier | null;
}) {
  const { createSupplier, updateSupplier } = useSuppliersMutations();
  const form = useForm<FormValues, undefined, FormSubmitValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      legalName: supplier?.legalName ?? '',
      documentNumber: supplier?.documentNumber ?? '',
      contactName: supplier?.contactName ?? '',
      phone: supplier?.phone ?? '',
      email: supplier?.email ?? '',
      notes: supplier?.notes ?? '',
    },
  });

  useEffect(() => {
    form.reset({
      legalName: supplier?.legalName ?? '',
      documentNumber: supplier?.documentNumber ?? '',
      contactName: supplier?.contactName ?? '',
      phone: supplier?.phone ?? '',
      email: supplier?.email ?? '',
      notes: supplier?.notes ?? '',
    });
  }, [form, supplier]);

  async function onSubmit(values: FormSubmitValues) {
    try {
      if (supplier) {
        await updateSupplier.mutateAsync({
          id: supplier.id,
          payload: {
            ...values,
            documentNumber: values.documentNumber || null,
            contactName: values.contactName || null,
            phone: values.phone || null,
            email: values.email || null,
            notes: values.notes || null,
          },
        });
        toast.success('Fornecedor atualizado.');
      } else {
        await createSupplier.mutateAsync({
          ...values,
          documentNumber: values.documentNumber || null,
          contactName: values.contactName || null,
          phone: values.phone || null,
          email: values.email || null,
          notes: values.notes || null,
        });
        toast.success('Fornecedor cadastrado com sucesso.');
      }

      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar o fornecedor.';
      toast.error(message);
    }
  }

  const submitting = createSupplier.isPending || updateSupplier.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{supplier ? 'Editar fornecedor' : 'Novo fornecedor'}</DialogTitle>
          <DialogDescription>Cadastre o fornecedor para usar nos pedidos e compras reais.</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="legalName">Razão social</Label>
            <Input id="legalName" {...form.register('legalName')} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="documentNumber">CNPJ/Documento</Label>
              <Input id="documentNumber" {...form.register('documentNumber')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactName">Contato</Label>
              <Input id="contactName" {...form.register('contactName')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" {...form.register('phone')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" {...form.register('email')} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" {...form.register('notes')} />
          </div>

          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} type="button" variant="ghost">
              Cancelar
            </Button>
            <Button disabled={submitting} type="submit">
              {submitting ? 'Salvando...' : supplier ? 'Salvar alterações' : 'Criar fornecedor'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
                  <TableHead>Contato</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell>
                      <div>
                        <p className="font-semibold">{supplier.legalName}</p>
                        <p className="text-xs text-muted-foreground">{supplier.notes || 'Sem observações'}</p>
                      </div>
                    </TableCell>
                    <TableCell>{supplier.documentNumber || '-'}</TableCell>
                    <TableCell>{supplier.contactName || '-'}</TableCell>
                    <TableCell>{supplier.phone || '-'}</TableCell>
                    <TableCell>{supplier.email || '-'}</TableCell>
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
