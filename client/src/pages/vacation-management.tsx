import { useState, useEffect, useRef } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DatePickerPeriod } from "@/components/ui/date-picker";
import { CalendarDays, Users, MapPin, Plus, Check, X, Clock, Plane, Edit, MessageSquare, RotateCcw, ChevronLeft, ChevronRight, Calendar, User, Baby, Heart, Home, Briefcase, GraduationCap, Stethoscope, AlertCircle, FileText, Download, GanttChart } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, differenceInDays, parseISO, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval, startOfDay, differenceInCalendarDays } from "date-fns";
import { es } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import StatsCard, { StatsCardGrid } from "@/components/StatsCard";
import { useAuth } from "@/hooks/use-auth";
import { usePageHeader } from '@/components/layout/page-header';
import { TabNavigation } from "@/components/ui/tab-navigation";
import { UserAvatar } from "@/components/ui/user-avatar";
import { formatVacationDatesShort, formatVacationPeriod } from "@/utils/dateUtils";

interface VacationRequest {
  id: number;
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
  personal_leave: FileText,
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
  personal_leave: 'Asuntos propios',
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
  personal_leave: { bg: 'bg-gray-50 dark:bg-gray-950/40', text: 'text-gray-700 dark:text-gray-300', border: 'border-gray-200 dark:border-gray-800' },
};

interface Employee {
  id: number;
  fullName: string;
  totalVacationDays: string;
  usedVacationDays: string;
  status: string;
}

interface Holiday {
  id?: number;
  name: string;
  date: string;
  type: 'national' | 'regional' | 'local';
  region?: string;
}

const spanishHolidays2025: Holiday[] = [
  { name: "Año Nuevo", date: "2025-01-01", type: "national" },
  { name: "Día de Reyes", date: "2025-01-06", type: "national" },
  { name: "Viernes Santo", date: "2025-04-18", type: "national" },
  { name: "Día del Trabajador", date: "2025-05-01", type: "national" },
  { name: "Asunción de la Virgen", date: "2025-08-15", type: "national" },
  { name: "Día de la Hispanidad", date: "2025-10-12", type: "national" },
  { name: "Todos los Santos", date: "2025-11-01", type: "national" },
  { name: "Día de la Constitución", date: "2025-12-06", type: "national" },
  { name: "Inmaculada Concepción", date: "2025-12-08", type: "national" },
  { name: "Navidad", date: "2025-12-25", type: "national" },
];

