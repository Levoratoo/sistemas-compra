import { ApiError } from '@/services/api-client';

/** Shape returned by Zod's `error.flatten()` on the API (422). */
type ZodFlattened = {
  formErrors: string[];
  fieldErrors: Record<string, string[] | undefined>;
};

type ZodIssuePayload = {
  path: (string | number)[];
  message: string;
  code?: string;
};

function isZodFlattened(details: unknown): details is ZodFlattened {
  if (typeof details !== 'object' || details === null) return false;
  const d = details as Record<string, unknown>;
  return Array.isArray(d.formErrors) && typeof d.fieldErrors === 'object' && d.fieldErrors !== null;
}

function isIssueArray(value: unknown): value is ZodIssuePayload[] {
  return (
    Array.isArray(value) &&
    value.every(
      (x) =>
        typeof x === 'object' &&
        x !== null &&
        'path' in x &&
        Array.isArray((x as ZodIssuePayload).path) &&
        typeof (x as ZodIssuePayload).message === 'string',
    )
  );
}

/** Labels for leaf keys (Portuguese, aligned with the UI). */
const FIELD_LABELS: Record<string, string> = {
  code: 'Código',
  name: 'Nome',
  organizationName: 'Órgão',
  procurementProcessNumber: 'Nº processo licitatório',
  bidNumber: 'Nº ata',
  contractNumber: 'Nº contrato',
  city: 'Cidade',
  state: 'UF',
  objectSummary: 'Objeto',
  projectStatus: 'Status do projeto',
  implementationStatus: 'Status de implantação',
  plannedSignatureDate: 'Data prevista de assinatura',
  plannedStartDate: 'Data prevista de início',
  actualStartDate: 'Data real de início',
  contractDurationMonths: 'Prazo (meses)',
  monthlyContractValue: 'Valor mensal (R$)',
  notes: 'Observações',
  roleName: 'Nome do cargo',
  cboCode: 'CBO',
  workRegime: 'Regime de trabalho',
  workloadLabel: 'Carga horária',
  allocationSector: 'Setor de alocação',
  plannedPositions: 'Postos previstos',
  employeesPerPosition: 'Efetivo por posto',
  plannedHeadcount: 'Quantidade efetiva prevista',
  sourceSheetName: 'Planilha de origem',
  sourceCellRef: 'Célula de origem',
  sourcePage: 'Página de origem',
  sourceExcerpt: 'Trecho de origem',
  itemCategory: 'Categoria',
  subcategory: 'Subcategoria',
  description: 'Descrição',
  specification: 'Especificação',
  unit: 'Unidade',
  sizeLabel: 'Tamanho',
  requiresCa: 'Exige CA',
  roleReference: 'Referência de cargo',
  plannedQuantity: 'Quantidade prevista',
  bidUnitValue: 'Valor unitário licitado',
  rubricMaxValue: 'Rubrica máxima (R$)',
  purchasedValue: 'Valor comprado (R$)',
  hasBidReference: 'Rubrica',
  title: 'Título',
  category: 'Categoria',
  status: 'Status',
  dueDate: 'Prazo',
};

function labelForLeaf(key: string): string {
  return FIELD_LABELS[key] ?? key;
}

function humanizeIssuePath(path: (string | number)[]): string {
  if (path.length === 0) return 'Formulário';
  const root = String(path[0]);

  if (root === 'project') {
    const rest = path.slice(1).map((p) => labelForLeaf(String(p)));
    return rest.length ? `Projeto — ${rest.join(' › ')}` : 'Projeto';
  }

  if (root === 'roles' && path.length >= 2 && typeof path[1] === 'number') {
    const line = path[1] + 1;
    const rest = path.slice(2).map((p) => labelForLeaf(String(p)));
    return `Cargos (linha ${line}) — ${rest.join(' › ') || 'campo'}`;
  }

  if (root === 'budgetItems' && path.length >= 2 && typeof path[1] === 'number') {
    const line = path[1] + 1;
    const rest = path.slice(2).map((p) => labelForLeaf(String(p)));
    return `Itens de compra (linha ${line}) — ${rest.join(' › ') || 'campo'}`;
  }

  if (root === 'tasks' && path.length >= 2 && typeof path[1] === 'number') {
    const line = path[1] + 1;
    const rest = path.slice(2).map((p) => labelForLeaf(String(p)));
    return `Tarefas (linha ${line}) — ${rest.join(' › ') || 'campo'}`;
  }

  return path
    .map((p) => (typeof p === 'number' ? `(linha ${p + 1})` : labelForLeaf(String(p))))
    .join(' › ');
}

