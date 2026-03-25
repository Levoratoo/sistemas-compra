import { documentRepository } from '../repositories/document.repository.js';
import { projectRepository } from '../repositories/project.repository.js';
import { roleRepository } from '../repositories/role.repository.js';
import { AppError } from '../utils/app-error.js';
import { serializeProjectRole } from '../utils/serializers.js';
import type {
  CreateProjectRoleInput,
  UpdateProjectRoleInput,
} from '../modules/role/role.schemas.js';

async function ensureProjectExists(projectId: string) {
  const project = await projectRepository.exists(projectId);

  if (!project) {
    throw new AppError('Project not found', 404);
  }
}

async function ensureSourceDocumentBelongsToProject(projectId: string, sourceDocumentId?: string | null) {
  if (!sourceDocumentId) {
    return;
  }

  const sourceDocument = await documentRepository.findById(sourceDocumentId);

  if (!sourceDocument) {
    throw new AppError('Source document not found', 404);
  }

  if (sourceDocument.projectId !== projectId) {
    throw new AppError('Source document does not belong to the same project', 409);
  }
}

class RoleService {
  async createProjectRole(projectId: string, input: CreateProjectRoleInput) {
    await ensureProjectExists(projectId);
    await ensureSourceDocumentBelongsToProject(projectId, input.sourceDocumentId);

    const role = await roleRepository.create({
      projectId,
      roleName: input.roleName,
      cboCode: input.cboCode ?? null,
      workRegime: input.workRegime ?? null,
      workloadLabel: input.workloadLabel ?? null,
      allocationSector: input.allocationSector ?? null,
      plannedPositions: input.plannedPositions ?? null,
      employeesPerPosition: input.employeesPerPosition ?? null,
      plannedHeadcount: input.plannedHeadcount,
      sourceType: input.sourceType ?? 'MANUAL',
      sourceDocumentId: input.sourceDocumentId ?? null,
      sourceSheetName: input.sourceSheetName ?? null,
      sourceCellRef: input.sourceCellRef ?? null,
      sourcePage: input.sourcePage ?? null,
      sourceExcerpt: input.sourceExcerpt ?? null,
      notes: input.notes ?? null,
    });

    return serializeProjectRole(role);
  }

  async listProjectRoles(projectId: string) {
    await ensureProjectExists(projectId);
    const roles = await roleRepository.findByProject(projectId);
    return roles.map(serializeProjectRole);
  }

  async updateProjectRole(roleId: string, input: UpdateProjectRoleInput) {
    const existingRole = await roleRepository.findById(roleId);

    if (!existingRole) {
      throw new AppError('Project role not found', 404);
    }

    await ensureSourceDocumentBelongsToProject(existingRole.projectId, input.sourceDocumentId);

    const updatedRole = await roleRepository.update(roleId, {
      roleName: input.roleName,
      cboCode: input.cboCode,
      workRegime: input.workRegime,
      workloadLabel: input.workloadLabel,
      allocationSector: input.allocationSector,
      plannedPositions: input.plannedPositions,
      employeesPerPosition: input.employeesPerPosition,
      plannedHeadcount: input.plannedHeadcount,
      sourceType: input.sourceType,
      sourceDocumentId: input.sourceDocumentId,
      sourceSheetName: input.sourceSheetName,
      sourceCellRef: input.sourceCellRef,
      sourcePage: input.sourcePage,
      sourceExcerpt: input.sourceExcerpt,
      notes: input.notes,
    });

    return serializeProjectRole(updatedRole);
  }

  async deleteProjectRole(roleId: string) {
    const existingRole = await roleRepository.findById(roleId);

    if (!existingRole) {
      throw new AppError('Project role not found', 404);
    }

    await roleRepository.delete(roleId);
  }
}

export const roleService = new RoleService();
