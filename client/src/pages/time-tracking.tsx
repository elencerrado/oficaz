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
import autoTable from 'jspdf-autotable';

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

  // Optimized event handlers with useCallback
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

  // Memoized calculations for better performance - moved before return
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

  // Calculate hours helper function
  const calculateHours = useCallback((clockIn: string, clockOut: string | null) => {
    if (!clockOut) return 0;
    return (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / (1000 * 60 * 60);
  }, []);

  // Memoized filtered sessions
  const filteredSessions = useMemo(() => {
    return sessionsList.filter((session: any) => {
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

  // Memoized statistics
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

  // PDF Export function
  const handleExportPDF = useCallback(() => {
    const doc = new jsPDF();
    
    // Modern header design
    // Company info (right aligned)
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Test Company', 210, 20, { align: 'right' });
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('CIF: B12345678', 210, 26, { align: 'right' });
    doc.text('Calle Principal, 123, Madrid', 210, 31, { align: 'right' });
    doc.text('+34 912 345 678', 210, 36, { align: 'right' });
    
    // Report title (left aligned)
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 122, 255);
    doc.text('INFORME CONTROL HORARIO', 20, 25);
    
    // Employee info and period (left side, below title)
    if (selectedEmployee !== 'all') {
      const employee = employeesList.find(emp => emp.id.toString() === selectedEmployee);
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(employee?.fullName || 'Empleado Desconocido', 20, 45);
      
      if (employee?.dni) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(102, 102, 102);
        doc.text(`DNI: ${employee.dni}`, 20, 52);
      }
      
      // Period info (right side of employee info)
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
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 122, 255);
      doc.text(`Período: ${periodText}`, 130, 45);
    }
    
    // Prepare table data (simplified columns - no Employee or Status)
    const sortedSessions = [...filteredSessions].sort((a, b) => new Date(a.clockIn).getTime() - new Date(b.clockIn).getTime());
    const tableData: any[] = [];
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
        
        if (isNewWeek && index > 0 && currentWeekStart) {
          tableData.push(['', '', '', `TOTAL SEMANA: ${weekHours.toFixed(1)}h`]);
          weekHours = 0;
        }
        
        if (isNewMonth && index > 0 && currentMonth) {
          const [year, month] = currentMonth.split('-');
          const monthName = format(new Date(parseInt(year), parseInt(month) - 1), 'MMMM yyyy', { locale: es });
          tableData.push(['', '', '', `TOTAL ${monthName.toUpperCase()}: ${monthHours.toFixed(1)}h`]);
          monthHours = 0;
        }
        
        if (isNewWeek) currentWeekStart = weekStart;
        if (isNewMonth) currentMonth = monthKey;
        
        tableData.push([
          format(sessionDate, 'dd/MM/yyyy'),
          format(sessionDate, 'HH:mm'),
          session.clockOut ? format(new Date(session.clockOut), 'HH:mm') : '-',
          hours > 0 ? `${hours.toFixed(1)}h` : '-'
        ]);
        
        weekHours += hours;
        monthHours += hours;
        
        if (index === sortedSessions.length - 1) {
          if (weekHours > 0) {
            tableData.push(['', '', '', `TOTAL SEMANA: ${weekHours.toFixed(1)}h`]);
          }
          if (monthHours > 0 && currentMonth) {
            const [year, month] = currentMonth.split('-');
            const monthName = format(new Date(parseInt(year), parseInt(month) - 1), 'MMMM yyyy', { locale: es });
            tableData.push(['', '', '', `TOTAL ${monthName.toUpperCase()}: ${monthHours.toFixed(1)}h`]);
          }
        }
      });
    } else {
      sortedSessions.forEach((session: any) => {
        const sessionDate = new Date(session.clockIn);
        const hours = calculateHours(session.clockIn, session.clockOut);
        
        tableData.push([
          format(sessionDate, 'dd/MM/yyyy'),
          format(sessionDate, 'HH:mm'),
          session.clockOut ? format(new Date(session.clockOut), 'HH:mm') : '-',
          hours > 0 ? `${hours.toFixed(1)}h` : '-'
        ]);
      });
    }
    
    // Modern table design with proper spacing
    autoTable(doc, {
      head: [['Fecha', 'Entrada', 'Salida', 'Horas']],
      body: tableData,
      startY: 65,
      styles: { 
        fontSize: 10, 
        cellPadding: 4,
        lineColor: [230, 230, 230],
        lineWidth: 0.5
      },
      headStyles: { 
        fillColor: [0, 122, 255], 
        textColor: 255, 
        fontStyle: 'bold',
        fontSize: 11
      },
      alternateRowStyles: { 
        fillColor: [248, 249, 250]
      },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 25, halign: 'center' },
        2: { cellWidth: 25, halign: 'center' },
        3: { cellWidth: 25, halign: 'center' }
      },
      didParseCell: function(data) {
        if (data.cell.text[0] && (data.cell.text[0].includes('TOTAL SEMANA:') || data.cell.text[0].includes('TOTAL '))) {
          data.cell.styles.fillColor = data.cell.text[0].includes('TOTAL SEMANA:') 
            ? [220, 220, 220] 
            : [0, 122, 255];
          data.cell.styles.textColor = data.cell.text[0].includes('TOTAL SEMANA:') 
            ? [0, 0, 0] 
            : [255, 255, 255];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.halign = 'center';
          data.cell.colSpan = 4;
        }
      },
      margin: { left: 20, right: 20 },
      tableLineColor: [200, 200, 200],
      tableLineWidth: 0.1
    });
    
    // Modern footer with proper spacing
    const reportDate = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es });
    const pageHeight = doc.internal.pageSize.height;
    
    // Footer line
    doc.setDrawColor(0, 122, 255);
    doc.setLineWidth(0.5);
    doc.line(20, pageHeight - 25, 190, pageHeight - 25);
    
    doc.setFontSize(8);
    doc.setTextColor(102, 102, 102);
    doc.text('Este documento ha sido generado automáticamente por el sistema Oficaz', 20, pageHeight - 18);
    doc.text(`Fecha del informe: ${reportDate}`, 20, pageHeight - 12);
    
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
              <Popover open={isDayDialogOpen} onOpenChange={setIsDayDialogOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-[200px] justify-center font-medium"
                  >
                    {format(currentDate, 'EEEE, d MMMM yyyy', { locale: es })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center">
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
                    className="rounded-md border-0"
                  />
                </PopoverContent>
              </Popover>
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
              <Popover open={isRangeDialogOpen} onOpenChange={setIsRangeDialogOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-[200px] justify-center font-medium"
                  >
                    {selectedStartDate && selectedEndDate
                      ? `${format(selectedStartDate, 'd MMM', { locale: es })} - ${format(selectedEndDate, 'd MMM yyyy', { locale: es })}`
                      : 'Seleccionar rango de fechas'
                    }
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-4" align="center">
                  <div className="flex flex-col items-center space-y-4">
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
                      className="rounded-md border-0"
                      disabled={(date) => date > new Date()}
                      locale={es}
                    />
                    <div className="flex gap-3 justify-center w-full">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedStartDate(null);
                          setSelectedEndDate(null);
                          setStartDate('');
                          setEndDate('');
                        }}
                        className="px-6"
                      >
                        Limpiar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setIsRangeDialogOpen(false)}
                        className="bg-oficaz-primary hover:bg-oficaz-primary/90 px-6"
                      >
                        Aplicar
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Employee Filter with integrated search */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-center border-t pt-3">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Filtrar empleado" />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2 border-b">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        placeholder="Buscar empleado..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 w-full"
                      />
                    </div>
                  </div>
                  <SelectItem value="all">Filtrar empleado</SelectItem>
                  {employeesList
                    .filter((employee: any) => 
                      employee.fullName?.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map((employee: any) => (
                      <SelectItem key={employee.id} value={employee.id.toString()}>
                        {employee.fullName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
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
                {useMemo(() => {
                  if (filteredSessions.length === 0) return null;
                  
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
                  });
                  
                  // Add final summaries for the last week and month when filtering by specific employee
                  if (showSummaries && sortedSessions.length > 0) {
                    if (currentWeekStart) {
                      const weekTotal = calculateWeekTotal(currentWeekStart);
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
                    
                    if (currentMonth && typeof currentMonth === 'string') {
                      const monthTotal = calculateMonthTotal(currentMonth);
                      const [year, month] = currentMonth.split('-');
                      const monthName = format(new Date(parseInt(year), parseInt(month) - 1), 'MMMM yyyy', { locale: es });
                      
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
                }, [filteredSessions, selectedEmployee, editingSession, editData, handleEditSession, handleSaveSession, handleCancelEdit, updateSessionMutation.isPending, calculateHours])}
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