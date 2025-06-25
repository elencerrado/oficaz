import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { X, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, isToday, isTomorrow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '@/hooks/use-auth';

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
  const { user, token, isLoading: authLoading } = useAuth();
  const isAuthenticated = !!(user && token);

  // Fetch active reminders with optimized settings for real-time detection
  const { data: activeReminders = [], isLoading, error } = useQuery({
    queryKey: ['/api/reminders/active'],
    refetchInterval: isAuthenticated ? 3000 : false, // Only poll if authenticated, every 3 seconds
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: false, // Don't retry to avoid auth error spam
    enabled: isAuthenticated && !authLoading, // Only run if authenticated
    refetchIntervalInBackground: false
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

  // Mark reminder as completed mutation
  const markAsCompletedMutation = useMutation({
    mutationFn: async (reminderId: number) => {
      return await apiRequest('PATCH', `/api/reminders/${reminderId}`, {
        status: 'completed'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reminders/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reminders'] });
    },
  });

  // Don't render anything if not authenticated or still loading auth
  if (authLoading || !isAuthenticated) {
    return null;
  }

  if (isLoading) {
    return null;
  }

  if (error) {
    // Silently fail for authentication errors to avoid console spam
    return null;
  }

  // Filter out dismissed reminders - safely handle null/undefined activeReminders
  const visibleReminders = (activeReminders || []).filter(
    (reminder: ActiveReminder) => !dismissedReminders.includes(reminder.id)
  );
  
  const dismissReminder = (reminderId: number) => {
    setDismissedReminders(prev => [...prev, reminderId]);
    markAsShownMutation.mutate(reminderId);
  };

  const completeReminder = (reminderId: number) => {
    setDismissedReminders(prev => [...prev, reminderId]);
    markAsCompletedMutation.mutate(reminderId);
  };

  const formatReminderDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) return 'Hoy';
    if (isTomorrow(date)) return 'Mañana';
    return format(date, 'dd/MM/yyyy HH:mm', { locale: es });
  };

  // Format just the time for display in column layout
  const formatReminderTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return `Hoy ${date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    return date.toLocaleDateString('es-ES', { 
      day: 'numeric', 
      month: 'short'
    }) + ` ${date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
  };


  if (!visibleReminders || visibleReminders.length === 0) {
    return null;
  }

  const firstReminder = visibleReminders[0];
  if (!firstReminder) {
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
        right: '20px',
        backgroundColor: '#ffffff',
        color: '#1a1a1a',
        padding: '0px',
        borderRadius: '16px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.1)',
        zIndex: 9999,
        width: '420px',
        maxWidth: 'calc(100vw - 40px)',
        fontSize: '14px',
        fontWeight: '500',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        animation: 'slideInRight 0.4s ease-out'
      }}
    >
      {/* Contenido con layout de 3 columnas */}
      <div style={{ 
        padding: '20px 24px', 
        display: 'grid', 
        gridTemplateColumns: '1fr 2fr auto',
        gap: '20px',
        alignItems: 'start'
      }}>
        {/* Columna 1: Título y fecha/hora */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div 
            style={{ 
              backgroundColor: firstReminder.color || '#6366f1',
              borderRadius: '50%',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <PriorityIcon style={{ width: '16px', height: '16px', color: '#ffffff' }} />
          </div>
          <div>
            <div style={{ 
              fontSize: '15px', 
              fontWeight: '700', 
              color: '#1f2937',
              marginBottom: '4px',
              lineHeight: '1.2'
            }}>
              {firstReminder.title}
            </div>
            {firstReminder.reminderDate && (
              <div style={{ 
                fontSize: '12px', 
                color: '#6b7280', 
                fontWeight: '500'
              }}>
                {formatReminderTime(firstReminder.reminderDate)}
              </div>
            )}
          </div>
        </div>
        
        {/* Columna 2: Contenido del recordatorio */}
        <div>
          {firstReminder.content && (
            <div style={{ 
              fontSize: '14px', 
              color: '#374151', 
              lineHeight: '1.5',
              fontWeight: '400'
            }}>
              {firstReminder.content}
            </div>
          )}
        </div>
        
        {/* Columna 3: Botones de acción */}
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => completeReminder(firstReminder.id)}
            style={{ 
              backgroundColor: '#059669',
              color: '#ffffff',
              padding: '8px 14px',
              fontSize: '12px',
              fontWeight: '600',
              border: 'none',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              boxShadow: '0 1px 3px rgba(5, 150, 105, 0.3)',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#047857';
              e.target.style.transform = 'translateY(-1px)';
              e.target.style.boxShadow = '0 2px 6px rgba(5, 150, 105, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = '#059669';
              e.target.style.transform = 'translateY(0px)';
              e.target.style.boxShadow = '0 1px 3px rgba(5, 150, 105, 0.3)';
            }}
          >
            <CheckCircle style={{ width: '14px', height: '14px' }} />
            Hecho
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => dismissReminder(firstReminder.id)}
            style={{ 
              backgroundColor: '#f3f4f6',
              color: '#6b7280',
              padding: '8px 10px',
              fontSize: '12px',
              fontWeight: '600',
              border: 'none',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#e5e7eb';
              e.target.style.color = '#374151';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = '#f3f4f6';
              e.target.style.color = '#6b7280';
            }}
          >
            <X style={{ width: '14px', height: '14px' }} />
          </Button>
        </div>
      </div>
    </div>
  );
}