function translateZodMessage(message: string, code?: string): string {
  const m = message.toLowerCase();
  if (code === 'invalid_type' && m.includes('required')) return 'campo obrigatório.';
  if (m.includes('required')) return 'campo obrigatório.';
  if (m.includes('too small') || code === 'too_small') return 'valor inválido ou abaixo do mínimo permitido.';
  if (m.includes('too big') || code === 'too_big') return 'valor inválido ou acima do máximo permitido.';
  if (m.includes('invalid enum') || code === 'invalid_enum_value') return 'valor inválido para as opções permitidas.';
  if (m.includes('invalid string') || m.includes('invalid format')) return 'formato inválido.';
  return message;
}

/**
 * Turns a Zod field path like `budgetItems.0.itemCategory` into a short Portuguese description.
 */
function humanizeFieldPath(path: string): string {
  const parts = path.split('.').filter(Boolean);
  if (parts.length === 0) return path;
  const asPath = parts.map((p) => (/^\d+$/.test(p) ? Number(p) : p));
  return humanizeIssuePath(asPath);
}

function joinMessages(messages: string[] | undefined): string {
  if (!messages?.length) return '';
  return messages.filter(Boolean).join('; ');
}

function formatIssuesForToast(issues: ZodIssuePayload[]): string | null {
  if (issues.length === 0) return null;
  const lines = issues.map((issue) => {
    const where = humanizeIssuePath(issue.path);
    const what = translateZodMessage(issue.message, issue.code);
    return `${where}: ${what}`;
  });
  const maxLines = 8;
  if (lines.length > maxLines) {
    const rest = lines.length - maxLines;
    return [...lines.slice(0, maxLines), `… e mais ${rest} problema(s).`].join('\n');
  }
  return lines.join('\n');
}

/**
 * Formats Zod `flatten()` payload for a user-visible toast (Portuguese).
 * Note: `flatten()` drops array indices; prefer API `details.issues`.
 */
export function formatZodFlattenForToast(details: unknown): string | null {
  if (!isZodFlattened(details)) return null;

  const lines: string[] = [];

  const formErr = joinMessages(details.formErrors);
  if (formErr) {
    lines.push(formErr);
  }

  const entries = Object.entries(details.fieldErrors).filter(
    ([, msgs]) => msgs && msgs.length > 0,
  ) as [string, string[]][];

  for (const [path, msgs] of entries) {
    const where = humanizeFieldPath(path);
    const what = joinMessages(msgs);
    if (what) {
      lines.push(`${where}: ${what}`);
    } else {
      lines.push(`${where}: preenchimento obrigatório ou valor inválido.`);
    }
  }

  if (lines.length === 0) return null;

  const maxLines = 8;
  if (lines.length > maxLines) {
    const rest = lines.length - maxLines;
    return [...lines.slice(0, maxLines), `… e mais ${rest} problema(s).`].join('\n');
  }

  return lines.join('\n');
}

/**
 * Accepts API 422 `details`: either `{ issues, flatten? }` (preferred) or a raw flatten object.
 */
export function formatZodDetailsForToast(details: unknown): string | null {
  if (typeof details !== 'object' || details === null) return null;
  const d = details as Record<string, unknown>;

  if (isIssueArray(d.issues) && d.issues.length > 0) {
    return formatIssuesForToast(d.issues);
  }

  if (isZodFlattened(details)) {
    return formatZodFlattenForToast(details);
  }

  if (isZodFlattened(d.flatten)) {
    return formatZodFlattenForToast(d.flatten);
  }

  return null;
}

/**
 * Message for failed API calls: uses structured 422 details when present.
 */
export function formatApiValidationToastMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status === 422) {
    const formatted = formatZodDetailsForToast(error.details);
    if (formatted) {
      return formatted;
    }
    if (error.message && error.message !== 'Validation error') {
      return error.message;
    }
    return 'Dados inválidos ou incompletos. Verifique os campos obrigatórios e tente novamente.';
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
