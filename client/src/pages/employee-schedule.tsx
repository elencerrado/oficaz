import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, ChevronLeft, ChevronRight, Clock, MapPin, ArrowLeft } from "lucide-react";
import { format, addDays, subDays, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { PageLoading } from "@/components/ui/page-loading";

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
  const { user, company } = useAuth();
  const [location] = useLocation();

  // Estado para la fecha actual (solo vista de día)
  const [currentDate, setCurrentDate] = useState(new Date());

  // Get company alias from URL
  const urlParts = location.split('/').filter(part => part.length > 0);
  const companyAlias = urlParts[0] || company?.companyAlias || 'test';

  // Check if should show logo based on subscription features
  const shouldShowLogo = company?.logoUrl && company?.subscription?.features?.logoUpload;

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
        className="mb-3 p-4 rounded-xl text-white shadow-sm border border-white/20 backdrop-blur-sm"
        style={{ backgroundColor: shift.color }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium text-sm">{shift.title}</span>
          <div className="flex items-center text-xs bg-black/20 px-2 py-1 rounded-lg">
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
          <div className="text-xs opacity-80 mt-2 bg-black/20 p-2 rounded-lg">
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
        <div className="h-full flex items-center justify-center p-4">
          <div className="bg-blue-500/20 border border-blue-500/30 rounded-xl p-4 text-center backdrop-blur-sm">
            <div className="text-blue-300 font-medium mb-1">🏖️ Vacaciones</div>
            <div className="text-blue-200 text-xs">Disfruta tu descanso</div>
          </div>
        </div>
      );
    }
    
    if (holiday) {
      return (
        <div className="h-full flex items-center justify-center p-4">
          <div className="bg-orange-500/20 border border-orange-500/30 rounded-xl p-4 text-center backdrop-blur-sm">
            <div className="text-orange-300 font-medium mb-1">🎉 {holiday.name}</div>
            <div className="text-orange-200 text-xs">Día festivo</div>
          </div>
        </div>
      );
    }
    
    return null;
  };

  const dayShifts = getShiftsForDate(currentDate);
  const isToday = format(new Date(), 'yyyy-MM-dd') === format(currentDate, 'yyyy-MM-dd');

  // Show loading state
  if (shiftsLoading) {
    return <PageLoading />;
  }

  return (
    <div 
      className="bg-employee-gradient text-white min-h-screen"
      style={{
        overscrollBehavior: 'none'
      }}
    >
      {/* Header - Fixed height */}
      <div className="flex items-center justify-between p-6 pb-8 h-20">
        <Link href={`/${companyAlias}/inicio`}>
          <Button
            variant="ghost"
            size="lg"
            className="text-white hover:bg-white/20 px-6 py-3 rounded-xl bg-white/10 backdrop-blur-sm transition-all duration-200 transform hover:scale-105"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            <span className="font-medium">Atrás</span>
          </Button>
        </Link>
        
        <div className="flex-1 flex flex-col items-end text-right">
          {/* Mostrar logo solo si tiene logo Y función habilitada en super admin */}
          {shouldShowLogo ? (
            <img 
              src={company.logoUrl} 
              alt={company.name} 
              className="h-8 w-auto mb-1 object-contain filter brightness-0 invert"
            />
          ) : (
            <div className="text-white text-sm font-medium mb-1">
              {company?.name || 'Mi Empresa'}
            </div>
          )}
          <div className="text-white/70 text-xs">
            {user?.fullName}
          </div>
        </div>
      </div>

      {/* Page Title */}
      <div className="px-6 pb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Cuadrante</h1>
        <p className="text-white/70 text-sm">
          Consulta tus horarios y turnos asignados
        </p>
      </div>

      {/* Navigation Controls */}
      <div className="px-6 mb-6">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateDay('prev')}
              className="text-white hover:bg-white/20 px-4 py-2 rounded-lg"
              data-testid="button-prev-day"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Anterior
            </Button>
            
            <div className="text-center">
              <h2 className="text-lg font-semibold text-white">
                {format(currentDate, "EEEE, d 'de' MMMM yyyy", { locale: es })}
              </h2>
              {isToday && (
                <Badge variant="secondary" className="mt-1 bg-blue-500 text-white border-blue-400">
                  Hoy
                </Badge>
              )}
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateDay('next')}
              className="text-white hover:bg-white/20 px-4 py-2 rounded-lg"
              data-testid="button-next-day"
            >
              Siguiente
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* Day Content */}
      <div className="px-6 mb-6">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 min-h-[400px]">
          
          {/* Contenido especial (vacaciones/festivos) */}
          {getCellContent(currentDate)}
          
          {/* Turnos del día */}
          {dayShifts.length > 0 && !getCellContent(currentDate) && (
            <div className="p-6">
              <h3 className="font-medium text-white mb-4 flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-blue-400" />
                Tus turnos de hoy ({dayShifts.length})
              </h3>
              <div className="space-y-3">
                {dayShifts.map(shift => renderShiftBadge(shift))}
              </div>
            </div>
          )}

          {/* Sin turnos programados */}
          {dayShifts.length === 0 && !getCellContent(currentDate) && (
            <div className="flex flex-col items-center justify-center h-full text-center p-12">
              <CalendarClock className="w-16 h-16 text-white/30 mb-4" />
              <h3 className="font-medium text-white mb-2">Sin turnos programados</h3>
              <p className="text-sm text-white/70">No tienes horarios asignados para este día</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-6 mb-6">
        <div className="grid grid-cols-2 gap-4">
          {!isToday && (
            <Button
              variant="ghost"
              onClick={() => setCurrentDate(new Date())}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm rounded-xl py-3"
            >
              Volver a hoy
            </Button>
          )}
          <Button
            variant="ghost"
            className="bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm rounded-xl py-3"
            onClick={() => refetchShifts()}
          >
            <Clock className="w-4 h-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Copyright at bottom */}
      <div className="text-center pb-4 mt-auto">
        <div className="flex items-center justify-center space-x-1 text-white/60 text-xs">
          <span className="font-semibold text-blue-400">Oficaz</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </div>
    </div>
  );
}