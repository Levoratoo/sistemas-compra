import type { Request, Response } from 'express';

import {
  createSupplierSchema,
  supplierIdParamsSchema,
  updateSupplierSchema,
} from '../modules/supplier/supplier.schemas.js';
import { supplierService } from '../services/supplier.service.js';

function projectIdFromBody(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') {
    return undefined;
  }
  const raw = (body as Record<string, unknown>).projectId;
  if (typeof raw !== 'string') {
    return undefined;
  }
  const t = raw.trim();
  return t === '' ? undefined : t;
}

class SupplierController {
  async create(request: Request, response: Response) {
    const input = createSupplierSchema.parse(request.body);
    const files = Array.isArray(request.files) ? request.files : [];
    const projectId = projectIdFromBody(request.body);

    const result = await supplierService.createSupplier(input, {
      projectId,
      cndFiles: files,
    });
    response.status(201).json(result);
  }

  async list(_request: Request, response: Response) {
    const result = await supplierService.listSuppliers();
    response.json(result);
  }

  async update(request: Request, response: Response) {
    const { id } = supplierIdParamsSchema.parse(request.params);
    const input = updateSupplierSchema.parse(request.body);
    const files = Array.isArray(request.files) ? request.files : [];
    const projectId = projectIdFromBody(request.body);

    const result = await supplierService.updateSupplier(id, input, {
      projectId,
      cndFiles: files,
    });
    response.json(result);
  }

  async delete(request: Request, response: Response) {
    const { id } = supplierIdParamsSchema.parse(request.params);
    await supplierService.deleteSupplier(id);
    response.status(204).send();
  }
}

export const supplierController = new SupplierController();
