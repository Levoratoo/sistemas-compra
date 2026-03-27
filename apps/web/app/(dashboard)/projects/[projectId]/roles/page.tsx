import { redirect } from 'next/navigation';

import { STATIC_EXPORT_PROJECT_ID } from '@/lib/static-export-placeholders';

export async function generateStaticParams() {
  return [{ projectId: STATIC_EXPORT_PROJECT_ID }];
}

type ProjectPageProps = {
  params: Promise<{ projectId: string }>;
};

/** Módulo removido da navegação; URL antiga redireciona para a visão geral do projeto. */
export default async function ProjectRolesRedirect({ params }: ProjectPageProps) {
  const { projectId } = await params;
  redirect(`/projects/${projectId}`);
}
