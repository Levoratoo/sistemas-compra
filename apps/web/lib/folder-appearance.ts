import type { CSSProperties } from 'react';

/** Emojis permitidos como ícone da pasta (alinhado à API). */
export const FOLDER_WORK_EMOJIS = [
  '📁',
  '📂',
  '🗂️',
  '📋',
  '📄',
  '📑',
  '📊',
  '📈',
  '📉',
  '🗃️',
  '🗄️',
  '💼',
  '🏢',
  '🤝',
  '✅',
  '⏰',
  '📌',
  '📎',
  '✏️',
  '📐',
  '🔒',
  '🔑',
  '⚖️',
  '📜',
  '📇',
  '🗓️',
  '✉️',
  '📬',
  '🖊️',
  '💡',
  '🔍',
  '📞',
  '☎️',
  '🖥️',
  '⚙️',
  '📦',
] as const;

export const DEFAULT_FOLDER_COLOR_HEX = '#14b8a6';

/** Garante `#rrggbb` minúsculo (exigido pelo `<input type="color">` e pela API). */
export function normalizeFolderHex(hex: string | undefined | null): string {
  if (hex == null || typeof hex !== 'string') return DEFAULT_FOLDER_COLOR_HEX;
  const t = hex.trim();
  const m = /^#?([0-9a-fA-F]{6})$/.exec(t);
  if (!m) return DEFAULT_FOLDER_COLOR_HEX;
  return `#${m[1].toLowerCase()}`;
}

function hexToRgb(hex: string): { b: number; g: number; r: number } | null {
  const h = hex.replace('#', '').toLowerCase();
  if (h.length !== 6) return null;
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return { r, g, b };
}

/**
 * Fundo do cartão de pasta: degradê da cor escolhida → superfície do tema → tom primary (paleta do site).
 */
export function folderCardSurfaceStyle(accentHex: string): CSSProperties {
  const n = normalizeFolderHex(accentHex);
  const rgb = hexToRgb(n);
  if (!rgb) {
    return { background: 'hsl(var(--card))' };
  }
  const { r, g, b } = rgb;
  return {
    background: `linear-gradient(145deg, rgba(${r},${g},${b},0.48) 0%, hsl(var(--card) / 0.94) 44%, hsl(var(--primary) / 0.24) 100%)`,
    boxShadow: `inset 0 1px 0 0 rgba(${r},${g},${b},0.18)`,
  };
}

/** Paleta rápida + qualquer cor via seletor nativo (validada na API como #RRGGBB). */
export const FOLDER_COLOR_SWATCHES = [
  '#14b8a6',
  '#0d9488',
  '#0ea5e9',
  '#2563eb',
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#ec4899',
  '#f43f5e',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#10b981',
  '#64748b',
  '#475569',
] as const;
