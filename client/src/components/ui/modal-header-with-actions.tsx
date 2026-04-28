import { ReactNode } from 'react';
import { DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface ModalHeaderWithActionsProps {
  title: string;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
  titleClassName?: string;
}

export function ModalHeaderWithActions({
  title,
  icon,
  actions,
  className,
  titleClassName,
}: ModalHeaderWithActionsProps) {
  return (
    <DialogHeader className={cn('px-3 md:px-4 py-2 md:py-3 border-b flex-shrink-0 !space-y-0 !text-left', className)}>
      <div className="flex min-h-8 items-center justify-between gap-3">
        <DialogTitle className={cn('truncate flex items-center gap-2 leading-none', titleClassName)}>
          {icon}
          {title}
        </DialogTitle>
        {actions ? (
          <div className="flex items-center gap-1.5 flex-shrink-0 self-center">
            {actions}
          </div>
        ) : null}
      </div>
    </DialogHeader>
  );
}
