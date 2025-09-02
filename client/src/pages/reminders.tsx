import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFeatureCheck } from '@/hooks/use-feature-check';
import FeatureRestrictedPage from '@/components/feature-restricted-page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  Filter,
  Users
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
  showBanner: boolean;
  createdAt: string;
  updatedAt: string;
  userId?: number;
  userFullName?: string;
  assignedUserIds?: number[];
  assignedBy?: number;
  assignedAt?: string;
}

interface Employee {
  id: number;
  fullName: string;
  email: string;
  role: string;
  position?: string;
  profilePicture?: string;
}

const PRIORITY_COLORS = {
  low: 'bg-green-50 border-green-200 text-green-800',
  medium: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  high: 'bg-red-50 border-red-200 text-red-800'
};

const REMINDER_COLORS = [
  '#FFB3BA', // Coral red
  '#FFE4B5', // Warm peach  
  '#FFFFCC', // Light yellow
  '#C8E6C9', // Soft green
  '#BBDEFB', // Sky blue
  '#E1BEE7', // Lavender purple
  '#F8BBD9'  // Rose pink
];

// Component to display assigned user avatars with a limit
const AssignedUsersAvatars = ({ assignedUserIds, employees, maxDisplay = 3, currentUserId, completedByUserIds }: {
  assignedUserIds?: number[];
  employees: Employee[];
  maxDisplay?: number;
  currentUserId?: number;
  completedByUserIds?: number[];
}) => {
  if (!assignedUserIds?.length) return null;

  // Filter out the current user from assigned users - they don't need to see themselves as "assigned"
  const filteredAssignedIds = assignedUserIds.filter(id => id !== currentUserId);
  if (!filteredAssignedIds.length) return null;

  const assignedEmployees = employees.filter(emp => filteredAssignedIds.includes(emp.id));
  const displayEmployees = assignedEmployees.slice(0, maxDisplay);
  const remainingCount = assignedEmployees.length - maxDisplay;

  // Generate consistent colors for each user based on their ID
  const getAvatarColor = (userId: number) => {
    const colors = [
      'bg-red-100 text-red-700',
      'bg-blue-100 text-blue-700', 
      'bg-green-100 text-green-700',
      'bg-yellow-100 text-yellow-700',
      'bg-purple-100 text-purple-700',
      'bg-pink-100 text-pink-700',
      'bg-indigo-100 text-indigo-700',
      'bg-gray-100 text-gray-700'
    ];
    return colors[userId % colors.length];
  };

  return (
    <div className="flex items-center -space-x-1 mt-2">
      {displayEmployees.map((employee) => {
        const isCompleted = completedByUserIds?.includes(employee.id) || false;
        return (
          <Avatar 
            key={employee.id} 
            className={`w-5 h-5 border-2 shadow-sm hover:scale-110 transition-transform cursor-pointer ${
              isCompleted ? 'border-green-500' : 'border-white'
            }`}
            title={`${employee.fullName}${isCompleted ? ' (Completado)' : ''}`}
          >
            <AvatarImage 
              src={employee.profilePicture ? `/uploads/${employee.profilePicture}` : undefined} 
              alt={employee.fullName}
              className="object-cover"
            />
            <AvatarFallback className={`text-[10px] font-medium ${getAvatarColor(employee.id)}`}>
              {employee.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        );
      })}
      
      {remainingCount > 0 && (
        <div 
          className="w-5 h-5 rounded-full bg-gray-100 border-2 border-white shadow-sm flex items-center justify-center hover:scale-110 transition-transform cursor-pointer"
          title={`+${remainingCount} más`}
        >
          <span className="text-[9px] text-gray-600 font-bold">+{remainingCount}</span>
        </div>
      )}
    </div>
  );
};

export default function Reminders() {
  const { user } = useAuth();
  const { hasAccess } = useFeatureCheck();
  
  const canAccessReminders = hasAccess('reminders');

  if (!canAccessReminders) {
    return (
      <FeatureRestrictedPage
        featureName="Recordatorios"
        description="Tu plan actual no incluye la funcionalidad de recordatorios. Contacta con el administrador para actualizar tu plan."
        requiredPlan="Pro"
      />
    );
  }
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed' | 'archived'>('active');
  const [selectedColor, setSelectedColor] = useState('#ffffff');
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedReminderForAssignment, setSelectedReminderForAssignment] = useState<Reminder | null>(null);
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  const [assignDialogSearchTerm, setAssignDialogSearchTerm] = useState('');
  
  const [reminderData, setReminderData] = useState({
    title: '',
    content: '',
    reminderDate: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    color: '#ffffff',
    showBanner: false,
    assignedUserIds: [] as number[]
  });

  // Fetch reminders
  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ['/api/reminders'],
    retry: false,
    select: (data) => {
      // Ensure reminders data is an array
      if (!data || !Array.isArray(data)) return [];
      return data;
    }
  });

  // Fetch employees for assignment (only for admins/managers)
  const { data: employees = [], isLoading: employeesLoading, error: employeesError } = useQuery<Employee[]>({
    queryKey: ['/api/users/employees'],
    enabled: user?.role === 'admin' || user?.role === 'manager',
    select: (data) => {
      // Ensure employees data is an array
      if (!data || !Array.isArray(data)) return [];
      return data;
    }
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

  // Assign reminder mutation
  const assignReminderMutation = useMutation({
    mutationFn: async ({ reminderId, userIds }: { reminderId: number; userIds: number[] }) => {
      return await apiRequest('POST', `/api/reminders/${reminderId}/assign`, { assignedUserIds: userIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reminders'] });
      setIsAssignDialogOpen(false);
      setSelectedReminderForAssignment(null);
      setSelectedEmployees([]);
      toast({
        title: "Recordatorio asignado",
        description: "El recordatorio se ha asignado correctamente a los empleados seleccionados",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo asignar el recordatorio",
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
      color: '#FFB3BA',
      showBanner: false,
      assignedUserIds: []
    });
    setSelectedColor('#FFB3BA');
    setEditingReminder(null);
    setEmployeeSearchTerm('');
  };

  const handleAssignReminder = (reminder: Reminder) => {
    console.log('handleAssignReminder called', reminder);
    setSelectedReminderForAssignment(reminder);
    setSelectedEmployees(reminder.assignedUserIds || []);
    setAssignDialogSearchTerm('');
    setIsAssignDialogOpen(true);
  };

  const handleEmployeeToggle = (employeeId: number) => {
    setSelectedEmployees(prev => 
      prev.includes(employeeId) 
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const handleAssignSubmit = async () => {
    if (!selectedReminderForAssignment) return;

    try {
      await assignReminderMutation.mutateAsync({
        reminderId: selectedReminderForAssignment.id,
        userIds: selectedEmployees
      });
      setIsAssignDialogOpen(false);
      toast({
        title: "Recordatorio asignado",
        description: (() => {
          const countWithoutCurrentUser = selectedEmployees.filter(id => id !== user?.id).length;
          return countWithoutCurrentUser > 0 ? 
            `Se ha asignado a ${countWithoutCurrentUser} empleado${countWithoutCurrentUser !== 1 ? 's' : ''}` :
            'Recordatorio asignado solo a ti';
        })(),
      });
    } catch (error) {
      console.error('Error assigning reminder:', error);
      toast({
        title: "Error",
        description: "No se pudo asignar el recordatorio",
        variant: "destructive"
      });
    }
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
      reminderDate: processedDate // null when empty, ISO string when has date
    };

    if (editingReminder) {
      updateReminderMutation.mutate({ id: editingReminder.id, data: submitData as any });
    } else {
      createReminderMutation.mutate(submitData as any);
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
      color: reminder.color,
      showBanner: reminder.showBanner || false,
      assignedUserIds: Array.isArray(reminder.assignedUserIds) ? reminder.assignedUserIds : []
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
    const timeStr = format(date, 'HH:mm', { locale: es });
    
    if (isToday(date)) return `Hoy ${timeStr}`;
    if (isTomorrow(date)) return `Mañana ${timeStr}`;
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

  // Filter reminders - protect against null data
  const filteredReminders = React.useMemo(() => {
    if (!Array.isArray(reminders)) return [];
    
    return reminders.filter((reminder: Reminder) => {
      // Safely handle null/undefined fields
      const title = reminder.title || '';
      const content = reminder.content || '';
      
      const matchesSearch = title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           content.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesFilter = 
        filterStatus === 'all' ||
        (filterStatus === 'active' && !reminder.isCompleted && !reminder.isArchived) ||
        (filterStatus === 'completed' && reminder.isCompleted) ||
        (filterStatus === 'archived' && reminder.isArchived);

      return matchesSearch && matchesFilter;
    });
  }, [reminders, searchTerm, filterStatus]);

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
    <div className="px-6 py-4 min-h-screen bg-background" style={{ overflowX: 'clip' }}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Gestión de Recordatorios</h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">
          Organiza tus tareas y recordatorios para mantenerte al día.
        </p>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="bg-oficaz-primary hover:bg-oficaz-primary/90 whitespace-nowrap hidden">
              <Plus className="w-4 h-4 mr-2" />
              Crear
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

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="showBanner"
                      checked={reminderData.showBanner}
                      onCheckedChange={(checked) => 
                        setReminderData(prev => ({ ...prev, showBanner: checked as boolean }))
                      }
                    />
                    <Label htmlFor="showBanner" className="text-sm font-medium">
                      Mostrar aviso
                    </Label>
                    <div className="text-xs text-muted-foreground ml-2">
                      (Solo si tiene fecha configurada)
                    </div>
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

                  {/* Assignment section - only for admins/managers */}
                  {(user?.role === 'admin' || user?.role === 'manager') && (
                    <div>
                      <Label>Asignar a empleados</Label>
                      
                      {/* Employee search */}
                      <div className="relative mt-2">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                        <Input
                          placeholder="Buscar empleados..."
                          value={employeeSearchTerm}
                          onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                          className="pl-10 text-sm"
                        />
                      </div>
                      
                      <div className="mt-2 space-y-2 max-h-32 overflow-y-auto border rounded-md p-2">
                        {employees
                          .filter(emp => emp.id !== user?.id)
                          .filter(emp => 
                            employeeSearchTerm === '' || 
                            emp.fullName.toLowerCase().includes(employeeSearchTerm.toLowerCase())
                          )
                          .map((employee) => (
                          <div key={employee.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`form-employee-${employee.id}`}
                              checked={reminderData.assignedUserIds.includes(employee.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setReminderData(prev => ({
                                    ...prev,
                                    assignedUserIds: [...prev.assignedUserIds, employee.id]
                                  }));
                                } else {
                                  setReminderData(prev => ({
                                    ...prev,
                                    assignedUserIds: prev.assignedUserIds.filter(id => id !== employee.id)
                                  }));
                                }
                              }}
                            />
                            <label
                              htmlFor={`form-employee-${employee.id}`}
                              className="flex-1 cursor-pointer text-sm font-medium leading-none"
                            >
                              {employee.fullName}
                            </label>
                          </div>
                        ))}
                        
                        {employees
                          .filter(emp => emp.id !== user?.id)
                          .filter(emp => 
                            employeeSearchTerm === '' || 
                            emp.fullName.toLowerCase().includes(employeeSearchTerm.toLowerCase())
                          ).length === 0 && employeeSearchTerm !== '' && (
                          <div className="text-center py-2 text-muted-foreground text-sm">
                            No se encontraron empleados
                          </div>
                        )}
                      </div>
                      
                      {reminderData.assignedUserIds.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {(() => {
                            const countWithoutCurrentUser = reminderData.assignedUserIds.filter(id => id !== user?.id).length;
                            return countWithoutCurrentUser > 0 ? 
                              `${countWithoutCurrentUser} empleado${countWithoutCurrentUser !== 1 ? 's' : ''} seleccionado${countWithoutCurrentUser !== 1 ? 's' : ''}` :
                              'Solo tú estás asignado a este recordatorio';
                          })()}
                        </div>
                      )}
                    </div>
                  )}
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
          <Button 
            onClick={() => {
              resetForm();
              setIsDialogOpen(true);
            }} 
            className="bg-oficaz-primary hover:bg-oficaz-primary/90 whitespace-nowrap"
          >
            <Plus className="w-4 h-4 mr-2" />
            Crear
          </Button>
        </div>

        {/* Reminders Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : sortedReminders.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-lg shadow-sm">
            <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No hay recordatorios</h3>
            <p className="text-muted-foreground mb-4">
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
                      {reminder.isPinned && <Pin className="w-4 h-4 text-gray-700 dark:text-gray-800" />}
                      {getPriorityIcon(reminder.priority)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(reminder)}
                        className="h-6 w-6 p-0 hover:bg-black/10"
                      >
                        <Edit className="w-3 h-3 text-gray-700" />
                      </Button>
                      {(user?.role === 'admin' || user?.role === 'manager') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAssignReminder(reminder)}
                          className="h-6 w-6 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-100/50"
                          title="Asignar a empleados"
                        >
                          <Users className="w-3 h-3" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => togglePin(reminder)}
                        className="h-6 w-6 p-0 hover:bg-black/10"
                      >
                        <Pin className={`w-3 h-3 ${reminder.isPinned ? 'text-blue-600' : 'text-gray-600'}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleArchive(reminder)}
                        className="h-6 w-6 p-0 hover:bg-black/10"
                      >
                        <Archive className={`w-3 h-3 ${reminder.isArchived ? 'text-gray-700' : 'text-gray-600'}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteReminderMutation.mutate(reminder.id)}
                        className="h-6 w-6 p-0 text-red-600 hover:text-red-800 hover:bg-red-100/50"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <CardTitle className={`text-sm font-medium text-gray-900 dark:text-gray-900 ${reminder.isCompleted ? 'line-through' : ''}`}>
                    {reminder.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {reminder.content && (
                    <p className={`text-sm text-gray-700 dark:text-gray-800 mb-3 ${reminder.isCompleted ? 'line-through' : ''}`}>
                      {reminder.content}
                    </p>
                  )}
                  
                  {reminder.reminderDate && (
                    <div className="flex items-center gap-1 mb-3">
                      <Calendar className="w-3 h-3 text-gray-600 dark:text-gray-700" />
                      <span className={`text-xs ${
                        isPast(new Date(reminder.reminderDate)) && !reminder.isCompleted 
                          ? 'text-red-600 font-medium' 
                          : 'text-gray-600 dark:text-gray-700'
                      }`}>
                        {formatReminderDate(reminder.reminderDate)}
                      </span>
                    </div>
                  )}
                  
                  {/* Assigned users avatars */}
                  <AssignedUsersAvatars 
                    assignedUserIds={reminder.assignedUserIds} 
                    employees={employees} 
                    maxDisplay={3}
                    currentUserId={user?.id}
                    completedByUserIds={reminder.completedByUserIds}
                  />
                  
                  <div className="flex items-center justify-between mt-4">
                    <Badge variant="secondary" className={`text-xs ${PRIORITY_COLORS[reminder.priority]}`}>
                      {reminder.priority === 'high' ? 'Alta' : reminder.priority === 'medium' ? 'Media' : 'Baja'}
                    </Badge>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleComplete(reminder)}
                      className={`h-7 px-3 text-xs font-medium transition-colors ${
                        reminder.isCompleted 
                          ? 'bg-green-100 text-green-800 hover:bg-green-200 border border-green-300' 
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200 border border-gray-300'
                      }`}
                    >
                      {reminder.isCompleted ? (
                        <span className="flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Completado
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Marcar
                        </span>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Assignment Dialog */}
        <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Asignar Recordatorio</DialogTitle>
              <DialogDescription>
                Selecciona los empleados que recibirán este recordatorio: "{selectedReminderForAssignment?.title}"
              </DialogDescription>
            </DialogHeader>
            
            {/* Employee search for assignment dialog */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar empleados..."
                value={assignDialogSearchTerm}
                onChange={(e) => setAssignDialogSearchTerm(e.target.value)}
                className="pl-10 text-sm"
              />
            </div>
            
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {employeesLoading && <p className="text-sm text-muted-foreground">Cargando empleados...</p>}
              {employeesError && <p className="text-sm text-red-500">Error cargando empleados: {String(employeesError)}</p>}
              {!employeesLoading && !employeesError && employees.filter(emp => emp.id !== user?.id).length === 0 && (
                <p className="text-sm text-muted-foreground">No hay empleados disponibles para asignar</p>
              )}
              {employees
                .filter(emp => emp.id !== user?.id)
                .filter(emp => 
                  assignDialogSearchTerm === '' || 
                  emp.fullName.toLowerCase().includes(assignDialogSearchTerm.toLowerCase())
                )
                .map((employee) => (
                <div key={employee.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`employee-${employee.id}`}
                    checked={selectedEmployees.includes(employee.id)}
                    onCheckedChange={() => handleEmployeeToggle(employee.id)}
                  />
                  <label
                    htmlFor={`employee-${employee.id}`}
                    className="flex-1 cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center justify-between"
                  >
                    <span>{employee.fullName}</span>
                    {selectedReminderForAssignment?.completedByUserIds?.includes(employee.id) && (
                      <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                        Completado
                      </span>
                    )}
                  </label>
                </div>
              ))}
              
              {employees
                .filter(emp => emp.id !== user?.id)
                .filter(emp => 
                  assignDialogSearchTerm === '' || 
                  emp.fullName.toLowerCase().includes(assignDialogSearchTerm.toLowerCase())
                ).length === 0 && assignDialogSearchTerm !== '' && (
                <div className="text-center py-2 text-muted-foreground text-sm">
                  No se encontraron empleados
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsAssignDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleAssignSubmit}
                disabled={selectedEmployees.length === 0 || assignReminderMutation.isPending}
              >
                {assignReminderMutation.isPending ? 'Asignando...' : (() => {
                  const countWithoutCurrentUser = selectedEmployees.filter(id => id !== user?.id).length;
                  return countWithoutCurrentUser > 0 ? 
                    `Asignar a ${countWithoutCurrentUser} empleado${countWithoutCurrentUser !== 1 ? 's' : ''}` :
                    'Asignar solo a ti';
                })()}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}