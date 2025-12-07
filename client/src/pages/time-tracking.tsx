import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useFeatureCheck } from '@/hooks/use-feature-check';
import { usePageHeader } from '@/components/layout/page-header';
import { usePageTitle } from '@/hooks/use-page-title';
import { FeatureRestrictedPage } from '@/components/feature-restricted-page';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import StatsCard, { StatsCardGrid } from '@/components/StatsCard';
import { UserAvatar } from '@/components/ui/user-avatar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { TabNavigation } from '@/components/ui/tab-navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { DatePickerPeriod, DatePickerDay } from '@/components/ui/date-picker';
import { 
  Search, 
  Users,
  Filter,
  TrendingUp,
  Download,
  ChevronLeft,
  CalendarDays,
  BarChart3,
  ChevronRight,
  ChevronDown,
  Check,
  X,
  Clock,
  AlertTriangle,
  AlertCircle,
  Plus,
  Bell,
  FileText,
  History,
  ArrowDown,
  ArrowRight,
  LogOut,
  MapPin,
  Coffee,
  ExternalLink,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, startOfWeek, addDays, subDays, differenceInMinutes, startOfDay, endOfDay, endOfWeek, startOfMonth, endOfMonth, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

export default function TimeTracking() {
  usePageTitle('Gestión de Fichajes');
  const { user, company } = useAuth();
  const { hasAccess, getTimeTrackingAccessMode } = useFeatureCheck();
  const { setHeader, resetHeader } = usePageHeader();
  
  const timeTrackingAccessMode = getTimeTrackingAccessMode();
  const isSelfAccessOnly = timeTrackingAccessMode === 'self';

  // Set page header - adjust for self-access mode
  useEffect(() => {
    setHeader({
      title: isSelfAccessOnly ? 'Mis Fichajes' : 'Gestión de Fichajes',
      subtitle: isSelfAccessOnly ? 'Consulta tus registros de horas' : 'Administra todos los fichajes de empleados y genera reportes'
    });
    return resetHeader;
  }, [isSelfAccessOnly]);

  // State for auto-export trigger from AI
  const [pendingAutoExport, setPendingAutoExport] = useState<'pdf' | 'excel' | null>(null);

  // Read URL params to activate filters on load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const filterParam = urlParams.get('filter');
    const employeeIdParam = urlParams.get('employeeId');
    const startDateParam = urlParams.get('startDate');
    const endDateParam = urlParams.get('endDate');
    const exportParam = urlParams.get('export');
    
    if (filterParam === 'incomplete') {
      setActiveStatsFilter('incomplete');
    }
    
    // Apply employee filter from URL
    if (employeeIdParam) {
      setSelectedEmployee(employeeIdParam);
    }
    
    // Apply date range filter from URL
    if (startDateParam && endDateParam) {
      setDateFilter('custom');
      setStartDate(startDateParam);
      setEndDate(endDateParam);
      setSelectedStartDate(new Date(startDateParam));
      setSelectedEndDate(new Date(endDateParam));
    }
    
    // Trigger auto-export if requested by AI
    if (exportParam === 'pdf' || exportParam === 'excel') {
      setPendingAutoExport(exportParam);
    }
    
    // Clean URL after reading params to avoid confusion
    if (filterParam || employeeIdParam || startDateParam || endDateParam || exportParam) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);
  
  // Check if user has access to time tracking feature
  if (timeTrackingAccessMode === 'none') {
    return (
      <FeatureRestrictedPage
        featureName="Fichajes"
        description="Gestión de fichajes y control horario de empleados"
        icon={Clock}
      />
    );
  }
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // All useState hooks first
  const [searchTerm, setSearchTerm] = useState('');
  // In self-access mode, auto-select current user
  const [selectedEmployee, setSelectedEmployee] = useState(() => 
    isSelfAccessOnly && user?.id ? user.id.toString() : 'all'
  );
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
  const [showFilters, setShowFilters] = useState(false);
  const [showBreakTooltip, setShowBreakTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [tooltipContent, setTooltipContent] = useState('');
  const [activeStatsFilter, setActiveStatsFilter] = useState<'today' | 'week' | 'month' | 'incomplete' | null>(null);
  
  // Tab state
  const [activeTab, setActiveTab] = useState('sessions');
  
  // Summary tab states
  const [summaryWeek, setSummaryWeek] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [summarySearch, setSummarySearch] = useState('');
  
  // Requests tab filter states
  const [requestsStatus, setRequestsStatus] = useState('all');
  const [requestsEmployeeId, setRequestsEmployeeId] = useState('all');
  const [requestsType, setRequestsType] = useState('all');
  const [requestsEmployeeSearchTerm, setRequestsEmployeeSearchTerm] = useState('');
  
  // Modification & Audit states
  const [showManualEntryDialog, setShowManualEntryDialog] = useState(false);
  const [showRequestsDialog, setShowRequestsDialog] = useState(false);
  const [showAuditDialog, setShowAuditDialog] = useState(false);
  const [selectedSessionForAudit, setSelectedSessionForAudit] = useState<number | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showIncompleteWarningDialog, setShowIncompleteWarningDialog] = useState(false);
  const [pendingExportType, setPendingExportType] = useState<'pdf' | 'excel' | null>(null);
  const [incompleteSessionsCount, setIncompleteSessionsCount] = useState(0);
  
  // Close incomplete session dialog state
  const [showCloseIncompleteDialog, setShowCloseIncompleteDialog] = useState(false);
  const [closeIncompleteData, setCloseIncompleteData] = useState<{
    sessions: any[];
    userName: string;
    clockIn: Date;
    defaultCloseTime: string;
    selectedCloseTime: string;
  } | null>(null);
  
  // Infinite scroll state
  const [displayedCount, setDisplayedCount] = useState(15);
  const ITEMS_PER_LOAD = 15;
  
  // Expandable rows state
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const loadMoreDesktopRef = useRef<HTMLDivElement>(null);
  const loadMoreMobileRef = useRef<HTMLDivElement>(null);
  
  // Track first load completion for wave animation (only show animation on initial load)
  const [manualEntryData, setManualEntryData] = useState({
    employeeId: '',
    date: '',
    clockIn: '',
    clockOut: '',
    reason: ''
  });

  // Build query params for server-side filtering (Performance Optimization)
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    
    // Employee filter
    if (selectedEmployee !== 'all') {
      params.append('employeeId', selectedEmployee);
    }
    
    // Date filters
    if (dateFilter === 'custom' && startDate && endDate) {
      params.append('startDate', startDate);
      params.append('endDate', endDate);
    } else if (dateFilter === 'today') {
      const today = new Date();
      params.append('startDate', format(startOfDay(today), 'yyyy-MM-dd'));
      params.append('endDate', format(endOfDay(today), 'yyyy-MM-dd'));
    } else if (dateFilter === 'day') {
      params.append('startDate', format(startOfDay(currentDate), 'yyyy-MM-dd'));
      params.append('endDate', format(endOfDay(currentDate), 'yyyy-MM-dd'));
    } else if (dateFilter === 'month') {
      const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      params.append('startDate', format(startOfDay(monthStart), 'yyyy-MM-dd'));
      params.append('endDate', format(endOfDay(monthEnd), 'yyyy-MM-dd'));
    }
    
    // Status filter for incomplete sessions
    if (activeStatsFilter === 'incomplete') {
      params.append('status', 'incomplete');
    }
    
    return params.toString();
  }, [selectedEmployee, dateFilter, startDate, endDate, currentDate, currentMonth, activeStatsFilter]);

  // Server-side pagination with useInfiniteQuery
  const SESSIONS_PER_PAGE = 50;

  // useInfiniteQuery for proper infinite scroll
  const {
    data: infiniteData,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ['/api/work-sessions/company', queryParams],
    queryFn: async ({ pageParam = 0 }) => {
      const url = `/api/work-sessions/company?${queryParams}&limit=${SESSIONS_PER_PAGE}&offset=${pageParam}`;
      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${JSON.parse(localStorage.getItem('authData') || sessionStorage.getItem('authData') || '{}').token || ''}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });
      if (!response.ok) throw new Error('Failed to fetch sessions');
      return await response.json();
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      return allPages.length * SESSIONS_PER_PAGE;
    },
    enabled: !!user && (user.role === 'admin' || user.role === 'manager'),
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
    retryDelay: 750,
  });

  // Flatten all pages into single sessions array
  const allSessions = useMemo(() => {
    if (!infiniteData?.pages) return [];
    return infiniteData.pages.flatMap(page => page.sessions || []);
  }, [infiniteData]);

  // Get total count from last page
  const totalCount = infiniteData?.pages?.[infiniteData.pages.length - 1]?.totalCount || 0;
  
  // hasMore is true if we have more items to display (either locally or on server)
  const hasMoreToDisplay = displayedCount < allSessions.length || (hasNextPage ?? false);

  // Load more function for infinite scroll - first show more from loaded data, then fetch from server
  const loadMoreSessions = useCallback(() => {
    // First, check if we have more sessions loaded that we haven't displayed yet
    if (displayedCount < allSessions.length) {
      // Show more from already-loaded sessions
      setDisplayedCount(prev => Math.min(prev + ITEMS_PER_LOAD, allSessions.length + ITEMS_PER_LOAD));
      return;
    }
    
    // If we've displayed all loaded sessions and there are more on the server, fetch next page
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
      // Also increase displayedCount to show the newly loaded sessions
      setDisplayedCount(prev => prev + ITEMS_PER_LOAD);
    }
  }, [displayedCount, allSessions.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // For backwards compatibility
  const sessions = allSessions;

  // Employees with ultra-aggressive caching 
  const { data: employees = [] } = useQuery<any[]>({
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

  // Optimized query for Summary tab - returns only aggregated stats (no individual sessions)
  const summaryMonthStart = useMemo(() => startOfMonth(summaryWeek), [summaryWeek]);
  const summaryMonthEnd = useMemo(() => endOfMonth(summaryWeek), [summaryWeek]);
  
  // Monthly stats query
  const { data: monthlyStatsRaw = {} } = useQuery<Record<string, { employeeId: number; totalHours: number; totalBreakHours: number; sessionCount: number }>>({
    queryKey: ['/api/work-sessions/summary-stats', { startDate: format(summaryMonthStart, 'yyyy-MM-dd'), endDate: format(summaryMonthEnd, 'yyyy-MM-dd') }],
    enabled: !!user && (user.role === 'admin' || user.role === 'manager') && activeTab === 'summary',
    staleTime: 60 * 1000, // 1 minute - stats don't need to be super fresh
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
  
  // Weekly stats query (for the selected week within the month)
  const weekEnd = useMemo(() => endOfWeek(summaryWeek, { weekStartsOn: 1 }), [summaryWeek]);
  
  const { data: weeklyStatsRaw = {} } = useQuery<Record<string, { employeeId: number; totalHours: number; totalBreakHours: number; sessionCount: number }>>({
    queryKey: ['/api/work-sessions/summary-stats', { startDate: format(summaryWeek, 'yyyy-MM-dd'), endDate: format(weekEnd, 'yyyy-MM-dd') }],
    enabled: !!user && (user.role === 'admin' || user.role === 'manager') && activeTab === 'summary',
    staleTime: 60 * 1000, // 1 minute
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
  
  // Convert object response to arrays (API returns object with numeric keys)
  const monthlyStats = useMemo(() => Array.isArray(monthlyStatsRaw) ? monthlyStatsRaw : Object.values(monthlyStatsRaw || {}), [monthlyStatsRaw]);
  const weeklyStats = useMemo(() => Array.isArray(weeklyStatsRaw) ? weeklyStatsRaw : Object.values(weeklyStatsRaw || {}), [weeklyStatsRaw]);
  
  // Create lookup maps for fast access
  const monthlyStatsMap = useMemo(() => new Map(monthlyStats.map(s => [s.employeeId, s])), [monthlyStats]);
  const weeklyStatsMap = useMemo(() => new Map(weeklyStats.map(s => [s.employeeId, s])), [weeklyStats]);
  
  // Modification requests count - WebSocket handles real-time updates
  const { data: pendingRequestsData } = useQuery<{ count: number }>({
    queryKey: ['/api/admin/work-sessions/modification-requests/count'],
    enabled: !!user && (user.role === 'admin' || user.role === 'manager'),
    staleTime: 60000, // Cache for 1 min - WebSocket invalidates on changes
  });
  const pendingRequestsCount = pendingRequestsData?.count || 0;
  
  // Modification requests (when tab is active or dialog is open)
  const { data: modificationRequests = [], isLoading: isLoadingModificationRequests, isFetching: isFetchingModificationRequests } = useQuery<any[]>({
    queryKey: ['/api/admin/work-sessions/modification-requests'],
    enabled: !!user && (user.role === 'admin' || user.role === 'manager') && (activeTab === 'requests' || showRequestsDialog),
  });
  
  // Track if data has been shown at least once (for wave animation)
  const [sessionsHaveBeenShown, setSessionsHaveBeenShown] = useState(false);
  const [requestsHaveBeenShown, setRequestsHaveBeenShown] = useState(false);
  
  // Mark as shown when data is displayed for the first time
  useEffect(() => {
    if (!isLoading && allSessions.length > 0 && !sessionsHaveBeenShown) {
      // Small delay to allow wave animation to complete
      const timer = setTimeout(() => setSessionsHaveBeenShown(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [isLoading, allSessions.length, sessionsHaveBeenShown]);
  
  useEffect(() => {
    if (!isLoadingModificationRequests && modificationRequests.length > 0 && !requestsHaveBeenShown) {
      const timer = setTimeout(() => setRequestsHaveBeenShown(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [isLoadingModificationRequests, modificationRequests.length, requestsHaveBeenShown]);
  
  // Show wave loading animation only on first display
  const showSessionsWaveLoading = !sessionsHaveBeenShown && allSessions.length > 0;
  const showRequestsWaveLoading = !requestsHaveBeenShown && modificationRequests.length > 0;
  
  // WebSocket connection for real-time updates (Performance Optimization)
  useEffect(() => {
    if (!user || (user.role !== 'admin' && user.role !== 'manager')) return;

    // Get auth token for WebSocket authentication
    const authData = localStorage.getItem('auth');
    if (!authData) return;

    const { token } = JSON.parse(authData);
    
    // Build WebSocket URL dynamically from current window location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host; // Already includes port if needed
    const wsUrl = `${protocol}//${host}/ws/work-sessions?token=${token}`;

    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'work_session_created' || message.type === 'work_session_updated') {
          queryClient.invalidateQueries({ 
            queryKey: ['/api/work-sessions/company'],
            refetchType: 'none'
          });
          queryClient.invalidateQueries({ 
            queryKey: ['/api/work-sessions/summary-stats'],
            refetchType: 'none'
          });
          queryClient.invalidateQueries({ queryKey: ['/api/admin/work-sessions/modification-requests/count'] });
        }
      } catch {
        // Silent fail for malformed messages
      }
    };

    // Cleanup on unmount
    return () => {
      ws.close();
    };
  }, [user, queryClient]);

  // Lazy loading of audit logs - only when dialog is opened
  const { data: auditLogs = [], isLoading: isLoadingAuditLogs } = useQuery<any[]>({
    queryKey: [`/api/admin/work-sessions/${selectedSessionForAudit}/audit-log`],
    enabled: !!selectedSessionForAudit && showAuditDialog,
    staleTime: 30 * 1000,
  });

  // Reset displayed count when filters change
  useEffect(() => {
    setDisplayedCount(15);
  }, [selectedEmployee, dateFilter, startDate, endDate, currentDate, currentMonth, activeStatsFilter]);

  // Infinite scroll with IntersectionObserver - triggers fetchNextPage
  useEffect(() => {
    // Only set up observer when in sessions tab
    if (activeTab !== 'sessions') return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some(entry => entry.isIntersecting) && !isLoading && !isFetchingNextPage && hasMoreToDisplay) {
          loadMoreSessions();
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );
    
    // Small delay to ensure refs are mounted after tab switch
    const timeoutId = setTimeout(() => {
      if (loadMoreDesktopRef.current) {
        observer.observe(loadMoreDesktopRef.current);
      }
      if (loadMoreMobileRef.current) {
        observer.observe(loadMoreMobileRef.current);
      }
    }, 50);
    
    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [isLoading, isFetchingNextPage, hasMoreToDisplay, activeTab, loadMoreSessions]);

  // Helper function to check if a specific session is incomplete
  const isSessionIncomplete = useCallback((session: any) => {
    // Check the authoritative status from the database first
    if (session.status === 'incomplete') return true;
    
    // If session has clockOut, it's completed
    if (session.clockOut) return false;
    
    // No additional frontend calculation needed - backend handles this
    return false;
  }, []);

  // Function to check if a day has incomplete sessions
  const calculateSessionStatus = useCallback((dayData: any) => {
    if (!dayData.sessions?.length) {
      return 'complete';
    }

    // Check if any session has status 'incomplete' from the database
    const hasIncompleteSession = dayData.sessions.some((session: any) => 
      session.status === 'incomplete'
    );
    
    return hasIncompleteSession ? 'incomplete' : 'complete';
  }, []);

  // Create manual work session mutation
  const createManualSessionMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/admin/work-sessions/create-manual', {
      employeeId: parseInt(data.employeeId),
      date: new Date(`${data.date}T12:00:00`).toISOString(),
      clockIn: new Date(`${data.date}T${data.clockIn}:00`).toISOString(),
      clockOut: new Date(`${data.date}T${data.clockOut}:00`).toISOString(),
      reason: data.reason
    }),
    onSuccess: () => {
      toast({
        title: 'Fichaje Creado',
        description: 'El fichaje manual se ha creado exitosamente.',
      });
      setShowManualEntryDialog(false);
      setManualEntryData({ employeeId: '', date: '', clockIn: '', clockOut: '', reason: '' });
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions/company'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo crear el fichaje.',
        variant: 'destructive',
      });
    },
  });
  
  // Approve/reject modification request mutation
  const processRequestMutation = useMutation({
    mutationFn: ({ id, status, adminResponse }: { id: number; status: string; adminResponse?: string }) =>
      apiRequest('PATCH', `/api/admin/work-sessions/modification-requests/${id}`, { status, adminResponse }),
    onSuccess: () => {
      toast({
        title: 'Solicitud Procesada',
        description: 'La solicitud se ha procesado exitosamente.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/work-sessions/modification-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/work-sessions/modification-requests/count'] });
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions/company'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo procesar la solicitud.',
        variant: 'destructive',
      });
    },
  });
  
  // Close incomplete sessions mutation - accepts custom close time
  const closeIncompleteSessionsMutation = useMutation({
    mutationFn: async ({ sessions, clockOutTime }: { sessions: any[]; clockOutTime: Date }) => {
      const promises = sessions.map(session => {
        return apiRequest('POST', '/api/work-sessions/clock-out-incomplete', {
          sessionId: session.id,
          clockOutTime: clockOutTime.toISOString()
        });
      });
      
      return Promise.all(promises);
    },
    onSuccess: () => {
      toast({
        title: 'Día Cerrado',
        description: 'Las sesiones incompletas se han cerrado exitosamente.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions/company'] });
      setShowCloseIncompleteDialog(false);
      setCloseIncompleteData(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudieron cerrar las sesiones.',
        variant: 'destructive',
      });
    },
  });
  
  // Open close incomplete dialog with calculated default time
  const openCloseIncompleteDialog = useCallback((sessions: any[], userName: string) => {
    const firstSession = sessions[0];
    const clockIn = new Date(firstSession.clockIn);
    const maxHours = (companySettings as any)?.workingHoursPerDay || 8;
    
    // Calculate default close time = clockIn + maxHours
    const defaultCloseDate = new Date(clockIn);
    defaultCloseDate.setHours(clockIn.getHours() + maxHours, clockIn.getMinutes(), 0, 0);
    
    // If default exceeds 23:59, cap it
    const clockInDay = new Date(clockIn);
    clockInDay.setHours(23, 59, 0, 0);
    if (defaultCloseDate > clockInDay) {
      defaultCloseDate.setHours(23, 59, 0, 0);
    }
    
    const defaultTimeStr = format(defaultCloseDate, 'HH:mm');
    
    setCloseIncompleteData({
      sessions,
      userName,
      clockIn,
      defaultCloseTime: defaultTimeStr,
      selectedCloseTime: defaultTimeStr
    });
    setShowCloseIncompleteDialog(true);
  }, [companySettings]);

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

  // Generate last 24 months for month selector (independent of loaded data)
  const availableMonths = useMemo(() => {
    const months: string[] = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(format(date, 'yyyy-MM'));
    }
    return months;
  }, []);

  // ⚠️ PROTECTED: Data processing and filtering functions - DO NOT MODIFY
  // These functions are CRITICAL for data accuracy and filtering logic
  const { employeesList, sessionsList } = useMemo(() => {
    const allEmployees = (employees as any[]) || [];
    // Include admin for employee list so admin can see their own time tracking
    const filteredEmployees = allEmployees;
    // Include all sessions including admin sessions
    const filteredSessions = (sessions as any[]) || [];

    return {
      employeesList: filteredEmployees,
      sessionsList: filteredSessions
    };
  }, [employees, sessions]);

  // Client-side filtering only for search text (date/employee filters are handled server-side)
  // Server already filters by date, employee, and status via queryParams
  const filteredSessions = useMemo(() => {
    return sessionsList.filter((session: any) => {
      // Only filter by search text - everything else is handled by server
      const matchesSearch = !searchTerm || session.userName?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Incomplete filter logic for client-side validation
      if (activeStatsFilter === 'incomplete') {
        if (!session.clockOut) {
          const clockInTime = new Date(session.clockIn).getTime();
          const now = Date.now();
          const hoursElapsed = (now - clockInTime) / (1000 * 60 * 60);
          const maxHours = (companySettings as any)?.workingHoursPerDay || 8;
          return matchesSearch && hoursElapsed > maxHours;
        } else {
          return false;
        }
      }
      
      return matchesSearch;
    });
  }, [sessionsList, searchTerm, activeStatsFilter, companySettings]);

  // Generate dynamic title based on filter - text only (number shown separately)
  const getFilterTitle = () => {
    const fichajes = totalCount === 1 ? 'fichaje' : 'fichajes';
    
    switch (dateFilter) {
      case 'today':
        return `${fichajes} de hoy`;
      case 'day':
        return `${fichajes} el ${format(currentDate, "d 'de' MMMM 'de' yyyy", { locale: es })}`;
      case 'month':
        return `${fichajes} en ${format(currentMonth, "MMMM 'de' yyyy", { locale: es })}`;
      case 'custom':
        if (startDate && endDate) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          // Check if same day
          if (format(start, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd')) {
            return `${fichajes} el ${format(start, "d 'de' MMMM 'de' yyyy", { locale: es })}`;
          }
          return `${fichajes} del ${format(start, "d", { locale: es })} al ${format(end, "d 'de' MMMM 'de' yyyy", { locale: es })}`;
        }
        return fichajes;
      case 'all':
      default:
        return fichajes;
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
  const executeExportPDF = useCallback(async () => {
    // Get auth token for API calls
    const authData = JSON.parse(localStorage.getItem('authData') || sessionStorage.getItem('authData') || '{}');
    const authToken = authData.token || '';
    
    // First, load audit logs for sessions that have them
    const sessionsWithAuditLogs = await Promise.all(
      (filteredSessions || []).map(async (session: any) => {
        if (session.hasAuditLogs && (!session.auditLogs || session.auditLogs.length === 0)) {
          try {
            const response = await fetch(`/api/admin/work-sessions/${session.id}/audit-log`, {
              credentials: 'include',
              headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
              },
            });
            if (response.ok) {
              const auditLogs = await response.json();
              return { ...session, auditLogs };
            }
          } catch (error) {
            console.error('Error loading audit logs for session', session.id, error);
          }
        }
        return session;
      })
    );
    
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
        doc.text('MODIFICACIONES', colPositions[5], headerY);
        
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
      
      // Table setup for individual employee (added audit column on the right)
      const tableStartX = 20;
      const colWidths = [25, 18, 18, 28, 16, 60];
      const colPositions = [
        tableStartX, 
        tableStartX + colWidths[0], 
        tableStartX + colWidths[0] + colWidths[1], 
        tableStartX + colWidths[0] + colWidths[1] + colWidths[2],
        tableStartX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3],
        tableStartX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4]
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
          
          // Build audit info for the modifications column - ONE LINE PER ITEM for clarity
          let auditLines: string[] = [];
          
          // Check for modifications from audit logs
          const auditLogs = session.auditLogs || [];
          auditLogs.forEach((log: any, logIndex: number) => {
            // Extract just the reason without prefix
            let cleanReason = log.reason || '';
            const isEmployeeRequest = /^Employee request approved:/i.test(log.reason || '');
            cleanReason = cleanReason.replace(/^Employee request approved:\s*/i, '');
            cleanReason = cleanReason.replace(/^Admin modification:\s*/i, '');
            
            const approvedBy = log.modifiedByName || 'Admin';
            const modDate = log.modifiedAt ? format(new Date(log.modifiedAt), 'dd/MM HH:mm') : '';
            
            // Add separator between multiple modifications
            if (logIndex > 0) {
              auditLines.push('───────────');
            }
            
            if (log.modificationType === 'created_manual') {
              auditLines.push(`Registro manual creado`);
              auditLines.push(`Aprobado por: ${approvedBy}`);
              if (modDate) auditLines.push(`Fecha: ${modDate}`);
            } else if (log.modificationType === 'modified_clockin' || log.modificationType === 'modified_clockout' || log.modificationType === 'modified_both') {
              if (isEmployeeRequest) {
                auditLines.push(`Solicitud del empleado`);
              } else {
                auditLines.push(`Modificado por: ${approvedBy}`);
              }
              
              const oldVal = log.oldValue || {};
              const newVal = log.newValue || {};
              
              if ((log.modificationType === 'modified_clockin' || log.modificationType === 'modified_both') && oldVal.clockIn) {
                const oldTime = format(new Date(oldVal.clockIn), 'HH:mm');
                const newTime = newVal.clockIn ? format(new Date(newVal.clockIn), 'HH:mm') : format(new Date(session.clockIn), 'HH:mm');
                auditLines.push(`Entrada: ${oldTime} → ${newTime}`);
              }
              
              if ((log.modificationType === 'modified_clockout' || log.modificationType === 'modified_both') && oldVal.clockOut) {
                const oldTime = format(new Date(oldVal.clockOut), 'HH:mm');
                const newTime = newVal.clockOut ? format(new Date(newVal.clockOut), 'HH:mm') : (session.clockOut ? format(new Date(session.clockOut), 'HH:mm') : '-');
                auditLines.push(`Salida: ${oldTime} → ${newTime}`);
              }
              
              if (isEmployeeRequest) {
                auditLines.push(`Aprobado por: ${approvedBy}`);
              }
              
              if (modDate) auditLines.push(`Fecha modif.: ${modDate}`);
            }
            
            if (cleanReason) {
              if (cleanReason.length <= 40) {
                auditLines.push(`Motivo: ${cleanReason}`);
              } else {
                auditLines.push(`Motivo: ${cleanReason.substring(0, 37)}...`);
              }
            }
          });
          
          // Handle break periods - create separate rows for each break
          const breakPeriods = session.breakPeriods || [];
          if (breakPeriods.length === 0) {
            doc.text('Sin descansos', colPositions[3], currentY);
            doc.text(hours > 0 ? `${hours.toFixed(1)}h` : '-', colPositions[4], currentY);
            
            // Show audit info in modifications column - ONE LINE PER ITEM for clarity
            let auditHeight = 6; // Default height
            if (auditLines.length > 0) {
              doc.setFontSize(7);
              const lineHeight = 3.5;
              let yOffset = currentY;
              
              auditLines.forEach((line) => {
                // Check if it's a separator line
                if (line === '───────────') {
                  doc.setTextColor(180, 180, 180);
                  doc.setFont('helvetica', 'normal');
                  doc.text('─────────', colPositions[5], yOffset);
                  yOffset += lineHeight;
                  return;
                }
                
                // Split on FIRST colon to handle times like "Entrada: 09:00 → 10:30"
                const colonIndex = line.indexOf(':');
                if (colonIndex !== -1) {
                  const label = line.substring(0, colonIndex).trim();
                  const value = line.substring(colonIndex + 1).trim();
                  
                  doc.setTextColor(100, 100, 100);
                  doc.setFont('helvetica', 'normal');
                  doc.text(label + ':', colPositions[5], yOffset);
                  const labelWidth = doc.getTextWidth(label + ': ');
                  
                  doc.setTextColor(50, 50, 50);
                  doc.setFont('helvetica', 'bold');
                  doc.text(value, colPositions[5] + labelWidth, yOffset);
                } else {
                  doc.setTextColor(50, 50, 50);
                  doc.setFont('helvetica', 'bold');
                  doc.text(line, colPositions[5], yOffset);
                }
                
                yOffset += lineHeight;
              });
              
              // Calculate height based on actual lines drawn
              auditHeight = Math.max(6, auditLines.length * lineHeight + 2);
            }
            
            currentY += auditHeight;
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
            
            // Show audit info in modifications column - ONE LINE PER ITEM for clarity
            let auditHeight = 6; // Default height
            if (auditLines.length > 0) {
              doc.setFontSize(7);
              const lineHeight = 3.5;
              let yOffset = currentY;
              
              auditLines.forEach((line) => {
                // Check if it's a separator line
                if (line === '───────────') {
                  doc.setTextColor(180, 180, 180);
                  doc.setFont('helvetica', 'normal');
                  doc.text('─────────', colPositions[5], yOffset);
                  yOffset += lineHeight;
                  return;
                }
                
                // Split on FIRST colon to handle times like "Entrada: 09:00 → 10:30"
                const colonIndex = line.indexOf(':');
                if (colonIndex !== -1) {
                  const label = line.substring(0, colonIndex).trim();
                  const value = line.substring(colonIndex + 1).trim();
                  
                  doc.setTextColor(100, 100, 100);
                  doc.setFont('helvetica', 'normal');
                  doc.text(label + ':', colPositions[5], yOffset);
                  const labelWidth = doc.getTextWidth(label + ': ');
                  
                  doc.setTextColor(50, 50, 50);
                  doc.setFont('helvetica', 'bold');
                  doc.text(value, colPositions[5] + labelWidth, yOffset);
                } else {
                  doc.setTextColor(50, 50, 50);
                  doc.setFont('helvetica', 'bold');
                  doc.text(line, colPositions[5], yOffset);
                }
                
                yOffset += lineHeight;
              });
              
              // Calculate height based on actual lines drawn
              auditHeight = Math.max(6, auditLines.length * lineHeight + 2);
            }
            
            currentY += auditHeight;
            
            // Add subtle separator line between work sessions (centered in the gap)
            doc.setDrawColor(220, 220, 220);
            doc.setLineWidth(0.1);
            doc.line(tableStartX, currentY - 3, tableStartX + colWidths.reduce((a, b) => a + b, 0), currentY - 3);
            
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
          
          // Add subtle separator line after each work session (centered in the gap)
          doc.setDrawColor(220, 220, 220);
          doc.setLineWidth(0.1);
          doc.line(tableStartX, currentY - 3, tableStartX + colWidths.reduce((a, b) => a + b, 0), currentY - 3);
          
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
          
          // Build audit info for the modifications column - ONE LINE PER ITEM for clarity
          let auditLines: string[] = [];
          
          // Check for modifications from audit logs
          const auditLogs = session.auditLogs || [];
          auditLogs.forEach((log: any, logIndex: number) => {
            // Extract just the reason without prefix
            let cleanReason = log.reason || '';
            const isEmployeeRequest = /^Employee request approved:/i.test(log.reason || '');
            cleanReason = cleanReason.replace(/^Employee request approved:\s*/i, '');
            cleanReason = cleanReason.replace(/^Admin modification:\s*/i, '');
            
            const approvedBy = log.modifiedByName || 'Admin';
            const modDate = log.modifiedAt ? format(new Date(log.modifiedAt), 'dd/MM HH:mm') : '';
            
            // Add separator between multiple modifications
            if (logIndex > 0) {
              auditLines.push('───────────');
            }
            
            if (log.modificationType === 'created_manual') {
              auditLines.push(`Registro manual creado`);
              auditLines.push(`Aprobado por: ${approvedBy}`);
              if (modDate) auditLines.push(`Fecha: ${modDate}`);
            } else if (log.modificationType === 'modified_clockin' || log.modificationType === 'modified_clockout' || log.modificationType === 'modified_both') {
              if (isEmployeeRequest) {
                auditLines.push(`Solicitud del empleado`);
              } else {
                auditLines.push(`Modificado por: ${approvedBy}`);
              }
              
              const oldVal = log.oldValue || {};
              const newVal = log.newValue || {};
              
              if ((log.modificationType === 'modified_clockin' || log.modificationType === 'modified_both') && oldVal.clockIn) {
                const oldTime = format(new Date(oldVal.clockIn), 'HH:mm');
                const newTime = newVal.clockIn ? format(new Date(newVal.clockIn), 'HH:mm') : format(new Date(session.clockIn), 'HH:mm');
                auditLines.push(`Entrada: ${oldTime} → ${newTime}`);
              }
              
              if ((log.modificationType === 'modified_clockout' || log.modificationType === 'modified_both') && oldVal.clockOut) {
                const oldTime = format(new Date(oldVal.clockOut), 'HH:mm');
                const newTime = newVal.clockOut ? format(new Date(newVal.clockOut), 'HH:mm') : (session.clockOut ? format(new Date(session.clockOut), 'HH:mm') : '-');
                auditLines.push(`Salida: ${oldTime} → ${newTime}`);
              }
              
              if (isEmployeeRequest) {
                auditLines.push(`Aprobado por: ${approvedBy}`);
              }
              
              if (modDate) auditLines.push(`Fecha modif.: ${modDate}`);
            }
            
            if (cleanReason) {
              if (cleanReason.length <= 40) {
                auditLines.push(`Motivo: ${cleanReason}`);
              } else {
                auditLines.push(`Motivo: ${cleanReason.substring(0, 37)}...`);
              }
            }
          });
          
          // Handle break periods - create separate rows for each break
          const breakPeriods = session.breakPeriods || [];
          if (breakPeriods.length === 0) {
            doc.text('Sin descansos', colPositions[3], currentY);
            doc.text(hours > 0 ? `${hours.toFixed(1)}h` : '-', colPositions[4], currentY);
            
            // Show audit info in modifications column - ONE LINE PER ITEM for clarity
            let auditHeight = 6; // Default height
            if (auditLines.length > 0) {
              doc.setFontSize(7);
              const lineHeight = 3.5;
              let yOffset = currentY;
              
              auditLines.forEach((line) => {
                // Check if it's a separator line
                if (line === '───────────') {
                  doc.setTextColor(180, 180, 180);
                  doc.setFont('helvetica', 'normal');
                  doc.text('─────────', colPositions[5], yOffset);
                  yOffset += lineHeight;
                  return;
                }
                
                // Split on FIRST colon to handle times like "Entrada: 09:00 → 10:30"
                const colonIndex = line.indexOf(':');
                if (colonIndex !== -1) {
                  const label = line.substring(0, colonIndex).trim();
                  const value = line.substring(colonIndex + 1).trim();
                  
                  doc.setTextColor(100, 100, 100);
                  doc.setFont('helvetica', 'normal');
                  doc.text(label + ':', colPositions[5], yOffset);
                  const labelWidth = doc.getTextWidth(label + ': ');
                  
                  doc.setTextColor(50, 50, 50);
                  doc.setFont('helvetica', 'bold');
                  doc.text(value, colPositions[5] + labelWidth, yOffset);
                } else {
                  doc.setTextColor(50, 50, 50);
                  doc.setFont('helvetica', 'bold');
                  doc.text(line, colPositions[5], yOffset);
                }
                
                yOffset += lineHeight;
              });
              
              // Calculate height based on actual lines drawn
              auditHeight = Math.max(6, auditLines.length * lineHeight + 2);
            }
            
            currentY += auditHeight;
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
            
            // Show audit info in modifications column - ONE LINE PER ITEM for clarity
            let auditHeight = 6; // Default height
            if (auditLines.length > 0) {
              doc.setFontSize(7);
              const lineHeight = 3.5;
              let yOffset = currentY;
              
              auditLines.forEach((line) => {
                // Check if it's a separator line
                if (line === '───────────') {
                  doc.setTextColor(180, 180, 180);
                  doc.setFont('helvetica', 'normal');
                  doc.text('─────────', colPositions[5], yOffset);
                  yOffset += lineHeight;
                  return;
                }
                
                // Split on FIRST colon to handle times like "Entrada: 09:00 → 10:30"
                const colonIndex = line.indexOf(':');
                if (colonIndex !== -1) {
                  const label = line.substring(0, colonIndex).trim();
                  const value = line.substring(colonIndex + 1).trim();
                  
                  doc.setTextColor(100, 100, 100);
                  doc.setFont('helvetica', 'normal');
                  doc.text(label + ':', colPositions[5], yOffset);
                  const labelWidth = doc.getTextWidth(label + ': ');
                  
                  doc.setTextColor(50, 50, 50);
                  doc.setFont('helvetica', 'bold');
                  doc.text(value, colPositions[5] + labelWidth, yOffset);
                } else {
                  doc.setTextColor(50, 50, 50);
                  doc.setFont('helvetica', 'bold');
                  doc.text(line, colPositions[5], yOffset);
                }
                
                yOffset += lineHeight;
              });
              
              // Calculate height based on actual lines drawn
              auditHeight = Math.max(6, auditLines.length * lineHeight + 2);
            }
            
            currentY += auditHeight;
            
            // Add subtle separator line between work sessions (centered in the gap)
            doc.setDrawColor(220, 220, 220);
            doc.setLineWidth(0.1);
            doc.line(tableStartX, currentY - 3, tableStartX + colWidths.reduce((a, b) => a + b, 0), currentY - 3);
            
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
            
            // Add subtle separator line after all breaks
            doc.setDrawColor(220, 220, 220);
            doc.setLineWidth(0.1);
            doc.line(tableStartX, currentY - 2, tableStartX + colWidths.reduce((a, b) => a + b, 0), currentY - 2);
          }
        });
      }
      
      // Add footer to the last page of this employee
      addFooter();
    };

    if (selectedEmployee !== 'all') {
      // Single employee PDF
      const employee = employeesList.find(emp => emp.id.toString() === selectedEmployee);
      createEmployeePage(employee, sessionsWithAuditLogs, true);
    } else {
      // Multiple employees - one page per employee
      const employeesWithSessions = (employeesList || []).filter(employee => 
        sessionsWithAuditLogs.some(session => session.userId === employee.id)
      );
      
      employeesWithSessions.forEach((employee, index) => {
        const employeeSessions = sessionsWithAuditLogs.filter(session => session.userId === employee.id);
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

  // Export to Excel function
  const executeExportExcel = useCallback(() => {
    if (!filteredSessions || filteredSessions.length === 0) {
      toast({
        title: "No hay datos para exportar",
        description: "No se encontraron fichajes con los filtros seleccionados",
        variant: "destructive"
      });
      return;
    }

    // Check if exporting all employees
    const isAllEmployees = !selectedEmployee || selectedEmployee === 'all';
    
    // Create workbook
    const workbook = XLSX.utils.book_new();

    if (isAllEmployees) {
      // First sheet: All employees together
      const allData = createExcelDataForSessions(filteredSessions);
      const allWorksheet = XLSX.utils.json_to_sheet(allData);
      
      // Set column widths for "Todos" sheet
      allWorksheet['!cols'] = [
        { wch: 12 }, // Fecha
        { wch: 25 }, // Empleado
        { wch: 10 }, // Entrada
        { wch: 10 }, // Salida
        { wch: 16 }, // Inicio Descanso
        { wch: 14 }, // Fin Descanso
        { wch: 15 }, // Total Descanso
        { wch: 15 }, // Horas Diarias
        { wch: 15 }, // Total Semanal
        { wch: 25 }, // Total Mensual
        { wch: 60 }  // Modificaciones
      ];
      
      XLSX.utils.book_append_sheet(workbook, allWorksheet, 'Todos');

      // Group sessions by employee
      const sessionsByEmployee = new Map<string, any[]>();
      
      filteredSessions.forEach((session: any) => {
        const employeeName = session.userName || 'Desconocido';
        if (!sessionsByEmployee.has(employeeName)) {
          sessionsByEmployee.set(employeeName, []);
        }
        sessionsByEmployee.get(employeeName)!.push(session);
      });

      // Create a sheet for each employee
      sessionsByEmployee.forEach((sessions, employeeName) => {
        const data = createExcelDataForSessions(sessions);
        const worksheet = XLSX.utils.json_to_sheet(data);
        
        // Set column widths
        worksheet['!cols'] = [
          { wch: 12 }, // Fecha
          { wch: 25 }, // Empleado
          { wch: 10 }, // Entrada
          { wch: 10 }, // Salida
          { wch: 16 }, // Inicio Descanso
          { wch: 14 }, // Fin Descanso
          { wch: 15 }, // Total Descanso
          { wch: 15 }, // Horas Diarias
          { wch: 15 }, // Total Semanal
          { wch: 25 }, // Total Mensual
          { wch: 60 }  // Modificaciones
        ];

        // Sheet name limited to 31 characters
        const sheetName = employeeName.substring(0, 31);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      });
    } else {
      // Single employee - single sheet
      const data = createExcelDataForSessions(filteredSessions);
      const worksheet = XLSX.utils.json_to_sheet(data);
      
      // Set column widths
      worksheet['!cols'] = [
        { wch: 12 }, // Fecha
        { wch: 25 }, // Empleado
        { wch: 10 }, // Entrada
        { wch: 10 }, // Salida
        { wch: 16 }, // Inicio Descanso
        { wch: 14 }, // Fin Descanso
        { wch: 15 }, // Total Descanso
        { wch: 15 }, // Horas Diarias
        { wch: 15 }, // Total Semanal
        { wch: 25 }, // Total Mensual
        { wch: 60 }  // Modificaciones
      ];

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Fichajes');
    }

    // Generate filename
    let employeePart = 'todos-empleados';
    if (selectedEmployee && selectedEmployee !== 'all') {
      const employee = employeesList.find((e: any) => e.id.toString() === selectedEmployee);
      if (employee) {
        employeePart = employee.fullName.toLowerCase().replace(/\s+/g, '-');
      }
    }

    let timePart = 'todos-registros';
    if (dateFilter === 'day') {
      timePart = format(currentDate, 'dd-MM-yyyy');
    } else if (dateFilter === 'month') {
      timePart = format(currentMonth, 'MMMM-yyyy', { locale: es });
    } else if (dateFilter === 'custom') {
      if (startDate && endDate) {
        timePart = `${format(new Date(startDate), 'dd-MM-yyyy')} - ${format(new Date(endDate), 'dd-MM-yyyy')}`;
      } else if (startDate) {
        timePart = `desde ${format(new Date(startDate), 'dd-MM-yyyy')}`;
      } else if (endDate) {
        timePart = `hasta ${format(new Date(endDate), 'dd-MM-yyyy')}`;
      }
    }

    const exportDateTime = format(new Date(), 'dd-MM-yy - HH-mm');
    const fileName = `${employeePart} - ${timePart} - ${exportDateTime}.xlsx`
      .replace(/[/\\?%*:|"<>]/g, '-')
      .replace(/\s+/g, ' ')
      .trim();

    // Download file
    XLSX.writeFile(workbook, fileName);

    toast({
      title: "Excel exportado correctamente",
      description: `El archivo ${fileName} se ha descargado`,
    });
  }, [filteredSessions, selectedEmployee, employeesList, dateFilter, currentDate, currentMonth, startDate, endDate, toast]);

  // Handlers for export that check for incomplete sessions first
  const handleExportPDF = useCallback(async () => {
    setShowExportDialog(false);
    
    if (filteredSessions && filteredSessions.length > 0) {
      const incompleteSessions = filteredSessions.filter((session: any) => !session.clockOut);
      if (incompleteSessions.length > 0) {
        setIncompleteSessionsCount(incompleteSessions.length);
        setPendingExportType('pdf');
        setShowIncompleteWarningDialog(true);
        return;
      }
    }
    
    await executeExportPDF();
  }, [filteredSessions, executeExportPDF]);

  const handleExportExcel = useCallback(() => {
    setShowExportDialog(false);
    
    if (filteredSessions && filteredSessions.length > 0) {
      const incompleteSessions = filteredSessions.filter((session: any) => !session.clockOut);
      if (incompleteSessions.length > 0) {
        setIncompleteSessionsCount(incompleteSessions.length);
        setPendingExportType('excel');
        setShowIncompleteWarningDialog(true);
        return;
      }
    }
    
    executeExportExcel();
  }, [filteredSessions, executeExportExcel]);

  const handleConfirmExport = useCallback(async () => {
    setShowIncompleteWarningDialog(false);
    
    if (pendingExportType === 'pdf') {
      await executeExportPDF();
    } else if (pendingExportType === 'excel') {
      executeExportExcel();
    }
    
    setPendingExportType(null);
    setIncompleteSessionsCount(0);
  }, [pendingExportType, executeExportPDF, executeExportExcel]);

  const handleCancelExport = useCallback(() => {
    setShowIncompleteWarningDialog(false);
    setPendingExportType(null);
    setIncompleteSessionsCount(0);
  }, []);

  // Auto-export triggered by AI navigation
  useEffect(() => {
    if (pendingAutoExport && filteredSessions && filteredSessions.length > 0) {
      // Small delay to ensure UI is ready
      const timer = setTimeout(() => {
        if (pendingAutoExport === 'pdf') {
          handleExportPDF();
        } else if (pendingAutoExport === 'excel') {
          handleExportExcel();
        }
        setPendingAutoExport(null);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [pendingAutoExport, filteredSessions, handleExportPDF, handleExportExcel]);

  // Helper function to create Excel data for a set of sessions
  const createExcelDataForSessions = (sessions: any[]) => {
    const data: any[] = [];
    
    // Sort sessions by date
    const sortedSessions = [...sessions].sort((a, b) => new Date(a.clockIn).getTime() - new Date(b.clockIn).getTime());
    
    // Track totals for summaries
    let currentWeekStart: Date | null = null;
    let currentMonth: string | null = null;
    let weekHours = 0;
    let monthHours = 0;

    sortedSessions.forEach((session: any, index: number) => {
      const sessionDate = new Date(session.clockIn);
      const weekStart = startOfWeek(sessionDate, { weekStartsOn: 1 });
      const monthKey = format(sessionDate, 'yyyy-MM');
      
      const isNewWeek = currentWeekStart === null || weekStart.getTime() !== currentWeekStart.getTime();
      const isNewMonth = currentMonth === null || monthKey !== currentMonth;

      // Calculate hours for this session
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

      // Add month summary row before new month
      if (isNewMonth && index > 0 && currentMonth !== null) {
        const [year, month] = currentMonth.split('-');
        const monthName = format(new Date(parseInt(year), parseInt(month) - 1), 'MMMM yyyy', { locale: es });
        data.push({
          Fecha: '',
          Empleado: '',
          Entrada: '',
          Salida: '',
          'Inicio Descanso': '',
          'Fin Descanso': '',
          'Total Descanso': '',
          'Horas Diarias': '',
          'Total Semanal': '',
          'Total Mensual': `${monthHours.toFixed(1)}h (${monthName})`,
          Modificaciones: ''
        });
        monthHours = 0;
      }

      // Add week summary row before new week
      if (isNewWeek && index > 0 && currentWeekStart && !isNewMonth) {
        data.push({
          Fecha: '',
          Empleado: '',
          Entrada: '',
          Salida: '',
          'Inicio Descanso': '',
          'Fin Descanso': '',
          'Total Descanso': '',
          'Horas Diarias': '',
          'Total Semanal': `${weekHours.toFixed(1)}h`,
          'Total Mensual': '',
          Modificaciones: ''
        });
        weekHours = 0;
      }

      if (isNewWeek) {
        currentWeekStart = weekStart;
      }
      if (isNewMonth) {
        currentMonth = monthKey;
      }

      // Build break periods text
      const breakPeriods = session.breakPeriods || [];
      let breakStartText = '';
      let breakEndText = '';
      
      breakPeriods.forEach((breakPeriod: any, idx: number) => {
        if (breakPeriod.breakStart) {
          if (idx > 0) breakStartText += ', ';
          breakStartText += format(new Date(breakPeriod.breakStart), 'HH:mm');
        }
        if (breakPeriod.breakEnd) {
          if (idx > 0) breakEndText += ', ';
          breakEndText += format(new Date(breakPeriod.breakEnd), 'HH:mm');
        } else if (breakPeriod.breakStart) {
          if (idx > 0) breakEndText += ', ';
          breakEndText += 'Incompleto';
        }
      });

      // Build modifications description
      let modificationsText = '';
      const auditLogs = session.auditLogs || [];
      auditLogs.forEach((log: any) => {
        let cleanReason = log.reason || '';
        cleanReason = cleanReason.replace(/^Employee request approved:\s*/i, '');
        cleanReason = cleanReason.replace(/^Admin modification:\s*/i, '');
        
        const approvedBy = log.modifiedByName || 'Admin';
        
        if (log.modificationType === 'created_manual') {
          modificationsText += `Fichaje manual solicitado por empleado, aprobado por ${approvedBy}. `;
        } else if (log.modificationType === 'modified_clockin' || log.modificationType === 'modified_clockout' || log.modificationType === 'modified_both') {
          const oldVal = log.oldValue || {};
          
          if (log.modificationType === 'modified_clockin' && oldVal.clockIn) {
            const oldTime = format(new Date(oldVal.clockIn), 'HH:mm');
            modificationsText += `Entrada modificada (anterior: ${oldTime}). `;
          }
          if (log.modificationType === 'modified_clockout' && oldVal.clockOut) {
            const oldTime = format(new Date(oldVal.clockOut), 'HH:mm');
            modificationsText += `Salida modificada (anterior: ${oldTime}). `;
          }
          if (log.modificationType === 'modified_both') {
            if (oldVal.clockIn) {
              const oldTime = format(new Date(oldVal.clockIn), 'HH:mm');
              modificationsText += `Entrada modificada (anterior: ${oldTime}). `;
            }
            if (oldVal.clockOut) {
              const oldTime = format(new Date(oldVal.clockOut), 'HH:mm');
              modificationsText += `Salida modificada (anterior: ${oldTime}). `;
            }
          }
          modificationsText += `Aprobado por ${approvedBy}. `;
        }
        
        if (cleanReason) {
          modificationsText += `Motivo: ${cleanReason}. `;
        }
      });

      // Add session data row
      data.push({
        Fecha: format(sessionDate, 'dd/MM/yyyy'),
        Empleado: session.userName || 'Desconocido',
        Entrada: session.clockIn ? format(new Date(session.clockIn), 'HH:mm') : '',
        Salida: session.clockOut ? format(new Date(session.clockOut), 'HH:mm') : 'Incompleto',
        'Inicio Descanso': breakStartText || '-',
        'Fin Descanso': breakEndText || '-',
        'Total Descanso': breakHours > 0 ? `${breakHours.toFixed(1)}h` : '-',
        'Horas Diarias': session.clockOut ? `${hours.toFixed(1)}h` : '',
        'Total Semanal': '',
        'Total Mensual': '',
        Modificaciones: modificationsText.trim()
      });

      weekHours += hours;
      monthHours += hours;
    });

    // Add final week summary
    if (weekHours > 0) {
      data.push({
        Fecha: '',
        Empleado: '',
        Entrada: '',
        Salida: '',
        'Inicio Descanso': '',
        'Fin Descanso': '',
        'Total Descanso': '',
        'Horas Diarias': '',
        'Total Semanal': `${weekHours.toFixed(1)}h`,
        'Total Mensual': '',
        Modificaciones: ''
      });
    }

    // Add final month summary
    if (monthHours > 0 && currentMonth !== null) {
      const [year, month] = (currentMonth as string).split('-');
      const monthName = format(new Date(parseInt(year), parseInt(month) - 1), 'MMMM yyyy', { locale: es });
      data.push({
        Fecha: '',
        Empleado: '',
        Entrada: '',
        Salida: '',
        'Inicio Descanso': '',
        'Fin Descanso': '',
        'Total Descanso': '',
        'Horas Diarias': '',
        'Total Semanal': '',
        'Total Mensual': `${monthHours.toFixed(1)}h (${monthName})`,
        Modificaciones: ''
      });
    }

    return data;
  };

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

  // Helper function to consolidate sessions that are close together (within 15 minutes gap)
  const consolidateSessions = (sessions: any[]) => {
    if (!sessions || sessions.length <= 1) return { consolidated: sessions, wasConsolidated: false };
    
    const CONSOLIDATION_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes in milliseconds
    
    // Sort sessions by clockIn time
    const sortedSessions = [...sessions].sort((a, b) => 
      new Date(a.clockIn).getTime() - new Date(b.clockIn).getTime()
    );
    
    const consolidatedGroups: any[][] = [];
    let currentGroup: any[] = [sortedSessions[0]];
    
    for (let i = 1; i < sortedSessions.length; i++) {
      const prevSession = currentGroup[currentGroup.length - 1];
      const currSession = sortedSessions[i];
      
      // Only consolidate if both sessions have clockOut (completed sessions)
      if (prevSession.clockOut && currSession.clockIn) {
        const prevClockOut = new Date(prevSession.clockOut).getTime();
        const currClockIn = new Date(currSession.clockIn).getTime();
        const gap = currClockIn - prevClockOut;
        
        if (gap >= 0 && gap <= CONSOLIDATION_THRESHOLD_MS) {
          // Sessions are close enough, add to current group
          currentGroup.push(currSession);
        } else {
          // Gap too large, start new group
          consolidatedGroups.push(currentGroup);
          currentGroup = [currSession];
        }
      } else {
        // Can't consolidate incomplete sessions
        consolidatedGroups.push(currentGroup);
        currentGroup = [currSession];
      }
    }
    consolidatedGroups.push(currentGroup);
    
    // Create consolidated session objects
    const consolidated = consolidatedGroups.map(group => {
      if (group.length === 1) return group[0];
      
      // Merge all break periods from all sessions in the group
      const allBreakPeriods = group.flatMap((s: any) => s.breakPeriods || []);
      
      return {
        ...group[0],
        id: `consolidated-${group[0].id}`,
        clockIn: group[0].clockIn,
        clockOut: group[group.length - 1].clockOut,
        breakPeriods: allBreakPeriods,
        isConsolidated: true,
        originalSessions: group,
        originalCount: group.length
      };
    });
    
    const wasConsolidated = consolidatedGroups.some(g => g.length > 1);
    return { consolidated, wasConsolidated };
  };

  // Daily Timeline Bar Component for displaying multiple sessions in a single day
  const DailyTimelineBar = ({ dayData }: { dayData: any }) => {
    if (!dayData.sessions || dayData.sessions.length === 0) {
      return <div className="text-gray-400">Sin datos</div>;
    }

    // PRIORITY 1: Check for incomplete sessions first (most important to show)
    const hasIncompleteSession = dayData.sessions.some((session: any) => session.status === 'incomplete');
    
    // PRIORITY 2: Check for active sessions (sessions without clockOut)
    const hasActiveSessions = dayData.sessions.some((session: any) => !session.clockOut && session.status !== 'incomplete');
    
    // Only show "Trabajando" status for TODAY's active sessions
    // For past days with incomplete sessions, use the incomplete view
    const isTodaySession = dayData.sessions.some((session: any) => 
      session.clockIn && isToday(new Date(session.clockIn))
    );
    
    // Handle incomplete sessions FIRST (highest priority)
    if (hasIncompleteSession) {
      const incompleteSession = dayData.sessions.find((session: any) => session.status === 'incomplete');
      const sessionStart = new Date(incompleteSession.clockIn);
      const formatTime = (date: Date) => format(date, 'HH:mm');

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
            {/* Start time with green circle */}
            <div className="absolute flex items-center" style={{ left: '0%', top: '0px' }}>
              <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
              <span className="text-xs font-medium text-green-700 whitespace-nowrap">{formatTime(sessionStart)}</span>
            </div>
            
            {/* "Incompleto" status with red circle */}
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
            
            {/* Descanso activo - siempre a la derecha de la barra */}
            {activeBreakPeriod && (
              <div
                className="absolute text-xs text-orange-600 font-medium flex items-center gap-1 animate-pulse"
                style={{ 
                  left: `${progressPercentage}%`,
                  top: '0px',
                  marginLeft: '4px'
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
              {/* Barra verde progresiva para sesión activa (se va llenando en tiempo real) */}
              <div
                className="absolute top-0 h-5 bg-green-500 rounded-sm transition-all duration-1000"
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
              <span className={`text-xs font-medium mr-1 whitespace-nowrap ${activeBreakPeriod ? 'text-orange-600' : 'text-green-600'}`}>
                {activeBreakPeriod ? 'En descanso' : 'Trabajando'}
              </span>
              <div className={`w-2 h-2 rounded-full ${activeBreakPeriod ? 'bg-orange-500 animate-pulse' : 'bg-green-500 animate-pulse'}`}></div>
            </div>
          </div>
        </div>
      );
    }

    // Apply session consolidation for visual display
    const { consolidated: consolidatedSessions, wasConsolidated } = consolidateSessions(dayData.sessions);
    
    // Calcular el rango total del día (desde primera entrada hasta última salida) - solo sesiones completadas
    const allTimes = consolidatedSessions.flatMap((session: any) => [
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
          {consolidatedSessions.map((session: any, sessionIndex: number) => {
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
            {consolidatedSessions.filter((session: any) => session.clockOut).map((session: any, sessionIndex: number) => {
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
                    
                    // Validar que el descanso esté dentro de la sesión
                    const clampedBreakStart = new Date(Math.max(breakStart.getTime(), sessionStart.getTime()));
                    const clampedBreakEnd = new Date(Math.min(breakEnd.getTime(), sessionEnd.getTime()));
                    
                    // Posición del descanso relativa al día
                    const breakStartOffset = (clampedBreakStart.getTime() - dayStart.getTime()) / (1000 * 60 * 60);
                    const breakDurationHours = (clampedBreakEnd.getTime() - clampedBreakStart.getTime()) / (1000 * 60 * 60);
                    
                    // Calcular porcentajes con límites
                    const breakLeftPercentage = Math.max(0, Math.min((breakStartOffset / totalDayDuration) * 100, 100));
                    const breakWidthPercentage = Math.max(0.5, Math.min((breakDurationHours / totalDayDuration) * 100, 100 - breakLeftPercentage));
                    
                    return (
                      <div
                        key={`${sessionIndex}-${breakIndex}`}
                        className="absolute top-0.5 h-4 bg-orange-400 rounded-sm"
                        style={{
                          left: `${breakLeftPercentage}%`,
                          width: `${breakWidthPercentage}%`
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
            const completedSessions = consolidatedSessions.filter((session: any) => session.clockOut);
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
                  (<div 
                    key={key}
                    className="absolute w-2 h-2 bg-green-500 rounded-full cursor-help shadow-md border border-white" 
                    style={{ 
                      left: `${label.position - 1}%`,
                      top: '0px',
                      transform: 'translateX(-50%)',
                      zIndex: 10
                    }}
                    title={`Entrada: ${label.text}`}
                  />)
                ) : (
                  // Sin colisión: punto + hora visible (+ verde si hay consolidación)
                  (<div key={key} className="absolute flex items-center" style={{ left: `${label.position}%`, top: '0px' }}>
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                    <span className="text-xs font-medium text-green-700 whitespace-nowrap">
                      {label.text}{wasConsolidated && label.sessionIndex === 0 && <span className="text-green-600 font-bold">+</span>}
                    </span>
                  </div>)
                );
              } else {
                // Salida
                return label.hasCollision ? (
                  // Con colisión: punto desplazado horizontalmente
                  (<div 
                    key={key}
                    className="absolute w-2 h-2 bg-red-500 rounded-full cursor-help shadow-md border border-white" 
                    style={{ 
                      left: `${label.position + 1}%`,
                      top: '0px',
                      transform: 'translateX(-50%)',
                      zIndex: 10
                    }}
                    title={`Salida: ${label.text}`}
                  />)
                ) : (
                  // Sin colisión: punto + hora visible (+ rojo a la izquierda si hay consolidación)
                  (<div key={key} className="absolute flex items-center" style={{ left: `${label.position}%`, top: '0px', transform: 'translateX(-100%)' }}>
                    <span className="text-xs font-medium text-red-700 whitespace-nowrap mr-1">
                      {wasConsolidated && label.sessionIndex === consolidatedSessions.length - 1 && <span className="text-red-600 font-bold">+</span>}{label.text}
                    </span>
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  </div>)
                );
              }
            });
          })()}
        </div>
      </div>
    );
  };

  return (
    <div>
      <StatsCardGrid columns={4}>
        <StatsCard
          label="Incompletos"
          value={incompleteSessions}
          color="red"
          icon={AlertCircle}
          onClick={handleIncompleteFilter}
          isActive={activeStatsFilter === 'incomplete'}
          isLoading={isLoading}
          index={0}
          data-testid="stat-incomplete-sessions"
        />
        <StatsCard
          label="Media Diaria"
          value={`${averageHoursPerEmployee.toFixed(1)}h`}
          color="orange"
          icon={TrendingUp}
          onClick={handleTodayFilter}
          isActive={activeStatsFilter === 'today'}
          isLoading={isLoading}
          index={1}
          data-testid="stat-daily-average"
        />
        <StatsCard
          label="Media Semanal"
          value={`${averageHoursPerWeek.toFixed(1)}h`}
          color="blue"
          icon={CalendarDays}
          onClick={handleThisWeekFilter}
          isActive={activeStatsFilter === 'week'}
          isLoading={isLoading}
          index={2}
          data-testid="stat-weekly-average"
        />
        <StatsCard
          label="Media Mensual"
          value={`${averageHoursPerMonth.toFixed(1)}h`}
          color="purple"
          icon={BarChart3}
          onClick={handleThisMonthFilter}
          isActive={activeStatsFilter === 'month'}
          isLoading={isLoading}
          index={3}
          data-testid="stat-monthly-average"
        />
      </StatsCardGrid>
      {/* Tab Navigation - Simplified for self-access mode */}
      <TabNavigation
        tabs={isSelfAccessOnly 
          ? [{ id: 'sessions', label: 'Mis Fichajes', icon: Users }]
          : [
              { id: 'sessions', label: 'Fichajes', icon: Users },
              { id: 'requests', label: 'Solicitudes', icon: Bell, badge: pendingRequestsCount },
              { id: 'summary', label: 'Resumen', icon: BarChart3 }
            ]
        }
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      {/* Tab Content: Lista de Horas */}
      {activeTab === 'sessions' && (
        <div className="space-y-4">
          {/* Filter Bar - UNIFIED HEIGHT with requests tab */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 min-h-[40px]">
            {/* Contador de fichajes - mismo estilo que Solicitudes */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg">
              <span className="text-sm font-medium text-foreground">{totalCount}</span>
              <span className="text-sm text-muted-foreground">{getFilterTitle()}</span>
            </div>
            
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
                onClick={() => setShowExportDialog(true)}
                title="Exporta los fichajes en PDF o Excel"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </div>

            {/* Mobile: buttons in single row */}
            <div className="sm:hidden grid grid-cols-3 gap-2 w-full">
              <Button 
                variant={pendingRequestsCount > 0 ? "default" : "outline"}
                size="sm" 
                onClick={() => setShowRequestsDialog(true)}
                className="flex items-center justify-center gap-1"
                data-testid="button-view-requests"
              >
                <Bell className={cn("w-4 h-4", pendingRequestsCount > 0 && "animate-pulse")} />
                <span className="text-xs">Solicitudes</span>
                {pendingRequestsCount > 0 && (
                  <Badge className="ml-1 text-xs">{pendingRequestsCount}</Badge>
                )}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center justify-center gap-1"
              >
                <Filter className="w-4 h-4" />
                <span className="text-xs">Filtros</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowExportDialog(true)}
                title="Exporta los fichajes en PDF o Excel"
                className="flex items-center justify-center gap-1"
              >
                <Download className="w-4 h-4" />
                <span className="text-xs">Exportar</span>
              </Button>
            </div>
          </div>

          {/* Filters Section */}
          {showFilters && (
            <div className="p-4 bg-card dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
            <div className={cn("grid gap-4 items-end", isSelfAccessOnly ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-3")}>
              {/* Left side - Employee Filter - Hidden in self-access mode */}
              {!isSelfAccessOnly && (
                <div className="flex flex-col space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Empleado</label>
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger className="h-10 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
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
              )}

              {/* Right side - Date Filters */}
              <div className={cn("flex flex-col space-y-2", !isSelfAccessOnly && "lg:col-span-2")}>
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
                    className={cn(
                      "h-10 text-xs font-normal flex-1 text-center",
                      dateFilter !== 'today' && "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                    )}
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
                      dateFilter === 'day' 
                        ? "bg-[#007AFF] text-white border-[#007AFF] hover:bg-[#007AFF]/90"
                        : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                    )}
                  />

                  <Popover open={isMonthDialogOpen} onOpenChange={setIsMonthDialogOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "h-10 text-xs font-normal whitespace-nowrap flex-1 text-center",
                          dateFilter === 'month' 
                            ? "bg-[#007AFF] text-white border-[#007AFF] hover:bg-[#007AFF]/90"
                            : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                        )}
                      >
                        {dateFilter === 'month' ? format(currentMonth, 'MMM yyyy', { locale: es }) : 'Mes'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-2" align="start" sideOffset={4}>
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
                      dateFilter === 'custom' 
                        ? "bg-[#007AFF] text-white border-[#007AFF] hover:bg-[#007AFF]/90"
                        : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
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
                    className="h-10 text-xs font-normal whitespace-nowrap flex-1 text-center bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
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
                      className={cn(
                        "h-9 text-xs font-normal text-center",
                        dateFilter !== 'today' && "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                      )}
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
                        : "h-9 text-xs font-normal text-center bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
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
                          "h-9 text-xs font-normal text-center [&>svg]:hidden focus:ring-0 focus:ring-offset-0",
                          dateFilter === 'month' 
                            ? "bg-[#007AFF] text-white border-[#007AFF] hover:bg-[#007AFF]/90 focus:bg-[#007AFF] focus:border-[#007AFF]"
                            : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-foreground hover:bg-gray-100 dark:hover:bg-gray-700"
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
                        : "h-9 text-xs font-normal text-center bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
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
                      className="h-9 text-xs font-normal text-center bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Limpiar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

          {/* Cards Container */}
          <div className={`transition-opacity duration-300 ${isLoading ? 'opacity-60' : 'opacity-100'}`}>
            {/* Desktop Card View */}
            <div className="hidden md:block space-y-3">
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
                  
                  // Limitar a displayedCount para infinite scroll
                  const visibleEntries = dailyEntries.slice(0, displayedCount);
                  
                  visibleEntries.forEach((dayData: any, index: number) => {
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
                        <div key={`month-${previousMonth}`} className="bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-200 dark:border-blue-700 rounded-xl py-2 px-4 text-center">
                          <div className="font-semibold text-blue-800 dark:text-blue-200 capitalize text-sm">
                            Total {monthName}: {monthTotal.toFixed(1)}h
                          </div>
                        </div>
                      );
                    }
                    
                    // Add week separator when changing weeks
                    if (isNewWeek && index > 0 && previousWeekStart) {
                      if (showSummaries) {
                        // Show week total when filtering by specific employee
                        const weekTotal = calculateWeekTotal(previousWeekStart);
                        result.push(
                          <div key={`week-${previousWeekStart.getTime()}`} className="bg-gray-100 dark:bg-gray-700/50 border-2 border-gray-300 dark:border-gray-500 rounded-xl py-2 px-4 text-center">
                            <div className="font-medium text-gray-700 dark:text-gray-300 text-sm">
                              Total semana: {weekTotal.toFixed(1)}h
                            </div>
                          </div>
                        );
                      } else {
                        // Show just a separator line when showing all employees
                        result.push(
                          <div key={`week-separator-${previousWeekStart.getTime()}`} className="border-t-2 border-gray-300 dark:border-gray-600 my-2" />
                        );
                      }
                    }
                    
                    // Calcular horas totales trabajadas del día menos períodos de descanso
                    // Si hay alguna sesión incomplete en el día, no mostrar total (será 0 para mostrar "-")
                    const hasIncompleteSession = dayData.sessions.some((s: any) => s.status === 'incomplete');
                    const totalDayHours = hasIncompleteSession ? 0 : dayData.sessions.reduce((total: number, session: any) => {
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
                    
                    const rowKey = `day-${dayData.date}-${dayData.userId}`;
                    const isExpanded = expandedRows.has(rowKey);
                    const toggleExpand = () => {
                      setExpandedRows(prev => {
                        const next = new Set(prev);
                        if (next.has(rowKey)) {
                          next.delete(rowKey);
                        } else {
                          next.add(rowKey);
                        }
                        return next;
                      });
                    };
                    
                    // Main card
                    result.push(
                      <div 
                        key={rowKey} 
                        className={`bg-card dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-all hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600${showSessionsWaveLoading ? ` row-wave-loading row-wave-${index % 15}` : ''}`}
                      >
                        {/* Card Header - clickable to expand - GRID LAYOUT for column alignment */}
                        <div 
                          className={cn(
                            "grid items-center px-4 py-3.5 min-h-[72px] cursor-pointer select-none transition-colors gap-3",
                            isExpanded && "bg-gray-50 dark:bg-gray-900/50"
                          )}
                          style={{ gridTemplateColumns: 'minmax(220px,280px) 90px minmax(120px,1fr) 60px 36px 20px' }}
                          onClick={toggleExpand}
                        >
                          {/* Col 1: Avatar + Name (flexible width) */}
                          <div className="flex items-center gap-2 min-w-0">
                            <UserAvatar 
                              fullName={dayData.userName || 'Usuario Desconocido'} 
                              size="sm"
                              userId={dayData.userId}
                              profilePicture={dayData.profilePicture}
                            />
                            <div className="flex items-center gap-1 min-w-0 flex-1">
                              <span className="font-medium text-gray-900 dark:text-gray-100 text-sm pl-[2px] pr-[2px]">
                                {dayData.userName || 'Usuario Desconocido'}
                              </span>
                              {dayData.hasAutoCompleted && (
                                <div title="Esta sesión fue cerrada automáticamente por el sistema">
                                  <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Col 2: Weekday + Date (fixed width, stacked) */}
                          <div className="text-center">
                            <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                              {format(new Date(dayData.date), 'EEEE', { locale: es })}
                            </div>
                            <div className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                              {format(new Date(dayData.date), 'dd/MM/yyyy')}
                            </div>
                          </div>
                          
                          {/* Col 3: Timeline Bar (flexible) */}
                          <div className="w-full">
                            <DailyTimelineBar dayData={dayData} />
                          </div>
                          
                          {/* Col 4: Total Hours (fixed width) */}
                          <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm text-right">
                            {totalDayHours > 0 ? `${totalDayHours.toFixed(1)}h` : '-'}
                          </div>
                          
                          {/* Col 5: Action Button (fixed width) */}
                          <div className="justify-self-end" onClick={(e) => e.stopPropagation()}>
                            {(() => {
                              const incompleteSession = dayData.sessions.find((s: any) => s.status === 'incomplete');
                              const activeSession = dayData.sessions.find((s: any) => !s.clockOut);
                              const session = incompleteSession || activeSession || dayData.sessions[0];
                              const hasAuditLogs = session.hasAuditLogs === true;
                              const canCloseIncomplete = hasIncompleteSession && dayData.userId === user?.id;
                              
                              if (canCloseIncomplete) {
                                return (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      const incompleteSessions = dayData.sessions.filter((s: any) => s.status === 'incomplete');
                                      openCloseIncompleteDialog(incompleteSessions, dayData.userName || 'Usuario Desconocido');
                                    }}
                                    disabled={closeIncompleteSessionsMutation.isPending}
                                    className="h-8 w-8 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-200"
                                    title="Cerrar sesión incompleta"
                                    data-testid={`button-close-incomplete-${dayData.date}`}
                                  >
                                    <LogOut className="w-4 h-4" />
                                  </Button>
                                );
                              }
                              
                              return (
                                <Button
                                  size="sm"
                                  variant={hasAuditLogs ? "outline" : "ghost"}
                                  onClick={() => {
                                    if (hasAuditLogs) {
                                      setSelectedSessionForAudit(session.id);
                                      setShowAuditDialog(true);
                                    }
                                  }}
                                  disabled={!hasAuditLogs}
                                  className={cn(
                                    "h-8 w-8 p-0",
                                    hasAuditLogs ? "text-blue-600 hover:text-blue-700 hover:bg-blue-50" : "text-gray-400 cursor-default"
                                  )}
                                  title={hasAuditLogs ? "Ver historial de modificaciones" : "Sin modificaciones"}
                                  data-testid={`button-history-${session.id}`}
                                >
                                  <History className="w-4 h-4" />
                                </Button>
                              );
                            })()}
                          </div>
                          
                          {/* Col 6: Chevron (fixed width, right side) */}
                          <ChevronDown className={cn(
                            "w-4 h-4 text-gray-400 transition-transform duration-200 justify-self-end",
                            isExpanded && "transform rotate-180"
                          )} />
                        </div>
                        
                        {/* Expanded details - inside the card */}
                        {isExpanded && (
                          <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-4">
                            <div className="space-y-3">
                              {dayData.sessions.map((session: any, sessionIndex: number) => {
                                const clockInTime = new Date(session.clockIn);
                                const clockOutTime = session.clockOut ? new Date(session.clockOut) : null;
                                const hasClockInLocation = session.clockInLatitude != null && session.clockInLongitude != null;
                                const hasClockOutLocation = session.clockOutLatitude != null && session.clockOutLongitude != null;
                                
                                return (
                                  <div key={session.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                                    <div className="flex gap-4">
                                      {/* Session number indicator - only show if multiple sessions */}
                                      {dayData.sessions.length > 1 && (
                                        <div className="flex flex-col items-center justify-center flex-shrink-0">
                                          <span className="text-3xl font-bold text-gray-300 dark:text-gray-600">{sessionIndex + 1}</span>
                                          {(session.status === 'incomplete' || session.autoCompleted) && (
                                            <div className="mt-1">
                                              {session.status === 'incomplete' ? (
                                                <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Incompleta</span>
                                              ) : session.autoCompleted ? (
                                                <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                                  <AlertTriangle className="w-2.5 h-2.5" /> Auto
                                                </span>
                                              ) : null}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                      
                                      {/* Details grid */}
                                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                      {/* Entrada */}
                                      <div className="space-y-1">
                                        <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Entrada</div>
                                        <div className="flex items-center gap-2">
                                          <Clock className="w-4 h-4 text-green-500" />
                                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                            {format(clockInTime, 'HH:mm')}
                                          </span>
                                        </div>
                                        {hasClockInLocation && (
                                          <a
                                            href={`https://www.google.com/maps?q=${session.clockInLatitude},${session.clockInLongitude}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <MapPin className="w-3 h-3" />
                                            <span>{parseFloat(session.clockInLatitude).toFixed(5)}, {parseFloat(session.clockInLongitude).toFixed(5)}</span>
                                            <ExternalLink className="w-3 h-3" />
                                          </a>
                                        )}
                                      </div>
                                      
                                      {/* Salida */}
                                      <div className="space-y-1">
                                        <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Salida</div>
                                        {clockOutTime ? (
                                          <>
                                            <div className="flex items-center gap-2">
                                              <Clock className="w-4 h-4 text-red-500" />
                                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                {format(clockOutTime, 'HH:mm')}
                                              </span>
                                            </div>
                                            {hasClockOutLocation && (
                                              <a
                                                href={`https://www.google.com/maps?q=${session.clockOutLatitude},${session.clockOutLongitude}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline"
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                <MapPin className="w-3 h-3" />
                                                <span>{parseFloat(session.clockOutLatitude).toFixed(5)}, {parseFloat(session.clockOutLongitude).toFixed(5)}</span>
                                                <ExternalLink className="w-3 h-3" />
                                              </a>
                                            )}
                                          </>
                                        ) : (
                                          <span className="text-sm text-gray-400">En curso...</span>
                                        )}
                                      </div>
                                      
                                      {/* Descansos */}
                                      <div className="space-y-1">
                                        <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Descansos</div>
                                        {session.breakPeriods && session.breakPeriods.length > 0 ? (
                                          <div className="space-y-1">
                                            {session.breakPeriods.map((bp: any, bpIndex: number) => (
                                              <div key={bpIndex} className="flex items-center gap-2 text-sm">
                                                <Coffee className="w-3 h-3 text-orange-500" />
                                                <span className="text-gray-700 dark:text-gray-300">
                                                  {format(new Date(bp.breakStart), 'HH:mm')} - {bp.breakEnd ? format(new Date(bp.breakEnd), 'HH:mm') : 'En curso'}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <span className="text-sm text-gray-400">Sin descansos</span>
                                        )}
                                      </div>
                                      
                                      {/* Duración */}
                                      <div className="space-y-1">
                                        <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Duración</div>
                                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                          {(() => {
                                            let hours = calculateHours(session.clockIn, session.clockOut);
                                            if (hours > 24) hours = 24;
                                            const breakHours = session.breakPeriods 
                                              ? session.breakPeriods.reduce((total: number, bp: any) => {
                                                  return total + calculateHours(bp.breakStart, bp.breakEnd);
                                                }, 0) 
                                              : 0;
                                            const netHours = Math.max(0, hours - breakHours);
                                            return netHours > 0 ? `${netHours.toFixed(1)}h` : '-';
                                          })()}
                                        </div>
                                      </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  });
                  
                  // Add final summaries for the last entries
                  if (showSummaries && sortedSessions.length > 0) {
                    if (previousWeekStart) {
                      const weekTotal = calculateWeekTotal(previousWeekStart);
                      result.push(
                        <div key={`week-final`} className="bg-gray-100 dark:bg-gray-700/50 border-2 border-gray-300 dark:border-gray-500 rounded-xl py-2 px-4 text-center">
                          <div className="font-medium text-gray-700 dark:text-gray-300">
                            Total semana: {weekTotal.toFixed(1)}h
                          </div>
                        </div>
                      );
                    }
                    
                    if (currentMonth) {
                      const monthTotal = calculateMonthTotal(currentMonth);
                      const monthName = format(new Date(currentMonth + '-01'), 'MMMM yyyy', { locale: es });
                      
                      result.push(
                        <div key={`month-final`} className="bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-200 dark:border-blue-700 rounded-xl py-3 px-4 text-center">
                          <div className="font-semibold text-blue-800 dark:text-blue-200 capitalize">
                            Total {monthName}: {monthTotal.toFixed(1)}h
                          </div>
                        </div>
                      );
                    }
                  }
                  
                  // Elemento observador para infinite scroll + indicador visual
                  result.push(
                    <div key="load-more-observer" className="py-4">
                      <div ref={loadMoreDesktopRef} className="flex items-center justify-center gap-2 text-gray-400 dark:text-gray-500 text-sm">
                        {hasMoreToDisplay ? (
                          <>
                            {isFetchingNextPage ? (
                              <span>Cargando más fichajes...</span>
                            ) : (
                              <>
                                <ArrowDown className="w-4 h-4 animate-bounce" />
                                <span>Desplaza para ver más ({totalCount - Math.min(displayedCount, allSessions.length)} restantes de {totalCount})</span>
                              </>
                            )}
                          </>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600">Has visto todos los {totalCount} fichajes</span>
                        )}
                      </div>
                    </div>
                  );
                  
                  return result;
                })()}
                
                {filteredSessions.length === 0 && (
                  <div className="text-center py-12">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                        {isLoading ? (
                          <LoadingSpinner size="sm" />
                        ) : (
                          <Users className="w-6 h-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="text-foreground font-medium">
                        {isLoading ? 'Cargando fichajes...' : 'No hay fichajes en este período'}
                      </div>
                      {!isLoading && (
                        <div className="text-muted-foreground text-sm">
                          Prueba seleccionando un rango de fechas diferente
                        </div>
                      )}
                    </div>
                  </div>
                )}
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
              
              // Limitar a displayedCount para infinite scroll
              const visibleEntries = dailyEntries.slice(0, displayedCount);
              
              visibleEntries.forEach((dayData: any, index: number) => {
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
                
                // Add week separator when changing weeks
                if (isNewWeek && index > 0 && previousWeekStart) {
                  if (showSummaries) {
                    // Show week total when filtering by specific employee
                    const weekTotal = calculateWeekTotal(previousWeekStart);
                    result.push(
                      <div key={`week-${previousWeekStart.getTime()}`} className="bg-gray-100 dark:bg-gray-700/50 border-2 border-gray-400 dark:border-gray-500 rounded-lg p-3 mx-4 mb-3">
                        <div className="font-medium text-gray-700 dark:text-gray-300 text-sm text-center">
                          Total semana: {weekTotal.toFixed(1)}h
                        </div>
                      </div>
                    );
                  } else {
                    // Show just a separator line when showing all employees
                    result.push(
                      <div key={`week-separator-${previousWeekStart.getTime()}`} className="border-t-2 border-gray-400 dark:border-gray-500 mx-4 mb-3"></div>
                    );
                  }
                }
                
                // Calculate total day hours
                // Si hay alguna sesión incomplete en el día, no mostrar total (será 0 para mostrar "-")
                const hasIncompleteSession = dayData.sessions.some((s: any) => s.status === 'incomplete');
                const totalDayHours = hasIncompleteSession ? 0 : dayData.sessions.reduce((total: number, session: any) => {
                  let sessionHours = calculateHours(session.clockIn, session.clockOut);
                  if (sessionHours > 24) sessionHours = 24;
                  const breakHours = session.breakPeriods 
                    ? session.breakPeriods.reduce((breakTotal: number, breakPeriod: any) => {
                        return breakTotal + calculateHours(breakPeriod.breakStart, breakPeriod.breakEnd);
                      }, 0) 
                    : 0;
                  return total + Math.max(0, sessionHours - breakHours);
                }, 0);
                
                // When there are multiple sessions in a day, prioritize incomplete session, then active, then first
                const incompleteSession = dayData.sessions.find((s: any) => s.status === 'incomplete');
                const activeSession = dayData.sessions.find((s: any) => !s.clockOut);
                const session = incompleteSession || activeSession || dayData.sessions[0];
                const sessionIsIncomplete = isSessionIncomplete(session);
                
                const mobileRowKey = `mobile-day-${dayData.date}-${dayData.userId}`;
                const isMobileExpanded = expandedRows.has(mobileRowKey);
                const toggleMobileExpand = () => {
                  setExpandedRows(prev => {
                    const next = new Set(prev);
                    if (next.has(mobileRowKey)) {
                      next.delete(mobileRowKey);
                    } else {
                      next.add(mobileRowKey);
                    }
                    return next;
                  });
                };
                
                result.push(
                  <div 
                    key={mobileRowKey} 
                    className={cn(
                      `bg-background border border-border rounded-lg mx-4 mb-3 shadow-sm${showSessionsWaveLoading ? ` row-wave-loading row-wave-${index % 15}` : ''} cursor-pointer select-none transition-all`,
                      isMobileExpanded && "ring-1 ring-blue-200 dark:ring-blue-800"
                    )}
                    onClick={toggleMobileExpand}
                  >
                    {/* Header with employee and date */}
                    <div className="flex items-center justify-between px-3 py-3 min-w-0">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <ChevronDown className={cn(
                          "w-4 h-4 text-gray-400 transition-transform duration-200 flex-shrink-0",
                          isMobileExpanded && "transform rotate-180"
                        )} />
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
                      <div className="flex items-center gap-1 min-w-0 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <div className="text-right mr-1">
                          <div className="font-medium text-foreground text-sm">
                            {totalDayHours > 0 ? `${totalDayHours.toFixed(1)}h` : '-'}
                          </div>
                        </div>
                        
                        {(() => {
                          const hasAuditLogs = session.hasAuditLogs === true;
                          const canCloseIncomplete = hasIncompleteSession && dayData.userId === user?.id;
                          
                          // If user has incomplete session, show close button instead of history
                          if (canCloseIncomplete) {
                            return (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const incompleteSessions = dayData.sessions.filter((s: any) => s.status === 'incomplete');
                                  openCloseIncompleteDialog(incompleteSessions, dayData.userName || 'Usuario Desconocido');
                                }}
                                disabled={closeIncompleteSessionsMutation.isPending}
                                className="h-8 w-8 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-200"
                                title="Cerrar sesión incompleta"
                                data-testid={`button-close-incomplete-mobile-${dayData.date}`}
                              >
                                <LogOut className="w-4 h-4" />
                              </Button>
                            );
                          }
                          
                          // Show history button if there are audit logs
                          return (
                            <Button
                              size="sm"
                              variant={hasAuditLogs ? "outline" : "ghost"}
                              onClick={() => {
                                if (hasAuditLogs) {
                                  setSelectedSessionForAudit(session.id);
                                  setShowAuditDialog(true);
                                }
                              }}
                              disabled={!hasAuditLogs}
                              className={cn(
                                "h-8 w-8 p-0",
                                hasAuditLogs ? "text-blue-600 hover:text-blue-700 hover:bg-blue-50" : "text-gray-400 cursor-default"
                              )}
                              title={hasAuditLogs ? "Ver historial de modificaciones" : "Sin modificaciones"}
                              data-testid={`button-history-mobile-${session.id}`}
                            >
                              <History className="w-4 h-4" />
                            </Button>
                          );
                        })()}
                      </div>
                    </div>
                    
                    {/* Timeline - always visible */}
                    <div className="px-3 pb-2">
                      <div className="bg-muted rounded-lg p-2 w-full">
                        <DailyTimelineBar dayData={dayData} />
                      </div>
                    </div>
                    
                    {/* Expanded details */}
                    {isMobileExpanded && (
                      <div className="px-3 pb-3 space-y-2 border-t border-border pt-3">
                        {dayData.sessions.map((sess: any, sessIndex: number) => {
                          const clockIn = new Date(sess.clockIn);
                          const clockOut = sess.clockOut ? new Date(sess.clockOut) : null;
                          const hasInLoc = sess.clockInLatitude != null && sess.clockInLongitude != null;
                          const hasOutLoc = sess.clockOutLatitude != null && sess.clockOutLongitude != null;
                          
                          return (
                            <div key={sess.id} className="bg-muted/50 rounded-lg p-3 space-y-2">
                              {dayData.sessions.length > 1 && (
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-medium text-muted-foreground">
                                    Sesión {sessIndex + 1}
                                  </span>
                                  {sess.status === 'incomplete' && (
                                    <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Incompleta</span>
                                  )}
                                </div>
                              )}
                              
                              {/* Entry/Exit grid */}
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <div className="text-xs text-muted-foreground mb-1">Entrada</div>
                                  <div className="flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-green-500" />
                                    <span className="text-sm font-medium">{format(clockIn, 'HH:mm')}</span>
                                  </div>
                                  {hasInLoc && (
                                    <a
                                      href={`https://www.google.com/maps?q=${sess.clockInLatitude},${sess.clockInLongitude}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <MapPin className="w-3 h-3" />
                                      {parseFloat(sess.clockInLatitude).toFixed(4)}, {parseFloat(sess.clockInLongitude).toFixed(4)}
                                    </a>
                                  )}
                                </div>
                                <div>
                                  <div className="text-xs text-muted-foreground mb-1">Salida</div>
                                  {clockOut ? (
                                    <>
                                      <div className="flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5 text-red-500" />
                                        <span className="text-sm font-medium">{format(clockOut, 'HH:mm')}</span>
                                      </div>
                                      {hasOutLoc && (
                                        <a
                                          href={`https://www.google.com/maps?q=${sess.clockOutLatitude},${sess.clockOutLongitude}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <MapPin className="w-3 h-3" />
                                          {parseFloat(sess.clockOutLatitude).toFixed(4)}, {parseFloat(sess.clockOutLongitude).toFixed(4)}
                                        </a>
                                      )}
                                    </>
                                  ) : (
                                    <span className="text-sm text-muted-foreground">En curso...</span>
                                  )}
                                </div>
                              </div>
                              
                              {/* Breaks */}
                              {sess.breakPeriods && sess.breakPeriods.length > 0 && (
                                <div>
                                  <div className="text-xs text-muted-foreground mb-1">Descansos</div>
                                  <div className="flex flex-wrap gap-2">
                                    {sess.breakPeriods.map((bp: any, bpIdx: number) => (
                                      <div key={bpIdx} className="flex items-center gap-1 text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2 py-1 rounded">
                                        <Coffee className="w-3 h-3" />
                                        {format(new Date(bp.breakStart), 'HH:mm')} - {bp.breakEnd ? format(new Date(bp.breakEnd), 'HH:mm') : '...'}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              });
              
              // Add final summaries for mobile
              if (showSummaries && sortedSessions.length > 0) {
                if (previousWeekStart) {
                  const weekTotal = calculateWeekTotal(previousWeekStart);
                  result.push(
                    <div key={`week-final`} className="bg-gray-100 dark:bg-gray-700/50 border-2 border-gray-400 dark:border-gray-500 rounded-lg p-3 mx-4 mb-3">
                      <div className="font-medium text-gray-700 dark:text-gray-300 text-sm text-center">
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
              
              // Elemento observador para infinite scroll + indicador visual (mobile)
              result.push(
                <div key="load-more-observer-mobile" className="py-4 text-center mx-4">
                  <div ref={loadMoreMobileRef} className="flex items-center justify-center gap-2 text-gray-400 dark:text-gray-500 text-sm">
                    {hasMoreToDisplay ? (
                      <>
                        {isFetchingNextPage ? (
                          <span>Cargando más fichajes...</span>
                        ) : (
                          <>
                            <ArrowDown className="w-4 h-4 animate-bounce" />
                            <span>Desplaza para ver más ({totalCount - Math.min(displayedCount, allSessions.length)} restantes de {totalCount})</span>
                          </>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-300 dark:text-gray-600">Has visto todos los {totalCount} fichajes</span>
                    )}
                  </div>
                </div>
              );
              
              return result;
            })()}
            
            {filteredSessions.length === 0 && (
              <div className="py-12 text-center mx-4">
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                    {isLoading ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <Users className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="text-foreground font-medium">
                    {isLoading ? 'Cargando fichajes...' : 'No hay fichajes en este período'}
                  </div>
                  {!isLoading && (
                    <div className="text-muted-foreground text-sm">
                      Prueba seleccionando un rango de fechas diferente
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          </div>
        </div>
      )}
      {/* Tab Content: Resumen */}
      {activeTab === 'summary' && (
        <div className="space-y-4">
          {/* Controles de filtrado - UNIFIED with other tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 min-h-[40px]">
            {/* Buscador de empleados - left side */}
            <div className="relative w-full sm:w-[280px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar empleado..."
                value={summarySearch}
                onChange={(e) => setSummarySearch(e.target.value)}
                className="pl-10 h-9"
                data-testid="input-summary-search"
              />
            </div>

            {/* Selector de semana - right side, same height as buttons */}
            <div className="flex items-center gap-1 bg-white dark:bg-gray-800 border rounded-md h-9 px-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSummaryWeek(addDays(summaryWeek, -7))}
                className="h-7 w-7 p-0"
                data-testid="button-prev-week"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="text-sm font-medium min-w-[150px] text-center">
                {format(summaryWeek, 'd MMM', { locale: es })} - {format(addDays(summaryWeek, 6), 'd MMM yyyy', { locale: es })}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const nextWeek = addDays(summaryWeek, 7);
                  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
                  if (nextWeek <= currentWeekStart) {
                    setSummaryWeek(nextWeek);
                  }
                }}
                disabled={addDays(summaryWeek, 7) > startOfWeek(new Date(), { weekStartsOn: 1 })}
                className="h-7 w-7 p-0"
                data-testid="button-next-week"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Grid de empleados */}
          <div className={`grid grid-cols-1 lg:grid-cols-2 gap-4 transition-opacity duration-300 ${isLoading ? 'opacity-60' : 'opacity-100'}`}>
            {(Array.isArray(employees) ? employees : []).filter((emp: any) => 
              summarySearch === '' || 
              emp.fullName.toLowerCase().includes(summarySearch.toLowerCase())
            ).map((employee) => {
              // Get pre-calculated stats from optimized endpoint (O(1) lookup)
              const monthStats = monthlyStatsMap.get(employee.id);
              const weekStats = weeklyStatsMap.get(employee.id);
              
              // Net hours = total work hours - break hours (already calculated server-side)
              const monthlyHours = (monthStats?.totalHours || 0) - (monthStats?.totalBreakHours || 0);
              const weeklyHours = (weekStats?.totalHours || 0) - (weekStats?.totalBreakHours || 0);

              const workingHoursPerDay = (companySettings as any)?.workingHoursPerDay || 8;
              const weeklyTarget = workingHoursPerDay * 5;
              const monthlyTarget = weeklyTarget * 4;
              const monthlyProgress = (monthlyHours / monthlyTarget) * 100;
              const weeklyProgress = (weeklyHours / weeklyTarget) * 100;

              return (
                <div 
                  key={employee.id} 
                  className="group relative bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-shadow duration-300"
                >
                  {/* Header con Avatar */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className="relative" style={{ transform: 'scale(1.6)', transformOrigin: 'left center' }}>
                      <UserAvatar
                        fullName={employee.fullName}
                        profilePicture={employee.profilePicture || employee.avatarUrl}
                        userId={employee.id}
                        size="lg"
                      />
                    </div>
                    <div className="flex-1" style={{ marginLeft: '24px' }}>
                      <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
                        {employee.fullName}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {employee.email || employee.position || 'Empleado'}
                      </p>
                    </div>
                  </div>

                  {/* Progreso semanal */}
                  <div className="space-y-3 mb-5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <CalendarDays className="w-4 h-4" />
                        Progreso Semanal
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {weeklyProgress.toFixed(0)}%
                      </span>
                    </div>
                    <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-500 ease-out",
                          weeklyProgress >= 100 ? "bg-gradient-to-r from-green-500 to-emerald-600" : 
                          weeklyProgress >= 75 ? "bg-gradient-to-r from-blue-500 to-cyan-600" : 
                          weeklyProgress >= 50 ? "bg-gradient-to-r from-yellow-500 to-orange-600" : "bg-gradient-to-r from-orange-500 to-red-600"
                        )}
                        style={{ width: `${Math.min(weeklyProgress, 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>{weeklyHours.toFixed(1)}h trabajadas</span>
                      <span>{weeklyTarget}h objetivo</span>
                    </div>
                  </div>

                  {/* Progreso mensual */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" />
                        Progreso Mensual
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {monthlyProgress.toFixed(0)}%
                      </span>
                    </div>
                    <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-500 ease-out",
                          monthlyProgress >= 100 ? "bg-gradient-to-r from-green-500 to-emerald-600" : 
                          monthlyProgress >= 75 ? "bg-gradient-to-r from-blue-500 to-cyan-600" : 
                          monthlyProgress >= 50 ? "bg-gradient-to-r from-yellow-500 to-orange-600" : "bg-gradient-to-r from-orange-500 to-red-600"
                        )}
                        style={{ width: `${Math.min(monthlyProgress, 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>{monthlyHours.toFixed(1)}h trabajadas</span>
                      <span>{monthlyTarget}h objetivo</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Empty state */}
          {(Array.isArray(employees) ? employees : []).filter((emp: any) => 
            summarySearch === '' || 
            emp.fullName.toLowerCase().includes(summarySearch.toLowerCase())
          ).length === 0 && (
            <div className="py-20 text-center">
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-950 dark:to-purple-950 rounded-full flex items-center justify-center">
                  <Users className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-xl font-semibold text-gray-900 dark:text-white">
                  {summarySearch ? 'No se encontraron empleados' : 'No hay empleados'}
                </div>
                <div className="text-gray-500 dark:text-gray-400 max-w-md">
                  {summarySearch 
                    ? 'Intenta con otro término de búsqueda' 
                    : 'Añade empleados para ver el resumen de horas y el progreso de su trabajo'
                  }
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Tab Content: Solicitudes de Modificación */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          {/* Calcular solicitudes filtradas una vez */}
          {(() => {
            const filteredModificationRequests = modificationRequests.filter((request: any) => {
              const matchesStatus = requestsStatus === "all" || request.status === requestsStatus;
              const matchesEmployee = requestsEmployeeId === "all" || request.employeeId === parseInt(requestsEmployeeId);
              const matchesType = requestsType === "all" || request.requestType === requestsType || (requestsType === "modification" && request.requestType !== "forgotten_checkin");
              return matchesStatus && matchesEmployee && matchesType;
            });
            
            return (
              <>
                {/* Filtros - Desktop - UNIFIED HEIGHT with sessions tab */}
                <div className="hidden md:flex items-center justify-between gap-3 min-h-[40px]">
                  {/* Contador de solicitudes - left side */}
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg">
                    <span className="text-sm font-medium text-foreground">{filteredModificationRequests.length}</span>
                    <span className="text-sm text-muted-foreground">solicitudes</span>
                  </div>
                  
                  {/* Filtros - right side */}
                  <div className="flex items-center gap-2">
                  {/* Filtro Empleado con buscador */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="w-[180px] h-9 justify-between font-normal">
                        <span className="truncate">
                          {requestsEmployeeId === "all" 
                            ? "Todos los empleados" 
                            : employees.find((e: any) => e.id === parseInt(requestsEmployeeId))?.fullName || "Empleado"}
                        </span>
                        <User className="w-4 h-4 ml-2 flex-shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[240px] p-0" align="start">
                      <div className="p-2 border-b">
                        <Input
                          placeholder="Buscar empleado..."
                          value={requestsEmployeeSearchTerm}
                          onChange={(e) => setRequestsEmployeeSearchTerm(e.target.value)}
                          className="h-8"
                        />
                      </div>
                      <div className="max-h-[200px] overflow-y-auto p-1">
                        <button
                          onClick={() => { setRequestsEmployeeId("all"); setRequestsEmployeeSearchTerm(""); }}
                          className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors ${requestsEmployeeId === "all" ? "bg-muted font-medium" : ""}`}
                        >
                          Todos los empleados
                        </button>
                        {(employees || [])
                          .filter((emp: any) => 
                            requestsEmployeeSearchTerm === '' || 
                            emp.fullName.toLowerCase().includes(requestsEmployeeSearchTerm.toLowerCase())
                          )
                          .map((emp: any) => (
                            <button
                              key={emp.id}
                              onClick={() => { setRequestsEmployeeId(emp.id.toString()); setRequestsEmployeeSearchTerm(""); }}
                              className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors truncate ${requestsEmployeeId === emp.id.toString() ? "bg-muted font-medium" : ""}`}
                            >
                              {emp.fullName}
                            </button>
                          ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  
                  {/* Filtro Tipo de Solicitud */}
                  <Select value={requestsType} onValueChange={setRequestsType}>
                    <SelectTrigger className="w-[160px] h-9">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los tipos</SelectItem>
                      <SelectItem value="forgotten_checkin">Fichaje olvidado</SelectItem>
                      <SelectItem value="modification">Modificar horario</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {/* Filtro Estado */}
                  <Select value={requestsStatus} onValueChange={setRequestsStatus}>
                    <SelectTrigger className="w-[130px] h-9">
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="pending">Pendientes</SelectItem>
                      <SelectItem value="approved">Aprobadas</SelectItem>
                      <SelectItem value="rejected">Rechazadas</SelectItem>
                    </SelectContent>
                  </Select>
                  </div>
                </div>
                
                {/* Filtros - Mobile */}
                <div className="md:hidden space-y-3">
                  {/* Primera fila: Contador */}
                  <div className="flex items-center">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg">
                      <span className="text-sm font-medium text-foreground">{filteredModificationRequests.length}</span>
                      <span className="text-sm text-muted-foreground">solicitudes</span>
                    </div>
                  </div>
                  
                  {/* Segunda fila: Filtros en grid 2x2 */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Filtro Empleado */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between font-normal text-xs h-9">
                          <span className="truncate">
                            {requestsEmployeeId === "all" 
                              ? "Empleado" 
                              : employees.find((e: any) => e.id === parseInt(requestsEmployeeId))?.fullName?.split(' ')[0] || "Empleado"}
                          </span>
                          <User className="w-3.5 h-3.5 ml-1 flex-shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[220px] p-0" align="start">
                        <div className="p-2 border-b">
                          <Input
                            placeholder="Buscar..."
                            value={requestsEmployeeSearchTerm}
                            onChange={(e) => setRequestsEmployeeSearchTerm(e.target.value)}
                            className="h-8"
                          />
                        </div>
                        <div className="max-h-[180px] overflow-y-auto p-1">
                          <button
                            onClick={() => { setRequestsEmployeeId("all"); setRequestsEmployeeSearchTerm(""); }}
                            className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-muted ${requestsEmployeeId === "all" ? "bg-muted font-medium" : ""}`}
                          >
                            Todos
                          </button>
                          {(employees || [])
                            .filter((emp: any) => 
                              requestsEmployeeSearchTerm === '' || 
                              emp.fullName.toLowerCase().includes(requestsEmployeeSearchTerm.toLowerCase())
                            )
                            .map((emp: any) => (
                              <button
                                key={emp.id}
                                onClick={() => { setRequestsEmployeeId(emp.id.toString()); setRequestsEmployeeSearchTerm(""); }}
                                className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-muted truncate ${requestsEmployeeId === emp.id.toString() ? "bg-muted font-medium" : ""}`}
                              >
                                {emp.fullName}
                              </button>
                            ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                    
                    {/* Filtro Tipo */}
                    <Select value={requestsType} onValueChange={setRequestsType}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los tipos</SelectItem>
                        <SelectItem value="forgotten_checkin">Fichaje olvidado</SelectItem>
                        <SelectItem value="modification">Modificar horario</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    {/* Filtro Estado - ocupa toda la fila */}
                    <Select value={requestsStatus} onValueChange={setRequestsStatus}>
                      <SelectTrigger className="col-span-2 h-9 text-xs">
                        <SelectValue placeholder="Estado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="pending">Pendientes</SelectItem>
                        <SelectItem value="approved">Aprobadas</SelectItem>
                        <SelectItem value="rejected">Rechazadas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Lista de solicitudes */}
                {isLoadingModificationRequests ? (
                  <div className="text-center py-12">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                        <LoadingSpinner size="sm" />
                      </div>
                      <div className="text-foreground font-medium">
                        Cargando solicitudes...
                      </div>
                    </div>
                  </div>
                ) : filteredModificationRequests.length === 0 ? (
              <div className="text-center py-12">
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                    <Bell className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div className="text-foreground font-medium">
                    {modificationRequests.length === 0 
                      ? "No hay solicitudes pendientes" 
                      : "No se encontraron solicitudes con los filtros aplicados"}
                  </div>
                  <div className="text-muted-foreground text-sm">
                    {modificationRequests.length === 0 
                      ? "Las solicitudes de modificación aparecerán aquí"
                      : `Total de solicitudes: ${modificationRequests.length}`}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredModificationRequests.map((request: any, reqIndex: number) => {
              const isForgotten = request.requestType === 'forgotten_checkin';
              const requestedTotal = request.requestedClockOut ? (() => {
                const ms = new Date(request.requestedClockOut).getTime() - new Date(request.requestedClockIn).getTime();
                const h = Math.floor(ms / (1000 * 60 * 60));
                const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
                return `${h}h ${m}m`;
              })() : '—';
              const currentTotal = request.currentClockIn && request.currentClockOut ? (() => {
                const ms = new Date(request.currentClockOut).getTime() - new Date(request.currentClockIn).getTime();
                const h = Math.floor(ms / (1000 * 60 * 60));
                const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
                return `${h}h ${m}m`;
              })() : null;
              
              return (
                <div
                  key={request.id}
                  className={`bg-card dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-all hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600${showRequestsWaveLoading ? ` row-wave-loading row-wave-${reqIndex % 15}` : ''}`}
                >
                  {/* Mobile: Header con estado */}
                  <div className={`lg:hidden px-4 py-2.5 flex items-center justify-between ${
                    request.status === 'pending'
                      ? 'bg-amber-50 dark:bg-amber-950/30 border-b border-amber-100 dark:border-amber-900/50'
                      : request.status === 'approved'
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-900/50'
                      : 'bg-rose-50 dark:bg-rose-950/30 border-b border-rose-100 dark:border-rose-900/50'
                  }`}>
                    <div className="flex items-center gap-2">
                      <Clock className={`w-4 h-4 ${isForgotten ? 'text-blue-600' : 'text-orange-600'}`} />
                      <span className={`text-sm font-medium ${isForgotten ? 'text-blue-700 dark:text-blue-300' : 'text-orange-700 dark:text-orange-300'}`}>
                        {isForgotten ? 'Fichaje olvidado' : 'Modificar horario'}
                      </span>
                    </div>
                    <Badge variant={request.status === 'pending' ? 'default' : request.status === 'approved' ? 'default' : 'destructive'} 
                           className={`text-xs ${request.status === 'approved' ? 'bg-emerald-600' : ''}`}>
                      {request.status === 'pending' ? 'Pendiente' : request.status === 'approved' ? 'Aprobada' : 'Rechazada'}
                    </Badge>
                  </div>

                  {/* Mobile: Contenido vertical */}
                  <div className="lg:hidden p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar fullName={request.employeeName} profilePicture={request.employeeProfilePicture} size="sm" userId={request.employeeId} />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">{request.employeeName}</div>
                        <span className="text-xs text-muted-foreground">{format(new Date(request.requestedDate), 'dd/MM/yyyy', { locale: es })}</span>
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Entrada:</span>
                        <div className="flex items-center gap-1">
                          {!isForgotten && request.currentClockIn && (
                            <span className="line-through text-gray-400 text-xs mr-1">{format(new Date(request.currentClockIn), 'HH:mm')}</span>
                          )}
                          <span className="font-medium text-blue-600 dark:text-blue-400">{format(new Date(request.requestedClockIn), 'HH:mm')}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Salida:</span>
                        <div className="flex items-center gap-1">
                          {!isForgotten && request.currentClockOut && (
                            <span className="line-through text-gray-400 text-xs mr-1">{format(new Date(request.currentClockOut), 'HH:mm')}</span>
                          )}
                          <span className="font-medium text-blue-600 dark:text-blue-400">{request.requestedClockOut ? format(new Date(request.requestedClockOut), 'HH:mm') : '—'}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm pt-1 border-t border-gray-200 dark:border-gray-700">
                        <span className="text-muted-foreground">Total:</span>
                        <div className="flex items-center gap-1">
                          {!isForgotten && currentTotal && (
                            <span className="line-through text-gray-400 text-xs mr-1">{currentTotal}</span>
                          )}
                          <span className="font-semibold text-blue-600 dark:text-blue-400">{requestedTotal}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Motivo:</span>{' '}
                      <span className="italic text-gray-700 dark:text-gray-300">{request.reason}</span>
                    </div>
                    {request.status === 'pending' && (
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" onClick={() => processRequestMutation.mutate({ id: request.id, status: 'approved' })} className="flex-1 h-9 bg-emerald-600 hover:bg-emerald-700" data-testid={`button-approve-${request.id}`}>
                          <Check className="w-4 h-4 mr-1" />Aprobar
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => processRequestMutation.mutate({ id: request.id, status: 'rejected' })} className="flex-1 h-9" data-testid={`button-reject-${request.id}`}>
                          <X className="w-4 h-4 mr-1" />Rechazar
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Desktop: Fila horizontal con grid */}
                  <div className="hidden lg:flex items-stretch min-w-0">
                    <div className="flex-1 grid items-center px-4 py-5 gap-3" style={{ gridTemplateColumns: 'auto minmax(100px,1.2fr) 80px 60px 60px 70px minmax(100px,1.5fr) auto' }}>
                      {/* Col 1: Avatar */}
                      <UserAvatar fullName={request.employeeName} profilePicture={request.employeeProfilePicture} size="sm" userId={request.employeeId} />
                      
                      {/* Col 2: Tipo + Nombre */}
                      <div className="min-w-0">
                        <span className={`text-[10px] font-medium ${isForgotten ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'} block`}>
                          {isForgotten ? 'Fichaje olvidado' : 'Modificar horario'}
                        </span>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate text-sm leading-tight">{request.employeeName}</h3>
                      </div>
                      
                      {/* Col 3: Fecha */}
                      <div className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {format(new Date(request.requestedDate), 'dd/MM/yy', { locale: es })}
                      </div>
                      
                      {/* Col 4: Entrada */}
                      <div className="text-center">
                        {!isForgotten && request.currentClockIn && (
                          <div className="line-through text-gray-400 text-[10px]">{format(new Date(request.currentClockIn), 'HH:mm')}</div>
                        )}
                        <div className="font-semibold text-sm text-blue-600 dark:text-blue-400">{format(new Date(request.requestedClockIn), 'HH:mm')}</div>
                      </div>
                      
                      {/* Col 5: Salida */}
                      <div className="text-center">
                        {!isForgotten && request.currentClockOut && (
                          <div className="line-through text-gray-400 text-[10px]">{format(new Date(request.currentClockOut), 'HH:mm')}</div>
                        )}
                        <div className="font-semibold text-sm text-blue-600 dark:text-blue-400">{request.requestedClockOut ? format(new Date(request.requestedClockOut), 'HH:mm') : '—'}</div>
                      </div>
                      
                      {/* Col 6: Total */}
                      <div className="text-center">
                        {!isForgotten && currentTotal && (
                          <div className="line-through text-gray-400 text-[10px]">{currentTotal}</div>
                        )}
                        <div className="font-semibold text-sm text-blue-600 dark:text-blue-400">{requestedTotal}</div>
                      </div>
                      
                      {/* Col 7: Motivo */}
                      <div className="text-xs text-gray-600 dark:text-gray-400 truncate italic" title={request.reason}>
                        {request.reason}
                      </div>
                      
                      {/* Col 8: Botones */}
                      <div className="flex items-center gap-1">
                        {request.status === 'pending' ? (
                          <>
                            <button onClick={() => processRequestMutation.mutate({ id: request.id, status: 'approved' })} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors" title="Aprobar" data-testid={`button-approve-desktop-${request.id}`}>
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={() => processRequestMutation.mutate({ id: request.id, status: 'rejected' })} className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors" title="Rechazar" data-testid={`button-reject-desktop-${request.id}`}>
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                    
                    {/* Sección coloreada de estado - punta derecha */}
                    <div className={`w-[90px] flex items-center justify-center flex-shrink-0 ${
                      request.status === 'pending'
                        ? 'bg-amber-100 dark:bg-amber-900/40'
                        : request.status === 'approved'
                        ? 'bg-emerald-100 dark:bg-emerald-900/40'
                        : 'bg-rose-100 dark:bg-rose-900/40'
                    }`}>
                      <span className={`text-xs font-semibold ${
                        request.status === 'pending'
                          ? 'text-amber-700 dark:text-amber-300'
                          : request.status === 'approved'
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : 'text-rose-700 dark:text-rose-300'
                      }`}>
                        {request.status === 'pending' ? 'Pendiente' : request.status === 'approved' ? 'Aprobada' : 'Rechazada'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
              </div>
            )}
              </>
            );
          })()}
        </div>
      )}
      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Exportar Fichajes</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Selecciona el formato de exportación para los fichajes filtrados
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="h-24 flex flex-col items-center justify-center gap-2"
                onClick={() => {
                  setShowExportDialog(false);
                  handleExportPDF();
                }}
                data-testid="button-export-pdf"
              >
                <FileText className="w-8 h-8 text-red-600" />
                <span className="font-medium">Exportar PDF</span>
              </Button>
              <Button
                variant="outline"
                className="h-24 flex flex-col items-center justify-center gap-2"
                onClick={() => {
                  setShowExportDialog(false);
                  handleExportExcel();
                }}
                data-testid="button-export-excel"
              >
                <FileText className="w-8 h-8 text-green-600" />
                <span className="font-medium">Exportar Excel</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Manual Entry Dialog */}
      <Dialog open={showManualEntryDialog} onOpenChange={setShowManualEntryDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Crear Fichaje Manual</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Empleado</label>
              <Select 
                value={manualEntryData.employeeId} 
                onValueChange={(value) => setManualEntryData({...manualEntryData, employeeId: value})}
              >
                <SelectTrigger data-testid="select-employee-manual">
                  <SelectValue placeholder="Seleccionar empleado" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp: any) => (
                    <SelectItem key={emp.id} value={emp.id.toString()}>{emp.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    data-testid="button-select-date-manual"
                  >
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {manualEntryData.date ? format(new Date(manualEntryData.date), 'dd/MM/yyyy', { locale: es }) : 'Seleccionar fecha'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={manualEntryData.date ? new Date(manualEntryData.date) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        setManualEntryData({...manualEntryData, date: format(date, 'yyyy-MM-dd')});
                      }
                    }}
                    disabled={(date) => date > new Date()}
                    locale={es}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Entrada</label>
                <Input
                  type="time"
                  value={manualEntryData.clockIn}
                  onChange={(e) => setManualEntryData({...manualEntryData, clockIn: e.target.value})}
                  data-testid="input-clockin-manual"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Salida</label>
                <Input
                  type="time"
                  value={manualEntryData.clockOut}
                  onChange={(e) => setManualEntryData({...manualEntryData, clockOut: e.target.value})}
                  data-testid="input-clockout-manual"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Motivo (obligatorio)</label>
              <Input
                value={manualEntryData.reason}
                onChange={(e) => setManualEntryData({...manualEntryData, reason: e.target.value})}
                placeholder="Ej: Fichaje olvidado, error en registro..."
                data-testid="input-reason-manual"
              />
            </div>
            <Button
              onClick={() => createManualSessionMutation.mutate(manualEntryData)}
              disabled={!manualEntryData.employeeId || !manualEntryData.date || !manualEntryData.clockIn || !manualEntryData.clockOut || !manualEntryData.reason}
              className="w-full"
              data-testid="button-submit-manual"
            >
              Crear Fichaje
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Modification Requests Dialog */}
      <Dialog open={showRequestsDialog} onOpenChange={setShowRequestsDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Solicitudes de Modificación</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {modificationRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay solicitudes pendientes
              </div>
            ) : (
              modificationRequests.map((request: any) => (
                <div key={request.id} className="border rounded-lg p-4 space-y-3 bg-card">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        fullName={request.employeeName}
                        profilePicture={request.employeeProfilePicture}
                        size="sm"
                      />
                      <div>
                        <div className="font-medium">{request.employeeName}</div>
                        <div className="text-sm text-muted-foreground">
                          {request.requestType === 'forgotten_checkin' ? 'Quiere añadir un nuevo fichaje manual' : 'Quiere modificar este horario'}
                        </div>
                      </div>
                    </div>
                    <Badge variant={request.status === 'pending' ? 'default' : request.status === 'approved' ? 'default' : 'destructive'}>
                      {request.status === 'pending' ? 'Pendiente' : request.status === 'approved' ? 'Aprobada' : 'Rechazada'}
                    </Badge>
                  </div>
                  
                  <div className="space-y-3 pt-2">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Fecha:</span> {format(new Date(request.requestedDate), 'dd/MM/yyyy', { locale: es })}
                    </div>
                    
                    {request.requestType === 'forgotten_checkin' ? (
                      // Fichaje olvidado - solo mostrar nueva información
                      (<div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Entrada:</span>
                          <span className="font-medium">{format(new Date(request.requestedClockIn), 'HH:mm')}</span>
                        </div>
                        {request.requestedClockOut && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Salida:</span>
                            <span className="font-medium">{format(new Date(request.requestedClockOut), 'HH:mm')}</span>
                          </div>
                        )}
                        {request.requestedClockOut && (() => {
                          const totalMs = new Date(request.requestedClockOut).getTime() - new Date(request.requestedClockIn).getTime();
                          const hours = Math.floor(totalMs / (1000 * 60 * 60));
                          const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
                          return (
                            <div className="flex items-center justify-between pt-1 border-t border-blue-200 dark:border-blue-800">
                              <span className="text-muted-foreground">Total:</span>
                              <span className="font-semibold text-blue-600 dark:text-blue-400">{hours}h {minutes}min</span>
                            </div>
                          );
                        })()}
                      </div>)
                    ) : (
                      // Modificación de horario - mostrar antes y después compacto
                      (<div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg space-y-2 text-sm">
                        {/* Entrada */}
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Entrada:</span>
                          <div className="flex items-center gap-2">
                            <span className="line-through text-gray-400">{request.currentClockIn ? format(new Date(request.currentClockIn), 'HH:mm') : '—'}</span>
                            <ArrowDown className="w-3 h-3 text-blue-500 rotate-[-90deg]" />
                            <span className="font-medium text-blue-600 dark:text-blue-400">{format(new Date(request.requestedClockIn), 'HH:mm')}</span>
                          </div>
                        </div>
                        {/* Salida */}
                        {request.requestedClockOut && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Salida:</span>
                            <div className="flex items-center gap-2">
                              <span className="line-through text-gray-400">{request.currentClockOut ? format(new Date(request.currentClockOut), 'HH:mm') : '—'}</span>
                              <ArrowDown className="w-3 h-3 text-blue-500 rotate-[-90deg]" />
                              <span className="font-medium text-blue-600 dark:text-blue-400">{format(new Date(request.requestedClockOut), 'HH:mm')}</span>
                            </div>
                          </div>
                        )}
                        {/* Total */}
                        {request.requestedClockOut && (
                          <div className="flex items-center justify-between pt-1 border-t border-gray-200 dark:border-gray-700">
                            <span className="text-muted-foreground">Total:</span>
                            <div className="flex items-center gap-2">
                              {request.currentClockIn && request.currentClockOut ? (
                                // Mostrar comparación si hay ambos valores
                                (<>
                                  {(() => {
                                    const currentMs = new Date(request.currentClockOut).getTime() - new Date(request.currentClockIn).getTime();
                                    const currentHours = Math.floor(currentMs / (1000 * 60 * 60));
                                    const currentMinutes = Math.floor((currentMs % (1000 * 60 * 60)) / (1000 * 60));
                                    return <span className="line-through text-gray-400">{currentHours}h {currentMinutes}min</span>;
                                  })()}
                                  <ArrowDown className="w-3 h-3 text-blue-500 rotate-[-90deg]" />
                                </>)
                              ) : null}
                              {(() => {
                                const requestedMs = new Date(request.requestedClockOut).getTime() - new Date(request.requestedClockIn).getTime();
                                const requestedHours = Math.floor(requestedMs / (1000 * 60 * 60));
                                const requestedMinutes = Math.floor((requestedMs % (1000 * 60 * 60)) / (1000 * 60));
                                return <span className="font-semibold text-blue-600 dark:text-blue-400">{requestedHours}h {requestedMinutes}min</span>;
                              })()}
                            </div>
                          </div>
                        )}
                      </div>)
                    )}
                    
                    <div className="text-sm pt-1">
                      <span className="text-muted-foreground">Motivo:</span>{' '}
                      <span className="italic">{request.reason}</span>
                    </div>
                  </div>
                  
                  {request.status === 'pending' && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={() => processRequestMutation.mutate({ id: request.id, status: 'approved' })}
                        className="flex-1"
                        data-testid={`button-approve-${request.id}`}
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Aprobar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => processRequestMutation.mutate({ id: request.id, status: 'rejected' })}
                        className="flex-1"
                        data-testid={`button-reject-${request.id}`}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Rechazar
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
      {/* Audit History Dialog */}
      <Dialog open={showAuditDialog} onOpenChange={setShowAuditDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Historial de Auditoría</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {auditLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay registros de auditoría para este fichaje
              </div>
            ) : (
              auditLogs.map((log: any) => {
                // Find the session to get employee name
                const session = filteredSessions.find((s: any) => s.id === selectedSessionForAudit);
                const employeeName = session?.userName || 'Empleado';
                
                // Detect if it's an employee request or admin modification
                const isEmployeeRequest = log.reason?.includes('Employee request approved:');
                const isAdminModification = log.reason?.includes('Admin modification:');
                
                // Clean and translate the reason
                let cleanReason = log.reason || '';
                cleanReason = cleanReason.replace(/^Employee request approved:\s*/i, '');
                cleanReason = cleanReason.replace(/^Admin modification:\s*/i, '');
                
                // Get modification type in Spanish
                let modificationType = '';
                if (log.modificationType === 'created_manual') {
                  modificationType = 'Fichaje Manual Creado';
                } else if (log.modificationType === 'modified_clockin') {
                  modificationType = 'Entrada Modificada';
                } else if (log.modificationType === 'modified_clockout') {
                  modificationType = 'Salida Modificada';
                } else if (log.modificationType === 'modified_both') {
                  modificationType = 'Entrada y Salida Modificadas';
                }
                
                return (
                  <div key={log.id} className="border-l-4 border-blue-500 pl-4 py-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-sm">
                        {modificationType}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(log.modifiedAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                      </div>
                    </div>
                    
                    {/* Show who performed the action based on type */}
                    {log.modificationType === 'created_manual' && (
                      <>
                        <div className="text-sm text-purple-600 dark:text-purple-400">
                          <span className="font-medium">Creado por:</span> {employeeName}
                        </div>
                        {log.modifiedByName && (
                          <div className="text-sm text-blue-600 dark:text-blue-400">
                            <span className="font-medium">Aprobado por:</span> {log.modifiedByName}
                          </div>
                        )}
                      </>
                    )}
                    
                    {log.modificationType !== 'created_manual' && isEmployeeRequest && (
                      <>
                        <div className="text-sm text-purple-600 dark:text-purple-400">
                          <span className="font-medium">Solicitado por:</span> {employeeName}
                        </div>
                        {log.modifiedByName && (
                          <div className="text-sm text-blue-600 dark:text-blue-400">
                            <span className="font-medium">Aprobado por:</span> {log.modifiedByName}
                          </div>
                        )}
                      </>
                    )}
                    
                    {log.modificationType !== 'created_manual' && isAdminModification && log.modifiedByName && (
                      <div className="text-sm text-blue-600 dark:text-blue-400">
                        <span className="font-medium">Modificado por:</span> {log.modifiedByName}
                      </div>
                    )}
                    
                    {/* Show old values if exists */}
                    {log.oldValue && (
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium">Anterior:</span>{' '}
                        {log.oldValue.clockIn && format(new Date(log.oldValue.clockIn), 'HH:mm')}{' '}
                        {log.oldValue.clockOut && `- ${format(new Date(log.oldValue.clockOut), 'HH:mm')}`}
                      </div>
                    )}
                    
                    {/* Show new values if exists */}
                    {log.newValue && (
                      <div className="text-sm">
                        <span className="font-medium">Nuevo:</span>{' '}
                        {log.newValue.clockIn && format(new Date(log.newValue.clockIn), 'HH:mm')}{' '}
                        {log.newValue.clockOut && `- ${format(new Date(log.newValue.clockOut), 'HH:mm')}`}
                      </div>
                    )}
                    
                    {/* Show cleaned reason */}
                    {cleanReason && (
                      <div className="text-sm italic text-muted-foreground">
                        <span className="font-medium">Motivo:</span> {cleanReason}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
      {/* Incomplete Sessions Warning Dialog */}
      <Dialog open={showIncompleteWarningDialog} onOpenChange={setShowIncompleteWarningDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              Fichajes Incompletos Detectados
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  Se han encontrado {incompleteSessionsCount} fichaje(s) incompleto(s) en el rango seleccionado.
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-200">
                  Los datos exportados serán inexactos hasta que se completen estos fichajes.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleCancelExport}
                data-testid="button-cancel-export"
              >
                Cancelar
              </Button>
              <Button
                variant="default"
                className="flex-1 bg-amber-600 hover:bg-amber-700"
                onClick={handleConfirmExport}
                data-testid="button-confirm-export"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar Igualmente
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Close Incomplete Session Dialog - ask for close time */}
      <Dialog open={showCloseIncompleteDialog} onOpenChange={(open) => {
        if (!open) {
          setShowCloseIncompleteDialog(false);
          setCloseIncompleteData(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Cerrar Sesión Incompleta
            </DialogTitle>
          </DialogHeader>
          {closeIncompleteData && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Empleado:</span> {closeIncompleteData.userName}
                </p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Fecha:</span> {format(closeIncompleteData.clockIn, 'dd/MM/yyyy', { locale: es })}
                </p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Entrada:</span> {format(closeIncompleteData.clockIn, 'HH:mm', { locale: es })}
                </p>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Hora de salida:</label>
                <Input
                  type="time"
                  value={closeIncompleteData.selectedCloseTime}
                  onChange={(e) => setCloseIncompleteData({
                    ...closeIncompleteData,
                    selectedCloseTime: e.target.value
                  })}
                  className="w-full"
                  data-testid="input-close-time"
                />
                <p className="text-xs text-muted-foreground">
                  Por defecto: {closeIncompleteData.defaultCloseTime} (entrada + {(companySettings as any)?.workingHoursPerDay || 8}h de jornada)
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowCloseIncompleteDialog(false);
                    setCloseIncompleteData(null);
                  }}
                  data-testid="button-cancel-close"
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    if (!closeIncompleteData) return;
                    
                    // Build the close time date
                    const [hours, minutes] = closeIncompleteData.selectedCloseTime.split(':').map(Number);
                    const clockOutTime = new Date(closeIncompleteData.clockIn);
                    clockOutTime.setHours(hours, minutes, 0, 0);
                    
                    // Validate close time is after clock in
                    if (clockOutTime <= closeIncompleteData.clockIn) {
                      toast({
                        title: 'Error',
                        description: 'La hora de salida debe ser posterior a la hora de entrada.',
                        variant: 'destructive',
                      });
                      return;
                    }
                    
                    closeIncompleteSessionsMutation.mutate({
                      sessions: closeIncompleteData.sessions,
                      clockOutTime
                    });
                  }}
                  disabled={closeIncompleteSessionsMutation.isPending}
                  data-testid="button-confirm-close"
                >
                  {closeIncompleteSessionsMutation.isPending ? 'Cerrando...' : 'Cerrar Sesión'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}