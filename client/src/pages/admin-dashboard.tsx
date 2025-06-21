import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { 
  Clock, 
  Users, 
  MessageSquare, 
  CalendarDays,
  LogIn,
  LogOut,
  Coffee,
  Plane,
  PartyPopper
} from 'lucide-react';
import { format, addDays, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function AdminDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch active work session
  const { data: activeSession } = useQuery({
    queryKey: ['/api/work-sessions/active'],
    refetchInterval: 5000,
  });

  // Fetch recent work sessions
  const { data: recentSessions } = useQuery({
    queryKey: ['/api/work-sessions/company'],
    select: (data: any[]) => data?.slice(0, 5) || [],
  });

  // Fetch recent messages - one per employee
  const { data: messages } = useQuery({
    queryKey: ['/api/messages'],
    select: (data: any[]) => {
      if (!data?.length) return [];
      
      // Group messages by sender and get the latest one for each
      const messagesBySender = data.reduce((acc, message) => {
        if (!acc[message.senderId] || new Date(message.createdAt) > new Date(acc[message.senderId].createdAt)) {
          acc[message.senderId] = message;
        }
        return acc;
      }, {});
      
      return Object.values(messagesBySender).slice(0, 4);
    },
  });

  // Fetch vacation requests for calendar
  const { data: vacationRequests } = useQuery({
    queryKey: ['/api/vacation-requests/company'],
    select: (data: any[]) => data || [],
  });

  const approvedVacations = vacationRequests?.filter((req: any) => req.status === 'approved') || [];
  const pendingVacations = vacationRequests?.filter((req: any) => req.status === 'pending') || [];

  // Clock in/out mutation
  const clockMutation = useMutation({
    mutationFn: async (action: 'in' | 'out') => {
      return await apiRequest(`/api/work-sessions/clock-${action}`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions/company'] });
      toast({
        title: activeSession ? 'Fichaje de salida registrado' : 'Fichaje de entrada registrado',
        description: `${format(new Date(), 'HH:mm', { locale: es })}`,
      });
    },
  });

  // Spanish holidays 2025
  const holidays = [
    { date: '2025-01-01', name: 'Año Nuevo' },
    { date: '2025-01-06', name: 'Reyes Magos' },
    { date: '2025-04-18', name: 'Viernes Santo' },
    { date: '2025-05-01', name: 'Día del Trabajo' },
    { date: '2025-08-15', name: 'Asunción de la Virgen' },
    { date: '2025-10-12', name: 'Fiesta Nacional' },
    { date: '2025-11-01', name: 'Todos los Santos' },
    { date: '2025-12-06', name: 'Día de la Constitución' },
    { date: '2025-12-08', name: 'Inmaculada Concepción' },
    { date: '2025-12-25', name: 'Navidad' },
  ];

  const formatTime = (date: Date) => {
    return format(date, 'HH:mm', { locale: es });
  };

  const formatDate = (dateString: string) => {
    return format(parseISO(dateString), 'dd/MM', { locale: es });
  };

  const formatDateTime = (dateString: string) => {
    return format(parseISO(dateString), 'dd/MM HH:mm', { locale: es });
  };

  const getLastClockInTime = () => {
    if (activeSession?.clockIn) {
      return format(parseISO(activeSession.clockIn), "'hoy a las' HH:mm", { locale: es });
    }
    if (recentSessions?.length > 0) {
      const lastSession = recentSessions[0];
      const clockTime = lastSession.clockOut || lastSession.clockIn;
      return format(parseISO(clockTime), "'el' dd/MM 'a las' HH:mm", { locale: es });
    }
    return 'No hay fichajes recientes';
  };

  // Check if date has events
  const getDateEvents = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const events = [];

    // Check holidays
    const holiday = holidays.find(h => h.date === dateStr);
    if (holiday) {
      events.push({ type: 'holiday', name: holiday.name });
    }

    // Check employee vacations (only approved ones)
    const vacations = approvedVacations?.filter((req: any) => {
      const startDate = parseISO(req.startDate);
      const endDate = parseISO(req.endDate);
      return date >= startDate && date <= endDate;
    });

    if (vacations?.length) {
      events.push({ type: 'vacation', count: vacations.length });
    }

    return events;
  };

  return (
    <div className="px-6 py-4 min-h-screen bg-gray-50">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard Administrativo</h1>
        <p className="text-gray-500 mt-1">
          Gestión rápida y vista general de la empresa
        </p>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Quick Actions & Lists */}
        <div className="space-y-6">
          
          {/* Quick Clock In/Out */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Fichaje Rápido
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">
                    Tu último fichaje: {getLastClockInTime()}
                  </p>
                </div>
                <Button
                  size="lg"
                  onClick={() => clockMutation.mutate(activeSession ? 'out' : 'in')}
                  disabled={clockMutation.isPending}
                  className={activeSession ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
                >
                  {activeSession ? (
                    <>
                      <LogOut className="h-4 w-4 mr-2" />
                      Salir
                    </>
                  ) : (
                    <>
                      <LogIn className="h-4 w-4 mr-2" />
                      Entrar
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Clock-ins */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Últimos Fichajes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentSessions?.length > 0 ? (
                  recentSessions.map((session: any) => (
                    <div key={session.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <Clock className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{session.userName}</p>
                        <p className="text-sm text-gray-500">
                          {session.clockOut ? 'Salida' : 'Entrada'} - {formatDateTime(session.clockOut || session.clockIn)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">No hay fichajes recientes</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Messages */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Últimos Mensajes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {messages?.length > 0 ? (
                  messages.map((message: any) => (
                    <div key={message.id} className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                        <MessageSquare className="h-4 w-4 text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{message.senderName || 'Empleado'}</p>
                        <p className="text-sm text-gray-500 truncate">{message.content}</p>
                        <p className="text-xs text-gray-400">{formatTime(parseISO(message.createdAt))}</p>
                      </div>
                      {!message.isRead && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">No hay mensajes recientes</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Calendar with Events */}
        <div>
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Calendario
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Calendar */}
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                locale={es}
                className="rounded-md border-0"
                classNames={{
                  months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                  month: "space-y-4",
                  caption: "flex justify-center pt-1 relative items-center",
                  caption_label: "text-sm font-medium",
                  nav: "space-x-1 flex items-center",
                  nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
                  nav_button_previous: "absolute left-1",
                  nav_button_next: "absolute right-1",
                  table: "w-full border-collapse space-y-1",
                  head_row: "flex",
                  head_cell: "text-gray-500 rounded-md w-8 font-normal text-[0.8rem]",
                  row: "flex w-full mt-2",
                  cell: "relative h-8 w-8 text-center text-sm p-0 [&:has([aria-selected])]:bg-oficaz-primary [&:has([aria-selected])]:text-white first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                  day: "h-8 w-8 p-0 font-normal aria-selected:opacity-100 hover:bg-oficaz-primary/10 rounded-md",
                  day_selected: "bg-oficaz-primary text-white hover:bg-oficaz-primary hover:text-white focus:bg-oficaz-primary focus:text-white",
                  day_today: "bg-oficaz-primary/20 text-oficaz-primary font-semibold",
                  day_outside: "text-gray-400 opacity-50",
                  day_disabled: "text-gray-400 opacity-50",
                  day_range_middle: "aria-selected:bg-oficaz-primary/50 aria-selected:text-white",
                  day_hidden: "invisible",
                }}
                modifiers={{
                  holiday: holidays.map(h => parseISO(h.date)),
                  vacation: approvedVacations?.flatMap((req: any) => {
                    const start = parseISO(req.startDate);
                    const end = parseISO(req.endDate);
                    const dates = [];
                    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                      dates.push(new Date(d));
                    }
                    return dates;
                  }) || []
                }}
                modifiersStyles={{
                  holiday: { backgroundColor: '#ef4444', color: 'white' },
                  vacation: { backgroundColor: '#3b82f6', color: 'white' }
                }}
              />

              {/* Pending Requests Section */}
              {pendingVacations.length > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                      Pendientes de Aprobación
                    </h4>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const companyAlias = 'test';
                        window.location.href = `/${companyAlias}/vacaciones`;
                      }}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      ver más
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {pendingVacations.slice(0, 3).map((request: any) => (
                      <div 
                        key={request.id} 
                        className="flex items-center gap-3 py-2 cursor-pointer hover:bg-gray-50 rounded-md"
                        onClick={() => {
                          const companyAlias = 'test';
                          window.location.href = `/${companyAlias}/vacaciones`;
                        }}
                      >
                        <Coffee className="h-4 w-4 text-orange-500" />
                        <span className="text-sm text-gray-900">
                          Vacaciones de {request.userName || 'Empleado'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upcoming Events Section */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                    Próximos Eventos
                  </h4>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    ver más
                  </Button>
                </div>
                <div className="space-y-2">
                  {holidays.slice(0, 3).map((holiday, idx) => {
                    const holidayDate = parseISO(holiday.date);
                    const today = new Date();
                    if (holidayDate > today) {
                      return (
                        <div key={idx} className="flex items-center gap-3 py-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-xs font-medium text-blue-600">
                              {format(holidayDate, 'dd')}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {format(holidayDate, 'dd MMM, EEEE', { locale: es })}
                            </p>
                            <p className="text-xs text-gray-500">{holiday.name}</p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }).filter(Boolean)}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}