import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { X, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, isToday, isTomorrow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '@/hooks/use-auth';

// Hook para detectar si estamos en móvil
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkSize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  return isMobile;
};

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
  const isMobile = useIsMobile();

  // Fetch active reminders with reduced polling for better performance
  const { data: activeReminders = [], isLoading, error } = useQuery({
    queryKey: ['/api/reminders/active'],
    refetchInterval: isAuthenticated ? 30000 : false, // Poll every 30 seconds instead of 3
    staleTime: 25000, // Cache for 25 seconds
    gcTime: 60000, // Keep in cache for 1 minute
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
        isCompleted: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reminders/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reminders'] });
    },
    onError: (error) => {
      console.error('Error marking reminder as completed:', error);
    }
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
    // Immediately hide the banner while the request processes
    setDismissedReminders(prev => [...prev, reminderId]);
    // Mark as completed in the database
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
        right: isMobile ? '4px' : '20px',
        left: isMobile ? '4px' : 'auto',
        backgroundColor: '#ffffff',
        color: '#1a1a1a',
        padding: '0px',
        borderRadius: '16px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.1)',
        zIndex: 9999,
        minWidth: isMobile ? 'auto' : '480px',
        maxWidth: isMobile ? 'calc(100vw - 8px)' : 'min(70vw, calc(100vw - 40px))',
        width: isMobile ? 'auto' : 'fit-content',
        fontSize: '14px',
        fontWeight: '500',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        animation: 'slideInRight 0.4s ease-out'
      }}
    >
      {/* Contenido responsive */}
      <div style={{ 
        padding: isMobile ? '8px' : '20px 24px', 
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'flex-start',
        gap: isMobile ? '6px' : '20px',
        width: '100%',
        boxSizing: 'border-box',
        maxWidth: isMobile ? '100vw' : 'none',
        overflow: 'hidden'
      }}>
        {/* Header: Título y fecha/hora */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: isMobile ? '8px' : '12px',
          flexBasis: isMobile ? 'auto' : '200px',
          flexShrink: 0
        }}>
          <div 
            style={{ 
              backgroundColor: firstReminder.color || '#6366f1',
              borderRadius: '50%',
              padding: isMobile ? '4px' : '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <PriorityIcon style={{ 
              width: isMobile ? '12px' : '16px', 
              height: isMobile ? '12px' : '16px', 
              color: '#ffffff' 
            }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ 
              fontSize: isMobile ? '11px' : '15px', 
              fontWeight: '700', 
              color: '#1f2937',
              marginBottom: '1px',
              lineHeight: '1.1'
            }}>
              {firstReminder.title}
            </div>
            {firstReminder.reminderDate && (
              <div style={{ 
                fontSize: isMobile ? '9px' : '12px', 
                color: '#6b7280', 
                fontWeight: '500'
              }}>
                {formatReminderTime(firstReminder.reminderDate)}
              </div>
            )}
          </div>
        </div>
        
        {/* Contenido del recordatorio */}
        <div style={{ 
          minWidth: '0', 
          wordWrap: 'break-word',
          flex: '1',
          marginRight: isMobile ? '0' : '16px',
          order: isMobile ? 2 : 1
        }}>
          {firstReminder.content && (
            <div style={{ 
              fontSize: isMobile ? '10px' : '14px', 
              color: '#374151', 
              lineHeight: isMobile ? '1.2' : '1.6',
              fontWeight: '400',
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
              hyphens: 'auto',
              maxHeight: isMobile ? '30px' : 'none',
              overflow: isMobile ? 'hidden' : 'visible'
            }}>
              {firstReminder.content}
            </div>
          )}
        </div>
        
        {/* Botones de acción */}
        <div style={{ 
          display: 'flex', 
          gap: isMobile ? '4px' : '8px', 
          flexShrink: 0,
          alignSelf: isMobile ? 'stretch' : 'flex-start',
          justifyContent: isMobile ? 'flex-end' : 'flex-start',
          minWidth: isMobile ? 'auto' : '140px',
          order: isMobile ? 3 : 2
        }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => completeReminder(firstReminder.id)}
            style={{ 
              backgroundColor: '#059669',
              color: '#ffffff',
              padding: isMobile ? '1px 3px' : '8px 14px',
              fontSize: isMobile ? '7px' : '12px',
              fontWeight: '600',
              border: 'none',
              borderRadius: isMobile ? '3px' : '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: isMobile ? '1px' : '5px',
              boxShadow: '0 1px 3px rgba(5, 150, 105, 0.3)',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
              flex: isMobile ? '0 0 auto' : 'auto',
              height: isMobile ? '16px' : 'auto',
              minWidth: isMobile ? '16px' : 'auto',
              maxWidth: isMobile ? '35px' : 'auto'
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
            <CheckCircle style={{ width: isMobile ? '8px' : '14px', height: isMobile ? '8px' : '14px' }} />
            {isMobile ? 'OK' : 'Hecho'}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => dismissReminder(firstReminder.id)}
            style={{ 
              backgroundColor: '#f3f4f6',
              color: '#6b7280',
              padding: isMobile ? '1px 3px' : '8px 10px',
              fontSize: isMobile ? '7px' : '12px',
              fontWeight: '600',
              border: 'none',
              borderRadius: isMobile ? '3px' : '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              minWidth: isMobile ? '16px' : 'auto',
              height: isMobile ? '16px' : 'auto',
              maxWidth: isMobile ? '20px' : 'auto'
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
            <X style={{ 
              width: isMobile ? '8px' : '14px', 
              height: isMobile ? '8px' : '14px' 
            }} />
          </Button>
        </div>
      </div>
    </div>
  );
}