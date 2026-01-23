import { Inbox } from "lucide-react";

interface ListEmptyStateProps {
  title: string;
  subtitle?: string;
  className?: string;
}

export function ListEmptyState({ title, subtitle, className = "" }: ListEmptyStateProps) {
  return (
    <div className={`text-center py-12 ${className}`}>
      <div className="flex flex-col items-center justify-center space-y-2">
        <Inbox className="w-8 h-8 text-gray-400 dark:text-gray-500" />
        <div className="text-gray-600 dark:text-gray-400 font-medium">
          {title}
        </div>
        {subtitle && (
          <div className="text-gray-500 dark:text-gray-500 text-sm">
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
