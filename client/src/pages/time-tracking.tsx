import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
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
import { format, startOfMonth, endOfMonth, addMonths, subMonths, addDays, subDays } from 'date-fns';
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
  const [dateFilter, setDateFilter] = useState('month'); // 'day', 'month', 'custom'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedStartDate, setSelectedStartDate] = useState<Date | null>(null);
  const [selectedEndDate, setSelectedEndDate] = useState<Date | null>(null);
  const [isRangeDialogOpen, setIsRangeDialogOpen] = useState(false);
  const [isDayDialogOpen, setIsDayDialogOpen] = useState(false);
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

  // Get unique months from sessions
  const availableMonths = sessionsList.reduce((months: string[], session: any) => {
    const sessionDate = new Date(session.clockIn);
    const monthKey = format(sessionDate, 'yyyy-MM');
    if (!months.includes(monthKey)) {
      months.push(monthKey);
    }
    return months;
  }, []).sort().reverse(); // Most recent first

  // Update currentMonth to most recent available month if not already set correctly
  const currentMonthKey = format(currentMonth, 'yyyy-MM');
  if (availableMonths.length > 0 && !availableMonths.includes(currentMonthKey)) {
    const [year, month] = availableMonths[0].split('-');
    setCurrentMonth(new Date(parseInt(year), parseInt(month) - 1, 1));
  }

  // Filter sessions based on search, employee and date range
  const filteredSessions = sessionsList.filter((session: any) => {
    const sessionDate = new Date(session.clockIn);
    
    const matchesEmployee = selectedEmployee === 'all' || session.userId.toString() === selectedEmployee;
    const matchesSearch = session.userName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Date filtering
    let matchesDate = true;
    if (dateFilter === 'day') {
      const dayStart = new Date(currentDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);
      matchesDate = sessionDate >= dayStart && sessionDate <= dayEnd;
    } else if (dateFilter === 'month') {
      const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      monthStart.setHours(0, 0, 0, 0);
      const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      monthEnd.setHours(23, 59, 59, 999);
      matchesDate = sessionDate >= monthStart && sessionDate <= monthEnd;
    } else if (dateFilter === 'custom' && startDate && endDate) {
      const filterStart = new Date(startDate);
      const filterEnd = new Date(endDate);
      filterEnd.setHours(23, 59, 59, 999);
      matchesDate = sessionDate >= filterStart && sessionDate <= filterEnd;
    } else if (dateFilter === 'custom' && startDate && !endDate) {
      const filterStart = new Date(startDate);
      matchesDate = sessionDate >= filterStart;
    } else if (dateFilter === 'custom' && !startDate && endDate) {
      const filterEnd = new Date(endDate);
      filterEnd.setHours(23, 59, 59, 999);
      matchesDate = sessionDate <= filterEnd;
    }
    
    return matchesEmployee && matchesSearch && matchesDate;
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

  // Calculate employees who have clocked in
  const uniqueEmployeesWithSessions = new Set(filteredSessions.map((s: any) => s.userId));
  const employeesWithSessions = uniqueEmployeesWithSessions.size;
  const totalEmployees = employeesList.length;
  
  // Calculate average hours per employee
  const averageHoursPerEmployee = employeesWithSessions > 0 ? totalHours / employeesWithSessions : 0;
  
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
                <p className="text-sm text-gray-500">Han Fichado</p>
                <p className="text-xl font-semibold text-gray-900">
                  {employeesWithSessions}/{totalEmployees}
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
                <p className="text-sm text-gray-500">Media Horas</p>
                <p className="text-xl font-semibold text-gray-900">
                  {averageHoursPerEmployee.toFixed(1)}h
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
                <p className="text-sm text-gray-500">Completados</p>
                <p className="text-xl font-semibold text-gray-900">
                  {completedSessions}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Section - Compact */}
      <Card className="mb-4">
        <CardContent className="p-3">
          {/* Date Filter Type Selector */}
          <div className="flex items-center justify-center space-x-2 mb-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCurrentDate(new Date());
                setDateFilter('day');
              }}
              className="text-blue-600 border-blue-600 hover:bg-blue-50"
            >
              Hoy
            </Button>
            <Button
              variant={dateFilter === 'day' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateFilter('day')}
              className={dateFilter === 'day' ? 'bg-oficaz-primary' : ''}
            >
              Día
            </Button>
            <Button
              variant={dateFilter === 'month' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateFilter('month')}
              className={dateFilter === 'month' ? 'bg-oficaz-primary' : ''}
            >
              Mes
            </Button>
            <Button
              variant={dateFilter === 'custom' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateFilter('custom')}
              className={dateFilter === 'custom' ? 'bg-oficaz-primary' : ''}
            >
              Rango
            </Button>
          </div>

          {/* Date Navigation Based on Type */}
          {dateFilter === 'day' && (
            <div className="flex items-center justify-center space-x-3 mb-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(subDays(currentDate, 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Dialog open={isDayDialogOpen} onOpenChange={setIsDayDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-[200px] justify-center font-medium"
                  >
                    {format(currentDate, 'EEEE, d MMMM yyyy', { locale: es })}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Seleccionar día</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Calendar
                      mode="single"
                      selected={currentDate}
                      onSelect={(date) => {
                        if (date) {
                          setCurrentDate(date);
                          setIsDayDialogOpen(false);
                        }
                      }}
                      locale={es}
                      className="rounded-md border"
                    />
                  </div>
                </DialogContent>
              </Dialog>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(addDays(currentDate, 1))}
                disabled={format(currentDate, 'yyyy-MM-dd') >= format(new Date(), 'yyyy-MM-dd')}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {dateFilter === 'month' && (
            <div className="flex items-center justify-center space-x-3 mb-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const currentIndex = availableMonths.indexOf(format(currentMonth, 'yyyy-MM'));
                  if (currentIndex < availableMonths.length - 1) {
                    const [year, month] = availableMonths[currentIndex + 1].split('-');
                    setCurrentMonth(new Date(parseInt(year), parseInt(month) - 1, 1));
                  }
                }}
                disabled={availableMonths.indexOf(format(currentMonth, 'yyyy-MM')) >= availableMonths.length - 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Select
                value={format(currentMonth, 'yyyy-MM')}
                onValueChange={(value) => {
                  const [year, month] = value.split('-');
                  setCurrentMonth(new Date(parseInt(year), parseInt(month) - 1, 1));
                }}
              >
                <SelectTrigger className="w-[150px] text-center font-medium">
                  <SelectValue>
                    {format(currentMonth, 'MMMM yyyy', { locale: es })}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableMonths.map((monthKey) => {
                    const [year, month] = monthKey.split('-');
                    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
                    return (
                      <SelectItem key={monthKey} value={monthKey}>
                        {format(date, 'MMMM yyyy', { locale: es })}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const currentIndex = availableMonths.indexOf(format(currentMonth, 'yyyy-MM'));
                  if (currentIndex > 0) {
                    const [year, month] = availableMonths[currentIndex - 1].split('-');
                    setCurrentMonth(new Date(parseInt(year), parseInt(month) - 1, 1));
                  }
                }}
                disabled={availableMonths.indexOf(format(currentMonth, 'yyyy-MM')) <= 0}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {dateFilter === 'custom' && (
            <div className="flex flex-col items-center justify-center mb-3 relative z-0">
              <Dialog open={isRangeDialogOpen} onOpenChange={setIsRangeDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="min-w-[200px] justify-center"
                  >
                    {selectedStartDate && selectedEndDate
                      ? `${format(selectedStartDate, 'd MMM', { locale: es })} - ${format(selectedEndDate, 'd MMM yyyy', { locale: es })}`
                      : 'Seleccionar rango de fechas'
                    }
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Seleccionar rango de fechas</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Calendar
                      mode="range"
                      selected={{
                        from: selectedStartDate || undefined,
                        to: selectedEndDate || undefined,
                      }}
                      onSelect={(range) => {
                        if (range?.from) {
                          setSelectedStartDate(range.from);
                          setStartDate(format(range.from, 'yyyy-MM-dd'));
                        }
                        if (range?.to) {
                          setSelectedEndDate(range.to);
                          setEndDate(format(range.to, 'yyyy-MM-dd'));
                        }
                      }}
                      className="rounded-md border"
                      disabled={(date) => date > new Date()}
                      locale={es}
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedStartDate(null);
                          setSelectedEndDate(null);
                          setStartDate('');
                          setEndDate('');
                        }}
                        className="flex-1"
                      >
                        Limpiar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setIsRangeDialogOpen(false)}
                        className="flex-1"
                      >
                        Aplicar
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {/* Employee Filter and Search */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-center border-t pt-3">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="w-48">
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

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar empleado..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-48"
              />
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