import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarClock, Users, Plus, ChevronLeft, ChevronRight, Clock, Edit, Copy, Trash2 } from "lucide-react";
import { format, differenceInDays, addDays, startOfWeek, endOfWeek, eachDayOfInterval, parseISO, addWeeks, subWeeks } from "date-fns";
import { es } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAuth } from "@/hooks/use-auth";
import { usePageHeader } from '@/components/layout/page-header';
import { UserAvatar } from "@/components/ui/user-avatar";

interface WorkShift {
  id: number;
  employeeId: number;
  startAt: string;
  endAt: string;
  title: string;
  location?: string;
  notes?: string;
  color: string;
  employeeName?: string;
}

interface Employee {
  id: number;
  fullName: string;
  status: string;
  profilePicture?: string;
}

const SHIFT_COLORS = [
  '#3B82F6', // blue-500
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#EF4444', // red-500
  '#8B5CF6', // violet-500
  '#06B6D4', // cyan-500
  '#84CC16', // lime-500
  '#F97316', // orange-500
];

export default function Schedules() {
  const { company, user } = useAuth();
  const { setHeader, resetHeader } = usePageHeader();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Set page header
  useEffect(() => {
    setHeader({
      title: 'Cuadrante de Horarios',
      subtitle: 'Gestión de turnos y horarios de empleados'
    });
    return resetHeader;
  }, []);

  // Estados principales
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedShift, setSelectedShift] = useState<WorkShift | null>(null);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showNewShiftModal, setShowNewShiftModal] = useState(false);
  
  // Estados para nueva creación/edición de turnos
  const [newShift, setNewShift] = useState({
    employeeId: '',
    startDate: '',
    endDate: '',
    startTime: '09:00',
    endTime: '17:00',
    title: '',
    location: '',
    notes: '',
    color: SHIFT_COLORS[0]
  });

  // Calcular rango de la semana actual
  const getWeekRange = () => {
    const start = startOfWeek(viewDate, { weekStartsOn: 1 }); // Monday start
    const end = endOfWeek(viewDate, { weekStartsOn: 1 });
    return { start, end, days: eachDayOfInterval({ start, end }) };
  };

  const weekRange = getWeekRange();

  // Navegación de semanas
  const navigateWeek = (direction: 'prev' | 'next') => {
    setViewDate(prev => direction === 'prev' ? subWeeks(prev, 1) : addWeeks(prev, 1));
  };

  // Queries
  const { data: employees = [], isLoading: loadingEmployees } = useQuery({
    queryKey: ['/api/employees'],
    select: (data) => data.filter((emp: Employee) => emp.status === 'active'),
  });

  const { data: workShifts = [], isLoading: loadingShifts, refetch: refetchShifts } = useQuery({
    queryKey: ['/api/work-shifts/company', format(weekRange.start, 'yyyy-MM-dd'), format(weekRange.end, 'yyyy-MM-dd')],
    enabled: !!weekRange.start && !!weekRange.end,
  });

  // Obtener turnos para un empleado específico
  const getShiftsForEmployee = (employeeId: number) => {
    return workShifts.filter((shift: WorkShift) => shift.employeeId === employeeId);
  };

  // Renderizar barras de turnos en el timeline
  const renderShiftBar = (employee: Employee) => {
    const shifts = getShiftsForEmployee(employee.id);
    
    return shifts.map((shift: WorkShift, index: number) => {
      const shiftStart = parseISO(shift.startAt);
      const shiftEnd = parseISO(shift.endAt);
      
      // Verificar si el turno está en el rango visible
      if (shiftEnd < weekRange.start || shiftStart > weekRange.end) {
        return null;
      }
      
      // Calcular posición y duración
      const visibleStart = shiftStart < weekRange.start ? weekRange.start : shiftStart;
      const visibleEnd = shiftEnd > weekRange.end ? weekRange.end : shiftEnd;
      
      const totalDays = differenceInDays(weekRange.end, weekRange.start) + 1;
      const startOffset = differenceInDays(visibleStart, weekRange.start);
      const duration = differenceInDays(visibleEnd, visibleStart) + 1;
      
      const leftPercent = (startOffset / totalDays) * 100;
      const widthPercent = (duration / totalDays) * 100;
      
      const shiftHours = `${format(shiftStart, 'HH:mm')} - ${format(shiftEnd, 'HH:mm')}`;
      
      return (
        <div
          key={`${shift.id}-${index}`}
          className="absolute rounded-md cursor-pointer transition-all hover:opacity-90 dark:hover:opacity-80 flex items-center justify-center text-white dark:text-gray-100 text-xs font-medium shadow-sm dark:shadow-md dark:ring-1 dark:ring-white/20"
          style={{
            left: `${leftPercent}%`,
            width: `${widthPercent}%`,
            top: '2px',
            bottom: '2px',
            backgroundColor: shift.color,
            zIndex: 10
          }}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedShift(shift);
            setShowShiftModal(true);
          }}
          title={`${shift.title}\n${shiftHours}${shift.location ? `\n📍 ${shift.location}` : ''}${shift.notes ? `\n📝 ${shift.notes}` : ''}`}
        >
          <span className="truncate px-1">
            {shift.title || shiftHours}
          </span>
        </div>
      );
    }).filter(Boolean);
  };

  return (
    <div className="px-6 py-4 min-h-screen bg-gray-50 dark:bg-gray-900 space-y-6" style={{ overflowX: 'clip' }}>
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
            {/* Header con controles */}
            <div className="p-4 border-b bg-muted/20">
              <div className="flex items-center justify-between">
                {/* Navegación de semana */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigateWeek('prev')}
                      className="h-8 w-8 p-0"
                      data-testid="button-prev-week"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    
                    <div className="text-center min-w-[160px]">
                      <span className="text-sm font-medium text-foreground">
                        {format(weekRange.start, "dd MMM", { locale: es })} - {format(weekRange.end, "dd MMM yyyy", { locale: es })}
                      </span>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigateWeek('next')}
                      className="h-8 w-8 p-0"
                      data-testid="button-next-week"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Botones de acción */}
                <div className="flex items-center gap-2">
                  <Button 
                    onClick={() => setShowNewShiftModal(true)}
                    size="sm"
                    data-testid="button-new-shift"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Nuevo Turno
                  </Button>
                </div>
              </div>
            </div>

            {/* Timeline Grid */}
            <div className="divide-y divide-border">
              {/* Header de días */}
              <div className="bg-muted/10 p-4">
                <div className="grid grid-cols-8 gap-1">
                  <div className="text-sm font-medium text-muted-foreground">Empleado</div>
                  {weekRange.days.map((day, index) => (
                    <div key={index} className="text-center">
                      <div className="text-xs text-muted-foreground">
                        {format(day, 'EEE', { locale: es })}
                      </div>
                      <div className="text-sm font-medium text-foreground">
                        {format(day, 'dd')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Filas de empleados */}
              {employees.map((employee: Employee) => {
                const shiftsCount = getShiftsForEmployee(employee.id).length;
                
                return (
                  <div key={employee.id} className="p-4">
                    <div className="grid grid-cols-8 gap-1 items-center min-h-[60px]">
                      {/* Columna del empleado */}
                      <div className="flex items-center gap-2">
                        <UserAvatar 
                          fullName={employee.fullName} 
                          size="sm" 
                          userId={employee.id}
                          profilePicture={employee.profilePicture}
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">
                            {employee.fullName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {shiftsCount} turno{shiftsCount !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>

                      {/* Columnas de días */}
                      {weekRange.days.map((day, dayIndex) => (
                        <div key={dayIndex} className="relative h-12 bg-muted/20 dark:bg-muted/30 rounded border border-border">
                          {/* Timeline bars serán renderizadas aquí */}
                          {renderShiftBar(employee)}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      {/* Modal para nuevo turno - TO DO */}
      {/* Modal para ver/editar turno - TO DO */}
    </div>
  );
}