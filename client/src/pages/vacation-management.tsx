import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { CalendarDays, Users, MapPin, Plus, Check, X, Clock, Plane, Edit, MessageSquare, RotateCcw, ChevronLeft, ChevronRight, Calendar, User } from "lucide-react";
import { format, differenceInDays, parseISO, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import StatsCard from "@/components/StatsCard";
import { useAuth } from "@/hooks/use-auth";
import { TabNavigation } from "@/components/ui/tab-navigation";
import { UserAvatar } from "@/components/ui/user-avatar";

interface VacationRequest {
  id: number;
  userId: number;
  startDate: string;
  endDate: string;
  days: number;
  reason?: string;
  status: 'pending' | 'approved' | 'denied';
  requestDate: string;
  user?: {
    fullName: string;
    email: string;
  };
}

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
  const { company } = useAuth();
  const [activeTab, setActiveTab] = useState("employees");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [newHoliday, setNewHoliday] = useState<{ name: string; startDate: Date | null; endDate: Date | null; type: 'national' | 'regional' | 'local' }>({ name: "", startDate: null, endDate: null, type: "regional" });
  const [showAddHoliday, setShowAddHoliday] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<VacationRequest | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [modalAction, setModalAction] = useState<'approve' | 'deny' | 'edit' | 'revert'>('approve');
  const [editDates, setEditDates] = useState({ startDate: null as Date | null, endDate: null as Date | null });
  const [adminComment, setAdminComment] = useState("");
  
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

      return (
        <div
          key={tooltipId}
          data-vacation-bar
          className={`absolute rounded-md cursor-pointer transition-all ${
            period.status === 'approved' 
              ? 'bg-blue-500 border-blue-600 hover:bg-blue-600' 
              : 'bg-yellow-400 border-yellow-500 hover:bg-yellow-500'
          } border opacity-90 hover:opacity-100 flex items-center justify-center`}
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
          {/* Número de días visible siempre */}
          <div className="text-white text-xs md:text-sm font-bold select-none">
            {fullRequest?.startDate && fullRequest?.endDate 
              ? calculateDays(fullRequest.startDate, fullRequest.endDate)
              : fullRequest?.days || duration
            }
          </div>

          {/* Panel de información que aparece al hacer clic */}
          {isTooltipActive && (
            <>
              {/* Overlay semi-transparente para evitar interferencias */}
              <div 
                className="fixed inset-0 bg-black bg-opacity-25"
                style={{ zIndex: 99998 }}
                onClick={() => setActiveTooltip(null)}
              />
              
              <div 
                data-vacation-tooltip
                className="fixed bg-card border border-border rounded-lg shadow-xl mx-auto"
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
              {/* Contenido con padding como las tarjetas de solicitudes */}
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-foreground">{fullRequest?.user?.fullName}</h3>
                  {getStatusBadge(period.status)}
                </div>
                
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>
                    <span className="font-medium">Fechas:</span>{" "}
                    {format(period.startDate, "dd/MM/yyyy", { locale: es })} -{" "}
                    {format(period.endDate, "dd/MM/yyyy", { locale: es })}
                  </p>
                  <p>
                    <span className="font-medium">Días:</span> {
                      fullRequest?.startDate && fullRequest?.endDate 
                        ? calculateDays(fullRequest.startDate, fullRequest.endDate)
                        : fullRequest?.days || duration
                    }
                  </p>
                  {fullRequest?.reason && (
                    <p>
                      <span className="font-medium">Motivo:</span> {fullRequest.reason}
                    </p>
                  )}
                  <p>
                    <span className="font-medium">Solicitado:</span>{" "}
                    {fullRequest?.requestDate ? format(new Date(fullRequest.requestDate), "dd/MM/yyyy", { locale: es }) : 
                     fullRequest?.createdAt ? format(new Date(fullRequest.createdAt), "dd/MM/yyyy", { locale: es }) : "N/A"}
                  </p>
                </div>

                {/* Botones de acción - Mismo estilo que las tarjetas móviles */}
                {period.status === 'pending' ? (
                  <div className="grid grid-cols-3 gap-2 w-full">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTooltip(null);
                        if (fullRequest) openRequestModal(fullRequest, 'approve');
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white h-9 w-full flex items-center justify-center rounded-lg transition-colors"
                      title="Aprobar solicitud"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTooltip(null);
                        if (fullRequest) openRequestModal(fullRequest, 'edit');
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white h-9 w-full flex items-center justify-center rounded-lg transition-colors"
                      title="Editar solicitud"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTooltip(null);
                        if (fullRequest) openRequestModal(fullRequest, 'deny');
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white h-9 w-full flex items-center justify-center rounded-lg transition-colors"
                      title="Denegar solicitud"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex w-full">
                    {(period.status === 'approved' || period.status === 'denied') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTooltip(null);
                          if (fullRequest) openRequestModal(fullRequest, 'revert');
                        }}
                        className="text-orange-600 border border-orange-300 hover:bg-orange-50 h-9 w-full flex items-center justify-center rounded-lg transition-colors"
                        title="Revertir a pendiente"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
              </div>
            </>
          )}
        </div>
      );
    }).filter(Boolean);
  };
  // ⚠️ END PROTECTED TIMELINE FUNCTIONS ⚠️

  // Fetch vacation requests
  const { data: vacationRequests = [], isLoading: loadingRequests } = useQuery({
    queryKey: ['/api/vacation-requests/company'],
    staleTime: 5 * 60 * 1000,
    select: (data) => {
      // Ensure data consistency and handle missing fields
      if (!data || !Array.isArray(data)) return [];
      return data.map((request: any) => ({
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
    const matchesSearch = searchTerm === "" || 
      (request.user?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
    return matchesStatus && matchesSearch;
  });

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

  return (
    <div className="px-6 py-4 min-h-screen bg-background" style={{ overflowX: 'clip' }}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Gestión de Vacaciones</h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">
          Gestiona solicitudes de vacaciones y empleados
        </p>
      </div>
      {/* Stats Cards with Navigation - Unified Component */}
      <div className="mb-3">
        <div className="grid grid-cols-4 gap-2 md:gap-6">
          <StatsCard
            title="Solicitudes"
            subtitle="Pendientes"
            value={stats.pending}
            color="yellow"
            icon={Clock}
            onClick={() => {
              setActiveTab('requests');
              setSelectedStatus('pending');
              setSearchTerm('');
            }}
          />

          <StatsCard
            title="Solicitudes"
            subtitle="Aprobadas"
            value={stats.approved}
            color="green"
            icon={Check}
            onClick={() => {
              setActiveTab('requests');
              setSelectedStatus('approved');
              setSearchTerm('');
            }}
          />

          <StatsCard
            title="Empleados"
            subtitle="De Vacaciones"
            value={stats.onVacation}
            color="blue"
            icon={Plane}
            onClick={() => setActiveTab('employees')}
          />

          <StatsCard
            title="Días Festivos"
            subtitle="2025"
            value={spanishHolidays2025.length}
            color="purple"
            icon={CalendarDays}
            onClick={() => setActiveTab('holidays')}
          />
        </div>
      </div>
      {/* Tabs Navigation */}
      <TabNavigation
        tabs={[
          { id: 'employees', label: 'Timeline de Vacaciones', icon: Users },
          { id: 'requests', label: 'Solicitudes', icon: Clock },
          { id: 'holidays', label: 'Días Festivos', icon: CalendarDays }
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      {/* Content based on active tab */}
      <div>
          {activeTab === 'requests' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 justify-between mb-4">
                <Input
                  placeholder="Buscar empleado..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-48"
                />
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="pending">Pendientes</SelectItem>
                    <SelectItem value="approved">Aprobadas</SelectItem>
                    <SelectItem value="denied">Denegadas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            {loadingRequests ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {vacationRequests.length === 0 
                  ? "No hay solicitudes de vacaciones" 
                  : "No se encontraron solicitudes con los filtros aplicados"}
                <div className="text-xs text-muted-foreground/60 mt-2">
                  Total de solicitudes: {vacationRequests.length}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRequests.map((request: VacationRequest) => (
                  <div
                    key={request.id}
                    className="p-4 border border-border rounded-lg hover:bg-muted/10 bg-card"
                  >
                    {/* Desktop: layout horizontal */}
                    <div className="hidden md:flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-medium text-foreground">{request.user?.fullName}</h3>
                          {getStatusBadge(request.status)}
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>
                            <span className="font-medium">Fechas:</span>{" "}
                            {request.startDate ? format(new Date(request.startDate), "dd/MM/yyyy", { locale: es }) : "N/A"} -{" "}
                            {request.endDate ? format(new Date(request.endDate), "dd/MM/yyyy", { locale: es }) : "N/A"}
                          </p>
                          <p>
                            <span className="font-medium">Días:</span> {
                              request.startDate && request.endDate 
                                ? calculateDays(request.startDate, request.endDate)
                                : request.days || "N/A"
                            }
                          </p>
                          {request.reason && (
                            <p>
                              <span className="font-medium">Motivo:</span> {request.reason}
                            </p>
                          )}
                          <p>
                            <span className="font-medium">Solicitado:</span>{" "}
                            {request.requestDate ? format(new Date(request.requestDate), "dd/MM/yyyy", { locale: es }) : 
                             request.createdAt ? format(new Date(request.createdAt), "dd/MM/yyyy", { locale: es }) : "N/A"}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 ml-4">
                        {request.status === 'pending' ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => openRequestModal(request, 'approve')}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Aprobar
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => openRequestModal(request, 'edit')}
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              Modificar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => openRequestModal(request, 'deny')}
                            >
                              <X className="w-4 h-4 mr-1" />
                              Denegar
                            </Button>
                          </>
                        ) : (
                          <div className="flex gap-2">
                            {(request.status === 'approved' || request.status === 'denied') && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openRequestModal(request, 'revert')}
                                className="text-orange-600 border-orange-300 hover:bg-orange-50"
                              >
                                <RotateCcw className="w-4 h-4 mr-1" />
                                Revertir
                              </Button>
                            )}
                            <Badge variant="outline" className="text-xs">
                              {request.status === 'approved' ? 'Aprobada' : 'Denegada'}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Mobile: layout vertical */}
                    <div className="md:hidden space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-foreground">{request.user?.fullName}</h3>
                        {getStatusBadge(request.status)}
                      </div>
                      
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>
                          <span className="font-medium">Fechas:</span>{" "}
                          {request.startDate ? format(new Date(request.startDate), "dd/MM/yyyy", { locale: es }) : "N/A"} -{" "}
                          {request.endDate ? format(new Date(request.endDate), "dd/MM/yyyy", { locale: es }) : "N/A"}
                        </p>
                        <p>
                          <span className="font-medium">Días:</span> {
                            request.startDate && request.endDate 
                              ? calculateDays(request.startDate, request.endDate)
                              : request.days || "N/A"
                          }
                        </p>
                        {request.reason && (
                          <p>
                            <span className="font-medium">Motivo:</span> {request.reason}
                          </p>
                        )}
                        <p>
                          <span className="font-medium">Solicitado:</span>{" "}
                          {request.requestDate ? format(new Date(request.requestDate), "dd/MM/yyyy", { locale: es }) : 
                           request.createdAt ? format(new Date(request.createdAt), "dd/MM/yyyy", { locale: es }) : "N/A"}
                        </p>
                      </div>

                      {/* Mobile action buttons */}
                      {request.status === 'pending' ? (
                        <div className="grid grid-cols-3 gap-2 w-full">
                          <Button
                            size="sm"
                            onClick={() => openRequestModal(request, 'approve')}
                            className="bg-green-600 hover:bg-green-700 text-white h-9 w-full flex items-center justify-center"
                            title="Aprobar solicitud"
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => openRequestModal(request, 'edit')}
                            className="bg-blue-600 hover:bg-blue-700 text-white h-9 w-full flex items-center justify-center"
                            title="Editar solicitud"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => openRequestModal(request, 'deny')}
                            className="h-9 w-full flex items-center justify-center"
                            title="Denegar solicitud"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex w-full">
                          {(request.status === 'approved' || request.status === 'denied') && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openRequestModal(request, 'revert')}
                              className="text-orange-600 border-orange-300 hover:bg-orange-50 h-9 w-full flex items-center justify-center"
                              title="Revertir a pendiente"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>
          )}

          {activeTab === 'employees' && (
            <div className="space-y-6">
              {/* Timeline de Vacaciones tipo Gantt */}
              {loadingEmployees ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : employees.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay empleados registrados
                </div>
              ) : (
                <div className="bg-card rounded-lg border border-border overflow-hidden">
                  {/* Desktop: Header con controles */}
                  <div className="hidden md:block p-4 border-b bg-muted/20">
                    {/* Header unificado con controles y leyenda */}
                    <div className="flex items-center justify-between">
                      {/* Leyenda de colores y controles de navegación compactos */}
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-primary rounded-sm"></div>
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
                        <div className="w-2.5 h-2.5 bg-blue-500 rounded-sm"></div>
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
                      const totalDays = parseFloat(employee.totalVacationDays) || 0;
                      const availableDays = Math.max(0, totalDays - usedDays);
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
                                      <div className="flex-1 bg-muted rounded-full h-2">
                                        <div 
                                          className="bg-primary h-2 rounded-full"
                                          style={{ width: `${Math.min(100, usagePercent)}%` }}
                                        />
                                      </div>
                                      <span className="text-xs font-medium text-green-600 dark:text-green-400">
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
                              <div className="relative h-12 bg-muted/50 rounded border border-border">
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
                                
                                {/* Contenedor específico para barras de vacaciones */}
                                <div className="absolute inset-0 overflow-hidden">
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
                      const totalDays = parseFloat(employee.totalVacationDays) || 0;
                      const availableDays = Math.max(0, totalDays - usedDays);
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
                              <div className="flex-1 bg-muted rounded-full h-2">
                                <div 
                                  className="bg-primary h-2 rounded-full"
                                  style={{ width: `${Math.min(100, usagePercent)}%` }}
                                />
                              </div>
                            </div>

                          </div>

                          {/* Mobile Timeline */}
                          <div className="relative">
                            {/* Fondo del timeline con marcas de días */}
                            <div 
                              className="relative h-10 bg-muted/50 rounded border border-border overflow-hidden touch-pan-y select-none"
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
                              
                              {/* Contenedor específico para barras de vacaciones */}
                              <div className="absolute inset-0 overflow-hidden">
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
                      <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setShowAddHoliday(false);
                            setNewHoliday({ name: "", startDate: null, endDate: null, type: "regional" });
                          }}
                          className="w-full sm:w-auto"
                        >
                          Cancelar
                        </Button>
                        <Button 
                          className="bg-[#007AFF] hover:bg-[#0056CC] w-full sm:w-auto"
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
                      Nuevo período de vacaciones
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
    </div>
  );
}