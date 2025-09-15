import { createContext, useContext, useState, ReactNode } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

interface SidebarContextType {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  shouldShowHeader: boolean; // true when header should be visible
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  // Logic: Show header when sidebar is hidden
  // Desktop: sidebar always visible → header always hidden
  // Mobile: sidebar visible when open → header visible when closed
  const shouldShowHeader = isMobile && !isSidebarOpen;

  return (
    <SidebarContext.Provider value={{ 
      isSidebarOpen, 
      setIsSidebarOpen, 
      shouldShowHeader 
    }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebarState() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebarState must be used within a SidebarProvider');
  }
  return context;
}