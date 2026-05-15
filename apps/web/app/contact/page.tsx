import type { Metadata } from 'next';

import { Web3FormsContactForm } from '@/components/contact/web3forms-contact-form';
import { SITE_DISPLAY_NAME } from '@/lib/site-brand';

export const metadata: Metadata = {
  title: `Contacto | ${SITE_DISPLAY_NAME}`,
  description: 'Envie uma mensagem à equipa.',
};

export default function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-muted/40 to-background px-4 py-12">
      <Web3FormsContactForm />
    </div>
  );
}
