import { useAuth } from '@/hooks/use-auth';
import { useFeatureCheck } from "@/hooks/use-feature-check";
import FeatureUnavailable from "@/components/feature-unavailable";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { 
  ArrowLeft, 
  Bell, 
  Plus, 
  Search, 
  Calendar,
  Clock,
  AlertTriangle,
  Check,
  Archive,
  Pin,
  Trash2,
  Edit3
} from 'lucide-react';
import { useLocation } from 'wouter';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Reminder {
  id: number;
  title: string;
  content: string;
  scheduledFor: string | null;
  priority: 'low' | 'medium' | 'high';
  color: string;
  isCompleted: boolean;
  isArchived: boolean;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

const priorityLabels = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta'
};

const priorityIcons = {
  low: <Bell className="w-4 h-4" />,
  medium: <Clock className="w-4 h-4" />,
  high: <AlertTriangle className="w-4 h-4" />
};

const colorOptions = [
  { value: 'blue', label: 'Azul', class: 'bg-blue-500' },
  { value: 'green', label: 'Verde', class: 'bg-green-500' },
  { value: 'yellow', label: 'Amarillo', class: 'bg-yellow-500' },
  { value: 'red', label: 'Rojo', class: 'bg-red-500' },
  { value: 'purple', label: 'Morado', class: 'bg-purple-500' },
  { value: 'pink', label: 'Rosa', class: 'bg-pink-500' },
  { value: 'orange', label: 'Naranja', class: 'bg-orange-500' },
  { value: 'gray', label: 'Gris', class: 'bg-gray-500' }
];

