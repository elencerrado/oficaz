import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { X, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, isToday, isTomorrow } from 'date-fns';
import { es } from 'date-fns/locale';

interface ActiveReminder {
  id: number;
  title: string;
  content?: string;
  reminderDate?: string;
  priority: 'low' | 'medium' | 'high';
  color: string;
}

const PRIORITY_COLORS = {
  low: 'bg-green-100 text-green-800 border-green-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  high: 'bg-red-100 text-red-800 border-red-200'
};

const PRIORITY_ICONS = {
  low: CheckCircle,
  medium: Clock,
  high: AlertCircle
};

export function ReminderBanner() {
  const [dismissedReminders, setDismissedReminders] = useState<number[]>([]);
  const queryClient = useQueryClient();

  // Fetch active reminders
  const { data: activeReminders = [] } = useQuery({
    queryKey: ['/api/reminders/active'],
    refetchInterval: 60000, // Check every minute
  });

  // Mark reminder as shown mutation
  const markAsShownMutation = useMutation({
    mutationFn: async (reminderId: number) => {
      return await apiRequest('PATCH', `/api/reminders/${reminderId}`, {
        notificationShown: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reminders/active'] });
    },
  });

  // Filter out dismissed reminders
  const visibleReminders = activeReminders.filter(
    (reminder: ActiveReminder) => !dismissedReminders.includes(reminder.id)
  );

  const dismissReminder = (reminderId: number) => {
    setDismissedReminders(prev => [...prev, reminderId]);
    markAsShownMutation.mutate(reminderId);
  };

  const formatReminderDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) return 'Hoy';
    if (isTomorrow(date)) return 'Mañana';
    return format(date, 'dd/MM/yyyy HH:mm', { locale: es });
  };

  if (visibleReminders.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-3 max-w-sm">
      {visibleReminders.map((reminder: ActiveReminder) => {
        const PriorityIcon = PRIORITY_ICONS[reminder.priority];
        
        return (
          <div
            key={reminder.id}
            className={`
              rounded-lg border shadow-lg p-4 animate-in slide-in-from-bottom-2 duration-300
              ${PRIORITY_COLORS[reminder.priority]}
            `}
            style={{ backgroundColor: reminder.color !== '#ffffff' ? reminder.color : undefined }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 flex-1">
                <PriorityIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate">
                    {reminder.title}
                  </h4>
                  {reminder.content && (
                    <p className="text-xs mt-1 line-clamp-2 opacity-90">
                      {reminder.content}
                    </p>
                  )}
                  {reminder.reminderDate && (
                    <div className="flex items-center gap-1 mt-2">
                      <Clock className="w-3 h-3" />
                      <span className="text-xs font-medium">
                        {formatReminderDate(reminder.reminderDate)}
                      </span>
                    </div>
                  )}
                  <Badge 
                    variant="secondary" 
                    className="text-xs mt-2"
                  >
                    {reminder.priority === 'high' ? 'Alta' : 
                     reminder.priority === 'medium' ? 'Media' : 'Baja'}
                  </Badge>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dismissReminder(reminder.id)}
                className="h-6 w-6 p-0 hover:bg-black/10"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}