import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { X, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, isToday, isTomorrow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '@/hooks/use-auth';
import { getMadridDate, getMadridTimeString, formatInMadridTime } from '@/utils/dateUtils';

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

  // Fetch reminders with notifications enabled only 
  const { data: activeReminders = [], isLoading, error } = useQuery({
    queryKey: ['/api/reminders/check-notifications'],
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
  const visibleReminders = (Array.isArray(activeReminders) ? activeReminders : []).filter(
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
    const date = getMadridDate(dateString);
    if (isToday(date)) return 'Hoy';
    if (isTomorrow(date)) return 'Mañana';
    return formatInMadridTime(dateString, 'dd/MM/yyyy HH:mm');
  };

  // Format just the time for display in column layout
  const formatReminderTime = (dateString: string) => {
    const date = getMadridDate(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return `Hoy ${getMadridTimeString(dateString)}`;
    }
    
    // Format date in Madrid timezone
    const dateFormatter = new Intl.DateTimeFormat('es-ES', {
      timeZone: 'Europe/Madrid',
      day: 'numeric',
      month: 'short'
    });
    
    return `${dateFormatter.format(date)} ${getMadridTimeString(dateString)}`; 
  };


  if (!visibleReminders || visibleReminders.length === 0) {
    return null;
  }

  const firstReminder = visibleReminders[0];
  if (!firstReminder) {
    return null;
  }
  
  const PriorityIcon = PRIORITY_ICONS[firstReminder.priority as keyof typeof PRIORITY_ICONS] || PRIORITY_ICONS.medium;
  
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
        bottom: isMobile ? '16px' : '20px',
        right: isMobile ? '16px' : '20px',
        left: isMobile ? '16px' : 'auto',
        backgroundColor: firstReminder.color || '#007AFF',
        color: textColor,
        padding: '0px',
        borderRadius: '16px',
        boxShadow: isMobile 
          ? '0 6px 25px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06)' 
          : '0 12px 40px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.1)',
        zIndex: 9999,
        maxWidth: isMobile ? 'none' : '480px',
        width: isMobile ? 'calc(100vw - 32px)' : 'fit-content',
        fontSize: isMobile ? '13px' : '14px',
        fontWeight: '500',
        border: `1px solid ${borderColor}`,
        overflow: 'hidden',
        animation: 'slideInRight 0.4s ease-out',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)'
      }}
    >
      {/* Contenido compacto y armonioso */}
      <div style={{ 
        padding: isMobile ? '14px 16px' : '20px 24px', 
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: isMobile ? '10px' : '16px',
        width: '100%',
        boxSizing: 'border-box',
        minHeight: isMobile ? '56px' : 'auto'
      }}>
        {/* Icono de prioridad */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center',
          gap: isMobile ? '8px' : '12px',
          flexShrink: 0
        }}>
          <div 
            style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.25)',
              borderRadius: '50%',
              padding: isMobile ? '4px' : '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <PriorityIcon style={{ 
              width: isMobile ? '10px' : '14px', 
              height: isMobile ? '10px' : '14px', 
              color: textColor 
            }} />
          </div>
        </div>
        
        {/* Contenido principal */}
        <div style={{ 
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: isMobile ? '1px' : '3px'
        }}>
          <div style={{ 
            fontSize: isMobile ? '13px' : '15px', 
            fontWeight: '600', 
            color: textColor,
            lineHeight: isMobile ? '1.2' : '1.3',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical'
          }}>
            {firstReminder.title}
          </div>
          
          {/* Solo mostrar contenido en desktop o si es muy importante */}
          {!isMobile && firstReminder.content && (
            <div style={{ 
              fontSize: '12px', 
              color: textColor, 
              opacity: 0.85,
              lineHeight: '1.3',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 1,
              WebkitBoxOrient: 'vertical'
            }}>
              {firstReminder.content}
            </div>
          )}
          
          {firstReminder.reminderDate && (
            <div style={{ 
              fontSize: isMobile ? '10px' : '11px', 
              color: textColor, 
              opacity: 0.7,
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '3px'
            }}>
              <Clock style={{ width: '8px', height: '8px' }} />
              {formatReminderTime(firstReminder.reminderDate)}
            </div>
          )}
        </div>
        
        {/* Botones de acción compactos */}
        <div style={{ 
          display: 'flex',
          gap: isMobile ? '4px' : '6px',
          flexShrink: 0,
          alignItems: 'center'
        }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => completeReminder(firstReminder.id)}
            style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.25)',
              color: textColor,
              padding: isMobile ? '6px 10px' : '8px 14px',
              fontSize: isMobile ? '11px' : '12px',
              fontWeight: '600',
              border: `1px solid rgba(255, 255, 255, 0.3)`,
              borderRadius: isMobile ? '8px' : '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: isMobile ? '3px' : '5px',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
              height: isMobile ? '28px' : 'auto',
              minWidth: isMobile ? '60px' : 'auto',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)'
            }}
            onMouseEnter={(e) => {
              const target = e.target as HTMLElement;
              target.style.backgroundColor = 'rgba(255, 255, 255, 0.35)';
              target.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              const target = e.target as HTMLElement;
              target.style.backgroundColor = 'rgba(255, 255, 255, 0.25)';
              target.style.transform = 'scale(1)';
            }}
          >
            <CheckCircle style={{ width: isMobile ? '10px' : '12px', height: isMobile ? '10px' : '12px' }} />
            {!isMobile && 'Hecho'}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => dismissReminder(firstReminder.id)}
            style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              color: textColor,
              padding: isMobile ? '6px' : '8px 10px',
              fontSize: isMobile ? '11px' : '12px',
              fontWeight: '600',
              border: `1px solid rgba(255, 255, 255, 0.2)`,
              borderRadius: isMobile ? '8px' : '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              height: isMobile ? '28px' : 'auto',
              width: isMobile ? '28px' : 'auto',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)'
            }}
            onMouseEnter={(e) => {
              const target = e.target as HTMLElement;
              target.style.backgroundColor = 'rgba(255, 255, 255, 0.25)';
              target.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              const target = e.target as HTMLElement;
              target.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
              target.style.transform = 'scale(1)';
            }}
          >
            <X style={{ 
              width: isMobile ? '11px' : '12px', 
              height: isMobile ? '11px' : '12px' 
            }} />
          </Button>
        </div>
      </div>
    </div>
  );
}