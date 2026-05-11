'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';

import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
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
import { SupplierCndPdfPickers } from '@/features/suppliers/supplier-cnd-pdf-pickers';
import { useSuppliersMutations } from '@/hooks/use-suppliers';
import { formatDate, formatDateTime } from '@/lib/format';
import { SUPPLIER_OFFERING_CATEGORY_OPTIONS } from '@/lib/supplier-offering-categories';
import { cn } from '@/lib/utils';
import type { Supplier, SupplierOfferingCategorySlug } from '@/types/api';

const OFFERING_CATEGORY_SLUGS = SUPPLIER_OFFERING_CATEGORY_OPTIONS.map((o) => o.value) as [
  SupplierOfferingCategorySlug,
  ...SupplierOfferingCategorySlug[],
];

const offeringCategoryField = z.enum(OFFERING_CATEGORY_SLUGS);
const formSchema = z
  .object({
    legalName: z.string().trim().min(1, 'Informe o nome do fornecedor.'),
    tradeName: z.string().trim().optional(),
    documentNumber: z.string().trim().optional(),
    contactName: z.string().trim().optional(),
    address: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    email: z.string().trim().email('Informe um e-mail válido.').optional().or(z.literal('')),
    cnd: z.string().trim().optional(),
    notes: z.string().trim().optional(),
    offeringCategories: z.array(offeringCategoryField).default([]),
    offeringCategoriesOtherDetail: z.string().max(400, 'Use no máximo 400 caracteres.').optional(),
  })
  .superRefine((data, ctx) => {
    const hasOutros = data.offeringCategories?.includes('OUTROS');
    const detail = (data.offeringCategoriesOtherDetail ?? '').trim();
    if (hasOutros && !detail) {
      ctx.addIssue({
        code: 'custom',
        message: 'Descreva o que se enquadra em «Outros».',
        path: ['offeringCategoriesOtherDetail'],
      });
    }
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
  const [cndFederalFile, setCndFederalFile] = useState<File | null>(null);
  const [cndEstadualFile, setCndEstadualFile] = useState<File | null>(null);
  const cndBlockRef = useRef<HTMLDivElement>(null);

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
      offeringCategories: supplier?.offeringCategories ?? [],
      offeringCategoriesOtherDetail: supplier?.offeringCategoriesOtherDetail ?? '',
    },
  });

  const { reset } = form;

  const supplierResetKey =
    supplier == null ? 'new' : `${supplier.id}:${supplier.updatedAt ?? ''}`;

  useEffect(() => {
    if (!open) {
      return;
    }
    reset({
      legalName: supplier?.legalName ?? '',
      tradeName: supplier?.tradeName ?? '',
      documentNumber: supplier?.documentNumber ?? '',
      contactName: supplier?.contactName ?? '',
      address: supplier?.address ?? '',
      phone: supplier?.phone ?? '',
      email: supplier?.email ?? '',
      cnd: supplier?.cnd ?? '',
      notes: supplier?.notes ?? '',
      offeringCategories: supplier?.offeringCategories ?? [],
      offeringCategoriesOtherDetail: supplier?.offeringCategoriesOtherDetail ?? '',
    });
  }, [open, supplierResetKey, reset]);

  useEffect(() => {
    if (!open) {
      setCndFederalFile(null);
      setCndEstadualFile(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const bothServerMissing =
      supplier == null || (!supplier.cndFederalPresent && !supplier.cndStatePresent);
    if (!bothServerMissing) {
      return;
    }
    const handle = window.setTimeout(() => {
      cndBlockRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 160);
    return () => window.clearTimeout(handle);
  }, [open, supplier?.id, supplier?.cndFederalPresent, supplier?.cndStatePresent]);

  async function onSubmit(values: FormSubmitValues) {
    try {
      const hasOutros = (values.offeringCategories ?? []).includes('OUTROS');
      const trimmedOtherDetail = hasOutros ? (values.offeringCategoriesOtherDetail ?? '').trim() : undefined;
      const { offeringCategoriesOtherDetail: _otherDetail, ...restValues } = values;

      const payload = {
        ...restValues,
        tradeName: values.tradeName || null,
        documentNumber: values.documentNumber || null,
        contactName: values.contactName || null,
        address: values.address || null,
        phone: values.phone || null,
        email: values.email || null,
        cnd: values.cnd || null,
        notes: values.notes || null,
        offeringCategories: values.offeringCategories ?? [],
        ...(trimmedOtherDetail !== undefined ? { offeringCategoriesOtherDetail: trimmedOtherDetail } : {}),
      };
      const cndUploads =
        cndFederalFile || cndEstadualFile
          ? {
              ...(cndFederalFile ? { cndFederal: cndFederalFile } : {}),
              ...(cndEstadualFile ? { cndEstadual: cndEstadualFile } : {}),
            }
          : undefined;

      const saved = supplier
        ? await updateSupplier.mutateAsync({
            id: supplier.id,
            payload,
            cndUploads,
          })
        : await createSupplier.mutateAsync({
            payload,
            cndUploads,
          });

      if (cndUploads) {
        await queryClient.invalidateQueries({ queryKey: ['project-documents'] });
        await queryClient.invalidateQueries({ queryKey: ['project-document-folders'] });
      }

      toast.success(supplier ? 'Fornecedor atualizado.' : 'Fornecedor cadastrado com sucesso.');
      onSaved?.(saved);
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar o fornecedor.';
      toast.error(message);
    }
  }

  const submitting = createSupplier.isPending || updateSupplier.isPending;
  const selectedCategories =
    useWatch({
      control: form.control,
      name: 'offeringCategories',
      defaultValue: [],
    }) ?? [];

  function toggleCategory(slug: SupplierOfferingCategorySlug) {
    const cur = form.getValues('offeringCategories') ?? [];
    const removingOutros = slug === 'OUTROS' && cur.includes('OUTROS');
    const next = cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug];
    form.setValue('offeringCategories', next, { shouldDirty: true, shouldTouch: true });
    if (removingOutros) {
      form.setValue('offeringCategoriesOtherDetail', '', { shouldDirty: true, shouldTouch: true });
    }
  }
  const hasParsedCnd = Boolean(
    supplier?.cndFederal?.validUntil ||
      supplier?.cndState?.validUntil ||
      supplier?.cndValidUntil ||
      supplier?.cndIssuedAt ||
      supplier?.cndControlCode ||
      supplier?.cndSourceFileName,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-h-[calc(100dvh-2rem)]">
        <div className="shrink-0 px-4 pb-2 pt-5 sm:px-6 sm:pt-6">
          <DialogHeader>
            <DialogTitle>{supplier ? 'Editar fornecedor' : 'Novo fornecedor'}</DialogTitle>
            <DialogDescription>
              Cadastre o fornecedor para usar nos pedidos, compras reais e controle automático da CND.
            </DialogDescription>
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
                    placeholder="Logradouro, número, bairro, cidade..."
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

                <div className="min-w-0 space-y-2 sm:col-span-2">
                  <Label>Categorias de produtos / serviços</Label>
                  <p className="text-xs text-muted-foreground">Selecione uma ou mais opções (ex.: EPI, uniformes).</p>
                  <div className="flex flex-wrap gap-2">
                    {SUPPLIER_OFFERING_CATEGORY_OPTIONS.map((opt) => {
                      const on = selectedCategories.includes(opt.value);
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          className={cn(
                            'rounded-full border px-3 py-1.5 text-xs font-medium transition',
                            on
                              ? 'border-primary bg-primary/10 text-foreground'
                              : 'border-border/80 bg-muted/30 text-muted-foreground hover:border-primary/40',
                          )}
                          onClick={() => toggleCategory(opt.value)}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  {selectedCategories.includes('OUTROS') ? (
                    <div className="space-y-2 pt-1">
                      <Label htmlFor="offeringCategoriesOtherDetail">Descrição em «Outros»</Label>
                      <Input
                        id="offeringCategoriesOtherDetail"
                        autoComplete="off"
                        className="min-w-0"
                        maxLength={400}
                        placeholder="Ex.: ferramentas especializadas, insumos de laboratório…"
                        {...form.register('offeringCategoriesOtherDetail')}
                      />
                      {form.formState.errors.offeringCategoriesOtherDetail ? (
                        <p className="text-xs text-destructive">
                          {form.formState.errors.offeringCategoriesOtherDetail.message}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Campo obrigatório quando «Outros» está selecionado.</p>
                      )}
                    </div>
                  ) : null}
                </div>

                <div ref={cndBlockRef} className="space-y-5 sm:col-span-2">
                  <div>
                    <Label className="text-base font-medium">CND (certidão negativa de débitos)</Label>
                    <p className="mt-1 text-xs leading-snug text-muted-foreground">
                      Envie o PDF da CND federal e, separadamente, da CND estadual. O sistema replica cada arquivo na
                      documentação dos projetos e lê a validade automaticamente quando possível.
                    </p>
                  </div>

                  {supplier && hasParsedCnd ? (
                    <div className="rounded-2xl border border-border/70 bg-muted/15 px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={supplierCndBadgeVariant(supplier)}>{supplierCndStatusLabel(supplier)}</Badge>
                        {supplier.cndValidUntil ? (
                          <span className="text-sm font-medium text-foreground">
                            Validade mais restrita: {formatDate(supplier.cndValidUntil)}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{supplierCndStatusDescription(supplier)}</p>
                      <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                        {supplier.cndFederal?.validUntil ? (
                          <p>
                            <span className="font-medium text-foreground/90">Federal:</span> valida ate{' '}
                            {formatDate(supplier.cndFederal.validUntil)}
                            {supplier.cndFederal.originalFileName ? ` · ${supplier.cndFederal.originalFileName}` : null}
                          </p>
                        ) : (
                          <p>
                            <span className="font-medium text-foreground/90">Federal:</span> sem leitura de validade ou
                            não enviada.
                          </p>
                        )}
                        {supplier.cndState?.validUntil ? (
                          <p>
                            <span className="font-medium text-foreground/90">Estadual:</span> valida ate{' '}
                            {formatDate(supplier.cndState.validUntil)}
                            {supplier.cndState.originalFileName ? ` · ${supplier.cndState.originalFileName}` : null}
                          </p>
                        ) : (
                          <p>
                            <span className="font-medium text-foreground/90">Estadual:</span> sem leitura de validade ou
                            não enviada.
                          </p>
                        )}
                        <div className="grid gap-1 border-t border-border/50 pt-2 sm:grid-cols-2">
                          <p>Emissão (agregado): {supplier.cndIssuedAt ? formatDateTime(supplier.cndIssuedAt) : '-'}</p>
                          <p>Controle (agregado): {supplier.cndControlCode || '-'}</p>
                          <p className="sm:col-span-2">Arquivo referencia (agregado): {supplier.cndSourceFileName || '-'}</p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <SupplierCndPdfPickers
                    estadualFile={cndEstadualFile}
                    federalFile={cndFederalFile}
                    onEstadualFile={setCndEstadualFile}
                    onFederalFile={setCndFederalFile}
                  />

                  <div className="space-y-2 pt-1">
                    <Label className="text-muted-foreground" htmlFor="cnd">
                      Observação da CND (opcional)
                    </Label>
                    <Input
                      id="cnd"
                      className="min-w-0"
                      placeholder="Ex.: observação manual, observação de renovação..."
                      {...form.register('cnd')}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
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
              {submitting ? 'Salvando...' : supplier ? 'Salvar alterações' : 'Criar fornecedor'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
