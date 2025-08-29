import { useEffect } from 'react';
import { useLocation } from 'wouter';

/**
 * Custom hook that automatically resets scroll position to top
 * whenever the route changes
 */
export function useScrollReset() {
  const [location] = useLocation();
  
  useEffect(() => {
    console.log('🔄 Scroll reset triggered for location:', location);
    
    // Use setTimeout to ensure DOM is fully rendered before scrolling
    const timer = setTimeout(() => {
      console.log('📍 Executing scroll reset...');
      
      // Scroll main window
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      
      // Also scroll any potential scrollable containers
      const scrollableElements = document.querySelectorAll('[data-scroll-container], .overflow-auto, .overflow-y-auto, main');
      console.log('📍 Found scrollable elements:', scrollableElements.length);
      
      scrollableElements.forEach(element => {
        if (element instanceof HTMLElement) {
          element.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        }
      });
      
      // Reset document body scroll as well
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;
      
      console.log('✅ Scroll reset completed');
    }, 0);
    
    return () => clearTimeout(timer);
  }, [location]);
}