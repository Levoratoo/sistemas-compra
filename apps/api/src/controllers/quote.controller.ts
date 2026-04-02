import type { Request, Response } from 'express';

import { quoteService } from '../services/quote.service.js';
import type {
  ApplyQuoteWinnerInput,
  ApplyQuoteImportInput,
  GenerateQuotePurchaseOrderInput,
  UpdateQuoteItemInput,
  UpdateQuoteSupplierInput,
} from '../modules/quote/quote.schemas.js';
import { AppError } from '../utils/app-error.js';
import { normalizeImportedFileName } from '../utils/encoding.js';

class QuoteController {
  async listByProject(request: Request, response: Response) {
    const result = await quoteService.listProjectQuotes(String(request.params.id));
    response.json(result);
  }

  async updateSupplier(request: Request, response: Response) {
    const result = await quoteService.updateQuoteSupplier(
      String(request.params.id),
      Number(request.params.slotNumber),
      request.body as UpdateQuoteSupplierInput,
    );
    response.json(result);
  }

  async updateItem(request: Request, response: Response) {
    const result = await quoteService.updateQuoteItem(
      String(request.params.id),
      Number(request.params.slotNumber),
      String(request.params.budgetItemId),
      request.body as UpdateQuoteItemInput,
    );
    response.json(result);
  }

  async selectSlot(request: Request, response: Response) {
    const result = await quoteService.selectQuoteSlot(
      String(request.params.id),
      Number(request.params.slotNumber),
    );
    response.json(result);
  }

  async applyWinner(request: Request, response: Response) {
    const result = await quoteService.applyQuoteWinner(
      String(request.params.id),
      request.body as ApplyQuoteWinnerInput,
    );
    response.json(result);
  }

  async generatePurchaseOrder(request: Request, response: Response) {
    const result = await quoteService.generatePurchaseOrderDocument(
      String(request.params.id),
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
      Number(request.params.slotNumber),
      { ...file, originalname: safeName },
    );
    response.status(201).json(result);
  }

  async applyImportedPdf(request: Request, response: Response) {
    const result = await quoteService.applyImportedSupplierQuotePdf(
      String(request.params.id),
      Number(request.params.slotNumber),
      String(request.params.documentId),
      request.body as ApplyQuoteImportInput,
    );
    response.json(result);
  }
}

export const quoteController = new QuoteController();
