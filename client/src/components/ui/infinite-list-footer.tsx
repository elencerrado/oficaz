import { RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';

type InfiniteListFooterProps = {
  hasMore: boolean;
  onLoadMore: () => void;
  sentinelRef?: RefObject<HTMLDivElement | null>;
  isLoading?: boolean;
  loadingText?: string;
  hintText?: string;
  doneText?: string;
  buttonText?: string;
  className?: string;
  textClassName?: string;
  showButton?: boolean;
};

export function InfiniteListFooter({
  hasMore,
  onLoadMore,
  sentinelRef,
  isLoading = false,
  loadingText = 'Cargando más elementos...',
  hintText = 'Desplaza para cargar más',
  doneText,
  buttonText = 'Cargar más',
  className,
  textClassName,
  showButton = true,
}: InfiniteListFooterProps) {
  return (
    <div className={cn('py-3 text-center', className)}>
      {sentinelRef ? <div ref={sentinelRef as RefObject<HTMLDivElement>} className="h-px w-full" /> : null}

      {hasMore ? (
        <div className={cn('mt-2 flex flex-col items-center gap-2 text-sm text-muted-foreground', textClassName)}>
          {isLoading ? (
            <div className="flex items-center gap-2">
              <LoadingSpinner size="sm" />
              <span>{loadingText}</span>
            </div>
          ) : (
            <span>{hintText}</span>
          )}

          {showButton && !isLoading ? (
            <Button type="button" variant="outline" size="sm" onClick={onLoadMore}>
              {buttonText}
            </Button>
          ) : null}
        </div>
      ) : doneText ? (
        <span className={cn('text-sm text-muted-foreground', textClassName)}>{doneText}</span>
      ) : null}
    </div>
  );
}
