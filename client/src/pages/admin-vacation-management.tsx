import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { usePageTitle } from '@/hooks/use-page-title';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DatePickerPeriod } from "@/components/ui/date-picker";
import { CalendarDays, Users, MapPin, Plus, Check, X, Clock, Plane, Edit, MessageSquare, RotateCcw, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Calendar, User, Baby, Heart, Home, Briefcase, GraduationCap, Stethoscope, AlertCircle, FileText, Download, GanttChart, Upload, Paperclip, Thermometer, Eye, Trash2 } from "lucide-react";
import { DocumentPreviewModal } from "@/components/DocumentPreviewModal";
import { Label } from "@/components/ui/label";
import { SelectGroup, SelectLabel, SelectSeparator } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, differenceInDays, parseISO, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval, startOfDay, differenceInCalendarDays, addDays, isSameDay, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";
import { getAuthData, refreshAccessToken } from "@/lib/auth";
import { logger } from '@/lib/logger';
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ListLoadingState } from "@/components/ui/list-loading-state";
import { ListEmptyState } from "@/components/ui/list-empty-state";
import StatsCard, { StatsCardGrid } from "@/components/StatsCard";
import { useAuth } from "@/hooks/use-auth";
import { usePageHeader } from '@/components/layout/page-header';
import { TabNavigation } from "@/components/ui/tab-navigation";
import { UserAvatar } from "@/components/ui/user-avatar";
import { formatInMadridTime, formatVacationDatesShort, formatVacationPeriod, parseDateOnlyLocal } from "@/utils/dateUtils";
import { getSpanishNationalHolidays, getHolidaysForDateRange } from "@/utils/spanishHolidays";
import { useTeams, resolveTeamMemberIds } from '@/hooks/use-teams';
import { EmployeeScopeDropdown } from '@/components/ui/employee-scope-dropdown';
import { useStandardInfiniteScroll } from '@/hooks/use-standard-infinite-scroll';
import { useIsMobile } from '@/hooks/use-mobile';

interface VacationRequest {
  id: number | string;
  userId: number;
  startDate: string;
  endDate: string;
  days: number;
  reason?: string;
  status: 'pending' | 'approved' | 'denied';
  requestDate: string;
  absenceType?: string;
  attachmentPath?: string;
  createdAt?: string;
  user?: {
    fullName: string;
    email: string;
  };
  // Hour-based absence fields
  isHourBased?: boolean;
  hoursStart?: number;
  hoursEnd?: number;
  totalHours?: number;
  absenceDate?: string;
  adminComment?: string;
  reviewedBy?: number;
  reviewedAt?: string;
  autoApprove?: boolean;
  assignedByAdmin?: boolean;
}

const ABSENCE_TYPE_ICONS: Record<string, any> = {
  vacation: Plane,
  maternity_paternity: Baby,
  marriage: Heart,
  bereavement: Home,
  moving: Home,
  medical_appointment: Stethoscope,
  public_duty: Briefcase,
  training: GraduationCap,
  temporary_disability: Stethoscope,
  adverse_weather: AlertCircle,
  personal_leave: FileText,
  family_illness: Stethoscope,
  family_illness_travel: Stethoscope,
};

const ABSENCE_TYPE_LABELS: Record<string, string> = {
  vacation: 'Vacaciones',
  maternity_paternity: 'Maternidad / Paternidad',
  marriage: 'Matrimonio',
  bereavement: 'Fallecimiento familiar',
  moving: 'Mudanza',
  medical_appointment: 'Cita médica',
  public_duty: 'Deber público',
  training: 'Formación',
  temporary_disability: 'Baja médica',
  adverse_weather: 'Inclemencia del tiempo',
  personal_leave: 'Asuntos propios',
  family_illness: 'Enfermedad grave familiar',
  family_illness_travel: 'Enfermedad grave familiar (con desplazamiento)',
};

