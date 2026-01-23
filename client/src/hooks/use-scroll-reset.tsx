import { useEffect } from 'react';
import { useLocation } from 'wouter';

/**
 * Custom hook that automatically resets scroll position to top
 * whenever the route changes
 */
export function useScrollReset() {
  const [location] = useLocation();
  
  useEffect(() => {
    // Use longer delay to ensure DOM is fully rendered and stable
    const timer = setTimeout(() => {
      // Scroll main window
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      
      // Reset all overflow-y-auto EXCEPT sidebar (nav element with data-preserve-scroll)
      const scrollableElements = document.querySelectorAll('.overflow-y-auto, [data-scroll-container]');
      
      scrollableElements.forEach(element => {
        if (element instanceof HTMLElement) {
          // Skip sidebar - it has data-preserve-scroll attribute
          if (element.hasAttribute('data-preserve-scroll')) {
            return;
          }
          // Skip nav elements (sidebar)
          if (element.tagName === 'NAV') {
            return;
          }
          element.scrollTop = 0;
        }
      });
      
      // Reset document body scroll as well
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;
    }, 50);
    
    return () => clearTimeout(timer);
  }, [location]);
}