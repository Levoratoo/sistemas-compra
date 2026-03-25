import type { Request, Response } from 'express';

import { roleService } from '../services/role.service.js';
import type {
  CreateProjectRoleInput,
  UpdateProjectRoleInput,
} from '../modules/role/role.schemas.js';

class RoleController {
  async create(request: Request, response: Response) {
    const result = await roleService.createProjectRole(
      String(request.params.id),
      request.body as CreateProjectRoleInput,
    );
    response.status(201).json(result);
  }

  async listByProject(request: Request, response: Response) {
    const result = await roleService.listProjectRoles(String(request.params.id));
    response.json(result);
  }

  async update(request: Request, response: Response) {
    const result = await roleService.updateProjectRole(
      String(request.params.id),
      request.body as UpdateProjectRoleInput,
    );
    response.json(result);
  }

  async delete(request: Request, response: Response) {
    await roleService.deleteProjectRole(String(request.params.id));
    response.status(204).send();
  }
}

export const roleController = new RoleController();
