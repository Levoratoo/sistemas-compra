import type {
  DeliveryStatus,
  DocumentProcessingStatus,
  DocumentReviewStatus,
  DocumentType,
  ImplementationStatus,
  IntervalUnit,
  ItemCategory,
  MissingItemUrgency,
  OwnerApprovalStatus,
  ProjectStatus,
  PurchaseStatus,
  ReplenishmentDerivedStatus,
  ReplenishmentTriggerType,
  UserRole,
} from '@/types/api';

export const projectStatusOptions: Array<{ value: ProjectStatus; label: string }> = [
  { value: 'DRAFT', label: 'Rascunho' },
  { value: 'PLANNED', label: 'Planejado' },
  { value: 'ACTIVE', label: 'Ativo' },
  { value: 'ON_HOLD', label: 'Em espera' },
  { value: 'CLOSED', label: 'Encerrado' },
  { value: 'CANCELLED', label: 'Cancelado' },
];

export const implementationStatusOptions: Array<{ value: ImplementationStatus; label: string }> = [
  { value: 'NOT_STARTED', label: 'Não iniciada' },
  { value: 'IN_PROGRESS', label: 'Em andamento' },
  { value: 'COMPLETED', label: 'Concluída' },
  { value: 'BLOCKED', label: 'Bloqueada' },
];

export const purchaseStatusOptions: Array<{ value: PurchaseStatus; label: string }> = [
  { value: 'TO_START', label: 'Iniciar compra' },
  { value: 'QUOTING', label: 'Em cotação' },
  { value: 'UNDER_REVIEW', label: 'Em análise' },
  { value: 'APPROVAL_PENDING', label: 'Aguardando aprovação' },
  { value: 'APPROVED', label: 'Aprovada' },
  { value: 'PAYMENT_PENDING', label: 'Aguardando pagamento' },
  { value: 'COMPLETED', label: 'Concluída' },
  { value: 'CANCELLED', label: 'Cancelada' },
];

export const deliveryStatusOptions: Array<{ value: DeliveryStatus; label: string }> = [
  { value: 'NOT_SCHEDULED', label: 'Sem entrega' },
  { value: 'SCHEDULED', label: 'Agendada' },
  { value: 'PARTIALLY_DELIVERED', label: 'Entrega parcial' },
  { value: 'DELIVERED', label: 'Entregue' },
  { value: 'DELAYED', label: 'Atrasada' },
  { value: 'CANCELLED', label: 'Cancelada' },
];

export const documentTypeOptions: Array<{ value: DocumentType; label: string }> = [
  { value: 'NOTICE', label: 'Edital' },
  { value: 'TERMS_OF_REFERENCE', label: 'Termo de Referência' },
  { value: 'IMPLEMENTATION_MAP', label: 'Mapa de Implantação' },
  { value: 'COST_SPREADSHEET', label: 'Planilha de composição' },
  { value: 'CONTROL_SPREADSHEET', label: 'Planilha de controle' },
  { value: 'PURCHASE_ORDER_PDF', label: 'Ordem de compra (PDF)' },
  { value: 'SUPPLIER_QUOTE_PDF', label: 'OrÃ§amento de fornecedor (PDF)' },
  { value: 'OTHER_ATTACHMENT', label: 'Outro anexo' },
];

export const itemCategoryOptions: Array<{ value: ItemCategory; label: string }> = [
  { value: 'UNIFORM', label: 'Uniforme' },
  { value: 'EPI', label: 'EPI' },
  { value: 'EQUIPMENT', label: 'Equipamento' },
  { value: 'CONSUMABLE', label: 'Material de consumo' },
  { value: 'OTHER', label: 'Outro' },
];

export const replenishmentTriggerOptions: Array<{ value: ReplenishmentTriggerType; label: string }> = [
  { value: 'FROM_DELIVERY', label: 'A partir da entrega' },
  { value: 'FROM_PROJECT_START', label: 'A partir do início do projeto' },
  { value: 'FROM_LAST_REPLENISHMENT', label: 'A partir da última reposição' },
  { value: 'MANUAL', label: 'Data base manual' },
];

