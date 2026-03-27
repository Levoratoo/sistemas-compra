import { apiRequest, apiUploadJson } from '@/services/api-client';

export type OcrTableRow = {
  item: string;
  quantity: string;
  description: string;
};

export type OcrImageResponse = {
  text: string;
  tableRows?: OcrTableRow[];
  mimeType?: string;
  bytes?: number;
};

/** Multipart: campo `image` (arquivo). */
export function recognizeImageFile(file: File) {
  const formData = new FormData();
  formData.append('image', file);
  return apiUploadJson<OcrImageResponse>('ocr/image', formData);
}

/** JSON: útil para colagem ou integrações. */
export function recognizeImageBase64(imageBase64: string) {
  return apiRequest<OcrImageResponse>('ocr/image-base64', {
    method: 'POST',
    body: { imageBase64 },
  });
}
