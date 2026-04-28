// Schedules Component - Work Shift Management
// Last updated: 2025-12-05 - Fixed access mode initialization

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePageTitle } from '@/hooks/use-page-title';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Users, Plus, ChevronLeft, ChevronRight, ChevronDown, Clock, Copy, Trash2, MapPin, X, Plane, Loader2, AlertTriangle } from "lucide-react";
import { format, differenceInDays, addDays, subDays, startOfWeek, endOfWeek, eachDayOfInterval, parseISO, addWeeks, subWeeks, getDay } from "date-fns";
import { es } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";
import { logger } from '@/lib/logger';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useFeatureCheck } from "@/hooks/use-feature-check";
import { FeatureRestrictedPage } from "@/components/feature-restricted-page";
import { usePageHeader } from '@/components/layout/page-header';
import { UserAvatar } from "@/components/ui/user-avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTeams, resolveTeamMemberIds } from '@/hooks/use-teams';
import { 
  DndContext, 
  closestCenter,
  closestCorners,
  KeyboardSensor, 
  PointerSensor, 
  TouchSensor,
  useSensor, 
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  DragOverlay,
  useDraggable,
  useDroppable,
  defaultDropAnimationSideEffects,
  Modifier
} from '@dnd-kit/core';
import { 
  SortableContext, 
  horizontalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
  arrayMove
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
  role: 'admin' | 'manager' | 'employee';
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

interface ShiftTemplate {
  id: number;
  companyId: number;
  title: string;
  startTime: string;
  endTime: string;
  color: string;
  location?: string;
  notes?: string;
  displayOrder: number;
  createdBy?: number;
  createdAt: string;
  updatedAt?: string;
}

interface WeeklyEventGroup {
  key: string;
  representativeShiftId: number;
  title: string;
  startTime: string;
  endTime: string;
  location?: string;
  color: string;
  notes?: string;
  displayOrder: number;
}

const SHIFT_COLORS = [
  '#2563EB', // blue-600 (azul intenso)
  '#DC2626', // red-600 (rojo)
  '#059669', // emerald-600 (verde esmeralda)
  '#7C3AED', // violet-600 (violeta)
  '#CA8A04', // yellow-600 (mostaza/dorado)
  '#0891B2', // cyan-600 (turquesa)
  '#DB2777', // pink-600 (rosa fucsia)
  '#4B5563', // gray-600 (gris oscuro)
];

const MIN_SHIFT_DURATION_MINUTES = 15;

// Helper to get weekday number (0 = Sunday, 6 = Saturday)
const getWeekdayNumber = (date: Date): number => {
  return getDay(date);
};

export default function Schedules() {
  // Core hooks - must be called unconditionally
  usePageTitle('Horarios');
  const { company, user } = useAuth();
  const featureCheck = useFeatureCheck();
  const { setHeader, resetHeader } = usePageHeader();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Access mode - safe to call after featureCheck is initialized
  const schedulesAccessMode = featureCheck?.getSchedulesAccessMode?.() || 'none';
  const isViewOnly = schedulesAccessMode === 'view';
  const hasNoAccess = schedulesAccessMode === 'none';

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
      // ⭐ OPTIMIZACIÓN: Invalidar solo la semana actual en lugar de todas
      invalidateCurrentWeekShifts();
      refetchShifts();
      
      const successes = results.filter(r => r.success).length;
      
      // Reset si al menos uno fue exitoso
      if (successes > 0) {
        setShowShiftModal(false);
        setSelectedShift(null);
        setSelectedDays(new Set());
      }
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error?.message || 'No se pudieron actualizar los turnos'
      });
    },
  });
  
  // Mutation para eliminar turno
  const deleteShiftMutation = useMutation({
    mutationFn: async (shiftId: number) => {
      setDeletingShiftId(shiftId);
      return apiRequest('DELETE', `/api/work-shifts/${shiftId}`);
    },
    onSuccess: async () => {
      // ⭐ OPTIMIZACIÓN: Invalidar solo la semana actual
      invalidateCurrentWeekShifts();
      await refetchShifts();
      setShowShiftModal(false);
      setSelectedShift(null);
      setDeletingShiftId(null);
    },
    onError: (error: any) => {
      setDeletingShiftId(null);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error?.message || 'No se pudo eliminar el turno'
      });
    },
  });

  // Helper para calcular fecha de un día específico en la semana actual
  const getDateForWeekday = (baseDate: Date, targetWeekday: number): Date => {
    const currentWeekday = getWeekdayNumber(baseDate);
    const daysToAdd = targetWeekday - currentWeekday;
    return addDays(baseDate, daysToAdd);
  };

  // Mutation para crear turno(s) en múltiples días - detecta conflictos y los encola
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
      
      const employee = employees.find(e => e.id === selectedCell.employeeId);
      const employeeName = employee?.fullName || 'Empleado';
      
      // Separar días con conflicto de días sin conflicto
      const daysWithConflict: Array<{
        targetDate: Date;
        existingShifts: WorkShift[];
      }> = [];
      const daysWithoutConflict: Date[] = [];
      
      for (const dayNumber of selectedDaysArray) {
        const targetDate = getDateForWeekday(selectedCell.date, dayNumber);
        
        // Obtener turnos existentes en ese día para ese empleado
        const dayString = format(targetDate, 'yyyy-MM-dd');
        const existingShifts = workShifts.filter((shift: WorkShift) => {
          if (shift.employeeId !== selectedCell.employeeId) return false;
          const shiftDate = format(parseISO(shift.startAt), 'yyyy-MM-dd');
          return shiftDate === dayString;
        });
        
        if (existingShifts.length > 0) {
          // Verificar si hay solapamiento de tiempo
          const [startHour, startMinute] = shiftData.startTime.split(':').map(Number);
          const [endHour, endMinute] = shiftData.endTime.split(':').map(Number);
          
          const newStart = new Date(targetDate);
          newStart.setHours(startHour, startMinute, 0, 0);
          const newEnd = new Date(targetDate);
          newEnd.setHours(endHour, endMinute, 0, 0);
          if (newEnd <= newStart) newEnd.setDate(newEnd.getDate() + 1);
          
          const hasOverlap = existingShifts.some((shift: WorkShift) => {
            const existingStart = parseISO(shift.startAt);
            const existingEnd = parseISO(shift.endAt);
            return newStart < existingEnd && newEnd > existingStart;
          });
          
          if (hasOverlap) {
            daysWithConflict.push({ targetDate, existingShifts });
          } else {
            daysWithoutConflict.push(targetDate);
          }
        } else {
          daysWithoutConflict.push(targetDate);
        }
      }
      
      // Crear turnos para días sin conflicto
      const results = await Promise.all(daysWithoutConflict.map(async (targetDate) => {
        const startAt = new Date(targetDate);
        const endAt = new Date(targetDate);
        
        const [startHour, startMinute] = shiftData.startTime.split(':').map(Number);
        const [endHour, endMinute] = shiftData.endTime.split(':').map(Number);
        
        startAt.setHours(startHour, startMinute, 0, 0);
        endAt.setHours(endHour, endMinute, 0, 0);
        
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
      }));
      
      // Preparar conflictos para la cola
      const conflictsToQueue = daysWithConflict.map(({ targetDate, existingShifts }) => {
        const startAt = new Date(targetDate);
        const endAt = new Date(targetDate);
        
        const [startHour, startMinute] = shiftData.startTime.split(':').map(Number);
        const [endHour, endMinute] = shiftData.endTime.split(':').map(Number);
        
        startAt.setHours(startHour, startMinute, 0, 0);
        endAt.setHours(endHour, endMinute, 0, 0);
        
        if (endAt <= startAt) {
          endAt.setDate(endAt.getDate() + 1);
        }
        
        // Crear un "pseudo-shift" para el modal de conflictos
        const sourceShift: WorkShift = {
          id: -1, // ID temporal negativo
          employeeId: selectedCell.employeeId,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          title: shiftData.title,
          notes: shiftData.notes || '',
          location: shiftData.location || '',
          color: shiftData.color
        };
        
        return {
          sourceShift,
          targetEmployeeId: selectedCell.employeeId,
          targetEmployeeName: employeeName,
          targetDate,
          existingShifts
        };
      });
      
      return { results, conflictsToQueue };
    },
    onSuccess: ({ results, conflictsToQueue }) => {
      // ⭐ OPTIMIZACIÓN: Invalidar solo la semana actual
      invalidateCurrentWeekShifts();
      refetchShifts();
      
      // Cerrar modal de nuevo turno
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
      
      // Si hay conflictos, encolarlos y mostrar el primero
      if (conflictsToQueue.length > 0) {
        const [firstConflict, ...remainingConflicts] = conflictsToQueue;
        setPendingConflicts(remainingConflicts);
        setConflictData(firstConflict);
        setShowConflictModal(true);
      }
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error?.message || 'No se pudieron crear los turnos'
      });
    },
  });

  // Mutation para eliminar todos los turnos de la semana de un empleado
  const deleteWeekShiftsMutation = useMutation({
    mutationFn: async ({ employeeId, weekStart }: { employeeId: number; weekStart: Date }) => {
      // Obtener todos los turnos del empleado en esa semana
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
      
      const employeeShifts = workShifts.filter(shift => 
        shift.employeeId === employeeId &&
        weekDays.some(day => format(parseISO(shift.startAt), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd'))
      );

      // Eliminar todos los turnos de la semana
      const deletePromises = employeeShifts.map(shift => 
        apiRequest('DELETE', `/api/work-shifts/${shift.id}`)
      );
      
      return Promise.all(deletePromises);
    },
    onSuccess: () => {
      // ⭐ OPTIMIZACIÓN: Invalidar solo la semana actual
      invalidateCurrentWeekShifts();
      refetchShifts();
      toast({
        title: 'Turnos eliminados',
        description: 'Los turnos de la semana se han eliminado'
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error?.message || 'No se pudieron eliminar los turnos'
      });
    },
  });

  // Mutation para duplicar semana actual a la siguiente
  const duplicateWeekMutation = useMutation({
    mutationFn: async ({ employeeId, currentWeekStart }: { employeeId: number; currentWeekStart: Date }) => {
      // Calcular semana siguiente
      const nextWeekStart = addWeeks(currentWeekStart, 1);
      const nextWeekEnd = endOfWeek(nextWeekStart, { weekStartsOn: 1 });
      
      // Obtener turnos de la semana actual
      const currentWeekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
      const currentWeekDays = eachDayOfInterval({ start: currentWeekStart, end: currentWeekEnd });
      
      const currentWeekShifts = workShifts.filter(shift => 
        shift.employeeId === employeeId &&
        currentWeekDays.some(day => format(parseISO(shift.startAt), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd'))
      );

      if (currentWeekShifts.length === 0) {
        throw new Error('No hay turnos en la semana actual para duplicar');
      }

      // Eliminar turnos existentes en la semana siguiente
      const nextWeekDays = eachDayOfInterval({ start: nextWeekStart, end: nextWeekEnd });
      const nextWeekShifts = workShifts.filter(shift => 
        shift.employeeId === employeeId &&
        nextWeekDays.some(day => format(parseISO(shift.startAt), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd'))
      );

      const deletePromises = nextWeekShifts.map(shift => 
        apiRequest('DELETE', `/api/work-shifts/${shift.id}`)
      );
      
      if (deletePromises.length > 0) {
        await Promise.all(deletePromises);
      }

      // Duplicar turnos de la semana actual a la siguiente
      const createPromises = currentWeekShifts.map(shift => {
        const originalStart = parseISO(shift.startAt);
        const originalEnd = parseISO(shift.endAt);
        
        // Calcular la nueva fecha (misma hora, semana siguiente)
        const daysDiff = differenceInDays(originalStart, currentWeekStart);
        const newStart = addDays(nextWeekStart, daysDiff);
        const newEnd = addDays(newStart, differenceInDays(originalEnd, originalStart));
        
        newStart.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0);
        newEnd.setHours(originalEnd.getHours(), originalEnd.getMinutes(), 0, 0);

        return apiRequest('POST', '/api/work-shifts', {
          employeeId: shift.employeeId,
          startAt: newStart.toISOString(),
          endAt: newEnd.toISOString(),
          title: shift.title,
          location: shift.location || '',
          notes: shift.notes || '',
          color: shift.color
        });
      });
      
      return Promise.all(createPromises);
    },
    onSuccess: () => {
      // ⭐ OPTIMIZACIÓN: Invalidar solo la semana actual
      invalidateCurrentWeekShifts();
      refetchShifts();
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error?.message || 'No se pudo duplicar la semana'
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
  const [deletingShiftId, setDeletingShiftId] = useState<number | null>(null);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [viewMode, setViewMode] = useState<'day' | 'workweek' | 'week'>('week');
  const [boardMode, setBoardMode] = useState<'employees-by-days' | 'events-by-employees'>('employees-by-days');
  
  // Forzar vista día en móvil excepto en la vista de eventos, que siempre es semanal
  useEffect(() => {
    const checkMobile = () => {
      if (boardMode === 'events-by-employees') {
        setViewMode('week');
        return;
      }

      if (window.innerWidth < 640) {
        setViewMode('day');
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [boardMode]);

  useEffect(() => {
    if (boardMode === 'events-by-employees' && viewMode !== 'week') {
      setViewMode('week');
    }
  }, [boardMode, viewMode]);
  
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
  const [showTemplateBar, setShowTemplateBar] = useState(false);
  const templatesScrollRef = useRef<HTMLDivElement | null>(null);
   const [showTemplateDialog, setShowTemplateDialog] = useState(false);
   const [templateBeingEdited, setTemplateBeingEdited] = useState<any>(null);
   const [templateBeingCreated, setTemplateBeingCreated] = useState<{
     title: string;
     startTime: string;
     endTime: string;
     color: string;
     location?: string;
     notes?: string;
   } | null>(null);
   
   // Nombres de días para UI
   const dayNames = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

   // Query para cargar plantillas de la BD
   const { data: userTemplates = [], isLoading: isLoadingTemplates } = useQuery({
     queryKey: ['/api/shift-templates'],
     queryFn: () => apiRequest('GET', '/api/shift-templates'),
     enabled: !hasNoAccess,
     staleTime: 5 * 60 * 1000,
     gcTime: 15 * 60 * 1000,
     refetchOnMount: false,
     refetchOnWindowFocus: false,
   });

   // Mutation para crear plantilla
   const createTemplateMutation = useMutation({
     mutationFn: (template: any) => apiRequest('POST', '/api/shift-templates', template),
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['/api/shift-templates'] });
       toast({ title: 'Plantilla creada', description: 'La plantilla se ha guardado correctamente' });
     },
     onError: (error: any) => {
       toast({ title: 'Error', description: error.message, variant: 'destructive' });
     },
   });

   // Mutation para actualizar plantilla
   const updateTemplateMutation = useMutation({
     mutationFn: ({ id, ...data }: any) => apiRequest('PUT', `/api/shift-templates/${id}`, data),
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['/api/shift-templates'] });
       toast({ title: 'Plantilla actualizada', description: 'Los cambios se han guardado correctamente' });
     },
     onError: (error: any) => {
       toast({ title: 'Error', description: error.message, variant: 'destructive' });
     },
   });

   // Mutation para eliminar plantilla
   const deleteTemplateMutation = useMutation({
     mutationFn: (id: number) => apiRequest('DELETE', `/api/shift-templates/${id}`),
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['/api/shift-templates'] });
       toast({ title: 'Plantilla eliminada', description: 'La plantilla se ha eliminado correctamente' });
     },
     onError: (error: any) => {
       toast({ title: 'Error', description: error.message, variant: 'destructive' });
     },
   });

   // Mutation para reordenar plantillas
   const reorderTemplatesMutation = useMutation({
     mutationFn: (templates: Array<{ id: number; displayOrder: number }>) => 
       apiRequest('PUT', '/api/shift-templates/reorder', { templates }),
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['/api/shift-templates'] });
     },
     onError: (error: any) => {
       toast({ title: 'Error al reordenar', description: error.message, variant: 'destructive' });
     },
   });

   // Helpers para compatibilidad con código existente
   const addTemplate = (template: any) => {
     createTemplateMutation.mutate(template);
   };

   const deleteTemplate = (templateId: string | number) => {
     deleteTemplateMutation.mutate(typeof templateId === 'string' ? Number(templateId) : templateId);
   };

   const updateTemplate = (updatedTemplate: any) => {
     updateTemplateMutation.mutate(updatedTemplate);
   };

   const saveTemplates = (templates: any[]) => {
     // Actualizar el orden de visualización
     const templatesWithOrder = templates.map((t, index) => ({
       id: t.id,
       displayOrder: index,
     }));
     reorderTemplatesMutation.mutate(templatesWithOrder);
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

  // Estados para autocompletado de direcciones (Photon API)
  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [loadingLocationSuggestions, setLoadingLocationSuggestions] = useState(false);
  const [locationSearchTimeout, setLocationSearchTimeout] = useState<number | null>(null);
  
  // Coordenadas para links exactos de Google Maps
  const [newShiftCoords, setNewShiftCoords] = useState<{lat: number, lng: number} | null>(null);
  const [editShiftCoords, setEditShiftCoords] = useState<{lat: number, lng: number} | null>(null);

  // Estados y configuración para drag & drop
  const [activeShift, setActiveShift] = useState<WorkShift | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<ShiftTemplate | null>(null);
  const [activeEmployeeDrag, setActiveEmployeeDrag] = useState<Employee | null>(null);
  const [dragOverCellId, setDragOverCellId] = useState<string | null>(null);
  const [dragAnchor, setDragAnchor] = useState<{
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  
  // Estados para el modal de conflictos
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [isOverriding, setIsOverriding] = useState(false);
  const [isAdapting, setIsAdapting] = useState(false);
  const [conflictData, setConflictData] = useState<{
    sourceShift: WorkShift;
    targetEmployeeId: number;
    targetEmployeeName: string;
    targetDate: Date;
    existingShifts: WorkShift[];
  } | null>(null);
  
  // Cola de conflictos pendientes para creación multi-día
  const [pendingConflicts, setPendingConflicts] = useState<Array<{
    sourceShift: WorkShift;
    targetEmployeeId: number;
    targetEmployeeName: string;
    targetDate: Date;
    existingShifts: WorkShift[];
  }>>([]);
  
  // Estados para diálogos de confirmación de acciones de semana
  const [showDeleteWeekConfirm, setShowDeleteWeekConfirm] = useState(false);
  const [showDuplicateWeekConfirm, setShowDuplicateWeekConfirm] = useState(false);
  const [weekActionEmployee, setWeekActionEmployee] = useState<Employee | null>(null);
  
  // Configurar sensors para drag & drop con soporte móvil mejorado
  // IMPORTANTE: Touch sensor con delay más largo para evitar conflicto con scroll
  const sensors = useSensors(
    // Mouse/trackpad support - activación rápida con distancia mínima
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10, // 10px threshold para evitar drags accidentales
      },
    }),
    
    // Touch support for mobile/tablet devices
    // Delay largo para distinguir entre scroll y drag (long press)
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 400, // 400ms long press para iniciar drag (evita conflicto con scroll)
        tolerance: 5, // Solo 5px de tolerancia durante el delay (más estricto)
      },
    }),
    
    // Keyboard support for accessibility
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handlers para eventos de drag & drop
  // IMPORTANTE: Deshabilitar scroll del body durante el drag para evitar conflictos en móvil
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const dragData = active.data.current as any;
    const activatorEvent = event.activatorEvent as PointerEvent | MouseEvent | TouchEvent | undefined;
    const rect = active.rect?.current?.initial;
    if (rect && activatorEvent) {
      const clientX = 'touches' in activatorEvent ? activatorEvent.touches?.[0]?.clientX : (activatorEvent as MouseEvent).clientX;
      const clientY = 'touches' in activatorEvent ? activatorEvent.touches?.[0]?.clientY : (activatorEvent as MouseEvent).clientY;
      if (typeof clientX === 'number' && typeof clientY === 'number') {
        setDragAnchor({
          width: rect.width,
          height: rect.height,
          offsetX: clientX - rect.left,
          offsetY: clientY - rect.top,
        });
      }
    } else {
      setDragAnchor(null);
    }

    if (dragData?.type === 'employee-assignment') {
      setActiveShift(null);
      setActiveTemplate(null);
      setActiveEmployeeDrag(dragData.employee as Employee);
    } else if (dragData?.type === 'template') {
      setActiveShift(null);
      setActiveEmployeeDrag(null);
      setActiveTemplate(dragData.template as ShiftTemplate);
    } else {
      const shift = workShifts.find(s => s.id === Number(active.id));
      if (shift) {
        setActiveEmployeeDrag(null);
        setActiveTemplate(null);
        setActiveShift(shift);
      }
    }

    // Deshabilitar scroll del body durante el drag (crítico para móvil/tablet)
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setDragOverCellId(over ? String(over.id) : null);
  };

  // Handler para cancelación del drag (por ejemplo, al soltar fuera del área)
  const handleDragCancel = () => {
    setActiveShift(null);
    setActiveTemplate(null);
    setActiveEmployeeDrag(null);
    setDragOverCellId(null);
    setDragAnchor(null);
    // Restaurar scroll del body
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const dragData = active.data.current as any;
    const isTemplateDrag = dragData?.type === 'template';
    const isEmployeeDrag = dragData?.type === 'employee-assignment';
    const draggedTemplate = isTemplateDrag ? (dragData.template as ShiftTemplate) : null;
    const draggedEmployee = isEmployeeDrag ? (dragData.employee as Employee) : null;
    
    // Guardar referencia ANTES de resetear el estado
    const draggedShift = isTemplateDrag ? null : activeShift;
    
    setActiveShift(null);
    setActiveTemplate(null);
    setActiveEmployeeDrag(null);
    setDragOverCellId(null);
    setDragAnchor(null);
    
    // Restaurar scroll del body después del drag
    document.body.style.overflow = '';
    document.body.style.touchAction = '';

    if (!over || (!draggedShift && !draggedTemplate && !draggedEmployee)) return;

    if (draggedEmployee && String(over.id).startsWith('event-cell-')) {
      const eventCellParts = String(over.id).split('-');
      const templateId = Number(eventCellParts[2]);
      const employeeId = Number(eventCellParts[3]);

      if (!templateId || !employeeId) return;

      const eventGroup = groupedWeeklyEvents.find((item) => item.representativeShiftId === templateId);
      if (!eventGroup) return;

      const firstAvailableDay = filteredDays.find((day) => {
        if (isEmployeeOnVacation(employeeId, day)) return false;
        return !hasTimeConflict(employeeId, day, eventGroup.startTime, eventGroup.endTime);
      });

      if (!firstAvailableDay) {
        toast({
          title: 'Sin hueco disponible',
          description: 'No hay días disponibles en la semana para este evento y empleado.',
          variant: 'destructive',
        });
        return;
      }

      const targetDate = firstAvailableDay;
      const vacation = isEmployeeOnVacation(employeeId, targetDate);
      if (vacation) {
        toast({
          title: 'No disponible',
          description: 'El empleado está de vacaciones en esa fecha.',
          variant: 'destructive',
        });
        return;
      }

      const [startHour, startMinute] = eventGroup.startTime.split(':').map(Number);
      const [endHour, endMinute] = eventGroup.endTime.split(':').map(Number);

      const startAt = new Date(targetDate);
      startAt.setHours(startHour, startMinute, 0, 0);

      const endAt = new Date(targetDate);
      endAt.setHours(endHour, endMinute, 0, 0);
      if (endAt <= startAt) {
        endAt.setDate(endAt.getDate() + 1);
      }

      if (hasTimeConflict(employeeId, targetDate, eventGroup.startTime, eventGroup.endTime)) {
        toast({
          title: 'Conflicto de horario',
          description: 'Ya existe un turno que se solapa para este empleado.',
          variant: 'destructive',
        });
        return;
      }

      try {
        await apiRequest('POST', '/api/work-shifts', {
          employeeId,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          title: eventGroup.title,
          location: eventGroup.location || '',
          notes: eventGroup.notes || '',
          color: eventGroup.color,
        });
        invalidateCurrentWeekShifts();
      } catch {
        toast({
          title: 'Error al asignar',
          description: 'No se pudo crear el turno desde el evento.',
          variant: 'destructive',
        });
      }
      return;
    }

    // Handle template reordering (plantilla a plantilla)
    if (isTemplateDrag && String(over.id).startsWith('template-')) {
      const activeId = String(active.id);
      const overId = String(over.id);
      
      if (activeId !== overId) {
        const oldIndex = userTemplates.findIndex((t: ShiftTemplate) => t.id === Number(activeId));
        const newIndex = userTemplates.findIndex((t: ShiftTemplate) => t.id === Number(overId));
        
        if (oldIndex !== -1 && newIndex !== -1) {
          const reorderedTemplates = arrayMove(userTemplates, oldIndex, newIndex);
          saveTemplates(reorderedTemplates);
        }
      }
      return;
    }

    // Verificar si se dropea sobre la zona de plantillas para crear una plantilla
    // IMPORTANTE: Solo se puede crear plantilla desde un shift, NO desde otra plantilla
    if (String(over.id) === 'templates-drop-zone' && draggedShift && !isTemplateDrag) {
      // Crear plantilla automáticamente sin mostrar diálogo
      const startTime = format(parseISO(draggedShift.startAt), 'HH:mm');
      const endTime = format(parseISO(draggedShift.endAt), 'HH:mm');
      
      const newTemplateData = {
        title: draggedShift.title,
        startTime,
        endTime,
        color: draggedShift.color,
        location: draggedShift.location || '',
        notes: draggedShift.notes || '',
        displayOrder: userTemplates.length,
      };
      
      createTemplateMutation.mutate(newTemplateData);
      return;
    }

    // Prevenir que se intente crear plantilla desde otra plantilla
    if (String(over.id) === 'templates-drop-zone' && isTemplateDrag) {
      // Simply cancel the action without showing toast
      setDragAnchor(null);
      return;
    }

    // Continuar con lógica de drop en empleados (shift a empleado o template a empleado)
    if (!String(over.id).startsWith('cell-')) return;

    // Parse drop target (format: "cell-employeeId-yyyy-MM-dd")
    const parts = String(over.id).split('-');
    const prefix = parts[0];
    const employeeIdStr = parts[1];
    const dateStr = parts.slice(2).join('-');
    
    if (prefix !== 'cell') return;

    const targetEmployeeId = Number(employeeIdStr);
    const targetDate = parseISO(dateStr);
    
    if (draggedShift) {
      // Check if it's the same cell where the shift was picked up
      const isDropOnSameCell = targetEmployeeId === draggedShift.employeeId && 
          format(targetDate, 'yyyy-MM-dd') === format(parseISO(draggedShift.startAt), 'yyyy-MM-dd');
      
      if (isDropOnSameCell) {
        // Simply cancel the action without showing toast
        return;
      }
    }

    // ⚠️ PROTECTED - DO NOT MODIFY - Validation Logic
    // Critical drop validation system that prevents data conflicts
    
    // 1. Validate target employee exists and is active
    const targetEmployee = getEmployeeById(targetEmployeeId);
    if (!targetEmployee) return;
    // Los empleados ya están filtrados por status === 'active' en la query

    // 2. Validate employee is not on vacation
    const vacation = isEmployeeOnVacation(targetEmployeeId, targetDate);
    if (vacation) return;

    // Duplicar desde plantilla reutilizable
    if (draggedTemplate) {
      const [startHour, startMinute] = draggedTemplate.startTime.split(':').map(Number);
      const [endHour, endMinute] = draggedTemplate.endTime.split(':').map(Number);

      const newStart = new Date(targetDate);
      newStart.setHours(startHour, startMinute, 0, 0);

      const newEnd = new Date(targetDate);
      newEnd.setHours(endHour, endMinute, 0, 0);
      if (newEnd <= newStart) {
        newEnd.setDate(newEnd.getDate() + 1);
      }

      // Check for real time conflicts (overlapping hours) on the same day
      const existingShifts = getShiftsForEmployee(targetEmployeeId);
      const targetDateStr = format(targetDate, 'yyyy-MM-dd');
      
      // Helper function to check if two shifts have overlapping times
      const hasTimeConflictOverlap = (shift: WorkShift, newStart: Date, newEnd: Date): boolean => {
        const shiftStart = parseISO(shift.startAt);
        const shiftEnd = parseISO(shift.endAt);
        
        // Check if times overlap: (start1 < end2) && (start2 < end1)
        return shiftStart < newEnd && newStart < shiftEnd;
      };
      
      // Find shifts with actual time conflicts
      const conflictingShifts = existingShifts.filter((shift: WorkShift) => {
        const shiftStart = parseISO(shift.startAt);
        const shiftEnd = parseISO(shift.endAt);
        const shiftStartDateStr = format(shiftStart, 'yyyy-MM-dd');
        const shiftEndDateStr = format(shiftEnd, 'yyyy-MM-dd');
        
        // Check if the shift overlaps with the target date
        const shiftOverlapsTargetDate = shiftStartDateStr === targetDateStr || shiftEndDateStr === targetDateStr;
        
        return shiftOverlapsTargetDate && hasTimeConflictOverlap(shift, newStart, newEnd);
      });

      // If there are time conflicts, show confirmation modal
      if (conflictingShifts.length > 0) {
        // Create a pseudo-shift from template to show in conflict modal
        const pseudoShift: WorkShift = {
          id: -1,
          employeeId: targetEmployeeId,
          startAt: newStart.toISOString(),
          endAt: newEnd.toISOString(),
          title: draggedTemplate.title,
          location: draggedTemplate.location || '',
          notes: draggedTemplate.notes || '',
          color: draggedTemplate.color,
        };
        
        setConflictData({
          sourceShift: pseudoShift,
          targetEmployeeId,
          targetEmployeeName: targetEmployee.fullName,
          targetDate,
          existingShifts: conflictingShifts
        });
        setShowConflictModal(true);
        return;
      }

      const tempId = -Date.now();
      const optimisticShift: WorkShift = {
        id: tempId,
        employeeId: targetEmployeeId,
        startAt: newStart.toISOString(),
        endAt: newEnd.toISOString(),
        title: draggedTemplate.title,
        location: draggedTemplate.location || '',
        notes: draggedTemplate.notes || '',
        color: draggedTemplate.color,
      };

      const currentQueryKey = ['/api/work-shifts/company', format(weekRange.start, 'yyyy-MM-dd'), format(weekRange.end, 'yyyy-MM-dd')];
      queryClient.setQueryData(currentQueryKey, (oldData: any) => {
        if (!oldData) return oldData;
        if (oldData.shifts) {
          return {
            ...oldData,
            shifts: [...oldData.shifts, optimisticShift]
          };
        }
        if (Array.isArray(oldData)) {
          return [...oldData, optimisticShift];
        }
        return oldData;
      });

      createShiftFromTemplate(draggedTemplate, targetEmployeeId, newStart, newEnd, tempId, currentQueryKey);
      return;
    }

    // 3. Check for real time conflicts (overlapping hours) on the same day
    const existingShifts = getShiftsForEmployee(targetEmployeeId);
    const targetDateStr = format(targetDate, 'yyyy-MM-dd');
    
    // Helper function to check if two shifts have overlapping times
    const hasTimeConflictOverlap = (shift1: WorkShift, shift2Start: Date, shift2End: Date): boolean => {
      const shift1Start = parseISO(shift1.startAt);
      const shift1End = parseISO(shift1.endAt);
      
      // Check if times overlap: (start1 < end2) && (start2 < end1)
      return shift1Start < shift2End && shift2Start < shift1End;
    };
    
    // Calculate the new shift's start and end times
    if (!draggedShift) return;
    const originalStart = parseISO(draggedShift.startAt);
    const originalEnd = parseISO(draggedShift.endAt);
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
      if (shift.id === draggedShift.id) return false;
      
      const shiftStart = parseISO(shift.startAt);
      const shiftEnd = parseISO(shift.endAt);
      const shiftStartDateStr = format(shiftStart, 'yyyy-MM-dd');
      const shiftEndDateStr = format(shiftEnd, 'yyyy-MM-dd');
      
      // Check if the shift overlaps with the target date
      const shiftOverlapsTargetDate = shiftStartDateStr === targetDateStr || shiftEndDateStr === targetDateStr;
      
      return shiftOverlapsTargetDate && hasTimeConflictOverlap(shift, newStart, newEnd);
    });
    

    // If there are time conflicts, show confirmation modal
    if (conflictingShifts.length > 0) {
      setConflictData({
        sourceShift: draggedShift,
        targetEmployeeId,
        targetEmployeeName: targetEmployee.fullName,
        targetDate,
        existingShifts: conflictingShifts
      });
      setShowConflictModal(true);
      return;
    }

    // All validations passed - proceed with INSTANT optimistic duplication
    // (reusing newStart/newEnd already calculated above for conflict check)

    // IMMEDIATELY add optimistic shift to UI (before API call)
    const tempId = -Date.now();
    const optimisticShift: WorkShift = {
      id: tempId,
      employeeId: targetEmployeeId,
      startAt: newStart.toISOString(),
      endAt: newEnd.toISOString(),
      title: draggedShift.title,
      location: draggedShift.location || '',
      notes: draggedShift.notes || '',
      color: draggedShift.color,
    };

    // Instantly update cache - shift appears immediately!
    // Use predicate to match the correct queryKey (includes dates)
    const currentQueryKey = ['/api/work-shifts/company', format(weekRange.start, 'yyyy-MM-dd'), format(weekRange.end, 'yyyy-MM-dd')];
    queryClient.setQueryData(currentQueryKey, (oldData: any) => {
      if (!oldData) return oldData;
      // Handle { shifts: [...] } structure
      if (oldData.shifts) {
        return {
          ...oldData,
          shifts: [...oldData.shifts, optimisticShift]
        };
      }
      // Handle array structure
      if (Array.isArray(oldData)) {
        return [...oldData, optimisticShift];
      }
      return oldData;
    });

    // Step 3: Fire API call in background (no await = non-blocking)
    duplicateShiftAsync(draggedShift, targetEmployeeId, targetDate, tempId, currentQueryKey);
  };

  // Async function that runs in background after optimistic update
  const duplicateShiftAsync = async (originalShift: WorkShift, newEmployeeId: number, newDate: Date, tempId: number, queryKey: any[]) => {
    const originalStart = parseISO(originalShift.startAt);
    const originalEnd = parseISO(originalShift.endAt);
    
    const newStart = new Date(newDate);
    newStart.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0);
    
    const newEnd = new Date(newDate);
    newEnd.setHours(originalEnd.getHours(), originalEnd.getMinutes(), 0, 0);
    
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

    try {
      await apiRequest('POST', '/api/work-shifts', duplicateData);
      // Success - refresh to get real ID from server
      // ⭐ OPTIMIZACIÓN: Invalidar solo la semana actual
      invalidateCurrentWeekShifts();
    } catch (error) {
      // Error - remove optimistic shift from cache
      queryClient.setQueryData(queryKey, (oldData: any) => {
        if (!oldData) return oldData;
        // Handle { shifts: [...] } structure
        if (oldData.shifts) {
          return {
            ...oldData,
            shifts: oldData.shifts.filter((s: WorkShift) => s.id !== tempId)
          };
        }
        // Handle array structure
        if (Array.isArray(oldData)) {
          return oldData.filter((s: WorkShift) => s.id !== tempId);
        }
        return oldData;
      });
      toast({
        title: "Error al duplicar turno",
        description: "No se pudo guardar el turno. Inténtalo de nuevo.",
        variant: "destructive",
      });
    }
  };

  const createShiftFromTemplate = async (
    template: ShiftTemplate,
    employeeId: number,
    startAtDate: Date,
    endAtDate: Date,
    tempId: number,
    queryKey: any[],
  ) => {
    const payload = {
      employeeId,
      startAt: startAtDate.toISOString(),
      endAt: endAtDate.toISOString(),
      title: template.title,
      location: template.location || '',
      notes: template.notes || '',
      color: template.color,
    };

    try {
      await apiRequest('POST', '/api/work-shifts', payload);
      // ⭐ OPTIMIZACIÓN: Invalidar solo la semana actual
      invalidateCurrentWeekShifts();
    } catch (error) {
      queryClient.setQueryData(queryKey, (oldData: any) => {
        if (!oldData) return oldData;
        if (oldData.shifts) {
          return {
            ...oldData,
            shifts: oldData.shifts.filter((s: WorkShift) => s.id !== tempId)
          };
        }
        if (Array.isArray(oldData)) {
          return oldData.filter((s: WorkShift) => s.id !== tempId);
        }
        return oldData;
      });

      toast({
        title: 'Error al crear turno',
        description: 'No se pudo aplicar la plantilla. Inténtalo de nuevo.',
        variant: 'destructive',
      });
    }
  };

  // Funciones para autocompletado de direcciones con Photon API (via backend proxy)
  const searchLocation = async (query: string) => {
    if (!query || query.length < 3) {
      setLocationSuggestions([]);
      setShowLocationSuggestions(false);
      return;
    }

    // Clear previous timeout
    if (locationSearchTimeout) {
      clearTimeout(locationSearchTimeout);
    }

    // Debounce search (500ms)
    const timeout = window.setTimeout(async () => {
      try {
        setLoadingLocationSuggestions(true);
        // Use backend proxy to avoid CORS issues
        const response = await fetch(
          `/api/geocoding/search?q=${encodeURIComponent(query)}`
        );
        
        if (!response.ok) throw new Error('Failed to fetch locations');
        
        const data = await response.json();
        setLocationSuggestions(data.features || []);
        setShowLocationSuggestions(data.features && data.features.length > 0);
      } catch (error) {
        console.error('Location search error:', error);
        setLocationSuggestions([]);
        setShowLocationSuggestions(false);
      } finally {
        setLoadingLocationSuggestions(false);
      }
    }, 500);

    setLocationSearchTimeout(timeout);
  };

  const selectLocation = (feature: any, isEditMode: boolean = false) => {
    const props = feature.properties;
    // Build formatted address
    const parts = [];
    if (props.name) parts.push(props.name);
    if (props.street) parts.push(props.street);
    if (props.housenumber) parts[parts.length - 1] += ` ${props.housenumber}`;
    if (props.city) parts.push(props.city);
    if (props.country) parts.push(props.country);
    
    const address = parts.join(', ') || props.name || 'Ubicación seleccionada';
    
    // Extract coordinates from Photon API response (format: [lng, lat])
    const coords = feature.geometry?.coordinates;
    const locationCoords = coords ? { lat: coords[1], lng: coords[0] } : null;
    
    if (isEditMode) {
      setEditShift(prev => ({ ...prev, location: address }));
      setEditShiftCoords(locationCoords);
    } else {
      setNewShift(prev => ({ ...prev, location: address }));
      setNewShiftCoords(locationCoords);
    }
    
    setLocationSuggestions([]);
    setShowLocationSuggestions(false);
  };

  const getGoogleMapsLink = (address: string, coords?: {lat: number, lng: number} | null) => {
    // If we have exact coordinates, use them for a precise location
    if (coords) {
      return `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`;
    }
    // Otherwise, fall back to text search
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  };

  // Funciones para manejar el modal de conflictos
  const handleConfirmOverride = async () => {
    if (!conflictData || isOverriding) return;

    setIsOverriding(true);
    try {
      // First, delete existing conflicting shifts
      for (const shift of conflictData.existingShifts) {
        try {
          await apiRequest('DELETE', `/api/work-shifts/${shift.id}`);
          // ⭐ OPTIMIZACIÓN: Invalidate cache immediately after each deletion (solo la semana actual)
          invalidateCurrentWeekShifts();
        } catch (error: any) {
          // If shift is already deleted (404), continue
          if (error.status === 404) {
            console.warn(`Shift ${shift.id} already deleted, skipping...`);
            continue;
          }
          throw error; // Re-throw other errors
        }
      }
      
      // Wait a moment for cache to update
      await new Promise(resolve => setTimeout(resolve, 100));

      // Then duplicate the original shift with instant optimistic update
      const shift = conflictData.sourceShift;
      const targetEmpId = conflictData.targetEmployeeId;
      const targetDt = conflictData.targetDate;
      
      // Calculate times for optimistic shift
      const origStart = parseISO(shift.startAt);
      const origEnd = parseISO(shift.endAt);
      const optStart = new Date(targetDt);
      optStart.setHours(origStart.getHours(), origStart.getMinutes(), 0, 0);
      const optEnd = new Date(targetDt);
      optEnd.setHours(origEnd.getHours(), origEnd.getMinutes(), 0, 0);
      if (origEnd < origStart) {
        optEnd.setDate(optEnd.getDate() + 1);
      }
      
      // Optimistic update - show shift immediately
      const tempId = -Date.now();
      const optimisticShift: WorkShift = {
        id: tempId,
        employeeId: targetEmpId,
        startAt: optStart.toISOString(),
        endAt: optEnd.toISOString(),
        title: shift.title,
        location: shift.location || '',
        notes: shift.notes || '',
        color: shift.color,
      };
      
      queryClient.setQueryData(['/api/work-shifts/company'], (oldData: any) => {
        if (!oldData?.data) return oldData;
        return { ...oldData, data: [...oldData.data, optimisticShift] };
      });
      
      // Fire API call in background (non-blocking)
      duplicateShiftAsync(shift, targetEmpId, targetDt, tempId, ['/api/work-shifts/company']);
      
      // Procesar siguiente conflicto de la cola
      processNextConflict();
    } catch (error: any) {
    } finally {
      setIsOverriding(false);
    }
  };

  // Función para procesar el siguiente conflicto de la cola
  const processNextConflict = () => {
    if (pendingConflicts.length > 0) {
      const [nextConflict, ...remaining] = pendingConflicts;
      setPendingConflicts(remaining);
      setConflictData(nextConflict);
      // El modal ya está abierto, solo actualizamos el conflicto
    } else {
      setShowConflictModal(false);
      setConflictData(null);
    }
  };

  const handleCancelConflict = () => {
    // Cancelar este conflicto y procesar el siguiente
    processNextConflict();
  };

  // Interfaz para turnos adaptados
  interface AdaptedShiftResult {
    toCreate: Array<{
      id?: number;
      employeeId: number;
      startAt: string;
      endAt: string;
      title: string;
      location?: string;
      notes?: string;
      color: string;
      isNew?: boolean;
    }>;
    toDelete: number[];
    toUpdate: Array<{
      id: number;
      startAt: string;
      endAt: string;
    }>;
  }

  // Calcular cómo adaptar turnos existentes para acomodar el nuevo
  const calculateAdaptedShifts = (): AdaptedShiftResult | null => {
    if (!conflictData) return null;

    const newShift = conflictData.sourceShift;
    const targetDate = conflictData.targetDate;
    
    // Calcular tiempos del nuevo turno
    const origStart = parseISO(newShift.startAt);
    const origEnd = parseISO(newShift.endAt);
    const newStart = new Date(targetDate);
    newStart.setHours(origStart.getHours(), origStart.getMinutes(), 0, 0);
    const newEnd = new Date(targetDate);
    newEnd.setHours(origEnd.getHours(), origEnd.getMinutes(), 0, 0);
    if (origEnd < origStart) {
      newEnd.setDate(newEnd.getDate() + 1);
    }

    const result: AdaptedShiftResult = {
      toCreate: [],
      toDelete: [],
      toUpdate: []
    };

    // Siempre crear el nuevo turno
    result.toCreate.push({
      employeeId: conflictData.targetEmployeeId,
      startAt: newStart.toISOString(),
      endAt: newEnd.toISOString(),
      title: newShift.title,
      location: newShift.location,
      notes: newShift.notes,
      color: newShift.color,
      isNew: true
    });

    // Para cada turno existente, calcular cómo adaptarlo
    for (const existingShift of conflictData.existingShifts) {
      const existStart = parseISO(existingShift.startAt);
      const existEnd = parseISO(existingShift.endAt);

      // Verificar solapamiento
      const overlaps = existStart < newEnd && newStart < existEnd;
      
      if (!overlaps) {
        // Sin solapamiento, mantener turno como está
        continue;
      }

      // Caso 1: El nuevo turno cubre completamente el existente
      if (newStart <= existStart && newEnd >= existEnd) {
        result.toDelete.push(existingShift.id);
        continue;
      }

      // Caso 2: El existente empieza antes y termina durante/después del nuevo
      // Resultado: recortar el existente para que termine cuando empieza el nuevo
      if (existStart < newStart && existEnd > newStart) {
        const durationMinutes = (newStart.getTime() - existStart.getTime()) / (1000 * 60);
        
        if (durationMinutes >= MIN_SHIFT_DURATION_MINUTES) {
          // Mantener la primera parte del turno existente
          result.toUpdate.push({
            id: existingShift.id,
            startAt: existStart.toISOString(),
            endAt: newStart.toISOString()
          });
          
          // Si el existente también termina después del nuevo, crear turno para la parte final
          if (existEnd > newEnd) {
            const finalDuration = (existEnd.getTime() - newEnd.getTime()) / (1000 * 60);
            if (finalDuration >= MIN_SHIFT_DURATION_MINUTES) {
              result.toCreate.push({
                employeeId: existingShift.employeeId,
                startAt: newEnd.toISOString(),
                endAt: existEnd.toISOString(),
                title: existingShift.title,
                location: existingShift.location,
                notes: existingShift.notes,
                color: existingShift.color
              });
            }
          }
        } else {
          // Duración muy corta, eliminar
          result.toDelete.push(existingShift.id);
          
          // Pero si hay parte después del nuevo turno, crearla
          if (existEnd > newEnd) {
            const finalDuration = (existEnd.getTime() - newEnd.getTime()) / (1000 * 60);
            if (finalDuration >= MIN_SHIFT_DURATION_MINUTES) {
              result.toCreate.push({
                employeeId: existingShift.employeeId,
                startAt: newEnd.toISOString(),
                endAt: existEnd.toISOString(),
                title: existingShift.title,
                location: existingShift.location,
                notes: existingShift.notes,
                color: existingShift.color
              });
            }
          }
        }
        continue;
      }

      // Caso 3: El existente empieza durante el nuevo y termina después
      if (existStart >= newStart && existStart < newEnd && existEnd > newEnd) {
        const durationMinutes = (existEnd.getTime() - newEnd.getTime()) / (1000 * 60);
        
        if (durationMinutes >= MIN_SHIFT_DURATION_MINUTES) {
          // Actualizar para que empiece cuando termina el nuevo
          result.toUpdate.push({
            id: existingShift.id,
            startAt: newEnd.toISOString(),
            endAt: existEnd.toISOString()
          });
        } else {
          result.toDelete.push(existingShift.id);
        }
        continue;
      }

      // Caso 4: El nuevo turno está en medio del existente (el existente es más largo por ambos lados)
      if (existStart < newStart && existEnd > newEnd) {
        const beforeDuration = (newStart.getTime() - existStart.getTime()) / (1000 * 60);
        const afterDuration = (existEnd.getTime() - newEnd.getTime()) / (1000 * 60);

        if (beforeDuration >= MIN_SHIFT_DURATION_MINUTES) {
          // Actualizar el existente para que termine cuando empieza el nuevo
          result.toUpdate.push({
            id: existingShift.id,
            startAt: existStart.toISOString(),
            endAt: newStart.toISOString()
          });
        } else {
          result.toDelete.push(existingShift.id);
        }

        if (afterDuration >= MIN_SHIFT_DURATION_MINUTES) {
          // Crear nuevo turno para la parte después
          result.toCreate.push({
            employeeId: existingShift.employeeId,
            startAt: newEnd.toISOString(),
            endAt: existEnd.toISOString(),
            title: existingShift.title,
            location: existingShift.location,
            notes: existingShift.notes,
            color: existingShift.color
          });
        }
        continue;
      }
    }

    return result;
  };

  // Handler para adaptar turnos existentes
  const handleConfirmAdapt = async () => {
    if (!conflictData || isAdapting) return;

    const adaptedResult = calculateAdaptedShifts();
    if (!adaptedResult) return;

    setIsAdapting(true);
    try {
      // 1. Eliminar turnos que serán completamente reemplazados
      for (const shiftId of adaptedResult.toDelete) {
        try {
          await apiRequest('DELETE', `/api/work-shifts/${shiftId}`);
        } catch (error: any) {
          if (error.status !== 404) throw error;
        }
      }

      // 2. Actualizar turnos que serán recortados
      for (const update of adaptedResult.toUpdate) {
        await apiRequest('PATCH', `/api/work-shifts/${update.id}`, {
          startAt: update.startAt,
          endAt: update.endAt
        });
      }

      // 3. Crear nuevos turnos (incluyendo el turno duplicado y partes divididas)
      for (const newShift of adaptedResult.toCreate) {
        await apiRequest('POST', '/api/work-shifts', {
          employeeId: newShift.employeeId,
          startAt: newShift.startAt,
          endAt: newShift.endAt,
          title: newShift.title,
          location: newShift.location || '',
          notes: newShift.notes || '',
          color: newShift.color
        });
      }

      // ⭐ OPTIMIZACIÓN: Invalidar solo la semana actual
      invalidateCurrentWeekShifts();

      toast({
        title: 'Turnos adaptados',
        description: 'Los turnos se han ajustado correctamente'
      });

      // Procesar siguiente conflicto de la cola
      processNextConflict();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron adaptar los turnos'
      });
    } finally {
      setIsAdapting(false);
    }
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

  // Calcular horas semanales de un empleado
  const getWeeklyHours = (employeeId: number): { hours: number; minutes: number; formatted: string } => {
    const employeeShifts = getShiftsForEmployee(employeeId);
    const weekStart = startOfWeek(viewDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(viewDate, { weekStartsOn: 1 });
    
    let totalMinutes = 0;
    
    employeeShifts.forEach((shift: WorkShift) => {
      const shiftStart = parseISO(shift.startAt);
      const shiftEnd = parseISO(shift.endAt);
      
      // Solo contar turnos de la semana actual
      if (shiftStart >= weekStart && shiftStart <= weekEnd) {
        const diffMs = shiftEnd.getTime() - shiftStart.getTime();
        totalMinutes += diffMs / (1000 * 60);
      }
    });
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);
    
    return {
      hours,
      minutes,
      formatted: minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
    };
  };

  // Función para obtener el estilo de la celda según el estado
  const getCellStyle = (employeeId: number, date: Date): string => {
    const holiday = isHoliday(date);
    const vacation = isEmployeeOnVacation(employeeId, date);
    
    let baseStyle = "relative rounded-xl overflow-hidden min-h-[60px]"; // Sin borde, altura compacta, radio iOS
    
    if (holiday) {
      // Día festivo - fondo rojo suave
      baseStyle += " bg-red-100 dark:bg-red-900/30";
    } else if (vacation) {
      // Empleado de vacaciones - fondo azul suave
      baseStyle += " bg-blue-100 dark:bg-blue-900/30";
    } else {
      // Día normal - fondo más oscuro como las cards interiores
      baseStyle += " bg-white dark:bg-gray-900";
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
          <Plane className="w-5 h-5 text-blue-600 dark:text-blue-400" />
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
    staleTime: 5 * 60 * 1000, // ⚡ Cache for 5 minutes - employees don't change often
    select: (data: Employee[]) => data?.filter((emp: Employee) => emp.status === 'active') || [],
  });

  const { data: teams = [] } = useTeams(true);
  const [teamFilter, setTeamFilter] = useState('all');

  const visibleEmployees = useMemo(() => {
    if (teamFilter === 'all') return employees;
    const teamId = parseInt(teamFilter, 10);
    if (!Number.isInteger(teamId)) return employees;
    const memberIds = new Set(resolveTeamMemberIds(teams, teamId));
    return employees.filter((employee) => memberIds.has(employee.id));
  }, [employees, teamFilter, teams]);

  const { data: workShifts = [], isLoading: loadingShifts, refetch: refetchShifts } = useQuery<WorkShift[]>({
    queryKey: ['/api/work-shifts/company', format(weekRange.start, 'yyyy-MM-dd'), format(weekRange.end, 'yyyy-MM-dd')],
    enabled: !!weekRange.start && !!weekRange.end,
    staleTime: 10 * 60 * 1000, // ⭐ Cache válido por 10 minutos (una semana rara vez cambia tan rápido)
    gcTime: 7 * 24 * 60 * 60 * 1000, // ⭐ Guardar en caché 7 días (permite navegar sin refetch)
    select: (data: any) => {
      // Handle both old array format and new { shifts, accessMode } format
      return Array.isArray(data) ? data : (data?.shifts || []);
    },
  });

  // Usar solo plantillas creadas por el usuario (del localStorage)

  const scrollTemplates = (direction: 'left' | 'right') => {
    const container = templatesScrollRef.current;
    if (!container) return;

    const amount = container.clientWidth * 0.7;
    container.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  // Query para obtener solicitudes de vacaciones aprobadas
  const { data: vacationRequests = [] } = useQuery<VacationRequest[]>({
    queryKey: ['/api/vacation-requests/company'],
    staleTime: 60 * 60 * 1000, // ⭐ Cache 1 hora (vacaciones no cambian cada minuto)
    gcTime: 7 * 24 * 60 * 60 * 1000, // ⭐ Guardar 7 días
    select: (data: any) => {
      // Handle both old array format and new { requests, accessMode } format
      const requests = Array.isArray(data) ? data : (data?.requests || []);
      return requests?.filter((req: VacationRequest) => req.status === 'approved') || [];
    },
  });

  // Query para obtener días festivos
  const { data: holidays = [] } = useQuery<Holiday[]>({
    queryKey: ['/api/holidays/custom'],
    staleTime: 60 * 60 * 1000, // ⭐ Cache 1 hora (festivos no cambian frecuentemente)
    gcTime: 30 * 24 * 60 * 60 * 1000, // ⭐ Guardar 30 días
  });

  // ⭐ Helper para invalidar solo la semana actual (no todas las semanas cacheadas)
  const getShiftsQueryKey = (start?: Date, end?: Date) => [
    '/api/work-shifts/company',
    start ? format(start, 'yyyy-MM-dd') : format(weekRange.start, 'yyyy-MM-dd'),
    end ? format(end, 'yyyy-MM-dd') : format(weekRange.end, 'yyyy-MM-dd')
  ];

  const invalidateCurrentWeekShifts = () => {
    queryClient.invalidateQueries({ queryKey: getShiftsQueryKey() });
  };

  // ⚠️ OPTIMIZACIÓN: Memoizar filtros de días para evitar recálculos en cada renderizado
  const filteredDays = useMemo(() => {
    return viewMode === 'workweek' 
      ? weekRange.days.filter(day => day.getDay() >= 1 && day.getDay() <= 5)
      : weekRange.days;
  }, [weekRange.days, viewMode]);

  const groupedWeeklyEvents = useMemo(() => {
    const normalizeText = (value: string | undefined | null) =>
      (value || '').trim().toLowerCase().replace(/\s+/g, ' ');

    const groups = new Map<string, WeeklyEventGroup>();

    // ✅ FILTRAR: Solo turnos de esta semana visible
    const weekShifts = workShifts.filter((shift: WorkShift) => {
      const shiftStart = parseISO(shift.startAt);
      return shiftStart >= weekRange.start && shiftStart <= weekRange.end;
    });

    weekShifts.forEach((shift: WorkShift, index: number) => {
      const shiftStart = parseISO(shift.startAt);
      const shiftEnd = parseISO(shift.endAt);
      const key = [
        normalizeText(shift.title),
        format(shiftStart, 'HH:mm'),
        format(shiftEnd, 'HH:mm'),
        normalizeText(shift.location),
      ].join('||');

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          representativeShiftId: shift.id,
          title: shift.title,
          startTime: format(shiftStart, 'HH:mm'),
          endTime: format(shiftEnd, 'HH:mm'),
          location: shift.location,
          color: shift.color,
          notes: shift.notes,
          displayOrder: index,
        });
      }
    });

    return Array.from(groups.values()).sort((a, b) => a.displayOrder - b.displayOrder);
  }, [workShifts, weekRange]);

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
    const dayString = format(day, 'yyyy-MM-dd');
    
    // Detectar si esta celda es la celda de origen del turno que se está arrastrando
    const isOriginCell = activeShift && 
      activeShift.employeeId === employeeId && 
      format(parseISO(activeShift.startAt), 'yyyy-MM-dd') === dayString;
    const hasDrag = !!activeShift || !!activeTemplate;
    
    // No permitir drop en la celda de origen (no tiene sentido duplicar en el mismo sitio)
    // Pero permitir que se vea el indicador visual de "cancelar"
    const effectiveDisabled = isDisabled;
    
    const {
      isOver,
      setNodeRef
    } = useDroppable({
      id: cellId,
      disabled: effectiveDisabled
    });

    // Enhanced visual feedback based on drag state and validity
    const getDropStyles = () => {
      if (!hasDrag) return {};
      
      const isValidDrop = !effectiveDisabled;
      
      // Si es la celda de origen, mostrar indicador de "cancelar"
      if (isOriginCell && isOver) {
        return {
          backgroundColor: 'rgba(239, 68, 68, 0.15)', // red with opacity
          borderColor: 'rgb(239, 68, 68)', // red-500
          borderWidth: '2px',
          borderStyle: 'solid',
          boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.1)',
          transform: 'scale(0.98)',
          transition: 'all 0.2s ease'
        };
      }
      
      if (isOriginCell) return {};
      
      if (isOver) {
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
    const isValidDrop = !effectiveDisabled;
    const isDraggedOver = isOver;

    return (
      <div
        ref={setNodeRef}
        className={`${className} ${
          activeShift && !isOriginCell ? 
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
        title={activeShift && isDraggedOver && !isOriginCell ? 
          (isValidDrop ? 'Soltar aquí para duplicar el turno' : title) : 
          title
        }
      >
        {children}
        {/* Visual indicator for cancel when dragging over origin cell */}
        {activeShift && isOriginCell && isDraggedOver && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 1000 }}>
            <div className="bg-red-500 text-white px-2 py-1 rounded flex items-center justify-center shadow-md">
              <span className="text-xs font-semibold">✕ Cancelar</span>
            </div>
          </div>
        )}
        {/* Visual indicator for valid drop zones */}
        {activeShift && isDraggedOver && isValidDrop && !isOriginCell && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 1000 }}>
            <div className="bg-green-500 text-white px-3 py-1.5 rounded-lg flex items-center justify-center shadow-lg animate-pulse">
              <span className="text-xs font-semibold whitespace-nowrap">Duplicar turno aquí</span>
            </div>
          </div>
        )}
        {/* Visual indicator for invalid drop zones */}
        {activeShift && isDraggedOver && !isValidDrop && !isOriginCell && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg">
              <span className="text-sm font-bold">✕</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Plantilla arrastrable para la barra superior
  function TemplateBadge({ template, disabled = false, onEdit, onDelete }: { template: ShiftTemplate; disabled?: boolean; onEdit?: (template: ShiftTemplate) => void; onDelete?: (templateId: string) => void; }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging
    } = useSortable({
      id: template.id,
      data: { type: 'template', template },
      disabled,
    });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        onClick={() => !isDragging && onEdit && onEdit(template)}
        className={`group flex-none relative min-w-[170px] max-w-[220px] rounded-[7px] flex flex-col items-center justify-center text-white dark:text-gray-100 shadow-sm dark:shadow-md dark:ring-1 dark:ring-white/20 overflow-hidden px-2 py-1 select-none cursor-grab hover:opacity-90 dark:hover:opacity-80 hover:shadow-md active:cursor-grabbing transition-all duration-200`}
        style={{ backgroundColor: template.color, ...style }}
        title={`Click para editar | Arrastra para duplicar | ${template.title} • ${template.startTime}-${template.endTime}${template.location ? `\n📍 ${template.location}` : ''}${template.notes ? `\n📝 ${template.notes}` : ''}`}
      >
        <div className="text-[10px] md:text-[11px] font-semibold leading-tight text-center truncate w-full">{template.title}</div>
        <div className="text-[8px] md:text-[9px] opacity-90 leading-tight text-center truncate w-full mt-0.5">{template.startTime} - {template.endTime}</div>
        
        {template.location && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(template.location)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[7px] md:text-[8px] opacity-80 leading-tight text-center truncate w-full mt-0.5 flex items-center justify-center gap-0.5 hover:opacity-100 hover:underline"
            onClick={(e) => {
              e.stopPropagation();
            }}
            title={`Abrir en Google Maps: ${template.location}`}
          >
            <MapPin className="w-2 h-2 flex-shrink-0" />
            <span className="truncate">{template.location}</span>
          </a>
        )}
        
        {!disabled && !isDragging && (
          <button
            type="button"
            className="absolute top-0.5 right-0.5 w-4 h-4 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center bg-white/90 dark:bg-gray-800/90 rounded-full shadow-sm hover:bg-red-100 dark:hover:bg-red-900/50"
            style={{ zIndex: 1001 }}
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(String(template.id));
            }}
            title="Eliminar plantilla"
          >
            <X className="w-2.5 h-2.5 text-red-500 dark:text-red-400" />
          </button>
        )}
      </div>
    );
  }

  // Zona droppable para crear plantillas desde shifts
  function TemplatesDropZone({ userTemplates, deleteTemplate, isViewOnly, showTemplateBar, setShowTemplateBar, onEditTemplate }: { userTemplates: ShiftTemplate[]; deleteTemplate: (id: string) => void; isViewOnly: boolean; showTemplateBar: boolean; setShowTemplateBar: (value: boolean | ((prev: boolean) => boolean)) => void; onEditTemplate?: (template: ShiftTemplate) => void; }) {
    const { setNodeRef, isOver } = useDroppable({
      id: 'templates-drop-zone',
      disabled: isViewOnly // No permitir drop si estás en modo lectura
    });

    // Solo permitir drag de shifts, no de plantillas
    const canAcceptDrop = isOver && activeShift && !activeTemplate;
    const isInvalidDrop = isOver && activeTemplate;

    return (
      <Card 
        ref={setNodeRef}
        className={`bg-card border-border shadow-sm transition-all duration-200 relative ${
          canAcceptDrop 
            ? 'bg-blue-100/60 dark:bg-blue-900/30 border-2 border-dashed border-blue-400 dark:border-blue-500' 
            : isInvalidDrop
              ? 'bg-red-50/50 dark:bg-red-900/10 border-2 border-dashed border-red-400/50' 
              : ''
        }`}
      >
        {/* Indicador de cancelar cuando se arrastra una plantilla */}
        {isInvalidDrop && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 1000 }}>
            <div className="bg-red-500 text-white px-2 py-1 rounded flex items-center justify-center shadow-md">
              <span className="text-xs font-semibold">✕ Cancelar</span>
            </div>
          </div>
        )}
        
        {/* Indicador superpuesto cuando se arrastra un shift válido */}
        {canAcceptDrop && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 1000 }}>
            <div className="bg-blue-500 text-white px-2 py-1 rounded flex items-center justify-center shadow-md">
              <span className="text-xs font-semibold">✓ Crear plantilla</span>
            </div>
          </div>
        )}

        <CardContent className="p-0">
          <button
            type="button"
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/60 transition-colors"
            onClick={() => setShowTemplateBar((v) => !v)}
          >
            <div className="flex items-center gap-2 text-left">
              <Copy className="w-4 h-4 text-blue-500" />
              <div>
                <div className="text-sm font-semibold">Plantillas de turnos</div>
              </div>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-muted-foreground transition-transform ${showTemplateBar ? 'rotate-180' : ''}`}
            />
          </button>

          {showTemplateBar && (
            <div className="px-3 pb-3 space-y-2">
              <div className="flex gap-2 overflow-x-auto pb-2 px-1 scrollbar-thin scrollbar-thumb-muted/60">
          {/* Tarjeta para crear nueva plantilla */}
          {!isViewOnly && (
            <button
              type="button"
              onClick={() => {
                setTemplateBeingCreated({
                  title: '',
                  startTime: '09:00',
                  endTime: '17:00',
                  color: SHIFT_COLORS[0],
                  location: '',
                  notes: '',
                });
                setShowTemplateDialog(true);
              }}
              className="flex-none relative min-w-[170px] max-w-[220px] rounded-lg px-3 py-2 text-muted-foreground shadow-sm border-2 border-dashed border-muted-foreground/40 transition-all duration-200 select-none cursor-pointer hover:border-muted-foreground/70 hover:bg-muted/50 flex items-center justify-center"
              title="Crear nueva plantilla manualmente"
            >
              <div className="text-center">
                <div className="text-2xl mb-1">+</div>
                <div className="text-xs font-medium">Crea o arrastra un turno</div>
              </div>
            </button>
          )}

          {/* Plantillas existentes */}
          <SortableContext items={userTemplates.map(t => t.id)} strategy={horizontalListSortingStrategy}>
            {userTemplates.map((template) => (
              <TemplateBadge key={template.id} template={template} disabled={isViewOnly} onEdit={onEditTemplate} onDelete={deleteTemplate} />
            ))}
          </SortableContext>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Componente draggable para badges de turnos
  function DraggableBadge({ 
    shift, 
    shiftHours, 
    style, 
    onClick, 
    title, 
    className,
    onDelete,
    disabled = false,
    isDeleting = false
  }: {
    shift: WorkShift;
    shiftHours: string;
    style: React.CSSProperties;
    onClick: (e: React.MouseEvent) => void;
    title: string;
    className?: string;
    onDelete?: (shiftId: number) => void;
    disabled?: boolean;
    isDeleting?: boolean;
  }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      isDragging,
    } = useDraggable({
      id: shift.id,
      disabled: disabled,
    });

    // El original permanece normal mientras se arrastra - solo el DragOverlay muestra la copia
    const getDragStyles = (): React.CSSProperties => {
      return {
        transition: 'all 0.2s ease',
        cursor: 'grab',
        touchAction: 'none',
      };
    };

    const enhancedDragStyles = getDragStyles();

    return (
      <div
        ref={setNodeRef}
        data-id={shift.id}
        {...listeners}
        {...attributes}
        className={`group absolute rounded-[7px] flex flex-col items-center justify-center text-white dark:text-gray-100 shadow-sm dark:shadow-md dark:ring-1 dark:ring-white/20 overflow-hidden px-2 py-1 select-none cursor-grab hover:opacity-90 dark:hover:opacity-80 hover:shadow-md active:cursor-grabbing ${className || ''}`}
        style={{
          ...style,
          ...enhancedDragStyles,
          backgroundColor: shift.color || '#007AFF',
        }}
        onClick={(e) => {
          e.preventDefault();
          onClick(e);
        }}
        title={`${title} (Click para editar, arrastrar para duplicar)`}
      >
        {/* Diseño: nombre, hora, y ubicación (si existe) */}
        <div className="text-[10px] md:text-[11px] font-semibold leading-tight text-center truncate w-full">
          {shift.title}
        </div>
        <div className="text-[8px] md:text-[9px] opacity-90 leading-tight text-center truncate w-full mt-0.5">
          {shiftHours}
        </div>
        
        {/* Location - shown below hours as clickable link */}
        {shift.location && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shift.location)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[7px] md:text-[8px] opacity-80 leading-tight text-center truncate w-full mt-0.5 flex items-center justify-center gap-0.5 hover:opacity-100 hover:underline"
            onClick={(e) => {
              e.stopPropagation();
            }}
            title={`Abrir en Google Maps: ${shift.location}`}
          >
            <MapPin className="w-2 h-2 flex-shrink-0" />
            <span className="truncate">{shift.location}</span>
          </a>
        )}
        
        {/* Delete button - only visible on hover when not dragging */}
        {!isDragging && onDelete && !isDeleting && (
          <button
            type="button"
            className="absolute top-0.5 right-0.5 w-4 h-4 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center bg-white/90 dark:bg-gray-800/90 rounded-full shadow-sm hover:bg-red-100 dark:hover:bg-red-900/50"
            style={{ zIndex: 1001 }}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(shift.id);
            }}
            title="Eliminar turno"
          >
            <X className="w-2.5 h-2.5 text-red-500 dark:text-red-400" />
          </button>
        )}
        
        {/* Overlay de eliminación - centrado sobre el turno */}
        {isDeleting && (
          <div 
            className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-[7px]"
            style={{ zIndex: 1002 }}
          >
            <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 px-2 py-1 rounded-md shadow-lg">
              <Loader2 className="w-3 h-3 text-red-500 animate-spin" />
              <span className="text-[9px] font-medium text-gray-700 dark:text-gray-200">Eliminando</span>
            </div>
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
    
    // Detectar si estamos en móvil (menos de 640px)
    const isMobile = window.innerWidth < 640;
    
    // MODO DÍA: Timeline cronológico horizontal en desktop, vertical en móvil
    if (viewMode === 'day' && !isMobile) {
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
        <div className="absolute inset-0">
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
              onDelete={isViewOnly ? undefined : (shiftId) => deleteShiftMutation.mutate(shiftId)}
              disabled={isViewOnly}
              isDeleting={deletingShiftId === shift.id}
            />
          ))}
        </div>
      );
    }
    
    // MODO DÍA MÓVIL: Layout vertical como modo semana
    if (viewMode === 'day' && isMobile) {
      // Usar la misma lógica vertical que el modo semana
      const shiftLanes = assignShiftLanes(dayShifts);
      const totalVisible = dayShifts.length;
      const MARGIN = 4; // Margen exterior
      const GAP = 3; // Gap entre badges
      const totalGaps = totalVisible > 1 ? (totalVisible - 1) * GAP : 0;
      
      return (
        <>
          {/* Renderizar todos los turnos verticalmente */}
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
                  left: `${MARGIN}px`,
                  right: `${MARGIN}px`,
                  top: index === 0 
                    ? `${MARGIN}px` 
                    : `calc(${MARGIN}px + ${index} * ((100% - ${MARGIN * 2 + totalGaps}px) / ${totalVisible} + ${GAP}px))`,
                  height: `calc((100% - ${MARGIN * 2 + totalGaps}px) / ${totalVisible})`,
                  zIndex: 10,
                  boxSizing: 'border-box'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedShift(shift);
                  setShowShiftModal(true);
                }}
                title={`${shift.title}\n${shiftHours}${shift.location ? `\n📍 ${shift.location}` : ''}${shift.notes ? `\n📝 ${shift.notes}` : ''}`}
                onDelete={isViewOnly ? undefined : (shiftId) => deleteShiftMutation.mutate(shiftId)}
                disabled={isViewOnly}
                isDeleting={deletingShiftId === shift.id}
              />
            );
          })}
        </>
      );
    }
    
    // MODO SEMANA: Sistema de carriles verticales (actual)
    // Assign lanes to prevent overlapping
    const shiftLanes = assignShiftLanes(dayShifts);
    
    // Configuración para modo semana: mostrar todos los badges
    const totalVisible = dayShifts.length;
    const MARGIN = 4; // Margen exterior (arriba/abajo/izquierda/derecha)
    const GAP = 3; // Gap entre badges cuando hay múltiples
    const totalGaps = totalVisible > 1 ? (totalVisible - 1) * GAP : 0;
    
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
                left: `${MARGIN}px`,
                right: `${MARGIN}px`,
                top: index === 0 
                  ? `${MARGIN}px` 
                  : `calc(${MARGIN}px + ${index} * ((100% - ${MARGIN * 2 + totalGaps}px) / ${totalVisible} + ${GAP}px))`,
                height: `calc((100% - ${MARGIN * 2 + totalGaps}px) / ${totalVisible})`,
                zIndex: 10,
                boxSizing: 'border-box'
              }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedShift(shift);
                setShowShiftModal(true);
              }}
              title={`${shift.title}\n${shiftHours}${shift.location ? `\n📍 ${shift.location}` : ''}${shift.notes ? `\n📝 ${shift.notes}` : ''}`}
              onDelete={isViewOnly ? undefined : (shiftId) => deleteShiftMutation.mutate(shiftId)}
              disabled={isViewOnly}
              isDeleting={deletingShiftId === shift.id}
            />
          );
        })}
      </>
    );
  }, [workShifts, viewMode, getShiftsForEmployee, getGlobalTimelineBounds, assignShiftLanes, isViewOnly, deletingShiftId]);

  const getEventShiftForEmployeeOnDay = useCallback((eventGroup: WeeklyEventGroup, employeeId: number, day: Date) => {
    const dayKey = format(day, 'yyyy-MM-dd');
    const normalizeText = (value: string | undefined | null) =>
      (value || '').trim().toLowerCase().replace(/\s+/g, ' ');

    return workShifts.find((shift: WorkShift) => {
      if (shift.employeeId !== employeeId) return false;
      const shiftStart = parseISO(shift.startAt);
      const shiftEnd = parseISO(shift.endAt);
      const sameTitle = normalizeText(shift.title) === normalizeText(eventGroup.title);
      const sameLocation = normalizeText(shift.location) === normalizeText(eventGroup.location);
      const sameTimeWindow =
        format(shiftStart, 'HH:mm') === eventGroup.startTime &&
        format(shiftEnd, 'HH:mm') === eventGroup.endTime;

      return (
        format(shiftStart, 'yyyy-MM-dd') === dayKey &&
        sameTitle &&
        sameTimeWindow &&
        sameLocation
      );
    }) || null;
  }, [workShifts]);

  function EmployeeAssignmentChip({ employee }: { employee: Employee }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
      id: `assign-emp-${employee.id}`,
      disabled: isViewOnly,
      data: { type: 'employee-assignment', employee },
    });

    return (
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs border transition-all ${
          isViewOnly
            ? 'cursor-default bg-muted/50 text-muted-foreground border-border'
            : 'cursor-grab active:cursor-grabbing bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/35'
        }`}
        style={{
          transform: CSS.Transform.toString(transform),
          opacity: isDragging ? 0.5 : 1,
        }}
        title={isViewOnly ? 'Modo lectura' : 'Arrastra para asignar a un evento'}
      >
        <Users className="w-3 h-3" />
        <span>Asignar</span>
      </div>
    );
  }

  function WeeklyEventAssignmentCell({
    eventGroup,
    employee,
  }: {
    eventGroup: WeeklyEventGroup;
    employee: Employee;
  }) {
    const createShiftFromTemplate = async (day: Date) => {
      const [startHour, startMinute] = eventGroup.startTime.split(':').map(Number);
      const [endHour, endMinute] = eventGroup.endTime.split(':').map(Number);

      const startAt = new Date(day);
      startAt.setHours(startHour, startMinute, 0, 0);

      const endAt = new Date(day);
      endAt.setHours(endHour, endMinute, 0, 0);
      if (endAt <= startAt) {
        endAt.setDate(endAt.getDate() + 1);
      }

      if (hasTimeConflict(employee.id, day, eventGroup.startTime, eventGroup.endTime)) {
        toast({
          title: 'Conflicto de horario',
          description: 'Ya existe un turno que se solapa para este empleado.',
          variant: 'destructive',
        });
        return;
      }

      try {
        await apiRequest('POST', '/api/work-shifts', {
          employeeId: employee.id,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          title: eventGroup.title,
          location: eventGroup.location || '',
          notes: eventGroup.notes || '',
          color: eventGroup.color,
        });
        invalidateCurrentWeekShifts();
      } catch {
        toast({
          title: 'Error al crear',
          description: 'No se pudo crear el turno.',
          variant: 'destructive',
        });
      }
    };

    const matchingShiftsThisWeek = filteredDays
      .map((day) => {
        const shift = getEventShiftForEmployeeOnDay(eventGroup, employee.id, day);
        if (!shift) return null;
        return { day, shift };
      })
      .filter((item): item is { day: Date; shift: WorkShift } => item !== null);

    const cellId = `event-cell-${eventGroup.representativeShiftId}-${employee.id}`;
    const { setNodeRef, isOver } = useDroppable({ id: cellId, disabled: isViewOnly });

    return (
      <div
        ref={setNodeRef}
        className={`min-h-[140px] rounded-lg border p-2 text-[12px] transition-colors ${
          isOver
            ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
            : 'border-border bg-white dark:bg-gray-900'
        }`}
      >
        {matchingShiftsThisWeek.length > 0 ? (
          <div className="space-y-1.5">
            {matchingShiftsThisWeek.map(({ day, shift }) => (
              <div
                key={`event-line-${shift.id}`}
                className="rounded-md px-2 py-1 text-white relative"
                style={{ backgroundColor: shift.color || eventGroup.color }}
              >
                <div className="font-semibold capitalize">
                  {format(day, 'EEEE', { locale: es })} - {format(parseISO(shift.startAt), 'HH:mm')} a {format(parseISO(shift.endAt), 'HH:mm')}
                </div>
                {!isViewOnly && (
                  <button
                    type="button"
                    className="absolute top-1 right-1 w-4 h-4 rounded-full bg-white/90 text-red-600 flex items-center justify-center"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteShiftMutation.mutate(shift.id);
                    }}
                    title="Eliminar turno"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col items-start justify-center gap-2 text-muted-foreground">
            <span>Sin turnos de este evento</span>
            {!isViewOnly && (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:text-foreground"
                onClick={() => createShiftFromTemplate(filteredDays[0])}
                title="Asignar este evento (primer día de la semana visible)"
              >
                <Plus className="w-3 h-3" />
                Asignar
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // No subscription access = no access at all (moved after all hooks)
  if (hasNoAccess) {
    return (
      <FeatureRestrictedPage 
        featureName="Cuadrante de Horarios" 
        description="Gestiona los horarios y turnos de todos tus empleados. Activa este addon desde la Tienda para comenzar a usarlo." 
      />
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {visibleEmployees.length === 0 && !loadingEmployees ? (
        <div className="text-center py-8 text-muted-foreground">
          {teamFilter === 'all' ? 'No hay empleados registrados' : 'No hay empleados en el equipo seleccionado'}
        </div>
      ) : (
        <div className={`space-y-3 transition-opacity duration-300 ${loadingEmployees ? 'opacity-60' : 'opacity-100'}`}>
          {/* Card 1: Navegación del mes */}
          <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-4 py-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigateWeek('prev')}
                  className="h-auto w-auto p-0 hover:bg-transparent"
                  data-testid="button-prev-week"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                
                <h2 className="text-sm font-semibold text-foreground capitalize text-center">
                  {boardMode === 'events-by-employees'
                    ? `${format(weekRange.start, "d MMM", { locale: es })} - ${format(weekRange.end, "d MMM yyyy", { locale: es })}`
                    : format(weekRange.start, "MMMM yyyy", { locale: es })}
                </h2>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigateWeek('next')}
                  className="h-auto w-auto p-0 hover:bg-transparent"
                  data-testid="button-next-week"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="px-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 text-muted-foreground" />
                <Select value={teamFilter} onValueChange={setTeamFilter}>
                  <SelectTrigger className="w-full sm:w-[280px] h-9">
                    <SelectValue placeholder="Filtrar por equipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los equipos</SelectItem>
                    {teams.map((team) => (
                      <SelectItem key={`schedule-team-${team.id}`} value={team.id.toString()}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="hidden items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vista</span>
                <button
                  type="button"
                  className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                    boardMode === 'employees-by-days'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:text-foreground'
                  }`}
                  onClick={() => setBoardMode('employees-by-days')}
                >
                  Empleados x dias
                </button>
                <button
                  type="button"
                  className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                    boardMode === 'events-by-employees'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:text-foreground'
                  }`}
                  onClick={() => setBoardMode('events-by-employees')}
                >
                  Eventos x personas
                </button>
              </div>
            </div>
          </div>

          {boardMode === 'employees-by-days' ? (
            <div className={`grid gap-1 md:gap-4 px-3 ${viewMode === 'day' ? 'sm:grid-cols-[120px_minmax(0,1fr)] grid-cols-1' : viewMode === 'workweek' ? 'grid-cols-[120px_repeat(5,minmax(0,1fr))]' : 'grid-cols-[120px_repeat(7,minmax(0,1fr))]'}`}>
              <div className={`flex items-center justify-center ${viewMode === 'day' ? 'hidden sm:flex' : ''}`}>
                <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-1 relative hidden sm:block">
                  <div 
                    className="absolute top-1 bottom-1 bg-white dark:bg-gray-900 rounded-lg shadow-sm transition-all duration-300 ease-in-out border border-gray-200 dark:border-gray-700"
                    style={{
                      left: viewMode === 'day' ? '4px' : viewMode === 'workweek' ? 'calc(33.33% + 1px)' : 'calc(66.66% - 2px)',
                      width: 'calc(33.33% - 4px)'
                    }}
                  />
                  <div className="relative flex">
                    {(['day', 'workweek', 'week'] as const).map((mode) => {
                      const labels = { day: '1', workweek: '5', week: '7' };
                      return (
                        <button
                          type="button"
                          key={mode}
                          onClick={() => {
                            if (window.innerWidth >= 640 || mode === 'day' || mode === 'workweek') {
                              setViewMode(mode);
                            }
                          }}
                          className={`py-1.5 px-3 font-medium text-xs transition-colors duration-200 relative z-10 flex items-center justify-center ${
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

              {filteredDays.map((day, index) => {
                const isToday = format(new Date(), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                const abbrs = ['DOM','LUN','MAR','MIE','JUE','VIE','SAB'] as const;
                const abbr = abbrs[day.getDay()];
                const colorClass = isToday
                  ? 'text-blue-600 dark:text-blue-400'
                  : isWeekend
                    ? 'text-muted-foreground/70'
                    : 'text-muted-foreground';

                return (
                  <div key={index} className={`flex items-center justify-center py-1.5 px-3 rounded-lg border bg-card border-border dark:border-gray-700 dark:bg-gray-800/50 shadow-sm ${isToday ? 'ring-2 ring-blue-500/50' : ''}`}>
                    <span className={`text-sm font-semibold uppercase tracking-wide ${colorClass}`}>
                      {`${abbr} ${format(day, 'd')}`}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}

          {/* Barra superior de plantillas reutilizables */}
          <TemplatesDropZone 
            userTemplates={userTemplates} 
            deleteTemplate={deleteTemplate} 
            isViewOnly={isViewOnly}
            showTemplateBar={showTemplateBar}
            setShowTemplateBar={setShowTemplateBar}
            onEditTemplate={(template) => {
              setTemplateBeingEdited(template);
              setShowTemplateDialog(true);
            }}
          />

          {boardMode === 'events-by-employees' ? (
            <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
              {groupedWeeklyEvents.length === 0 ? (
                <Card className="bg-card border-border shadow-sm">
                  <CardContent className="py-10 text-center text-muted-foreground">
                    No hay eventos en la semana visible.
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-card border-border shadow-sm overflow-hidden">
                  <CardContent className="p-3 space-y-3 overflow-x-auto">
                    <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 min-w-max">
                      <div className="text-sm font-semibold text-foreground capitalize">
                        {format(weekRange.start, "d MMM", { locale: es })} - {format(weekRange.end, "d MMM yyyy", { locale: es })}
                      </div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wide">
                        {groupedWeeklyEvents.length} eventos reales x {visibleEmployees.length} personas
                      </div>
                    </div>

                    <div
                      className="grid gap-2 min-w-max"
                      style={{ gridTemplateColumns: `220px repeat(${visibleEmployees.length}, minmax(210px, 1fr))` }}
                    >
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center px-2">
                        Evento
                      </div>
                      {visibleEmployees.map((employee) => (
                        <div key={`event-col-${employee.id}`} className="rounded-md border border-border p-2 bg-muted/30">
                          <div className="flex items-center gap-2">
                            <UserAvatar
                              fullName={employee.fullName}
                              size="sm"
                              userId={employee.id}
                              profilePicture={employee.profilePicture}
                              className="w-6 h-6"
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-medium truncate">{employee.fullName}</div>
                              <div className="text-[11px] text-muted-foreground">{getWeeklyHours(employee.id).formatted}</div>
                            </div>
                          </div>
                          {!isViewOnly && (
                            <div className="mt-2">
                              <EmployeeAssignmentChip employee={employee} />
                            </div>
                          )}
                        </div>
                      ))}

                      {groupedWeeklyEvents.map((eventGroup) => (
                        <div key={`event-row-wrap-${eventGroup.key}`} className="contents">
                          <div className="rounded-md border border-border p-3 bg-white dark:bg-gray-900 flex flex-col justify-start gap-1">
                            <div className="text-sm font-semibold truncate" style={{ color: eventGroup.color }}>
                              {eventGroup.title}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {eventGroup.startTime} - {eventGroup.endTime}
                            </div>
                            {eventGroup.location ? (
                              <div className="text-[11px] text-muted-foreground truncate">📍 {eventGroup.location}</div>
                            ) : null}
                          </div>
                          {visibleEmployees.map((employee) => (
                            <WeeklyEventAssignmentCell
                              key={`event-cell-${eventGroup.key}-${employee.id}`}
                              eventGroup={eventGroup}
                              employee={employee}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
          <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
            {visibleEmployees.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Users className="w-12 h-12 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No hay empleados para este filtro</p>
              </div>
            ) : null}
            
            {/* Card por cada empleado */}
            {visibleEmployees.map((employee: Employee) => (
              <Card key={employee.id} className="bg-card border-border shadow-sm overflow-hidden">
                <CardContent className="p-0">
                  {viewMode === 'day' ? (
                      /* Layout móvil para modo día - Estructura vertical */
                      <div className="space-y-1 sm:hidden">
                        {/* Header del empleado en móvil */}
                        <div className="flex items-center gap-2 px-1">
                          <UserAvatar 
                            fullName={employee.fullName} 
                            size="sm" 
                            userId={employee.id}
                            profilePicture={employee.profilePicture}
                            className="w-8 h-8"
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-foreground">
                              {employee.fullName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(filteredDays[0], "EEEE, d 'de' MMMM", { locale: es })}
                            </div>
                          </div>
                        </div>
                        
                        {/* Timeline que ocupa todo el ancho - Layout vertical como modo semana */}
                        <div className="w-full">
                          {filteredDays.map((day, dayIndex) => {
                            const holiday = isHoliday(day);
                            const vacation = isEmployeeOnVacation(employee.id, day);
                            const isDisabled = !!vacation;
                            
                            return (
                              <DroppableCell
                                key={`${viewMode}-${format(weekRange.start, 'yyyy-MM-dd')}-${dayIndex}`}
                                employeeId={employee.id}
                                day={day}
                                isDisabled={isDisabled}
                                className={`${getCellStyle(employee.id, day)} flex flex-col w-full min-h-[120px] border border-border/30 relative ${
                                  !isDisabled ? 'hover:bg-gray-100 dark:hover:bg-gray-700/70 transition-colors' : 'cursor-not-allowed'
                                }${loadingShifts ? ` schedule-cell-wave schedule-cell-wave-${dayIndex}` : ''}`}
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
                                {/* Área principal de la celda - Layout vertical para badges */}
                                <div className="flex-1 relative overflow-hidden">
                                  {getCellContent(employee.id, day)}
                                  {renderShiftBar(employee, day)}
                                  
                                  {/* Botón "+" como badge - posicionado abajo a la derecha */}
                                  {!isViewOnly && !isDisabled && (
                                    <button
                                      type="button"
                                      className="absolute w-5 h-5 rounded-[5px] bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500 hover:text-gray-700 dark:hover:text-gray-100 transition-colors flex items-center justify-center text-xs font-medium shadow-sm"
                                      style={{ bottom: '4px', right: '4px' }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedCell({
                                          employeeId: employee.id,
                                          date: day,
                                          employeeName: employee.fullName
                                        });
                                        setShowNewShiftModal(true);
                                      }}
                                      title="Añadir turno"
                                      data-testid={`button-add-shift-${employee.id}-${format(day, 'yyyy-MM-dd')}`}
                                    >
                                      <Plus className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </DroppableCell>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                    
                    {/* Layout original para desktop o modos semana */}
                    <div className={`${viewMode === 'day' ? 'hidden sm:grid' : 'grid'} gap-2 items-stretch p-3 ${viewMode === 'day' ? 'grid-cols-[120px_minmax(0,1fr)]' : viewMode === 'workweek' ? 'grid-cols-[120px_repeat(5,minmax(0,1fr))]' : 'grid-cols-[120px_repeat(7,minmax(0,1fr))]'}`}>
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
                        
                        {/* Contador de horas semanales */}
                        {(viewMode === 'week' || viewMode === 'workweek') && (
                          <div className="text-[9px] md:text-[10px] text-muted-foreground font-medium flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {getWeeklyHours(employee.id).formatted}
                          </div>
                        )}
                        
                        {/* Iconos de acciones de semana - fijos debajo del nombre */}
                        {!isViewOnly && (viewMode === 'week' || viewMode === 'workweek') && (
                          <div className="flex items-center gap-1 mt-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setWeekActionEmployee(employee);
                                setShowDuplicateWeekConfirm(true);
                              }}
                              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                              title="Duplicar semana a la siguiente"
                              disabled={duplicateWeekMutation.isPending}
                            >
                              <Copy className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setWeekActionEmployee(employee);
                                setShowDeleteWeekConfirm(true);
                              }}
                              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                              title="Eliminar turnos de la semana"
                              disabled={deleteWeekShiftsMutation.isPending}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Columnas de días */}
                      {filteredDays.map((day, dayIndex) => {
                        const holiday = isHoliday(day);
                        const vacation = isEmployeeOnVacation(employee.id, day);
                        const isDisabled = !!vacation; // Solo las vacaciones deshabilitan la celda
                        
                        return (
                          <DroppableCell
                            key={`${viewMode}-${format(weekRange.start, 'yyyy-MM-dd')}-${dayIndex}`}
                            employeeId={employee.id}
                            day={day}
                            isDisabled={isDisabled}
                            className={`${getCellStyle(employee.id, day)} ${
                              viewMode === 'day' 
                                ? 'flex flex-row' // Modo día: layout horizontal 
                                : 'flex flex-col' // Modo semana: layout vertical
                            } ${!isDisabled ? 'hover:bg-gray-100 dark:hover:bg-gray-700/70 transition-colors' : 'cursor-not-allowed'}${loadingShifts ? ` schedule-cell-wave schedule-cell-wave-${dayIndex}` : ''}`}
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
                            <div className="group relative overflow-hidden flex-1">
                              {/* Contenido especial para festivos/vacaciones */}
                              {getCellContent(employee.id, day)}
                              {/* Timeline bars serán renderizadas aquí */}
                              {renderShiftBar(employee, day)}
                              
                              {/* Botón "+" - diferente según si hay turnos o no */}
                              {!isViewOnly && !isDisabled && (() => {
                                const dayShifts = getShiftsForEmployee(employee.id).filter(
                                  shift => format(parseISO(shift.startAt), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
                                );
                                const isEmpty = dayShifts.length === 0;
                                
                                return isEmpty ? (
                                  /* Celda vacía: "+" grande centrado */
                                  <button
                                    type="button"
                                    className="absolute inset-0 flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-gray-400 dark:hover:text-gray-500 transition-all opacity-0 group-hover:opacity-100"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedCell({
                                        employeeId: employee.id,
                                        date: day,
                                        employeeName: employee.fullName
                                      });
                                      setShowNewShiftModal(true);
                                    }}
                                    title="Añadir turno"
                                    data-testid={`button-add-shift-${employee.id}-${format(day, 'yyyy-MM-dd')}`}
                                  >
                                    <Plus className="w-8 h-8" />
                                  </button>
                                ) : (
                                  /* Celda con turnos: botón pequeño abajo centrado */
                                  <button
                                    type="button"
                                    className="absolute left-1/2 -translate-x-1/2 h-5 px-4 rounded-[5px] bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-700 transition-all flex items-center justify-center text-xs font-medium shadow-sm opacity-0 group-hover:opacity-100 z-20"
                                    style={{ bottom: '10px' }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedCell({
                                        employeeId: employee.id,
                                        date: day,
                                        employeeName: employee.fullName
                                      });
                                      setShowNewShiftModal(true);
                                    }}
                                    title="Añadir turno"
                                    data-testid={`button-add-shift-${employee.id}-${format(day, 'yyyy-MM-dd')}`}
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                );
                              })()}
                            </div>
                          </DroppableCell>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
        )}

      {/* Diálogo para crear/editar plantilla */}
      <Dialog open={showTemplateDialog} onOpenChange={(open) => {
        setShowTemplateDialog(open);
        if (!open) {
          setTemplateBeingEdited(null);
          setTemplateBeingCreated(null);
        }
      }}>
        <DialogContent className="max-w-lg p-0 gap-0 bg-background border-0 overflow-visible">
          {/* Header con preview del badge */}
          <div 
            className="px-6 py-4 text-white relative overflow-hidden rounded-t-lg"
            style={{ backgroundColor: templateBeingEdited?.color || templateBeingCreated?.color || SHIFT_COLORS[0] }}
          >
            <div className="absolute inset-0 bg-black/10" />
            <div className="relative z-10">
              <h3 className="text-lg font-semibold">
                {templateBeingEdited ? 'Editar plantilla' : 'Crear plantilla de turno'}
              </h3>
              <p className="text-sm opacity-90">
                {(templateBeingEdited?.startTime || templateBeingCreated?.startTime) && (templateBeingEdited?.endTime || templateBeingCreated?.endTime)
                  ? `${templateBeingEdited?.startTime || templateBeingCreated?.startTime} - ${templateBeingEdited?.endTime || templateBeingCreated?.endTime}`
                  : '09:00 - 17:00'
                }
              </p>
              <p className="text-xs opacity-75 mt-1">
                {templateBeingEdited ? 'Personaliza esta plantilla' : 'Esta plantilla se reutilizará en otros cuadrantes'}
              </p>
            </div>
          </div>

          <div className="flex">
            {/* Panel izquierdo - Colores verticales */}
            <div className="w-16 bg-muted/30 p-2 flex flex-col gap-1">
              {SHIFT_COLORS.map((color, index) => (
                <button
                  type="button"
                  key={color}
                  onClick={() => {
                    if (templateBeingEdited) {
                      setTemplateBeingEdited((prev: any) => prev ? { ...prev, color } : null);
                    } else {
                      setTemplateBeingCreated(prev => prev ? { ...prev, color } : null);
                    }
                  }}
                  className={`w-12 h-8 rounded border-2 transition-all hover:scale-105 ${
                    (templateBeingEdited?.color || templateBeingCreated?.color) === color
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
                value={templateBeingEdited?.title || templateBeingCreated?.title || ''}
                onChange={(e) => {
                  if (templateBeingEdited) {
                    setTemplateBeingEdited((prev: any) => prev ? { ...prev, title: e.target.value } : null);
                  } else {
                    setTemplateBeingCreated(prev => prev ? { ...prev, title: e.target.value } : null);
                  }
                }}
                placeholder="Nombre de la plantilla"
                className="w-full px-3 py-2 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              
              {/* Horas */}
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="time"
                  value={templateBeingEdited?.startTime || templateBeingCreated?.startTime || '09:00'}
                  onChange={(e) => {
                    if (templateBeingEdited) {
                      setTemplateBeingEdited((prev: any) => prev ? { ...prev, startTime: e.target.value } : null);
                    } else {
                      setTemplateBeingCreated(prev => prev ? { ...prev, startTime: e.target.value } : null);
                    }
                  }}
                  className="w-full px-3 py-2 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <input
                  type="time"
                  value={templateBeingEdited?.endTime || templateBeingCreated?.endTime || '17:00'}
                  onChange={(e) => {
                    if (templateBeingEdited) {
                      setTemplateBeingEdited((prev: any) => prev ? { ...prev, endTime: e.target.value } : null);
                    } else {
                      setTemplateBeingCreated(prev => prev ? { ...prev, endTime: e.target.value } : null);
                    }
                  }}
                  className="w-full px-3 py-2 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              
              {/* Ubicación */}
              <input
                type="text"
                value={templateBeingEdited?.location || templateBeingCreated?.location || ''}
                onChange={(e) => {
                  if (templateBeingEdited) {
                    setTemplateBeingEdited((prev: any) => prev ? { ...prev, location: e.target.value } : null);
                  } else {
                    setTemplateBeingCreated(prev => prev ? { ...prev, location: e.target.value } : null);
                  }
                }}
                placeholder="Ubicación (opcional)"
                className="w-full px-3 py-2 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              
              {/* Notas */}
              <textarea
                value={templateBeingEdited?.notes || templateBeingCreated?.notes || ''}
                onChange={(e) => {
                  if (templateBeingEdited) {
                    setTemplateBeingEdited((prev: any) => prev ? { ...prev, notes: e.target.value } : null);
                  } else {
                    setTemplateBeingCreated(prev => prev ? { ...prev, notes: e.target.value } : null);
                  }
                }}
                placeholder="Notas (opcional)"
                className="w-full px-3 py-2 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none max-h-20"
                rows={2}
              />
              
              {/* Botones */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowTemplateDialog(false);
                    setTemplateBeingEdited(null);
                    setTemplateBeingCreated(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-blue-500 hover:bg-blue-600"
                  onClick={() => {
                    if (templateBeingEdited) {
                      updateTemplate(templateBeingEdited);
                    } else if (templateBeingCreated) {
                      const newTemplateData = {
                        title: templateBeingCreated.title || 'Sin nombre',
                        startTime: templateBeingCreated.startTime,
                        endTime: templateBeingCreated.endTime,
                        color: templateBeingCreated.color,
                        location: templateBeingCreated.location || '',
                        notes: templateBeingCreated.notes || '',
                        displayOrder: userTemplates.length,
                      };
                      createTemplateMutation.mutate(newTemplateData);
                    }
                    setShowTemplateDialog(false);
                    setTemplateBeingEdited(null);
                    setTemplateBeingCreated(null);
                  }}
                >
                  {templateBeingEdited ? 'Actualizar plantilla' : 'Crear plantilla'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para nuevo turno - DISEÑO VISUAL TIPO BADGE */}
      <Dialog open={showNewShiftModal} onOpenChange={setShowNewShiftModal}>
        <DialogContent className="max-w-lg p-0 gap-0 bg-background border-0 overflow-visible">
          <DialogTitle className="sr-only">Crear nuevo turno</DialogTitle>
          {/* Header con preview del badge */}
          <div 
            className="px-6 py-4 text-white relative overflow-hidden rounded-t-lg"
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
                  type="button"
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
              
              {/* Ubicación con autocompletado */}
              <div className="relative">
                <MapPin className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                <input
                  type="text"
                  value={newShift.location}
                  onChange={(e) => {
                    setNewShift(prev => ({ ...prev, location: e.target.value }));
                    setNewShiftCoords(null); // Clear coords when typing manually
                    searchLocation(e.target.value);
                  }}
                  onFocus={() => newShift.location && searchLocation(newShift.location)}
                  onBlur={() => setTimeout(() => setShowLocationSuggestions(false), 200)}
                  placeholder="Dirección o ubicación (ej: Calle Gran Vía 1, Madrid)"
                  className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                
                {/* Sugerencias de autocompletado */}
                {showLocationSuggestions && locationSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {locationSuggestions.map((feature, idx) => {
                      const props = feature.properties;
                      const displayName = [props.name, props.city, props.country].filter(Boolean).join(', ');
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => selectLocation(feature, false)}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors border-b border-border last:border-0"
                        >
                          <div className="font-medium text-foreground">{props.name || props.city}</div>
                          {props.street && <div className="text-xs text-muted-foreground">{props.street} {props.housenumber || ''}</div>}
                          <div className="text-xs text-muted-foreground">{props.city}, {props.country}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
                
                {/* Link a Google Maps si hay dirección */}
                {newShift.location && !showLocationSuggestions && (
                  <a
                    href={getGoogleMapsLink(newShift.location, newShiftCoords)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 dark:text-blue-400 mt-1 pl-8 flex items-center gap-1 hover:underline"
                  >
                    🗺️ Abrir en Google Maps {newShiftCoords && '(ubicación exacta)'}
                  </a>
                )}
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
        <DialogContent className="max-w-lg p-0 gap-0 bg-background border-0 overflow-visible">
          <DialogTitle className="sr-only">Editar turno</DialogTitle>
          {/* Header con preview del badge */}
          <div 
            className="px-6 py-4 text-white relative overflow-hidden rounded-t-lg"
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
            {/* Panel izquierdo - Colores verticales (hidden in view-only mode) */}
            {!isViewOnly && (
              <div className="w-16 bg-muted/30 p-2 flex flex-col gap-1">
                {SHIFT_COLORS.map((color, index) => (
                  <button
                    type="button"
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
            )}

            {/* Panel derecho - Formulario compacto */}
            <div className="flex-1 p-4 space-y-3">
              {/* Título */}
              <input
                type="text"
                value={editShift.title}
                onChange={(e) => setEditShift(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Título del turno (ej: Mañana, Tarde, Noche)"
                className="w-full px-3 py-2 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed"
                disabled={isViewOnly}
              />
              
              {/* Horas */}
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="time"
                  value={editShift.startTime}
                  onChange={(e) => setEditShift(prev => ({ ...prev, startTime: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed"
                  disabled={isViewOnly}
                />
                <input
                  type="time"
                  value={editShift.endTime}
                  onChange={(e) => setEditShift(prev => ({ ...prev, endTime: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed"
                  disabled={isViewOnly}
                />
              </div>
              
              {/* Días de la semana - hidden in view-only mode */}
              {!isViewOnly && (
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
              )}
              
              {/* Ubicación con autocompletado */}
              <div>
                <div className="relative">
                  {editShift.location ? (
                    <a
                      href={getGoogleMapsLink(editShift.location, editShiftCoords)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute left-2 top-1/2 transform -translate-y-1/2 z-10 hover:scale-110 transition-transform"
                      title="Abrir en Google Maps"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MapPin className="h-4 w-4 text-blue-500 hover:text-blue-600" />
                    </a>
                  ) : (
                    <MapPin className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                  )}
                  <input
                    type="text"
                    value={editShift.location}
                    onChange={(e) => {
                      setEditShift(prev => ({ ...prev, location: e.target.value }));
                      setEditShiftCoords(null); // Clear coords when typing manually
                      searchLocation(e.target.value);
                    }}
                    onFocus={() => editShift.location && searchLocation(editShift.location)}
                    onBlur={() => setTimeout(() => setShowLocationSuggestions(false), 200)}
                    placeholder="Dirección o ubicación (ej: Calle Gran Vía 1, Madrid)"
                    className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed"
                    disabled={isViewOnly}
                  />
                </div>
                
                {/* Sugerencias de autocompletado */}
                {showLocationSuggestions && locationSuggestions.length > 0 && (
                  <div className="relative">
                    <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {locationSuggestions.map((feature, idx) => {
                        const props = feature.properties;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => selectLocation(feature, true)}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors border-b border-border last:border-0"
                          >
                            <div className="font-medium text-foreground">{props.name || props.city}</div>
                            {props.street && <div className="text-xs text-muted-foreground">{props.street} {props.housenumber || ''}</div>}
                            <div className="text-xs text-muted-foreground">{props.city}, {props.country}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Notas */}
              <textarea
                value={editShift.notes}
                onChange={(e) => setEditShift(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Notas (opcional)"
                rows={2}
                className="w-full px-3 py-2 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none disabled:opacity-70 disabled:cursor-not-allowed"
                disabled={isViewOnly}
              />
              
              {/* Botones */}
              <div className="flex justify-between items-center pt-2">
                {/* Delete button - hidden in view-only mode */}
                {!isViewOnly ? (
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
                ) : (
                  <div />
                )}
                
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setShowShiftModal(false);
                      setSelectedShift(null);
                    }}
                  >
                    {isViewOnly ? 'Cerrar' : 'Cancelar'}
                  </Button>
                  {/* Save button - hidden in view-only mode */}
                  {!isViewOnly && (
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
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de conflictos de turnos */}
      <Dialog open={showConflictModal} onOpenChange={setShowConflictModal}>
        <DialogContent className="max-w-md p-0 gap-0 bg-background border-0 overflow-hidden">
          <DialogTitle className="sr-only">Conflicto de turnos</DialogTitle>
          {/* Header */}
          <div className="px-6 py-4 bg-orange-500 text-white">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-lg font-semibold">Conflicto de turnos</h3>
            </div>
          </div>

          {/* Body */}
          <div className="p-6">
            <p className="text-sm text-muted-foreground mb-4 text-center">
              <strong>{conflictData?.targetEmployeeName}</strong> ya tiene {conflictData?.existingShifts.length} turno(s) el{' '}
              <strong>{conflictData?.targetDate && format(conflictData.targetDate, "EEEE d 'de' MMMM", { locale: es })}</strong>
            </p>

            {/* Simulaciones visuales en dos columnas */}
            {(() => {
              const adapted = calculateAdaptedShifts();
              if (!adapted) return null;

              // Obtener TODOS los turnos del empleado en ese día (no solo los que tienen conflicto)
              const dayString = format(conflictData!.targetDate, 'yyyy-MM-dd');
              const allEmployeeShiftsThisDay = workShifts.filter(shift => {
                if (shift.employeeId !== conflictData!.targetEmployeeId) return false;
                const shiftDate = format(parseISO(shift.startAt), 'yyyy-MM-dd');
                return shiftDate === dayString;
              });

              // Construir lista completa de turnos resultantes para "Adaptar"
              const allAdaptedShifts = [
                // Turnos nuevos creados (incluye el nuevo turno y fragmentos)
                ...adapted.toCreate.map(shift => ({
                  ...shift,
                  isCreated: true,
                  isUpdated: false,
                  isDeleted: false
                })),
                // Turnos existentes actualizados con nuevos horarios
                ...adapted.toUpdate.map(update => {
                  const original = conflictData!.existingShifts.find(s => s.id === update.id);
                  if (!original) return null;
                  return {
                    id: original.id,
                    employeeId: original.employeeId,
                    startAt: update.startAt,
                    endAt: update.endAt,
                    title: original.title,
                    location: original.location,
                    notes: original.notes,
                    color: original.color,
                    isCreated: false,
                    isUpdated: true,
                    isDeleted: false
                  };
                }).filter(Boolean),
                // Turnos que se eliminarán (mostrar en gris)
                ...adapted.toDelete.map(shiftId => {
                  const original = conflictData!.existingShifts.find(s => s.id === shiftId);
                  if (!original) return null;
                  return {
                    ...original,
                    isCreated: false,
                    isUpdated: false,
                    isDeleted: true
                  };
                }).filter(Boolean),
                // Turnos del día que NO tienen conflicto (se mantienen igual)
                ...allEmployeeShiftsThisDay
                  .filter(shift => !conflictData!.existingShifts.some(es => es.id === shift.id))
                  .map(shift => ({
                    ...shift,
                    isCreated: false,
                    isUpdated: false,
                    isDeleted: false
                  }))
              ];

              // Ordenar todos por hora de inicio
              allAdaptedShifts.sort((a, b) => {
                if (!a || !b) return 0;
                return parseISO(a.startAt).getTime() - parseISO(b.startAt).getTime();
              });

              logger.log('ADAPTAR preview shifts:', {
                total: allAdaptedShifts.length,
                created: allAdaptedShifts.filter((s: any) => s && s.isCreated).length,
                updated: allAdaptedShifts.filter((s: any) => s && s.isUpdated).length,
                unchanged: allAdaptedShifts.filter((s: any) => s && !s.isCreated && !s.isUpdated).length,
                shifts: allAdaptedShifts
              });

              // Componente reutilizable para renderizar turnos como en el cuadrante
              const renderShiftsPreview = (shifts: any[]) => {
                const totalVisible = shifts.length;
                const MARGIN = 4;
                const GAP = 3;
                const totalGaps = totalVisible > 1 ? (totalVisible - 1) * GAP : 0;

                return (
                  <div className="relative overflow-hidden flex-1 min-h-[180px] bg-white/50 dark:bg-black/20 rounded">
                    {shifts.map((shift, index) => {
                      const shiftStart = parseISO(shift.startAt);
                      const shiftEnd = parseISO(shift.endAt);
                      const startTime = format(shiftStart, 'HH:mm');
                      const endTime = format(shiftEnd, 'HH:mm');

                      return (
                        <div
                          key={`preview-${index}`}
                          className={`absolute group rounded-[7px] flex flex-col items-center justify-center text-white dark:text-gray-100 shadow-sm dark:shadow-md dark:ring-1 dark:ring-white/20 overflow-hidden px-2 py-1 select-none ${
                            shift.isDeleted ? 'opacity-40' : ''
                          }`}
                          style={{
                            backgroundColor: shift.color,
                            left: `${MARGIN}px`,
                            right: `${MARGIN}px`,
                            top: index === 0 
                              ? `${MARGIN}px` 
                              : `calc(${MARGIN}px + ${index} * ((100% - ${MARGIN * 2 + totalGaps}px) / ${totalVisible} + ${GAP}px))`,
                            height: `calc((100% - ${MARGIN * 2 + totalGaps}px) / ${totalVisible})`,
                            zIndex: 10,
                            boxSizing: 'border-box',
                            transition: '0.2s',
                            textDecoration: shift.isDeleted ? 'line-through' : 'none'
                          }}
                        >
                          <div className="text-[10px] md:text-[11px] font-semibold leading-tight text-center truncate w-full">
                            {shift.title}
                          </div>
                          <div className="text-[8px] md:text-[9px] opacity-90 leading-tight text-center truncate w-full mt-0.5">
                            {startTime}-{endTime}
                          </div>
                          {shift.location && (
                            <a 
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shift.location)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[7px] md:text-[8px] opacity-80 leading-tight text-center truncate w-full mt-0.5 flex items-center justify-center gap-0.5 hover:opacity-100 hover:underline"
                              title={`Abrir en Google Maps: ${shift.location}`}
                            >
                              <MapPin className="w-2 h-2 flex-shrink-0" />
                              <span className="truncate">{shift.location}</span>
                            </a>
                          )}
                          {(shift.isCreated || shift.isUpdated) && (
                            <div className="absolute inset-0 rounded-[7px] pointer-events-none"
                              style={{
                                boxShadow: shift.isUpdated 
                                  ? '0 0 0 2px rgb(251, 146, 60), 0 0 0 4px rgb(255, 255, 255)' 
                                  : '0 0 0 2px rgb(59, 130, 246), 0 0 0 4px rgb(255, 255, 255)'
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              };

              // Verificar si ADAPTAR tiene sentido: debe haber cambios significativos
              // Solo mostrar ADAPTAR si:
              // 1. Hay turnos que se recortan (toUpdate.length > 0)
              // 2. O hay fragmentos creados además del turno nuevo (toCreate.length > 1)
              const hasAdaptChanges = adapted.toUpdate.length > 0 || adapted.toCreate.length > 1;

              return (
                <div className={`${hasAdaptChanges ? 'grid grid-cols-2' : 'grid grid-cols-1'} gap-3 mb-4`}>
                  {/* Opción 1: ADAPTAR - Solo mostrar si tiene sentido */}
                  {hasAdaptChanges && (
                  <button
                    type="button"
                    onClick={handleConfirmAdapt}
                    disabled={isAdapting || isOverriding}
                    className="flex flex-col border-2 border-green-500 dark:border-green-600 rounded-lg overflow-hidden hover:border-green-600 dark:hover:border-green-500 transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {/* Badges de turnos */}
                    <div className="bg-green-50 dark:bg-green-900/20 p-3 flex-1 min-h-[200px] flex flex-col">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm">🔄</span>
                        <span className="font-semibold text-sm text-green-700 dark:text-green-400">Adaptar</span>
                      </div>
                      
                      {/* Preview de turnos como en cuadrante */}
                      {renderShiftsPreview(allAdaptedShifts)}

                      {/* Info adicional */}
                      {adapted.toDelete.length > 0 && (
                        <div className="mt-2 text-xs text-red-500 dark:text-red-400 text-center">
                          ⚠️ {adapted.toDelete.length} turno(s) eliminado(s) por duración insuficiente
                        </div>
                      )}
                    </div>

                    {/* Botón integrado */}
                    <div className="bg-green-600 hover:bg-green-700 text-white py-2 px-3 text-sm font-medium text-center transition-colors">
                      {isAdapting ? 'Adaptando...' : 'Seleccionar Adaptar'}
                    </div>
                  </button>
                  )}

                  {/* Opción 2: SOBRESCRIBIR */}
                  <button
                    type="button"
                    onClick={handleConfirmOverride}
                    disabled={isOverriding || isAdapting}
                    className="flex flex-col border-2 border-orange-500 dark:border-orange-600 rounded-lg overflow-hidden hover:border-orange-600 dark:hover:border-orange-500 transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {/* Badges de turnos */}
                    <div className="bg-orange-50 dark:bg-orange-900/20 p-3 flex-1 min-h-[200px] flex flex-col">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm">⚠️</span>
                        <span className="font-semibold text-sm text-orange-700 dark:text-orange-400">Sobrescribir</span>
                      </div>
                      
                      {/* Preview de turnos como en cuadrante */}
                      {(() => {
                        // Construir lista de turnos resultantes para "Sobrescribir"
                        const overrideShifts = [
                          // El nuevo turno que se añade
                          {
                            ...conflictData!.sourceShift,
                            isCreated: true,
                            isUpdated: false
                          },
                          // Turnos del día que NO tienen conflicto (no se eliminan)
                          ...allEmployeeShiftsThisDay
                            .filter(shift => !conflictData!.existingShifts.some(es => es.id === shift.id))
                            .map(shift => ({
                              ...shift,
                              isCreated: false,
                              isUpdated: false
                            }))
                        ];

                        // Ordenar todos por hora de inicio
                        overrideShifts.sort((a, b) => 
                          parseISO(a.startAt).getTime() - parseISO(b.startAt).getTime()
                        );

                        return renderShiftsPreview(overrideShifts);
                      })()}
                    </div>

                    {/* Botón integrado */}
                    <div className="bg-orange-500 hover:bg-orange-600 text-white py-2 px-3 text-sm font-medium text-center transition-colors">
                      {isOverriding ? 'Sobrescribiendo...' : 'Seleccionar Sobrescribir'}
                    </div>
                  </button>
                </div>
              );
            })()}

            {/* Botón Cancelar centrado */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelConflict}
              className="w-full"
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmación para eliminar turnos de la semana */}
      <AlertDialog open={showDeleteWeekConfirm} onOpenChange={setShowDeleteWeekConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              Eliminar turnos de la semana
            </AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres eliminar <strong>todos los turnos</strong> de{' '}
              <strong>{weekActionEmployee?.fullName}</strong> de esta semana?
              <br /><br />
              <span className="text-red-500">Esta acción no se puede deshacer.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setWeekActionEmployee(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={() => {
                if (weekActionEmployee) {
                  deleteWeekShiftsMutation.mutate({
                    employeeId: weekActionEmployee.id,
                    weekStart: weekRange.start
                  });
                }
                setShowDeleteWeekConfirm(false);
                setWeekActionEmployee(null);
              }}
            >
              {deleteWeekShiftsMutation.isPending ? 'Eliminando...' : 'Eliminar turnos'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de confirmación para duplicar semana */}
      <AlertDialog open={showDuplicateWeekConfirm} onOpenChange={setShowDuplicateWeekConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Copy className="w-5 h-5 text-blue-500" />
              Duplicar semana
            </AlertDialogTitle>
            <AlertDialogDescription>
              ¿Quieres copiar los turnos de <strong>{weekActionEmployee?.fullName}</strong> de esta semana 
              a la <strong>semana siguiente</strong>?
              <br /><br />
              <span className="text-amber-600">
                Nota: Los turnos existentes en la semana siguiente serán reemplazados.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setWeekActionEmployee(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-blue-500 hover:bg-blue-600"
              onClick={() => {
                if (weekActionEmployee) {
                  duplicateWeekMutation.mutate({
                    employeeId: weekActionEmployee.id,
                    currentWeekStart: weekRange.start
                  });
                }
                setShowDuplicateWeekConfirm(false);
                setWeekActionEmployee(null);
              }}
            >
              {duplicateWeekMutation.isPending ? 'Duplicando...' : 'Duplicar semana'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      </div>
      )}

      {/* DragOverlay - El elemento arrastrado flota por encima de todo */}
      <DragOverlay 
        dropAnimation={{
          duration: 200,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
          sideEffects: defaultDropAnimationSideEffects({
            styles: {
              active: {
                opacity: '0.5',
              },
            },
          }),
        }}
        style={{ cursor: 'grabbing' }}
        modifiers={[
          ({ transform, activeNodeRect }) => {
            const w = dragAnchor?.width ?? activeNodeRect?.width;
            const h = dragAnchor?.height ?? activeNodeRect?.height;
            if (!w || !h) return transform;
            const dx = (dragAnchor?.offsetX ?? w / 2) - w / 2;
            const dy = (dragAnchor?.offsetY ?? h / 2) - h / 2;
            return {
              ...transform,
              x: transform.x - dx,
              y: transform.y - dy,
            };
          },
        ]}
      >
        {activeShift ? (
          <div
            className="rounded-[7px] flex flex-col items-center justify-center text-white shadow-xl px-2 py-1.5 cursor-grabbing"
            style={{
              backgroundColor: activeShift.color || '#007AFF',
              transform: 'scale(1.05)',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
              border: '2px solid rgba(255, 255, 255, 0.8)',
              width: dragAnchor?.width,
              height: dragAnchor?.height,
            }}
          >
            <div className="text-[11px] font-semibold leading-tight text-center truncate">
              {activeShift.title}
            </div>
            <div className="text-[9px] opacity-90 leading-tight text-center truncate mt-0.5">
              {format(parseISO(activeShift.startAt), 'HH:mm')}-{format(parseISO(activeShift.endAt), 'HH:mm')}
            </div>
            <div className="absolute -top-2 -right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
              <Copy className="w-2.5 h-2.5 text-white" />
            </div>
          </div>
        ) : activeTemplate ? (
          <div
            className="rounded-[7px] flex flex-col items-center justify-center text-white shadow-xl px-2 py-1.5 cursor-grabbing"
            style={{
              backgroundColor: activeTemplate.color || '#007AFF',
              transform: 'scale(1.05)',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
              border: '2px solid rgba(255, 255, 255, 0.8)',
              width: dragAnchor?.width,
              height: dragAnchor?.height,
            }}
          >
            <div className="text-[11px] font-semibold leading-tight text-center truncate">
              {activeTemplate.title}
            </div>
            <div className="text-[9px] opacity-90 leading-tight text-center truncate mt-0.5">
              {activeTemplate.startTime}-{activeTemplate.endTime}
            </div>
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white text-[10px] font-semibold">
              T
            </div>
          </div>
        ) : activeEmployeeDrag ? (
          <div
            className="rounded-[7px] flex items-center gap-2 text-white shadow-xl px-3 py-2 cursor-grabbing"
            style={{
              backgroundColor: '#2563EB',
              transform: 'scale(1.05)',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
              border: '2px solid rgba(255, 255, 255, 0.8)',
            }}
          >
            <Users className="w-4 h-4" />
            <span className="text-xs font-semibold">{activeEmployeeDrag.fullName}</span>
            <span className="text-[10px] opacity-90">{getWeeklyHours(activeEmployeeDrag.id).formatted}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}