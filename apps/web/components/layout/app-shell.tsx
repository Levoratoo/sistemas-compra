import type { ReactNode } from 'react';

import { AppHeader } from '@/components/layout/app-header';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { SidebarProvider } from '@/components/layout/sidebar-context';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-mesh dark:bg-mesh-dark dark:opacity-90" />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-grid-subtle opacity-[0.65] dark:bg-grid-subtle-dark dark:opacity-[0.2]" />
      <SidebarProvider>
        <div className="flex min-h-screen">
          <AppSidebar />
          <div className="flex min-h-screen w-full min-w-0 flex-1 flex-col">
            <AppHeader />
            <main className="relative flex-1 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
              <div className="mx-auto w-full max-w-[1600px]">{children}</div>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </div>
  );
}
