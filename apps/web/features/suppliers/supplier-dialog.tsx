'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { FileUp, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useProjectsQuery } from '@/hooks/use-projects';
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
  documentationProjectId = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: Supplier | null;
  onSaved?: (supplier: Supplier) => void;
  /** Quando definido, anexos CND vão para a documentação deste projeto (pasta CND → fornecedor). */
  documentationProjectId?: string | null;
}) {
  const queryClient = useQueryClient();
  const { data: projects } = useProjectsQuery();
  const { createSupplier, updateSupplier } = useSuppliersMutations();
  const [cndFiles, setCndFiles] = useState<File[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');

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

  const effectiveProjectId = useMemo(() => {
    const fromProp = documentationProjectId?.trim();
    if (fromProp) {
      return fromProp;
    }
    const fromSelect = selectedProjectId.trim();
    return fromSelect || null;
  }, [documentationProjectId, selectedProjectId]);

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
      setSelectedProjectId('');
    }
  }, [open]);

  function removeCndFile(index: number) {
    setCndFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSubmit(values: FormSubmitValues) {
    if (cndFiles.length > 0 && !effectiveProjectId) {
      toast.error('Selecione o projeto para salvar os arquivos da CND em Documentação → CND.');
      return;
    }

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

      const docProject = effectiveProjectId;

      const saved = supplier
        ? await updateSupplier.mutateAsync({
            id: supplier.id,
            payload,
            cndFiles: cndFiles.length > 0 ? cndFiles : undefined,
            projectId: docProject,
          })
        : await createSupplier.mutateAsync({
            payload,
            cndFiles: cndFiles.length > 0 ? cndFiles : undefined,
            projectId: docProject,
          });

      if (docProject && cndFiles.length > 0) {
        await queryClient.invalidateQueries({ queryKey: ['project-documents', docProject] });
        await queryClient.invalidateQueries({ queryKey: ['project-document-folders', docProject] });
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
  const showProjectPicker = cndFiles.length > 0 && !documentationProjectId?.trim();

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
              <Label htmlFor="cnd-files">CND (certidão negativa de débitos)</Label>
              <p className="text-xs text-muted-foreground">
                Envie um ou mais arquivos. Eles ficam em Documentação → CND → pasta com o nome da razão social.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <label
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-3 text-sm font-medium text-foreground transition hover:border-primary/50 hover:bg-muted/40"
                  htmlFor="cnd-files"
                >
                  <FileUp className="size-4 text-primary" aria-hidden />
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
                <ul className="mt-2 space-y-1 rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-sm">
                  {cndFiles.map((file, index) => (
                    <li className="flex items-center justify-between gap-2" key={`${file.name}-${index}`}>
                      <span className="min-w-0 truncate text-foreground">{file.name}</span>
                      <Button
                        className="shrink-0"
                        size="sm"
                        type="button"
                        variant="ghost"
                        onClick={() => removeCndFile(index)}
                      >
                        <X className="size-4" aria-hidden />
                        <span className="sr-only">Remover</span>
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="space-y-2 pt-1">
                <Label className="text-muted-foreground" htmlFor="cnd">
                  Número, validade ou observação (opcional)
                </Label>
                <Input
                  id="cnd"
                  placeholder="Ex.: validade, número da certidão…"
                  {...form.register('cnd')}
                />
              </div>
            </div>
          </div>

          {showProjectPicker ? (
            <div className="space-y-2 rounded-xl border border-amber-500/35 bg-amber-500/5 px-4 py-3">
              <Label htmlFor="cnd-project">Projeto (documentação)</Label>
              <Select
                id="cnd-project"
                required
                value={selectedProjectId}
                onChange={(event) => setSelectedProjectId(event.target.value)}
              >
                <option value="">Selecione o projeto…</option>
                {(projects ?? []).map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.code} — {project.name}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">
                Obrigatório ao enviar arquivos: os anexos são gravados na documentação do projeto escolhido.
              </p>
            </div>
          ) : null}

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
