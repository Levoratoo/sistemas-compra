import type { Request, Response } from 'express';

import { quoteService } from '../services/quote.service.js';
import type {
  ApplyQuoteWinnerInput,
  GenerateQuotePurchaseOrderInput,
  UpdateQuoteItemInput,
  UpdateQuoteSupplierInput,
} from '../modules/quote/quote.schemas.js';

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
}

export const quoteController = new QuoteController();
