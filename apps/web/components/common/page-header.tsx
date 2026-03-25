import type { ReactNode } from 'react';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

type Breadcrumb = {
  label: string;
  href?: string;
};

export function PageHeader({
  title,
  description,
  breadcrumbs = [],
  actions,
}: {
  title: string;
  description?: string;
  breadcrumbs?: Breadcrumb[];
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
      <div className="min-w-0 space-y-4">
        {breadcrumbs.length > 0 ? (
          <nav
            className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-muted-foreground"
            aria-label="Navegação estrutural"
          >
            {breadcrumbs.map((crumb, index) => (
              <div key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
                {index > 0 ? <ChevronRight className="size-3.5 shrink-0 opacity-50" aria-hidden /> : null}
                {crumb.href ? (
                  <Link
                    className="rounded-md text-muted-foreground transition-colors duration-200 hover:text-primary"
                    href={crumb.href}
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    className={
                      index === breadcrumbs.length - 1 ? 'font-semibold text-foreground' : 'text-muted-foreground'
                    }
                  >
                    {crumb.label}
                  </span>
                )}
              </div>
            ))}
          </nav>
        ) : null}
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
          {description ? (
            <p className="mt-3 max-w-3xl text-sm font-medium leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}
