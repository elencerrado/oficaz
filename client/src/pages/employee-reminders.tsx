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
import { 
  Plus, 
  Clock, 
  AlertCircle, 
  Edit, 
  Trash2, 
  Archive,
  Star,
  CheckCircle,
  Save,
  X
} from 'lucide-react';
import { format, isToday, isTomorrow, isPast, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { apiRequest } from '@/lib/queryClient';
import { convertMadridToUTC, convertUTCToMadrid, getMadridDate } from '@/utils/dateUtils';
import { EmployeeTopBar } from '@/components/employee/employee-top-bar';

interface Reminder {
  id: number;
  title: string;
  content?: string;
  reminderDate?: string;
  priority: 'low' | 'medium' | 'high';
  color: string;
  taskStatus?: 'pending' | 'in_progress' | 'on_hold' | 'completed';
  contextType?: 'general' | 'project' | 'area';
  contextName?: string;
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
  responsibleUserId?: number;
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

const taskStatusOptions = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'in_progress', label: 'En curso' },
  { value: 'on_hold', label: 'En espera' },
] as const;

const taskStatusColors = {
  pending: 'border-slate-200 text-slate-600',
  in_progress: 'border-blue-200 text-blue-600',
  on_hold: 'border-orange-200 text-orange-600',
  completed: 'border-green-200 text-green-700',
};

const STATUS_TRIGGER_COLORS: Record<string, string> = {
  on_hold:    'bg-orange-50 border border-orange-300 text-orange-700 hover:bg-orange-100',
  in_progress:'bg-blue-50   border border-blue-300   text-blue-700   hover:bg-blue-100',
  completed:  'bg-green-50  border border-green-300  text-green-700  hover:bg-green-100',
};

const cardStatusOptions = [
  { value: 'on_hold', label: 'En espera' },
  { value: 'in_progress', label: 'En proceso' },
  { value: 'completed', label: 'Completado' },
] as const;

const contextTypeLabels = {
  general: 'General',
  project: 'Proyecto',
  area: 'Area',
};

