import * as React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ModalActionIntent = 'save' | 'delete' | 'edit' | 'download' | 'neutral';

interface ModalActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  intent?: ModalActionIntent;
  title: string;
  children: React.ReactNode;
}

const INTENT_STYLES: Record<ModalActionIntent, string> = {
  save: 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-300',
  delete: 'text-red-600 dark:text-red-400 hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300',
  edit: 'text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 hover:text-orange-700 dark:hover:text-orange-300',
  download: 'text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 hover:text-blue-700 dark:hover:text-blue-300',
  neutral: 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-500/10 hover:text-zinc-700 dark:hover:text-zinc-200',
};

export function ModalActionButton({
  intent = 'neutral',
  title,
  className,
  children,
  ...props
}: ModalActionButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      title={title}
      className={cn(
        'h-8 w-8 p-0 rounded-xl border-black/25 dark:border-white/15 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-sm shadow-none hover:border-black/35 dark:hover:border-white/25 hover:shadow-none [&_svg]:h-4 [&_svg]:w-4',
        INTENT_STYLES[intent],
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  );
}
