import { useEffect } from 'react';
import { useLocation } from 'wouter';

/**
 * Custom hook that automatically resets scroll position to top
 * whenever the route changes
 */
export function useScrollReset() {
  const [location] = useLocation();
  
  useEffect(() => {
    // Scroll to top whenever location changes
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  }, [location]);
}