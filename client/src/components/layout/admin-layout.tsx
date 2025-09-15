import { ReactNode } from 'react';
import { PageHeaderProvider } from './page-header';
import { ConditionalHeader } from './conditional-header';

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <PageHeaderProvider>
      <div className="px-6 py-4 h-screen bg-background overflow-hidden flex flex-col" style={{ overflowX: 'clip' }}>
        <ConditionalHeader />
        <div className="admin-content flex-1 min-h-0 overflow-hidden">
          {children}
        </div>
      </div>
    </PageHeaderProvider>
  );
}