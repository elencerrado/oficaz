import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useFeatureCheck } from '@/hooks/use-feature-check';
import { FeatureRestrictedPage } from '@/components/feature-restricted-page';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import StatsCard from '@/components/StatsCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DatePickerPeriod, DatePickerDay } from '@/components/ui/date-picker';
import { 
  Search, 
  Edit, 
  Users,
  Filter,
  TrendingUp,
  Download,
  ChevronLeft,
  CalendarDays,
  BarChart3,
  ChevronRight,
  Check,
  X,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, startOfWeek, addDays, subDays, differenceInMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';

export default function TimeTracking() {
  const { user, company } = useAuth();
  const { hasAccess, getRequiredPlan } = useFeatureCheck();
  
  // Check if user has access to time tracking feature
  if (!hasAccess('timeTracking')) {
    return (
      <FeatureRestrictedPage
        featureName="Fichajes"
        description="Gestión de fichajes y control horario de empleados"
        requiredPlan={getRequiredPlan('timeTracking')}
        icon={Clock}
      />
    );
  }
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // All useState hooks first
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
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
  const [isMonthDialogOpen, setIsMonthDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<number | null>(null);
  const [editData, setEditData] = useState({
    clockIn: '',
    clockOut: '',
    date: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showBreakTooltip, setShowBreakTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [tooltipContent, setTooltipContent] = useState('');

  // All useQuery hooks - Real-time updates for admin time tracking
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['/api/work-sessions/company'],
    enabled: !!user && (user.role === 'admin' || user.role === 'manager'),
    staleTime: 30 * 1000, // 30 seconds for real-time updates
    gcTime: 2 * 60 * 1000, // 2 minutes
    retry: 1,
    retryDelay: 500,
    refetchInterval: 20000, // Reduced from 5s to 20s for better performance
    refetchIntervalInBackground: false, // Disabled background polling
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['/api/employees'],
    enabled: !!user && (user.role === 'admin' || user.role === 'manager'),
    staleTime: 5 * 60 * 1000, // 5 minutes for employees list
    gcTime: 10 * 60 * 1000, // 10 minutes
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

  // ⚠️ PROTECTED: Session editing and time calculation functions - DO NOT MODIFY
  // These functions are CRITICAL for time tracking accuracy and must remain stable
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

  // ⚠️ PROTECTED: Time calculation function - CRITICAL FOR ACCURACY
  const calculateHours = useCallback((clockIn: string, clockOut: string | null) => {
    if (!clockOut) return 0;
    return (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / (1000 * 60 * 60);
  }, []);
  // ⚠️ END PROTECTED SECTION

  // ⚠️ PROTECTED: Data processing and filtering functions - DO NOT MODIFY
  // These functions are CRITICAL for data accuracy and filtering logic
  const { employeesList, sessionsList, availableMonths } = useMemo(() => {
    const allEmployees = employees as any[];
    // Include admin for employee list so admin can see their own time tracking
    const filteredEmployees = (allEmployees || []);
    // Include all sessions including admin sessions
    const filteredSessions = (sessions || []);

    const months = (filteredSessions || []).reduce((acc: string[], session: any) => {
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
    return (sessionsList || []).filter((session: any) => {
      const sessionDate = new Date(session.clockIn);
      
      const matchesEmployee = selectedEmployee === 'all' || session.userId.toString() === selectedEmployee;
      const matchesSearch = session.userName?.toLowerCase().includes(searchTerm.toLowerCase());
      
      let matchesDate = true;
      if (dateFilter === 'today') {
        const today = new Date();
        const dayStart = new Date(today);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(today);
        dayEnd.setHours(23, 59, 59, 999);
        matchesDate = sessionDate >= dayStart && sessionDate <= dayEnd;
      } else if (dateFilter === 'day') {
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
      } else if (dateFilter === 'all') {
        matchesDate = true; // No aplicar filtro de fecha
      }
      
      return matchesEmployee && matchesSearch && matchesDate;
    });
  }, [sessionsList, selectedEmployee, searchTerm, dateFilter, currentDate, currentMonth, startDate, endDate]);

  // Generate dynamic title based on filter
  const getFilterTitle = () => {
    switch (dateFilter) {
      case 'today':
        return 'Fichajes de hoy';
      case 'day':
        return `Fichajes del ${format(currentDate, 'd MMMM yyyy', { locale: es })}`;
      case 'month':
        return `Fichajes de ${format(currentMonth, 'MMMM yyyy', { locale: es })}`;
      case 'custom':
        if (startDate && endDate) {
          return `Fichajes del ${format(new Date(startDate), 'd MMM', { locale: es })} al ${format(new Date(endDate), 'd MMM yyyy', { locale: es })}`;
        }
        return 'Fichajes personalizados';
      case 'all':
      default:
        return 'Todos los fichajes';
    }
  };

  // ⚠️ PROTECTED: Statistics calculation functions - CRITICAL FOR REPORTING
  const { employeesWithSessions, totalEmployees, averageHoursPerEmployee, averageHoursPerWeek, averageHoursPerMonth } = useMemo(() => {
    const uniqueEmployees = new Set(filteredSessions.map((s: any) => s.userId)).size;
    const totalHours = filteredSessions.reduce((total: number, session: any) => {
      const sessionHours = calculateHours(session.clockIn, session.clockOut);
      const breakHours = session.breakPeriods 
        ? session.breakPeriods.reduce((breakTotal: number, breakPeriod: any) => {
            return breakTotal + calculateHours(breakPeriod.breakStart, breakPeriod.breakEnd);
          }, 0) 
        : 0;
      return total + (sessionHours - breakHours);
    }, 0);
    
    // Calculate average hours per worker per day
    let averageHoursPerDay = 0;
    let averageHoursWeekly = 0;
    let averageHoursMonthly = 0;
    
    if (filteredSessions.length > 0) {
      // Group sessions by employee and day to count unique working days
      const employeeDays = new Set();
      const employeeWeeks = new Set();
      const employeeMonths = new Set();
      
      filteredSessions.forEach((session: any) => {
        const sessionDate = new Date(session.clockIn);
        const dayKey = `${session.userId}-${format(sessionDate, 'yyyy-MM-dd')}`;
        const weekKey = `${session.userId}-${format(sessionDate, 'yyyy-ww')}`;
        const monthKey = `${session.userId}-${format(sessionDate, 'yyyy-MM')}`;
        
        employeeDays.add(dayKey);
        employeeWeeks.add(weekKey);
        employeeMonths.add(monthKey);
      });
      
      // Calculate averages
      averageHoursPerDay = totalHours / employeeDays.size;
      averageHoursWeekly = totalHours / employeeWeeks.size;
      averageHoursMonthly = totalHours / employeeMonths.size;
    }
    
    return {
      employeesWithSessions: uniqueEmployees,
      totalEmployees: employeesList.length,
      averageHoursPerEmployee: averageHoursPerDay,
      averageHoursPerWeek: averageHoursWeekly,
      averageHoursPerMonth: averageHoursMonthly
    };
  }, [filteredSessions, employeesList.length, calculateHours]);
  // ⚠️ END PROTECTED SECTION

  // ⚠️ PROTECTED: PDF generation function - CRITICAL FOR REPORTING
  const handleExportPDF = useCallback(() => {
    const doc = new jsPDF();
    
    // Get period text for reuse
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

    // Function to create a page for an employee
    const createEmployeePage = (employee: any, employeeSessions: any[], isFirstPage: boolean) => {
      if (!isFirstPage) {
        doc.addPage();
      }
      
      // Helper function to add header to new page
      const addPageHeader = () => {
        // Company info (right aligned with elegant styling) - Using real company data
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(31, 51, 71); // Elegant dark blue
        doc.text(company?.name || 'Empresa', 190, 20, { align: 'right' });
        
        // Subtle divider line
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(140, 24, 190, 24);
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(85, 85, 85); // Professional gray
        let yPos = 28;
        
        if (company?.cif) {
          doc.text(`CIF: ${company.cif}`, 190, yPos, { align: 'right' });
          yPos += 4;
        }
        if (company?.address) {
          doc.text(company.address, 190, yPos, { align: 'right' });
          yPos += 4;
        }
        if (company?.province) {
          doc.text(company.province, 190, yPos, { align: 'right' });
          yPos += 4;
        }
        if (company?.phone) {
          doc.text(`Tel: ${company.phone}`, 190, yPos, { align: 'right' });
        }
        
        // Clean report title
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(31, 51, 71); // Professional dark blue
        doc.text('INFORME DE CONTROL HORARIO', 20, 25);
        
        // Employee info with modern styling
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(31, 51, 71);
        doc.text('EMPLEADO', 20, 40);
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(85, 85, 85);
        doc.text(employee?.fullName || 'Empleado Desconocido', 20, 46);
        
        if (employee?.dni) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(128, 128, 128);
          doc.text(`DNI: ${employee.dni}`, 20, 51);
        }
        
        // Period info with elegant layout
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(31, 51, 71);
        doc.text('PERÍODO', 120, 40);
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(85, 85, 85);
        doc.text(periodText, 120, 46);
        
        // Clean table header without background
        const headerY = 62;
        
        // Header text with professional styling
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(31, 51, 71);
        doc.text('FECHA', colPositions[0], headerY);
        doc.text('ENTRADA', colPositions[1], headerY);
        doc.text('SALIDA', colPositions[2], headerY);
        doc.text('HORAS', colPositions[3], headerY);
        
        return headerY + 5; // Return starting Y position for content
      };
      
      // Helper function to add clean footer
      const addFooter = () => {
        const reportDate = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es });
        const pageHeight = doc.internal.pageSize.height;
        
        // Footer top line
        doc.setDrawColor(31, 51, 71);
        doc.setLineWidth(0.8);
        doc.line(20, pageHeight - 25, 190, pageHeight - 25);
        
        // Company and generation info with elegant layout
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(85, 85, 85);
        doc.text(`${company?.name || 'Oficaz'} - Sistema de Control Horario`, 20, pageHeight - 18);
        
        doc.setTextColor(128, 128, 128);
        doc.text(`Generado: ${reportDate}`, 190, pageHeight - 18, { align: 'right' });
        
        // Oficaz branding
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 122, 255);
        doc.text('Powered by Oficaz', 105, pageHeight - 10, { align: 'center' });
        
        // Page number with elegant styling
        const pageCount = doc.getNumberOfPages();
        if (pageCount > 1) {
          doc.setFontSize(8);
          doc.setTextColor(85, 85, 85);
          doc.text(`Página ${doc.getCurrentPageInfo().pageNumber} de ${pageCount}`, 190, pageHeight - 10, { align: 'right' });
        }
      };
      
      // Table setup for individual employee (no employee column needed)
      const tableStartX = 60;
      const colWidths = [35, 25, 25, 25];
      const colPositions = [
        tableStartX, 
        tableStartX + colWidths[0], 
        tableStartX + colWidths[0] + colWidths[1], 
        tableStartX + colWidths[0] + colWidths[1] + colWidths[2]
      ];
      
      // Add header to first page
      let currentY = addPageHeader();
      
      // Sort sessions by date
      const sortedSessions = [...employeeSessions].sort((a, b) => new Date(a.clockIn).getTime() - new Date(b.clockIn).getTime());
      
      // Track totals for summaries
      let weekHours = 0;
      let monthHours = 0;
      let currentWeekStart: Date | null = null;
      let currentMonth: string | null = null;
      const pageHeight = doc.internal.pageSize.height;
      const maxContentY = pageHeight - 35; // Reserve space for footer
      
      const showSummaries = true; // Always show summaries for individual employees
      
      if (showSummaries && sortedSessions.length > 0) {
        sortedSessions.forEach((session: any, index: number) => {
          const sessionDate = new Date(session.clockIn);
          const hours = calculateHours(session.clockIn, session.clockOut);
          
          // Calculate week start (Monday)
          const weekStart = startOfWeek(sessionDate, { weekStartsOn: 1 });
          const monthKey = format(sessionDate, 'yyyy-MM');
          
          const isNewWeek = currentWeekStart === null || weekStart.getTime() !== currentWeekStart.getTime();
          const isNewMonth = currentMonth === null || monthKey !== currentMonth;
          
          // NEW PAGE FOR EACH MONTH - Add month summary and create new page
          if (isNewMonth && index > 0 && currentMonth) {
            // Add previous month summary
            const [year, month] = currentMonth.split('-');
            const monthName = format(new Date(parseInt(year), parseInt(month) - 1), 'MMMM yyyy', { locale: es });
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 122, 255);
            doc.text(`TOTAL ${monthName.toUpperCase()}:`, colPositions[0], currentY);
            doc.text(`${monthHours.toFixed(1)}h`, colPositions[3], currentY);
            
            // Add footer and create new page for new month
            addFooter();
            doc.addPage();
            currentY = addPageHeader();
            
            monthHours = 0;
          }
          
          // Add week summary (only if not starting a new month)
          if (isNewWeek && index > 0 && currentWeekStart && !isNewMonth) {
            // Check if we need a new page for week summary
            if (currentY > maxContentY - 15) {
              addFooter();
              doc.addPage();
              currentY = addPageHeader();
            }
            
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(80, 80, 80);
            doc.text('TOTAL SEMANA:', colPositions[0], currentY);
            doc.text(`${weekHours.toFixed(1)}h`, colPositions[3], currentY);
            currentY += 7;
            weekHours = 0;
          }
          
          if (isNewWeek) currentWeekStart = weekStart;
          if (isNewMonth) currentMonth = monthKey;
          
          // Check if we need a new page before adding regular row (only within same month)
          if (currentY > maxContentY) {
            addFooter();
            doc.addPage();
            currentY = addPageHeader();
          }
          
          // Regular row
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(40, 40, 40);
          
          doc.text(format(sessionDate, 'dd/MM/yyyy'), colPositions[0], currentY);
          doc.text(format(sessionDate, 'HH:mm'), colPositions[1], currentY);
          doc.text(session.clockOut ? format(new Date(session.clockOut), 'HH:mm') : '-', colPositions[2], currentY);
          doc.text(hours > 0 ? `${hours.toFixed(1)}h` : '-', colPositions[3], currentY);
          
          currentY += 6;
          weekHours += hours;
          monthHours += hours;
          
          // Final summaries for the last session
          if (index === sortedSessions.length - 1) {
            // Check if we need a new page for final summaries
            if (currentY > maxContentY - 15) {
              addFooter();
              doc.addPage();
              currentY = addPageHeader();
            }
            
            // Add final week summary if exists
            if (weekHours > 0) {
              doc.setFontSize(8);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(80, 80, 80);
              doc.text('TOTAL SEMANA:', colPositions[0], currentY);
              doc.text(`${weekHours.toFixed(1)}h`, colPositions[3], currentY);
              currentY += 7;
            }
            
            // Add final month summary
            if (monthHours > 0 && currentMonth) {
              const [year, month] = currentMonth.split('-');
              const monthName = format(new Date(parseInt(year), parseInt(month) - 1), 'MMMM yyyy', { locale: es });
              doc.setFontSize(8);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(0, 122, 255);
              doc.text(`TOTAL ${monthName.toUpperCase()}:`, colPositions[0], currentY);
              doc.text(`${monthHours.toFixed(1)}h`, colPositions[3], currentY);
            }
          }
        });
      } else {
        sortedSessions.forEach((session: any) => {
          // Check if we need a new page
          if (currentY > maxContentY) {
            addFooter();
            doc.addPage();
            currentY = addPageHeader();
          }
          
          const sessionDate = new Date(session.clockIn);
          const hours = calculateHours(session.clockIn, session.clockOut);
          
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(40, 40, 40);
          
          doc.text(format(sessionDate, 'dd/MM/yyyy'), colPositions[0], currentY);
          doc.text(format(sessionDate, 'HH:mm'), colPositions[1], currentY);
          doc.text(session.clockOut ? format(new Date(session.clockOut), 'HH:mm') : '-', colPositions[2], currentY);
          doc.text(hours > 0 ? `${hours.toFixed(1)}h` : '-', colPositions[3], currentY);
          
          currentY += 6;
        });
      }
      
      // Add footer to the last page of this employee
      addFooter();
    };

    if (selectedEmployee !== 'all') {
      // Single employee PDF
      const employee = employeesList.find(emp => emp.id.toString() === selectedEmployee);
      createEmployeePage(employee, filteredSessions, true);
    } else {
      // Multiple employees - one page per employee
      const employeesWithSessions = (employeesList || []).filter(employee => 
        (filteredSessions || []).some(session => session.userId === employee.id)
      );
      
      employeesWithSessions.forEach((employee, index) => {
        const employeeSessions = (filteredSessions || []).filter(session => session.userId === employee.id);
        createEmployeePage(employee, employeeSessions, index === 0);
      });
    }

    // Generate friendly filename format: Employee - Time filter - Export date/time
    const generateFriendlyFileName = () => {
      // Employee part
      let employeePart = 'Todos los empleados';
      if (selectedEmployee !== 'all') {
        const employee = employeesList?.find(emp => emp.id.toString() === selectedEmployee);
        employeePart = employee?.fullName || 'Empleado';
      }
      
      // Time filter part
      let timePart = 'todos los fichajes';
      if (dateFilter === 'today') {
        timePart = 'hoy';
      } else if (dateFilter === 'month') {
        timePart = format(currentMonth, 'MMMM yyyy', { locale: es });
      } else if (dateFilter === 'custom' && (startDate || endDate)) {
        if (startDate && endDate) {
          timePart = `${format(new Date(startDate), 'dd-MM-yyyy')} - ${format(new Date(endDate), 'dd-MM-yyyy')}`;
        } else if (startDate) {
          timePart = `desde ${format(new Date(startDate), 'dd-MM-yyyy')}`;
        } else if (endDate) {
          timePart = `hasta ${format(new Date(endDate), 'dd-MM-yyyy')}`;
        }
      }
      
      // Export date/time part (format: DD-MM-YY - HH-MM)
      const exportDateTime = format(new Date(), 'dd-MM-yy - HH-mm');
      
      // Clean filename (replace invalid characters)
      const cleanName = `${employeePart} - ${timePart} - ${exportDateTime}`
        .replace(/[/\\?%*:|"<>]/g, '-')  // Replace invalid filename characters
        .replace(/\s+/g, ' ')            // Normalize spaces
        .trim();
      
      return `${cleanName}.pdf`;
    };

    const fileName = generateFriendlyFileName();
    
    doc.save(fileName);
    
    toast({
      title: "PDF exportado correctamente",
      description: `El archivo ${fileName} se ha descargado`,
    });
  }, [filteredSessions, selectedEmployee, employeesList, dateFilter, currentDate, currentMonth, startDate, endDate, calculateHours, toast]);

  // Timeline Bar Component for displaying work sessions with break periods
  const TimelineBar = ({ session }: { session: any }) => {
    if (!session.clockIn || !session.clockOut) {
      return (
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <Clock className="w-4 h-4" />
          <span>Sesión en curso</span>
        </div>
      );
    }

    const clockIn = new Date(session.clockIn);
    const clockOut = new Date(session.clockOut);
    const totalSessionMinutes = differenceInMinutes(clockOut, clockIn);
    const breakPeriods = session.breakPeriods || [];

    // Calculate total break duration
    const totalBreakMinutes = breakPeriods.reduce((total: number, breakPeriod: any) => {
      if (breakPeriod.breakEnd) {
        return total + differenceInMinutes(new Date(breakPeriod.breakEnd), new Date(breakPeriod.breakStart));
      }
      return total;
    }, 0);

    const formatTime = (date: Date) => format(date, 'HH:mm');
    const formatDuration = (minutes: number) => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    };

    return (
      <div className="space-y-2">
        {/* Timeline visualization */}
        <div className="relative h-8 bg-gray-100 rounded-lg overflow-hidden">
          {/* Main work session bar */}
          <div className="absolute inset-0 bg-blue-500 rounded-lg"></div>
          
          {/* Break periods as orange bars */}
          {breakPeriods.map((breakPeriod: any, index: number) => {
            if (!breakPeriod.breakEnd) return null;
            
            const breakStart = new Date(breakPeriod.breakStart);
            const breakEnd = new Date(breakPeriod.breakEnd);
            const breakStartMinutes = differenceInMinutes(breakStart, clockIn);
            const breakDurationMinutes = differenceInMinutes(breakEnd, breakStart);
            
            const leftPercentage = (breakStartMinutes / totalSessionMinutes) * 100;
            const widthPercentage = (breakDurationMinutes / totalSessionMinutes) * 100;
            
            return (
              <div
                key={index}
                className="absolute top-0 bottom-0 bg-orange-400 rounded cursor-help"
                style={{
                  left: `${leftPercentage}%`,
                  width: `${widthPercentage}%`,
                }}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTooltipPosition({ 
                    x: rect.left + rect.width / 2, 
                    y: rect.top - 10 
                  });
                  setShowBreakTooltip(true);
                  setTooltipContent(`Descanso: ${formatTime(breakStart)} - ${formatTime(breakEnd)} (${breakDurationMinutes} min)`);
                }}
                onMouseLeave={() => {
                  setShowBreakTooltip(false);
                  setTooltipContent('');
                }}
              />
            );
          })}
        </div>

        {/* Time labels */}
        <div className="flex justify-between items-center text-xs text-gray-600">
          <div className="flex items-center space-x-1">
            <span className="font-medium">Entrada:</span>
            <span>{formatTime(clockIn)}</span>
          </div>
          
          {totalBreakMinutes > 0 && (
            <div className="flex items-center space-x-1 text-orange-600">
              <span className="font-medium">Descanso:</span>
              <span>{formatDuration(totalBreakMinutes)}</span>
            </div>
          )}
          
          <div className="flex items-center space-x-1">
            <span className="font-medium">Salida:</span>
            <span>{formatTime(clockOut)}</span>
          </div>
        </div>
      </div>
    );
  };

  // Daily Timeline Bar Component for displaying multiple sessions in a single day
  const DailyTimelineBar = ({ dayData }: { dayData: any }) => {
    if (!dayData.sessions || dayData.sessions.length === 0) {
      return <div className="text-gray-400">Sin datos</div>;
    }

    // Check for active sessions (sessions without clockOut)
    const hasActiveSessions = dayData.sessions.some((session: any) => !session.clockOut);
    
    if (hasActiveSessions) {
      // Handle active sessions - show current status with same visual style
      const activeSession = dayData.sessions.find((session: any) => !session.clockOut);
      const sessionStart = new Date(activeSession.clockIn);
      const now = new Date();
      const activeBreakPeriod = (activeSession.breakPeriods || []).find((bp: any) => !bp.breakEnd);
      const formatTime = (date: Date) => format(date, 'HH:mm');
      
      // Calculate active session progress and break positions
      const completedBreaks = (activeSession.breakPeriods || []).filter((bp: any) => bp.breakEnd);
      const activeBreakStart = activeBreakPeriod ? new Date(activeBreakPeriod.breakStart) : null;
      
      // Calculate progress percentage based on elapsed time 
      // LÓGICA: Una jornada típica de 8 horas = 100% de la barra
      // La barra se llena progresivamente según el tiempo transcurrido
      const sessionElapsedMinutes = Math.round((now.getTime() - sessionStart.getTime()) / (1000 * 60));
      const maxWorkdayMinutes = 8 * 60; // 480 minutos = 8 horas jornada estándar
      const progressPercentage = Math.min((sessionElapsedMinutes / maxWorkdayMinutes) * 100, 90); // Máximo 90% hasta fichar salida
      
      // Calculate break positions as percentages of elapsed time
      const sessionElapsedMs = now.getTime() - sessionStart.getTime();
      
      return (
        <div className="space-y-1">
          {/* Contenedor para duraciones de descanso ARRIBA de las barras */}
          <div className="relative h-4">
            {/* Descansos completados */}
            {completedBreaks.map((breakPeriod: any, breakIndex: number) => {
              const breakStart = new Date(breakPeriod.breakStart);
              const breakEnd = new Date(breakPeriod.breakEnd);
              const breakMinutes = Math.round((breakEnd.getTime() - breakStart.getTime()) / (1000 * 60));
              
              // Calculate break position as percentage of elapsed session time
              const breakStartMs = breakStart.getTime() - sessionStart.getTime();
              const breakPositionPercentage = Math.min((breakStartMs / sessionElapsedMs) * progressPercentage, progressPercentage - 5);
              
              return (
                <div
                  key={`completed-break-${breakIndex}`}
                  className="absolute text-xs text-orange-600 font-medium transform -translate-x-1/2 flex items-center gap-1"
                  style={{ 
                    left: `${breakPositionPercentage}%`,
                    top: '0px'
                  }}
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  {breakMinutes}min
                </div>
              );
            })}
            
            {/* Descanso activo */}
            {activeBreakPeriod && (
              <div
                className="absolute text-xs text-orange-600 font-medium transform -translate-x-1/2 flex items-center gap-1 animate-pulse"
                style={{ 
                  left: `${Math.min((((activeBreakStart!.getTime() - sessionStart.getTime()) / sessionElapsedMs) * progressPercentage), progressPercentage - 5)}%`,
                  top: '0px'
                }}
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                {activeBreakStart ? Math.round((now.getTime() - activeBreakStart.getTime()) / (1000 * 60)) : 0}min
              </div>
            )}
          </div>

          {/* Timeline visual progresivo */}
          <div className="relative h-5">
            {/* Línea base gris */}
            <div className="h-5 bg-gray-200 rounded-sm relative overflow-hidden">
              {/* Barra azul progresiva (se va llenando en tiempo real) */}
              <div
                className="absolute top-0 h-5 bg-blue-500 rounded-sm transition-all duration-1000"
                style={{
                  left: '0%',
                  width: `${progressPercentage}%`
                }}
              />
              
              {/* Descansos completados como sliders naranjas posicionados correctamente */}
              {completedBreaks.map((breakPeriod: any, breakIndex: number) => {
                const breakStart = new Date(breakPeriod.breakStart);
                const breakEnd = new Date(breakPeriod.breakEnd);
                const breakStartMs = breakStart.getTime() - sessionStart.getTime();
                const breakDurationMs = breakEnd.getTime() - breakStart.getTime();
                
                const breakLeftPercentage = Math.min((breakStartMs / sessionElapsedMs) * progressPercentage, progressPercentage - 5);
                const breakWidthPercentage = Math.min((breakDurationMs / sessionElapsedMs) * progressPercentage, 8);
                
                return (
                  <div
                    key={`break-bar-${breakIndex}`}
                    className="absolute top-0.5 h-4 bg-orange-400 rounded-sm"
                    style={{
                      left: `${breakLeftPercentage}%`,
                      width: `${breakWidthPercentage}%`
                    }}
                  />
                );
              })}
              
              {/* Descanso activo como slider naranja pulsante */}
              {activeBreakPeriod && (
                <div
                  className="absolute top-0.5 h-4 bg-orange-400 rounded-sm animate-pulse cursor-help"
                  style={{
                    left: `${Math.min((((activeBreakStart!.getTime() - sessionStart.getTime()) / sessionElapsedMs) * progressPercentage), progressPercentage - 5)}%`,
                    width: `${Math.max(Math.min((((now.getTime() - activeBreakStart!.getTime()) / sessionElapsedMs) * progressPercentage), 8), 3)}%`,
                    minWidth: '20px'
                  }}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTooltipPosition({ 
                      x: rect.left + rect.width / 2, 
                      y: rect.top - 10 
                    });
                    setShowBreakTooltip(true);
                    setTooltipContent(`Descanso en progreso: ${Math.round((now.getTime() - activeBreakStart!.getTime()) / (1000 * 60))} min`);
                  }}
                  onMouseLeave={() => {
                    setShowBreakTooltip(false);
                    setTooltipContent('');
                  }}
                />
              )}

              {/* Tooltip personalizado para descanso activo */}
              {showBreakTooltip && (
                <div
                  className="fixed bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg z-50 pointer-events-none"
                  style={{
                    left: `${tooltipPosition.x}px`,
                    top: `${tooltipPosition.y}px`,
                    transform: 'translateX(-50%)'
                  }}
                >
                  {tooltipContent || (activeBreakPeriod ? `Descanso en progreso: ${Math.round((now.getTime() - activeBreakStart!.getTime()) / (1000 * 60))} minutos` : '')}
                  <div 
                    className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Contenedor para horas ABAJO de las barras */}
          <div className="relative h-4 mt-1">
            {/* Entrada: punto alineado con inicio de barra + hora a la derecha */}
            <div className="absolute flex items-center" style={{ left: '0%', top: '0px' }}>
              <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
              <span className="text-xs font-medium text-green-700 whitespace-nowrap">{formatTime(sessionStart)}</span>
            </div>
            
            {/* Estado actual en tiempo real con punto pulsante - derecha */}
            <div className="absolute flex items-center" style={{ right: '0%', top: '0px', transform: 'translateX(100%)' }}>
              <span className={`text-xs font-medium mr-1 ${activeBreakPeriod ? 'text-orange-600' : 'text-blue-600'}`}>
                {activeBreakPeriod ? 'En descanso' : 'Trabajando'}
              </span>
              <div className={`w-2 h-2 rounded-full ${activeBreakPeriod ? 'bg-orange-500 animate-pulse' : 'bg-blue-500 animate-pulse'}`}></div>
            </div>
          </div>
        </div>
      );
    }

    // Calcular el rango total del día (desde primera entrada hasta última salida) - solo sesiones completadas
    const allTimes = dayData.sessions.flatMap((session: any) => [
      new Date(session.clockIn),
      session.clockOut ? new Date(session.clockOut) : null
    ]).filter(Boolean);
    const dayStart = new Date(Math.min(...allTimes.map(d => d.getTime())));
    const dayEnd = new Date(Math.max(...allTimes.map(d => d.getTime())));
    const totalDayDuration = (dayEnd.getTime() - dayStart.getTime()) / (1000 * 60 * 60); // en horas

    const formatTime = (date: Date) => format(date, 'HH:mm');

    return (
      <div className="space-y-1">
        {/* Contenedor para duraciones de descanso ARRIBA de las barras */}
        <div className="relative h-4">
          {dayData.sessions.map((session: any, sessionIndex: number) => {
            return (session.breakPeriods || []).map((breakPeriod: any, breakIndex: number) => {
              if (!breakPeriod.breakEnd) return null;
              
              const breakStart = new Date(breakPeriod.breakStart);
              const breakEnd = new Date(breakPeriod.breakEnd);
              
              // Posición del descanso relativa al inicio del día
              const breakStartOffset = (breakStart.getTime() - dayStart.getTime()) / (1000 * 60 * 60);
              const breakDuration = (breakEnd.getTime() - breakStart.getTime()) / (1000 * 60 * 60);
              
              const breakLeftPercentage = (breakStartOffset / totalDayDuration) * 100;
              const breakWidthPercentage = Math.max((breakDuration / totalDayDuration) * 100, 1);
              const breakMinutes = Math.round((breakEnd.getTime() - breakStart.getTime()) / (1000 * 60));
              
              return (
                <div
                  key={`break-label-${sessionIndex}-${breakIndex}`}
                  className="absolute text-xs text-orange-600 font-medium transform -translate-x-1/2 flex items-center gap-1"
                  style={{ 
                    left: `${breakLeftPercentage + breakWidthPercentage/2}%`,
                    top: '0px'
                  }}
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  {breakMinutes}min
                </div>
              );
            });
          })}
        </div>

        {/* Timeline visual minimalista */}
        <div className="relative h-5">
          {/* Línea base gris minimalista */}
          <div className="h-5 bg-gray-200 rounded-sm relative overflow-hidden">
            
            {/* Segmentos de trabajo (barras azules minimalistas) con descansos slider */}
            {dayData.sessions.filter((session: any) => session.clockOut).map((session: any, sessionIndex: number) => {
              const sessionStart = new Date(session.clockIn);
              const sessionEnd = new Date(session.clockOut);
              
              // Posición relativa dentro del día
              const startOffset = (sessionStart.getTime() - dayStart.getTime()) / (1000 * 60 * 60);
              const sessionDuration = (sessionEnd.getTime() - sessionStart.getTime()) / (1000 * 60 * 60);
              
              const leftPercentage = (startOffset / totalDayDuration) * 100;
              const widthPercentage = (sessionDuration / totalDayDuration) * 100;
              
              return (
                <div key={sessionIndex} className="relative">
                  {/* Barra azul minimalista */}
                  <div
                    className="absolute top-0 h-5 bg-blue-500 rounded-sm"
                    style={{
                      left: `${leftPercentage}%`,
                      width: `${widthPercentage}%`
                    }}
                  />
                  
                  {/* Descansos como sliders dentro de la barra azul */}
                  {(session.breakPeriods || []).map((breakPeriod: any, breakIndex: number) => {
                    if (!breakPeriod.breakEnd) return null;
                    
                    const breakStart = new Date(breakPeriod.breakStart);
                    const breakEnd = new Date(breakPeriod.breakEnd);
                    
                    // Posición del descanso relativa al inicio de la sesión (no del día)
                    const breakStartRelativeToSession = (breakStart.getTime() - sessionStart.getTime()) / (1000 * 60 * 60);
                    const breakDuration = (breakEnd.getTime() - breakStart.getTime()) / (1000 * 60 * 60);
                    
                    const breakLeftPercentageInSession = (breakStartRelativeToSession / sessionDuration) * 100;
                    const breakWidthPercentageInSession = Math.max((breakDuration / sessionDuration) * 100, 2); // Mínimo 2%
                    
                    return (
                      <div
                        key={`${sessionIndex}-${breakIndex}`}
                        className="absolute top-0.5 h-4 bg-orange-400 rounded-sm"
                        style={{
                          left: `${breakLeftPercentageInSession}%`,
                          width: `${breakWidthPercentageInSession}%`
                        }}
                        title={`Descanso: ${formatTime(breakStart)} - ${formatTime(breakEnd)}`}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Contenedor para horas de entrada/salida ABAJO de las barras */}
        <div className="relative h-6 mt-1" style={{ zIndex: 10 }}>
          {(() => {
            // Preparar todas las etiquetas de tiempo con sus posiciones
            const completedSessions = dayData.sessions.filter((session: any) => session.clockOut);
            const timeLabels: Array<{
              text: string;
              position: number;
              type: 'start' | 'end';
              sessionIndex: number;
              originalPosition: number;
              time: Date; // Agregar fecha real para ordenar cronológicamente
            }> = [];

            completedSessions.forEach((session: any, sessionIndex: number) => {
              const sessionStart = new Date(session.clockIn);
              const sessionEnd = new Date(session.clockOut);
              
              // Posición relativa dentro del día
              const startOffset = (sessionStart.getTime() - dayStart.getTime()) / (1000 * 60 * 60);
              const sessionDuration = (sessionEnd.getTime() - sessionStart.getTime()) / (1000 * 60 * 60);
              
              const leftPercentage = (startOffset / totalDayDuration) * 100;
              const widthPercentage = (sessionDuration / totalDayDuration) * 100;

              // Agregar etiqueta de entrada
              timeLabels.push({
                text: formatTime(sessionStart),
                position: leftPercentage,
                originalPosition: leftPercentage,
                type: 'start',
                sessionIndex,
                time: sessionStart
              });

              // Agregar etiqueta de salida
              timeLabels.push({
                text: formatTime(sessionEnd),
                position: leftPercentage + widthPercentage,
                originalPosition: leftPercentage + widthPercentage,
                type: 'end',
                sessionIndex,
                time: sessionEnd
              });
            });

            // Ordenar etiquetas por tiempo real (cronológicamente)
            timeLabels.sort((a, b) => a.time.getTime() - b.time.getTime());

            // Algoritmo híbrido: detectar colisiones locales y marcar puntos específicos
            const avgTextWidth = 5; // En porcentaje del contenedor (~42px de 800px típicos)
            const minDistance = 3; // Distancia mínima en % para evitar solapamiento
            
            // Marcar cada etiqueta como overlapping o no
            const labelOverlapStatus = timeLabels.map((label, index) => {
              let hasCollision = false;
              
              // Verificar colisión con etiqueta anterior
              if (index > 0) {
                const prevLabel = timeLabels[index - 1];
                const distance = label.position - prevLabel.position;
                if (distance < avgTextWidth + minDistance) {
                  hasCollision = true;
                }
              }
              
              // Verificar colisión con etiqueta siguiente
              if (index < timeLabels.length - 1) {
                const nextLabel = timeLabels[index + 1];
                const distance = nextLabel.position - label.position;
                if (distance < avgTextWidth + minDistance) {
                  hasCollision = true;
                }
              }
              
              return { ...label, hasCollision };
            });

            // Si hay muchas etiquetas (>8), usar modo compacto global
            const shouldUseGlobalCompactMode = timeLabels.length > 8;
            
            // Algoritmo híbrido implementado: detecta colisiones específicas y aplica posicionamiento flexible
            
            if (shouldUseGlobalCompactMode) {
              // Modo compacto global: todas las etiquetas como tooltips
              return completedSessions.map((session: any, sessionIndex: number) => {
                const sessionStart = new Date(session.clockIn);
                const sessionEnd = new Date(session.clockOut);
                
                const startOffset = (sessionStart.getTime() - dayStart.getTime()) / (1000 * 60 * 60);
                const sessionDuration = (sessionEnd.getTime() - sessionStart.getTime()) / (1000 * 60 * 60);
                
                const leftPercentage = (startOffset / totalDayDuration) * 100;
                const widthPercentage = (sessionDuration / totalDayDuration) * 100;
                
                return (
                  <div key={`session-indicators-${sessionIndex}`} className="relative">
                    {/* Indicador de entrada */}
                    <div
                      className="absolute w-2 h-2 bg-green-500 rounded-full cursor-help group"
                      style={{ left: `${leftPercentage}%`, top: '1px', transform: 'translateX(-50%)' }}
                    >
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 text-xs bg-black text-white rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-20">
                        Entrada: {formatTime(sessionStart)}
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-black"></div>
                      </div>
                    </div>
                    
                    {/* Indicador de salida */}
                    <div
                      className="absolute w-2 h-2 bg-red-500 rounded-full cursor-help group"
                      style={{ left: `${leftPercentage + widthPercentage}%`, top: '1px', transform: 'translateX(-50%)' }}
                    >
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 text-xs bg-black text-white rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-20">
                        Salida: {formatTime(sessionEnd)}
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-black"></div>
                      </div>
                    </div>
                  </div>
                );
              });
            }

            // Usar directamente timeLabels que ya está ordenado cronológicamente
            return labelOverlapStatus.map((label, eventIndex) => {
              const key = `event-${label.type}-${label.sessionIndex}-${eventIndex}`;
              
              if (label.type === 'start') {
                // Entrada
                return label.hasCollision ? (
                  // Con colisión: punto desplazado horizontalmente
                  <div 
                    key={key}
                    className="absolute w-2 h-2 bg-green-500 rounded-full cursor-help shadow-md border border-white" 
                    style={{ 
                      left: `${label.position - 1}%`,
                      top: '0px',
                      transform: 'translateX(-50%)',
                      zIndex: 10
                    }}
                    title={`Entrada: ${label.text}`}
                  />
                ) : (
                  // Sin colisión: punto + hora visible
                  <div key={key} className="absolute flex items-center" style={{ left: `${label.position}%`, top: '0px' }}>
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                    <span className="text-xs font-medium text-green-700 whitespace-nowrap">{label.text}</span>
                  </div>
                );
              } else {
                // Salida
                return label.hasCollision ? (
                  // Con colisión: punto desplazado horizontalmente
                  <div 
                    key={key}
                    className="absolute w-2 h-2 bg-red-500 rounded-full cursor-help shadow-md border border-white" 
                    style={{ 
                      left: `${label.position + 1}%`,
                      top: '0px',
                      transform: 'translateX(-50%)',
                      zIndex: 10
                    }}
                    title={`Salida: ${label.text}`}
                  />
                ) : (
                  // Sin colisión: punto + hora visible
                  <div key={key} className="absolute flex items-center" style={{ left: `${label.position}%`, top: '0px', transform: 'translateX(-100%)' }}>
                    <span className="text-xs font-medium text-red-700 whitespace-nowrap mr-1">{label.text}</span>
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  </div>
                );
              }
            });
          })()}
        </div>
      </div>
    );
  };

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
      <div className="grid grid-cols-4 md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-6 mb-6">
        <StatsCard
          title="Han Fichado"
          subtitle="Empleados"
          value={`${employeesWithSessions}/${totalEmployees}`}
          color="green"
          icon={Users}
        />
        
        <StatsCard
          title="Media Diaria"
          subtitle="Horas/día"
          value={`${averageHoursPerEmployee.toFixed(1)}h`}
          color="orange"
          icon={TrendingUp}
        />
        
        <StatsCard
          title="Media Semanal"
          subtitle="Horas/sem"
          value={`${averageHoursPerWeek.toFixed(1)}h`}
          color="blue"
          icon={CalendarDays}
        />
        
        <StatsCard
          title="Media Mensual"
          subtitle="Horas/mes"
          value={`${averageHoursPerMonth.toFixed(1)}h`}
          color="purple"
          icon={BarChart3}
        />
      </div>

      {/* Sessions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{getFilterTitle()} ({filteredSessions.length})</span>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2"
              >
                <Filter className="w-4 h-4" />
                Filtros
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleExportPDF}
                title="Exporta en PDF la vista actual de fichajes"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </div>
          </CardTitle>
        </CardHeader>

        {/* Filters Section - Integrated between header and table */}
        {showFilters && (
          <div className="px-6 py-4 border-b bg-gray-50">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-end">
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
                    {(employeesList || [])
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
              {/* ⚠️ CRÍTICO: NO MODIFICAR ESTE LAYOUT - IMPLEMENTACIÓN FINAL BLINDADA */}
              {/* Layout perfecto: 5 botones uniformes en línea horizontal con distribución completa */}
              {/* flex-1 + gap-2 + text-xs + text-center = distribución perfecta sin espacios vacíos */}
              <div className="flex flex-col space-y-2 lg:col-span-2">
                <label className="text-sm font-medium text-gray-700">Período de tiempo</label>
                <div className="flex items-center gap-2 w-full">
                  {/* ⚠️ TODOS LOS BOTONES DEBEN MANTENER: flex-1 text-xs font-normal text-center */}
                  <Button
                    variant={dateFilter === 'today' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setDateFilter('today');
                      setSelectedStartDate(null);
                      setSelectedEndDate(null);
                      setStartDate('');
                      setEndDate('');
                    }}
                    className="h-10 text-xs font-normal flex-1 text-center" // ⚠️ NO MODIFICAR: tipografía uniforme
                  >
                    Hoy
                  </Button>
                  
                  <DatePickerDay
                    date={dateFilter === 'day' ? currentDate : undefined}
                    onDateChange={(date) => {
                      if (date) {
                        setCurrentDate(date);
                        setDateFilter('day');
                        setSelectedStartDate(null);
                        setSelectedEndDate(null);
                        setStartDate('');
                        setEndDate('');
                      }
                    }}
                    buttonText={dateFilter === 'day' 
                      ? format(currentDate, 'd MMM yyyy', { locale: es })
                      : 'Día'
                    }
                    className={cn(
                      "h-10 text-xs font-normal whitespace-nowrap flex-1 text-center", // ⚠️ NO MODIFICAR: tipografía uniforme
                      dateFilter === 'day' && "bg-[#007AFF] text-white border-[#007AFF] hover:bg-[#007AFF]/90"
                    )}
                  />

                  <Popover open={isMonthDialogOpen} onOpenChange={setIsMonthDialogOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant={dateFilter === 'month' ? 'default' : 'outline'}
                        size="sm"
                        className="h-10 text-xs font-normal whitespace-nowrap flex-1 text-center" // ⚠️ NO MODIFICAR: tipografía uniforme
                      >
                        {dateFilter === 'month' ? format(currentMonth, 'MMM yyyy', { locale: es }) : 'Mes'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-2" align="start">
                      <div className="space-y-1 max-h-60 overflow-y-auto">
                        {availableMonths.map((monthKey: string) => {
                          const [year, month] = monthKey.split('-');
                          const monthDate = new Date(parseInt(year), parseInt(month) - 1);
                          return (
                            <Button
                              key={monthKey}
                              variant="ghost"
                              className="w-full justify-start text-sm"
                              onClick={() => {
                                setCurrentMonth(monthDate);
                                setDateFilter('month');
                                setIsMonthDialogOpen(false);
                                setSelectedStartDate(null);
                                setSelectedEndDate(null);
                                setStartDate('');
                                setEndDate('');
                              }}
                            >
                              {format(monthDate, 'MMMM yyyy', { locale: es })}
                            </Button>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>

                  <DatePickerPeriod
                    startDate={selectedStartDate}
                    endDate={selectedEndDate}
                    onStartDateChange={(date) => {
                      setSelectedStartDate(date || null);
                      setStartDate(date ? format(date, 'yyyy-MM-dd') : '');
                      if (date && selectedEndDate) {
                        setDateFilter('custom');
                      }
                    }}
                    onEndDateChange={(date) => {
                      setSelectedEndDate(date || null);
                      setEndDate(date ? format(date, 'yyyy-MM-dd') : '');
                      if (selectedStartDate && date) {
                        setDateFilter('custom');
                      }
                    }}
                    className={cn(
                      "h-10 text-xs font-normal whitespace-nowrap flex-1 text-center", // ⚠️ NO MODIFICAR: tipografía uniforme
                      dateFilter === 'custom' && "bg-[#007AFF] text-white border-[#007AFF] hover:bg-[#007AFF]/90"
                    )}
                  />

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDateFilter('all');
                      setSelectedEmployee('all');
                      setSelectedStartDate(null);
                      setSelectedEndDate(null);
                      setStartDate('');
                      setEndDate('');
                      setCurrentDate(new Date());
                      setCurrentMonth(new Date());
                    }}
                    className="h-10 text-xs font-normal whitespace-nowrap flex-1 text-center"
                  >
                    Limpiar filtros
                  </Button>
                  {/* ⚠️ FIN ZONA CRÍTICA - Layout de filtros completamente optimizado y blindado */}
                </div>
              </div>
            </div>
          </div>
        )}

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Empleado</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Fecha</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900 min-w-[300px]">Jornada de Trabajo</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Total</th>
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
                    (sortedSessions || [])
                      .filter(session => {
                        const sessionWeekStart = startOfWeek(new Date(session.clockIn), { weekStartsOn: 1 });
                        return sessionWeekStart.getTime() === weekStart.getTime();
                      })
                      .reduce((total, session) => {
                        const totalSessionHours = calculateHours(session.clockIn, session.clockOut);
                        const breakHours = session.breakPeriods 
                          ? session.breakPeriods.reduce((breakTotal: number, breakPeriod: any) => {
                              return breakTotal + calculateHours(breakPeriod.breakStart, breakPeriod.breakEnd);
                            }, 0) 
                          : 0;
                        return total + (totalSessionHours - breakHours);
                      }, 0);
                  
                  const calculateMonthTotal = (monthKey: string) => 
                    (sortedSessions || [])
                      .filter(session => format(new Date(session.clockIn), 'yyyy-MM') === monthKey)
                      .reduce((total, session) => {
                        const totalSessionHours = calculateHours(session.clockIn, session.clockOut);
                        const breakHours = session.breakPeriods 
                          ? session.breakPeriods.reduce((breakTotal: number, breakPeriod: any) => {
                              return breakTotal + calculateHours(breakPeriod.breakStart, breakPeriod.breakEnd);
                            }, 0) 
                          : 0;
                        return total + (totalSessionHours - breakHours);
                      }, 0);
                  
                  // Agrupar sesiones por empleado y día
                  const sessionsByDay = sortedSessions.reduce((acc: any, session: any) => {
                    const dayKey = `${session.userId}-${format(new Date(session.clockIn), 'yyyy-MM-dd')}`;
                    if (!acc[dayKey]) {
                      acc[dayKey] = {
                        date: format(new Date(session.clockIn), 'yyyy-MM-dd'),
                        userId: session.userId,
                        userName: session.userName,
                        sessions: []
                      };
                    }
                    acc[dayKey].sessions.push(session);
                    return acc;
                  }, {});

                  // Ordenar sesiones dentro de cada día por hora
                  Object.values(sessionsByDay).forEach((dayData: any) => {
                    dayData.sessions.sort((a: any, b: any) => new Date(a.clockIn).getTime() - new Date(b.clockIn).getTime());
                  });

                  // Convertir a array y ordenar por fecha (más reciente primero)
                  const dailyEntries = Object.values(sessionsByDay).sort((a: any, b: any) => 
                    new Date(b.date).getTime() - new Date(a.date).getTime()
                  );

                  const result: JSX.Element[] = [];
                  
                  dailyEntries.forEach((dayData: any, index: number) => {
                    const dayDate = new Date(dayData.date);
                    const weekStart = startOfWeek(dayDate, { weekStartsOn: 1 });
                    const monthKey = format(dayDate, 'yyyy-MM');
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
                        <tr key={`month-${previousMonth}`} className="bg-blue-50 border-y-2 border-blue-200 h-10">
                          <td colSpan={5} className="py-1 px-4 text-center">
                            <div className="font-semibold text-blue-800 capitalize text-sm">
                              Total {monthName}: {monthTotal.toFixed(1)}h
                            </div>
                          </td>
                        </tr>
                      );
                    }
                    
                    if (showSummaries && isNewWeek && index > 0 && previousWeekStart) {
                      const weekTotal = calculateWeekTotal(previousWeekStart);
                      result.push(
                        <tr key={`week-${previousWeekStart.getTime()}`} className="bg-gray-100 border-y border-gray-300 h-10">
                          <td colSpan={5} className="py-1 px-4 text-center">
                            <div className="font-medium text-gray-700 text-sm">
                              Total semana: {weekTotal.toFixed(1)}h
                            </div>
                          </td>
                        </tr>
                      );
                    }
                    
                    // Calcular horas totales trabajadas del día menos períodos de descanso
                    const totalDayHours = dayData.sessions.reduce((total: number, session: any) => {
                      const sessionHours = calculateHours(session.clockIn, session.clockOut);
                      const breakHours = session.breakPeriods 
                        ? session.breakPeriods.reduce((breakTotal: number, breakPeriod: any) => {
                            return breakTotal + calculateHours(breakPeriod.breakStart, breakPeriod.breakEnd);
                          }, 0) 
                        : 0;
                      return total + (sessionHours - breakHours);
                    }, 0);
                    
                    const isEditing = editingSession === dayData.sessions[0]?.id;
                    
                    result.push(
                      <tr key={`day-${dayData.date}-${dayData.userId}`} className="hover:bg-gray-50 border-b border-gray-100 h-12">
                        <td className="py-2 px-4">
                          <div className="font-medium text-gray-900">
                            {dayData.userName || 'Usuario Desconocido'}
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
                              {format(new Date(dayData.date), 'dd/MM/yyyy')}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 min-w-[300px]">
                          {isEditing ? (
                            <div className="space-y-2">
                              <div className="flex space-x-2">
                                <Input
                                  type="time"
                                  value={editData.clockIn}
                                  onChange={(e) => setEditData(prev => ({ ...prev, clockIn: e.target.value }))}
                                  className="w-24 h-8"
                                  placeholder="Entrada"
                                />
                                <Input
                                  type="time"
                                  value={editData.clockOut}
                                  onChange={(e) => setEditData(prev => ({ ...prev, clockOut: e.target.value }))}
                                  className="w-24 h-8"
                                  placeholder="Salida"
                                />
                              </div>
                            </div>
                          ) : (
                            <DailyTimelineBar dayData={dayData} />
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-900">
                            {totalDayHours > 0 ? `${totalDayHours.toFixed(1)}h` : '-'}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isEditing ? (
                            <div className="flex gap-2 justify-center">
                              <Button
                                size="sm"
                                onClick={() => handleSaveSession(dayData.sessions[0]?.id)}
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
                              onClick={() => handleEditSession(dayData.sessions[0])}
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
                          <td colSpan={5} className="py-2 px-4 text-center">
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
                          <td colSpan={5} className="py-3 px-4 text-center">
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
                
                {filteredSessions.length === 0 && (
                  <tr className="h-32">
                    <td colSpan={5} className="py-8 text-center">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                          <Users className="w-5 h-5 text-gray-400" />
                        </div>
                        <div className="text-gray-500 font-medium text-sm">
                          No hay fichajes en este período
                        </div>
                        <div className="text-gray-400 text-xs">
                          Prueba seleccionando un rango de fechas diferente
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}