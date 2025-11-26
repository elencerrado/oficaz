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
  Users
} from 'lucide-react';
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
  status: 'completed' | 'pending' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  employeeName: string;
}

interface Employee {
  id: number;
  fullName: string;
  role: string;
}

const STATUS_STYLES = {
  completed: { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800', text: 'text-green-700 dark:text-green-300', label: 'Completado' },
  pending: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-200 dark:border-yellow-800', text: 'text-yellow-700 dark:text-yellow-300', label: 'Pendiente' },
  cancelled: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-300', label: 'Cancelado' }
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

  const totalMinutes = filteredReports.reduce((sum, r) => sum + r.durationMinutes, 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  const uniqueEmployees = useMemo(() => {
    const names = new Set(reports.map(r => r.employeeName));
    return names.size;
  }, [reports]);

  const completedCount = useMemo(() => {
    return filteredReports.filter(r => r.status === 'completed').length;
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
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredReports.map((report) => {
                const statusStyle = STATUS_STYLES[report.status];
                return (
                  <div 
                    key={report.id} 
                    className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    data-testid={`card-admin-report-${report.id}`}
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-0">
                            <User className="w-3 h-3 mr-1" />
                            {report.employeeName}
                          </Badge>
                          <Badge className={`${statusStyle.bg} ${statusStyle.text} border-0`}>
                            {statusStyle.label}
                          </Badge>
                          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                            <Calendar className="w-4 h-4 mr-1" />
                            {format(parseISO(report.reportDate), 'EEEE, d MMMM yyyy', { locale: es })}
                          </div>
                          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                            <Clock className="w-4 h-4 mr-1" />
                            {report.startTime} - {report.endTime} ({formatDuration(report.durationMinutes)})
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 mt-1 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                          <span className="font-medium text-gray-900 dark:text-white">{report.location}</span>
                        </div>

                        {report.clientName && (
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                            <User className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                            Cliente: {report.clientName}
                          </div>
                        )}

                        <div className="flex items-start gap-2">
                          <FileText className="w-4 h-4 mt-1 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                          <p className="text-gray-700 dark:text-gray-300">{report.description}</p>
                        </div>

                        {report.notes && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 italic pl-6">
                            Notas: {report.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
