import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
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
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [location] = useLocation();
  const companyAlias = location.split('/')[1] || 'test';

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

  // Calculate total hours for the month
  const totalMonthHours = monthSessions.reduce((total, session) => {
    if (session.totalHours) {
      const [hours, minutes] = session.totalHours.split(':').map(Number);
      return total + hours + (minutes / 60);
    }
    return total;
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
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
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
    const day = date.getDate();
    const month = format(date, 'MMM', { locale: es });
    const year = date.getFullYear().toString().slice(-2);
    
    return `${dayOfWeek} ${day} ${month} ${year}`;
  };

  const monthName = format(currentDate, 'MMMM yyyy', { locale: es });

  return (
    <div className="min-h-screen bg-employee-gradient text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-6 pb-4">
        <Link href={`/${companyAlias}/dashboard`}>
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/10 p-2"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="ml-2">Atrás</span>
          </Button>
        </Link>
        
        <div className="flex items-center space-x-2">
          <div className="text-2xl font-bold text-blue-400">Oficaz</div>
          <div className="w-6 h-6 bg-blue-400 rounded-full flex items-center justify-center">
            <div className="w-3 h-3 bg-white rounded-full"></div>
          </div>
        </div>
        
        <div className="text-lg font-medium">{user?.fullName}</div>
      </div>

      {/* Title */}
      <div className="flex items-center justify-center mb-8">
        <Clock className="h-8 w-8 mr-3" />
        <h1 className="text-2xl font-bold">FICHAJES</h1>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between px-6 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={goToPreviousMonth}
          className="text-white hover:bg-white/10 p-2"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
        
        <h2 className="text-xl font-semibold capitalize">{monthName}</h2>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={goToNextMonth}
          className="text-white hover:bg-white/10 p-2"
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      </div>

      {/* Table Container */}
      <div className="px-4 mb-6">
        <div className="bg-white/5 rounded-lg overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-4 bg-white/10 py-3 px-4">
            <div className="text-sm font-semibold text-center">Fecha</div>
            <div className="text-sm font-semibold text-center">Entrada</div>
            <div className="text-sm font-semibold text-center">Salida</div>
            <div className="text-sm font-semibold text-center">Total</div>
          </div>

          {/* Table Body */}
          <div className="max-h-96 overflow-y-auto scrollbar-thin">
            {monthSessions.length > 0 ? (
              monthSessions
                .sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime())
                .map((session) => (
                  <div
                    key={session.id}
                    className="grid grid-cols-4 py-3 px-4 border-b border-white/10 hover:bg-white/5"
                  >
                    <div className="text-sm text-center text-white/90">
                      {formatDate(session.clockIn)}
                    </div>
                    <div className="text-sm text-center font-mono">
                      {formatTime(session.clockIn)}
                    </div>
                    <div className="text-sm text-center font-mono">
                      {session.clockOut ? formatTime(session.clockOut) : '-'}
                    </div>
                    <div className="text-sm text-center font-mono font-semibold">
                      {session.totalHours || '-'}
                    </div>
                  </div>
                ))
            ) : (
              <div className="py-8 text-center text-white/60">
                No hay fichajes este mes
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Total Hours */}
      <div className="px-4 mb-8">
        <div className="bg-blue-500/20 rounded-lg py-4 px-6 border border-blue-400/30">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold">TOTAL HORAS {monthName.split(' ')[0].toUpperCase()}</span>
            <span className="text-2xl font-bold font-mono">{formatTotalHours(totalMonthHours)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}