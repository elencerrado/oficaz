import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

interface PageHeaderState {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  visible?: boolean;
}

interface PageHeaderContextType {
  header: PageHeaderState;
  setHeader: (updates: Partial<PageHeaderState>) => void;
  resetHeader: () => void;
}

const PageHeaderContext = createContext<PageHeaderContextType | undefined>(undefined);

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [header, setHeaderState] = useState<PageHeaderState>({});

  const setHeader = useCallback((updates: Partial<PageHeaderState>) => {
    setHeaderState(prev => ({ ...prev, ...updates }));
  }, []);

  const resetHeader = useCallback(() => {
    setHeaderState({});
  }, []);

  return (
    <PageHeaderContext.Provider value={{ header, setHeader, resetHeader }}>
      {children}
    </PageHeaderContext.Provider>
  );
}

export function usePageHeader() {
  const context = useContext(PageHeaderContext);
  if (!context) {
    throw new Error('usePageHeader must be used within a PageHeaderProvider');
  }
  return context;
}