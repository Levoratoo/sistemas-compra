import type { Request, Response } from 'express';

import { supplierService } from '../services/supplier.service.js';
import type { CreateSupplierInput, UpdateSupplierInput } from '../modules/supplier/supplier.schemas.js';

class SupplierController {
  async create(request: Request, response: Response) {
    const result = await supplierService.createSupplier(request.body as CreateSupplierInput);
    response.status(201).json(result);
  }

  async list(_request: Request, response: Response) {
    const result = await supplierService.listSuppliers();
    response.json(result);
  }

  async update(request: Request, response: Response) {
    const result = await supplierService.updateSupplier(
      String(request.params.id),
      request.body as UpdateSupplierInput,
    );
    response.json(result);
  }

  async delete(request: Request, response: Response) {
    await supplierService.deleteSupplier(String(request.params.id));
    response.status(204).send();
  }
}

export const supplierController = new SupplierController();
