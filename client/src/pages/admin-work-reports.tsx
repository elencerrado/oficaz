import { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { usePageTitle } from '@/hooks/use-page-title';
import { usePageHeader } from '@/components/layout/page-header';
import { FeatureRestrictedPage } from '@/components/feature-restricted-page';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { getAuthHeaders } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import StatsCard from '@/components/StatsCard';
import { cn } from '@/lib/utils';
import { 
  ClipboardList, 
  Clock, 
  MapPin,
  Calendar,
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
  Pen
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface WorkReportWithEmployee {
  id: number;
  companyId: number;
  employeeId: number;
  reportDate: string;
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

export default function AdminWorkReportsPage() {
  usePageTitle('Partes de Trabajo - Admin');
  const { user, isAuthenticated, isLoading: authLoading, subscription } = useAuth();
  const { setHeader, resetHeader } = usePageHeader();
  const { toast } = useToast();

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
    enabled: isAuthenticated && !authLoading
  });

  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (employeeFilter !== 'all') params.append('employeeId', employeeFilter);
    return params.toString() ? `?${params.toString()}` : '';
  }, [startDate, endDate, employeeFilter]);
  
  const { data: reports = [], isLoading: reportsLoading } = useQuery<WorkReportWithEmployee[]>({
    queryKey: [`/api/admin/work-reports${buildQueryParams()}`],
    enabled: isAuthenticated && !authLoading
  });

  const filteredReports = useMemo(() => {
    return reports.filter(report => {
      const matchesSearch = searchTerm === '' || 
        report.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (report.clientName && report.clientName.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesSearch;
    });
  }, [reports, searchTerm]);

  const handleTodayFilter = useCallback(() => {
    if (activeStatsFilter === 'today') {
      setActiveStatsFilter(null);
      setDateFilter('all');
    } else {
      setActiveStatsFilter('today');
      setDateFilter('today');
    }
  }, [activeStatsFilter]);

  const handleThisWeekFilter = useCallback(() => {
    if (activeStatsFilter === 'week') {
      setActiveStatsFilter(null);
      setDateFilter('all');
    } else {
      setActiveStatsFilter('week');
      setDateFilter('this-week');
    }
  }, [activeStatsFilter]);

  const handleThisMonthFilter = useCallback(() => {
    if (activeStatsFilter === 'month') {
      setActiveStatsFilter(null);
      setDateFilter('all');
    } else {
      setActiveStatsFilter('month');
      setDateFilter('this-month');
    }
  }, [activeStatsFilter]);

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

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}min`;
  };

  const handleViewReport = (report: WorkReportWithEmployee) => {
    setSelectedReport(report);
    setViewModalOpen(true);
  };

  const handleDownloadPdf = async (report: WorkReportWithEmployee) => {
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
  };

  const totalMinutes = filteredReports.reduce((sum, r) => sum + r.durationMinutes, 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  const uniqueEmployees = useMemo(() => {
    const names = new Set(reports.map(r => r.employeeName));
    return names.size;
  }, [reports]);

  const completedCount = useMemo(() => {
    return filteredReports.filter(r => r.status === 'submitted').length;
  }, [filteredReports]);

  const getFilterTitle = () => {
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
  };

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
          value={`${totalHours}h${remainingMinutes > 0 ? ` ${remainingMinutes}m` : ''}`}
          color="green"
          icon={Clock}
          onClick={handleTodayFilter}
          isActive={activeStatsFilter === 'today'}
        />
        
        <StatsCard
          title="Empleados"
          subtitle="Activos"
          value={uniqueEmployees}
          color="purple"
          icon={Users}
          onClick={handleThisWeekFilter}
          isActive={activeStatsFilter === 'week'}
        />
        
        <StatsCard
          title="Completados"
          subtitle="Partes"
          value={completedCount}
          color="green"
          icon={CheckCircle}
        />
      </div>

      {/* Filters & List Card */}
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader className="border-b border-gray-200 dark:border-gray-700">
          <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
            <span className="text-sm sm:text-lg font-medium text-gray-900 dark:text-white">{getFilterTitle()} ({filteredReports.length})</span>
            
            {/* Desktop: buttons grouped together */}
            <div className="hidden sm:flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Filter className="w-4 h-4" />
                Filtros
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => exportToFormat('pdf')}
                disabled={isExporting || filteredReports.length === 0}
                className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                data-testid="button-export-pdf"
              >
                <Download className="w-4 h-4 mr-2" />
                PDF
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => exportToFormat('excel')}
                disabled={isExporting || filteredReports.length === 0}
                className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                data-testid="button-export-excel"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Excel
              </Button>
            </div>

            {/* Mobile: buttons in single row */}
            <div className="sm:hidden grid grid-cols-3 gap-2 w-full">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center justify-center gap-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
              >
                <Filter className="w-4 h-4" />
                <span className="text-xs">Filtros</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => exportToFormat('pdf')}
                disabled={isExporting || filteredReports.length === 0}
                className="flex items-center justify-center gap-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
              >
                <Download className="w-4 h-4" />
                <span className="text-xs">PDF</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => exportToFormat('excel')}
                disabled={isExporting || filteredReports.length === 0}
                className="flex items-center justify-center gap-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span className="text-xs">Excel</span>
              </Button>
            </div>
          </CardTitle>
        </CardHeader>

        {/* Collapsible Filters */}
        {showFilters && (
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-end">
              <div className="flex flex-col space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Buscar</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Buscar por empleado, ubicación..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-10 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    data-testid="input-admin-search-reports"
                  />
                </div>
              </div>
              <div className="flex flex-col space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Empleado</label>
                <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                  <SelectTrigger className="h-10 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white" data-testid="select-employee-filter">
                    <Users className="w-4 h-4 mr-2 text-gray-500" />
                    <SelectValue placeholder="Filtrar por empleado" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                    <SelectItem value="all" className="text-gray-900 dark:text-white">Todos los empleados</SelectItem>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id.toString()} className="text-gray-900 dark:text-white">{emp.fullName}</SelectItem>
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
                    className={cn(
                      "h-10 text-xs font-normal flex-1",
                      dateFilter !== 'today' && "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    )}
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
                    className={cn(
                      "h-10 text-xs font-normal flex-1",
                      dateFilter !== 'this-week' && "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    )}
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
                    className={cn(
                      "h-10 text-xs font-normal flex-1",
                      dateFilter !== 'this-month' && "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    )}
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
                    className={cn(
                      "h-10 text-xs font-normal flex-1",
                      dateFilter !== 'all' && "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    )}
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
          ) : (
            <div className="p-4 md:p-6 space-y-4">
              {filteredReports.map((report) => {
                const statusStyle = STATUS_STYLES[report.status];
                return (
                  <div 
                    key={report.id} 
                    className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                    data-testid={`card-admin-report-${report.id}`}
                  >
                    <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800">
                      <div className="flex items-center gap-2 text-white">
                        <User className="w-4 h-4" />
                        <span className="font-semibold">{report.employeeName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`${statusStyle.bg} ${statusStyle.text} border-0`}>
                          {statusStyle.label}
                        </Badge>
                        <button
                          onClick={() => handleViewReport(report)}
                          className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors text-white"
                          title="Ver parte completo"
                          data-testid={`button-view-report-${report.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownloadPdf(report)}
                          disabled={isDownloadingPdf === report.id}
                          className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors text-white disabled:opacity-50"
                          title="Descargar PDF"
                          data-testid={`button-download-pdf-${report.id}`}
                        >
                          <Download className={`w-4 h-4 ${isDownloadingPdf === report.id ? 'animate-pulse' : ''}`} />
                        </button>
                      </div>
                    </div>
                    
                    <div className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-2">
                          <div>
                            <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-xs mb-0.5">
                              <Calendar className="w-3.5 h-3.5" />
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
                        
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-2">
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

                        <div className="md:col-span-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
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
          )}
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
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-4 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-80">Empleado</p>
                    <p className="text-lg font-bold">{selectedReport.employeeName}</p>
                  </div>
                  <Badge className={`${STATUS_STYLES[selectedReport.status].bg} ${STATUS_STYLES[selectedReport.status].text} border-0 text-sm`}>
                    {STATUS_STYLES[selectedReport.status].label}
                  </Badge>
                </div>
              </div>

              {/* Información del parte */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
                    <Calendar className="w-4 h-4" />
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
                      <div className="bg-white dark:bg-gray-800 rounded border border-gray-100 dark:border-gray-600 p-2">
                        <img 
                          src={selectedReport.employeeSignature} 
                          alt="Firma del empleado" 
                          className="max-h-20 w-auto mx-auto dark:invert dark:brightness-90"
                        />
                      </div>
                    ) : (
                      <div className="h-20 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center">
                        <span className="text-gray-400 text-sm">Sin firma registrada</span>
                      </div>
                    )}
                    <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-2">{selectedReport.employeeName}</p>
                  </div>

                  {/* Firma del cliente */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Firma del cliente</p>
                    {selectedReport.signatureImage ? (
                      <div className="bg-white dark:bg-gray-800 rounded border border-gray-100 dark:border-gray-600 p-2">
                        <img 
                          src={selectedReport.signatureImage} 
                          alt="Firma del cliente" 
                          className="max-h-20 w-auto mx-auto dark:invert dark:brightness-90"
                        />
                      </div>
                    ) : (
                      <div className="h-20 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center">
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
    </div>
  );
}
