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
  Trash2,
  Settings,
  Plus,
  Save,
  FolderKanban,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DatePickerDay, DatePickerPeriod } from '@/components/ui/date-picker';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ModalActionButton } from '@/components/ui/modal-action-button';
import { ModalHeaderWithActions } from '@/components/ui/modal-header-with-actions';
import { EmployeeScopeDropdown } from '@/components/ui/employee-scope-dropdown';
import { InfiniteListFooter } from '@/components/ui/infinite-list-footer';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useTeams, resolveTeamMemberIds } from '@/hooks/use-teams';
import { useIncrementalList } from '@/hooks/use-incremental-list';
import { useStandardInfiniteScroll } from '@/hooks/use-standard-infinite-scroll';
import {
  FILTER_LABEL_CLASS,
  FILTER_PANEL_CLASS,
  FILTER_SEARCH_INPUT_CLASS,
  FILTER_SELECT_TRIGGER_CLASS,
} from '@/lib/filter-styles';
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

interface ExportEmployeeOption {
  id: number;
  name: string;
  profilePicture?: string | null;
}

interface CompanyWorkSchedule {
  dayOfWeek: number;
  isWorkingDay: boolean;
  expectedEntryTime: string | null;
  expectedExitTime: string | null;
}

const EMPTY_REPORTS: WorkReportWithEmployee[] = [];

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

type TableSortKey =
  | 'reportDate'
  | 'employeeName'
  | 'refCode'
  | 'location'
  | 'clientName'
  | 'startTime'
  | 'endTime'
  | 'durationMinutes'
  | 'status';

type TableColumnKey =
  | 'reportDate'
  | 'employeeName'
  | 'refCode'
  | 'location'
  | 'clientName'
  | 'startTime'
  | 'endTime'
  | 'durationMinutes'
  | 'status'
  | 'description'
  | 'notes'
  | 'actions';

interface TableColumnFilters {
  reportDate: string;
  employeeName: string;
  refCode: string;
  location: string;
  clientName: string;
  status: 'all' | 'draft' | 'submitted';
}

