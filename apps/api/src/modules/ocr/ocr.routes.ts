import { Router } from 'express';
import multer from 'multer';

import { ocrController } from '../../controllers/ocr.controller.js';
import { OPERATIONAL_USER_ROLES, requireRole } from '../../middlewares/auth.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const ocrRouter = Router();

const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, _file, cb) => {
    cb(null, true);
  },
});

/** Confirma que o módulo OCR está no deploy (útil após novo build da API). */
ocrRouter.get('/ocr/status', requireRole(...OPERATIONAL_USER_ROLES), (_request, response) => {
  response.json({ ok: true, service: 'ocr', engine: 'tesseract' });
});

ocrRouter.post(
  '/ocr/image',
  requireRole(...OPERATIONAL_USER_ROLES),
  uploadImage.single('image'),
  asyncHandler((request, response) => ocrController.imageFromUpload(request, response)),
);

ocrRouter.post(
  '/ocr/image-base64',
  requireRole(...OPERATIONAL_USER_ROLES),
  asyncHandler((request, response) => ocrController.imageFromBase64(request, response)),
);
