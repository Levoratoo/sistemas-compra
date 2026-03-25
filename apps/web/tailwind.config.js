const path = require('path');

const dirs = ['app', 'components', 'features', 'hooks', 'lib', 'services', 'types'];

function contentGlobs() {
  const root = __dirname;
  const out = [];
  for (const dir of dirs) {
    out.push(path.join(root, dir, '**', '*.ts').replace(/\\/g, '/'));
    out.push(path.join(root, dir, '**', '*.tsx').replace(/\\/g, '/'));
  }
  return out;
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: contentGlobs(),
  theme: {
    extend: {
      colors: {
        border: '#e2e8f0',
        input: '#f1f5f9',
        ring: '#14b8a6',
        background: '#f8fafc',
        foreground: '#0f172a',
        primary: {
          DEFAULT: '#0d9488',
          foreground: '#f0fdfa',
        },
        secondary: {
          DEFAULT: '#f1f5f9',
          foreground: '#0f172a',
        },
        muted: {
          DEFAULT: '#f1f5f9',
          foreground: '#64748b',
        },
        accent: {
          DEFAULT: '#f59e0b',
          foreground: '#451a03',
        },
        card: {
          DEFAULT: '#ffffff',
          foreground: '#0f172a',
        },
        destructive: {
          DEFAULT: '#dc2626',
          foreground: '#fff1f2',
        },
        sidebar: {
          DEFAULT: '#0f172a',
          foreground: '#f8fafc',
          muted: '#94a3b8',
          accent: '#14b8a6',
          border: '#1e293b',
        },
      },
      borderRadius: {
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      boxShadow: {
        soft: '0 1px 3px 0 rgb(15 23 42 / 0.06), 0 12px 32px -8px rgb(15 23 42 / 0.12)',
        glow: '0 0 0 1px rgb(20 184 166 / 0.15), 0 8px 24px -6px rgb(13 148 136 / 0.25)',
      },
      backgroundImage: {
        mesh:
          'radial-gradient(at 0% 0%, rgb(20 184 166 / 0.12) 0px, transparent 50%), radial-gradient(at 100% 0%, rgb(245 158 11 / 0.08) 0px, transparent 45%), radial-gradient(at 100% 100%, rgb(13 148 136 / 0.06) 0px, transparent 40%)',
        'grid-subtle':
          'linear-gradient(to right, rgb(148 163 184 / 0.08) 1px, transparent 1px), linear-gradient(to bottom, rgb(148 163 184 / 0.08) 1px, transparent 1px)',
      },
      backgroundSize: {
        'grid-subtle': '40px 40px',
      },
      fontFamily: {
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        heading: ['var(--font-title)', 'var(--font-body)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
