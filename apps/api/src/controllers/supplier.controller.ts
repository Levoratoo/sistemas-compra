import type { Request, Response } from 'express';

import {
  createSupplierSchema,
  supplierIdParamsSchema,
  updateSupplierSchema,
} from '../modules/supplier/supplier.schemas.js';
import { supplierService } from '../services/supplier.service.js';

class SupplierController {
  async create(request: Request, response: Response) {
    const input = createSupplierSchema.parse(request.body);
    const files = Array.isArray(request.files) ? request.files : [];

    const result = await supplierService.createSupplier(input, {
      cndFiles: files,
    });
    response.status(201).json(result);
  }

  async list(_request: Request, response: Response) {
    const result = await supplierService.listSuppliers();
    response.json(result);
  }

  async getById(request: Request, response: Response) {
    const { id } = supplierIdParamsSchema.parse(request.params);
    const result = await supplierService.getSupplierById(id);
    response.json(result);
  }

  async update(request: Request, response: Response) {
    const { id } = supplierIdParamsSchema.parse(request.params);
    const input = updateSupplierSchema.parse(request.body);
    const files = Array.isArray(request.files) ? request.files : [];

    const result = await supplierService.updateSupplier(id, input, {
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
