import type { LucideIcon } from 'lucide-react';
import { Building2, ClipboardCheck, FolderKanban, LayoutDashboard, Users } from 'lucide-react';

export const mainNav: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/', label: 'Painel executivo', icon: LayoutDashboard },
  { href: '/projects', label: 'Projetos', icon: FolderKanban },
  { href: '/suppliers', label: 'Fornecedores', icon: Building2 },
];

/** Visível apenas para APPROVER e ADMIN (filtro no sidebar). */
export const approverInboxNavItem = {
  href: '/approvals/missing-items',
  label: 'Aprovações',
  icon: ClipboardCheck,
} as const;

export const adminNavItem = { href: '/admin/users', label: 'Usuários', icon: Users } as const;
