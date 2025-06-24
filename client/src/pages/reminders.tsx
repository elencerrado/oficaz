import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Bell, 
  Plus, 
  Clock, 
  Pin, 
  Archive, 
  Trash2, 
  Calendar,
  AlertCircle,
  CheckCircle,
  Edit,
  X,
  Search,
  Filter
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { format, isToday, isTomorrow, isPast, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

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
  createdAt: string;
  updatedAt: string;
}

const PRIORITY_COLORS = {
  low: 'bg-green-50 border-green-200 text-green-800',
  medium: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  high: 'bg-red-50 border-red-200 text-red-800'
};

const REMINDER_COLORS = [
  '#ffffff', '#f8f9fa', '#fff3cd', '#d4edda', '#d1ecf1', '#f8d7da', '#e2e3e5',
  '#fef7e0', '#e8f5e8', '#e1f5fe', '#fce4ec', '#f3e5f5', '#e0f2f1'
];

export default function Reminders() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed' | 'archived'>('active');
  const [selectedColor, setSelectedColor] = useState('#ffffff');
  
  const [reminderData, setReminderData] = useState({
    title: '',
    content: '',
    reminderDate: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    color: '#ffffff'
  });

  // Fetch reminders
  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ['/api/reminders'],
    retry: false,
  });

  // Create reminder mutation
  const createReminderMutation = useMutation({
    mutationFn: async (data: typeof reminderData) => {
      return await apiRequest('POST', '/api/reminders', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reminders'] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "Recordatorio creado",
        description: "El recordatorio se ha guardado correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el recordatorio",
        variant: "destructive",
      });
    },
  });

  // Update reminder mutation
  const updateReminderMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Reminder> }) => {
      return await apiRequest('PATCH', `/api/reminders/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reminders'] });
      setEditingReminder(null);
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "Recordatorio actualizado",
        description: "Los cambios se han guardado correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el recordatorio",
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
      toast({
        title: "Recordatorio eliminado",
        description: "El recordatorio se ha eliminado correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el recordatorio",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setReminderData({
      title: '',
      content: '',
      reminderDate: '',
      priority: 'medium',
      color: '#ffffff'
    });
    setSelectedColor('#ffffff');
    setEditingReminder(null);
  };

  const handleSubmit = () => {
    if (!reminderData.title.trim()) {
      toast({
        title: "Error",
        description: "El título es obligatorio",
        variant: "destructive",
      });
      return;
    }

    let processedDate = null;
    if (reminderData.reminderDate && reminderData.reminderDate !== '') {
      // Create date from datetime-local input string
      // This should preserve the time as intended by the user
      const inputParts = reminderData.reminderDate.split('T');
      const datePart = inputParts[0];
      const timePart = inputParts[1];
      
      // User input is in local timezone (Madrid), convert to UTC for storage
      // Use the browser's built-in timezone handling
      processedDate = new Date(reminderData.reminderDate).toISOString();
      
      console.log('Date processing (automatic timezone):', {
        input: reminderData.reminderDate,
        finalISO: processedDate
      });
    }

    const submitData = {
      ...reminderData,
      color: selectedColor,
      reminderDate: processedDate
    };

    // Remove undefined values to avoid issues
    Object.keys(submitData).forEach(key => {
      if (submitData[key] === undefined) {
        delete submitData[key];
      }
    });

    if (editingReminder) {
      updateReminderMutation.mutate({ id: editingReminder.id, data: submitData });
    } else {
      createReminderMutation.mutate(submitData);
    }
  };

  const handleEdit = (reminder: Reminder) => {
    setEditingReminder(reminder);
    
    // Convert UTC date back to local datetime-local format
    let localDateTimeString = '';
    if (reminder.reminderDate) {
      const reminderDate = new Date(reminder.reminderDate);
      // Extract components as Madrid local time
      const year = reminderDate.getFullYear();
      const month = String(reminderDate.getMonth() + 1).padStart(2, '0');
      const day = String(reminderDate.getDate()).padStart(2, '0');
      const hour = String(reminderDate.getHours()).padStart(2, '0');
      const minute = String(reminderDate.getMinutes()).padStart(2, '0');
      
      localDateTimeString = `${year}-${month}-${day}T${hour}:${minute}`;
      
      console.log('Edit date conversion (manual):', {
        originalUTC: reminder.reminderDate,
        reminderDate: reminderDate.toString(),
        extractedParts: { year, month, day, hour, minute },
        inputValue: localDateTimeString
      });
    }
    
    setReminderData({
      title: reminder.title,
      content: reminder.content || '',
      reminderDate: localDateTimeString,
      priority: reminder.priority,
      color: reminder.color
    });
    setSelectedColor(reminder.color);
    setIsDialogOpen(true);
  };

  const toggleComplete = (reminder: Reminder) => {
    updateReminderMutation.mutate({
      id: reminder.id,
      data: { isCompleted: !reminder.isCompleted }
    });
  };

  const togglePin = (reminder: Reminder) => {
    updateReminderMutation.mutate({
      id: reminder.id,
      data: { isPinned: !reminder.isPinned }
    });
  };

  const toggleArchive = (reminder: Reminder) => {
    updateReminderMutation.mutate({
      id: reminder.id,
      data: { isArchived: !reminder.isArchived }
    });
  };

  const formatReminderDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) return 'Hoy';
    if (isTomorrow(date)) return 'Mañana';
    if (isPast(date)) return `Hace ${formatDistanceToNow(date, { locale: es })}`;
    return format(date, 'dd/MM/yyyy HH:mm', { locale: es });
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'medium': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'low': return <CheckCircle className="w-4 h-4 text-green-500" />;
      default: return null;
    }
  };

  // Filter reminders
  const filteredReminders = reminders.filter((reminder: Reminder) => {
    const matchesSearch = reminder.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         reminder.content?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = 
      filterStatus === 'all' ||
      (filterStatus === 'active' && !reminder.isCompleted && !reminder.isArchived) ||
      (filterStatus === 'completed' && reminder.isCompleted) ||
      (filterStatus === 'archived' && reminder.isArchived);

    return matchesSearch && matchesFilter;
  });

  // Sort reminders: pinned first, then by date
  const sortedReminders = filteredReminders.sort((a: Reminder, b: Reminder) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    if (a.reminderDate && b.reminderDate) {
      return new Date(a.reminderDate).getTime() - new Date(b.reminderDate).getTime();
    }
    if (a.reminderDate) return -1;
    if (b.reminderDate) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
                <Bell className="w-6 h-6" />
                Mis Recordatorios
              </h1>
              <p className="text-gray-500 mt-1">Organiza tus tareas y recordatorios</p>
            </div>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm} className="bg-oficaz-primary hover:bg-oficaz-primary/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo Recordatorio
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingReminder ? 'Editar Recordatorio' : 'Nuevo Recordatorio'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingReminder ? 'Modifica los detalles del recordatorio' : 'Crea un nuevo recordatorio para organizarte mejor'}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div>
                    <Label htmlFor="title">Título *</Label>
                    <Input
                      id="title"
                      value={reminderData.title}
                      onChange={(e) => setReminderData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Ej: Reunión con cliente"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="content">Descripción</Label>
                    <Textarea
                      id="content"
                      value={reminderData.content}
                      onChange={(e) => setReminderData(prev => ({ ...prev, content: e.target.value }))}
                      placeholder="Detalles adicionales del recordatorio..."
                      rows={3}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="reminderDate">Fecha y hora</Label>
                    <Input
                      id="reminderDate"
                      type="datetime-local"
                      value={reminderData.reminderDate}
                      onChange={(e) => {
                        console.log('Date input changed:', e.target.value);
                        setReminderData(prev => ({ ...prev, reminderDate: e.target.value }));
                      }}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="priority">Prioridad</Label>
                    <Select value={reminderData.priority} onValueChange={(value: any) => setReminderData(prev => ({ ...prev, priority: value }))}>
                      <SelectTrigger className="mt-1">
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
                    <Label>Color</Label>
                    <div className="grid grid-cols-7 gap-2 mt-2">
                      {REMINDER_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`w-8 h-8 rounded-full border-2 transition-all ${
                            selectedColor === color ? 'border-gray-400 scale-110' : 'border-gray-200'
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => setSelectedColor(color)}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={createReminderMutation.isPending || updateReminderMutation.isPending}
                  >
                    {editingReminder ? 'Actualizar' : 'Crear'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Buscar recordatorios..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
            <SelectTrigger className="w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="completed">Completados</SelectItem>
              <SelectItem value="archived">Archivados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Reminders Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : sortedReminders.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay recordatorios</h3>
            <p className="text-gray-500 mb-4">
              {searchTerm ? 'No se encontraron recordatorios que coincidan con tu búsqueda' : 'Crea tu primer recordatorio para empezar a organizarte'}
            </p>
            <Button onClick={() => setIsDialogOpen(true)} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Crear Recordatorio
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedReminders.map((reminder: Reminder) => (
              <Card
                key={reminder.id}
                className={`transition-all hover:shadow-md ${
                  reminder.isCompleted ? 'opacity-75' : ''
                } ${reminder.isArchived ? 'opacity-60' : ''}`}
                style={{ backgroundColor: reminder.color }}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {reminder.isPinned && <Pin className="w-4 h-4 text-gray-600" />}
                      {getPriorityIcon(reminder.priority)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(reminder)}
                        className="h-6 w-6 p-0"
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => togglePin(reminder)}
                        className="h-6 w-6 p-0"
                      >
                        <Pin className={`w-3 h-3 ${reminder.isPinned ? 'text-blue-500' : 'text-gray-400'}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleArchive(reminder)}
                        className="h-6 w-6 p-0"
                      >
                        <Archive className={`w-3 h-3 ${reminder.isArchived ? 'text-gray-600' : 'text-gray-400'}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteReminderMutation.mutate(reminder.id)}
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <CardTitle className={`text-sm font-medium ${reminder.isCompleted ? 'line-through' : ''}`}>
                    {reminder.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {reminder.content && (
                    <p className={`text-sm text-gray-600 mb-3 ${reminder.isCompleted ? 'line-through' : ''}`}>
                      {reminder.content}
                    </p>
                  )}
                  
                  {reminder.reminderDate && (
                    <div className="flex items-center gap-1 mb-3">
                      <Calendar className="w-3 h-3 text-gray-500" />
                      <span className={`text-xs text-gray-500 ${
                        isPast(new Date(reminder.reminderDate)) && !reminder.isCompleted 
                          ? 'text-red-500 font-medium' 
                          : ''
                      }`}>
                        {formatReminderDate(reminder.reminderDate)}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className={`text-xs ${PRIORITY_COLORS[reminder.priority]}`}>
                      {reminder.priority === 'high' ? 'Alta' : reminder.priority === 'medium' ? 'Media' : 'Baja'}
                    </Badge>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleComplete(reminder)}
                      className={`h-6 px-2 text-xs ${
                        reminder.isCompleted 
                          ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      {reminder.isCompleted ? 'Completado' : 'Marcar como hecho'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}