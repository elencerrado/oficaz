import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFeatureCheck } from '@/hooks/use-feature-check';
import { usePageTitle } from '@/hooks/use-page-title';
import { usePageHeader } from '@/components/layout/page-header';
import { FeatureRestrictedPage } from '@/components/feature-restricted-page';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { UserAvatar } from '@/components/ui/user-avatar';
import { getAuthHeaders } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import StatsCard, { StatsCardGrid } from '@/components/StatsCard';
import { cn } from '@/lib/utils';
import { TabNavigation } from '@/components/ui/tab-navigation';
import {
  ClipboardList,
  Clock,
  MapPin,
  Calendar as CalendarIcon,
  Search,
  Filter,
  User,
  FileText,
  Download,
  FileSpreadsheet,
  Users,
  Eye,
  X,
  Pen,
  Edit,
  Settings,
  Plus,
  ArrowDown,
  FolderKanban,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DatePickerDay } from '@/components/ui/date-picker';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  parseISO,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  isSameDay
} from 'date-fns';
import { es } from 'date-fns/locale';

interface WorkReportWithEmployee {
  id: number;
  companyId: number;
  employeeId: number;
  reportDate: string;
  refCode?: string | null;
  location: string;
  locationCoords?: string | null;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  description: string;
  clientName?: string | null;
  notes?: string | null;
  signedBy?: string | null;
  signatureImage?: string | null;
  status: 'draft' | 'submitted';
  createdAt: string;
  updatedAt: string;
  employeeName: string;
  employeeSignature?: string | null;
  profilePicture?: string | null;
}

interface Employee {
  id: number;
  fullName: string;
  role: string;
  workReportMode?: string;
}

interface UniqueEmployee {
  id: number;
  name: string;
  profilePicture?: string | null;
}

