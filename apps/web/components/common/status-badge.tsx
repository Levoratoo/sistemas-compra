import { Badge } from '@/components/ui/badge';
import {
  getDeliveryStatusLabel,
  getImplementationStatusLabel,
  getProcessingStatusLabel,
  getProjectStatusLabel,
  getPurchaseStatusLabel,
  getReplenishmentStatusLabel,
  getReviewStatusLabel,
} from '@/lib/constants';
import type {
  DeliveryStatus,
  DocumentProcessingStatus,
  DocumentReviewStatus,
  ImplementationStatus,
  ProjectStatus,
  PurchaseStatus,
  ReplenishmentDerivedStatus,
} from '@/types/api';

function variantForStatus(status: string) {
  if (['ACTIVE', 'COMPLETED', 'DELIVERED', 'PROCESSED', 'REVIEWED', 'SCHEDULED'].includes(status)) {
    return 'success' as const;
  }

  if (['BLOCKED', 'FAILED', 'CANCELLED', 'OVERDUE', 'CONFLICT'].includes(status)) {
    return 'danger' as const;
  }

  if (['UNDER_REVIEW', 'APPROVAL_PENDING', 'PROCESSING', 'UPCOMING', 'PENDING_REVIEW'].includes(status)) {
    return 'warning' as const;
  }

  return 'secondary' as const;
}

export function ProjectStatusBadge({ value }: { value: ProjectStatus }) {
  return <Badge variant={variantForStatus(value)}>{getProjectStatusLabel(value)}</Badge>;
}

export function ImplementationStatusBadge({ value }: { value: ImplementationStatus }) {
  return <Badge variant={variantForStatus(value)}>{getImplementationStatusLabel(value)}</Badge>;
}

export function PurchaseStatusBadge({ value }: { value: PurchaseStatus }) {
  return <Badge variant={variantForStatus(value)}>{getPurchaseStatusLabel(value)}</Badge>;
}

export function DeliveryStatusBadge({ value }: { value: DeliveryStatus }) {
  return <Badge variant={variantForStatus(value)}>{getDeliveryStatusLabel(value)}</Badge>;
}

export function DocumentProcessingBadge({ value }: { value: DocumentProcessingStatus }) {
  return <Badge variant={variantForStatus(value)}>{getProcessingStatusLabel(value)}</Badge>;
}

export function DocumentReviewBadge({ value }: { value: DocumentReviewStatus }) {
  return <Badge variant={variantForStatus(value)}>{getReviewStatusLabel(value)}</Badge>;
}

export function ReplenishmentStatusBadge({ value }: { value: ReplenishmentDerivedStatus }) {
  return <Badge variant={variantForStatus(value)}>{getReplenishmentStatusLabel(value)}</Badge>;
}

export function AlertSeverityBadge({ severity }: { severity: 'INFO' | 'WARNING' | 'CRITICAL' }) {
  const variant = severity === 'CRITICAL' ? 'danger' : severity === 'WARNING' ? 'warning' : 'secondary';
  const label = severity === 'CRITICAL' ? 'Crítico' : severity === 'WARNING' ? 'Atenção' : 'Info';
  return <Badge variant={variant}>{label}</Badge>;
}
