import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
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
  PartyPopper,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import { format, addDays, isSameDay, parseISO, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function AdminDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  // Función para manejar clics en días del calendario
  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
    }
  };

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
    select: (data: any[]) => {
      if (!data?.length) return [];
      
      // Create separate events for clock-in and clock-out
      const events: any[] = [];
      
      data.forEach((session: any) => {
        // Add clock-in event
        events.push({
          id: `${session.id}-in`,
          userName: session.userName,
          type: 'entry',
          timestamp: session.clockIn,
          sessionId: session.id
        });
        
        // Add clock-out event if exists
        if (session.clockOut) {
          events.push({
            id: `${session.id}-out`,
            userName: session.userName,
            type: 'exit',
            timestamp: session.clockOut,
            sessionId: session.id
          });
        }
      });
      
      // Sort by timestamp (most recent first) and take first 5
      return events
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5);
    },
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
      const clockDate = parseISO(activeSession.clockIn);
      const today = new Date();
      const isToday = clockDate.toDateString() === today.toDateString();
      
      if (isToday) {
        return format(clockDate, "'hoy a las' HH:mm", { locale: es });
      } else {
        return format(clockDate, "'el' dd/MM 'a las' HH:mm", { locale: es });
      }
    }
    if (recentSessions?.length > 0) {
      const lastEvent = recentSessions[0];
      return format(parseISO(lastEvent.timestamp), "'el' dd/MM 'a las' HH:mm", { locale: es });
    }
    return 'No hay fichajes recientes';
  };

  // Get vacation details for a specific date
  const getVacationDetailsForDate = (date: Date) => {
    const approved = approvedVacations?.filter((req: any) => {
      const startDate = startOfDay(parseISO(req.startDate));
      const endDate = startOfDay(parseISO(req.endDate));
      const targetDate = startOfDay(date);
      return targetDate >= startDate && targetDate <= endDate;
    }).map((req: any) => ({
      ...req,
      userName: req.userName || req.fullName || 'Empleado',
      status: 'approved'
    })) || [];

    const pending = pendingVacations?.filter((req: any) => {
      const startDate = startOfDay(parseISO(req.startDate));
      const endDate = startOfDay(parseISO(req.endDate));
      const targetDate = startOfDay(date);
      return targetDate >= startDate && targetDate <= endDate;
    }).map((req: any) => ({
      ...req,
      userName: req.userName || req.fullName || 'Empleado',
      status: 'pending'
    })) || [];

    return [...approved, ...pending];
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

    // Check employee vacations (approved and pending)
    const approvedVacs = approvedVacations?.filter((req: any) => {
      const startDate = startOfDay(parseISO(req.startDate));
      const endDate = startOfDay(parseISO(req.endDate));
      const targetDate = startOfDay(date);
      return targetDate >= startDate && targetDate <= endDate;
    });

    const pendingVacs = pendingVacations?.filter((req: any) => {
      const startDate = startOfDay(parseISO(req.startDate));
      const endDate = startOfDay(parseISO(req.endDate));
      const targetDate = startOfDay(date);
      return targetDate >= startDate && targetDate <= endDate;
    });

    if (approvedVacs?.length) {
      events.push({ type: 'vacation', count: approvedVacs.length, subtype: 'approved' });
    }

    if (pendingVacs?.length) {
      events.push({ type: 'vacation', count: pendingVacs.length, subtype: 'pending' });
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
              <div className="flex items-center justify-between min-h-[60px]">
                <div className="flex flex-col justify-center">
                  <p className="text-sm text-gray-500">
                    Tu último fichaje: {getLastClockInTime()}
                  </p>
                </div>
                <div className="flex justify-end">
                  <Button
                    size="lg"
                    onClick={() => clockMutation.mutate(activeSession ? 'out' : 'in')}
                    disabled={clockMutation.isPending}
                    className={`px-8 py-3 font-medium rounded-lg transition-all duration-200 shadow-sm ${
                      activeSession 
                        ? 'bg-red-500 hover:bg-red-600 text-white border-red-500 hover:shadow-red-200' 
                        : 'bg-green-500 hover:bg-green-600 text-white border-green-500 hover:shadow-green-200'
                    } hover:shadow-md`}
                  >
                    {activeSession ? (
                      <>
                        <LogOut className="h-5 w-5 mr-2" />
                        Salir
                      </>
                    ) : (
                      <>
                        <LogIn className="h-5 w-5 mr-2" />
                        Entrar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Clock-ins */}
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation('/test/fichajes')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Últimos Fichajes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentSessions?.length > 0 ? (
                  recentSessions.map((event: any) => (
                    <div key={event.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        event.type === 'entry' ? 'bg-green-100' : 'bg-red-100'
                      }`}>
                        {event.type === 'entry' ? (
                          <ArrowRight className="h-4 w-4 text-green-600" />
                        ) : (
                          <ArrowLeft className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{event.userName}</p>
                        <p className="text-sm text-gray-500">
                          {event.type === 'entry' ? 'Entrada' : 'Salida'} - {formatDateTime(event.timestamp)}
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
                {(() => {
                  const receivedMessages = messages?.filter((message: any) => message.senderId !== user?.id) || [];
                  
                  return receivedMessages.length > 0 ? (
                    receivedMessages.map((message: any) => (
                      <div 
                        key={message.id} 
                        className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50 transition-colors rounded-md"
                        onClick={() => setLocation(`/test/mensajes?chat=${message.senderId}`)}
                      >
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
                  );
                })()}
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
              {/* Calendar - Simple and Compact */}
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="p-4">
                  {(() => {
                    try {
                      // Validar datos antes de crear modifiers
                      const safeNationalHolidays = Array.isArray(nationalHolidays) ? nationalHolidays.filter(h => h?.date) : [];
                      const safeCustomHolidays = Array.isArray(customHolidays) ? customHolidays.filter(h => h?.date) : [];
                      const safeApprovedVacations = Array.isArray(approvedVacations) ? approvedVacations.filter(v => v?.startDate && v?.endDate) : [];

                      return (
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={handleDateSelect}
                          locale={es}
                          className="w-full mx-auto"
                          modifiers={{
                            nationalHoliday: safeNationalHolidays.map(h => parseISO(h.date)),
                            customHoliday: safeCustomHolidays.map(h => parseISO(h.date)),
                            approvedVacation: safeApprovedVacations.map(v => {
                              try {
                                const dates = [];
                                const start = parseISO(v.startDate);
                                const end = parseISO(v.endDate);
                                for (let date = start; date <= end; date.setDate(date.getDate() + 1)) {
                                  dates.push(new Date(date));
                                }
                                return dates;
                              } catch {
                                return [];
                              }
                            }).flat()
                          }}
                          modifiersStyles={{
                            nationalHoliday: { 
                              backgroundColor: '#fee2e2', 
                              color: '#dc2626', 
                              fontWeight: '600'
                            },
                            customHoliday: { 
                              backgroundColor: '#fed7aa', 
                              color: '#d97706', 
                              fontWeight: '600'
                            },
                            approvedVacation: { 
                              backgroundColor: '#dcfce7', 
                              color: '#16a34a', 
                              fontWeight: '600'
                            }
                          }}
                        />
                      );
                    } catch (error) {
                      console.warn('Error rendering calendar:', error);
                      return (
                        <div className="w-full h-64 flex items-center justify-center text-gray-500">
                          <div className="text-center">
                            <CalendarDays className="h-8 w-8 mx-auto mb-2" />
                            <p>Calendario no disponible</p>
                          </div>
                        </div>
                      );
                    }
                  })()}
                </div>

                {/* Event Details for Selected Date */}
                {selectedDate && (
                  <div className="border-t border-gray-200 p-4 bg-gray-50">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" />
                      {format(selectedDate, 'dd MMMM yyyy', { locale: es })}
                    </h4>
                    {(() => {
                      try {
                        const events = getDateEvents(selectedDate) || [];
                        const vacations = getVacationDetailsForDate(selectedDate) || [];
                        
                        if (events.length === 0 && vacations.length === 0) {
                          return <p className="text-sm text-gray-500">No hay eventos programados</p>;
                        }
                        
                        return (
                          <div className="space-y-3">
                            {/* Festivos */}
                            {events.filter(event => event && event.type === 'holiday').map((event, idx) => (
                              <div key={idx} className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                                <div className={`w-3 h-3 rounded-full ${
                                  event.subtype === 'custom' ? 'bg-orange-500' : 'bg-red-500'
                                }`}></div>
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{event.name || 'Evento'}</p>
                                  <p className="text-xs text-gray-600">
                                    {event.subtype === 'custom' ? 'Día festivo personalizado' : 'Día festivo nacional'}
                                  </p>
                                </div>
                              </div>
                            ))}
                            
                            {/* Vacaciones aprobadas */}
                            {vacations.filter(v => v && v.status === 'approved').map((vacation: any, idx: number) => (
                              <div key={idx} className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                <div>
                                  <p className="text-sm font-medium text-gray-900">
                                    {vacation.userName || 'Empleado'} - Vacaciones
                                  </p>
                                  <p className="text-xs text-gray-600">
                                    Del {format(parseISO(vacation.startDate), 'dd/MM')} al {format(parseISO(vacation.endDate), 'dd/MM')}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      } catch (error) {
                        console.warn('Error rendering date events:', error);
                        return <p className="text-sm text-gray-500">Error mostrando eventos</p>;
                      }
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
                      onClick={() => setLocation('/test/vacaciones')}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      ver más
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {pendingVacations.slice(0, 3).map((request: any) => (
                      <div 
                        key={request.id} 
                        className="flex items-center gap-3 p-3 bg-white rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => setLocation('/test/vacaciones')}
                      >
                        <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            Vacaciones de {request.userName || 'Empleado'}
                          </p>
                          <p className="text-xs text-gray-600">
                            Del {format(parseISO(request.startDate), 'dd/MM')} al {format(parseISO(request.endDate), 'dd/MM')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upcoming Events Section */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="mb-3">
                  <h4 className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                    Próximos Eventos
                  </h4>
                </div>
                <div className="space-y-3">
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
                        <div key={idx} className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                          <div className={`w-3 h-3 rounded-full ${
                            isCustom ? 'bg-orange-500' : 'bg-red-500'
                          }`}></div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {holiday.name}
                            </p>
                            <p className="text-xs text-gray-600">
                              {format(holidayDate, 'dd MMM, EEEE', { locale: es })}
                              {isCustom && (
                                <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                                  Personalizado
                                </span>
                              )}
                            </p>
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