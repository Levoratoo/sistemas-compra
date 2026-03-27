import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import { env } from './config/env.js';
import { errorHandler } from './middlewares/error-handler.js';
import { notFoundHandler } from './middlewares/not-found.js';
import { ocrRouter } from './modules/ocr/ocr.routes.js';
import { apiRouter } from './routes/index.js';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((origin) => origin.trim().replace(/\/+$/, '')),
    }),
  );
  app.use(morgan('dev'));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/uploads', express.static(env.UPLOADS_DIR_ABSOLUTE));

  /**
   * OCR de imagem: registrado aqui (antes do apiRouter) para garantir as rotas em qualquer deploy
   * e evitar 404 se a ordem de `use` dentro do apiRouter mudar.
   */
  app.use(ocrRouter);
  app.use('/api', ocrRouter);

  app.use(apiRouter);
  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
