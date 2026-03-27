import { redirect } from 'next/navigation';

import { STATIC_EXPORT_PROJECT_ID } from '@/lib/static-export-placeholders';

export async function generateStaticParams() {
  return [{ projectId: STATIC_EXPORT_PROJECT_ID }];
}

type ProjectPageProps = {
  params: Promise<{ projectId: string }>;
};

/** Módulo removido da navegação; URL antiga redireciona para Controle de compras. */
export default async function ProjectBudgetItemsRedirect({ params }: ProjectPageProps) {
  const { projectId } = await params;
  redirect(`/projects/${projectId}/purchase-control`);
}
