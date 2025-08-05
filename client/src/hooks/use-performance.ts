import { useCallback, useMemo, lazy } from 'react';

// Hook para memoizar funciones costosas
export function usePerformance() {
  const memoizedCallback = useCallback((fn: Function, deps: any[]) => {
    return useCallback(fn, deps);
  }, []);

  const memoizedValue = useCallback((fn: () => any, deps: any[]) => {
    return useMemo(fn, deps);
  }, []);

  // Función para lazy loading de componentes
  const lazyComponent = useCallback((importFn: () => Promise<any>) => {
    return useMemo(() => {
      const LazyComponent = lazy(importFn);
      return LazyComponent;
    }, [importFn]);
  }, []);

  return {
    memoizedCallback,
    memoizedValue,
    lazyComponent
  };
}