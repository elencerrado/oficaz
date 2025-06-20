import { ReactNode } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { PageLoading } from './page-loading';

interface PageWrapperProps {
  children: ReactNode;
}

export function PageWrapper({ children }: PageWrapperProps) {
  const { user, company, isLoading } = useAuth();

  if (isLoading || !user || !company) {
    return <PageLoading />;
  }

  return <>{children}</>;
}