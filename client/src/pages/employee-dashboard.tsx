import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, User, FileText, Calendar, Bell, MessageSquare, LogOut } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface WorkSession {
  id: number;
  userId: number;
  clockIn: string;
  clockOut?: string;
  totalHours?: string;
  createdAt: string;
}

export default function EmployeeDashboard() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Get active work session
  const { data: activeSession } = useQuery<WorkSession>({
    queryKey: ['/api/work-sessions/active'],
  });

  // Get unread messages count
  const { data: unreadCount } = useQuery<{ count: number }>({
    queryKey: ['/api/messages/unread-count'],
    refetchInterval: 30000, // Refetch every 30 seconds
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

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const formatLastClockIn = (session: WorkSession | null) => {
    if (!session) return '';
    const date = new Date(session.clockIn);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const isYesterday = date.toDateString() === yesterday.toDateString();
    const time = formatTime(date);
    
    return isYesterday ? `Ayer a las ${time}` : `Hoy a las ${time}`;
  };

  const handleClockAction = () => {
    if (activeSession) {
      clockOutMutation.mutate();
    } else {
      clockInMutation.mutate();
    }
  };

  const menuItems = [
    { 
      icon: Clock, 
      title: 'Fichajes', 
      route: '/time-tracking',
      notification: false 
    },
    { 
      icon: User, 
      title: 'Usuario', 
      route: '/settings',
      notification: false 
    },
    { 
      icon: FileText, 
      title: 'Documentos', 
      route: '/documents',
      notification: false 
    },
    { 
      icon: Calendar, 
      title: 'Vacaciones', 
      route: '/vacation-requests',
      notification: false 
    },
    { 
      icon: Bell, 
      title: 'Recordatorios', 
      route: '/notifications',
      notification: false 
    },
    { 
      icon: MessageSquare, 
      title: 'Mensajes', 
      route: '/messages',
      notification: (unreadCount?.count || 0) > 0 
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 text-white">
      {/* Header */}
      <div className="flex justify-between items-center p-6 pb-4">
        <div>
          <h1 className="text-xl font-medium">{user?.fullName}</h1>
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

      {/* Logo */}
      <div className="flex justify-center mb-8">
        <div className="flex items-center space-x-2">
          <div className="text-4xl font-bold text-blue-400">Oficaz</div>
          <div className="w-8 h-8 bg-blue-400 rounded-full flex items-center justify-center">
            <div className="w-4 h-4 bg-white rounded-full"></div>
          </div>
        </div>
      </div>

      {/* Menu Grid */}
      <div className="px-6 mb-8">
        <div className="grid grid-cols-3 gap-4">
          {menuItems.map((item, index) => (
            <a
              key={index}
              href={item.route}
              className="relative block bg-blue-500 hover:bg-blue-600 transition-colors rounded-2xl p-4 aspect-square flex flex-col items-center justify-center text-center"
            >
              <item.icon className="h-8 w-8 mb-2" />
              <span className="text-sm font-medium">{item.title}</span>
              {item.notification && (
                <div className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
              )}
            </a>
          ))}
        </div>
      </div>

      {/* Last Clock In Info */}
      {activeSession && (
        <div className="px-6 mb-6 text-center">
          <div className="text-gray-300 text-sm mb-1">Tu último fichaje:</div>
          <div className="text-white font-medium">
            {formatLastClockIn(activeSession as WorkSession)}
          </div>
        </div>
      )}

      {/* Clock Button */}
      <div className="flex justify-center px-6">
        <Button
          onClick={handleClockAction}
          disabled={clockInMutation.isPending || clockOutMutation.isPending}
          className="w-48 h-48 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-2xl font-bold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
        >
          {clockInMutation.isPending || clockOutMutation.isPending ? (
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          ) : (
            <>
              {activeSession ? 'SALIR' : 'FICHAR'}
            </>
          )}
        </Button>
      </div>

      {/* Current Time */}
      <div className="text-center mt-8 text-gray-300 text-sm">
        {formatTime(currentTime)}
      </div>
    </div>
  );
}