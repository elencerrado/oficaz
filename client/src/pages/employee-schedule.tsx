import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, ChevronLeft, ChevronRight, Clock, MapPin } from "lucide-react";
import { format, addDays, subDays, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";
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

export default function EmployeeSchedule() {
  const { user } = useAuth();
  const { setHeader, resetHeader } = usePageHeader();

  // Estado para la fecha actual (solo vista de día)
  const [currentDate, setCurrentDate] = useState(new Date());

  // Configurar header de página
  useEffect(() => {
    setHeader({
      title: 'Mi Cuadrante',
      subtitle: 'Consulta tus horarios y turnos asignados'
    });
    
    return () => resetHeader();
  }, [setHeader, resetHeader]);

  // Queries para datos
  const { data: shifts = [], isLoading: shiftsLoading, refetch: refetchShifts } = useQuery<WorkShift[]>({
    queryKey: ['/api/work-shifts/my-shifts'],
    queryFn: async () => {
      return await apiRequest('GET', '/api/work-shifts/my-shifts');
    },
    enabled: !!user,
    staleTime: 30000,
  });

  const { data: vacationRequests = [] } = useQuery<VacationRequest[]>({
    queryKey: ['/api/vacation-requests'],
    enabled: !!user,
    staleTime: 60000,
  });

  const { data: holidays = [] } = useQuery<Holiday[]>({
    queryKey: ['/api/holidays/custom'],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  // Función para navegar entre días
  const navigateDay = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setCurrentDate(prev => subDays(prev, 1));
    } else {
      setCurrentDate(prev => addDays(prev, 1));
    }
  };

  // Función para obtener turnos del día actual
  const getShiftsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return shifts.filter(shift => {
      const shiftDate = format(parseISO(shift.startAt), 'yyyy-MM-dd');
      return shiftDate === dateStr;
    });
  };

  // Función para verificar si está de vacaciones
  const isOnVacation = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return vacationRequests.find(request => 
      request.status === 'approved' &&
      request.startDate.split('T')[0] <= dateStr &&
      request.endDate.split('T')[0] >= dateStr
    );
  };

  // Función para verificar si es festivo
  const isHoliday = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return holidays.find(holiday => 
      holiday.startDate.split('T')[0] <= dateStr &&
      holiday.endDate.split('T')[0] >= dateStr
    );
  };

  // Función para renderizar badge de turno
  const renderShiftBadge = (shift: WorkShift) => {
    const startTime = format(parseISO(shift.startAt), 'HH:mm');
    const endTime = format(parseISO(shift.endAt), 'HH:mm');
    
    return (
      <div 
        key={shift.id}
        className="mb-2 p-3 rounded-lg text-white shadow-sm border border-white/20"
        style={{ backgroundColor: shift.color }}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="font-medium text-sm">{shift.title}</span>
          <div className="flex items-center text-xs">
            <Clock className="w-3 h-3 mr-1" />
            {startTime} - {endTime}
          </div>
        </div>
        
        {shift.location && (
          <div className="flex items-center text-xs opacity-90 mb-1">
            <MapPin className="w-3 h-3 mr-1" />
            {shift.location}
          </div>
        )}
        
        {shift.notes && (
          <div className="text-xs opacity-80 mt-1">
            {shift.notes}
          </div>
        )}
      </div>
    );
  };

  // Función para obtener contenido de la celda
  const getCellContent = (date: Date) => {
    const vacation = isOnVacation(date);
    const holiday = isHoliday(date);
    
    if (vacation) {
      return (
        <div className="h-full flex items-center justify-center">
          <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
            Vacaciones
          </Badge>
        </div>
      );
    }
    
    if (holiday) {
      return (
        <div className="h-full flex items-center justify-center">
          <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200 text-center text-xs leading-tight">
            {holiday.name}
          </Badge>
        </div>
      );
    }
    
    return null;
  };

  const dayShifts = getShiftsForDate(currentDate);
  const isToday = format(new Date(), 'yyyy-MM-dd') === format(currentDate, 'yyyy-MM-dd');

  if (shiftsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="px-6 py-4 min-h-screen bg-gray-50 dark:bg-gray-900" style={{ overflowX: 'clip' }}>
      <Card className="px-6 pt-4 pb-8 h-screen bg-card text-card-foreground border-border border shadow-sm flex flex-col" style={{ overflowX: 'clip' }}>
        
        <CardHeader className="bg-muted/10 px-4 py-2 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Mi Cuadrante</h1>
            </div>
          </div>
          
          {/* Navegación de días */}
          <div className="flex items-center justify-between mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateDay('prev')}
              className="h-8 w-8 p-0"
              data-testid="button-prev-day"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <div className="text-center">
              <h2 className="text-lg font-semibold text-foreground">
                {format(currentDate, "EEEE, d 'de' MMMM yyyy", { locale: es })}
              </h2>
              {isToday && (
                <Badge variant="secondary" className="mt-1 bg-blue-100 text-blue-800 border-blue-200">
                  Hoy
                </Badge>
              )}
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateDay('next')}
              className="h-8 w-8 p-0"
              data-testid="button-next-day"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-0 overflow-y-auto" style={{ height: 'calc(100vh - 160px)' }}>
          <div className="p-4">
            {/* Información del empleado */}
            <div className="flex items-center gap-3 mb-4 p-3 bg-muted/30 rounded-lg">
              <UserAvatar 
                fullName={user?.fullName || ''} 
                size="md" 
                userId={user?.id}
                profilePicture={user?.profilePicture}
              />
              <div>
                <h3 className="font-medium text-foreground">{user?.fullName}</h3>
                <p className="text-sm text-muted-foreground">Mi horario del día</p>
              </div>
            </div>

            {/* Contenido del día */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-border min-h-[300px] p-4">
              {/* Contenido especial (vacaciones/festivos) */}
              {getCellContent(currentDate)}
              
              {/* Turnos del día */}
              {dayShifts.length > 0 ? (
                <div>
                  <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Turnos del día ({dayShifts.length})
                  </h4>
                  <div className="space-y-2">
                    {dayShifts.map(shift => renderShiftBadge(shift))}
                  </div>
                </div>
              ) : !getCellContent(currentDate) ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <CalendarClock className="w-12 h-12 text-muted-foreground mb-3" />
                  <h3 className="font-medium text-foreground mb-1">Sin turnos programados</h3>
                  <p className="text-sm text-muted-foreground">No tienes horarios asignados para este día</p>
                </div>
              ) : null}
            </div>

            {/* Botón para volver a hoy */}
            {!isToday && (
              <div className="mt-4 text-center">
                <Button
                  variant="outline"
                  onClick={() => setCurrentDate(new Date())}
                  className="text-sm"
                >
                  Volver a hoy
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}