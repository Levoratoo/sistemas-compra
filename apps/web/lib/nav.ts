import type { LucideIcon } from 'lucide-react';
import { Building2, FolderKanban, LayoutDashboard, Users } from 'lucide-react';

export const mainNav: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/', label: 'Painel executivo', icon: LayoutDashboard },
  { href: '/projects', label: 'Projetos', icon: FolderKanban },
  { href: '/suppliers', label: 'Fornecedores', icon: Building2 },
];

export const adminNavItem = { href: '/admin/users', label: 'Usuários', icon: Users } as const;
