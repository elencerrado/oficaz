import { useAuth } from '@/hooks/use-auth';
import { useFeatureCheck } from '@/hooks/use-feature-check';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Clock, User, FileText, Calendar, Bell, MessageSquare, LogOut, Palmtree } from 'lucide-react';
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
  
  // Lógica inteligente: mostrar logo solo si tiene logo Y función habilitada
  const shouldShowLogo = company?.logoUrl && hasAccess('logoUpload');
  const [hasVacationUpdates, setHasVacationUpdates] = useState(() => {
    return localStorage.getItem('hasVacationUpdates') === 'true';
  });
  const [lastVacationCheck, setLastVacationCheck] = useState<any[]>([]);

  // Data fetching with real-time updates
  const { data: activeSession } = useQuery<WorkSession>({
    queryKey: ['/api/work-sessions/active'],
    enabled: !!user,
    staleTime: 10 * 1000, // 10 seconds for real-time updates
    gcTime: 2 * 60 * 1000, // 2 minutes
    retry: 1,
    retryDelay: 500,
    refetchInterval: 3 * 1000, // Poll every 3 seconds for clock status
    refetchIntervalInBackground: true, // Continue polling in background
  });

  // Get unread messages count with real-time updates
  const { data: unreadCount } = useQuery<{ count: number }>({
    queryKey: ['/api/messages/unread-count'],
    enabled: !!user,
    refetchInterval: 10000, // Check every 10 seconds
    refetchIntervalInBackground: true,
    staleTime: 0, // Always fetch fresh data
  });

  // Get document notifications with real-time updates
  const { data: documents } = useQuery({
    queryKey: ['/api/documents'],
    enabled: !!user,
    refetchInterval: 15000, // Check every 15 seconds
    refetchIntervalInBackground: true,
  });

  // Get real document notifications from database with real-time updates
  const { data: documentNotifications } = useQuery({
    queryKey: ['/api/document-notifications'],
    enabled: !!user,
    refetchInterval: 15000, // Check every 15 seconds
    refetchIntervalInBackground: true,
  });

  // Get vacation requests with real-time updates for notifications
  const { data: vacationRequests = [] } = useQuery({
    queryKey: ['/api/vacation-requests'],
    enabled: !!user,
    refetchInterval: 10000, // Check every 10 seconds for vacation updates
    refetchIntervalInBackground: true,
    staleTime: 0, // Always fetch fresh data for vacation notifications
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

  // Check if user is currently on vacation
  const today = new Date().toISOString().split('T')[0];
  const isOnVacation = vacationRequests.some((request: any) => 
    request.status === 'approved' &&
    request.startDate.split('T')[0] <= today &&
    request.endDate.split('T')[0] >= today
  );

  // Check for pending notifications and new documents
  const hasDocumentRequests = (documentNotifications as any[] || []).length > 0;
  const hasNewDocuments = (documents as any[] || []).length > 0;

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
      toast({ title: '¡Entrada registrada!', description: 'Has fichado correctamente la entrada.' });
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
      toast({ title: '¡Salida registrada!', description: 'Has fichado correctamente la salida.' });
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

  const formatLastClockDate = () => {
    const sessionToShow = activeSession || (recentSessions && recentSessions[0]);
    if (!sessionToShow) return '';
    
    const clockInDate = new Date(sessionToShow.clockIn);
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
      return `Hoy a las ${time}`;
    } else if (isYesterday) {
      return `Ayer a las ${time}`;
    } else {
      const dayName = clockInDate.toLocaleDateString('es-ES', { weekday: 'long' });
      const dayNumber = clockInDate.getDate();
      const month = clockInDate.toLocaleDateString('es-ES', { month: 'long' });
      return `El ${dayName} ${dayNumber} de ${month} a las ${time}`;
    }
  };

  const handleClockAction = () => {
    if (activeSession) {
      clockOutMutation.mutate();
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
      route: `/${companyAlias}/horas`,
      notification: false,
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

  return (
    <div className="h-screen bg-employee-gradient text-white flex flex-col overflow-hidden">
      {/* Scrollable Content Container */}
      <div className="flex-1 overflow-y-auto">
        {/* Header - Moderno y elegante */}
        <div className="flex justify-between items-center p-6 pb-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/30 to-blue-600/20 border border-blue-400/30 flex items-center justify-center backdrop-blur-xl">
              <span className="text-white font-bold text-lg">
                {user?.fullName?.split(' ').map(n => n[0]).join('').substring(0, 2) || 'U'}
              </span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white drop-shadow-lg">{user?.fullName}</h1>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="text-white hover:bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl px-4 py-2 transition-all duration-300 hover:scale-105"
          >
            <LogOut className="h-4 w-4 mr-2" />
            <span className="font-medium">Salir</span>
          </Button>
        </div>

        {/* Company Logo and Name - Limpio y simple */}
        <div className="flex justify-center mb-8">
          <div className="text-center">
            {/* Mostrar logo solo si tiene logo Y función habilitada en super admin */}
            {shouldShowLogo ? (
              <img 
                src={company.logoUrl} 
                alt={company.name} 
                className="h-12 w-auto mx-auto object-contain filter brightness-0 invert drop-shadow-lg"
              />
            ) : (
              <div className="text-white text-lg font-semibold drop-shadow-lg">
                {company?.name || 'Mi Empresa'}
              </div>
            )}
          </div>
        </div>

        {/* Menu Grid - Moderno y elegante inspirado en el hero */}
        <div className="px-6 mb-8">
          <div className="grid grid-cols-3 gap-6">
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
                    className={`relative w-28 h-28 transition-all duration-300 rounded-2xl flex items-center justify-center mb-3 backdrop-blur-xl border ${
                      isFeatureDisabled 
                        ? 'bg-gray-500/20 border-gray-400/30 cursor-not-allowed opacity-40' 
                        : 'bg-blue-500/20 border-blue-400/30 hover:bg-blue-500/30 hover:border-blue-400/50 hover:shadow-2xl hover:shadow-blue-500/30 transform hover:scale-110 hover:-translate-y-1 group-hover:animate-pulse'
                    }`}
                    disabled={isFeatureDisabled}
                  >
                    <item.icon className={`h-14 w-14 transition-all duration-300 ${
                      isFeatureDisabled 
                        ? 'text-gray-400/50' 
                        : 'text-white drop-shadow-lg group-hover:scale-110'
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

        {/* Last Clock In Info - Elegante y moderno */}
        <div className="px-6 mb-6 text-center">
          <div className="backdrop-blur-xl bg-white/5 border border-white/20 rounded-2xl p-4 mx-4">
            <div className="text-white/60 text-sm mb-2 font-medium">Tu último fichaje</div>
            <div className="text-white text-lg font-semibold">
              {formatLastClockDate() || 'Sin fichajes previos'}
            </div>
          </div>
        </div>

        {/* Clock Button or Vacation Message - Moderno y espectacular */}
        <div className="flex-1 flex items-center justify-center px-6 pb-8 min-h-[200px]">
          {isOnVacation ? (
            <div className="flex flex-col items-center">
              <div className="w-40 h-40 rounded-full bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 flex items-center justify-center mb-6 shadow-2xl shadow-emerald-500/30 border-4 border-white/20 backdrop-blur-xl">
                <Palmtree className="w-20 h-20 text-white drop-shadow-lg" />
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/20 to-transparent"></div>
              </div>
              <p className="text-xl font-bold text-white mb-2 text-center drop-shadow-lg">
                ¡Disfruta de tus vacaciones,
              </p>
              <p className="text-xl font-bold text-white text-center drop-shadow-lg">
                te las has ganado!
              </p>
            </div>
          ) : (
            <div className="relative">
              <Button
                onClick={handleClockAction}
                disabled={clockInMutation.isPending || clockOutMutation.isPending}
                className="w-40 h-40 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 hover:from-blue-400 hover:to-blue-600 text-white text-xl font-bold shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-110 active:scale-95 border-4 border-white/20 backdrop-blur-xl relative overflow-hidden"
              >
                {clockInMutation.isPending || clockOutMutation.isPending ? (
                  <LoadingSpinner size="lg" className="text-white scale-150" />
                ) : (
                  <>
                    <span className="relative z-10 drop-shadow-lg">
                      {activeSession ? 'SALIR' : 'FICHAR'}
                    </span>
                  </>
                )}
                {/* Efecto de brillo animado */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500 transform -skew-x-12 animate-pulse"></div>
                {/* Anillo exterior pulsante cuando está activo */}
                {activeSession && (
                  <div className="absolute -inset-2 rounded-full border-2 border-green-400 animate-ping opacity-75"></div>
                )}
              </Button>
              {/* Partículas flotantes decorativas */}
              <div className="absolute -top-4 -left-4 w-3 h-3 bg-blue-400/60 rounded-full animate-bounce delay-100"></div>
              <div className="absolute -top-2 -right-6 w-2 h-2 bg-blue-300/60 rounded-full animate-bounce delay-300"></div>
              <div className="absolute -bottom-6 -left-2 w-4 h-4 bg-blue-500/60 rounded-full animate-bounce delay-500"></div>
              <div className="absolute -bottom-4 -right-4 w-2 h-2 bg-blue-600/60 rounded-full animate-bounce delay-700"></div>
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
    </div>
  );
}