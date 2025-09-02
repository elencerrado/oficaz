import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { BellRing } from 'lucide-react';

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
  const { toast } = useToast();
  
  // Check for due notifications every minute
  const { data: remindersDue = [] } = useQuery<ReminderNotification[]>({
    queryKey: ['/api/reminders/check-notifications'],
    refetchInterval: 60000, // Check every minute
    refetchIntervalInBackground: true, // Keep checking even when tab is not active
    refetchOnWindowFocus: true, // Check when window gets focus
  });

  useEffect(() => {
    // Show toast for new notifications
    remindersDue.forEach((reminder) => {
      if (!shownNotifications.current.has(reminder.id)) {
        shownNotifications.current.add(reminder.id);
        
        const priorityText = reminder.priority === 'high' ? 'Alta' :
                            reminder.priority === 'medium' ? 'Media' : 'Baja';
        
        const reminderDate = new Date(reminder.reminderDate);
        const timeString = reminderDate.toLocaleTimeString('es-ES', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        
        const description = `${reminder.content ? reminder.content + ' | ' : ''}Prioridad: ${priorityText} | Hora: ${timeString}`;
        
        // Show toast notification
        toast({
          title: `📅 ${reminder.title}`,
          description: description,
        });
        
        // Mark notification as shown on the server
        markNotificationShown(reminder.id);
      }
    });
  }, [remindersDue, toast]);

  // Function to mark notification as shown
  const markNotificationShown = async (reminderId: number) => {
    try {
      await fetch(`/api/reminders/${reminderId}/mark-notification-shown`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
    } catch (error) {
      console.error('Error marking notification as shown:', error);
    }
  };
}