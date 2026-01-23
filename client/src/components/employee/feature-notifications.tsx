import { Button } from '@/components/ui/button';
import { Bell, MessageSquare, FileText, Palmtree } from 'lucide-react';

export interface FeatureNotificationsProps {
  hasVacationUpdates: boolean;
  hasDocumentRequests: boolean;
  hasNewDocuments: boolean;
  hasUnsignedDocuments: boolean;
  unreadCount: number;
  onVacationClick: () => void;
  onDocumentsClick: () => void;
  onMessagesClick: () => void;
}

export function FeatureNotifications({
  hasVacationUpdates,
  hasDocumentRequests,
  hasNewDocuments,
  hasUnsignedDocuments,
  unreadCount,
  onVacationClick,
  onDocumentsClick,
  onMessagesClick,
}: FeatureNotificationsProps) {
  return (
    <div className="grid grid-cols-2 gap-2 mb-4">
      {/* Vacation Updates */}
      <Button
        onClick={onVacationClick}
        variant="outline"
        className={`flex items-center gap-2 h-auto py-3 text-xs transition-all ${
          hasVacationUpdates
            ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/30'
            : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
        }`}
      >
        <Palmtree className="h-4 w-4" />
        <span>Vacaciones</span>
        {hasVacationUpdates && <span className="ml-auto animate-pulse text-amber-600 dark:text-amber-400">•</span>}
      </Button>

      {/* Document Requests */}
      <Button
        onClick={onDocumentsClick}
        variant="outline"
        className={`flex items-center gap-2 h-auto py-3 text-xs transition-all ${
          hasDocumentRequests || hasNewDocuments || hasUnsignedDocuments
            ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-900 dark:text-cyan-200 hover:bg-cyan-100 dark:hover:bg-cyan-900/30'
            : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
        }`}
      >
        <FileText className="h-4 w-4" />
        <span>Documentos</span>
        {(hasDocumentRequests || hasNewDocuments || hasUnsignedDocuments) && (
          <span className="ml-auto animate-pulse text-cyan-600 dark:text-cyan-400">•</span>
        )}
      </Button>

      {/* Messages */}
      <Button
        onClick={onMessagesClick}
        variant="outline"
        className={`flex items-center gap-2 h-auto py-3 text-xs transition-all col-span-2 ${
          unreadCount > 0
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/30'
            : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
        }`}
      >
        <MessageSquare className="h-4 w-4" />
        <span>Mensajes</span>
        {unreadCount > 0 && (
          <>
            <span className="ml-auto flex items-center gap-1">
              <span className="animate-pulse text-blue-600 dark:text-blue-400">•</span>
              <span className="font-medium">{unreadCount}</span>
            </span>
          </>
        )}
      </Button>
    </div>
  );
}