export default function EmployeeReminders() {
  usePageTitle('Mis Tareas');
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
        featureName="Tareas"
        description="No tienes acceso a la funcionalidad de tareas. Contacta con el administrador para activar este addon."
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
    enableNotifications: false,
    taskStatus: 'pending' as 'pending' | 'in_progress' | 'on_hold',
    contextType: 'general' as 'general' | 'project' | 'area',
    contextName: '',
  });

  // Get all reminders
  const { data: reminders = [], isLoading } = useQuery<Reminder[]>({
    queryKey: ['/api/reminders'],
    enabled: !!user,
    staleTime: 60_000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
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
      setFormData({ title: '', content: '', reminderDate: '', priority: 'medium', color: '#ffffff', enableNotifications: false, taskStatus: 'pending', contextType: 'general', contextName: '' });
      if (!editingReminder) {
        toast({
          title: "Tarea creada",
          description: "Se ha creado una nueva tarea",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al procesar la tarea",
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
        title: "Tarea eliminada",
        description: "La tarea se ha eliminado correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al eliminar la tarea",
        variant: "destructive",
      });
    },
  });

  // Update status mutation (for archiving and completing)
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: { isArchived?: boolean; isCompleted?: boolean; taskStatus?: 'pending' | 'in_progress' | 'on_hold' | 'completed' } }) => {
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
        description: error.message || "Error al completar la tarea",
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
      enableNotifications: reminder.enableNotifications || false,
      taskStatus: reminder.taskStatus === 'completed' ? 'pending' : (reminder.taskStatus || 'pending'),
      contextType: reminder.contextType || 'general',
      contextName: reminder.contextName || ''
    });
    setIsDialogOpen(true);
  };

  const getTaskStatusLabel = (status?: Reminder['taskStatus']) => {
    if (status === 'completed') return 'Completado';
    return taskStatusOptions.find((option) => option.value === status)?.label || 'Pendiente';
  };

  const getCardStatusValue = (reminder: Reminder): 'on_hold' | 'in_progress' | 'completed' => {
    if (isCompletedByCurrentUser(reminder)) return 'completed';
    if (reminder.taskStatus === 'in_progress') return 'in_progress';
    return 'on_hold';
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
      // console.error('Error formatting reminder date:', error, 'Input:', dateString);
      return 'Fecha inválida';
    }
  };

  // Filter reminders - protect against null data
  const filteredReminders = (reminders || []).filter(reminder => {
    const matchesSearch = reminder.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (reminder.content || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (reminder.contextName || '').toLowerCase().includes(searchTerm.toLowerCase());
    
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
      <EmployeeTopBar homeHref={`/${companyAlias}/inicio`} />

      {/* Page title */}
      <div className="px-6 pb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Tareas</h1>
        <p className="text-gray-600 dark:text-white/70 text-sm">Gestiona tus tareas personales</p>
      </div>

      {/* Search and Filters */}
      <div className="px-6 pb-4 space-y-3">
        <Input
          placeholder="Buscar tareas..."
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
                  setFormData({ title: '', content: '', reminderDate: '', priority: 'medium', color: '#ffffff', enableNotifications: false, taskStatus: 'pending', contextType: 'general', contextName: '' });
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nuevo
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden border-0 bg-background">
              <DialogTitle className="sr-only">{editingReminder ? 'Editar Tarea' : 'Nueva Tarea'}</DialogTitle>

              {/* Colored header preview */}
              <div
                className="px-6 py-4 relative"
                style={{ backgroundColor: formData.color !== '#ffffff' ? formData.color : '#F1F5F9' }}
              >
                <div className="absolute inset-0 bg-black/5" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-600 opacity-70" />
                    <span className="text-xs text-gray-600 font-medium uppercase tracking-wide">
                      {editingReminder ? 'Editar Tarea' : 'Nueva Tarea'}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mt-0.5">
                    {formData.title || 'Sin título'}
                  </h3>
                  {formData.contextName && (
                    <span className="text-xs text-gray-600">{formData.contextName}</span>
                  )}
                </div>
              </div>

              <div className="flex">
                {/* Left: color swatches */}
                <div className="w-14 bg-muted/20 p-2 flex flex-col gap-1.5 pt-3 border-r border-border">
                  {colorOptions.map((col, index) => (
                    <button
                      type="button"
                      key={col.value}
                      onClick={() => setFormData(prev => ({ ...prev, color: col.value }))}
                      className={`w-10 h-7 rounded border-2 transition-all hover:scale-105 ${
                        formData.color === col.value
                          ? 'border-gray-700 dark:border-gray-200 scale-105 shadow-md'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                      style={{ backgroundColor: col.value }}
                      title={col.name}
                    />
                  ))}

                  <div className="mt-auto pt-2 border-t border-border/60 flex flex-col gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 rounded-xl border border-red-200 bg-red-50 text-red-600 shadow-sm transition-colors hover:bg-red-100 hover:text-red-700"
                      onClick={() => setIsDialogOpen(false)}
                      title="Cancelar"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <Button
                      type="submit"
                      form="employee-task-form"
                      size="icon"
                      className="h-10 w-10 rounded-xl border border-green-200 bg-green-50 text-green-600 shadow-sm transition-colors hover:bg-green-100 hover:text-green-700"
                      disabled={createReminderMutation.isPending}
                      title={editingReminder ? 'Actualizar tarea' : 'Guardar tarea'}
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Right: form */}
                <form id="employee-task-form" onSubmit={handleSubmit} className="flex-1 p-5 space-y-3 overflow-y-auto max-h-[70vh]">
                  {/* Title */}
                  <input
                    type="text"
                    placeholder="Título de la tarea *"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    className="w-full px-3 py-2 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                  />

                  {/* Row: Estado + Prioridad */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Estado</label>
                      <Select value={formData.taskStatus} onValueChange={(value: any) => setFormData({ ...formData, taskStatus: value })}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {taskStatusOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Prioridad</label>
                      <Select value={formData.priority} onValueChange={(value: any) => setFormData({ ...formData, priority: value })}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Baja</SelectItem>
                          <SelectItem value="medium">Media</SelectItem>
                          <SelectItem value="high">Alta</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Row: Organizar como + Nombre contexto */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Organizar como</label>
                      <Select value={formData.contextType} onValueChange={(value: any) => setFormData({ ...formData, contextType: value })}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="general">General</SelectItem>
                          <SelectItem value="project">Proyecto</SelectItem>
                          <SelectItem value="area">Area</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        {formData.contextType === 'project' ? 'Nombre del proyecto' : formData.contextType === 'area' ? 'Nombre del área' : 'Contexto (opcional)'}
                      </label>
                      <input
                        type="text"
                        placeholder={formData.contextType === 'project' ? 'Ej: Cliente Repsol' : formData.contextType === 'area' ? 'Ej: Administración' : 'Opcional'}
                        value={formData.contextName}
                        onChange={(e) => setFormData({ ...formData, contextName: e.target.value })}
                        className="w-full px-3 py-1.5 text-xs border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 h-8"
                      />
                    </div>
                  </div>

                  {/* Fecha */}
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Fecha y hora</label>
                    <input
                      type="datetime-local"
                      value={formData.reminderDate}
                      onChange={(e) => setFormData({ ...formData, reminderDate: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 h-8"
                    />
                  </div>

                  {/* Notificación si hay fecha */}
                  {formData.reminderDate && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.enableNotifications}
                        onChange={(e) => setFormData({ ...formData, enableNotifications: e.target.checked })}
                        className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                      />
                      <span className="text-xs text-muted-foreground">Mostrar notificación cuando llegue la fecha</span>
                    </label>
                  )}

                  {/* Description */}
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Descripción</label>
                    <textarea
                      placeholder="Contenido (opcional)"
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 text-xs border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                    />
                  </div>

                </form>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Reminders List */}
      <div className="flex-1 px-6 pb-6">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="text-muted-foreground">Cargando tareas...</div>
          </div>
        ) : sortedReminders.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <div className="text-foreground mb-2">No hay tareas</div>
            <div className="text-muted-foreground text-sm">
              {statusFilter === 'all' ? 'Crea tu primera tarea' : `No hay tareas ${statusFilter === 'active' ? 'activas' : statusFilter === 'completed' ? 'completadas' : 'archivadas'}`}
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

                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        {!reminder.isArchived ? (
                          <Select
                            value={getCardStatusValue(reminder)}
                            onValueChange={(value: 'on_hold' | 'in_progress' | 'completed') => {
                              if (value === 'completed') {
                                if (!isCompletedByCurrentUser(reminder)) {
                                  completeReminderMutation.mutate(reminder.id);
                                }
                                return;
                              }

                              const updates: { taskStatus: 'on_hold' | 'in_progress'; isCompleted?: boolean } = {
                                taskStatus: value,
                              };
                              if (isCompletedByCurrentUser(reminder)) {
                                updates.isCompleted = false;
                              }
                              updateStatusMutation.mutate({ id: reminder.id, updates });
                            }}
                          >
                            <SelectTrigger
                              className={`h-6 pl-2.5 pr-1.5 gap-1 text-xs font-medium rounded-full border w-auto focus:ring-0 focus:ring-offset-0 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:shrink-0 [&>svg]:opacity-60 ${
                                STATUS_TRIGGER_COLORS[getCardStatusValue(reminder)] ?? STATUS_TRIGGER_COLORS['on_hold']
                              }`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {cardStatusOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline" className="text-xs border-gray-400/30 text-gray-400/70">
                            Archivado
                          </Badge>
                        )}
                        {reminder.contextName && (
                          <Badge variant="outline" className="text-xs border-gray-300 dark:border-white/20 text-gray-600 dark:text-white/70">
                            {contextTypeLabels[reminder.contextType || 'general']}: {reminder.contextName}
                          </Badge>
                        )}
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