const regions = [
  "Andalucía", "Aragón", "Asturias", "Baleares", "Canarias", "Cantabria",
  "Castilla-La Mancha", "Castilla y León", "Cataluña", "Extremadura",
  "Galicia", "Madrid", "Murcia", "Navarra", "País Vasco", "La Rioja", "Valencia"
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
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("all");
  const [selectedAbsenceType, setSelectedAbsenceType] = useState("all");
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [newHoliday, setNewHoliday] = useState<{ name: string; startDate: Date | null; endDate: Date | null; type: 'national' | 'regional' | 'local' }>({ name: "", startDate: null, endDate: null, type: "regional" });
  const [showAddHoliday, setShowAddHoliday] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<VacationRequest | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [modalAction, setModalAction] = useState<'approve' | 'deny' | 'edit' | 'revert'>('approve');
  const [editDates, setEditDates] = useState({ startDate: null as Date | null, endDate: null as Date | null });
  const [adminComment, setAdminComment] = useState("");
  
  // Estados para nueva solicitud de manager/admin
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [newRequestDates, setNewRequestDates] = useState({ startDate: null as Date | null, endDate: null as Date | null });
  const [newRequestReason, setNewRequestReason] = useState("");
  
  // Estados para el timeline de vacaciones (pestaña empleados)
  const [timelineViewDate, setTimelineViewDate] = useState(new Date());
  const [timelineViewMode, setTimelineViewMode] = useState<'month' | 'quarter'>('month');
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  
  // Estados para swipe en móvil
  const [touchStartX, setTouchStartX] = useState<number>(0);
  const [touchStartY, setTouchStartY] = useState<number>(0);
  const [isSwiping, setIsSwiping] = useState(false);
  
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
  const calculateDays = (startDate: string, endDate: string) => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    return differenceInDays(end, start) + 1;
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
        // Swipe derecha - mes anterior
        setTimelineViewDate(prev => {
          const newDate = new Date(prev);
          newDate.setMonth(newDate.getMonth() - 1);
          return newDate;
        });
      } else {
        // Swipe izquierda - mes siguiente
        setTimelineViewDate(prev => {
          const newDate = new Date(prev);
          newDate.setMonth(newDate.getMonth() + 1);
          return newDate;
        });
      }
    }
  };

  // ⚠️ PROTECTED TIMELINE FUNCTIONS - DO NOT MODIFY ⚠️
  // Funciones críticas para el timeline de vacaciones tipo Gantt
  const getTimelineRange = () => {
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
      // Verificar si el período se solapa con el rango visible
      const periodStart = period.startDate;
      const periodEnd = period.endDate;
      
      if (periodEnd < rangeStart || periodStart > rangeEnd) {
        return null; // Período fuera del rango visible
      }
      
      // Calcular posición y ancho relativo
      const visibleStart = periodStart < rangeStart ? rangeStart : periodStart;
      const visibleEnd = periodEnd > rangeEnd ? rangeEnd : periodEnd;
      
      const totalDays = differenceInDays(rangeEnd, rangeStart) + 1;
      const startOffset = differenceInDays(visibleStart, rangeStart);
      const duration = differenceInDays(visibleEnd, visibleStart) + 1;
      
      const leftPercent = (startOffset / totalDays) * 100;
      const widthPercent = (duration / totalDays) * 100;
      
      const fullRequest = vacationRequests?.find((req: any) => req.id === period.id);
      const periodText = `${format(periodStart, "dd/MM")} - ${format(periodEnd, "dd/MM")}`;
      
      const tooltipId = `${employee.id}-${period.id}-${index}`;
      const isTooltipActive = activeTooltip === tooltipId;

      // Obtener el icono del tipo de ausencia
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
  // ⚠️ END PROTECTED TIMELINE FUNCTIONS ⚠️

  // Fetch vacation requests
  // ⚡ WebSocket provides real-time updates - no polling needed!
  const { data: vacationRequests = [], isLoading: loadingRequests } = useQuery({
    queryKey: ['/api/vacation-requests/company'],
    staleTime: 60000, // Cache for 1 min - WebSocket invalidates on changes
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

  // Fetch employees for vacation overview
  const { data: employees = [], isLoading: loadingEmployees } = useQuery({
    queryKey: ['/api/employees'],
    staleTime: 5 * 60 * 1000,
    select: (data) => {
      // Ensure employees data is an array
      if (!data || !Array.isArray(data)) return [];
      return data;
    }
  });

  // ⚡ REAL-TIME UPDATES: WebSocket listener for instant vacation request notifications
  // This eliminates polling delays - updates appear immediately when employees submit requests
  useEffect(() => {
    if (!user || (user.role !== 'admin' && user.role !== 'manager')) return;

    // Get auth token for WebSocket authentication
    const authData = localStorage.getItem('auth');
    if (!authData) return;

    let ws: WebSocket | null = null;
    
    try {
      const parsed = JSON.parse(authData);
      const token = parsed.token;
      
      if (!token) {
        console.log('⚠️ Vacation WS: No token found in auth data');
        return;
      }
      
      // Build WebSocket URL dynamically from current window location
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws/work-sessions?token=${token}`;
      
      console.log('🔔 Vacation WS: Connecting to', wsUrl.replace(/token=.*/, 'token=[HIDDEN]'));

      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('✅ Vacation Management WebSocket CONNECTED - ready for real-time notifications');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('📡 Vacation WS received:', message.type, message);
          
          // Handle new vacation request - show toast and refresh data immediately
          if (message.type === 'vacation_request_created') {
            console.log('🎯 Processing vacation_request_created:', message.data);
            const { employeeName, startDate, endDate } = message.data || {};
            
            // Show instant toast notification with employee name
            if (employeeName) {
              const periodText = startDate && endDate ? ` ${formatVacationPeriod(startDate, endDate)}` : '';
              
              console.log('🔔 Showing vacation toast for:', employeeName);
              toast({
                title: "📋 Nueva solicitud de ausencia",
                description: `${employeeName} ha solicitado ausencia${periodText}`,
                duration: 8000,
              });
            } else {
              console.log('⚠️ No employeeName in message.data');
            }
            
            // Immediately invalidate and refetch vacation requests
            queryClient.invalidateQueries({ queryKey: ['/api/vacation-requests/company'] });
          }
          
          // Also handle vacation request updates
          if (message.type === 'vacation_request_updated') {
            queryClient.invalidateQueries({ queryKey: ['/api/vacation-requests/company'] });
          }
        } catch (err) {
          console.log('⚠️ Vacation WS parse error:', err);
        }
      };

      ws.onerror = (error) => {
        console.log('⚠️ Vacation WS error:', error);
      };
      
      ws.onclose = (event) => {
        console.log('🔔 Vacation WS closed:', event.code, event.reason);
      };
    } catch (err) {
      console.log('⚠️ Vacation WS setup error:', err);
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
  
  // Keep reference in sync with current requests (WebSocket handles toast notifications)
  useEffect(() => {
    if (!vacationRequests || vacationRequests.length === 0) return;
    previousRequestsRef.current = [...vacationRequests];
  }, [vacationRequests]);

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
      
      console.log('Updating vacation request:', { id, updateData });
      
      return apiRequest('PATCH', `/api/vacation-requests/${id}`, updateData);
    },
    onSuccess: (data) => {
      console.log('Update successful:', data);
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
    mutationFn: async ({ startDate, endDate, reason }: { 
      startDate: string; 
      endDate: string; 
      reason?: string;
    }) => {
      const requestData = {
        startDate,
        endDate,
        reason: reason || undefined,
        // Admin requests are auto-approved, manager requests are pending
        status: user?.role === 'admin' ? 'approved' : 'pending'
      };
      
      console.log('Creating vacation request:', requestData);
      
      return apiRequest('POST', '/api/vacation-requests', requestData);
    },
    onSuccess: (data) => {
      console.log('Create successful:', data);
      queryClient.invalidateQueries({ queryKey: ['/api/vacation-requests/company'] });
      setShowNewRequestModal(false);
      setNewRequestDates({ startDate: null, endDate: null });
      setNewRequestReason("");
      const message = user?.role === 'admin' 
        ? "Tu solicitud de ausencia ha sido aprobada automáticamente" 
        : "Tu solicitud de ausencia ha sido enviada y está pendiente de aprobación";
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

  // Fetch custom holidays
  const { data: customHolidays = [], isLoading: loadingHolidays, refetch: refetchHolidays } = useQuery({
    queryKey: ['/api/holidays/custom'],
    staleTime: 10 * 60 * 1000, // 10 minutes
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

  const filteredRequests = (vacationRequests || []).filter((request: VacationRequest) => {
    const matchesStatus = selectedStatus === "all" || request.status === selectedStatus;
    const matchesEmployee = selectedEmployeeId === "all" || request.userId === parseInt(selectedEmployeeId);
    const matchesAbsenceType = selectedAbsenceType === "all" || (request.absenceType || 'vacation') === selectedAbsenceType;
    return matchesStatus && matchesEmployee && matchesAbsenceType;
  });
  
  // Filtrar empleados para el buscador
  const filteredEmployeesForSearch = (employees || []).filter((emp: Employee) =>
    emp.fullName.toLowerCase().includes(employeeSearchTerm.toLowerCase())
  );

  const pendingRequests = (vacationRequests || []).filter((r: VacationRequest) => r.status === 'pending');
  const approvedRequests = (vacationRequests || []).filter((r: VacationRequest) => r.status === 'approved');

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
    const holidaysCount = spanishHolidays2025.filter(holiday => 
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

  const openRequestModal = (request: VacationRequest, action: 'approve' | 'deny' | 'edit' | 'revert') => {
    setSelectedRequest(request);
    setModalAction(action);
    setEditDates({
      startDate: request.startDate ? new Date(request.startDate) : null,
      endDate: request.endDate ? new Date(request.endDate) : null
    });
    setAdminComment("");
    setShowRequestModal(true);
  };

  const handleRequestAction = () => {
    if (!selectedRequest) return;

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
  };

  // Handle new request creation
  const handleCreateRequest = () => {
    if (!newRequestDates.startDate || !newRequestDates.endDate) return;

    createRequestMutation.mutate({
      startDate: newRequestDates.startDate.toISOString().split('T')[0],
      endDate: newRequestDates.endDate.toISOString().split('T')[0],
      reason: newRequestReason.trim() || undefined
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
            setSearchTerm('');
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
            setSearchTerm('');
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
          value={spanishHolidays2025.length}
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
              <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-4">
                {/* Filtro Estado */}
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-[120px] md:w-[130px]">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="pending">Pendientes</SelectItem>
                    <SelectItem value="approved">Aprobadas</SelectItem>
                    <SelectItem value="denied">Denegadas</SelectItem>
                  </SelectContent>
                </Select>
                
                {/* Filtro Empleado con buscador */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[160px] md:w-[180px] justify-between font-normal">
                      <span className="truncate">
                        {selectedEmployeeId === "all" 
                          ? "Todos los empleados" 
                          : employees.find((e: Employee) => e.id === parseInt(selectedEmployeeId))?.fullName || "Empleado"}
                      </span>
                      <User className="w-4 h-4 ml-2 flex-shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[240px] p-0" align="start">
                    <div className="p-2 border-b">
                      <Input
                        placeholder="Buscar empleado..."
                        value={employeeSearchTerm}
                        onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                        className="h-8"
                      />
                    </div>
                    <div className="max-h-[200px] overflow-y-auto p-1">
                      <button
                        onClick={() => { setSelectedEmployeeId("all"); setEmployeeSearchTerm(""); }}
                        className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors ${selectedEmployeeId === "all" ? "bg-muted font-medium" : ""}`}
                      >
                        Todos los empleados
                      </button>
                      {filteredEmployeesForSearch.map((emp: Employee) => (
                        <button
                          key={emp.id}
                          onClick={() => { setSelectedEmployeeId(emp.id.toString()); setEmployeeSearchTerm(""); }}
                          className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors truncate ${selectedEmployeeId === emp.id.toString() ? "bg-muted font-medium" : ""}`}
                        >
                          {emp.fullName}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                
                {/* Filtro Tipo de Ausencia */}
                <Select value={selectedAbsenceType} onValueChange={setSelectedAbsenceType}>
                  <SelectTrigger className="w-[140px] md:w-[160px]">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los tipos</SelectItem>
                    {Object.entries(ABSENCE_TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
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
                    <span className="hidden sm:inline">Nueva Solicitud</span>
                    <span className="sm:hidden">Nueva</span>
                  </Button>
                )}
              </div>
            {filteredRequests.length === 0 && !loadingRequests ? (
              <div className="text-center py-8 text-muted-foreground">
                {vacationRequests.length === 0 
                  ? "No hay solicitudes de ausencias" 
                  : "No se encontraron solicitudes con los filtros aplicados"}
                <div className="text-xs text-muted-foreground/60 mt-2">
                  Total de solicitudes: {vacationRequests.length}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRequests.map((request: VacationRequest) => {
                  const absenceType = request.absenceType || 'vacation';
                  const AbsenceIcon = ABSENCE_TYPE_ICONS[absenceType] || Plane;
                  const absenceLabel = ABSENCE_TYPE_LABELS[absenceType] || 'Vacaciones';
                  const absenceColors = ABSENCE_TYPE_COLORS[absenceType] || ABSENCE_TYPE_COLORS.vacation;
                  const daysCount = request.startDate && request.endDate 
                    ? calculateDays(request.startDate, request.endDate)
                    : request.days || 0;
                  
                  return (
                    <div
                      key={request.id}
                      className="bg-card dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-all hover:shadow-md"
                    >
                      {/* Header con estado - solo móvil */}
                      <div className={`md:hidden px-4 py-2.5 flex items-center justify-between ${
                        request.status === 'pending'
                          ? 'bg-amber-50 dark:bg-amber-950/30 border-b border-amber-100 dark:border-amber-900/50'
                          : request.status === 'approved'
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-900/50'
                          : 'bg-rose-50 dark:bg-rose-950/30 border-b border-rose-100 dark:border-rose-900/50'
                      }`}>
                        <div className="flex items-center gap-2">
                          <AbsenceIcon className={`w-4 h-4 ${absenceColors.text}`} />
                          <span className={`text-sm font-medium ${absenceColors.text}`}>{absenceLabel}</span>
                        </div>
                        {getStatusBadge(request.status)}
                      </div>

                      {/* Desktop - fila con grid proporcional */}
                      <div className="hidden md:flex items-stretch min-w-0">
                        {/* Contenido principal con grid proporcional - nunca corta textos */}
                        <div className="flex-1 grid items-center px-4 py-3 gap-2 lg:gap-3 min-w-0" style={{ gridTemplateColumns: 'minmax(120px,1.8fr) minmax(140px,1.5fr) auto auto auto 1fr auto auto' }}>
                          {/* Nombre y tipo de ausencia en dos filas */}
                          <div className="flex items-center gap-2 min-w-0">
                            <AbsenceIcon className={`w-5 h-5 flex-shrink-0 ${absenceColors.text}`} />
                            <div className="min-w-0">
                              <span className={`text-[10px] font-medium ${absenceColors.text} block`}>{absenceLabel}</span>
                              <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate text-sm leading-tight">
                                {request.user?.fullName}
                              </h3>
                            </div>
                          </div>
                          
                          {/* Fechas - proporcional, nunca trunca */}
                          <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                            <CalendarDays className="w-4 h-4 flex-shrink-0" />
                            <span className="whitespace-nowrap">
                              {request.startDate && request.endDate 
                                ? formatVacationDatesShort(request.startDate, request.endDate)
                                : "N/A"}
                            </span>
                          </div>
                          
                          {/* Días */}
                          <div>
                            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                              {daysCount}d
                            </span>
                          </div>
                          
                          {/* Icono de notas si hay motivo */}
                          <div className="flex justify-center w-8">
                            {request.reason && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button 
                                    className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <FileText className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-72 p-4" side="top">
                                  <div className="space-y-2">
                                    <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100">Observaciones</h4>
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
                                    <a 
                                      href={request.attachmentPath}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Download className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                                    </a>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    <p className="text-sm">Descargar justificante</p>
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
                            {request.status === 'pending' ? 'Pendiente' : request.status === 'approved' ? 'Aprobada' : 'Denegada'}
                          </span>
                        </div>
                      </div>

                      {/* Contenido móvil */}
                      <div className="md:hidden px-4 py-3 space-y-3">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                            {request.user?.fullName}
                          </h3>
                          
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
                                  <button
                                    onClick={() => openRequestModal(request, 'revert')}
                                    className="p-2 rounded-xl text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/30 transition-colors"
                                  >
                                    <RotateCcw className="w-5 h-5" />
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            </div>
          )}

          {activeTab === 'employees' && (
            <div className="space-y-6">
              {/* Timeline de Vacaciones tipo Gantt */}
              {employees.length === 0 && !loadingEmployees ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay empleados registrados
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
                              {timelineViewMode === 'month' 
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
                            {timelineViewMode === 'month' 
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
                      </div>
                    </div>
                  </div>

                  {/* Desktop: Lista de Empleados con Timeline */}
                  <div className="hidden md:block divide-y">
                    {employees.map((employee: Employee) => {
                      // Calcular días usados y disponibles
                      const employeeRequests = vacationRequests.filter((req: VacationRequest) => 
                        req.userId === employee.id && req.status === 'approved'
                      );
                      const usedDays = employeeRequests.reduce((sum, req) => 
                        sum + (req.startDate && req.endDate ? calculateDays(req.startDate, req.endDate) : 0), 0
                      );
                      const totalDays = Math.round(parseFloat(employee.totalVacationDays) || 0);
                      const availableDays = Math.round(Math.max(0, totalDays - usedDays));
                      const usagePercent = (usedDays / totalDays) * 100;
                      
                      const timelineRange = getTimelineRange();
                      
                      return (
                        <div key={employee.id} className="p-4 hover:bg-muted/10">
                          <div className="flex items-center">
                            {/* Información del Empleado */}
                            <div className="w-72 flex-shrink-0 pr-6">
                              <div className="flex items-center gap-3">
                                <UserAvatar fullName={employee.fullName} size="sm" userId={employee.id} profilePicture={employee.profilePicture} />
                                <div className="flex-1">
                                  <h4 className="font-medium text-foreground truncate">
                                    {employee.fullName}
                                  </h4>
                                  <div className="text-xs text-muted-foreground space-y-1">
                                    <div>
                                      <span className="font-medium">{usedDays}</span>/{totalDays} días usados
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                                        <div 
                                          className="bg-primary h-2 rounded-full transition-all duration-700 ease-out"
                                          style={{ width: loadingRequests ? '0%' : `${Math.min(100, usagePercent)}%` }}
                                        />
                                      </div>
                                      <span className={`text-xs font-medium text-green-600 dark:text-green-400 transition-opacity duration-300 ${loadingRequests ? 'opacity-50' : ''}`}>
                                        {availableDays} rest.
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Timeline Horizontal */}
                            <div className="flex-1 relative">
                              {/* Fondo del timeline con marcas de días */}
                              <div className="relative h-14 bg-muted rounded border border-border">
                                {/* Grid de días (solo mostrar algunos para no saturar) */}
                                {timelineRange.days
                                  .filter((_, index) => index % (timelineViewMode === 'month' ? 3 : 7) === 0)
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
                  </div>

                  {/* Mobile: Vertical Timeline View */}
                  <div className="md:hidden divide-y">
                    {employees.map((employee: Employee) => {
                      // Calcular días usados y disponibles
                      const employeeRequests = vacationRequests.filter((req: VacationRequest) => 
                        req.userId === employee.id && req.status === 'approved'
                      );
                      const usedDays = employeeRequests.reduce((sum, req) => 
                        sum + (req.startDate && req.endDate ? calculateDays(req.startDate, req.endDate) : 0), 0
                      );
                      const totalDays = Math.round(parseFloat(employee.totalVacationDays) || 0);
                      const availableDays = Math.round(Math.max(0, totalDays - usedDays));
                      const usagePercent = (usedDays / totalDays) * 100;
                      
                      const timelineRange = getTimelineRange();
                      
                      return (
                        <div key={employee.id} className="p-4 bg-card">
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
                              <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                                <div 
                                  className="bg-primary h-2 rounded-full transition-all duration-700 ease-out"
                                  style={{ width: loadingRequests ? '0%' : `${Math.min(100, usagePercent)}%` }}
                                />
                              </div>
                            </div>

                          </div>

                          {/* Mobile Timeline */}
                          <div className="relative">
                            {/* Fondo del timeline con marcas de días */}
                            <div 
                              className="relative h-12 bg-muted rounded border border-border overflow-hidden touch-pan-y select-none"
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
                            placeholder={{
                              start: "Fecha inicio",
                              end: "Fecha fin"
                            }}
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
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
              {spanishHolidays2025.map((holiday, index) => (
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
                {selectedRequest.reason && (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Motivo:</span> {selectedRequest.reason}
                  </p>
                )}
              </div>

              {modalAction === 'edit' && (
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
                  disabled={updateRequestMutation.isPending || (modalAction === 'deny' && !adminComment.trim())}
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
                  {updateRequestMutation.isPending ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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

      {/* New Request Modal for Managers and Admins */}
      <Dialog open={showNewRequestModal} onOpenChange={setShowNewRequestModal}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#007AFF]" />
              Nueva Solicitud de Ausencia
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Información del solicitante */}
            <div className="p-3 bg-muted/20 rounded-lg">
              <h3 className="font-medium text-foreground mb-1">{user?.fullName}</h3>
              <p className="text-sm text-muted-foreground">
                {user?.role === 'admin' ? 'Administrador' : user?.role === 'manager' ? 'Manager' : 'Empleado'}
              </p>
              {user?.role === 'admin' && (
                <p className="text-xs text-green-600 mt-1">
                  ✓ Tu solicitud será aprobada automáticamente
                </p>
              )}
              {user?.role === 'manager' && (
                <p className="text-xs text-yellow-600 mt-1">
                  ⏳ Tu solicitud será enviada al administrador para aprobación
                </p>
              )}
            </div>

            {/* Selector de fechas */}
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">
                  Período de ausencia
                </label>
                <DatePickerPeriod
                  startDate={newRequestDates.startDate || undefined}
                  endDate={newRequestDates.endDate || undefined}
                  onStartDateChange={(date) => setNewRequestDates(prev => ({ ...prev, startDate: date || null }))}
                  onEndDateChange={(date) => setNewRequestDates(prev => ({ ...prev, endDate: date || null }))}
                />
              </div>
              
              {/* Mostrar días calculados */}
              {newRequestDates.startDate && newRequestDates.endDate && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">Días solicitados:</span> {
                    calculateDays(
                      newRequestDates.startDate.toISOString().split('T')[0],
                      newRequestDates.endDate.toISOString().split('T')[0]
                    )
                  }
                </div>
              )}
            </div>

            {/* Motivo (opcional) */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                Motivo (opcional)
              </label>
              <Textarea
                value={newRequestReason}
                onChange={(e) => setNewRequestReason(e.target.value)}
                placeholder="Describe el motivo de tus vacaciones..."
                rows={3}
              />
            </div>

            <div className="flex justify-center sm:justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowNewRequestModal(false);
                  setNewRequestDates({ startDate: null, endDate: null });
                  setNewRequestReason("");
                }}
                className="flex-1 sm:w-auto"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreateRequest}
                disabled={createRequestMutation.isPending || !newRequestDates.startDate || !newRequestDates.endDate}
                className="bg-[#007AFF] hover:bg-[#0056CC] flex-1 sm:w-auto"
              >
                {createRequestMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-1" />
                    {user?.role === 'admin' ? 'Aprobar Solicitud' : 'Enviar Solicitud'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}