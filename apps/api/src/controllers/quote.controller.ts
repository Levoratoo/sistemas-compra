import type { Request, Response } from 'express';

import { quoteService } from '../services/quote.service.js';
import type {
  ApplyQuoteWinnerInput,
  ApplyQuoteImportInput,
  CreateQuotePurchaseInput,
  GenerateQuotePurchaseOrderInput,
  UpdateQuoteItemInput,
  UpdateQuotePurchaseInput,
  UpdateQuotePurchaseItemsInput,
  UpdateQuoteSupplierInput,
} from '../modules/quote/quote.schemas.js';
import { AppError } from '../utils/app-error.js';
import { normalizeImportedFileName } from '../utils/encoding.js';

class QuoteController {
  async listByProject(request: Request, response: Response) {
    const result = await quoteService.listProjectQuotes(String(request.params.id));
    response.json(result);
  }

  async createPurchase(request: Request, response: Response) {
    const result = await quoteService.createQuotePurchase(
      String(request.params.id),
      request.body as CreateQuotePurchaseInput,
    );
    response.status(201).json(result);
  }

  async updatePurchase(request: Request, response: Response) {
    const result = await quoteService.updateQuotePurchase(
      String(request.params.id),
      String(request.params.purchaseId),
      request.body as UpdateQuotePurchaseInput,
    );
    response.json(result);
  }

  async deletePurchase(request: Request, response: Response) {
    const result = await quoteService.deleteQuotePurchase(String(request.params.id), String(request.params.purchaseId));
    response.json(result);
  }

  async addPurchaseItems(request: Request, response: Response) {
    const result = await quoteService.addQuotePurchaseItems(
      String(request.params.id),
      String(request.params.purchaseId),
      request.body as UpdateQuotePurchaseItemsInput,
    );
    response.json(result);
  }

  async removePurchaseItem(request: Request, response: Response) {
    const result = await quoteService.removeQuotePurchaseItem(
      String(request.params.id),
      String(request.params.purchaseId),
      String(request.params.budgetItemId),
    );
    response.json(result);
  }

  async updateSupplier(request: Request, response: Response) {
    const result = await quoteService.updateQuoteSupplier(
      String(request.params.id),
      String(request.params.purchaseId),
      Number(request.params.slotNumber),
      request.body as UpdateQuoteSupplierInput,
    );
    response.json(result);
  }

  async updateItem(request: Request, response: Response) {
    const result = await quoteService.updateQuoteItem(
      String(request.params.id),
      String(request.params.purchaseId),
      Number(request.params.slotNumber),
      String(request.params.budgetItemId),
      request.body as UpdateQuoteItemInput,
    );
    response.json(result);
  }

  async applyWinner(request: Request, response: Response) {
    const result = await quoteService.applyQuoteWinner(
      String(request.params.id),
      String(request.params.purchaseId),
      request.body as ApplyQuoteWinnerInput,
    );
    response.json(result);
  }

  async generatePurchaseOrders(request: Request, response: Response) {
    const result = await quoteService.generatePurchaseOrderDocuments(
      String(request.params.id),
      String(request.params.purchaseId),
      request.body as GenerateQuotePurchaseOrderInput,
    );
    response.status(201).json(result);
  }

  async importPdf(request: Request, response: Response) {
    const file = request.file;
    if (!file) {
      throw new AppError('Envie um arquivo PDF do fornecedor.', 400);
    }

    const safeName = normalizeImportedFileName(file.originalname);
    if (!/\.pdf$/i.test(safeName)) {
      throw new AppError('Envie um arquivo PDF do fornecedor.', 400);
    }

    const result = await quoteService.importSupplierQuotePdf(
      String(request.params.id),
      String(request.params.purchaseId),
      Number(request.params.slotNumber),
      { ...file, originalname: safeName },
    );
    response.status(201).json(result);
  }

  async applyImportedPdf(request: Request, response: Response) {
    const result = await quoteService.applyImportedSupplierQuotePdf(
      String(request.params.id),
      String(request.params.purchaseId),
      Number(request.params.slotNumber),
      String(request.params.documentId),
      request.body as ApplyQuoteImportInput,
    );
    response.json(result);
  }
}

export const quoteController = new QuoteController();
