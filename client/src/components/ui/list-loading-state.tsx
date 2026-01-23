import { LoadingSpinner } from "./loading-spinner";

interface ListLoadingStateProps {
  message: string;
  className?: string;
}

export function ListLoadingState({ message, className = "" }: ListLoadingStateProps) {
  return (
    <div className={`text-center py-12 ${className}`}>
      <div className="flex flex-col items-center justify-center space-y-3">
        <LoadingSpinner size="md" color="gray" />
        <div className="text-gray-500 dark:text-gray-400 font-medium">
          Cargando {message}...
        </div>
      </div>
    </div>
  );
}
