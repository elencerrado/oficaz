import { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { usePageTitle } from '@/hooks/use-page-title';
import { usePageHeader } from '@/components/layout/page-header';
import { FeatureRestrictedPage } from '@/components/feature-restricted-page';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { getAuthHeaders } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import StatsCard from '@/components/StatsCard';
import { cn } from '@/lib/utils';
import { 
  ClipboardList, 
  Clock, 
  MapPin,
  Calendar as CalendarIcon,
  Search,
  Filter,
  User,
  FileText,
  CheckCircle,
  Download,
  FileSpreadsheet,
  Users,
  Eye,
  X,
  Pen,
  Edit
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface WorkReportWithEmployee {
  id: number;
  companyId: number;
  employeeId: number;
  reportDate: string;
  refCode?: string | null;
  location: string;
  locationCoords?: string | null;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  description: string;
  clientName?: string | null;
  notes?: string | null;
  signedBy?: string | null;
  signatureImage?: string | null;
  status: 'draft' | 'submitted';
  createdAt: string;
  updatedAt: string;
  employeeName: string;
  employeeSignature?: string | null;
}

interface Employee {
  id: number;
  fullName: string;
  role: string;
}

const STATUS_STYLES = {
  draft: { bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800', text: 'text-orange-700 dark:text-orange-300', label: 'Borrador' },
  submitted: { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800', text: 'text-green-700 dark:text-green-300', label: 'Enviado' }
};

const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}min`;
};

interface EditFormData {
  reportDate: string;
  refCode: string;
  location: string;
  startTime: string;
  endTime: string;
  description: string;
  clientName: string;
  notes: string;
}

export default function AdminWorkReportsPage() {
  usePageTitle('Partes de Trabajo - Admin');
  const { user, isAuthenticated, isLoading: authLoading, subscription } = useAuth();
  const { setHeader, resetHeader } = usePageHeader();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    setHeader({
      title: 'Partes de Trabajo',
      subtitle: 'Visualiza y exporta los partes de trabajo de todos los empleados'
    });
    return resetHeader;
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('this-month');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [isExporting, setIsExporting] = useState(false);
  const [activeStatsFilter, setActiveStatsFilter] = useState<'today' | 'week' | 'month' | null>('month');
  const [showFilters, setShowFilters] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<WorkReportWithEmployee | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<number | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<WorkReportWithEmployee | null>(null);
  const [editFormData, setEditFormData] = useState<EditFormData>({
    reportDate: '',
    refCode: '',
    location: '',
    startTime: '',
    endTime: '',
    description: '',
    clientName: '',
    notes: ''
  });

  const getDateRange = useCallback(() => {
    const today = new Date();
    switch (dateFilter) {
      case 'today':
        const todayStr = format(today, 'yyyy-MM-dd');
        return { startDate: todayStr, endDate: todayStr };
      case 'this-week':
        return { 
          startDate: format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
          endDate: format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        };
      case 'this-month':
        return { 
          startDate: format(startOfMonth(today), 'yyyy-MM-dd'),
          endDate: format(endOfMonth(today), 'yyyy-MM-dd')
        };
      case 'all':
      default:
        return {};
    }
  }, [dateFilter]);

  const { startDate, endDate } = getDateRange();

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['/api/employees'],
    enabled: isAuthenticated && !authLoading,
    staleTime: 5 * 60 * 1000 // ⚡ Cache for 5 minutes
  });

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (employeeFilter !== 'all') params.append('employeeId', employeeFilter);
    return params.toString() ? `?${params.toString()}` : '';
  }, [startDate, endDate, employeeFilter]);

  const stableQueryKey = useMemo(() => 
    ['/api/admin/work-reports', dateFilter, employeeFilter] as const,
    [dateFilter, employeeFilter]
  );
  
  const { data: reports = [], isLoading: reportsLoading, isFetching } = useQuery<WorkReportWithEmployee[]>({
    queryKey: stableQueryKey,
    queryFn: async () => {
      const response = await fetch(`/api/admin/work-reports${queryParams}`, {
        headers: getAuthHeaders() as Record<string, string>,
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch reports');
      return response.json();
    },
    enabled: isAuthenticated && !authLoading,
    staleTime: 30000,
    placeholderData: keepPreviousData
  });

  const filteredReports = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    return reports.filter(report => {
      if (searchTerm === '') return true;
      
      const formattedDate = format(parseISO(report.reportDate), "d 'de' MMMM yyyy", { locale: es }).toLowerCase();
      const shortDate = format(parseISO(report.reportDate), 'dd/MM/yyyy');
      
      return (
        report.location.toLowerCase().includes(searchLower) ||
        report.description.toLowerCase().includes(searchLower) ||
        report.employeeName.toLowerCase().includes(searchLower) ||
        (report.clientName && report.clientName.toLowerCase().includes(searchLower)) ||
        (report.refCode && report.refCode.toLowerCase().includes(searchLower)) ||
        formattedDate.includes(searchLower) ||
        shortDate.includes(searchLower)
      );
    });
  }, [reports, searchTerm]);

  const handleTodayFilter = useCallback(() => {
    setActiveStatsFilter(prev => {
      if (prev === 'today') {
        setDateFilter('all');
        return null;
      }
      setDateFilter('today');
      return 'today';
    });
  }, []);

  const handleThisWeekFilter = useCallback(() => {
    setActiveStatsFilter(prev => {
      if (prev === 'week') {
        setDateFilter('all');
        return null;
      }
      setDateFilter('this-week');
      return 'week';
    });
  }, []);

  const handleThisMonthFilter = useCallback(() => {
    setActiveStatsFilter(prev => {
      if (prev === 'month') {
        setDateFilter('all');
        return null;
      }
      setDateFilter('this-month');
      return 'month';
    });
  }, []);

  const exportToFormat = async (format: 'pdf' | 'excel') => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (employeeFilter !== 'all') params.append('employeeId', employeeFilter);

      const response = await fetch(`/api/admin/work-reports/export/${format}?${params}`, {
        headers: getAuthHeaders() as Record<string, string>
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `partes-trabajo-${startDate || 'all'}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({ title: 'Exportación completada', description: `Los partes se han exportado a ${format.toUpperCase()}.` });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'No se pudo exportar.', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleViewReport = useCallback((report: WorkReportWithEmployee) => {
    setSelectedReport(report);
    setViewModalOpen(true);
  }, []);

  const handleDownloadPdf = useCallback(async (report: WorkReportWithEmployee) => {
    setIsDownloadingPdf(report.id);
    try {
      const response = await fetch(`/api/work-reports/${report.id}/pdf`, {
        headers: getAuthHeaders() as Record<string, string>
      });

      if (!response.ok) throw new Error('Error al generar PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `parte-trabajo-${report.id}-${report.reportDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({ title: 'PDF descargado', description: 'El parte de trabajo se ha descargado correctamente.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'No se pudo generar el PDF.', variant: 'destructive' });
    } finally {
      setIsDownloadingPdf(null);
    }
  }, [toast]);

  const handleEditReport = useCallback((report: WorkReportWithEmployee) => {
    setEditingReport(report);
    setEditFormData({
      reportDate: report.reportDate,
      refCode: report.refCode || '',
      location: report.location,
      startTime: report.startTime,
      endTime: report.endTime,
      description: report.description,
      clientName: report.clientName || '',
      notes: report.notes || ''
    });
    setEditModalOpen(true);
  }, []);

  const updateReportMutation = useMutation({
    mutationFn: async (data: { id: number; updates: Partial<EditFormData> }) => {
      return apiRequest('PATCH', `/api/admin/work-reports/${data.id}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/work-reports'], exact: false });
      setEditModalOpen(false);
      setEditingReport(null);
      toast({ title: 'Parte actualizado', description: 'Los cambios se han guardado correctamente.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'No se pudo actualizar el parte.', variant: 'destructive' });
    }
  });

  const handleSaveEdit = useCallback(() => {
    if (!editingReport) return;
    updateReportMutation.mutate({
      id: editingReport.id,
      updates: editFormData
    });
  }, [editingReport, editFormData, updateReportMutation]);

  const stats = useMemo(() => {
    const totalMinutes = filteredReports.reduce((sum, r) => sum + r.durationMinutes, 0);
    const totalHours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;
    const uniqueEmployees = new Set(reports.map(r => r.employeeName)).size;
    const completedCount = filteredReports.filter(r => r.status === 'submitted').length;
    return { totalMinutes, totalHours, remainingMinutes, uniqueEmployees, completedCount };
  }, [filteredReports, reports]);

  const filterTitle = useMemo(() => {
    switch (dateFilter) {
      case 'today':
        return 'Partes de hoy';
      case 'this-week':
        return 'Partes de esta semana';
      case 'this-month':
        return 'Partes de este mes';
      case 'all':
      default:
        return 'Todos los partes';
    }
  }, [dateFilter]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const isPro = subscription?.plan === 'pro' || subscription?.plan === 'master';
  if (!isPro) {
    return (
      <FeatureRestrictedPage 
        featureName="Partes de Trabajo" 
        description="Visualiza y exporta los partes de trabajo de todos tus empleados con esta funcionalidad exclusiva del plan Pro." 
        requiredPlan="Pro" 
      />
    );
  }

  if (reportsLoading) {
    return (
      <div className="px-6 py-4">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-2 md:gap-6 mb-3">
        <StatsCard
          title="Total Partes"
          subtitle="Registrados"
          value={filteredReports.length}
          color="blue"
          icon={ClipboardList}
          onClick={handleThisMonthFilter}
          isActive={activeStatsFilter === 'month'}
        />
        
        <StatsCard
          title="Horas Totales"
          subtitle="Trabajadas"
          value={`${stats.totalHours}h${stats.remainingMinutes > 0 ? ` ${stats.remainingMinutes}m` : ''}`}
          color="green"
          icon={Clock}
          onClick={handleTodayFilter}
          isActive={activeStatsFilter === 'today'}
        />
        
        <StatsCard
          title="Empleados"
          subtitle="Activos"
          value={stats.uniqueEmployees}
          color="purple"
          icon={Users}
          onClick={handleThisWeekFilter}
          isActive={activeStatsFilter === 'week'}
        />
        
        <StatsCard
          title="Completados"
          subtitle="Partes"
          value={stats.completedCount}
          color="green"
          icon={CheckCircle}
        />
      </div>

      {/* Filters & List Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
            <span className="text-sm sm:text-lg font-medium">{filterTitle} ({filteredReports.length})</span>
            
            {/* Filters button */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              Filtros
            </Button>
          </CardTitle>
        </CardHeader>

        {/* Collapsible Filters */}
        {showFilters && (
          <div className="px-6 py-4 border-b bg-muted">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-end">
              <div className="flex flex-col space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Buscar</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Buscar por cód. ref., empleado, lugar, cliente, fecha, trabajo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-10"
                    data-testid="input-admin-search-reports"
                  />
                </div>
              </div>
              <div className="flex flex-col space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Empleado</label>
                <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                  <SelectTrigger className="h-10" data-testid="select-employee-filter">
                    <Users className="w-4 h-4 mr-2 text-gray-500" />
                    <SelectValue placeholder="Filtrar por empleado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los empleados</SelectItem>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id.toString()}>{emp.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Período</label>
                <div className="flex items-center gap-2">
                  <Button
                    variant={dateFilter === 'today' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setDateFilter('today');
                      setActiveStatsFilter('today');
                    }}
                    className="h-10 text-xs font-normal flex-1"
                  >
                    Hoy
                  </Button>
                  <Button
                    variant={dateFilter === 'this-week' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setDateFilter('this-week');
                      setActiveStatsFilter('week');
                    }}
                    className="h-10 text-xs font-normal flex-1"
                  >
                    Semana
                  </Button>
                  <Button
                    variant={dateFilter === 'this-month' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setDateFilter('this-month');
                      setActiveStatsFilter('month');
                    }}
                    className="h-10 text-xs font-normal flex-1"
                  >
                    Mes
                  </Button>
                  <Button
                    variant={dateFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setDateFilter('all');
                      setActiveStatsFilter(null);
                    }}
                    className="h-10 text-xs font-normal flex-1"
                  >
                    Todo
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <CardContent className="p-0">
          {filteredReports.length === 0 ? (
            <div className="py-12 text-center">
              <ClipboardList className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {searchTerm || employeeFilter !== 'all' ? 'No se encontraron partes' : 'Sin partes de trabajo'}
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                {searchTerm || employeeFilter !== 'all' 
                  ? 'Intenta con otros filtros de búsqueda' 
                  : 'Los empleados aún no han registrado partes de trabajo en este período'}
              </p>
            </div>
          ) : filteredReports.length > 0 ? (
            <div className="p-4 md:p-6 space-y-4">
              {filteredReports.map((report) => {
                const statusStyle = STATUS_STYLES[report.status];
                return (
                  <div 
                    key={report.id} 
                    className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                    data-testid={`card-admin-report-${report.id}`}
                  >
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                        <User className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        <span className="font-semibold">{report.employeeName}</span>
                        {report.refCode && (
                          <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700 text-xs">
                            {report.refCode}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditReport(report)}
                          className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400"
                          title="Editar parte"
                          data-testid={`button-edit-report-${report.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleViewReport(report)}
                          className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400"
                          title="Ver parte completo"
                          data-testid={`button-view-report-${report.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownloadPdf(report)}
                          disabled={isDownloadingPdf === report.id}
                          className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400 disabled:opacity-50"
                          title="Descargar PDF"
                          data-testid={`button-download-pdf-${report.id}`}
                        >
                          <Download className={`w-4 h-4 ${isDownloadingPdf === report.id ? 'animate-pulse' : ''}`} />
                        </button>
                      </div>
                    </div>
                    
                    <div className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-2">
                          <div>
                            <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-xs mb-0.5">
                              <CalendarIcon className="w-3.5 h-3.5" />
                              Fecha
                            </div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                              {format(parseISO(report.reportDate), 'EEE, d MMM yyyy', { locale: es })}
                            </p>
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-xs mb-0.5">
                              <Clock className="w-3.5 h-3.5" />
                              Horario
                            </div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {report.startTime} - {report.endTime}
                              <span className="ml-1 text-xs text-blue-600 dark:text-blue-400 font-medium">
                                ({formatDuration(report.durationMinutes)})
                              </span>
                            </p>
                          </div>
                        </div>
                        
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-2">
                          <div>
                            <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-xs mb-0.5">
                              <MapPin className="w-3.5 h-3.5" />
                              Ubicación
                            </div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{report.location}</p>
                          </div>
                          {report.clientName && (
                            <div>
                              <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-xs mb-0.5">
                                <User className="w-3.5 h-3.5" />
                                Cliente
                              </div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{report.clientName}</p>
                            </div>
                          )}
                        </div>

                        <div className="md:col-span-2 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                          <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-xs mb-1">
                            <FileText className="w-3.5 h-3.5" />
                            Trabajo realizado
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-300">{report.description}</p>
                        </div>
                      </div>
                      
                      {report.notes && (
                        <div className="mt-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 border-l-4 border-amber-400">
                          <p className="text-sm text-amber-800 dark:text-amber-200">
                            <span className="font-medium">Notas:</span> {report.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Modal de visualización del parte */}
      <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900">
          <DialogHeader className="border-b border-gray-200 dark:border-gray-700 pb-4">
            <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Parte de Trabajo
            </DialogTitle>
          </DialogHeader>
          
          {selectedReport && (
            <div className="py-4 space-y-6">
              {/* Cabecera del documento */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Empleado</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">{selectedReport.employeeName}</p>
                  </div>
                </div>
              </div>

              {/* Información del parte */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
                    <CalendarIcon className="w-4 h-4" />
                    Fecha
                  </div>
                  <p className="text-gray-900 dark:text-white font-medium capitalize">
                    {format(parseISO(selectedReport.reportDate), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
                  </p>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
                    <Clock className="w-4 h-4" />
                    Horario
                  </div>
                  <p className="text-gray-900 dark:text-white font-medium">
                    {selectedReport.startTime} - {selectedReport.endTime}
                    <span className="ml-2 text-blue-600 dark:text-blue-400">
                      ({formatDuration(selectedReport.durationMinutes)})
                    </span>
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
                    <MapPin className="w-4 h-4" />
                    Ubicación
                  </div>
                  <p className="text-gray-900 dark:text-white font-medium">{selectedReport.location}</p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
                    <User className="w-4 h-4" />
                    Cliente
                  </div>
                  <p className="text-gray-900 dark:text-white font-medium">
                    {selectedReport.clientName || 'No especificado'}
                  </p>
                </div>
              </div>

              {/* Descripción del trabajo */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-2">
                  <FileText className="w-4 h-4" />
                  Trabajo realizado
                </div>
                <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{selectedReport.description}</p>
              </div>

              {/* Notas */}
              {selectedReport.notes && (
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border-l-4 border-amber-400">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    <span className="font-medium">Notas:</span> {selectedReport.notes}
                  </p>
                </div>
              )}

              {/* Sección de firmas */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Pen className="w-5 h-5" />
                  Firmas
                </h3>
                <div className="grid grid-cols-2 gap-6">
                  {/* Firma del empleado */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Firma del empleado</p>
                    {selectedReport.employeeSignature ? (
                      <img 
                        src={selectedReport.employeeSignature} 
                        alt="Firma del empleado" 
                        className="max-h-20 w-auto mx-auto dark:invert dark:brightness-90"
                      />
                    ) : (
                      <div className="h-20 flex items-center justify-center">
                        <span className="text-gray-400 text-sm">Sin firma registrada</span>
                      </div>
                    )}
                    <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-2">{selectedReport.employeeName}</p>
                  </div>

                  {/* Firma del cliente */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Firma del cliente</p>
                    {selectedReport.signatureImage ? (
                      <img 
                        src={selectedReport.signatureImage} 
                        alt="Firma del cliente" 
                        className="max-h-20 w-auto mx-auto dark:invert dark:brightness-90"
                      />
                    ) : (
                      <div className="h-20 flex items-center justify-center">
                        <span className="text-gray-400 text-sm">Sin firma del cliente</span>
                      </div>
                    )}
                    <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-2">
                      {selectedReport.signedBy || 'Cliente'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Botón de descarga */}
              <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                  onClick={() => handleDownloadPdf(selectedReport)}
                  disabled={isDownloadingPdf === selectedReport.id}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {isDownloadingPdf === selectedReport.id ? 'Generando...' : 'Descargar PDF'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de edición */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900">
          <DialogHeader className="border-b border-gray-200 dark:border-gray-700 pb-4">
            <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Edit className="w-5 h-5 text-blue-600" />
              Editar Parte de Trabajo
            </DialogTitle>
          </DialogHeader>
          
          {editingReport && (
            <div className="py-4 space-y-4">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400">Empleado</p>
                <p className="font-medium text-gray-900 dark:text-white">{editingReport.employeeName}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fecha</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal bg-white dark:bg-gray-800"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {editFormData.reportDate 
                          ? format(parseISO(editFormData.reportDate), "d 'de' MMMM, yyyy", { locale: es })
                          : "Seleccionar fecha"
                        }
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={editFormData.reportDate ? parseISO(editFormData.reportDate) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            setEditFormData(prev => ({ ...prev, reportDate: format(date, 'yyyy-MM-dd') }));
                          }
                        }}
                        locale={es}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-ref-code">Código ref.</Label>
                  <Input
                    id="edit-ref-code"
                    value={editFormData.refCode}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, refCode: e.target.value }))}
                    placeholder="Ej: OBR-2024-001"
                    className="bg-white dark:bg-gray-800"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-location">Ubicación</Label>
                <Input
                  id="edit-location"
                  value={editFormData.location}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="Ubicación"
                  className="bg-white dark:bg-gray-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-start">Hora inicio</Label>
                  <Input
                    id="edit-start"
                    type="time"
                    value={editFormData.startTime}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, startTime: e.target.value }))}
                    className="bg-white dark:bg-gray-800"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-end">Hora fin</Label>
                  <Input
                    id="edit-end"
                    type="time"
                    value={editFormData.endTime}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, endTime: e.target.value }))}
                    className="bg-white dark:bg-gray-800"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-client">Cliente</Label>
                <Input
                  id="edit-client"
                  value={editFormData.clientName}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, clientName: e.target.value }))}
                  placeholder="Nombre del cliente"
                  className="bg-white dark:bg-gray-800"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Trabajo realizado</Label>
                <Textarea
                  id="edit-description"
                  value={editFormData.description}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descripción del trabajo realizado"
                  rows={4}
                  className="bg-white dark:bg-gray-800"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-notes">Notas adicionales</Label>
                <Textarea
                  id="edit-notes"
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Notas adicionales (opcional)"
                  rows={2}
                  className="bg-white dark:bg-gray-800"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                  variant="outline"
                  onClick={() => setEditModalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  disabled={updateReportMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {updateReportMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
