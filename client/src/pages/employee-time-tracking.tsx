import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, BarChart3 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, differenceInMinutes, parseISO, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { useLocation, Link } from 'wouter';

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
  const [currentDate, setCurrentDate] = useState(new Date());
  const [location] = useLocation();
  const companyAlias = location.split('/')[1] || 'test';

  // Touch/swipe handling
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const minSwipeDistance = 50;

  // Get work sessions for current user
  const { data: workSessions = [] } = useQuery<WorkSession[]>({
    queryKey: ['/api/work-sessions'],
  });

  // Filter sessions for current month
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  
  const monthSessions = workSessions.filter(session => {
    const sessionDate = new Date(session.clockIn);
    return sessionDate >= monthStart && sessionDate <= monthEnd;
  });

  // Calculate total hours for the month correctly
  const calculateSessionHours = (session: WorkSession) => {
    if (!session.clockOut) return 0;
    
    const clockIn = parseISO(session.clockIn);
    const clockOut = parseISO(session.clockOut);
    const totalMinutes = differenceInMinutes(clockOut, clockIn);
    
    return totalMinutes / 60; // Convert to hours
  };

  const totalMonthHours = monthSessions.reduce((total, session) => {
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

  return (
    <div className="min-h-screen bg-employee-gradient text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 pb-8">
        <Link href={`/${companyAlias}/dashboard`}>
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
              className="w-8 h-8 mb-1 rounded-full object-cover"
            />
          ) : (
            <div className="text-white text-sm font-medium mb-1">
              {company?.name || 'Mi Empresa'}
            </div>
          )}
          <div className="text-base font-medium text-white">{user?.fullName}</div>
        </div>
      </div>

      {/* Modern Title */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-light text-white/90 tracking-wide">Fichajes</h1>
      </div>

      {/* 4-Month Hours Chart */}
      <div className="px-6 mb-8">
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
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
                    className={`w-full rounded-t-lg transition-all duration-700 absolute bottom-0 ${
                      data.isCurrentMonth ? 'bg-blue-500 shadow-lg shadow-blue-500/30' : 'bg-white/40'
                    }`}
                    style={{ 
                      height: `${Math.max((data.hours / maxHours) * 100, data.hours > 0 ? 15 : 0)}%`
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Month Navigation */}
      <div 
        className="flex items-center justify-between px-6 mb-4"
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
          <div className="w-10 h-10" /> // Spacer to maintain layout
        )}
      </div>

      {/* Month Total Hours */}
      <div 
        className="px-6 mb-6"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
          <div className="text-center">
            <p className="text-white/70 text-sm mb-1">Total del mes</p>
            <p className="text-2xl font-bold text-white">{formatTotalHours(totalMonthHours)}</p>
          </div>
        </div>
      </div>

      {/* Table Container - Fixed height to prevent layout shift */}
      <div 
        className="px-4 mb-6 flex-1"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="bg-white/5 rounded-lg overflow-hidden h-full min-h-96">
          {/* Table Header */}
          <div className="grid grid-cols-4 bg-white/10 py-3 px-4">
            <div className="text-sm font-semibold text-center">Fecha</div>
            <div className="text-sm font-semibold text-center">Entrada</div>
            <div className="text-sm font-semibold text-center">Salida</div>
            <div className="text-sm font-semibold text-center">Total</div>
          </div>

          {/* Table Body */}
          <div className="h-full overflow-y-auto scrollbar-thin" style={{ maxHeight: 'calc(100vh - 500px)', minHeight: '300px' }}>
            {monthSessions.length > 0 ? (
              monthSessions
                .sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime())
                .map((session) => (
                  <div
                    key={session.id}
                    className="grid grid-cols-4 py-3 px-4 border-b border-white/10 hover:bg-white/5"
                  >
                    <div className="text-sm text-center text-white/90 whitespace-nowrap">
                      {formatDate(session.clockIn)}
                    </div>
                    <div className="text-sm text-center font-mono">
                      {formatTime(session.clockIn)}
                    </div>
                    <div className="text-sm text-center font-mono">
                      {session.clockOut ? formatTime(session.clockOut) : '-'}
                    </div>
                    <div className="text-sm text-center font-mono font-semibold">
                      {session.clockOut ? formatTotalHours(calculateSessionHours(session)) : '-'}
                    </div>
                  </div>
                ))
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
      <div className="text-center pb-4 mt-auto">
        <div className="flex items-center justify-center space-x-1 text-gray-400 text-xs">
          <span className="font-semibold text-blue-400">Oficaz</span>
          <span>© {currentYear}</span>
        </div>
      </div>
    </div>
  );
}