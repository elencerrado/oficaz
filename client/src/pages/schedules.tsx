import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader as DialogHeaderComponent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarClock, Users, Plus, ChevronLeft, ChevronRight, Clock, Edit, Copy, Trash2, MapPin } from "lucide-react";
import { format, differenceInDays, addDays, subDays, startOfWeek, endOfWeek, eachDayOfInterval, parseISO, addWeeks, subWeeks, getDay } from "date-fns";
import { es } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAuth } from "@/hooks/use-auth";
import { usePageHeader } from '@/components/layout/page-header';
import { UserAvatar } from "@/components/ui/user-avatar";
import Autocomplete from "react-google-autocomplete";
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  TouchSensor,
  useSensor, 
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  useDraggable,
  useDroppable
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

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
  isActive: boolean;
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
  const [viewMode, setViewMode] = useState<'day' | 'workweek' | 'week'>('week');
  
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

  // Estados y configuración para drag & drop
  const [activeShift, setActiveShift] = useState<WorkShift | null>(null);
  const [dragOverCellId, setDragOverCellId] = useState<string | null>(null);
  
  // Estados para el modal de conflictos
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [isOverriding, setIsOverriding] = useState(false);
  const [conflictData, setConflictData] = useState<{
    sourceShift: WorkShift;
    targetEmployeeId: number;
    targetEmployeeName: string;
    targetDate: Date;
    existingShifts: WorkShift[];
  } | null>(null);
  
  // Configurar sensors para drag & drop con soporte móvil mejorado
  const sensors = useSensors(
    // Mouse/trackpad support
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px threshold to start dragging
      },
    }),
    
    // Touch support for mobile devices
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250, // 250ms long press to start dragging
        tolerance: 8, // Allow 8px of movement during delay
      },
    }),
    
    // Keyboard support for accessibility
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handlers para eventos de drag & drop
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const shift = workShifts.find(s => s.id === Number(active.id));
    if (shift) {
      setActiveShift(shift);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setDragOverCellId(over ? String(over.id) : null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    setActiveShift(null);
    setDragOverCellId(null);

    if (!over || !activeShift) return;

    // Parse drop target (format: "cell-employeeId-yyyy-MM-dd")
    const parts = String(over.id).split('-');
    const prefix = parts[0];
    const employeeIdStr = parts[1];
    const dateStr = parts.slice(2).join('-'); // Reconstruct the full date (yyyy-MM-dd)
    
    if (prefix !== 'cell') return;

    const targetEmployeeId = Number(employeeIdStr);
    const targetDate = parseISO(dateStr);
    
    // Don't duplicate if dropped on the same cell
    if (targetEmployeeId === activeShift.employeeId && 
        format(targetDate, 'yyyy-MM-dd') === format(parseISO(activeShift.startAt), 'yyyy-MM-dd')) {
      return;
    }

    // ⚠️ PROTECTED - DO NOT MODIFY - Validation Logic
    // Critical drop validation system that prevents data conflicts
    
    // 1. Validate target employee exists and is active
    const targetEmployee = getEmployeeById(targetEmployeeId);
    if (!targetEmployee) {
      toast({
        title: 'Error de validación',
        description: 'El empleado de destino no existe',
        variant: 'destructive'
      });
      return;
    }
    
    if (!targetEmployee.isActive) {
      toast({
        title: 'Empleado inactivo',
        description: `No se pueden asignar turnos a ${targetEmployee.fullName} porque está inactivo`,
        variant: 'destructive'
      });
      return;
    }

    // 2. Validate employee is not on vacation
    const vacation = isEmployeeOnVacation(targetEmployeeId, targetDate);
    if (vacation) {
      toast({
        title: 'Empleado de vacaciones',
        description: `${targetEmployee.fullName} está de vacaciones en esta fecha`,
        variant: 'destructive'
      });
      return;
    }

    // 3. Check for real time conflicts (overlapping hours) on the same day
    const existingShifts = getShiftsForEmployee(targetEmployeeId);
    const targetDateStr = format(targetDate, 'yyyy-MM-dd');
    
    // Helper function to check if two shifts have overlapping times
    const hasTimeConflict = (shift1: WorkShift, shift2Start: Date, shift2End: Date): boolean => {
      const shift1Start = parseISO(shift1.startAt);
      const shift1End = parseISO(shift1.endAt);
      
      // Check if times overlap: (start1 < end2) && (start2 < end1)
      return shift1Start < shift2End && shift2Start < shift1End;
    };
    
    // Calculate the new shift's start and end times
    const originalStart = parseISO(activeShift.startAt);
    const originalEnd = parseISO(activeShift.endAt);
    const newStart = new Date(targetDate);
    newStart.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0);
    const newEnd = new Date(targetDate);
    newEnd.setHours(originalEnd.getHours(), originalEnd.getMinutes(), 0, 0);
    
    // Handle overnight shifts
    if (originalEnd < originalStart) {
      newEnd.setDate(newEnd.getDate() + 1);
    }
    
    // Find shifts with actual time conflicts (including overnight shifts)
    // Exclude the original shift being dragged to avoid deleting it
    const conflictingShifts = existingShifts.filter((shift: WorkShift) => {
      // Skip the original shift being dragged
      if (shift.id === activeShift.id) return false;
      
      const shiftStart = parseISO(shift.startAt);
      const shiftEnd = parseISO(shift.endAt);
      const shiftStartDateStr = format(shiftStart, 'yyyy-MM-dd');
      const shiftEndDateStr = format(shiftEnd, 'yyyy-MM-dd');
      
      // Check if the shift overlaps with the target date
      const shiftOverlapsTargetDate = shiftStartDateStr === targetDateStr || shiftEndDateStr === targetDateStr;
      
      return shiftOverlapsTargetDate && hasTimeConflict(shift, newStart, newEnd);
    });
    

    // If there are time conflicts, show confirmation modal
    if (conflictingShifts.length > 0) {
      setConflictData({
        sourceShift: activeShift,
        targetEmployeeId,
        targetEmployeeName: targetEmployee.fullName,
        targetDate,
        existingShifts: conflictingShifts
      });
      setShowConflictModal(true);
      return;
    }

    // All validations passed - proceed with duplication
    try {
      await duplicateShift(activeShift, targetEmployeeId, targetDate);
      
      toast({
        title: '✅ Turno duplicado',
        description: `El turno "${activeShift.title}" se ha duplicado para ${targetEmployee.fullName}`,
      });
    } catch (error: any) {
      toast({
        title: 'Error al duplicar turno',
        description: error.message || 'No se pudo duplicar el turno',
        variant: 'destructive'
      });
    }
  };

  // Function to duplicate a shift
  const duplicateShift = async (originalShift: WorkShift, newEmployeeId: number, newDate: Date) => {
    const originalStart = parseISO(originalShift.startAt);
    const originalEnd = parseISO(originalShift.endAt);
    
    // Create new dates with same time but different date
    const newStart = new Date(newDate);
    newStart.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0);
    
    const newEnd = new Date(newDate);
    newEnd.setHours(originalEnd.getHours(), originalEnd.getMinutes(), 0, 0);
    
    // Handle overnight shifts
    if (originalEnd < originalStart) {
      newEnd.setDate(newEnd.getDate() + 1);
    }

    const duplicateData = {
      employeeId: newEmployeeId,
      startAt: newStart.toISOString(),
      endAt: newEnd.toISOString(),
      title: originalShift.title,
      location: originalShift.location || '',
      notes: originalShift.notes || '',
      color: originalShift.color
    };

    const response = await apiRequest('POST', '/api/work-shifts', duplicateData);
    
    // Invalidate and refetch shifts data
    queryClient.invalidateQueries({ queryKey: ['/api/work-shifts/company'] });
    
    return response;
  };

  // Funciones para manejar el modal de conflictos
  const handleConfirmOverride = async () => {
    if (!conflictData || isOverriding) return;
    
    console.log('🔧 Starting override process');
    setIsOverriding(true);
    try {
      console.log('🔧 About to delete', conflictData.existingShifts.length, 'shifts');
      
      // First, delete existing conflicting shifts
      for (const shift of conflictData.existingShifts) {
        try {
          console.log('🔧 Deleting shift', shift.id);
          await apiRequest('DELETE', `/api/work-shifts/${shift.id}`);
          console.log('🔧 Shift', shift.id, 'deleted successfully');
          // Invalidate cache immediately after each deletion
          queryClient.invalidateQueries({ queryKey: ['/api/work-shifts/company'] });
        } catch (error: any) {
          // If shift is already deleted (404), continue
          if (error.status === 404) {
            console.warn(`Shift ${shift.id} already deleted, skipping...`);
            continue;
          }
          console.error('🔧 Error deleting shift', shift.id, error);
          throw error; // Re-throw other errors
        }
      }
      
      console.log('🔧 All shifts deleted, waiting for cache update');
      // Wait a moment for cache to update
      await new Promise(resolve => setTimeout(resolve, 100));

      console.log('🔧 About to duplicate shift');
      // Then duplicate the original shift
      await duplicateShift(conflictData.sourceShift, conflictData.targetEmployeeId, conflictData.targetDate);
      console.log('🔧 Shift duplicated successfully');
      
      toast({
        title: '✅ Turno sobrescrito',
        description: `El turno "${conflictData.sourceShift.title}" ha reemplazado los turnos existentes para ${conflictData.targetEmployeeName}`,
      });
      
      setShowConflictModal(false);
      setConflictData(null);
    } catch (error: any) {
      toast({
        title: 'Error al sobrescribir turnos',
        description: error.message || 'No se pudieron sobrescribir los turnos',
        variant: 'destructive'
      });
    } finally {
      setIsOverriding(false);
    }
  };

  const handleCancelConflict = () => {
    setShowConflictModal(false);
    setConflictData(null);
  };

  // Calcular rango según el modo de vista
  const getWeekRange = () => {
    if (viewMode === 'day') {
      // Solo mostrar el día actual
      return {
        start: viewDate,
        end: viewDate,
        days: [viewDate]
      };
    } else if (viewMode === 'workweek') {
      // Solo mostrar días laborales (lunes a viernes)
      const start = startOfWeek(viewDate, { weekStartsOn: 1 }); // Monday start
      const end = addDays(start, 4); // Friday (Monday + 4 days = Friday)
      return { start, end, days: eachDayOfInterval({ start, end }) };
    } else {
      // Mostrar toda la semana (incluyendo sábado y domingo)
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
    
    let baseStyle = "relative rounded border overflow-hidden min-h-[60px]"; // Altura compacta
    
    if (holiday) {
      // Día festivo - fondo rojo suave
      baseStyle += " bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800";
    } else if (vacation) {
      // Empleado de vacaciones - fondo azul suave
      baseStyle += " bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800";
    } else {
      // Día normal - fondo más claro y atractivo
      baseStyle += " bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700";
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

  // ⚠️ OPTIMIZACIÓN: Memoizar filtros de días para evitar recálculos en cada renderizado
  const filteredDays = useMemo(() => {
    return viewMode === 'workweek' 
      ? weekRange.days.filter(day => day.getDay() >= 1 && day.getDay() <= 5)
      : weekRange.days;
  }, [weekRange.days, viewMode]);

  // Obtener turnos para un empleado específico
  const getShiftsForEmployee = (employeeId: number) => {
    return workShifts.filter((shift: WorkShift) => shift.employeeId === employeeId);
  };

  // ⚠️ PROTECTED - Lane assignment algorithm for shift collision detection - DO NOT MODIFY ⚠️
  const assignShiftLanes = useCallback((dayShifts: WorkShift[]): { shift: WorkShift; lane: number; totalLanes: number }[] => {
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
    
    return result;
  }, []);

  // ⚠️ TIMELINE GLOBAL MEMOIZADO: Calcular límites para TODOS los empleados del día
  const getGlobalTimelineBounds = useCallback((day: Date) => {
    const dayString = format(day, 'yyyy-MM-dd');
    
    // Obtener TODOS los turnos de TODOS los empleados para este día
    const allDayShifts = workShifts.filter((shift: WorkShift) => {
      const shiftStart = parseISO(shift.startAt);
      const shiftStartDay = format(shiftStart, 'yyyy-MM-dd');
      return shiftStartDay === dayString;
    });
    
    if (allDayShifts.length === 0) {
      return { start: 6, end: 22 }; // Default si no hay turnos
    }
    
    let minHour = 24;
    let maxHour = 0;
    
    allDayShifts.forEach(shift => {
      const startHour = parseISO(shift.startAt).getHours();
      const endHour = parseISO(shift.endAt).getHours();
      const endMinutes = parseISO(shift.endAt).getMinutes();
      
      minHour = Math.min(minHour, startHour);
      maxHour = Math.max(maxHour, endMinutes > 0 ? endHour + 1 : endHour);
    });
    
    // Añadir margen de 1 hora a cada lado para mejor visualización
    const startWithMargin = Math.max(0, minHour - 1);
    const endWithMargin = Math.min(24, maxHour + 1);
    
    return { start: startWithMargin, end: endWithMargin };
  }, [workShifts]);

  // Componente droppable para celdas del calendario
  function DroppableCell({
    employeeId,
    day,
    isDisabled,
    className,
    style,
    onClick,
    children,
    title
  }: {
    employeeId: number;
    day: Date;
    isDisabled: boolean;
    className: string;
    style: React.CSSProperties;
    onClick: () => void;
    children: React.ReactNode;
    title: string;
  }) {
    const cellId = `cell-${employeeId}-${format(day, 'yyyy-MM-dd')}`;
    
    const {
      isOver,
      setNodeRef
    } = useDroppable({
      id: cellId,
      disabled: isDisabled
    });

    // Enhanced visual feedback based on drag state and validity
    const getDropStyles = () => {
      if (!activeShift) return {};
      
      const isValidDrop = !isDisabled;
      const isDraggedOver = isOver;
      
      if (isDraggedOver) {
        if (isValidDrop) {
          // Valid drop zone - green highlight
          return {
            backgroundColor: 'rgba(34, 197, 94, 0.1)', // green-500 with opacity
            borderColor: 'rgb(34, 197, 94)', // green-500
            borderWidth: '2px',
            borderStyle: 'dashed',
            transform: 'scale(1.02)',
            transition: 'all 0.2s ease'
          };
        } else {
          // Invalid drop zone - red highlight
          return {
            backgroundColor: 'rgba(239, 68, 68, 0.1)', // red-500 with opacity
            borderColor: 'rgb(239, 68, 68)', // red-500
            borderWidth: '2px',
            borderStyle: 'solid',
            transform: 'scale(0.98)',
            transition: 'all 0.2s ease'
          };
        }
      } else if (activeShift && isValidDrop) {
        // Valid but not hovered - subtle indication
        return {
          backgroundColor: 'rgba(34, 197, 94, 0.03)', // very subtle green
          borderColor: 'rgba(34, 197, 94, 0.3)', // subtle green border
          borderWidth: '1px',
          borderStyle: 'dotted',
          transition: 'all 0.2s ease'
        };
      }
      
      return {};
    };

    const dropStyles = getDropStyles();
    const isValidDrop = !isDisabled;
    const isDraggedOver = isOver;

    return (
      <div
        ref={setNodeRef}
        className={`${className} ${
          activeShift ? 
            (isDraggedOver ? 
              (isValidDrop ? 'ring-2 ring-green-400/50 shadow-lg' : 'ring-2 ring-red-400/50') : 
              (isValidDrop ? 'ring-1 ring-green-300/30' : '')) : 
            ''
        }`}
        style={{
          ...style,
          ...dropStyles
        }}
        onClick={onClick}
        title={activeShift && isDraggedOver ? 
          (isValidDrop ? 'Soltar aquí para duplicar el turno' : title) : 
          title
        }
      >
        {children}
        {/* Visual indicator for valid drop zones */}
        {activeShift && isDraggedOver && isValidDrop && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-green-500 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg animate-pulse">
              <span className="text-sm font-bold">+</span>
            </div>
          </div>
        )}
        {/* Visual indicator for invalid drop zones */}
        {activeShift && isDraggedOver && !isValidDrop && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg">
              <span className="text-sm font-bold">✕</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Componente draggable para badges de turnos
  function DraggableBadge({ 
    shift, 
    shiftHours, 
    style, 
    onClick, 
    title, 
    className 
  }: {
    shift: WorkShift;
    shiftHours: string;
    style: React.CSSProperties;
    onClick: (e: React.MouseEvent) => void;
    title: string;
    className?: string;
  }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      isDragging,
    } = useDraggable({
      id: shift.id,
    });

    const dragStyle = transform ? {
      transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    } : {};

    // Enhanced drag styling with better visual feedback
    const getDragStyles = () => {
      if (isDragging) {
        return {
          opacity: 0.8,
          transform: `${transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : ''} rotate(5deg) scale(1.05)`,
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3), 0 0 0 2px rgba(255, 255, 255, 0.8)',
          zIndex: 1000,
          transition: 'none', // Remove transitions during drag for smooth movement
          filter: 'brightness(1.1) saturate(1.2)', // Make colors more vibrant when dragging
          border: '2px solid rgba(255, 255, 255, 0.9)',
        };
      }
      return {
        ...dragStyle,
        transition: 'all 0.2s ease',
        cursor: 'grab'
      };
    };

    const enhancedDragStyles = getDragStyles();

    return (
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        className={`absolute rounded-md flex flex-col items-center justify-center text-white dark:text-gray-100 shadow-sm dark:shadow-md dark:ring-1 dark:ring-white/20 overflow-hidden px-2 py-1 select-none ${
          isDragging ? 
            'z-50 shadow-2xl ring-2 ring-white/50' : 
            'cursor-grab hover:opacity-90 dark:hover:opacity-80 hover:shadow-md hover:scale-105 active:cursor-grabbing'
        } ${className || ''}`}
        style={{
          ...style,
          ...enhancedDragStyles,
          backgroundColor: shift.color || '#007AFF',
        }}
        onClick={onClick}
        title={isDragging ? 'Arrastrando turno...' : `${title} (Click para editar, arrastrar para duplicar)`}
      >
        {/* Diseño de dos líneas: nombre arriba, hora abajo */}
        <div className="text-[10px] md:text-[11px] font-semibold leading-tight text-center truncate w-full">
          {shift.title}
        </div>
        <div className="text-[8px] md:text-[9px] opacity-90 leading-tight text-center truncate w-full mt-0.5">
          {shiftHours}
        </div>
        
        {/* Drag handle indicator - only visible on hover when not dragging */}
        {!isDragging && (
          <div className="absolute top-0 right-0 w-3 h-3 opacity-0 group-hover:opacity-70 transition-opacity">
            <div className="w-full h-full bg-white/30 rounded-bl-md flex items-center justify-center">
              <span className="text-[6px] font-bold">⋮⋮</span>
            </div>
          </div>
        )}
        
        {/* Duplicate icon when dragging */}
        {isDragging && (
          <div className="absolute -top-2 -right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white animate-pulse">
            <span className="text-[8px] font-bold text-white">📋</span>
          </div>
        )}
      </div>
    );
  }

  // ⚠️ OPTIMIZACIÓN: Renderizar barras de turnos memoizado para evitar O(E×S) recálculos
  const renderShiftBar = useCallback((employee: Employee, day: Date) => {
    const shifts = getShiftsForEmployee(employee.id);
    const dayString = format(day, 'yyyy-MM-dd');
    
    // Filtrar turnos que caen en este día específico
    const dayShifts = shifts.filter((shift: WorkShift) => {
      const shiftStart = parseISO(shift.startAt);
      const shiftStartDay = format(shiftStart, 'yyyy-MM-dd');
      return shiftStartDay === dayString;
    });
    
    if (dayShifts.length === 0) return null;

    // ⚠️ USAR TIMELINE GLOBAL para que TODOS los empleados tengan la misma escala temporal
    const timelineBounds = getGlobalTimelineBounds(day);
    const TIMELINE_START_HOUR = timelineBounds.start;
    const TIMELINE_END_HOUR = timelineBounds.end;
    const TIMELINE_TOTAL_HOURS = TIMELINE_END_HOUR - TIMELINE_START_HOUR;
    
    // MODO DÍA: Timeline cronológico puro - SIN carriles verticales
    if (viewMode === 'day') {
      // Ordenar turnos cronológicamente
      const sortedShifts = [...dayShifts].sort((a, b) => 
        parseISO(a.startAt).getTime() - parseISO(b.startAt).getTime()
      );
      
      // Calcular posiciones cronológicas directas para TODOS los turnos
      const shiftsWithPositions = sortedShifts.map(shift => {
        const shiftStart = parseISO(shift.startAt);
        const shiftEnd = parseISO(shift.endAt);
        const shiftHours = `${format(shiftStart, 'HH:mm')}-${format(shiftEnd, 'HH:mm')}`;
        
        // Calcular horas como decimales
        const startHour = shiftStart.getHours() + shiftStart.getMinutes() / 60;
        const endHour = shiftEnd.getHours() + shiftEnd.getMinutes() / 60;
        
        // Limitar al timeline visible
        const clampedStart = Math.max(startHour, TIMELINE_START_HOUR);
        const clampedEnd = Math.min(endHour, TIMELINE_END_HOUR);
        
        // Posición cronológica exacta en %
        const leftPercent = ((clampedStart - TIMELINE_START_HOUR) / TIMELINE_TOTAL_HOURS) * 100;
        const widthPercent = ((clampedEnd - clampedStart) / TIMELINE_TOTAL_HOURS) * 100;
        
        
        return {
          shift,
          shiftHours,
          leftPercent,
          widthPercent: widthPercent
        };
      });
      
      // ⚠️ ANCHO MÍNIMO INTELIGENTE: Garantizar legibilidad sin romper cronología
      const MIN_WIDTH_PERCENT = 8; // 8% mínimo para mostrar "18:00-19:00" completo
      const minGap = 0.5;
      
      // Aplicar ancho mínimo a todos los badges
      shiftsWithPositions.forEach(item => {
        item.widthPercent = Math.max(item.widthPercent, MIN_WIDTH_PERCENT);
      });
      
      // Verificar si todos los badges caben en el timeline
      const totalRequiredWidth = shiftsWithPositions.reduce((sum, item) => sum + item.widthPercent, 0);
      const totalGaps = (shiftsWithPositions.length - 1) * minGap;
      const totalRequired = totalRequiredWidth + totalGaps;
      
      // Si no cabe todo, aplicar compresión proporcional
      if (totalRequired > 100) {
        const compressionFactor = (100 - totalGaps) / totalRequiredWidth;
        
        shiftsWithPositions.forEach(item => {
          item.widthPercent = Math.max(MIN_WIDTH_PERCENT * 0.7, item.widthPercent * compressionFactor); // Permitir hasta 70% del mínimo
        });
      }
      
      // ⚠️ REPOSICIONAMIENTO INTELIGENTE: Solo si hay solapamiento visual real
      for (let i = 1; i < shiftsWithPositions.length; i++) {
        const current = shiftsWithPositions[i];
        const previous = shiftsWithPositions[i - 1];
        
        const prevRightEdge = previous.leftPercent + previous.widthPercent;
        
        // Solo reposicionar si HAY solapamiento visual (no temporal)
        if (current.leftPercent < prevRightEdge + minGap) {
          const originalLeft = current.leftPercent;
          current.leftPercent = prevRightEdge + minGap;
          
          // Si se sale del 100%, comprimir el ancho
          if (current.leftPercent + current.widthPercent > 100) {
            current.widthPercent = Math.max(MIN_WIDTH_PERCENT * 0.7, 100 - current.leftPercent);
          }
          
        } else {
          // No hay solapamiento - mantener posición cronológica original
        }
      }
      
      return (
        <>
          {/* ⏰ REGLA DE HORAS - Referencia visual cronológica */}
          <div className="absolute top-0 left-0 right-0 h-6 border-b border-border/30 bg-muted/5 dark:bg-muted/10 flex items-end z-5">
            {Array.from({ length: TIMELINE_TOTAL_HOURS + 1 }, (_, i) => {
              const hour = TIMELINE_START_HOUR + i;
              const hourPercent = (i / TIMELINE_TOTAL_HOURS) * 100;
              
              return (
                <div
                  key={hour}
                  className="absolute flex flex-col items-center"
                  style={{ left: `${hourPercent}%` }}
                >
                  {/* Línea vertical de referencia */}
                  <div className="w-px h-2 bg-muted-foreground/30 dark:bg-muted-foreground/40 mb-1" />
                  {/* Etiqueta de hora */}
                  <div className="text-[8px] md:text-[9px] font-medium text-muted-foreground whitespace-nowrap">
                    {hour.toString().padStart(2, '0')}:00
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Badges de turnos */}
          {shiftsWithPositions.map(({ shift, shiftHours, leftPercent, widthPercent }) => (
            <DraggableBadge
              key={shift.id}
              shift={shift}
              shiftHours={shiftHours}
              style={{
                left: `${leftPercent}%`,
                width: `${widthPercent}%`,
                top: '28px',          // Margen para la regla de horas arriba
                bottom: '3px',        
                zIndex: 10,
                boxSizing: 'border-box'
              }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedShift(shift);
                setShowShiftModal(true);
              }}
              title={`${shift.title}\n${shiftHours}${shift.location ? `\n📍 ${shift.location}` : ''}${shift.notes ? `\n📝 ${shift.notes}` : ''}`}
            />
          ))}
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
            <DraggableBadge
              key={`${shift.id}-${index}`}
              shift={shift}
              shiftHours={shiftHours}
              style={{
                left: '3px',
                right: '3px',
                top: `calc(3px + ${index} * (100% - 6px) / ${totalVisible})`, // Espacio disponible (menos márgenes) dividido uniformemente
                height: `calc((100% - 6px) / ${totalVisible} - 2px)`, // Altura con separación interna de 2px entre badges
                zIndex: 10,
                boxSizing: 'border-box'
              }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedShift(shift);
                setShowShiftModal(true);
              }}
              title={`${shift.title}\n${shiftHours}${shift.location ? `\n📍 ${shift.location}` : ''}${shift.notes ? `\n📝 ${shift.notes}` : ''}`}
            />
          );
        })}
      </>
    );
  }, [workShifts, viewMode, getShiftsForEmployee, getGlobalTimelineBounds, assignShiftLanes]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {loadingEmployees ? (
        <div className="px-6 pt-4 pb-8 min-h-screen bg-background overflow-y-auto flex justify-center py-8" style={{ overflowX: 'clip' }}>
          <LoadingSpinner />
        </div>
      ) : employees.length === 0 ? (
        <div className="px-6 pt-4 pb-8 min-h-screen bg-background overflow-y-auto text-center py-8 text-muted-foreground" style={{ overflowX: 'clip' }}>
          No hay empleados registrados
        </div>
      ) : (
        <Card className="px-6 pt-4 pb-8 h-screen bg-card text-card-foreground border-border border shadow-sm flex flex-col" style={{ overflowX: 'clip' }}>
            <CardHeader className="bg-muted/10 px-4 py-2 flex-shrink-0">
              {/* Header con mes y navegación */}
              <div>
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
                <div className={`grid gap-1 py-0.5 ${viewMode === 'day' ? 'grid-cols-[120px_minmax(0,1fr)]' : viewMode === 'workweek' ? 'grid-cols-[120px_repeat(5,minmax(0,1fr))]' : 'grid-cols-[120px_repeat(7,minmax(0,1fr))]'}`}>
                  {/* Selector de vista */}
                  <div className="flex items-center justify-center">
                    {/* Slider con estética de TabNavigation - Oculto en móvil */}
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-1 relative scale-75 hidden sm:block">
                      {/* Sliding indicator */}
                      <div 
                        className="absolute top-1 bottom-1 bg-white dark:bg-gray-900 rounded-lg shadow-sm transition-all duration-300 ease-in-out border border-gray-200 dark:border-gray-700"
                        style={{
                          left: viewMode === 'day' ? '0%' : viewMode === 'workweek' ? '33.33%' : '66.66%',
                          width: '33.33%'
                        }}
                      />
                      
                      {/* Tab buttons */}
                      <div className="relative flex">
                        {(['day', 'workweek', 'week'] as const).map((mode) => {
                          const labels = { day: '1', workweek: '5', week: '7' };
                          return (
                            <button
                              key={mode}
                              onClick={() => {
                              // Prevenir cambio a week en móvil (workweek y day sí funcionan)
                              if (window.innerWidth >= 640 || mode === 'day' || mode === 'workweek') {
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
                  {filteredDays.map((day, index) => {
                    const isToday = format(new Date(), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    
                    return (
                      <div key={index} className={`flex flex-col items-center justify-center h-8 ${
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
                        
                        {(viewMode === 'week' || viewMode === 'workweek') && (
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
            </CardHeader>
            
            <CardContent className="p-0 overflow-y-auto" style={{ height: 'calc(100vh - 160px)' }}>
              {/* Filas de empleados */}
              {employees.map((employee: Employee) => {
                return (
                  <div key={employee.id} className="p-4">
                    <div className={`grid gap-1 items-stretch ${viewMode === 'day' ? 'grid-cols-[120px_minmax(0,1fr)]' : viewMode === 'workweek' ? 'grid-cols-[120px_repeat(5,minmax(0,1fr))]' : 'grid-cols-[120px_repeat(7,minmax(0,1fr))]'}`}>
                      {/* Columna del empleado */}
                      <div className="flex flex-col items-center justify-center gap-1">
                        <UserAvatar 
                          fullName={employee.fullName} 
                          size="sm" 
                          userId={employee.id}
                          profilePicture={employee.profilePicture}
                          className="w-4 h-4 sm:w-6 sm:h-6 md:w-8 md:h-8"
                        />
                        <div className="text-[10px] md:text-xs font-medium text-foreground text-center max-w-full leading-tight">
                          {employee.fullName}
                        </div>
                      </div>

                      {/* Columnas de días */}
                      {filteredDays.map((day, dayIndex) => {
                        const holiday = isHoliday(day);
                        const vacation = isEmployeeOnVacation(employee.id, day);
                        const isDisabled = !!vacation; // Solo las vacaciones deshabilitan la celda
                        
                        return (
                          <DroppableCell
                            key={dayIndex}
                            employeeId={employee.id}
                            day={day}
                            isDisabled={isDisabled}
                            className={`${getCellStyle(employee.id, day)} ${
                              viewMode === 'day' 
                                ? 'flex flex-row' // Modo día: layout horizontal 
                                : 'flex flex-col' // Modo semana: layout vertical
                            } ${!isDisabled ? 'hover:bg-gray-100 dark:hover:bg-gray-700/70 transition-colors' : 'cursor-not-allowed'}`}
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
                              holiday ? `Día festivo: ${holiday.name} - Click para añadir turno o arrastrar turno aquí` : 
                              'Click para añadir turno o arrastrar turno aquí'
                            }
                          >
                            {/* Área principal de la celda (badges y contenido especial) */}
                            <div className={`relative overflow-hidden ${
                              viewMode === 'day' 
                                ? 'flex-1' // Modo día: ocupa espacio restante
                                : 'flex-1' // Modo semana: ocupa el espacio menos el footer
                            }`} style={
                              viewMode === 'week' || viewMode === 'workweek' 
                                ? { paddingBottom: '16px', maxHeight: 'calc(100% - 16px)' }
                                : {}
                            }>
                              {/* Contenido especial para festivos/vacaciones */}
                              {getCellContent(employee.id, day)}
                              {/* Timeline bars serán renderizadas aquí */}
                              {renderShiftBar(employee, day)}
                            </div>
                            
                            {viewMode === 'day' ? (
                              /* MODO DÍA: Barra lateral derecha con botón "+" */
                              <div className="w-6 bg-gray-100 dark:bg-gray-700/50 border-l border-gray-300 dark:border-gray-600 rounded-r flex items-center justify-center group hover:bg-gray-200 dark:hover:bg-gray-600/70 transition-colors">
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
                              <div className="absolute bottom-0 left-0 right-0 h-4 bg-gray-100 dark:bg-gray-700/50 border-t border-gray-300 dark:border-gray-600 rounded-b flex items-center justify-center group hover:bg-gray-200 dark:hover:bg-gray-600/70 transition-colors z-30">
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
                          </DroppableCell>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

      {/* Modal para nuevo turno - DISEÑO VISUAL TIPO BADGE */}
      <Dialog open={showNewShiftModal} onOpenChange={setShowNewShiftModal}>
        <DialogContent className="max-w-lg p-0 gap-0 bg-background border-0 overflow-hidden">
          {/* Header con preview del badge */}
          <div 
            className="px-6 py-4 text-white relative overflow-hidden"
            style={{ backgroundColor: newShift.color || SHIFT_COLORS[0] }}
          >
            <div className="absolute inset-0 bg-black/10" />
            <div className="relative z-10">
              <h3 className="text-lg font-semibold">
                {newShift.title || 'Nuevo Turno'}
              </h3>
              <p className="text-sm opacity-90">
                {newShift.startTime && newShift.endTime 
                  ? `${newShift.startTime} - ${newShift.endTime}`
                  : '09:00 - 17:00'
                }
              </p>
              <p className="text-xs opacity-75 mt-1">
                {selectedCell?.employeeName} • {selectedCell && format(selectedCell.date, "d MMM", { locale: es })}
              </p>
            </div>
          </div>

          <div className="flex">
            {/* Panel izquierdo - Colores verticales */}
            <div className="w-16 bg-muted/30 p-2 flex flex-col gap-1">
              {SHIFT_COLORS.map((color, index) => (
                <button
                  key={color}
                  onClick={() => setNewShift(prev => ({ ...prev, color }))}
                  className={`w-12 h-8 rounded border-2 transition-all hover:scale-105 ${
                    newShift.color === color 
                      ? 'border-gray-800 dark:border-gray-200 scale-105 shadow-md' 
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                  style={{ backgroundColor: color }}
                  title={`Color ${index + 1}`}
                />
              ))}
            </div>

            {/* Panel derecho - Formulario compacto */}
            <div className="flex-1 p-4 space-y-3">
              {/* Título */}
              <input
                type="text"
                value={newShift.title}
                onChange={(e) => setNewShift(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Título del turno (ej: Mañana, Tarde, Noche)"
                className="w-full px-3 py-2 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              
              {/* Horas */}
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="time"
                  value={newShift.startTime}
                  onChange={(e) => setNewShift(prev => ({ ...prev, startTime: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <input
                  type="time"
                  value={newShift.endTime}
                  onChange={(e) => setNewShift(prev => ({ ...prev, endTime: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              
              {/* Días de la semana */}
              <div className="flex gap-1 justify-center">
                {dayNames.map((dayName, index) => {
                  const dayNumber = index + 1;
                  const isSelected = selectedDays.has(dayNumber);
                  
                  return (
                    <label
                      key={dayNumber}
                      className="cursor-pointer select-none"
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
                        className="sr-only"
                      />
                      <div className={`w-6 h-6 rounded text-xs font-medium flex items-center justify-center transition-colors ${
                        isSelected 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                      }`}>
                        {dayName.charAt(0)}
                      </div>
                    </label>
                  );
                })}
              </div>
              
              {/* Ubicación */}
              <div className="relative">
                <MapPin className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={newShift.location}
                  onChange={(e) => setNewShift(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="Dirección o ubicación (ej: Calle Gran Vía 1, Madrid)"
                  className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <div className="text-xs text-blue-600 dark:text-blue-400 mt-1 pl-8">
                  🗺️ Para habilitar autocompletado: quita restricciones de tu API key de Google Maps
                </div>
              </div>
              
              {/* Notas */}
              <textarea
                value={newShift.notes}
                onChange={(e) => setNewShift(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Notas (opcional)"
                rows={2}
                className="w-full px-3 py-2 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              />
              
              {/* Botones */}
              <div className="flex justify-end gap-2 pt-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setShowNewShiftModal(false);
                    setSelectedCell(null);
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
                  size="sm"
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
                  {createShiftMutation.isPending ? 'Creando...' : 'Crear'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para editar turno - DISEÑO VISUAL TIPO BADGE */}
      <Dialog open={showShiftModal} onOpenChange={setShowShiftModal}>
        <DialogContent className="max-w-lg p-0 gap-0 bg-background border-0 overflow-hidden">
          {/* Header con preview del badge */}
          <div 
            className="px-6 py-4 text-white relative overflow-hidden"
            style={{ backgroundColor: editShift.color || SHIFT_COLORS[0] }}
          >
            <div className="absolute inset-0 bg-black/10" />
            <div className="relative z-10">
              <h3 className="text-lg font-semibold">
                {editShift.title || 'Turno'}
              </h3>
              <p className="text-sm opacity-90">
                {editShift.startTime && editShift.endTime 
                  ? `${editShift.startTime} - ${editShift.endTime}`
                  : 'Sin horario'
                }
              </p>
              <p className="text-xs opacity-75 mt-1">
                {selectedShift && getEmployeeById(selectedShift.employeeId)?.fullName} • {selectedShift && format(new Date(selectedShift.startAt), "d MMM", { locale: es })}
              </p>
            </div>
          </div>

          <div className="flex">
            {/* Panel izquierdo - Colores verticales */}
            <div className="w-16 bg-muted/30 p-2 flex flex-col gap-1">
              {SHIFT_COLORS.map((color, index) => (
                <button
                  key={color}
                  onClick={() => setEditShift(prev => ({ ...prev, color }))}
                  className={`w-12 h-8 rounded border-2 transition-all hover:scale-105 ${
                    editShift.color === color 
                      ? 'border-gray-800 dark:border-gray-200 scale-105 shadow-md' 
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                  style={{ backgroundColor: color }}
                  title={`Color ${index + 1}`}
                />
              ))}
            </div>

            {/* Panel derecho - Formulario compacto */}
            <div className="flex-1 p-4 space-y-3">
              {/* Título */}
              <input
                type="text"
                value={editShift.title}
                onChange={(e) => setEditShift(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Título del turno (ej: Mañana, Tarde, Noche)"
                className="w-full px-3 py-2 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              
              {/* Horas */}
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="time"
                  value={editShift.startTime}
                  onChange={(e) => setEditShift(prev => ({ ...prev, startTime: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <input
                  type="time"
                  value={editShift.endTime}
                  onChange={(e) => setEditShift(prev => ({ ...prev, endTime: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              
              {/* Días de la semana */}
              <div className="flex gap-1 justify-center">
                {dayNames.map((dayName, index) => {
                  const dayNumber = index + 1;
                  const isSelected = selectedDays.has(dayNumber);
                  
                  return (
                    <label
                      key={dayNumber}
                      className="cursor-pointer select-none"
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
                        className="sr-only"
                      />
                      <div className={`w-6 h-6 rounded text-xs font-medium flex items-center justify-center transition-colors ${
                        isSelected 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                      }`}>
                        {dayName.charAt(0)}
                      </div>
                    </label>
                  );
                })}
              </div>
              
              {/* Ubicación */}
              <div className="relative">
                <MapPin className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={editShift.location}
                  onChange={(e) => setEditShift(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="Dirección o ubicación (ej: Calle Gran Vía 1, Madrid)"
                  className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <div className="text-xs text-blue-600 dark:text-blue-400 mt-1 pl-8">
                  🗺️ Para habilitar autocompletado: quita restricciones de tu API key de Google Maps
                </div>
              </div>
              
              {/* Notas */}
              <textarea
                value={editShift.notes}
                onChange={(e) => setEditShift(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Notas (opcional)"
                rows={2}
                className="w-full px-3 py-2 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              />
              
              {/* Botones */}
              <div className="flex justify-between items-center pt-2">
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => {
                    if (selectedShift) {
                      deleteShiftMutation.mutate(selectedShift.id);
                    }
                  }}
                  disabled={deleteShiftMutation.isPending}
                >
                  {deleteShiftMutation.isPending ? 'Eliminando...' : 'Eliminar'}
                </Button>
                
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setShowShiftModal(false);
                      setSelectedShift(null);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    size="sm"
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
                    {updateShiftMutation.isPending ? 'Guardando...' : 'Guardar'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de conflictos de turnos */}
      <Dialog open={showConflictModal} onOpenChange={setShowConflictModal}>
        <DialogContent className="max-w-md p-0 gap-0 bg-background border-0 overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 bg-orange-500 text-white">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-sm">⚠️</span>
              </div>
              <h3 className="text-lg font-semibold">Conflicto de turnos</h3>
            </div>
            <p className="text-sm opacity-90 mt-1">
              {conflictData?.targetEmployeeName} ya tiene turnos asignados en esta fecha
            </p>
          </div>

          {/* Body */}
          <div className="p-6">
            <div className="mb-4">
              <p className="text-sm text-muted-foreground mb-3">
                <strong>{conflictData?.targetEmployeeName}</strong> ya tiene {conflictData?.existingShifts.length} turno(s) el{' '}
                <strong>{conflictData?.targetDate && format(conflictData.targetDate, "EEEE d 'de' MMMM", { locale: es })}</strong>:
              </p>
              
              {/* Lista de turnos existentes */}
              <div className="space-y-2 mb-4">
                {conflictData?.existingShifts.map((shift, index) => (
                  <div
                    key={shift.id}
                    className="p-3 rounded border flex items-center justify-between"
                    style={{ borderLeftWidth: '4px', borderLeftColor: shift.color }}
                  >
                    <div>
                      <div className="font-medium text-sm">{shift.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(parseISO(shift.startAt), 'HH:mm')} - {format(parseISO(shift.endAt), 'HH:mm')}
                        {shift.location && ` • ${shift.location}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: conflictData?.sourceShift.color }}
                  />
                  <span className="font-medium text-sm">Nuevo turno a añadir:</span>
                </div>
                <div className="text-sm">
                  <strong>{conflictData?.sourceShift.title}</strong>
                </div>
                <div className="text-xs text-muted-foreground">
                  {conflictData?.sourceShift && format(parseISO(conflictData.sourceShift.startAt), 'HH:mm')} -{' '}
                  {conflictData?.sourceShift && format(parseISO(conflictData.sourceShift.endAt), 'HH:mm')}
                  {conflictData?.sourceShift.location && ` • ${conflictData.sourceShift.location}`}
                </div>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              ¿Qué deseas hacer? Si sobrescribes, los turnos existentes se eliminarán permanentemente.
            </p>

            {/* Botones */}
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelConflict}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmOverride}
                disabled={isOverriding}
                className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50"
              >
                {isOverriding ? 'Sobrescribiendo...' : 'Sobrescribir turnos'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DndContext>
  );
}