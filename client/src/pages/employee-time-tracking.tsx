import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Play, 
  Square, 
  Save, 
  X,
  RefreshCw
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, addMonths, subMonths, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { apiRequest } from '@/lib/queryClient';

// Interfaces
interface WorkSession {
  id: number;
  userId: number;
  clockIn: string;
  clockOut?: string;
  totalHours?: string;
  createdAt: string;
}

interface BreakPeriod {
  id: number;
  workSessionId: number;
  userId: number;
  breakStart: string;
  breakEnd?: string;
  duration: number;
  status: 'active' | 'completed';
  createdAt: string;
}

interface ActiveSession {
  id: number;
  clockIn: string;
}

export default function EmployeeTimeTracking() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State management
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [editingSession, setEditingSession] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ clockIn: '', clockOut: '' });
  const [tooltipContent, setTooltipContent] = useState<{ show: boolean; content: string; x: number; y: number }>({
    show: false,
    content: '',
    x: 0,
    y: 0
  });
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  
  // Touch handling for mobile swipe
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchThreshold = 50;
  
  const onTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    // Prevent any scroll during touch move
    e.preventDefault();
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);

    // Only process horizontal swipes (deltaY < 50 for horizontal bias)
    if (deltaY < 50 && Math.abs(deltaX) > touchThreshold) {
      e.preventDefault();
      if (deltaX > 0) {
        // Swipe right - previous month
        setCurrentMonth(prev => subMonths(prev, 1));
      } else {
        // Swipe left - next month
        setCurrentMonth(prev => addMonths(prev, 1));
      }
    }

    touchStartRef.current = null;
  };

  // Date calculations
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const currentYear = new Date().getFullYear();
  
  // Queries
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['/api/work-sessions'],
    staleTime: 30000,
    gcTime: 60000,
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
  });

  const { data: breakPeriods = [] } = useQuery({
    queryKey: ['/api/break-periods'],
    staleTime: 30000,
    gcTime: 60000,
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
  });

  const { data: activeSession } = useQuery({
    queryKey: ['/api/work-sessions/active'],
    staleTime: 10000,
    gcTime: 30000,
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
  });

  // Mutations
  const updateSessionMutation = useMutation({
    mutationFn: async ({ id, clockIn, clockOut }: { id: number; clockIn: string; clockOut: string }) => {
      return apiRequest('PATCH', `/api/work-sessions/${id}`, { clockIn, clockOut });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions'] });
      setEditingSession(null);
      toast({
        title: "Fichaje actualizado",
        description: "Los horarios se han actualizado correctamente.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `No se pudo actualizar el fichaje: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Helper functions
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'dd/MM', { locale: es });
  };

  const formatDayDate = (date: Date) => {
    return format(date, 'EEEE dd', { locale: es });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'HH:mm');
  };

  const formatTotalHours = (hours: number) => {
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}h ${m}m`;
  };

  const calculateSessionHours = (session: WorkSession) => {
    if (!session.clockOut) return 0;
    const start = new Date(session.clockIn);
    const end = new Date(session.clockOut);
    return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  };

  // Check if user can edit time
  const canEditTime = user?.company?.employeeTimeEditPermission === 'yes';

  // Get sessions for current month
  const monthSessions = sessions.filter((session: WorkSession) => {
    const sessionDate = new Date(session.clockIn);
    return sessionDate >= monthStart && sessionDate <= monthEnd;
  });

  // Calculate total hours for the month
  const totalMonthHours = monthSessions.reduce((total, session) => {
    return total + calculateSessionHours(session);
  }, 0);

  // Edit functions
  const handleDoubleClick = (session: WorkSession) => {
    if (!canEditTime) return;
    startEditing(session);
  };

  const handleTouchEnd = (session: WorkSession) => {
    if (!canEditTime) return;
    startEditing(session);
  };

  const startEditing = (session: WorkSession) => {
    setEditingSession(session.id);
    setEditForm({
      clockIn: formatTime(session.clockIn),
      clockOut: session.clockOut ? formatTime(session.clockOut) : ''
    });
  };

  const saveEdit = () => {
    if (editingSession && editForm.clockIn && editForm.clockOut) {
      const session = sessions.find((s: WorkSession) => s.id === editingSession);
      if (session) {
        const clockInDate = new Date(session.clockIn);
        const clockOutDate = new Date(session.clockOut || session.clockIn);
        
        // Update times while preserving dates
        const newClockIn = new Date(clockInDate);
        const [inHours, inMinutes] = editForm.clockIn.split(':').map(Number);
        newClockIn.setHours(inHours, inMinutes, 0, 0);
        
        const newClockOut = new Date(clockOutDate);
        const [outHours, outMinutes] = editForm.clockOut.split(':').map(Number);
        newClockOut.setHours(outHours, outMinutes, 0, 0);
        
        updateSessionMutation.mutate({
          id: editingSession,
          clockIn: newClockIn.toISOString(),
          clockOut: newClockOut.toISOString()
        });
      }
    }
  };

  const cancelEditing = () => {
    setEditingSession(null);
    setEditForm({ clockIn: '', clockOut: '' });
  };

  const toggleDayExpansion = (dayKey: string) => {
    const newExpanded = new Set(expandedDays);
    if (newExpanded.has(dayKey)) {
      newExpanded.delete(dayKey);
    } else {
      newExpanded.add(dayKey);
    }
    setExpandedDays(newExpanded);
  };

  // Mobile Timeline Rendering Function - Admin Style Bars
  const renderMobileTimeline = (session: WorkSession) => {
    const sessionBreaks = breakPeriods.filter((bp: BreakPeriod) => bp.workSessionId === session.id);
    
    // Debug: log break periods
    console.log('Session breaks for session', session.id, ':', sessionBreaks);
    
    if (!session.clockOut) {
      return (
        <div key={session.id} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 mb-3 border border-white/20">
          <div className="flex justify-between items-center mb-2">
            <span className="text-white font-medium text-sm">{formatDayDate(new Date(session.clockIn))}</span>
            <Badge variant="secondary" className="bg-green-500/20 text-green-300 border-green-500/30">
              En curso
            </Badge>
          </div>
          
          <div className="flex items-center space-x-2 mb-3">
            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-white/90 text-sm">Entrada: {formatTime(session.clockIn)}</span>
          </div>
          
          <div className="text-center text-white/60 text-xs py-2">
            Sesión activa - ficha para terminar
          </div>
        </div>
      );
    }

    // Admin-style timeline with wide bars and day boundaries
    const sessionStart = new Date(session.clockIn);
    const sessionEnd = new Date(session.clockOut);
    
    // Use day boundaries like admin view (6 AM to 10 PM)
    const dayStart = new Date(sessionStart);
    dayStart.setHours(6, 0, 0, 0);
    const dayEnd = new Date(sessionStart);
    dayEnd.setHours(22, 0, 0, 0);
    
    const totalDayDuration = 16; // 16 hours from 6 AM to 10 PM
    
    // Calculate position relative to day (not session)
    const startOffset = (sessionStart.getTime() - dayStart.getTime()) / (1000 * 60 * 60);
    const sessionDuration = (sessionEnd.getTime() - sessionStart.getTime()) / (1000 * 60 * 60);
    
    const leftPercentage = (startOffset / totalDayDuration) * 100;
    const widthPercentage = (sessionDuration / totalDayDuration) * 100;

    return (
      <div 
        key={session.id} 
        className="bg-white/10 backdrop-blur-sm rounded-xl p-4 mb-3 border border-white/20 cursor-pointer"
        onClick={() => toggleDayExpansion(`${formatDayDate(new Date(session.clockIn))}-${session.id}`)}
      >
        {/* Header with date and total hours */}
        <div className="flex justify-between items-center mb-4">
          <span className="text-white font-medium text-sm">{formatDayDate(new Date(session.clockIn))}</span>
          <span className="text-white/90 font-mono text-sm">{formatTotalHours(calculateSessionHours(session))}</span>
        </div>

        {/* Admin-style timeline bar - más ancho */}
        <div className="relative h-7 mb-2 mx-2">
            {/* Main session bar - h-5 like admin, más ancho del contenedor */}
            <div
              className="absolute top-0 h-5 bg-blue-500 rounded-sm"
              style={{
                left: `${Math.max(0, leftPercentage - 2)}%`,
                width: `${Math.min(100, widthPercentage + 4)}%`
              }}
            />
            
            {/* Break periods as orange bars inside the session bar */}
            {sessionBreaks.map((breakPeriod: BreakPeriod, breakIndex: number) => {
              if (!breakPeriod.breakEnd) return null;
              
              const breakStart = new Date(breakPeriod.breakStart);
              const breakEnd = new Date(breakPeriod.breakEnd);
              
              // Position relative to session start (not day)
              const breakStartRelativeToSession = (breakStart.getTime() - sessionStart.getTime()) / (1000 * 60 * 60);
              const breakDuration = (breakEnd.getTime() - breakStart.getTime()) / (1000 * 60 * 60);
              
              const breakLeftPercentageInSession = (breakStartRelativeToSession / sessionDuration) * 100;
              const breakWidthPercentageInSession = Math.max((breakDuration / sessionDuration) * 100, 2); // Minimum 2%
              
              // Calcular posición real considerando el margen de la barra expandida
              const actualBarLeft = Math.max(0, leftPercentage - 2);
              const actualBarWidth = Math.min(100, widthPercentage + 4);
              
              return (
                <div
                  key={`break-${breakIndex}`}
                  className="absolute top-0.5 h-4 bg-orange-400 rounded-sm"
                  style={{
                    left: `${actualBarLeft + (breakLeftPercentageInSession * actualBarWidth / 100)}%`,
                    width: `${(breakWidthPercentageInSession * actualBarWidth / 100)}%`
                  }}
                />
              );
            })}
            
            {/* Puntos de entrada/salida debajo de la barra - solo cuando está expandido */}
            {expandedDays.has(`${formatDayDate(new Date(session.clockIn))}-${session.id}`) && (
              <>
                {/* Punto de entrada - verde sólido, debajo de la barra */}
                <div
                  className="absolute w-3 h-3 bg-green-500 rounded-full"
                  style={{
                    left: `${leftPercentage}%`,
                    top: '24px', // Debajo de la barra h-5
                    transform: 'translateX(-50%)'
                  }}
                />
                
                {/* Punto de salida - rojo sólido, debajo de la barra */}
                <div
                  className="absolute w-3 h-3 bg-red-500 rounded-full"
                  style={{
                    left: `${leftPercentage + widthPercentage + 1}%`,
                    top: '24px', // Debajo de la barra h-5
                    transform: 'translateX(-50%)'
                  }}
                />
              </>
            )}
          </div>

        {/* Detalles de horarios - solo cuando está expandido */}
        {expandedDays.has(`${formatDayDate(new Date(session.clockIn))}-${session.id}`) && (
          <div className="mx-2 mb-3 space-y-2">
            {/* Horarios de entrada y salida */}
            <div className="flex justify-between text-xs text-white/70">
              <span>Entrada: {sessionStart.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
              <span>Salida: {sessionEnd.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            
            {/* Información de descansos - solo mostrar título cuando está expandido */}
            {sessionBreaks.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs text-white/50 font-medium">Descansos:</div>
                {sessionBreaks.map((breakPeriod: BreakPeriod, breakIndex: number) => {
                  if (!breakPeriod.breakEnd) return null;
                  
                  const breakStart = new Date(breakPeriod.breakStart);
                  const breakEnd = new Date(breakPeriod.breakEnd);
                  const duration = Math.floor((breakEnd.getTime() - breakStart.getTime()) / (1000 * 60));
                  
                  return (
                    <div key={`break-detail-${breakIndex}`} className="flex justify-between text-xs text-orange-200">
                      <span>{formatTime(breakPeriod.breakStart)} - {formatTime(breakPeriod.breakEnd!)}</span>
                      <span>{duration} min</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}



        {/* Tooltip */}
        {tooltipContent.show && (
          <div
            className="fixed z-50 bg-black/90 text-white text-xs px-2 py-1 rounded pointer-events-none"
            style={{
              left: tooltipContent.x,
              top: tooltipContent.y,
              transform: 'translateX(-50%)'
            }}
          >
            {tooltipContent.content}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-black/90"></div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div 
      className="min-h-screen bg-employee-gradient text-white overflow-x-hidden" 
      style={{ overflowX: 'clip' }}
    >
      {/* Header with company info */}
      <div className="px-6 pt-6 pb-2">
        <div className="flex items-center space-x-3 mb-2">
          {user?.company?.logoUrl ? (
            <img
              src={user.company.logoUrl}
              alt="Logo empresa"
              className="h-8 w-auto filter invert"
            />
          ) : (
            <div className="text-white text-base font-semibold">
              {user?.company?.name || 'Mi Empresa'}
            </div>
          )}
        </div>
        <div className="text-white/70 text-xs">
          {user?.fullName || 'Empleado'}
        </div>
      </div>

      {/* Page title */}
      <div className="px-6 pb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Control de Tiempo</h1>
        <p className="text-white/70 text-sm">Revisa tu historial de fichajes y horas trabajadas</p>
      </div>

      {/* Month navigation - Fixed height */}
      <div className="flex items-center justify-between px-6 mb-6 h-12">
        <Button
          onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
          className="text-white hover:bg-white/10 p-2 rounded-xl"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
        
        <h2 className="text-xl font-semibold text-white text-center min-w-0 flex-1">
          {format(currentMonth, 'MMMM yyyy', { locale: es })}
        </h2>
        
        {format(currentMonth, 'yyyy-MM') < format(new Date(), 'yyyy-MM') ? (
          <Button
            onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
            className="text-white hover:bg-white/10 p-2 rounded-xl"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        ) : (
          <div className="w-10 h-10 p-2" /> // Spacer to maintain exact layout
        )}
      </div>

      {/* Month Total Hours - Fixed height */}
      <div 
        className="px-6 mb-6 h-20"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 h-full flex items-center justify-center">
          <div className="text-center">
            <p className="text-white/70 text-sm mb-1">Total del mes</p>
            <p className="text-2xl font-bold text-white">{formatTotalHours(totalMonthHours)}</p>
          </div>
        </div>
      </div>

      {/* Timeline Mobile Container */}
      <div 
        className="px-6 mb-6"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {monthSessions.length > 0 ? (
          (() => {
            const sortedSessions = monthSessions
              .sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime());
            
            // Group sessions by week
            const weekGroups = new Map<string, WorkSession[]>();
            
            sortedSessions.forEach((session) => {
              const sessionDate = new Date(session.clockIn);
              const weekStart = startOfWeek(sessionDate, { weekStartsOn: 1 });
              const weekKey = weekStart.toISOString();
              
              if (!weekGroups.has(weekKey)) {
                weekGroups.set(weekKey, []);
              }
              weekGroups.get(weekKey)!.push(session);
            });
            
            // Convert to array and sort by week (most recent first)
            const sortedWeeks = Array.from(weekGroups.entries())
              .sort(([keyA], [keyB]) => new Date(keyB).getTime() - new Date(keyA).getTime());
            
            const result: JSX.Element[] = [];
            
            sortedWeeks.forEach(([weekKey, weekSessions], weekIndex) => {
              const weekStart = new Date(weekKey);
              const weekTotal = weekSessions.reduce((total, session) => total + calculateSessionHours(session), 0);
              
              // Contenedor de semana
              result.push(
                <div key={`week-${weekKey}`} className="bg-white/5 backdrop-blur-sm rounded-xl p-4 mb-4 border border-white/10">
                  {/* Header de semana */}
                  <div className="flex justify-between items-center mb-4 pb-3 border-b border-white/10">
                    <h3 className="text-white font-medium text-sm">
                      Semana del {format(weekStart, 'dd MMM', { locale: es })}
                    </h3>
                    <span className="text-blue-300 font-mono text-sm bg-blue-400/20 px-2 py-1 rounded-lg">
                      📊 {formatTotalHours(weekTotal)}
                    </span>
                  </div>
                  
                  {/* Sesiones de la semana agrupadas por día */}
                  <div className="space-y-3">
                    {(() => {
                      // Agrupar sesiones por día
                      const dayGroups = new Map<string, WorkSession[]>();
                      
                      weekSessions.forEach((session) => {
                        const sessionDate = new Date(session.clockIn);
                        const dayKey = sessionDate.toDateString(); // Same day
                        
                        if (!dayGroups.has(dayKey)) {
                          dayGroups.set(dayKey, []);
                        }
                        dayGroups.get(dayKey)!.push(session);
                      });
                      
                      // Convert to array and sort by day (most recent first)
                      const sortedDays = Array.from(dayGroups.entries())
                        .sort(([keyA], [keyB]) => new Date(keyB).getTime() - new Date(keyA).getTime());
                      
                      return sortedDays.map(([dayKey, daySessions]) => {
                        // Sort sessions within the day chronologically
                        const sortedDaySessions = daySessions.sort((a, b) => 
                          new Date(a.clockIn).getTime() - new Date(b.clockIn).getTime()
                        );
                        
                        if (sortedDaySessions.length === 1) {
                          // Single session - use current rendering
                          return renderMobileTimeline(sortedDaySessions[0]);
                        } else {
                          // Multiple sessions in same day - group them
                          const dayTotal = sortedDaySessions.reduce((total, session) => 
                            total + calculateSessionHours(session), 0
                          );
                          
                          return (
                            <div 
                              key={`day-${dayKey}`} 
                              className="bg-white/10 backdrop-blur-sm rounded-xl p-4 mb-3 border border-white/20 cursor-pointer"
                              onClick={() => toggleDayExpansion(`${formatDayDate(new Date(dayKey))}-multi`)}
                            >
                              {/* Header with date and total hours */}
                              <div className="flex justify-between items-center mb-4">
                                <span className="text-white font-medium text-sm">
                                  {formatDayDate(new Date(dayKey))}
                                </span>
                                <span className="text-white/90 font-mono text-sm">
                                  {formatTotalHours(dayTotal)}
                                </span>
                              </div>

                              {/* Multiple session bars - más ancho */}
                              <div className="relative h-7 mb-2 mx-2">
                                {sortedDaySessions.map((session, sessionIndex) => {
                                  if (!session.clockOut) return null; // Skip active sessions in multi-view
                                  
                                  const sessionStart = new Date(session.clockIn);
                                  const sessionEnd = new Date(session.clockOut);
                                  const sessionBreaks = breakPeriods.filter((bp: BreakPeriod) => bp.workSessionId === session.id);
                                  
                                  // Day boundaries (6 AM to 10 PM)
                                  const dayStart = new Date(sessionStart);
                                  dayStart.setHours(6, 0, 0, 0);
                                  const totalDayDuration = 16; // 16 hours
                                  
                                  // Calculate position relative to day
                                  const startOffset = (sessionStart.getTime() - dayStart.getTime()) / (1000 * 60 * 60);
                                  const sessionDuration = (sessionEnd.getTime() - sessionStart.getTime()) / (1000 * 60 * 60);
                                  
                                  const leftPercentage = (startOffset / totalDayDuration) * 100;
                                  const widthPercentage = (sessionDuration / totalDayDuration) * 100;
                                  
                                  return (
                                    <div key={`session-${session.id}`} className="relative">
                                      {/* Session bar - más ancho */}
                                      <div
                                        className="absolute top-0 h-5 bg-blue-500 rounded-sm"
                                        style={{
                                          left: `${Math.max(0, leftPercentage - 1)}%`,
                                          width: `${Math.min(100, widthPercentage + 2)}%`
                                        }}
                                      />
                                      
                                      {/* Puntos de entrada/salida debajo de la barra - solo cuando está expandido */}
                                      {expandedDays.has(`${formatDayDate(new Date(dayKey))}-multi`) && (
                                        <>
                                          {/* Punto de entrada - verde sólido, debajo de la barra */}
                                          <div
                                            className="absolute w-3 h-3 bg-green-500 rounded-full"
                                            style={{
                                              left: `${leftPercentage}%`,
                                              top: '24px', // Debajo de la barra h-5
                                              transform: 'translateX(-50%)'
                                            }}
                                          />
                                          
                                          {/* Punto de salida - rojo sólido, debajo de la barra */}
                                          <div
                                            className="absolute w-3 h-3 bg-red-500 rounded-full"
                                            style={{
                                              left: `${leftPercentage + widthPercentage + 0.5}%`,
                                              top: '24px', // Debajo de la barra h-5
                                              transform: 'translateX(-50%)'
                                            }}
                                          />
                                        </>
                                      )}
                                      
                                      {/* Break periods within session */}
                                      {sessionBreaks.map((breakPeriod: BreakPeriod, breakIndex: number) => {
                                        if (!breakPeriod.breakEnd) return null;
                                        
                                        const breakStart = new Date(breakPeriod.breakStart);
                                        const breakEnd = new Date(breakPeriod.breakEnd);
                                        
                                        const breakStartRelativeToSession = (breakStart.getTime() - sessionStart.getTime()) / (1000 * 60 * 60);
                                        const breakDuration = (breakEnd.getTime() - breakStart.getTime()) / (1000 * 60 * 60);
                                        
                                        const breakLeftPercentageInSession = (breakStartRelativeToSession / sessionDuration) * 100;
                                        const breakWidthPercentageInSession = Math.max((breakDuration / sessionDuration) * 100, 2);
                                        
                                        // Calcular posición considerando la barra expandida
                                        const actualBarLeft = Math.max(0, leftPercentage - 1);
                                        const actualBarWidth = Math.min(100, widthPercentage + 2);
                                        
                                        return (
                                          <div
                                            key={`break-${breakIndex}`}
                                            className="absolute top-0.5 h-4 bg-orange-400 rounded-sm cursor-pointer"
                                            style={{
                                              left: `${actualBarLeft + (breakLeftPercentageInSession * actualBarWidth / 100)}%`,
                                              width: `${(breakWidthPercentageInSession * actualBarWidth / 100)}%`
                                            }}
                                            title={`Descanso: ${formatTime(breakPeriod.breakStart)} - ${formatTime(breakPeriod.breakEnd!)} (${Math.floor((breakEnd.getTime() - breakStart.getTime()) / (1000 * 60))} min)`}
                                          />
                                        );
                                      })}
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Detalles de horarios - solo cuando está expandido */}
                              {expandedDays.has(`${formatDayDate(new Date(dayKey))}-multi`) && (
                                <div className="mx-2 mb-3 space-y-3">
                                  {/* Lista de sesiones con horarios detallados */}
                                  {sortedDaySessions.map((session, sessionIndex) => {
                                    if (!session.clockOut) return null;
                                    
                                    const sessionStart = new Date(session.clockIn);
                                    const sessionEnd = new Date(session.clockOut);
                                    const sessionBreaks = breakPeriods.filter((bp: BreakPeriod) => bp.workSessionId === session.id);
                                    
                                    return (
                                      <div key={`session-detail-${session.id}`} className="space-y-2">
                                        <div className="text-xs text-white/50 font-medium">Sesión {sessionIndex + 1}:</div>
                                        
                                        {/* Horarios de entrada y salida de la sesión */}
                                        <div className="flex justify-between text-xs text-white/70">
                                          <span>Entrada: {sessionStart.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                                          <span>Salida: {sessionEnd.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        
                                        {/* Información de descansos de esta sesión */}
                                        {sessionBreaks.length > 0 && (
                                          <div className="space-y-1 ml-4">
                                            <div className="text-xs text-white/50 font-medium">Descansos:</div>
                                            {sessionBreaks.map((breakPeriod: BreakPeriod, breakIndex: number) => {
                                              if (!breakPeriod.breakEnd) return null;
                                              
                                              const breakStart = new Date(breakPeriod.breakStart);
                                              const breakEnd = new Date(breakPeriod.breakEnd);
                                              const duration = Math.floor((breakEnd.getTime() - breakStart.getTime()) / (1000 * 60));
                                              
                                              return (
                                                <div key={`break-detail-${breakIndex}`} className="flex justify-between text-xs text-orange-200">
                                                  <span>{formatTime(breakPeriod.breakStart)} - {formatTime(breakPeriod.breakEnd!)}</span>
                                                  <span>{duration} min</span>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Sessions info */}
                              <div className="text-xs text-white/50 mt-2">
                                {sortedDaySessions.length} tramos de trabajo
                              </div>
                            </div>
                          );
                        }
                      });
                    })()}
                  </div>
                </div>
              );
            });
            
            return result;
          })()
        ) : isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="text-center text-white/60">
              <LoadingSpinner size="lg" className="mx-auto mb-3 text-white" />
              <p>Cargando fichajes...</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-48">
            <div className="text-center text-white/60">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No hay fichajes este mes</p>
            </div>
          </div>
        )}
      </div>

      {/* Copyright at bottom */}
      <div className="text-center pb-4 pt-6">
        <div className="flex items-center justify-center space-x-1 text-gray-400 text-xs">
          <span className="font-semibold text-blue-400">Oficaz</span>
          <span>© {currentYear}</span>
        </div>
      </div>
    </div>
  );
}