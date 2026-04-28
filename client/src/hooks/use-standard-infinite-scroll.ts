import { useEffect, type RefObject } from 'react';

type InfiniteScrollOptions = {
  targetRef: RefObject<Element | null>;
  enabled: boolean;
  canLoadMore: boolean;
  isLoadingMore?: boolean;
  onLoadMore: () => void;
  dependencyKey?: string | number;
  rootRef?: RefObject<Element | null>;
  threshold?: number;
  rootMargin?: string;
};

function findScrollableParent(element: Element | null): Element | null {
  let parent = element?.parentElement ?? null;

  while (parent) {
    const styles = window.getComputedStyle(parent);
    const overflowY = styles.overflowY;
    const canScroll = overflowY === 'auto' || overflowY === 'scroll';

    if (canScroll && parent.scrollHeight > parent.clientHeight) {
      return parent;
    }

    parent = parent.parentElement;
  }

  return null;
}

export function useStandardInfiniteScroll({
  targetRef,
  enabled,
  canLoadMore,
  isLoadingMore = false,
  onLoadMore,
  dependencyKey,
  rootRef,
  threshold = 0.1,
  rootMargin = '120px',
}: InfiniteScrollOptions) {
  useEffect(() => {
    const target = targetRef.current;

    if (!enabled || !target || !canLoadMore || isLoadingMore) {
      return;
    }

    let frameRequest = 0;
    let queued = false;

    const queueLoadMore = () => {
      if (queued) return;
      queued = true;

      frameRequest = window.requestAnimationFrame(() => {
        queued = false;
        onLoadMore();
      });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          queueLoadMore();
        }
      },
      {
        root: rootRef?.current ?? findScrollableParent(target),
        threshold,
        rootMargin,
      }
    );

    observer.observe(target);

    return () => {
      if (frameRequest) {
        window.cancelAnimationFrame(frameRequest);
      }
      observer.disconnect();
    };
  }, [
    targetRef,
    enabled,
    canLoadMore,
    isLoadingMore,
    onLoadMore,
    dependencyKey,
    rootRef,
    threshold,
    rootMargin,
  ]);
}
