import type { Request, Response } from 'express';

import { purchaseService } from '../services/purchase.service.js';
import type {
  CreatePurchaseOrderInput,
  CreatePurchaseOrderItemInput,
} from '../modules/purchase/purchase.schemas.js';

class PurchaseController {
  async createOrder(request: Request, response: Response) {
    const result = await purchaseService.createPurchaseOrder(
      String(request.params.id),
      request.body as CreatePurchaseOrderInput,
    );
    response.status(201).json(result);
  }

  async listOrders(request: Request, response: Response) {
    const result = await purchaseService.listProjectPurchaseOrders(String(request.params.id));
    response.json(result);
  }

  async createOrderItem(request: Request, response: Response) {
    const result = await purchaseService.createPurchaseOrderItem(
      String(request.params.id),
      request.body as CreatePurchaseOrderItemInput,
    );
    response.status(201).json(result);
  }
}

export const purchaseController = new PurchaseController();
