import type { LucideIcon } from 'lucide-react';
import { Building2, FolderKanban, LayoutDashboard } from 'lucide-react';

export const mainNav: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/', label: 'Painel executivo', icon: LayoutDashboard },
  { href: '/projects', label: 'Projetos', icon: FolderKanban },
  { href: '/suppliers', label: 'Fornecedores', icon: Building2 },
];
