import { ReactNode } from 'react';
import { PageHeaderProvider } from './page-header';
import { ConditionalHeader } from './conditional-header';

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <PageHeaderProvider>
      <div className="px-6 py-4 min-h-screen bg-background" style={{ overflowX: 'clip' }}>
        <ConditionalHeader />
        <div className="admin-content">
          {children}
        </div>
      </div>
    </PageHeaderProvider>
  );
}