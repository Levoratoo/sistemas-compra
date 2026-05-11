'use client';

import { Upload } from 'lucide-react';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { SupplierCndPdfPickers } from '@/features/suppliers/supplier-cnd-pdf-pickers';
import { useSuppliersMutations } from '@/hooks/use-suppliers';

/**
 * Envio só de PDFs da CND (PUT multipart com `{}`), sem obrigar edição dos demais campos.
 * Adequado para a página de detalhe depois que o fornecedor já existe.
 */
export function SupplierCndInlineUpload({
  supplierId,
  supplierLegalName,
}: {
  supplierId: string;
  supplierLegalName: string;
}) {
  const queryClient = useQueryClient();
  const { updateSupplier } = useSuppliersMutations();
  const [cndFederalFile, setCndFederalFile] = useState<File | null>(null);
  const [cndEstadualFile, setCndEstadualFile] = useState<File | null>(null);

  const pending = Boolean(cndFederalFile || cndEstadualFile);
  const uploading = updateSupplier.isPending;

  async function submit() {
    if (!pending) {
      toast.warning('Escolha o PDF federal e/ou o estadual antes de enviar.', {
        description: 'Pode mandar só um por vez; o outro depois.',
      });
      return;
    }

    try {
      await updateSupplier.mutateAsync({
        id: supplierId,
        payload: {},
        cndUploads: {
          ...(cndFederalFile ? { cndFederal: cndFederalFile } : {}),
          ...(cndEstadualFile ? { cndEstadual: cndEstadualFile } : {}),
        },
      });

      await queryClient.invalidateQueries({ queryKey: ['project-documents'] });
      await queryClient.invalidateQueries({ queryKey: ['project-document-folders'] });

      setCndFederalFile(null);
      setCndEstadualFile(null);
      toast.success('CND enviada. O sistema leu as datas quando possível e copiou aos projetos.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Não foi possível enviar os PDFs da CND. Tente novamente.';
      toast.error(message);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-dashed border-primary/25 bg-primary/[0.04] p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Anexar / substituir CND em PDF</h3>
        <p className="mt-1 text-xs leading-snug text-muted-foreground">
          Envie só o que mudar ({supplierLegalName}). Cada arquivo substitui apenas o respectivo tipo (federal ou
          estadual) e pode ser atualizado sempre que precisar.
        </p>
      </div>

      <SupplierCndPdfPickers
        compact
        estadualFile={cndEstadualFile}
        federalFile={cndFederalFile}
        onEstadualFile={setCndEstadualFile}
        onFederalFile={setCndFederalFile}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          disabled={uploading || !pending}
          onClick={() => void submit()}
          size="sm"
          type="button"
          variant="secondary"
          className="gap-2"
        >
          <Upload className="size-4" aria-hidden />
          {uploading ? 'Enviando…' : 'Enviar PDFs ao cadastro'}
        </Button>
        {pending ? (
          <Button
            disabled={uploading}
            onClick={() => {
              setCndFederalFile(null);
              setCndEstadualFile(null);
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            Limpar seleção
          </Button>
        ) : null}
      </div>
    </div>
  );
}