export const intervalUnitOptions: Array<{ value: IntervalUnit; label: string }> = [
  { value: 'DAY', label: 'Dia' },
  { value: 'WEEK', label: 'Semana' },
  { value: 'MONTH', label: 'Mês' },
  { value: 'YEAR', label: 'Ano' },
];

export const missingItemUrgencyOptions: Array<{ value: MissingItemUrgency; label: string; hint: string }> = [
  { value: 'HIGH', label: 'Alta', hint: 'necessário com urgência' },
  { value: 'MEDIUM', label: 'Média', hint: 'necessário em breve' },
  { value: 'LOW', label: 'Baixa', hint: 'pode aguardar' },
];

export const ownerApprovalStatusOptions: Array<{ value: OwnerApprovalStatus; label: string }> = [
  { value: 'PENDING', label: 'Pendente de aprovação' },
  { value: 'APPROVED', label: 'Aprovado pelo dono da empresa' },
  { value: 'REJECTED', label: 'Rejeitado' },
];

export function getMissingItemUrgencyLabel(level: MissingItemUrgency) {
  return missingItemUrgencyOptions.find((o) => o.value === level)?.label ?? level;
}

export function getOwnerApprovalStatusLabel(status: OwnerApprovalStatus) {
  return ownerApprovalStatusOptions.find((o) => o.value === status)?.label ?? status;
}

export function getProjectStatusLabel(value: ProjectStatus) {
  return projectStatusOptions.find((option) => option.value === value)?.label ?? value;
}

export function getImplementationStatusLabel(value: ImplementationStatus) {
  return implementationStatusOptions.find((option) => option.value === value)?.label ?? value;
}

export function getPurchaseStatusLabel(value: PurchaseStatus) {
  return purchaseStatusOptions.find((option) => option.value === value)?.label ?? value;
}

export function getDeliveryStatusLabel(value: DeliveryStatus) {
  return deliveryStatusOptions.find((option) => option.value === value)?.label ?? value;
}

export function getDocumentTypeLabel(value: DocumentType) {
  return documentTypeOptions.find((option) => option.value === value)?.label ?? value;
}

export function getItemCategoryLabel(value: ItemCategory) {
  return itemCategoryOptions.find((option) => option.value === value)?.label ?? value;
}

export function getProcessingStatusLabel(value: DocumentProcessingStatus) {
  switch (value) {
    case 'PENDING':
      return 'Pendente';
    case 'PROCESSING':
      return 'Processando';
    case 'PROCESSED':
      return 'Processado';
    case 'FAILED':
      return 'Falhou';
  }
}

export function getReviewStatusLabel(value: DocumentReviewStatus) {
  switch (value) {
    case 'PENDING_REVIEW':
      return 'Aguardando revisão';
    case 'REVIEWED':
      return 'Revisado';
    case 'CONFLICT':
      return 'Conflito';
    case 'REJECTED':
      return 'Rejeitado';
  }
}

export function getReplenishmentStatusLabel(value: ReplenishmentDerivedStatus) {
  switch (value) {
    case 'DISABLED':
      return 'Desativada';
    case 'PENDING_BASE_DATE':
      return 'Sem data base';
    case 'COMPLETED':
      return 'Concluída';
    case 'OVERDUE':
      return 'Vencida';
    case 'UPCOMING':
      return 'Próxima';
    case 'SCHEDULED':
      return 'Agendada';
  }
}

export const userRoleOptions: Array<{ value: UserRole; label: string }> = [
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'USER', label: 'Usuário' },
  { value: 'APPROVER', label: 'Aprovador' },
];

export function getUserRoleLabel(role: UserRole) {
  return userRoleOptions.find((o) => o.value === role)?.label ?? role;
}
