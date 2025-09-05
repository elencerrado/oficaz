import { useAuth } from '@/hooks/use-auth';
import { useFeatureCheck } from '@/hooks/use-feature-check';
import { useWorkAlarms } from '@/hooks/use-work-alarms';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Clock, User, FileText, Calendar, Bell, MessageSquare, LogOut, Palmtree, Building2, MapPin, CreditCard, AlarmClock } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { useEffect, useState } from 'react';

interface WorkSession {
  id: number;
  userId: number;
  clockIn: string;
  clockOut?: string;
  totalHours?: string;
  createdAt: string;
}

export default function EmployeeDashboard() {
  const { user, logout, company } = useAuth();
  const { hasAccess } = useFeatureCheck();
  const { toast } = useToast();
  const { startAlarmService, notificationPermission } = useWorkAlarms();
  
  // Lógica inteligente: mostrar logo solo si tiene logo Y función habilitada
  const shouldShowLogo = company?.logoUrl && hasAccess('logoUpload');
  const [hasVacationUpdates, setHasVacationUpdates] = useState(false);
  const [lastVacationCheck, setLastVacationCheck] = useState<any[]>([]);
  
  // Estado para mensajes temporales en el cajón de fichaje
  const [temporaryMessage, setTemporaryMessage] = useState<string | null>(null);
  
  // Estado para el modal de alarmas
  const [isAlarmModalOpen, setIsAlarmModalOpen] = useState(false);

  // Función para generar mensajes dinámicos según la hora
  const generateDynamicMessage = (actionType: 'entrada' | 'salida') => {
    const hour = new Date().getHours();
    let greeting = '';
    
    if (hour >= 6 && hour < 14) {
      greeting = 'Buenos días';
    } else if (hour >= 14 && hour < 20) {
      greeting = 'Buenas tardes';
    } else {
      greeting = 'Buenas noches';
    }
    
    const action = actionType === 'entrada' ? 'Entrada registrada' : 'Salida registrada';
    return `${greeting}, ${action}.`;
  };

  // Función para mostrar mensaje temporal
  const showTemporaryMessage = (message: string) => {
    setTemporaryMessage(message);
    setTimeout(() => {
      setTemporaryMessage(null);
    }, 3000); // Mensaje visible por 3 segundos
  };

  // Data fetching with real-time updates
  const { data: activeSession } = useQuery<WorkSession>({
    queryKey: ['/api/work-sessions/active'],
    enabled: !!user,
    staleTime: 10 * 1000, // 10 seconds for real-time updates
    gcTime: 2 * 60 * 1000, // 2 minutes
    retry: 1,
    retryDelay: 500,
    refetchInterval: 10 * 1000, // Poll every 10 seconds instead of 3
    refetchIntervalInBackground: false, // Stop background polling
  });

  // Query for active break period
  const { data: activeBreak } = useQuery({
    queryKey: ['/api/break-periods/active'],
    enabled: !!user && !!activeSession,
    refetchInterval: activeSession ? 15 * 1000 : false, // Only poll when session active
    refetchIntervalInBackground: false,
    staleTime: 10 * 1000,
  });

  // Query for company work hours settings
  const { data: companySettings } = useQuery({
    queryKey: ['/api/settings/work-hours'],
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
  });

  // Get unread messages count with real-time updates
  const { data: unreadCount } = useQuery<{ count: number }>({
    queryKey: ['/api/messages/unread-count'],
    enabled: !!user,
    refetchInterval: 30000, // Check every 30 seconds instead of 10
    refetchIntervalInBackground: false,
    staleTime: 25000, // Cache for 25 seconds
  });

  // Check for incomplete work sessions notifications
  const { data: timeTrackingNotifications = [] } = useQuery({
    queryKey: ['/api/notifications', { category: 'time-tracking' }],
    enabled: !!user,
    refetchInterval: 30000, // Check every 30 seconds
    refetchIntervalInBackground: false,
    staleTime: 25000,
  });

  // Calculate if there are unread incomplete session notifications
  const hasIncompleteSessionNotifications = timeTrackingNotifications.filter((n: any) => !n.isRead && !n.isCompleted).length > 0;

  // Get document notifications with reduced frequency
  const { data: documents } = useQuery({
    queryKey: ['/api/documents'],
    enabled: !!user,
    refetchInterval: 60000, // Check every minute instead of 15 seconds
    refetchIntervalInBackground: false,
    staleTime: 45000,
  });

  // Get real document notifications from database with reduced frequency
  const { data: documentNotifications } = useQuery({
    queryKey: ['/api/document-notifications'],
    enabled: !!user,
    refetchInterval: 60000, // Check every minute instead of 15 seconds
    refetchIntervalInBackground: false,
    staleTime: 45000,
  });

  // Get vacation requests with reduced frequency
  const { data: vacationRequests = [] } = useQuery({
    queryKey: ['/api/vacation-requests'],
    enabled: !!user,
    refetchInterval: 120000, // Check every 2 minutes instead of 10 seconds
    refetchIntervalInBackground: false,
    staleTime: 90000, // Cache for 90 seconds
  });

  // Check for vacation updates - clear notification when back on dashboard
  useEffect(() => {
    if (!vacationRequests?.length) return;
    
    const lastCheckTime = localStorage.getItem('lastVacationCheck');
    const lastCheckDate = lastCheckTime ? new Date(lastCheckTime) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Find processed requests (approved/denied) that were reviewed after last check
    const newlyProcessedRequests = vacationRequests.filter((request: any) => {
      if (request.status === 'pending') return false;
      
      const reviewDate = request.reviewedAt ? new Date(request.reviewedAt) : new Date(request.createdAt);
      const isNew = reviewDate > lastCheckDate;
      
      console.log('Dashboard vacation check:', {
        id: request.id,
        status: request.status,
        reviewedAt: request.reviewedAt,
        reviewDate: reviewDate.toISOString(),
        lastCheck: lastCheckDate.toISOString(),
        isNew,
        currentTime: new Date().toISOString()
      });
      
      return isNew;
    });
    
    const hasUpdates = newlyProcessedRequests.length > 0;
    setHasVacationUpdates(hasUpdates);
    
    if (hasUpdates) {
      console.log('Dashboard setting vacation notification flag for', newlyProcessedRequests.length, 'requests');
      localStorage.setItem('hasVacationUpdates', 'true');
      
      // Show browser notification if supported
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Oficaz - Vacaciones', {
          body: `Tienes ${newlyProcessedRequests.length} solicitud(es) de vacaciones procesada(s)`,
          icon: '/favicon.ico'
        });
      }
    } else {
      setHasVacationUpdates(false);
    }
  }, [vacationRequests]);

  // Clear vacation notifications when returning to dashboard
  useEffect(() => {
    if (hasVacationUpdates) {
      const timer = setTimeout(() => {
        console.log('Dashboard: clearing vacation notifications after viewing dashboard');
        setHasVacationUpdates(false);
        localStorage.setItem('lastVacationCheck', new Date().toISOString());
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [hasVacationUpdates]);

  // Check for document notifications with intelligent state tracking
  const [hasDocumentRequests, setHasDocumentRequests] = useState(false);
  const [hasNewDocuments, setHasNewDocuments] = useState(false);

  // Clear document notifications when returning to dashboard (after viewing documents page)
  useEffect(() => {
    // Check if user has visited documents page recently
    const lastDocumentPageVisit = localStorage.getItem('lastDocumentPageVisit');
    if (lastDocumentPageVisit) {
      const lastVisitDate = new Date(lastDocumentPageVisit);
      const timeSinceVisit = Date.now() - lastVisitDate.getTime();
      
      // If user visited documents page in the last 30 seconds, clear new documents notification
      if (timeSinceVisit < 30000) {
        console.log('📋 Clearing new documents notification - user recently visited documents page');
        setHasNewDocuments(false);
        localStorage.setItem('lastDocumentCheck', new Date().toISOString());
        localStorage.removeItem('lastDocumentPageVisit');
      }
    }
  }, []); // Only run once on mount

  // Check if user is currently on vacation
  const today = new Date().toISOString().split('T')[0];
  const isOnVacation = vacationRequests.some((request: any) => 
    request.status === 'approved' &&
    request.startDate.split('T')[0] <= today &&
    request.endDate.split('T')[0] >= today
  );

  // Check document notifications and new documents with proper state logic
  useEffect(() => {
    if (!documentNotifications || !documents) return;

    // Check for pending document requests (RED notification)
    const pendingRequests = (documentNotifications as any[]).filter(notification => 
      !notification.isCompleted
    );
    const hasPendingRequests = pendingRequests.length > 0;
    setHasDocumentRequests(hasPendingRequests);

    // Check for new documents (GREEN notification)
    const lastDocumentCheck = localStorage.getItem('lastDocumentCheck');
    const lastCheckDate = lastDocumentCheck ? new Date(lastDocumentCheck) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const newDocuments = (documents as any[]).filter((doc: any) => {
      const docDate = new Date(doc.createdAt);
      return docDate > lastCheckDate;
    });
    
    const hasRecentDocuments = newDocuments.length > 0;
    setHasNewDocuments(hasRecentDocuments);

    console.log('📋 Document notifications check:', {
      totalNotifications: (documentNotifications as any[]).length,
      notificationsData: documentNotifications,
      pendingRequests: pendingRequests.length,
      pendingRequestsData: pendingRequests,
      newDocuments: newDocuments.length,
      lastCheck: lastCheckDate.toISOString(),
      hasPendingRequests,
      hasRecentDocuments
    });

  }, [documentNotifications, documents]);

  // Get recent work session for "last clock in" info
  const { data: recentSessions } = useQuery<WorkSession[]>({
    queryKey: ['/api/work-sessions'],
  });

  // Clock in/out mutations
  const clockInMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/work-sessions/clock-in');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions'] });
      const message = generateDynamicMessage('entrada');
      showTemporaryMessage(message);
    },
    onError: (error: any) => {
      if (error.message?.includes('Invalid or expired token') || error.message?.includes('403')) {
        toast({
          title: "Sesión expirada",
          description: "Redirigiendo al login...",
          variant: "destructive",
        });
        localStorage.removeItem('authData');
        setTimeout(() => {
          window.location.href = '/login';
        }, 1000);
      } else {
        toast({ 
          title: 'Error', 
          description: 'No se pudo registrar la entrada',
          variant: 'destructive'
        });
      }
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/work-sessions/clock-out');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions'] });
      const message = generateDynamicMessage('salida');
      showTemporaryMessage(message);
    },
    onError: (error: any) => {
      if (error.message?.includes('Invalid or expired token') || error.message?.includes('403')) {
        toast({
          title: "Sesión expirada",
          description: "Redirigiendo al login...",
          variant: "destructive",
        });
        localStorage.removeItem('authData');
        setTimeout(() => {
          window.location.href = '/login';
        }, 1000);
      } else {
        toast({ 
          title: 'Error', 
          description: 'No se pudo registrar la salida',
          variant: 'destructive'
        });
      }
    },
  });

  // Break periods mutations
  const startBreakMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/break-periods/start');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/break-periods/active'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: 'No se pudo iniciar el descanso',
        variant: 'destructive'
      });
    },
  });

  const endBreakMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/break-periods/end');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/break-periods/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions/active'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: 'No se pudo finalizar el descanso',
        variant: 'destructive'
      });
    },
  });

  // Determine session state and status 
  const getSessionStatus = () => {
    if (!activeSession) return { isActive: false, isIncomplete: false, isToday: false };
    
    const clockIn = new Date(activeSession.clockIn);
    const currentTime = new Date();
    const isToday = clockIn.toDateString() === currentTime.toDateString();
    
    // If session is from previous day and no clock out, it's incomplete
    if (!isToday && activeSession.status === 'incomplete') {
      return { isActive: false, isIncomplete: true, isToday: false };
    }
    
    // If session is from today, check if it's still within working hours
    if (isToday) {
      const hoursWorked = (currentTime.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
      const maxDailyHours = companySettings?.workingHoursPerDay || 8;
      const maxHoursWithOvertime = maxDailyHours + 4;
      
      // If exceeded max hours + overtime, treat as finished
      if (hoursWorked > maxHoursWithOvertime) {
        return { isActive: false, isIncomplete: false, isToday: true };
      } else {
        return { isActive: true, isIncomplete: false, isToday: true };
      }
    }
    
    return { isActive: false, isIncomplete: false, isToday: false };
  };

  const sessionStatus = getSessionStatus();

  const formatLastClockDate = () => {
    // If there's an incomplete session from previous day, show it
    if (sessionStatus.isIncomplete && activeSession) {
      const clockInDate = new Date(activeSession.clockIn);
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const isYesterday = clockInDate.toDateString() === yesterday.toDateString();
      const time = clockInDate.toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
      
      if (isYesterday) {
        return `Sesión incompleta de ayer a las ${time}`;
      } else {
        const dayName = clockInDate.toLocaleDateString('es-ES', { weekday: 'long' });
        const dayNumber = clockInDate.getDate();
        const month = clockInDate.toLocaleDateString('es-ES', { month: 'long' });
        return `Sesión incompleta del ${dayName} ${dayNumber} de ${month} a las ${time}`;
      }
    }
    
    // If there's an active session from today, show when they clocked in
    if (sessionStatus.isActive && activeSession) {
      const clockInDate = new Date(activeSession.clockIn);
      const time = clockInDate.toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
      return `Hoy a las ${time}`;
    }
    
    // If no active session, show the most recent clock out or clock in
    if (recentSessions && recentSessions.length > 0) {
      // Find the most recent session (should be first due to ordering)
      const mostRecentSession = recentSessions[0];
      
      // If the session has clock out, show when they clocked out
      if (mostRecentSession.clockOut) {
        const clockOutDate = new Date(mostRecentSession.clockOut);
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        
        const isToday = clockOutDate.toDateString() === now.toDateString();
        const isYesterday = clockOutDate.toDateString() === yesterday.toDateString();
        
        const time = clockOutDate.toLocaleTimeString('es-ES', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        });
        
        if (isToday) {
          return `Salida hoy a las ${time}`;
        } else if (isYesterday) {
          return `Salida ayer a las ${time}`;
        } else {
          const dayName = clockOutDate.toLocaleDateString('es-ES', { weekday: 'long' });
          const dayNumber = clockOutDate.getDate();
          const month = clockOutDate.toLocaleDateString('es-ES', { month: 'long' });
          return `Salida el ${dayName} ${dayNumber} de ${month} a las ${time}`;
        }
      } else {
        // Show when they clocked in (incomplete session)
        const clockInDate = new Date(mostRecentSession.clockIn);
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        
        const isToday = clockInDate.toDateString() === now.toDateString();
        const isYesterday = clockInDate.toDateString() === yesterday.toDateString();
        
        const time = clockInDate.toLocaleTimeString('es-ES', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        });
        
        if (isToday) {
          return `Entrada hoy a las ${time}`;
        } else if (isYesterday) {
          return `Entrada ayer a las ${time}`;
        } else {
          const dayName = clockInDate.toLocaleDateString('es-ES', { weekday: 'long' });
          const dayNumber = clockInDate.getDate();
          const month = clockInDate.toLocaleDateString('es-ES', { month: 'long' });
          return `Entrada el ${dayName} ${dayNumber} de ${month} a las ${time}`;
        }
      }
    }
    
    return '';
  };

  const handleClockAction = () => {
    if (sessionStatus.isActive || sessionStatus.isIncomplete) {
      // Si hay un descanso activo, terminarlo primero antes de salir
      if (activeBreak) {
        endBreakMutation.mutate(undefined, {
          onSuccess: () => {
            // Después de terminar el descanso, hacer clock out
            clockOutMutation.mutate();
          }
        });
      } else {
        clockOutMutation.mutate();
      }
    } else {
      clockInMutation.mutate();
    }
  };

  // Get company alias from current URL or company data
  const [location, setLocation] = useLocation();
  const urlParts = location.split('/').filter(part => part.length > 0);
  const companyAlias = urlParts[0] || company?.companyAlias || 'test';

  const handleNavigation = (route: string) => {
    setLocation(route);
  };

  const menuItems = [
    { 
      icon: Clock, 
      title: 'Fichajes', 
      route: `/${companyAlias}/misfichajes`,
      notification: hasIncompleteSessionNotifications,
      notificationType: 'red',
      feature: 'timeTracking'
    },
    { 
      icon: User, 
      title: 'Usuario', 
      route: `/${companyAlias}/usuario`,
      notification: false,
      feature: null
    },
    { 
      icon: Calendar, 
      title: 'Vacaciones', 
      route: `/${companyAlias}/vacaciones`,
      notification: hasVacationUpdates,
      notificationType: 'red',
      feature: 'vacation'
    },
    { 
      icon: FileText, 
      title: 'Documentos', 
      route: `/${companyAlias}/documentos`,
      notification: hasDocumentRequests || hasNewDocuments,
      notificationType: hasDocumentRequests ? 'red' : 'green',
      feature: 'documents'
    },
    { 
      icon: Bell, 
      title: 'Recordatorios', 
      route: `/${companyAlias}/recordatorios`,
      notification: false,
      feature: 'reminders'
    },
    { 
      icon: MessageSquare, 
      title: 'Mensajes', 
      route: `/${companyAlias}/mensajes`,
      notification: (unreadCount?.count || 0) > 0,
      feature: 'messages'
    },
  ];

  const currentYear = new Date().getFullYear();

  // Initialize notifications and page setup
  useEffect(() => {
    window.scrollTo(0, 0);
    
    // Request notification permission for real-time alerts
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Log real-time notification status for debugging
  useEffect(() => {
    console.log('🔔 Real-time notifications status:', {
      hasVacationUpdates,
      hasDocumentRequests,
      hasNewDocuments,
      unreadMessages: unreadCount?.count || 0,
      timestamp: new Date().toISOString()
    });
  }, [hasVacationUpdates, hasDocumentRequests, hasNewDocuments, unreadCount]);

  // Log feature access for debugging
  useEffect(() => {
    console.log('Employee dashboard feature access:', {
      documents: hasAccess('documents'),
      messages: hasAccess('messages'),
      vacation: hasAccess('vacation'),
      timeTracking: hasAccess('timeTracking')
    });
  }, [hasAccess]);

  // Initialize work alarms service
  useEffect(() => {
    if (user) {
      const cleanup = startAlarmService();
      return cleanup;
    }
  }, [user, startAlarmService]);

  return (
    <div className="h-screen bg-employee-gradient text-white flex flex-col overflow-hidden">
      {/* Fixed Content Container - Sin scroll */}
      <div className="flex-1 flex flex-col p-4">
        {/* Header - Compacto */}
        <div className="flex justify-between items-center py-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <UserAvatar
              fullName={user?.fullName || ''}
              size="sm"
              userId={user?.id}
              profilePicture={user?.profilePicture}
            />
            <div>
              <h1 className="text-xs font-medium text-white drop-shadow-lg">{user?.fullName}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAlarmModalOpen(true)}
              className="text-white hover:bg-white/10 backdrop-blur-xl border border-white/20 rounded-lg p-2"
              title="Configurar alarmas de trabajo"
            >
              <AlarmClock className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="text-white hover:bg-white/10 backdrop-blur-xl border border-white/20 rounded-lg px-2 py-1 text-xs"
            >
              <LogOut className="h-3 w-3 mr-1" />
              <span className="font-medium">Salir</span>
            </Button>
          </div>
        </div>

        {/* Company Logo and Name - Más grande sin cajón */}
        <div className="flex justify-center mb-3">
          <Dialog>
            <DialogTrigger asChild>
              <button className="text-center hover:scale-105 transition-transform duration-200 cursor-pointer">
                {/* Mostrar logo solo si tiene logo Y función habilitada en super admin */}
                {shouldShowLogo ? (
                  <img 
                    src={company.logoUrl} 
                    alt={company.name} 
                    className="h-10 w-auto mx-auto object-contain filter brightness-0 invert drop-shadow-lg"
                  />
                ) : (
                  <div className="text-white text-base font-medium drop-shadow-lg">
                    {company?.name || 'Mi Empresa'}
                  </div>
                )}
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-sm mx-auto bg-white/10 backdrop-blur-xl border border-white/20 text-white rounded-3xl shadow-2xl">
              {/* Tarjeta de Visita de la Empresa */}
              <div className="space-y-5 p-6">
                {/* Header con logo o nombre */}
                <div className="text-center pb-5">
                  {shouldShowLogo ? (
                    <img 
                      src={company.logoUrl} 
                      alt={company.name} 
                      className="h-12 w-auto mx-auto object-contain filter brightness-0 invert mb-4"
                    />
                  ) : (
                    <div className="w-12 h-12 mx-auto bg-white/10 rounded-2xl flex items-center justify-center mb-4">
                      <Building2 className="h-6 w-6 text-white" />
                    </div>
                  )}
                  <h2 className="text-lg font-semibold text-white">
                    {company?.name || 'Mi Empresa'}
                  </h2>
                </div>

                {/* Información de la empresa */}
                <div className="space-y-4">
                  {/* CIF */}
                  {company?.cif && (
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 rounded-xl bg-blue-400/20 flex items-center justify-center">
                        <CreditCard className="h-4 w-4 text-blue-300" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-white/60 mb-1">CIF</p>
                        <p className="text-sm font-medium text-white">{company.cif}</p>
                      </div>
                    </div>
                  )}

                  {/* Dirección Postal */}
                  {(company?.address || company?.province) && (
                    <div className="flex items-start space-x-4">
                      <div className="w-8 h-8 rounded-xl bg-green-400/20 flex items-center justify-center mt-0.5">
                        <MapPin className="h-4 w-4 text-green-300" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-white/60 mb-1">Dirección</p>
                        <div className="text-sm font-medium text-white leading-relaxed">
                          {company?.address && (
                            <p>{company.address}</p>
                          )}
                          {company?.province && (
                            <p>{company.province}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Email de contacto */}
                  {company?.email && (
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 rounded-xl bg-purple-400/20 flex items-center justify-center">
                        <MessageSquare className="h-4 w-4 text-purple-300" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-white/60 mb-1">Contacto</p>
                        <p className="text-sm font-medium text-white truncate">{company.email}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Menu Grid - Compacto */}
        <div className="mb-2">
          <div className="grid grid-cols-3 gap-2">
            {menuItems.map((item, index) => {
              const isFeatureDisabled = item.feature && !hasAccess(item.feature);
              

              
              return (
                <div key={index} className="flex flex-col items-center group">
                  <button
                    onClick={() => {
                      if (isFeatureDisabled) {
                        return; // Do nothing if feature is disabled
                      }
                      
                      if (item.title === 'Vacaciones') {
                        // Update last check time and clear notification when user visits vacations page
                        localStorage.setItem('lastVacationCheck', new Date().toISOString());
                        if (hasVacationUpdates) {
                          setHasVacationUpdates(false);
                          localStorage.removeItem('hasVacationUpdates');
                        }
                      }
                      handleNavigation(item.route);
                    }}
                    className={`relative w-24 h-24 transition-all duration-200 rounded-2xl flex items-center justify-center mb-2 backdrop-blur-xl border ${
                      isFeatureDisabled 
                        ? 'bg-gray-500/20 border-gray-400/30 cursor-not-allowed opacity-40' 
                        : 'bg-[#007AFF]/20 border-[#007AFF]/30 hover:bg-[#007AFF]/30 hover:border-[#007AFF]/50'
                    }`}
                    disabled={isFeatureDisabled}
                  >
                    <item.icon className={`h-12 w-12 transition-all duration-200 ${
                      isFeatureDisabled 
                        ? 'text-gray-400/50' 
                        : 'text-[#007AFF] drop-shadow-lg'
                    }`} />
                    {item.notification && !isFeatureDisabled && (
                      <div className={`absolute -top-2 -right-2 w-6 h-6 rounded-full border-2 border-white shadow-lg animate-bounce ${
                        (item as any).notificationType === 'red' ? 'bg-gradient-to-r from-red-500 to-pink-500' : 
                        (item as any).notificationType === 'green' ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-red-500 to-pink-500'
                      }`}>
                        <div className="w-full h-full rounded-full animate-ping opacity-75 bg-white/30"></div>
                      </div>
                    )}
                    {/* Efecto de brillo en hover */}
                    {!isFeatureDisabled && (
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform -skew-x-12"></div>
                    )}
                  </button>
                  <span className={`text-sm font-medium text-center leading-tight transition-all duration-300 ${
                    isFeatureDisabled 
                      ? 'text-white/30' 
                      : 'text-white/90 group-hover:text-white group-hover:scale-105'
                  }`}>
                    {item.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Status Line and Last Clock In Info / Temporary Message - Compacto */}
        <div className="text-center mb-2 mt-6 flex justify-center">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-2 w-[304px]">
            {/* Status Line */}
            <div className={`text-xs mb-2 font-medium ${
              sessionStatus.isActive 
                ? activeBreak 
                  ? 'text-orange-400' 
                  : 'text-green-400'
                : sessionStatus.isIncomplete
                  ? 'text-yellow-400'
                  : 'text-red-400'
            }`}>
              {sessionStatus.isActive 
                ? activeBreak 
                  ? '🟡 En descanso' 
                  : '🟢 Trabajando...'
                : sessionStatus.isIncomplete
                  ? '🟡 Sesión incompleta'
                  : '🔴 Fuera del trabajo'}
            </div>
            
            {temporaryMessage ? (
              <>
                <div className="text-green-400 text-xs mb-1 font-medium">✓ Fichaje exitoso</div>
                <div className="text-white text-sm font-medium">
                  {temporaryMessage}
                </div>
              </>
            ) : (
              <>
                <div className="text-white/60 text-xs mb-1 font-medium">Tu último fichaje</div>
                <div className="text-white text-sm font-medium">
                  {formatLastClockDate() || 'Sin fichajes previos'}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Clock Button or Vacation Message - Compacto */}
        <div className="flex-1 flex items-center justify-center pb-4">
          {isOnVacation ? (
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 flex items-center justify-center mb-3 shadow-lg">
                <Palmtree className="w-12 h-12 text-white" />
              </div>
              <p className="text-sm font-bold text-white text-center">
                ¡Disfruta de tus vacaciones!
              </p>
            </div>
          ) : (
            <div className="relative w-full flex justify-center">
              {/* Contenedor centrado que se adapta al número de botones */}
              <div className={`flex items-center gap-6 transition-all duration-500 ${
                (sessionStatus.isActive || sessionStatus.isIncomplete) ? 'justify-center' : 'justify-center'
              }`}>
                
                {/* Break Button - Solo visible cuando hay sesión activa del día */}
                {sessionStatus.isActive && (
                  <div className="transition-all duration-700 transform translate-x-0 opacity-100 scale-100 animate-slideInFromRight">
                    <Button
                      onClick={() => {
                        if (activeBreak) {
                          endBreakMutation.mutate();
                        } else {
                          startBreakMutation.mutate();
                        }
                      }}
                      disabled={startBreakMutation.isPending || endBreakMutation.isPending}
                      className={`w-32 h-32 rounded-full ${
                        activeBreak 
                          ? 'bg-red-500 hover:bg-red-600' 
                          : 'bg-orange-500 hover:bg-orange-600'
                      } text-white text-sm font-bold shadow-lg transition-all duration-300 relative overflow-hidden`}
                    >
                      {startBreakMutation.isPending || endBreakMutation.isPending ? (
                        <LoadingSpinner size="lg" className="text-white w-12 h-12" />
                      ) : (
                        <span className="relative z-10 whitespace-pre-line">
                          {activeBreak ? 'Terminar\nDescanso' : 'Tomar\nDescanso'}
                        </span>
                      )}
                      {/* Indicador de descanso activo */}
                      {activeBreak && (
                        <div className="absolute -inset-1 rounded-full border border-red-400 animate-pulse opacity-75"></div>
                      )}
                    </Button>
                  </div>
                )}

                {/* Clock Button - Siempre visible */}
                <div className="transition-all duration-500">
                  <Button
                    onClick={handleClockAction}
                    disabled={clockInMutation.isPending || clockOutMutation.isPending}
                    className="w-32 h-32 rounded-full bg-[#007AFF] hover:bg-[#0056CC] text-white text-xl font-bold shadow-lg transition-all duration-300 relative overflow-hidden"
                  >
                    {clockInMutation.isPending || clockOutMutation.isPending ? (
                      <LoadingSpinner size="lg" className="text-white w-12 h-12" />
                    ) : (
                      <span className="relative z-10">
                        {(sessionStatus.isActive || sessionStatus.isIncomplete) ? 'SALIR' : 'FICHAR'}
                      </span>
                    )}
                    {/* Anillo exterior pulsante cuando está activo */}
                    {(sessionStatus.isActive || sessionStatus.isIncomplete) && (
                      <div className={`absolute -inset-1 rounded-full border animate-ping opacity-75 ${
                        sessionStatus.isIncomplete ? 'border-yellow-400' : 'border-green-400'
                      }`}></div>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Small Oficaz logo at bottom */}
      <div className="text-center pb-3">
        <div className="flex items-center justify-center space-x-1 text-gray-400 text-xs">
          <span className="font-semibold text-blue-400">Oficaz</span>
          <span>© {currentYear}</span>
        </div>
      </div>

      {/* Work Alarms Modal */}
      {isAlarmModalOpen && (
        <WorkAlarmsModal 
          isOpen={isAlarmModalOpen}
          onClose={() => setIsAlarmModalOpen(false)}
        />
      )}
    </div>
  );
}

// Work Alarms Modal Component
function WorkAlarmsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [alarms, setAlarms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingAlarm, setEditingAlarm] = useState<any>(null);
  
  // Form states
  const [formData, setFormData] = useState({
    title: '',
    type: 'clock_in' as 'clock_in' | 'clock_out',
    time: '',
    weekdays: [] as number[],
    soundEnabled: true
  });

  // Load alarms
  const loadAlarms = async () => {
    try {
      setIsLoading(true);
      const response = await apiRequest('GET', '/api/work-alarms');
      setAlarms(response || []);
    } catch (error) {
      console.error('Error loading alarms:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las alarmas',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Load alarms when modal opens
  useEffect(() => {
    if (isOpen) {
      loadAlarms();
    }
  }, [isOpen]);

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.time || formData.weekdays.length === 0) {
      toast({
        title: 'Error',
        description: 'Por favor completa todos los campos',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsLoading(true);
      
      if (editingAlarm) {
        // Update existing alarm
        await apiRequest('PUT', `/api/work-alarms/${editingAlarm.id}`, formData);
        toast({
          title: 'Éxito',
          description: 'Alarma actualizada correctamente'
        });
      } else {
        // Create new alarm
        await apiRequest('POST', '/api/work-alarms', formData);
        toast({
          title: 'Éxito',
          description: 'Alarma creada correctamente'
        });
      }
      
      // Reset form
      setFormData({
        title: '',
        type: 'clock_in',
        time: '',
        weekdays: [],
        soundEnabled: true
      });
      setShowForm(false);
      setEditingAlarm(null);
      loadAlarms();
    } catch (error) {
      console.error('Error saving alarm:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar la alarma',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle delete alarm
  const handleDelete = async (alarmId: number) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta alarma?')) {
      return;
    }

    try {
      setIsLoading(true);
      await apiRequest('DELETE', `/api/work-alarms/${alarmId}`);
      toast({
        title: 'Éxito',
        description: 'Alarma eliminada correctamente'
      });
      loadAlarms();
    } catch (error) {
      console.error('Error deleting alarm:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la alarma',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle edit alarm
  const handleEdit = (alarm: any) => {
    setEditingAlarm(alarm);
    setFormData({
      title: alarm.title,
      type: alarm.type,
      time: alarm.time,
      weekdays: alarm.weekdays,
      soundEnabled: alarm.soundEnabled
    });
    setShowForm(true);
  };

  // Toggle weekday
  const toggleWeekday = (day: number) => {
    setFormData(prev => ({
      ...prev,
      weekdays: prev.weekdays.includes(day)
        ? prev.weekdays.filter(d => d !== day)
        : [...prev.weekdays, day].sort()
    }));
  };

  // Weekday names
  const weekdayNames = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const weekdayFullNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Alarmas de Trabajo</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {/* Add alarm button */}
          {!showForm && (
            <Button
              onClick={() => setShowForm(true)}
              className="w-full mb-4 bg-[#007AFF] hover:bg-[#0056CC]"
            >
              + Nueva Alarma
            </Button>
          )}

          {/* Alarm form */}
          {showForm && (
            <form onSubmit={handleSubmit} className="mb-6 p-4 border rounded-lg bg-gray-50">
              <h3 className="font-medium mb-4 text-gray-900">
                {editingAlarm ? 'Editar Alarma' : 'Nueva Alarma'}
              </h3>
              
              {/* Title */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Título
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Ej: Entrada oficina"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                  required
                />
              </div>

              {/* Type */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as 'clock_in' | 'clock_out' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                >
                  <option value="clock_in">Entrada (Fichar)</option>
                  <option value="clock_out">Salida (Salir)</option>
                </select>
              </div>

              {/* Time */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hora
                </label>
                <input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                  required
                />
              </div>

              {/* Weekdays */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Días de la semana
                </label>
                <div className="flex gap-1">
                  {weekdayNames.map((day, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => toggleWeekday(index + 1)}
                      className={`w-8 h-8 text-xs font-medium rounded ${
                        formData.weekdays.includes(index + 1)
                          ? 'bg-[#007AFF] text-white'
                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                      }`}
                      title={weekdayFullNames[index]}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sound */}
              <div className="mb-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.soundEnabled}
                    onChange={(e) => setFormData(prev => ({ ...prev, soundEnabled: e.target.checked }))}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Activar sonido</span>
                </label>
              </div>

              {/* Form buttons */}
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-[#007AFF] hover:bg-[#0056CC]"
                >
                  {isLoading ? 'Guardando...' : editingAlarm ? 'Actualizar' : 'Crear'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setEditingAlarm(null);
                    setFormData({
                      title: '',
                      type: 'clock_in',
                      time: '',
                      weekdays: [],
                      soundEnabled: true
                    });
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          )}

          {/* Alarms list */}
          <div className="space-y-3">
            {isLoading && !showForm ? (
              <div className="text-center py-4">
                <LoadingSpinner size="lg" />
              </div>
            ) : alarms.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                No tienes alarmas configuradas
              </div>
            ) : (
              alarms.map((alarm) => (
                <div
                  key={alarm.id}
                  className="p-3 border rounded-lg bg-white shadow-sm"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{alarm.title}</h4>
                      <p className="text-sm text-gray-600">
                        {alarm.type === 'clock_in' ? 'Entrada' : 'Salida'} a las {alarm.time}
                      </p>
                      <p className="text-xs text-gray-500">
                        {alarm.weekdays.map((day: number) => weekdayNames[day - 1]).join(', ')}
                        {alarm.soundEnabled && ' • Con sonido'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(alarm)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(alarm.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}