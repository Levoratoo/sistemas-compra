import { Router } from 'express';
import multer from 'multer';

import { ocrController } from '../../controllers/ocr.controller.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const ocrRouter = Router();

/** Confirma que o módulo OCR está no deploy (útil após novo build da API). */
ocrRouter.get('/ocr/status', (_request, response) => {
  response.json({ ok: true, service: 'ocr', engine: 'tesseract' });
});

const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, _file, cb) => {
    cb(null, true);
  },
});

ocrRouter.post(
  '/ocr/image',
  uploadImage.single('image'),
  asyncHandler((request, response) => ocrController.imageFromUpload(request, response)),
);

ocrRouter.post(
  '/ocr/image-base64',
  asyncHandler((request, response) => ocrController.imageFromBase64(request, response)),
);
