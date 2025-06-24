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
  const { data: activeReminders = [], isLoading, error } = useQuery({
    queryKey: ['/api/reminders/active'],
    queryFn: async () => {
      const response = await fetch('/api/reminders/active');
      if (!response.ok) {
        console.log('Reminder fetch failed:', response.status, response.statusText);
        return [];
      }
      return response.json();
    },
    refetchInterval: 3000, // Check every 3 seconds for immediate testing
    retry: false,
    enabled: true // Ensure query runs even if other queries might be disabled
  });

  console.log('ReminderBanner - Query result:', { 
    activeReminders, 
    isLoading, 
    error: error?.message,
    count: activeReminders?.length,
    timestamp: new Date().toLocaleTimeString(),
    madridTime: new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })
  });
  console.log('ReminderBanner - Dismissed reminders:', dismissedReminders);

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

  if (isLoading) {
    return null;
  }

  if (error) {
    console.error('ReminderBanner - Error fetching active reminders:', error);
    return null;
  }

  // Filter out dismissed reminders
  const visibleReminders = activeReminders.filter(
    (reminder: ActiveReminder) => !dismissedReminders.includes(reminder.id)
  );
  
  console.log('ReminderBanner - Visible reminders:', visibleReminders);

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
    console.log('ReminderBanner - No visible reminders, returning null');
    return null;
  }
  
  console.log('ReminderBanner - Rendering banner with', visibleReminders.length, 'reminders');

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-red-500 text-white p-4 shadow-lg">
      <div className="max-w-7xl mx-auto">
        {visibleReminders.map((reminder: ActiveReminder) => {
          const PriorityIcon = PRIORITY_ICONS[reminder.priority];
          
          return (
            <div
              key={reminder.id}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <PriorityIcon className="w-5 h-5 text-white" />
                <div className="flex-1">
                  <h4 className="font-semibold text-white">
                    {reminder.title}
                  </h4>
                  {reminder.content && (
                    <p className="text-red-100 text-sm">
                      {reminder.content}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-red-100 text-sm font-medium">
                  {reminder.priority === 'high' ? 'ALTA PRIORIDAD' : 
                   reminder.priority === 'medium' ? 'MEDIA PRIORIDAD' : 'BAJA PRIORIDAD'}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => dismissReminder(reminder.id)}
                  className="h-8 w-8 p-0 hover:bg-red-600 text-white"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}