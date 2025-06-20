import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { 
  Search, 
  Edit, 
  Users,
  Filter,
  TrendingUp,
  Download,
  ChevronLeft,
  ChevronRight,
  Check,
  X
} from 'lucide-react';
import { format, startOfWeek, addDays, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';

export default function TimeTracking() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // All useState hooks first
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [dateFilter, setDateFilter] = useState('month');
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

  // All useQuery hooks
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['/api/work-sessions/company'],
    enabled: !!user && (user.role === 'admin' || user.role === 'manager')
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['/api/employees'],
    enabled: !!user && (user.role === 'admin' || user.role === 'manager')
  });

  // All useMutation hooks
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

  // All useCallback hooks
  const handleEditSession = useCallback((session: any) => {
    setEditingSession(session.id);
    setEditData({
      clockIn: session.clockIn ? format(new Date(session.clockIn), 'HH:mm') : '',
      clockOut: session.clockOut ? format(new Date(session.clockOut), 'HH:mm') : '',
      date: format(new Date(session.clockIn), 'yyyy-MM-dd'),
    });
  }, []);

  const handleSaveSession = useCallback((sessionId: number) => {
    const clockInDateTime = new Date(`${editData.date}T${editData.clockIn}:00`);
    const clockOutDateTime = editData.clockOut ? new Date(`${editData.date}T${editData.clockOut}:00`) : null;
    
    updateSessionMutation.mutate({
      id: sessionId,
      data: {
        clockIn: clockInDateTime.toISOString(),
        clockOut: clockOutDateTime?.toISOString() || null,
      }
    });
  }, [editData, updateSessionMutation]);

  const handleCancelEdit = useCallback(() => {
    setEditingSession(null);
    setEditData({ clockIn: '', clockOut: '', date: '' });
  }, []);

  const calculateHours = useCallback((clockIn: string, clockOut: string | null) => {
    if (!clockOut) return 0;
    return (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / (1000 * 60 * 60);
  }, []);

  // All useMemo hooks
  const { employeesList, sessionsList, availableMonths } = useMemo(() => {
    const allEmployees = employees as any[];
    const filteredEmployees = allEmployees.filter((emp: any) => emp.role !== 'admin');
    const filteredSessions = (sessions as any[]).filter((session: any) => {
      const sessionUser = allEmployees.find((emp: any) => emp.id === session.userId);
      return sessionUser?.role !== 'admin';
    });

    const months = filteredSessions.reduce((acc: string[], session: any) => {
      const monthKey = format(new Date(session.clockIn), 'yyyy-MM');
      if (!acc.includes(monthKey)) acc.push(monthKey);
      return acc;
    }, []).sort().reverse();

    return {
      employeesList: filteredEmployees,
      sessionsList: filteredSessions,
      availableMonths: months
    };
  }, [employees, sessions]);

  const filteredSessions = useMemo(() => {
    return sessionsList.filter((session: any) => {
      const sessionDate = new Date(session.clockIn);
      
      const matchesEmployee = selectedEmployee === 'all' || session.userId.toString() === selectedEmployee;
      const matchesSearch = session.userName?.toLowerCase().includes(searchTerm.toLowerCase());
      
      let matchesDate = true;
      if (dateFilter === 'day') {
        const dayStart = new Date(currentDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(currentDate);
        dayEnd.setHours(23, 59, 59, 999);
        matchesDate = sessionDate >= dayStart && sessionDate <= dayEnd;
      } else if (dateFilter === 'month') {
        const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
        monthEnd.setHours(23, 59, 59, 999);
        matchesDate = sessionDate >= monthStart && sessionDate <= monthEnd;
      } else if (dateFilter === 'custom' && (startDate || endDate)) {
        const filterStart = startDate ? new Date(startDate) : new Date(0);
        const filterEnd = endDate ? new Date(endDate) : new Date();
        if (endDate) filterEnd.setHours(23, 59, 59, 999);
        matchesDate = sessionDate >= filterStart && sessionDate <= filterEnd;
      }
      
      return matchesEmployee && matchesSearch && matchesDate;
    });
  }, [sessionsList, selectedEmployee, searchTerm, dateFilter, currentDate, currentMonth, startDate, endDate]);

  const { employeesWithSessions, totalEmployees, averageHoursPerEmployee } = useMemo(() => {
    const uniqueEmployees = new Set(filteredSessions.map((s: any) => s.userId)).size;
    const totalHours = filteredSessions.reduce((total: number, session: any) => {
      return total + calculateHours(session.clockIn, session.clockOut);
    }, 0);
    
    return {
      employeesWithSessions: uniqueEmployees,
      totalEmployees: employeesList.length,
      averageHoursPerEmployee: uniqueEmployees > 0 ? totalHours / uniqueEmployees : 0
    };
  }, [filteredSessions, employeesList.length, calculateHours]);

  const handleExportPDF = useCallback(() => {
    const doc = new jsPDF();
    
    // Company info (right aligned with proper margins)
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Test Company', 190, 20, { align: 'right' });
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('CIF: B12345678', 190, 26, { align: 'right' });
    doc.text('Calle Principal, 123, Madrid', 190, 31, { align: 'right' });
    doc.text('+34 912 345 678', 190, 36, { align: 'right' });
    
    // Report title (left aligned)
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 122, 255);
    doc.text('INFORME CONTROL HORARIO', 20, 25);
    
    // Employee info and period
    if (selectedEmployee !== 'all') {
      const employee = employeesList.find(emp => emp.id.toString() === selectedEmployee);
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(employee?.fullName || 'Empleado Desconocido', 20, 42);
      
      if (employee?.dni) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(102, 102, 102);
        doc.text(`DNI: ${employee.dni}`, 20, 48);
      }
      
      // Period info
      let periodText = '';
      if (dateFilter === 'day') {
        periodText = format(currentDate, 'dd/MM/yyyy', { locale: es });
      } else if (dateFilter === 'month') {
        periodText = format(currentMonth, 'MMMM yyyy', { locale: es });
      } else if (dateFilter === 'custom' && (startDate || endDate)) {
        if (startDate && endDate) {
          periodText = `${format(new Date(startDate), 'dd/MM/yyyy')} - ${format(new Date(endDate), 'dd/MM/yyyy')}`;
        } else if (startDate) {
          periodText = `Desde ${format(new Date(startDate), 'dd/MM/yyyy')}`;
        } else if (endDate) {
          periodText = `Hasta ${format(new Date(endDate), 'dd/MM/yyyy')}`;
        }
      } else {
        periodText = 'Todos los registros';
      }
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 122, 255);
      doc.text(`Período: ${periodText}`, 120, 42);
    }
    
    // Clean table without visible lines
    const sortedSessions = [...filteredSessions].sort((a, b) => new Date(a.clockIn).getTime() - new Date(b.clockIn).getTime());
    let currentY = 60;
    
    // Header row
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 122, 255);
    doc.text('Fecha', 20, currentY);
    doc.text('Entrada', 70, currentY);
    doc.text('Salida', 110, currentY);
    doc.text('Horas', 150, currentY);
    
    currentY += 5;
    
    const showSummaries = selectedEmployee !== 'all';
    
    if (showSummaries && sortedSessions.length > 0) {
      let currentWeekStart: Date | null = null;
      let currentMonth: string | null = null;
      let weekHours = 0;
      let monthHours = 0;
      
      sortedSessions.forEach((session: any, index: number) => {
        const sessionDate = new Date(session.clockIn);
        const weekStart = startOfWeek(sessionDate, { weekStartsOn: 1 });
        const monthKey = format(sessionDate, 'yyyy-MM');
        const hours = calculateHours(session.clockIn, session.clockOut);
        
        const isNewWeek = currentWeekStart === null || weekStart.getTime() !== currentWeekStart.getTime();
        const isNewMonth = currentMonth === null || monthKey !== currentMonth;
        
        // Add week summary
        if (isNewWeek && index > 0 && currentWeekStart) {
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(60, 60, 60);
          doc.text(`TOTAL SEMANA: ${weekHours.toFixed(1)}h`, 20, currentY);
          currentY += 6;
          weekHours = 0;
        }
        
        // Add month summary
        if (isNewMonth && index > 0 && currentMonth) {
          const [year, month] = currentMonth.split('-');
          const monthName = format(new Date(parseInt(year), parseInt(month) - 1), 'MMMM yyyy', { locale: es });
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(0, 122, 255);
          doc.text(`TOTAL ${monthName.toUpperCase()}: ${monthHours.toFixed(1)}h`, 20, currentY);
          currentY += 8;
          monthHours = 0;
        }
        
        if (isNewWeek) currentWeekStart = weekStart;
        if (isNewMonth) currentMonth = monthKey;
        
        // Regular row
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        
        doc.text(format(sessionDate, 'dd/MM/yyyy'), 20, currentY);
        doc.text(format(sessionDate, 'HH:mm'), 70, currentY);
        doc.text(session.clockOut ? format(new Date(session.clockOut), 'HH:mm') : '-', 110, currentY);
        doc.text(hours > 0 ? `${hours.toFixed(1)}h` : '-', 150, currentY);
        
        currentY += 5;
        weekHours += hours;
        monthHours += hours;
        
        // Final summaries
        if (index === sortedSessions.length - 1) {
          if (weekHours > 0) {
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(60, 60, 60);
            doc.text(`TOTAL SEMANA: ${weekHours.toFixed(1)}h`, 20, currentY);
            currentY += 6;
          }
          if (monthHours > 0 && currentMonth) {
            const [year, month] = currentMonth.split('-');
            const monthName = format(new Date(parseInt(year), parseInt(month) - 1), 'MMMM yyyy', { locale: es });
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 122, 255);
            doc.text(`TOTAL ${monthName.toUpperCase()}: ${monthHours.toFixed(1)}h`, 20, currentY);
          }
        }
      });
    } else {
      sortedSessions.forEach((session: any) => {
        const sessionDate = new Date(session.clockIn);
        const hours = calculateHours(session.clockIn, session.clockOut);
        
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        
        doc.text(format(sessionDate, 'dd/MM/yyyy'), 20, currentY);
        doc.text(format(sessionDate, 'HH:mm'), 70, currentY);
        doc.text(session.clockOut ? format(new Date(session.clockOut), 'HH:mm') : '-', 110, currentY);
        doc.text(hours > 0 ? `${hours.toFixed(1)}h` : '-', 150, currentY);
        
        currentY += 5;
      });
    }
    
    // Footer
    const reportDate = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es });
    const pageHeight = doc.internal.pageSize.height;
    
    doc.setDrawColor(0, 122, 255);
    doc.setLineWidth(0.3);
    doc.line(20, pageHeight - 20, 190, pageHeight - 20);
    
    doc.setFontSize(7);
    doc.setTextColor(102, 102, 102);
    doc.text('Este documento ha sido generado automáticamente por el sistema Oficaz', 20, pageHeight - 14);
    doc.text(`Fecha del informe: ${reportDate}`, 20, pageHeight - 9);
    
    // Save the PDF
    const fileName = selectedEmployee !== 'all' 
      ? `control_horario_${employeesList.find(emp => emp.id.toString() === selectedEmployee)?.fullName?.replace(/\s+/g, '_') || 'empleado'}_${format(new Date(), 'yyyyMMdd')}.pdf`
      : `control_horario_todos_empleados_${format(new Date(), 'yyyyMMdd')}.pdf`;
    
    doc.save(fileName);
    
    toast({
      title: 'PDF Generado',
      description: 'El informe de control horario se ha descargado correctamente.',
    });
  }, [filteredSessions, selectedEmployee, employeesList, dateFilter, currentDate, currentMonth, startDate, endDate, calculateHours, toast]);

  // Loading check AFTER all hooks
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
                <p className="text-sm text-gray-500">Media Horas Diarias</p>
                <p className="text-xl font-semibold text-gray-900">
                  {averageHoursPerEmployee.toFixed(1)}h
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Section */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
            <Filter className="w-5 h-5 mr-2" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-end">
            {/* Left side - Employee Filter */}
            <div className="flex flex-col space-y-2">
              <label className="text-sm font-medium text-gray-700">Empleado</label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Seleccionar empleado" />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        placeholder="Buscar empleado..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-8"
                      />
                    </div>
                  </div>
                  <SelectItem value="all">Todos los empleados</SelectItem>
                  {employeesList
                    .filter((employee: any) => 
                      employee.fullName.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map((employee: any) => (
                    <SelectItem key={employee.id} value={employee.id.toString()}>
                      {employee.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Right side - Date Filters */}
            <div className="flex flex-col space-y-2">
              <label className="text-sm font-medium text-gray-700">Período de tiempo</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Button
                  variant={dateFilter === 'today' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDateFilter('today')}
                  className="h-10"
                >
                  Hoy
                </Button>
                
                <Popover open={isDayDialogOpen} onOpenChange={setIsDayDialogOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant={dateFilter === 'day' ? 'default' : 'outline'}
                      size="sm"
                      className="h-10"
                    >
                      Día
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={currentDate}
                      onSelect={(date) => {
                        if (date) {
                          setCurrentDate(date);
                          setDateFilter('day');
                          setIsDayDialogOpen(false);
                        }
                      }}
                      className="rounded-md border"
                    />
                  </PopoverContent>
                </Popover>

                <Select 
                  value={dateFilter === 'month' ? format(currentMonth, 'yyyy-MM') : ''} 
                  onValueChange={(value) => {
                    if (value) {
                      const [year, month] = value.split('-');
                      setCurrentMonth(new Date(parseInt(year), parseInt(month) - 1, 1));
                      setDateFilter('month');
                    }
                  }}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Mes" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMonths.map((monthKey: string) => {
                      const [year, month] = monthKey.split('-');
                      const monthDate = new Date(parseInt(year), parseInt(month) - 1);
                      return (
                        <SelectItem key={monthKey} value={monthKey}>
                          {format(monthDate, 'MMMM yyyy', { locale: es })}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                <Popover open={isRangeDialogOpen} onOpenChange={setIsRangeDialogOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant={dateFilter === 'custom' ? 'default' : 'outline'}
                      size="sm"
                      className="h-10"
                    >
                      Rango
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-4" align="end">
                    <div className="space-y-4">
                      <div className="text-sm font-medium text-center">
                        Seleccionar rango de fechas
                      </div>
                      <div className="text-xs text-gray-500 text-center">
                        Haz clic en una fecha de inicio y luego en una fecha de fin
                      </div>
                      <Calendar
                        mode="range"
                        selected={{
                          from: selectedStartDate || undefined,
                          to: selectedEndDate || undefined
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
                          if (!range) {
                            setSelectedStartDate(null);
                            setSelectedEndDate(null);
                            setStartDate('');
                            setEndDate('');
                          }
                        }}
                        className="rounded-md border"
                        numberOfMonths={1}
                        showOutsideDays={false}
                      />
                      {(selectedStartDate || selectedEndDate) && (
                        <div className="text-xs text-center text-gray-600">
                          {selectedStartDate && (
                            <div>Desde: {format(selectedStartDate, 'dd/MM/yyyy', { locale: es })}</div>
                          )}
                          {selectedEndDate && (
                            <div>Hasta: {format(selectedEndDate, 'dd/MM/yyyy', { locale: es })}</div>
                          )}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button
                          onClick={() => {
                            setDateFilter('custom');
                            setIsRangeDialogOpen(false);
                          }}
                          className="flex-1"
                          disabled={!selectedStartDate}
                        >
                          Aplicar
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setStartDate('');
                            setEndDate('');
                            setSelectedStartDate(null);
                            setSelectedEndDate(null);
                          }}
                          className="flex-1"
                        >
                          Limpiar
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
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
            <Button variant="outline" size="sm" onClick={handleExportPDF}>
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
                  <th className="text-center py-3 px-4 font-medium text-gray-900">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const sortedSessions = filteredSessions
                    .sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime());
                  
                  const showSummaries = selectedEmployee !== 'all';
                  let currentWeekStart: Date | null = null;
                  let previousWeekStart: Date | null = null;
                  let currentMonth: string | null = null;
                  let previousMonth: string | null = null;
                  
                  const calculateWeekTotal = (weekStart: Date) => 
                    sortedSessions
                      .filter(session => {
                        const sessionWeekStart = startOfWeek(new Date(session.clockIn), { weekStartsOn: 1 });
                        return sessionWeekStart.getTime() === weekStart.getTime();
                      })
                      .reduce((total, session) => total + calculateHours(session.clockIn, session.clockOut), 0);
                  
                  const calculateMonthTotal = (monthKey: string) => 
                    sortedSessions
                      .filter(session => format(new Date(session.clockIn), 'yyyy-MM') === monthKey)
                      .reduce((total, session) => total + calculateHours(session.clockIn, session.clockOut), 0);
                  
                  const result: JSX.Element[] = [];
                  
                  sortedSessions.forEach((session: any, index: number) => {
                    const sessionDate = new Date(session.clockIn);
                    const weekStart = startOfWeek(sessionDate, { weekStartsOn: 1 });
                    const monthKey = format(sessionDate, 'yyyy-MM');
                    const isNewWeek = currentWeekStart === null || weekStart.getTime() !== currentWeekStart.getTime();
                    const isNewMonth = currentMonth === null || monthKey !== currentMonth;
                    
                    if (isNewWeek) {
                      previousWeekStart = currentWeekStart;
                      currentWeekStart = weekStart;
                    }
                    
                    if (isNewMonth) {
                      previousMonth = currentMonth;
                      currentMonth = monthKey;
                    }
                    
                    // Add summaries only when filtering by specific employee
                    if (showSummaries && isNewMonth && index > 0 && previousMonth) {
                      const monthTotal = calculateMonthTotal(previousMonth);
                      const [year, month] = previousMonth.split('-');
                      const monthName = format(new Date(parseInt(year), parseInt(month) - 1), 'MMMM yyyy', { locale: es });
                      
                      result.push(
                        <tr key={`month-${previousMonth}`} className="bg-blue-50 border-y-2 border-blue-200">
                          <td colSpan={6} className="py-3 px-4 text-center">
                            <div className="font-semibold text-blue-800 capitalize">
                              Total {monthName}: {monthTotal.toFixed(1)}h
                            </div>
                          </td>
                        </tr>
                      );
                    }
                    
                    if (showSummaries && isNewWeek && index > 0 && previousWeekStart) {
                      const weekTotal = calculateWeekTotal(previousWeekStart);
                      result.push(
                        <tr key={`week-${previousWeekStart.getTime()}`} className="bg-gray-100 border-y border-gray-300">
                          <td colSpan={6} className="py-2 px-4 text-center">
                            <div className="font-medium text-gray-700">
                              Total semana: {weekTotal.toFixed(1)}h
                            </div>
                          </td>
                        </tr>
                      );
                    }
                    
                    const hours = calculateHours(session.clockIn, session.clockOut);
                    const isEditing = editingSession === session.id;
                    
                    result.push(
                      <tr key={session.id} className="hover:bg-gray-50 border-b border-gray-100">
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
                              className="w-36 h-8"
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
                        <td className="py-3 px-4 text-center">
                          {isEditing ? (
                            <div className="flex gap-2 justify-center">
                              <Button
                                size="sm"
                                onClick={() => handleSaveSession(session.id)}
                                className="h-8 w-8 p-0"
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCancelEdit}
                                className="h-8 w-8 p-0"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditSession(session)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  });
                  
                  // Add final summaries for the last entries
                  if (showSummaries && sortedSessions.length > 0) {
                    if (previousWeekStart) {
                      const weekTotal = calculateWeekTotal(previousWeekStart);
                      result.push(
                        <tr key={`week-final`} className="bg-gray-100 border-y border-gray-300">
                          <td colSpan={6} className="py-2 px-4 text-center">
                            <div className="font-medium text-gray-700">
                              Total semana: {weekTotal.toFixed(1)}h
                            </div>
                          </td>
                        </tr>
                      );
                    }
                    
                    if (currentMonth) {
                      const monthTotal = calculateMonthTotal(currentMonth);
                      // Use currentMonth directly as it's already a string from the monthKey
                      const monthName = format(new Date(currentMonth + '-01'), 'MMMM yyyy', { locale: es });
                      
                      result.push(
                        <tr key={`month-final`} className="bg-blue-50 border-y-2 border-blue-200">
                          <td colSpan={6} className="py-3 px-4 text-center">
                            <div className="font-semibold text-blue-800 capitalize">
                              Total {monthName}: {monthTotal.toFixed(1)}h
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  }
                  
                  return result;
                })()}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}