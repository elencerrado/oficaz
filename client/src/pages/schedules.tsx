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

interface VacationRequest {
  id: number;
  userId: number;
  startDate: string;
  endDate: string;
  status: 'pending' | 'approved' | 'denied';
  userName?: string;
}

interface Holiday {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  type: 'national' | 'regional' | 'local';
  region?: string;
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
  const [selectedCell, setSelectedCell] = useState<{employeeId: number, date: Date, employeeName: string} | null>(null);
  
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

  // Función para verificar si un día es festivo
  const isHoliday = (date: Date): Holiday | null => {
    return holidays.find((holiday: Holiday) => {
      const holidayStart = new Date(holiday.startDate);
      const holidayEnd = new Date(holiday.endDate);
      holidayStart.setHours(0, 0, 0, 0);
      holidayEnd.setHours(23, 59, 59, 999);
      const checkDate = new Date(date);
      checkDate.setHours(12, 0, 0, 0);
      return checkDate >= holidayStart && checkDate <= holidayEnd;
    }) || null;
  };

  // Función para verificar si un empleado está de vacaciones en un día específico
  const isEmployeeOnVacation = (employeeId: number, date: Date): VacationRequest | null => {
    return vacationRequests.find((vacation: VacationRequest) => {
      if (vacation.userId !== employeeId) return false;
      const vacationStart = new Date(vacation.startDate);
      const vacationEnd = new Date(vacation.endDate);
      vacationStart.setHours(0, 0, 0, 0);
      vacationEnd.setHours(23, 59, 59, 999);
      const checkDate = new Date(date);
      checkDate.setHours(12, 0, 0, 0);
      return checkDate >= vacationStart && checkDate <= vacationEnd;
    }) || null;
  };

  // Función para obtener el estilo de la celda según el estado
  const getCellStyle = (employeeId: number, date: Date): string => {
    const holiday = isHoliday(date);
    const vacation = isEmployeeOnVacation(employeeId, date);
    
    let baseStyle = "relative h-12 rounded border";
    
    if (holiday) {
      // Día festivo - fondo rojo suave
      baseStyle += " bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800";
    } else if (vacation) {
      // Empleado de vacaciones - fondo azul suave
      baseStyle += " bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800";
    } else {
      // Día normal
      baseStyle += " bg-muted/20 dark:bg-muted/30 border-border";
    }
    
    return baseStyle;
  };

  // Función para obtener el contenido adicional de la celda
  const getCellContent = (employeeId: number, date: Date): JSX.Element | null => {
    const holiday = isHoliday(date);
    const vacation = isEmployeeOnVacation(employeeId, date);
    
    if (holiday) {
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-medium text-red-600 dark:text-red-400 text-center px-1" title={holiday.name}>
            🎉
          </span>
        </div>
      );
    }
    
