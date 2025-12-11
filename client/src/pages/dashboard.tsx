import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClockWidget } from '@/components/time-tracking/clock-widget';
import { VacationModal } from '@/components/vacation/vacation-modal';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Clock, 
  Calendar, 
  Users, 
  Umbrella, 
  ArrowUp, 
  CalendarPlus, 
  Upload, 
  Send,
  User
} from 'lucide-react';
import { format } from 'date-fns';
import { usePageTitle } from '@/hooks/use-page-title';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export default function Dashboard() {
  usePageTitle('Panel de Control');
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isVacationModalOpen, setIsVacationModalOpen] = useState(false);
  const [showDemoBanner, setShowDemoBanner] = useState(false);
  const queryClient = useQueryClient();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['/api/dashboard/stats'],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const { data: recentMessages } = useQuery({
    queryKey: ['/api/messages'],
  });

  // Check if company has demo data
  const { data: demoStatus } = useQuery({
    queryKey: ['/api/demo-data/status'],
    select: (data: any) => data?.hasDemoData || false,
  });

  useEffect(() => {
    if (demoStatus === true) {
      setShowDemoBanner(true);
    }
  }, [demoStatus]);

  // Mutation to generate demo data
  const generateDemoDataMutation = useMutation({
    mutationFn: () => fetch('/api/demo-data/generate', { 
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    }).then(res => res.json()),
    onSuccess: () => {
      // Invalidate all queries to refresh the dashboard
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions/company'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vacation-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vacation-requests/company'] });
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reminders/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      alert('¡Datos demo generados exitosamente! Recarga la página para ver los empleados y datos de ejemplo.');
    },
    onError: (error) => {
      console.error('Error generating demo data:', error);
      alert('Error al generar datos demo. Por favor intenta de nuevo.');
    }
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-ES', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: false,
    });
  };

  const formatSessionTime = (startTime: string) => {
    const start = new Date(startTime);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen bg-gray-50">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Panel Principal</h1>
      
      {/* Demo Data Banner */}
      {showDemoBanner && (
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="mr-3">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">D</span>
                </div>
              </div>
              <div>
                <h3 className="text-blue-800 font-semibold">Datos de demostración activos</h3>
                <p className="text-blue-700 text-sm">
                  Esta cuenta incluye empleados y datos de ejemplo para explorar todas las funcionalidades.
                </p>
              </div>
            </div>
            <button 
              className="text-blue-400 hover:text-blue-600 ml-4"
              onClick={() => setShowDemoBanner(false)}
            >
              <span className="text-lg">&times;</span>
            </button>
          </div>
        </div>
      )}
      
      {/* Generate Demo Data Button */}
      <div className="mb-6">
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-orange-800 mb-1">Generar Datos Demo</h3>
                <p className="text-sm text-orange-700">
                  Crea empleados y datos de ejemplo para probar todas las funcionalidades de Oficaz.
                </p>
              </div>
              <Button
                onClick={() => generateDemoDataMutation.mutate()}
                disabled={generateDemoDataMutation.isPending}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                {generateDemoDataMutation.isPending ? (
                  <>
                    <LoadingSpinner size="xs" className="mr-2" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Users className="mr-2" size={16} />
                    Generar Datos Demo
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="rounded-2xl shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Horas de Hoy</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {(stats as any)?.todayHours || '0.0'}h
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100/20 rounded-xl flex items-center justify-center">
                <Clock className="text-oficaz-primary text-xl" />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center text-sm">
                <ArrowUp className="text-oficaz-success mr-1" size={16} />
                <span className="text-oficaz-success">Buen progreso</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Esta Semana</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {(stats as any)?.weekHours || '0.0'}h
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100/20 rounded-xl flex items-center justify-center">
                <Calendar className="text-oficaz-success text-xl" />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center text-sm">
                <span className="text-gray-500">
                  {Math.max(0, 40 - parseFloat((stats as any)?.weekHours || '0')).toFixed(1)}h remaining
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Días de Vacaciones</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {(stats as any)?.vacationDaysRemaining || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100/20 rounded-xl flex items-center justify-center">
                <Umbrella className="text-oficaz-warning text-xl" />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center text-sm">
                <span className="text-gray-500">restantes este año</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Empleados Activos</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {(stats as any)?.activeEmployees || 1}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100/20 rounded-xl flex items-center justify-center">
                <Users className="text-purple-600 text-xl" />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center text-sm">
                <span className="text-gray-500">in your company</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Clock In/Out Section */}
        <div className="lg:col-span-2 space-y-6">
          <ClockWidget />

          {/* Recent Time Entries */}
          <Card className="rounded-2xl shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Recent Time Entries</h2>
                <Button variant="ghost" size="sm" className="rounded-xl">
                  View All
                </Button>
              </div>
              
              <div className="space-y-3">
                {(stats as any)?.recentSessions?.length > 0 ? (
                  (stats as any).recentSessions.map((session: any, index: number) => (
                    <div key={session.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-oficaz-success rounded-full"></div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {index === 0 ? 'Today' : format(new Date(session.createdAt), 'MMM d')}
                          </p>
                          <p className="text-sm text-gray-500">
                            {format(new Date(session.clockIn), 'h:mm a')} - {
                              session.clockOut 
                                ? format(new Date(session.clockOut), 'h:mm a')
                                : 'In Progress'
                            }
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">
                          {session.totalHours ? `${parseFloat(session.totalHours).toFixed(1)}h` : 'Active'}
                        </p>
                        <p className={`text-xs ${
                          session.status === 'active' ? 'text-oficaz-primary' : 'text-oficaz-success'
                        }`}>
                          {session.status === 'active' ? 'In Progress' : 'Complete'}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Clock className="mx-auto mb-2" size={48} />
                    <p>No time entries yet</p>
                    <p className="text-sm">Clock in to start tracking your time</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <Button
                  variant="ghost"
                  className="w-full justify-start p-3 h-auto"
                  onClick={() => setIsVacationModalOpen(true)}
                >
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                    <CalendarPlus className="text-oficaz-primary" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900">Request Vacation</p>
                    <p className="text-sm text-gray-500">Submit time off request</p>
                  </div>
                </Button>

                <Button
                  variant="ghost"
                  className="w-full justify-start p-3 h-auto"
                >
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                    <Upload className="text-oficaz-success" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900">Upload Document</p>
                    <p className="text-sm text-gray-500">Add files to your profile</p>
                  </div>
                </Button>

                <Button
                  variant="ghost"
                  className="w-full justify-start p-3 h-auto"
                >
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                    <Send className="text-purple-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900">Send Message</p>
                    <p className="text-sm text-gray-500">Contact your team</p>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Messages */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Recent Messages</h2>
                <Button variant="ghost" size="sm">
                  View All
                </Button>
              </div>
              
              <div className="space-y-4">
                {(recentMessages as any)?.length > 0 ? (
                  (recentMessages as any).slice(0, 3).map((message: any) => (
                    <div key={message.id} className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="text-gray-600 text-sm" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900">
                            {message.senderName || 'Team Member'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {format(new Date(message.createdAt), 'MMM d')}
                          </p>
                        </div>
                        <p className="text-sm text-gray-600 mt-1 truncate">
                          {message.content}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    <p className="text-sm">No recent messages</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Current Session Timer (if active) */}
          {(stats as any)?.currentSession && (
            <Card>
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Session</h2>
                <div className="text-center">
                  <div className="text-3xl font-bold text-oficaz-primary mb-2">
                    {formatSessionTime((stats as any).currentSession.clockIn)}
                  </div>
                  <p className="text-sm text-gray-500">
                    Started at {format(new Date((stats as any).currentSession.clockIn), 'h:mm a')}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <VacationModal 
        isOpen={isVacationModalOpen}
        onClose={() => setIsVacationModalOpen(false)}
      />
    </div>
  );
}
