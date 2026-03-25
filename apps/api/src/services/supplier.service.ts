import { supplierRepository } from '../repositories/supplier.repository.js';
import { AppError } from '../utils/app-error.js';
import { serializeSupplier } from '../utils/serializers.js';
import type { CreateSupplierInput, UpdateSupplierInput } from '../modules/supplier/supplier.schemas.js';

class SupplierService {
  async createSupplier(input: CreateSupplierInput) {
    const supplier = await supplierRepository.create({
      legalName: input.legalName,
      documentNumber: input.documentNumber ?? null,
      contactName: input.contactName ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      notes: input.notes ?? null,
    });

    return serializeSupplier(supplier);
  }

  async listSuppliers() {
    const suppliers = await supplierRepository.findMany();
    return suppliers.map(serializeSupplier);
  }

  async updateSupplier(id: string, input: UpdateSupplierInput) {
    const existingSupplier = await supplierRepository.findById(id);

    if (!existingSupplier) {
      throw new AppError('Supplier not found', 404);
    }

    const supplier = await supplierRepository.update(id, {
      legalName: input.legalName,
      documentNumber: input.documentNumber,
      contactName: input.contactName,
      phone: input.phone,
      email: input.email,
      notes: input.notes,
    });

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
