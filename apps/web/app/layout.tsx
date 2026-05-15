import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Manrope, Space_Grotesk } from 'next/font/google';

import { Providers } from '@/components/providers';
import { SITE_DISPLAY_NAME, SITE_TAGLINE } from '@/lib/site-brand';

import './globals.css';

const bodyFont = Manrope({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  preload: true,
  adjustFontFallback: true,
});

const titleFont = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-title',
  display: 'swap',
  /** Só o body precisa bloquear primeira pintura; título carrega depois. */
  preload: false,
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  title: {
    default: SITE_DISPLAY_NAME,
    template: `%s | ${SITE_DISPLAY_NAME}`,
  },
  description: SITE_TAGLINE,
  icons: {
    icon: [{ url: '/logo-alianca-universal.png', sizes: 'any', type: 'image/png' }],
    apple: '/logo-alianca-universal.png',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${bodyFont.variable} ${titleFont.variable} min-h-screen bg-background font-sans text-foreground antialiased transition-colors duration-300`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
