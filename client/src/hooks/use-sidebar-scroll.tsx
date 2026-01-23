import { createContext, useContext, useRef, useCallback, useEffect } from 'react';

interface SidebarScrollContextType {
  scrollPosition: number;
  setScrollPosition: (position: number) => void;
  applyScroll: (element: HTMLElement | null) => void;
  saveScroll: (element: HTMLElement | null) => void;
}

const SidebarScrollContext = createContext<SidebarScrollContextType | undefined>(undefined);

// Global scroll state that persists across re-renders
let globalSidebarScroll = 0;

export function SidebarScrollProvider({ children }: { children: React.ReactNode }) {
  const scrollPositionRef = useRef(0);

  const setScrollPosition = useCallback((position: number) => {
    scrollPositionRef.current = position;
    globalSidebarScroll = position;
  }, []);

  const applyScroll = useCallback((element: HTMLElement | null) => {
    if (!element) return;
    
    // Apply immediately
    element.scrollTop = scrollPositionRef.current;
    
    // Also apply after next frame to handle async renders
    requestAnimationFrame(() => {
      element.scrollTop = scrollPositionRef.current;
    });
  }, []);

  const saveScroll = useCallback((element: HTMLElement | null) => {
    if (!element) return;
    setScrollPosition(element.scrollTop);
  }, [setScrollPosition]);

  const value: SidebarScrollContextType = {
    scrollPosition: scrollPositionRef.current,
    setScrollPosition,
    applyScroll,
    saveScroll,
  };

  return (
    <SidebarScrollContext.Provider value={value}>
      {children}
    </SidebarScrollContext.Provider>
  );
}

export function useSidebarScroll() {
  const context = useContext(SidebarScrollContext);
  if (!context) {
    throw new Error('useSidebarScroll must be used within SidebarScrollProvider');
  }
  return context;
}
