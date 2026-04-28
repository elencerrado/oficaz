import { useCallback, useEffect, useMemo, useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

interface UseIncrementalListOptions<T> {
  items: T[];
  mobileInitialCount: number;
  desktopInitialCount: number;
  mobileStep?: number;
  desktopStep?: number;
  resetKey?: string | number;
}

export function useIncrementalList<T>({
  items,
  mobileInitialCount,
  desktopInitialCount,
  mobileStep,
  desktopStep,
  resetKey,
}: UseIncrementalListOptions<T>) {
  const isMobile = useIsMobile();
  const initialCount = isMobile ? mobileInitialCount : desktopInitialCount;
  const step = isMobile ? (mobileStep ?? mobileInitialCount) : (desktopStep ?? desktopInitialCount);

  const [displayedCount, setDisplayedCount] = useState(initialCount);

  useEffect(() => {
    setDisplayedCount(initialCount);
  }, [initialCount, resetKey]);

  const visibleItems = useMemo(() => items.slice(0, displayedCount), [items, displayedCount]);
  const hasMore = displayedCount < items.length;

  const loadMore = useCallback(() => {
    setDisplayedCount((prev) => Math.min(prev + step, items.length));
  }, [step, items.length]);

  return {
    displayedCount,
    setDisplayedCount,
    visibleItems,
    hasMore,
    loadMore,
    initialCount,
    totalCount: items.length,
  };
}
