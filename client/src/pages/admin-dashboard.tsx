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
import { UserAvatar } from '@/components/ui/user-avatar';
import { PaymentMethodManager } from '@/components/PaymentMethodManager';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { getNationalHolidaysForCalendar, getUpcomingHolidays } from '@/utils/spanishHolidays';

export default function AdminDashboard() {
  usePageTitle('Panel Principal');
  const { user, company } = useAuth();
  const { hasAccess } = useFeatureCheck();
  const companyAlias = company?.companyAlias || 'test';
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
  // ✨ FIXED: Cards always visible by default to prevent blank dashboard on first load
  const [visibleCards, setVisibleCards] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  // ✨ OPTIMIZED: Removed MutationObserver - CustomCalendar handles today highlighting via CSS

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

  // ⚠️ Performance: currentTime state removed - calculate directly when needed to avoid unnecessary re-renders


  // Fetch cancellation status for subscription termination warning
  const { data: cancellationStatus } = useQuery<{ scheduledForCancellation?: boolean; nextPaymentDate?: string }>({
    queryKey: ['/api/account/cancellation-status'],
    staleTime: 30000,
    refetchInterval: 300000, // ⚡ Optimizado: 5 minutos (was 60s)
  });

  // Fetch payment methods to determine if user has payment method
  const { data: paymentMethods = [] } = useQuery<any[]>({
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
  const { data: activeSession } = useQuery<any>({
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

  // ⚡ Fast pending-only query so "Resumen de Pendientes" is not blocked by full dashboard payload
  const { data: pendingSummary } = useQuery<{
    pendingVacationsCount: number;
    incompleteSessionsCount: number;
    modificationRequestsCount: number;
    unreadMessagesCount: number;
    unsignedPayrollsCount: number;
    documentRequestsCount: number;
    totalPending: number;
  }>({
    queryKey: ['/api/admin/dashboard/pending-summary'],
    staleTime: 15_000,
    enabled: user?.role === 'admin' || user?.role === 'manager',
  });

  // ✨ OPTIMIZATION: Memoize extracted data to prevent creating new arrays on every render
  const employees = useMemo(() => dashboardData?.employees || [], [dashboardData?.employees]);
  const recentSessions = useMemo(() => dashboardData?.recentSessions || [], [dashboardData?.recentSessions]);
  const messages = useMemo(() => dashboardData?.messages || [], [dashboardData?.messages]);
  const activeReminders = useMemo(() => dashboardData?.activeReminders || [], [dashboardData?.activeReminders]);
  const vacationRequests = useMemo(() => dashboardData?.vacationRequests || [], [dashboardData?.vacationRequests]);
  const approvedVacations = useMemo(() => dashboardData?.approvedVacations || [], [dashboardData?.approvedVacations]);
  const pendingVacations = useMemo(() => dashboardData?.pendingVacations || [], [dashboardData?.pendingVacations]);
  const incompleteSessions = useMemo(() => dashboardData?.incompleteSessions || [], [dashboardData?.incompleteSessions]);
  const modificationRequests = useMemo(() => dashboardData?.modificationRequests || [], [dashboardData?.modificationRequests]);

  // ✨ OPTIMIZATION: Memoize canManageRequest function to prevent recalculation
  const canManageRequest = useCallback((request: any) => {
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
  }, [user?.role, employees]);

  // ✨ OPTIMIZATION: Memoize date selection handler
  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);
  
  // Extract remaining data from consolidated response
  const unreadMessagesCount = dashboardData?.unreadMessagesCount || 0;
  const unsignedPayrollsCount = dashboardData?.unsignedPayrollsCount || 0;
  const documentRequests = dashboardData?.documentRequests || [];
  const customHolidays = dashboardData?.customHolidays || [];

  // Prefer fast pending-summary counts for the pending card and total
  const pendingVacationsCount = pendingSummary?.pendingVacationsCount ?? pendingVacations.length;
  const incompleteSessionsCount = pendingSummary?.incompleteSessionsCount ?? incompleteSessions.length;
  const modificationRequestsCount = pendingSummary?.modificationRequestsCount ?? modificationRequests.length;
  const unreadMessagesPendingCount = pendingSummary?.unreadMessagesCount ?? unreadMessagesCount;
  const unsignedPayrollsPendingCount = pendingSummary?.unsignedPayrollsCount ?? unsignedPayrollsCount;
  const documentRequestsPendingCount = pendingSummary?.documentRequestsCount ?? documentRequests.length;

  // Calculate total pending items (respecting feature access)
  const totalPending = 
    (hasAccess('time_tracking') ? incompleteSessionsCount + modificationRequestsCount : 0) + 
    (hasAccess('vacation') ? pendingVacationsCount : 0) + 
    (hasAccess('documents') ? unsignedPayrollsPendingCount + documentRequestsPendingCount : 0) + 
    (hasAccess('messages') ? unreadMessagesPendingCount : 0);

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

  // Dynamic Spanish national holidays based on calendar visible month
  const nationalHolidays = useMemo(() => 
    getNationalHolidaysForCalendar(selectedDate || new Date()), 
    [selectedDate]
  );
  
  // Upcoming national holidays for "Próximos Eventos" (limit 3 months, max 4 items)
  const upcomingNationalHolidays = useMemo(() => 
    getUpcomingHolidays(3, 4), 
    []
  );

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
  }, [nationalHolidays, processedCustomHolidays]);
  
  // Upcoming events for "Próximos Eventos" section (limited to 3 months, max 4 items)
  const upcomingEvents = useMemo(() => {
    const today = new Date();
    const threeMonthsLater = new Date(today);
    threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
    const todayStr = today.toISOString().split('T')[0];
    const limitStr = threeMonthsLater.toISOString().split('T')[0];
    
    // Combine upcoming national holidays with filtered custom holidays
    const customUpcoming = processedCustomHolidays
      .filter(h => h.date > todayStr && h.date <= limitStr)
      .reduce((acc: any[], holiday: any) => {
        if (holiday.isMultiDay) {
          const existing = acc.find(h => h.id === holiday.id);
          if (!existing) acc.push(holiday);
        } else {
          acc.push(holiday);
        }
        return acc;
      }, []);
    
    return [...upcomingNationalHolidays, ...customUpcoming]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 4);
  }, [upcomingNationalHolidays, processedCustomHolidays]);

  // ✨ OPTIMIZATION: Calculate work hours once and reuse (prevents duplicate calculations)
  const currentWorkHours = useMemo(() => {
    return calculateWorkHours(activeSession, companySettings);
  }, [activeSession, companySettings, calculateWorkHours]);

  // ✨ OPTIMIZATION: Memoize current session status to prevent recalculation
  const sessionStatus = useMemo(() => {
    if (!currentWorkHours) {
      return { state: 'inactive', label: 'Fuera del trabajo', color: 'red' };
    }
    
    if (currentWorkHours.isExceeded) {
      return { state: 'exceeded', label: 'Fuera del trabajo', color: 'red' };
    }
    
    if (activeBreak) {
      return { state: 'break', label: 'En descanso', color: 'orange' };
    }
    
    if (currentWorkHours.isOvertime) {
      return { state: 'overtime', label: 'Incompleto', color: 'red' };
    }
    
    return { state: 'working', label: 'Trabajando', color: 'green' };
  }, [currentWorkHours, activeBreak]);

  // ✨ OPTIMIZATION: Memoize filtered received messages to prevent recalculation
  const receivedMessages = useMemo(() => {
    return messages?.filter((message: any) => message.senderId !== user?.id) || [];
  }, [messages, user?.id]);

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

  // ✨ OPTIMIZED: Staggered card animation - only runs ONCE per session using RAF
  useEffect(() => {
    if (!hasAnimated && dashboardData) {
      // Reset cards for animation on first load
      setVisibleCards([]);
      const totalCards = 7;
      let currentCard = 0;
      
      const animateNextCard = () => {
        if (currentCard < totalCards) {
          setVisibleCards(prev => [...prev, currentCard]);
          currentCard++;
          
          if (currentCard < totalCards) {
            setTimeout(() => requestAnimationFrame(animateNextCard), 80);
          } else {
            sessionStorage.setItem('adminDashboardAnimated', 'true');
            setHasAnimated(true);
          }
        }
      };
      
      requestAnimationFrame(animateNextCard);
    }
  }, [hasAnimated, dashboardData]);

  // Helper function to get card animation class
  const getCardAnimationClass = (cardIndex: number) => {
    const isVisible = visibleCards.includes(cardIndex);
    return `transition-all duration-300 ease-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`;
  };

  return (
    <div>
      {/* Trial Status Management - Only visible to admins - Always visible, no animation */}
      {user?.role === 'admin' && (
        <div className="mb-6">
          <TrialManager />
        </div>
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
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 bg-${sessionStatus.color}-500 rounded-full ${sessionStatus.state !== 'inactive' && sessionStatus.state !== 'exceeded' ? 'animate-pulse' : ''}`}></div>
                        <span className={`text-${sessionStatus.color}-600 font-medium`}>{sessionStatus.label}</span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground text-center md:text-left">
                      Tu último fichaje: {getLastClockInTime()}
                    </p>
                  </div>
                <div className="flex flex-row md:flex-col justify-center gap-2">
                  {(() => {
                    // ✨ OPTIMIZED: Using memoized sessionStatus (calculated once per render)
                    const shouldShowActiveButtons = activeSession && sessionStatus.state !== 'exceeded';
                    
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
                                  <LoadingSpinner size="xs" className="mr-2" />
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
                                    <LoadingSpinner size="xs" className="mr-2" />
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
                                    <LoadingSpinner size="xs" className="mr-2" />
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
                                <LoadingSpinner size="xs" className="mr-2" />
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
                  {hasAccess('time_tracking') && incompleteSessionsCount > 0 && (
                    <button
                      onClick={() => setLocation(`/${companyAlias}/fichajes?filter=incomplete`)}
                      className="w-full flex items-center justify-between p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                          <Clock className="h-5 w-5 text-red-600 dark:text-red-400" />
                        </div>
                        <span className="text-2xl font-bold text-red-600 dark:text-red-400">{incompleteSessionsCount}</span>
                        <div>
                          <p className="font-medium text-sm">Sesiones incompletas</p>
                          <p className="text-xs text-muted-foreground">Sin fichaje de salida</p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </button>
                  )}

                  {hasAccess('time_tracking') && modificationRequestsCount > 0 && (
                    <button
                      onClick={() => setLocation(`/${companyAlias}/fichajes`)}
                      className="w-full flex items-center justify-between p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                          <Edit className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{modificationRequestsCount}</span>
                        <div>
                          <p className="font-medium text-sm">Solicitudes de fichajes</p>
                          <p className="text-xs text-muted-foreground">Modificaciones pendientes</p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </button>
                  )}

                  {hasAccess('vacation') && pendingVacationsCount > 0 && (
                    <button
                      onClick={() => setLocation(`/${companyAlias}/ausencias?filter=pending`)}
                      className="w-full flex items-center justify-between p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                          <Plane className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">{pendingVacationsCount}</span>
                        <div>
                          <p className="font-medium text-sm">Solicitudes de ausencias</p>
                          <p className="text-xs text-muted-foreground">Pendientes de aprobación</p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </button>
                  )}

                  {hasAccess('documents') && unsignedPayrollsPendingCount > 0 && (
                    <button
                      onClick={() => setLocation(`/${companyAlias}/documentos?filter=unsigned`)}
                      className="w-full flex items-center justify-between p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center flex-shrink-0">
                          <FileText className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <span className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{unsignedPayrollsPendingCount}</span>
                        <div>
                          <p className="font-medium text-sm">Documentos pendientes de firma</p>
                          <p className="text-xs text-muted-foreground">Nóminas y circulares</p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </button>
                  )}

                  {hasAccess('documents') && documentRequestsPendingCount > 0 && (
                    <button
                      onClick={() => setLocation(`/${companyAlias}/documentos`)}
                      className="w-full flex items-center justify-between p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                          <Upload className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                        </div>
                        <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">{documentRequestsPendingCount}</span>
                        <div>
                          <p className="font-medium text-sm">Solicitudes de documentos</p>
                          <p className="text-xs text-muted-foreground">Pendientes de subida</p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </button>
                  )}

                  {hasAccess('messages') && unreadMessagesPendingCount > 0 && (
                    <button
                      onClick={() => setLocation(`/${companyAlias}/mensajes`)}
                      className="w-full flex items-center justify-between p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                          <MessageSquare className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{unreadMessagesPendingCount}</span>
                        <div>
                          <p className="font-medium text-sm">Mensajes sin leer</p>
                          <p className="text-xs text-muted-foreground">Nuevas conversaciones</p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
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
                  {receivedMessages.length > 0 ? (
                    receivedMessages.map((message: any) => (
                        <div 
                          key={message.id} 
                          className="flex items-start gap-3 p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                          onClick={() => setLocation(`/${companyAlias}/mensajes?chat=${message.senderId}`)}
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
                    )}
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
                  Tareas Próximas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activeReminders && activeReminders.length > 0 ? (
                    activeReminders.map((reminder: any) => (
                      <div 
                        key={reminder.id} 
                        className="flex items-start gap-3 p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        onClick={() => setLocation(`/${companyAlias}/recordatorios`)}
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
                    <p className="text-muted-foreground text-center py-4">No hay tareas activas</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Clock-ins */}
          {hasAccess('time_tracking') && (
            <Card className={`cursor-pointer hover:shadow-md ${getCardAnimationClass(5)}`} onClick={() => setLocation(`/${companyAlias}/fichajes`)}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Fichajes Recientes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentSessions?.length > 0 ? (
                    recentSessions.slice(0, 10).map((event: any) => (
                      <div key={event.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          event.type === 'entry' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'
                        }`}>
                          {event.type === 'entry' ? (
                            <ArrowRight className="h-4 w-4 text-green-600 dark:text-green-400" />
                          ) : (
                            <ArrowLeft className="h-4 w-4 text-red-600 dark:text-red-400" />
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
              <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
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
                            <div key={idx} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
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
                            <div key={idx} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
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
                      onClick={() => setLocation(`/${companyAlias}/ausencias`)}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      ver más
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {pendingVacations.slice(0, 3).map((request: any) => (
                      <div 
                        key={request.id} 
                        className="flex items-center gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
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
                              onClick={() => setLocation(`/${companyAlias}/ausencias?requestId=${request.id}&action=approve`)}
                              className="p-1.5 rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                              title="Aprobar solicitud"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setLocation(`/${companyAlias}/ausencias?requestId=${request.id}&action=edit`)}
                              className="p-1.5 rounded text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                              title="Modificar solicitud"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setLocation(`/${companyAlias}/ausencias?requestId=${request.id}&action=deny`)}
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

              {/* Upcoming Events Section - Limited to 3 months */}
              <div className="mt-6 pt-4 border-t border-border">
                <div className="mb-3">
                  <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Próximos Eventos
                  </h4>
                </div>
                <div className="space-y-3">
                  {upcomingEvents.length > 0 ? (
                    upcomingEvents.map((holiday: any, idx: number) => {
                      const holidayDate = parseISO(holiday.date);
                      const isCustom = holiday.type === 'custom';
                    
                      return (
                        <div key={idx} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
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
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-2">No hay eventos próximos</p>
                  )}
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