'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { FileUp, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
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
import { supplierCndBadgeVariant, supplierCndStatusDescription, supplierCndStatusLabel } from '@/features/suppliers/cnd-status';
import { useSuppliersMutations } from '@/hooks/use-suppliers';
import { formatDate, formatDateTime } from '@/lib/format';
import type { Supplier } from '@/types/api';

const formSchema = z.object({
  legalName: z.string().trim().min(1, 'Informe o nome do fornecedor.'),
  tradeName: z.string().trim().optional(),
  documentNumber: z.string().trim().optional(),
  contactName: z.string().trim().optional(),
  address: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email('Informe um e-mail valido.').optional().or(z.literal('')),
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
  const queryClient = useQueryClient();
  const { createSupplier, updateSupplier } = useSuppliersMutations();
  const [cndFiles, setCndFiles] = useState<File[]>([]);

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

  useEffect(() => {
    if (!open) {
      setCndFiles([]);
    }
  }, [open]);

  function removeCndFile(index: number) {
    setCndFiles((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  }

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
            cndFiles: cndFiles.length > 0 ? cndFiles : undefined,
          })
        : await createSupplier.mutateAsync({
            payload,
            cndFiles: cndFiles.length > 0 ? cndFiles : undefined,
          });

      if (cndFiles.length > 0) {
        await queryClient.invalidateQueries({ queryKey: ['project-documents'] });
        await queryClient.invalidateQueries({ queryKey: ['project-document-folders'] });
      }

      toast.success(supplier ? 'Fornecedor atualizado.' : 'Fornecedor cadastrado com sucesso.');
      onSaved?.(saved);
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel salvar o fornecedor.';
      toast.error(message);
    }
  }

  const submitting = createSupplier.isPending || updateSupplier.isPending;
  const hasParsedCnd = Boolean(
    supplier?.cndValidUntil || supplier?.cndIssuedAt || supplier?.cndControlCode || supplier?.cndSourceFileName,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-h-[calc(100dvh-2rem)]">
        <div className="shrink-0 px-4 pb-2 pt-5 sm:px-6 sm:pt-6">
          <DialogHeader>
            <DialogTitle>{supplier ? 'Editar fornecedor' : 'Novo fornecedor'}</DialogTitle>
            <DialogDescription>Cadastre o fornecedor para usar nos pedidos, compras reais e controle automatico da CND.</DialogDescription>
          </DialogHeader>
        </div>

        <form className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 sm:px-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="legalName">Razao social</Label>
                <Input id="legalName" className="min-w-0" {...form.register('legalName')} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tradeName">Nome fantasia</Label>
                <Input id="tradeName" className="min-w-0" placeholder="Opcional" {...form.register('tradeName')} />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="documentNumber">CNPJ/Documento</Label>
                  <Input id="documentNumber" className="min-w-0" {...form.register('documentNumber')} />
                </div>

                <div className="min-w-0 space-y-2">
                  <Label htmlFor="contactName">Contato</Label>
                  <Input id="contactName" className="min-w-0" {...form.register('contactName')} />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="address">Endereco</Label>
                  <Input
                    id="address"
                    className="min-w-0"
                    placeholder="Logradouro, numero, bairro, cidade..."
                    {...form.register('address')}
                  />
                </div>

                <div className="min-w-0 space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input id="phone" className="min-w-0" {...form.register('phone')} />
                </div>

                <div className="min-w-0 space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    className="min-w-0"
                    type="email"
                    placeholder="Preencher quando disponivel"
                    {...form.register('email')}
                  />
                </div>

                <div className="space-y-3 sm:col-span-2">
                  <Label htmlFor="cnd-files">CND (certidao negativa de debitos)</Label>
                  <p className="text-xs leading-snug text-muted-foreground">
                    Envie o PDF da CND. O sistema replica o arquivo na documentacao dos projetos e le automaticamente a linha de validade.
                  </p>

                  {supplier && hasParsedCnd ? (
                    <div className="rounded-2xl border border-border/70 bg-muted/15 px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={supplierCndBadgeVariant(supplier)}>{supplierCndStatusLabel(supplier)}</Badge>
                        {supplier.cndValidUntil ? (
                          <span className="text-sm font-medium text-foreground">Valida ate {formatDate(supplier.cndValidUntil)}</span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{supplierCndStatusDescription(supplier)}</p>
                      <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                        <p>Emissao: {formatDateTime(supplier.cndIssuedAt)}</p>
                        <p>Controle: {supplier.cndControlCode || '-'}</p>
                        <p className="sm:col-span-2">Arquivo lido: {supplier.cndSourceFileName || '-'}</p>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2">
                    <label
                      className="inline-flex max-w-full cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border/80 bg-muted/20 px-3 py-2.5 text-sm font-medium text-foreground transition hover:border-primary/50 hover:bg-muted/40 sm:px-4 sm:py-3"
                      htmlFor="cnd-files"
                    >
                      <FileUp className="size-4 shrink-0 text-primary" aria-hidden />
                      Escolher arquivos
                    </label>
                    <input
                      className="sr-only"
                      id="cnd-files"
                      multiple
                      type="file"
                      onChange={(event) => {
                        const list = event.target.files ? Array.from(event.target.files) : [];
                        setCndFiles((prev) => [...prev, ...list]);
                        event.target.value = '';
                      }}
                    />
                  </div>

                  {cndFiles.length > 0 ? (
                    <ul className="space-y-1 rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-sm">
                      {cndFiles.map((file, index) => (
                        <li className="flex items-center justify-between gap-2" key={`${file.name}-${index}`}>
                          <span className="min-w-0 break-all text-foreground">{file.name}</span>
                          <Button className="shrink-0" size="sm" type="button" variant="ghost" onClick={() => removeCndFile(index)}>
                            <X className="size-4" aria-hidden />
                            <span className="sr-only">Remover</span>
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="space-y-2 pt-1">
                    <Label className="text-muted-foreground" htmlFor="cnd">
                      Observacao da CND (opcional)
                    </Label>
                    <Input
                      id="cnd"
                      className="min-w-0"
                      placeholder="Ex.: observacao manual, observacao de renovacao..."
                      {...form.register('cnd')}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Observacoes</Label>
                <Textarea
                  id="notes"
                  className="min-h-[88px] max-h-40 min-w-0 resize-y"
                  rows={4}
                  {...form.register('notes')}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-0 shrink-0 gap-3 border-t border-border/60 bg-card/95 px-4 py-4 backdrop-blur-sm sm:px-6">
            <Button onClick={() => onOpenChange(false)} type="button" variant="ghost">
              Cancelar
            </Button>
            <Button disabled={submitting} type="submit">
              {submitting ? 'Salvando...' : supplier ? 'Salvar alteracoes' : 'Criar fornecedor'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
