import { createCanvas } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createWorker } from 'tesseract.js';

import { logger } from '../config/logger.js';

function envInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Renderiza páginas do PDF em imagem e aplica OCR (Tesseract).
 * Usado quando o texto embutido do PDF não traz tabelas que estão só como imagem.
 */
export async function extractPdfTextViaOcr(buffer: Buffer): Promise<string> {
  const maxPages = envInt('PDF_OCR_MAX_PAGES', 18, 1, 40);
  const scale = envInt('PDF_OCR_RENDER_SCALE', 200, 100, 300) / 100;

  const data = new Uint8Array(buffer.byteLength);
  data.set(buffer);

  const loadingTask = getDocument({ data, verbosity: 0 });
  const pdf = await loadingTask.promise;

  const numPages = Math.min(pdf.numPages, maxPages);
  const lang = (process.env.PDF_OCR_LANG ?? 'por+eng').trim() || 'por+eng';

  const worker = await createWorker(lang);
  const parts: string[] = [];

  try {
    for (let p = 1; p <= numPages; p++) {
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale });
      const w = Math.ceil(viewport.width);
      const h = Math.ceil(viewport.height);

      if (w > 14_000 || h > 14_000) {
        logger.warn(`PDF OCR: página ${p} excede limite de pixels (${w}x${h}), ignorada.`);
        continue;
      }

      const canvas = createCanvas(w, h);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        logger.warn(`PDF OCR: página ${p} sem contexto 2D, ignorada.`);
        continue;
      }
      await page.render({
        canvas: canvas as unknown as HTMLCanvasElement,
        canvasContext: ctx as unknown as CanvasRenderingContext2D,
        viewport,
      }).promise;
      const png = canvas.toBuffer('image/png');

      const {
        data: { text },
      } = await worker.recognize(png);
      const trimmed = text?.trim() ?? '';
      if (trimmed.length > 0) {
        parts.push(`--- Página ${p} ---\n${trimmed}`);
      }
    }
  } finally {
    await worker.terminate();
    await pdf.destroy();
  }

  return parts.join('\n\n');
}
