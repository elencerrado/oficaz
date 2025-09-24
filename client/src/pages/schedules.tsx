import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarClock, Users, Plus, ChevronLeft, ChevronRight, Clock, Edit, Copy, Trash2 } from "lucide-react";
import { format, differenceInDays, addDays, subDays, startOfWeek, endOfWeek, eachDayOfInterval, parseISO, addWeeks, subWeeks, getDay } from "date-fns";
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

  // Mutation para actualizar/expandir turno a múltiples días
  const updateShiftMutation = useMutation({
    mutationFn: async (shiftData: {
      id: number;
      startTime: string;
      endTime: string;
      title: string;
      location?: string;
      notes?: string;
      color: string;
    }) => {
      if (!selectedShift) throw new Error('No hay turno seleccionado');
      
      const originalShiftDate = new Date(selectedShift.startAt);
      const originalDayNumber = getWeekdayNumber(originalShiftDate);
      const selectedDaysArray = Array.from(selectedDays);
      
      if (selectedDaysArray.length === 0) {
        throw new Error('Debe seleccionar al menos un día');
      }
      
      const promises: Promise<any>[] = [];
      const operations: Array<{type: 'update' | 'create', day: number, date: Date}> = [];
      
      // Para cada día seleccionado, determinar si actualizar o crear
      for (const dayNumber of selectedDaysArray) {
        const targetDate = getDateForWeekday(originalShiftDate, dayNumber);
        
        if (dayNumber === originalDayNumber) {
          // Actualizar el turno existente
          operations.push({type: 'update', day: dayNumber, date: targetDate});
          
          // Verificar conflictos excluyendo el turno actual
          if (hasTimeConflict(selectedShift.employeeId, targetDate, shiftData.startTime, shiftData.endTime, selectedShift.id)) {
            throw new Error(`Conflicto de horario en ${format(targetDate, 'EEEE dd/MM', { locale: es })}`);
          }
          
          const startAt = new Date(targetDate);
          const endAt = new Date(targetDate);
          
          const [startHour, startMinute] = shiftData.startTime.split(':').map(Number);
          const [endHour, endMinute] = shiftData.endTime.split(':').map(Number);
          
          startAt.setHours(startHour, startMinute, 0, 0);
          endAt.setHours(endHour, endMinute, 0, 0);
          
          // Si el turno termina al día siguiente
          if (endAt <= startAt) {
            endAt.setDate(endAt.getDate() + 1);
          }
          
          const updatePayload = {
            startAt: startAt.toISOString(),
            endAt: endAt.toISOString(),
            title: shiftData.title,
            location: shiftData.location || null,
            notes: shiftData.notes || null,
            color: shiftData.color
          };
          
          promises.push(
            apiRequest('PATCH', `/api/work-shifts/${shiftData.id}`, updatePayload)
              .then(response => ({ success: true, type: 'update', date: targetDate, response }))
              .catch(error => ({ 
                success: false, 
                type: 'update', 
                date: targetDate, 
                error: error?.response?.data?.error || error.message || 'Error desconocido' 
              }))
          );
        } else {
          // Crear nuevo turno en día diferente
          operations.push({type: 'create', day: dayNumber, date: targetDate});
          
          // Verificar conflictos
          if (hasTimeConflict(selectedShift.employeeId, targetDate, shiftData.startTime, shiftData.endTime)) {
            throw new Error(`Conflicto de horario en ${format(targetDate, 'EEEE dd/MM', { locale: es })}`);
          }
          
          const startAt = new Date(targetDate);
          const endAt = new Date(targetDate);
          
          const [startHour, startMinute] = shiftData.startTime.split(':').map(Number);
          const [endHour, endMinute] = shiftData.endTime.split(':').map(Number);
          
          startAt.setHours(startHour, startMinute, 0, 0);
          endAt.setHours(endHour, endMinute, 0, 0);
          
          // Si el turno termina al día siguiente
          if (endAt <= startAt) {
            endAt.setDate(endAt.getDate() + 1);
          }
          
          const createPayload = {
            employeeId: selectedShift.employeeId,
            startAt: startAt.toISOString(),
            endAt: endAt.toISOString(),
            title: shiftData.title,
            location: shiftData.location || null,
            notes: shiftData.notes || null,
            color: shiftData.color
          };
          
          promises.push(
            apiRequest('POST', '/api/work-shifts', createPayload)
              .then(response => ({ success: true, type: 'create', date: targetDate, response }))
              .catch(error => ({ 
                success: false, 
                type: 'create', 
                date: targetDate, 
                error: error?.response?.data?.error || error.message || 'Error desconocido' 
              }))
          );
        }
      }
      
      // Ejecutar todas las operaciones
      const results = await Promise.allSettled(promises);
      return results.map(result => result.status === 'fulfilled' ? result.value : { success: false, error: 'Error interno' });
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['/api/work-shifts/company'] });
      refetchShifts();
      
      const successes = results.filter(r => r.success).length;
      const failures = results.filter(r => !r.success);
      
      if (failures.length === 0) {
        // Todos exitosos
        toast({
          title: "✅ Turnos actualizados",
          description: `Se ${successes === 1 ? 'ha actualizado 1 turno' : `han procesado ${successes} turnos`} correctamente`
        });
      } else if (successes === 0) {
        // Todos fallaron
        const errorMsg = failures[0]?.error || 'Error desconocido';
        toast({
          title: "❌ Error al actualizar turnos",
          description: errorMsg,
          variant: "destructive"
        });
      } else {
        // Parcialmente exitoso
        toast({
          title: "⚠️ Actualización parcial",
          description: `${successes} turnos procesados, ${failures.length} fallaron`,
          variant: "destructive"
        });
      }
      
      // Reset si al menos uno fue exitoso
      if (successes > 0) {
        setShowShiftModal(false);
        setSelectedShift(null);
        setSelectedDays(new Set());
      }
    },
    onError: (error: any) => {
      console.error('Error updating shifts:', error);
      const message = error?.message || 'Error desconocido';
      toast({
        title: "❌ Error al actualizar turnos",
        description: message,
        variant: "destructive"
      });
    },
  });
  
  // Mutation para eliminar turno
  const deleteShiftMutation = useMutation({
    mutationFn: async (shiftId: number) => {
      return apiRequest('DELETE', `/api/work-shifts/${shiftId}`);
    },
    onSuccess: () => {
      toast({ 
        title: "Turno eliminado exitosamente", 
        description: "El turno ha sido eliminado del calendario" 
      });
      queryClient.invalidateQueries({ queryKey: ['/api/work-shifts/company'] });
      refetchShifts();
      setShowShiftModal(false);
      setSelectedShift(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Error al eliminar el turno", 
        description: error.message || "Ha ocurrido un error inesperado",
        variant: "destructive" 
      });
    },
  });

  // Helper para calcular fecha de un día específico en la semana actual
  const getDateForWeekday = (baseDate: Date, targetWeekday: number): Date => {
    const currentWeekday = getWeekdayNumber(baseDate);
    const daysToAdd = targetWeekday - currentWeekday;
    return addDays(baseDate, daysToAdd);
  };

  // Mutation para crear turno(s) en múltiples días
  const createShiftMutation = useMutation({
    mutationFn: async (shiftData: {
      employeeId: number;
      date: Date;
      startTime: string;
      endTime: string;
      title: string;
      location?: string;
      notes?: string;
      color: string;
    }) => {
      if (!selectedCell) throw new Error('No hay celda seleccionada');
      
      const selectedDaysArray = Array.from(selectedDays);
      if (selectedDaysArray.length === 0) {
        throw new Error('Debe seleccionar al menos un día');
      }
      
      // Crear array de promesas para múltiples POSTs
      const shiftPromises = selectedDaysArray.map(async (dayNumber) => {
        const targetDate = getDateForWeekday(selectedCell.date, dayNumber);
        
        // Verificar conflictos antes de crear
        if (hasTimeConflict(selectedCell.employeeId, targetDate, shiftData.startTime, shiftData.endTime)) {
          throw new Error(`Conflicto de horario en ${format(targetDate, 'EEEE dd/MM', { locale: es })}`);
        }
        
        // Combinar fecha con horas para crear timestamps
        const startAt = new Date(targetDate);
        const endAt = new Date(targetDate);
        
        const [startHour, startMinute] = shiftData.startTime.split(':').map(Number);
        const [endHour, endMinute] = shiftData.endTime.split(':').map(Number);
        
        startAt.setHours(startHour, startMinute, 0, 0);
        endAt.setHours(endHour, endMinute, 0, 0);
        
        // Si el turno termina al día siguiente (ej: 22:00 - 06:00)
        if (endAt <= startAt) {
          endAt.setDate(endAt.getDate() + 1);
        }
        
        const payload = {
          employeeId: selectedCell.employeeId,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          title: shiftData.title,
          location: shiftData.location || null,
          notes: shiftData.notes || null,
          color: shiftData.color
        };
        
        try {
          const response = await apiRequest('POST', '/api/work-shifts', payload);
          return { success: true, date: targetDate, response };
        } catch (error: any) {
          return { 
            success: false, 
            date: targetDate, 
            error: error?.response?.data?.error || error.message || 'Error desconocido'
          };
        }
      });
      
      // Ejecutar todas las promesas y recopilar resultados
      const results = await Promise.allSettled(shiftPromises);
      return results.map(result => result.status === 'fulfilled' ? result.value : { success: false, error: 'Error interno' });
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['/api/work-shifts/company'] });
      refetchShifts();
      
      const successes = results.filter(r => r.success).length;
      const failures = results.filter(r => !r.success);
      
      if (failures.length === 0) {
        // Todos exitosos
        toast({
          title: "✅ Turnos creados",
          description: `Se ${successes === 1 ? 'ha creado 1 turno' : `han creado ${successes} turnos`} correctamente`
        });
      } else if (successes === 0) {
        // Todos fallaron
        const errorMsg = failures[0]?.error || 'Error desconocido';
        toast({
          title: "❌ Error al crear turnos",
          description: errorMsg,
          variant: "destructive"
        });
      } else {
        // Parcialmente exitoso
        toast({
          title: "⚠️ Creación parcial",
          description: `${successes} turnos creados, ${failures.length} fallaron`,
          variant: "destructive"
        });
      }
      
      // Reset form si al menos uno fue exitoso
      if (successes > 0) {
        setShowNewShiftModal(false);
        setSelectedCell(null);
        setSelectedDays(new Set());
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
      }
    },
    onError: (error: any) => {
      console.error('Error creating shifts:', error);
      const message = error?.message || 'Error desconocido';
      toast({
        title: "❌ Error al crear turnos",
        description: message,
        variant: "destructive"
      });
    },
  });

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
  const [viewMode, setViewMode] = useState<'day' | 'week'>('week');
  
  // Forzar vista día en móvil
  useEffect(() => {
    const checkMobile = () => {
      if (window.innerWidth < 640) { // Forzar día solo en pantallas muy pequeñas (móvil)
        setViewMode('day');
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Estado para el formulario de edición
  const [editShift, setEditShift] = useState({
    startTime: '09:00',
    endTime: '17:00',
    title: '',
    location: '',
    notes: '',
    color: SHIFT_COLORS[0]
  });
  
  // Estado para días seleccionados (1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb, 7=Dom)
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set());
  
  // Nombres de días para UI
  const dayNames = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  
  // Helper para convertir Date a día de semana (1=Lun, 7=Dom)
  const getWeekdayNumber = (date: Date): number => {
    const day = getDay(date); // 0=Dom, 1=Lun, 2=Mar, etc.
    return day === 0 ? 7 : day; // Convertir Dom(0) a 7, mantener otros
  };
  
  // Helper para verificar conflictos de horario
  const hasTimeConflict = (employeeId: number, targetDate: Date, startTime: string, endTime: string, excludeShiftId?: number): boolean => {
    const targetDateStr = format(targetDate, 'yyyy-MM-dd');
    const employeeShifts = workShifts.filter(shift => 
      shift.employeeId === employeeId && 
      format(new Date(shift.startAt), 'yyyy-MM-dd') === targetDateStr &&
      shift.id !== excludeShiftId
    );
    
    // Convertir tiempos a minutos para comparación fácil
    const [newStartHour, newStartMin] = startTime.split(':').map(Number);
    const [newEndHour, newEndMin] = endTime.split(':').map(Number);
    const newStart = newStartHour * 60 + newStartMin;
    let newEnd = newEndHour * 60 + newEndMin;
    
    // Si el turno termina al día siguiente
    if (newEnd <= newStart) {
      newEnd += 24 * 60;
    }
    
    return employeeShifts.some(shift => {
      const shiftStart = new Date(shift.startAt);
      const shiftEnd = new Date(shift.endAt);
      
      const existingStart = shiftStart.getHours() * 60 + shiftStart.getMinutes();
      let existingEnd = shiftEnd.getHours() * 60 + shiftEnd.getMinutes();
      
      // Si el turno existente termina al día siguiente
      if (format(shiftStart, 'yyyy-MM-dd') !== format(shiftEnd, 'yyyy-MM-dd')) {
        existingEnd += 24 * 60;
      }
      
      // Verificar solapamiento: (start1 < end2) && (start2 < end1)
      return (newStart < existingEnd) && (existingStart < newEnd);
    });
  };
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

  // Calcular rango según el modo de vista
  const getWeekRange = () => {
    if (viewMode === 'day') {
      // Solo mostrar el día actual
      return {
        start: viewDate,
        end: viewDate,
        days: [viewDate]
      };
    } else {
      // Mostrar toda la semana
      const start = startOfWeek(viewDate, { weekStartsOn: 1 }); // Monday start
      const end = endOfWeek(viewDate, { weekStartsOn: 1 });
      return { start, end, days: eachDayOfInterval({ start, end }) };
    }
  };

  const weekRange = getWeekRange();
  

  // Navegación según modo
  const navigateWeek = (direction: 'prev' | 'next') => {
    if (viewMode === 'day') {
      setViewDate(prev => direction === 'prev' ? subDays(prev, 1) : addDays(prev, 1));
    } else {
      setViewDate(prev => direction === 'prev' ? subWeeks(prev, 1) : addWeeks(prev, 1));
    }
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
    
    let baseStyle = "relative rounded border overflow-hidden min-h-[80px]"; // Altura fija más alta
    
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
  
  // Función para obtener la altura de la celda (fija en día, dinámica en semana)
  const getCellHeightStyle = (employeeId: number, date: Date) => {
    if (viewMode === 'day') {
      return { minHeight: '120px' }; // Altura fija para modo día
    }
    
    // Modo semana: altura dinámica basada en el número de turnos
    const shifts = getShiftsForEmployee(employeeId);
    const dayString = format(date, 'yyyy-MM-dd');
    const dayShifts = shifts.filter((shift: WorkShift) => {
      const shiftStart = parseISO(shift.startAt);
      const shiftStartDay = format(shiftStart, 'yyyy-MM-dd');
      return shiftStartDay === dayString;
    });
    
    // Altura mínima de 120px, más 30px por cada turno adicional
    const baseHeight = 120;
    const heightPerShift = dayShifts.length > 0 ? 30 : 0;
    const totalHeight = Math.max(baseHeight, baseHeight + (dayShifts.length - 1) * heightPerShift);
    
    return { minHeight: `${totalHeight}px` };
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
  
  // Función helper para obtener empleado por ID
  const getEmployeeById = (employeeId: number) => {
    return employees.find(emp => emp.id === employeeId);
  };
  
  // Efecto para pre-rellenar el formulario de edición
  useEffect(() => {
    if (selectedShift) {
      const shiftDate = new Date(selectedShift.startAt);
      const startTime = format(shiftDate, 'HH:mm');
      const endTime = format(new Date(selectedShift.endAt), 'HH:mm');
      const dayNumber = getWeekdayNumber(shiftDate);
      
      setEditShift({
        startTime,
        endTime,
        title: selectedShift.title || '',
        location: selectedShift.location || '',
        notes: selectedShift.notes || '',
        color: selectedShift.color || SHIFT_COLORS[0]
      });
      
      // Inicializar días seleccionados con el día del turno actual
      setSelectedDays(new Set([dayNumber]));
    }
  }, [selectedShift]);
  
  // Efecto para inicializar días seleccionados al crear nuevo turno
  useEffect(() => {
    if (selectedCell && showNewShiftModal) {
      const dayNumber = getWeekdayNumber(selectedCell.date);
      setSelectedDays(new Set([dayNumber]));
    }
  }, [selectedCell, showNewShiftModal]);

  // Queries
  const { data: employees = [], isLoading: loadingEmployees } = useQuery<Employee[]>({
    queryKey: ['/api/employees'],
    select: (data: Employee[]) => data?.filter((emp: Employee) => emp.status === 'active') || [],
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

  // ⚠️ PROTECTED - Lane assignment algorithm for shift collision detection - DO NOT MODIFY ⚠️
  const assignShiftLanes = (dayShifts: WorkShift[]): { shift: WorkShift; lane: number; totalLanes: number }[] => {
    if (dayShifts.length === 0) return [];
    
    // Sort shifts by start time
    const sortedShifts = [...dayShifts].sort((a, b) => {
      const timeA = parseISO(a.startAt).getTime();
      const timeB = parseISO(b.startAt).getTime();
      return timeA - timeB;
    });
    
    // OPCIÓN: Cada turno en su propio carril (siempre separados)
    const result = sortedShifts.map((shift, index) => ({
      shift,
      lane: index, // Cada turno va a su propio carril
      totalLanes: sortedShifts.length
    }));
    
    console.log(`Lane assignment: ${sortedShifts.length} shifts assigned to ${sortedShifts.length} separate lanes`);
    sortedShifts.forEach((shift, index) => {
      console.log(`Shift "${shift.title}" (${format(parseISO(shift.startAt), 'HH:mm')}-${format(parseISO(shift.endAt), 'HH:mm')}) assigned to lane ${index}`);
    });
    
    return result;
  };

  // Renderizar barras de turnos para un día específico con tamaño proporcional por horas
  const renderShiftBar = (employee: Employee, day: Date) => {
    const shifts = getShiftsForEmployee(employee.id);
    const dayString = format(day, 'yyyy-MM-dd');
    
    // Filtrar turnos que caen en este día específico
    const dayShifts = shifts.filter((shift: WorkShift) => {
      const shiftStart = parseISO(shift.startAt);
      const shiftStartDay = format(shiftStart, 'yyyy-MM-dd');
      return shiftStartDay === dayString;
    });
    
    if (dayShifts.length === 0) return null;

    // Configuración del timeline: 6:00 AM a 10:00 PM (16 horas de trabajo)
    const TIMELINE_START_HOUR = 6; // 6:00 AM
    const TIMELINE_END_HOUR = 22; // 10:00 PM
    const TIMELINE_TOTAL_HOURS = TIMELINE_END_HOUR - TIMELINE_START_HOUR; // 16 horas
    
    // MODO DÍA: Sistema horizontal cronológico con carriles verticales para evitar solapamiento
    if (viewMode === 'day') {
      // Función para detectar si dos turnos se solapan horizontalmente
      const doShiftsOverlap = (shift1: WorkShift, shift2: WorkShift): boolean => {
        const start1 = parseISO(shift1.startAt).getTime();
        const end1 = parseISO(shift1.endAt).getTime();
        const start2 = parseISO(shift2.startAt).getTime();
        const end2 = parseISO(shift2.endAt).getTime();
        
        // Verificar solapamiento real: (start1 < end2) && (start2 < end1)
        // Los turnos consecutivos (end1 === start2) NO se consideran solapamiento
        return (start1 < end2) && (start2 < end1);
      };
      
      // Asignar carriles para evitar solapamiento usando algoritmo optimizado
      const shiftsWithLanes: { shift: WorkShift; lane: number }[] = [];
      
      dayShifts.forEach((shift, index) => {
        // Encontrar el carril más bajo disponible para este turno
        let lane = 0;
        
        // Buscar entre turnos ya procesados cuáles se solapan con el actual
        const conflictingLanes = new Set<number>();
        
        shiftsWithLanes.forEach(processedShift => {
          if (doShiftsOverlap(shift, processedShift.shift)) {
            conflictingLanes.add(processedShift.lane);
          }
        });
        
        // Encontrar el primer carril disponible (no ocupado por turnos solapados)
        while (conflictingLanes.has(lane)) {
          lane++;
        }
        
        shiftsWithLanes.push({ shift, lane });
      });
      
      const maxLanes = Math.max(...shiftsWithLanes.map(s => s.lane), 0) + 1;
      const laneHeight = 100 / maxLanes;
      
      // ⚠️ NUEVA LÓGICA: Distribución robusta para evitar solapamiento con múltiples badges
      // Calcular posiciones iniciales y agrupar por carril
      const shiftsByLane = shiftsWithLanes.reduce((acc, item) => {
        if (!acc[item.lane]) acc[item.lane] = [];
        
        const shiftStart = parseISO(item.shift.startAt);
        const shiftEnd = parseISO(item.shift.endAt);
        const startTime = format(shiftStart, 'HH:mm');
        const endTime = format(shiftEnd, 'HH:mm');
        const shiftHours = `${startTime}-${endTime}`;
        
        // Calcular posición cronológica real
        const startHour = shiftStart.getHours() + shiftStart.getMinutes() / 60;
        const endHour = shiftEnd.getHours() + shiftEnd.getMinutes() / 60;
        const clampedStart = Math.max(startHour, TIMELINE_START_HOUR);
        const clampedEnd = Math.min(endHour, TIMELINE_END_HOUR);
        
        // Calcular duración relativa para proporcionalidad visual
        const duration = clampedEnd - clampedStart;
        const chronoLeftPercent = ((clampedStart - TIMELINE_START_HOUR) / TIMELINE_TOTAL_HOURS) * 100;
        
        acc[item.lane].push({
          shift: item.shift,
          lane: item.lane,
          shiftHours,
          clampedStart,
          clampedEnd,
          duration,
          chronoLeftPercent, // Posición cronológica real
          leftPercent: 0, // Se calculará después
          widthPercent: 0 // Se calculará después
        });
        
        return acc;
      }, {} as Record<number, Array<{
        shift: WorkShift;
        lane: number;
        shiftHours: string;
        clampedStart: number;
        clampedEnd: number;
        duration: number;
        chronoLeftPercent: number;
        leftPercent: number;
        widthPercent: number;
      }>>);
      
      // Para cada carril, distribuir el espacio de manera robusta
      const shiftsWithPositions = Object.values(shiftsByLane).flat();
      
      Object.values(shiftsByLane).forEach(laneShifts => {
        if (laneShifts.length === 0) return;
        
        // Ordenar por posición cronológica
        laneShifts.sort((a, b) => a.clampedStart - b.clampedStart);
        
        const shiftsCount = laneShifts.length;
        
        if (shiftsCount === 1) {
          // Un solo turno: usar posición y tamaño cronológico
          const shift = laneShifts[0];
          shift.leftPercent = shift.chronoLeftPercent;
          shift.widthPercent = (shift.duration / TIMELINE_TOTAL_HOURS) * 100;
        } else {
          // ⚠️ LÓGICA ROBUSTA: Distribución que NUNCA excede el 100% del contenedor
          // Calcular gap mínimo escalado por cantidad de badges
          const minGapPercent = Math.max(0.5, Math.min(2, 100 / (shiftsCount * 20))); // Gap adaptativo: 0.5% a 2%
          const totalGapPercent = minGapPercent * (shiftsCount - 1); // Espacio total para separaciones
          
          // ✅ GARANTIZADO: espacio disponible nunca negativo
          let availableWidthPercent = Math.max(10, 100 - totalGapPercent);
          
          // Si los gaps son demasiado grandes, reducirlos para asegurar espacio para badges
          if (totalGapPercent > 85) {
            const adjustedGapPercent = 15 / (shiftsCount - 1); // Máximo 15% total para gaps
            availableWidthPercent = 85; // 85% para badges, 15% para gaps
          }
          
          // Calcular duración total para proporcionalidad
          const totalDuration = laneShifts.reduce((sum, shift) => sum + shift.duration, 0);
          
          // Primera pasada: calcular anchos ideales usando Map temporal
          const idealWidths = new Map<number, number>();
          let totalIdealWidth = 0;
          
          laneShifts.forEach((shift, index) => {
            // Ancho proporcional a la duración
            const proportionalWidth = totalDuration > 0 
              ? (shift.duration / totalDuration) * availableWidthPercent
              : availableWidthPercent / shiftsCount;
            
            // Ancho mínimo garantizado: al menos 6% pero no más del espacio disponible dividido equitativamente
            const minWidth = Math.max(6, availableWidthPercent / shiftsCount * 0.7); // 70% del espacio equitativo como mínimo
            const idealWidth = Math.max(minWidth, proportionalWidth);
            
            idealWidths.set(index, idealWidth);
            totalIdealWidth += idealWidth;
          });
          
          // Segunda pasada: ajustar si excede el espacio disponible
          const scaleFactor = totalIdealWidth > availableWidthPercent 
            ? availableWidthPercent / totalIdealWidth 
            : 1;
          
          // Tercera pasada: posicionar badges con escala aplicada
          let currentLeftPercent = 0;
          const actualGapPercent = totalGapPercent > 0 
            ? Math.min(minGapPercent, (100 - totalIdealWidth * scaleFactor) / (shiftsCount - 1))
            : 0;
          
          laneShifts.forEach((shift, index) => {
            const idealWidth = idealWidths.get(index) || 0;
            shift.widthPercent = idealWidth * scaleFactor;
            shift.leftPercent = currentLeftPercent;
            
            // Siguiente posición: actual + ancho + gap (pero nunca exceder 100%)
            currentLeftPercent = Math.min(
              100 - (laneShifts.length - index - 1) * 6, // Reservar espacio mínimo para badges restantes
              currentLeftPercent + shift.widthPercent + actualGapPercent
            );
          });
        }
      });
      
      return (
        <>
          {shiftsWithPositions.map(({ shift, lane, leftPercent, widthPercent, shiftHours }) => {
            
            return (
              <div
                key={shift.id}
                className="absolute rounded-md cursor-pointer transition-all hover:opacity-90 dark:hover:opacity-80 flex flex-col items-center justify-center text-white dark:text-gray-100 shadow-sm dark:shadow-md dark:ring-1 dark:ring-white/20 overflow-hidden px-2 py-1"
                style={{
                  left: `${leftPercent}%`,
                  width: `${widthPercent}%`,
                  top: `calc(3px + ${lane} * (100% - 6px) / ${maxLanes})`, // Espacio disponible dividido uniformemente entre carriles
                  height: `calc((100% - 6px) / ${maxLanes} - 2px)`, // Altura con separación interna de 2px entre carriles
                  backgroundColor: shift.color || '#007AFF',
                  zIndex: 10 + shiftsWithPositions.indexOf(shiftsWithPositions.find(item => item.shift.id === shift.id)!), // Z-index único para evitar solapamiento visual
                  minWidth: '60px', // Ancho mínimo para legibilidad
                  boxSizing: 'border-box'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedShift(shift);
                  setShowShiftModal(true);
                }}
                title={`${shift.title}\n${shiftHours}${shift.location ? `\n📍 ${shift.location}` : ''}${shift.notes ? `\n📝 ${shift.notes}` : ''}`}
              >
                {/* Diseño de dos líneas: nombre arriba, hora abajo */}
                <div className="text-[10px] md:text-[11px] font-semibold leading-tight text-center truncate w-full">
                  {shift.title}
                </div>
                <div className="text-[8px] md:text-[9px] opacity-90 leading-tight text-center truncate w-full mt-0.5">
                  {shiftHours}
                </div>
              </div>
            );
          })}
        </>
      );
    }
    
    // MODO SEMANA: Sistema de carriles verticales (actual)
    // Assign lanes to prevent overlapping
    const shiftLanes = assignShiftLanes(dayShifts);
    
    // Configuración para modo semana: mostrar todos los badges
    const totalVisible = dayShifts.length; // Mostrar todos sin límite
    const shiftHeight = `${100 / totalVisible}%`; // Altura dinámica según número de turnos
    
    return (
      <>
        {/* Renderizar todos los turnos */}
        {shiftLanes.map(({ shift, lane }, index: number) => {
          const shiftStart = parseISO(shift.startAt);
          const shiftEnd = parseISO(shift.endAt);
          const startTime = format(shiftStart, 'HH:mm');
          const endTime = format(shiftEnd, 'HH:mm');
          const shiftHours = `${startTime}-${endTime}`;
          
          return (
            <div
              key={`${shift.id}-${index}`}
              className="absolute rounded-md cursor-pointer transition-all hover:opacity-90 dark:hover:opacity-80 flex flex-col items-center justify-center text-white dark:text-gray-100 shadow-sm dark:shadow-md dark:ring-1 dark:ring-white/20 overflow-hidden px-2 py-1"
              style={{
                left: '3px',
                right: '3px',
                top: `calc(3px + ${index} * (100% - 6px) / ${totalVisible})`, // Espacio disponible (menos márgenes) dividido uniformemente
                height: `calc((100% - 6px) / ${totalVisible} - 2px)`, // Altura con separación interna de 2px entre badges
                backgroundColor: shift.color || '#007AFF',
                zIndex: 10,
                boxSizing: 'border-box'
              }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedShift(shift);
                setShowShiftModal(true);
              }}
              title={`${shift.title}\n${shiftHours}${shift.location ? `\n📍 ${shift.location}` : ''}${shift.notes ? `\n📝 ${shift.notes}` : ''}`}
            >
              {/* Diseño de dos líneas: nombre arriba, hora abajo */}
              <div className="text-[10px] md:text-[11px] font-semibold leading-tight text-center truncate w-full">
                {shift.title}
              </div>
              <div className="text-[8px] md:text-[9px] opacity-90 leading-tight text-center truncate w-full mt-0.5">
                {shiftHours}
              </div>
            </div>
          );
        })}
      </>
    );
  };

  return (
    <div className="px-2 md:px-6 py-2 md:py-4 min-h-screen bg-gray-50 dark:bg-gray-900 space-y-3 md:space-y-6" style={{ overflowX: 'clip' }}>
      {loadingEmployees ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : employees.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No hay empleados registrados
          </div>
        ) : (
          <div className="bg-card rounded-lg border border-border overflow-hidden shadow-sm">

            {/* Timeline Grid */}
            <div className="divide-y divide-border">
              {/* Header con mes y navegación */}
              <div className="bg-muted/10 p-2 md:p-4">
                <div className="flex items-center justify-between mb-2 md:mb-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigateWeek('prev')}
                    className="h-8 w-8 p-0"
                    data-testid="button-prev-week"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  
                  <h2 className="text-base md:text-lg font-semibold text-foreground">
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
                <div className={`grid gap-1 py-1 ${viewMode === 'day' ? 'grid-cols-[120px_minmax(0,1fr)]' : 'grid-cols-[120px_repeat(7,minmax(0,1fr))]'}`}>
                  {/* Selector de vista */}
                  <div className="flex items-center justify-center">
                    {/* Slider con estética de TabNavigation - Oculto en móvil */}
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-1 relative scale-75 hidden sm:block">
                      {/* Sliding indicator */}
                      <div 
                        className="absolute top-1 bottom-1 bg-white dark:bg-gray-900 rounded-lg shadow-sm transition-all duration-300 ease-in-out border border-gray-200 dark:border-gray-700"
                        style={{
                          left: viewMode === 'day' ? '0%' : '50%',
                          width: '50%'
                        }}
                      />
                      
                      {/* Tab buttons */}
                      <div className="relative flex">
                        {(['day', 'week'] as const).map((mode) => {
                          const labels = { day: '1', week: '7' };
                          return (
                            <button
                              key={mode}
                              onClick={() => {
                              // Prevenir cambio a week en móvil
                              if (window.innerWidth >= 640 || mode === 'day') {
                                setViewMode(mode);
                              }
                            }}
                              className={`flex-1 py-2 px-3 font-medium text-xs transition-colors duration-200 relative z-10 flex items-center justify-center ${
                                viewMode === mode
                                  ? 'text-primary'
                                  : 'text-muted-foreground hover:text-foreground'
                              }`}
                              data-testid={`view-mode-${mode}`}
                            >
                              {labels[mode]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  
                  {/* Días de la semana */}
                  {weekRange.days.map((day, index) => {
                    const isToday = format(new Date(), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    
                    return (
                      <div key={index} className={`flex flex-col items-center justify-center h-10 ${
                        viewMode === 'day' ? 'justify-center' : 'items-center'
                      }`}>
                        <div className={`text-[10px] md:text-xs font-medium uppercase tracking-wide leading-none ${
                          isToday 
                            ? 'text-blue-600 dark:text-blue-400' 
                            : isWeekend 
                              ? 'text-muted-foreground/70' 
                              : 'text-muted-foreground'
                        }`}>
                          {viewMode === 'day' 
                            ? format(day, "EEEE, d 'de' MMMM", { locale: es })
                            : format(day, 'EEE', { locale: es })
                          }
                        </div>
                        
                        {viewMode === 'week' && (
                          <div className={`text-sm font-semibold rounded w-5 h-5 flex items-center justify-center leading-none mt-0.5 ${
                            isToday 
                              ? 'bg-blue-500 text-white shadow' 
                              : isWeekend 
                                ? 'text-muted-foreground/70' 
                                : 'text-foreground hover:bg-muted/50'
                          }`}>
                            {format(day, 'dd')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Filas de empleados */}
              {employees.map((employee: Employee) => {
                return (
                  <div key={employee.id} className="p-2 md:p-4">
                    <div className={`grid gap-1 items-stretch ${viewMode === 'day' ? 'grid-cols-[120px_minmax(0,1fr)]' : 'grid-cols-[120px_repeat(7,minmax(0,1fr))]'}`}>
                      {/* Columna del empleado */}
                      <div className="flex flex-col items-center justify-center gap-1">
                        <UserAvatar 
                          fullName={employee.fullName} 
                          size="sm" 
                          userId={employee.id}
                          profilePicture={employee.profilePicture}
                          className="w-4 h-4 sm:w-6 sm:h-6 md:w-8 md:h-8"
                        />
                        <div className="text-[10px] md:text-xs font-medium text-foreground text-center truncate max-w-full">
                          {employee.fullName}
                        </div>
                      </div>

                      {/* Columnas de días */}
                      {weekRange.days.map((day, dayIndex) => {
                        const holiday = isHoliday(day);
                        const vacation = isEmployeeOnVacation(employee.id, day);
                        const isDisabled = vacation; // Solo las vacaciones deshabilitan la celda
                        
                        return (
                          <div 
                            key={dayIndex} 
                            className={`${getCellStyle(employee.id, day)} ${
                              viewMode === 'day' 
                                ? 'flex flex-row' // Modo día: layout horizontal 
                                : 'flex flex-col' // Modo semana: layout vertical
                            } ${!isDisabled ? 'hover:bg-muted/40 dark:hover:bg-muted/50 transition-colors' : 'cursor-not-allowed'}`}
                            style={getCellHeightStyle(employee.id, day)}
                            onClick={() => {
                              if (!isDisabled && getShiftsForEmployee(employee.id).filter(shift => format(parseISO(shift.startAt), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')).length === 0) {
                                setSelectedCell({
                                  employeeId: employee.id,
                                  date: day,
                                  employeeName: employee.fullName
                                });
                                setShowNewShiftModal(true);
                              }
                            }}
                            title={
                              vacation ? 'Empleado de vacaciones' : 
                              holiday ? `Día festivo: ${holiday.name} - Click para añadir turno` : 
                              'Click para añadir turno'
                            }
                          >
                            {/* Área principal de la celda (badges y contenido especial) */}
                            <div className={`relative overflow-hidden ${
                              viewMode === 'day' 
                                ? 'flex-1' // Modo día: ocupa espacio restante
                                : 'flex-1' // Modo semana: ocupa el espacio menos el footer
                            }`} style={
                              viewMode === 'week' 
                                ? { paddingBottom: '24px', maxHeight: 'calc(100% - 24px)' }
                                : {}
                            }>
                              {/* Contenido especial para festivos/vacaciones */}
                              {getCellContent(employee.id, day)}
                              {/* Timeline bars serán renderizadas aquí */}
                              {renderShiftBar(employee, day)}
                            </div>
                            
                            {viewMode === 'day' ? (
                              /* MODO DÍA: Barra lateral derecha con botón "+" */
                              <div className="w-6 bg-muted/10 dark:bg-muted/20 border-l border-border/30 rounded-r flex items-center justify-center group hover:bg-muted/20 dark:hover:bg-muted/30 transition-colors">
                                <button
                                  className="text-muted-foreground group-hover:text-foreground transition-colors text-xs font-medium flex items-center justify-center w-full h-full"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isDisabled) {
                                      setSelectedCell({
                                        employeeId: employee.id,
                                        date: day,
                                        employeeName: employee.fullName
                                      });
                                      setShowNewShiftModal(true);
                                    }
                                  }}
                                  title="Añadir turno"
                                  data-testid={`button-add-shift-${employee.id}-${format(day, 'yyyy-MM-dd')}`}
                                >
                                  <span className="text-[10px]">+</span>
                                </button>
                              </div>
                            ) : (
                              /* MODO SEMANA: Footer abajo con botón "+" */
                              <div className="absolute bottom-0 left-0 right-0 h-6 bg-muted/10 dark:bg-muted/20 border-t border-border/30 rounded-b flex items-center justify-center group hover:bg-muted/20 dark:hover:bg-muted/30 transition-colors">
                                <button
                                  className="text-muted-foreground group-hover:text-foreground transition-colors text-xs font-medium flex items-center gap-1 px-2 py-1"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isDisabled) {
                                      setSelectedCell({
                                        employeeId: employee.id,
                                        date: day,
                                        employeeName: employee.fullName
                                      });
                                      setShowNewShiftModal(true);
                                    }
                                  }}
                                  title="Añadir turno"
                                  data-testid={`button-add-shift-${employee.id}-${format(day, 'yyyy-MM-dd')}`}
                                >
                                  <span className="text-[10px]">+</span>
                                </button>
                              </div>
                            )}
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
              <label className="text-sm font-medium text-foreground">Días de la semana</label>
              <div className="flex gap-2 flex-wrap">
                {dayNames.map((dayName, index) => {
                  const dayNumber = index + 1;
                  const isSelected = selectedDays.has(dayNumber);
                  
                  return (
                    <label
                      key={dayNumber}
                      className="flex flex-col items-center gap-1 cursor-pointer select-none"
                      data-testid={`checkbox-day-${dayNumber}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          const newSelectedDays = new Set(selectedDays);
                          if (e.target.checked) {
                            newSelectedDays.add(dayNumber);
                          } else {
                            newSelectedDays.delete(dayNumber);
                          }
                          setSelectedDays(newSelectedDays);
                        }}
                        className="w-4 h-4 rounded border-2 border-border text-blue-600 focus:ring-2 focus:ring-blue-500"
                      />
                      <span className={`text-xs font-medium ${
                        isSelected 
                          ? 'text-blue-600 dark:text-blue-400' 
                          : 'text-muted-foreground'
                      }`}>
                        {dayName}
                      </span>
                    </label>
                  );
                })}
              </div>
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
                if (selectedCell && newShift.title && newShift.startTime && newShift.endTime) {
                  createShiftMutation.mutate({
                    employeeId: selectedCell.employeeId,
                    date: selectedCell.date,
                    startTime: newShift.startTime,
                    endTime: newShift.endTime,
                    title: newShift.title,
                    location: newShift.location,
                    notes: newShift.notes,
                    color: newShift.color
                  });
                }
              }}
              disabled={!newShift.title || !newShift.startTime || !newShift.endTime || createShiftMutation.isPending}
            >
              {createShiftMutation.isPending ? 'Creando...' : 'Crear Turno'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para editar turno */}
      <Dialog open={showShiftModal} onOpenChange={setShowShiftModal}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">
              Editar Turno - {selectedShift && getEmployeeById(selectedShift.employeeId)?.fullName}
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {selectedShift && format(new Date(selectedShift.startAt), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
            </p>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Hora de inicio</label>
                <input
                  type="time"
                  value={editShift.startTime}
                  onChange={(e) => setEditShift(prev => ({ ...prev, startTime: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Hora de fin</label>
                <input
                  type="time"
                  value={editShift.endTime}
                  onChange={(e) => setEditShift(prev => ({ ...prev, endTime: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Título del turno</label>
              <input
                type="text"
                value={editShift.title}
                onChange={(e) => setEditShift(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ej: Turno de mañana, Guardia, etc."
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Ubicación (opcional)</label>
              <input
                type="text"
                value={editShift.location}
                onChange={(e) => setEditShift(prev => ({ ...prev, location: e.target.value }))}
                placeholder="Ej: Oficina central, Sucursal norte, etc."
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Notas (opcional)</label>
              <textarea
                value={editShift.notes}
                onChange={(e) => setEditShift(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Instrucciones especiales, tareas específicas, etc."
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Días de la semana</label>
              <div className="flex gap-2 flex-wrap">
                {dayNames.map((dayName, index) => {
                  const dayNumber = index + 1;
                  const isSelected = selectedDays.has(dayNumber);
                  
                  return (
                    <label
                      key={dayNumber}
                      className="flex flex-col items-center gap-1 cursor-pointer select-none"
                      data-testid={`edit-checkbox-day-${dayNumber}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          const newSelectedDays = new Set(selectedDays);
                          if (e.target.checked) {
                            newSelectedDays.add(dayNumber);
                          } else {
                            newSelectedDays.delete(dayNumber);
                          }
                          setSelectedDays(newSelectedDays);
                        }}
                        className="w-4 h-4 rounded border-2 border-border text-blue-600 focus:ring-2 focus:ring-blue-500"
                      />
                      <span className={`text-xs font-medium ${
                        isSelected 
                          ? 'text-blue-600 dark:text-blue-400' 
                          : 'text-muted-foreground'
                      }`}>
                        {dayName}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Color del turno</label>
              <div className="flex gap-2 flex-wrap">
                {SHIFT_COLORS.map((color, index) => (
                  <button
                    key={color}
                    onClick={() => setEditShift(prev => ({ ...prev, color }))}
                    className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                      editShift.color === color 
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
          
          <div className="flex justify-between pt-4">
            <Button 
              variant="destructive" 
              onClick={() => {
                if (selectedShift) {
                  deleteShiftMutation.mutate(selectedShift.id);
                }
              }}
              disabled={deleteShiftMutation.isPending}
            >
              {deleteShiftMutation.isPending ? 'Eliminando...' : 'Eliminar Turno'}
            </Button>
            
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowShiftModal(false);
                  setSelectedShift(null);
                }}
              >
                Cancelar
              </Button>
              <Button 
                onClick={() => {
                  if (selectedShift && editShift.title && editShift.startTime && editShift.endTime) {
                    updateShiftMutation.mutate({
                      id: selectedShift.id,
                      startTime: editShift.startTime,
                      endTime: editShift.endTime,
                      title: editShift.title,
                      location: editShift.location,
                      notes: editShift.notes,
                      color: editShift.color
                    });
                  }
                }}
                disabled={!editShift.title || !editShift.startTime || !editShift.endTime || updateShiftMutation.isPending}
              >
                {updateShiftMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}