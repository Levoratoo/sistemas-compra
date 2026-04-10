import type { UserRole } from '@/types/api';

export function isSupervisorRole(role: UserRole | null | undefined) {
  return role === 'SUPERVISOR';
}

export function getDefaultPathForRole(role: UserRole | null | undefined) {
  return isSupervisorRole(role) ? '/projects' : '/';
}

export function getSupervisorProjectMissingItemsPath(projectId: string) {
  return `/projects/${projectId}/missing-items`;
}

export function canAccessTopLevelNav(role: UserRole | null | undefined, href: string) {
  if (!isSupervisorRole(role)) {
    return true;
  }

  return href === '/projects';
}

/** Separador «Aprovação» no nav do contrato: só aprovador e admin. */
export function canAccessProjectApprovalTab(role: UserRole | null | undefined) {
  return role === 'APPROVER' || role === 'ADMIN';
}

export function canAccessProjectTab(role: UserRole | null | undefined, href: string) {
  if (!isSupervisorRole(role)) {
    return true;
  }

  return href === '/missing-items';
}

export function getRestrictedPathRedirect(role: UserRole | null | undefined, pathname: string) {
  if (!isSupervisorRole(role)) {
    return null;
  }

  if (pathname === '/projects') {
    return null;
  }

  const projectMatch = pathname.match(/^\/projects\/([^/]+)(?:\/(.*))?$/);
  if (projectMatch) {
    const projectId = projectMatch[1];
    const subPath = projectMatch[2] ?? '';

    if (subPath === 'missing-items') {
      return null;
    }

    return getSupervisorProjectMissingItemsPath(projectId);
  }

  return '/projects';
}
