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
  console.log('ReminderBanner component initializing...');
  const [dismissedReminders, setDismissedReminders] = useState<number[]>([]);
  const queryClient = useQueryClient();

  // Fetch active reminders
  const { data: activeReminders = [], isLoading, error } = useQuery({
    queryKey: ['/api/reminders/active'],
    refetchInterval: 2000, // Check every 2 seconds for immediate detection
    staleTime: 0, // Always consider data stale
    gcTime: 0, // Don't cache results
    refetchOnMount: true,
    refetchOnWindowFocus: true,
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

  // Filter out dismissed reminders - safely handle null/undefined activeReminders
  const visibleReminders = (activeReminders || []).filter(
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


  
  console.log('ReminderBanner - Rendering banner with', visibleReminders?.length || 0, 'reminders');
  console.log('ReminderBanner - Active reminders from query:', activeReminders);
  console.log('ReminderBanner - Dismissed reminders:', dismissedReminders);

  if (!visibleReminders || visibleReminders.length === 0) {
    console.log('ReminderBanner - No visible reminders, returning null');
    return null;
  }

  const firstReminder = visibleReminders[0];
  if (!firstReminder) {
    console.log('ReminderBanner - No first reminder found, returning null');
    return null;
  }
  
  const PriorityIcon = PRIORITY_ICONS[firstReminder.priority] || PRIORITY_ICONS.medium;
  
  // Determinar color de texto basado en color de fondo
  const isLightColor = (color: string) => {
    if (!color || typeof color !== 'string') return false;
    const lightColors = ['#ffffff', '#ffeb3b', '#d1ecf1', '#e8f5e9', '#fff3e0', '#f3e5f5'];
    return lightColors.includes(color) || 
           (color.startsWith('#') && color.length === 7 &&
            parseInt(color.slice(1, 3), 16) + parseInt(color.slice(3, 5), 16) + parseInt(color.slice(5, 7), 16) > 400);
  };

  const textColor = isLightColor(firstReminder.color) ? '#000000' : '#ffffff';
  const borderColor = isLightColor(firstReminder.color) ? '#e2e8f0' : 'rgba(255,255,255,0.3)';

  return (
    <div 
      style={{ 
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: firstReminder.color || '#ff6b35',
        color: textColor,
        padding: '12px 20px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 9999,
        maxWidth: '90vw',
        width: 'auto',
        minWidth: '300px',
        textAlign: 'center',
        fontSize: '14px',
        fontWeight: '500',
        border: `2px solid ${borderColor}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1' }}>
        <PriorityIcon style={{ width: '16px', height: '16px', color: textColor }} />
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontWeight: '600', marginBottom: '2px' }}>
            {firstReminder.title}
          </div>
          {firstReminder.content && (
            <div style={{ fontSize: '12px', opacity: '0.8' }}>
              {firstReminder.content}
            </div>
          )}
        </div>
      </div>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={() => dismissReminder(firstReminder.id)}
        style={{ 
          color: textColor, 
          padding: '4px 8px',
          fontSize: '12px',
          backgroundColor: 'transparent',
          border: `1px solid ${textColor}`,
          borderRadius: '4px'
        }}
      >
        <X style={{ width: '14px', height: '14px' }} />
      </Button>
    </div>
  );
}