    if (vacation) {
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-medium text-blue-600 dark:text-blue-400 text-center px-1" title="Vacaciones">
            🏖️
          </span>
        </div>
      );
    }
    
    return null;
  };

  // Queries
  const { data: employees = [], isLoading: loadingEmployees } = useQuery({
    queryKey: ['/api/employees'],
    select: (data) => data.filter((emp: Employee) => emp.status === 'active'),
  });

  const { data: workShifts = [], isLoading: loadingShifts, refetch: refetchShifts } = useQuery<WorkShift[]>({
    queryKey: ['/api/work-shifts/company', format(weekRange.start, 'yyyy-MM-dd'), format(weekRange.end, 'yyyy-MM-dd')],
    enabled: !!weekRange.start && !!weekRange.end,
  });

  // Query para obtener solicitudes de vacaciones aprobadas
  const { data: vacationRequests = [] } = useQuery<VacationRequest[]>({
    queryKey: ['/api/vacation-requests/company'],
    select: (data: VacationRequest[]) => data?.filter(req => req.status === 'approved') || [],
  });

  // Query para obtener días festivos
  const { data: holidays = [] } = useQuery<Holiday[]>({
    queryKey: ['/api/holidays/custom'],
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

            {/* Timeline Grid */}
            <div className="divide-y divide-border">
              {/* Header con mes y navegación */}
              <div className="bg-muted/10 p-4">
                <div className="flex items-center justify-between mb-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigateWeek('prev')}
                    className="h-8 w-8 p-0"
                    data-testid="button-prev-week"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  
                  <h2 className="text-lg font-semibold text-foreground">
                    {format(weekRange.start, "MMMM yyyy", { locale: es })}
                  </h2>
                  
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
                
                {/* Header de días súper compacto */}
                <div className="grid grid-cols-8 gap-1 py-1">
                  {/* Columna vacía para empleados */}
                  <div className="flex items-center justify-center">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Equipo
                    </div>
                  </div>
                  
                  {/* Días de la semana */}
                  {weekRange.days.map((day, index) => {
                    const isToday = format(new Date(), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    
                    return (
                      <div key={index} className="flex flex-col items-center justify-center h-10">
                        <div className={`text-xs font-medium uppercase tracking-wide leading-none ${
                          isToday 
                            ? 'text-blue-600 dark:text-blue-400' 
                            : isWeekend 
                              ? 'text-muted-foreground/70' 
                              : 'text-muted-foreground'
                        }`}>
                          {format(day, 'EEE', { locale: es })}
                        </div>
                        
                        <div className={`text-sm font-semibold rounded w-5 h-5 flex items-center justify-center leading-none mt-0.5 ${
                          isToday 
                            ? 'bg-blue-500 text-white shadow' 
                            : isWeekend 
                              ? 'text-muted-foreground/70' 
                              : 'text-foreground hover:bg-muted/50'
                        }`}>
                          {format(day, 'dd')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Filas de empleados */}
              {employees.map((employee: Employee) => {
                return (
                  <div key={employee.id} className="p-4">
                    <div className="grid grid-cols-8 gap-1 items-center min-h-[60px]">
                      {/* Columna del empleado */}
                      <div className="flex flex-col items-center justify-center gap-1">
                        <UserAvatar 
                          fullName={employee.fullName} 
                          size="sm" 
                          userId={employee.id}
                          profilePicture={employee.profilePicture}
                        />
                        <div className="text-xs font-medium text-foreground text-center truncate max-w-full">
                          {employee.fullName}
                        </div>
                      </div>

                      {/* Columnas de días */}
                      {weekRange.days.map((day, dayIndex) => {
                        const holiday = isHoliday(day);
                        const vacation = isEmployeeOnVacation(employee.id, day);
                        const isDisabled = holiday || vacation;
                        
                        return (
                          <div 
                            key={dayIndex} 
                            className={`${getCellStyle(employee.id, day)} ${!isDisabled ? 'cursor-pointer hover:bg-muted/40 dark:hover:bg-muted/50 transition-colors' : 'cursor-not-allowed'}`}
                            onClick={() => {
                              if (!isDisabled) {
                                setSelectedCell({
                                  employeeId: employee.id,
                                  date: day,
                                  employeeName: employee.fullName
                                });
                                setShowNewShiftModal(true);
                              }
                            }}
                            title={isDisabled ? (holiday ? `Día festivo: ${holiday.name}` : 'Empleado de vacaciones') : 'Click para añadir turno'}
                          >
                            {/* Contenido especial para festivos/vacaciones */}
                            {getCellContent(employee.id, day)}
                            {/* Timeline bars serán renderizadas aquí */}
                            {renderShiftBar(employee)}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      {/* Modal para nuevo turno */}
      <Dialog open={showNewShiftModal} onOpenChange={setShowNewShiftModal}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">
              Nuevo Turno - {selectedCell?.employeeName}
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {selectedCell && format(selectedCell.date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
            </p>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Hora de inicio</label>
                <input
                  type="time"
                  value={newShift.startTime}
                  onChange={(e) => setNewShift(prev => ({ ...prev, startTime: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Hora de fin</label>
                <input
                  type="time"
                  value={newShift.endTime}
                  onChange={(e) => setNewShift(prev => ({ ...prev, endTime: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Título del turno</label>
              <input
                type="text"
                value={newShift.title}
                onChange={(e) => setNewShift(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ej: Turno de mañana, Guardia, etc."
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Ubicación (opcional)</label>
              <input
                type="text"
                value={newShift.location}
                onChange={(e) => setNewShift(prev => ({ ...prev, location: e.target.value }))}
                placeholder="Ej: Oficina central, Sucursal norte, etc."
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Notas (opcional)</label>
              <textarea
                value={newShift.notes}
                onChange={(e) => setNewShift(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Instrucciones especiales, tareas específicas, etc."
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Color del turno</label>
              <div className="flex gap-2 flex-wrap">
                {SHIFT_COLORS.map((color, index) => (
                  <button
                    key={color}
                    onClick={() => setNewShift(prev => ({ ...prev, color }))}
                    className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                      newShift.color === color 
                        ? 'border-gray-800 dark:border-gray-200 scale-110' 
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                    style={{ backgroundColor: color }}
                    title={`Color ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowNewShiftModal(false);
                setSelectedCell(null);
                // Reset form
                setNewShift({
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
              }}
            >
              Cancelar
            </Button>
            <Button 
              onClick={() => {
                // TODO: Implementar creación de turno
                console.log('Crear turno:', { ...newShift, employeeId: selectedCell?.employeeId, date: selectedCell?.date });
                toast({ title: "Funcionalidad en desarrollo", description: "Próximamente podrás crear turnos" });
                setShowNewShiftModal(false);
                setSelectedCell(null);
              }}
              disabled={!newShift.title || !newShift.startTime || !newShift.endTime}
            >
              Crear Turno
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}