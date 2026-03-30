'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Send } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const WEB3FORMS_SUBMIT = 'https://api.web3forms.com/submit';

const schema = z.object({
  name: z.string().trim().min(1, 'Informe o nome.'),
  email: z.string().trim().email('Informe um e-mail válido.'),
  message: z.string().trim().min(1, 'Escreva a mensagem.'),
});

type FormValues = z.infer<typeof schema>;

export function Web3FormsContactForm() {
  const accessKey = process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY?.trim();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', message: '' },
  });

  async function onSubmit(values: FormValues) {
    if (!accessKey) {
      toast.error('Chave Web3Forms não configurada.');
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('access_key', accessKey);
      fd.append('name', values.name);
      fd.append('email', values.email);
      fd.append('message', values.message);

      const response = await fetch(WEB3FORMS_SUBMIT, {
        method: 'POST',
        body: fd,
      });

      const data = (await response.json()) as { success?: boolean; message?: string };

      if (response.ok && data.success) {
        toast.success('Mensagem enviada. Em breve entramos em contacto.');
        form.reset();
      } else {
        toast.error(data.message ?? 'Não foi possível enviar. Tente novamente.');
      }
    } catch {
      toast.error('Erro de rede. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!accessKey) {
    return (
      <Card className="w-full max-w-lg border-border/80 shadow-xl">
        <CardHeader>
          <CardTitle className="font-heading text-xl">Contacto</CardTitle>
          <CardDescription>
            Defina <code className="rounded bg-muted px-1 py-0.5 text-xs">NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY</code> na
            Vercel (e no <code className="rounded bg-muted px-1 py-0.5 text-xs">.env</code> local) e faça um novo
            deploy.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-lg border-border/80 shadow-xl">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="font-heading text-2xl">Contacto</CardTitle>
        <CardDescription>Envie uma mensagem; a equipa recebe por e-mail (Web3Forms).</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="contact-name">Nome</Label>
            <Input id="contact-name" autoComplete="name" placeholder="O seu nome" {...form.register('name')} />
            {form.formState.errors.name ? (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-email">E-mail</Label>
            <Input
              id="contact-email"
              autoComplete="email"
              inputMode="email"
              placeholder="nome@empresa.com"
              type="email"
              {...form.register('email')}
            />
            {form.formState.errors.email ? (
              <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-message">Mensagem</Label>
            <Textarea
              id="contact-message"
              className="min-h-[120px] resize-y"
              placeholder="Como podemos ajudar?"
              {...form.register('message')}
            />
            {form.formState.errors.message ? (
              <p className="text-sm text-destructive">{form.formState.errors.message.message}</p>
            ) : null}
          </div>
          <Button className="w-full gap-2" disabled={submitting} type="submit">
            <Send className="h-4 w-4" />
            {submitting ? 'A enviar…' : 'Enviar'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
