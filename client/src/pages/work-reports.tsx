import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFeatureCheck } from '@/hooks/use-feature-check';
import { usePageTitle } from '@/hooks/use-page-title';
import { FeatureRestrictedPage } from '@/components/feature-restricted-page';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ClipboardList, 
  Plus, 
  Clock, 
  MapPin,
  Calendar,
  Edit,
  Trash2,
  Search,
  Filter,
  User,
  FileText,
  CheckCircle
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface WorkReport {
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
}

const STATUS_STYLES = {
  completed: { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800', text: 'text-green-700 dark:text-green-300', label: 'Completado' },
  pending: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-200 dark:border-yellow-800', text: 'text-yellow-700 dark:text-yellow-300', label: 'Pendiente' },
  cancelled: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-300', label: 'Cancelado' }
};

export default function WorkReportsPage() {
  usePageTitle('Partes de Trabajo');
  const { user, company, isAuthenticated, isLoading: authLoading, subscription } = useAuth();
  const { hasAccess } = useFeatureCheck();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<WorkReport | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('this-month');

  const [formData, setFormData] = useState({
    reportDate: format(new Date(), 'yyyy-MM-dd'),
    location: '',
    startTime: '09:00',
    endTime: '17:00',
    description: '',
    clientName: '',
    notes: '',
    status: 'completed' as 'completed' | 'pending' | 'cancelled'
  });

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

  const queryParams = startDate || endDate 
    ? `?${new URLSearchParams({ ...(startDate && { startDate }), ...(endDate && { endDate }) }).toString()}`
    : '';
  
  const { data: reports = [], isLoading: reportsLoading } = useQuery<WorkReport[]>({
    queryKey: [`/api/work-reports${queryParams}`],
    enabled: isAuthenticated && !authLoading
  });

  const filteredReports = useMemo(() => {
    return reports.filter(report => {
      const matchesSearch = searchTerm === '' || 
        report.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (report.clientName && report.clientName.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesSearch;
    });
  }, [reports, searchTerm]);

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest('POST', '/api/work-reports', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => (query.queryKey[0] as string).startsWith('/api/work-reports') });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({ title: 'Parte creado', description: 'El parte de trabajo se ha creado correctamente.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'No se pudo crear el parte.', variant: 'destructive' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      return apiRequest('PATCH', `/api/work-reports/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => (query.queryKey[0] as string).startsWith('/api/work-reports') });
      setIsEditDialogOpen(false);
      setSelectedReport(null);
      resetForm();
      toast({ title: 'Parte actualizado', description: 'El parte de trabajo se ha actualizado correctamente.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'No se pudo actualizar el parte.', variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/work-reports/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => (query.queryKey[0] as string).startsWith('/api/work-reports') });
      setIsDeleteDialogOpen(false);
      setSelectedReport(null);
      toast({ title: 'Parte eliminado', description: 'El parte de trabajo se ha eliminado correctamente.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'No se pudo eliminar el parte.', variant: 'destructive' });
    }
  });

  const resetForm = () => {
    setFormData({
      reportDate: format(new Date(), 'yyyy-MM-dd'),
      location: '',
      startTime: '09:00',
      endTime: '17:00',
      description: '',
      clientName: '',
      notes: '',
      status: 'completed'
    });
  };

  const openEditDialog = (report: WorkReport) => {
    setSelectedReport(report);
    setFormData({
      reportDate: report.reportDate,
      location: report.location,
      startTime: report.startTime,
      endTime: report.endTime,
      description: report.description,
      clientName: report.clientName || '',
      notes: report.notes || '',
      status: report.status
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (report: WorkReport) => {
    setSelectedReport(report);
    setIsDeleteDialogOpen(true);
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
        description="Registra y gestiona los partes de trabajo de tus empleados con esta funcionalidad exclusiva del plan Pro." 
        requiredPlan="Pro" 
      />
    );
  }

  return (
    <div className="px-6 py-4 min-h-screen bg-gray-50 dark:bg-gray-900" style={{ overflowX: 'clip' }}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Partes de Trabajo</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Registra y gestiona tus partes de trabajo diarios</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Buscar por ubicación, cliente o descripción..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-reports"
          />
        </div>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-date-filter">
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
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setIsCreateDialogOpen(true); }} data-testid="button-new-report">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Parte
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nuevo Parte de Trabajo</DialogTitle>
              <DialogDescription>Registra un nuevo parte de trabajo con los detalles de la visita.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="reportDate">Fecha</Label>
                  <Input
                    id="reportDate"
                    type="date"
                    value={formData.reportDate}
                    onChange={(e) => setFormData({ ...formData, reportDate: e.target.value })}
                    data-testid="input-report-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Estado</Label>
                  <Select value={formData.status} onValueChange={(v: 'completed' | 'pending' | 'cancelled') => setFormData({ ...formData, status: v })}>
                    <SelectTrigger data-testid="select-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="completed">Completado</SelectItem>
                      <SelectItem value="pending">Pendiente</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Ubicación *</Label>
                <Input
                  id="location"
                  placeholder="Dirección o nombre del lugar"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  data-testid="input-location"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startTime">Hora inicio *</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    data-testid="input-start-time"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">Hora fin *</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    data-testid="input-end-time"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientName">Cliente</Label>
                <Input
                  id="clientName"
                  placeholder="Nombre del cliente (opcional)"
                  value={formData.clientName}
                  onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                  data-testid="input-client-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descripción del trabajo *</Label>
                <Textarea
                  id="description"
                  placeholder="Describe las tareas realizadas..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  data-testid="textarea-description"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notas adicionales</Label>
                <Textarea
                  id="notes"
                  placeholder="Observaciones o notas (opcional)"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  data-testid="textarea-notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} data-testid="button-cancel-create">
                Cancelar
              </Button>
              <Button 
                onClick={() => createMutation.mutate(formData)}
                disabled={createMutation.isPending || !formData.location || !formData.description}
                data-testid="button-submit-create"
              >
                {createMutation.isPending ? 'Creando...' : 'Crear Parte'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
                <p className="text-sm text-gray-500 dark:text-gray-400">Horas Trabajadas</p>
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
              {searchTerm ? 'No se encontraron partes' : 'Sin partes de trabajo'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {searchTerm 
                ? 'Intenta con otros términos de búsqueda' 
                : 'Crea tu primer parte de trabajo para empezar a registrar tus visitas'}
            </p>
            {!searchTerm && (
              <Button onClick={() => { resetForm(); setIsCreateDialogOpen(true); }} data-testid="button-empty-new-report">
                <Plus className="w-4 h-4 mr-2" />
                Crear Parte
              </Button>
            )}
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
                data-testid={`card-report-${report.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
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

                    <div className="flex gap-2 md:flex-shrink-0">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => openEditDialog(report)}
                        data-testid={`button-edit-${report.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => openDeleteDialog(report)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        data-testid={`button-delete-${report.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Parte de Trabajo</DialogTitle>
            <DialogDescription>Modifica los detalles del parte de trabajo.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-reportDate">Fecha</Label>
                <Input
                  id="edit-reportDate"
                  type="date"
                  value={formData.reportDate}
                  onChange={(e) => setFormData({ ...formData, reportDate: e.target.value })}
                  data-testid="input-edit-report-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-status">Estado</Label>
                <Select value={formData.status} onValueChange={(v: 'completed' | 'pending' | 'cancelled') => setFormData({ ...formData, status: v })}>
                  <SelectTrigger data-testid="select-edit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed">Completado</SelectItem>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-location">Ubicación *</Label>
              <Input
                id="edit-location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                data-testid="input-edit-location"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-startTime">Hora inicio *</Label>
                <Input
                  id="edit-startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  data-testid="input-edit-start-time"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-endTime">Hora fin *</Label>
                <Input
                  id="edit-endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  data-testid="input-edit-end-time"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-clientName">Cliente</Label>
              <Input
                id="edit-clientName"
                value={formData.clientName}
                onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                data-testid="input-edit-client-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Descripción del trabajo *</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                data-testid="textarea-edit-description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notas adicionales</Label>
              <Textarea
                id="edit-notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                data-testid="textarea-edit-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} data-testid="button-cancel-edit">
              Cancelar
            </Button>
            <Button 
              onClick={() => selectedReport && updateMutation.mutate({ id: selectedReport.id, data: formData })}
              disabled={updateMutation.isPending || !formData.location || !formData.description}
              data-testid="button-submit-edit"
            >
              {updateMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Parte de Trabajo</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que quieres eliminar este parte de trabajo? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          {selectedReport && (
            <div className="py-4">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
                <p className="font-medium text-gray-900 dark:text-white">{selectedReport.location}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {format(parseISO(selectedReport.reportDate), 'd MMMM yyyy', { locale: es })} - {selectedReport.startTime} a {selectedReport.endTime}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} data-testid="button-cancel-delete">
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              onClick={() => selectedReport && deleteMutation.mutate(selectedReport.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
