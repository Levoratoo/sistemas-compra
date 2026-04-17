import type { Express, Request, Response } from 'express';

import {
  createSupplierSchema,
  supplierIdParamsSchema,
  updateSupplierSchema,
} from '../modules/supplier/supplier.schemas.js';
import type { ScopedCndUpload } from '../services/supplier-cnd-sync.service.js';
import { supplierService } from '../services/supplier.service.js';

function parseScopedCndUploads(request: Request): ScopedCndUpload[] {
  const raw = request.files;
  if (!raw || Array.isArray(raw)) {
    return [];
  }

  const dict = raw as Record<string, Express.Multer.File[] | undefined>;
  const out: ScopedCndUpload[] = [];
  const federal = dict.cndFederal?.[0];
  const estadual = dict.cndEstadual?.[0];
  if (federal) {
    out.push({ file: federal, scope: 'FEDERAL' });
  }
  if (estadual) {
    out.push({ file: estadual, scope: 'STATE' });
  }
  return out;
}

class SupplierController {
  async create(request: Request, response: Response) {
    const input = createSupplierSchema.parse(request.body);
    const scopedCndFiles = parseScopedCndUploads(request);

    const result = await supplierService.createSupplier(input, {
      scopedCndFiles,
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
    const scopedCndFiles = parseScopedCndUploads(request);

    const result = await supplierService.updateSupplier(id, input, {
      scopedCndFiles,
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
