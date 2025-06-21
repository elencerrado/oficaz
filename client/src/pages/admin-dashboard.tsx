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
import { format, addDays, isSameDay, parseISO, startOfDay } from 'date-fns';
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

  // Spanish national holidays 2025
  const nationalHolidays = [
    { name: "Año Nuevo", date: "2025-01-01", type: "national" },
    { name: "Día de Reyes", date: "2025-01-06", type: "national" },
    { name: "Viernes Santo", date: "2025-04-18", type: "national" },
    { name: "Día del Trabajo", date: "2025-05-01", type: "national" },
    { name: "Asunción de la Virgen", date: "2025-08-15", type: "national" },
    { name: "Día de la Hispanidad", date: "2025-10-12", type: "national" },
    { name: "Todos los Santos", date: "2025-11-01", type: "national" },
    { name: "Día de la Constitución", date: "2025-12-06", type: "national" },
    { name: "Inmaculada Concepción", date: "2025-12-08", type: "national" },
    { name: "Navidad", date: "2025-12-25", type: "national" }
  ];

  // Fetch custom holidays from database
  const { data: customHolidays = [] } = useQuery({
    queryKey: ['/api/holidays/custom'],
    select: (data: any[]) => data?.map((h: any) => ({ ...h, type: 'custom' })) || [],
  });

  const allHolidays = [...nationalHolidays, ...customHolidays];

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

  // Get vacation details for a specific date
  const getVacationDetailsForDate = (date: Date) => {
    return approvedVacations?.filter((req: any) => {
      // Parse dates and normalize to date-only comparison
      const startDate = startOfDay(parseISO(req.startDate));
      const endDate = startOfDay(parseISO(req.endDate));
      const targetDate = startOfDay(date);
      
      return targetDate >= startDate && targetDate <= endDate;
    }).map((req: any) => ({
      ...req,
      userName: req.userName || req.fullName || 'Empleado'
    })) || [];
  };

  // Check if date has events
  const getDateEvents = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const events = [];

    // Check holidays
    const holiday = allHolidays.find(h => h.date === dateStr);
    if (holiday) {
      events.push({ type: 'holiday', name: holiday.name });
    }

    // Check employee vacations (only approved ones)
    const vacations = approvedVacations?.filter((req: any) => {
      // Parse dates and normalize to date-only comparison
      const startDate = startOfDay(parseISO(req.startDate));
      const endDate = startOfDay(parseISO(req.endDate));
      const targetDate = startOfDay(date);
      
      return targetDate >= startDate && targetDate <= endDate;
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
              {/* Calendar - Large and Enhanced */}
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-visible">
                <div className="p-4 overflow-visible">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      // Si es el mismo día, mantener la selección
                      if (selectedDate && date && isSameDay(selectedDate, date)) {
                        return;
                      }
                      setSelectedDate(date);
                    }}
                    locale={es}
                    showWeekNumber={true}
                    className="w-full overflow-visible"
                    classNames={{
                      months: "flex flex-col space-y-4 w-full",
                      month: "space-y-4 w-full min-w-0",
                      caption: "flex justify-center pt-2 relative items-center mb-4",
                      caption_label: "text-lg font-bold text-gray-800",
                      nav: "space-x-1 flex items-center",
                      nav_button: "h-8 w-8 bg-gray-100 hover:bg-gray-200 rounded-lg p-0 transition-colors flex items-center justify-center shadow-sm",
                      nav_button_previous: "absolute left-0 top-2",
                      nav_button_next: "absolute right-0 top-2",
                      table: "w-full border-collapse table-fixed",
                      head_row: "flex mb-2 w-full",
                      head_cell: "text-gray-600 flex-1 h-8 font-semibold text-xs flex items-center justify-center uppercase tracking-wide min-w-0",
                      row: "flex w-full mb-1",
                      weeknumber: "w-6 h-10 text-xs text-gray-500 flex items-center justify-center font-semibold border-r border-gray-200 mr-1 bg-gray-50 flex-shrink-0",
                      cell: "relative flex-1 h-10 text-center text-sm p-0 focus-within:relative focus-within:z-20 min-w-0",
                      day: "w-full h-10 p-0 font-medium flex items-center justify-center rounded-md hover:bg-blue-50 transition-all duration-200 text-xs",
                      day_selected: "bg-blue-600 text-white hover:bg-blue-700 font-semibold shadow-lg",
                      day_today: "bg-blue-100 text-blue-900 font-bold ring-1 ring-blue-500 ring-inset shadow-md",
                      day_outside: "text-gray-300",
                      day_disabled: "text-gray-200 cursor-not-allowed",
                      day_range_middle: "aria-selected:bg-blue-50 aria-selected:text-blue-900",
                      day_hidden: "invisible",
                    }}
                    modifiers={{
                      nationalHoliday: nationalHolidays.map(h => parseISO(h.date)),
                      customHoliday: customHolidays.map(h => parseISO(h.date)),
                      vacation: approvedVacations?.flatMap((req: any) => {
                        const start = startOfDay(parseISO(req.startDate));
                        const end = startOfDay(parseISO(req.endDate));
                        const dates = [];
                        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                          dates.push(new Date(d));
                        }
                        return dates;
                      }) || []
                    }}
                    modifiersStyles={{
                      nationalHoliday: { 
                        backgroundColor: '#dc2626', 
                        color: 'white', 
                        fontWeight: '700',
                        borderRadius: '6px',
                        boxShadow: '0 1px 3px rgba(220, 38, 38, 0.3)'
                      },
                      customHoliday: { 
                        backgroundColor: '#d97706', 
                        color: 'white', 
                        fontWeight: '700',
                        borderRadius: '6px',
                        boxShadow: '0 1px 3px rgba(217, 119, 6, 0.3)'
                      },
                      vacation: { 
                        backgroundColor: '#16a34a', 
                        color: 'white', 
                        fontWeight: '700',
                        borderRadius: '6px',
                        boxShadow: '0 1px 3px rgba(22, 163, 74, 0.3)'
                      }
                    }}
                  />
                </div>

                {/* Event Details Panel */}
                {selectedDate && (
                  <div className="border-t border-gray-200 p-4 bg-gray-50">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" />
                      {format(selectedDate, 'dd MMMM yyyy', { locale: es })}
                    </h4>
                    {(() => {
                      const events = getDateEvents(selectedDate);
                      const vacations = getVacationDetailsForDate(selectedDate);
                      
                      if (events.length === 0 && vacations.length === 0) {
                        return <p className="text-sm text-gray-500">No hay eventos programados</p>;
                      }
                      
                      return (
                        <div className="space-y-3">
                          {events.map((event, idx) => (
                            <div key={idx} className="flex items-center gap-3 p-2 bg-white rounded-lg border">
                              {event.type === 'holiday' ? (
                                <>
                                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">{event.name}</p>
                                    <p className="text-xs text-red-600">
                                      {event.holidayType === 'custom' ? 'Día festivo personalizado' : 'Día festivo nacional'}
                                    </p>
                                  </div>
                                </>
                              ) : null}
                            </div>
                          ))}
                          
                          {vacations.length > 0 && (
                            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                <span className="text-sm font-semibold text-green-800">
                                  {vacations.length} empleado{vacations.length > 1 ? 's' : ''} de vacaciones
                                </span>
                              </div>
                              <div className="space-y-1">
                                {vacations.map((vacation: any, idx: number) => (
                                  <div key={idx} className="text-sm text-green-700 ml-5">
                                    • {vacation.userName || vacation.fullName || `Usuario ${vacation.userId}`}
                                    <span className="text-xs text-gray-500 ml-2">
                                      ({format(parseISO(vacation.startDate), 'dd/MM')} - {format(parseISO(vacation.endDate), 'dd/MM')})
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

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
                  {allHolidays
                    .filter(holiday => {
                      const holidayDate = parseISO(holiday.date);
                      const today = new Date();
                      return holidayDate > today;
                    })
                    .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime())
                    .slice(0, 4)
                    .map((holiday, idx) => {
                      const holidayDate = parseISO(holiday.date);
                      const isCustom = holiday.type === 'custom';
                      
                      return (
                        <div key={idx} className="flex items-center gap-3 py-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            isCustom 
                              ? 'bg-amber-100 text-amber-600' 
                              : 'bg-red-100 text-red-600'
                          }`}>
                            <span className="text-xs font-medium">
                              {format(holidayDate, 'dd')}
                            </span>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {format(holidayDate, 'dd MMM, EEEE', { locale: es })}
                            </p>
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-gray-500">{holiday.name}</p>
                              {isCustom && (
                                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                                  Personalizado
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}