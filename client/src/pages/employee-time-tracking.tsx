import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFeatureCheck } from '@/hooks/use-feature-check';
import { FeatureRestrictedPage } from '@/components/feature-restricted-page';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { PageLoading } from '@/components/ui/page-loading';
import { Input } from '@/components/ui/input';
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, BarChart3, Edit3, Save, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, differenceInMinutes, parseISO, subMonths, startOfWeek, isSameWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { useLocation, Link } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface WorkSession {
  id: number;
  userId: number;
  clockIn: string;
  clockOut?: string;
  totalHours?: string;
  createdAt: string;
}

export default function EmployeeTimeTracking() {
  const { user, company } = useAuth();
  const { hasAccess, getRequiredPlan } = useFeatureCheck();
  
  // Check if user has access to time tracking feature
  if (!hasAccess('timeTracking')) {
    return (
      <FeatureRestrictedPage
        featureName="Control de Tiempo"
        description="Registro de fichajes y control horario"
        requiredPlan={getRequiredPlan('timeTracking')}
        icon={Clock}
      />
    );
  }
  const [currentDate, setCurrentDate] = useState(new Date());
  const [location] = useLocation();
  const urlParts = location.split('/').filter(part => part.length > 0);
  const companyAlias = urlParts[0] || company?.companyAlias || 'test';
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Touch/swipe handling
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Editing functionality
  const [editingSession, setEditingSession] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    clockIn: '',
    clockOut: ''
  });

  const minSwipeDistance = 50;

  // Update work session mutation
  const updateSessionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { clockIn: string; clockOut?: string } }) => {
      return apiRequest('PATCH', `/api/work-sessions/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions'] });
      setEditingSession(null);
      toast({
        title: 'Fichaje actualizado',
        description: 'Los horarios han sido modificados correctamente.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar el fichaje',
        variant: 'destructive',
      });
    },
  });

  // Get work sessions for current user
  const { data: workSessions = [], isLoading } = useQuery<WorkSession[]>({
    queryKey: ['/api/work-sessions'],
    enabled: !!user,
    staleTime: 30000, // Cache for 30 seconds to reduce API calls
  });

  // Check if user can edit time entries based on company configuration
  const canEditTime = company?.employeeTimeEditPermission === 'yes';



  // Filter sessions for current month + complete weeks that span across months
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  
  // Get sessions for the month
  const strictMonthSessions = workSessions.filter(session => {
    const sessionDate = new Date(session.clockIn);
    return sessionDate >= monthStart && sessionDate <= monthEnd;
  });
  
  // Get all weeks that have at least one session in the current month
  const monthWeeks = new Set();
  strictMonthSessions.forEach(session => {
    const sessionDate = new Date(session.clockIn);
    const weekStart = startOfWeek(sessionDate, { weekStartsOn: 1 });
    monthWeeks.add(weekStart.getTime());
  });
  
  // Include all sessions from weeks that intersect with the current month
  const monthSessions = workSessions.filter(session => {
    const sessionDate = new Date(session.clockIn);
    const weekStart = startOfWeek(sessionDate, { weekStartsOn: 1 });
    return monthWeeks.has(weekStart.getTime());
  });

  // Calculate total hours for the month correctly
  const calculateSessionHours = (session: WorkSession) => {
    if (!session.clockOut) return 0;
    
    const clockIn = parseISO(session.clockIn);
    const clockOut = parseISO(session.clockOut);
    const totalMinutes = differenceInMinutes(clockOut, clockIn);
    
    return totalMinutes / 60; // Convert to hours
  };

  // Calculate total only for sessions that actually belong to the current month
  const totalMonthHours = strictMonthSessions.reduce((total, session) => {
    return total + calculateSessionHours(session);
  }, 0);

  const formatTotalHours = (hours: number) => {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return `${wholeHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const goToNextMonth = () => {
    const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1);
    const currentMonth = new Date();
    
    // Don't allow going beyond current month
    if (nextMonth <= currentMonth) {
      setCurrentDate(nextMonth);
    }
  };

  // Double click/tap handlers for editing
  const [lastTap, setLastTap] = useState<number>(0);

  const handleDoubleClick = (session: WorkSession) => {
    if (canEditTime) {
      startEditing(session);
    }
  };

  const handleTouchEnd = (session: WorkSession) => {
    if (!canEditTime) return;
    
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTap;
    
    if (tapLength < 500 && tapLength > 0) {
      // Double tap detected
      startEditing(session);
    }
    
    setLastTap(currentTime);
  };

  const startEditing = (session: WorkSession) => {
    if (!canEditTime) return;
    
    setEditingSession(session.id);
    setEditForm({
      clockIn: format(new Date(session.clockIn), 'HH:mm'),
      clockOut: session.clockOut ? format(new Date(session.clockOut), 'HH:mm') : ''
    });
  };

  const cancelEditing = () => {
    setEditingSession(null);
    setEditForm({ clockIn: '', clockOut: '' });
  };

  const saveEdit = () => {
    if (!editingSession) return;
    
    const session = workSessions.find(s => s.id === editingSession);
    if (!session) return;

    const sessionDate = format(new Date(session.clockIn), 'yyyy-MM-dd');
    const newClockIn = `${sessionDate}T${editForm.clockIn}:00.000Z`;
    const newClockOut = editForm.clockOut ? `${sessionDate}T${editForm.clockOut}:00.000Z` : undefined;

    updateSessionMutation.mutate({
      id: editingSession,
      data: {
        clockIn: newClockIn,
        clockOut: newClockOut
      }
    });
  };

  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const dayNames = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
    const dayOfWeek = dayNames[getDay(date)];
    const day = date.getDate().toString().padStart(2, '0');
    const month = format(date, 'MMM', { locale: es }).substring(0, 3);
    const year = date.getFullYear().toString().slice(-2);
    
    return `${dayOfWeek} ${day}/${month}/${year}`;
  };

  const monthName = format(currentDate, 'MMMM yyyy', { locale: es });
  const currentYear = new Date().getFullYear();

  // Navigate to current month
  const goToCurrentMonth = () => {
    setCurrentDate(new Date());
  };

  // Touch event handlers for swipe navigation
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    // Only update touchEnd, don't trigger any navigation during move
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    // Only execute navigation at the end of the gesture
    if (isLeftSwipe) {
      // Swipe left = next month (if allowed)
      const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1);
      const currentMonth = new Date();
      if (nextMonth <= currentMonth) {
        setCurrentDate(nextMonth);
      }
    } else if (isRightSwipe) {
      // Swipe right = previous month
      goToPreviousMonth();
    }
    
    // Reset touch states
    setTouchStart(null);
    setTouchEnd(null);
  };

  // Calculate hours for last 4 months for chart
  const getLast4MonthsData = () => {
    const months = [];
    for (let i = 3; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);
      
      const monthSessions = workSessions.filter(session => {
        const sessionDate = new Date(session.clockIn);
        return sessionDate >= monthStart && sessionDate <= monthEnd;
      });
      
      const totalHours = monthSessions.reduce((total, session) => {
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

  const last4MonthsData = getLast4MonthsData();
  const maxHours = Math.max(...last4MonthsData.map(m => m.hours), 1);

  // Show loading state
  if (isLoading) {
    return <PageLoading />;
  }

  return (
    <div className="min-h-screen bg-employee-gradient text-white flex flex-col page-scroll">
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
          {company?.logoUrl ? (
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
        <h1 className="text-3xl font-bold text-white mb-2">Control de Tiempo</h1>
        <p className="text-white/70 text-sm">
          Gestiona tus fichajes y consulta tus horas trabajadas
        </p>
      </div>

      {/* 4-Month Hours Chart */}
      <div 
        className="px-6 mb-8"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="bg-white/8 backdrop-blur-xl rounded-2xl p-6 border border-white/10 shadow-2xl">
          <div className="flex items-center mb-6">
            <BarChart3 className="h-5 w-5 mr-2 text-blue-400" />
            <h3 className="text-sm font-medium text-white/80">Últimos 4 meses</h3>
          </div>
          <div className="flex items-end justify-between h-24 space-x-3">
            {last4MonthsData.map((data, index) => (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div className="text-xs text-white/60 mb-2 capitalize">{data.month}</div>
                <div className="text-xs text-white/80 font-medium mb-2">
                  {formatTotalHours(data.hours)}
                </div>
                <div className="w-full bg-white/10 rounded-t-lg overflow-hidden relative" style={{ height: '70px' }}>
                  <div 
                    className={`w-full rounded-t-lg absolute bottom-0 ${
                      data.isCurrentMonth ? 'bg-gradient-to-t from-blue-500 to-blue-400 shadow-lg shadow-blue-500/30' : 'bg-white/40'
                    }`}
                    style={{ 
                      '--final-height': `${Math.max((data.hours / maxHours) * 100, data.hours > 0 ? 15 : 0)}%`,
                      animation: `slideUp 800ms ease-out ${500 + index * 150}ms both`
                    } as React.CSSProperties}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Month Navigation - Fixed height */}
      <div 
        className="flex items-center justify-between px-6 mb-4 h-16"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={goToPreviousMonth}
          className="text-white hover:bg-white/10 p-2 rounded-xl"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
        
        <button 
          onClick={goToCurrentMonth}
          className="text-xl font-semibold capitalize text-white hover:text-blue-300 transition-colors duration-200 cursor-pointer"
        >
          {monthName}
        </button>
        
        {format(currentDate, 'yyyy-MM') < format(new Date(), 'yyyy-MM') ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={goToNextMonth}
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

      {/* Table Container - Dynamic height with touch events */}
      <div 
        className="px-6 mb-6"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="bg-white/5 rounded-lg overflow-hidden" style={{ backgroundColor: 'rgba(50, 58, 70, 0.8)' }}>
          {/* Table Header */}
          <div className="grid grid-cols-4 bg-white/10 py-3 px-4">
            <div className="text-sm font-semibold text-center">Fecha</div>
            <div className="text-sm font-semibold text-center">Entrada</div>
            <div className="text-sm font-semibold text-center">Salida</div>
            <div className="text-sm font-semibold text-center">Total</div>
          </div>

          {/* Table Body - No internal scroll with touch events */}
          <div 
            className="w-full" 
            style={{ 
              backgroundColor: 'rgba(50, 58, 70, 0.6)'
            }}
          >
            {monthSessions.length > 0 ? (
              (() => {
                const sortedSessions = monthSessions
                  .sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime());
                
                let currentWeekStart: Date | null = null;
                let previousWeekStart: Date | null = null;
                
                // Calculate weekly totals
                const calculateWeekTotal = (weekStart: Date) => {
                  return sortedSessions
                    .filter(session => {
                      const sessionWeekStart = startOfWeek(new Date(session.clockIn), { weekStartsOn: 1 });
                      return sessionWeekStart.getTime() === weekStart.getTime();
                    })
                    .reduce((total, session) => total + calculateSessionHours(session), 0);
                };
                
                const result = sortedSessions.map((session, index) => {
                  const sessionDate = new Date(session.clockIn);
                  const weekStart = startOfWeek(sessionDate, { weekStartsOn: 1 }); // Monday start
                  
                  // Check if this is a new week
                  const isNewWeek = currentWeekStart === null || 
                    weekStart.getTime() !== currentWeekStart.getTime();
                  
                  if (isNewWeek) {
                    previousWeekStart = currentWeekStart;
                    currentWeekStart = weekStart;
                  }
                  
                  return (
                    <div key={session.id}>
                      {/* Week separator with total - only show if it's a new week and not the first item */}
                      {isNewWeek && index > 0 && previousWeekStart && (
                        <div className="border-t-2 border-blue-400/30 bg-blue-400/10 py-2 px-4">
                          <div className="text-center text-sm font-semibold text-blue-300">
                            Total semana: {formatTotalHours(calculateWeekTotal(previousWeekStart))}
                          </div>
                        </div>
                      )}
                      {(() => {
                        const sessionDate = new Date(session.clockIn);
                        const isCurrentMonth = sessionDate >= monthStart && sessionDate <= monthEnd;
                        const opacity = isCurrentMonth ? 'text-white/90' : 'text-white/50';
                        const bgOpacity = isCurrentMonth ? 'hover:bg-white/5' : 'hover:bg-white/3';
                        
                        return editingSession === session.id && canEditTime ? (
                          // Editing mode - Expanded row with maintained separators  
                          <div className="border-b border-white/10 bg-blue-500/10 relative py-4 px-4">
                            {/* Date header */}
                            <div className="text-sm text-center text-white/90 mb-4 font-medium">
                              {formatDate(session.clockIn)}
                            </div>
                            
                            {/* Time inputs perfectly centered */}
                            <div className="flex justify-center gap-6 mb-4">
                              <div className="flex flex-col items-center space-y-2">
                                <label className="text-xs text-white/70 font-medium">Entrada</label>
                                <Input
                                  type="time"
                                  value={editForm.clockIn}
                                  onChange={(e) => setEditForm({ ...editForm, clockIn: e.target.value })}
                                  className="h-10 w-24 text-center bg-white/10 border-white/20 text-white text-sm rounded-lg"
                                />
                              </div>
                              <div className="flex flex-col items-center space-y-2">
                                <label className="text-xs text-white/70 font-medium">Salida</label>
                                <Input
                                  type="time"
                                  value={editForm.clockOut}
                                  onChange={(e) => setEditForm({ ...editForm, clockOut: e.target.value })}
                                  className="h-10 w-24 text-center bg-white/10 border-white/20 text-white text-sm rounded-lg"
                                />
                              </div>
                            </div>

                            {/* Total and action buttons with better spacing */}
                            <div className="flex justify-between items-center pt-2">
                              <div className="text-sm text-white/80">
                                <span className="font-medium">Total: </span>
                                <span className="font-mono">
                                  {editForm.clockIn && editForm.clockOut ? 
                                    formatTotalHours(
                                      (new Date(`2000-01-01T${editForm.clockOut}:00`).getTime() - 
                                       new Date(`2000-01-01T${editForm.clockIn}:00`).getTime()) / (1000 * 60 * 60)
                                    ) : '-'
                                  }
                                </span>
                              </div>
                              <div className="flex gap-3">
                                <Button
                                  size="sm"
                                  onClick={saveEdit}
                                  disabled={updateSessionMutation.isPending}
                                  className="h-9 w-9 p-0 bg-green-600 hover:bg-green-700 rounded-lg"
                                >
                                  <Save className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={cancelEditing}
                                  className="h-9 w-9 p-0 bg-red-600 hover:bg-red-700 rounded-lg"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          // Normal mode with double click/tap
                          <div 
                            className={`grid grid-cols-4 py-3 px-4 border-b border-white/10 ${bgOpacity} relative select-none cursor-pointer`}
                            onDoubleClick={() => handleDoubleClick(session)}
                            onTouchEnd={() => handleTouchEnd(session)}
                          >
                            <div className={`text-sm text-center ${opacity} whitespace-nowrap ${!isCurrentMonth ? 'italic' : ''}`}>
                              {formatDate(session.clockIn)}
                            </div>
                            <div className={`text-sm text-center font-mono ${opacity}`}>
                              {formatTime(session.clockIn)}
                            </div>
                            <div className={`text-sm text-center font-mono ${opacity}`}>
                              {session.clockOut ? formatTime(session.clockOut) : '-'}
                            </div>
                            <div className={`text-sm text-center font-mono font-semibold ${opacity}`}>
                              {session.clockOut ? formatTotalHours(calculateSessionHours(session)) : '-'}
                            </div>
                            {/* Edit indicator - only show if editing is allowed */}
                            {canEditTime && (
                              <div className="absolute inset-0 flex items-center justify-end pr-2 pointer-events-none">
                                <Edit3 className="h-3 w-3 text-white/20" />
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                });
                
                // Add total for the last (most recent) week at the end
                if (currentWeekStart) {
                  result.push(
                    <div key="current-week-total" className="border-t-2 border-blue-400/30 bg-blue-400/10 py-2 px-4">
                      <div className="text-center text-sm font-semibold text-blue-300">
                        Total semana: {formatTotalHours(calculateWeekTotal(currentWeekStart))}
                      </div>
                    </div>
                  );
                }
                
                return result;
              })()
            ) : isLoading ? (
              <div className="flex items-center justify-center h-full min-h-48">
                <div className="text-center text-white/60">
                  <LoadingSpinner size="lg" className="mx-auto mb-3 text-white" />
                  <p>Cargando fichajes...</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full min-h-48">
                <div className="text-center text-white/60">
                  <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No hay fichajes este mes</p>
                </div>
              </div>
            )}
          </div>
        </div>
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