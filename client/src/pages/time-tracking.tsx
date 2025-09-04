import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useFeatureCheck } from '@/hooks/use-feature-check';
import { FeatureRestrictedPage } from '@/components/feature-restricted-page';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import StatsCard from '@/components/StatsCard';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { DatePickerPeriod, DatePickerDay } from '@/components/ui/date-picker';
import { 
  Search, 
  Edit, 
  Users,
  Filter,
  TrendingUp,
  Download,
  ChevronLeft,
  CalendarDays,
  BarChart3,
  ChevronRight,
  Check,
  X,
  Clock,
  AlertTriangle,
  AlertCircle,
  LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, startOfWeek, addDays, subDays, differenceInMinutes, startOfDay, endOfDay, endOfWeek, startOfMonth, endOfMonth, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';

export default function TimeTracking() {
  const { user, company } = useAuth();
  const { hasAccess, getRequiredPlan } = useFeatureCheck();
  
  // Check if user has access to time tracking feature
  if (!hasAccess('timeTracking')) {
    return (
      <FeatureRestrictedPage
        featureName="Fichajes"
        description="Gestión de fichajes y control horario de empleados"
        requiredPlan={getRequiredPlan('timeTracking')}
        icon={Clock}
      />
    );
  }
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // All useState hooks first
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedStartDate, setSelectedStartDate] = useState<Date | null>(null);
  const [selectedEndDate, setSelectedEndDate] = useState<Date | null>(null);
  const [isRangeDialogOpen, setIsRangeDialogOpen] = useState(false);
  const [isMonthDialogOpen, setIsMonthDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<number | null>(null);
  const [editData, setEditData] = useState({
    clockIn: '',
    clockOut: '',
    date: '',
    breakPeriods: [] as Array<{breakStart: string, breakEnd: string | null}>,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showBreakTooltip, setShowBreakTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [tooltipContent, setTooltipContent] = useState('');
  const [activeStatsFilter, setActiveStatsFilter] = useState<'today' | 'week' | 'month' | 'incomplete' | null>(null);

  // Optimized query with real-time updates
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['/api/work-sessions/company?limit=40'], // Load 40 sessions with full data
    enabled: !!user && (user.role === 'admin' || user.role === 'manager'),
    staleTime: 0, // Force refetch after database changes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    retryDelay: 750,
    refetchInterval: 30 * 1000, // Refresh every 30 seconds for real-time updates
    refetchIntervalInBackground: true, // Keep updating even when window is not focused
  });

  // Employees with ultra-aggressive caching 
  const { data: employees = [] } = useQuery({
    queryKey: ['/api/employees'],
    enabled: !!user && (user.role === 'admin' || user.role === 'manager'),
    staleTime: 30 * 60 * 1000, // 30 minutes cache
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
    retry: 1,
  });

  // Company settings with maximum caching
  const { data: companySettings = {} } = useQuery({
    queryKey: ['/api/settings/work-hours'],
    enabled: !!user && (user.role === 'admin' || user.role === 'manager'),
    staleTime: 60 * 60 * 1000, // 1 hour cache
    gcTime: 4 * 60 * 60 * 1000, // 4 hours
    retry: 1,
  });

  // Helper function to check if a specific session is incomplete
  const isSessionIncomplete = useCallback((session: any) => {
    if (session.clockOut) return false; // Session is completed
    
    const maxHours = (companySettings as any)?.workingHoursPerDay || 8;
    const sessionStart = new Date(session.clockIn);
    const now = new Date();
    const elapsedHours = (now.getTime() - sessionStart.getTime()) / (1000 * 60 * 60);
    
    return elapsedHours > maxHours;
  }, [companySettings]);

  // Function to check if a day has incomplete sessions (no clockOut after max hours)
  const calculateSessionStatus = useCallback((dayData: any) => {
    if (!dayData.sessions?.length) {
      return 'complete';
    }

    // Use configured max hours or fallback to 8 hours (as configured in Test Company)
    const maxHours = (companySettings as any)?.workingHoursPerDay || 8;
    const maxMilliseconds = maxHours * 60 * 60 * 1000;
    const now = new Date();
    
    // Check for incomplete sessions (no clockOut and exceeded max hours)
    const hasIncompleteSession = dayData.sessions.some((session: any) => {
      if (session.clockOut) {
        // Session is completed, ignore it
        return false;
      }
      
      // Check if session started more than maxHours ago
      const sessionStart = new Date(session.clockIn);
      const timeSinceStart = now.getTime() - sessionStart.getTime();
      
      return timeSinceStart > maxMilliseconds;
    });
    

    
    return hasIncompleteSession ? 'incomplete' : 'complete';
  }, [companySettings]);

  // All useMutation hooks
  const updateSessionMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest('PATCH', `/api/work-sessions/${id}`, data),
    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ['/api/work-sessions/company'] });

      // Snapshot the previous value
      const previousSessions = queryClient.getQueryData(['/api/work-sessions/company']);

      // Optimistically update to the new value
      queryClient.setQueryData(['/api/work-sessions/company'], (old: any) => {
        if (!old) return old;
        
        return old.map((session: any) => {
          if (session.id === id) {
            return {
              ...session,
              ...data,
              // Ensure date fields are properly formatted
              clockIn: data.clockIn,
              clockOut: data.clockOut || session.clockOut,
              breakPeriods: data.breakPeriods || session.breakPeriods
            };
          }
          return session;
        });
      });

      // Return a context object with the snapshotted value
      return { previousSessions };
    },
    onSuccess: () => {
      // Update UI immediately
      toast({
        title: 'Fichaje Actualizado',
        description: 'Los cambios se han guardado exitosamente.',
      });
      setEditingSession(null);
      setEditData({ clockIn: '', clockOut: '', date: '', breakPeriods: [] });
      
      // Refetch to ensure data consistency (but UI already updated)
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions/company'] });
    },
    onError: (error: any, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousSessions) {
        queryClient.setQueryData(['/api/work-sessions/company'], context.previousSessions);
      }
      
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar el fichaje.',
        variant: 'destructive',
      });
    },
  });

  // Force complete session mutation for handling individual incomplete sessions
  const forceCompleteSessionMutation = useMutation({
    mutationFn: async (sessionId: number) => {
      // Get company work hours configuration
      const maxHours = (companySettings as any)?.workingHoursPerDay || 8;
      
      // Find the session to complete
      const sessionToComplete = (sessions as any[]).find((s: any) => s.id === sessionId);
      if (!sessionToComplete) {
        throw new Error('Sesión no encontrada');
      }
      
      // Calculate clockOut time: clockIn + maxHours
      const clockInDate = new Date(sessionToComplete.clockIn);
      const clockOutDate = new Date(clockInDate.getTime() + (maxHours * 60 * 60 * 1000));
      
      return apiRequest('PATCH', `/api/work-sessions/${sessionId}`, {
        clockOut: clockOutDate.toISOString()
      });
    },
    onMutate: async (sessionId: number) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['/api/work-sessions/company'] });

      // Snapshot the previous value
      const previousSessions = queryClient.getQueryData(['/api/work-sessions/company']);

      // Get the session and calculate clockOut
      const maxHours = (companySettings as any)?.workingHoursPerDay || 8;
      const sessionToComplete = (sessions as any[])?.find((s: any) => s.id === sessionId);
      
      if (sessionToComplete) {
        const clockInDate = new Date(sessionToComplete.clockIn);
        const clockOutDate = new Date(clockInDate.getTime() + (maxHours * 60 * 60 * 1000));

        // Optimistically update the session
        queryClient.setQueryData(['/api/work-sessions/company'], (old: any) => {
          if (!old) return old;
          
          return old.map((session: any) => {
            if (session.id === sessionId) {
              return {
                ...session,
                clockOut: clockOutDate.toISOString()
              };
            }
            return session;
          });
        });
      }

      return { previousSessions };
    },
    onSuccess: () => {
      toast({
        title: 'Sesión Completada',
        description: 'La sesión incompleta se ha cerrado automáticamente con las horas configuradas.',
      });
      
      // Refetch to ensure data consistency
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions/company'] });
    },
    onError: (error: any, variables, context) => {
      // Roll back on error
      if (context?.previousSessions) {
        queryClient.setQueryData(['/api/work-sessions/company'], context.previousSessions);
      }
      
      toast({
        title: 'Error',
        description: error.message || 'No se pudo completar la sesión.',
        variant: 'destructive',
      });
    },
  });

  // ⚠️ PROTECTED: Session editing and time calculation functions - DO NOT MODIFY
  // These functions are CRITICAL for time tracking accuracy and must remain stable
  const handleEditSession = useCallback((session: any) => {
    setEditingSession(session.id);
    
    // Format break periods for editing
    const formattedBreaks = (session.breakPeriods || []).map((bp: any) => ({
      breakStart: bp.breakStart ? format(new Date(bp.breakStart), 'HH:mm') : '',
      breakEnd: bp.breakEnd ? format(new Date(bp.breakEnd), 'HH:mm') : '',
    }));
    
    setEditData({
      clockIn: session.clockIn ? format(new Date(session.clockIn), 'HH:mm') : '',
      clockOut: session.clockOut ? format(new Date(session.clockOut), 'HH:mm') : '',
      date: format(new Date(session.clockIn), 'yyyy-MM-dd'),
      breakPeriods: formattedBreaks,
    });
  }, []);

  const handleSaveSession = useCallback((sessionId: number) => {
    const clockInDateTime = new Date(`${editData.date}T${editData.clockIn}:00`);
    const clockOutDateTime = editData.clockOut ? new Date(`${editData.date}T${editData.clockOut}:00`) : null;
    
    // Format break periods back to ISO format
    const formattedBreakPeriods = editData.breakPeriods
      .filter(bp => bp.breakStart) // Only include breaks with start time
      .map(bp => ({
        breakStart: new Date(`${editData.date}T${bp.breakStart}:00`).toISOString(),
        breakEnd: bp.breakEnd ? new Date(`${editData.date}T${bp.breakEnd}:00`).toISOString() : null,
      }));
    
    updateSessionMutation.mutate({
      id: sessionId,
      data: {
        clockIn: clockInDateTime.toISOString(),
        clockOut: clockOutDateTime?.toISOString() || null,
        breakPeriods: formattedBreakPeriods,
      }
    });
  }, [editData, updateSessionMutation]);

  const handleCancelEdit = useCallback(() => {
    setEditingSession(null);
    setEditData({ clockIn: '', clockOut: '', date: '', breakPeriods: [] });
  }, []);

  // Break period management functions
  const handleAddBreakPeriod = useCallback(() => {
    setEditData(prev => ({
      ...prev,
      breakPeriods: [...prev.breakPeriods, { breakStart: '', breakEnd: '' }]
    }));
  }, []);

  const handleUpdateBreakPeriod = useCallback((index: number, field: 'breakStart' | 'breakEnd', value: string) => {
    setEditData(prev => ({
      ...prev,
      breakPeriods: prev.breakPeriods.map((bp, i) => 
        i === index ? { ...bp, [field]: value } : bp
      )
    }));
  }, []);

  const handleRemoveBreakPeriod = useCallback((index: number) => {
    setEditData(prev => ({
      ...prev,
      breakPeriods: prev.breakPeriods.filter((_, i) => i !== index)
    }));
  }, []);

  // Quick filter functions for stats cards
  const handleResetFilters = useCallback(() => {
    setDateFilter('all');
    setSelectedEmployee('all');
    setStartDate('');
    setEndDate('');
    setSelectedStartDate(null);
    setSelectedEndDate(null);
  }, []);

  const handleTodayFilter = useCallback(() => {
    if (activeStatsFilter === 'today') {
      // Desactivar filtro - volver a mostrar todo
      setActiveStatsFilter(null);
      setDateFilter('all');
      setStartDate('');
      setEndDate('');
      setSelectedStartDate(null);
      setSelectedEndDate(null);
    } else {
      // Activar filtro de hoy
      const today = new Date();
      setActiveStatsFilter('today');
      setDateFilter('custom');
      setSelectedEmployee('all');
      setStartDate(format(startOfDay(today), 'yyyy-MM-dd'));
      setEndDate(format(endOfDay(today), 'yyyy-MM-dd'));
      setSelectedStartDate(startOfDay(today));
      setSelectedEndDate(endOfDay(today));
    }
  }, [activeStatsFilter]);

  const handleThisWeekFilter = useCallback(() => {
    if (activeStatsFilter === 'week') {
      // Desactivar filtro - volver a mostrar todo
      setActiveStatsFilter(null);
      setDateFilter('all');
      setStartDate('');
      setEndDate('');
      setSelectedStartDate(null);
      setSelectedEndDate(null);
    } else {
      // Activar filtro de esta semana
      const today = new Date();
      const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday start
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
      setActiveStatsFilter('week');
      setDateFilter('custom');
      setSelectedEmployee('all');
      setStartDate(format(startOfDay(weekStart), 'yyyy-MM-dd'));
      setEndDate(format(endOfDay(weekEnd), 'yyyy-MM-dd'));
      setSelectedStartDate(startOfDay(weekStart));
      setSelectedEndDate(endOfDay(weekEnd));
    }
  }, [activeStatsFilter]);

  const handleThisMonthFilter = useCallback(() => {
    if (activeStatsFilter === 'month') {
      // Desactivar filtro - volver a mostrar todo
      setActiveStatsFilter(null);
      setDateFilter('all');
      setStartDate('');
      setEndDate('');
      setSelectedStartDate(null);
      setSelectedEndDate(null);
    } else {
      // Activar filtro de este mes
      const today = new Date();
      const monthStart = startOfMonth(today);
      const monthEnd = endOfMonth(today);
      setActiveStatsFilter('month');
      setDateFilter('custom');
      setSelectedEmployee('all');
      setStartDate(format(startOfDay(monthStart), 'yyyy-MM-dd'));
      setEndDate(format(endOfDay(monthEnd), 'yyyy-MM-dd'));
      setSelectedStartDate(startOfDay(monthStart));
      setSelectedEndDate(endOfDay(monthEnd));
    }
  }, [activeStatsFilter]);

  const handleIncompleteFilter = useCallback(() => {
    if (activeStatsFilter === 'incomplete') {
      // Desactivar filtro - volver a mostrar todo
      setActiveStatsFilter(null);
      setDateFilter('all');
      setStartDate('');
      setEndDate('');
      setSelectedStartDate(null);
      setSelectedEndDate(null);
    } else {
      // Activar filtro de sesiones incompletas - no cambiar fechas, solo filtrar por estado
      setActiveStatsFilter('incomplete');
      setSelectedEmployee('all');
    }
  }, [activeStatsFilter]);

  // ⚠️ PROTECTED: Time calculation function - CRITICAL FOR ACCURACY
  const calculateHours = useCallback((clockIn: string, clockOut: string | null) => {
    if (!clockOut) return 0;
    return (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / (1000 * 60 * 60);
  }, []);
  // ⚠️ END PROTECTED SECTION

  // ⚠️ PROTECTED: Data processing and filtering functions - DO NOT MODIFY
  // These functions are CRITICAL for data accuracy and filtering logic
  const { employeesList, sessionsList, availableMonths } = useMemo(() => {
    const allEmployees = (employees as any[]) || [];
    // Include admin for employee list so admin can see their own time tracking
    const filteredEmployees = allEmployees;
    // Include all sessions including admin sessions
    const filteredSessions = (sessions as any[]) || [];

    const months = filteredSessions.reduce((acc: string[], session: any) => {
      const monthKey = format(new Date(session.clockIn), 'yyyy-MM');
      if (!acc.includes(monthKey)) acc.push(monthKey);
      return acc;
    }, []).sort().reverse();

    return {
      employeesList: filteredEmployees,
      sessionsList: filteredSessions,
      availableMonths: months
    };
  }, [employees, sessions]);

  const filteredSessions = useMemo(() => {
    return sessionsList.filter((session: any) => {
      const sessionDate = new Date(session.clockIn);
      
      const matchesEmployee = selectedEmployee === 'all' || session.userId.toString() === selectedEmployee;
      const matchesSearch = session.userName?.toLowerCase().includes(searchTerm.toLowerCase());
      
      let matchesDate = true;
      if (dateFilter === 'today') {
        const today = new Date();
        const dayStart = new Date(today);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(today);
        dayEnd.setHours(23, 59, 59, 999);
        matchesDate = sessionDate >= dayStart && sessionDate <= dayEnd;
      } else if (dateFilter === 'day') {
        const dayStart = new Date(currentDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(currentDate);
        dayEnd.setHours(23, 59, 59, 999);
        matchesDate = sessionDate >= dayStart && sessionDate <= dayEnd;
      } else if (dateFilter === 'month') {
        const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
        monthEnd.setHours(23, 59, 59, 999);
        matchesDate = sessionDate >= monthStart && sessionDate <= monthEnd;
      } else if (dateFilter === 'custom' && (startDate || endDate)) {
        const filterStart = startDate ? new Date(startDate) : new Date(0);
        const filterEnd = endDate ? new Date(endDate) : new Date();
        if (endDate) filterEnd.setHours(23, 59, 59, 999);
        matchesDate = sessionDate >= filterStart && sessionDate <= filterEnd;
      } else if (dateFilter === 'all') {
        matchesDate = true; // No aplicar filtro de fecha
      }

      // Filtro específico para sesiones incompletas
      if (activeStatsFilter === 'incomplete') {
        if (!session.clockOut) {
          // Solo mostrar sesiones sin clockOut que excedan las horas máximas configuradas
          const clockInTime = new Date(session.clockIn).getTime();
          const now = Date.now();
          const hoursElapsed = (now - clockInTime) / (1000 * 60 * 60);
          const maxHours = (companySettings as any)?.workingHoursPerDay || 8;
          
          // Solo mostrar como incompleta si han pasado más horas que las configuradas
          return matchesEmployee && matchesSearch && matchesDate && hoursElapsed > maxHours;
        } else {
          // Si tiene clockOut, no es incompleta
          return false;
        }
      }
      
      return matchesEmployee && matchesSearch && matchesDate;
    });
  }, [sessionsList, selectedEmployee, searchTerm, dateFilter, currentDate, currentMonth, startDate, endDate, activeStatsFilter, companySettings]);

  // Generate dynamic title based on filter
  const getFilterTitle = () => {
    switch (dateFilter) {
      case 'today':
        return 'Fichajes de hoy';
      case 'day':
        return `Fichajes del ${format(currentDate, 'd MMMM yyyy', { locale: es })}`;
      case 'month':
        return `Fichajes de ${format(currentMonth, 'MMMM yyyy', { locale: es })}`;
      case 'custom':
        if (startDate && endDate) {
          return `Fichajes del ${format(new Date(startDate), 'd MMM', { locale: es })} al ${format(new Date(endDate), 'd MMM yyyy', { locale: es })}`;
        }
        return 'Fichajes personalizados';
      case 'all':
      default:
        return 'Todos los fichajes';
    }
  };

  // ⚠️ PROTECTED: Statistics calculation functions - CRITICAL FOR REPORTING
  const { employeesWithSessions, totalEmployees, averageHoursPerEmployee, averageHoursPerWeek, averageHoursPerMonth, incompleteSessions } = useMemo(() => {
    const uniqueEmployees = new Set(filteredSessions.map((s: any) => s.userId)).size;
    const totalHours = filteredSessions.reduce((total: number, session: any) => {
      let sessionHours = calculateHours(session.clockIn, session.clockOut);
      
      // Validación: Limitar a máximo 24 horas por sesión
      if (sessionHours > 24) {
        sessionHours = 24;
      }
      
      const breakHours = session.breakPeriods 
        ? session.breakPeriods.reduce((breakTotal: number, breakPeriod: any) => {
            return breakTotal + calculateHours(breakPeriod.breakStart, breakPeriod.breakEnd);
          }, 0) 
        : 0;
      return total + Math.max(0, sessionHours - breakHours);
    }, 0);
    
    // Calculate average hours per worker per day
    let averageHoursPerDay = 0;
    let averageHoursWeekly = 0;
    let averageHoursMonthly = 0;
    
    if (filteredSessions.length > 0) {
      // Group sessions by employee and day to count unique working days
      const employeeDays = new Set();
      const employeeWeeks = new Set();
      const employeeMonths = new Set();
      
      filteredSessions.forEach((session: any) => {
        const sessionDate = new Date(session.clockIn);
        const dayKey = `${session.userId}-${format(sessionDate, 'yyyy-MM-dd')}`;
        const weekKey = `${session.userId}-${format(sessionDate, 'yyyy-ww')}`;
        const monthKey = `${session.userId}-${format(sessionDate, 'yyyy-MM')}`;
        
        employeeDays.add(dayKey);
        employeeWeeks.add(weekKey);
        employeeMonths.add(monthKey);
      });
      
      // Calculate averages
      averageHoursPerDay = totalHours / employeeDays.size;
      averageHoursWeekly = totalHours / employeeWeeks.size;
      averageHoursMonthly = totalHours / employeeMonths.size;
    }

    // Calculate incomplete sessions - sessions without clockOut that exceed working hours
    const incompleteSessionsCount = (sessionsList || []).filter((session: any) => {
      if (session.clockOut) return false; // Has clockOut, not incomplete
      
      const clockInTime = new Date(session.clockIn).getTime();
      const now = Date.now();
      const hoursElapsed = (now - clockInTime) / (1000 * 60 * 60);
      const maxHours = (companySettings as any)?.workingHoursPerDay || 8;
      
      return hoursElapsed > maxHours;
    }).length;
    
    return {
      employeesWithSessions: uniqueEmployees,
      totalEmployees: employeesList.length,
      averageHoursPerEmployee: averageHoursPerDay,
      averageHoursPerWeek: averageHoursWeekly,
      averageHoursPerMonth: averageHoursMonthly,
      incompleteSessions: incompleteSessionsCount
    };
  }, [filteredSessions, employeesList.length, calculateHours, sessionsList, companySettings]);
  // ⚠️ END PROTECTED SECTION

  // ⚠️ PROTECTED: PDF generation function - CRITICAL FOR REPORTING
  const handleExportPDF = useCallback(() => {
    const doc = new jsPDF();
    
    // Get period text for reuse
    let periodText = '';
    if (dateFilter === 'day') {
      periodText = format(currentDate, 'dd/MM/yyyy', { locale: es });
    } else if (dateFilter === 'month') {
      periodText = format(currentMonth, 'MMMM yyyy', { locale: es });
    } else if (dateFilter === 'custom' && (startDate || endDate)) {
      if (startDate && endDate) {
        periodText = `${format(new Date(startDate), 'dd/MM/yyyy')} - ${format(new Date(endDate), 'dd/MM/yyyy')}`;
      } else if (startDate) {
        periodText = `Desde ${format(new Date(startDate), 'dd/MM/yyyy')}`;
      } else if (endDate) {
        periodText = `Hasta ${format(new Date(endDate), 'dd/MM/yyyy')}`;
      }
    } else {
      periodText = 'Todos los registros';
    }



    // Function to create a page for an employee
    const createEmployeePage = (employee: any, employeeSessions: any[], isFirstPage: boolean) => {
      if (!isFirstPage) {
        doc.addPage();
      }
      
      // Helper function to add header to new page
      const addPageHeader = () => {
        // Company info (right aligned with elegant styling) - Using real company data
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(31, 51, 71); // Elegant dark blue
        doc.text(company?.name || 'Empresa', 190, 20, { align: 'right' });
        
        // Subtle divider line
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(140, 24, 190, 24);
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(85, 85, 85); // Professional gray
        let yPos = 28;
        
        if (company?.cif) {
          doc.text(`CIF: ${company.cif}`, 190, yPos, { align: 'right' });
          yPos += 4;
        }
        if (company?.address) {
          doc.text(company.address, 190, yPos, { align: 'right' });
          yPos += 4;
        }
        if (company?.province) {
          doc.text(company.province, 190, yPos, { align: 'right' });
          yPos += 4;
        }
        if (company?.phone) {
          doc.text(`Tel: ${company.phone}`, 190, yPos, { align: 'right' });
        }
        
        // Clean report title
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(31, 51, 71); // Professional dark blue
        doc.text('INFORME DE CONTROL HORARIO', 20, 25);
        
        // Employee info with modern styling
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(31, 51, 71);
        doc.text('EMPLEADO', 20, 40);
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(85, 85, 85);
        doc.text(employee?.fullName || 'Empleado Desconocido', 20, 46);
        
        if (employee?.dni) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(128, 128, 128);
          doc.text(`DNI: ${employee.dni}`, 20, 51);
        }
        
        // Period info with elegant layout
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(31, 51, 71);
        doc.text('PERÍODO', 120, 40);
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(85, 85, 85);
        doc.text(periodText, 120, 46);
        
        // Clean table header without background
        const headerY = 62;
        
        // Header text with professional styling
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(31, 51, 71);
        doc.text('FECHA', colPositions[0], headerY);
        doc.text('ENTRADA', colPositions[1], headerY);
        doc.text('SALIDA', colPositions[2], headerY);
        doc.text('DESCANSOS', colPositions[3], headerY);
        doc.text('HORAS', colPositions[4], headerY);
        
        return headerY + 5; // Return starting Y position for content
      };
      
      // Helper function to add clean footer
      const addFooter = () => {
        const reportDate = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es });
        const pageHeight = doc.internal.pageSize.height;
        
        // Footer top line
        doc.setDrawColor(31, 51, 71);
        doc.setLineWidth(0.8);
        doc.line(20, pageHeight - 25, 190, pageHeight - 25);
        
        // Company and generation info with elegant layout
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(85, 85, 85);
        doc.text(`${company?.name || 'Oficaz'} - Sistema de Control Horario`, 20, pageHeight - 18);
        
        doc.setTextColor(128, 128, 128);
        doc.text(`Generado: ${reportDate}`, 190, pageHeight - 18, { align: 'right' });
        
        // Oficaz branding
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 122, 255);
        doc.text('Generado por Oficaz', 105, pageHeight - 10, { align: 'center' });
        
        // Page number with elegant styling
        const pageCount = doc.getNumberOfPages();
        if (pageCount > 1) {
          doc.setFontSize(8);
          doc.setTextColor(85, 85, 85);
          doc.text(`Página ${doc.getCurrentPageInfo().pageNumber} de ${pageCount}`, 190, pageHeight - 10, { align: 'right' });
        }
      };
      
      // Table setup for individual employee (no employee column needed)
      const tableStartX = 50;
      const colWidths = [30, 22, 22, 30, 20];
      const colPositions = [
        tableStartX, 
        tableStartX + colWidths[0], 
        tableStartX + colWidths[0] + colWidths[1], 
        tableStartX + colWidths[0] + colWidths[1] + colWidths[2],
        tableStartX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3]
      ];
      
      // Add header to first page
      let currentY = addPageHeader();
      
      // Sort sessions by date
      const sortedSessions = [...employeeSessions].sort((a, b) => new Date(a.clockIn).getTime() - new Date(b.clockIn).getTime());
      
      // Track totals for summaries
      let weekHours = 0;
      let monthHours = 0;
      let currentWeekStart: Date | null = null;
      let currentMonth: string | null = null;
      const pageHeight = doc.internal.pageSize.height;
      const maxContentY = pageHeight - 35; // Reserve space for footer
      
      const showSummaries = true; // Always show summaries for individual employees
      
      if (showSummaries && sortedSessions.length > 0) {
        sortedSessions.forEach((session: any, index: number) => {
          const sessionDate = new Date(session.clockIn);
          // Calculate total session hours minus break time
          const sessionHours = calculateHours(session.clockIn, session.clockOut);
          const breakHours = session.breakPeriods 
            ? session.breakPeriods.reduce((breakTotal: number, breakPeriod: any) => {
                if (breakPeriod.breakEnd) {
                  return breakTotal + calculateHours(breakPeriod.breakStart, breakPeriod.breakEnd);
                }
                return breakTotal;
              }, 0)
            : 0;
          const hours = Math.max(0, sessionHours - breakHours);
          
          // Calculate week start (Monday)
          const weekStart = startOfWeek(sessionDate, { weekStartsOn: 1 });
          const monthKey = format(sessionDate, 'yyyy-MM');
          
          const isNewWeek = currentWeekStart === null || weekStart.getTime() !== currentWeekStart.getTime();
          const isNewMonth = currentMonth === null || monthKey !== currentMonth;
          
          // NEW PAGE FOR EACH MONTH - Add month summary and create new page
          if (isNewMonth && index > 0 && currentMonth) {
            // Add previous month summary
            const [year, month] = currentMonth.split('-');
            const monthName = format(new Date(parseInt(year), parseInt(month) - 1), 'MMMM yyyy', { locale: es });
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 122, 255);
            doc.text(`TOTAL ${monthName.toUpperCase()}:`, colPositions[0], currentY);
            doc.text(`${monthHours.toFixed(1)}h`, colPositions[4], currentY);
            
            // Add footer and create new page for new month
            addFooter();
            doc.addPage();
            currentY = addPageHeader();
            
            monthHours = 0;
          }
          
          // Add week summary (only if not starting a new month)
          if (isNewWeek && index > 0 && currentWeekStart && !isNewMonth) {
            // Check if we need a new page for week summary
            if (currentY > maxContentY - 15) {
              addFooter();
              doc.addPage();
              currentY = addPageHeader();
            }
            
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(80, 80, 80);
            doc.text('TOTAL SEMANA:', colPositions[0], currentY);
            doc.text(`${weekHours.toFixed(1)}h`, colPositions[4], currentY);
            currentY += 7;
            weekHours = 0;
          }
          
          if (isNewWeek) currentWeekStart = weekStart;
          if (isNewMonth) currentMonth = monthKey;
          
          // Check if we need a new page before adding regular row (only within same month)
          if (currentY > maxContentY) {
            addFooter();
            doc.addPage();
            currentY = addPageHeader();
          }
          
          // Regular row
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(40, 40, 40);
          
          // Main row with session data
          doc.text(format(sessionDate, 'dd/MM/yyyy'), colPositions[0], currentY);
          doc.text(format(sessionDate, 'HH:mm'), colPositions[1], currentY);
          doc.text(session.clockOut ? format(new Date(session.clockOut), 'HH:mm') : '-', colPositions[2], currentY);
          
          // Handle break periods - create separate rows for each break
          const breakPeriods = session.breakPeriods || [];
          if (breakPeriods.length === 0) {
            doc.text('Sin descansos', colPositions[3], currentY);
            doc.text(hours > 0 ? `${hours.toFixed(1)}h` : '-', colPositions[4], currentY);
            currentY += 6;
          } else {
            // First break on main row
            const firstBreak = breakPeriods[0];
            try {
              const startTime = format(new Date(firstBreak.breakStart), 'HH:mm');
              const endTime = firstBreak.breakEnd ? format(new Date(firstBreak.breakEnd), 'HH:mm') : 'En curso';
              if (firstBreak.breakEnd) {
                const duration = Math.round((new Date(firstBreak.breakEnd).getTime() - new Date(firstBreak.breakStart).getTime()) / (1000 * 60));
                doc.text(`${startTime}-${endTime} (${duration} min)`, colPositions[3], currentY);
              } else {
                doc.text(`${startTime} (En curso)`, colPositions[3], currentY);
              }
            } catch (error) {
              doc.text('Descanso (datos inválidos)', colPositions[3], currentY);
            }
            doc.text(hours > 0 ? `${hours.toFixed(1)}h` : '-', colPositions[4], currentY);
            currentY += 6;
            
            // Additional breaks in separate rows (empty cells except for break info)
            for (let i = 1; i < breakPeriods.length; i++) {
              // Check if we need a new page for additional break row
              if (currentY > maxContentY) {
                addFooter();
                doc.addPage();
                currentY = addPageHeader();
              }
              
              const breakPeriod = breakPeriods[i];
              try {
                const startTime = format(new Date(breakPeriod.breakStart), 'HH:mm');
                const endTime = breakPeriod.breakEnd ? format(new Date(breakPeriod.breakEnd), 'HH:mm') : 'En curso';
                if (breakPeriod.breakEnd) {
                  const duration = Math.round((new Date(breakPeriod.breakEnd).getTime() - new Date(breakPeriod.breakStart).getTime()) / (1000 * 60));
                  doc.text(`${startTime}-${endTime} (${duration} min)`, colPositions[3], currentY);
                } else {
                  doc.text(`${startTime} (En curso)`, colPositions[3], currentY);
                }
              } catch (error) {
                doc.text('Descanso (datos inválidos)', colPositions[3], currentY);
              }
              currentY += 6;
            }
          }
          weekHours += hours;
          monthHours += hours;
          
          // Final summaries for the last session
          if (index === sortedSessions.length - 1) {
            // Check if we need a new page for final summaries
            if (currentY > maxContentY - 15) {
              addFooter();
              doc.addPage();
              currentY = addPageHeader();
            }
            
            // Add final week summary if exists
            if (weekHours > 0) {
              doc.setFontSize(8);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(80, 80, 80);
              doc.text('TOTAL SEMANA:', colPositions[0], currentY);
              doc.text(`${weekHours.toFixed(1)}h`, colPositions[4], currentY);
              currentY += 7;
            }
            
            // Add final month summary
            if (monthHours > 0 && currentMonth) {
              const [year, month] = currentMonth.split('-');
              const monthName = format(new Date(parseInt(year), parseInt(month) - 1), 'MMMM yyyy', { locale: es });
              doc.setFontSize(8);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(0, 122, 255);
              doc.text(`TOTAL ${monthName.toUpperCase()}:`, colPositions[0], currentY);
              doc.text(`${monthHours.toFixed(1)}h`, colPositions[3], currentY);
            }
          }
        });
      } else {
        sortedSessions.forEach((session: any) => {
          // Check if we need a new page
          if (currentY > maxContentY) {
            addFooter();
            doc.addPage();
            currentY = addPageHeader();
          }
          
          const sessionDate = new Date(session.clockIn);
          // Calculate total session hours minus break time
          const sessionHours = calculateHours(session.clockIn, session.clockOut);
          const breakHours = session.breakPeriods 
            ? session.breakPeriods.reduce((breakTotal: number, breakPeriod: any) => {
                if (breakPeriod.breakEnd) {
                  return breakTotal + calculateHours(breakPeriod.breakStart, breakPeriod.breakEnd);
                }
                return breakTotal;
              }, 0)
            : 0;
          const hours = Math.max(0, sessionHours - breakHours);
          
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(40, 40, 40);
          
          // Main row with session data
          doc.text(format(sessionDate, 'dd/MM/yyyy'), colPositions[0], currentY);
          doc.text(format(sessionDate, 'HH:mm'), colPositions[1], currentY);
          doc.text(session.clockOut ? format(new Date(session.clockOut), 'HH:mm') : '-', colPositions[2], currentY);
          
          // Handle break periods - create separate rows for each break
          const breakPeriods = session.breakPeriods || [];
          if (breakPeriods.length === 0) {
            doc.text('Sin descansos', colPositions[3], currentY);
            doc.text(hours > 0 ? `${hours.toFixed(1)}h` : '-', colPositions[4], currentY);
            currentY += 6;
          } else {
            // First break on main row
            const firstBreak = breakPeriods[0];
            try {
              const startTime = format(new Date(firstBreak.breakStart), 'HH:mm');
              const endTime = firstBreak.breakEnd ? format(new Date(firstBreak.breakEnd), 'HH:mm') : 'En curso';
              if (firstBreak.breakEnd) {
                const duration = Math.round((new Date(firstBreak.breakEnd).getTime() - new Date(firstBreak.breakStart).getTime()) / (1000 * 60));
                doc.text(`${startTime}-${endTime} (${duration} min)`, colPositions[3], currentY);
              } else {
                doc.text(`${startTime} (En curso)`, colPositions[3], currentY);
              }
            } catch (error) {
              doc.text('Descanso (datos inválidos)', colPositions[3], currentY);
            }
            doc.text(hours > 0 ? `${hours.toFixed(1)}h` : '-', colPositions[4], currentY);
            currentY += 6;
            
            // Additional breaks in separate rows (empty cells except for break info)
            for (let i = 1; i < breakPeriods.length; i++) {
              // Check if we need a new page for additional break row
              if (currentY > maxContentY) {
                addFooter();
                doc.addPage();
                currentY = addPageHeader();
              }
              
              const breakPeriod = breakPeriods[i];
              try {
                const startTime = format(new Date(breakPeriod.breakStart), 'HH:mm');
                const endTime = breakPeriod.breakEnd ? format(new Date(breakPeriod.breakEnd), 'HH:mm') : 'En curso';
                if (breakPeriod.breakEnd) {
                  const duration = Math.round((new Date(breakPeriod.breakEnd).getTime() - new Date(breakPeriod.breakStart).getTime()) / (1000 * 60));
                  doc.text(`${startTime}-${endTime} (${duration} min)`, colPositions[3], currentY);
                } else {
                  doc.text(`${startTime} (En curso)`, colPositions[3], currentY);
                }
              } catch (error) {
                doc.text('Descanso (datos inválidos)', colPositions[3], currentY);
              }
              currentY += 6;
            }
          }
        });
      }
      
      // Add footer to the last page of this employee
      addFooter();
    };

    if (selectedEmployee !== 'all') {
      // Single employee PDF
      const employee = employeesList.find(emp => emp.id.toString() === selectedEmployee);
      createEmployeePage(employee, filteredSessions, true);
    } else {
      // Multiple employees - one page per employee
      const employeesWithSessions = (employeesList || []).filter(employee => 
        (filteredSessions || []).some(session => session.userId === employee.id)
      );
      
      employeesWithSessions.forEach((employee, index) => {
        const employeeSessions = (filteredSessions || []).filter(session => session.userId === employee.id);
        createEmployeePage(employee, employeeSessions, index === 0);
      });
    }

    // Generate friendly filename format: Employee - Time filter - Export date/time
    const generateFriendlyFileName = () => {
      // Employee part
      let employeePart = 'Todos los empleados';
      if (selectedEmployee !== 'all') {
        const employee = employeesList?.find(emp => emp.id.toString() === selectedEmployee);
        employeePart = employee?.fullName || 'Empleado';
      }
      
      // Time filter part
      let timePart = 'todos los fichajes';
      if (dateFilter === 'today') {
        timePart = 'hoy';
      } else if (dateFilter === 'month') {
        timePart = format(currentMonth, 'MMMM yyyy', { locale: es });
      } else if (dateFilter === 'custom' && (startDate || endDate)) {
        if (startDate && endDate) {
          timePart = `${format(new Date(startDate), 'dd-MM-yyyy')} - ${format(new Date(endDate), 'dd-MM-yyyy')}`;
        } else if (startDate) {
          timePart = `desde ${format(new Date(startDate), 'dd-MM-yyyy')}`;
        } else if (endDate) {
          timePart = `hasta ${format(new Date(endDate), 'dd-MM-yyyy')}`;
        }
      }
      
      // Export date/time part (format: DD-MM-YY - HH-MM)
      const exportDateTime = format(new Date(), 'dd-MM-yy - HH-mm');
      
      // Clean filename (replace invalid characters)
      const cleanName = `${employeePart} - ${timePart} - ${exportDateTime}`
        .replace(/[/\\?%*:|"<>]/g, '-')  // Replace invalid filename characters
        .replace(/\s+/g, ' ')            // Normalize spaces
        .trim();
      
      return `${cleanName}.pdf`;
    };

    const fileName = generateFriendlyFileName();
    
    doc.save(fileName);
    
    toast({
      title: "PDF exportado correctamente",
      description: `El archivo ${fileName} se ha descargado`,
    });
  }, [filteredSessions, selectedEmployee, employeesList, dateFilter, currentDate, currentMonth, startDate, endDate, calculateHours, toast]);

  // Timeline Bar Component for displaying work sessions with break periods
  const TimelineBar = ({ session }: { session: any }) => {
    if (!session.clockIn || !session.clockOut) {
      return (
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <Clock className="w-4 h-4" />
          <span>Sesión en curso</span>
        </div>
      );
    }

    const clockIn = new Date(session.clockIn);
    const clockOut = new Date(session.clockOut);
    const totalSessionMinutes = differenceInMinutes(clockOut, clockIn);
    const breakPeriods = session.breakPeriods || [];

    // Calculate total break duration
    const totalBreakMinutes = breakPeriods.reduce((total: number, breakPeriod: any) => {
      if (breakPeriod.breakEnd) {
        return total + differenceInMinutes(new Date(breakPeriod.breakEnd), new Date(breakPeriod.breakStart));
      }
      return total;
    }, 0);

    const formatTime = (date: Date) => format(date, 'HH:mm');
    const formatDuration = (minutes: number) => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    };

    return (
      <div className="space-y-2">
        {/* Timeline visualization */}
        <div className="relative h-8 bg-gray-100 rounded-lg overflow-hidden">
          {/* Main work session bar */}
          <div className="absolute inset-0 bg-blue-500 rounded-lg"></div>
          
          {/* Break periods as orange bars */}
          {breakPeriods.map((breakPeriod: any, index: number) => {
            if (!breakPeriod.breakEnd) return null;
            
            const breakStart = new Date(breakPeriod.breakStart);
            const breakEnd = new Date(breakPeriod.breakEnd);
            const breakStartMinutes = differenceInMinutes(breakStart, clockIn);
            const breakDurationMinutes = differenceInMinutes(breakEnd, breakStart);
            
            const leftPercentage = (breakStartMinutes / totalSessionMinutes) * 100;
            const widthPercentage = (breakDurationMinutes / totalSessionMinutes) * 100;
            
            return (
              <div
                key={index}
                className="absolute top-0 bottom-0 bg-orange-400 rounded cursor-help"
                style={{
                  left: `${leftPercentage}%`,
                  width: `${widthPercentage}%`,
                }}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTooltipPosition({ 
                    x: rect.left + rect.width / 2, 
                    y: rect.top - 10 
                  });
                  setShowBreakTooltip(true);
                  setTooltipContent(`Descanso: ${formatTime(breakStart)} - ${formatTime(breakEnd)} (${breakDurationMinutes} min)`);
                }}
                onMouseLeave={() => {
                  setShowBreakTooltip(false);
                  setTooltipContent('');
                }}
              />
            );
          })}
        </div>

        {/* Time labels */}
        <div className="flex justify-between items-center text-xs text-muted-foreground">
          <div className="flex items-center space-x-1">
            <span className="font-medium">Entrada:</span>
            <span>{formatTime(clockIn)}</span>
          </div>
          
          {totalBreakMinutes > 0 && (
            <div className="flex items-center space-x-1 text-orange-600">
              <span className="font-medium">Descanso:</span>
              <span>{formatDuration(totalBreakMinutes)}</span>
            </div>
          )}
          
          <div className="flex items-center space-x-1">
            <span className="font-medium">Salida:</span>
            <span>{formatTime(clockOut)}</span>
          </div>
        </div>
      </div>
    );
  };

  // Daily Timeline Bar Component for displaying multiple sessions in a single day
  const DailyTimelineBar = ({ dayData }: { dayData: any }) => {
    if (!dayData.sessions || dayData.sessions.length === 0) {
      return <div className="text-gray-400">Sin datos</div>;
    }

    // Check for active sessions (sessions without clockOut)
    const hasActiveSessions = dayData.sessions.some((session: any) => !session.clockOut);
    
    // Only show "Trabajando" status for TODAY's active sessions
    // For past days with incomplete sessions, use the normal completed view + badge
    const isTodaySession = dayData.sessions.some((session: any) => 
      session.clockIn && isToday(new Date(session.clockIn))
    );
    
    if (hasActiveSessions && isTodaySession) {
      // Handle TODAY's active sessions - show current status with same visual style
      const activeSession = dayData.sessions.find((session: any) => !session.clockOut);
      const sessionStart = new Date(activeSession.clockIn);
      const now = new Date();
      const activeBreakPeriod = (activeSession.breakPeriods || []).find((bp: any) => !bp.breakEnd);
      const formatTime = (date: Date) => format(date, 'HH:mm');
      
      // Calculate active session progress and break positions
      const completedBreaks = (activeSession.breakPeriods || []).filter((bp: any) => bp.breakEnd);
      const activeBreakStart = activeBreakPeriod ? new Date(activeBreakPeriod.breakStart) : null;
      
      // Calculate progress percentage based on elapsed time 
      // LÓGICA: Una jornada típica de 8 horas = 100% de la barra
      // La barra se llena progresivamente según el tiempo transcurrido
      const sessionElapsedMinutes = Math.round((now.getTime() - sessionStart.getTime()) / (1000 * 60));
      const maxWorkdayMinutes = 8 * 60; // 480 minutos = 8 horas jornada estándar
      const progressPercentage = Math.min((sessionElapsedMinutes / maxWorkdayMinutes) * 100, 90); // Máximo 90% hasta fichar salida
      
      // Calculate break positions as percentages of elapsed time
      const sessionElapsedMs = now.getTime() - sessionStart.getTime();
      
      return (
        <div className="space-y-0">
          {/* Contenedor para duraciones de descanso ARRIBA de las barras */}
          <div className="relative h-4">
            {/* Descansos completados */}
            {completedBreaks.map((breakPeriod: any, breakIndex: number) => {
              const breakStart = new Date(breakPeriod.breakStart);
              const breakEnd = new Date(breakPeriod.breakEnd);
              const breakMinutes = Math.round((breakEnd.getTime() - breakStart.getTime()) / (1000 * 60));
              
              // Calculate break position as percentage of elapsed session time
              const breakStartMs = breakStart.getTime() - sessionStart.getTime();
              const breakPositionPercentage = Math.min((breakStartMs / sessionElapsedMs) * progressPercentage, progressPercentage - 5);
              
              return (
                <div
                  key={`completed-break-${breakIndex}`}
                  className="absolute text-xs text-orange-600 font-medium transform -translate-x-1/2 flex items-center gap-1"
                  style={{ 
                    left: `${breakPositionPercentage}%`,
                    top: '0px'
                  }}
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  {breakMinutes}min
                </div>
              );
            })}
            
            {/* Descanso activo */}
            {activeBreakPeriod && (
              <div
                className="absolute text-xs text-orange-600 font-medium transform -translate-x-1/2 flex items-center gap-1 animate-pulse"
                style={{ 
                  left: `${Math.min((((activeBreakStart!.getTime() - sessionStart.getTime()) / sessionElapsedMs) * progressPercentage), progressPercentage - 5)}%`,
                  top: '0px'
                }}
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                {activeBreakStart ? Math.round((now.getTime() - activeBreakStart.getTime()) / (1000 * 60)) : 0}min
              </div>
            )}
          </div>

          {/* Timeline visual progresivo */}
          <div className="relative h-5">
            {/* Línea base gris */}
            <div className="h-5 bg-gray-200 rounded-sm relative overflow-hidden">
              {/* Barra azul progresiva (se va llenando en tiempo real) */}
              <div
                className="absolute top-0 h-5 bg-blue-500 rounded-sm transition-all duration-1000"
                style={{
                  left: '0%',
                  width: `${progressPercentage}%`
                }}
              />
              
              {/* Descansos completados como sliders naranjas posicionados correctamente */}
              {completedBreaks.map((breakPeriod: any, breakIndex: number) => {
                const breakStart = new Date(breakPeriod.breakStart);
                const breakEnd = new Date(breakPeriod.breakEnd);
                const breakStartMs = breakStart.getTime() - sessionStart.getTime();
                const breakDurationMs = breakEnd.getTime() - breakStart.getTime();
                
                const breakLeftPercentage = Math.min((breakStartMs / sessionElapsedMs) * progressPercentage, progressPercentage - 5);
                const breakWidthPercentage = Math.min((breakDurationMs / sessionElapsedMs) * progressPercentage, 8);
                
                return (
                  <div
                    key={`break-bar-${breakIndex}`}
                    className="absolute top-0.5 h-4 bg-orange-400 rounded-sm"
                    style={{
                      left: `${breakLeftPercentage}%`,
                      width: `${breakWidthPercentage}%`
                    }}
                  />
                );
              })}
              
              {/* Descanso activo como slider naranja pulsante */}
              {activeBreakPeriod && (
                <div
                  className="absolute top-0.5 h-4 bg-orange-400 rounded-sm animate-pulse cursor-help"
                  style={{
                    left: `${Math.min((((activeBreakStart!.getTime() - sessionStart.getTime()) / sessionElapsedMs) * progressPercentage), progressPercentage - 5)}%`,
                    width: `${Math.max(Math.min((((now.getTime() - activeBreakStart!.getTime()) / sessionElapsedMs) * progressPercentage), 8), 3)}%`,
                    minWidth: '20px'
                  }}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTooltipPosition({ 
                      x: rect.left + rect.width / 2, 
                      y: rect.top - 10 
                    });
                    setShowBreakTooltip(true);
                    setTooltipContent(`Descanso en progreso: ${Math.round((now.getTime() - activeBreakStart!.getTime()) / (1000 * 60))} min`);
                  }}
                  onMouseLeave={() => {
                    setShowBreakTooltip(false);
                    setTooltipContent('');
                  }}
                />
              )}

              {/* Tooltip personalizado para descanso activo */}
              {showBreakTooltip && (
                <div
                  className="fixed bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg z-50 pointer-events-none"
                  style={{
                    left: `${tooltipPosition.x}px`,
                    top: `${tooltipPosition.y}px`,
                    transform: 'translateX(-50%)'
                  }}
                >
                  {tooltipContent || (activeBreakPeriod ? `Descanso en progreso: ${Math.round((now.getTime() - activeBreakStart!.getTime()) / (1000 * 60))} minutos` : '')}
                  <div 
                    className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Contenedor para horas ABAJO de las barras */}
          <div className="relative h-4">
            {/* Entrada: punto alineado con inicio de barra + hora a la derecha */}
            <div className="absolute flex items-center" style={{ left: '0%', top: '0px' }}>
              <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
              <span className="text-xs font-medium text-green-700 whitespace-nowrap">{formatTime(sessionStart)}</span>
            </div>
            
            {/* Estado actual en tiempo real con punto pulsante - MISMO LUGAR que salida */}
            <div className="absolute flex items-center" style={{ left: '100%', top: '0px', transform: 'translateX(-100%)' }}>
              <span className={`text-xs font-medium mr-1 whitespace-nowrap ${activeBreakPeriod ? 'text-orange-600' : 'text-blue-600'}`}>
                {activeBreakPeriod ? 'En descanso' : 'Trabajando'}
              </span>
              <div className={`w-2 h-2 rounded-full ${activeBreakPeriod ? 'bg-orange-500 animate-pulse' : 'bg-blue-500 animate-pulse'}`}></div>
            </div>
          </div>
        </div>
      );
    }

    // Handle incomplete sessions from past days - show "Incompleto" status
    if (hasActiveSessions && !isTodaySession) {
      const activeSession = dayData.sessions.find((session: any) => !session.clockOut);
      const sessionStart = new Date(activeSession.clockIn);
      const now = new Date();
      const elapsedHours = (now.getTime() - sessionStart.getTime()) / (1000 * 60 * 60);
      const formatTime = (date: Date) => format(date, 'HH:mm');

      // Use configured max hours from company settings (same as calculateSessionStatus function)
      const maxHours = (companySettings as any)?.workingHoursPerDay || 8;
      
      // Only show "Incompleto" if more than maxHours have passed
      if (elapsedHours > maxHours) {
        return (
          <div className="space-y-0">
            {/* Contenedor para duraciones de descanso ARRIBA de las barras */}
            <div className="relative h-4"></div>
            
            {/* Simple timeline showing incomplete session */}
            <div className="relative h-5">
              <div className="h-5 bg-gray-200 rounded-sm relative overflow-hidden">
                {/* Red bar indicating incomplete session */}
                <div className="absolute top-0 h-5 bg-red-400 rounded-sm w-full opacity-60" />
              </div>
            </div>

            {/* Time labels showing start time and "Incompleto" status */}
            <div className="relative h-4">
              {/* Start time */}
              <div className="absolute flex items-center" style={{ left: '0%', top: '0px' }}>
                <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                <span className="text-xs font-medium text-green-700 whitespace-nowrap">{formatTime(sessionStart)}</span>
              </div>
              
              {/* "Incompleto" status */}
              <div className="absolute flex items-center" style={{ left: '100%', top: '0px', transform: 'translateX(-100%)' }}>
                <span className="text-xs font-medium text-red-600 whitespace-nowrap mr-1">
                  Incompleto
                </span>
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
              </div>
            </div>
          </div>
        );
      }
    }

    // Calcular el rango total del día (desde primera entrada hasta última salida) - solo sesiones completadas
    const allTimes = dayData.sessions.flatMap((session: any) => [
      new Date(session.clockIn),
      session.clockOut ? new Date(session.clockOut) : null
    ]).filter(Boolean);
    const dayStart = new Date(Math.min(...allTimes.map((d: any) => d.getTime())));
    const dayEnd = new Date(Math.max(...allTimes.map((d: any) => d.getTime())));
    const totalDayDuration = (dayEnd.getTime() - dayStart.getTime()) / (1000 * 60 * 60); // en horas

    const formatTime = (date: Date) => format(date, 'HH:mm');

    return (
      <div className="space-y-0">
        {/* Contenedor para duraciones de descanso ARRIBA de las barras */}
        <div className="relative h-4">
          {dayData.sessions.map((session: any, sessionIndex: number) => {
            return (session.breakPeriods || []).map((breakPeriod: any, breakIndex: number) => {
              if (!breakPeriod.breakEnd) return null;
              
              const breakStart = new Date(breakPeriod.breakStart);
              const breakEnd = new Date(breakPeriod.breakEnd);
              
              // Posición del descanso relativa al inicio del día
              const breakStartOffset = (breakStart.getTime() - dayStart.getTime()) / (1000 * 60 * 60);
              const breakDuration = (breakEnd.getTime() - breakStart.getTime()) / (1000 * 60 * 60);
              
              const breakLeftPercentage = (breakStartOffset / totalDayDuration) * 100;
              const breakWidthPercentage = Math.max((breakDuration / totalDayDuration) * 100, 1);
              const breakMinutes = Math.round((breakEnd.getTime() - breakStart.getTime()) / (1000 * 60));
              
              return (
                <div
                  key={`break-label-${sessionIndex}-${breakIndex}`}
                  className="absolute text-xs text-orange-600 font-medium transform -translate-x-1/2 flex items-center gap-1"
                  style={{ 
                    left: `${breakLeftPercentage + breakWidthPercentage/2}%`,
                    top: '0px'
                  }}
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  {breakMinutes}min
                </div>
              );
            });
          })}
        </div>

        {/* Timeline visual minimalista */}
        <div className="relative h-5">
          {/* Línea base gris minimalista */}
          <div className="h-5 bg-gray-200 rounded-sm relative overflow-hidden">
            
            {/* Segmentos de trabajo (barras azules minimalistas) con descansos slider */}
            {dayData.sessions.filter((session: any) => session.clockOut).map((session: any, sessionIndex: number) => {
              const sessionStart = new Date(session.clockIn);
              const sessionEnd = new Date(session.clockOut);
              
              // Posición relativa dentro del día
              const startOffset = (sessionStart.getTime() - dayStart.getTime()) / (1000 * 60 * 60);
              const sessionDuration = (sessionEnd.getTime() - sessionStart.getTime()) / (1000 * 60 * 60);
              
              const leftPercentage = (startOffset / totalDayDuration) * 100;
              const widthPercentage = (sessionDuration / totalDayDuration) * 100;
              
              return (
                <div key={sessionIndex} className="relative">
                  {/* Barra azul minimalista */}
                  <div
                    className="absolute top-0 h-5 bg-blue-500 rounded-sm"
                    style={{
                      left: `${leftPercentage}%`,
                      width: `${widthPercentage}%`
                    }}
                  />
                  
                  {/* Descansos como sliders dentro de la barra azul */}
                  {(session.breakPeriods || []).map((breakPeriod: any, breakIndex: number) => {
                    if (!breakPeriod.breakEnd) return null;
                    
                    const breakStart = new Date(breakPeriod.breakStart);
                    const breakEnd = new Date(breakPeriod.breakEnd);
                    
                    // Posición del descanso relativa al inicio de la sesión (no del día)
                    const breakStartRelativeToSession = (breakStart.getTime() - sessionStart.getTime()) / (1000 * 60 * 60);
                    const breakDuration = (breakEnd.getTime() - breakStart.getTime()) / (1000 * 60 * 60);
                    
                    const breakLeftPercentageInSession = (breakStartRelativeToSession / sessionDuration) * 100;
                    const breakWidthPercentageInSession = Math.max((breakDuration / sessionDuration) * 100, 2); // Mínimo 2%
                    
                    return (
                      <div
                        key={`${sessionIndex}-${breakIndex}`}
                        className="absolute top-0.5 h-4 bg-orange-400 rounded-sm"
                        style={{
                          left: `${breakLeftPercentageInSession}%`,
                          width: `${breakWidthPercentageInSession}%`
                        }}
                        title={`Descanso: ${formatTime(breakStart)} - ${formatTime(breakEnd)}`}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Contenedor para horas de entrada/salida ABAJO de las barras */}
        <div className="relative h-4" style={{ zIndex: 10 }}>
          {(() => {
            // Preparar todas las etiquetas de tiempo con sus posiciones
            const completedSessions = dayData.sessions.filter((session: any) => session.clockOut);
            const timeLabels: Array<{
              text: string;
              position: number;
              type: 'start' | 'end';
              sessionIndex: number;
              originalPosition: number;
              time: Date; // Agregar fecha real para ordenar cronológicamente
            }> = [];

            completedSessions.forEach((session: any, sessionIndex: number) => {
              const sessionStart = new Date(session.clockIn);
              const sessionEnd = new Date(session.clockOut);
              
              // Posición relativa dentro del día
              const startOffset = (sessionStart.getTime() - dayStart.getTime()) / (1000 * 60 * 60);
              const sessionDuration = (sessionEnd.getTime() - sessionStart.getTime()) / (1000 * 60 * 60);
              
              const leftPercentage = (startOffset / totalDayDuration) * 100;
              const widthPercentage = (sessionDuration / totalDayDuration) * 100;

              // Agregar etiqueta de entrada
              timeLabels.push({
                text: formatTime(sessionStart),
                position: leftPercentage,
                originalPosition: leftPercentage,
                type: 'start',
                sessionIndex,
                time: sessionStart
              });

              // Agregar etiqueta de salida
              timeLabels.push({
                text: formatTime(sessionEnd),
                position: leftPercentage + widthPercentage,
                originalPosition: leftPercentage + widthPercentage,
                type: 'end',
                sessionIndex,
                time: sessionEnd
              });
            });

            // Ordenar etiquetas por tiempo real (cronológicamente)
            timeLabels.sort((a, b) => a.time.getTime() - b.time.getTime());

            // Algoritmo híbrido: detectar colisiones locales y marcar puntos específicos
            const avgTextWidth = 5; // En porcentaje del contenedor (~42px de 800px típicos)
            const minDistance = 3; // Distancia mínima en % para evitar solapamiento
            
            // Marcar cada etiqueta como overlapping o no
            const labelOverlapStatus = timeLabels.map((label, index) => {
              let hasCollision = false;
              
              // Verificar colisión con etiqueta anterior
              if (index > 0) {
                const prevLabel = timeLabels[index - 1];
                const distance = label.position - prevLabel.position;
                if (distance < avgTextWidth + minDistance) {
                  hasCollision = true;
                }
              }
              
              // Verificar colisión con etiqueta siguiente
              if (index < timeLabels.length - 1) {
                const nextLabel = timeLabels[index + 1];
                const distance = nextLabel.position - label.position;
                if (distance < avgTextWidth + minDistance) {
                  hasCollision = true;
                }
              }
              
              return { ...label, hasCollision };
            });

            // Si hay muchas etiquetas (>8), usar modo compacto global
            const shouldUseGlobalCompactMode = timeLabels.length > 8;
            
            // Algoritmo híbrido implementado: detecta colisiones específicas y aplica posicionamiento flexible
            
            if (shouldUseGlobalCompactMode) {
              // Modo compacto global: todas las etiquetas como tooltips
              return completedSessions.map((session: any, sessionIndex: number) => {
                const sessionStart = new Date(session.clockIn);
                const sessionEnd = new Date(session.clockOut);
                
                const startOffset = (sessionStart.getTime() - dayStart.getTime()) / (1000 * 60 * 60);
                const sessionDuration = (sessionEnd.getTime() - sessionStart.getTime()) / (1000 * 60 * 60);
                
                const leftPercentage = (startOffset / totalDayDuration) * 100;
                const widthPercentage = (sessionDuration / totalDayDuration) * 100;
                
                return (
                  <div key={`session-indicators-${sessionIndex}`} className="relative">
                    {/* Indicador de entrada */}
                    <div
                      className="absolute w-2 h-2 bg-green-500 rounded-full cursor-help group"
                      style={{ left: `${leftPercentage}%`, top: '1px', transform: 'translateX(-50%)' }}
                    >
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 text-xs bg-black text-white rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-20">
                        Entrada: {formatTime(sessionStart)}
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-black"></div>
                      </div>
                    </div>
                    
                    {/* Indicador de salida */}
                    <div
                      className="absolute w-2 h-2 bg-red-500 rounded-full cursor-help group"
                      style={{ left: `${leftPercentage + widthPercentage}%`, top: '1px', transform: 'translateX(-50%)' }}
                    >
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 text-xs bg-black text-white rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-20">
                        Salida: {formatTime(sessionEnd)}
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-black"></div>
                      </div>
                    </div>
                  </div>
                );
              });
            }

            // Usar directamente timeLabels que ya está ordenado cronológicamente
            return labelOverlapStatus.map((label, eventIndex) => {
              const key = `event-${label.type}-${label.sessionIndex}-${eventIndex}`;
              
              if (label.type === 'start') {
                // Entrada
                return label.hasCollision ? (
                  // Con colisión: punto desplazado horizontalmente
                  <div 
                    key={key}
                    className="absolute w-2 h-2 bg-green-500 rounded-full cursor-help shadow-md border border-white" 
                    style={{ 
                      left: `${label.position - 1}%`,
                      top: '0px',
                      transform: 'translateX(-50%)',
                      zIndex: 10
                    }}
                    title={`Entrada: ${label.text}`}
                  />
                ) : (
                  // Sin colisión: punto + hora visible
                  <div key={key} className="absolute flex items-center" style={{ left: `${label.position}%`, top: '0px' }}>
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                    <span className="text-xs font-medium text-green-700 whitespace-nowrap">{label.text}</span>
                  </div>
                );
              } else {
                // Salida
                return label.hasCollision ? (
                  // Con colisión: punto desplazado horizontalmente
                  <div 
                    key={key}
                    className="absolute w-2 h-2 bg-red-500 rounded-full cursor-help shadow-md border border-white" 
                    style={{ 
                      left: `${label.position + 1}%`,
                      top: '0px',
                      transform: 'translateX(-50%)',
                      zIndex: 10
                    }}
                    title={`Salida: ${label.text}`}
                  />
                ) : (
                  // Sin colisión: punto + hora visible
                  <div key={key} className="absolute flex items-center" style={{ left: `${label.position}%`, top: '0px', transform: 'translateX(-100%)' }}>
                    <span className="text-xs font-medium text-red-700 whitespace-nowrap mr-1">{label.text}</span>
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  </div>
                );
              }
            });
          })()}
        </div>
      </div>
    );
  };

  // Loading check AFTER all hooks
  if (isLoading) {
    return (
      <div className="px-6 py-4">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-16 bg-muted rounded-lg"></div>
          <div className="h-96 bg-muted rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-4 min-h-screen bg-background" style={{ overflowX: 'clip' }}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Gestión de Fichajes</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              Administra todos los fichajes de empleados y genera reportes.
            </p>
          </div>

        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-2 md:gap-6 mb-3">
        <StatsCard
          title="Incompletos"
          subtitle="Sesiones"
          value={`${incompleteSessions}`}
          color="red"
          icon={AlertCircle}
          onClick={handleIncompleteFilter}
          isActive={activeStatsFilter === 'incomplete'}
        />
        
        <StatsCard
          title="Media Diaria"
          subtitle="Horas/día"
          value={`${averageHoursPerEmployee.toFixed(1)}h`}
          color="orange"
          icon={TrendingUp}
          onClick={handleTodayFilter}
          isActive={activeStatsFilter === 'today'}
        />
        
        <StatsCard
          title="Media Semanal"
          subtitle="Horas/sem"
          value={`${averageHoursPerWeek.toFixed(1)}h`}
          color="blue"
          icon={CalendarDays}
          onClick={handleThisWeekFilter}
          isActive={activeStatsFilter === 'week'}
        />
        
        <StatsCard
          title="Media Mensual"
          subtitle="Horas/mes"
          value={`${averageHoursPerMonth.toFixed(1)}h`}
          color="purple"
          icon={BarChart3}
          onClick={handleThisMonthFilter}
          isActive={activeStatsFilter === 'month'}
        />
      </div>

      {/* Sessions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
            <span className="text-sm sm:text-lg font-medium">{getFilterTitle()} ({filteredSessions.length})</span>
            
            {/* Desktop: buttons grouped together */}
            <div className="hidden sm:flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2"
              >
                <Filter className="w-4 h-4" />
                Filtros
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleExportPDF}
                title="Exporta en PDF la vista actual de fichajes"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </div>

            {/* Mobile: buttons full width */}
            <div className="sm:hidden grid grid-cols-2 gap-2 w-full">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center justify-center gap-2 w-full"
              >
                <Filter className="w-4 h-4" />
                Filtros
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleExportPDF}
                title="Exporta en PDF la vista actual de fichajes"
                className="flex items-center justify-center gap-2 w-full"
              >
                <Download className="w-4 h-4" />
                Exportar
              </Button>
            </div>
          </CardTitle>
        </CardHeader>

        {/* Filters Section - Integrated between header and table */}
        {showFilters && (
          <div className="px-6 py-4 border-b bg-muted">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-end">
              {/* Left side - Employee Filter */}
              <div className="flex flex-col space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Empleado</label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Seleccionar empleado" />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="p-2">
                      <div className="relative mb-2">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                          placeholder="Buscar empleado..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10 h-8"
                        />
                      </div>
                    </div>
                    <SelectItem value="all">Todos los empleados</SelectItem>
                    {(employeesList || [])
                      .filter((employee: any) => 
                        employee.fullName.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      .map((employee: any) => (
                      <SelectItem key={employee.id} value={employee.id.toString()}>
                        {employee.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Right side - Date Filters */}
              <div className="flex flex-col space-y-2 lg:col-span-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Período de tiempo</label>
                
                {/* Desktop Layout: All buttons in one row */}
                <div className="hidden lg:flex items-center gap-2 w-full">
                  <Button
                    variant={dateFilter === 'today' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setDateFilter('today');
                      setSelectedStartDate(null);
                      setSelectedEndDate(null);
                      setStartDate('');
                      setEndDate('');
                    }}
                    className="h-10 text-xs font-normal flex-1 text-center"
                  >
                    Hoy
                  </Button>
                  
                  <DatePickerDay
                    date={dateFilter === 'day' ? currentDate : undefined}
                    onDateChange={(date) => {
                      if (date) {
                        setCurrentDate(date);
                        setDateFilter('day');
                        setSelectedStartDate(null);
                        setSelectedEndDate(null);
                        setStartDate('');
                        setEndDate('');
                      }
                    }}
                    buttonText={dateFilter === 'day' 
                      ? format(currentDate, 'd MMM yyyy', { locale: es })
                      : 'Día'
                    }
                    className={cn(
                      "h-10 text-xs font-normal whitespace-nowrap flex-1 text-center",
                      dateFilter === 'day' && "bg-[#007AFF] text-white border-[#007AFF] hover:bg-[#007AFF]/90"
                    )}
                  />

                  <Popover open={isMonthDialogOpen} onOpenChange={setIsMonthDialogOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "h-10 text-xs font-normal whitespace-nowrap flex-1 text-center",
                          dateFilter === 'month' && "bg-[#007AFF] text-white border-[#007AFF] hover:bg-[#007AFF]/90"
                        )}
                      >
                        {dateFilter === 'month' ? format(currentMonth, 'MMM yyyy', { locale: es }) : 'Mes'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-2" align="start">
                      <div className="space-y-1 max-h-60 overflow-y-auto">
                        {availableMonths.map((monthKey: string) => {
                          const [year, month] = monthKey.split('-');
                          const monthDate = new Date(parseInt(year), parseInt(month) - 1);
                          return (
                            <Button
                              key={monthKey}
                              variant="ghost"
                              className="w-full justify-start text-sm"
                              onClick={() => {
                                setCurrentMonth(monthDate);
                                setDateFilter('month');
                                setIsMonthDialogOpen(false);
                                setSelectedStartDate(null);
                                setSelectedEndDate(null);
                                setStartDate('');
                                setEndDate('');
                              }}
                            >
                              {format(monthDate, 'MMMM yyyy', { locale: es })}
                            </Button>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>

                  <DatePickerPeriod
                    startDate={selectedStartDate || undefined}
                    endDate={selectedEndDate || undefined}
                    onStartDateChange={(date) => {
                      setSelectedStartDate(date || null);
                      setStartDate(date ? format(date, 'yyyy-MM-dd') : '');
                      if (date && selectedEndDate) {
                        setDateFilter('custom');
                      }
                    }}
                    onEndDateChange={(date) => {
                      setSelectedEndDate(date || null);
                      setEndDate(date ? format(date, 'yyyy-MM-dd') : '');
                      if (selectedStartDate && date) {
                        setDateFilter('custom');
                      }
                    }}
                    className={cn(
                      "h-10 text-xs font-normal whitespace-nowrap flex-1 text-center",
                      dateFilter === 'custom' && "bg-[#007AFF] text-white border-[#007AFF] hover:bg-[#007AFF]/90"
                    )}
                  />

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDateFilter('all');
                      setSelectedEmployee('all');
                      setSelectedStartDate(null);
                      setSelectedEndDate(null);
                      setStartDate('');
                      setEndDate('');
                      setCurrentDate(new Date());
                      setCurrentMonth(new Date());
                    }}
                    className="h-10 text-xs font-normal whitespace-nowrap flex-1 text-center"
                  >
                    Limpiar filtros
                  </Button>
                </div>

                {/* Mobile Layout: Buttons in two rows */}
                <div className="lg:hidden space-y-2">
                  {/* First row: Main filter buttons */}
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant={dateFilter === 'today' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setDateFilter('today');
                        setSelectedStartDate(null);
                        setSelectedEndDate(null);
                        setStartDate('');
                        setEndDate('');
                      }}
                      className="h-9 text-xs font-normal text-center"
                    >
                      Hoy
                    </Button>
                    
                    <DatePickerDay
                      date={dateFilter === 'day' ? currentDate : undefined}
                      onDateChange={(date) => {
                        if (date) {
                          setCurrentDate(date);
                          setDateFilter('day');
                          setSelectedStartDate(null);
                          setSelectedEndDate(null);
                          setStartDate('');
                          setEndDate('');
                        }
                      }}
                      buttonText={dateFilter === 'day' 
                        ? format(currentDate, 'd/MM', { locale: es })
                        : 'Día'
                      }
                      className={dateFilter === 'day' 
                        ? "h-9 text-xs font-normal text-center bg-[#007AFF] text-white border-[#007AFF] hover:bg-[#007AFF]/90"
                        : "h-9 text-xs font-normal text-center"
                      }
                    />

                    <Select 
                      value={dateFilter === 'month' ? format(currentMonth, 'yyyy-MM') : ''} 
                      onValueChange={(value) => {
                        if (value) {
                          const [year, month] = value.split('-');
                          const monthDate = new Date(parseInt(year), parseInt(month) - 1);
                          setCurrentMonth(monthDate);
                          setDateFilter('month');
                          setSelectedStartDate(null);
                          setSelectedEndDate(null);
                          setStartDate('');
                          setEndDate('');
                        }
                      }}
                    >
                      <SelectTrigger 
                        className={cn(
                          "h-9 text-xs font-normal text-center [&>svg]:hidden focus:ring-0 focus:ring-offset-0 border border-input bg-background hover:bg-accent hover:text-accent-foreground",
                          dateFilter === 'month' 
                            ? "bg-[#007AFF] text-white border-[#007AFF] hover:bg-[#007AFF]/90 focus:bg-[#007AFF] focus:border-[#007AFF]"
                            : "text-foreground"
                        )}
                      >
                        <span className={cn(
                          "w-full text-center block",
                          dateFilter === 'month' ? "text-white" : "text-foreground"
                        )}>
                          {dateFilter === 'month' ? format(currentMonth, 'MMM', { locale: es }) : 'Mes'}
                        </span>
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {availableMonths.map((monthKey: string) => {
                          const [year, month] = monthKey.split('-');
                          const monthDate = new Date(parseInt(year), parseInt(month) - 1);
                          return (
                            <SelectItem key={monthKey} value={monthKey}>
                              {format(monthDate, 'MMMM yyyy', { locale: es })}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Second row: Range picker and clear button */}
                  <div className="grid grid-cols-2 gap-2">
                    <DatePickerPeriod
                      startDate={selectedStartDate || undefined}
                      endDate={selectedEndDate || undefined}
                      onStartDateChange={(date) => {
                        setSelectedStartDate(date || null);
                        setStartDate(date ? format(date, 'yyyy-MM-dd') : '');
                        if (date && selectedEndDate) {
                          setDateFilter('custom');
                        }
                      }}
                      onEndDateChange={(date) => {
                        setSelectedEndDate(date || null);
                        setEndDate(date ? format(date, 'yyyy-MM-dd') : '');
                        if (selectedStartDate && date) {
                          setDateFilter('custom');
                        }
                      }}
                      className={dateFilter === 'custom' 
                        ? "h-9 text-xs font-normal text-center bg-[#007AFF] text-white border-[#007AFF] hover:bg-[#007AFF]/90"
                        : "h-9 text-xs font-normal text-center"
                      }
                    />

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDateFilter('all');
                        setSelectedEmployee('all');
                        setSelectedStartDate(null);
                        setSelectedEndDate(null);
                        setStartDate('');
                        setEndDate('');
                        setCurrentDate(new Date());
                        setCurrentMonth(new Date());
                      }}
                      className="h-9 text-xs font-normal text-center"
                    >
                      Limpiar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <CardContent className="p-0">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Empleado</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Fecha</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground min-w-[300px]">Jornada de Trabajo</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Total</th>
                  <th className="text-center py-3 px-4 font-medium text-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const sortedSessions = filteredSessions
                    .sort((a: any, b: any) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime());
                  
                  const showSummaries = selectedEmployee !== 'all';
                  let currentWeekStart: Date | null = null;
                  let previousWeekStart: Date | null = null;
                  let currentMonth: string | null = null;
                  let previousMonth: string | null = null;
                  
                  const calculateWeekTotal = (weekStart: Date) => 
                    (sortedSessions || [])
                      .filter(session => {
                        const sessionWeekStart = startOfWeek(new Date(session.clockIn), { weekStartsOn: 1 });
                        return sessionWeekStart.getTime() === weekStart.getTime();
                      })
                      .reduce((total: number, session: any) => {
                        let totalSessionHours = calculateHours(session.clockIn, session.clockOut);
                        
                        // Validación: Limitar a máximo 24 horas por sesión
                        if (totalSessionHours > 24) {
                          totalSessionHours = 24;
                        }
                        
                        const breakHours = session.breakPeriods 
                          ? session.breakPeriods.reduce((breakTotal: number, breakPeriod: any) => {
                              return breakTotal + calculateHours(breakPeriod.breakStart, breakPeriod.breakEnd);
                            }, 0) 
                          : 0;
                        return total + Math.max(0, totalSessionHours - breakHours);
                      }, 0);
                  
                  const calculateMonthTotal = (monthKey: string) => 
                    (sortedSessions || [])
                      .filter(session => format(new Date(session.clockIn), 'yyyy-MM') === monthKey)
                      .reduce((total: number, session: any) => {
                        let totalSessionHours = calculateHours(session.clockIn, session.clockOut);
                        
                        // Validación: Limitar a máximo 24 horas por sesión
                        if (totalSessionHours > 24) {
                          totalSessionHours = 24;
                        }
                        
                        const breakHours = session.breakPeriods 
                          ? session.breakPeriods.reduce((breakTotal: number, breakPeriod: any) => {
                              return breakTotal + calculateHours(breakPeriod.breakStart, breakPeriod.breakEnd);
                            }, 0) 
                          : 0;
                        return total + Math.max(0, totalSessionHours - breakHours);
                      }, 0);
                  
                  // Agrupar sesiones por empleado y día
                  const sessionsByDay = sortedSessions.reduce((acc: any, session: any) => {
                    const dayKey = `${session.userId}-${format(new Date(session.clockIn), 'yyyy-MM-dd')}`;
                    if (!acc[dayKey]) {
                      acc[dayKey] = {
                        date: format(new Date(session.clockIn), 'yyyy-MM-dd'),
                        userId: session.userId,
                        userName: session.userName,
                        profilePicture: session.profilePicture, // ← CRITICAL FIX: Include profilePicture in grouping
                        sessions: [],
                        hasAutoCompleted: false // Track if any session in this day was auto-completed
                      };
                    }
                    acc[dayKey].sessions.push(session);
                    // Check if this session was auto-completed
                    if (session.autoCompleted) {
                      acc[dayKey].hasAutoCompleted = true;
                    }
                    return acc;
                  }, {});

                  // Ordenar sesiones dentro de cada día por hora
                  Object.values(sessionsByDay).forEach((dayData: any) => {
                    dayData.sessions.sort((a: any, b: any) => new Date(a.clockIn).getTime() - new Date(b.clockIn).getTime());
                  });

                  // Convertir a array y ordenar por fecha (más reciente primero)
                  const dailyEntries = Object.values(sessionsByDay).sort((a: any, b: any) => 
                    new Date(b.date).getTime() - new Date(a.date).getTime()
                  );

                  const result: JSX.Element[] = [];
                  
                  dailyEntries.forEach((dayData: any, index: number) => {
                    const dayDate = new Date(dayData.date);
                    const weekStart = startOfWeek(dayDate, { weekStartsOn: 1 });
                    const monthKey = format(dayDate, 'yyyy-MM');
                    const isNewWeek = currentWeekStart === null || weekStart.getTime() !== currentWeekStart.getTime();
                    const isNewMonth = currentMonth === null || monthKey !== currentMonth;
                    
                    if (isNewWeek) {
                      previousWeekStart = currentWeekStart;
                      currentWeekStart = weekStart;
                    }
                    
                    if (isNewMonth) {
                      previousMonth = currentMonth;
                      currentMonth = monthKey;
                    }
                    
                    // Add summaries only when filtering by specific employee
                    if (showSummaries && isNewMonth && index > 0 && previousMonth) {
                      const monthTotal = calculateMonthTotal(previousMonth);
                      const [year, month] = previousMonth.split('-');
                      const monthName = format(new Date(parseInt(year), parseInt(month) - 1), 'MMMM yyyy', { locale: es });
                      
                      result.push(
                        <tr key={`month-${previousMonth}`} className="bg-blue-50 dark:bg-blue-900/30 border-y-2 border-blue-200 dark:border-blue-700 h-10">
                          <td colSpan={5} className="py-1 px-4 text-center">
                            <div className="font-semibold text-blue-800 dark:text-blue-200 capitalize text-sm">
                              Total {monthName}: {monthTotal.toFixed(1)}h
                            </div>
                          </td>
                        </tr>
                      );
                    }
                    
                    if (showSummaries && isNewWeek && index > 0 && previousWeekStart) {
                      const weekTotal = calculateWeekTotal(previousWeekStart);
                      result.push(
                        <tr key={`week-${previousWeekStart.getTime()}`} className="bg-gray-100 dark:bg-gray-700/50 border-y border-gray-300 dark:border-gray-600 h-10">
                          <td colSpan={5} className="py-1 px-4 text-center">
                            <div className="font-medium text-gray-700 dark:text-gray-300 text-sm">
                              Total semana: {weekTotal.toFixed(1)}h
                            </div>
                          </td>
                        </tr>
                      );
                    }
                    
                    // Calcular horas totales trabajadas del día menos períodos de descanso
                    const totalDayHours = dayData.sessions.reduce((total: number, session: any) => {
                      let sessionHours = calculateHours(session.clockIn, session.clockOut);
                      
                      // Validación: Limitar a máximo 24 horas por sesión para evitar overflow
                      if (sessionHours > 24) {
                        sessionHours = 24;
                      }
                      
                      const breakHours = session.breakPeriods 
                        ? session.breakPeriods.reduce((breakTotal: number, breakPeriod: any) => {
                            return breakTotal + calculateHours(breakPeriod.breakStart, breakPeriod.breakEnd);
                          }, 0) 
                        : 0;
                      
                      return total + Math.max(0, sessionHours - breakHours);
                    }, 0);
                    
                    const isEditing = editingSession === dayData.sessions[0]?.id;
                    
                    result.push(
                      <tr key={`day-${dayData.date}-${dayData.userId}`} className="hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-700 h-12">
                        <td className="py-2 px-4">
                          <div className="flex items-center gap-2">
                            <UserAvatar 
                              fullName={dayData.userName || 'Usuario Desconocido'} 
                              size="sm"
                              userId={dayData.userId}
                              profilePicture={dayData.profilePicture}
                            />
                            <div className="flex items-center gap-2">
                              <div className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                                {dayData.userName || 'Usuario Desconocido'}
                              </div>
                              {dayData.hasAutoCompleted && (
                                <div className="flex items-center" title="Esta sesión fue cerrada automáticamente por el sistema">
                                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-4">
                          {isEditing ? (
                            <div className="w-36">
                              <DatePickerDay
                                date={editData.date ? new Date(editData.date) : undefined}
                                onDateChange={(date) => {
                                  setEditData(prev => ({ 
                                    ...prev, 
                                    date: date ? format(date, 'yyyy-MM-dd') : '' 
                                  }));
                                }}
                                className="h-8 text-sm"
                                placeholder="Seleccionar fecha"
                              />
                            </div>
                          ) : (
                            <div className="text-gray-700 dark:text-gray-300 text-sm">
                              {format(new Date(dayData.date), 'dd/MM/yyyy')}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-4 min-w-[300px]">
                          {isEditing ? (
                            <div className="space-y-3">
                              {/* Entrada y Salida */}
                              <div className="flex space-x-2">
                                <Input
                                  type="time"
                                  value={editData.clockIn}
                                  onChange={(e) => setEditData(prev => ({ ...prev, clockIn: e.target.value }))}
                                  className="w-24 h-8"
                                  placeholder="Entrada"
                                />
                                <Input
                                  type="time"
                                  value={editData.clockOut}
                                  onChange={(e) => setEditData(prev => ({ ...prev, clockOut: e.target.value }))}
                                  className="w-24 h-8"
                                  placeholder="Salida"
                                />
                              </div>
                              
                              {/* Periodos de Descanso */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                    Descansos
                                  </label>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={handleAddBreakPeriod}
                                    className="h-6 px-2 text-xs"
                                  >
                                    + Añadir
                                  </Button>
                                </div>
                                
                                {editData.breakPeriods.map((breakPeriod, index) => (
                                  <div key={index} className="flex items-center space-x-1">
                                    <Input
                                      type="time"
                                      value={breakPeriod.breakStart}
                                      onChange={(e) => handleUpdateBreakPeriod(index, 'breakStart', e.target.value)}
                                      className="w-20 h-7 text-xs"
                                      placeholder="Inicio"
                                    />
                                    <span className="text-xs text-gray-400 dark:text-gray-500">-</span>
                                    <Input
                                      type="time"
                                      value={breakPeriod.breakEnd || ''}
                                      onChange={(e) => handleUpdateBreakPeriod(index, 'breakEnd', e.target.value)}
                                      className="w-20 h-7 text-xs"
                                      placeholder="Fin"
                                    />
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleRemoveBreakPeriod(index)}
                                      className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30"
                                    >
                                      <X className="w-3 h-3" />
                                    </Button>
                                  </div>
                                ))}
                                
                                {editData.breakPeriods.length === 0 && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                                    Sin descansos programados
                                  </p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <DailyTimelineBar dayData={dayData} />
                          )}
                        </td>
                        <td className="py-2 px-4">
                          <div className="space-y-1">
                            <div className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                              {totalDayHours > 0 ? `${totalDayHours.toFixed(1)}h` : '-'}
                            </div>
                            {/* Show status badge for completed sessions when they exceed work hours */}
                            {totalDayHours > 0 && (() => {
                              const status = calculateSessionStatus(dayData);
                              return status === 'incomplete' ? (
                                <Badge variant="destructive" className="text-xs">
                                  Incompleto
                                </Badge>
                              ) : null;
                            })()}
                          </div>
                        </td>
                        <td className="py-2 px-4 text-center">
                          {isEditing ? (
                            <div className="flex gap-2 justify-center">
                              <Button
                                size="sm"
                                onClick={() => handleSaveSession(dayData.sessions[0]?.id)}
                                className="h-8 w-8 p-0"
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCancelEdit}
                                className="h-8 w-8 p-0"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            // Check session status to show appropriate button
                            (() => {
                              // When there are multiple sessions in a day, find the active one or use the first one for completed sessions
                              const activeSession = dayData.sessions.find((s: any) => !s.clockOut);
                              const session = activeSession || dayData.sessions[0];
                              const sessionIsIncomplete = isSessionIncomplete(session);
                              const sessionIsActiveToday = !session.clockOut && isToday(new Date(session.clockIn)); // Active session means no clockOut AND is today
                              
                              if (sessionIsIncomplete) {
                                // Show red exit button for force completing incomplete sessions (from previous days)
                                return (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => forceCompleteSessionMutation.mutate(session.id)}
                                    className="h-8 w-8 p-0 bg-red-600 hover:bg-red-700"
                                    disabled={forceCompleteSessionMutation.isPending}
                                  >
                                    <LogOut className="w-4 h-4" />
                                  </Button>
                                );
                              } else if (sessionIsActiveToday) {
                                // Don't show edit button for today's active sessions
                                return null;
                              } else {
                                // Show regular edit button for completed sessions only
                                return (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleEditSession(session)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                );
                              }
                            })()
                          )}
                        </td>
                      </tr>
                    );
                  });
                  
                  // Add final summaries for the last entries
                  if (showSummaries && sortedSessions.length > 0) {
                    if (previousWeekStart) {
                      const weekTotal = calculateWeekTotal(previousWeekStart);
                      result.push(
                        <tr key={`week-final`} className="bg-gray-100 dark:bg-gray-700/50 border-y border-gray-300 dark:border-gray-600">
                          <td colSpan={5} className="py-2 px-4 text-center">
                            <div className="font-medium text-gray-700 dark:text-gray-300">
                              Total semana: {weekTotal.toFixed(1)}h
                            </div>
                          </td>
                        </tr>
                      );
                    }
                    
                    if (currentMonth) {
                      const monthTotal = calculateMonthTotal(currentMonth);
                      // Use currentMonth directly as it's already a string from the monthKey
                      const monthName = format(new Date(currentMonth + '-01'), 'MMMM yyyy', { locale: es });
                      
                      result.push(
                        <tr key={`month-final`} className="bg-blue-50 dark:bg-blue-900/30 border-y-2 border-blue-200 dark:border-blue-700">
                          <td colSpan={5} className="py-3 px-4 text-center">
                            <div className="font-semibold text-blue-800 dark:text-blue-200 capitalize">
                              Total {monthName}: {monthTotal.toFixed(1)}h
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  }
                  
                  return result;
                })()}
                
                {filteredSessions.length === 0 && (
                  <tr className="h-32">
                    <td colSpan={5} className="py-8 text-center">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                          <Users className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                        </div>
                        <div className="text-gray-500 dark:text-gray-400 font-medium text-sm">
                          No hay fichajes en este período
                        </div>
                        <div className="text-gray-400 dark:text-gray-500 text-xs">
                          Prueba seleccionando un rango de fechas diferente
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden">
            {(() => {
              const sortedSessions = filteredSessions
                .sort((a: any, b: any) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime());
              
              const showSummaries = selectedEmployee !== 'all';
              let currentWeekStart: Date | null = null;
              let previousWeekStart: Date | null = null;
              let currentMonth: string | null = null;
              let previousMonth: string | null = null;
              
              const calculateWeekTotal = (weekStart: Date) => 
                (sortedSessions || [])
                  .filter(session => {
                    const sessionWeekStart = startOfWeek(new Date(session.clockIn), { weekStartsOn: 1 });
                    return sessionWeekStart.getTime() === weekStart.getTime();
                  })
                  .reduce((total: number, session: any) => {
                    let totalSessionHours = calculateHours(session.clockIn, session.clockOut);
                    if (totalSessionHours > 24) totalSessionHours = 24;
                    const breakHours = session.breakPeriods 
                      ? session.breakPeriods.reduce((breakTotal: number, breakPeriod: any) => {
                          return breakTotal + calculateHours(breakPeriod.breakStart, breakPeriod.breakEnd);
                        }, 0) 
                      : 0;
                    return total + Math.max(0, totalSessionHours - breakHours);
                  }, 0);
              
              const calculateMonthTotal = (monthKey: string) => 
                (sortedSessions || [])
                  .filter(session => format(new Date(session.clockIn), 'yyyy-MM') === monthKey)
                  .reduce((total: number, session: any) => {
                    let totalSessionHours = calculateHours(session.clockIn, session.clockOut);
                    if (totalSessionHours > 24) totalSessionHours = 24;
                    const breakHours = session.breakPeriods 
                      ? session.breakPeriods.reduce((breakTotal: number, breakPeriod: any) => {
                          return breakTotal + calculateHours(breakPeriod.breakStart, breakPeriod.breakEnd);
                        }, 0) 
                      : 0;
                    return total + Math.max(0, totalSessionHours - breakHours);
                  }, 0);
              
              // Group sessions by day
              const sessionsByDay = sortedSessions.reduce((acc: any, session: any) => {
                const dayKey = `${session.userId}-${format(new Date(session.clockIn), 'yyyy-MM-dd')}`;
                if (!acc[dayKey]) {
                  acc[dayKey] = {
                    date: format(new Date(session.clockIn), 'yyyy-MM-dd'),
                    userId: session.userId,
                    userName: session.userName,
                    profilePicture: session.profilePicture,
                    sessions: [],
                    hasAutoCompleted: false
                  };
                }
                acc[dayKey].sessions.push(session);
                if (session.autoCompleted) {
                  acc[dayKey].hasAutoCompleted = true;
                }
                return acc;
              }, {});

              Object.values(sessionsByDay).forEach((dayData: any) => {
                dayData.sessions.sort((a: any, b: any) => new Date(a.clockIn).getTime() - new Date(b.clockIn).getTime());
              });

              const dailyEntries = Object.values(sessionsByDay).sort((a: any, b: any) => 
                new Date(b.date).getTime() - new Date(a.date).getTime()
              );

              const result: JSX.Element[] = [];
              
              dailyEntries.forEach((dayData: any, index: number) => {
                const dayDate = new Date(dayData.date);
                const weekStart = startOfWeek(dayDate, { weekStartsOn: 1 });
                const monthKey = format(dayDate, 'yyyy-MM');
                const isNewWeek = currentWeekStart === null || weekStart.getTime() !== currentWeekStart.getTime();
                const isNewMonth = currentMonth === null || monthKey !== currentMonth;
                
                if (isNewWeek) {
                  previousWeekStart = currentWeekStart;
                  currentWeekStart = weekStart;
                }
                
                if (isNewMonth) {
                  previousMonth = currentMonth;
                  currentMonth = monthKey;
                }
                
                // Add summaries only when filtering by specific employee
                if (showSummaries && isNewMonth && index > 0 && previousMonth) {
                  const monthTotal = calculateMonthTotal(previousMonth);
                  const [year, month] = previousMonth.split('-');
                  const monthName = format(new Date(parseInt(year), parseInt(month) - 1), 'MMMM yyyy', { locale: es });
                  
                  result.push(
                    <div key={`month-${previousMonth}`} className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-3 mx-4 mb-3">
                      <div className="font-semibold text-blue-800 dark:text-blue-200 capitalize text-sm text-center">
                        Total {monthName}: {monthTotal.toFixed(1)}h
                      </div>
                    </div>
                  );
                }
                
                if (showSummaries && isNewWeek && index > 0 && previousWeekStart) {
                  const weekTotal = calculateWeekTotal(previousWeekStart);
                  result.push(
                    <div key={`week-${previousWeekStart.getTime()}`} className="bg-gray-100 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg p-3 mx-4 mb-3">
                      <div className="font-medium text-gray-700 dark:text-gray-300 text-sm text-center">
                        Total semana: {weekTotal.toFixed(1)}h
                      </div>
                    </div>
                  );
                }
                
                // Calculate total day hours
                const totalDayHours = dayData.sessions.reduce((total: number, session: any) => {
                  let sessionHours = calculateHours(session.clockIn, session.clockOut);
                  if (sessionHours > 24) sessionHours = 24;
                  const breakHours = session.breakPeriods 
                    ? session.breakPeriods.reduce((breakTotal: number, breakPeriod: any) => {
                        return breakTotal + calculateHours(breakPeriod.breakStart, breakPeriod.breakEnd);
                      }, 0) 
                    : 0;
                  return total + Math.max(0, sessionHours - breakHours);
                }, 0);
                
                const isEditing = editingSession === dayData.sessions[0]?.id;
                // When there are multiple sessions in a day, find the active one or use the first one for completed sessions
                const activeSession = dayData.sessions.find((s: any) => !s.clockOut);
                const session = activeSession || dayData.sessions[0];
                const sessionIsIncomplete = isSessionIncomplete(session);
                
                result.push(
                  <div key={`day-${dayData.date}-${dayData.userId}`} className="bg-background border border-border rounded-lg mx-4 mb-3 px-3 py-3 shadow-sm">
                    {/* Header with employee and date */}
                    <div className="flex items-center justify-between mb-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <UserAvatar 
                          fullName={dayData.userName || 'Usuario Desconocido'} 
                          size="sm"
                          userId={dayData.userId}
                          profilePicture={dayData.profilePicture}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-foreground text-sm truncate">
                            {dayData.userName || 'Usuario Desconocido'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(dayData.date), 'dd/MM/yyyy')}
                          </div>
                        </div>
                        {dayData.hasAutoCompleted && (
                          <div className="flex items-center flex-shrink-0" title="Esta sesión fue cerrada automáticamente por el sistema">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                          </div>
                        )}
                      </div>
                      
                      {/* Action button */}
                      <div className="flex items-center gap-1 min-w-0 flex-shrink-0">
                        <div className="text-right">
                          <div className="font-medium text-foreground text-sm">
                            {totalDayHours > 0 ? `${totalDayHours.toFixed(1)}h` : '-'}
                          </div>
                        </div>
                        
                        {isEditing ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleSaveSession(dayData.sessions[0]?.id)}
                              className="h-8 w-8 p-0"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleCancelEdit}
                              className="h-8 w-8 p-0"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          (() => {
                            const sessionIsActiveToday = !session.clockOut && isToday(new Date(session.clockIn)); // Active session means no clockOut AND is today
                            
                            if (sessionIsIncomplete) {
                              // Show red exit button for force completing incomplete sessions (from previous days)
                              return (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => forceCompleteSessionMutation.mutate(session.id)}
                                  className="h-8 w-8 p-0 bg-red-600 hover:bg-red-700"
                                  disabled={forceCompleteSessionMutation.isPending}
                                >
                                  <LogOut className="w-4 h-4" />
                                </Button>
                              );
                            } else if (sessionIsActiveToday) {
                              // Don't show edit button for today's active sessions
                              return null;
                            } else {
                              // Show regular edit button for completed sessions only
                              return (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditSession(session)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              );
                            }
                          })()
                        )}
                      </div>
                    </div>
                    
                    {/* Timeline or edit mode */}
                    <div>
                      {isEditing ? (
                        <div className="space-y-3">
                          {/* Date picker for editing */}
                          <div>
                            <label className="text-xs font-medium text-foreground block mb-1">Fecha</label>
                            <DatePickerDay
                              date={editData.date ? new Date(editData.date) : undefined}
                              onDateChange={(date) => {
                                setEditData(prev => ({ 
                                  ...prev, 
                                  date: date ? format(date, 'yyyy-MM-dd') : '' 
                                }));
                              }}
                              className="h-8 text-sm w-full"
                              placeholder="Seleccionar fecha"
                            />
                          </div>
                          
                          {/* Entry and exit times */}
                          <div className="overflow-hidden">
                            <label className="text-xs font-medium text-foreground block mb-1">Horarios</label>
                            <div className="flex gap-2">
                              <div className="flex-1 min-w-0">
                                <Input
                                  type="time"
                                  value={editData.clockIn}
                                  onChange={(e) => setEditData(prev => ({ ...prev, clockIn: e.target.value }))}
                                  className="h-7 w-full px-1 min-w-0"
                                  style={{ fontSize: '10px', maxWidth: '100%' }}
                                />
                                <span className="text-xs text-muted-foreground mt-0.5 block">Entrada</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <Input
                                  type="time"
                                  value={editData.clockOut}
                                  onChange={(e) => setEditData(prev => ({ ...prev, clockOut: e.target.value }))}
                                  className="h-7 w-full px-1 min-w-0"
                                  style={{ fontSize: '10px', maxWidth: '100%' }}
                                />
                                <span className="text-xs text-muted-foreground mt-0.5 block">Salida</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Break periods */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-xs font-medium text-foreground">Descansos</label>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={handleAddBreakPeriod}
                                className="h-6 px-2 text-xs"
                              >
                                + Añadir
                              </Button>
                            </div>
                            
                            {editData.breakPeriods.map((breakPeriod, index) => (
                              <div key={index} className="flex items-center gap-1 mb-2">
                                <div className="flex-1 max-w-[40%]">
                                  <Input
                                    type="time"
                                    value={breakPeriod.breakStart}
                                    onChange={(e) => handleUpdateBreakPeriod(index, 'breakStart', e.target.value)}
                                    className="h-7 text-xs w-full px-1 max-w-full"
                                    placeholder="Inicio"
                                    style={{ fontSize: '10px' }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground px-1">-</span>
                                <div className="flex-1 max-w-[40%]">
                                  <Input
                                    type="time"
                                    value={breakPeriod.breakEnd || ''}
                                    onChange={(e) => handleUpdateBreakPeriod(index, 'breakEnd', e.target.value)}
                                    className="h-7 text-xs w-full px-1 max-w-full"
                                    placeholder="Fin"
                                    style={{ fontSize: '10px' }}
                                  />
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRemoveBreakPeriod(index)}
                                  className="h-7 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            ))}
                            
                            {editData.breakPeriods.length === 0 && (
                              <p className="text-xs text-muted-foreground italic">
                                Sin descansos programados
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="min-h-[40px] flex items-center">
                          <div className="bg-muted rounded-lg p-2 w-full">
                            <DailyTimelineBar dayData={dayData} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              });
              
              // Add final summaries for mobile
              if (showSummaries && sortedSessions.length > 0) {
                if (previousWeekStart) {
                  const weekTotal = calculateWeekTotal(previousWeekStart);
                  result.push(
                    <div key={`week-final`} className="bg-muted border border-border rounded-lg p-3 mx-4 mb-3">
                      <div className="font-medium text-foreground text-sm text-center">
                        Total semana: {weekTotal.toFixed(1)}h
                      </div>
                    </div>
                  );
                }
                
                if (currentMonth) {
                  const monthTotal = calculateMonthTotal(currentMonth);
                  const monthName = format(new Date(currentMonth + '-01'), 'MMMM yyyy', { locale: es });
                  
                  result.push(
                    <div key={`month-final`} className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mx-4 mb-3">
                      <div className="font-semibold text-blue-800 dark:text-blue-200 capitalize text-sm text-center">
                        Total {monthName}: {monthTotal.toFixed(1)}h
                      </div>
                    </div>
                  );
                }
              }
              
              return result;
            })()}
            
            {filteredSessions.length === 0 && (
              <div className="py-12 text-center mx-4">
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                    <Users className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div className="text-foreground font-medium">
                    No hay fichajes en este período
                  </div>
                  <div className="text-muted-foreground text-sm">
                    Prueba seleccionando un rango de fechas diferente
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}