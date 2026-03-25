import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-mesh p-6">
      <Card className="max-w-md border-border/80 shadow-lg">
        <CardContent className="space-y-4 p-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">404</p>
          <h1 className="font-heading text-2xl font-bold text-card-foreground">Página não encontrada</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            O caminho solicitado não existe nesta versão do MVP.
          </p>
          <Button asChild className="mt-2">
            <Link href="/">Voltar ao dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
