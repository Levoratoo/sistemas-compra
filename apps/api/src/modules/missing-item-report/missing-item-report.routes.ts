import { Router } from 'express';
import multer from 'multer';

import { missingItemReportController } from '../../controllers/missing-item-report.controller.js';
import { requireRole } from '../../middlewares/auth.js';
import { validateRequest } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  createMissingItemReportSchema,
  missingItemReportAttachmentIdParamsSchema,
  missingItemReportIdParamsSchema,
  missingItemReportProjectParamsSchema,
  updateMissingItemReportSchema,
} from './missing-item-report.schemas.js';

export const missingItemReportRouter = Router();

const uploadAttachment = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

missingItemReportRouter.get(
  '/missing-item-reports/pending-approval',
  requireRole('APPROVER', 'ADMIN'),
  asyncHandler((request, response) => missingItemReportController.listPendingApproval(request, response)),
);

missingItemReportRouter.post(
  '/projects/:id/missing-item-reports',
  validateRequest({
    params: missingItemReportProjectParamsSchema,
    body: createMissingItemReportSchema,
  }),
  asyncHandler((request, response) => missingItemReportController.create(request, response)),
);

missingItemReportRouter.get(
  '/projects/:id/missing-item-reports',
  validateRequest({ params: missingItemReportProjectParamsSchema }),
  asyncHandler((request, response) => missingItemReportController.listByProject(request, response)),
);

missingItemReportRouter.put(
  '/missing-item-reports/:id',
  validateRequest({
    params: missingItemReportIdParamsSchema,
    body: updateMissingItemReportSchema,
  }),
  asyncHandler((request, response) => missingItemReportController.update(request, response)),
);

missingItemReportRouter.delete(
  '/missing-item-reports/:id',
  validateRequest({ params: missingItemReportIdParamsSchema }),
  asyncHandler((request, response) => missingItemReportController.delete(request, response)),
);

missingItemReportRouter.post(
  '/missing-item-reports/:id/attachments',
  uploadAttachment.single('file'),
  validateRequest({ params: missingItemReportIdParamsSchema }),
  asyncHandler((request, response) => missingItemReportController.addAttachment(request, response)),
);

missingItemReportRouter.delete(
  '/missing-item-report-attachments/:id',
  validateRequest({ params: missingItemReportAttachmentIdParamsSchema }),
  asyncHandler((request, response) => missingItemReportController.deleteAttachment(request, response)),
);
