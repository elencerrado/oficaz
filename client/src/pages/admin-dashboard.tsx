import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFeatureCheck } from '@/hooks/use-feature-check';
import { usePageHeader } from '@/components/layout/page-header';
import { usePageTitle } from '@/hooks/use-page-title';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
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
  X,
  FileText,
  AlertTriangle,
  ChevronRight,
  Upload
} from 'lucide-react';
import { format, addDays, isSameDay, parseISO, startOfDay, differenceInCalendarDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { TrialManager } from '@/components/TrialManager';
import BlockedAccountOverlay from '@/components/BlockedAccountOverlay';
import { UserAvatar } from '@/components/ui/user-avatar';
import { PaymentMethodManager } from '@/components/PaymentMethodManager';

export default function AdminDashboard() {
  usePageTitle('Panel Principal');
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
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const temporaryMessageTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // ⚠️ PROTECTED - DO NOT MODIFY - Message system states identical to employee system
  const [temporaryMessage, setTemporaryMessage] = useState<string | null>(null);
  
  // Staggered card animation - only runs ONCE per session (persisted in sessionStorage)
  const [hasAnimated, setHasAnimated] = useState(() => 
    sessionStorage.getItem('adminDashboardAnimated') === 'true'
  );
  const [visibleCards, setVisibleCards] = useState<number[]>(() => 
    sessionStorage.getItem('adminDashboardAnimated') === 'true' ? [0, 1, 2, 3, 4, 5, 6] : []
  );

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
    // Clear any existing timeout to prevent memory leaks
    if (temporaryMessageTimeoutRef.current) {
      clearTimeout(temporaryMessageTimeoutRef.current);
    }
    
    setTemporaryMessage(message);
    temporaryMessageTimeoutRef.current = setTimeout(() => {
      setTemporaryMessage(null);
      temporaryMessageTimeoutRef.current = null;
    }, 3000);
  };
  
  // Cleanup timeout on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (temporaryMessageTimeoutRef.current) {
        clearTimeout(temporaryMessageTimeoutRef.current);
      }
    };
  }, []);

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

  // ⚠️ Performance: currentTime state removed - calculate directly when needed to avoid unnecessary re-renders


  // Fetch cancellation status for subscription termination warning
  const { data: cancellationStatus } = useQuery({
    queryKey: ['/api/account/cancellation-status'],
    staleTime: 30000,
    refetchInterval: 60000,
  });

  // Fetch payment methods to determine if user has payment method
  const { data: paymentMethods } = useQuery({
    queryKey: ['/api/account/payment-methods'],
    staleTime: 120000, // Cache for 2 minutes (optimized from 30s)
    refetchInterval: 300000, // Refetch every 5 minutes (optimized from 60s)
    refetchIntervalInBackground: false,
  });

  // Fetch trial status for blocking overlay
  const { data: trialStatus = {} } = useQuery({
    queryKey: ['/api/account/trial-status'],
    staleTime: 120000, // Cache for 2 minutes (optimized from 30s)
    refetchInterval: 300000, // Refetch every 5 minutes (optimized from 60s)
    refetchIntervalInBackground: false,
  });

  // Fetch company settings for work hours configuration
  const { data: companySettings = {} } = useQuery({
    queryKey: ['/api/settings/work-hours'],
    staleTime: 60000, // Cache for 1 minute
  });

  // ⚠️ PROTECTED - DO NOT MODIFY - Queries identical to employee system
  // WebSocket handles real-time work_session_* events - only use staleTime for cache
  const { data: activeSession } = useQuery({
    queryKey: ['/api/work-sessions/active'],
    staleTime: 30000, // Cache for 30s - WebSocket invalidates on changes
  });

  // Query for active break period
  const { data: activeBreak } = useQuery({
    queryKey: ['/api/break-periods/active'],
    staleTime: 30000, // Cache for 30s - WebSocket handles updates
    enabled: !!activeSession, // Only run when there's an active session
  });

  // ✨ OPTIMIZED: Single consolidated query for all dashboard data
  // This replaces 10+ individual queries with one API call for faster loading
  // WebSocket handles real-time updates via work_session_*, vacation_request_*, message_received events
  const { data: dashboardData, isLoading: isDashboardLoading } = useQuery<{
    employees: any[];
    recentSessions: any[];
    messages: any[];
    activeReminders: any[];
    vacationRequests: any[];
    approvedVacations: any[];
    pendingVacations: any[];
    incompleteSessions: any[];
    modificationRequests: any[];
    unreadMessagesCount: number;
    unsignedPayrollsCount: number;
    documentRequests: any[];
    customHolidays: any[];
  }>({
    queryKey: ['/api/admin/dashboard/summary'],
    staleTime: 60000, // Cache for 1 min - WebSocket invalidates on real-time events
    enabled: user?.role === 'admin' || user?.role === 'manager',
  });

  // Extract data from consolidated response
  const employees = dashboardData?.employees || [];
  const recentSessions = dashboardData?.recentSessions || [];
  const messages = dashboardData?.messages || [];
  const activeReminders = dashboardData?.activeReminders || [];
  const vacationRequests = dashboardData?.vacationRequests || [];
  const approvedVacations = dashboardData?.approvedVacations || [];
  const pendingVacations = dashboardData?.pendingVacations || [];
  const incompleteSessions = dashboardData?.incompleteSessions || [];
  const modificationRequests = dashboardData?.modificationRequests || [];
  
  // WebSocket connection for real-time updates
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || (user?.role !== 'admin' && user?.role !== 'manager')) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const ws = new WebSocket(`${protocol}//${host}/ws/work-sessions?token=${token}`);

    ws.onopen = () => {
      console.log('✅ WebSocket connected for real-time updates');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('📡 WebSocket message received:', message);

        // Invalidate consolidated dashboard query for any updates
        if (message.type === 'vacation_request_created' || 
            message.type === 'vacation_request_updated' ||
            message.type === 'modification_request_created' || 
            message.type === 'modification_request_updated' ||
            message.type === 'work_session_created' || 
            message.type === 'work_session_updated' || 
            message.type === 'work_session_deleted' ||
            message.type === 'message_received' ||
            message.type === 'document_uploaded' ||
            message.type === 'work_report_created' ||
            message.type === 'reminder_all_completed') {
          queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard/summary'] });
        }
        
        // 🔔 Toast notifications for new employee actions
        if (message.type === 'message_received' && message.data) {
          toast({
            title: "💬 Nuevo mensaje",
            description: `${message.data.senderName} te ha enviado un mensaje`,
            duration: 8000
          });
        }
        
        if (message.type === 'document_uploaded' && message.data) {
          const docType = message.data.requestType ? ` (${message.data.requestType})` : '';
          toast({
            title: "📄 Documento subido",
            description: `${message.data.employeeName} ha subido un documento${docType}`,
            duration: 8000
          });
        }
        
        if (message.type === 'work_report_created' && message.data) {
          toast({
            title: "📋 Nuevo parte de trabajo",
            description: `${message.data.employeeName} ha enviado un parte desde ${message.data.location}`,
            duration: 8000
          });
        }
        
        if (message.type === 'reminder_all_completed' && message.data) {
          toast({
            title: "✅ Recordatorio completado",
            description: `Todos (${message.data.completedCount}) han completado: ${message.data.title}`,
            duration: 8000
          });
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };

    // Cleanup on unmount
    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [user, queryClient]);

  // Extract remaining data from consolidated response
  const unreadMessagesCount = dashboardData?.unreadMessagesCount || 0;
  const unsignedPayrollsCount = dashboardData?.unsignedPayrollsCount || 0;
  const documentRequests = dashboardData?.documentRequests || [];
  const customHolidays = dashboardData?.customHolidays || [];

  // Calculate total pending items (respecting feature access)
  const totalPending = 
    (hasAccess('time_tracking') ? incompleteSessions.length + modificationRequests.length : 0) + 
    (hasAccess('vacation') ? pendingVacations.length : 0) + 
    (hasAccess('documents') ? unsignedPayrollsCount + documentRequests.length : 0) + 
    (hasAccess('messages') ? unreadMessagesCount : 0);

  // Track previous vacation requests to detect new ones for toast notifications
  const previousVacationRequestsRef = useRef<any[]>([]);
  const previousModificationRequestsRef = useRef<any[]>([]);

  // ✨ OPTIMIZATION: Reusable function to calculate work hours (prevents duplicate logic)
  const calculateWorkHours = useCallback((session: any, settings: any) => {
    if (!session) return null;
    
    const clockIn = new Date(session.clockIn);
    const hoursWorked = (Date.now() - clockIn.getTime()) / (1000 * 60 * 60);
    const maxDailyHours = settings?.workingHoursPerDay || 8;
    const maxHoursWithOvertime = maxDailyHours + 4;
    
    return {
      hoursWorked,
      maxDailyHours,
      maxHoursWithOvertime,
      isOvertime: hoursWorked > maxDailyHours,
      isExceeded: hoursWorked > maxHoursWithOvertime,
    };
  }, []);

  // ✨ OPTIMIZATION: Generic hook for request notifications (reduces duplicate useEffect code)
  const useNewRequestNotifications = useCallback((
    requests: any[] | undefined,
    previousRequestsRef: React.MutableRefObject<any[]>,
    formatter: (request: any) => { title: string; description: string }
  ) => {
    useEffect(() => {
      if (!requests || requests.length === 0) {
        return;
      }
      
      const previousRequests = previousRequestsRef.current;
      
      // On first load, just store current requests without showing notifications
      if (previousRequests.length === 0) {
        previousRequestsRef.current = [...requests];
        return;
      }
      
      // Find new pending requests
      const newPendingRequests = requests.filter((current: any) => 
        current.status === 'pending' && 
        !previousRequests.some((prev: any) => prev.id === current.id)
      );
      
      // Show notification for each new pending request
      newPendingRequests.forEach((request: any) => {
        const { title, description } = formatter(request);
        toast({ title, description, duration: 8000 });
      });
      
      // Update the reference with current requests
      previousRequestsRef.current = [...requests];
    }, [requests, previousRequestsRef, formatter]);
  }, [toast]);

  // Use generic notification hook for vacation requests
  useNewRequestNotifications(
    vacationRequests,
    previousVacationRequestsRef,
    useCallback((request: any) => {
      const employeeName = request.userName || 'Un empleado';
      const startDateObj = startOfDay(parseISO(request.startDate));
      const endDateObj = startOfDay(parseISO(request.endDate));
      const days = differenceInCalendarDays(endDateObj, startDateObj) + 1;
      
      const startDate = format(startDateObj, 'd \'de\' MMMM', { locale: es });
      const endDate = format(endDateObj, 'd \'de\' MMMM', { locale: es });
      
      return {
        title: "📋 Nueva solicitud de vacaciones",
        description: `${employeeName} ha solicitado vacaciones del ${startDate} al ${endDate} (${days} ${days === 1 ? 'día' : 'días'})`,
      };
    }, [])
  );

  // Use generic notification hook for modification requests
  useNewRequestNotifications(
    modificationRequests,
    previousModificationRequestsRef,
    useCallback((request: any) => {
      const employeeName = request.employeeName || 'Un empleado';
      const requestTypeText = request.requestType === 'forgotten_checkin' ? 'fichaje olvidado' : 'modificación de horario';
      
      return {
        title: "🕐 Nueva solicitud de fichaje",
        description: `${employeeName} ha solicitado un ${requestTypeText}`,
      };
    }, [])
  );

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

  // ✨ OPTIMIZED: Process custom holidays from consolidated response
  const processedCustomHolidays = useMemo(() => {
    if (!customHolidays || !Array.isArray(customHolidays)) return [];
    
    // Expand date ranges into individual days for calendar display
    const expandedHolidays: any[] = [];
    
    customHolidays.filter((h: any) => h && h.startDate).forEach((h: any) => {
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
  }, [customHolidays]);

  // ✨ OPTIMIZED: Memoize holidays array to prevent recalculation on every render
  const allHolidays = useMemo(() => {
    return [...nationalHolidays, ...processedCustomHolidays];
  }, [processedCustomHolidays]);

  // ✨ OPTIMIZATION: Calculate work hours once and reuse (prevents duplicate calculations)
  const currentWorkHours = useMemo(() => {
    return calculateWorkHours(activeSession, companySettings);
  }, [activeSession, companySettings, calculateWorkHours]);

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

  // ✨ OPTIMIZATION: Memoize vacation details function to prevent recalculation on every render
  const getVacationDetailsForDate = useCallback((date: Date) => {
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
  }, [approvedVacations, pendingVacations]);

  // ✨ OPTIMIZATION: Memoize date events function to prevent recalculation on every render
  const getDateEvents = useCallback((date: Date) => {
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
  }, [allHolidays, approvedVacations, pendingVacations]);

  // Show skeleton loading on initial load
  const isInitialLoading = isDashboardLoading && !dashboardData;

  // Staggered card animation effect - only runs ONCE per session
  useEffect(() => {
    if (!isInitialLoading && dashboardData && !hasAnimated) {
      // Stagger the appearance of each card (7 cards total)
      const totalCards = 7;
      const delays = Array.from({ length: totalCards }, (_, i) => i);
      delays.forEach((cardIndex) => {
        setTimeout(() => {
          setVisibleCards(prev => [...prev, cardIndex]);
          // Mark animation complete after last card
          if (cardIndex === totalCards - 1) {
            sessionStorage.setItem('adminDashboardAnimated', 'true');
            setHasAnimated(true);
          }
        }, cardIndex * 80);
      });
    }
  }, [isInitialLoading, dashboardData, hasAnimated]);

  // Helper function to get card animation class
  const getCardAnimationClass = (cardIndex: number) => {
    const isVisible = visibleCards.includes(cardIndex);
    return `transition-all duration-300 ease-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`;
  };

  return (
    <div>
      {/* Trial Status Management - Only visible to admins */}
      {user?.role === 'admin' && (
        <div className={`mb-6 ${getCardAnimationClass(0)}`}>
          <TrialManager />
        </div>
      )}

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
          {hasAccess('time_tracking') && (
            <Card className={getCardAnimationClass(1)}>
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
                        // ✨ OPTIMIZED: Using memoized currentWorkHours (calculated once per render)
                        const workHours = currentWorkHours;
                        
                        if (workHours) {
                          // If session has exceeded max hours + overtime, show as "Fuera del trabajo"
                          if (workHours.isExceeded) {
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
                          } else if (workHours.isOvertime) {
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
                    // ✨ OPTIMIZED: Using memoized currentWorkHours (calculated once per render)
                    const workHours = currentWorkHours;
                    
                    // Check if we should allow new clock-in even with active session
                    let shouldShowActiveButtons = !!activeSession;
                    
                    // If session has exceeded max hours + overtime, treat as if no active session
                    if (workHours?.isExceeded) {
                      shouldShowActiveButtons = false; // Allow new clock-in
                    }
                    
                    if (shouldShowActiveButtons) {
                      return (
                        <>
                          <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: "spring", stiffness: 400, damping: 25 }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <Button
                              size="lg"
                              onClick={() => clockOutMutation.mutate()}
                              disabled={clockOutMutation.isPending}
                              className="w-[120px] h-[48px] font-medium rounded-lg bg-red-500 hover:bg-red-600 text-white border-0 transition-all duration-300"
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
                          </motion.div>
                          
                          {!activeBreak ? (
                            <motion.div
                              initial={{ scale: 0.9, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ type: "spring", stiffness: 400, damping: 25, delay: 0.1 }}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              <Button
                                size="lg"
                                variant="outline"
                                onClick={() => startBreakMutation.mutate()}
                                disabled={startBreakMutation.isPending}
                                className="w-[120px] h-[48px] border-2 border-orange-400 text-orange-600 hover:border-orange-500 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-all duration-300"
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
                            </motion.div>
                          ) : (
                            <motion.div
                              initial={{ scale: 0.9, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ type: "spring", stiffness: 400, damping: 25, delay: 0.1 }}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              <Button
                                size="lg"
                                variant="outline"
                                onClick={() => endBreakMutation.mutate()}
                                disabled={endBreakMutation.isPending}
                                className="w-[120px] h-[48px] border-2 border-green-400 text-green-600 hover:border-green-500 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/20 transition-all duration-300"
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
                            </motion.div>
                          )}
                        </>
                      );
                    } else {
                      return (
                        <motion.div
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: "spring", stiffness: 400, damping: 25 }}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <Button
                            size="lg"
                            onClick={() => clockInMutation.mutate()}
                            disabled={clockInMutation.isPending}
                            className="w-[120px] h-[48px] font-medium rounded-lg bg-green-500 hover:bg-green-600 text-white border-0 transition-all duration-300"
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
                        </motion.div>
                      );
                    }
                  })()}
                </div>
              </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Summary of Pending Items */}
          {totalPending > 0 && (
            <Card className={getCardAnimationClass(2)}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Resumen de Pendientes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {hasAccess('time_tracking') && incompleteSessions.length > 0 && (
                    <button
                      onClick={() => setLocation('/test/fichajes?filter=incomplete')}
                      className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                          <Clock className="h-4 w-4 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">Sesiones incompletas</p>
                          <p className="text-xs text-muted-foreground">Sin fichaje de salida</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">{incompleteSessions.length}</Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                  )}

                  {hasAccess('time_tracking') && modificationRequests.length > 0 && (
                    <button
                      onClick={() => setLocation('/test/fichajes')}
                      className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                          <Edit className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">Solicitudes de fichajes</p>
                          <p className="text-xs text-muted-foreground">Modificaciones pendientes</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">{modificationRequests.length}</Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                  )}

                  {hasAccess('vacation') && pendingVacations.length > 0 && (
                    <button
                      onClick={() => setLocation('/test/ausencias?filter=pending')}
                      className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                          <Plane className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">Solicitudes de ausencias</p>
                          <p className="text-xs text-muted-foreground">Pendientes de aprobación</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">{pendingVacations.length}</Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                  )}

                  {hasAccess('documents') && unsignedPayrollsCount > 0 && (
                    <button
                      onClick={() => setLocation('/test/documentos?filter=unsigned')}
                      className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center flex-shrink-0">
                          <FileText className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">Documentos pendientes de firma</p>
                          <p className="text-xs text-muted-foreground">Nóminas y circulares</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">{unsignedPayrollsCount}</Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                  )}

                  {hasAccess('documents') && documentRequests.length > 0 && (
                    <button
                      onClick={() => setLocation('/test/documentos')}
                      className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                          <Upload className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">Solicitudes de documentos</p>
                          <p className="text-xs text-muted-foreground">Pendientes de subida</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">{documentRequests.length}</Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                  )}

                  {hasAccess('messages') && unreadMessagesCount > 0 && (
                    <button
                      onClick={() => setLocation('/test/mensajes')}
                      className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                          <MessageSquare className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">Mensajes sin leer</p>
                          <p className="text-xs text-muted-foreground">Nuevas conversaciones</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">{unreadMessagesCount}</Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Messages */}
          {hasAccess('messages') && (
            <Card className={getCardAnimationClass(3)}>
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
                          className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => setLocation(`/test/mensajes?chat=${message.senderId}`)}
                        >
                          <UserAvatar 
                            fullName={message.senderName || 'Empleado'}
                            userId={message.senderId} 
                            size="sm" 
                            profilePicture={message.senderProfilePicture}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate mb-1">{message.senderName || 'Empleado'}</p>
                            <div className="flex items-baseline gap-2">
                              <p className="text-sm text-muted-foreground truncate flex-1">{message.content}</p>
                              <p className="text-xs text-muted-foreground opacity-75 whitespace-nowrap">{formatTime(parseISO(message.createdAt))}</p>
                            </div>
                          </div>
                          {!message.isRead && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
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
            <Card className={getCardAnimationClass(4)}>
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
                        className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setLocation('/test/recordatorios')}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          reminder.priority === 'high' ? 'bg-red-100 dark:bg-red-900/30' : 
                          reminder.priority === 'medium' ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-blue-100 dark:bg-blue-900/30'
                        }`}>
                          {reminder.priority === 'high' ? (
                            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                          ) : (
                            <Bell className="h-4 w-4 text-blue-600 dark:text-blue-400" />
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
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
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
          {hasAccess('time_tracking') && (
            <Card className={`cursor-pointer hover:shadow-md ${getCardAnimationClass(5)}`} onClick={() => setLocation('/test/fichajes')}>
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
          )}
        </div>

        {/* Right Column - Calendar with Events */}
        <div>
          <Card className={`h-fit ${getCardAnimationClass(6)}`}>
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
                    customHolidays={processedCustomHolidays.filter(h => h.date)}
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
                      onClick={() => setLocation('/test/ausencias')}
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
                            Ausencia de {request.userName || 'Empleado'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Del {format(parseISO(request.startDate), 'dd/MM')} al {format(parseISO(request.endDate), 'dd/MM')}
                          </p>
                        </div>
                        
                        {/* Action icons - only show if user can manage this request */}
                        {canManageRequest(request) && (
                          <div className="flex gap-1 flex-shrink-0">
                            <button
                              onClick={() => setLocation(`/test/ausencias?requestId=${request.id}&action=approve`)}
                              className="p-1.5 rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                              title="Aprobar solicitud"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setLocation(`/test/ausencias?requestId=${request.id}&action=edit`)}
                              className="p-1.5 rounded text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                              title="Modificar solicitud"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setLocation(`/test/ausencias?requestId=${request.id}&action=deny`)}
                              className="p-1.5 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              title="Denegar solicitud"
                            >
                              <X className="w-4 h-4" />
                            </button>
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

    </div>
  );
}