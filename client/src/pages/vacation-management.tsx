import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [activeTab, setActiveTab] = useState("requests");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [newHoliday, setNewHoliday] = useState({ name: "", date: "", type: "regional" as const });
  const [showAddHoliday, setShowAddHoliday] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<VacationRequest | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [modalAction, setModalAction] = useState<'approve' | 'deny' | 'edit'>('approve');
  const [editDates, setEditDates] = useState({ startDate: null as Date | null, endDate: null as Date | null });
  const [adminComment, setAdminComment] = useState("");
  
  // Estados para el timeline de vacaciones (pestaña empleados)
  const [timelineViewDate, setTimelineViewDate] = useState(new Date());
  const [timelineViewMode, setTimelineViewMode] = useState<'month' | 'quarter'>('month');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
    return vacationRequests
      .filter(req => req.userId === employeeId && (req.status === 'approved' || req.status === 'pending'))
      .map(req => ({
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
    
    return periods.map((period, index) => {
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
      
      const fullRequest = vacationRequests.find(req => req.id === period.id);
      const periodText = `${format(periodStart, "dd/MM")} - ${format(periodEnd, "dd/MM")}`;
      
      return (
        <div
          key={`${employee.id}-${period.id}-${index}`}
          className={`absolute h-12 rounded-md cursor-pointer transition-all group ${
            period.status === 'approved' 
              ? 'bg-blue-500 border-blue-600' 
              : 'bg-yellow-400 border-yellow-500'
          } border opacity-90 hover:opacity-100 flex items-center justify-center`}
          style={{
            left: `${leftPercent}%`,
            width: `${widthPercent}%`,
            top: '0px',
            zIndex: 10
          }}
        >
          {/* Período visible siempre */}
          <div className="text-white text-xs font-medium group-hover:opacity-0 transition-opacity duration-200">
            {periodText}
          </div>

          {/* Información completa y iconos que aparecen en hover */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/20 rounded-md flex flex-col items-center justify-center p-1">
            {/* Información del período */}
            <div className="text-white text-xs font-medium mb-1">
              {periodText}
            </div>
            
            {/* Comentario si existe */}
            {fullRequest?.reason && (
              <div className="text-white text-xs opacity-90 mb-1 text-center px-1 truncate max-w-full">
                {fullRequest.reason}
              </div>
            )}
            
            {/* Iconos de acción */}
            <div className="flex items-center gap-1">
              {period.status === 'pending' ? (
                <>
                  {/* Aprobar */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (fullRequest) openRequestModal(fullRequest, 'approve');
                    }}
                    className="w-6 h-6 bg-green-600 hover:bg-green-700 rounded-full flex items-center justify-center text-white text-xs transition-all hover:scale-110"
                    title="Aprobar"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                  
                  {/* Modificar */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (fullRequest) openRequestModal(fullRequest, 'edit');
                    }}
                    className="w-6 h-6 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center text-white text-xs transition-all hover:scale-110"
                    title="Modificar"
                  >
                    <Edit className="w-3 h-3" />
                  </button>
                  
                  {/* Denegar */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (fullRequest) openRequestModal(fullRequest, 'deny');
                    }}
                    className="w-6 h-6 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center text-white text-xs transition-all hover:scale-110"
                    title="Denegar"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </>
              ) : (
                /* Para solicitudes aprobadas, solo mostrar revertir */
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (fullRequest) openRequestModal(fullRequest, 'revert');
                  }}
                  className="w-6 h-6 bg-orange-600 hover:bg-orange-700 rounded-full flex items-center justify-center text-white text-xs transition-all hover:scale-110"
                  title="Revertir aprobación"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
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
    <div className="px-6 py-4 min-h-screen bg-gray-50" style={{ overflowX: 'clip' }}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Gestión de Vacaciones</h1>
        <p className="text-gray-500 mt-1">
          Gestiona solicitudes de vacaciones y empleados
        </p>
      </div>

        {/* Stats Cards with Navigation - Unified Component */}
        <div className="mb-6">
          <div className="grid grid-cols-4 md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-6">
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
            { id: 'requests', label: 'Solicitudes', icon: Clock },
            { id: 'employees', label: 'Empleados de Vacaciones', icon: Users },
            { id: 'holidays', label: 'Días Festivos', icon: CalendarDays }
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* Content based on active tab */}
        <Card>
          <CardContent className="p-6">
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
                <div className="text-center py-8 text-gray-500">
                  {vacationRequests.length === 0 
                    ? "No hay solicitudes de vacaciones" 
                    : "No se encontraron solicitudes con los filtros aplicados"}
                  <div className="text-xs text-gray-400 mt-2">
                    Total de solicitudes: {vacationRequests.length}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredRequests.map((request: VacationRequest) => (
                    <div
                      key={request.id}
                      className="p-4 border rounded-lg hover:bg-gray-50"
                    >
                      {/* Desktop: layout horizontal */}
                      <div className="hidden md:flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-medium text-gray-900">{request.user?.fullName}</h3>
                            {getStatusBadge(request.status)}
                          </div>
                          <div className="text-sm text-gray-600 space-y-1">
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
                              {request.status === 'approved' && (
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
                          <h3 className="font-medium text-gray-900">{request.user?.fullName}</h3>
                          {getStatusBadge(request.status)}
                        </div>
                        
                        <div className="text-sm text-gray-600 space-y-1">
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
                          <div className="grid grid-cols-3 gap-2">
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
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => openRequestModal(request, 'deny')}
                            >
                              <X className="w-4 h-4 mr-1" />
                              Denegar
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            {request.status === 'approved' && (
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
                  <div className="text-center py-8 text-gray-500">
                    No hay empleados registrados
                  </div>
                ) : (
                  <div className="bg-white rounded-lg border overflow-hidden">
                    <div className="p-4 border-b bg-gray-50">
                      {/* Header unificado con controles y leyenda */}
                      <div className="flex items-center justify-between">
                        {/* Leyenda de colores y controles de navegación compactos */}
                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
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
                              <span className="text-sm font-medium text-gray-900">
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

                    {/* Lista de Empleados con Timeline */}
                    <div className="divide-y">
                      {employees.map((employee: Employee) => {
                        // Calcular días usados y disponibles
                        const employeeRequests = vacationRequests.filter((req: VacationRequest) => 
                          req.userId === employee.id && req.status === 'approved'
                        );
                        const usedDays = employeeRequests.reduce((sum, req) => 
                          sum + (req.startDate && req.endDate ? calculateDays(req.startDate, req.endDate) : 0), 0
                        );
                        const totalDays = parseInt(employee.totalVacationDays) || 22;
                        const availableDays = Math.max(0, totalDays - usedDays);
                        const usagePercent = (usedDays / totalDays) * 100;
                        
                        const timelineRange = getTimelineRange();
                        
                        return (
                          <div key={employee.id} className="p-4 hover:bg-gray-50">
                            <div className="flex items-center">
                              {/* Información del Empleado */}
                              <div className="w-72 flex-shrink-0 pr-6">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-blue-100 rounded-full">
                                    <User className="w-4 h-4 text-blue-600" />
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="font-medium text-gray-900 truncate">
                                      {employee.fullName}
                                    </h4>
                                    <div className="text-xs text-gray-500 space-y-1">
                                      <div>
                                        <span className="font-medium">{usedDays}</span>/{totalDays} días usados
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                                          <div 
                                            className="bg-blue-500 h-2 rounded-full"
                                            style={{ width: `${Math.min(100, usagePercent)}%` }}
                                          />
                                        </div>
                                        <span className="text-xs font-medium text-green-600">
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
                                <div className="relative h-12 bg-gray-100 rounded border overflow-hidden">
                                  {/* Grid de días (solo mostrar algunos para no saturar) */}
                                  {timelineRange.days
                                    .filter((_, index) => index % (timelineViewMode === 'month' ? 3 : 7) === 0)
                                    .map((day, index) => (
                                      <div
                                        key={index}
                                        className="absolute top-0 bottom-0 w-px bg-gray-200"
                                        style={{
                                          left: `${(eachDayOfInterval({
                                            start: timelineRange.start,
                                            end: day
                                          }).length - 1) / timelineRange.days.length * 100}%`
                                        }}
                                      />
                                    ))
                                  }
                                  
                                  {/* Barras de vacaciones */}
                                  {renderVacationBar(employee, timelineRange)}
                                </div>
                                
                                {/* Labels de días debajo del timeline */}
                                <div className="flex justify-between text-xs text-gray-400 mt-1">
                                  <span>{format(timelineRange.start, "dd/MM")}</span>
                                  <span>{format(timelineRange.end, "dd/MM")}</span>
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
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Añadir Día Festivo</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <Input
                          placeholder="Nombre del festivo"
                          value={newHoliday.name}
                          onChange={(e) => setNewHoliday(prev => ({ ...prev, name: e.target.value }))}
                        />
                        <Input
                          type="date"
                          value={newHoliday.date}
                          onChange={(e) => setNewHoliday(prev => ({ ...prev, date: e.target.value }))}
                        />
                        <Select 
                          value={newHoliday.type} 
                          onValueChange={(value: 'national' | 'regional' | 'local') => 
                            setNewHoliday(prev => ({ ...prev, type: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="national">Nacional</SelectItem>
                            <SelectItem value="regional">Regional</SelectItem>
                            <SelectItem value="local">Local</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setShowAddHoliday(false)}>
                            Cancelar
                          </Button>
                          <Button className="bg-[#007AFF] hover:bg-[#0056CC]">
                            Añadir
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

                {spanishHolidays2025.map((holiday, index) => (
                  <Card key={index} className="border-green-200 bg-green-50">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-gray-900 mb-1">{holiday.name}</h3>
                          <p className="text-sm text-gray-600">
                            {format(new Date(holiday.date), "dd/MM/yyyy", { locale: es })}
                          </p>
                          <Badge 
                            variant="secondary" 
                            className="mt-2 text-xs bg-green-100 text-green-800"
                          >
                            {holiday.type === 'national' ? 'Nacional' : 
                             holiday.type === 'regional' ? 'Regional' : 'Local'}
                          </Badge>
                        </div>
                        <MapPin className="w-4 h-4 text-green-600" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      {/* Request Management Modal */}
      <Dialog open={showRequestModal} onOpenChange={setShowRequestModal}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {modalAction === 'approve' && <Check className="w-5 h-5 text-green-600" />}
              {modalAction === 'deny' && <X className="w-5 h-5 text-red-600" />}
              {modalAction === 'edit' && <Edit className="w-5 h-5 text-blue-600" />}
              
              {modalAction === 'approve' && 'Aprobar Solicitud'}
              {modalAction === 'deny' && 'Denegar Solicitud'}
              {modalAction === 'edit' && 'Modificar Solicitud'}
            </DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-1">{selectedRequest.user?.fullName}</h3>
                <p className="text-sm text-gray-600">
                  {selectedRequest.startDate ? format(new Date(selectedRequest.startDate), "dd/MM/yyyy", { locale: es }) : "N/A"} -{" "}
                  {selectedRequest.endDate ? format(new Date(selectedRequest.endDate), "dd/MM/yyyy", { locale: es }) : "N/A"}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Días:</span> {
                    selectedRequest.startDate && selectedRequest.endDate 
                      ? calculateDays(selectedRequest.startDate, selectedRequest.endDate)
                      : selectedRequest.days || "N/A"
                  }
                </p>
                {selectedRequest.reason && (
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Motivo:</span> {selectedRequest.reason}
                  </p>
                )}
              </div>

              {modalAction === 'edit' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                      Nuevo período de vacaciones
                    </label>
                    <DatePickerPeriod
                      startDate={editDates.startDate}
                      endDate={editDates.endDate}
                      onStartDateChange={(date) => setEditDates(prev => ({ ...prev, startDate: date || null }))}
                      onEndDateChange={(date) => setEditDates(prev => ({ ...prev, endDate: date || null }))}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block flex items-center gap-2">
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