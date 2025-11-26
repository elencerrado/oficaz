import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { usePageTitle } from '@/hooks/use-page-title';
import { FeatureRestrictedPage } from '@/components/feature-restricted-page';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { getAuthHeaders } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('this-month');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [isExporting, setIsExporting] = useState(false);

  const getDateRange = () => {
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
  };

  const { startDate, endDate } = getDateRange();

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['/api/employees'],
    enabled: isAuthenticated && !authLoading
  });

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (employeeFilter !== 'all') params.append('employeeId', employeeFilter);
    return params.toString() ? `?${params.toString()}` : '';
  };
  
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

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
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

  return (
    <div className="px-6 py-4 min-h-screen bg-gray-50 dark:bg-gray-900" style={{ overflowX: 'clip' }}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Partes de Trabajo</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Visualiza y exporta los partes de trabajo de todos los empleados</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Buscar por empleado, ubicación, cliente o descripción..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-admin-search-reports"
          />
        </div>
        <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
          <SelectTrigger className="w-[200px]" data-testid="select-employee-filter">
            <Users className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filtrar por empleado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los empleados</SelectItem>
            {employees.map((emp) => (
              <SelectItem key={emp.id} value={emp.id.toString()}>{emp.fullName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-admin-date-filter">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filtrar por fecha" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoy</SelectItem>
            <SelectItem value="this-week">Esta semana</SelectItem>
            <SelectItem value="this-month">Este mes</SelectItem>
            <SelectItem value="all">Todo</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => exportToFormat('pdf')}
            disabled={isExporting || filteredReports.length === 0}
            data-testid="button-export-pdf"
          >
            <Download className="w-4 h-4 mr-2" />
            PDF
          </Button>
          <Button 
            variant="outline" 
            onClick={() => exportToFormat('excel')}
            disabled={isExporting || filteredReports.length === 0}
            data-testid="button-export-excel"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Excel
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-white dark:bg-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Partes</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{filteredReports.length}</p>
              </div>
              <ClipboardList className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Horas Totales</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {totalHours}h {remainingMinutes > 0 ? `${remainingMinutes}m` : ''}
                </p>
              </div>
              <Clock className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Empleados Activos</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{uniqueEmployees}</p>
              </div>
              <Users className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Completados</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {filteredReports.filter(r => r.status === 'completed').length}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {reportsLoading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <LoadingSpinner size="lg" />
          <p className="text-gray-500 dark:text-gray-400">Cargando partes de trabajo...</p>
        </div>
      ) : filteredReports.length === 0 ? (
        <Card className="bg-white dark:bg-gray-800">
          <CardContent className="py-12 text-center">
            <ClipboardList className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {searchTerm || employeeFilter !== 'all' ? 'No se encontraron partes' : 'Sin partes de trabajo'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {searchTerm || employeeFilter !== 'all' 
                ? 'Intenta con otros filtros de búsqueda' 
                : 'Los empleados aún no han registrado partes de trabajo en este período'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredReports.map((report) => {
            const statusStyle = STATUS_STYLES[report.status];
            return (
              <Card 
                key={report.id} 
                className={`bg-white dark:bg-gray-800 border ${statusStyle.border} hover:shadow-md transition-shadow`}
                data-testid={`card-admin-report-${report.id}`}
              >
                <CardContent className="p-4">
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
                        <MapPin className="w-4 h-4 mt-1 text-gray-400 flex-shrink-0" />
                        <span className="font-medium text-gray-900 dark:text-white">{report.location}</span>
                      </div>

                      {report.clientName && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                          <User className="w-4 h-4 text-gray-400" />
                          Cliente: {report.clientName}
                        </div>
                      )}

                      <div className="flex items-start gap-2">
                        <FileText className="w-4 h-4 mt-1 text-gray-400 flex-shrink-0" />
                        <p className="text-gray-700 dark:text-gray-300">{report.description}</p>
                      </div>

                      {report.notes && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 italic pl-6">
                          Notas: {report.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
