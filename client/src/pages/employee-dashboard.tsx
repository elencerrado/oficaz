import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Clock, User, FileText, Calendar, Bell, MessageSquare, LogOut } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { useEffect } from 'react';

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
  const { toast } = useToast();

  // Get active work session
  const { data: activeSession } = useQuery<WorkSession>({
    queryKey: ['/api/work-sessions/active'],
  });

  // Get unread messages count
  const { data: unreadCount } = useQuery<{ count: number }>({
    queryKey: ['/api/messages/unread-count'],
    refetchInterval: 30000,
  });

  // Get document notifications
  const { data: documents } = useQuery({
    queryKey: ['/api/documents'],
    refetchInterval: 60000,
  });

  // Get real document notifications from database
  const { data: documentNotifications } = useQuery({
    queryKey: ['/api/document-notifications'],
    enabled: !!user,
  });

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
      const response = await fetch('/api/work-sessions/clock-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) throw new Error('Error al fichar entrada');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions'] });
      toast({ title: '¡Entrada registrada!', description: 'Has fichado correctamente la entrada.' });
    },
    onError: () => {
      toast({ 
        title: 'Error', 
        description: 'No se pudo registrar la entrada',
        variant: 'destructive'
      });
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/work-sessions/clock-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) throw new Error('Error al fichar salida');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions'] });
      toast({ title: '¡Salida registrada!', description: 'Has fichado correctamente la salida.' });
    },
    onError: () => {
      toast({ 
        title: 'Error', 
        description: 'No se pudo registrar la salida',
        variant: 'destructive'
      });
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
      notification: false 
    },
    { 
      icon: User, 
      title: 'Usuario', 
      route: `/${companyAlias}/usuario`,
      notification: false 
    },
    { 
      icon: FileText, 
      title: 'Documentos', 
      route: `/${companyAlias}/documentos`,
      notification: hasDocumentRequests || hasNewDocuments,
      notificationType: hasDocumentRequests ? 'red' : 'green'
    },
    { 
      icon: Calendar, 
      title: 'Vacaciones', 
      route: `/${companyAlias}/vacaciones`,
      notification: false 
    },
    { 
      icon: Bell, 
      title: 'Recordatorios', 
      route: `/${companyAlias}/notificaciones`,
      notification: false 
    },
    { 
      icon: MessageSquare, 
      title: 'Mensajes', 
      route: `/${companyAlias}/mensajes`,
      notification: (unreadCount?.count || 0) > 0 
    },
  ];

  const currentYear = new Date().getFullYear();

  // Ensure page always starts at top
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="h-screen bg-employee-gradient text-white flex flex-col overflow-hidden">
      {/* Scrollable Content Container */}
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-4 pb-4 flex-shrink-0">
          <div>
            <h1 className="text-lg font-medium">{user?.fullName}</h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="text-white hover:bg-white/10"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Salir
          </Button>
        </div>

        {/* Company Logo and Name */}
        <div className="flex justify-center mb-6">
          <div className="text-center">
            {company?.logoUrl ? (
              <img 
                src={company.logoUrl} 
                alt={company.name} 
                className="w-12 h-12 mx-auto rounded-full object-cover"
              />
            ) : (
              <div className="text-white text-base font-medium">
                {company?.name || 'Mi Empresa'}
              </div>
            )}
          </div>
        </div>

        {/* Menu Grid - iPhone style with compact icons */}
        <div className="px-6 mb-6">
          <div className="grid grid-cols-3 gap-6">
            {menuItems.map((item, index) => (
              <div key={index} className="flex flex-col items-center">
                <button
                  onClick={() => handleNavigation(item.route)}
                  className="relative w-24 h-24 bg-blue-500 hover:bg-blue-600 transition-all duration-200 rounded-xl flex items-center justify-center mb-2 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <item.icon className="h-12 w-12 text-white" />
                  {item.notification && (
                    <div className={`absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center shadow-md ${
                      (item as any).notificationType === 'red' ? 'bg-red-500' : 'bg-green-500'
                    }`}>
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                  )}
                </button>
                <span className="text-xs font-medium text-center text-white/90 leading-tight">
                  {item.title}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Last Clock In Info - Always visible */}
        <div className="px-6 mb-4 text-center">
          <div className="text-gray-300 text-xs mb-1">Tu último fichaje:</div>
          <div className="text-white text-sm font-medium">
            {formatLastClockDate() || 'Sin fichajes previos'}
          </div>
        </div>

        {/* Clock Button - Positioned for thumb accessibility */}
        <div className="flex-1 flex items-center justify-center px-6 pb-6 min-h-[200px]">
          <Button
            onClick={handleClockAction}
            disabled={clockInMutation.isPending || clockOutMutation.isPending}
            className="w-36 h-36 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-xl font-bold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 active:scale-95"
          >
            {clockInMutation.isPending || clockOutMutation.isPending ? (
              <LoadingSpinner size="lg" className="text-white scale-150" />
            ) : (
              <>
                {activeSession ? 'SALIR' : 'FICHAR'}
              </>
            )}
          </Button>
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