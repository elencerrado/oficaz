import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Play, 
  Square, 
  Save, 
  X,
  RefreshCw,
  ArrowLeft,
  LogOut
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, addMonths, subMonths, startOfWeek, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '@/hooks/use-auth';
import { useFeatureCheck } from '@/hooks/use-feature-check';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { apiRequest } from '@/lib/queryClient';
import { Link, useLocation } from 'wouter';

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
  const { user, company } = useAuth();
  const { hasAccess } = useFeatureCheck();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Lógica inteligente: mostrar logo solo si tiene logo Y función habilitada
  const shouldShowLogo = company?.logoUrl && hasAccess('logoUpload');
  
  // Get company alias from URL
  const [location] = useLocation();
  const urlParts = location.split('/').filter((part: string) => part.length > 0);
  const companyAlias = urlParts[0] || company?.companyAlias || 'test-company';
  
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
  const [incompleteDialogOpen, setIncompleteDialogOpen] = useState(false);
  const [incompleteSessionId, setIncompleteSessionId] = useState<number | null>(null);
  const [clockOutTime, setClockOutTime] = useState('');
  
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
        // Swipe left - next month (solo si no es futuro)
        const nextMonth = addMonths(currentMonth, 1);
        const currentDate = new Date();
        
        // Solo permitir navegar al siguiente mes si no supera el mes actual
        if (startOfMonth(nextMonth) <= startOfMonth(currentDate)) {
          setCurrentMonth(prev => addMonths(prev, 1));
        }
      }
    }

    touchStartRef.current = null;
  };

  // Date calculations
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const currentYear = new Date().getFullYear();
  
  // Queries with optimized intervals for better performance
  const { data: sessions = [], isLoading } = useQuery<WorkSession[]>({
    queryKey: ['/api/work-sessions'],
    staleTime: 60000,
    gcTime: 120000,
    refetchInterval: 15000, // Reduced from 3s to 15s
    refetchIntervalInBackground: false,
  });

  const { data: breakPeriods = [] } = useQuery<BreakPeriod[]>({
    queryKey: ['/api/break-periods'],
    staleTime: 60000,
    gcTime: 120000,
    refetchInterval: 15000, // Reduced from 3s to 15s
    refetchIntervalInBackground: false,
  });

  const { data: activeSession } = useQuery({
    queryKey: ['/api/work-sessions/active'],
    staleTime: 30000,
    gcTime: 60000,
    refetchInterval: 10000, // Reduced from 3s to 10s for active session
    refetchIntervalInBackground: false,
  });

  // Query for company work hours settings
  const { data: companySettings } = useQuery<{ workingHoursPerDay: number; name: string; alias: string }>({
    queryKey: ['/api/settings/work-hours'],
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
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

  // Clock out mutation for incomplete sessions
  const clockOutMutation = useMutation({
    mutationFn: async ({ sessionId, clockOutTime }: { sessionId: number; clockOutTime: string }) => {
      return apiRequest('POST', '/api/work-sessions/clock-out-incomplete', { 
        sessionId, 
        clockOutTime 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions/active'] });
      setIncompleteDialogOpen(false);
      setIncompleteSessionId(null);
      setClockOutTime('');
      toast({
        title: "Sesión cerrada",
        description: "La sesión incompleta se ha cerrado correctamente.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `No se pudo cerrar la sesión: ${error.message}`,
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

  // Function to determine if session is incomplete (from previous day)
  const isSessionIncomplete = (session: WorkSession) => {
    if (session.clockOut) return false; // Has clock out, not incomplete
    
    const clockIn = new Date(session.clockIn);
    const currentTime = new Date();
    const isToday = clockIn.toDateString() === currentTime.toDateString();
    
    // If session is from previous day and no clock out, it's incomplete
    if (!isToday) {
      return true;
    }
    
    // If session is from today, check if it exceeded working hours
    const hoursWorked = (currentTime.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
    const maxDailyHours = companySettings?.workingHoursPerDay || 8;
    
    // If exceeded max hours, it's still active for today but would be incomplete if from previous day
    return false; // Today's sessions are always "active" even if long
  };

  // Function to handle clock out for incomplete sessions
  const handleClockOutIncomplete = (sessionId: number) => {
    setIncompleteSessionId(sessionId);
    
    // Find the session to get clock in time
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      const clockInTime = new Date(session.clockIn);
      const maxHours = companySettings?.workingHoursPerDay || 8;
      
      // Add max working hours to clock in time
      const suggestedClockOut = new Date(clockInTime.getTime() + (maxHours * 60 * 60 * 1000));
      const suggestedTime = suggestedClockOut.toTimeString().slice(0, 5); // Format: "HH:MM"
      setClockOutTime(suggestedTime);
    } else {
      // Fallback to current time
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5);
      setClockOutTime(currentTime);
    }
    
    setIncompleteDialogOpen(true);
  };

  const submitClockOut = () => {
    if (!incompleteSessionId || !clockOutTime) return;
    
    // Find the session to get the original date
    const session = sessions.find(s => s.id === incompleteSessionId);
    if (!session) return;
    
    // Create clock out datetime using the session's original date + user's time input
    const sessionDate = new Date(session.clockIn);
    const [hours, minutes] = clockOutTime.split(':').map(Number);
    
    // Set the time on the same date as the session
    const clockOutDateTime = new Date(sessionDate);
    clockOutDateTime.setHours(hours, minutes, 0, 0);
    
    clockOutMutation.mutate({
      sessionId: incompleteSessionId,
      clockOutTime: clockOutDateTime.toISOString()
    });
  };

  // ⚠️ PROTECTED: Time formatting and calculation functions - DO NOT MODIFY
  // These functions are CRITICAL for accurate time display and calculations
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
    // Only calculate hours for completed sessions (with clockOut)
    if (!session.clockOut) {
      return 0; // Incomplete/active sessions don't count toward worked hours
    }
    
    const start = new Date(session.clockIn);
    const end = new Date(session.clockOut);
    
    // Calculate base work hours
    const totalHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    
    // Find break periods for this session and subtract them
    const sessionBreaks = breakPeriods.filter((breakPeriod: any) => 
      breakPeriod.workSessionId === session.id && 
      breakPeriod.status === 'completed'
    );
    
    const totalBreakHours = sessionBreaks.reduce((total: number, breakPeriod: any) => {
      return total + (parseFloat(breakPeriod.duration) || 0);
    }, 0);
    
    // Return net work hours (total time - break time)
    return Math.max(0, totalHours - totalBreakHours);
  };
  // ⚠️ END PROTECTED SECTION - Time calculation functions

  // ⚠️ PROTECTED: Statistical calculation functions - CRITICAL FOR CHARTS
  // Calculate hours for last 4 months for chart
  const getLast4MonthsData = () => {
    const months = [];
    for (let i = 3; i >= 0; i--) {
      const date = subMonths(currentMonth, i);
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);
      
      const monthSessions = sessions.filter((session: any) => {
        const sessionDate = new Date(session.clockIn);
        return sessionDate >= monthStart && sessionDate <= monthEnd;
      });
      
      const totalHours = monthSessions.reduce((total: number, session: any) => {
        return total + calculateSessionHours(session);
      }, 0);
      
      months.push({
        month: format(date, 'MMM', { locale: es }),
        hours: totalHours,
        isCurrentMonth: format(date, 'yyyy-MM') === format(new Date(), 'yyyy-MM')
      });
    }
    return months;
  };
  // ⚠️ END PROTECTED SECTION - Statistical calculation functions

  // Check if user can edit time
  const canEditTime = hasAccess('employee_time_edit');

  // Get sessions for current month
  const monthSessions = sessions.filter((session: WorkSession) => {
    const sessionDate = new Date(session.clockIn);
    return sessionDate >= monthStart && sessionDate <= monthEnd;
  });

  // Calculate total hours for the month
  const totalMonthHours = monthSessions.reduce((total: number, session: WorkSession) => {
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

  // ⚠️ PROTECTED: Mobile Timeline Rendering Function - CRITICAL FOR EMPLOYEE UI
  // DO NOT MODIFY - This function controls the complete visual display
  const renderMobileTimeline = (session: WorkSession) => {
    const sessionBreaks = breakPeriods.filter((bp: BreakPeriod) => bp.workSessionId === session.id);
    
    if (!session.clockOut) {
      const isIncomplete = isSessionIncomplete(session);
      const statusColor = isIncomplete ? "red" : "green";
      const statusText = isIncomplete ? "Incompleto" : "En curso";
      
      return (
        <div key={session.id} className="bg-white/10 backdrop-blur-sm rounded-xl p-3 mb-2 border border-white/20">
          <div className="flex justify-between items-center mb-2">
            <span className="text-white font-medium text-sm">{formatDayDate(new Date(session.clockIn))}</span>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className={`${
                statusColor === "red" 
                  ? "bg-red-500/20 text-red-300 border-red-500/30" 
                  : "bg-green-500/20 text-green-300 border-green-500/30"
              }`}>
                {statusText}
              </Badge>
              {isIncomplete && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 py-0 text-xs bg-red-500/20 border-red-500/50 text-red-300 hover:bg-red-500/30 hover:border-red-400"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClockOutIncomplete(session.id);
                  }}
                >
                  <LogOut className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2 mb-3">
            <div className={`w-3 h-3 ${
              statusColor === "red" 
                ? "bg-red-400 ring-2 ring-red-400/30" 
                : "bg-green-400"
            } rounded-full ${statusColor === "green" ? "animate-pulse" : ""}`}></div>
            <span className="text-white/90 text-sm">Entrada: {formatTime(session.clockIn)}</span>
          </div>
          
          <div className="text-center text-white/60 text-xs py-2">
            {isIncomplete ? "Sesión incompleta - marcar salida" : "Sesión activa - ficha para terminar"}
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
        className="bg-white/10 backdrop-blur-sm rounded-xl p-2 mb-2 border border-white/20 cursor-pointer"
        onClick={() => toggleDayExpansion(`${formatDayDate(new Date(session.clockIn))}-${session.id}`)}
      >
        {/* Header with date and total hours - alineado con barra azul */}
        <div className="flex justify-between items-center mb-3 mx-2">
          <span className="text-white font-medium text-sm">{formatDayDate(new Date(session.clockIn))}</span>
          <div className="flex items-center space-x-2">
            <span className="text-white/90 font-mono text-sm">
              {session.clockOut ? formatTotalHours(calculateSessionHours(session)) : '0h 0m'}
            </span>
            {!session.clockOut && (
              <span className="text-red-400 text-xs bg-red-500/20 px-2 py-1 rounded-full">
                Incompleto
              </span>
            )}
          </div>
        </div>

        {/* Admin-style timeline bar - ancho completo */}
        <div className="relative h-6 mb-4 mx-2">
            {/* Main session bar - h-5 like admin, ancho completo del contenedor */}
            <div
              className={`absolute top-0 h-5 rounded-sm w-full ${!session.clockOut ? 'bg-red-500' : 'bg-blue-500'}`}
              style={{
                left: '0%',
                width: '100%'
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
              
              return (
                <div
                  key={`break-${breakIndex}`}
                  className="absolute top-0.5 h-4 bg-orange-400 rounded-sm"
                  style={{
                    left: `${breakLeftPercentageInSession}%`,
                    width: `${breakWidthPercentageInSession}%`
                  }}
                />
              );
            })}
            
            {/* Puntos de entrada/salida debajo de la barra - solo cuando está expandido */}
            {expandedDays.has(`${formatDayDate(new Date(session.clockIn))}-${session.id}`) && (
              <>
                {/* Punto de entrada - verde sólido, extremo izquierdo debajo de la barra */}
                <div
                  className="absolute w-3 h-3 bg-green-500 rounded-full"
                  style={{
                    left: '0%',
                    top: '24px', // Debajo de la barra h-5
                    transform: 'translateX(0%)'
                  }}
                />
                
                {/* Punto de salida - rojo sólido, extremo derecho debajo de la barra */}
                <div
                  className="absolute w-3 h-3 bg-red-500 rounded-full"
                  style={{
                    left: '100%',
                    top: '24px', // Debajo de la barra h-5
                    transform: 'translateX(-100%)'
                  }}
                />
              </>
            )}
          </div>

        {/* Detalles de horarios - solo cuando está expandido */}
        {expandedDays.has(`${formatDayDate(new Date(session.clockIn))}-${session.id}`) && (
          <div className="mx-2 mb-3 space-y-2">
            {/* Horarios de entrada y salida */}
            <div className="flex justify-between text-xs">
              <span className="text-green-400">{sessionStart.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
              <span className="text-red-400">{sessionEnd.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
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
  // ⚠️ END PROTECTED SECTION - Mobile Timeline Rendering Function

  return (
    <div 
      className="min-h-screen bg-employee-gradient text-white overflow-x-hidden" 
      style={{ overflowX: 'clip' }}
    >
      {/* Header - Standard employee pattern */}
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
              src={company.logoUrl || ''} 
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

      {/* Page title */}
      <div className="px-6 pb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Control de Tiempo</h1>
        <p className="text-white/70 text-sm">Revisa tu historial de fichajes y horas trabajadas</p>
      </div>

      {/* Month navigation - Fixed height */}
      <div className="flex items-center justify-between px-6 mb-6 h-12">
        <button
          onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
          className="text-white/70 hover:text-white hover:bg-white/5 p-2 rounded-lg transition-all duration-200"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        
        <h2 className="text-xl font-semibold text-white text-center min-w-0 flex-1">
          {format(currentMonth, 'MMMM yyyy', { locale: es })}
        </h2>
        
        {/* Flecha hacia adelante - solo si no es el mes actual */}
        {format(currentMonth, 'yyyy-MM') < format(new Date(), 'yyyy-MM') ? (
          <button
            onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
            className="text-white/70 hover:text-white hover:bg-white/5 p-2 rounded-lg transition-all duration-200"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        ) : (
          <div className="w-9 h-9 p-2" /> /* Spacer para mantener layout */
        )}
      </div>

      {/* Month Total Hours with 4 Month Statistics */}
      <div 
        className="px-6 mb-6"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
          {/* Total del mes */}
          <div className="text-center mb-4">
            <p className="text-white/70 text-sm mb-1">Total del mes</p>
            <p className="text-2xl font-bold text-white">{formatTotalHours(totalMonthHours)}</p>
          </div>
          
          {/* 4 Month Statistics - Mini Charts */}
          <div className="grid grid-cols-4 gap-3">
            {getLast4MonthsData().map((monthData, index) => {
              const isViewingThisMonth = format(currentMonth, 'MMM', { locale: es }) === monthData.month;
              const monthDate = subMonths(currentMonth, 3 - index);
              
              const handleMonthClick = () => {
                setCurrentMonth(monthDate);
              };
              
              return (
                <div 
                  key={monthData.month}
                  onClick={handleMonthClick}
                  className={`bg-white/5 backdrop-blur-sm rounded-lg p-3 border transition-all duration-500 cursor-pointer hover:scale-105 ${
                    isViewingThisMonth 
                      ? 'ring-2 ring-blue-400 bg-blue-500/20 border-blue-400/50' 
                      : monthData.isCurrentMonth 
                        ? 'ring-1 ring-green-400/50 bg-green-500/10 border-green-400/30' 
                        : 'border-white/10 hover:border-white/30'
                  }`}
                  style={{
                    animationDelay: `${index * 100}ms`,
                    animation: 'fadeInUp 0.6s ease-out forwards',
                    opacity: 0
                  }}
                >
                  <div className="text-center">
                    <p className={`text-xs mb-1 font-medium ${
                      isViewingThisMonth ? 'text-blue-300' : 'text-white/60'
                    }`}>
                      {monthData.month}
                    </p>
                    <div className="relative h-10 mb-1 px-1">
                      <div className={`absolute bottom-0 left-0 right-0 rounded-t-sm transition-all duration-700 ${
                        isViewingThisMonth ? 'bg-blue-400' : 'bg-blue-400'
                      }`}
                           style={{ 
                             '--final-height': `${(monthData.hours / Math.max(...getLast4MonthsData().map(m => m.hours), 1)) * 100}%`,
                             height: '0px',
                             minHeight: monthData.hours > 0 ? '6px' : '0px',
                             animationDelay: `${index * 150 + 300}ms`,
                             animation: 'growHeight 1.2s ease-out forwards'
                           } as React.CSSProperties}
                      />
                    </div>
                    <p className={`text-xs font-mono ${
                      isViewingThisMonth ? 'text-blue-200' : 'text-white'
                    }`}>
                      {monthData.hours.toFixed(0)}h
                    </p>
                  </div>
                </div>
              );
            })}
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
              .sort((a: WorkSession, b: WorkSession) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime());
            
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
              const weekTotal = weekSessions.reduce((total: number, session: WorkSession) => total + calculateSessionHours(session), 0);
              
              // Contenedor de semana
              result.push(
                <div key={`week-${weekKey}`} className="bg-white/5 backdrop-blur-sm rounded-xl p-4 mb-4 border border-white/10">
                  {/* Header de semana */}
                  <div className="flex justify-between items-center mb-4 pb-3 border-b border-white/10">
                    <h3 className="text-white font-medium text-sm">
                      {format(weekStart, 'MMMM', { locale: es })} semana del {format(weekStart, 'dd', { locale: es })}-{format(addDays(weekStart, 6), 'dd', { locale: es })}
                    </h3>
                    <span className="text-blue-300 font-mono text-sm bg-blue-400/20 px-2 py-1 rounded-lg">
                      {formatTotalHours(weekTotal)}
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
                        
                        // Check if any session in the day is incomplete/active
                        const hasIncompleteSession = sortedDaySessions.some(s => !s.clockOut);
                        
                        if (sortedDaySessions.length === 1 || hasIncompleteSession) {
                          // Single session OR any incomplete session - render individually
                          return sortedDaySessions.map(session => renderMobileTimeline(session));
                        } else {
                          // Multiple completed sessions - group them
                          const dayTotal = sortedDaySessions.reduce((total: number, session: WorkSession) => 
                            total + calculateSessionHours(session), 0
                          );
                          
                          return (
                            <div 
                              key={`day-${dayKey}`} 
                              className="bg-white/10 backdrop-blur-sm rounded-xl p-2 mb-2 border border-white/20 cursor-pointer"
                              onClick={() => toggleDayExpansion(`${formatDayDate(new Date(dayKey))}-multi`)}
                            >
                              {/* Header with date and total hours - alineado con barra azul */}
                              <div className="flex justify-between items-center mb-3 mx-2">
                                <span className="text-white font-medium text-sm">
                                  {formatDayDate(new Date(dayKey))}
                                </span>
                                <div className="flex items-center space-x-2">
                                  <span className="text-white/90 font-mono text-sm">
                                    {dayTotal > 0 ? formatTotalHours(dayTotal) : '0h 0m'}
                                  </span>
                                  {sortedDaySessions.some(s => !s.clockOut) && (
                                    <span className="text-red-400 text-xs bg-red-500/20 px-2 py-1 rounded-full">
                                      Incompleto
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Multiple session bars - en la misma línea horizontal */}
                              <div className="relative h-6 mb-4 mx-2">
                                {/* Session bars */}
                                {sortedDaySessions.map((session, sessionIndex) => {
                                  // Show all sessions, use different styling for active/incomplete ones
                  const isIncompleteOrActive = !session.clockOut;
                                  
                                  // Calcular ancho con gap más visible entre sesiones
                                  const gapPercentage = 1.5; // 1.5% de gap entre sesiones
                                  const totalGaps = (sortedDaySessions.length - 1) * gapPercentage;
                                  const sessionWidth = (100 - totalGaps) / sortedDaySessions.length;
                                  const sessionLeft = sessionIndex * (sessionWidth + gapPercentage);
                                  
                                  return (
                                    <div
                                      key={`session-bar-${session.id}`}
                                      className={`absolute top-0 h-5 rounded-sm ${isIncompleteOrActive ? 'bg-red-500' : 'bg-blue-500'}`}
                                      style={{
                                        left: `${sessionLeft}%`,
                                        width: `${sessionWidth}%`
                                      }}
                                    />
                                  );
                                })}
                                
                                {/* Break periods */}
                                {sortedDaySessions.map((session, sessionIndex) => {
                                  if (!session.clockOut) return null;
                                  
                                  const sessionStart = new Date(session.clockIn);
                                  const sessionEnd = new Date(session.clockOut);
                                  const sessionBreaks = breakPeriods.filter((bp: BreakPeriod) => bp.workSessionId === session.id);
                                  const sessionDuration = (sessionEnd.getTime() - sessionStart.getTime()) / (1000 * 60 * 60);
                                  
                                  // Usar mismo cálculo de gap que las barras de sesión
                                  const gapPercentage = 1.5;
                                  const totalGaps = (sortedDaySessions.length - 1) * gapPercentage;
                                  const sessionWidth = (100 - totalGaps) / sortedDaySessions.length;
                                  const sessionLeft = sessionIndex * (sessionWidth + gapPercentage);
                                  
                                  return sessionBreaks.map((breakPeriod: BreakPeriod, breakIndex: number) => {
                                    if (!breakPeriod.breakEnd) return null;
                                    
                                    const breakStart = new Date(breakPeriod.breakStart);
                                    const breakEnd = new Date(breakPeriod.breakEnd);
                                    
                                    const breakStartRelativeToSession = (breakStart.getTime() - sessionStart.getTime()) / (1000 * 60 * 60);
                                    const breakDuration = (breakEnd.getTime() - breakStart.getTime()) / (1000 * 60 * 60);
                                    
                                    const breakLeftPercentageInSession = (breakStartRelativeToSession / sessionDuration) * 100;
                                    const breakWidthPercentageInSession = Math.max((breakDuration / sessionDuration) * 100, 2);
                                    
                                    const adjustedBreakLeft = sessionLeft + (breakLeftPercentageInSession * sessionWidth / 100);
                                    const adjustedBreakWidth = (breakWidthPercentageInSession * sessionWidth / 100);
                                    
                                    return (
                                      <div
                                        key={`break-${session.id}-${breakIndex}`}
                                        className="absolute top-0.5 h-4 bg-orange-400 rounded-sm cursor-pointer"
                                        style={{
                                          left: `${adjustedBreakLeft}%`,
                                          width: `${adjustedBreakWidth}%`
                                        }}
                                        title={`Descanso: ${formatTime(breakPeriod.breakStart)} - ${formatTime(breakPeriod.breakEnd!)} (${Math.floor((breakEnd.getTime() - breakStart.getTime()) / (1000 * 60))} min)`}
                                      />
                                    );
                                  });
                                })}
                                
                                {/* Entry/Exit points when expanded */}
                                {expandedDays.has(`${formatDayDate(new Date(dayKey))}-multi`) && sortedDaySessions.map((session, sessionIndex) => {
                                  if (!session.clockOut) return null;
                                  
                                  // Usar mismo cálculo de gap que las barras de sesión
                                  const gapPercentage = 1.5;
                                  const totalGaps = (sortedDaySessions.length - 1) * gapPercentage;
                                  const sessionWidth = (100 - totalGaps) / sortedDaySessions.length;
                                  const sessionLeft = sessionIndex * (sessionWidth + gapPercentage);
                                  
                                  return (
                                    <div key={`points-${session.id}`}>
                                      {/* Punto de entrada */}
                                      <div
                                        className="absolute w-3 h-3 bg-green-500 rounded-full"
                                        style={{
                                          left: `${sessionLeft}%`,
                                          top: '24px',
                                          transform: 'translateX(0%)'
                                        }}
                                      />
                                      {/* Punto de salida */}
                                      <div
                                        className="absolute w-3 h-3 bg-red-500 rounded-full"
                                        style={{
                                          left: `${sessionLeft + sessionWidth}%`,
                                          top: '24px',
                                          transform: 'translateX(-100%)'
                                        }}
                                      />
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
                                        <div className="flex justify-between text-xs">
                                          <span className="text-green-400">{sessionStart.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                                          <span className="text-red-400">{sessionEnd.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
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
      
      {/* Dialog for incomplete session clock out */}
      <Dialog open={incompleteDialogOpen} onOpenChange={setIncompleteDialogOpen}>
        <DialogContent className="sm:max-w-xs max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">Cerrar Sesión Incompleta</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="text-center text-sm text-gray-600">
              Introduce la hora de salida para cerrar esta sesión incompleta:
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 text-center">
                Hora de salida
              </label>
              <div className="flex justify-center">
                <Input
                  type="time"
                  value={clockOutTime}
                  onChange={(e) => setClockOutTime(e.target.value)}
                  className="text-center w-32 text-lg font-mono"
                  placeholder="HH:MM"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setIncompleteDialogOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={submitClockOut}
                disabled={clockOutMutation.isPending || !clockOutTime}
                className="flex-1"
              >
                {clockOutMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  'Cerrar Sesión'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}