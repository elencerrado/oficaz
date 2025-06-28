import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, eachDayOfInterval, isSameDay, parseISO, addDays, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";
import { TabNavigation } from "@/components/ui/tab-navigation";
import { 
  Calendar, 
  Clock, 
  CalendarDays, 
  ChevronLeft, 
  ChevronRight, 
  User,
  RotateCcw,
  Check,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

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

export default function VacationManagementClean() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Estados principales
  const [activeTab, setActiveTab] = useState<"timeline" | "requests" | "holidays">("timeline");
  const [timelineViewMode, setTimelineViewMode] = useState<'month' | 'quarter'>('month');
  const [timelineDate, setTimelineDate] = useState(new Date());
  
  // Estados para drag and drop
  const [isDragging, setIsDragging] = useState(false);
  const [dragData, setDragData] = useState<{
    requestId: number;
    startX: number;
    originalStartDate: string;
    originalEndDate: string;
    timelineRange: any;
  } | null>(null);

  // Fetch data
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['/api/employees'],
    staleTime: 60000,
  });

  const { data: vacationRequests = [] } = useQuery<VacationRequest[]>({
    queryKey: ['/api/vacation-requests/company'],
    staleTime: 30000,
  });

  // Mutation para actualizar solicitud de vacaciones
  const updateVacationMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await apiRequest('PATCH', `/api/vacation-requests/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vacation-requests/company'] });
      toast({
        title: "Solicitud actualizada",
        description: "Las fechas de vacaciones han sido actualizadas correctamente.",
      });
    },
    onError: (error) => {
      console.error('Error updating vacation request:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la solicitud de vacaciones.",
        variant: "destructive",
      });
    },
  });

  // Funciones auxiliares
  const calculateDays = (startDate: string, endDate: string) => {
    return differenceInDays(parseISO(endDate), parseISO(startDate)) + 1;
  };

  const getTimelineRange = () => {
    if (timelineViewMode === 'month') {
      const start = startOfMonth(timelineDate);
      const end = endOfMonth(timelineDate);
      return {
        start,
        end,
        days: eachDayOfInterval({ start, end })
      };
    } else {
      const start = startOfMonth(timelineDate);
      const end = endOfMonth(addMonths(timelineDate, 2));
      return {
        start,
        end,
        days: eachDayOfInterval({ start, end })
      };
    }
  };

  const dateToPixels = (date: Date, timelineRange: any) => {
    const dayIndex = timelineRange.days.findIndex((d: Date) => 
      isSameDay(d, date)
    );
    return dayIndex >= 0 ? (dayIndex / timelineRange.days.length) * 100 : 0;
  };

  const pixelsToDate = (pixels: number, timelineRange: any) => {
    const percentage = pixels / 100;
    const dayIndex = Math.round(percentage * timelineRange.days.length);
    return timelineRange.days[dayIndex] || null;
  };

  // Event handlers para drag and drop
  const handleBarMouseDown = (e: React.MouseEvent, request: VacationRequest, timelineRange: any) => {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = e.currentTarget.closest('[data-timeline-container]')?.getBoundingClientRect();
    if (!rect) return;
    
    setDragData({
      requestId: request.id,
      startX: e.clientX - rect.left,
      originalStartDate: request.startDate,
      originalEndDate: request.endDate,
      timelineRange
    });
    
    setIsDragging(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragData || !isDragging) return;
    
    const rect = document.querySelector('[data-timeline-container]')?.getBoundingClientRect();
    if (!rect) return;
    
    const currentX = e.clientX - rect.left;
    const deltaX = currentX - dragData.startX;
    
    // Convertir delta de píxeles a días
    const timelineWidth = rect.width;
    const totalDays = dragData.timelineRange.days.length;
    const pixelsPerDay = timelineWidth / totalDays;
    const daysDelta = Math.round(deltaX / pixelsPerDay);
    
    if (Math.abs(daysDelta) < 1) return; // No hay cambio significativo
    
    const originalStart = parseISO(dragData.originalStartDate);
    const originalEnd = parseISO(dragData.originalEndDate);
    
    const newStartDate = addDays(originalStart, daysDelta);
    const newEndDate = addDays(originalEnd, daysDelta);
    
    // Validar que las fechas estén dentro del rango
    if (newStartDate >= dragData.timelineRange.start && newEndDate <= dragData.timelineRange.end) {
      // Todo se ve bien, el usuario puede soltar para confirmar
    }
  };

  const handleMouseUp = (e: MouseEvent) => {
    if (!dragData || !isDragging) return;
    
    const rect = document.querySelector('[data-timeline-container]')?.getBoundingClientRect();
    if (!rect) return;
    
    // Calcular las nuevas fechas basadas en la posición final del mouse
    const currentX = e.clientX - rect.left;
    const deltaX = currentX - dragData.startX;
    
    const timelineWidth = rect.width;
    const totalDays = dragData.timelineRange.days.length;
    const pixelsPerDay = timelineWidth / totalDays;
    const daysDelta = Math.round(deltaX / pixelsPerDay);
    
    if (Math.abs(daysDelta) >= 1) {
      const originalStart = parseISO(dragData.originalStartDate);
      const originalEnd = parseISO(dragData.originalEndDate);
      
      const newStartDate = addDays(originalStart, daysDelta);
      const newEndDate = addDays(originalEnd, daysDelta);
      
      // Validar que las fechas estén dentro del rango del timeline
      if (newStartDate >= dragData.timelineRange.start && newEndDate <= dragData.timelineRange.end) {
        // Actualizar la solicitud en la base de datos
        updateVacationMutation.mutate({
          id: dragData.requestId,
          data: {
            startDate: format(newStartDate, 'yyyy-MM-dd'),
            endDate: format(newEndDate, 'yyyy-MM-dd'),
            days: calculateDays(format(newStartDate, 'yyyy-MM-dd'), format(newEndDate, 'yyyy-MM-dd'))
          }
        });
      } else {
        toast({
          title: "Fechas fuera del rango",
          description: "Las nuevas fechas están fuera del período visible del timeline.",
          variant: "destructive",
        });
      }
    }
    
    setIsDragging(false);
    setDragData(null);
  };

  // Event listeners para mouse y cambiar cursor
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isDragging, dragData]);

  // Renderizar barras de vacaciones
  const renderVacationBar = (employee: Employee, timelineRange: any) => {
    const employeeRequests = (vacationRequests as VacationRequest[]).filter((req: VacationRequest) => 
      req.userId === employee.id && req.status === 'approved'
    );

    return employeeRequests.map((request: VacationRequest) => {
      const startDate = parseISO(request.startDate);
      const endDate = parseISO(request.endDate);
      
      const startPercent = dateToPixels(startDate, timelineRange);
      const endPercent = dateToPixels(endDate, timelineRange);
      const width = endPercent - startPercent;
      
      if (width <= 0) return null;
      
      return (
        <div
          key={request.id}
          className={`absolute top-1 bottom-1 rounded-sm cursor-move group transition-all duration-200 ${
            isDragging && dragData?.requestId === request.id 
              ? 'bg-blue-700 shadow-lg scale-105 z-10' 
              : 'bg-blue-500 hover:bg-blue-600'
          }`}
          style={{
            left: `${startPercent}%`,
            width: `${width}%`,
          }}
          onMouseDown={(e) => handleBarMouseDown(e, request, timelineRange)}
          title={`${request.user?.fullName || 'Usuario'}: ${format(startDate, 'dd/MM')} - ${format(endDate, 'dd/MM')} (${request.days} días)`}
        >
          <div className="text-white text-xs font-bold p-1 select-none">
            {request.days}d
          </div>
        </div>
      );
    }).filter(Boolean);
  };

  const timelineRange = getTimelineRange();

  return (
    <div className="px-6 py-4 min-h-screen bg-gray-50" style={{ overflowX: 'clip' }}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Gestión de Vacaciones</h1>
        <p className="text-gray-500 mt-1">Administra solicitudes de vacaciones y días festivos</p>
      </div>

      {/* Navegación por pestañas */}
      <TabNavigation
        tabs={[
          { id: "timeline", label: "Timeline de Vacaciones", icon: Calendar },
          { id: "requests", label: "Solicitudes", icon: Clock },
          { id: "holidays", label: "Días Festivos", icon: CalendarDays },
        ]}
        activeTab={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId as "timeline" | "requests" | "holidays")}
      />

      {/* Contenido según pestaña activa */}
      {activeTab === "timeline" && (
        <div className="bg-white rounded-lg shadow-sm border">
          {/* Controles del timeline */}
          <div className="p-4 border-b bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTimelineDate(subMonths(timelineDate, timelineViewMode === 'month' ? 1 : 3))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <h3 className="font-medium text-lg">
                    {timelineViewMode === 'month' 
                      ? format(timelineDate, "MMMM yyyy", { locale: es })
                      : format(timelineDate, "MMM", { locale: es }) + " - " + format(addMonths(timelineDate, 2), "MMM yyyy", { locale: es })
                    }
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTimelineDate(addMonths(timelineDate, timelineViewMode === 'month' ? 1 : 3))}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant={timelineViewMode === 'month' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTimelineViewMode('month')}
                >
                  Mes
                </Button>
                <Button
                  variant={timelineViewMode === 'quarter' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTimelineViewMode('quarter')}
                >
                  Trimestre
                </Button>
              </div>
            </div>
          </div>

          {/* Lista de empleados con timeline */}
          <div className="divide-y">
            {(employees as Employee[]).map((employee: Employee) => {
              const employeeRequests = (vacationRequests as VacationRequest[]).filter((req: VacationRequest) => 
                req.userId === employee.id && req.status === 'approved'
              );
              const usedDays = employeeRequests.reduce((sum: number, req: VacationRequest) => 
                sum + (req.startDate && req.endDate ? calculateDays(req.startDate, req.endDate) : 0), 0
              );
              const totalDays = parseInt(employee.totalVacationDays) || 22;
              const availableDays = Math.max(0, totalDays - usedDays);
              
              return (
                <div key={employee.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center">
                    {/* Información del empleado */}
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
                              <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                                <div 
                                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                                  style={{ width: `${Math.min((usedDays / totalDays) * 100, 100)}%` }}
                                />
                              </div>
                              <span className="text-green-600 font-medium">{availableDays}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Timeline horizontal */}
                    <div className="flex-1 relative">
                      <div className="relative h-12 bg-gray-100 rounded border" data-timeline-container>
                        {/* Grid de días */}
                        {timelineRange.days
                          .filter((_: Date, index: number) => index % (timelineViewMode === 'month' ? 3 : 7) === 0)
                          .map((day: Date, index: number) => (
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
                        <div className="absolute inset-0 overflow-hidden">
                          {renderVacationBar(employee, timelineRange)}
                        </div>
                      </div>
                      
                      {/* Labels de fechas */}
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

      {/* Placeholder para otras pestañas */}
      {activeTab === "requests" && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <p className="text-gray-500">Contenido de solicitudes de vacaciones</p>
        </div>
      )}

      {activeTab === "holidays" && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <p className="text-gray-500">Contenido de días festivos</p>
        </div>
      )}
    </div>
  );
}