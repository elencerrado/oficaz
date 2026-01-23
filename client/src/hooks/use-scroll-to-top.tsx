import { useEffect } from 'react';

/**
 * Hook to scroll to top when component mounts
 * Useful for page components to ensure they start at the top
 */
export function useScrollToTop() {
  useEffect(() => {
    // Use setTimeout to ensure DOM has updated before scrolling
    const timer = setTimeout(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }, 0);

    return () => clearTimeout(timer);
  }, []);
}
