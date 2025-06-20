import { ReactNode } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { PageLoading } from './page-loading';

interface PageWrapperProps {
  children: ReactNode;
  loadingMessage?: string;
}

export function PageWrapper({ children, loadingMessage = "Cargando..." }: PageWrapperProps) {
  const { user, company, isLoading } = useAuth();

  if (isLoading || !user || !company) {
    return <PageLoading message={loadingMessage} />;
  }

  return <>{children}</>;
}