import { apiRequest, apiUploadJson } from '@/services/api-client';
import type {
  ImplementationStatus,
  ItemCategory,
  ProjectDetail,
  ProjectListItem,
  ProjectStatus,
  DocumentType,
  TaskCategory,
  TaskStatus,
} from '@/types/api';

export type ProjectPayload = {
  code: string;
  name: string;
  organizationName: string;
  procurementProcessNumber?: string | null;
  bidNumber?: string | null;
  contractNumber?: string | null;
  city?: string | null;
  state?: string | null;
  objectSummary?: string | null;
  projectStatus?: ProjectStatus;
  implementationStatus?: ImplementationStatus;
  plannedSignatureDate?: string | null;
  plannedStartDate?: string | null;
  actualStartDate?: string | null;
  contractDurationMonths?: number;
  monthlyContractValue?: number | null;
  notes?: string | null;
};

export function listProjects(query?: { search?: string; projectStatus?: ProjectStatus }) {
  return apiRequest<ProjectListItem[]>('projects', { query });
}

export function getProject(projectId: string) {
  return apiRequest<ProjectDetail>(`projects/${projectId}`);
}

export function createProject(payload: ProjectPayload) {
  return apiRequest<ProjectDetail>('projects', {
    method: 'POST',
    body: payload,
  });
}

export function updateProject(projectId: string, payload: Partial<ProjectPayload>) {
  return apiRequest<ProjectDetail>(`projects/${projectId}`, {
    method: 'PUT',
    body: payload,
  });
}

export function deleteProject(projectId: string) {
  return apiRequest<null>(`projects/${projectId}`, {
    method: 'DELETE',
  });
}

export type BootstrapProjectFromDocumentResult = {
  project: ProjectDetail;
  documentId: string;
};

export function bootstrapProjectFromDocument(file: File, documentType: DocumentType) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('documentType', documentType);
  return apiUploadJson<BootstrapProjectFromDocumentResult>('projects/from-document', formData);
}

export type ImportDocumentToProjectResult = {
  project: ProjectDetail;
  documentId: string;
};

/** Upload com leitura real do PDF/Excel e campos extraídos (mesmo pipeline do “novo projeto”). */
export function importProjectDocumentFromUpload(
  projectId: string,
  file: File,
  documentType: DocumentType,
  options?: { documentDate?: string | null; notes?: string | null },
) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('documentType', documentType);
  if (options?.documentDate) formData.append('documentDate', options.documentDate);
  if (options?.notes) formData.append('notes', options.notes);
  return apiUploadJson<ImportDocumentToProjectResult>(`projects/${projectId}/documents/from-upload`, formData);
}

/** Corpo alinhado ao `applyExtractionBodySchema` da API (sem sourceDocumentId — definido no servidor). */
export type ApplyExtractionRoleInput = {
  roleName: string;
  cboCode?: string | null;
  workRegime?: string | null;
  workloadLabel?: string | null;
  allocationSector?: string | null;
  plannedPositions?: number | null;
  employeesPerPosition?: number | null;
  plannedHeadcount: number;
  sourcePage?: number | null;
  sourceExcerpt?: string | null;
  notes?: string | null;
};

export type ApplyExtractionBudgetInput = {
  itemCategory: ItemCategory;
  subcategory?: string | null;
  name: string;
  description?: string | null;
  specification?: string | null;
  unit?: string | null;
  sizeLabel?: string | null;
  requiresCa?: boolean | null;
  roleReference?: string | null;
  allocationSector?: string | null;
  plannedQuantity?: number | null;
  bidUnitValue?: number | null;
  rubricMaxValue?: number | null;
  purchasedValue?: number | null;
  hasBidReference?: boolean;
  contextOnly?: boolean;
  sourcePage?: number | null;
  sourceExcerpt?: string | null;
  notes?: string | null;
};

export type ApplyExtractionTaskInput = {
  title: string;
  category: TaskCategory;
  description?: string | null;
  status?: TaskStatus;
  dueDate?: string | null;
  sourcePage?: number | null;
  notes?: string | null;
};

export type ApplyExtractionPayload = {
  project?: Partial<ProjectPayload>;
  roles: ApplyExtractionRoleInput[];
  budgetItems: ApplyExtractionBudgetInput[];
  tasks: ApplyExtractionTaskInput[];
};

export function applyExtractionToProject(
  projectId: string,
  documentId: string,
  payload: ApplyExtractionPayload,
) {
  return apiRequest<ProjectDetail>(`projects/${projectId}/documents/${documentId}/apply-extraction`, {
    method: 'POST',
    body: payload,
  });
}