const STATUS_STYLES = {
  draft: { bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800', text: 'text-orange-700 dark:text-orange-300', label: 'Borrador' },
  submitted: { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800', text: 'text-green-700 dark:text-green-300', label: 'Enviado' }
};

const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}min`;
};

interface EditFormData {
  reportDate: string;
  refCode: string;
  location: string;
  startTime: string;
  endTime: string;
  description: string;
  clientName: string;
  notes: string;
}

export default function AdminWorkReportsPage() {
  usePageTitle('Partes de Trabajo - Admin');
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const featureCheck = useFeatureCheck();

  const workReportsAccessMode = featureCheck?.getWorkReportsAccessMode?.() || 'none';
  const isSelfAccessOnly = workReportsAccessMode === 'self';
  const { setHeader, resetHeader } = usePageHeader();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    setHeader({
      title: 'Partes de Trabajo',
      subtitle: 'Visualiza y exporta los partes de trabajo de todos los empleados'
    });
    return resetHeader;
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [isExporting, setIsExporting] = useState(false);
  const [activeStatsFilter, setActiveStatsFilter] = useState<'all' | 'month' | 'employee' | 'project' | null>(null);
  const [employeeRotationIndex, setEmployeeRotationIndex] = useState(-1);
  const [projectRotationIndex, setProjectRotationIndex] = useState(-1);
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [displayedCount, setDisplayedCount] = useState(5);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [isViewModalEditMode, setIsViewModalEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'grid'>('list');
  const [gridViewMode, setGridViewMode] = useState<'week' | 'month'>('week');
  const [gridViewDate, setGridViewDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<WorkReportWithEmployee | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<number | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<WorkReportWithEmployee | null>(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [employeeWorkModes, setEmployeeWorkModes] = useState<Record<number, string>>({});
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [createFormData, setCreateFormData] = useState({
    reportDate: format(new Date(), 'yyyy-MM-dd'),
    refCode: '',
    location: '',
    startTime: '09:00',
    endTime: '17:00',
    description: '',
    clientName: '',
    notes: ''
  });
  const [showCreateRefCodeSuggestions, setShowCreateRefCodeSuggestions] = useState(false);
  const [showCreateLocationSuggestions, setShowCreateLocationSuggestions] = useState(false);
  const [showCreateClientSuggestions, setShowCreateClientSuggestions] = useState(false);
  const [editFormData, setEditFormData] = useState<EditFormData>({
    reportDate: '',
    refCode: '',
    location: '',
    startTime: '',
    endTime: '',
    description: '',
    clientName: '',
    notes: ''
  });

  const dateRangeParams = useMemo(() => {
    switch (dateFilter) {
      case 'month':
        const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
        return {
          startDate: format(startOfDay(monthStart), 'yyyy-MM-dd'),
          endDate: format(endOfDay(monthEnd), 'yyyy-MM-dd')
        };
      case 'day':
        if (selectedDay) {
          const dayStr = format(selectedDay, 'yyyy-MM-dd');
          return { startDate: dayStr, endDate: dayStr };
        }
        return {};
      case 'all':
      default:
        return {};
    }
  }, [dateFilter, currentMonth, selectedDay]);

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['/api/employees'],
    enabled: isAuthenticated && !authLoading,
    staleTime: 5 * 60 * 1000
  });

  const { data: companyLocations = [] } = useQuery<string[]>({
    queryKey: ['/api/admin/work-reports/locations'],
    enabled: isAuthenticated && !authLoading,
    staleTime: 60000
  });

  const { data: companyClients = [] } = useQuery<string[]>({
    queryKey: ['/api/admin/work-reports/clients'],
    enabled: isAuthenticated && !authLoading,
    staleTime: 60000
  });

  const { data: companyRefCodes = [] } = useQuery<string[]>({
    queryKey: ['/api/admin/work-reports/ref-codes'],
    enabled: isAuthenticated && !authLoading,
    staleTime: 60000
  });

  const filteredLocationSuggestions = useMemo(() => {
    if (!createFormData.location) return companyLocations.slice(0, 5);
    return companyLocations
      .filter(loc => loc.toLowerCase().includes(createFormData.location.toLowerCase()))
      .slice(0, 5);
  }, [createFormData.location, companyLocations]);

  const filteredClientSuggestions = useMemo(() => {
    if (!createFormData.clientName) return companyClients.slice(0, 5);
    return companyClients
      .filter(client => client.toLowerCase().includes(createFormData.clientName.toLowerCase()))
      .slice(0, 5);
  }, [createFormData.clientName, companyClients]);

  const filteredRefCodeSuggestions = useMemo(() => {
    if (!createFormData.refCode) return companyRefCodes.slice(0, 5);
    return companyRefCodes
      .filter(code => code.toLowerCase().includes(createFormData.refCode.toLowerCase()))
      .slice(0, 5);
  }, [createFormData.refCode, companyRefCodes]);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (dateRangeParams.startDate) params.append('startDate', dateRangeParams.startDate);
    if (dateRangeParams.endDate) params.append('endDate', dateRangeParams.endDate);
    if (employeeFilter !== 'all') params.append('employeeId', employeeFilter);
    return params.toString() ? `?${params.toString()}` : '';
  }, [dateRangeParams, employeeFilter]);

  const stableQueryKey = useMemo(
    () => [
      '/api/admin/work-reports',
      dateFilter,
      currentMonth.getTime(),
      selectedDay ? selectedDay.getTime() : 0,
      employeeFilter
    ] as const,
    [dateFilter, currentMonth, selectedDay, employeeFilter]
  );

  const { data: reports = [], isLoading: reportsLoading, isFetching } = useQuery<WorkReportWithEmployee[]>({
    queryKey: stableQueryKey,
    queryFn: async () => {
      const response = await fetch(`/api/admin/work-reports${queryParams}`, {
        headers: getAuthHeaders() as Record<string, string>,
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch reports');
      const data = await response.json();
      return Array.isArray(data) ? data : data?.reports || [];
    },
    enabled: isAuthenticated && !authLoading,
    staleTime: 30000,
    placeholderData: keepPreviousData
  });

  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    reports.forEach(report => {
      const reportDate = parseISO(report.reportDate);
      monthsSet.add(format(reportDate, 'yyyy-MM'));
    });
    return Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
  }, [reports]);

  const reportsSource = useMemo(() => {
    if (isSelfAccessOnly && user?.id) {
      return reports.filter(r => r.employeeId === user.id);
    }
    return reports;
  }, [reports, isSelfAccessOnly, user?.id]);

  const filteredReports = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    return reportsSource.filter(report => {
      if (projectFilter !== 'all' && report.refCode !== projectFilter) {
        return false;
      }

      if (searchTerm === '') return true;

      const formattedDate = format(parseISO(report.reportDate), "d 'de' MMMM yyyy", { locale: es }).toLowerCase();
      const shortDate = format(parseISO(report.reportDate), 'dd/MM/yyyy');

      return (
        report.location.toLowerCase().includes(searchLower) ||
        report.description.toLowerCase().includes(searchLower) ||
        report.employeeName.toLowerCase().includes(searchLower) ||
        (report.clientName && report.clientName.toLowerCase().includes(searchLower)) ||
        (report.refCode && report.refCode.toLowerCase().includes(searchLower)) ||
        formattedDate.includes(searchLower) ||
        shortDate.includes(searchLower)
      );
    });
  }, [reportsSource, searchTerm, projectFilter]);

  const visibleReports = useMemo(() => {
    return filteredReports.slice(0, displayedCount);
  }, [filteredReports, displayedCount]);

  const hasMoreToDisplay = displayedCount < filteredReports.length;

  useEffect(() => {
    setDisplayedCount(5);
  }, [dateFilter, employeeFilter, searchTerm, projectFilter]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreToDisplay) {
          setDisplayedCount(prev => Math.min(prev + 5, filteredReports.length));
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMoreToDisplay, filteredReports.length]);

  // Lista de empleados únicos que han enviado partes (uses reportsSource for self-access mode)
  const uniqueEmployeesList = useMemo<UniqueEmployee[]>(() => {
    const employeeMap = new Map<number, UniqueEmployee>();
    reportsSource.forEach(report => {
      const existing = employeeMap.get(report.employeeId);
      if (!existing) {
        employeeMap.set(report.employeeId, {
          id: report.employeeId,
          name: report.employeeName,
          profilePicture: report.profilePicture ?? null
        });
      } else if (!existing.profilePicture && report.profilePicture) {
        employeeMap.set(report.employeeId, {
          ...existing,
          profilePicture: report.profilePicture
        });
      }
    });
    return Array.from(employeeMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [reportsSource]);

  // Lista de proyectos únicos (refCodes) - uses reportsSource for self-access mode
  const uniqueProjectsList = useMemo(() => {
    const projects = new Set<string>();
    reportsSource.forEach(report => {
      if (report.refCode) {
        projects.add(report.refCode);
      }
    });
    return Array.from(projects).sort();
  }, [reportsSource]);

  // Partes de este mes - uses reportsSource for self-access mode
  const thisMonthReports = useMemo(() => {
    const today = new Date();
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);
    return reportsSource.filter(report => {
      const reportDate = parseISO(report.reportDate);
      return reportDate >= monthStart && reportDate <= monthEnd;
    });
  }, [reportsSource]);

  // Handler Card 1: Todos los partes
  const handleAllReportsFilter = useCallback(() => {
    setActiveStatsFilter(prev => {
      if (prev === 'all') {
        return null;
      }
      setDateFilter('all');
      setEmployeeFilter('all');
      setProjectFilter('all');
      setEmployeeRotationIndex(-1);
      setProjectRotationIndex(-1);
      setSelectedDay(null);
      return 'all';
    });
  }, []);

  // Handler Card 2: Partes este mes (usa el mes actual)
  const handleThisMonthFilter = useCallback(() => {
    setActiveStatsFilter(prev => {
      if (prev === 'month') {
        setDateFilter('all');
        return null;
      }
      // Establecer mes actual
      const now = new Date();
      setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
      setDateFilter('month');
      setEmployeeFilter('all');
      setProjectFilter('all');
      setEmployeeRotationIndex(-1);
      setProjectRotationIndex(-1);
      setSelectedDay(null);
      return 'month';
    });
  }, []);

  // Handler Card 3: Rotar empleados (incluye "todos" en la rotación)
  const handleEmployeeRotation = useCallback(() => {
    if (uniqueEmployeesList.length === 0) return;
    
    // Rotación: -1 (todos) → 0 → 1 → ... → n-1 → -1 (todos) → ...
    const nextIndex = employeeRotationIndex + 1;
    if (nextIndex >= uniqueEmployeesList.length) {
      // Volver a "todos"
      setEmployeeRotationIndex(-1);
      setEmployeeFilter('all');
      setActiveStatsFilter(null);
    } else {
      setEmployeeRotationIndex(nextIndex);
      setEmployeeFilter(String(uniqueEmployeesList[nextIndex].id));
      setActiveStatsFilter('employee');
    }
    setDateFilter('all');
    setProjectFilter('all');
    setProjectRotationIndex(-1);
  }, [employeeRotationIndex, uniqueEmployeesList]);

  // Handler doble click Card 3: Mostrar todos los empleados
  const handleEmployeeShowAll = useCallback(() => {
    setEmployeeRotationIndex(-1);
    setEmployeeFilter('all');
    setDateFilter('all');
    setProjectFilter('all');
    setActiveStatsFilter(null);
  }, []);

  // Handler Card 4: Rotar proyectos (incluye "todos" en la rotación)
  const handleProjectRotation = useCallback(() => {
    if (uniqueProjectsList.length === 0) return;
    
    // Rotación: -1 (todos) → 0 → 1 → ... → n-1 → -1 (todos) → ...
    const nextIndex = projectRotationIndex + 1;
    if (nextIndex >= uniqueProjectsList.length) {
      // Volver a "todos"
      setProjectRotationIndex(-1);
      setProjectFilter('all');
      setActiveStatsFilter(null);
    } else {
      setProjectRotationIndex(nextIndex);
      setProjectFilter(uniqueProjectsList[nextIndex]);
      setActiveStatsFilter('project');
    }
    setDateFilter('all');
    setEmployeeFilter('all');
    setEmployeeRotationIndex(-1);
  }, [projectRotationIndex, uniqueProjectsList]);

  // Handler doble click Card 4: Mostrar todos los proyectos
  const handleProjectShowAll = useCallback(() => {
    setProjectRotationIndex(-1);
    setProjectFilter('all');
    setDateFilter('all');
    setEmployeeFilter('all');
    setActiveStatsFilter(null);
  }, []);

  const exportToFormat = async (format: 'pdf' | 'excel') => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (dateRangeParams.startDate) params.append('startDate', dateRangeParams.startDate);
      if (dateRangeParams.endDate) params.append('endDate', dateRangeParams.endDate);
      if (employeeFilter !== 'all') params.append('employeeId', employeeFilter);

      const response = await fetch(`/api/admin/work-reports/export/${format}?${params}`, {
        headers: getAuthHeaders() as Record<string, string>
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const exportLabel = (() => {
        if (dateFilter === 'month') {
          return format(currentMonth, 'yyyy-MM');
        }
        if (dateFilter === 'day' && selectedDay) {
          return format(selectedDay, 'yyyy-MM-dd');
        }
        return 'all';
      })();
      a.download = `partes-trabajo-${exportLabel}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({ title: 'Exportación completada', description: `Los partes se han exportado a ${format.toUpperCase()}.` });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'No se pudo exportar.', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleViewReport = useCallback((report: WorkReportWithEmployee) => {
    setSelectedReport(report);
    setViewModalOpen(true);
  }, []);

  const handleDownloadPdf = useCallback(async (report: WorkReportWithEmployee) => {
    setIsDownloadingPdf(report.id);
    try {
      const response = await fetch(`/api/work-reports/${report.id}/pdf`, {
        headers: getAuthHeaders() as Record<string, string>
      });

      if (!response.ok) throw new Error('Error al generar PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `parte-trabajo-${report.id}-${report.reportDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({ title: 'PDF descargado', description: 'El parte de trabajo se ha descargado correctamente.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'No se pudo generar el PDF.', variant: 'destructive' });
    } finally {
      setIsDownloadingPdf(null);
    }
  }, [toast]);

  const handleEditReport = useCallback((report: WorkReportWithEmployee) => {
    setEditingReport(report);
    setEditFormData({
      reportDate: report.reportDate,
      refCode: report.refCode || '',
      location: report.location,
      startTime: report.startTime,
      endTime: report.endTime,
      description: report.description,
      clientName: report.clientName || '',
      notes: report.notes || ''
    });
    setEditModalOpen(true);
  }, []);

  const updateReportMutation = useMutation({
    mutationFn: async (data: { id: number; updates: Partial<EditFormData> }) => {
      return apiRequest('PATCH', `/api/admin/work-reports/${data.id}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/work-reports'], exact: false });
      setEditModalOpen(false);
      setIsViewModalEditMode(false);
      setEditingReport(null);
      toast({ title: 'Parte actualizado', description: 'Los cambios se han guardado correctamente.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'No se pudo actualizar el parte.', variant: 'destructive' });
    }
  });

  const handleSaveEdit = useCallback(() => {
    if (!editingReport) return;
    updateReportMutation.mutate({
      id: editingReport.id,
      updates: editFormData
    });
  }, [editingReport, editFormData, updateReportMutation]);

  const stats = useMemo(() => {
    const totalReports = reportsSource.length;
    const thisMonthCount = thisMonthReports.length;
    const uniqueEmployeesCount = uniqueEmployeesList.length;
    const uniqueProjectsCount = uniqueProjectsList.length;
    return { 
      totalReports, 
      thisMonthCount, 
      uniqueEmployeesCount, 
      uniqueProjectsCount 
    };
  }, [reportsSource, thisMonthReports, uniqueEmployeesList, uniqueProjectsList]);

  const filterTitle = useMemo(() => {
    switch (dateFilter) {
      case 'month':
        return `Partes de ${format(currentMonth, 'MMMM yyyy', { locale: es })}`;
      case 'day':
        return selectedDay
          ? `Partes del ${format(selectedDay, 'd MMM yyyy', { locale: es })}`
          : 'Partes por día';
      case 'all':
      default:
        return 'Todos los partes';
    }
  }, [dateFilter, currentMonth, selectedDay]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Dual-access model: allow self-access for managers even when feature is disabled
  // 'none' = no subscription access, 'self' = manager sees own reports only, 'full' = full access
  if (workReportsAccessMode === 'none') {
    return (
      <FeatureRestrictedPage 
        featureName="Partes de Trabajo" 
        description="Visualiza y exporta los partes de trabajo de todos tus empleados. Activa este addon desde la Tienda para comenzar a usarlo." 
      />
    );
  }

  return (
    <div className={`transition-opacity duration-300 ${reportsLoading ? 'opacity-60' : 'opacity-100'}`}>
      {/* Stats Cards - Simplified for self-access mode */}
      {isSelfAccessOnly ? (
        <StatsCardGrid columns={2}>
          {/* Card 1: Mis Partes */}
          <StatsCard
            title="Mis Partes"
            subtitle="Total"
            value={stats.totalReports}
            color="blue"
            icon={ClipboardList}
            onClick={handleAllReportsFilter}
            isActive={activeStatsFilter === 'all'}
            isLoading={reportsLoading}
            index={0}
          />
          {/* Card 2: Este Mes */}
          <StatsCard
            title="Este Mes"
            subtitle="Partes"
            value={stats.thisMonthCount}
            color="green"
            icon={CalendarIcon}
            onClick={handleThisMonthFilter}
            isActive={activeStatsFilter === 'month'}
            isLoading={reportsLoading}
            index={1}
          />
        </StatsCardGrid>
      ) : (
        <StatsCardGrid columns={4}>
          {/* Card 1: Total de partes */}
          <StatsCard
            title="Total Partes"
            subtitle="Todos"
            value={stats.totalReports}
            color="blue"
            icon={ClipboardList}
            onClick={handleAllReportsFilter}
            isActive={activeStatsFilter === 'all'}
            isLoading={reportsLoading}
            index={0}
          />
          {/* Card 2: Partes este mes */}
          <StatsCard
            title="Este Mes"
            subtitle="Partes"
            value={stats.thisMonthCount}
            color="green"
            icon={CalendarIcon}
            onClick={handleThisMonthFilter}
            isActive={activeStatsFilter === 'month'}
            isLoading={reportsLoading}
            index={1}
          />
          {/* Card 3: Empleados - click rota, doble click todos */}
          <StatsCard
            title={employeeRotationIndex >= 0 && uniqueEmployeesList[employeeRotationIndex] 
              ? uniqueEmployeesList[employeeRotationIndex].name.split(' ')[0] 
              : "Empleados"}
            subtitle={employeeRotationIndex >= 0 ? `${employeeRotationIndex + 1}/${stats.uniqueEmployeesCount}` : "Con partes"}
            value={stats.uniqueEmployeesCount}
            color="purple"
            icon={Users}
            onClick={handleEmployeeRotation}
            onDoubleClick={handleEmployeeShowAll}
            isActive={activeStatsFilter === 'employee'}
            isLoading={reportsLoading}
            index={2}
          />
          {/* Card 4: Proyectos - click rota, doble click todos */}
          <StatsCard
            title={projectRotationIndex >= 0 && uniqueProjectsList[projectRotationIndex] 
              ? uniqueProjectsList[projectRotationIndex] 
              : "Proyectos"}
            subtitle={projectRotationIndex >= 0 ? `${projectRotationIndex + 1}/${stats.uniqueProjectsCount}` : "Cod. Ref"}
            value={stats.uniqueProjectsCount}
            color="orange"
            icon={FolderKanban}
            onClick={handleProjectRotation}
            onDoubleClick={handleProjectShowAll}
            isActive={activeStatsFilter === 'project'}
            isLoading={reportsLoading}
            index={3}
          />
        </StatsCardGrid>
      )}

      {/* Tab Navigation */}
      <TabNavigation
        tabs={[
          { id: 'list', label: 'Lista de Partes', icon: ClipboardList },
          { id: 'grid', label: 'Cuadrante', icon: CalendarIcon }
        ]}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as 'list' | 'grid')}
      />

      {/* Reports List */}
      {activeTab === 'list' && (
        <>
      {/* Filters Section */}
      <div className="mb-4">
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm sm:text-lg font-medium">{filterTitle} ({filteredReports.length})</span>
              
              {/* Desktop buttons */}
              <div className="hidden sm:flex items-center gap-2">
                {/* Create button - hidden in self-access mode (read-only) */}
                {!isSelfAccessOnly && (
                  <Button 
                    size="sm" 
                    onClick={() => {
                      setSelectedEmployeeId('');
                      setCreateFormData({
                        reportDate: format(new Date(), 'yyyy-MM-dd'),
                        refCode: '',
                        location: '',
                        startTime: '09:00',
                        endTime: '17:00',
                        description: '',
                        clientName: '',
                        notes: ''
                      });
                      setCreateModalOpen(true);
                    }}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Plus className="w-4 h-4" />
                    Crear Parte
                  </Button>
                )}
                {/* Config button - hidden in self-access mode */}
                {!isSelfAccessOnly && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      const modes: Record<number, string> = {};
                      employees.forEach(emp => {
                        let mode = emp.workReportMode || 'manual';
                        if (mode === 'on_clockout') mode = 'both';
                        modes[emp.id] = mode;
                      });
                      setEmployeeWorkModes(modes);
                      setConfigModalOpen(true);
                    }}
                    className="flex items-center gap-2"
                  >
                    <Settings className="w-4 h-4" />
                    Configurar
                  </Button>
                )}
                {/* Filters button */}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-2"
                >
                  <Filter className="w-4 h-4" />
                  Filtros
                </Button>
              </div>
            </div>
            
            {/* Mobile buttons - grid layout */}
            <div className={`sm:hidden grid gap-2 ${isSelfAccessOnly ? 'grid-cols-1' : 'grid-cols-3'}`}>
              {!isSelfAccessOnly && (
                <Button 
                  size="sm" 
                  onClick={() => {
                    setSelectedEmployeeId('');
                    setCreateFormData({
                      reportDate: format(new Date(), 'yyyy-MM-dd'),
                      refCode: '',
                      location: '',
                      startTime: '09:00',
                      endTime: '17:00',
                      description: '',
                      clientName: '',
                      notes: ''
                    });
                    setCreateModalOpen(true);
                  }}
                  className="flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-xs">Crear</span>
                </Button>
              )}
              {!isSelfAccessOnly && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    const modes: Record<number, string> = {};
                    employees.forEach(emp => {
                      let mode = emp.workReportMode || 'manual';
                      if (mode === 'on_clockout') mode = 'both';
                      modes[emp.id] = mode;
                    });
                    setEmployeeWorkModes(modes);
                    setConfigModalOpen(true);
                  }}
                  className="flex items-center justify-center gap-1"
                >
                  <Settings className="w-4 h-4" />
                  <span className="text-xs">Config</span>
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center justify-center gap-1"
              >
                <Filter className="w-4 h-4" />
                <span className="text-xs">Filtros</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Collapsible Filters */}
        {showFilters && (
          <div className="py-4 bg-muted/50 rounded-lg px-4 mb-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-end">
              <div className="flex flex-col space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Buscar</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Buscar por cód. ref., empleado, lugar, cliente, fecha, trabajo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-10"
                    data-testid="input-admin-search-reports"
                  />
                </div>
              </div>
              {/* Employee filter - hidden in self-access mode */}
              {!isSelfAccessOnly && (
                <div className="flex flex-col space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Empleado</label>
                  <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                    <SelectTrigger className="h-10" data-testid="select-employee-filter">
                      <Users className="w-4 h-4 mr-2 text-gray-500" />
                      <SelectValue placeholder="Filtrar por empleado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los empleados</SelectItem>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id.toString()}>{emp.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex flex-col space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Período</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Select
                    value={dateFilter === 'month' ? format(currentMonth, 'yyyy-MM') : 'all'}
                    onValueChange={(value) => {
                      setActiveStatsFilter(null);
                      setEmployeeRotationIndex(-1);
                      setProjectRotationIndex(-1);
                      setSelectedDay(null);
                      setDisplayedCount(5);
                      if (value === 'all') {
                        setDateFilter('all');
                        return;
                      }
                      const [year, month] = value.split('-');
                      const parsedMonth = new Date(Number(year), Number(month) - 1, 1);
                      setCurrentMonth(parsedMonth);
                      setDateFilter('month');
                    }}
                  >
                    <SelectTrigger className="h-10 text-xs" aria-label="Seleccionar mes con partes">
                      <CalendarIcon className="w-4 h-4 mr-2 text-gray-500" />
                      <SelectValue placeholder="Meses con partes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los meses</SelectItem>
                      {availableMonths.length === 0 ? (
                        <SelectItem value="none" disabled>
                          Sin registros
                        </SelectItem>
                      ) : (
                        availableMonths.map((monthKey) => {
                          const [year, month] = monthKey.split('-');
                          const monthDate = new Date(Number(year), Number(month) - 1);
                          return (
                            <SelectItem key={monthKey} value={monthKey} className="capitalize">
                              {format(monthDate, 'MMMM yyyy', { locale: es })}
                            </SelectItem>
                          );
                        })
                      )}
                    </SelectContent>
                  </Select>

                  <DatePickerDay
                    date={selectedDay || undefined}
                    onDateChange={(date) => {
                      setActiveStatsFilter(null);
                      setEmployeeRotationIndex(-1);
                      setProjectRotationIndex(-1);
                      setDisplayedCount(5);
                      if (date) {
                        setSelectedDay(date);
                        setDateFilter('day');
                      } else {
                        setSelectedDay(null);
                        setDateFilter('all');
                      }
                    }}
                    placeholder="Seleccionar día"
                    className={cn(
                      "h-10 text-xs font-normal w-full justify-center",
                      dateFilter === 'day'
                        ? "bg-[#007AFF] text-white border-[#007AFF] hover:bg-[#007AFF]/90"
                        : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                    )}
                  />
                </div>
              </div>
              {/* Project filter */}
              <div className="flex flex-col space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Proyecto (Cód. ref.)</label>
                <Select value={projectFilter} onValueChange={setProjectFilter}>
                  <SelectTrigger className="h-10" data-testid="select-project-filter">
                    <FolderKanban className="w-4 h-4 mr-2 text-gray-500" />
                    <SelectValue placeholder="Filtrar por código de referencia" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los proyectos</SelectItem>
                    {uniqueProjectsList.map((project) => (
                      <SelectItem key={project} value={project}>{project}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
      
      {filteredReports.length === 0 ? (
        <div className="py-12 text-center px-4">
          <ClipboardList className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {searchTerm || employeeFilter !== 'all' || dateFilter !== 'all' ? 'No se encontraron partes' : 'Sin partes de trabajo'}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base max-w-xs sm:max-w-none mx-auto">
            {searchTerm || employeeFilter !== 'all' || dateFilter !== 'all'
              ? 'Intenta con otros filtros' 
              : 'Aún no hay partes registrados'}
          </p>
        </div>
      ) : visibleReports.length > 0 ? (
        <div className="space-y-4">
          {visibleReports.map((report) => {
            const statusStyle = STATUS_STYLES[report.status];
            return (
              <div 
                key={report.id} 
                onClick={() => handleViewReport(report)}
                className="bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 shadow-sm transition-colors overflow-hidden cursor-pointer"
                data-testid={`card-admin-report-${report.id}`}
              >
                {/* Compact Header */}
                <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-3 min-w-0">
                    <UserAvatar 
                      fullName={report.employeeName}
                      size="sm"
                      userId={report.employeeId}
                      profilePicture={report.profilePicture}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{report.employeeName}</p>
                      {report.refCode && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">{report.refCode}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Main content - clean grid layout */}
                <div className="px-6 py-5 space-y-5">
                  {/* Row 1: Date, Time, Location, Client, Work Description */}
                  <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    {/* Date */}
                    <div>
                      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs font-medium mb-2">
                        <CalendarIcon className="w-4 h-4" />
                        Fecha
                      </div>
                      <p className="text-base font-semibold text-gray-900 dark:text-white">
                        {format(parseISO(report.reportDate), 'd MMM', { locale: es })}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {format(parseISO(report.reportDate), 'EEEE', { locale: es })}
                      </p>
                    </div>

                    {/* Time */}
                    <div>
                      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs font-medium mb-2">
                        <Clock className="w-4 h-4" />
                        Horario
                      </div>
                      <p className="text-base font-semibold text-gray-900 dark:text-white">
                        {report.startTime.substring(0, 5)} - {report.endTime.substring(0, 5)}
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-0.5">
                        {formatDuration(report.durationMinutes)}
                      </p>
                    </div>

                    {/* Location */}
                    <div>
                      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs font-medium mb-2">
                        <MapPin className="w-4 h-4" />
                        Ubicación
                      </div>
                      <p className="text-base font-semibold text-gray-900 dark:text-white line-clamp-2">
                        {report.location}
                      </p>
                    </div>

                    {/* Client */}
                    {report.clientName && (
                      <div>
                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs font-medium mb-2">
                          <User className="w-4 h-4" />
                          Cliente
                        </div>
                        <p className="text-base font-semibold text-gray-900 dark:text-white line-clamp-2">
                          {report.clientName}
                        </p>
                      </div>
                    )}

                    {/* Work description */}
                    <div>
                      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs font-medium mb-2">
                        <FileText className="w-4 h-4" />
                        Trabajo realizado
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                        {report.description}
                      </p>
                    </div>
                  </div>

                  {/* Notes - if present */}
                  {report.notes && (
                    <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Notas: </span>
                        {report.notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          
          {/* Infinite scroll observer */}
          <div 
            ref={loadMoreRef} 
            className="py-4 text-center"
          >
            {hasMoreToDisplay ? (
              <div className="flex items-center justify-center gap-2 text-gray-400 dark:text-gray-500 text-sm">
                <ArrowDown className="w-4 h-4 animate-bounce" />
                <span>Desplaza para ver más ({filteredReports.length - displayedCount} restantes de {filteredReports.length})</span>
              </div>
            ) : filteredReports.length > 5 ? (
              <span className="text-gray-300 dark:text-gray-600 text-sm">
                Has visto todos los {filteredReports.length} partes
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
        </>
      )}

      {/* Vista de Cuadrante */}
      {activeTab === 'grid' && (
        <div className="space-y-4">
          {/* Controles */}
          <div className="flex items-center justify-between gap-4">
            {/* Selector Semana/Mes */}
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-1 relative inline-flex">
              <div 
                className="absolute top-1 bottom-1 bg-primary rounded-md transition-all duration-300"
                style={{
                  left: gridViewMode === 'week' ? '4px' : 'calc(50% + 2px)',
                  width: 'calc(50% - 6px)'
                }}
              />
              <div className="relative flex">
                <button
                  onClick={() => setGridViewMode('week')}
                  className={cn(
                    "w-[70px] py-2 text-sm font-medium transition-colors relative z-10 flex items-center justify-center rounded",
                    gridViewMode === 'week' ? 'text-white' : 'text-gray-600 dark:text-gray-400'
                  )}
                >
                  Semana
                </button>
                <button
                  onClick={() => setGridViewMode('month')}
                  className={cn(
                    "w-[70px] py-2 text-sm font-medium transition-colors relative z-10 flex items-center justify-center rounded",
                    gridViewMode === 'month' ? 'text-white' : 'text-gray-600 dark:text-gray-400'
                  )}
                >
                  Mes
                </button>
              </div>
            </div>

            {/* Navegación de fechas */}
            <div className="flex items-center gap-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2">
              <button
                onClick={() => {
                  if (gridViewMode === 'week') {
                    setGridViewDate(prev => subWeeks(prev, 1));
                  } else {
                    setGridViewDate(prev => subMonths(prev, 1));
                  }
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              <h3 className="font-semibold text-gray-900 dark:text-white min-w-[200px] text-center">
                {gridViewMode === 'week' 
                  ? `${format(startOfWeek(gridViewDate, { locale: es }), 'd MMM', { locale: es })} - ${format(endOfWeek(gridViewDate, { locale: es }), 'd MMM yyyy', { locale: es })}`
                  : format(gridViewDate, 'MMMM yyyy', { locale: es })}
              </h3>
              
              <button
                onClick={() => {
                  if (gridViewMode === 'week') {
                    setGridViewDate(prev => addWeeks(prev, 1));
                  } else {
                    setGridViewDate(prev => addMonths(prev, 1));
                  }
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Cuadrante de partes */}
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div 
              className="overflow-x-auto cursor-grab active:cursor-grabbing user-select-none"
              onMouseDown={(e) => {
                const el = e.currentTarget;
                let isDown = true;
                let startX = e.pageX - el.offsetLeft;
                let scrollLeft = el.scrollLeft;
                
                const handleMouseMove = (e: MouseEvent) => {
                  if (!isDown) return;
                  e.preventDefault();
                  const x = e.pageX - el.offsetLeft;
                  const walk = (x - startX) * 2;
                  el.scrollLeft = scrollLeft - walk;
                };
                
                const handleMouseUp = () => {
                  isDown = false;
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                };
                
                const handleSelectStart = (e: Event) => {
                  e.preventDefault();
                };
                
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
                document.addEventListener('selectstart', handleSelectStart);
              }}>
              <table className="w-full table-fixed">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-3 py-3 text-center font-semibold text-gray-700 dark:text-gray-300 w-[120px] min-w-[120px] max-w-[120px] sticky left-0 bg-gray-50 dark:bg-gray-800">
                      Empleado
                    </th>
                    {(() => {
                      const days = gridViewMode === 'week'
                        ? eachDayOfInterval({
                            start: startOfWeek(gridViewDate, { locale: es }),
                            end: endOfWeek(gridViewDate, { locale: es })
                          })
                        : eachDayOfInterval({
                            start: startOfMonth(gridViewDate),
                            end: endOfMonth(gridViewDate)
                          });
                      
                      return days.map(day => (
                        <th
                          key={day.toISOString()}
                          className={cn(
                            "px-1 py-2 text-center font-semibold text-gray-700 dark:text-gray-300",
                            gridViewMode === 'week'
                              ? 'w-[100px] min-w-[100px] max-w-[100px]'
                              : 'min-w-[60px]'
                          )}
                        >
                          <div className="flex flex-col items-center">
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {format(day, 'EEE', { locale: es })}
                            </span>
                            <span className="text-sm">{format(day, 'd', { locale: es })}</span>
                          </div>
                        </th>
                      ));
                    })()}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {uniqueEmployeesList.map(employee => {
                    const days = gridViewMode === 'week'
                      ? eachDayOfInterval({
                          start: startOfWeek(gridViewDate, { locale: es }),
                          end: endOfWeek(gridViewDate, { locale: es })
                        })
                      : eachDayOfInterval({
                          start: startOfMonth(gridViewDate),
                          end: endOfMonth(gridViewDate)
                        });
                    
                    // Calcular total de horas
                    const employeeReportsInPeriod = reportsSource.filter(r => {
                      const reportDate = parseISO(r.reportDate);
                      if (r.employeeId !== employee.id) return false;
                      
                      if (gridViewMode === 'week') {
                        return reportDate >= startOfWeek(gridViewDate, { locale: es }) && 
                               reportDate <= endOfWeek(gridViewDate, { locale: es });
                      } else {
                        return reportDate >= startOfMonth(gridViewDate) && 
                               reportDate <= endOfMonth(gridViewDate);
                      }
                    });
                    const totalMinutes = employeeReportsInPeriod.reduce((sum, r) => sum + r.durationMinutes, 0);
                    
                    return (
                      <tr key={employee.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 h-[120px]">
                        <td className="px-3 py-2 sticky left-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 w-[120px] min-w-[120px] max-w-[120px] h-full">
                          <div className="flex flex-col items-center gap-1.5 h-full justify-center">
                            <UserAvatar 
                              fullName={employee.name}
                              size="sm"
                              userId={employee.id}
                              profilePicture={employee.profilePicture}
                            />
                            <span className="font-medium text-gray-900 dark:text-white text-xs text-center leading-tight">
                              {employee.name}
                            </span>
                            <div className="text-xs text-gray-500 dark:text-gray-400 font-semibold">
                              {formatDuration(totalMinutes)}
                            </div>
                          </div>
                        </td>
                        {days.map(day => {
                          const dayReports = reportsSource.filter(r => 
                            r.employeeId === employee.id && 
                            isSameDay(parseISO(r.reportDate), day)
                          );
                          
                          const totalMinutes = dayReports.reduce((sum, r) => sum + r.durationMinutes, 0);
                          
                          return (
                            <td key={day.toISOString()} className={cn(
                              "text-center min-h-[100px] p-1",
                              gridViewMode === 'week' ? 'w-[100px] min-w-[100px] max-w-[100px] overflow-hidden' : ''
                            )}>
                              {dayReports.length > 0 ? (
                                gridViewMode === 'week' ? (
                                  <div className="h-full flex flex-col gap-1">
                                    {dayReports.map(report => {
                                      const startFormatted = report.startTime.substring(0, 5);
                                      const endFormatted = report.endTime.substring(0, 5);
                                      const duration = formatDuration(report.durationMinutes);
                                      return (
                                        <button
                                          key={report.id}
                                          onClick={() => handleViewReport(report)}
                                          className="flex-1 px-2 text-xs rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors overflow-hidden flex flex-col items-center justify-center gap-0.5"
                                          title={`${report.startTime}-${report.endTime} · ${report.location}`}
                                        >
                                          <div className="font-semibold leading-tight">{duration}</div>
                                          <div className="font-medium text-xs leading-tight">{startFormatted}-{endFormatted}</div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="h-full flex flex-col gap-1 items-center justify-center">
                                    {dayReports.map(report => (
                                      <button
                                        key={report.id}
                                        onClick={() => handleViewReport(report)}
                                        className="px-2 py-1 text-xs rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors whitespace-nowrap"
                                        title={`${report.startTime}-${report.endTime} · ${report.location}`}
                                      >
                                        <div className="font-semibold">{formatDuration(report.durationMinutes)}</div>
                                      </button>
                                    ))}
                                  </div>
                                )
                              ) : (
                                <div className="h-full flex items-center justify-center">
                                  <span className="text-gray-300 dark:text-gray-600 text-xs">-</span>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal de visualización del parte */}
      <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900">
          <DialogHeader className="border-b border-gray-200 dark:border-gray-700 pb-4">
            <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Parte de Trabajo
            </DialogTitle>
          </DialogHeader>
          
          {selectedReport && (
            <div className="py-4 space-y-6">
              {/* Cabecera del documento */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Empleado</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">{selectedReport.employeeName}</p>
                  </div>
                </div>
              </div>

              {/* Información del parte */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
                    <CalendarIcon className="w-4 h-4" />
                    Fecha
                  </div>
                  <p className="text-gray-900 dark:text-white font-medium capitalize">
                    {format(parseISO(selectedReport.reportDate), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
                  </p>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
                    <Clock className="w-4 h-4" />
                    Horario
                  </div>
                  <p className="text-gray-900 dark:text-white font-medium">
                    {selectedReport.startTime} - {selectedReport.endTime}
                    <span className="ml-2 text-blue-600 dark:text-blue-400">
                      ({formatDuration(selectedReport.durationMinutes)})
                    </span>
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
                    <MapPin className="w-4 h-4" />
                    Ubicación
                  </div>
                  <p className="text-gray-900 dark:text-white font-medium">{selectedReport.location}</p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
                    <User className="w-4 h-4" />
                    Cliente
                  </div>
                  <p className="text-gray-900 dark:text-white font-medium">
                    {selectedReport.clientName || 'No especificado'}
                  </p>
                </div>
              </div>

              {/* Descripción del trabajo */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-2">
                  <FileText className="w-4 h-4" />
                  Trabajo realizado
                </div>
                <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{selectedReport.description}</p>
              </div>

              {/* Notas */}
              {selectedReport.notes && (
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border-l-4 border-amber-400">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    <span className="font-medium">Notas:</span> {selectedReport.notes}
                  </p>
                </div>
              )}

              {/* Sección de firmas */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Pen className="w-5 h-5" />
                  Firmas
                </h3>
                <div className="grid grid-cols-2 gap-6">
                  {/* Firma del empleado */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Firma del empleado</p>
                    {selectedReport.employeeSignature ? (
                      <img 
                        src={selectedReport.employeeSignature} 
                        alt="Firma del empleado" 
                        className="max-h-20 w-auto mx-auto dark:invert dark:brightness-90"
                      />
                    ) : (
                      <div className="h-20 flex items-center justify-center">
                        <span className="text-gray-400 text-sm">Sin firma registrada</span>
                      </div>
                    )}
                    <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-2">{selectedReport.employeeName}</p>
                  </div>

                  {/* Firma del cliente */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Firma del cliente</p>
                    {selectedReport.signatureImage ? (
                      <img 
                        src={selectedReport.signatureImage} 
                        alt="Firma del cliente" 
                        className="max-h-20 w-auto mx-auto dark:invert dark:brightness-90"
                      />
                    ) : (
                      <div className="h-20 flex items-center justify-center">
                        <span className="text-gray-400 text-sm">Sin firma del cliente</span>
                      </div>
                    )}
                    <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-2">
                      {selectedReport.signedBy || 'Cliente'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                {!isViewModalEditMode && !isSelfAccessOnly && (
                  <Button
                    onClick={() => {
                      setIsViewModalEditMode(true);
                      if (selectedReport) {
                        handleEditReport(selectedReport);
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Editar
                  </Button>
                )}
                <Button
                  onClick={() => handleDownloadPdf(selectedReport!)}
                  disabled={isDownloadingPdf === selectedReport?.id}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {isDownloadingPdf === selectedReport?.id ? 'Generando...' : 'Descargar PDF'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de edición */}
      <Dialog 
        open={editModalOpen} 
        onOpenChange={(open) => {
          setEditModalOpen(open);
          if (!open) {
            setIsViewModalEditMode(false);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900">
          <DialogHeader className="border-b border-gray-200 dark:border-gray-700 pb-4">
            <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Edit className="w-5 h-5 text-blue-600" />
              Editar Parte de Trabajo
            </DialogTitle>
          </DialogHeader>
          
          {editingReport && (
            <div className="py-4 space-y-4">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400">Empleado</p>
                <p className="font-medium text-gray-900 dark:text-white">{editingReport.employeeName}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fecha</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal bg-white dark:bg-gray-800"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {editFormData.reportDate 
                          ? format(parseISO(editFormData.reportDate), "d 'de' MMMM, yyyy", { locale: es })
                          : "Seleccionar fecha"
                        }
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={editFormData.reportDate ? parseISO(editFormData.reportDate) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            setEditFormData(prev => ({ ...prev, reportDate: format(date, 'yyyy-MM-dd') }));
                          }
                        }}
                        locale={es}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-ref-code">Código ref.</Label>
                  <Input
                    id="edit-ref-code"
                    value={editFormData.refCode}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, refCode: e.target.value }))}
                    placeholder="Ej: OBR-2024-001"
                    className="bg-white dark:bg-gray-800"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-location">Ubicación</Label>
                <Input
                  id="edit-location"
                  value={editFormData.location}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="Ubicación"
                  className="bg-white dark:bg-gray-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-start">Hora inicio</Label>
                  <Input
                    id="edit-start"
                    type="time"
                    value={editFormData.startTime}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, startTime: e.target.value }))}
                    className="bg-white dark:bg-gray-800"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-end">Hora fin</Label>
                  <Input
                    id="edit-end"
                    type="time"
                    value={editFormData.endTime}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, endTime: e.target.value }))}
                    className="bg-white dark:bg-gray-800"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-client">Cliente</Label>
                <Input
                  id="edit-client"
                  value={editFormData.clientName}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, clientName: e.target.value }))}
                  placeholder="Nombre del cliente"
                  className="bg-white dark:bg-gray-800"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Trabajo realizado</Label>
                <Textarea
                  id="edit-description"
                  value={editFormData.description}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descripción del trabajo realizado"
                  rows={4}
                  className="bg-white dark:bg-gray-800"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-notes">Notas adicionales</Label>
                <Textarea
                  id="edit-notes"
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Notas adicionales (opcional)"
                  rows={2}
                  className="bg-white dark:bg-gray-800"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                  variant="outline"
                  onClick={() => setEditModalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  disabled={updateReportMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {updateReportMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de creación de parte */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900">
          <DialogHeader className="border-b border-gray-200 dark:border-gray-700 pb-4">
            <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600" />
              Crear Parte de Trabajo
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            {/* Employee selector - hidden in self-access mode */}
            {isSelfAccessOnly ? (
              <div className="space-y-2">
                <Label>Empleado</Label>
                <div className="p-2 bg-muted rounded-md text-sm">
                  {user?.fullName || 'Usuario'}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Empleado *</Label>
                <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                  <SelectTrigger className="bg-white dark:bg-gray-800">
                    <SelectValue placeholder="Seleccionar empleado" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.filter(emp => emp.role !== 'admin').map((emp) => (
                      <SelectItem key={emp.id} value={emp.id.toString()}>{emp.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal bg-white dark:bg-gray-800"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {createFormData.reportDate 
                        ? format(parseISO(createFormData.reportDate), "d 'de' MMMM, yyyy", { locale: es })
                        : "Seleccionar fecha"
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={createFormData.reportDate ? parseISO(createFormData.reportDate) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          setCreateFormData(prev => ({ ...prev, reportDate: format(date, 'yyyy-MM-dd') }));
                        }
                      }}
                      locale={es}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2 relative">
                <Label htmlFor="create-ref-code">Código ref.</Label>
                <Input
                  id="create-ref-code"
                  value={createFormData.refCode}
                  onChange={(e) => setCreateFormData(prev => ({ ...prev, refCode: e.target.value }))}
                  onFocus={() => setShowCreateRefCodeSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowCreateRefCodeSuggestions(false), 150)}
                  placeholder="Ej: OBR-2024-001"
                  className="bg-white dark:bg-gray-800"
                  autoComplete="off"
                />
                {showCreateRefCodeSuggestions && filteredRefCodeSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-40 overflow-y-auto">
                    {filteredRefCodeSuggestions.map((code, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                        onMouseDown={() => {
                          setCreateFormData(prev => ({ ...prev, refCode: code }));
                          setShowCreateRefCodeSuggestions(false);
                        }}
                      >
                        <FileText className="w-3 h-3 text-blue-400" />
                        {code}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2 relative">
              <Label htmlFor="create-location">Ubicación *</Label>
              <Input
                id="create-location"
                value={createFormData.location}
                onChange={(e) => setCreateFormData(prev => ({ ...prev, location: e.target.value }))}
                onFocus={() => setShowCreateLocationSuggestions(true)}
                onBlur={() => setTimeout(() => setShowCreateLocationSuggestions(false), 150)}
                placeholder="Ubicación del trabajo"
                className="bg-white dark:bg-gray-800"
                autoComplete="off"
              />
              {showCreateLocationSuggestions && filteredLocationSuggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-40 overflow-y-auto">
                  {filteredLocationSuggestions.map((loc, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                      onMouseDown={() => {
                        setCreateFormData(prev => ({ ...prev, location: loc }));
                        setShowCreateLocationSuggestions(false);
                      }}
                    >
                      <MapPin className="w-3 h-3 text-gray-400" />
                      {loc}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create-start">Hora inicio *</Label>
                <Input
                  id="create-start"
                  type="time"
                  value={createFormData.startTime}
                  onChange={(e) => setCreateFormData(prev => ({ ...prev, startTime: e.target.value }))}
                  className="bg-white dark:bg-gray-800"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-end">Hora fin *</Label>
                <Input
                  id="create-end"
                  type="time"
                  value={createFormData.endTime}
                  onChange={(e) => setCreateFormData(prev => ({ ...prev, endTime: e.target.value }))}
                  className="bg-white dark:bg-gray-800"
                />
              </div>
            </div>

            <div className="space-y-2 relative">
              <Label htmlFor="create-client">Cliente</Label>
              <Input
                id="create-client"
                value={createFormData.clientName}
                onChange={(e) => setCreateFormData(prev => ({ ...prev, clientName: e.target.value }))}
                onFocus={() => setShowCreateClientSuggestions(true)}
                onBlur={() => setTimeout(() => setShowCreateClientSuggestions(false), 150)}
                placeholder="Nombre del cliente"
                className="bg-white dark:bg-gray-800"
                autoComplete="off"
              />
              {showCreateClientSuggestions && filteredClientSuggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-40 overflow-y-auto">
                  {filteredClientSuggestions.map((client, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                      onMouseDown={() => {
                        setCreateFormData(prev => ({ ...prev, clientName: client }));
                        setShowCreateClientSuggestions(false);
                      }}
                    >
                      <User className="w-3 h-3 text-gray-400" />
                      {client}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-description">Trabajo realizado *</Label>
              <Textarea
                id="create-description"
                value={createFormData.description}
                onChange={(e) => setCreateFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe el trabajo realizado..."
                className="bg-white dark:bg-gray-800 min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-notes">Notas adicionales</Label>
              <Textarea
                id="create-notes"
                value={createFormData.notes}
                onChange={(e) => setCreateFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Notas adicionales..."
                className="bg-white dark:bg-gray-800 min-h-[60px]"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="outline"
                onClick={() => setCreateModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  // In self-access mode, use current user's ID
                  const employeeIdToUse = isSelfAccessOnly ? user?.id?.toString() : selectedEmployeeId;
                  
                  if (!employeeIdToUse) {
                    toast({ title: 'Error', description: 'Selecciona un empleado', variant: 'destructive' });
                    return;
                  }
                  if (!createFormData.location || !createFormData.description) {
                    toast({ title: 'Error', description: 'Completa los campos obligatorios', variant: 'destructive' });
                    return;
                  }
                  try {
                    const [startH, startM] = createFormData.startTime.split(':').map(Number);
                    const [endH, endM] = createFormData.endTime.split(':').map(Number);
                    const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
                    
                    await apiRequest('POST', '/api/admin/work-reports', {
                      employeeId: parseInt(employeeIdToUse),
                      reportDate: createFormData.reportDate,
                      refCode: createFormData.refCode || null,
                      location: createFormData.location,
                      startTime: createFormData.startTime,
                      endTime: createFormData.endTime,
                      durationMinutes: durationMinutes > 0 ? durationMinutes : 0,
                      description: createFormData.description,
                      clientName: createFormData.clientName || null,
                      notes: createFormData.notes || null,
                      status: 'submitted'
                    });
                    
                    queryClient.invalidateQueries({ queryKey: ['/api/admin/work-reports'] });
                    toast({
                      title: 'Parte creado',
                      description: 'El parte de trabajo ha sido creado correctamente.',
                    });
                    setCreateModalOpen(false);
                  } catch (error) {
                    toast({
                      title: 'Error',
                      description: 'No se pudo crear el parte de trabajo.',
                      variant: 'destructive',
                    });
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Crear Parte
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de configuración de modos de partes */}
      <Dialog open={configModalOpen} onOpenChange={setConfigModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900">
          <DialogHeader className="border-b border-gray-200 dark:border-gray-700 pb-4">
            <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-600" />
              Configurar Partes de Trabajo
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Configura cómo cada empleado puede crear partes de trabajo.
            </p>
            
            <div className="space-y-3">
              {employees.filter(emp => emp.role !== 'admin').map((emp) => (
                <div 
                  key={emp.id} 
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-500" />
                    <span className="font-medium text-gray-900 dark:text-white">{emp.fullName}</span>
                  </div>
                  <Select 
                    value={employeeWorkModes[emp.id] || 'manual'} 
                    onValueChange={(value) => {
                      setEmployeeWorkModes(prev => ({ ...prev, [emp.id]: value }));
                    }}
                  >
                    <SelectTrigger className="w-[160px] h-9 text-sm bg-white dark:bg-gray-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="disabled">No puede crear partes</SelectItem>
                      <SelectItem value="manual">En página de partes</SelectItem>
                      <SelectItem value="both">En página y al cerrar fichaje</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="outline"
                onClick={() => setConfigModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  try {
                    for (const [empId, mode] of Object.entries(employeeWorkModes)) {
                      const emp = employees.find(e => e.id === parseInt(empId));
                      if (emp && emp.workReportMode !== mode) {
                        await apiRequest('PATCH', `/api/employees/${empId}`, { workReportMode: mode });
                      }
                    }
                    queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
                    toast({
                      title: 'Configuración guardada',
                      description: 'Los modos de partes de trabajo han sido actualizados.',
                    });
                    setConfigModalOpen(false);
                  } catch (error) {
                    toast({
                      title: 'Error',
                      description: 'No se pudo guardar la configuración.',
                      variant: 'destructive',
                    });
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Guardar cambios
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
