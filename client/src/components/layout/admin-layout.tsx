import { ReactNode } from 'react';
import { PageHeaderProvider } from './page-header';
import { ConditionalHeader } from './conditional-header';

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <PageHeaderProvider>
      <div className="px-6 pt-4 pb-8 min-h-screen bg-background overflow-y-auto" style={{ overflowX: 'clip' }}>
        <ConditionalHeader />
        <div className="admin-content">
          {children}
        </div>
      </div>
    </PageHeaderProvider>
  );
}