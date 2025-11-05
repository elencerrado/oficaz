import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, ChevronLeft, ChevronRight, Clock, MapPin, ArrowLeft, Calendar } from "lucide-react";
import { format, addDays, subDays, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks } from "date-fns";
import { es } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { PageLoading } from "@/components/ui/page-loading";
import { useFeatureCheck } from "@/hooks/use-feature-check";

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
  const { hasAccess } = useFeatureCheck();

  // Estado para la fecha actual y tipo de vista
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');

  // Get company alias from URL
  const urlParts = location.split('/').filter(part => part.length > 0);
  const companyAlias = urlParts[0] || company?.companyAlias || 'test';

  // Lógica inteligente: mostrar logo solo si tiene logo Y función habilitada
  const shouldShowLogo = company?.logoUrl && hasAccess('logoUpload');

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

  // Función para navegar entre días o semanas
  const navigate = (direction: 'prev' | 'next') => {
    if (viewMode === 'day') {
      if (direction === 'prev') {
        setCurrentDate(prev => subDays(prev, 1));
      } else {
        setCurrentDate(prev => addDays(prev, 1));
      }
    } else {
      if (direction === 'prev') {
        setCurrentDate(prev => subWeeks(prev, 1));
      } else {
        setCurrentDate(prev => addWeeks(prev, 1));
      }
    }
  };
  
  // Obtener los días de la semana actual
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 }); // Lunes
    const end = endOfWeek(currentDate, { weekStartsOn: 1 }); // Domingo
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

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
    return vacationRequests.find(request => {
      if (request.status !== 'approved') return false;
      
      // Parse dates correctly to avoid timezone issues
      const startDate = format(parseISO(request.startDate), 'yyyy-MM-dd');
      const endDate = format(parseISO(request.endDate), 'yyyy-MM-dd');
      
      return startDate <= dateStr && endDate >= dateStr;
    });
  };

  // Función para verificar si es festivo
  const isHoliday = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return holidays.find(holiday => {
      // Parse dates correctly to avoid timezone issues
      const startDate = format(parseISO(holiday.startDate), 'yyyy-MM-dd');
      const endDate = format(parseISO(holiday.endDate), 'yyyy-MM-dd');
      
      return startDate <= dateStr && endDate >= dateStr;
    });
  };

  // Función para renderizar badge de turno - Optimizada para móvil
  const renderShiftBadge = (shift: WorkShift) => {
    const startTime = format(parseISO(shift.startAt), 'HH:mm');
    const endTime = format(parseISO(shift.endAt), 'HH:mm');
    
    return (
      <div 
        key={shift.id}
        className="p-3 rounded-xl text-white shadow-sm border border-white/20 backdrop-blur-sm"
        style={{ backgroundColor: shift.color }}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="font-medium text-sm truncate pr-2">{shift.title}</span>
          <div className="flex items-center text-xs bg-black/20 px-2 py-1 rounded-lg whitespace-nowrap">
            <Clock className="w-3 h-3 mr-1" />
            {startTime}-{endTime}
          </div>
        </div>
        
        {shift.location && (
          <div className="flex items-center text-xs opacity-90 mb-1">
            <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
            <span className="truncate">{shift.location}</span>
          </div>
        )}
        
        {shift.notes && (
          <div className="text-xs opacity-80 mt-1.5 bg-black/20 p-2 rounded-lg">
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
              src={company.logoUrl!} 
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
      <div className="px-6 pb-4">
        <h1 className="text-3xl font-bold text-white mb-2">Cuadrante</h1>
        <p className="text-white/70 text-sm">
          Consulta tus horarios y turnos asignados
        </p>
      </div>

      {/* View Mode Selector */}
      <div className="px-4 mb-4">
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-1 border border-white/20 flex gap-1">
          <Button
            variant="ghost"
            onClick={() => setViewMode('day')}
            className={`flex-1 rounded-xl transition-all ${
              viewMode === 'day' 
                ? 'bg-white/20 text-white font-medium' 
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <CalendarClock className="w-4 h-4 mr-2" />
            Día
          </Button>
          <Button
            variant="ghost"
            onClick={() => setViewMode('week')}
            className={`flex-1 rounded-xl transition-all ${
              viewMode === 'week' 
                ? 'bg-white/20 text-white font-medium' 
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Semana
          </Button>
        </div>
      </div>

      {/* Mobile-optimized Navigation */}
      <div className="px-4 mb-4">
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 border border-white/20">
          <div className="flex items-center justify-between">
            {/* Botón Anterior */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('prev')}
              className="text-white hover:bg-white/20 w-12 h-12 rounded-full p-0 flex items-center justify-center"
              data-testid="button-prev"
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>
            
            {/* Fecha compacta */}
            <div className="text-center flex-1 px-2">
              {viewMode === 'day' ? (
                <>
                  <div className="text-sm font-medium text-white/80 leading-tight capitalize">
                    {format(currentDate, "EEEE", { locale: es })}
                  </div>
                  <div className="text-lg font-bold text-white leading-tight">
                    {format(currentDate, "d MMM", { locale: es })}
                  </div>
                  {isToday && (
                    <Badge variant="secondary" className="mt-1 bg-blue-500 text-white border-blue-400 text-xs px-2 py-0.5">
                      HOY
                    </Badge>
                  )}
                </>
              ) : (
                <>
                  <div className="text-sm font-medium text-white/80 leading-tight">
                    Semana
                  </div>
                  <div className="text-lg font-bold text-white leading-tight">
                    {format(weekDays[0], "d", { locale: es })} - {format(weekDays[6], "d MMM", { locale: es })}
                  </div>
                </>
              )}
            </div>
            
            {/* Botón Siguiente */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('next')}
              className="text-white hover:bg-white/20 w-12 h-12 rounded-full p-0 flex items-center justify-center"
              data-testid="button-next"
            >
              <ChevronRight className="w-6 h-6" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content - Vista Día o Semana */}
      {viewMode === 'day' ? (
        /* Vista DÍA */
        <div className="px-4 mb-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 min-h-[320px]">
            
            {/* Contenido especial (vacaciones/festivos) */}
            {getCellContent(currentDate)}
            
            {/* Turnos del día - Compacto para móvil */}
            {dayShifts.length > 0 && (
              <div className="p-4">
                <h3 className="font-medium text-white mb-3 flex items-center gap-2 text-sm">
                  <CalendarClock className="w-4 h-4 text-blue-400" />
                  {getCellContent(currentDate) ? 'Turnos (día especial)' : 'Turnos de hoy'} ({dayShifts.length})
                </h3>
                <div className="space-y-2">
                  {dayShifts.map(shift => renderShiftBadge(shift))}
                </div>
              </div>
            )}

            {/* Sin turnos programados - Compacto para móvil */}
            {dayShifts.length === 0 && !getCellContent(currentDate) && (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <CalendarClock className="w-12 h-12 text-white/30 mb-3" />
                <h3 className="font-medium text-white mb-1 text-sm">Sin turnos</h3>
                <p className="text-xs text-white/70">No hay horarios para este día</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Vista SEMANA */
        <div className="px-4 mb-4">
          <div className="space-y-2">
            {weekDays.map((day, index) => {
              const dayShifts = getShiftsForDate(day);
              const isToday = format(new Date(), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
              const specialContent = getCellContent(day);
              
              return (
                <div 
                  key={index}
                  className={`bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden ${
                    isToday ? 'ring-2 ring-blue-400/50' : ''
                  }`}
                >
                  {/* Día header */}
                  <div className={`px-4 py-2 flex items-center justify-between ${
                    isToday ? 'bg-blue-500/20' : 'bg-white/5'
                  }`}>
                    <div className="flex items-center gap-2">
                      <div className="text-white font-medium text-sm capitalize">
                        {format(day, "EEEE", { locale: es })}
                      </div>
                      <div className="text-white/70 text-xs">
                        {format(day, "d MMM", { locale: es })}
                      </div>
                      {isToday && (
                        <Badge variant="secondary" className="bg-blue-500 text-white border-blue-400 text-xs px-2 py-0.5">
                          HOY
                        </Badge>
                      )}
                    </div>
                    <div className="text-white/60 text-xs">
                      {dayShifts.length > 0 ? `${dayShifts.length} turno${dayShifts.length > 1 ? 's' : ''}` : ''}
                    </div>
                  </div>
                  
                  {/* Día content */}
                  <div className="px-4 py-3">
                    {specialContent ? (
                      <div className="py-2">
                        {specialContent}
                      </div>
                    ) : dayShifts.length > 0 ? (
                      <div className="space-y-2">
                        {dayShifts.map(shift => {
                          const startTime = format(parseISO(shift.startAt), 'HH:mm');
                          const endTime = format(parseISO(shift.endAt), 'HH:mm');
                          
                          return (
                            <div 
                              key={shift.id}
                              className="p-2 rounded-lg text-white text-xs border border-white/20"
                              style={{ backgroundColor: shift.color }}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium truncate pr-2">{shift.title}</span>
                                <div className="flex items-center bg-black/20 px-2 py-0.5 rounded whitespace-nowrap">
                                  <Clock className="w-3 h-3 mr-1" />
                                  {startTime}-{endTime}
                                </div>
                              </div>
                              {shift.location && (
                                <div className="flex items-center mt-1 opacity-90">
                                  <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
                                  <span className="truncate text-xs">{shift.location}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-3 text-white/40 text-xs">
                        Sin turnos
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Actions - Móvil */}
      <div className="px-4 mb-4">
        <div className="flex gap-3">
          {(viewMode === 'day' ? !isToday : true) && (
            <Button
              variant="ghost"
              onClick={() => setCurrentDate(new Date())}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm rounded-xl py-2.5 px-4 text-sm flex-1"
            >
              🏠 {viewMode === 'day' ? 'Hoy' : 'Esta semana'}
            </Button>
          )}
          <Button
            variant="ghost"
            className="bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm rounded-xl py-2.5 px-4 text-sm flex-1"
            onClick={() => refetchShifts()}
          >
            <Clock className="w-4 h-4 mr-1" />
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