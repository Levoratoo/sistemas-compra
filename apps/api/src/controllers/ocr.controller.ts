import type { Request, Response } from 'express';

import { extractTextFromImageBuffer } from '../utils/image-ocr.js';
import { AppError } from '../utils/app-error.js';

const ALLOWED_MIME = /^image\/(png|jpe?g|gif|webp)$/i;

export const ocrController = {
  async imageFromUpload(request: Request, response: Response) {
    const file = request.file;
    if (!file?.buffer?.length) {
      throw new AppError('Envie uma imagem (PNG, JPEG, WebP ou GIF).', 400);
    }
    if (!ALLOWED_MIME.test(file.mimetype || '')) {
      throw new AppError('Formato de imagem não suportado. Use PNG, JPEG, WebP ou GIF.', 400);
    }

    const text = await extractTextFromImageBuffer(file.buffer);
    response.json({
      text,
      mimeType: file.mimetype,
      bytes: file.buffer.length,
    });
  },

  async imageFromBase64(request: Request, response: Response) {
    const raw = (request.body as { imageBase64?: string })?.imageBase64;
    if (typeof raw !== 'string' || !raw.trim()) {
      throw new AppError('Envie imageBase64 com o conteúdo da imagem em base64 (data URL ou só o payload).', 400);
    }

    let b64 = raw.trim();
    const dataUrl = /^data:image\/\w+;base64,/.exec(b64);
    if (dataUrl) {
      b64 = b64.slice(dataUrl[0].length);
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(b64, 'base64');
    } catch {
      throw new AppError('Base64 inválido.', 400);
    }

    if (buffer.length < 40) {
      throw new AppError('Imagem muito pequena ou base64 incompleto.', 400);
    }
    if (buffer.length > 15 * 1024 * 1024) {
      throw new AppError('Imagem muito grande (máx. 15 MB).', 400);
    }

    const text = await extractTextFromImageBuffer(buffer);
    response.json({
      text,
      bytes: buffer.length,
    });
  },
};
