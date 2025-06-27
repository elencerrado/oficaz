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

  // Mobile Timeline Rendering Function
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

    // Timeline calculation
    const startTime = new Date(session.clockIn);
    const endTime = new Date(session.clockOut);
    const totalMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
    
    // Create timeline points
    const timelinePoints = [
      { type: 'entrada', time: startTime, label: 'Entrada' },
      ...sessionBreaks.flatMap((breakPeriod: BreakPeriod) => [
        { type: 'break-start', time: new Date(breakPeriod.breakStart), label: 'Descanso inicio', breakPeriod },
        ...(breakPeriod.breakEnd ? [{ type: 'break-end', time: new Date(breakPeriod.breakEnd), label: 'Descanso fin', breakPeriod }] : [])
      ]),
      { type: 'salida', time: endTime, label: 'Salida' }
    ].sort((a, b) => a.time.getTime() - b.time.getTime());

    // Collision detection with 0 threshold for maximum sensitivity
    const hasProximity = timelinePoints.some((point, index) => {
      if (index === timelinePoints.length - 1) return false;
      const nextPoint = timelinePoints[index + 1];
      const timeDiff = nextPoint.time.getTime() - point.time.getTime();
      return timeDiff <= 0; // Any proximity triggers compact mode
    });

    return (
      <div key={session.id} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 mb-3 border border-white/20">
        {/* Header with date and total hours */}
        <div className="flex justify-between items-center mb-4">
          <span className="text-white font-medium text-sm">{formatDayDate(new Date(session.clockIn))}</span>
          <span className="text-white/90 font-mono text-sm">{formatTotalHours(calculateSessionHours(session))}</span>
        </div>

        {/* Timeline container - BARRA MÁS ANCHA */}
        <div className="relative mb-3">
          {/* Main blue bar - Aumentada de h-1 a h-2 */}
          <div className="relative h-2 bg-blue-400 rounded-full">
            {/* Break periods overlay */}
            {sessionBreaks.map((breakPeriod: BreakPeriod) => {
              const breakStartField = breakPeriod.breakStart;
              const breakEndField = breakPeriod.breakEnd;
              
              if (!breakStartField) return null;
              
              const breakStart = new Date(breakStartField);
              const breakEnd = breakEndField ? new Date(breakEndField) : new Date();
              
              const startPercent = ((breakStart.getTime() - startTime.getTime()) / (endTime.getTime() - startTime.getTime())) * 100;
              const endPercent = ((breakEnd.getTime() - startTime.getTime()) / (endTime.getTime() - startTime.getTime())) * 100;
              const width = Math.max(2, endPercent - startPercent); // Mínimo 2% de ancho
              
              return (
                <div
                  key={breakPeriod.id}
                  className={`absolute h-2 rounded-full ${breakPeriod.status === 'active' ? 'bg-orange-400 animate-pulse' : 'bg-gray-400'}`}
                  style={{
                    left: `${Math.max(0, Math.min(95, startPercent))}%`,
                    width: `${Math.min(100 - Math.max(0, startPercent), width)}%`,
                    top: '0px'
                  }}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const content = breakPeriod.status === 'active' 
                      ? `Descanso en progreso: ${Math.floor((new Date().getTime() - breakStart.getTime()) / (1000 * 60))} min`
                      : `Descanso: ${formatTime(breakStartField)} - ${formatTime(breakEndField!)} (${Math.floor((breakEnd.getTime() - breakStart.getTime()) / (1000 * 60))} min)`;
                    
                    setTooltipContent({
                      show: true,
                      content,
                      x: rect.left + rect.width / 2,
                      y: rect.top - 10
                    });
                  }}
                  onMouseLeave={() => {
                    setTooltipContent({ show: false, content: '', x: 0, y: 0 });
                  }}
                />
              );
            })}
          </div>

          {/* Timeline points - Puntos más grandes para mejor visibilidad */}
          {timelinePoints.map((point, index) => {
            const position = ((point.time.getTime() - startTime.getTime()) / (endTime.getTime() - startTime.getTime())) * 100;
            const isEntrada = point.type === 'entrada';
            const isSalida = point.type === 'salida';
            
            // Apply horizontal displacement for entrada/salida only
            let adjustedPosition = position;
            if (isEntrada) {
              adjustedPosition = Math.max(0, position - 1); // 1% left for entrada
            } else if (isSalida) {
              adjustedPosition = Math.min(100, position + 1); // 1% right for salida
            }

            return (
              <div
                key={`${point.type}-${index}`}
                className={`absolute w-4 h-4 rounded-full border-2 border-white shadow-lg transform -translate-x-1/2 ${
                  isEntrada ? 'bg-green-400' : 
                  isSalida ? 'bg-red-400' : 
                  'bg-orange-400'
                }`}
                style={{
                  left: `${adjustedPosition}%`,
                  top: '0px',
                  transform: 'translateX(-50%) translateY(-25%)'
                }}
              />
            );
          })}
        </div>

        {/* Times display - conditional based on proximity */}
        {!hasProximity && (
          <div className="flex justify-between text-xs text-white/70 mt-2">
            <span>{formatTime(session.clockIn)}</span>
            <span>{formatTime(session.clockOut)}</span>
          </div>
        )}

        {/* Debug info - mostrar descansos encontrados */}
        {sessionBreaks.length > 0 && (
          <div className="text-xs text-white/50 mt-2">
            Descansos: {sessionBreaks.length}
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
                  
                  {/* Sesiones de la semana */}
                  <div className="space-y-3">
                    {weekSessions.map((session) => renderMobileTimeline(session))}
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