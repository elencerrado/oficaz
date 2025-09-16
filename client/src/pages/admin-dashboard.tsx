import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFeatureCheck } from '@/hooks/use-feature-check';
import { usePageHeader } from '@/components/layout/page-header';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CustomCalendar } from '@/components/CustomCalendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { 
  Clock, 
  Users, 
  MessageSquare, 
  CalendarDays,
  LogIn,
  LogOut,
  Coffee,
  Plane,
  PartyPopper,
  ArrowRight,
  ArrowLeft,
  Bell,
  AlertCircle,
  Check,
  Edit,
  X
} from 'lucide-react';
import { format, addDays, isSameDay, parseISO, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { TrialManager } from '@/components/TrialManager';
import BlockedAccountOverlay from '@/components/BlockedAccountOverlay';
import { UserAvatar } from '@/components/ui/user-avatar';
import { PaymentMethodManager } from '@/components/PaymentMethodManager';
import { WelcomeModal } from '@/components/welcome-modal';

export default function AdminDashboard() {
  const { user, company } = useAuth();
  const { hasAccess } = useFeatureCheck();
  const { setHeader, resetHeader } = usePageHeader();

  // Set page header
  useEffect(() => {
    setHeader({
      title: 'Panel Principal',
      subtitle: 'Gestión rápida y vista general de la empresa'
    });
    return resetHeader;
  }, []);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentLocation, setLocation] = useLocation() || ['', () => {}];
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  
  // ⚠️ PROTECTED - DO NOT MODIFY - Message system states identical to employee system
  const [temporaryMessage, setTemporaryMessage] = useState<string | null>(null);

  // Hook para destacar el día de hoy en el calendario con estilos inline
  useEffect(() => {
    const highlightTodayInCalendar = () => {
      const calendarContainer = document.querySelector('.calendar-admin-override');
      if (!calendarContainer) return;

      // Buscar todos los botones con clase rdp-day_today
      const todayButtons = calendarContainer.querySelectorAll('button.rdp-day_today');
      
      todayButtons.forEach((button: Element) => {
        const htmlButton = button as HTMLElement;
        // Aplicar estilos inline con máxima prioridad
        htmlButton.style.cssText = `
          background-color: #3b82f6 !important;
          background: #3b82f6 !important;
          color: white !important;
          border: 3px solid #1d4ed8 !important;
          border-radius: 50% !important;
          font-weight: 900 !important;
          box-shadow: 0 0 12px rgba(59, 130, 246, 0.8), 0 0 0 3px rgba(59, 130, 246, 0.3) !important;
          transform: scale(1.1) !important;
          opacity: 1 !important;
          position: relative !important;
          z-index: 99999 !important;
        `;
      });
    };

    // Ejecutar inmediatamente y después de cualquier re-renderizado
    const timeoutId = setTimeout(highlightTodayInCalendar, 100);
    
    // Observer para cambios en el DOM del calendario
    const observer = new MutationObserver(highlightTodayInCalendar);
    const calendarContainer = document.querySelector('.calendar-admin-override');
    
    if (calendarContainer) {
      observer.observe(calendarContainer, { 
        childList: true, 
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style']
      });
    }

    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [selectedDate]); // Re-ejecutar cuando cambie la fecha seleccionada

  // ⚠️ PROTECTED - DO NOT MODIFY - Dynamic message functions identical to employee system
  const generateDynamicMessage = (type: 'entrada' | 'salida') => {
    const hour = new Date().getHours();
    let greeting;
    
    if (hour >= 6 && hour < 14) {
      greeting = 'Buenos días';
    } else if (hour >= 14 && hour < 20) {
      greeting = 'Buenas tardes';
    } else {
      greeting = 'Buenas noches';
    }
    
    return `${greeting}, ${type === 'entrada' ? 'Entrada' : 'Salida'} registrada`;
  };

  const showTemporaryMessage = (message: string) => {
    setTemporaryMessage(message);
    setTimeout(() => {
      setTemporaryMessage(null);
    }, 3000);
  };

  // Helper function to determine if user can manage a specific request
  const canManageRequest = (request: any) => {
    // Admin can manage all requests
    if (user?.role === 'admin') return true;
    
    // Manager can only manage employee requests, not their own
    if (user?.role === 'manager') {
      // Get the user who made the request
      const requestUser = (employees || []).find((emp: any) => emp.id === request.userId);
      // Manager cannot manage their own requests, only employee requests
      return requestUser && requestUser.role === 'employee';
    }
    
    // Employees cannot manage any requests
    return false;
  };

  // Función para manejar clics en días del calendario
  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
  };

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Check for welcome modal display
  useEffect(() => {
    const shouldShowWelcome = localStorage.getItem('showWelcomeModal');
    if (shouldShowWelcome === 'true') {
      setShowWelcomeModal(true);
      localStorage.removeItem('showWelcomeModal');
    }
  }, []);

  // Fetch cancellation status for subscription termination warning
  const { data: cancellationStatus } = useQuery({
    queryKey: ['/api/account/cancellation-status'],
    staleTime: 30000,
    refetchInterval: 60000,
  });

  // Fetch payment methods to determine if user has payment method
  const { data: paymentMethods } = useQuery({
    queryKey: ['/api/account/payment-methods'],
    staleTime: 30000,
    refetchInterval: 60000,
  });

  // Fetch trial status for blocking overlay
  const { data: trialStatus = {} } = useQuery({
    queryKey: ['/api/account/trial-status'],
    staleTime: 30000,
    refetchInterval: 60000,
  });

  // Fetch company settings for work hours configuration
  const { data: companySettings = {} } = useQuery({
    queryKey: ['/api/settings/work-hours'],
    staleTime: 60000, // Cache for 1 minute
  });

  // ⚠️ PROTECTED - DO NOT MODIFY - Queries identical to employee system
  const { data: activeSession } = useQuery({
    queryKey: ['/api/work-sessions/active'],
    refetchInterval: 20000, // Reduced from 5s to 20s
    refetchIntervalInBackground: false,
    staleTime: 15000,
  });

  // Query for active break period
  const { data: activeBreak } = useQuery({
    queryKey: ['/api/break-periods/active'],
    refetchInterval: 3000, // Poll every 3 seconds when session is active
    enabled: !!activeSession, // Only run when there's an active session
  });

  // Fetch employees list for permission checking
  const { data: employees = [] } = useQuery({
    queryKey: ['/api/employees'],
    staleTime: 300000, // Cache for 5 minutes
  });

  // Fetch recent work sessions
  const { data: recentSessions = [] } = useQuery({
    queryKey: ['/api/work-sessions/company', companySettings?.workingHoursPerDay],
    enabled: !!companySettings, // Wait for company settings to be loaded
    staleTime: 0, // Force fresh data to avoid showing outdated sessions
    refetchInterval: 30000, // Refetch every 30 seconds
    select: (data: any[]) => {
      if (!data?.length) return [];
      
      // Create separate events for clock-in and clock-out, including session status for completed sessions
      const events: any[] = [];
      const maxDailyHours = companySettings?.workingHoursPerDay || 8;
      
      data.forEach((session: any) => {
        // Add clock-in event
        events.push({
          id: `${session.id}-in`,
          userName: session.userName,
          type: 'entry',
          timestamp: session.clockIn,
          sessionId: session.id
        });
        
        // Add clock-out event if exists
        if (session.clockOut) {
          events.push({
            id: `${session.id}-out`,
            userName: session.userName,
            type: 'exit',
            timestamp: session.clockOut,
            sessionId: session.id
          });
        }
      });
      
      // Sort by timestamp (most recent first) and take first 5
      return events
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5);
    },
  });

  // Fetch recent messages - one per employee
  const { data: messages } = useQuery({
    queryKey: ['/api/messages'],
    select: (data: any[]) => {
      if (!data?.length) return [];
      
      // Group messages by sender and get the latest one for each
      const messagesBySender = data.reduce((acc, message) => {
        if (!acc[message.senderId] || new Date(message.createdAt) > new Date(acc[message.senderId].createdAt)) {
          acc[message.senderId] = message;
        }
        return acc;
      }, {});
      
      return Object.values(messagesBySender).slice(0, 4);
    },
  });

  // Fetch active reminders for dashboard
  const { data: activeReminders } = useQuery({
    queryKey: ['/api/reminders/dashboard'],
    enabled: hasAccess('reminders'),
    select: (data: any[]) => {
      if (!data?.length) return [];
      
      // Show only first 3 active reminders - backend already filters active ones
      return data
        .sort((a: any, b: any) => {
          // Prioritize reminders with dates
          if (a.reminderDate && !b.reminderDate) return -1;
          if (!a.reminderDate && b.reminderDate) return 1;
          if (a.reminderDate && b.reminderDate) {
            return new Date(a.reminderDate).getTime() - new Date(b.reminderDate).getTime();
          }
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        })
        .slice(0, 3);
    },
  });

  // Fetch vacation requests for calendar
  const { data: vacationRequests } = useQuery({
    queryKey: ['/api/vacation-requests/company'],
    staleTime: 0, // Always consider data potentially stale for real-time updates
    refetchInterval: 10000, // Refetch every 10 seconds
    refetchIntervalInBackground: true, // Continue refetching when tab is not active
    select: (data: any[]) => data || [],
  });

  const approvedVacations = vacationRequests?.filter((req: any) => req.status === 'approved') || [];
  const pendingVacations = vacationRequests?.filter((req: any) => req.status === 'pending') || [];

  // ⚠️ PROTECTED - DO NOT MODIFY - Fichaje mutations identical to employee system
  const clockInMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/work-sessions/clock-in');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions/company'] });
      // Force immediate refetch to update dashboard
      queryClient.refetchQueries({ queryKey: ['/api/work-sessions/company'] });
      const message = generateDynamicMessage('entrada');
      showTemporaryMessage(message);
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: 'No se pudo registrar la entrada',
        variant: 'destructive'
      });
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/work-sessions/clock-out');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions/company'] });
      // Force immediate refetch to update dashboard
      queryClient.refetchQueries({ queryKey: ['/api/work-sessions/company'] });
      const message = generateDynamicMessage('salida');
      showTemporaryMessage(message);
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: 'No se pudo registrar la salida',
        variant: 'destructive'
      });
    },
  });

  // Break periods mutations - identical to employee system
  const startBreakMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/break-periods/start');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/break-periods/active'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: 'No se pudo iniciar el descanso',
        variant: 'destructive'
      });
    },
  });

  const endBreakMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/break-periods/end');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/break-periods/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions/active'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: 'No se pudo finalizar el descanso',
        variant: 'destructive'
      });
    },
  });

  // Spanish national holidays 2025
  const nationalHolidays = [
    { name: "Año Nuevo", date: "2025-01-01", type: "national" },
    { name: "Día de Reyes", date: "2025-01-06", type: "national" },
    { name: "Viernes Santo", date: "2025-04-18", type: "national" },
    { name: "Día del Trabajo", date: "2025-05-01", type: "national" },
    { name: "Asunción de la Virgen", date: "2025-08-15", type: "national" },
    { name: "Día de la Hispanidad", date: "2025-10-12", type: "national" },
    { name: "Todos los Santos", date: "2025-11-01", type: "national" },
    { name: "Día de la Constitución", date: "2025-12-06", type: "national" },
    { name: "Inmaculada Concepción", date: "2025-12-08", type: "national" },
    { name: "Navidad", date: "2025-12-25", type: "national" }
  ];

  // Fetch custom holidays from database
  const { data: customHolidays = [] } = useQuery({
    queryKey: ['/api/holidays/custom'],
    select: (data: any[]) => {
      if (!data || !Array.isArray(data)) return [];
      
      // Expand date ranges into individual days for calendar display
      const expandedHolidays: any[] = [];
      
      data.filter(h => h && h.startDate).forEach((h: any) => {
        const start = new Date(h.startDate);
        const end = new Date(h.endDate);
        
        // Create entry for each day in the range
        for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
          expandedHolidays.push({
            ...h,
            type: 'custom', // Display type for UI
            originalType: h.type, // Preserve original DB type (regional, etc)
            date: date.toISOString().split('T')[0], // Format as YYYY-MM-DD
            isMultiDay: start.getTime() !== end.getTime(),
            originalStart: h.startDate,
            originalEnd: h.endDate
          });
        }
      });
      
      return expandedHolidays;
    },
  });

  const allHolidays = [...nationalHolidays, ...customHolidays];

  const formatTime = (date: Date) => {
    return format(date, 'HH:mm', { locale: es });
  };

  const formatDate = (dateString: string) => {
    return format(parseISO(dateString), 'dd/MM', { locale: es });
  };

  const formatDateTime = (dateString: string) => {
    return format(parseISO(dateString), 'dd/MM HH:mm', { locale: es });
  };

  // ⚠️ PROTECTED - DO NOT MODIFY - Dynamic message display identical to employee system
  const getLastClockInTime = () => {
    // If there's a temporary message, show it with success indicator
    if (temporaryMessage) {
      return (
        <span className="text-green-400">
          ✓ Fichaje registrado - {temporaryMessage}
        </span>
      );
    }

    if (activeSession?.clockIn) {
      const clockDate = parseISO(activeSession.clockIn);
      const today = new Date();
      const isToday = clockDate.toDateString() === today.toDateString();
      
      if (isToday) {
        return format(clockDate, "'hoy a las' HH:mm", { locale: es });
      } else {
        return format(clockDate, "'el' dd/MM 'a las' HH:mm", { locale: es });
      }
    }
    // Filter sessions to show only admin's own sessions
    if (recentSessions?.length > 0 && user?.fullName) {
      const adminSessions = recentSessions.filter(session => session.userName === user.fullName);
      if (adminSessions.length > 0) {
        const lastEvent = adminSessions[0];
        return format(parseISO(lastEvent.timestamp), "'el' dd/MM 'a las' HH:mm", { locale: es });
      }
    }
    return 'No hay fichajes recientes';
  };

  // Get vacation details for a specific date
  const getVacationDetailsForDate = (date: Date) => {
    const approved = approvedVacations?.filter((req: any) => {
      const startDate = startOfDay(parseISO(req.startDate));
      const endDate = startOfDay(parseISO(req.endDate));
      const targetDate = startOfDay(date);
      return targetDate >= startDate && targetDate <= endDate;
    }).map((req: any) => ({
      ...req,
      userName: req.userName || req.fullName || 'Empleado',
      status: 'approved'
    })) || [];

    const pending = pendingVacations?.filter((req: any) => {
      const startDate = startOfDay(parseISO(req.startDate));
      const endDate = startOfDay(parseISO(req.endDate));
      const targetDate = startOfDay(date);
      return targetDate >= startDate && targetDate <= endDate;
    }).map((req: any) => ({
      ...req,
      userName: req.userName || req.fullName || 'Empleado',
      status: 'pending'
    })) || [];

    return [...approved, ...pending];
  };

  // Check if date has events
  const getDateEvents = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const events = [];

    // Check holidays
    const holiday = allHolidays.find(h => h.date === dateStr);
    if (holiday) {
      events.push({ 
        type: 'holiday', 
        name: holiday.name, 
        holidayType: holiday.type,
        originalType: holiday.originalType || holiday.type // Keep original type from DB for regional holidays
      });
    }

    // Check employee vacations (approved and pending)
    const approvedVacs = approvedVacations?.filter((req: any) => {
      const startDate = startOfDay(parseISO(req.startDate));
      const endDate = startOfDay(parseISO(req.endDate));
      const targetDate = startOfDay(date);
      return targetDate >= startDate && targetDate <= endDate;
    });

    const pendingVacs = pendingVacations?.filter((req: any) => {
      const startDate = startOfDay(parseISO(req.startDate));
      const endDate = startOfDay(parseISO(req.endDate));
      const targetDate = startOfDay(date);
      return targetDate >= startDate && targetDate <= endDate;
    });

    if (approvedVacs?.length) {
      events.push({ type: 'vacation', count: approvedVacs.length, subtype: 'approved' });
    }

    if (pendingVacs?.length) {
      events.push({ type: 'vacation', count: pendingVacs.length, subtype: 'pending' });
    }

    return events;
  };

  return (
    <div>

      {/* Trial Status Management */}
      <div className="mb-6">
        <TrialManager />
      </div>

      {/* Blocked Account Overlay */}
      {trialStatus?.isBlocked && (
        <BlockedAccountOverlay trialStatus={trialStatus} />
      )}

      {/* Subscription Termination Warning - Discrete */}
      {cancellationStatus?.scheduledForCancellation && 
       (!paymentMethods || paymentMethods.length === 0) && (
        <div className="mb-6">
          <div className="rounded-lg border p-3 bg-amber-50/30 dark:bg-amber-900/20 border-amber-200/50 dark:border-amber-700/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-full bg-amber-100 dark:bg-amber-800">
                  <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300" />
                </div>
                <div>
                  <span className="text-sm font-medium text-foreground">
                    ⚠️ Tu suscripción terminará el {cancellationStatus?.nextPaymentDate ? 
                      new Date(cancellationStatus.nextPaymentDate).toLocaleDateString('es-ES', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      }) : 'fecha por determinar'
                    }
                  </span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Añade una tarjeta antes de esa fecha para mantener tu suscripción
                  </p>
                </div>
              </div>
              <Button 
                variant="ghost"
                size="sm"
                className="text-xs text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-800"
                onClick={() => setShowPaymentModal(true)}
              >
                Gestionar pago
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Quick Actions & Lists */}
        <div className="space-y-6">
          
          {/* Quick Clock In/Out */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Fichaje Rápido
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between min-h-[60px] gap-4">
                <div className="flex flex-col justify-center items-center md:items-start">
                  {/* Estado actual */}
                  <div className="mb-2">
                    {(() => {
                      // Check if session has exceeded max hours + overtime (should show as "Fuera del trabajo")
                      if (activeSession) {
                        const clockIn = new Date(activeSession.clockIn);
                        const currentTime = new Date();
                        const hoursWorked = (currentTime.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
                        const maxDailyHours = companySettings?.workingHoursPerDay || 8;
                        const maxHoursWithOvertime = maxDailyHours + 4;
                        
                        // If session has exceeded max hours + overtime, show as "Fuera del trabajo"
                        if (hoursWorked > maxHoursWithOvertime) {
                          return (
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                              <span className="text-red-600 font-medium">Fuera del trabajo</span>
                            </div>
                          );
                        }
                        
                        // Normal flow for active sessions
                        if (activeBreak) {
                          return (
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                              <span className="text-orange-600 font-medium">En descanso</span>
                            </div>
                          );
                        } else {
                          // Calculate hours worked so far today
                          const clockIn = new Date(activeSession.clockIn);
                          const currentTime = new Date();
                          const hoursWorked = (currentTime.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
                          const maxDailyHours = companySettings?.workingHoursPerDay || 8;
                          
                          if (hoursWorked > maxDailyHours) {
                            return (
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                                <span className="text-red-600 font-medium">Incompleto</span>
                              </div>
                            );
                          } else {
                            return (
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                <span className="text-green-600 font-medium">Trabajando</span>
                              </div>
                            );
                          }
                        }
                      } else {
                        return (
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                            <span className="text-red-600 font-medium">Fuera del trabajo</span>
                          </div>
                        );
                      }
                    })()}
                  </div>
                  <p className="text-sm text-muted-foreground text-center md:text-left">
                    Tu último fichaje: {getLastClockInTime()}
                  </p>
                </div>
                <div className="flex flex-row md:flex-col justify-center gap-2">
                  {(() => {
                    // Check if we should allow new clock-in even with active session
                    let shouldShowActiveButtons = !!activeSession;
                    
                    if (activeSession) {
                      const clockIn = new Date(activeSession.clockIn);
                      const currentTime = new Date();
                      const hoursWorked = (currentTime.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
                      const maxDailyHours = companySettings?.workingHoursPerDay || 8;
                      const maxHoursWithOvertime = maxDailyHours + 4; // +4 hours for overtime allowance
                      
                      // If session has exceeded max hours + overtime, treat as if no active session
                      if (hoursWorked > maxHoursWithOvertime) {
                        shouldShowActiveButtons = false; // Allow new clock-in
                      }
                    }
                    
                    if (shouldShowActiveButtons) {
                      return (
                        <>
                          <Button
                            size="lg"
                            onClick={() => clockOutMutation.mutate()}
                            disabled={clockOutMutation.isPending}
                            className="w-[120px] h-[48px] font-medium rounded-lg transition-all duration-200 shadow-sm bg-red-500 hover:bg-red-600 text-white border-red-500 hover:shadow-red-200 hover:shadow-md"
                          >
                            {clockOutMutation.isPending ? (
                              <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                Fichando...
                              </>
                            ) : (
                              <>
                                <LogOut className="h-5 w-5 mr-2" />
                                Salir
                              </>
                            )}
                          </Button>
                          
                          {!activeBreak ? (
                            <Button
                              size="lg"
                              variant="outline"
                              onClick={() => startBreakMutation.mutate()}
                              disabled={startBreakMutation.isPending}
                              className="w-[120px] h-[48px] border-orange-300 text-orange-600 hover:bg-orange-50"
                            >
                              {startBreakMutation.isPending ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600 mr-2"></div>
                                  Iniciando...
                                </>
                              ) : (
                                <>
                                  <Coffee className="h-4 w-4 mr-2" />
                                  Descanso
                                </>
                              )}
                            </Button>
                          ) : (
                            <Button
                              size="lg"
                              variant="outline"
                              onClick={() => endBreakMutation.mutate()}
                              disabled={endBreakMutation.isPending}
                              className="w-[120px] h-[48px] border-green-300 text-green-600 hover:bg-green-50"
                            >
                              {endBreakMutation.isPending ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600 mr-2"></div>
                                  Finalizando...
                                </>
                              ) : (
                                <>
                                  <Coffee className="h-4 w-4 mr-2" />
                                  Finalizar
                                </>
                              )}
                            </Button>
                          )}
                        </>
                      );
                    } else {
                      return (
                        <Button
                          size="lg"
                          onClick={() => clockInMutation.mutate()}
                          disabled={clockInMutation.isPending}
                          className="w-[120px] h-[48px] font-medium rounded-lg transition-all duration-200 shadow-sm bg-green-500 hover:bg-green-600 text-white border-green-500 hover:shadow-green-200 hover:shadow-md"
                        >
                          {clockInMutation.isPending ? (
                            <>
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                              Fichando...
                            </>
                          ) : (
                            <>
                              <LogIn className="h-5 w-5 mr-2" />
                              Entrar
                            </>
                          )}
                        </Button>
                      );
                    }
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Messages */}
          {hasAccess('messages') && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Mensajes Recientes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(() => {
                    const receivedMessages = messages?.filter((message: any) => message.senderId !== user?.id) || [];
                    
                    return receivedMessages.length > 0 ? (
                      receivedMessages.map((message: any) => (
                        <div 
                          key={message.id} 
                          className="flex items-start gap-3 py-2 border-b border-border last:border-0 cursor-pointer hover:bg-muted/50 transition-colors rounded-md"
                          onClick={() => setLocation(`/test/mensajes?chat=${message.senderId}`)}
                        >
                          <UserAvatar 
                            fullName={message.senderName || 'Empleado'}
                            userId={message.senderId} 
                            size="sm" 
                            profilePicture={message.senderProfilePicture}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate">{message.senderName || 'Empleado'}</p>
                            <p className="text-sm text-muted-foreground truncate">{message.content}</p>
                            <p className="text-xs text-muted-foreground opacity-75">{formatTime(parseISO(message.createdAt))}</p>
                          </div>
                          {!message.isRead && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-center py-4">No hay mensajes recientes</p>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Active Reminders */}
          {hasAccess('reminders') && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Recordatorios Próximos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activeReminders && activeReminders.length > 0 ? (
                    activeReminders.map((reminder: any) => (
                      <div 
                        key={reminder.id} 
                        className="flex items-start gap-3 py-2 border-b border-border last:border-0 cursor-pointer hover:bg-muted/50 transition-colors rounded-md"
                        onClick={() => setLocation('/test/recordatorios')}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          reminder.priority === 'high' ? 'bg-red-100' : 
                          reminder.priority === 'medium' ? 'bg-orange-100' : 'bg-blue-100'
                        }`}>
                          {reminder.priority === 'high' ? (
                            <AlertCircle className="h-4 w-4 text-red-600" />
                          ) : (
                            <Bell className="h-4 w-4 text-blue-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{reminder.title}</p>
                          {reminder.content && (
                            <p className="text-sm text-muted-foreground truncate">{reminder.content}</p>
                          )}
                          <p className="text-xs text-muted-foreground opacity-75">
                            {reminder.reminderDate 
                              ? format(parseISO(reminder.reminderDate), 'dd MMM, HH:mm', { locale: es })
                              : 'Sin fecha'
                            }
                          </p>
                        </div>
                        <div className={`w-2 h-2 rounded-full ${
                          reminder.priority === 'high' ? 'bg-red-500' : 
                          reminder.priority === 'medium' ? 'bg-orange-500' : 'bg-blue-500'
                        }`}></div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-center py-4">No hay recordatorios activos</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Clock-ins */}
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation('/test/fichajes')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Fichajes Recientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentSessions?.length > 0 ? (
                  recentSessions.map((event: any) => (
                    <div key={event.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        event.type === 'entry' ? 'bg-green-100' : 'bg-red-100'
                      }`}>
                        {event.type === 'entry' ? (
                          <ArrowRight className="h-4 w-4 text-green-600" />
                        ) : (
                          <ArrowLeft className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{event.userName}</p>
                        <p className="text-sm text-muted-foreground">
                          {event.type === 'entry' ? 'Entrada' : 'Salida'} - {formatDateTime(event.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-4">No hay fichajes recientes</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Calendar with Events */}
        <div>
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Calendario
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Calendar - Simple and Compact */}
              <div className="bg-card rounded-lg border border-border shadow-sm">
                <div className="p-4">
                  <CustomCalendar
                    selectedDate={selectedDate}
                    onDateSelect={handleDateSelect}
                    nationalHolidays={nationalHolidays}
                    customHolidays={customHolidays.filter(h => h.date)}
                    approvedVacations={approvedVacations}
                    pendingVacations={pendingVacations}
                    className="w-full mx-auto"
                  />
                </div>

                {/* Event Details for Selected Date */}
                {selectedDate && (
                  <div className="border-t border-border p-4 bg-muted/50">
                    <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" />
                      {format(selectedDate, 'dd MMMM yyyy', { locale: es })}
                    </h4>
                    {(() => {
                      const events = getDateEvents(selectedDate);
                      const vacations = getVacationDetailsForDate(selectedDate);
                      
                      if (events.length === 0 && vacations.length === 0) {
                        return <p className="text-sm text-muted-foreground">No hay eventos programados</p>;
                      }
                      
                      return (
                        <div className="space-y-3">
                          {/* Festivos */}
                          {events.filter(event => event.type === 'holiday').map((event, idx) => (
                            <div key={idx} className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border">
                              <div className={`w-3 h-3 rounded-full ${
                                event.holidayType === 'custom' ? 'bg-orange-500' : 'bg-red-500'
                              }`}></div>
                              <div>
                                <p className="text-sm font-medium text-foreground">{event.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {event.holidayType === 'custom' 
                                    ? (event.originalType === 'regional' ? 'Día festivo regional' : 'Día festivo personalizado')
                                    : 'Día festivo nacional'
                                  }
                                </p>
                              </div>
                            </div>
                          ))}
                          
                          {/* Vacaciones aprobadas */}
                          {vacations.filter(v => v.status === 'approved').map((vacation: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border">
                              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                              <div>
                                <p className="text-sm font-medium text-foreground">
                                  {vacation.userName} - Vacaciones
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Del {format(parseISO(vacation.startDate), 'dd/MM')} al {format(parseISO(vacation.endDate), 'dd/MM')}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Pending Requests Section */}
              {pendingVacations.length > 0 && (
                <div className="mt-6 pt-4 border-t border-border">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                      Pendientes de Aprobación
                    </h4>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setLocation('/test/vacaciones')}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      ver más
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {pendingVacations.slice(0, 3).map((request: any) => (
                      <div 
                        key={request.id} 
                        className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border"
                      >
                        <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">
                            Vacaciones de {request.userName || 'Empleado'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Del {format(parseISO(request.startDate), 'dd/MM')} al {format(parseISO(request.endDate), 'dd/MM')}
                          </p>
                        </div>
                        
                        {/* Action buttons like timeline - only show if user can manage this request */}
                        {canManageRequest(request) && (
                          <div className="flex gap-1 flex-shrink-0">
                            <Button
                              size="sm"
                              onClick={() => setLocation(`/test/vacaciones?requestId=${request.id}&action=approve`)}
                              className="bg-green-600 hover:bg-green-700 text-white h-8 w-8 p-0"
                              title="Aprobar solicitud"
                            >
                              <Check className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => setLocation(`/test/vacaciones?requestId=${request.id}&action=edit`)}
                              className="bg-blue-600 hover:bg-blue-700 text-white h-8 w-8 p-0"
                              title="Modificar solicitud"
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => setLocation(`/test/vacaciones?requestId=${request.id}&action=deny`)}
                              variant="destructive"
                              className="h-8 w-8 p-0"
                              title="Denegar solicitud"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upcoming Events Section */}
              <div className="mt-6 pt-4 border-t border-border">
                <div className="mb-3">
                  <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Próximos Eventos
                  </h4>
                </div>
                <div className="space-y-3">
                  {allHolidays
                    .filter(holiday => {
                      if (!holiday.date) return false;
                      try {
                        const holidayDate = parseISO(holiday.date);
                        const today = new Date();
                        return holidayDate > today;
                      } catch (error) {
                        return false;
                      }
                    })
                    // Remove duplicates for multi-day events (show only the first day)
                    .reduce((acc: any[], holiday: any) => {
                      if (holiday.isMultiDay) {
                        const existing = acc.find(h => h.id === holiday.id);
                        if (!existing) {
                          acc.push(holiday);
                        }
                      } else {
                        acc.push(holiday);
                      }
                      return acc;
                    }, [])
                    .sort((a, b) => {
                      try {
                        return parseISO(a.date).getTime() - parseISO(b.date).getTime();
                      } catch (error) {
                        return 0;
                      }
                    })
                    .slice(0, 4)
                    .map((holiday, idx) => {
                      if (!holiday.date) return null;
                      try {
                        const holidayDate = parseISO(holiday.date);
                        const isCustom = holiday.type === 'custom';
                      
                        return (
                          <div key={idx} className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border">
                            <div className={`w-3 h-3 rounded-full ${
                              isCustom ? 'bg-orange-500' : 'bg-red-500'
                            }`}></div>
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {holiday.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {holiday.isMultiDay ? (
                                  <>
                                    {format(parseISO(holiday.originalStart), 'dd MMM', { locale: es })} - {format(parseISO(holiday.originalEnd), 'dd MMM', { locale: es })}
                                  </>
                                ) : (
                                  format(holidayDate, 'dd MMM, EEEE', { locale: es })
                                )}
                                {isCustom && (
                                  <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                                    {holiday.originalType === 'regional' ? 'Regional' : 'Personalizado'}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                        );
                      } catch (error) {
                        return null;
                      }
                    }).filter(Boolean)}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gestionar Métodos de Pago</DialogTitle>
          </DialogHeader>
          <PaymentMethodManager 
            paymentMethods={paymentMethods || []}
            onPaymentSuccess={() => {
              setShowPaymentModal(false);
              queryClient.invalidateQueries({ queryKey: ['/api/account/payment-methods'] });
              queryClient.invalidateQueries({ queryKey: ['/api/account/cancellation-status'] });
              toast({
                title: "Método de pago añadido",
                description: "Tu método de pago se ha configurado correctamente",
              });
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Welcome Modal */}
      <WelcomeModal
        isOpen={showWelcomeModal}
        onClose={() => setShowWelcomeModal(false)}
        companyName={company?.name || 'tu empresa'}
        trialDays={company?.trialDurationDays || 14}
      />
    </div>
  );
}