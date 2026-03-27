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

/** Segunda cor (degradê / radial); padrão sky para contrastar com o teal. */
export const DEFAULT_FOLDER_COLOR_HEX_2 = '#0ea5e9';

/** Como o cartão da pasta usa a cor (API + banco). */
export type FolderSurfaceStyle = 'SOLID' | 'GRADIENT' | 'RADIAL';

export const DEFAULT_FOLDER_SURFACE_STYLE: FolderSurfaceStyle = 'GRADIENT';

export const FOLDER_SURFACE_OPTIONS: {
  description: string;
  label: string;
  value: FolderSurfaceStyle;
}[] = [
  {
    value: 'SOLID',
    label: 'Cor sólida',
    description: 'Preenchimento uniforme sobre o fundo do tema',
  },
  {
    value: 'GRADIENT',
    label: 'Degradê',
    description: 'Transição em faixa com a paleta do site',
  },
  {
    value: 'RADIAL',
    label: 'Radial',
    description: 'Clareamento a partir do canto, tipo holofote',
  },
];

export function parseFolderSurfaceStyle(v: unknown): FolderSurfaceStyle {
  if (v === 'SOLID' || v === 'GRADIENT' || v === 'RADIAL') return v;
  return DEFAULT_FOLDER_SURFACE_STYLE;
}

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
 * Fundo do cartão: sólido (uma cor); degradê ou radial (duas cores + tema).
 */
export function folderCardSurfaceStyle(
  accentHex: string,
  surfaceStyle: FolderSurfaceStyle = DEFAULT_FOLDER_SURFACE_STYLE,
  accentHex2?: string,
): CSSProperties {
  const n = normalizeFolderHex(accentHex);
  const n2 = normalizeFolderHex(accentHex2 ?? DEFAULT_FOLDER_COLOR_HEX_2);
  const rgb = hexToRgb(n);
  const rgb2 = hexToRgb(n2) ?? hexToRgb(DEFAULT_FOLDER_COLOR_HEX_2);
  if (!rgb || !rgb2) {
    return { background: 'hsl(var(--card))' };
  }
  const { r, g, b } = rgb;
  const { r: r2, g: g2, b: b2 } = rgb2;
  switch (surfaceStyle) {
    case 'SOLID':
      return {
        background: `linear-gradient(0deg, rgba(${r},${g},${b},0.38), rgba(${r},${g},${b},0.38)), hsl(var(--card))`,
        boxShadow: `inset 0 0 0 1px rgba(${r},${g},${b},0.22)`,
      };
    case 'RADIAL':
      return {
        background: `radial-gradient(ellipse 110% 95% at 100% 0%, rgba(${r},${g},${b},0.55) 0%, rgba(${r2},${g2},${b2},0.38) 58%, hsl(var(--card) / 0.93) 100%)`,
        boxShadow: `inset 0 1px 0 0 rgba(${r},${g},${b},0.14)`,
      };
    case 'GRADIENT':
    default:
      return {
        background: `linear-gradient(145deg, rgba(${r},${g},${b},0.5) 0%, hsl(var(--card) / 0.92) 46%, rgba(${r2},${g2},${b2},0.42) 100%)`,
        boxShadow: `inset 0 1px 0 0 rgba(${r},${g},${b},0.16)`,
      };
  }
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
