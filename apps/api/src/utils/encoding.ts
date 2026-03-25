/**
 * Corrige texto em que bytes UTF-8 foram interpretados como Latin-1 (mojibake).
 * Ex.: "IMPLEMENTAÃ§Ã£O" → "IMPLEMENTAÇÃO"
 */
export function repairUtf8MisinterpretedAsLatin1(input: string): string {
  if (!input) return input;
  // Só tenta quando há marcadores típicos de UTF-8 lido como ISO-8859-1 (ou � U+FFFD)
  if (!/\u00c3|\u00c2|\uFFFD/.test(input)) {
    return input;
  }
  try {
    const buf = Buffer.from(input, 'latin1');
    const out = buf.toString('utf8');
    if (out.includes('\uFFFD')) return input;
    return out;
  } catch {
    return input;
  }
}

/**
 * Decodifica nomes vindos de multipart (filename*=UTF-8''... ou %XX).
 */
export function decodeMultipartFilename(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;

  try {
    if (/^UTF-8''/i.test(trimmed)) {
      return decodeURIComponent(trimmed.slice(7));
    }
    if (/%[0-9A-Fa-f]{2}/.test(trimmed)) {
      return decodeURIComponent(trimmed.replace(/\+/g, ' '));
    }
  } catch {
    /* mantém original */
  }

  return trimmed;
}

/** Nome de arquivo após upload multipart (encoding + mojibake). */
export function normalizeImportedFileName(fileName: string): string {
  return repairUtf8MisinterpretedAsLatin1(decodeMultipartFilename(fileName));
}
