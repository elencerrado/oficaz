import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Clock, 
  Search, 
  Edit, 
  Users,
  Filter,
  CalendarDays,
  TrendingUp,
  Download,
  ChevronLeft,
  ChevronRight,
  Check,
  X
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function TimeTracking() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for filters and editing
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [editingSession, setEditingSession] = useState<number | null>(null);
  const [editData, setEditData] = useState({
    clockIn: '',
    clockOut: '',
    date: '',
  });

  // Load company work sessions for admin/manager
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['/api/work-sessions/company'],
    enabled: !!user && (user.role === 'admin' || user.role === 'manager')
  });

  // Load employees for filter dropdown
  const { data: employees = [] } = useQuery({
    queryKey: ['/api/employees'],
    enabled: !!user && (user.role === 'admin' || user.role === 'manager')
  });

  // Update session mutation
  const updateSessionMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest('PATCH', `/api/work-sessions/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions/company'] });
      toast({
        title: 'Fichaje Actualizado',
        description: 'Los cambios se han guardado exitosamente.',
      });
      setEditingSession(null);
      setEditData({ clockIn: '', clockOut: '', date: '' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar el fichaje.',
        variant: 'destructive',
      });
    },
  });

  // Handle edit session
  const handleEditSession = (session: any) => {
    setEditingSession(session.id);
    setEditData({
      clockIn: session.clockIn ? format(new Date(session.clockIn), 'HH:mm') : '',
      clockOut: session.clockOut ? format(new Date(session.clockOut), 'HH:mm') : '',
      date: format(new Date(session.clockIn), 'yyyy-MM-dd'),
    });
  };

  // Save edited session
  const handleSaveSession = (sessionId: number) => {
    const clockInDateTime = new Date(`${editData.date}T${editData.clockIn}:00`);
    const clockOutDateTime = editData.clockOut ? new Date(`${editData.date}T${editData.clockOut}:00`) : null;
    
    updateSessionMutation.mutate({
      id: sessionId,
      data: {
        clockIn: clockInDateTime.toISOString(),
        clockOut: clockOutDateTime?.toISOString() || null,
      }
    });
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingSession(null);
    setEditData({ clockIn: '', clockOut: '', date: '' });
  };

  if (isLoading) {
    return (
      <div className="px-6 py-4">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-16 bg-gray-200 rounded-lg"></div>
          <div className="h-96 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  const sessionsList = sessions as any[];
  const employeesList = employees as any[];

  // Filter sessions based on search and selected employee and month
  const filteredSessions = sessionsList.filter((session: any) => {
    const sessionDate = new Date(session.clockIn);
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    
    const matchesEmployee = selectedEmployee === 'all' || session.userId.toString() === selectedEmployee;
    const matchesSearch = session.userName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMonth = sessionDate >= monthStart && sessionDate <= monthEnd;
    
    return matchesEmployee && matchesSearch && matchesMonth;
  });

  // Calculate totals
  const calculateHours = (clockIn: string, clockOut: string | null) => {
    if (!clockOut) return 0;
    const start = new Date(clockIn);
    const end = new Date(clockOut);
    return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  };

  const totalHours = filteredSessions.reduce((total: number, session: any) => {
    return total + calculateHours(session.clockIn, session.clockOut);
  }, 0);

  const totalSessions = filteredSessions.length;
  const completedSessions = filteredSessions.filter((s: any) => s.clockOut).length;

  return (
    <div className="px-6 py-4 min-h-screen bg-gray-50" style={{ overflowX: 'clip' }}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Gestión de Fichajes</h1>
        <p className="text-gray-500 mt-1">
          Administra todos los fichajes de empleados y genera reportes.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Horas</p>
                <p className="text-xl font-semibold text-gray-900">
                  {totalHours.toFixed(1)}h
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Fichajes</p>
                <p className="text-xl font-semibold text-gray-900">
                  {totalSessions}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Completados</p>
                <p className="text-xl font-semibold text-gray-900">
                  {completedSessions}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <CalendarDays className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Promedio Día</p>
                <p className="text-xl font-semibold text-gray-900">
                  {completedSessions > 0 ? (totalHours / completedSessions).toFixed(1) : '0.0'}h
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Section */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="space-y-4">
            {/* Month Navigator - Full width row */}
            <div className="flex items-center justify-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="text-center min-w-[160px]">
                <p className="font-medium text-gray-900">
                  {format(currentMonth, 'MMMM yyyy', { locale: es })}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(new Date())}
              >
                Hoy
              </Button>
            </div>

            {/* Filters row - Simple grid layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Employee Filter */}
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <div className="flex-1 max-w-xs">
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filtrar empleado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los empleados</SelectItem>
                      {employeesList.map((employee: any) => (
                        <SelectItem key={employee.id} value={employee.id.toString()}>
                          {employee.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar empleado..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 max-w-xs"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sessions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Fichajes ({filteredSessions.length})</span>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Empleado</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Fecha</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Entrada</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Salida</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Horas</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Estado</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-900">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.map((session: any, index: number) => {
                  const hours = calculateHours(session.clockIn, session.clockOut);
                  const isActive = !session.clockOut;
                  const isEditing = editingSession === session.id;
                  
                  return (
                    <tr 
                      key={session.id} 
                      className={`border-b hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} ${isEditing ? 'bg-blue-50' : ''}`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900">
                          {session.userName || 'Usuario Desconocido'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <Input
                            type="date"
                            value={editData.date}
                            onChange={(e) => setEditData(prev => ({ ...prev, date: e.target.value }))}
                            className="w-32 h-8"
                          />
                        ) : (
                          <div className="text-gray-700">
                            {format(new Date(session.clockIn), 'dd/MM/yyyy')}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <Input
                            type="time"
                            value={editData.clockIn}
                            onChange={(e) => setEditData(prev => ({ ...prev, clockIn: e.target.value }))}
                            className="w-24 h-8"
                          />
                        ) : (
                          <div className="text-gray-700">
                            {format(new Date(session.clockIn), 'HH:mm')}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <Input
                            type="time"
                            value={editData.clockOut}
                            onChange={(e) => setEditData(prev => ({ ...prev, clockOut: e.target.value }))}
                            className="w-24 h-8"
                          />
                        ) : (
                          <div className="text-gray-700">
                            {session.clockOut ? format(new Date(session.clockOut), 'HH:mm') : '-'}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900">
                          {hours > 0 ? `${hours.toFixed(1)}h` : '-'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge 
                          variant={isActive ? "default" : "secondary"}
                          className={isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}
                        >
                          {isActive ? 'Activo' : 'Completado'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSaveSession(session.id)}
                              disabled={updateSessionMutation.isPending}
                              className="text-green-600 hover:text-green-700 h-8 w-8 p-0"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleCancelEdit}
                              disabled={updateSessionMutation.isPending}
                              className="text-red-600 hover:text-red-700 h-8 w-8 p-0"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditSession(session)}
                            className="text-oficaz-primary hover:text-oficaz-primary/80 h-8 w-8 p-0"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            {filteredSessions.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No se encontraron fichajes para los filtros seleccionados.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}