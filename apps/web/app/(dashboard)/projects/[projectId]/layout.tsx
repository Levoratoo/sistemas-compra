import type { ReactNode } from 'react';

import { ProjectShell } from '@/features/projects/project-shell';

type ProjectLayoutProps = {
  children: ReactNode;
  params: Promise<{ projectId: string }>;
};

export default async function ProjectLayout({
  children,
  params,
}: ProjectLayoutProps) {
  const { projectId } = await params;

  return <ProjectShell projectId={projectId}>{children}</ProjectShell>;
}