export default function EmployeeReminders() {
  const { user, company } = useAuth();
  const { hasAccess } = useFeatureCheck();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('active');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  
  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [color, setColor] = useState('blue');

  const canAccess = hasAccess('reminders');

  if (!canAccess) {
    return <FeatureUnavailable feature="reminders" />;
  }

  // Get reminders
  const { data: reminders = [] } = useQuery<Reminder[]>({
    queryKey: ['/api/reminders'],
    enabled: !!user,
  });

  // Create/Update reminder mutation
  const reminderMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingReminder) {
        return await apiRequest('PATCH', `/api/reminders/${editingReminder.id}`, data);
      } else {
        return await apiRequest('POST', '/api/reminders', data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reminders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reminders/active'] });
      resetForm();
      setDialogOpen(false);
      toast({ 
        title: editingReminder ? 'Recordatorio actualizado' : 'Recordatorio creado',
        description: 'El recordatorio se ha guardado correctamente'
      });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error al guardar recordatorio', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  // Delete reminder mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/reminders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reminders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reminders/active'] });
      toast({ title: 'Recordatorio eliminado' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error al eliminar recordatorio', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  // Toggle reminder status mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: number; field: string; value: boolean }) => {
      return await apiRequest('PATCH', `/api/reminders/${id}`, { [field]: value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reminders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reminders/active'] });
    },
  });

  const resetForm = () => {
    setTitle('');
    setContent('');
    setScheduledFor('');
    setPriority('medium');
    setColor('blue');
    setEditingReminder(null);
  };

  const openEditDialog = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setTitle(reminder.title);
    setContent(reminder.content);
    setScheduledFor(reminder.scheduledFor ? format(new Date(reminder.scheduledFor), 'yyyy-MM-dd\'T\'HH:mm') : '');
    setPriority(reminder.priority);
    setColor(reminder.color);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!title.trim()) {
      toast({
        title: 'Error de validación',
        description: 'El título es obligatorio',
        variant: 'destructive'
      });
      return;
    }

    const data = {
      title: title.trim(),
      content: content.trim(),
      scheduledFor: scheduledFor || null,
      priority,
      color
    };

    reminderMutation.mutate(data);
  };

  const getColorClass = (colorValue: string) => {
    const colorMap: { [key: string]: string } = {
      blue: 'bg-blue-500/20 border-blue-500/40',
      green: 'bg-green-500/20 border-green-500/40',
      yellow: 'bg-yellow-500/20 border-yellow-500/40',
      red: 'bg-red-500/20 border-red-500/40',
      purple: 'bg-purple-500/20 border-purple-500/40',
      pink: 'bg-pink-500/20 border-pink-500/40',
      orange: 'bg-orange-500/20 border-orange-500/40',
      gray: 'bg-gray-500/20 border-gray-500/40'
    };
    return colorMap[colorValue] || colorMap.blue;
  };

  const filteredReminders = reminders.filter(reminder => {
    const matchesSearch = reminder.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         reminder.content.toLowerCase().includes(searchTerm.toLowerCase());
    
    switch (activeTab) {
      case 'active':
        return matchesSearch && !reminder.isCompleted && !reminder.isArchived;
      case 'completed':
        return matchesSearch && reminder.isCompleted && !reminder.isArchived;
      case 'archived':
        return matchesSearch && reminder.isArchived;
      default:
        return matchesSearch;
    }
  });

  const pinnedReminders = filteredReminders.filter(r => r.isPinned);
  const unpinnedReminders = filteredReminders.filter(r => !r.isPinned);

  return (
    <div className="h-screen bg-employee-gradient text-white flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const urlParts = window.location.pathname.split('/').filter(part => part.length > 0);
                const companyAlias = urlParts[0] || company?.companyAlias || 'test';
                setLocation(`/${companyAlias}`);
              }}
              className="text-white hover:bg-white/10"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Recordatorios</h1>
              <p className="text-white/70 text-sm">Organiza tus tareas y recordatorios</p>
            </div>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Nuevo
              </Button>
            </DialogTrigger>
          </Dialog>
        </div>

        <div className="px-6 pb-6">
          {/* Search and tabs */}
          <div className="mt-6 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar recordatorios..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50"
              />
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3 bg-white/10">
                <TabsTrigger value="active" className="data-[state=active]:bg-white/20">
                  Activos ({reminders.filter(r => !r.isCompleted && !r.isArchived).length})
                </TabsTrigger>
                <TabsTrigger value="completed" className="data-[state=active]:bg-white/20">
                  Completados ({reminders.filter(r => r.isCompleted && !r.isArchived).length})
                </TabsTrigger>
                <TabsTrigger value="archived" className="data-[state=active]:bg-white/20">
                  Archivados ({reminders.filter(r => r.isArchived).length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-6">
                {filteredReminders.length === 0 ? (
                  <Card className="bg-white/5 border-white/10">
                    <CardContent className="p-8 text-center">
                      <Bell className="w-12 h-12 text-white/40 mx-auto mb-3" />
                      <p className="text-white/70">
                        {searchTerm 
                          ? 'No se encontraron recordatorios con el término de búsqueda'
                          : `No tienes recordatorios ${activeTab === 'active' ? 'activos' : activeTab === 'completed' ? 'completados' : 'archivados'}`
                        }
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {/* Pinned reminders */}
                    {pinnedReminders.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-white/70 mb-3 flex items-center gap-2">
                          <Pin className="w-4 h-4" />
                          Fijados
                        </h3>
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                          {pinnedReminders.map((reminder) => (
                            <Card 
                              key={reminder.id} 
                              className={`${getColorClass(reminder.color)} border transition-all hover:scale-105`}
                            >
                              <CardHeader className="pb-2">
                                <div className="flex items-start justify-between">
                                  <CardTitle className="text-white text-sm font-medium line-clamp-2">
                                    {reminder.title}
                                  </CardTitle>
                                  <div className="flex gap-1">
                                    {reminder.isPinned && (
                                      <Pin className="w-3 h-3 text-yellow-400 fill-current" />
                                    )}
                                    <Badge 
                                      variant="outline" 
                                      className="text-xs border-white/20 text-white/80"
                                    >
                                      {priorityLabels[reminder.priority]}
                                    </Badge>
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent className="pt-0">
                                {reminder.content && (
                                  <p className="text-white/80 text-sm mb-3 line-clamp-3">
                                    {reminder.content}
                                  </p>
                                )}
                                {reminder.scheduledFor && (
                                  <p className="text-white/60 text-xs mb-3 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {format(new Date(reminder.scheduledFor), 'dd/MM/yyyy HH:mm', { locale: es })}
                                  </p>
                                )}
                                <div className="flex justify-between items-center">
                                  <div className="flex gap-1">
                                    {activeTab === 'active' && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => toggleMutation.mutate({ 
                                          id: reminder.id, 
                                          field: 'isCompleted', 
                                          value: true 
                                        })}
                                        className="h-7 px-2 text-white/70 hover:text-white hover:bg-white/10"
                                      >
                                        <Check className="w-3 h-3" />
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => toggleMutation.mutate({ 
                                        id: reminder.id, 
                                        field: 'isPinned', 
                                        value: !reminder.isPinned 
                                      })}
                                      className="h-7 px-2 text-white/70 hover:text-white hover:bg-white/10"
                                    >
                                      <Pin className={`w-3 h-3 ${reminder.isPinned ? 'fill-current' : ''}`} />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => openEditDialog(reminder)}
                                      className="h-7 px-2 text-white/70 hover:text-white hover:bg-white/10"
                                    >
                                      <Edit3 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => toggleMutation.mutate({ 
                                        id: reminder.id, 
                                        field: 'isArchived', 
                                        value: !reminder.isArchived 
                                      })}
                                      className="h-7 px-2 text-white/70 hover:text-white hover:bg-white/10"
                                    >
                                      <Archive className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => deleteMutation.mutate(reminder.id)}
                                      className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Unpinned reminders */}
                    {unpinnedReminders.length > 0 && (
                      <div>
                        {pinnedReminders.length > 0 && (
                          <h3 className="text-sm font-medium text-white/70 mb-3">
                            Otros
                          </h3>
                        )}
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                          {unpinnedReminders.map((reminder) => (
                            <Card 
                              key={reminder.id} 
                              className={`${getColorClass(reminder.color)} border transition-all hover:scale-105`}
                            >
                              <CardHeader className="pb-2">
                                <div className="flex items-start justify-between">
                                  <CardTitle className="text-white text-sm font-medium line-clamp-2">
                                    {reminder.title}
                                  </CardTitle>
                                  <div className="flex gap-1">
                                    {reminder.isPinned && (
                                      <Pin className="w-3 h-3 text-yellow-400 fill-current" />
                                    )}
                                    <Badge 
                                      variant="outline" 
                                      className="text-xs border-white/20 text-white/80"
                                    >
                                      {priorityLabels[reminder.priority]}
                                    </Badge>
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent className="pt-0">
                                {reminder.content && (
                                  <p className="text-white/80 text-sm mb-3 line-clamp-3">
                                    {reminder.content}
                                  </p>
                                )}
                                {reminder.scheduledFor && (
                                  <p className="text-white/60 text-xs mb-3 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {format(new Date(reminder.scheduledFor), 'dd/MM/yyyy HH:mm', { locale: es })}
                                  </p>
                                )}
                                <div className="flex justify-between items-center">
                                  <div className="flex gap-1">
                                    {activeTab === 'active' && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => toggleMutation.mutate({ 
                                          id: reminder.id, 
                                          field: 'isCompleted', 
                                          value: true 
                                        })}
                                        className="h-7 px-2 text-white/70 hover:text-white hover:bg-white/10"
                                      >
                                        <Check className="w-3 h-3" />
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => toggleMutation.mutate({ 
                                        id: reminder.id, 
                                        field: 'isPinned', 
                                        value: !reminder.isPinned 
                                      })}
                                      className="h-7 px-2 text-white/70 hover:text-white hover:bg-white/10"
                                    >
                                      <Pin className={`w-3 h-3 ${reminder.isPinned ? 'fill-current' : ''}`} />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => openEditDialog(reminder)}
                                      className="h-7 px-2 text-white/70 hover:text-white hover:bg-white/10"
                                    >
                                      <Edit3 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => toggleMutation.mutate({ 
                                        id: reminder.id, 
                                        field: 'isArchived', 
                                        value: !reminder.isArchived 
                                      })}
                                      className="h-7 px-2 text-white/70 hover:text-white hover:bg-white/10"
                                    >
                                      <Archive className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => deleteMutation.mutate(reminder.id)}
                                      className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingReminder ? 'Editar Recordatorio' : 'Nuevo Recordatorio'}
            </DialogTitle>
            <DialogDescription className="text-gray-300">
              {editingReminder ? 'Modifica los detalles del recordatorio' : 'Crea un nuevo recordatorio personalizado'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-white">Título *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título del recordatorio"
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-white">Contenido</label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Descripción detallada (opcional)"
                className="bg-gray-700 border-gray-600 text-white resize-none"
                rows={3}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-white">Programar para</label>
              <Input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-white">Prioridad</label>
                <Select value={priority} onValueChange={(value: 'low' | 'medium' | 'high') => setPriority(value)}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
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
                <label className="text-sm font-medium text-white">Color</label>
                <Select value={color} onValueChange={setColor}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {colorOptions.map((colorOption) => (
                      <SelectItem key={colorOption.value} value={colorOption.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${colorOption.class}`} />
                          {colorOption.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setDialogOpen(false)}
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={!title.trim() || reminderMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {reminderMutation.isPending ? (
                  <>
                    <Clock className="w-4 h-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    {editingReminder ? 'Actualizar' : 'Crear'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}