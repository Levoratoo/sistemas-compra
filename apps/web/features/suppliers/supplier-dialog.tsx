'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useSuppliersMutations } from '@/hooks/use-suppliers';
import type { Supplier } from '@/types/api';

const formSchema = z.object({
  legalName: z.string().trim().min(1, 'Informe o nome do fornecedor.'),
  tradeName: z.string().trim().optional(),
  documentNumber: z.string().trim().optional(),
  contactName: z.string().trim().optional(),
  address: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email('Informe um e-mail válido.').optional().or(z.literal('')),
  cnd: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

type FormValues = z.input<typeof formSchema>;
type FormSubmitValues = z.output<typeof formSchema>;

export function SupplierDialog({
  open,
  onOpenChange,
  supplier,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: Supplier | null;
  onSaved?: (supplier: Supplier) => void;
}) {
  const { createSupplier, updateSupplier } = useSuppliersMutations();
  const form = useForm<FormValues, undefined, FormSubmitValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      legalName: supplier?.legalName ?? '',
      tradeName: supplier?.tradeName ?? '',
      documentNumber: supplier?.documentNumber ?? '',
      contactName: supplier?.contactName ?? '',
      address: supplier?.address ?? '',
      phone: supplier?.phone ?? '',
      email: supplier?.email ?? '',
      cnd: supplier?.cnd ?? '',
      notes: supplier?.notes ?? '',
    },
  });

  useEffect(() => {
    form.reset({
      legalName: supplier?.legalName ?? '',
      tradeName: supplier?.tradeName ?? '',
      documentNumber: supplier?.documentNumber ?? '',
      contactName: supplier?.contactName ?? '',
      address: supplier?.address ?? '',
      phone: supplier?.phone ?? '',
      email: supplier?.email ?? '',
      cnd: supplier?.cnd ?? '',
      notes: supplier?.notes ?? '',
    });
  }, [form, supplier]);

  async function onSubmit(values: FormSubmitValues) {
    try {
      const payload = {
        ...values,
        tradeName: values.tradeName || null,
        documentNumber: values.documentNumber || null,
        contactName: values.contactName || null,
        address: values.address || null,
        phone: values.phone || null,
        email: values.email || null,
        cnd: values.cnd || null,
        notes: values.notes || null,
      };

      const saved = supplier
        ? await updateSupplier.mutateAsync({
            id: supplier.id,
            payload,
          })
        : await createSupplier.mutateAsync(payload);

      toast.success(supplier ? 'Fornecedor atualizado.' : 'Fornecedor cadastrado com sucesso.');
      onSaved?.(saved);
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
          <div className="space-y-2">
            <Label htmlFor="tradeName">Nome fantasia</Label>
            <Input id="tradeName" placeholder="Opcional" {...form.register('tradeName')} />
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
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">Endereço</Label>
              <Input id="address" placeholder="Logradouro, número, bairro, cidade..." {...form.register('address')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" {...form.register('phone')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" placeholder="Preencher quando disponível" {...form.register('email')} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="cnd">CND (certidão negativa de débitos)</Label>
              <Input id="cnd" placeholder="Número, validade ou observação — preencher depois" {...form.register('cnd')} />
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