const ABSENCE_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  vacation: { bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' },
  maternity_paternity: { bg: 'bg-pink-50 dark:bg-pink-950/40', text: 'text-pink-700 dark:text-pink-300', border: 'border-pink-200 dark:border-pink-800' },
  marriage: { bg: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-800' },
  bereavement: { bg: 'bg-slate-50 dark:bg-slate-950/40', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-200 dark:border-slate-800' },
  moving: { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' },
  medical_appointment: { bg: 'bg-teal-50 dark:bg-teal-950/40', text: 'text-teal-700 dark:text-teal-300', border: 'border-teal-200 dark:border-teal-800' },
  public_duty: { bg: 'bg-indigo-50 dark:bg-indigo-950/40', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-800' },
  training: { bg: 'bg-violet-50 dark:bg-violet-950/40', text: 'text-violet-700 dark:text-violet-300', border: 'border-violet-200 dark:border-violet-800' },
  temporary_disability: { bg: 'bg-red-50 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-300', border: 'border-red-200 dark:border-red-800' },
  adverse_weather: { bg: 'bg-yellow-50 dark:bg-yellow-950/40', text: 'text-yellow-700 dark:text-yellow-300', border: 'border-yellow-200 dark:border-yellow-800' },
  personal_leave: { bg: 'bg-gray-50 dark:bg-gray-950/40', text: 'text-gray-700 dark:text-gray-300', border: 'border-gray-200 dark:border-gray-800' },
  family_illness: { bg: 'bg-orange-50 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800' },
  family_illness_travel: { bg: 'bg-orange-50 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800' },
};

const AUTH_ERROR_REGEX = /invalid or expired token|token invalido o expirado|token inválido o expirado/i;

async function fetchWithUserTokenRefresh(url: string, init: RequestInit): Promise<Response> {
  const doFetch = async (token: string | null | undefined) => {
    const headers = new Headers(init.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    return fetch(url, {
      ...init,
      headers,
      credentials: 'include',
    });
  };

  const currentToken = getAuthData()?.token;
  let response = await doFetch(currentToken);

  if (response.status === 401 || response.status === 403) {
    const errorText = await response.clone().text();
    if (AUTH_ERROR_REGEX.test(errorText)) {
      const refreshedToken = await refreshAccessToken();
      if (refreshedToken) {
        response = await doFetch(refreshedToken);
      }
    }
  }

  return response;
}

interface Employee {
  id: number;
  fullName: string;
  totalVacationDays: string;
  usedVacationDays: string;
  status: string;
  profilePicture?: string | null;
}

interface Holiday {
  id?: number;
  name: string;
  date: string;
  type: 'national' | 'regional' | 'local';
  region?: string;
}

interface AbsencePolicy {
  id: number;
  companyId: number;
  absenceType: string;
  name: string;
  maxDays: number | null;
  requiresAttachment: boolean;
  recoveryPercentage?: number | null;
  isActive: boolean;
}

interface CompanyConfig {
  vacationCutoffDay?: string; // MM-DD
  workingHoursPerDay?: number | string;
}

// Dynamic Spanish national holidays - generates intelligently based on current date
const getSpanishHolidays = (): Holiday[] => {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-11
  
  // Si estamos en los últimos 3 meses del año (octubre, noviembre, diciembre),
  // mostrar festivos del año actual y siguiente
  if (currentMonth >= 9) { // October (9) or later
    return [
      ...getSpanishNationalHolidays(currentYear),
      ...getSpanishNationalHolidays(currentYear + 1),
    ];
  }
  
  // Para el resto del año, solo mostrar festivos del año actual
  return getSpanishNationalHolidays(currentYear);
};

const spanishHolidays: Holiday[] = getSpanishHolidays();

const regions = [
  "Andalucía", "Aragón", "Asturias", "Baleares", "Canarias", "Cantabria",
  "Castilla-La Mancha", "Castilla y León", "Cataluña", "Extremadura",
  "Galicia", "Madrid", "Murcia", "Navarra", "País Vasco", "La Rioja", "Valencia"
];

const cutoffMonths = [
  { value: '01', label: 'Enero' },
  { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' },
  { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
];

export default function VacationManagement() {
  usePageTitle('Gestión de Ausencias');
  const { company, user } = useAuth();
  const { setHeader, resetHeader } = usePageHeader();

  // Set page header
  useEffect(() => {
    setHeader({
      title: 'Gestión de Ausencias',
      subtitle: 'Gestiona solicitudes de ausencias y empleados'
    });
    return resetHeader;
  }, []);
  const [activeTab, setActiveTab] = useState("employees");
  const isMobile = useIsMobile();
  const REQUESTS_PER_LOAD = isMobile ? 8 : 14;
  const [displayedCurrentRequestsCount, setDisplayedCurrentRequestsCount] = useState(REQUESTS_PER_LOAD);
  const [displayedPreviousRequestsCount, setDisplayedPreviousRequestsCount] = useState(REQUESTS_PER_LOAD);
  const EMPLOYEES_PER_LOAD = isMobile ? 10 : 20;
  const [displayedTimelineEmployeesCount, setDisplayedTimelineEmployeesCount] = useState(EMPLOYEES_PER_LOAD);
  const loadMoreCurrentRequestsRef = useRef<HTMLDivElement | null>(null);
  const loadMorePreviousRequestsRef = useRef<HTMLDivElement | null>(null);
  const loadMoreTimelineDesktopRef = useRef<HTMLDivElement | null>(null);
  const loadMoreTimelineMobileRef = useRef<HTMLDivElement | null>(null);
  const [selectedStatus, setSelectedStatus] = useState("pending");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("all");
  const [selectedTeamId, setSelectedTeamId] = useState("all");
  const [selectedAbsenceType, setSelectedAbsenceType] = useState("all");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [newHoliday, setNewHoliday] = useState<{ name: string; startDate: Date | null; endDate: Date | null; type: 'national' | 'regional' | 'local' }>({ name: "", startDate: null, endDate: null, type: "regional" });
  const [showAddHoliday, setShowAddHoliday] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<VacationRequest | null>(null);
  const [deleteRequestConfirm, setDeleteRequestConfirm] = useState<VacationRequest | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [modalAction, setModalAction] = useState<'approve' | 'deny' | 'edit' | 'revert'>('approve');
  const [editDates, setEditDates] = useState({ startDate: null as Date | null, endDate: null as Date | null });
  const [adminComment, setAdminComment] = useState("");
  
  // Estados para nueva solicitud de manager/admin
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [newRequestDates, setNewRequestDates] = useState({ startDate: null as Date | null, endDate: null as Date | null });
  const [newRequestReason, setNewRequestReason] = useState("");
  const [newRequestAbsenceType, setNewRequestAbsenceType] = useState<string>('vacation');
  const [newRequestAttachment, setNewRequestAttachment] = useState<File | null>(null);
  const [uploadingNewRequestAttachment, setUploadingNewRequestAttachment] = useState(false);
  const [newRequestCalendarDate, setNewRequestCalendarDate] = useState(new Date());
  const [newRequestHoverDate, setNewRequestHoverDate] = useState<Date | null>(null);
  const [newRequestSelectedUserIds, setNewRequestSelectedUserIds] = useState<number[]>([]);
  const [newRequestEmployeeSearch, setNewRequestEmployeeSearch] = useState("");
  const [newRequestAutoApprove, setNewRequestAutoApprove] = useState(true);
  const [newRequestDeductFromVacation, setNewRequestDeductFromVacation] = useState(true);
  
  // Hour-based absence mode - nuevo sistema integrado
  const [newRequestIsFullDay, setNewRequestIsFullDay] = useState(true); // true = dia completo, false = horas específicas
  const [newRequestHoursStart, setNewRequestHoursStart] = useState<string>('09:00');
  const [newRequestHoursEnd, setNewRequestHoursEnd] = useState<string>('17:00');
  
  // Estados para el timeline de vacaciones (pestaña empleados)
  const [timelineViewDate, setTimelineViewDate] = useState(new Date());
  const [timelineViewMode, setTimelineViewMode] = useState<'week' | 'month' | 'quarter'>('month');
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [adverseHoursDialogEmployeeId, setAdverseHoursDialogEmployeeId] = useState<number | null>(null);
  const [absenceModalPeriod, setAbsenceModalPeriod] = useState<'current' | 'previous'>('current');
  
  // Estados para exportación de informe
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportSelectedEmployees, setExportSelectedEmployees] = useState<number[]>([]);
  const [exportStartMonth, setExportStartMonth] = useState<string>('');

  const { data: teams = [] } = useTeams(!!user && (user.role === 'admin' || user.role === 'manager'));
  const [exportEndMonth, setExportEndMonth] = useState<string>('');
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  
  // Estados para swipe en móvil
  const [touchStartX, setTouchStartX] = useState<number>(0);
  const [touchStartY, setTouchStartY] = useState<number>(0);
  const [isSwiping, setIsSwiping] = useState(false);
  
  // Estado para vista previa de documentos
  const [previewDoc, setPreviewDoc] = useState<{ url: string; filename: string } | null>(null);

  // Corte de vacaciones configurable
  const [vacationCutoffMonth, setVacationCutoffMonth] = useState('01');
  const [vacationCutoffDay, setVacationCutoffDay] = useState('31');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const search = useSearch();

  // Read query params from URL to configure initial state (for AI navigation)
  useEffect(() => {
    const searchParams = new URLSearchParams(search);
    const tabParam = searchParams.get('tab');
    const statusParam = searchParams.get('status');
    
    if (tabParam && ['employees', 'requests', 'holidays'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
    
    if (statusParam && ['all', 'pending', 'approved', 'denied'].includes(statusParam)) {
      setSelectedStatus(statusParam);
    }
  }, [search]);

  // Cerrar tooltip al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeTooltip) {
        const target = event.target as Element;
        // Solo cerrar si no es un clic en el tooltip o en una barra de vacaciones
        if (!target.closest('[data-vacation-bar]') && !target.closest('[data-vacation-tooltip]')) {
          setActiveTooltip(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeTooltip]);

  useEffect(() => {
    if (adverseHoursDialogEmployeeId !== null) {
      setAbsenceModalPeriod('current');
    }
  }, [adverseHoursDialogEmployeeId]);

  // Set initial region based on company province
  useEffect(() => {
    if (company?.province && !selectedRegion) {
      // Map company province to region
      const provinceToRegion: { [key: string]: string } = {
        'sevilla': 'Andalucía',
        'cordoba': 'Andalucía', 
        'cadiz': 'Andalucía',
        'malaga': 'Andalucía',
        'granada': 'Andalucía',
        'almeria': 'Andalucía',
        'huelva': 'Andalucía',
        'jaen': 'Andalucía',
        'madrid': 'Madrid',
        'barcelona': 'Cataluña',
        'valencia': 'Valencia',
        'bilbao': 'País Vasco',
        'zaragoza': 'Aragón',
        'badajoz': 'Extremadura',
        'caceres': 'Extremadura',
        // Add more mappings as needed
      };
      const region = provinceToRegion[company.province.toLowerCase()] || 'Madrid';
      setSelectedRegion(region);
    }
  }, [company, selectedRegion]);

  // Calculate days function
  const calculateDays = (startDate: string | Date, endDate: string | Date) => {
    const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
    const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;
    return differenceInDays(end, start) + 1;
  };

  const formatHourValue = (value?: number) => {
    if (value === null || value === undefined) return '';
    const hours = Math.floor(value);
    const minutes = Math.round((value % 1) * 60);
    return `${hours}:${String(minutes).padStart(2, '0')}`;
  };

  const formatHourRange = (start?: number, end?: number) => {
    if (start === null || start === undefined || end === null || end === undefined) return 'N/A';
    return `${formatHourValue(start)} - ${formatHourValue(end)}`;
  };

  const normalizeWorkingDays = (days: number[] | null | undefined): number[] => {
    if (!Array.isArray(days) || days.length === 0) return [1, 2, 3, 4, 5];
    const normalized = days
      .map((day) => (day === 7 ? 0 : day))
      .filter((day) => day >= 0 && day <= 6);
    return normalized.length > 0 ? Array.from(new Set(normalized)) : [1, 2, 3, 4, 5];
  };

  const expandDatesToIncludeWeekends = (
    startDate: Date,
    endDate: Date,
    workingDays: number[] = [1, 2, 3, 4, 5]
  ): { startDate: Date; endDate: Date } => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const expandedStart = new Date(start);
    const expandedEnd = new Date(end);

    const endDay = expandedEnd.getDay();
    if (endDay === 5) {
      expandedEnd.setDate(expandedEnd.getDate() + 2);
    } else if (endDay === 6) {
      expandedEnd.setDate(expandedEnd.getDate() + 1);
    }

    return { startDate: expandedStart, endDate: expandedEnd };
  };

  const getWorkingDatesInRange = (startDate: Date, endDate: Date, workingDays: number[]) => {
    const dates: Date[] = [];
    let current = startOfDay(startDate);
    const end = startOfDay(endDate);
    while (current <= end) {
      if (workingDays.includes(current.getDay())) {
        dates.push(new Date(current));
      }
      current = addDays(current, 1);
    }
    return dates;
  };

  // Swipe functions for mobile timeline navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setTouchStartX(e.touches[0].clientX);
      setTouchStartY(e.touches[0].clientY);
      setIsSwiping(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping || e.touches.length !== 1) return;
    
    // Prevent default to avoid page scrolling during horizontal swipes
    const deltaX = Math.abs(e.touches[0].clientX - touchStartX);
    const deltaY = Math.abs(e.touches[0].clientY - touchStartY);
    
    if (deltaX > deltaY && deltaX > 10) {
      e.preventDefault();
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isSwiping) return;
    setIsSwiping(false);

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;

    // Solo procesar swipes horizontales (más de 50px y más horizontal que vertical)
    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX > 0) {
        // Swipe derecha
        setTimelineViewDate(prev => {
          if (timelineViewMode === 'week') return addDays(prev, -7);
          if (timelineViewMode === 'month') return subMonths(prev, 1);
          return subMonths(prev, 3);
        });
      } else {
        // Swipe izquierda
        setTimelineViewDate(prev => {
          if (timelineViewMode === 'week') return addDays(prev, 7);
          if (timelineViewMode === 'month') return addMonths(prev, 1);
          return addMonths(prev, 3);
        });
      }
    }
  };

  // ⚠️ PROTECTED TIMELINE FUNCTIONS - DO NOT MODIFY ⚠️
  // Funciones críticas para el timeline de vacaciones tipo Gantt
  const getTimelineRange = () => {
    if (timelineViewMode === 'week') {
      const start = startOfWeek(timelineViewDate, { weekStartsOn: 1 });
      const end = endOfWeek(timelineViewDate, { weekStartsOn: 1 });
      return { start, end, days: eachDayOfInterval({ start, end }) };
    }
    if (timelineViewMode === 'month') {
      const start = startOfMonth(timelineViewDate);
      const end = endOfMonth(timelineViewDate);
      return { start, end, days: eachDayOfInterval({ start, end }) };
    } else {
      // Vista trimestral: 3 meses
      const start = startOfMonth(subMonths(timelineViewDate, 1));
      const end = endOfMonth(addMonths(timelineViewDate, 1));
      return { start, end, days: eachDayOfInterval({ start, end }) };
    }
  };

  const getVacationPeriodsForEmployee = (employeeId: number) => {
    if (!vacationRequests || !Array.isArray(vacationRequests)) return [];
    return vacationRequests
      .filter((req: any) => req.userId === employeeId && (req.status === 'approved' || req.status === 'pending'))
      .map((req: any) => ({
        ...req,
        startDate: parseISO(req.startDate),
        endDate: parseISO(req.endDate)
      }));
  };

  const navigateTimeline = (direction: 'prev' | 'next') => {
    if (timelineViewMode === 'week') {
      setTimelineViewDate(direction === 'next'
        ? addDays(timelineViewDate, 7)
        : addDays(timelineViewDate, -7)
      );
      return;
    }
    if (timelineViewMode === 'month') {
      setTimelineViewDate(direction === 'next' 
        ? addMonths(timelineViewDate, 1)
        : subMonths(timelineViewDate, 1)
      );
    } else {
      setTimelineViewDate(direction === 'next' 
        ? addMonths(timelineViewDate, 3)
        : subMonths(timelineViewDate, 3)
      );
    }
  };

  const renderVacationBar = (employee: Employee, timelineRange: any) => {
    const periods = getVacationPeriodsForEmployee(employee.id);
    const { start: rangeStart, end: rangeEnd } = timelineRange;
    
    if (!periods || !Array.isArray(periods)) return [];
    
    return periods.map((period: any, index: number) => {
      const periodStart = period.startDate;
      const periodEnd = period.endDate;
      
      if (periodEnd < rangeStart || periodStart > rangeEnd) {
        return null;
      }
      
      const visibleStart = periodStart < rangeStart ? rangeStart : periodStart;
      const visibleEnd = periodEnd > rangeEnd ? rangeEnd : periodEnd;
      
      const totalDays = differenceInDays(rangeEnd, rangeStart) + 1;
      const startOffset = differenceInDays(visibleStart, rangeStart);
      const duration = differenceInDays(visibleEnd, visibleStart) + 1;
      
      const leftPercent = (startOffset / totalDays) * 100;
      const widthPercent = (duration / totalDays) * 100;
      
      const fullRequest = vacationRequests?.find((req: any) => req.id === period.id);
      const tooltipId = `${employee.id}-${period.id}-${index}`;
      const isTooltipActive = activeTooltip === tooltipId;

      const absenceType = fullRequest?.absenceType || 'vacation';
      const AbsenceIcon = ABSENCE_TYPE_ICONS[absenceType] || Plane;
      const daysCount = fullRequest?.startDate && fullRequest?.endDate 
        ? calculateDays(fullRequest.startDate, fullRequest.endDate)
        : fullRequest?.days || duration;
      
      return (
        <div
          key={tooltipId}
          data-vacation-bar
          className={`absolute rounded-md cursor-pointer transition-all ${
            period.status === 'approved' 
              ? 'bg-green-500 border-green-600 hover:bg-green-600' 
              : 'bg-yellow-400 border-yellow-500 hover:bg-yellow-500'
          } border opacity-90 hover:opacity-100 flex flex-col items-center justify-center py-0.5`}
          style={{
            left: `${leftPercent}%`,
            width: `${widthPercent}%`,
            minWidth: '2.5rem',
            top: '2px',
            bottom: '2px',
            zIndex: isTooltipActive ? 15 : 10
          }}
          onClick={(e) => {
            e.stopPropagation();
            setActiveTooltip(isTooltipActive ? null : tooltipId);
          }}
        >
          {/* Icono del tipo de ausencia */}
          <AbsenceIcon className={`w-3.5 h-3.5 md:w-4 md:h-4 ${
            period.status === 'approved' ? 'text-white' : 'text-yellow-900 dark:text-yellow-950'
          }`} />
          {/* Número de días */}
          <div className={`text-[10px] md:text-xs font-bold select-none leading-tight ${
            period.status === 'approved' ? 'text-white' : 'text-yellow-900 dark:text-yellow-950'
          }`}>
            {daysCount}d
          </div>

          {/* Panel de información que aparece al hacer clic - Renderizado en portal para evitar problemas de z-index */}
          {isTooltipActive && createPortal(
            <>
              {/* Overlay semi-transparente para evitar interferencias */}
              <div 
                className="fixed inset-0 bg-black bg-opacity-25"
                style={{ zIndex: 99998 }}
                onClick={() => setActiveTooltip(null)}
              />
              
              <div 
                data-vacation-tooltip
                className="fixed bg-gray-50 dark:bg-gray-900 border border-border rounded-2xl shadow-xl mx-auto"
                style={{ 
                  zIndex: 99999,
                  position: 'fixed',
                  left: '1.5rem',
                  right: '1.5rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '20rem',
                  maxWidth: 'calc(100vw - 3rem)'
                }}
                onClick={(e) => e.stopPropagation()}
              >
              {/* Contenido estilo iOS card */}
              <div className="p-4 space-y-4">
                {/* Header con icono tipo ausencia, nombre y badge */}
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    period.status === 'approved' 
                      ? 'bg-green-100 dark:bg-green-900/30' 
                      : period.status === 'pending'
                      ? 'bg-yellow-100 dark:bg-yellow-900/30'
                      : 'bg-red-100 dark:bg-red-900/30'
                  }`}>
                    <AbsenceIcon className={`w-5 h-5 ${
                      period.status === 'approved' 
                        ? 'text-green-600 dark:text-green-400' 
                        : period.status === 'pending'
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-red-600 dark:text-red-400'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground">{fullRequest?.user?.fullName}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-sm text-primary font-medium">
                        {ABSENCE_TYPE_LABELS[absenceType as keyof typeof ABSENCE_TYPE_LABELS] || 'Vacaciones'}
                      </p>
                      {getStatusBadge(period.status)}
                    </div>
                  </div>
                </div>
                
                {/* Info en formato iOS */}
                <div className="bg-muted/50 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Fechas</span>
                    <span className="text-sm font-medium text-foreground">
                      {(() => {
                        const startStr = format(period.startDate, "dd/MM/yyyy", { locale: es });
                        const endStr = format(period.endDate, "dd/MM/yyyy", { locale: es });
                        return startStr === endStr ? format(period.startDate, "d MMM yyyy", { locale: es }) : `${startStr} - ${endStr}`;
                      })()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Días</span>
                    <span className="text-sm font-medium text-foreground">
                      {fullRequest?.startDate && fullRequest?.endDate 
                        ? calculateDays(fullRequest.startDate, fullRequest.endDate)
                        : fullRequest?.days || duration}
                    </span>
                  </div>
                  {fullRequest?.reason && (
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm text-muted-foreground shrink-0">Motivo</span>
                      <span className="text-sm text-foreground text-right">{fullRequest.reason}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Solicitado</span>
                    <span className="text-sm text-foreground">
                      {fullRequest?.requestDate ? format(new Date(fullRequest.requestDate), "d MMM yyyy", { locale: es }) : 
                       fullRequest?.createdAt ? format(new Date(fullRequest.createdAt), "d MMM yyyy", { locale: es }) : "N/A"}
                    </span>
                  </div>
                </div>

                {/* Botones de acción estilo iOS - iconos coloreados */}
                {period.status === 'pending' && fullRequest && canManageRequest(fullRequest) ? (
                  <div className="flex items-center justify-center gap-6 pt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTooltip(null);
                        if (fullRequest) openRequestModal(fullRequest, 'approve');
                      }}
                      className="flex flex-col items-center gap-1 group"
                      title="Aprobar solicitud"
                    >
                      <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center group-hover:bg-green-200 dark:group-hover:bg-green-800/40 transition-colors">
                        <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
                      </div>
                      <span className="text-xs text-muted-foreground">Aprobar</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTooltip(null);
                        if (fullRequest) openRequestModal(fullRequest, 'edit');
                      }}
                      className="flex flex-col items-center gap-1 group"
                      title="Editar solicitud"
                    >
                      <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-800/40 transition-colors">
                        <Edit className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <span className="text-xs text-muted-foreground">Editar</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTooltip(null);
                        if (fullRequest) openRequestModal(fullRequest, 'deny');
                      }}
                      className="flex flex-col items-center gap-1 group"
                      title="Denegar solicitud"
                    >
                      <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center group-hover:bg-red-200 dark:group-hover:bg-red-800/40 transition-colors">
                        <X className="w-6 h-6 text-red-600 dark:text-red-400" />
                      </div>
                      <span className="text-xs text-muted-foreground">Denegar</span>
                    </button>
                  </div>
                ) : period.status === 'pending' ? (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl text-center">
                    <p className="text-xs text-yellow-700 dark:text-yellow-400">
                      {user?.role === 'manager' && fullRequest?.userId === user?.id 
                        ? 'No puedes gestionar tus propias solicitudes' 
                        : 'Sin permisos para gestionar esta solicitud'}
                    </p>
                  </div>
                ) : (
                  <div className="flex justify-center pt-2">
                    {(period.status === 'approved' || period.status === 'denied') && fullRequest && canManageRequest(fullRequest) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTooltip(null);
                          if (fullRequest) openRequestModal(fullRequest, 'revert');
                        }}
                        className="flex flex-col items-center gap-1 group"
                        title="Revertir a pendiente"
                      >
                        <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center group-hover:bg-orange-200 dark:group-hover:bg-orange-800/40 transition-colors">
                          <RotateCcw className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                        </div>
                        <span className="text-xs text-muted-foreground">Revertir</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
              </div>
            </>,
            document.body
          )}
        </div>
      );
    }).filter(Boolean);
  };

  // Render hour-based absences as small indicators in timeline
  const renderHourAbsenceIndicators = (employee: Employee, timelineRange: any) => {
    const employeeHourAbsences = hourBasedAbsences.filter(ha => ha.userId === employee.id);
    const { start: rangeStart, end: rangeEnd } = timelineRange;
    
    if (!employeeHourAbsences || employeeHourAbsences.length === 0) return [];

    return employeeHourAbsences.map((absence: any, index: number) => {
      const absenceDate = parseDateOnlyLocal(absence.absenceDate);
      
      if (absenceDate < rangeStart || absenceDate > rangeEnd) {
        return null;
      }

      const totalDays = differenceInDays(rangeEnd, rangeStart) + 1;
      const startOffset = differenceInDays(absenceDate, rangeStart);
      
      const leftPercent = (startOffset / totalDays) * 100;
      const widthPercent = (1 / totalDays) * 100;
      
      const hoursStart = typeof absence.hoursStart === 'string' ? parseFloat(absence.hoursStart) : (absence.hoursStart || 0);
      const hoursEnd = typeof absence.hoursEnd === 'string' ? parseFloat(absence.hoursEnd) : (absence.hoursEnd || 0);
      const totalHours = typeof absence.totalHours === 'string' ? parseFloat(absence.totalHours) : (absence.totalHours || 0);

      const tooltipId = `hour-${employee.id}-${absence.id}-${index}`;
      const isTooltipActive = activeTooltip === tooltipId;

      const absenceLabel = ABSENCE_TYPE_LABELS[absence.absenceType as keyof typeof ABSENCE_TYPE_LABELS] || 'Ausencia';
      const hoursLabel = Number.isInteger(totalHours) ? String(totalHours) : totalHours.toFixed(1).replace('.', ',');

      return (
        <div
          key={tooltipId}
          data-hour-absence
          className={`absolute rounded-md cursor-pointer transition-all ${
            absence.status === 'approved' 
              ? 'bg-blue-500 border-blue-600 hover:bg-blue-600' 
              : 'bg-blue-300 border-blue-400 hover:bg-blue-400'
          } border opacity-90 hover:opacity-100 flex flex-col items-center justify-center py-0.5`}
          style={{
            left: `${leftPercent}%`,
            width: `${widthPercent}%`,
            minWidth: '2.5rem',
            height: '28px',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: isTooltipActive ? 15 : 5
          }}
          title={`${hoursLabel}h - ${absenceLabel}`}
          onClick={(e) => {
            e.stopPropagation();
            setActiveTooltip(isTooltipActive ? null : tooltipId);
            setSelectedRequest({
              ...absence,
              isHourBased: true,
              absenceDate: absence.absenceDate,
              hoursStart: typeof absence.hoursStart === 'string' ? parseFloat(absence.hoursStart) : absence.hoursStart,
              hoursEnd: typeof absence.hoursEnd === 'string' ? parseFloat(absence.hoursEnd) : absence.hoursEnd,
              totalHours: typeof absence.totalHours === 'string' ? parseFloat(absence.totalHours) : (absence.totalHours || 0),
              absenceType: absence.absenceType,
            } as any);
            setModalAction('edit');
            setShowRequestModal(true);
          }}
        >
          {/* Icon and text for hour absence */}
          <Clock className="w-4 h-4 text-white" />
          <span className="text-xs font-medium text-white">{totalHours.toFixed(1)}h</span>
        </div>
      );
    }).filter(Boolean);
  };

  // ⚠️ END PROTECTED TIMELINE FUNCTIONS ⚠️

  // Fetch vacation requests
  // ⚡ WebSocket provides real-time updates - no polling needed!
  const { data: vacationRequests = [], isLoading: loadingRequests } = useQuery({
    queryKey: ['/api/vacation-requests/company'],
    staleTime: 60000, // Cache for 1 min - WebSocket invalidates on changes
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    select: (data: any) => {
      // Handle both old array format and new { requests, accessMode } format
      const requests = Array.isArray(data) ? data : (data?.requests || []);
      if (!requests || !Array.isArray(requests)) return [];
      return requests.map((request: any) => ({
        ...request,
        days: request.days || 0,
        requestDate: request.requestDate || request.createdAt || new Date().toISOString(),
        user: request.user || { fullName: "Usuario desconocido", email: "" }
      }));
    }
  });

  // Fetch hour-based absences
  const { data: hourBasedAbsences = [], isLoading: loadingHourAbsences } = useQuery({
    queryKey: ['/api/hour-based-absences'],
    queryFn: async () => apiRequest('GET', '/api/hour-based-absences'),
    staleTime: 60000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    select: (data: any) => {
      if (!data || !Array.isArray(data)) return [];
      return data.map((absence: any) => ({
        ...absence,
        absenceDate: formatInMadridTime(absence.absenceDate, 'yyyy-MM-dd'),
        createdAt: absence.createdAt ? new Date(absence.createdAt) : new Date(),
      }));
    }
  });

  // Fetch employees for vacation overview
  const { data: employees = [], isLoading: loadingEmployees } = useQuery({
    queryKey: ['/api/employees'],
    staleTime: 5 * 60 * 1000,
    select: (data) => {
      // Ensure employees data is an array and exclude pending activations
      if (!data || !Array.isArray(data)) return [];
      return data.filter((e: any) => !e?.isPendingActivation);
    }
  });

  // Fetch absence policies for the new request modal
  const { data: absencePolicies = [] } = useQuery<AbsencePolicy[]>({
    queryKey: ['/api/absence-policies'],
    enabled: !!user,
  });

  // Fetch company config (vacation cutoff)
  const { data: companyConfig, isFetching: loadingCompanyConfig } = useQuery<CompanyConfig>({
    queryKey: ['/api/company/config'],
    queryFn: async () => apiRequest('GET', '/api/company/config'),
    enabled: !!user,
  });

  // Fetch adverse weather hours accumulated for all employees
  const { data: adverseWeatherHours = {} } = useQuery({
    queryKey: ['/api/adverse-weather-hours/company-balance'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/adverse-weather-hours/company-balance');
      const balances = Array.isArray(response?.balances) ? response.balances : [];
      return balances.reduce((acc: Record<number, { totalHours: number; usedHours: number; availableHours: number }>, balance: any) => {
        acc[balance.employeeId] = {
          totalHours: balance.totalHours,
          usedHours: balance.usedHours,
          availableHours: balance.availableHours,
        };
        return acc;
      }, {});
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!user && user?.role !== 'employee',
  });

  useEffect(() => {
    const cutoff = companyConfig?.vacationCutoffDay || '01-31';
    const [mm = '01', dd = '31'] = cutoff.split('-');
    setVacationCutoffMonth(mm.padStart(2, '0'));
    setVacationCutoffDay(dd.padStart(2, '0'));
  }, [companyConfig?.vacationCutoffDay]);

  const daysInCutoffMonth = useMemo(() => {
    const monthNum = Math.max(1, Math.min(12, parseInt(vacationCutoffMonth || '1', 10)));
    return new Date(2024, monthNum, 0).getDate();
  }, [vacationCutoffMonth]);

  useEffect(() => {
    const dayNum = parseInt(vacationCutoffDay || '1', 10);
    if (dayNum > daysInCutoffMonth) {
      setVacationCutoffDay(String(daysInCutoffMonth).padStart(2, '0'));
    }
  }, [daysInCutoffMonth, vacationCutoffDay]);

  const adminVacationPeriod = useMemo(() => {
    const cutoff = companyConfig?.vacationCutoffDay || '01-31';
    const [mmStr, ddStr] = cutoff.split('-');
    const mm = Math.max(1, Math.min(12, parseInt(mmStr || '1', 10))) - 1;
    const dd = Math.max(1, Math.min(31, parseInt(ddStr || '31', 10)));
    const today = new Date();
    const cutoffThisYear = new Date(today.getFullYear(), mm, dd);
    const periodEnd = today <= cutoffThisYear ? cutoffThisYear : new Date(today.getFullYear() + 1, mm, dd);
    const periodStart = new Date(periodEnd);
    periodStart.setFullYear(periodEnd.getFullYear() - 1);
    periodStart.setDate(periodStart.getDate() + 1);
    return { periodStart, periodEnd };
  }, [companyConfig?.vacationCutoffDay]);

  // Calculate previous vacation period for label display
  const previousVacationPeriod = useMemo(() => {
    const cutoff = companyConfig?.vacationCutoffDay || '01-31';
    const [mmStr, ddStr] = cutoff.split('-');
    const mm = Math.max(1, Math.min(12, parseInt(mmStr || '1', 10))) - 1;
    const dd = Math.max(1, Math.min(31, parseInt(ddStr || '31', 10)));
    const periodEnd = new Date(adminVacationPeriod.periodStart);
    periodEnd.setDate(periodEnd.getDate() - 1); // Day before current period starts
    const periodStart = new Date(periodEnd);
    periodStart.setFullYear(periodEnd.getFullYear() - 1);
    periodStart.setDate(periodStart.getDate() + 1);
    return { periodStart, periodEnd };
  }, [adminVacationPeriod]);

  const adverseRecoveryPercentage = useMemo(() => {
    const adversePolicy = absencePolicies.find((policy) => policy.absenceType === 'adverse_weather');
    const raw = Number(adversePolicy?.recoveryPercentage ?? 70);
    return Number.isFinite(raw) && raw > 0 ? raw : 70;
  }, [absencePolicies]);

  const approvedAdverseRawHoursByEmployee = useMemo(() => {
    const map = new Map<number, number>();
    if (!adminVacationPeriod) {
      logger.log('⚠️ No adminVacationPeriod set');
      return map;
    }

    const workingHoursPerDay = typeof companyConfig?.workingHoursPerDay === 'string'
      ? parseFloat(companyConfig.workingHoursPerDay)
      : (Number(companyConfig?.workingHoursPerDay) || 8);

    const workingDays = normalizeWorkingDays(company?.workingDays as number[] | undefined);
    const hourBasedDatesByUser = new Map<number, Set<string>>();
    const debugLog = import.meta.env?.DEV ? logger.log : () => {};

    debugLog('🔍 DEBUG approvedAdverseRawHoursByEmployee:', {
      adminVacationPeriodStart: adminVacationPeriod.periodStart.toISOString(),
      adminVacationPeriodEnd: adminVacationPeriod.periodEnd.toISOString(),
      totalAbsences: hourBasedAbsences?.length || 0,
      allAbsences: hourBasedAbsences
    });

    if (!hourBasedAbsences || hourBasedAbsences.length === 0) {
      debugLog('⚠️ No hourBasedAbsences data');
      return map;
    }

    for (let i = 0; i < (hourBasedAbsences as any[]).length; i++) {
      const absence = (hourBasedAbsences as any[])[i];
      debugLog(`\n📋 Processing absence #${i}:`, {
        id: absence?.id,
        userId: absence?.userId,
        absenceType: absence?.absenceType,
        status: absence?.status,
        autoApprove: absence?.autoApprove,
        absenceDate: absence?.absenceDate,
        hoursStart: absence?.hoursStart,
        hoursEnd: absence?.hoursEnd,
        totalHours: absence?.totalHours
      });

      if ((absence?.absenceType || 'adverse_weather') !== 'adverse_weather') {
        debugLog('  ❌ Skipped (not adverse_weather):', absence?.absenceType);
        continue;
      }
      if (!(absence?.status === 'approved' || absence?.autoApprove === true)) {
        debugLog('  ❌ Skipped (not approved/autoApprove):', { status: absence?.status, autoApprove: absence?.autoApprove });
        continue;
      }

      const absenceDate = absence?.absenceDate ? parseDateOnlyLocal(String(absence.absenceDate)) : null;
      if (!absenceDate) {
        debugLog('  ❌ Skipped (no valid date)');
        continue;
      }

      const periodStart = adminVacationPeriod.periodStart;
      const periodEnd = adminVacationPeriod.periodEnd;
      const isInPeriod = absenceDate >= periodStart && absenceDate <= periodEnd;
      
      debugLog('  📅 Date check:', {
        absenceDate: absenceDate.toISOString().split('T')[0],
        periodStart: periodStart.toISOString().split('T')[0],
        periodEnd: periodEnd.toISOString().split('T')[0],
        isInPeriod
      });

      if (!isInPeriod) {
        debugLog('  ❌ Skipped (outside period)');
        continue;
      }

      const userIdRaw = typeof absence?.userId === 'string' ? parseInt(absence.userId, 10) : Number(absence?.userId);
      if (!Number.isFinite(userIdRaw)) {
        debugLog('  ❌ Skipped (invalid userId):', absence?.userId);
        continue;
      }

      const totalHoursRaw = typeof absence?.totalHours === 'string'
        ? parseFloat(absence.totalHours)
        : Number(absence?.totalHours || 0);
      const totalHours = Number.isFinite(totalHoursRaw) ? totalHoursRaw : 0;

      debugLog(`  ✅ ADDED for user ${userIdRaw}:`, { 
        date: absenceDate.toISOString().split('T')[0],
        totalHours,
        hoursStart: absence?.hoursStart,
        hoursEnd: absence?.hoursEnd,
        runningTotal: (map.get(userIdRaw) || 0) + totalHours
      });

      map.set(userIdRaw, (map.get(userIdRaw) || 0) + totalHours);

      const absenceDateKey = format(absenceDate, 'yyyy-MM-dd');
      if (!hourBasedDatesByUser.has(userIdRaw)) {
        hourBasedDatesByUser.set(userIdRaw, new Set());
      }
      hourBasedDatesByUser.get(userIdRaw)!.add(absenceDateKey);
    }

    const periodStart = adminVacationPeriod.periodStart;
    const periodEnd = adminVacationPeriod.periodEnd;
    const approvedDayRequests = (vacationRequests || []).filter((request: any) => {
      if (!request || request.isHourBased) return false;
      if ((request.absenceType || 'vacation') !== 'adverse_weather') return false;
      if (request.status !== 'approved') return false;
      return request.startDate && request.endDate;
    });

    for (const request of approvedDayRequests) {
      const userIdRaw = typeof request.userId === 'string' ? parseInt(request.userId, 10) : Number(request.userId);
      if (!Number.isFinite(userIdRaw)) {
        continue;
      }

      const requestStart = startOfDay(parseDateOnlyLocal(request.startDate));
      const requestEnd = startOfDay(parseDateOnlyLocal(request.endDate));
      const rangeStart = requestStart > periodStart ? requestStart : periodStart;
      const rangeEnd = requestEnd < periodEnd ? requestEnd : periodEnd;
      if (rangeEnd < rangeStart) {
        continue;
      }

      let current = new Date(rangeStart);
      while (current <= rangeEnd) {
        const dateKey = format(current, 'yyyy-MM-dd');
        const existingDates = hourBasedDatesByUser.get(userIdRaw);
        if (workingDays.includes(current.getDay()) && (!existingDates || !existingDates.has(dateKey))) {
          map.set(userIdRaw, (map.get(userIdRaw) || 0) + workingHoursPerDay);
          if (!hourBasedDatesByUser.has(userIdRaw)) {
            hourBasedDatesByUser.set(userIdRaw, new Set());
          }
          hourBasedDatesByUser.get(userIdRaw)!.add(dateKey);
        }
        current = addDays(current, 1);
      }
    }

    logger.log('📊 Final approvedAdverseRawHoursByEmployee:', Object.fromEntries(map));

    return map;
  }, [hourBasedAbsences, vacationRequests, adminVacationPeriod, companyConfig?.workingHoursPerDay, company?.workingDays]);

  // Fetch custom holidays
  const { data: customHolidays = [], isLoading: loadingHolidays, refetch: refetchHolidays } = useQuery<Holiday[]>({
    queryKey: ['/api/holidays/custom'],
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Helper function to calculate vacation days within current period (optimized for performance)
  const getVacationDaysInCurrentPeriod = useMemo(() => {
    return (request: VacationRequest) => {
      if (!request?.startDate || !request?.endDate || request.absenceType !== 'vacation') return 0;
      if (!adminVacationPeriod) return 0;

      const requestStart = startOfDay(parseDateOnlyLocal(request.startDate));
      const requestEnd = startOfDay(parseDateOnlyLocal(request.endDate));
      const { periodStart, periodEnd } = adminVacationPeriod;

      // Check if request overlaps with current period
      if (requestEnd < periodStart || requestStart > periodEnd) return 0;

      // Calculate overlap using simple days calculation (natural days)
      const overlapStart = requestStart > periodStart ? requestStart : periodStart;
      const overlapEnd = requestEnd < periodEnd ? requestEnd : periodEnd;

      if (overlapEnd < overlapStart) return 0;
      
      // Use simple calculation for performance - just count natural days
      return differenceInDays(overlapEnd, overlapStart) + 1;
    };
  }, [adminVacationPeriod]);

  const updateCompanyConfig = useMutation({
    mutationFn: async () => {
      const payload = {
        vacationCutoffDay: `${vacationCutoffMonth.padStart(2, '0')}-${vacationCutoffDay.padStart(2, '0')}`,
      };
      return apiRequest('PATCH', '/api/company/config', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/company/config'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vacation-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vacation-requests/company'] });
      toast({
        title: 'Corte actualizado',
        description: 'El nuevo periodo de vacaciones ya está activo.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar el corte de vacaciones',
        variant: 'destructive',
      });
    },
  });

  // Calculate policy requirements for new request
  const selectedNewRequestPolicy = absencePolicies.find(p => p.absenceType === newRequestAbsenceType);
  const newRequestRequiresAttachment = selectedNewRequestPolicy?.requiresAttachment ?? false;
  const isNewRequestFixedDuration = selectedNewRequestPolicy?.maxDays !== null && newRequestAbsenceType !== 'vacation';
  const calculationMode = company?.absenceDayCalculationMode === 'working' ? 'working' : 'natural';
  const newRequestWorkingDays = useMemo(
    () => normalizeWorkingDays(company?.workingDays as number[] | undefined),
    [company?.workingDays]
  );
  const expandedNewRequestRange = useMemo(() => {
    if (!newRequestDates.startDate || !newRequestDates.endDate) return null;
    if (newRequestAbsenceType !== 'vacation' || calculationMode !== 'natural') {
      return { startDate: newRequestDates.startDate, endDate: newRequestDates.endDate, expanded: false };
    }
    const expanded = expandDatesToIncludeWeekends(
      newRequestDates.startDate,
      newRequestDates.endDate,
      newRequestWorkingDays
    );
    const expandedFlag =
      expanded.startDate.getTime() !== newRequestDates.startDate.getTime() ||
      expanded.endDate.getTime() !== newRequestDates.endDate.getTime();
    return { startDate: expanded.startDate, endDate: expanded.endDate, expanded: expandedFlag };
  }, [newRequestDates.startDate, newRequestDates.endDate, newRequestAbsenceType, calculationMode, newRequestWorkingDays]);

  // Calendar functions for new request modal
  const handleNewRequestDateClick = (date: Date) => {
    // For fixed-duration absences, auto-select end date
    if (isNewRequestFixedDuration && selectedNewRequestPolicy?.maxDays) {
      setNewRequestDates({
        startDate: date,
        endDate: addDays(date, selectedNewRequestPolicy.maxDays - 1)
      });
      return;
    }
    
    if (!newRequestDates.startDate || (newRequestDates.startDate && newRequestDates.endDate)) {
      setNewRequestDates({ startDate: date, endDate: null });
    } else if (date < newRequestDates.startDate) {
      setNewRequestDates({ startDate: date, endDate: null });
    } else {
      const rangeStart = newRequestDates.startDate;
      const rangeEnd = date;

      if (newRequestAbsenceType === 'vacation' && calculationMode === 'natural') {
        const expanded = expandDatesToIncludeWeekends(rangeStart, rangeEnd, newRequestWorkingDays);
        setNewRequestDates({ startDate: expanded.startDate, endDate: expanded.endDate });
      } else {
        setNewRequestDates({ startDate: rangeStart, endDate: rangeEnd });
      }
    }
  };

  const isNewRequestDateInRange = (date: Date) => {
    if (!newRequestDates.startDate) return false;
    if (!newRequestDates.endDate && !newRequestHoverDate) return isSameDay(date, newRequestDates.startDate);
    
    const endDate = newRequestDates.endDate || newRequestHoverDate;
    if (!endDate) return isSameDay(date, newRequestDates.startDate);
    
    return isWithinInterval(date, { 
      start: newRequestDates.startDate < endDate ? newRequestDates.startDate : endDate,
      end: newRequestDates.startDate < endDate ? endDate : newRequestDates.startDate
    });
  };

  const isNewRequestDateStart = (date: Date) => newRequestDates.startDate && isSameDay(date, newRequestDates.startDate);
  const isNewRequestDateEnd = (date: Date) => newRequestDates.endDate && isSameDay(date, newRequestDates.endDate);

  const goToNewRequestPreviousMonth = () => {
    setNewRequestCalendarDate(new Date(newRequestCalendarDate.getFullYear(), newRequestCalendarDate.getMonth() - 1, 1));
  };

  const goToNewRequestNextMonth = () => {
    setNewRequestCalendarDate(new Date(newRequestCalendarDate.getFullYear(), newRequestCalendarDate.getMonth() + 1, 1));
  };

  const generateNewRequestCalendarDays = () => {
    const currentMonth = newRequestCalendarDate.getMonth();
    const currentYear = newRequestCalendarDate.getFullYear();
    
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const startDay = (firstDayOfMonth.getDay() + 6) % 7; // Monday = 0
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    const days: (Date | null)[] = [];
    
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(currentYear, currentMonth, i);
      days.push(date);
    }
    
    return days;
  };

  const isSameDay = (date1: Date, date2: Date) => {
    return date1.getDate() === date2.getDate() && 
           date1.getMonth() === date2.getMonth() && 
           date1.getFullYear() === date2.getFullYear();
  };

  // ⚡ REAL-TIME UPDATES: WebSocket listener for instant vacation request notifications
  // This eliminates polling delays - updates appear immediately when employees submit requests
  useEffect(() => {
    if (!user || (user.role !== 'admin' && user.role !== 'manager')) return;

    // Get auth token for WebSocket authentication
    const authData = getAuthData();
    if (!authData?.token) return;

    let ws: WebSocket | null = null;
    
    try {
      const token = authData.token;
      
      // Build WebSocket URL dynamically from current window location
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws/work-sessions?token=${token}`;
      
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          // Handle new vacation request - show toast and refresh data immediately
          if (message.type === 'vacation_request_created') {
            const { employeeName, startDate, endDate } = message.data || {};
            
            // Show instant toast notification with employee name
            if (employeeName) {
              const periodText = startDate && endDate ? ` ${formatVacationPeriod(startDate, endDate)}` : '';
              
              toast({
                title: "📋 Nueva solicitud de ausencia",
                description: `${employeeName} ha solicitado ausencia${periodText}`,
                duration: 8000,
              });
            }
            
            // Immediately invalidate and refetch vacation requests
            queryClient.invalidateQueries({ queryKey: ['/api/vacation-requests/company'] });
          }
          
          // Also handle vacation request updates
          if (message.type === 'vacation_request_updated') {
            queryClient.invalidateQueries({ queryKey: ['/api/vacation-requests/company'] });
          }
        } catch (err) {
          logger.log('⚠️ Vacation WS parse error:', err);
        }
      };

      ws.onerror = (error) => {
        logger.log('⚠️ Vacation WS error:', error);
      };
      
      ws.onclose = (event) => {
        logger.log('🔔 Vacation WS closed:', event.code, event.reason);
      };
    } catch (err) {
      logger.log('⚠️ Vacation WS setup error:', err);
    }

    // Cleanup on unmount
    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [user, queryClient, toast]);

  // Track previous vacation requests (for reference only - WebSocket handles toasts)
  const previousRequestsRef = useRef<VacationRequest[]>([]);
  
  // Track if data has been shown at least once (for wave animation)
  const [requestsHaveBeenShown, setRequestsHaveBeenShown] = useState(false);
  
  // Keep reference in sync with current requests (WebSocket handles toast notifications)
  useEffect(() => {
    if (!vacationRequests || vacationRequests.length === 0) return;
    previousRequestsRef.current = [...vacationRequests];
  }, [vacationRequests]);
  
  // Mark as shown when data is displayed for the first time
  useEffect(() => {
    if (!loadingRequests && vacationRequests.length > 0 && !requestsHaveBeenShown) {
      const timer = setTimeout(() => setRequestsHaveBeenShown(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [loadingRequests, vacationRequests.length, requestsHaveBeenShown]);
  
  // Show wave loading animation only on first display
  const showWaveLoading = !requestsHaveBeenShown && vacationRequests.length > 0;

  // Update vacation request status
  const updateRequestMutation = useMutation({
    mutationFn: async ({ id, status, startDate, endDate, adminComment }: { 
      id: number; 
      status: string; 
      startDate?: string; 
      endDate?: string; 
      adminComment?: string;
    }) => {
      const updateData: any = { status };
      if (startDate) updateData.startDate = startDate;
      if (endDate) updateData.endDate = endDate;
      if (adminComment) updateData.adminComment = adminComment;
      
      logger.log('Updating vacation request:', { id, updateData });
      
      return apiRequest('PATCH', `/api/vacation-requests/${id}`, updateData);
    },
    onSuccess: (data) => {
      logger.log('Update successful:', data);
      queryClient.invalidateQueries({ queryKey: ['/api/vacation-requests/company'] });
      setShowRequestModal(false);
      setSelectedRequest(null);
      setAdminComment("");
      toast({ title: "Solicitud actualizada correctamente" });
    },
    onError: (error) => {
      console.error('Update failed:', error);
      toast({ 
        title: "Error", 
        description: `No se pudo actualizar la solicitud: ${error.message}`,
        variant: "destructive" 
      });
    },
  });

  // Create new vacation request (for managers and admins)
  const createRequestMutation = useMutation({
    mutationFn: async ({ startDate, endDate, reason, absenceType, attachmentPath, userIds, autoApprove, deductFromVacation }: { 
      startDate: string; 
      endDate: string; 
      reason?: string;
      absenceType?: string;
      attachmentPath?: string;
      userIds?: number[];
      autoApprove?: boolean;
      deductFromVacation?: boolean;
    }) => {
      const requestData: any = {
        startDate,
        endDate,
        reason: reason || undefined,
        absenceType: absenceType || 'vacation',
        autoApprove: autoApprove === true,
      };

      if (typeof deductFromVacation === 'boolean') {
        requestData.deductFromVacation = deductFromVacation;
      }
      
      // If specific users selected, assign to them; otherwise create for current user
      if (userIds && userIds.length > 0) {
        requestData.userIds = userIds;
      }
      
      if (attachmentPath) {
        requestData.attachmentPath = attachmentPath;
      }
      
      logger.log('Creating vacation request:', requestData);
      
      return apiRequest('POST', '/api/vacation-requests', requestData);
    },
    onSuccess: (data) => {
      logger.log('Create successful:', data);
      queryClient.invalidateQueries({ queryKey: ['/api/vacation-requests/company'] });
      setShowNewRequestModal(false);
      setNewRequestDates({ startDate: null, endDate: null });
      setNewRequestReason("");
      setNewRequestAbsenceType('vacation');
      setNewRequestAttachment(null);
      setNewRequestSelectedUserIds([]);
      setNewRequestEmployeeSearch("");
      setNewRequestAutoApprove(true);
      setNewRequestDeductFromVacation(true);
      const isSingleRequest = newRequestSelectedUserIds.length <= 1;
      const message = isSingleRequest 
        ? "Solicitud de ausencia creada exitosamente" 
        : `${newRequestSelectedUserIds.length} solicitudes de ausencia creadas exitosamente`;
      toast({ title: message });
    },
    onError: (error) => {
      console.error('Create failed:', error);
      toast({ 
        title: "Error", 
        description: `No se pudo crear la solicitud: ${error.message}`,
        variant: "destructive" 
      });
    },
  });

  // Mutation for hour-based absences
  const createHourAbsenceMutation = useMutation({
    mutationFn: async ({ absenceDate, hoursStart, hoursEnd, reason, absenceType, attachmentPath, userIds, autoApprove }: {
      absenceDate: string;
      hoursStart: string;
      hoursEnd: string;
      reason?: string;
      absenceType?: string;
      attachmentPath?: string;
      userIds?: number[];
      autoApprove?: boolean;
    }) => {
      const requestData: any = {
        absenceDate,
        hoursStart,
        hoursEnd,
        reason: reason || undefined,
        absenceType: absenceType || 'adverse_weather',
        autoApprove: autoApprove === true,
      };

      if (userIds && userIds.length > 0) {
        requestData.userIds = userIds;
      }

      if (attachmentPath) {
        requestData.attachmentPath = attachmentPath;
      }

      logger.log('Creating hour-based absence:', requestData);
      return apiRequest('POST', '/api/hour-based-absences', requestData);
    },
    onSuccess: (data) => {
      logger.log('Hour absence created:', data);
      queryClient.invalidateQueries({ queryKey: ['/api/hour-based-absences'] });
      setShowNewRequestModal(false);
      setNewRequestDates({ startDate: null, endDate: null });
      setNewRequestHoursStart('09:00');
      setNewRequestHoursEnd('17:00');
      setNewRequestReason("");
      setNewRequestAbsenceType('vacation');
      setNewRequestAttachment(null);
      setNewRequestSelectedUserIds([]);
      setNewRequestEmployeeSearch("");
      setNewRequestAutoApprove(true);
      setNewRequestIsFullDay(true);
      const isSingleRequest = newRequestSelectedUserIds.length <= 1;
      const message = isSingleRequest 
        ? "Ausencia por horas creada exitosamente" 
        : `${newRequestSelectedUserIds.length} ausencias por horas creadas exitosamente`;
      toast({ title: message });
    },
    onError: (error) => {
      console.error('Hour absence creation failed:', error);
      toast({
        title: "Error",
        description: `No se pudo crear la ausencia: ${error.message}`,
        variant: "destructive"
      });
    },
  });

  // Mutation for updating hour-based absences
  const updateHourAbsenceMutation = useMutation({
    mutationFn: async ({ id, status, adminComment }: { id: number; status: string; adminComment?: string }) => {
      const updateData: any = { status };
      if (adminComment) updateData.adminComment = adminComment;
      logger.log('Updating hour-based absence:', { id, updateData });
      return apiRequest('PATCH', `/api/hour-based-absences/${id}`, updateData);
    },
    onSuccess: (data) => {
      logger.log('Hour absence updated:', data);
      queryClient.invalidateQueries({ queryKey: ['/api/hour-based-absences'] });
      setShowRequestModal(false);
      setSelectedRequest(null);
      setAdminComment("");
      toast({ title: "Ausencia por horas actualizada correctamente" });
    },
    onError: (error) => {
      console.error('Hour absence update failed:', error);
      toast({ 
        title: "Error", 
        description: `No se pudo actualizar la ausencia: ${error.message}`,
        variant: "destructive" 
      });
    },
  });

  // Mutation for deleting vacation requests
  const deleteVacationRequestMutation = useMutation({
    mutationFn: async (id: number) => {
      logger.log('Deleting vacation request:', id);
      return apiRequest('DELETE', `/api/vacation-requests/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vacation-requests/company'] });
      toast({ title: "Solicitud eliminada correctamente" });
    },
    onError: (error) => {
      console.error('Vacation request deletion failed:', error);
      toast({ 
        title: "Error", 
        description: `No se pudo eliminar la solicitud: ${error.message}`,
        variant: "destructive" 
      });
    },
  });

  // Mutation for deleting hour-based absences
  const deleteHourAbsenceMutation = useMutation({
    mutationFn: async (id: number) => {
      logger.log('Deleting hour-based absence:', id);
      return apiRequest('DELETE', `/api/hour-based-absences/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/hour-based-absences'] });
      toast({ title: "Ausencia eliminada correctamente" });
    },
    onError: (error) => {
      console.error('Hour absence deletion failed:', error);
      toast({ 
        title: "Error", 
        description: `No se pudo eliminar la ausencia: ${error.message}`,
        variant: "destructive" 
      });
    },
  });

  // Add custom holiday mutation
  const addHolidayMutation = useMutation({
    mutationFn: async (holidayData: {
      name: string;
      startDate: Date;
      endDate: Date;
      type: 'national' | 'regional' | 'local';
      region?: string;
      description?: string;
    }) => {
      return apiRequest('POST', '/api/holidays/custom', {
        name: holidayData.name,
        startDate: holidayData.startDate.toISOString(),
        endDate: holidayData.endDate.toISOString(),
        type: holidayData.type,
        region: holidayData.region,
        description: holidayData.description,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/holidays/custom'] });
      toast({
        title: "Festivo añadido",
        description: `${newHoliday.name} se ha añadido correctamente`,
      });
      setShowAddHoliday(false);
      setNewHoliday({ name: "", startDate: null, endDate: null, type: "regional" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `No se pudo añadir el festivo: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Handle add holiday
  const handleAddHoliday = async () => {
    if (!newHoliday.name.trim() || !newHoliday.startDate) return;

    const endDate = newHoliday.endDate || newHoliday.startDate;
    
    await addHolidayMutation.mutateAsync({
      name: newHoliday.name.trim(),
      startDate: newHoliday.startDate,
      endDate: endDate,
      type: newHoliday.type,
      region: newHoliday.type === 'regional' ? selectedRegion : undefined,
    });
  };

  // Delete custom holiday mutation
  const deleteHolidayMutation = useMutation({
    mutationFn: async (holidayId: number) => {
      return apiRequest('DELETE', `/api/holidays/custom/${holidayId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/holidays/custom'] });
      toast({
        title: "Festivo eliminado",
        description: "El festivo personalizado se ha eliminado correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `No se pudo eliminar el festivo: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Handle delete custom holiday
  const deleteCustomHoliday = (holidayId: number) => {
    deleteHolidayMutation.mutate(holidayId);
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200",
      approved: "bg-green-100 text-green-800 hover:bg-green-200", 
      denied: "bg-red-100 text-red-800 hover:bg-red-200"
    };
    const labels = {
      pending: "Pendiente",
      approved: "Aprobada",
      denied: "Denegada"
    };
    return (
      <Badge className={variants[status as keyof typeof variants]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  // Combine vacation requests and hour-based absences into a single list
  const allRequests = useMemo(() => {
    const vacRequests = (vacationRequests || []).map(r => ({
      ...r,
      absenceType: r.absenceType || 'vacation',
      autoApprove: r.autoApprove || false,
      isHourBased: false
    }));
    
    const hourRequests = (hourBasedAbsences || []).map((absence: any) => ({
      id: `hour-${absence.id}`,
      userId: absence.userId,
      startDate: absence.absenceDate,
      endDate: absence.absenceDate,
      days: 0,
      reason: absence.reason,
      status: absence.status,
      requestDate: absence.createdAt,
      absenceType: absence.absenceType || 'adverse_weather',
      attachmentPath: absence.attachmentPath,
      createdAt: absence.createdAt,
      user: absence.user,
      isHourBased: true,
      hoursStart: parseFloat(absence.hoursStart),
      hoursEnd: parseFloat(absence.hoursEnd),
      totalHours: parseFloat(absence.totalHours),
      absenceDate: absence.absenceDate,
      adminComment: absence.adminComment,
      reviewedBy: absence.reviewedBy,
      reviewedAt: absence.reviewedAt,
      autoApprove: absence.autoApprove,
    }));
    
    return [...vacRequests, ...hourRequests];
  }, [vacationRequests, hourBasedAbsences]);

  const filteredRequests = (allRequests || []).filter((request: VacationRequest) => {
    const selectedTeamMembers = selectedTeamId !== 'all'
      ? new Set(resolveTeamMemberIds(teams, parseInt(selectedTeamId, 10)))
      : null;
    const matchesStatus = selectedStatus === "all" || request.status === selectedStatus;
    const matchesEmployee = selectedEmployeeId === "all" || request.userId === parseInt(selectedEmployeeId);
    const matchesTeam = !selectedTeamMembers || selectedTeamMembers.has(request.userId);
    const matchesAbsenceType = selectedAbsenceType === "all" || (request.absenceType || 'vacation') === selectedAbsenceType;
    return matchesStatus && matchesEmployee && matchesTeam && matchesAbsenceType;
  });

  // Helper: Check if a request's start date is in the current vacation period
  const isRequestInCurrentPeriod = (request: VacationRequest): boolean => {
    if (!adminVacationPeriod) return true;
    const dateStr = request.isHourBased ? request.absenceDate : request.startDate;
    const requestStart = dateStr ? parseDateOnlyLocal(String(dateStr)) : new Date();
    return requestStart >= adminVacationPeriod.periodStart && requestStart <= adminVacationPeriod.periodEnd;
  };

  // Helper: Calculate days of overlap with current period
  const getVacationOverlapDaysInCurrentPeriod = (request: VacationRequest): number => {
    if (request.absenceType !== 'vacation') return 0;
    if (!adminVacationPeriod) return 0;
    
    const requestStart = new Date(request.startDate);
    const requestEnd = new Date(request.endDate);
    
    const overlapStart = requestStart > adminVacationPeriod.periodStart 
      ? requestStart 
      : adminVacationPeriod.periodStart;
    const overlapEnd = requestEnd < adminVacationPeriod.periodEnd 
      ? requestEnd 
      : adminVacationPeriod.periodEnd;
    
    if (overlapEnd < overlapStart) return 0;
    return Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  // Separate requests into current and previous period
  const { currentPeriodRequests, previousPeriodRequests } = useMemo(() => {
    const current = filteredRequests.filter(r => isRequestInCurrentPeriod(r));
    const previous = filteredRequests.filter(r => !isRequestInCurrentPeriod(r));
    return { currentPeriodRequests: current, previousPeriodRequests: previous };
  }, [filteredRequests, adminVacationPeriod]);

  const visibleCurrentPeriodRequests = useMemo(
    () => currentPeriodRequests.slice(0, displayedCurrentRequestsCount),
    [currentPeriodRequests, displayedCurrentRequestsCount]
  );

  const visiblePreviousPeriodRequests = useMemo(
    () => previousPeriodRequests.slice(0, displayedPreviousRequestsCount),
    [previousPeriodRequests, displayedPreviousRequestsCount]
  );

  const hasMoreCurrentRequests = displayedCurrentRequestsCount < currentPeriodRequests.length;
  const hasMorePreviousRequests = displayedPreviousRequestsCount < previousPeriodRequests.length;
  const visibleTimelineEmployees = useMemo(
    () => employees.slice(0, displayedTimelineEmployeesCount),
    [employees, displayedTimelineEmployeesCount]
  );
  const hasMoreTimelineEmployees = displayedTimelineEmployeesCount < employees.length;

  useEffect(() => {
    setDisplayedCurrentRequestsCount(REQUESTS_PER_LOAD);
    setDisplayedPreviousRequestsCount(REQUESTS_PER_LOAD);
  }, [REQUESTS_PER_LOAD, selectedStatus, selectedEmployeeId, selectedTeamId, selectedAbsenceType, activeTab]);

  useEffect(() => {
    setDisplayedTimelineEmployeesCount(EMPLOYEES_PER_LOAD);
  }, [EMPLOYEES_PER_LOAD, activeTab, selectedTeamId, selectedEmployeeId]);

  useStandardInfiniteScroll({
    targetRef: loadMoreCurrentRequestsRef,
    enabled: activeTab === 'requests',
    canLoadMore: hasMoreCurrentRequests,
    onLoadMore: () => setDisplayedCurrentRequestsCount((prev) => Math.min(prev + REQUESTS_PER_LOAD, currentPeriodRequests.length)),
    dependencyKey: `current-${displayedCurrentRequestsCount}-${currentPeriodRequests.length}-${activeTab}`,
    rootMargin: '100px',
  });

  useStandardInfiniteScroll({
    targetRef: loadMorePreviousRequestsRef,
    enabled: activeTab === 'requests',
    canLoadMore: hasMorePreviousRequests,
    onLoadMore: () => setDisplayedPreviousRequestsCount((prev) => Math.min(prev + REQUESTS_PER_LOAD, previousPeriodRequests.length)),
    dependencyKey: `previous-${displayedPreviousRequestsCount}-${previousPeriodRequests.length}-${activeTab}`,
    rootMargin: '100px',
  });

  useStandardInfiniteScroll({
    targetRef: loadMoreTimelineDesktopRef,
    enabled: activeTab === 'employees',
    canLoadMore: hasMoreTimelineEmployees,
    onLoadMore: () => setDisplayedTimelineEmployeesCount((prev) => Math.min(prev + EMPLOYEES_PER_LOAD, employees.length)),
    dependencyKey: `timeline-desktop-${displayedTimelineEmployeesCount}-${employees.length}-${activeTab}`,
    rootMargin: '100px',
  });

  useStandardInfiniteScroll({
    targetRef: loadMoreTimelineMobileRef,
    enabled: activeTab === 'employees',
    canLoadMore: hasMoreTimelineEmployees,
    onLoadMore: () => setDisplayedTimelineEmployeesCount((prev) => Math.min(prev + EMPLOYEES_PER_LOAD, employees.length)),
    dependencyKey: `timeline-mobile-${displayedTimelineEmployeesCount}-${employees.length}-${activeTab}`,
    rootMargin: '100px',
  });
  
  // Filter pending and approved requests to current period only
  const pendingRequests = (vacationRequests || []).filter((r: VacationRequest) => 
    r.status === 'pending' && isRequestInCurrentPeriod(r)
  );
  const approvedRequests = (vacationRequests || []).filter((r: VacationRequest) => 
    r.status === 'approved' && isRequestInCurrentPeriod(r)
  );

  // Empleados actualmente de vacaciones (tienen solicitud aprobada que incluye hoy)
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const employeesOnVacation = (employees || []).filter((emp: Employee) => {
    // Verificar si tiene alguna solicitud aprobada que incluya hoy
    const hasActiveVacation = (vacationRequests || []).some((request: VacationRequest) => {
      if (request.userId !== emp.id || request.status !== 'approved') return false;
      
      const startDate = request.startDate.split('T')[0]; // Formato YYYY-MM-DD
      const endDate = request.endDate.split('T')[0];
      
      return startDate <= today && endDate >= today;
    });
    return hasActiveVacation;
  });

  // Calcular estadísticas dinámicas
  const getVacationStats = () => {
    const pending = pendingRequests.length;
    const approved = approvedRequests.length;
    const onVacation = employeesOnVacation.length;
    
    // Calcular días festivos del año actual
    const currentYear = new Date().getFullYear();
    const holidaysCount = spanishHolidays.filter(holiday => 
      new Date(holiday.date).getFullYear() === currentYear
    ).length;
    
    return { pending, approved, onVacation, holidaysCount };
  };

  const stats = getVacationStats();

  // Helper function to determine if user can manage a specific request
  const canManageRequest = (request: VacationRequest) => {
    // Admin can manage all requests
    if (user?.role === 'admin') return true;
    
    // Manager can only manage employee requests, not their own
    if (user?.role === 'manager') {
      // Get the user who made the request
      const requestUser = (employees || []).find((emp: Employee) => emp.id === request.userId);
      // Manager cannot manage their own requests, only employee requests
      return requestUser && requestUser.role === 'employee';
    }
    
    // Employees cannot manage any requests
    return false;
  };

  // Helper function to determine if a request can be deleted (instead of reverted)
  // Deletable requests are those that:
  // - Are of type adverse_weather OR
  // - Were auto-approved (autoApprove = true)
  const canDeleteRequest = (request: VacationRequest) => {
    return request.absenceType === 'adverse_weather' || request.autoApprove === true;
  };

  const openRequestModal = (request: VacationRequest, action: 'approve' | 'deny' | 'edit' | 'revert') => {
    setSelectedRequest(request);
    setModalAction(action);
    if (!request.isHourBased) {
      setEditDates({
        startDate: request.startDate ? new Date(request.startDate) : null,
        endDate: request.endDate ? new Date(request.endDate) : null
      });
    }
    setAdminComment("");
    setShowRequestModal(true);
  };

  const handleRequestAction = () => {
    if (!selectedRequest) return;

    if (selectedRequest.isHourBased) {
      // Handle hour-based absence update
      const id = typeof selectedRequest.id === 'string' 
        ? parseInt(selectedRequest.id.replace('hour-', '')) 
        : selectedRequest.id;
      
      const updateData: any = {
        status: modalAction === 'approve' ? 'approved' : 
                modalAction === 'deny' ? 'denied' : 
                modalAction === 'revert' ? 'pending' : 
                selectedRequest.status
      };

      if (adminComment.trim()) {
        updateData.adminComment = adminComment.trim();
      }

      updateHourAbsenceMutation.mutate({ id, ...updateData });
    } else {
      // Handle vacation request update
      const updateData: any = {
        id: selectedRequest.id,
        status: modalAction === 'approve' ? 'approved' : 
                modalAction === 'deny' ? 'denied' : 
                modalAction === 'revert' ? 'pending' : 
                selectedRequest.status
      };

      if (modalAction === 'edit' && editDates.startDate && editDates.endDate) {
        updateData.startDate = editDates.startDate.toISOString().split('T')[0];
        updateData.endDate = editDates.endDate.toISOString().split('T')[0];
        updateData.status = 'approved'; // Auto-approve when editing dates
      }

      if (adminComment.trim()) {
        updateData.adminComment = adminComment.trim();
      }

      updateRequestMutation.mutate(updateData);
    }
  };

  // Handle deletion of vacation requests or hour-based absences
  const handleDeleteRequest = (request: VacationRequest) => {
    if (!canDeleteRequest(request)) {
      toast({
        title: 'Acción no permitida',
        description: 'Esta solicitud no puede ser eliminada',
        variant: 'destructive'
      });
      return;
    }

    if (!canManageRequest(request)) {
      toast({
        title: 'Sin permisos',
        description: 'No tienes permisos para eliminar esta solicitud',
        variant: 'destructive'
      });
      return;
    }

    setDeleteRequestConfirm(request);
  };

  const confirmDeleteRequest = () => {
    if (!deleteRequestConfirm) return;

    if (deleteRequestConfirm.isHourBased) {
      const id = typeof deleteRequestConfirm.id === 'string'
        ? parseInt(deleteRequestConfirm.id.replace('hour-', ''))
        : deleteRequestConfirm.id;
      deleteHourAbsenceMutation.mutate(id);
    } else {
      deleteVacationRequestMutation.mutate(Number(deleteRequestConfirm.id));
    }

    setDeleteRequestConfirm(null);
  };

  // Handle new request creation with file upload
  const handleCreateRequest = async () => {
    if (!newRequestDates.startDate || !newRequestDates.endDate) return;
    if (newRequestSelectedUserIds.length === 0) {
      toast({
        title: 'Error',
        description: 'Debes seleccionar al menos un empleado',
        variant: 'destructive'
      });
      return;
    }

    if (newRequestAbsenceType === 'adverse_weather' && !newRequestIsFullDay) {
      if (!isSameDay(newRequestDates.startDate, newRequestDates.endDate)) {
        toast({
          title: 'Error',
          description: 'Las inclemencias por horas deben ser de un solo dia',
          variant: 'destructive'
        });
        return;
      }
      return handleCreateHourAbsense();
    }

    // Check if it's a single day with hours specified
    if (isSameDay(newRequestDates.startDate, newRequestDates.endDate) && !newRequestIsFullDay) {
      // Hour-based absence
      return handleCreateHourAbsense();
    }

    let attachmentPath: string | undefined;
    
    // Upload attachment if present
    if (newRequestAttachment) {
      setUploadingNewRequestAttachment(true);
      try {
        const formData = new FormData();
        formData.append('file', newRequestAttachment);
        
        const response = await fetchWithUserTokenRefresh('/api/vacation-requests/upload-attachment', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error('Error al subir el archivo');
        }
        
        const data = await response.json();
        attachmentPath = data.path;
      } catch (error) {
        toast({
          title: 'Error',
          description: 'No se pudo subir el archivo adjunto',
          variant: 'destructive'
        });
        setUploadingNewRequestAttachment(false);
        return;
      }
      setUploadingNewRequestAttachment(false);
    }

    if (newRequestAbsenceType === 'adverse_weather') {
      const workingHoursPerDay = typeof companyConfig?.workingHoursPerDay === 'string'
        ? parseFloat(companyConfig.workingHoursPerDay)
        : (Number(companyConfig?.workingHoursPerDay) || 8);

      const workingDates = getWorkingDatesInRange(
        newRequestDates.startDate,
        newRequestDates.endDate,
        newRequestWorkingDays
      );

      if (workingDates.length === 0) {
        toast({
          title: 'Error',
          description: 'El rango seleccionado no contiene dias laborables',
          variant: 'destructive'
        });
        return;
      }

      const requests = workingDates.map((date) =>
        apiRequest('POST', '/api/hour-based-absences', {
          absenceDate: format(date, 'yyyy-MM-dd'),
          hoursStart: '0',
          hoursEnd: workingHoursPerDay.toString(),
          reason: newRequestReason.trim() || undefined,
          absenceType: 'adverse_weather',
          attachmentPath,
          userIds: newRequestSelectedUserIds,
          autoApprove: newRequestAutoApprove,
        })
      );

      await Promise.all(requests);
      queryClient.invalidateQueries({ queryKey: ['/api/hour-based-absences'] });
      setShowNewRequestModal(false);
      setNewRequestDates({ startDate: null, endDate: null });
      setNewRequestHoursStart('09:00');
      setNewRequestHoursEnd('17:00');
      setNewRequestReason('');
      setNewRequestAbsenceType('vacation');
      setNewRequestAttachment(null);
      setNewRequestSelectedUserIds([]);
      setNewRequestEmployeeSearch('');
      setNewRequestAutoApprove(true);
      setNewRequestIsFullDay(true);
      const isSingleRequest = newRequestSelectedUserIds.length <= 1;
      const message = isSingleRequest
        ? 'Inclemencias creadas exitosamente'
        : `${newRequestSelectedUserIds.length} inclemencias creadas exitosamente`;
      toast({ title: message });
      return;
    }

    createRequestMutation.mutate({
      startDate: format(newRequestDates.startDate, 'yyyy-MM-dd'),
      endDate: format(newRequestDates.endDate, 'yyyy-MM-dd'),
      reason: newRequestReason.trim() || undefined,
      absenceType: newRequestAbsenceType,
      attachmentPath,
      userIds: newRequestSelectedUserIds,
      autoApprove: newRequestAutoApprove,
      deductFromVacation: newRequestDeductFromVacation
    });
  };

  // Handle hour-based absence creation
  const handleCreateHourAbsense = async () => {
    if (!newRequestDates.startDate) {
      toast({
        title: 'Error',
        description: 'Debes seleccionar una fecha',
        variant: 'destructive'
      });
      return;
    }

    if (newRequestSelectedUserIds.length === 0) {
      toast({
        title: 'Error',
        description: 'Debes seleccionar al menos un empleado',
        variant: 'destructive'
      });
      return;
    }

    let hoursStart: number;
    let hoursEnd: number;

    // If full day is selected, use configured working hours per day
    if (newRequestIsFullDay) {
      const workingHoursPerDay = typeof companyConfig?.workingHoursPerDay === 'string'
        ? parseFloat(companyConfig.workingHoursPerDay)
        : (Number(companyConfig?.workingHoursPerDay) || 8);
      hoursStart = 0;
      hoursEnd = workingHoursPerDay;
      logger.log('📅 Full day absence - using workingHoursPerDay:', workingHoursPerDay);
    } else {
      // Validate hours format (HH:MM)
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(newRequestHoursStart) || !timeRegex.test(newRequestHoursEnd)) {
        toast({
          title: 'Error',
          description: 'Las horas deben estar en formato HH:MM (00:00 a 23:59)',
          variant: 'destructive'
        });
        return;
      }

      // Convert time strings to decimal
      const [startH, startM] = newRequestHoursStart.split(':').map(Number);
      const [endH, endM] = newRequestHoursEnd.split(':').map(Number);
      hoursStart = startH + startM / 60;
      hoursEnd = endH + endM / 60;
    }

    if (hoursEnd <= hoursStart) {
      toast({
        title: 'Error',
        description: 'La hora de fin debe ser mayor que la hora de inicio',
        variant: 'destructive'
      });
      return;
    }

    let attachmentPath: string | undefined;

    // Upload attachment if present
    if (newRequestAttachment) {
      setUploadingNewRequestAttachment(true);
      try {
        const formData = new FormData();
        formData.append('file', newRequestAttachment);

        const response = await fetchWithUserTokenRefresh('/api/vacation-requests/upload-attachment', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Error al subir el archivo');
        }

        const data = await response.json();
        attachmentPath = data.path;
      } catch (error) {
        toast({
          title: 'Error',
          description: 'No se pudo subir el archivo adjunto',
          variant: 'destructive'
        });
        setUploadingNewRequestAttachment(false);
        return;
      }
      setUploadingNewRequestAttachment(false);
    }

    createHourAbsenceMutation.mutate({
      absenceDate: format(
        new Date(
          newRequestDates.startDate.getFullYear(),
          newRequestDates.startDate.getMonth(),
          newRequestDates.startDate.getDate()
        ),
        'yyyy-MM-dd'
      ),
      hoursStart: hoursStart.toString(),
      hoursEnd: hoursEnd.toString(),
      reason: newRequestReason.trim() || undefined,
      absenceType: newRequestAbsenceType,
      attachmentPath,
      userIds: newRequestSelectedUserIds,
      autoApprove: newRequestAutoApprove
    });
  };

  // Auto-open modal from URL parameters (dashboard navigation)
  useEffect(() => {
    const urlParams = new URLSearchParams(search);
    const requestId = urlParams.get('requestId');
    const action = urlParams.get('action');
    const filter = urlParams.get('filter');
    
    // Handle filter parameter (from dashboard quick access)
    if (filter === 'pending') {
      setActiveTab('requests');
      setSelectedStatus('pending');
      // Clean URL after applying filter
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // Handle requestId and action (from dashboard direct action)
    if (requestId && action && vacationRequests.length > 0) {
      const request = vacationRequests.find(r => r.id === parseInt(requestId));
      if (request && ['approve', 'deny', 'edit'].includes(action)) {
        setActiveTab('requests'); // Switch to requests tab
        openRequestModal(request, action as 'approve' | 'deny' | 'edit');
        // Clean URL after opening modal
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [search, vacationRequests]);

  return (
    <div>
      <StatsCardGrid columns={4}>
        <StatsCard
          label="Pendientes"
          value={stats.pending}
          color="yellow"
          icon={Clock}
          onClick={() => {
            setActiveTab('requests');
            setSelectedStatus('pending');
          }}
          isLoading={loadingRequests}
          index={0}
          data-testid="stat-pending-requests"
        />
        <StatsCard
          label="Aprobadas"
          value={stats.approved}
          color="green"
          icon={Check}
          onClick={() => {
            setActiveTab('requests');
            setSelectedStatus('approved');
          }}
          isLoading={loadingRequests}
          index={1}
          data-testid="stat-approved-requests"
        />
        <StatsCard
          label="De Ausencia"
          value={stats.onVacation}
          color="blue"
          icon={Plane}
          onClick={() => setActiveTab('employees')}
          isLoading={loadingRequests || loadingEmployees}
          index={2}
          data-testid="stat-on-vacation"
        />
        <StatsCard
          label="Días Festivos"
          value={spanishHolidays.length}
          color="purple"
          icon={CalendarDays}
          onClick={() => setActiveTab('holidays')}
          isLoading={false}
          index={3}
          data-testid="stat-holidays"
        />
      </StatsCardGrid>


      {/* Tabs Navigation */}
      <TabNavigation
        tabs={[
          { id: 'employees', label: 'Calendario', icon: GanttChart },
          { id: 'requests', label: 'Solicitudes', icon: Clock, badge: pendingRequests.length },
          { id: 'holidays', label: 'Días Festivos', icon: CalendarDays }
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      {/* Content based on active tab */}
      <div>
          {activeTab === 'requests' && (
            <div className="space-y-4">
              {/* Filtros - Desktop */}
              <div className="hidden md:flex items-center gap-3">
                {/* Contador de solicitudes */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg">
                  <span className="text-sm font-medium text-foreground">{filteredRequests.length}</span>
                  <span className="text-sm text-muted-foreground">solicitudes</span>
                </div>
                
                <EmployeeScopeDropdown
                  employees={employees.map((employee) => ({ id: employee.id, fullName: employee.fullName }))}
                  teams={teams.map((team) => ({ id: team.id, name: team.name }))}
                  value={
                    selectedTeamId !== 'all'
                      ? { type: 'team', id: parseInt(selectedTeamId, 10) }
                      : selectedEmployeeId !== 'all'
                        ? { type: 'employee', id: parseInt(selectedEmployeeId, 10) }
                        : { type: 'all' }
                  }
                  onChange={(value) => {
                    if (value.type === 'all') {
                      setSelectedEmployeeId('all');
                      setSelectedTeamId('all');
                      return;
                    }

                    if (value.type === 'team') {
                      setSelectedTeamId(String(value.id));
                      setSelectedEmployeeId('all');
                      return;
                    }

                    setSelectedEmployeeId(String(value.id));
                    setSelectedTeamId('all');
                  }}
                  buttonClassName="w-[180px] justify-between font-normal"
                  contentClassName="w-[240px] p-0"
                />
                
                {/* Filtro Tipo de Ausencia */}
                <Select value={selectedAbsenceType} onValueChange={setSelectedAbsenceType}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los tipos</SelectItem>
                    {Object.entries(ABSENCE_TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {/* Filtro Estado */}
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="pending">Pendientes</SelectItem>
                    <SelectItem value="approved">Aprobadas</SelectItem>
                    <SelectItem value="denied">Denegadas</SelectItem>
                  </SelectContent>
                </Select>
                
                {/* Espaciador flexible */}
                <div className="flex-1" />
                
                {/* Botón Nueva Solicitud */}
                {(user?.role === 'admin' || user?.role === 'manager') && (
                  <Button 
                    size="sm" 
                    className="bg-[#007AFF] hover:bg-[#0056CC]"
                    onClick={() => setShowNewRequestModal(true)}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Nueva Solicitud
                  </Button>
                )}
              </div>
              
              {/* Filtros - Mobile */}
              <div className="md:hidden space-y-3">
                {/* Primera fila: Contador + Botón Nueva */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg">
                    <span className="text-sm font-medium text-foreground">{filteredRequests.length}</span>
                    <span className="text-sm text-muted-foreground">solicitudes</span>
                  </div>
                  {(user?.role === 'admin' || user?.role === 'manager') && (
                    <Button 
                      size="sm" 
                      className="bg-[#007AFF] hover:bg-[#0056CC]"
                      onClick={() => setShowNewRequestModal(true)}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Nueva
                    </Button>
                  )}
                </div>
                
                {/* Segunda fila: Filtros en grid 2x2 */}
                <div className="grid grid-cols-2 gap-2">
                  <EmployeeScopeDropdown
                    employees={employees.map((employee) => ({ id: employee.id, fullName: employee.fullName }))}
                    teams={teams.map((team) => ({ id: team.id, name: team.name }))}
                    value={
                      selectedTeamId !== 'all'
                        ? { type: 'team', id: parseInt(selectedTeamId, 10) }
                        : selectedEmployeeId !== 'all'
                          ? { type: 'employee', id: parseInt(selectedEmployeeId, 10) }
                          : { type: 'all' }
                    }
                    onChange={(value) => {
                      if (value.type === 'all') {
                        setSelectedEmployeeId('all');
                        setSelectedTeamId('all');
                        return;
                      }

                      if (value.type === 'team') {
                        setSelectedTeamId(String(value.id));
                        setSelectedEmployeeId('all');
                        return;
                      }

                      setSelectedEmployeeId(String(value.id));
                      setSelectedTeamId('all');
                    }}
                    allLabel="Todos los empleados"
                    buttonPlaceholder="Empleado"
                    buttonClassName="w-full justify-between font-normal text-xs h-9"
                    contentClassName="w-[240px] p-0"
                  />

                  <Select value={selectedAbsenceType} onValueChange={setSelectedAbsenceType}>
                    <SelectTrigger className="w-full h-9 text-xs">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los tipos</SelectItem>
                      {Object.entries(ABSENCE_TYPE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="w-full h-9 text-xs">
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="pending">Pendientes</SelectItem>
                      <SelectItem value="approved">Aprobadas</SelectItem>
                      <SelectItem value="denied">Denegadas</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedEmployeeId('all');
                      setSelectedTeamId('all');
                      setSelectedAbsenceType('all');
                      setSelectedStatus('pending');
                    }}
                    className="h-9"
                  >
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Reset
                  </Button>
                </div>

                {/* End mobile filters */}
              </div>

                {filteredRequests.length === 0 ? (
                  <ListEmptyState
                    title={vacationRequests.length === 0 
                  ? "No hay solicitudes de ausencias" 
                  : selectedStatus === 'pending'
                  ? "No hay solicitudes pendientes"
                  : "No se encontraron solicitudes con los filtros aplicados"}
                subtitle={vacationRequests.length === 0 
                  ? "Las solicitudes de ausencias aparecerán aquí"
                  : selectedStatus === 'pending'
                  ? "Todas las solicitudes han sido procesadas"
                  : `Total de solicitudes: ${vacationRequests.length}`}
              />
            ) : (
              <div className="space-y-3">
                {/* Current period requests without label */}
                {currentPeriodRequests.length > 0 && (
                  <>
                    {visibleCurrentPeriodRequests.map((request: VacationRequest, requestIndex: number) => {
                      const absenceType = request.absenceType || 'vacation';
                      const AbsenceIcon = ABSENCE_TYPE_ICONS[absenceType] || Plane;
                      const absenceLabel = ABSENCE_TYPE_LABELS[absenceType] || 'Vacaciones';
                      const absenceColors = ABSENCE_TYPE_COLORS[absenceType] || ABSENCE_TYPE_COLORS.vacation;
                      const workingHoursPerDay = typeof companyConfig?.workingHoursPerDay === 'string'
                        ? parseFloat(companyConfig.workingHoursPerDay)
                        : (Number(companyConfig?.workingHoursPerDay) || 8);
                      const hoursStartValue = typeof request.hoursStart === 'number' ? request.hoursStart : Number(request.hoursStart || 0);
                      const hoursEndValue = typeof request.hoursEnd === 'number' ? request.hoursEnd : Number(request.hoursEnd || 0);
                      const isFullDayAdverse = request.isHourBased
                        && absenceType === 'adverse_weather'
                        && Math.abs(hoursStartValue) < 0.01
                        && Math.abs(hoursEndValue - workingHoursPerDay) < 0.01;
                      const hourAbsenceDateLabel = request.isHourBased && request.absenceDate
                        ? format(parseDateOnlyLocal(String(request.absenceDate)), 'dd/MM/yyyy', { locale: es })
                        : null;
                      const hourRangeLabel = request.hoursStart !== undefined && request.hoursEnd !== undefined
                        ? `${Math.floor(request.hoursStart)}:${String(Math.round((request.hoursStart % 1) * 60)).padStart(2, '0')} - ${Math.floor(request.hoursEnd)}:${String(Math.round((request.hoursEnd % 1) * 60)).padStart(2, '0')}`
                        : "N/A";
                      const daysCount = request.startDate && request.endDate 
                        ? calculateDays(request.startDate, request.endDate)
                        : request.days || 0;
                      const statusVisuals: Record<string, { stripe: string; headerBg: string; text: string; label: string; sectionBg: string; sectionText: string }> = {
                        pending: {
                          stripe: 'bg-amber-500',
                          headerBg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/50',
                          text: 'text-amber-700 dark:text-amber-300',
                          label: 'Pendiente',
                          sectionBg: 'bg-amber-100 dark:bg-amber-900/40',
                          sectionText: 'text-amber-700 dark:text-amber-300',
                        },
                        approved: {
                          stripe: 'bg-emerald-500',
                          headerBg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/50',
                          text: 'text-emerald-700 dark:text-emerald-300',
                          label: 'Aprobada',
                          sectionBg: 'bg-emerald-100 dark:bg-emerald-900/40',
                          sectionText: 'text-emerald-700 dark:text-emerald-300',
                        },
                        denied: {
                          stripe: 'bg-rose-500',
                          headerBg: 'bg-rose-50 dark:bg-rose-950/30 border-rose-100 dark:border-rose-900/50',
                          text: 'text-rose-700 dark:text-rose-300',
                          label: 'Denegada',
                          sectionBg: 'bg-rose-100 dark:bg-rose-900/40',
                          sectionText: 'text-rose-700 dark:text-rose-300',
                        },
                      };
                      const statusStyle = statusVisuals[request.status] || statusVisuals.pending;
                      
                      return (
                        <div
                          key={`current-${request.id}`}
                          className={`relative bg-card dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-all hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600${showWaveLoading ? ` row-wave-loading row-wave-${requestIndex % 15}` : ''}`}
                        >
                      {/* Mobile: stripe en la derecha */}
                      <div className={`md:hidden absolute right-0 top-0 h-full w-1 ${statusStyle.stripe}`} />

                      {/* Desktop - fila con grid proporcional */}
                      <div className="hidden md:flex items-stretch min-w-0">
                        {/* Contenido principal con grid proporcional - nunca corta textos */}
                        <div className="flex-1 grid items-center px-4 py-3 gap-2 lg:gap-3 min-w-0" style={{ gridTemplateColumns: 'minmax(120px,1.8fr) minmax(180px,1.6fr) minmax(50px,auto) auto auto minmax(0,0.3fr) auto auto' }}>
                          {/* Nombre y tipo de ausencia en dos filas */}
                          <div className="flex items-center gap-2 min-w-0">
                            <AbsenceIcon className={`w-5 h-5 flex-shrink-0 ${absenceColors.text}`} />
                            <div className="min-w-0">
                              <span className="text-[10px] text-gray-500 dark:text-gray-400 block">{request.user?.fullName}</span>
                              <h3 className={`font-semibold ${absenceColors.text} truncate text-sm leading-tight`}>
                                {absenceLabel}
                              </h3>
                            </div>
                          </div>
                          
                          {/* Fechas o Horas */}
                          <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                            {request.isHourBased ? (
                              <>
                                <CalendarDays className="w-4 h-4 flex-shrink-0" />
                                <div className="leading-tight">
                                  <div className="whitespace-nowrap font-medium text-gray-700 dark:text-gray-300">
                                    {hourAbsenceDateLabel || 'N/A'}
                                  </div>
                                  {!isFullDayAdverse && (
                                    <div className="whitespace-nowrap text-xs flex items-center gap-1">
                                      <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                                      <span>{hourRangeLabel}</span>
                                    </div>
                                  )}
                                </div>
                              </>
                            ) : (
                              <>
                                <CalendarDays className="w-4 h-4 flex-shrink-0" />
                                <span className="whitespace-nowrap">
                                  {request.startDate && request.endDate 
                                    ? formatVacationDatesShort(request.startDate, request.endDate)
                                    : "N/A"}
                                </span>
                              </>
                            )}
                          </div>
                          
                          {/* Días o Horas totales */}
                          <div>
                            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                              {request.isHourBased ? (
                                <>
                                  {isFullDayAdverse ? '1 dia' : `${request.totalHours?.toFixed(2)}h`}
                                </>
                              ) : (
                                <>
                                  {daysCount}d
                                </>
                              )}
                            </span>
                          </div>
                          
                          {/* Icono de notas si hay motivo */}
                          <div className="flex justify-center w-8">
                            {request.reason && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button 
                                    className="p-1 rounded-md hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <FileText className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-72 p-4" side="top">
                                  <div className="space-y-2">
                                    <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100">Observaciones del empleado</h4>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">{request.reason}</p>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>
                          
                          {/* Icono de descarga si hay archivo adjunto */}
                          <div className="flex justify-center w-8">
                            {request.attachmentPath && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button 
                                      className="p-1 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setPreviewDoc({
                                          url: `/api/vacation-requests/${request.id}/attachment`,
                                          filename: `Justificante_${request.user?.fullName || 'Solicitud'}`
                                        });
                                      }}
                                    >
                                      <Eye className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    <p className="text-sm">Ver justificante</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                          
                          {/* Espaciador flexible */}
                          <div />
                          
                          {/* Fecha solicitud */}
                          <div className="text-right whitespace-nowrap">
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              {request.requestDate ? format(new Date(request.requestDate), "dd MMM yyyy", { locale: es }) : 
                               request.createdAt ? format(new Date(request.createdAt), "dd MMM yyyy", { locale: es }) : ""}
                            </span>
                          </div>
                          
                          {/* Acciones - ancho mínimo fijo para mantener armonía */}
                          <div className="flex items-center justify-center gap-1 min-w-[100px]">
                            {request.status === 'pending' && canManageRequest(request) ? (
                              <>
                                <button
                                  onClick={(e) => { e.stopPropagation(); openRequestModal(request, 'approve'); }}
                                  className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
                                  title="Aprobar"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); openRequestModal(request, 'edit'); }}
                                  className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                                  title="Editar"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); openRequestModal(request, 'deny'); }}
                                  className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
                                  title="Denegar"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            ) : request.status === 'pending' ? (
                              <span className="text-xs text-amber-600 dark:text-amber-400">Sin permisos</span>
                            ) : canManageRequest(request) ? (
                              canDeleteRequest(request) ? (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteRequest(request); }}
                                  className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                  title="Eliminar"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              ) : (
                                <button
                                  onClick={(e) => { e.stopPropagation(); openRequestModal(request, 'revert'); }}
                                  className="p-1.5 rounded-lg text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/30 transition-colors"
                                  title="Revertir"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                              )
                            ) : null}
                          </div>
                        </div>
                        
                        {/* Sección coloreada de estado - punta derecha */}
                        <div className={`w-[90px] flex items-center justify-center flex-shrink-0 ${statusStyle.sectionBg}`}>
                          <span className={`text-xs font-semibold ${statusStyle.sectionText}`}>
                            {statusStyle.label}
                          </span>
                        </div>
                      </div>

                      {/* Contenido móvil */}
                      <div className="md:hidden px-4 py-3 space-y-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <AbsenceIcon className={`w-4 h-4 ${absenceColors.text}`} />
                              <span className={`text-xs font-medium ${absenceColors.text}`}>{absenceLabel}</span>
                            </div>
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                              {request.user?.fullName}
                            </h3>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                              <CalendarDays className="w-4 h-4" />
                              <span>
                                {request.startDate && request.endDate 
                                  ? formatVacationDatesShort(request.startDate, request.endDate)
                                  : "N/A"}
                              </span>
                            </div>
                            <div className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-xs font-medium text-gray-700 dark:text-gray-300">
                              {daysCount} {daysCount === 1 ? 'día' : 'días'}
                            </div>
                          </div>

                          {request.reason && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {request.reason}
                            </p>
                          )}

                          <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              Solicitado {request.requestDate ? format(new Date(request.requestDate), "dd MMM", { locale: es }) : 
                               request.createdAt ? format(new Date(request.createdAt), "dd MMM", { locale: es }) : "N/A"}
                            </span>
                            
                            <div className="flex items-center gap-1">
                              {request.status === 'pending' && canManageRequest(request) ? (
                                <>
                                  <button
                                    onClick={() => openRequestModal(request, 'approve')}
                                    className="p-2 rounded-xl text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
                                  >
                                    <Check className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => openRequestModal(request, 'edit')}
                                    className="p-2 rounded-xl text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                                  >
                                    <Edit className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => openRequestModal(request, 'deny')}
                                    className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
                                  >
                                    <X className="w-5 h-5" />
                                  </button>
                                </>
                              ) : request.status === 'pending' ? (
                                <span className="text-xs text-amber-600 dark:text-amber-400">
                                  Sin permisos
                                </span>
                              ) : (
                                canManageRequest(request) && (
                                  canDeleteRequest(request) ? (
                                    <button
                                      onClick={() => handleDeleteRequest(request)}
                                      className="p-2 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                    >
                                      <Trash2 className="w-5 h-5" />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => openRequestModal(request, 'revert')}
                                      className="p-2 rounded-xl text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/30 transition-colors"
                                    >
                                      <RotateCcw className="w-5 h-5" />
                                    </button>
                                  )
                                )
                              )}
                            </div>
                          </div>
                      </div>
                    </div>
                      );
                    })}

                    {hasMoreCurrentRequests && (
                      <div ref={loadMoreCurrentRequestsRef} className="py-3 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            Mostrando {visibleCurrentPeriodRequests.length} de {currentPeriodRequests.length} solicitudes del período actual
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setDisplayedCurrentRequestsCount((prev) => Math.min(prev + REQUESTS_PER_LOAD, currentPeriodRequests.length))}
                          >
                            Cargar más
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Periodo anterior con fechas */}
                {previousPeriodRequests.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 my-6">
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent"></div>
                      <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full border border-gray-200 dark:border-gray-700">
                        Período {format(previousVacationPeriod.periodStart, 'd MMM yyyy', { locale: es })} - {format(previousVacationPeriod.periodEnd, 'd MMM yyyy', { locale: es })}
                      </span>
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent"></div>
                    </div>
                    {visiblePreviousPeriodRequests.map((request: VacationRequest, requestIndex: number) => {
                      const absenceType = request.absenceType || 'vacation';
                      const AbsenceIcon = ABSENCE_TYPE_ICONS[absenceType] || Plane;
                      const absenceLabel = ABSENCE_TYPE_LABELS[absenceType] || 'Vacaciones';
                      const absenceColors = ABSENCE_TYPE_COLORS[absenceType] || ABSENCE_TYPE_COLORS.vacation;
                      const workingHoursPerDay = typeof companyConfig?.workingHoursPerDay === 'string'
                        ? parseFloat(companyConfig.workingHoursPerDay)
                        : (Number(companyConfig?.workingHoursPerDay) || 8);
                      const hoursStartValue = typeof request.hoursStart === 'number' ? request.hoursStart : Number(request.hoursStart || 0);
                      const hoursEndValue = typeof request.hoursEnd === 'number' ? request.hoursEnd : Number(request.hoursEnd || 0);
                      const isFullDayAdverse = request.isHourBased
                        && absenceType === 'adverse_weather'
                        && Math.abs(hoursStartValue) < 0.01
                        && Math.abs(hoursEndValue - workingHoursPerDay) < 0.01;
                      const hourAbsenceDateLabel = request.isHourBased && request.absenceDate
                        ? format(parseDateOnlyLocal(String(request.absenceDate)), 'dd/MM/yyyy', { locale: es })
                        : null;
                      const hourRangeLabel = request.hoursStart !== undefined && request.hoursEnd !== undefined
                        ? `${Math.floor(request.hoursStart)}:${String(Math.round((request.hoursStart % 1) * 60)).padStart(2, '0')} - ${Math.floor(request.hoursEnd)}:${String(Math.round((request.hoursEnd % 1) * 60)).padStart(2, '0')}`
                        : "N/A";
                      const daysCount = request.startDate && request.endDate 
                        ? calculateDays(request.startDate, request.endDate)
                        : request.days || 0;
                      const statusVisuals: Record<string, { stripe: string; headerBg: string; text: string; label: string; sectionBg: string; sectionText: string }> = {
                        pending: {
                          stripe: 'bg-amber-500',
                          headerBg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/50',
                          text: 'text-amber-700 dark:text-amber-300',
                          label: 'Pendiente',
                          sectionBg: 'bg-amber-100 dark:bg-amber-900/40',
                          sectionText: 'text-amber-700 dark:text-amber-300',
                        },
                        approved: {
                          stripe: 'bg-emerald-500',
                          headerBg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/50',
                          text: 'text-emerald-700 dark:text-emerald-300',
                          label: 'Aprobada',
                          sectionBg: 'bg-emerald-100 dark:bg-emerald-900/40',
                          sectionText: 'text-emerald-700 dark:text-emerald-300',
                        },
                        denied: {
                          stripe: 'bg-rose-500',
                          headerBg: 'bg-rose-50 dark:bg-rose-950/30 border-rose-100 dark:border-rose-900/50',
                          text: 'text-rose-700 dark:text-rose-300',
                          label: 'Denegada',
                          sectionBg: 'bg-rose-100 dark:bg-rose-900/40',
                          sectionText: 'text-rose-700 dark:text-rose-300',
                        },
                      };
                      const statusStyle = statusVisuals[request.status] || statusVisuals.pending;
                      
                      return (
                        <div
                          key={`previous-${request.id}`}
                          className={`relative bg-card dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-all hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 opacity-60${showWaveLoading ? ` row-wave-loading row-wave-${requestIndex % 15}` : ''}`}
                        >
                      {/* Mobile: stripe en la derecha */}
                      <div className={`md:hidden absolute right-0 top-0 h-full w-1 ${statusStyle.stripe}`} />

                      {/* Desktop - fila con grid proporcional */}
                      <div className="hidden md:flex items-stretch min-w-0">
                        {/* Contenido principal con grid proporcional - nunca corta textos */}
                        <div className="flex-1 grid items-center px-4 py-3 gap-2 lg:gap-3 min-w-0" style={{ gridTemplateColumns: 'minmax(120px,1.8fr) minmax(180px,1.6fr) minmax(50px,auto) auto auto minmax(0,0.3fr) auto auto' }}>
                          {/* Nombre y tipo de ausencia en dos filas */}
                          <div className="flex items-center gap-2 min-w-0">
                            <AbsenceIcon className={`w-5 h-5 flex-shrink-0 ${absenceColors.text}`} />
                            <div className="min-w-0">
                              <span className="text-[10px] text-gray-500 dark:text-gray-400 block">{request.user?.fullName}</span>
                              <h3 className={`font-semibold ${absenceColors.text} truncate text-sm leading-tight`}>
                                {absenceLabel}
                              </h3>
                            </div>
                          </div>
                          
                          {/* Fechas o Horas */}
                          <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                            {request.isHourBased ? (
                              <>
                                <CalendarDays className="w-4 h-4 flex-shrink-0" />
                                <div className="leading-tight">
                                  <div className="whitespace-nowrap font-medium text-gray-700 dark:text-gray-300">
                                    {hourAbsenceDateLabel || 'N/A'}
                                  </div>
                                  {!isFullDayAdverse && (
                                    <div className="whitespace-nowrap text-xs flex items-center gap-1">
                                      <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                                      <span>{hourRangeLabel}</span>
                                    </div>
                                  )}
                                </div>
                              </>
                            ) : (
                              <>
                                <CalendarDays className="w-4 h-4 flex-shrink-0" />
                                <span className="whitespace-nowrap">
                                  {request.startDate && request.endDate 
                                    ? formatVacationDatesShort(request.startDate, request.endDate)
                                    : "N/A"}
                                </span>
                              </>
                            )}
                          </div>
                          
                          {/* Días o Horas totales */}
                          <div>
                            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                              {request.isHourBased ? (
                                <>
                                  {isFullDayAdverse ? '1 dia' : `${request.totalHours?.toFixed(2)}h`}
                                </>
                              ) : (
                                <>
                                  {daysCount}d
                                </>
                              )}
                            </span>
                          </div>

                          {/* Icono de notas si hay motivo */}
                          <div className="flex justify-center w-8">
                            {request.reason && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button 
                                    className="p-1 rounded-md hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <FileText className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-72 p-4" side="top">
                                  <div className="space-y-2">
                                    <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100">
                                      {request.assignedByAdmin ? 'Comentario del administrador' : 'Observaciones del empleado'}
                                    </h4>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">{request.reason}</p>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>
                          
                          {/* Icono de descarga si hay archivo adjunto */}
                          <div className="flex justify-center w-8">
                            {request.attachmentPath && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button 
                                      className="p-1 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setPreviewDoc({
                                          url: `/api/vacation-requests/${request.id}/attachment`,
                                          filename: `Justificante_${request.user?.fullName || 'Solicitud'}`
                                        });
                                      }}
                                    >
                                      <Eye className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    <p className="text-sm">Ver justificante</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                          
                          {/* Espaciador flexible */}
                          <div />
                          
                          {/* Fecha solicitud */}
                          <div className="text-right whitespace-nowrap">
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              {request.requestDate ? format(new Date(request.requestDate), "dd MMM yyyy", { locale: es }) : 
                               request.createdAt ? format(new Date(request.createdAt), "dd MMM yyyy", { locale: es }) : ""}
                            </span>
                          </div>
                          
                          {/* Acciones - ancho mínimo fijo para mantener armonía */}
                          <div className="flex items-center justify-center gap-1 min-w-[100px]">
                            {request.status === 'pending' && request.assignedByAdmin ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteRequest(request);
                                }}
                                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : request.status === 'pending' && canManageRequest(request) ? (
                              <>
                                <button
                                  onClick={(e) => { e.stopPropagation(); openRequestModal(request, 'approve'); }}
                                  className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
                                  title="Aprobar"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); openRequestModal(request, 'edit'); }}
                                  className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                                  title="Editar"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); openRequestModal(request, 'deny'); }}
                                  className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
                                  title="Denegar"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            ) : request.status === 'pending' ? (
                              <span className="text-xs text-amber-600 dark:text-amber-400">Sin permisos</span>
                            ) : canManageRequest(request) ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); openRequestModal(request, 'revert'); }}
                                className="p-1.5 rounded-lg text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/30 transition-colors"
                                title="Revertir"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            ) : null}
                          </div>
                        </div>
                        
                        {/* Sección coloreada de estado - punta derecha */}
                        <div className={`w-[90px] flex items-center justify-center flex-shrink-0 ${statusStyle.sectionBg}`}>
                          <span className={`text-xs font-semibold ${statusStyle.sectionText}`}>
                            {statusStyle.label}
                          </span>
                        </div>
                      </div>

                      {/* Contenido móvil */}
                      <div className="md:hidden px-4 py-3 space-y-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <AbsenceIcon className={`w-4 h-4 ${absenceColors.text}`} />
                              <span className={`text-xs font-medium ${absenceColors.text}`}>{absenceLabel}</span>
                            </div>
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                              {request.user?.fullName}
                            </h3>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                              <CalendarDays className="w-4 h-4" />
                              <span>
                                {request.startDate && request.endDate 
                                  ? formatVacationDatesShort(request.startDate, request.endDate)
                                  : "N/A"}
                              </span>
                            </div>
                            <div className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-xs font-medium text-gray-700 dark:text-gray-300">
                              {daysCount} {daysCount === 1 ? 'día' : 'días'}
                            </div>
                          </div>

                          {request.reason && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {request.reason}
                            </p>
                          )}

                          <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              Solicitado {request.requestDate ? format(new Date(request.requestDate), "dd MMM yyyy", { locale: es }) : 
                               request.createdAt ? format(new Date(request.createdAt), "dd MMM yyyy", { locale: es }) : ""}
                            </span>
                            
                            <div className="flex items-center gap-1">
                              {request.status === 'pending' && request.assignedByAdmin ? (
                                <button
                                  onClick={() => handleDeleteRequest(request)}
                                  className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              ) : request.status === 'pending' && canManageRequest(request) ? (
                                <>
                                  <button
                                    onClick={() => openRequestModal(request, 'approve')}
                                    className="p-2 rounded-xl text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
                                  >
                                    <Check className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => openRequestModal(request, 'edit')}
                                    className="p-2 rounded-xl text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                                  >
                                    <Edit className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => openRequestModal(request, 'deny')}
                                    className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
                                  >
                                    <X className="w-5 h-5" />
                                  </button>
                                </>
                              ) : request.status === 'pending' ? (
                                <span className="text-xs text-amber-600 dark:text-amber-400">
                                  Sin permisos
                                </span>
                              ) : (
                                canManageRequest(request) && (
                                  canDeleteRequest(request) ? (
                                    <button
                                      onClick={() => handleDeleteRequest(request)}
                                      className="p-2 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                    >
                                      <Trash2 className="w-5 h-5" />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => openRequestModal(request, 'revert')}
                                      className="p-2 rounded-xl text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/30 transition-colors"
                                    >
                                      <RotateCcw className="w-5 h-5" />
                                    </button>
                                  )
                                )
                              )}
                            </div>
                          </div>
                      </div>
                    </div>
                      );
                    })}

                    {hasMorePreviousRequests && (
                      <div ref={loadMorePreviousRequestsRef} className="py-3 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            Mostrando {visiblePreviousPeriodRequests.length} de {previousPeriodRequests.length} solicitudes de períodos anteriores
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setDisplayedPreviousRequestsCount((prev) => Math.min(prev + REQUESTS_PER_LOAD, previousPeriodRequests.length))}
                          >
                            Cargar más
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            </div>
          )}

          {activeTab === 'employees' && (
            <div className="space-y-6">
              {/* Timeline de Vacaciones tipo Gantt */}
              {employees.length === 0 && !loadingEmployees ? (
                <div className="text-center py-12">
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                      <Users className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div className="text-foreground font-medium">
                      No hay empleados registrados
                    </div>
                    <div className="text-muted-foreground text-sm">
                      Añade empleados para ver el cuadrante
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-card dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                  {/* Desktop: Header con controles */}
                  <div className="hidden md:block p-4 border-b bg-muted/20">
                    {/* Header unificado con controles y leyenda */}
                    <div className="flex items-center justify-between">
                      {/* Leyenda de colores y controles de navegación compactos */}
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
                            <span>Aprobado</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-yellow-400 rounded-sm"></div>
                            <span>Pendiente</span>
                          </div>
                        </div>
                        
                        {/* Navegación compacta del timeline */}
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigateTimeline('prev')}
                            className="h-8 w-8 p-0"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          
                          <div className="text-center min-w-[140px]">
                            <span className="text-sm font-medium text-foreground">
                              {timelineViewMode === 'week'
                                ? `${format(startOfWeek(timelineViewDate, { weekStartsOn: 1 }), "d MMM", { locale: es })} - ${format(endOfWeek(timelineViewDate, { weekStartsOn: 1 }), "d MMM yyyy", { locale: es })}`
                                : timelineViewMode === 'month' 
                                  ? format(timelineViewDate, "MMM yyyy", { locale: es })
                                  : `${format(subMonths(timelineViewDate, 1), "MMM", { locale: es })} - ${format(addMonths(timelineViewDate, 1), "MMM yyyy", { locale: es })}`
                              }
                            </span>
                          </div>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigateTimeline('next')}
                            className="h-8 w-8 p-0"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Opciones de vista compactas */}
                      <div className="flex items-center gap-1">
                        <Button
                          variant={timelineViewMode === 'week' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => setTimelineViewMode('week')}
                          className="h-8 px-3 text-xs"
                        >
                          Semana
                        </Button>
                        <Button
                          variant={timelineViewMode === 'month' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => setTimelineViewMode('month')}
                          className="h-8 px-3 text-xs"
                        >
                          Mes
                        </Button>
                        <Button
                          variant={timelineViewMode === 'quarter' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => setTimelineViewMode('quarter')}
                          className="h-8 px-3 text-xs"
                        >
                          Trimestre
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowExportModal(true)}
                          className="h-8 px-3 text-xs ml-2"
                        >
                          <Download className="w-3 h-3 mr-1" />
                          Exportar
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Mobile: Header compacto */}
                  <div className="md:hidden p-3 border-b bg-muted space-y-3">
                    {/* Leyenda móvil */}
                    <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <div className="w-2.5 h-2.5 bg-green-500 rounded-sm"></div>
                        <span>Aprobado</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2.5 h-2.5 bg-yellow-400 rounded-sm"></div>
                        <span>Pendiente</span>
                      </div>
                    </div>
                    
                    {/* Controles móviles */}
                    <div className="flex items-center justify-between">
                      {/* Navegación del periodo */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigateTimeline('prev')}
                          className="h-8 w-8 p-0"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        
                        <div className="text-center min-w-[100px]">
                          <span className="text-xs font-medium text-foreground">
                            {timelineViewMode === 'week'
                              ? `${format(startOfWeek(timelineViewDate, { weekStartsOn: 1 }), "d MMM", { locale: es })} - ${format(endOfWeek(timelineViewDate, { weekStartsOn: 1 }), "d MMM yyyy", { locale: es })}`
                              : timelineViewMode === 'month' 
                                ? format(timelineViewDate, "MMM yyyy", { locale: es })
                                : `${format(subMonths(timelineViewDate, 1), "MMM", { locale: es })} - ${format(addMonths(timelineViewDate, 1), "MMM yyyy", { locale: es })}`
                            }
                          </span>
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigateTimeline('next')}
                          className="h-8 w-8 p-0"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      {/* Opciones de vista móvil */}
                      <div className="flex items-center gap-1">
                        <Button
                          variant={timelineViewMode === 'week' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => setTimelineViewMode('week')}
                          className="h-7 px-2 text-xs"
                        >
                          Sem
                        </Button>
                        <Button
                          variant={timelineViewMode === 'month' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => setTimelineViewMode('month')}
                          className="h-7 px-2 text-xs"
                        >
                          Mes
                        </Button>
                        <Button
                          variant={timelineViewMode === 'quarter' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => setTimelineViewMode('quarter')}
                          className="h-7 px-2 text-xs"
                        >
                          Trim
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowExportModal(true)}
                          className="h-7 px-2 text-xs ml-1"
                        >
                          <Download className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Desktop: Lista de Empleados con Timeline */}
                  <div className="hidden md:block divide-y">
                    {visibleTimelineEmployees.map((employee: Employee) => {
                      // Calcular días usados y disponibles (solo dentro del período actual de vacaciones)
                      const employeeRequests = vacationRequests.filter((req: VacationRequest) => 
                        req.userId === employee.id && req.status === 'approved' && req.absenceType === 'vacation'
                      );
                      const usedDays = employeeRequests.reduce((sum, req) => 
                        sum + getVacationDaysInCurrentPeriod(req), 0
                      );
                      const totalDays = Math.round(parseFloat(employee.totalVacationDays) || 0);
                      const availableDays = Math.round(Math.max(0, totalDays - usedDays));
                      const usagePercent = (usedDays / totalDays) * 100;
                      
                      // Calcular horas de inclemencias convertidas a días (las horas ya vienen con el 70% aplicado)
                      const adverseTotal = typeof adverseWeatherHours[employee.id]?.totalHours === 'string' 
                        ? parseFloat(adverseWeatherHours[employee.id].totalHours) 
                        : (adverseWeatherHours[employee.id]?.totalHours || 0);
                      const adverseApprovedRawHours = approvedAdverseRawHoursByEmployee.get(Number(employee.id)) || 0;
                      const adverseUsedFromApprovedAbsences = adverseApprovedRawHours * (adverseRecoveryPercentage / 100);
                      // ALWAYS use approved absences, not the old balance system
                      const adverseUsed = adverseUsedFromApprovedAbsences;
                      
                      const workingHoursPerDay = typeof companyConfig?.workingHoursPerDay === 'string'
                        ? parseFloat(companyConfig.workingHoursPerDay)
                        : (Number(companyConfig?.workingHoursPerDay) || 8);

                      const adverseDaysTotal = Math.round(Math.max(0, adverseTotal) / workingHoursPerDay);
                      const adverseDaysUsed = Math.round(Math.max(0, adverseUsed) / workingHoursPerDay);
                      
                      if (adverseApprovedRawHours > 0) {
                        logger.log(`📊 [TIMELINE] ${employee.fullName}:`, {
                          adverseApprovedRawHours,
                          adverseRecoveryPercentage,
                          adverseUsedFromApprovedAbsences,
                          adverseUsed,
                          workingHoursPerDay,
                          adverseDaysUsed
                        });
                      }
                      const totalWithAdverse = totalDays + adverseDaysTotal;
                      const usedWithAdverse = usedDays + adverseDaysUsed;
                      const usagePercentWithAdverse = totalWithAdverse > 0 ? (usedWithAdverse / totalWithAdverse) * 100 : 0;
                      const formatDays = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));
                      
                      const timelineRange = getTimelineRange();
                      
                      return (
                        <div key={employee.id} className="p-4 hover:bg-muted/10">
                          <div className="flex items-center">
                            {/* Información del Empleado */}
                            <div
                              className="w-72 flex-shrink-0 pr-6 cursor-pointer"
                              onClick={() => setAdverseHoursDialogEmployeeId(employee.id)}
                              title="Ver desglose de ausencias"
                            >
                              <div className="flex items-center gap-3">
                                <UserAvatar fullName={employee.fullName} size="sm" userId={employee.id} profilePicture={employee.profilePicture} />
                                <div className="flex-1">
                                  <h4 className="font-medium text-foreground truncate">
                                    {employee.fullName}
                                  </h4>
                                  <div className="text-xs text-muted-foreground space-y-1">
                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                      <div>
                                        <span className="font-medium">{formatDays(usedDays)}{adverseDaysUsed > 0 ? `+${adverseDaysUsed}` : ''}</span>/{formatDays(totalWithAdverse)} días usados
                                      </div>
                                    </div>
                                      <div className="flex items-center gap-2">
                                        <div
                                          className="flex-1 bg-muted rounded-full h-2 overflow-hidden relative cursor-pointer hover:opacity-90 transition-opacity"
                                          onClick={() => setAdverseHoursDialogEmployeeId(employee.id)}
                                          title="Ver desglose de ausencias"
                                        >
                                        {/* Vacation days bar (blue) */}
                                        <div 
                                          className="bg-primary h-2 absolute left-0 top-0 transition-all duration-700 ease-out"
                                          style={{ width: loadingRequests ? '0%' : `${Math.min(100, (usedDays / totalWithAdverse) * 100)}%` }}
                                        />
                                        {/* Adverse weather days bar (yellow) */}
                                        {adverseDaysUsed > 0 && (
                                          <div 
                                            className="bg-yellow-500 h-2 absolute top-0 transition-all duration-700 ease-out cursor-pointer hover:opacity-90"
                                            style={{ 
                                              width: `${Math.min(100, (adverseDaysUsed / totalWithAdverse) * 100)}%`,
                                              left: `${Math.min(100, (usedDays / totalWithAdverse) * 100)}%`
                                            }}
                                          />
                                        )}
                                      </div>
                                      <span className={`w-14 text-right text-xs font-medium text-green-600 dark:text-green-400 transition-opacity duration-300 ${loadingRequests ? 'opacity-50' : ''}`}>
                                        {formatDays(Math.max(0, Math.round((totalWithAdverse - usedWithAdverse) * 10) / 10))} rest.
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Timeline Horizontal */}
                            <div className="flex-1 relative">
                              {/* Fondo del timeline con marcas de días */}
                              <div className="relative h-14 bg-gray-100 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                                {/* Grid de días (solo mostrar algunos para no saturar) */}
                                {timelineRange.days
                                  .filter((_, index) => index % (timelineViewMode === 'week' ? 1 : timelineViewMode === 'month' ? 3 : 7) === 0)
                                  .map((day, index) => (
                                    <div
                                      key={index}
                                      className="absolute top-0 bottom-0 w-px bg-border"
                                      style={{
                                        left: `${(eachDayOfInterval({
                                          start: timelineRange.start,
                                          end: day
                                        }).length - 1) / timelineRange.days.length * 100}%`
                                      }}
                                    />
                                  ))
                                }
                                
                                {/* Marcadores de inicio de mes */}
                                {timelineRange.days
                                  .filter(day => day.getDate() === 1) // Solo primer día del mes
                                  .map((monthStart, index) => {
                                    const position = (eachDayOfInterval({
                                      start: timelineRange.start,
                                      end: monthStart
                                    }).length - 1) / timelineRange.days.length * 100;
                                    
                                    return (
                                      <div key={`month-${index}`}>
                                        {/* Línea vertical prominente */}
                                        <div
                                          className="absolute top-0 bottom-0 w-0.5 bg-primary z-10"
                                          style={{ left: `${position}%` }}
                                        />
                                      </div>
                                    );
                                  })
                                }
                                
                                {/* Línea vertical roja para el día actual */}
                                {(() => {
                                  const today = new Date();
                                  today.setHours(0, 0, 0, 0);
                                  const rangeStart = new Date(timelineRange.start);
                                  rangeStart.setHours(0, 0, 0, 0);
                                  const rangeEnd = new Date(timelineRange.end);
                                  rangeEnd.setHours(0, 0, 0, 0);
                                  
                                  if (today >= rangeStart && today <= rangeEnd) {
                                    const position = (eachDayOfInterval({
                                      start: timelineRange.start,
                                      end: today
                                    }).length - 1) / timelineRange.days.length * 100;
                                    
                                    return (
                                      <div
                                        className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20"
                                        style={{ left: `${position}%` }}
                                      />
                                    );
                                  }
                                  return null;
                                })()}
                                
                                {/* Contenedor específico para barras de vacaciones */}
                                <div className="absolute inset-0">
                                  {renderVacationBar(employee, timelineRange)}
                                  {renderHourAbsenceIndicators(employee, timelineRange)}
                                </div>
                              </div>
                              
                              {/* Labels de meses debajo del timeline */}
                              <div className="relative text-xs text-primary font-medium mt-2 h-4">
                                {/* Mostrar etiquetas de mes según los marcadores verticales */}
                                {timelineRange.days
                                  .filter(day => day.getDate() === 1) // Solo primer día del mes
                                  .map((monthStart, index) => {
                                    const position = (eachDayOfInterval({
                                      start: timelineRange.start,
                                      end: monthStart
                                    }).length - 1) / timelineRange.days.length * 100;
                                    
                                    return (
                                      <div
                                        key={`month-label-${index}`}
                                        className="absolute transform -translate-x-1/2"
                                        style={{ left: `${position}%` }}
                                      >
                                        {format(monthStart, "MMM", { locale: es })}
                                      </div>
                                    );
                                  })
                                }
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {hasMoreTimelineEmployees && (
                      <div ref={loadMoreTimelineDesktopRef} className="py-3 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            Mostrando {visibleTimelineEmployees.length} de {employees.length} empleados
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setDisplayedTimelineEmployeesCount((prev) => Math.min(prev + EMPLOYEES_PER_LOAD, employees.length))}
                          >
                            Cargar más empleados
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Mobile: Vertical Timeline View */}
                  <div className="md:hidden divide-y">
                    {visibleTimelineEmployees.map((employee: Employee) => {
                      // Calcular días usados y disponibles (solo dentro del período actual de vacaciones)
                      const employeeRequests = vacationRequests.filter((req: VacationRequest) => 
                        req.userId === employee.id && req.status === 'approved' && req.absenceType === 'vacation'
                      );
                      const usedDays = employeeRequests.reduce((sum, req) => 
                        sum + getVacationDaysInCurrentPeriod(req), 0
                      );
                      const totalDays = Math.round(parseFloat(employee.totalVacationDays) || 0);
                      const availableDays = Math.round(Math.max(0, totalDays - usedDays));
                      const usagePercent = (usedDays / totalDays) * 100;
                      
                      // Calcular horas de inclemencias convertidas a días
                      const adverseTotal = typeof adverseWeatherHours[employee.id]?.totalHours === 'string' 
                        ? parseFloat(adverseWeatherHours[employee.id].totalHours) 
                        : (adverseWeatherHours[employee.id]?.totalHours || 0);
                      const adverseApprovedRawHours = approvedAdverseRawHoursByEmployee.get(Number(employee.id)) || 0;
                      const adverseUsedFromApprovedAbsences = adverseApprovedRawHours * (adverseRecoveryPercentage / 100);
                      // ALWAYS use approved absences, not the old balance system
                      const adverseUsed = adverseUsedFromApprovedAbsences;
                      
                      const workingHoursPerDay = typeof companyConfig?.workingHoursPerDay === 'string'
                        ? parseFloat(companyConfig.workingHoursPerDay)
                        : (Number(companyConfig?.workingHoursPerDay) || 8);
                      const adverseDaysTotal = Math.floor(Math.max(0, adverseTotal) / workingHoursPerDay);
                      const adverseDaysUsed = Math.floor(Math.max(0, adverseUsed) / workingHoursPerDay);
                      const totalWithAdverse = totalDays + adverseDaysTotal;
                      const usedWithAdverse = usedDays + adverseDaysUsed;
                      
                      const timelineRange = getTimelineRange();
                      
                      return (
                        <div key={employee.id} className="p-4">
                          {/* Employee Header */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <UserAvatar 
                                fullName={employee.fullName} 
                                size="sm" 
                                userId={employee.id} 
                                profilePicture={employee.profilePicture} 
                              />
                              <div>
                                <h4 className="font-medium text-foreground text-sm">
                                  {employee.fullName}
                                </h4>
                                <div className="text-xs text-muted-foreground">
                                  <span className="font-medium">{usedDays}</span>/{totalDays} días usados
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-medium text-green-600 dark:text-green-400">
                                {availableDays} rest.
                              </div>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className="mb-4">
                            <div className="flex items-center gap-2 mb-1">
                              <div
                                className="flex-1 bg-muted rounded-full h-2 overflow-hidden relative cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => setAdverseHoursDialogEmployeeId(employee.id)}
                                title="Ver desglose de ausencias"
                              >
                                {/* Vacation days bar (blue) */}
                                <div 
                                  className="bg-primary h-2 absolute left-0 top-0 transition-all duration-700 ease-out"
                                  style={{ width: loadingRequests ? '0%' : `${Math.min(100, (usedDays / totalWithAdverse) * 100)}%` }}
                                />
                                {/* Adverse weather days bar (yellow) */}
                                {adverseDaysUsed > 0 && (
                                  <div 
                                    className="bg-yellow-500 h-2 absolute top-0 transition-all duration-700 ease-out cursor-pointer hover:opacity-90"
                                    style={{ 
                                      width: `${Math.min(100, (adverseDaysUsed / totalWithAdverse) * 100)}%`,
                                      left: `${Math.min(100, (usedDays / totalWithAdverse) * 100)}%`
                                    }}
                                  />
                                )}
                              </div>
                            </div>

                          </div>

                          {/* Mobile Timeline */}
                          <div className="relative">
                            {/* Fondo del timeline con marcas de días */}
                            <div 
                              className="relative h-12 bg-gray-100 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 overflow-hidden touch-pan-y select-none"
                              onTouchStart={handleTouchStart}
                              onTouchMove={handleTouchMove}
                              onTouchEnd={handleTouchEnd}
                            >
                              {/* Grid de días (solo mostrar algunos para no saturar en móvil) */}
                              {timelineRange.days
                                .filter((_, index) => index % (timelineViewMode === 'month' ? 5 : 10) === 0)
                                .map((day, index) => (
                                  <div
                                    key={index}
                                    className="absolute top-0 bottom-0 w-px bg-border"
                                    style={{
                                      left: `${(eachDayOfInterval({
                                        start: timelineRange.start,
                                        end: day
                                      }).length - 1) / timelineRange.days.length * 100}%`
                                    }}
                                  />
                                ))
                              }
                              
                              {/* Marcadores de inicio de mes */}
                              {timelineRange.days
                                .filter(day => day.getDate() === 1) // Solo primer día del mes
                                .map((monthStart, index) => {
                                  const position = (eachDayOfInterval({
                                    start: timelineRange.start,
                                    end: monthStart
                                  }).length - 1) / timelineRange.days.length * 100;
                                  
                                  return (
                                    <div key={`month-${index}`}>
                                      {/* Línea vertical prominente */}
                                      <div
                                        className="absolute top-0 bottom-0 w-0.5 bg-primary z-10"
                                        style={{ left: `${position}%` }}
                                      />
                                    </div>
                                  );
                                })
                              }
                              
                              {/* Línea vertical roja para el día actual - Móvil */}
                              {(() => {
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                const rangeStart = new Date(timelineRange.start);
                                rangeStart.setHours(0, 0, 0, 0);
                                const rangeEnd = new Date(timelineRange.end);
                                rangeEnd.setHours(0, 0, 0, 0);
                                
                                if (today >= rangeStart && today <= rangeEnd) {
                                  const position = (eachDayOfInterval({
                                    start: timelineRange.start,
                                    end: today
                                  }).length - 1) / timelineRange.days.length * 100;
                                  
                                  return (
                                    <div
                                      className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20"
                                      style={{ left: `${position}%` }}
                                    />
                                  );
                                }
                                return null;
                              })()}
                              
                              {/* Contenedor específico para barras de vacaciones */}
                              <div className="absolute inset-0">
                                {renderVacationBar(employee, timelineRange)}
                                {renderHourAbsenceIndicators(employee, timelineRange)}
                              </div>
                            </div>
                            
                            {/* Labels de meses debajo del timeline - Móvil simplificado */}
                            <div className="relative text-xs text-primary font-medium mt-1 h-4">
                              {/* Mostrar etiquetas de mes según los marcadores verticales */}
                              {timelineRange.days
                                .filter(day => day.getDate() === 1) // Solo primer día del mes
                                .map((monthStart, index) => {
                                  const position = (eachDayOfInterval({
                                    start: timelineRange.start,
                                    end: monthStart
                                  }).length - 1) / timelineRange.days.length * 100;
                                  
                                  return (
                                    <div
                                      key={`month-label-${index}`}
                                      className="absolute transform -translate-x-1/2"
                                      style={{ left: `${position}%` }}
                                    >
                                      {format(monthStart, "MMM", { locale: es })}
                                    </div>
                                  );
                                })
                              }
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {hasMoreTimelineEmployees && (
                      <div className="py-3 text-center">
                        <div ref={loadMoreTimelineMobileRef} className="h-px w-full" />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() => setDisplayedTimelineEmployeesCount((prev) => Math.min(prev + EMPLOYEES_PER_LOAD, employees.length))}
                        >
                          Cargar más empleados
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'holidays' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 justify-between mb-4">
                <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Seleccionar región" />
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map((region) => (
                      <SelectItem key={region} value={region}>{region}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Dialog open={showAddHoliday} onOpenChange={setShowAddHoliday}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-[#007AFF] hover:bg-[#0056CC]">
                      <Plus className="w-4 h-4 mr-1" />
                      Añadir Festivo
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md max-h-[90vh] sm:max-h-[80vh] overflow-y-auto">
                    <DialogHeader className="pb-4">
                      <DialogTitle className="text-lg sm:text-xl font-semibold text-center">Añadir Día Festivo</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6">
                      {/* Nombre del festivo */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">
                          Nombre del festivo
                        </label>
                        <Input
                          placeholder="Ej: Feria de Sevilla"
                          value={newHoliday.name}
                          onChange={(e) => setNewHoliday(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full"
                        />
                      </div>

                      {/* Selector de período */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">
                          Período del festivo
                        </label>
                        <div className="border rounded-lg p-3 bg-muted/20">
                          <DatePickerPeriod
                            startDate={newHoliday.startDate || undefined}
                            endDate={newHoliday.endDate || undefined}
                            onStartDateChange={(date) => setNewHoliday(prev => ({ ...prev, startDate: date || null }))}
                            onEndDateChange={(date) => setNewHoliday(prev => ({ ...prev, endDate: date || null }))}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Para un solo día, selecciona la misma fecha de inicio y fin
                        </p>
                      </div>

                      {/* Tipo de festivo */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">
                          Tipo de festivo
                        </label>
                        <Select 
                          value={newHoliday.type} 
                          onValueChange={(value: 'national' | 'regional' | 'local') => 
                            setNewHoliday(prev => ({ ...prev, type: value }))
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="national">Nacional</SelectItem>
                            <SelectItem value="regional">Regional</SelectItem>
                            <SelectItem value="local">Local</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Botones */}
                      <div className="flex justify-center sm:justify-end gap-3 pt-4 border-t">
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setShowAddHoliday(false);
                            setNewHoliday({ name: "", startDate: null, endDate: null, type: "regional" });
                          }}
                          className="flex-1 sm:w-auto"
                        >
                          Cancelar
                        </Button>
                        <Button 
                          className="bg-[#007AFF] hover:bg-[#0056CC] flex-1 sm:w-auto"
                          disabled={!newHoliday.name.trim() || !newHoliday.startDate || addHolidayMutation.isPending}
                          onClick={handleAddHoliday}
                        >
                          {addHolidayMutation.isPending ? (
                            <LoadingSpinner size="xs" />
                          ) : (
                            'Añadir Festivo'
                          )}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

              {/* Festivos nacionales */}
              {spanishHolidays.map((holiday, index) => (
                <Card key={`national-${index}`} className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/50">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium text-foreground mb-1">{holiday.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(holiday.date), "dd/MM/yyyy", { locale: es })}
                        </p>
                        <Badge 
                          variant="secondary" 
                          className="mt-2 text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        >
                          {holiday.type === 'national' ? 'Nacional' : 
                           holiday.type === 'regional' ? 'Regional' : 'Local'}
                        </Badge>
                      </div>
                      <MapPin className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Festivos personalizados */}
              {customHolidays.map((holiday: any) => (
                <Card key={`custom-${holiday.id}`} className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/50">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-foreground">{holiday.name}</h3>
                          <Badge 
                            variant="secondary" 
                            className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                          >
                            Personalizado
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {holiday.startDate && holiday.endDate && 
                           format(new Date(holiday.startDate), "dd/MM/yyyy", { locale: es }) === format(new Date(holiday.endDate), "dd/MM/yyyy", { locale: es })
                            ? format(new Date(holiday.startDate), "dd/MM/yyyy", { locale: es }) // Un solo día
                            : `${format(new Date(holiday.startDate), "dd/MM/yyyy", { locale: es })} - ${format(new Date(holiday.endDate), "dd/MM/yyyy", { locale: es })}` // Rango
                          }
                        </p>
                        <Badge 
                          variant="secondary" 
                          className="mt-2 text-xs bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                        >
                          {holiday.type === 'national' ? 'Nacional' : 
                           holiday.type === 'regional' ? 'Regional' : 'Local'}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-100 dark:hover:bg-red-950"
                        onClick={() => deleteCustomHoliday(holiday.id)}
                        title="Eliminar festivo personalizado"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              </div>
            </div>
          )}
        </div>

      {/* Request Management Modal */}
      <Dialog open={showRequestModal} onOpenChange={setShowRequestModal}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {modalAction === 'approve' && <Check className="w-5 h-5 text-green-600" />}
              {modalAction === 'deny' && <X className="w-5 h-5 text-red-600" />}
              {modalAction === 'edit' && <Edit className="w-5 h-5 text-blue-600" />}
              {modalAction === 'revert' && <RotateCcw className="w-5 h-5 text-orange-600" />}
              
              {modalAction === 'approve' && 'Aprobar Solicitud'}
              {modalAction === 'deny' && 'Denegar Solicitud'}
              {modalAction === 'edit' && 'Modificar Solicitud'}
              {modalAction === 'revert' && 'Revertir a Pendiente'}
            </DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/20 rounded-lg">
                <h3 className="font-medium text-foreground mb-1">{selectedRequest.user?.fullName}</h3>
                {selectedRequest.isHourBased ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {selectedRequest.absenceDate ? format(parseDateOnlyLocal(String(selectedRequest.absenceDate)), "dd/MM/yyyy", { locale: es }) : "N/A"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">Horario:</span> {selectedRequest.hoursStart && selectedRequest.hoursEnd 
                        ? `${Math.floor(selectedRequest.hoursStart)}:${String(Math.round((selectedRequest.hoursStart % 1) * 60)).padStart(2, '0')} - ${Math.floor(selectedRequest.hoursEnd)}:${String(Math.round((selectedRequest.hoursEnd % 1) * 60)).padStart(2, '0')}`
                        : "N/A"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">Horas:</span> {typeof selectedRequest.totalHours === 'number' ? selectedRequest.totalHours.toFixed(2) : (parseFloat(String(selectedRequest.totalHours || 0)).toFixed(2))}h
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {selectedRequest.startDate ? format(new Date(selectedRequest.startDate), "dd/MM/yyyy", { locale: es }) : "N/A"} -{" "}
                      {selectedRequest.endDate ? format(new Date(selectedRequest.endDate), "dd/MM/yyyy", { locale: es }) : "N/A"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">Días:</span> {
                        selectedRequest.startDate && selectedRequest.endDate 
                          ? calculateDays(selectedRequest.startDate, selectedRequest.endDate)
                          : selectedRequest.days || "N/A"
                      }
                    </p>
                  </>
                )}
                {selectedRequest.reason && (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Motivo:</span> {selectedRequest.reason}
                  </p>
                )}
              </div>

              {modalAction === 'edit' && !selectedRequest.isHourBased && (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">
                      Nuevo período de ausencia
                    </label>
                    <DatePickerPeriod
                      startDate={editDates.startDate || undefined}
                      endDate={editDates.endDate || undefined}
                      onStartDateChange={(date) => setEditDates(prev => ({ ...prev, startDate: date || null }))}
                      onEndDateChange={(date) => setEditDates(prev => ({ ...prev, endDate: date || null }))}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-foreground mb-1 block flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  {modalAction === 'deny' ? 'Motivo del rechazo' : 'Comentario (opcional)'}
                </label>
                <Textarea
                  value={adminComment}
                  onChange={(e) => setAdminComment(e.target.value)}
                  placeholder={modalAction === 'deny' 
                    ? "Explica el motivo del rechazo..." 
                    : "Añade un comentario si es necesario..."
                  }
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowRequestModal(false)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleRequestAction}
                  disabled={(selectedRequest?.isHourBased ? updateHourAbsenceMutation.isPending : updateRequestMutation.isPending) || (modalAction === 'deny' && !adminComment.trim())}
                  className={
                    modalAction === 'approve' 
                      ? "bg-green-600 hover:bg-green-700"
                      : modalAction === 'deny'
                      ? "bg-red-600 hover:bg-red-700"
                      : modalAction === 'revert'
                      ? "bg-orange-600 hover:bg-orange-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  }
                >
                  {(selectedRequest?.isHourBased ? updateHourAbsenceMutation.isPending : updateRequestMutation.isPending) ? (
                    <LoadingSpinner size="xs" />
                  ) : (
                    <>
                      {modalAction === 'approve' && <Check className="w-4 h-4 mr-1" />}
                      {modalAction === 'deny' && <X className="w-4 h-4 mr-1" />}
                      {modalAction === 'edit' && <Edit className="w-4 h-4 mr-1" />}
                      {modalAction === 'revert' && <RotateCcw className="w-4 h-4 mr-1" />}
                      
                      {modalAction === 'approve' && 'Aprobar'}
                      {modalAction === 'deny' && 'Denegar'}
                      {modalAction === 'edit' && 'Modificar'}
                      {modalAction === 'revert' && 'Revertir a Pendiente'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New Request Modal for Managers and Admins - Same components as employee form */}
      <Dialog open={showNewRequestModal} onOpenChange={(open) => {
        setShowNewRequestModal(open);
        if (!open) {
          setNewRequestDates({ startDate: null, endDate: null });
          setNewRequestReason("");
          setNewRequestAbsenceType('vacation');
          setNewRequestAttachment(null);
          setNewRequestCalendarDate(new Date());
          setNewRequestHoverDate(null);
          setNewRequestSelectedUserIds([]);
          setNewRequestEmployeeSearch("");
          setNewRequestAutoApprove(true);
          setNewRequestDeductFromVacation(true);
        }
      }}>
        <DialogContent className="w-[100vw] max-w-[100vw] md:w-auto md:max-w-6xl h-[100dvh] md:h-auto max-h-[100dvh] md:max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 rounded-none md:rounded-2xl p-3 sm:p-6">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-xl font-semibold text-center text-foreground">
              Crear Solicitud de Ausencia
            </DialogTitle>
            <p className="text-sm text-muted-foreground text-center">
              Selecciona empleados, fechas y tipo de ausencia
            </p>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 px-0">
            {/* COLUMNA 1: Seleccionar Empleados */}
            <div className="space-y-4 lg:border-r border-border lg:pr-4 pb-4 lg:pb-0 border-b lg:border-b-0">
              <div>
                <Label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Empleados
                </Label>
                <Input
                  placeholder="Buscar empleado..."
                  value={newRequestEmployeeSearch}
                  onChange={(e) => setNewRequestEmployeeSearch(e.target.value.toLowerCase())}
                  className="mb-2"
                />
              </div>
              
              <div className="border border-border rounded-lg p-3 max-h-56 sm:max-h-72 lg:max-h-96 overflow-y-auto space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    const allEmployeeIds = (employees || []).map(e => e.id);
                    setNewRequestSelectedUserIds(
                      newRequestSelectedUserIds.length === allEmployeeIds.length ? [] : allEmployeeIds
                    );
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold rounded-md hover:bg-muted bg-muted/50 mb-2"
                >
                  {newRequestSelectedUserIds.length === (employees || []).length ? '✓ Deseleccionar todos' : '+ Seleccionar todos'}
                </button>
                
                {(employees || [])
                  .filter(emp => emp.fullName.toLowerCase().includes(newRequestEmployeeSearch))
                  .map((emp: Employee) => (
                    <label key={emp.id} className="flex items-center gap-2 p-2 hover:bg-muted rounded-md cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newRequestSelectedUserIds.includes(emp.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewRequestSelectedUserIds([...newRequestSelectedUserIds, emp.id]);
                          } else {
                            setNewRequestSelectedUserIds(newRequestSelectedUserIds.filter(id => id !== emp.id));
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                      <span className="text-xs truncate">{emp.fullName}</span>
                    </label>
                  ))}
              </div>

              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                  {newRequestSelectedUserIds.length} empleado{newRequestSelectedUserIds.length !== 1 ? 's' : ''} seleccionado{newRequestSelectedUserIds.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* COLUMNA 2: Calendario y Tipo */}
            <div className="space-y-4 pb-4 lg:pb-0 border-b lg:border-b-0 border-border">
              {/* Absence Type Selector */}
              <div>
                <Label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Tipo de Ausencia
                </Label>
                <Select 
                  value={newRequestAbsenceType} 
                  onValueChange={(value) => {
                    setNewRequestAbsenceType(value);
                    setNewRequestDates({ startDate: null, endDate: null });
                    setNewRequestAttachment(null);
                  }}
                >
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Selecciona el tipo" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectGroup>
                      <SelectLabel className="text-muted-foreground">Vacaciones</SelectLabel>
                      <SelectItem value="vacation">
                        <div className="flex items-center gap-2">
                          <Plane className="w-4 h-4 flex-shrink-0 text-green-500" />
                          <span>Vacaciones</span>
                        </div>
                      </SelectItem>
                    </SelectGroup>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel className="text-muted-foreground">Incidencias</SelectLabel>
                      <SelectItem value="adverse_weather">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 flex-shrink-0 text-yellow-500" />
                          <span>Condiciones climaticas adversas</span>
                        </div>
                      </SelectItem>
                    </SelectGroup>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel className="text-muted-foreground">Permisos</SelectLabel>
                      {absencePolicies.filter(p => p.absenceType !== 'vacation' && p.absenceType !== 'temporary_disability' && p.absenceType !== 'adverse_weather' && p.isActive).map(policy => {
                        const IconComponent = ABSENCE_TYPE_ICONS[policy.absenceType] || Calendar;
                        return (
                          <SelectItem key={policy.absenceType} value={policy.absenceType}>
                            <div className="flex items-center gap-2">
                              <IconComponent className="w-4 h-4 flex-shrink-0 text-blue-500" />
                              <span>{policy.name}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectGroup>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel className="text-muted-foreground">Baja medica</SelectLabel>
                      {absencePolicies.filter(p => p.absenceType === 'temporary_disability' && p.isActive).map(policy => {
                        const IconComponent = ABSENCE_TYPE_ICONS[policy.absenceType] || Calendar;
                        return (
                          <SelectItem key={policy.absenceType} value={policy.absenceType}>
                            <div className="flex items-center gap-2">
                              <IconComponent className="w-4 h-4 flex-shrink-0 text-red-500" />
                              <span>{policy.name}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              {/* Calendar - Always shown */}
              <div className="bg-muted/30 rounded-xl p-2 sm:p-3 border border-border">
                <div className="flex items-center justify-between mb-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={goToNewRequestPreviousMonth}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <div className="text-xs font-medium text-foreground capitalize">
                    {format(newRequestCalendarDate, 'MMM yyyy', { locale: es })}
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={goToNewRequestNextMonth}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                
                {/* Days of week header */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day) => (
                    <div key={day} className="text-[11px] sm:text-xs text-muted-foreground text-center py-1 font-medium">
                      {day}
                    </div>
                  ))}
                </div>
                
                {/* Calendar days */}
                <div className="grid grid-cols-7 gap-1 min-h-[150px]">
                  {generateNewRequestCalendarDays().map((date, index) => {
                    if (!date) {
                      return <div key={`empty-${index}`} className="w-8 h-8 sm:w-6 sm:h-6"></div>;
                    }
                    
                    const isInRange = isNewRequestDateInRange(date);
                    const isStart = isNewRequestDateStart(date);
                    const isEnd = isNewRequestDateEnd(date);
                    const isToday = isSameDay(date, new Date());
                    
                    return (
                      <button
                        key={date.toISOString()}
                        onClick={() => handleNewRequestDateClick(date)}
                        className={`
                          w-8 h-8 sm:w-6 sm:h-6 text-[11px] sm:text-xs rounded transition-all duration-200 relative
                          ${isInRange 
                            ? (isStart || isEnd)
                              ? 'bg-[#007AFF] text-white font-semibold'
                              : 'bg-blue-100 dark:bg-blue-500/30 text-blue-700 dark:text-blue-200'
                            : 'text-foreground hover:bg-muted text-xs'
                          }
                          ${isToday && !isInRange ? 'ring-1 ring-[#007AFF]' : ''}
                        `}
                      >
                        {date.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Action buttons */}
              <div className="hidden lg:grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-border">
                <Button
                  onClick={handleCreateRequest}
                  disabled={
                    createRequestMutation.isPending || 
                    uploadingNewRequestAttachment ||
                    !newRequestDates.startDate || 
                    !newRequestDates.endDate ||
                    newRequestSelectedUserIds.length === 0
                  }
                  className="w-full bg-[#007AFF] hover:bg-[#0056CC] text-xs"
                >
                  {uploadingNewRequestAttachment 
                    ? 'Subiendo...' 
                    : createRequestMutation.isPending
                      ? 'Asignando...' 
                      : `Asignar a ${newRequestSelectedUserIds.length}`
                  }
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowNewRequestModal(false);
                    setNewRequestDates({ startDate: null, endDate: null });
                    setNewRequestReason("");
                    setNewRequestAbsenceType('vacation');
                    setNewRequestAttachment(null);
                    setNewRequestCalendarDate(new Date());
                    setNewRequestHoverDate(null);
                    setNewRequestSelectedUserIds([]);
                    setNewRequestEmployeeSearch("");
                    setNewRequestAutoApprove(true);
                    setNewRequestDeductFromVacation(true);
                    setNewRequestIsFullDay(true);
                    setNewRequestHoursStart('09:00');
                    setNewRequestHoursEnd('17:00');
                  }}
                  className="w-full text-xs"
                >
                  Cancelar
                </Button>
              </div>
            </div>

            {/* COLUMNA 3: Descripción y Resumen */}
            <div className="space-y-4 lg:border-l border-border lg:pl-4 pt-2 lg:pt-0">
              {/* Show selected day info - appears when a single day range is selected */}
              {newRequestDates.startDate && newRequestDates.endDate && 
               isSameDay(newRequestDates.startDate, newRequestDates.endDate) && (
                <div className="space-y-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                  <div className="text-xs text-center font-medium text-blue-700 dark:text-blue-300">
                    Día completo: {format(newRequestDates.startDate, 'd MMM yyyy', { locale: es })}
                  </div>

                  {/* Toggle to use hours instead of full day */}
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer flex-1">
                      <input
                        type="checkbox"
                        checked={!newRequestIsFullDay}
                        onChange={(e) => setNewRequestIsFullDay(!e.target.checked)}
                        className="rounded border-gray-300 w-4 h-4"
                      />
                      <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                        Especificar horas
                      </span>
                    </label>
                  </div>

                  {/* Hours selection - appears when checkbox is checked */}
                  {!newRequestIsFullDay && (
                  <div className="space-y-2 pt-2 border-t border-blue-200 dark:border-blue-800">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-blue-700 dark:text-blue-300 font-medium block mb-1">Desde</Label>
                        <input
                          type="time"
                          value={newRequestHoursStart}
                          onChange={(e) => setNewRequestHoursStart(e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-blue-300 dark:border-blue-700 rounded bg-white dark:bg-gray-950 text-foreground"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-blue-700 dark:text-blue-300 font-medium block mb-1">Hasta</Label>
                        <input
                          type="time"
                          value={newRequestHoursEnd}
                          onChange={(e) => setNewRequestHoursEnd(e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-blue-300 dark:border-blue-700 rounded bg-white dark:bg-gray-950 text-foreground"
                        />
                      </div>
                    </div>
                    
                    {/* Calculate and display hours */}
                    {newRequestHoursStart && newRequestHoursEnd && (
                    <div className="text-xs text-center p-1.5 bg-blue-100 dark:bg-blue-900/40 rounded text-blue-700 dark:text-blue-300 font-medium">
                      {newRequestHoursStart} - {newRequestHoursEnd}
                    </div>
                    )}
                  </div>
                  )}
                </div>
              )}

              {/* Selected range info (for multiple days) */}
              {newRequestDates.startDate && newRequestDates.endDate && 
               !isSameDay(newRequestDates.startDate, newRequestDates.endDate) && (
                <div className="text-xs text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-700 dark:text-blue-300 font-medium">
                  {format(newRequestDates.startDate, 'd MMM', { locale: es })} - {format(newRequestDates.endDate, 'd MMM', { locale: es })}
                  <span className="mx-2">•</span>
                  {calculateDays(
                    newRequestDates.startDate.toISOString().split('T')[0],
                    newRequestDates.endDate.toISOString().split('T')[0]
                  )} dias
                  {expandedNewRequestRange?.expanded && (
                    <div className="mt-1 text-[11px] text-blue-700/90 dark:text-blue-300/90 font-medium">
                      Se incluiran automaticamente los fines de semana: {format(expandedNewRequestRange.startDate, 'd MMM', { locale: es })} - {format(expandedNewRequestRange.endDate, 'd MMM', { locale: es })}
                      <span className="mx-2">•</span>
                      {calculateDays(
                        expandedNewRequestRange.startDate.toISOString().split('T')[0],
                        expandedNewRequestRange.endDate.toISOString().split('T')[0]
                      )} dias
                    </div>
                  )}
                </div>
              )}

              {/* Description textarea */}
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Descripción (opcional)
                </Label>
                <Textarea
                  value={newRequestReason}
                  onChange={(e) => setNewRequestReason(e.target.value)}
                  placeholder="Motivo..."
                  className="resize-none text-xs"
                  rows={3}
                />
              </div>

              {/* File attachment (for non-vacation types) */}
              {newRequestAbsenceType !== 'vacation' && (
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-2 block flex items-center gap-1">
                    <Paperclip className="w-3 h-3" />
                    Justificante
                  </Label>
                  <div className="relative">
                    <input
                      type="file"
                      id="new-request-attachment-admin"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setNewRequestAttachment(file);
                        }
                      }}
                      className="hidden"
                    />
                    <label
                      htmlFor="new-request-attachment-admin"
                      className={`
                        flex items-center justify-center gap-2 p-2 rounded-lg border-2 border-dashed cursor-pointer text-xs
                        transition-all duration-200
                        ${newRequestAttachment 
                          ? 'border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' 
                          : 'border-border text-muted-foreground hover:border-blue-400'
                        }
                      `}
                    >
                      {newRequestAttachment ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span className="truncate">{newRequestAttachment.name}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setNewRequestAttachment(null);
                            }}
                            className="ml-1 p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-full transition-colors"
                          >
                            <X className="w-3 h-3 text-red-500" />
                          </button>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          <span>Subir</span>
                        </>
                      )}
                    </label>
                  </div>
                </div>
              )}

              <div className="space-y-3 rounded-lg border border-border p-3">
                <label className="flex items-start gap-2 text-xs text-foreground">
                  <input
                    type="checkbox"
                    checked={newRequestAutoApprove}
                    onChange={(e) => setNewRequestAutoApprove(e.target.checked)}
                    className="mt-0.5 rounded border-gray-300"
                  />
                  <span>Aprobar automaticamente (sin confirmacion del trabajador)</span>
                </label>
                {newRequestAbsenceType === 'adverse_weather' && (
                  <label className="flex items-start gap-2 text-xs text-foreground">
                    <input
                      type="checkbox"
                      checked={newRequestDeductFromVacation}
                      onChange={(e) => setNewRequestDeductFromVacation(e.target.checked)}
                      className="mt-0.5 rounded border-gray-300"
                    />
                    <span>Contar para vacaciones</span>
                  </label>
                )}
              </div>

            </div>

            {/* Botones mobile al final del modal */}
            <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 mt-1 border-t border-border">
              <Button
                onClick={handleCreateRequest}
                disabled={
                  createRequestMutation.isPending ||
                  uploadingNewRequestAttachment ||
                  !newRequestDates.startDate ||
                  !newRequestDates.endDate ||
                  newRequestSelectedUserIds.length === 0
                }
                className="w-full bg-[#007AFF] hover:bg-[#0056CC] text-xs"
              >
                {uploadingNewRequestAttachment
                  ? 'Subiendo...'
                  : createRequestMutation.isPending
                    ? 'Asignando...'
                    : `Asignar a ${newRequestSelectedUserIds.length}`
                }
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowNewRequestModal(false);
                  setNewRequestDates({ startDate: null, endDate: null });
                  setNewRequestReason("");
                  setNewRequestAbsenceType('vacation');
                  setNewRequestAttachment(null);
                  setNewRequestCalendarDate(new Date());
                  setNewRequestHoverDate(null);
                  setNewRequestSelectedUserIds([]);
                  setNewRequestEmployeeSearch("");
                  setNewRequestAutoApprove(true);
                  setNewRequestDeductFromVacation(true);
                  setNewRequestIsFullDay(true);
                  setNewRequestHoursStart('09:00');
                  setNewRequestHoursEnd('17:00');
                }}
                className="w-full text-xs"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de vista previa de documentos */}
      <DocumentPreviewModal
        open={!!previewDoc}
        url={previewDoc?.url || ''}
        filename={previewDoc?.filename || 'Justificante'}
        onClose={() => setPreviewDoc(null)}
      />

      {/* Modal de exportación de informe */}
      <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-5 h-5 text-blue-500" />
              Exportar Informe de Vacaciones
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Selección de empleados */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Seleccionar Empleados
              </label>
              <div className="border rounded-lg p-4 max-h-64 overflow-y-auto space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    id="select-all-employees"
                    checked={exportSelectedEmployees.length === employees.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setExportSelectedEmployees(employees.map(emp => emp.id));
                      } else {
                        setExportSelectedEmployees([]);
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="select-all-employees" className="text-sm font-medium">
                    Seleccionar todos ({employees.length})
                  </label>
                </div>
                {employees.map((employee) => (
                  <div key={employee.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`employee-${employee.id}`}
                      checked={exportSelectedEmployees.includes(employee.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setExportSelectedEmployees([...exportSelectedEmployees, employee.id]);
                        } else {
                          setExportSelectedEmployees(exportSelectedEmployees.filter(id => id !== employee.id));
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor={`employee-${employee.id}`} className="text-sm flex items-center gap-2 cursor-pointer">
                      <UserAvatar
                        userId={employee.id}
                        fullName={employee.fullName}
                        profilePicture={employee.profilePicture}
                        size="sm"
                      />
                      {employee.fullName}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Rango de meses */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Periodo
              </label>

              {/* Selectores de mes mejorados */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Desde</label>
                  <Select value={exportStartMonth} onValueChange={setExportStartMonth}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar mes" />
                    </SelectTrigger>
                    <SelectContent>
                      {(() => {
                        const monthsWithVacations = new Set<string>();
                        (vacationRequests || []).forEach((req: any) => {
                          if (req.status === 'approved') {
                            const date = new Date(req.startDate);
                            const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                            monthsWithVacations.add(yearMonth);
                          }
                        });
                        const sortedMonths = Array.from(monthsWithVacations).sort().reverse();
                        
                        return sortedMonths.map(yearMonth => {
                          const [year, month] = yearMonth.split('-');
                          const date = new Date(parseInt(year), parseInt(month) - 1);
                          const label = format(date, 'MMMM yyyy', { locale: es });
                          return (
                            <SelectItem key={yearMonth} value={yearMonth}>
                              {label}
                            </SelectItem>
                          );
                        });
                      })()}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Hasta</label>
                  <Select value={exportEndMonth} onValueChange={setExportEndMonth}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar mes" />
                    </SelectTrigger>
                    <SelectContent>
                      {(() => {
                        const monthsWithVacations = new Set<string>();
                        (vacationRequests || []).forEach((req: any) => {
                          if (req.status === 'approved') {
                            const date = new Date(req.startDate);
                            const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                            monthsWithVacations.add(yearMonth);
                          }
                        });
                        const sortedMonths = Array.from(monthsWithVacations).sort().reverse();
                        
                        return sortedMonths.map(yearMonth => {
                          const [year, month] = yearMonth.split('-');
                          const date = new Date(parseInt(year), parseInt(month) - 1);
                          const label = format(date, 'MMMM yyyy', { locale: es });
                          return (
                            <SelectItem key={yearMonth} value={yearMonth}>
                              {label}
                            </SelectItem>
                          );
                        });
                      })()}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowExportModal(false);
                  setExportSelectedEmployees([]);
                  setExportStartMonth('');
                  setExportEndMonth('');
                }}
                disabled={isExportingExcel || isExportingPdf}
              >
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  if (exportSelectedEmployees.length === 0) {
                    toast({
                      variant: 'destructive',
                      title: 'Error',
                      description: 'Debes seleccionar al menos un empleado',
                    });
                    return;
                  }
                  if (!exportStartMonth || !exportEndMonth) {
                    toast({
                      variant: 'destructive',
                      title: 'Error',
                      description: 'Debes seleccionar un periodo',
                    });
                    return;
                  }

                  setIsExportingExcel(true);
                  try {
                    // Convertir mes a fecha (primer día del mes inicial, último día del mes final)
                    const startDate = new Date(exportStartMonth + '-01');
                    const endDateParts = exportEndMonth.split('-');
                    const endYear = parseInt(endDateParts[0]);
                    const endMonth = parseInt(endDateParts[1]);
                    // Para obtener el último día del mes: usar el día 0 del mes SIGUIENTE
                    const endDate = new Date(endYear, endMonth, 0);

                    const response = await fetchWithUserTokenRefresh('/api/vacation-requests/export-excel', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        employeeIds: exportSelectedEmployees,
                        startDate: startDate.toISOString(),
                        endDate: endDate.toISOString(),
                      }),
                    });

                    if (!response.ok) {
                      const errorData = await response.json().catch(() => ({ message: 'Error al generar el Excel' }));
                      throw new Error(errorData.message || 'Error al generar el Excel');
                    }

                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `informe-vacaciones-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);

                    toast({
                      title: 'Éxito',
                      description: 'Informe Excel exportado correctamente',
                    });

                    setShowExportModal(false);
                    setExportSelectedEmployees([]);
                    setExportStartMonth('');
                    setExportEndMonth('');
                  } catch (error: any) {
                    console.error('Error exporting Excel:', error);
                    toast({
                      variant: 'destructive',
                      title: 'Error',
                      description: error.message || 'No se pudo generar el informe Excel',
                    });
                  } finally {
                    setIsExportingExcel(false);
                  }
                }}
                disabled={isExportingExcel || isExportingPdf || exportSelectedEmployees.length === 0 || !exportStartMonth || !exportEndMonth}
                className="bg-green-600 hover:bg-green-700"
              >
                {isExportingExcel ? (
                  <>
                    <LoadingSpinner size="xs" className="mr-2" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Excel
                  </>
                )}
              </Button>
              <Button
                onClick={async () => {
                  if (exportSelectedEmployees.length === 0) {
                    toast({
                      variant: 'destructive',
                      title: 'Error',
                      description: 'Debes seleccionar al menos un empleado',
                    });
                    return;
                  }
                  if (!exportStartMonth || !exportEndMonth) {
                    toast({
                      variant: 'destructive',
                      title: 'Error',
                      description: 'Debes seleccionar un periodo',
                    });
                    return;
                  }

                  setIsExportingPdf(true);
                  try {
                    // Convertir mes a fecha (primer día del mes inicial, último día del mes final)
                    const startDate = new Date(exportStartMonth + '-01');
                    const endDateParts = exportEndMonth.split('-');
                    const endYear = parseInt(endDateParts[0]);
                    const endMonth = parseInt(endDateParts[1]);
                    // Para obtener el último día del mes: usar el día 0 del mes SIGUIENTE
                    const endDate = new Date(endYear, endMonth, 0);

                    const response = await fetchWithUserTokenRefresh('/api/vacation-requests/export-pdf', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        employeeIds: exportSelectedEmployees,
                        startDate: startDate.toISOString(),
                        endDate: endDate.toISOString(),
                      }),
                    });

                    if (!response.ok) {
                      const errorData = await response.json().catch(() => ({ message: 'Error al generar el PDF' }));
                      throw new Error(errorData.message || 'Error al generar el PDF');
                    }

                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `informe-vacaciones-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);

                    toast({
                      title: 'Éxito',
                      description: 'Informe PDF exportado correctamente',
                    });

                    setShowExportModal(false);
                    setExportSelectedEmployees([]);
                    setExportStartMonth('');
                    setExportEndMonth('');
                  } catch (error: any) {
                    console.error('Error exporting PDF:', error);
                    toast({
                      variant: 'destructive',
                      title: 'Error',
                      description: error.message || 'No se pudo generar el informe PDF',
                    });
                  } finally {
                    setIsExportingPdf(false);
                  }
                }}
                disabled={isExportingExcel || isExportingPdf || exportSelectedEmployees.length === 0 || !exportStartMonth || !exportEndMonth}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isExportingPdf ? (
                  <>
                    <LoadingSpinner size="xs" className="mr-2" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    PDF
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Adverse Hours Breakdown Dialog */}
      <Dialog open={adverseHoursDialogEmployeeId !== null} onOpenChange={(open) => !open && setAdverseHoursDialogEmployeeId(null)}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] flex flex-col">
          {adverseHoursDialogEmployeeId && (() => {
            const employee = employees.find((e: Employee) => e.id === adverseHoursDialogEmployeeId);
            if (!employee) return null;

            const selectedPeriod = absenceModalPeriod === 'current' ? adminVacationPeriod : previousVacationPeriod;

            const getVacationDaysInPeriod = (request: VacationRequest) => {
              if (!request?.startDate || !request?.endDate || request.absenceType !== 'vacation') return 0;
              if (!selectedPeriod) return 0;

              const requestStart = startOfDay(parseDateOnlyLocal(request.startDate));
              const requestEnd = startOfDay(parseDateOnlyLocal(request.endDate));
              const { periodStart, periodEnd } = selectedPeriod;

              if (requestEnd < periodStart || requestStart > periodEnd) return 0;

              const overlapStart = requestStart > periodStart ? requestStart : periodStart;
              const overlapEnd = requestEnd < periodEnd ? requestEnd : periodEnd;

              if (overlapEnd < overlapStart) return 0;
              return differenceInDays(overlapEnd, overlapStart) + 1;
            };

            const approvedVacationsRaw = vacationRequests
              .filter((req: VacationRequest) => req.userId === employee.id && req.status === 'approved' && req.absenceType === 'vacation')
              .map((req: VacationRequest) => ({
                ...req,
                overlapDays: getVacationDaysInPeriod(req)
              }))
              .filter((req: any) => req.overlapDays > 0);

            const approvedVacations = approvedVacationsRaw
              .map((req: any) => ({
                ...req,
                startDate: parseISO(req.startDate),
                endDate: parseISO(req.endDate)
              }))
              .sort((a: any, b: any) => (a.startDate as Date).getTime() - (b.startDate as Date).getTime());

            const usedVacationDays = approvedVacationsRaw.reduce((sum: number, req: any) => (
              sum + (req.overlapDays || 0)
            ), 0);
            const totalVacationDays = Math.round(parseFloat(employee.totalVacationDays) || 0);
            const vacationUsagePercent = totalVacationDays > 0
              ? Math.min(100, (usedVacationDays / totalVacationDays) * 100)
              : 0;

            const adverseApprovedRawHours = approvedAdverseRawHoursByEmployee.get(Number(employee.id)) || 0;
            const adverseUsedFromApprovedAbsences = adverseApprovedRawHours * (adverseRecoveryPercentage / 100);
            const adverseUsed = adverseUsedFromApprovedAbsences;
            const adverseTotal = typeof adverseWeatherHours[employee.id]?.totalHours === 'string'
              ? parseFloat(adverseWeatherHours[employee.id].totalHours)
              : (adverseWeatherHours[employee.id]?.totalHours || 0);

            const workingHoursPerDay = typeof companyConfig?.workingHoursPerDay === 'string'
              ? parseFloat(companyConfig.workingHoursPerDay)
              : (Number(companyConfig?.workingHoursPerDay) || 8);
            const adverseDaysUsed = Math.round(Math.max(0, adverseUsed) / workingHoursPerDay);
            const adverseUsagePercent = adverseApprovedRawHours > 0
              ? Math.min(100, (adverseRecoveryPercentage / 100) * 100)
              : 0;
            const hasAdverse = adverseTotal > 0 || adverseUsed > 0 || adverseApprovedRawHours > 0;
            const formatHours = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ','));
            const exactAdverseDays = workingHoursPerDay > 0 ? (adverseUsed / workingHoursPerDay) : 0;
            const formatDaysExact = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ','));
            const currentEmployeeIndex = employees.findIndex((e: Employee) => e.id === employee.id);
            const previousEmployee = currentEmployeeIndex > 0 ? employees[currentEmployeeIndex - 1] : null;
            const nextEmployee = currentEmployeeIndex >= 0 && currentEmployeeIndex < employees.length - 1
              ? employees[currentEmployeeIndex + 1]
              : null;

            return (
              <>
                <DialogHeader className="flex-shrink-0">
                  <DialogTitle className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => previousEmployee && setAdverseHoursDialogEmployeeId(previousEmployee.id)}
                          disabled={!previousEmployee}
                          title="Empleado anterior"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => nextEmployee && setAdverseHoursDialogEmployeeId(nextEmployee.id)}
                          disabled={!nextEmployee}
                          title="Empleado siguiente"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                      </div>
                      <UserAvatar fullName={employee.fullName} size="sm" userId={employee.id} profilePicture={employee.profilePicture} />
                      <div>
                        <div className="text-sm text-muted-foreground">Resumen de ausencias</div>
                        <div className="text-lg font-semibold text-foreground">{employee.fullName}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setAbsenceModalPeriod('previous')}
                        disabled={absenceModalPeriod === 'previous'}
                        title="Periodo anterior"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <div className="text-xs font-medium text-muted-foreground">
                        {selectedPeriod
                          ? `${format(selectedPeriod.periodStart, 'd MMM yyyy', { locale: es })} - ${format(selectedPeriod.periodEnd, 'd MMM yyyy', { locale: es })}`
                          : 'Periodo no disponible'}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setAbsenceModalPeriod('current')}
                        disabled={absenceModalPeriod === 'current'}
                        title="Periodo actual"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </DialogTitle>
                  {/* Combined summary bar - compact */}
                  <div className="mt-4 space-y-2 pb-3 border-b">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-foreground">Total días usados</div>
                      <div className="text-sm text-muted-foreground">
                        <span className="font-semibold text-foreground">{usedVacationDays + adverseDaysUsed}</span>/{totalVacationDays + (hasAdverse ? Math.round(adverseTotal / workingHoursPerDay) : 0)} días
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                        <div className="flex h-3">
                          <div
                            className="bg-gradient-to-r from-blue-500 via-primary to-blue-600 shadow-sm transition-all duration-700 ease-out"
                            style={{ 
                              width: `${Math.min(100, (usedVacationDays / (totalVacationDays + (hasAdverse ? Math.round(adverseTotal / workingHoursPerDay) : 0))) * 100)}%` 
                            }}
                          />
                          {hasAdverse && adverseDaysUsed > 0 && (
                            <div
                              className="bg-gradient-to-r from-yellow-500 to-amber-600 shadow-sm transition-all duration-700 ease-out"
                              style={{ 
                                width: `${Math.min(100, (adverseDaysUsed / (totalVacationDays + Math.round(adverseTotal / workingHoursPerDay))) * 100)}%` 
                              }}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-blue-500 to-blue-600"></div>
                          <span className="text-muted-foreground">Vac. <span className="font-medium text-foreground">{usedVacationDays}</span></span>
                        </div>
                        {hasAdverse && adverseDaysUsed > 0 && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-yellow-500 to-amber-600"></div>
                            <span className="text-muted-foreground">Incl. <span className="font-medium text-foreground">{adverseDaysUsed}</span></span>
                          </div>
                        )}
                      </div>
                      <span className="font-medium text-green-600 dark:text-green-400">
                        {Math.max(0, (totalVacationDays + (hasAdverse ? Math.round(adverseTotal / workingHoursPerDay) : 0)) - (usedVacationDays + adverseDaysUsed))} rest.
                      </span>
                    </div>
                  </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-1 pb-4 min-h-0">
                  <div className={`grid gap-6 ${hasAdverse ? 'lg:grid-cols-2' : ''}`}>
                    <div className="rounded-2xl border bg-background p-5 shadow-sm">
                      <div className="space-y-2 min-h-[92px]">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold text-foreground">Vacaciones aprobadas</div>
                          <div className="text-sm text-muted-foreground">
                            <span className="font-semibold text-foreground">{usedVacationDays}</span>/{totalVacationDays} dias
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Periodo seleccionado</span>
                          <span>
                            {selectedPeriod
                              ? `${format(selectedPeriod.periodStart, 'd MMM', { locale: es })} - ${format(selectedPeriod.periodEnd, 'd MMM yyyy', { locale: es })}`
                              : 'N/A'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-blue-500 via-primary to-blue-600 h-3 shadow-sm transition-all duration-700 ease-out"
                              style={{ width: `${vacationUsagePercent}%` }}
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Restantes</span>
                          <span className="font-medium text-primary">{Math.max(0, totalVacationDays - usedVacationDays)} dias</span>
                        </div>
                      </div>

                    <div className="mt-4 space-y-2 max-h-[300px] overflow-y-auto pr-1">
                      {approvedVacations.length > 0 ? (
                        approvedVacations.map((req: any) => {
                          const startLabel = format(req.startDate, 'd MMM yyyy', { locale: es });
                          const endLabel = format(req.endDate, 'd MMM yyyy', { locale: es });
                          const daysLabel = req.overlapDays ?? calculateDays(req.startDate, req.endDate);
                          return (
                            <div key={req.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/40 px-3 py-2">
                              <div>
                                <div className="text-xs text-muted-foreground">Periodo</div>
                                <div className="text-sm font-medium text-foreground">
                                  {startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`}
                                </div>
                              </div>
                              <div className="text-sm font-semibold text-foreground">{daysLabel} d</div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="rounded-xl border border-dashed border-muted-foreground/30 bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
                          No hay vacaciones aprobadas en este periodo.
                        </div>
                      )}
                    </div>
                  </div>

                  {hasAdverse && (
                    <div className="rounded-2xl border bg-background p-5 shadow-sm">
                      <div className="space-y-2 min-h-[92px]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <AlertCircle className="w-4 h-4 text-yellow-600" />
                            Inclemencias
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <span className="font-semibold text-foreground">{formatDaysExact(exactAdverseDays)}</span> dias
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Total horas aprobadas</span>
                          <span className="font-medium text-foreground">{formatHours(adverseApprovedRawHours)} h</span>
                        </div>
                        <div className="relative h-3 rounded-full bg-yellow-200 dark:bg-yellow-900/30 overflow-hidden">
                          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-yellow-300 to-yellow-500 opacity-70" />
                          <div
                            className="absolute left-0 top-0 h-3 rounded-full bg-gradient-to-r from-yellow-500 to-amber-600 shadow-sm transition-all duration-700 ease-out"
                            style={{ width: `${adverseUsagePercent}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Horas computadas ({adverseRecoveryPercentage}%)</span>
                          <span className="font-medium text-yellow-700 dark:text-yellow-300">{formatHours(adverseUsed)} h</span>
                        </div>
                      </div>

                      <div className="mt-4 rounded-xl border border-yellow-200/70 dark:border-yellow-900/40 bg-yellow-50/70 dark:bg-yellow-900/20 px-3 py-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Dias exactos</span>
                          <span className="font-semibold text-foreground">{formatDaysExact(exactAdverseDays)} d</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Redondeo aplicado</span>
                          <span className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{adverseDaysUsed}</span>
                        </div>
                      </div>

                      <div className="mt-3 text-xs text-muted-foreground">
                        {Number.isInteger(workingHoursPerDay) ? workingHoursPerDay : workingHoursPerDay.toFixed(1)} horas = 1 dia. Se redondea al dia mas cercano.
                      </div>
                    </div>
                  )}
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteRequestConfirm)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteRequestConfirm(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar solicitud?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteRequestConfirm && (
                <>
                  Esta acción eliminará la solicitud de <strong>{deleteRequestConfirm.user?.fullName || 'empleado'}</strong> y no se puede deshacer.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteRequestConfirm(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={confirmDeleteRequest}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}