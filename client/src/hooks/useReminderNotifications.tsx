import { useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { CheckCircle2, X } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { getMadridTimeString } from '@/utils/dateUtils';

interface ReminderNotification {
  id: number;
  title: string;
  content?: string;
  reminderDate: string;
  priority: 'low' | 'medium' | 'high';
  color: string;
}

export function useReminderNotifications() {
  const shownNotifications = useRef(new Set<number>());
  const { toast, dismiss } = useToast();
  
  // Mutation to mark reminder as completed
  const completeMutation = useMutation({
    mutationFn: async (reminderId: number) => {
      return apiRequest('PATCH', `/api/reminders/${reminderId}`, { isCompleted: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reminders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reminders/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reminders/check-notifications'] });
    },
  });
  
  // Check for due notifications every 30 seconds
  const { data: remindersDue = [] } = useQuery<ReminderNotification[]>({
    queryKey: ['/api/reminders/check-notifications'],
    refetchInterval: 30000, // Check every 30 seconds
    refetchIntervalInBackground: true, // Keep checking in background
    refetchOnWindowFocus: true, // Check when window gets focus
  });

  useEffect(() => {
    // Show toast for new notifications
    remindersDue.forEach((reminder) => {
      if (!shownNotifications.current.has(reminder.id)) {
        shownNotifications.current.add(reminder.id);
        
        const priorityText = reminder.priority === 'high' ? 'Alta' :
                            reminder.priority === 'medium' ? 'Media' : 'Baja';
        
        const timeString = getMadridTimeString(reminder.reminderDate);
        
        const description = `${reminder.content ? reminder.content + ' | ' : ''}Prioridad: ${priorityText} | Hora: ${timeString}`;
        
        // Show toast notification with action buttons
        const toastId = `reminder-${reminder.id}`;
        toast({
          title: `📅 ${reminder.title}`,
          description: description,
          duration: Infinity, // Don't auto-dismiss
          action: (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="default"
                onClick={(e) => {
                  e.preventDefault();
                  completeMutation.mutate(reminder.id);
                  dismiss(toastId);
                }}
                data-testid={`button-complete-reminder-${reminder.id}`}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Completar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.preventDefault();
                  dismiss(toastId);
                }}
                data-testid={`button-dismiss-reminder-${reminder.id}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ),
        });
        
        // Mark notification as shown on the server
        markNotificationShown(reminder.id);
      }
    });
  }, [remindersDue, toast, dismiss, completeMutation]);
  
  // Function to mark notification as shown on server
  const markNotificationShown = async (reminderId: number) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/reminders/${reminderId}/mark-notification-shown`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
    } catch (error) {
      console.error('Error marking notification as shown:', error);
    }
  };
}
