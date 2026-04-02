import { createCanvas } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createWorker } from 'tesseract.js';

import { logger } from '../config/logger.js';

type PdfOcrRegion = {
  pageNumber?: number;
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  heightRatio: number;
  label?: string;
};

type ExtractPdfTextViaOcrOptions = {
  maxPages?: number;
  renderScale?: number;
  pageSegMode?: string | number;
  regions?: PdfOcrRegion[];
};

function envInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function clampRatio(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function getOcrDefaults(options?: ExtractPdfTextViaOcrOptions) {
  return {
    maxPages: options?.maxPages ?? envInt('PDF_OCR_MAX_PAGES', 18, 1, 40),
    scale: (options?.renderScale ?? envInt('PDF_OCR_RENDER_SCALE', 250, 100, 400)) / 100,
    pageSegMode: options?.pageSegMode,
  };
}

async function renderPdfPage(page: any, scale: number) {
  const viewport = page.getViewport({ scale });
  const w = Math.ceil(viewport.width);
  const h = Math.ceil(viewport.height);

  if (w > 14_000 || h > 14_000) {
    throw new Error(`PDF OCR: pagina excede limite de pixels (${w}x${h}).`);
  }

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('PDF OCR: pagina sem contexto 2D.');
  }

  await page.render({
    canvas: canvas as unknown as HTMLCanvasElement,
    canvasContext: ctx as unknown as CanvasRenderingContext2D,
    viewport,
  }).promise;

  return { canvas, width: w, height: h };
}

function cropCanvas(sourceCanvas: any, region: PdfOcrRegion, width: number, height: number) {
  const x = Math.floor(width * clampRatio(region.xRatio));
  const y = Math.floor(height * clampRatio(region.yRatio));
  const regionWidth = Math.max(1, Math.floor(width * clampRatio(region.widthRatio)));
  const regionHeight = Math.max(1, Math.floor(height * clampRatio(region.heightRatio)));

  const crop = createCanvas(regionWidth, regionHeight);
  const cropCtx = crop.getContext('2d');
  if (!cropCtx) {
    throw new Error('PDF OCR: recorte sem contexto 2D.');
  }

  (cropCtx as any).drawImage(
    sourceCanvas as any,
    x,
    y,
    regionWidth,
    regionHeight,
    0,
    0,
    regionWidth,
    regionHeight,
  );

  return crop;
}

/**
 * Renderiza paginas do PDF em imagem e aplica OCR (Tesseract).
 * Usado quando o texto embutido do PDF nao traz tabelas que estao so como imagem.
 */
export async function extractPdfTextViaOcr(buffer: Buffer, options?: ExtractPdfTextViaOcrOptions): Promise<string> {
  const { maxPages, scale, pageSegMode } = getOcrDefaults(options);

  const data = new Uint8Array(buffer.byteLength);
  data.set(buffer);

  const loadingTask = getDocument({ data, verbosity: 0 });
  const pdf = await loadingTask.promise;

  const numPages = Math.min(pdf.numPages, maxPages);
  const lang = (process.env.PDF_OCR_LANG ?? 'por+eng').trim() || 'por+eng';

  const worker = await createWorker(lang);
  if (pageSegMode !== undefined) {
    await (worker as any).setParameters({
      tessedit_pageseg_mode: String(pageSegMode),
    });
  }

  const parts: string[] = [];

  try {
    if (options?.regions?.length) {
      for (const [index, region] of options.regions.entries()) {
        const pageNumber = region.pageNumber ?? 1;
        if (pageNumber < 1 || pageNumber > numPages) {
          continue;
        }

        const page = await pdf.getPage(pageNumber);
        try {
          const rendered = await renderPdfPage(page, scale);
          const crop = cropCanvas(rendered.canvas, region, rendered.width, rendered.height);
          const {
            data: { text },
          } = await worker.recognize(crop.toBuffer('image/png'));
          const trimmed = text?.trim() ?? '';
          if (trimmed.length > 0) {
            const label = region.label?.trim() || `Regiao ${index + 1}`;
            parts.push(`--- Pagina ${pageNumber} / ${label} ---\n${trimmed}`);
          }
        } catch (error) {
          logger.warn(`PDF OCR: falha ao processar regiao ${index + 1} da pagina ${pageNumber}: ${String(error)}`);
        }
      }

      return parts.join('\n\n');
    }

    for (let p = 1; p <= numPages; p += 1) {
      const page = await pdf.getPage(p);
      try {
        const rendered = await renderPdfPage(page, scale);
        const png = rendered.canvas.toBuffer('image/png');
        const {
          data: { text },
        } = await worker.recognize(png);
        const trimmed = text?.trim() ?? '';
        if (trimmed.length > 0) {
          parts.push(`--- Pagina ${p} ---\n${trimmed}`);
        }
      } catch (error) {
        logger.warn(`PDF OCR: pagina ${p} ignorada por falha de render/OCR: ${String(error)}`);
      }
    }
  } finally {
    await worker.terminate();
    await pdf.destroy();
  }

  return parts.join('\n\n');
}
