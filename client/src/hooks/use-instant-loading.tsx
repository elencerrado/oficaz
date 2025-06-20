import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { InstantLoading } from '@/components/ui/instant-loading';

export function useInstantLoading() {
  const [location] = useLocation();
  const [isNavigating, setIsNavigating] = useState(false);
  const [prevLocation, setPrevLocation] = useState(location);

  useEffect(() => {
    if (location !== prevLocation) {
      setIsNavigating(true);
      setPrevLocation(location);
      
      // Hide loading after brief moment to let page render
      const timer = setTimeout(() => {
        setIsNavigating(false);
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [location, prevLocation]);

  return { isNavigating, LoadingComponent: InstantLoading };
}