const TABLE_COLUMNS: Array<{ key: TableColumnKey; label: string; sortable: boolean }> = [
  { key: 'reportDate', label: 'Fecha', sortable: true },
  { key: 'employeeName', label: 'Empleado', sortable: true },
  { key: 'refCode', label: 'Cód. Ref.', sortable: true },
  { key: 'location', label: 'Ubicación', sortable: true },
  { key: 'clientName', label: 'Cliente', sortable: true },
  { key: 'startTime', label: 'Inicio', sortable: true },
  { key: 'endTime', label: 'Fin', sortable: true },
  { key: 'durationMinutes', label: 'Duración', sortable: true },
  { key: 'status', label: 'Estado', sortable: true },
  { key: 'description', label: 'Trabajo', sortable: false },
  { key: 'notes', label: 'Notas', sortable: false },
  { key: 'actions', label: 'Acciones', sortable: false }
];

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
  const [teamFilter, setTeamFilter] = useState('all');
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [exportStartDate, setExportStartDate] = useState<Date | undefined>(undefined);
  const [exportEndDate, setExportEndDate] = useState<Date | undefined>(undefined);
  const [exportSelectedEmployees, setExportSelectedEmployees] = useState<number[]>([]);
  const [exportFormat, setExportFormat] = useState<'excel' | 'pdf'>('excel');
  const [activeStatsFilter, setActiveStatsFilter] = useState<'all' | 'month' | 'employee' | 'project' | null>(null);
  const [employeeRotationIndex, setEmployeeRotationIndex] = useState(-1);
  const [projectRotationIndex, setProjectRotationIndex] = useState(-1);
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [isViewModalEditMode, setIsViewModalEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'grid' | 'table'>('list');
  const [gridViewMode, setGridViewMode] = useState<'week' | 'month'>('week');
  const [gridViewDate, setGridViewDate] = useState(new Date());
  const [isTableEditMode, setIsTableEditMode] = useState(false);
  const [isSavingTableChanges, setIsSavingTableChanges] = useState(false);
  const [savingTableRowIds, setSavingTableRowIds] = useState<Set<number>>(new Set());
  const [tableDrafts, setTableDrafts] = useState<Record<number, Partial<EditFormData>>>({});
  const [tableColumnFilters, setTableColumnFilters] = useState<TableColumnFilters>({
    reportDate: '',
    employeeName: '',
    refCode: '',
    location: '',
    clientName: '',
    status: 'all'
  });
  const [showTablePasteDialog, setShowTablePasteDialog] = useState(false);
  const [tablePasteInput, setTablePasteInput] = useState('');
  const [tableZoom, setTableZoom] = useState(100);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [tableSort, setTableSort] = useState<{ key: TableSortKey; direction: 'asc' | 'desc' }>({
    key: 'reportDate',
    direction: 'desc'
  });
  const [tableColumnWidths, setTableColumnWidths] = useState<Record<TableColumnKey, number>>({
    reportDate: 140,
    employeeName: 220,
    refCode: 160,
    location: 260,
    clientName: 220,
    startTime: 120,
    endTime: 120,
    durationMinutes: 140,
    status: 140,
    description: 360,
    notes: 360,
    actions: 190
  });
  const TABLE_EDITABLE_COL_COUNT = 8;
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<WorkReportWithEmployee | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<number | null>(null);
  const [reportToDelete, setReportToDelete] = useState<WorkReportWithEmployee | null>(null);
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
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const { data: companyWorkSchedules = [] } = useQuery<CompanyWorkSchedule[]>({
    queryKey: ['/api/company-work-schedules'],
    enabled: isAuthenticated && !authLoading,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const { data: teams = [] } = useTeams(isAuthenticated && !authLoading && !isSelfAccessOnly);

  const defaultReportTimes = useMemo(() => {
    const workingSchedules = companyWorkSchedules.filter(
      (schedule) => schedule.isWorkingDay && schedule.expectedEntryTime && schedule.expectedExitTime
    );

    if (workingSchedules.length === 0) {
      return { startTime: '09:00', endTime: '17:00' };
    }

    const scheduleCounts = new Map<string, number>();
    for (const schedule of workingSchedules) {
      const key = `${schedule.expectedEntryTime}-${schedule.expectedExitTime}`;
      scheduleCounts.set(key, (scheduleCounts.get(key) ?? 0) + 1);
    }

    const [mostFrequentKey] = Array.from(scheduleCounts.entries()).sort((a, b) => b[1] - a[1])[0];
    const [startTime, endTime] = mostFrequentKey.split('-');

    return {
      startTime: startTime || '09:00',
      endTime: endTime || '17:00'
    };
  }, [companyWorkSchedules]);

  const { data: companyLocations = [] } = useQuery<string[]>({
    queryKey: ['/api/admin/work-reports/locations'],
    enabled: isAuthenticated && !authLoading,
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const { data: companyClients = [] } = useQuery<string[]>({
    queryKey: ['/api/admin/work-reports/clients'],
    enabled: isAuthenticated && !authLoading,
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const { data: companyRefCodes = [] } = useQuery<string[]>({
    queryKey: ['/api/admin/work-reports/ref-codes'],
    enabled: isAuthenticated && !authLoading,
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
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
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData
  });

  const exportRangeQueryParams = useMemo(() => {
    if (!exportStartDate || !exportEndDate) return '';
    const params = new URLSearchParams();
    params.append('startDate', format(startOfDay(exportStartDate), 'yyyy-MM-dd'));
    params.append('endDate', format(endOfDay(exportEndDate), 'yyyy-MM-dd'));
    return `?${params.toString()}`;
  }, [exportStartDate, exportEndDate]);

  const { data: exportRangeReportsData, isLoading: exportRangeReportsLoading } = useQuery<WorkReportWithEmployee[]>({
    queryKey: ['/api/admin/work-reports/export-range', exportRangeQueryParams],
    queryFn: async () => {
      const response = await fetch(`/api/admin/work-reports${exportRangeQueryParams}`, {
        headers: getAuthHeaders() as Record<string, string>,
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch export range reports');
      const data = await response.json();
      return Array.isArray(data) ? data : data?.reports || [];
    },
    enabled: isAuthenticated && !authLoading && showExportModal && !!exportStartDate && !!exportEndDate && !isSelfAccessOnly,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const exportRangeReports = exportRangeReportsData ?? EMPTY_REPORTS;

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
    const selectedTeamId = teamFilter !== 'all' ? parseInt(teamFilter, 10) : null;
    const teamMembers = selectedTeamId ? new Set(resolveTeamMemberIds(teams, selectedTeamId)) : null;

    const searchLower = searchTerm.toLowerCase();
    return reportsSource.filter(report => {
      if (teamMembers && !teamMembers.has(report.employeeId)) {
        return false;
      }

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
  }, [reportsSource, searchTerm, projectFilter, teamFilter, teams]);

  const {
    displayedCount,
    setDisplayedCount,
    visibleItems: visibleReports,
    hasMore: hasMoreToDisplay,
    loadMore: loadMoreReports,
    initialCount: initialReportsCount,
  } = useIncrementalList({
    items: filteredReports,
    mobileInitialCount: 4,
    desktopInitialCount: 8,
    resetKey: `${dateFilter}-${employeeFilter}-${teamFilter}-${searchTerm}-${projectFilter}`,
  });

  useStandardInfiniteScroll({
    targetRef: loadMoreRef,
    enabled: activeTab === 'list',
    canLoadMore: hasMoreToDisplay,
    onLoadMore: loadMoreReports,
    dependencyKey: `${activeTab}-${displayedCount}-${filteredReports.length}`,
    rootMargin: '100px',
  });

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
      setTeamFilter('all');
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
      setTeamFilter('all');
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
    setTeamFilter('all');
    setProjectRotationIndex(-1);
  }, [employeeRotationIndex, uniqueEmployeesList]);

  // Handler doble click Card 3: Mostrar todos los empleados
  const handleEmployeeShowAll = useCallback(() => {
    setEmployeeRotationIndex(-1);
    setEmployeeFilter('all');
    setDateFilter('all');
    setProjectFilter('all');
    setTeamFilter('all');
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
    setTeamFilter('all');
    setEmployeeRotationIndex(-1);
  }, [projectRotationIndex, uniqueProjectsList]);

  // Handler doble click Card 4: Mostrar todos los proyectos
  const handleProjectShowAll = useCallback(() => {
    setProjectRotationIndex(-1);
    setProjectFilter('all');
    setDateFilter('all');
    setEmployeeFilter('all');
    setTeamFilter('all');
    setActiveStatsFilter(null);
  }, []);

  const exportEmployeesOptions = useMemo<ExportEmployeeOption[]>(() => {
    if (!exportStartDate || !exportEndDate) {
      return uniqueEmployeesList.map((employee) => ({
        id: employee.id,
        name: employee.name,
        profilePicture: employee.profilePicture
      }));
    }

    const employeesMap = new Map<number, ExportEmployeeOption>();
    exportRangeReports.forEach((report) => {
      if (!employeesMap.has(report.employeeId)) {
        employeesMap.set(report.employeeId, {
          id: report.employeeId,
          name: report.employeeName,
          profilePicture: report.profilePicture ?? null
        });
      }
    });

    return Array.from(employeesMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [uniqueEmployeesList, exportStartDate, exportEndDate, exportRangeReports]);

  useEffect(() => {
    setExportSelectedEmployees((previous) => {
      const filtered = previous.filter((id) => exportEmployeesOptions.some((employee) => employee.id === id));
      if (filtered.length === previous.length && filtered.every((id, index) => id === previous[index])) {
        return previous;
      }
      return filtered;
    });
  }, [exportEmployeesOptions]);

  const resetExportModalState = useCallback(() => {
    setShowExportModal(false);
    setExportStartDate(undefined);
    setExportEndDate(undefined);
    setExportSelectedEmployees([]);
    setExportFormat('excel');
  }, []);

  const handleExportWorkReportsExcel = useCallback(async () => {
    if (exportSelectedEmployees.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Debes seleccionar al menos un trabajador'
      });
      return;
    }

    if (!exportStartDate || !exportEndDate) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Debes seleccionar una fecha de inicio y fin'
      });
      return;
    }

    const rangeStart = startOfDay(exportStartDate);
    const rangeEnd = endOfDay(exportEndDate);

    if (rangeStart > rangeEnd) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'La fecha de inicio no puede ser posterior a la fecha fin'
      });
      return;
    }

    setIsExportingExcel(true);
    try {
      const response = await fetch('/api/admin/work-reports/export/excel', {
        method: 'POST',
        headers: {
          ...(getAuthHeaders() as Record<string, string>),
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          employeeIds: exportSelectedEmployees,
          startDate: rangeStart.toISOString(),
          endDate: rangeEnd.toISOString()
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'No se pudo generar el Excel' }));
        throw new Error(errorData.message || 'No se pudo generar el Excel');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `partes-trabajo-${format(rangeStart, 'yyyy-MM-dd')}_${format(rangeEnd, 'yyyy-MM-dd')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({ title: 'Exportación completada', description: 'Informe de partes exportado correctamente.' });
      resetExportModalState();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'No se pudo exportar el Excel.', variant: 'destructive' });
    } finally {
      setIsExportingExcel(false);
    }
  }, [exportSelectedEmployees, exportStartDate, exportEndDate, toast, resetExportModalState]);

  const handleExportWorkReportsPdf = useCallback(async () => {
    if (exportSelectedEmployees.length === 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Debes seleccionar al menos un trabajador' });
      return;
    }
    if (!exportStartDate || !exportEndDate) {
      toast({ variant: 'destructive', title: 'Error', description: 'Debes seleccionar una fecha de inicio y fin' });
      return;
    }
    const rangeStart = startOfDay(exportStartDate);
    const rangeEnd = endOfDay(exportEndDate);
    if (rangeStart > rangeEnd) {
      toast({ variant: 'destructive', title: 'Error', description: 'La fecha de inicio no puede ser posterior a la fecha fin' });
      return;
    }
    setIsExportingExcel(true);
    try {
      const response = await fetch('/api/admin/work-reports/export/pdf', {
        method: 'POST',
        headers: { ...(getAuthHeaders() as Record<string, string>), 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          employeeIds: exportSelectedEmployees,
          startDate: rangeStart.toISOString(),
          endDate: rangeEnd.toISOString(),
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'No se pudo generar el PDF' }));
        throw new Error(errorData.message || 'No se pudo generar el PDF');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `partes-trabajo-${format(rangeStart, 'yyyy-MM-dd')}_${format(rangeEnd, 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: 'Exportación completada', description: 'Informe de partes exportado correctamente.' });
      resetExportModalState();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'No se pudo exportar el PDF.', variant: 'destructive' });
    } finally {
      setIsExportingExcel(false);
    }
  }, [exportSelectedEmployees, exportStartDate, exportEndDate, toast, resetExportModalState]);

  const handleViewReport = useCallback((report: WorkReportWithEmployee) => {
    setIsViewModalEditMode(false);
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

  const deleteReportMutation = useMutation({
    mutationFn: async (id: number) => apiRequest('DELETE', `/api/work-reports/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/work-reports'], exact: false });
      setViewModalOpen(false);
      setEditModalOpen(false);
      setIsViewModalEditMode(false);
      setEditingReport(null);
      setSelectedReport(null);
      toast({ title: 'Parte eliminado', description: 'El parte de trabajo se ha eliminado correctamente.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'No se pudo eliminar el parte.', variant: 'destructive' });
    }
  });

  const handleDeleteReport = useCallback((report: WorkReportWithEmployee) => {
    setReportToDelete(report);
  }, [deleteReportMutation]);

  const getDraftOrOriginalValue = useCallback(
    (report: WorkReportWithEmployee, field: keyof EditFormData) => {
      const draftValue = tableDrafts[report.id]?.[field];
      if (draftValue !== undefined) return draftValue;

      switch (field) {
        case 'reportDate':
          return report.reportDate;
        case 'refCode':
          return report.refCode || '';
        case 'location':
          return report.location;
        case 'startTime':
          return report.startTime;
        case 'endTime':
          return report.endTime;
        case 'description':
          return report.description;
        case 'clientName':
          return report.clientName || '';
        case 'notes':
          return report.notes || '';
        default:
          return '';
      }
    },
    [tableDrafts]
  );

  const updateTableDraft = useCallback((reportId: number, field: keyof EditFormData, value: string) => {
    setTableDrafts(prev => ({
      ...prev,
      [reportId]: {
        ...(prev[reportId] || {}),
        [field]: value
      }
    }));
  }, []);

  const calculateMinutesFromTimes = useCallback((startTime: string, endTime: string) => {
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);

    if ([startHours, startMinutes, endHours, endMinutes].some(v => Number.isNaN(v))) {
      return 0;
    }

    let total = (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes);
    if (total < 0) total += 24 * 60;
    return total;
  }, []);

  const getTableDurationMinutes = useCallback((report: WorkReportWithEmployee) => {
    const draftStart = getDraftOrOriginalValue(report, 'startTime');
    const draftEnd = getDraftOrOriginalValue(report, 'endTime');
    return calculateMinutesFromTimes(draftStart, draftEnd);
  }, [calculateMinutesFromTimes, getDraftOrOriginalValue]);

  const sortedTableReports = useMemo(() => {
    const list = [...filteredReports];

    const getSortValue = (report: WorkReportWithEmployee) => {
      switch (tableSort.key) {
        case 'reportDate':
          return getDraftOrOriginalValue(report, 'reportDate');
        case 'employeeName':
          return report.employeeName;
        case 'refCode':
          return getDraftOrOriginalValue(report, 'refCode');
        case 'location':
          return getDraftOrOriginalValue(report, 'location');
        case 'clientName':
          return getDraftOrOriginalValue(report, 'clientName');
        case 'startTime':
          return getDraftOrOriginalValue(report, 'startTime');
        case 'endTime':
          return getDraftOrOriginalValue(report, 'endTime');
        case 'durationMinutes':
          return getTableDurationMinutes(report);
        case 'status':
          return report.status;
        default:
          return '';
      }
    };

    list.sort((a, b) => {
      const aValue = getSortValue(a);
      const bValue = getSortValue(b);

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return tableSort.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      const normalizedA = String(aValue || '').toLowerCase();
      const normalizedB = String(bValue || '').toLowerCase();
      const comparison = normalizedA.localeCompare(normalizedB, 'es');
      return tableSort.direction === 'asc' ? comparison : -comparison;
    });

    return list;
  }, [filteredReports, tableSort, getDraftOrOriginalValue, getTableDurationMinutes]);

  const hasTableChanges = useMemo(
    () => Object.values(tableDrafts).some((draft) => Object.keys(draft).length > 0),
    [tableDrafts]
  );

  const handleTableSort = useCallback((key: TableSortKey) => {
    setTableSort(prev => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === 'asc' ? 'desc' : 'asc'
        };
      }
      return { key, direction: 'asc' };
    });
  }, []);

  const handleClearTableColumnFilters = useCallback(() => {
    setTableColumnFilters({
      reportDate: '',
      employeeName: '',
      refCode: '',
      location: '',
      clientName: '',
      status: 'all'
    });
  }, []);

  const handleResetTableFilters = useCallback(() => {
    handleClearTableColumnFilters();
    setSearchTerm('');
    setDateFilter('all');
    setEmployeeFilter('all');
    setTeamFilter('all');
    setProjectFilter('all');
    setSelectedDay(null);
    setActiveStatsFilter(null);
    setEmployeeRotationIndex(-1);
    setProjectRotationIndex(-1);
  }, [handleClearTableColumnFilters]);

  const filteredTableReports = useMemo(() => {
    const dateFilterLower = tableColumnFilters.reportDate.trim().toLowerCase();
    const employeeFilterLower = tableColumnFilters.employeeName.trim().toLowerCase();
    const refCodeFilterLower = tableColumnFilters.refCode.trim().toLowerCase();
    const locationFilterLower = tableColumnFilters.location.trim().toLowerCase();
    const clientFilterLower = tableColumnFilters.clientName.trim().toLowerCase();

    return sortedTableReports.filter((report) => {
      const reportDateValue = getDraftOrOriginalValue(report, 'reportDate').toLowerCase();
      const employeeValue = report.employeeName.toLowerCase();
      const refCodeValue = getDraftOrOriginalValue(report, 'refCode').toLowerCase();
      const locationValue = getDraftOrOriginalValue(report, 'location').toLowerCase();
      const clientValue = getDraftOrOriginalValue(report, 'clientName').toLowerCase();

      if (dateFilterLower && !reportDateValue.includes(dateFilterLower)) return false;
      if (employeeFilterLower && !employeeValue.includes(employeeFilterLower)) return false;
      if (refCodeFilterLower && !refCodeValue.includes(refCodeFilterLower)) return false;
      if (locationFilterLower && !locationValue.includes(locationFilterLower)) return false;
      if (clientFilterLower && !clientValue.includes(clientFilterLower)) return false;
      if (tableColumnFilters.status !== 'all' && report.status !== tableColumnFilters.status) return false;

      return true;
    });
  }, [sortedTableReports, tableColumnFilters, getDraftOrOriginalValue]);

  const getColumnDisplayValue = useCallback((report: WorkReportWithEmployee, key: TableColumnKey) => {
    switch (key) {
      case 'reportDate':
        return getDraftOrOriginalValue(report, 'reportDate');
      case 'employeeName':
        return report.employeeName;
      case 'refCode':
        return getDraftOrOriginalValue(report, 'refCode');
      case 'location':
        return getDraftOrOriginalValue(report, 'location');
      case 'clientName':
        return getDraftOrOriginalValue(report, 'clientName');
      case 'startTime':
        return getDraftOrOriginalValue(report, 'startTime');
      case 'endTime':
        return getDraftOrOriginalValue(report, 'endTime');
      case 'durationMinutes':
        return formatDuration(getTableDurationMinutes(report));
      case 'status':
        return report.status === 'draft' ? 'Borrador' : 'Enviado';
      case 'description':
        return getDraftOrOriginalValue(report, 'description');
      case 'notes':
        return getDraftOrOriginalValue(report, 'notes');
      case 'actions':
        return 'acciones';
      default:
        return '';
    }
  }, [getDraftOrOriginalValue, getTableDurationMinutes]);

  const handleAutoFitColumn = useCallback((key: TableColumnKey) => {
    if (key === 'actions') return;

    const column = TABLE_COLUMNS.find(col => col.key === key);
    const headerLength = column?.label.length ?? 8;
    const maxContentLength = filteredTableReports.reduce((maxLen, report) => {
      const valueLength = String(getColumnDisplayValue(report, key) || '').length;
      return Math.max(maxLen, valueLength);
    }, headerLength);

    const isLargeTextColumn = key === 'description' || key === 'notes' || key === 'location';
    const minWidth = isLargeTextColumn ? 260 : 120;
    const maxWidth = isLargeTextColumn ? 900 : 520;
    const perChar = isLargeTextColumn ? 8.5 : 7.5;
    const nextWidth = Math.max(minWidth, Math.min(maxWidth, Math.round(maxContentLength * perChar + 44)));

    setTableColumnWidths(prev => ({
      ...prev,
      [key]: nextWidth
    }));
  }, [filteredTableReports, getColumnDisplayValue]);

  const handleTableWheelZoom = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    setTableZoom(prev => {
      const delta = e.deltaY < 0 ? 5 : -5;
      return Math.max(70, Math.min(170, prev + delta));
    });
  }, []);

  const focusTableEditableCell = useCallback((rowIndex: number, colIndex: number) => {
    const safeRow = Math.max(0, rowIndex);
    const safeCol = Math.max(0, Math.min(TABLE_EDITABLE_COL_COUNT - 1, colIndex));
    const selector = `[data-table-cell="true"][data-table-row="${safeRow}"][data-table-col="${safeCol}"]`;
    const target = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement | null;
    if (!target) return;
    target.focus();
    if (target instanceof HTMLInputElement) {
      target.select();
    }
  }, [TABLE_EDITABLE_COL_COUNT]);

  const handleTableCellKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number) => {
    if (!isTableEditMode) return;

    const maxRow = Math.max(0, filteredTableReports.length - 1);
    let nextRow = rowIndex;
    let nextCol = colIndex;
    let handled = true;

    switch (e.key) {
      case 'Enter':
        nextRow = Math.min(maxRow, rowIndex + 1);
        break;
      case 'ArrowDown':
        nextRow = Math.min(maxRow, rowIndex + 1);
        break;
      case 'ArrowUp':
        nextRow = Math.max(0, rowIndex - 1);
        break;
      case 'ArrowRight':
        nextCol = Math.min(TABLE_EDITABLE_COL_COUNT - 1, colIndex + 1);
        break;
      case 'ArrowLeft':
        nextCol = Math.max(0, colIndex - 1);
        break;
      default:
        handled = false;
        break;
    }

    if (!handled) return;
    e.preventDefault();
    focusTableEditableCell(nextRow, nextCol);
  }, [isTableEditMode, filteredTableReports.length, TABLE_EDITABLE_COL_COUNT, focusTableEditableCell]);

  const normalizePastedDate = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

    const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
      const day = slashMatch[1].padStart(2, '0');
      const month = slashMatch[2].padStart(2, '0');
      const year = slashMatch[3];
      return `${year}-${month}-${day}`;
    }

    return trimmed;
  }, []);

  const handleApplyTablePaste = useCallback(() => {
    const rawLines = tablePasteInput
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);

    if (rawLines.length === 0) {
      toast({
        title: 'Sin datos para pegar',
        description: 'Pega filas copiadas desde Excel antes de aplicar.',
        variant: 'destructive'
      });
      return;
    }

    const nextDrafts: Record<number, Partial<EditFormData>> = {};

    rawLines.forEach((line, index) => {
      const report = filteredTableReports[index];
      if (!report) return;

      const cols = line.split('\t');
      nextDrafts[report.id] = {
        ...(tableDrafts[report.id] || {}),
        ...(cols[0] !== undefined ? { reportDate: normalizePastedDate(cols[0]) } : {}),
        ...(cols[1] !== undefined ? { refCode: cols[1].trim() } : {}),
        ...(cols[2] !== undefined ? { location: cols[2].trim() } : {}),
        ...(cols[3] !== undefined ? { clientName: cols[3].trim() } : {}),
        ...(cols[4] !== undefined ? { startTime: cols[4].trim() } : {}),
        ...(cols[5] !== undefined ? { endTime: cols[5].trim() } : {}),
        ...(cols[6] !== undefined ? { description: cols[6].trim() } : {}),
        ...(cols[7] !== undefined ? { notes: cols[7].trim() } : {})
      };
    });

    setTableDrafts(prev => ({
      ...prev,
      ...nextDrafts
    }));
    setShowTablePasteDialog(false);
    setTablePasteInput('');

    toast({
      title: 'Pegado aplicado',
      description: `Se cargaron datos en ${Object.keys(nextDrafts).length} fila(s).`
    });
  }, [tablePasteInput, filteredTableReports, tableDrafts, normalizePastedDate, toast]);

  const getTableUpdatesForReport = useCallback((reportId: number, explicitDraft?: Partial<EditFormData>) => {
    const draft = explicitDraft || tableDrafts[reportId];
    const original = filteredReports.find(r => r.id === reportId);

    if (!draft || !original) return {} as Partial<EditFormData>;

    const updates: Partial<EditFormData> = {};
    const fields: (keyof EditFormData)[] = [
      'reportDate',
      'refCode',
      'location',
      'startTime',
      'endTime',
      'description',
      'clientName',
      'notes'
    ];

    fields.forEach((field) => {
      const nextValue = draft[field];
      if (nextValue === undefined) return;

      const currentValue = (() => {
        switch (field) {
          case 'reportDate':
            return original.reportDate;
          case 'refCode':
            return original.refCode || '';
          case 'location':
            return original.location;
          case 'startTime':
            return original.startTime;
          case 'endTime':
            return original.endTime;
          case 'description':
            return original.description;
          case 'clientName':
            return original.clientName || '';
          case 'notes':
            return original.notes || '';
          default:
            return '';
        }
      })();

      if (nextValue !== currentValue) {
        updates[field] = nextValue;
      }
    });

    return updates;
  }, [tableDrafts, filteredReports]);

  const hasReportPendingChanges = useCallback((reportId: number) => {
    return Object.keys(getTableUpdatesForReport(reportId)).length > 0;
  }, [getTableUpdatesForReport]);

  const handleDiscardTableRowChanges = useCallback((reportId: number) => {
    setTableDrafts(prev => {
      const next = { ...prev };
      delete next[reportId];
      return next;
    });
  }, []);

  const handleSaveSingleTableRow = useCallback(async (reportId: number) => {
    const updates = getTableUpdatesForReport(reportId);
    if (Object.keys(updates).length === 0) return;

    setSavingTableRowIds(prev => {
      const next = new Set(prev);
      next.add(reportId);
      return next;
    });

    try {
      await apiRequest('PATCH', `/api/admin/work-reports/${reportId}`, updates);
      await queryClient.invalidateQueries({ queryKey: ['/api/admin/work-reports'], exact: false });
      setTableDrafts(prev => {
        const next = { ...prev };
        delete next[reportId];
        return next;
      });
      toast({ title: 'Fila guardada', description: 'Los cambios de la fila se han guardado.' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'No se pudo guardar la fila.',
        variant: 'destructive'
      });
    } finally {
      setSavingTableRowIds(prev => {
        const next = new Set(prev);
        next.delete(reportId);
        return next;
      });
    }
  }, [getTableUpdatesForReport, queryClient, toast]);

  const handleSaveTableChanges = useCallback(async () => {
    if (!hasTableChanges || isSavingTableChanges) return;

    setIsSavingTableChanges(true);
    try {
      const entries = Object.entries(tableDrafts);

      await Promise.all(
        entries.map(async ([id, draft]) => {
          const reportId = Number(id);
          const updates = getTableUpdatesForReport(reportId, draft);

          if (Object.keys(updates).length === 0) return;
          await apiRequest('PATCH', `/api/admin/work-reports/${reportId}`, updates);
        })
      );

      await queryClient.invalidateQueries({ queryKey: ['/api/admin/work-reports'], exact: false });
      setTableDrafts({});
      setIsTableEditMode(false);

      toast({
        title: 'Cambios guardados',
        description: 'La tabla se actualizó correctamente.'
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'No se pudieron guardar los cambios de la tabla.',
        variant: 'destructive'
      });
    } finally {
      setIsSavingTableChanges(false);
    }
  }, [hasTableChanges, isSavingTableChanges, tableDrafts, getTableUpdatesForReport, queryClient, toast]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (activeTab !== 'table' || !isTableEditMode) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (!isSavingTableChanges && hasTableChanges) {
          handleSaveTableChanges();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTab, isTableEditMode, isSavingTableChanges, hasTableChanges, handleSaveTableChanges]);

  const tableEmployeeTotals = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { locale: es });
    const weekEnd = endOfWeek(now, { locale: es });
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const summary = new Map<number, { employeeId: number; employeeName: string; weekMinutes: number; monthMinutes: number }>();

    filteredTableReports.forEach((report) => {
      const reportDate = parseISO(report.reportDate);
      const durationMinutes = getTableDurationMinutes(report);

      if (!summary.has(report.employeeId)) {
        summary.set(report.employeeId, {
          employeeId: report.employeeId,
          employeeName: report.employeeName,
          weekMinutes: 0,
          monthMinutes: 0
        });
      }

      const row = summary.get(report.employeeId)!;
      if (reportDate >= weekStart && reportDate <= weekEnd) {
        row.weekMinutes += durationMinutes;
      }
      if (reportDate >= monthStart && reportDate <= monthEnd) {
        row.monthMinutes += durationMinutes;
      }
    });

    return Array.from(summary.values()).sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'es'));
  }, [filteredTableReports, getTableDurationMinutes]);

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
          { id: 'grid', label: 'Cuadrante', icon: CalendarIcon },
          { id: 'table', label: 'Tabla Excel', icon: FileSpreadsheet }
        ]}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as 'list' | 'grid' | 'table')}
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
                        startTime: defaultReportTimes.startTime,
                        endTime: defaultReportTimes.endTime,
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
                {!isSelfAccessOnly && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowExportModal(true)}
                    className="flex items-center gap-2"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Exportar
                  </Button>
                )}
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
            <div className={`sm:hidden grid gap-2 ${isSelfAccessOnly ? 'grid-cols-1' : 'grid-cols-4'}`}>
              {!isSelfAccessOnly && (
                <Button 
                  size="sm" 
                  onClick={() => {
                    setSelectedEmployeeId('');
                    setCreateFormData({
                      reportDate: format(new Date(), 'yyyy-MM-dd'),
                      refCode: '',
                      location: '',
                      startTime: defaultReportTimes.startTime,
                      endTime: defaultReportTimes.endTime,
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
              {!isSelfAccessOnly && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowExportModal(true)}
                  className="flex items-center justify-center gap-1"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span className="text-xs">Exportar</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Collapsible Filters */}
        {showFilters && (
          <div className={`${FILTER_PANEL_CLASS} mb-4`}>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-end">
              <div className="flex flex-col space-y-2">
                <label className={FILTER_LABEL_CLASS}>Buscar</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Buscar por cód. ref., empleado, lugar, cliente, fecha, trabajo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={FILTER_SEARCH_INPUT_CLASS}
                    data-testid="input-admin-search-reports"
                  />
                </div>
              </div>
              {/* Employee filter - hidden in self-access mode */}
              {!isSelfAccessOnly && (
                <div className="flex flex-col space-y-2">
                  <label className={FILTER_LABEL_CLASS}>Empleado / Equipo</label>
                  <EmployeeScopeDropdown
                    employees={employees.map((employee) => ({ id: employee.id, fullName: employee.fullName }))}
                    teams={teams.map((team) => ({ id: team.id, name: team.name }))}
                    value={
                      teamFilter !== 'all'
                        ? { type: 'team', id: parseInt(teamFilter, 10) }
                        : employeeFilter !== 'all'
                          ? { type: 'employee', id: parseInt(employeeFilter, 10) }
                          : { type: 'all' }
                    }
                    onChange={(value) => {
                      if (value.type === 'all') {
                        setEmployeeFilter('all');
                        setTeamFilter('all');
                        return;
                      }

                      if (value.type === 'team') {
                        setTeamFilter(String(value.id));
                        setEmployeeFilter('all');
                        return;
                      }

                      setEmployeeFilter(String(value.id));
                      setTeamFilter('all');
                    }}
                    searchPlaceholder="Buscar empleado..."
                    buttonClassName={`w-full justify-between font-normal ${FILTER_SELECT_TRIGGER_CLASS}`}
                    contentClassName="w-[240px] p-0"
                  />
                </div>
              )}
              <div className="flex flex-col space-y-2">
                <label className={FILTER_LABEL_CLASS}>Período</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Select
                    value={dateFilter === 'month' ? format(currentMonth, 'yyyy-MM') : 'all'}
                    onValueChange={(value) => {
                      setActiveStatsFilter(null);
                      setEmployeeRotationIndex(-1);
                      setProjectRotationIndex(-1);
                      setSelectedDay(null);
                      setDisplayedCount(initialReportsCount);
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
                    <SelectTrigger className={`${FILTER_SELECT_TRIGGER_CLASS} text-xs`} aria-label="Seleccionar mes con partes">
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
                      setDisplayedCount(initialReportsCount);
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
                <label className={FILTER_LABEL_CLASS}>Proyecto (Cód. ref.)</label>
                <Select value={projectFilter} onValueChange={setProjectFilter}>
                  <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS} data-testid="select-project-filter">
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
          
          <InfiniteListFooter
            hasMore={hasMoreToDisplay}
            sentinelRef={loadMoreRef}
            onLoadMore={loadMoreReports}
            hintText={`Mostrando ${visibleReports.length} de ${filteredReports.length} partes`}
            doneText={
              filteredReports.length > initialReportsCount
                ? `Has visto todos los ${filteredReports.length} partes`
                : undefined
            }
          />
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

      {/* Vista de Tabla Editable */}
      {activeTab === 'table' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              {filteredTableReports.length} fila{filteredTableReports.length !== 1 ? 's' : ''} · Orden: {tableSort.direction === 'asc' ? 'ascendente' : 'descendente'}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 px-2 py-1 border rounded-md bg-background">
                <span className="text-xs text-muted-foreground">Zoom</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setTableZoom(prev => Math.max(70, prev - 10))}
                >
                  -
                </Button>
                <span className="text-xs font-medium min-w-[48px] text-center">{tableZoom}%</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setTableZoom(prev => Math.min(150, prev + 10))}
                >
                  +
                </Button>
              </div>
              <Button
                variant="outline"
                onClick={handleResetTableFilters}
              >
                Reset filtros
              </Button>
              <Button
                variant={isTableEditMode ? 'default' : 'outline'}
                onClick={() => {
                  if (isTableEditMode) {
                    setIsTableEditMode(false);
                    setTableDrafts({});
                    return;
                  }
                  setIsTableEditMode(true);
                }}
                className="flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                {isTableEditMode ? 'Salir edición' : 'Editar todas las celdas'}
              </Button>
              {isTableEditMode && (
                <Button
                  variant="outline"
                  onClick={() => setShowTablePasteDialog(true)}
                >
                  Pegar desde Excel
                </Button>
              )}
              {isTableEditMode && hasTableChanges && (
                <Button
                  variant="outline"
                  onClick={() => setTableDrafts({})}
                >
                  Deshacer pendientes
                </Button>
              )}
              {isTableEditMode && (
                <Button
                  onClick={handleSaveTableChanges}
                  disabled={!hasTableChanges || isSavingTableChanges}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  <Save className="w-4 h-4" />
                  {isSavingTableChanges ? 'Guardando...' : 'Guardar cambios'}
                </Button>
              )}
            </div>
          </div>
          {isTableEditMode && (
            <p className="text-xs text-muted-foreground">
              Atajos: flechas y Enter para moverte entre celdas, Ctrl+S para guardar todo. Doble clic en una cabecera para autoajustar ancho.
            </p>
          )}

          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
            <div
              ref={tableContainerRef}
              className="overflow-auto max-h-[70vh]"
              onWheel={handleTableWheelZoom}
            >
              <div
                style={{
                  transform: `scale(${tableZoom / 100})`,
                  transformOrigin: 'top left',
                  width: `${100 / (tableZoom / 100)}%`
                }}
              >
              <table className="w-full" style={{ minWidth: `${Object.values(tableColumnWidths).reduce((sum, width) => sum + width, 0)}px` }}>
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-20">
                  <tr>
                    {TABLE_COLUMNS.map((column) => {
                      const isSortable = column.sortable;
                      const isActiveSort = tableSort.key === column.key;

                      return (
                        <th
                          key={column.key}
                          className={`px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap ${column.key === 'reportDate' ? 'sticky left-0 z-30 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700' : ''}`}
                          style={{ width: `${tableColumnWidths[column.key]}px`, minWidth: `${tableColumnWidths[column.key]}px` }}
                          onDoubleClick={() => handleAutoFitColumn(column.key)}
                          title="Doble clic para autoajustar ancho"
                        >
                          {isSortable ? (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400"
                              onClick={() => handleTableSort(column.key as TableSortKey)}
                            >
                              <span>{column.label}</span>
                              <span className="text-xs">
                                {isActiveSort ? (tableSort.direction === 'asc' ? '▲' : '▼') : '↕'}
                              </span>
                            </button>
                          ) : (
                            <span>{column.label}</span>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                  <tr className="border-t border-gray-200 dark:border-gray-700">
                    <th className="px-2 py-2 sticky left-0 z-30 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
                      <Input
                        value={tableColumnFilters.reportDate}
                        onChange={(e) => setTableColumnFilters(prev => ({ ...prev, reportDate: e.target.value }))}
                        className="h-8 text-xs"
                        placeholder="Filtrar fecha"
                      />
                    </th>
                    <th className="px-2 py-2" style={{ width: `${tableColumnWidths.employeeName}px`, minWidth: `${tableColumnWidths.employeeName}px` }}>
                      <Input
                        value={tableColumnFilters.employeeName}
                        onChange={(e) => setTableColumnFilters(prev => ({ ...prev, employeeName: e.target.value }))}
                        className="h-8 text-xs"
                        placeholder="Filtrar empleado"
                      />
                    </th>
                    <th className="px-2 py-2" style={{ width: `${tableColumnWidths.refCode}px`, minWidth: `${tableColumnWidths.refCode}px` }}>
                      <Input
                        value={tableColumnFilters.refCode}
                        onChange={(e) => setTableColumnFilters(prev => ({ ...prev, refCode: e.target.value }))}
                        className="h-8 text-xs"
                        placeholder="Filtrar código"
                      />
                    </th>
                    <th className="px-2 py-2" style={{ width: `${tableColumnWidths.location}px`, minWidth: `${tableColumnWidths.location}px` }}>
                      <Input
                        value={tableColumnFilters.location}
                        onChange={(e) => setTableColumnFilters(prev => ({ ...prev, location: e.target.value }))}
                        className="h-8 text-xs"
                        placeholder="Filtrar ubicación"
                      />
                    </th>
                    <th className="px-2 py-2" style={{ width: `${tableColumnWidths.clientName}px`, minWidth: `${tableColumnWidths.clientName}px` }}>
                      <Input
                        value={tableColumnFilters.clientName}
                        onChange={(e) => setTableColumnFilters(prev => ({ ...prev, clientName: e.target.value }))}
                        className="h-8 text-xs"
                        placeholder="Filtrar cliente"
                      />
                    </th>
                    <th className="px-2 py-2" style={{ width: `${tableColumnWidths.startTime}px`, minWidth: `${tableColumnWidths.startTime}px` }} />
                    <th className="px-2 py-2" style={{ width: `${tableColumnWidths.endTime}px`, minWidth: `${tableColumnWidths.endTime}px` }} />
                    <th className="px-2 py-2" style={{ width: `${tableColumnWidths.durationMinutes}px`, minWidth: `${tableColumnWidths.durationMinutes}px` }} />
                    <th className="px-2 py-2" style={{ width: `${tableColumnWidths.status}px`, minWidth: `${tableColumnWidths.status}px` }}>
                      <Select
                        value={tableColumnFilters.status}
                        onValueChange={(value) => setTableColumnFilters(prev => ({ ...prev, status: value as 'all' | 'draft' | 'submitted' }))}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Estado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="draft">Borrador</SelectItem>
                          <SelectItem value="submitted">Enviado</SelectItem>
                        </SelectContent>
                      </Select>
                    </th>
                    <th className="px-2 py-2" style={{ width: `${tableColumnWidths.description}px`, minWidth: `${tableColumnWidths.description}px` }} />
                    <th className="px-2 py-2" style={{ width: `${tableColumnWidths.notes}px`, minWidth: `${tableColumnWidths.notes}px` }} />
                    <th className="px-2 py-2" style={{ width: `${tableColumnWidths.actions}px`, minWidth: `${tableColumnWidths.actions}px` }} />
                  </tr>
                </thead>
                <tbody>
                  {filteredTableReports.map((report, rowIndex) => {
                    const rowStatusStyle = STATUS_STYLES[report.status];
                    const rowHasPendingChanges = hasReportPendingChanges(report.id);
                    const isSavingRow = savingTableRowIds.has(report.id);
                    return (
                      <tr key={report.id} className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/80 dark:hover:bg-gray-800/40 align-top ${rowHasPendingChanges ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''}`}>
                        <td className={`sticky left-0 z-10 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 ${isTableEditMode ? 'p-0' : 'px-3 py-2'}`} style={{ width: `${tableColumnWidths.reportDate}px`, minWidth: `${tableColumnWidths.reportDate}px` }}>
                          {isTableEditMode ? (
                            <input
                              type="date"
                              value={getDraftOrOriginalValue(report, 'reportDate')}
                              onChange={(e) => updateTableDraft(report.id, 'reportDate', e.target.value)}
                              onKeyDown={(e) => handleTableCellKeyDown(e, rowIndex, 0)}
                              data-table-cell="true"
                              data-table-row={rowIndex}
                              data-table-col={0}
                              className="w-full min-h-[42px] border-0 bg-transparent rounded-none px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          ) : (
                            format(parseISO(report.reportDate), 'dd/MM/yyyy')
                          )}
                        </td>
                        <td className="px-3 py-2 font-medium whitespace-normal break-words" style={{ width: `${tableColumnWidths.employeeName}px`, minWidth: `${tableColumnWidths.employeeName}px` }}>{report.employeeName}</td>
                        <td className={isTableEditMode ? 'p-0' : 'px-3 py-2'} style={{ width: `${tableColumnWidths.refCode}px`, minWidth: `${tableColumnWidths.refCode}px` }}>
                          {isTableEditMode ? (
                            <input
                              value={getDraftOrOriginalValue(report, 'refCode')}
                              onChange={(e) => updateTableDraft(report.id, 'refCode', e.target.value)}
                              onKeyDown={(e) => handleTableCellKeyDown(e, rowIndex, 1)}
                              data-table-cell="true"
                              data-table-row={rowIndex}
                              data-table-col={1}
                              className="w-full min-h-[42px] border-0 bg-transparent rounded-none px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Sin código"
                            />
                          ) : (
                            <span>{report.refCode || '-'}</span>
                          )}
                        </td>
                        <td className={isTableEditMode ? 'p-0' : 'px-3 py-2'} style={{ width: `${tableColumnWidths.location}px`, minWidth: `${tableColumnWidths.location}px` }}>
                          {isTableEditMode ? (
                            <input
                              value={getDraftOrOriginalValue(report, 'location')}
                              onChange={(e) => updateTableDraft(report.id, 'location', e.target.value)}
                              onKeyDown={(e) => handleTableCellKeyDown(e, rowIndex, 2)}
                              data-table-cell="true"
                              data-table-row={rowIndex}
                              data-table-col={2}
                              className="w-full min-h-[42px] border-0 bg-transparent rounded-none px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          ) : (
                            <span className="whitespace-normal break-words">{report.location}</span>
                          )}
                        </td>
                        <td className={isTableEditMode ? 'p-0' : 'px-3 py-2'} style={{ width: `${tableColumnWidths.clientName}px`, minWidth: `${tableColumnWidths.clientName}px` }}>
                          {isTableEditMode ? (
                            <input
                              value={getDraftOrOriginalValue(report, 'clientName')}
                              onChange={(e) => updateTableDraft(report.id, 'clientName', e.target.value)}
                              onKeyDown={(e) => handleTableCellKeyDown(e, rowIndex, 3)}
                              data-table-cell="true"
                              data-table-row={rowIndex}
                              data-table-col={3}
                              className="w-full min-h-[42px] border-0 bg-transparent rounded-none px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Sin cliente"
                            />
                          ) : (
                            <span>{report.clientName || '-'}</span>
                          )}
                        </td>
                        <td className={isTableEditMode ? 'p-0' : 'px-3 py-2'} style={{ width: `${tableColumnWidths.startTime}px`, minWidth: `${tableColumnWidths.startTime}px` }}>
                          {isTableEditMode ? (
                            <input
                              type="time"
                              value={getDraftOrOriginalValue(report, 'startTime')}
                              onChange={(e) => updateTableDraft(report.id, 'startTime', e.target.value)}
                              onKeyDown={(e) => handleTableCellKeyDown(e, rowIndex, 4)}
                              data-table-cell="true"
                              data-table-row={rowIndex}
                              data-table-col={4}
                              className="w-full min-h-[42px] border-0 bg-transparent rounded-none px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          ) : (
                            <span>{report.startTime.slice(0, 5)}</span>
                          )}
                        </td>
                        <td className={isTableEditMode ? 'p-0' : 'px-3 py-2'} style={{ width: `${tableColumnWidths.endTime}px`, minWidth: `${tableColumnWidths.endTime}px` }}>
                          {isTableEditMode ? (
                            <input
                              type="time"
                              value={getDraftOrOriginalValue(report, 'endTime')}
                              onChange={(e) => updateTableDraft(report.id, 'endTime', e.target.value)}
                              onKeyDown={(e) => handleTableCellKeyDown(e, rowIndex, 5)}
                              data-table-cell="true"
                              data-table-row={rowIndex}
                              data-table-col={5}
                              className="w-full min-h-[42px] border-0 bg-transparent rounded-none px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          ) : (
                            <span>{report.endTime.slice(0, 5)}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-semibold text-blue-700 dark:text-blue-300 whitespace-nowrap" style={{ width: `${tableColumnWidths.durationMinutes}px`, minWidth: `${tableColumnWidths.durationMinutes}px` }}>
                          {formatDuration(getTableDurationMinutes(report))}
                        </td>
                        <td className="px-3 py-2" style={{ width: `${tableColumnWidths.status}px`, minWidth: `${tableColumnWidths.status}px` }}>
                          <Badge className={`${rowStatusStyle.bg} ${rowStatusStyle.border} ${rowStatusStyle.text} border`}>
                            {rowStatusStyle.label}
                          </Badge>
                        </td>
                        <td className={`${isTableEditMode ? 'p-0' : 'px-3 py-2'}`} style={{ width: `${tableColumnWidths.description}px`, minWidth: `${tableColumnWidths.description}px` }}>
                          {isTableEditMode ? (
                            <textarea
                              value={getDraftOrOriginalValue(report, 'description')}
                              onChange={(e) => updateTableDraft(report.id, 'description', e.target.value)}
                              data-table-cell="true"
                              data-table-row={rowIndex}
                              data-table-col={6}
                              className="w-full min-h-[92px] border-0 bg-transparent rounded-none px-2 py-1 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          ) : (
                            <span className="whitespace-normal break-words text-sm text-gray-700 dark:text-gray-300">{report.description}</span>
                          )}
                        </td>
                        <td className={`${isTableEditMode ? 'p-0' : 'px-3 py-2'}`} style={{ width: `${tableColumnWidths.notes}px`, minWidth: `${tableColumnWidths.notes}px` }}>
                          {isTableEditMode ? (
                            <textarea
                              value={getDraftOrOriginalValue(report, 'notes')}
                              onChange={(e) => updateTableDraft(report.id, 'notes', e.target.value)}
                              data-table-cell="true"
                              data-table-row={rowIndex}
                              data-table-col={7}
                              className="w-full min-h-[92px] border-0 bg-transparent rounded-none px-2 py-1 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Sin notas"
                            />
                          ) : (
                            <span className="whitespace-normal break-words text-sm text-gray-600 dark:text-gray-400">{report.notes || '-'}</span>
                          )}
                        </td>
                        <td className="px-3 py-2" style={{ width: `${tableColumnWidths.actions}px`, minWidth: `${tableColumnWidths.actions}px` }}>
                          {isTableEditMode ? (
                            <div className="flex items-center gap-1.5">
                              <Button
                                size="sm"
                                onClick={() => handleSaveSingleTableRow(report.id)}
                                disabled={!rowHasPendingChanges || isSavingRow}
                                className="h-8"
                              >
                                {isSavingRow ? 'Guardando...' : 'Guardar fila'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDiscardTableRowChanges(report.id)}
                                disabled={!rowHasPendingChanges || isSavingRow}
                                className="h-8"
                              >
                                Descartar
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          </div>

          <Dialog open={showTablePasteDialog} onOpenChange={setShowTablePasteDialog}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Pegar desde Excel</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Orden de columnas esperado por fila: Fecha, Cód. Ref., Ubicación, Cliente, Inicio, Fin, Trabajo, Notas.
                </p>
                <p className="text-sm text-muted-foreground">
                  Se aplicará sobre las filas visibles y en el orden actual de la tabla.
                </p>
                <Textarea
                  value={tablePasteInput}
                  onChange={(e) => setTablePasteInput(e.target.value)}
                  className="min-h-[220px]"
                  placeholder="Pega aquí filas copiadas desde Excel (tabuladas)"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowTablePasteDialog(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleApplyTablePaste}>Aplicar pegado</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">Recuentos por empleado (semana y mes actual)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">Empleado</th>
                    <th className="px-4 py-2 text-left font-semibold">Total Semana</th>
                    <th className="px-4 py-2 text-left font-semibold">Total Mes</th>
                  </tr>
                </thead>
                <tbody>
                  {tableEmployeeTotals.map((row) => (
                    <tr key={row.employeeId} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="px-4 py-2 font-medium">{row.employeeName}</td>
                      <td className="px-4 py-2 text-blue-700 dark:text-blue-300 font-semibold">{formatDuration(row.weekMinutes)}</td>
                      <td className="px-4 py-2 text-green-700 dark:text-green-300 font-semibold">{formatDuration(row.monthMinutes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal de exportacion masiva */}
      <Dialog
        open={showExportModal}
        onOpenChange={(open) => {
          if (!open) {
            resetExportModalState();
            return;
          }
          setShowExportModal(true);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white">
              <FileSpreadsheet className="w-5 h-5 text-green-600" />
              Exportar Partes de Trabajo
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium mb-2 block">Rango de fechas</label>
              <DatePickerPeriod
                startDate={exportStartDate}
                endDate={exportEndDate}
                onStartDateChange={setExportStartDate}
                onEndDateChange={setExportEndDate}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Seleccionar trabajadores con partes</label>
              <div className="border rounded-lg p-4 max-h-64 overflow-y-auto space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    id="select-all-work-report-employees"
                    checked={
                      exportEmployeesOptions.length > 0 &&
                      exportSelectedEmployees.length === exportEmployeesOptions.length
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        setExportSelectedEmployees(exportEmployeesOptions.map((employee) => employee.id));
                      } else {
                        setExportSelectedEmployees([]);
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="select-all-work-report-employees" className="text-sm font-medium">
                    Seleccionar todos ({exportEmployeesOptions.length})
                  </label>
                </div>

                {exportRangeReportsLoading ? (
                  <p className="text-sm text-muted-foreground">Cargando trabajadores con partes...</p>
                ) : exportEmployeesOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay trabajadores con partes en el periodo seleccionado.</p>
                ) : (
                  exportEmployeesOptions.map((employee) => (
                    <div key={employee.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`export-worker-${employee.id}`}
                        checked={exportSelectedEmployees.includes(employee.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setExportSelectedEmployees((previous) => [...previous, employee.id]);
                          } else {
                            setExportSelectedEmployees((previous) => previous.filter((id) => id !== employee.id));
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor={`export-worker-${employee.id}`} className="text-sm flex items-center gap-2 cursor-pointer">
                        <UserAvatar
                          userId={employee.id}
                          fullName={employee.name}
                          profilePicture={employee.profilePicture}
                          size="sm"
                        />
                        {employee.name}
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Formato de exportación</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={exportFormat === 'excel' ? 'default' : 'outline'}
                  onClick={() => setExportFormat('excel')}
                  className={exportFormat === 'excel' ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Excel
                </Button>
                <Button
                  type="button"
                  variant={exportFormat === 'pdf' ? 'default' : 'outline'}
                  onClick={() => setExportFormat('pdf')}
                  className={exportFormat === 'pdf' ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  PDF
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={resetExportModalState}
                disabled={isExportingExcel}
              >
                Cancelar
              </Button>
              <Button
                onClick={exportFormat === 'pdf' ? handleExportWorkReportsPdf : handleExportWorkReportsExcel}
                disabled={
                  isExportingExcel ||
                  !exportStartDate ||
                  !exportEndDate ||
                  exportSelectedEmployees.length === 0
                }
                className={exportFormat === 'pdf' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}
              >
                {isExportingExcel ? (
                  <>
                    <LoadingSpinner size="xs" className="mr-2" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    {exportFormat === 'pdf' ? 'PDF' : 'Excel'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de visualización del parte */}
      <Dialog
        open={viewModalOpen}
        onOpenChange={(open) => {
          setViewModalOpen(open);
          if (!open) {
            setIsViewModalEditMode(false);
            setSelectedReport(null);
          }
        }}
      >
        <DialogContent showCloseButton={false} className="w-[96vw] md:w-[92vw] max-w-6xl max-h-[92vh] overflow-y-auto lg:overflow-hidden bg-white dark:bg-gray-900 p-0">
          <ModalHeaderWithActions
            title="Parte de Trabajo"
            icon={<FileText className="w-5 h-5 text-blue-600" />}
            className="px-5 md:px-6 py-2 border-gray-200 dark:border-gray-700"
            titleClassName="text-xl font-bold text-gray-900 dark:text-white"
            actions={selectedReport ? (
              <>
                  <ModalActionButton
                    intent="download"
                    onClick={() => handleDownloadPdf(selectedReport)}
                    disabled={isDownloadingPdf === selectedReport.id}
                    title="Descargar PDF"
                  >
                    <Download />
                  </ModalActionButton>

                  {!isSelfAccessOnly && (
                    <ModalActionButton
                      intent="edit"
                      onClick={() => {
                        setIsViewModalEditMode(true);
                        handleEditReport(selectedReport);
                      }}
                      title="Editar parte"
                    >
                      <Edit />
                    </ModalActionButton>
                  )}

                  {!isSelfAccessOnly && (
                    <ModalActionButton
                      intent="delete"
                      onClick={() => handleDeleteReport(selectedReport)}
                      disabled={deleteReportMutation.isPending}
                      title="Eliminar parte"
                    >
                      <Trash2 />
                    </ModalActionButton>
                  )}

                  <ModalActionButton
                    intent="neutral"
                    onClick={() => setViewModalOpen(false)}
                    title="Cerrar modal"
                  >
                    <X />
                  </ModalActionButton>
              </>
            ) : undefined}
          />
          
          {selectedReport && (
            <div className="px-5 md:px-6 py-3 space-y-4 lg:space-y-0 lg:grid lg:grid-cols-12 lg:gap-4 lg:h-[calc(92vh-190px)]">
              <div className="space-y-4 lg:col-span-7">
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
                      <CalendarIcon className="w-4 h-4" />
                      Fecha
                    </div>
                    <p className="text-gray-900 dark:text-white font-medium capitalize text-sm lg:text-base">
                      {format(parseISO(selectedReport.reportDate), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
                    </p>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
                      <Clock className="w-4 h-4" />
                      Horario
                    </div>
                    <p className="text-gray-900 dark:text-white font-medium text-sm lg:text-base">
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
                    <p className="text-gray-900 dark:text-white font-medium text-sm lg:text-base">{selectedReport.location}</p>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
                      <User className="w-4 h-4" />
                      Cliente
                    </div>
                    <p className="text-gray-900 dark:text-white font-medium text-sm lg:text-base">
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
                  <p className="text-gray-900 dark:text-white whitespace-pre-wrap text-sm lg:text-base">{selectedReport.description}</p>
                </div>
              </div>

              <div className="space-y-4 lg:col-span-5">
                {/* Notas */}
                {selectedReport.notes && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border-l-4 border-amber-400">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      <span className="font-medium">Notas:</span> {selectedReport.notes}
                    </p>
                  </div>
                )}

                {/* Sección de firmas */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Pen className="w-4 h-4" />
                    Firmas
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Firma del empleado */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Firma del empleado</p>
                      {selectedReport.employeeSignature ? (
                        <img 
                          src={selectedReport.employeeSignature} 
                          alt="Firma del empleado" 
                          className="max-h-16 w-auto mx-auto dark:invert dark:brightness-90"
                        />
                      ) : (
                        <div className="h-16 flex items-center justify-center">
                          <span className="text-gray-400 text-xs">Sin firma</span>
                        </div>
                      )}
                      <p className="text-center text-xs text-gray-600 dark:text-gray-400 mt-2">{selectedReport.employeeName}</p>
                    </div>

                    {/* Firma del cliente */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Firma del cliente</p>
                      {selectedReport.signatureImage ? (
                        <img 
                          src={selectedReport.signatureImage} 
                          alt="Firma del cliente" 
                          className="max-h-16 w-auto mx-auto dark:invert dark:brightness-90"
                        />
                      ) : (
                        <div className="h-16 flex items-center justify-center">
                          <span className="text-gray-400 text-xs">Sin firma</span>
                        </div>
                      )}
                      <p className="text-center text-xs text-gray-600 dark:text-gray-400 mt-2">
                        {selectedReport.signedBy || 'Cliente'}
                      </p>
                    </div>
                  </div>
                </div>
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
            setEditingReport(null);
          }
        }}
      >
        <DialogContent showCloseButton={false} className="max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 p-0">
          <ModalHeaderWithActions
            title="Editar Parte de Trabajo"
            icon={<Edit className="w-5 h-5 text-blue-600" />}
            className="px-5 md:px-6 border-gray-200 dark:border-gray-700 pb-4"
            titleClassName="text-xl font-bold text-gray-900 dark:text-white"
            actions={(
              <>
                {editingReport && (
                  <ModalActionButton
                    intent="save"
                    onClick={handleSaveEdit}
                    disabled={updateReportMutation.isPending}
                    title={updateReportMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
                  >
                    <Save />
                  </ModalActionButton>
                )}
                <ModalActionButton
                  intent="neutral"
                  onClick={() => setEditModalOpen(false)}
                  title="Cerrar modal"
                >
                  <X />
                </ModalActionButton>
              </>
            )}
          />
          
          {editingReport && (
            <div className="px-5 md:px-6 py-4 space-y-4">
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

            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(reportToDelete)} onOpenChange={(open) => !open && setReportToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar parte de trabajo?</AlertDialogTitle>
            <AlertDialogDescription>
              {reportToDelete ? (
                <>
                  Se eliminará el parte de <strong>{reportToDelete.employeeName}</strong> del día{' '}
                  <strong>{format(parseISO(reportToDelete.reportDate), 'dd/MM/yyyy')}</strong>.
                  Esta acción no se puede deshacer.
                </>
              ) : (
                'Esta acción no se puede deshacer.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setReportToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (!reportToDelete) return;
                deleteReportMutation.mutate(reportToDelete.id);
                setReportToDelete(null);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
