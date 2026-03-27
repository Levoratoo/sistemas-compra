import { createWorker } from 'tesseract.js';

/**
 * OCR em imagem (print, foto, scan) — complementa o fluxo de PDF quando o texto não é selecionável.
 * Idiomas alinhados ao OCR de PDF ({@link ./pdf-ocr.ts}).
 */
export async function extractTextFromImageBuffer(buffer: Buffer): Promise<string> {
  const lang = (process.env.PDF_OCR_LANG ?? 'por+eng').trim() || 'por+eng';
  const worker = await createWorker(lang);
  try {
    const {
      data: { text },
    } = await worker.recognize(buffer);
    return text?.trim() ?? '';
  } finally {
    await worker.terminate();
  }
}
