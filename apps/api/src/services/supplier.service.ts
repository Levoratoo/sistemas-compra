import type { Express } from 'express';

import { supplierRepository } from '../repositories/supplier.repository.js';
import { uploadSupplierCndFilesAndReplicateToAllProjects } from './supplier-cnd-sync.service.js';
import { AppError } from '../utils/app-error.js';
import { serializeSupplier } from '../utils/serializers.js';
import type { CreateSupplierInput, UpdateSupplierInput } from '../modules/supplier/supplier.schemas.js';

class SupplierService {
  async createSupplier(input: CreateSupplierInput, options?: { cndFiles?: Express.Multer.File[] }) {
    let supplier = await supplierRepository.create({
      legalName: input.legalName,
      tradeName: input.tradeName ?? null,
      documentNumber: input.documentNumber ?? null,
      contactName: input.contactName ?? null,
      address: input.address ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      cnd: input.cnd ?? null,
      notes: input.notes ?? null,
    });

    const files = options?.cndFiles ?? [];
    if (files.length > 0) {
      await uploadSupplierCndFilesAndReplicateToAllProjects(supplier.id, supplier.legalName, files);
      supplier = (await supplierRepository.findById(supplier.id)) ?? supplier;
    }

    return serializeSupplier(supplier);
  }

  async listSuppliers() {
    const suppliers = await supplierRepository.findMany();
    return suppliers.map(serializeSupplier);
  }

  async updateSupplier(id: string, input: UpdateSupplierInput, options?: { cndFiles?: Express.Multer.File[] }) {
    const existingSupplier = await supplierRepository.findById(id);

    if (!existingSupplier) {
      throw new AppError('Supplier not found', 404);
    }

    let supplier = await supplierRepository.update(id, {
      legalName: input.legalName,
      tradeName: input.tradeName,
      documentNumber: input.documentNumber,
      contactName: input.contactName,
      address: input.address,
      phone: input.phone,
      email: input.email,
      cnd: input.cnd,
      notes: input.notes,
    });

    const files = options?.cndFiles ?? [];
    if (files.length > 0) {
      await uploadSupplierCndFilesAndReplicateToAllProjects(supplier.id, supplier.legalName, files);
      supplier = (await supplierRepository.findById(supplier.id)) ?? supplier;
    }

    return serializeSupplier(supplier);
  }

  async deleteSupplier(id: string) {
    const existingSupplier = await supplierRepository.findById(id);

    if (!existingSupplier) {
      throw new AppError('Supplier not found', 404);
    }

    await supplierRepository.delete(id);
  }
}

export const supplierService = new SupplierService();
