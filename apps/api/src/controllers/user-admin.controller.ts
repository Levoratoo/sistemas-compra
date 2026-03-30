import type { Request, Response } from 'express';

import type { CreateUserInput, UpdateUserInput } from '../modules/user/user-admin.schemas.js';
import { userAdminService } from '../services/user-admin.service.js';

class UserAdminController {
  async list(_request: Request, response: Response) {
    const users = await userAdminService.list();
    response.json(users);
  }

  async create(request: Request, response: Response) {
    const user = await userAdminService.create(request.body as CreateUserInput);
    response.status(201).json(user);
  }

  async update(request: Request, response: Response) {
    const user = await userAdminService.update(String(request.params.id), request.body as UpdateUserInput);
    response.json(user);
  }
}

export const userAdminController = new UserAdminController();
