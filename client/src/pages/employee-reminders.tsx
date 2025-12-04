import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useFeatureCheck } from '@/hooks/use-feature-check';
import { usePageTitle } from '@/hooks/use-page-title';
import FeatureRestrictedPage from '@/components/feature-restricted-page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';
import { 
  ArrowLeft, 
  Plus, 
  Clock, 
  AlertCircle, 
  Edit, 
  Trash2, 
  Archive,
  Star,
  CheckCircle
} from 'lucide-react';
import { format, isToday, isTomorrow, isPast, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { apiRequest } from '@/lib/queryClient';
import { convertMadridToUTC, convertUTCToMadrid, getMadridDate } from '@/utils/dateUtils';

interface Reminder {
  id: number;
  title: string;
  content?: string;
  reminderDate?: string;
  priority: 'low' | 'medium' | 'high';
  color: string;
  isCompleted: boolean;
  isArchived: boolean;
  isPinned: boolean;
  enableNotifications?: boolean;
  createdAt: string;
  completedByUserIds?: number[];
  // Assignment properties (for assigned reminders)
  isAssigned?: boolean;
  assignedBy?: number;
  assignedAt?: string;
  creatorName?: string;
}

const priorityIcons = {
  low: CheckCircle,
  medium: Clock,
  high: AlertCircle
};

const priorityColors = {
  low: 'text-green-400',
  medium: 'text-yellow-400', 
  high: 'text-red-400'
};

const colorOptions = [
  { value: '#ffffff', name: 'Blanco' },
  { value: '#fef3c7', name: 'Amarillo' },
  { value: '#dbeafe', name: 'Azul' },
  { value: '#d1fae5', name: 'Verde' },
  { value: '#fce7f3', name: 'Rosa' },
  { value: '#e0e7ff', name: 'Púrpura' },
  { value: '#fed7d7', name: 'Rojo' },
];

export default function EmployeeReminders() {
  usePageTitle('Mis Recordatorios');
  const { user, company } = useAuth();
  const { hasAccess } = useFeatureCheck();
  
  const canAccessReminders = hasAccess('reminders');

  // Helper function to check if user completed this reminder individually
  const isCompletedByCurrentUser = (reminder: Reminder): boolean => {
    if (!user) return false;
    const completedByUserIds = reminder.completedByUserIds || [];
    return completedByUserIds.includes(user.id);
  };

  if (!canAccessReminders) {
    return (
      <FeatureRestrictedPage
        featureName="Recordatorios"
        description="No tienes acceso a la funcionalidad de recordatorios. Contacta con el administrador para activar este addon."
        requiredPlan="Addon"
      />
    );
  }
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'archived'>('active');

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    reminderDate: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    color: '#ffffff',
    enableNotifications: false
  });

  // Get all reminders
  const { data: reminders = [], isLoading } = useQuery<Reminder[]>({
    queryKey: ['/api/reminders'],
    enabled: !!user,
  });

  // Create/Update reminder mutation
  const createReminderMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingReminder) {
        return await apiRequest('PATCH', `/api/reminders/${editingReminder.id}`, data);
      }
      return await apiRequest('POST', '/api/reminders', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reminders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reminders/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reminders/check-notifications'] });
      setIsDialogOpen(false);
      setEditingReminder(null);
      setFormData({ title: '', content: '', reminderDate: '', priority: 'medium', color: '#ffffff', enableNotifications: false });
      if (!editingReminder) {
        toast({
          title: "Recordatorio creado",
          description: "Se ha creado un nuevo recordatorio",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al procesar el recordatorio",
        variant: "destructive",
      });
    },
  });

  // Delete reminder mutation
  const deleteReminderMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/reminders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reminders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reminders/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reminders/check-notifications'] });
      toast({
        title: "Recordatorio eliminado",
        description: "El recordatorio se ha eliminado correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al eliminar el recordatorio",
        variant: "destructive",
      });
    },
  });

  // Update status mutation (for archiving and completing)
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: { isArchived?: boolean; isCompleted?: boolean } }) => {
      return await apiRequest('PATCH', `/api/reminders/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reminders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reminders/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reminders/check-notifications'] });
    },
  });

  // Complete reminder individually
  const completeReminderMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('POST', `/api/reminders/${id}/complete-individual`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reminders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reminders/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reminders/check-notifications'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al completar el recordatorio",
        variant: "destructive",
      });
    },
  });

  // Toggle pin mutation
  const togglePinMutation = useMutation({
    mutationFn: async ({ id, isPinned }: { id: number; isPinned: boolean }) => {
      return await apiRequest('PATCH', `/api/reminders/${id}`, { isPinned });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reminders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reminders/check-notifications'] });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast({
        title: "Error",
        description: "El título es obligatorio",
        variant: "destructive",
      });
      return;
    }

    // Convert Madrid time to UTC for storage
    let processedDate = null;
    if (formData.reminderDate && formData.reminderDate !== '') {
      try {
        processedDate = convertMadridToUTC(formData.reminderDate);
      } catch (error) {
        toast({
          title: "Error",
          description: "Fecha inválida. Por favor, selecciona una fecha válida.",
          variant: "destructive",
        });
        return;
      }
    }

    const submitData = {
      ...formData,
      reminderDate: processedDate
    };

    createReminderMutation.mutate(submitData);
  };

  const handleEdit = (reminder: Reminder) => {
    setEditingReminder(reminder);
    
    // Convert UTC date back to Madrid time for datetime-local input
    let localDateTimeString = '';
    if (reminder.reminderDate) {
      localDateTimeString = convertUTCToMadrid(reminder.reminderDate);
    }
    
    setFormData({
      title: reminder.title,
      content: reminder.content || '',
      reminderDate: localDateTimeString,
      priority: reminder.priority,
      color: reminder.color,
      enableNotifications: reminder.enableNotifications || false
    });
    setIsDialogOpen(true);
  };

  const formatReminderDate = (dateString: string) => {
    // Validate date string
    if (!dateString || dateString.trim() === '') {
      return 'Sin fecha';
    }
    
    try {
      // Convert UTC to Madrid time for display
      const date = getMadridDate(dateString);
      const timeStr = format(date, 'HH:mm', { locale: es });
      
      if (isToday(date)) return `Hoy ${timeStr}`;
      if (isTomorrow(date)) return `Mañana ${timeStr}`;
      if (isPast(date)) return `Hace ${formatDistanceToNow(date, { locale: es })}`;
      return format(date, 'dd/MM/yyyy HH:mm', { locale: es });
    } catch (error) {
      console.error('Error formatting reminder date:', error, 'Input:', dateString);
      return 'Fecha inválida';
    }
  };

  // Filter reminders - protect against null data
  const filteredReminders = (reminders || []).filter(reminder => {
    const matchesSearch = reminder.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (reminder.content || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const userCompleted = isCompletedByCurrentUser(reminder);
    
    const matchesStatus = 
      statusFilter === 'all' ||
      (statusFilter === 'active' && !userCompleted && !reminder.isArchived) ||
      (statusFilter === 'completed' && userCompleted) ||
      (statusFilter === 'archived' && reminder.isArchived);
    
    return matchesSearch && matchesStatus;
  });

  // Sort reminders: pinned first, then by date
  const sortedReminders = [...filteredReminders].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    
    if (a.reminderDate && b.reminderDate) {
      return getMadridDate(a.reminderDate).getTime() - getMadridDate(b.reminderDate).getTime();
    }
    if (a.reminderDate && !b.reminderDate) return -1;
    if (!a.reminderDate && b.reminderDate) return 1;
    
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const companyAlias = company?.companyAlias || 'test';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-employee-gradient text-gray-900 dark:text-white flex flex-col page-scroll">
      {/* Header - Standard employee pattern */}
      <div className="flex items-center justify-between p-6 pb-8 h-20">
        <Link href={`/${companyAlias}/inicio`}>
          <Button
            variant="ghost"
            size="lg"
            className="text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-white/20 px-6 py-3 rounded-xl bg-gray-100 dark:bg-white/10 backdrop-blur-sm transition-all duration-200 border border-gray-300 dark:border-white/20"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            <span className="font-medium">Atrás</span>
          </Button>
        </Link>
        
        <div className="flex-1 flex flex-col items-end text-right">
          {/* Mostrar logo solo si tiene logo Y función habilitada en super admin */}
          {company?.logoUrl && hasAccess('logoUpload') ? (
            <img 
              src={company.logoUrl} 
              alt={company.name} 
              className="h-8 w-auto mb-1 object-contain filter dark:brightness-0 dark:invert"
            />
          ) : (
            <div className="text-gray-900 dark:text-white text-sm font-medium mb-1">
              {company?.name || 'Mi Empresa'}
            </div>
          )}
          <div className="text-gray-600 dark:text-white/70 text-xs">
            {user?.fullName}
          </div>
        </div>
      </div>

      {/* Page title */}
      <div className="px-6 pb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Recordatorios</h1>
        <p className="text-gray-600 dark:text-white/70 text-sm">Gestiona tus recordatorios personales</p>
      </div>

      {/* Search and Filters */}
      <div className="px-6 pb-4 space-y-3">
        <Input
          placeholder="Buscar recordatorios..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-white dark:bg-white/10 border-gray-200 dark:border-white/20 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-white/50"
        />
        
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
            <SelectTrigger className="bg-white dark:bg-white/10 border-gray-200 dark:border-white/20 text-gray-900 dark:text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="completed">Completados</SelectItem>
              <SelectItem value="archived">Archivados</SelectItem>
            </SelectContent>
          </Select>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="bg-gray-200 dark:bg-white/20 hover:bg-gray-300 dark:hover:bg-white/30 text-gray-900 dark:text-white border-gray-200 dark:border-white/20"
                onClick={() => {
                  setEditingReminder(null);
                  setFormData({ title: '', content: '', reminderDate: '', priority: 'medium', color: '#ffffff', enableNotifications: false });
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nuevo
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white">
              <DialogHeader>
                <DialogTitle className="text-gray-900 dark:text-white">
                  {editingReminder ? 'Editar Recordatorio' : 'Nuevo Recordatorio'}
                </DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Input
                    placeholder="Título del recordatorio"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                
                <div>
                  <Textarea
                    placeholder="Contenido (opcional)"
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white min-h-[80px]"
                  />
                </div>
                
                <div>
                  <Input
                    type="datetime-local"
                    value={formData.reminderDate}
                    onChange={(e) => setFormData({ ...formData, reminderDate: e.target.value })}
                    className="bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white"
                  />
                </div>

                {/* Checkbox para activar notificaciones - solo si hay fecha */}
                {formData.reminderDate && (
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="enableNotifications"
                      checked={formData.enableNotifications}
                      onChange={(e) => setFormData({ ...formData, enableNotifications: e.target.checked })}
                      className="rounded border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="enableNotifications" className="text-gray-900 dark:text-white text-sm">
                      Mostrar notificación cuando llegue la fecha
                    </label>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Select value={formData.priority} onValueChange={(value: any) => setFormData({ ...formData, priority: value })}>
                      <SelectTrigger className="bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Baja</SelectItem>
                        <SelectItem value="medium">Media</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Select value={formData.color} onValueChange={(value) => setFormData({ ...formData, color: value })}>
                      <SelectTrigger className="bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white">
                        <SelectValue>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-4 h-4 rounded border"
                              style={{ backgroundColor: formData.color }}
                            />
                            Color
                          </div>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {colorOptions.map((color) => (
                          <SelectItem key={color.value} value={color.value}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-4 h-4 rounded border"
                                style={{ backgroundColor: color.value }}
                              />
                              {color.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button 
                    type="submit" 
                    disabled={createReminderMutation.isPending}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white dark:text-white"
                  >
                    {createReminderMutation.isPending ? 'Guardando...' : (editingReminder ? 'Actualizar' : 'Crear')}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Reminders List */}
      <div className="flex-1 px-6 pb-6">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="text-gray-600 dark:text-white/70">Cargando recordatorios...</div>
          </div>
        ) : sortedReminders.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-gray-300 dark:text-white/30 mx-auto mb-4" />
            <div className="text-gray-600 dark:text-white/70 mb-2">No hay recordatorios</div>
            <div className="text-gray-500 dark:text-white/50 text-sm">
              {statusFilter === 'all' ? 'Crea tu primer recordatorio' : `No hay recordatorios ${statusFilter === 'active' ? 'activos' : statusFilter === 'completed' ? 'completados' : 'archivados'}`}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedReminders.map((reminder) => {
              const PriorityIcon = priorityIcons[reminder.priority];
              const isOverdue = reminder.reminderDate && isPast(getMadridDate(reminder.reminderDate)) && !reminder.isCompleted && !reminder.isArchived;
              
              return (
                <div
                  key={reminder.id}
                  className="relative rounded-lg p-4 shadow-md border border-gray-200 dark:border-white/10 backdrop-blur-sm bg-white dark:bg-transparent"
                  style={{ backgroundColor: reminder.color === '#ffffff' ? undefined : `${reminder.color}15` }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {reminder.isPinned && (
                          <Star className="h-4 w-4 text-yellow-400 fill-current" />
                        )}
                        <PriorityIcon className={`h-4 w-4 ${priorityColors[reminder.priority]}`} />
                        <h3 className="font-medium text-gray-900 dark:text-white text-sm">{reminder.title}</h3>
                      </div>
                      
                      {reminder.content && (
                        <p className="text-gray-600 dark:text-white/70 text-xs mb-2 line-clamp-2">{reminder.content}</p>
                      )}
                      
                      <div className="flex items-center gap-2 flex-wrap">
                        {reminder.reminderDate && (
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${isOverdue ? 'border-red-400 text-red-400' : 'border-gray-300 dark:border-white/30 text-gray-600 dark:text-white/70'}`}
                          >
                            <Clock className="h-3 w-3 mr-1" />
                            {formatReminderDate(reminder.reminderDate)}
                          </Badge>
                        )}
                        
                        <Badge 
                          variant="outline" 
                          className={`text-xs cursor-pointer transition-colors ${
                            reminder.isArchived 
                              ? 'border-gray-400/30 text-gray-400/70' 
                              : isCompletedByCurrentUser(reminder)
                                ? 'border-green-400/50 text-green-400 hover:border-green-400 hover:bg-green-400/10'
                                : 'border-gray-300 dark:border-white/30 text-gray-600 dark:text-white/70'
                          }`}
                          onClick={() => {
                            if (!reminder.isArchived && isCompletedByCurrentUser(reminder)) {
                              // Reactivar recordatorio completado
                              updateStatusMutation.mutate({ 
                                id: reminder.id, 
                                updates: { isCompleted: false } 
                              });
                            }
                          }}
                        >
                          {reminder.isArchived ? 'Archivado' : 
                           isCompletedByCurrentUser(reminder) ? 'Completado' : 'Activo'}
                        </Badge>
                        
                        {reminder.isAssigned && (
                          <Badge 
                            variant="outline" 
                            className="text-xs border-blue-400 text-blue-400"
                          >
                            Asignado{reminder.creatorName ? ` por ${reminder.creatorName}` : ''}
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-row gap-1 ml-2">
                      {/* Solo los empleados pueden hacer pin en sus recordatorios propios */}
                      {!reminder.isAssigned && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => togglePinMutation.mutate({ id: reminder.id, isPinned: !reminder.isPinned })}
                          className="h-8 w-8 p-0 text-gray-500 dark:text-white/60 hover:text-yellow-400 hover:bg-gray-100 dark:hover:bg-white/10"
                        >
                          <Star className={`h-4 w-4 ${reminder.isPinned ? 'fill-current text-yellow-400' : ''}`} />
                        </Button>
                      )}
                      
                      {/* Solo editar recordatorios propios, no asignados */}
                      {!reminder.isAssigned && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(reminder)}
                          className="h-8 w-8 p-0 text-gray-500 dark:text-white/60 hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-white/10"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      
                      {/* Completar recordatorios (tanto propios como asignados) */}
                      {!isCompletedByCurrentUser(reminder) && !reminder.isArchived && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => completeReminderMutation.mutate(reminder.id)}
                          className="h-8 w-8 p-0 text-gray-500 dark:text-white/60 hover:text-green-400 hover:bg-gray-100 dark:hover:bg-white/10"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                      
                      {/* Archivar recordatorios (tanto propios como asignados) */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => updateStatusMutation.mutate({ id: reminder.id, updates: { isArchived: true } })}
                        className="h-8 w-8 p-0 text-gray-500 dark:text-white/60 hover:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                      
                      {/* Solo borrar recordatorios propios, no asignados */}
                      {!reminder.isAssigned && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteReminderMutation.mutate(reminder.id)}
                          className="h-8 w-8 p-0 text-gray-500 dark:text-white/60 hover:text-red-400 hover:bg-gray-100 dark:hover:bg-white/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}