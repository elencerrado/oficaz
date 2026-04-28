import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFeatureCheck } from '@/hooks/use-feature-check';
import { usePageTitle } from '@/hooks/use-page-title';
import FeatureRestrictedPage from '@/components/feature-restricted-page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  Save,
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
import { usePageHeader } from '@/components/layout/page-header';
import { convertMadridToUTC, convertUTCToMadrid, getMadridDate } from '@/utils/dateUtils';
import { useTeams, resolveTeamMemberIds } from '@/hooks/use-teams';
import { useStandardInfiniteScroll } from '@/hooks/use-standard-infinite-scroll';
import { useIncrementalList } from '@/hooks/use-incremental-list';
import { InfiniteListFooter } from '@/components/ui/infinite-list-footer';
import { FILTER_SEARCH_INPUT_CLASS, FILTER_SELECT_TRIGGER_CLASS } from '@/lib/filter-styles';

interface Reminder {
  id: number;
  title: string;
  content?: string;
  reminderDate?: string;
  priority: 'low' | 'medium' | 'high';
  color: string;
  taskStatus?: 'pending' | 'in_progress' | 'on_hold';
  contextType?: 'general' | 'project' | 'area';
  contextName?: string;
  isCompleted: boolean;
  isArchived: boolean;
  isPinned: boolean;
  showBanner: boolean;
  createdAt: string;
  updatedAt: string;
  userId?: number;
  userFullName?: string;
  assignedUserIds?: number[];
  completedByUserIds?: number[];
  createdBy?: number;
  assignedBy?: number;
  assignedAt?: string;
  responsibleUserId?: number;
}

interface Employee {
  id: number;
  fullName: string;
  email: string;
  role: string;
  position?: string;
  profilePicture?: string;
}

const resolveAvatarUrl = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed;
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('/public-objects/')) return trimmed;
  if (trimmed.startsWith('uploads/') || trimmed.startsWith('public-objects/')) return `/${trimmed}`;
  if (trimmed.startsWith('/')) return trimmed;
  return `/uploads/${trimmed}`;
};

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

const TASK_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'in_progress', label: 'En curso' },
  { value: 'on_hold', label: 'En espera' },
] as const;

const TASK_STATUS_BADGES = {
  pending: 'bg-slate-100 border-slate-200 text-slate-700',
  in_progress: 'bg-blue-100 border-blue-200 text-blue-700',
  on_hold: 'bg-orange-100 border-orange-200 text-orange-700',
  completed: 'bg-green-100 border-green-200 text-green-700',
};

const STATUS_TRIGGER_CLASSES: Record<string, string> = {
  on_hold:    'bg-orange-50 border border-orange-300 text-orange-700 hover:bg-orange-100',
  in_progress:'bg-blue-50   border border-blue-300   text-blue-700   hover:bg-blue-100',
  completed:  'bg-green-50  border border-green-300  text-green-700  hover:bg-green-100',
};

const CARD_STATUS_OPTIONS = [
  { value: 'on_hold', label: 'En espera' },
  { value: 'in_progress', label: 'En proceso' },
  { value: 'completed', label: 'Completado' },
] as const;

const CONTEXT_TYPE_LABELS = {
  general: 'General',
  project: 'Proyecto',
  area: 'Area',
};

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
              src={resolveAvatarUrl(employee.profilePicture)} 
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
  usePageTitle('Tareas');
  const { user } = useAuth();
  const { hasAccess } = useFeatureCheck();
  const { setHeader, resetHeader } = usePageHeader();

  // Set page header
  useEffect(() => {
    setHeader({
      title: 'Gestión de Tareas',
      subtitle: 'Organiza tus tareas y mantente al día.'
    });
    return resetHeader;
  }, []);
  
  const canAccessReminders = hasAccess('reminders');

  if (!canAccessReminders) {
    return (
      <FeatureRestrictedPage
        featureName="Tareas"
        description="No tienes acceso a la funcionalidad de tareas. Activa este addon desde la Tienda para comenzar a usarlo."
      />
    );
  }
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed' | 'archived'>('active');
  const [workflowFilter, setWorkflowFilter] = useState<'all' | 'pending' | 'in_progress' | 'on_hold'>('all');
  const [responsibleFilter, setResponsibleFilter] = useState<'all' | string>('all');
  const [groupBy, setGroupBy] = useState<'none' | 'context' | 'responsible'>('context');
  const [selectedColor, setSelectedColor] = useState('#ffffff');
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedReminderForAssignment, setSelectedReminderForAssignment] = useState<Reminder | null>(null);
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  const [assignDialogSearchTerm, setAssignDialogSearchTerm] = useState('');
  const loadMoreRemindersRef = useRef<HTMLDivElement | null>(null);
  
  const [reminderData, setReminderData] = useState({
    title: '',
    content: '',
    reminderDate: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    color: '#ffffff',
    taskStatus: 'pending' as 'pending' | 'in_progress' | 'on_hold',
    contextType: 'general' as 'general' | 'project' | 'area',
    contextName: '',
    showBanner: false,
    assignedUserIds: [] as number[],
    responsibleUserId: user?.id || 0,
  });

  // Fetch reminders
  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ['/api/reminders'],
    retry: false,
    staleTime: 60_000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    select: (data) => {
      if (!data || !Array.isArray(data)) return [];
      return data;
    }
  });

  // Fetch employees for assignment (only for admins/managers)
  const { data: employees = [], isLoading: employeesLoading, error: employeesError } = useQuery<Employee[]>({
    queryKey: ['/api/users/employees'],
    enabled: user?.role === 'admin' || user?.role === 'manager',
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    select: (data) => {
      if (!data || !Array.isArray(data)) return [];
      return data;
    }
  });

  const { data: teams = [] } = useTeams(user?.role === 'admin' || user?.role === 'manager');



  // Create reminder mutation
  const createReminderMutation = useMutation({
    mutationFn: async (data: typeof reminderData) => {
      return await apiRequest('POST', '/api/reminders', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reminders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reminders/check-notifications'] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "Tarea creada",
        description: "La tarea se ha guardado correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear la tarea",
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
      queryClient.invalidateQueries({ queryKey: ['/api/reminders/check-notifications'] });
      setEditingReminder(null);
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar la tarea",
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
      queryClient.invalidateQueries({ queryKey: ['/api/reminders/check-notifications'] });
      toast({
        title: "Tarea eliminada",
        description: "La tarea se ha eliminado correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar la tarea",
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
      queryClient.invalidateQueries({ queryKey: ['/api/reminders/check-notifications'] });
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
      taskStatus: 'pending',
      contextType: 'general',
      contextName: '',
      showBanner: false,
      assignedUserIds: [],
      responsibleUserId: user?.id || 0,
    });
    setSelectedColor('#FFB3BA');
    setEditingReminder(null);
    setEmployeeSearchTerm('');
  };

  const handleAssignReminder = (reminder: Reminder) => {
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

  const toggleTeamSelection = (teamId: number) => {
    const memberIds = resolveTeamMemberIds(teams, teamId).filter((id) => id !== user?.id);
    if (memberIds.length === 0) return;

    const allSelected = memberIds.every((id) => selectedEmployees.includes(id));
    if (allSelected) {
      setSelectedEmployees((prev) => prev.filter((id) => !memberIds.includes(id)));
      return;
    }
    setSelectedEmployees((prev) => Array.from(new Set([...prev, ...memberIds])));
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
        title: "Tarea asignada",
        description: (() => {
          const countWithoutCurrentUser = selectedEmployees.filter(id => id !== user?.id).length;
          return countWithoutCurrentUser > 0 ? 
            `Se ha asignado a ${countWithoutCurrentUser} empleado${countWithoutCurrentUser !== 1 ? 's' : ''}` :
            'Tarea asignada solo a ti';
        })(),
      });
    } catch (error) {
      console.error('Error assigning reminder:', error);
      toast({
        title: "Error",
        description: "No se pudo asignar la tarea",
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
      // Validate date format first
      const dateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
      if (!dateRegex.test(reminderData.reminderDate)) {
        toast({
          title: "Error",
          description: "Formato de fecha inválido. Por favor, selecciona una fecha válida.",
          variant: "destructive",
        });
        return;
      }
      
      // Convert Madrid time to UTC for storage
      try {
        processedDate = convertMadridToUTC(reminderData.reminderDate);
      } catch (error) {
        toast({
          title: "Error",
          description: "Fecha inválida. Por favor, selecciona una fecha válida.",
          variant: "destructive",
        });
        return;
      }
    }

    // Don't submit if no date is provided
    if (!processedDate) {
      toast({
        title: "Error",
        description: "Debes seleccionar una fecha para la tarea",
        variant: "destructive",
      });
      return;
    }

    const submitData = {
      ...reminderData,
      color: selectedColor,
      reminderDate: processedDate // Now guaranteed to be string, not undefined
    };

    if (editingReminder) {
      updateReminderMutation.mutate({ id: editingReminder.id, data: submitData });
    } else {
      createReminderMutation.mutate(submitData);
    }
  };

  const handleEdit = (reminder: Reminder) => {
    setEditingReminder(reminder);
    
    // Convert UTC date back to Madrid time for datetime-local input
    let localDateTimeString = '';
    if (reminder.reminderDate) {
      localDateTimeString = convertUTCToMadrid(reminder.reminderDate);
    }
    
    setReminderData({
      title: reminder.title,
      content: reminder.content || '',
      reminderDate: localDateTimeString,
      priority: reminder.priority,
      color: reminder.color,
      taskStatus: reminder.taskStatus || 'pending',
      contextType: reminder.contextType || 'general',
      contextName: reminder.contextName || '',
      showBanner: reminder.showBanner || false,
      assignedUserIds: Array.isArray(reminder.assignedUserIds) ? reminder.assignedUserIds : [],
      responsibleUserId: reminder.responsibleUserId || reminder.userId || user?.id || 0,
    });
    setSelectedColor(reminder.color);
    setIsDialogOpen(true);
  };

  // Helper function to check if current user has completed the reminder individually
  const isCompletedByCurrentUser = (reminder: Reminder): boolean => {
    if (!user?.id) return false;
    return reminder.completedByUserIds?.includes(user.id) || false;
  };

  const getResponsibleName = (reminder: Reminder): string => {
    const responsibleId = reminder.responsibleUserId || reminder.userId;
    if (!responsibleId) return 'Sin responsable';
    if (responsibleId === user?.id) return 'Tú';
    return employees.find((employee) => employee.id === responsibleId)?.fullName || reminder.userFullName || 'Sin responsable';
  };

  const getTaskStatusLabel = (status?: Reminder['taskStatus'] | 'completed') => {
    if (status === 'completed') return 'Completado';
    return TASK_STATUS_OPTIONS.find((option) => option.value === status)?.label || 'Pendiente';
  };

  const getCardStatusValue = (reminder: Reminder): 'on_hold' | 'in_progress' | 'completed' => {
    if (isCompletedByCurrentUser(reminder)) return 'completed';
    if (reminder.taskStatus === 'in_progress') return 'in_progress';
    return 'on_hold';
  };

  const getGroupInfo = (reminder: Reminder) => {
    if (groupBy === 'responsible') {
      const label = getResponsibleName(reminder);
      return {
        key: `responsible:${reminder.responsibleUserId || reminder.userId || 'none'}`,
        label,
      };
    }

    if (groupBy === 'context') {
      const contextType = reminder.contextType || 'general';
      const contextName = reminder.contextName?.trim();
      if (contextName) {
        return {
          key: `context:${contextType}:${contextName.toLowerCase()}`,
          label: `${CONTEXT_TYPE_LABELS[contextType]}: ${contextName}`,
        };
      }

      return {
        key: 'context:general:sin-contexto',
        label: 'Sin proyecto o area',
      };
    }

    return {
      key: 'all',
      label: 'Todas las tareas',
    };
  };

  // Helper function to check if reminder is completed by all assigned users but not creator
  const isCompletedByAssignedOnly = (reminder: Reminder): boolean => {
    const assignedUserIds = reminder.assignedUserIds || [];
    const completedByUserIds = reminder.completedByUserIds || [];
    const creatorId = reminder.createdBy || reminder.userId;
    
    // Get assigned users excluding the creator
    const assignedNonCreators = assignedUserIds.filter(id => id !== creatorId);
    
    // Check if all assigned non-creators completed but creator hasn't
    const allAssignedCompleted = assignedNonCreators.length > 0 && 
                                assignedNonCreators.every(id => completedByUserIds.includes(id));
    const creatorNotCompleted = Boolean(creatorId && !completedByUserIds.includes(creatorId));
    
    return allAssignedCompleted && creatorNotCompleted;
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
    // Convert UTC to Madrid time for display
    const date = getMadridDate(dateString);
    const timeStr = format(date, 'HH:mm', { locale: es });
    
    if (isToday(date)) return `Hoy ${timeStr}`;
    if (isTomorrow(date)) return `Mañana ${timeStr}`;
    if (isPast(date)) return `Hace ${formatDistanceToNow(date, { locale: es })}`;
    return format(date, 'dd/MM/yyyy HH:mm', { locale: es });
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return <AlertCircle className="w-4 h-4 text-gray-800 dark:text-gray-900" />;
      case 'medium': return <Clock className="w-4 h-4 text-gray-800 dark:text-gray-900" />;
      case 'low': return <CheckCircle className="w-4 h-4 text-gray-800 dark:text-gray-900" />;
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
      const contextName = reminder.contextName || '';
      
      const matchesSearch = title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           contextName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesFilter = 
        filterStatus === 'all' ||
        (filterStatus === 'active' && !isCompletedByCurrentUser(reminder) && !reminder.isArchived) ||
        (filterStatus === 'completed' && isCompletedByCurrentUser(reminder)) ||
        (filterStatus === 'archived' && reminder.isArchived);

      const matchesWorkflow = workflowFilter === 'all' || (reminder.taskStatus || 'pending') === workflowFilter;

      const matchesResponsible = responsibleFilter === 'all' ||
        String(reminder.responsibleUserId || reminder.userId || '') === responsibleFilter;

      return matchesSearch && matchesFilter && matchesWorkflow && matchesResponsible;
    });
  }, [reminders, searchTerm, filterStatus, workflowFilter, responsibleFilter]);

  // Sort reminders: pinned first, then by date
  const sortedReminders = [...filteredReminders].sort((a: Reminder, b: Reminder) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    if (a.reminderDate && b.reminderDate) {
      return new Date(a.reminderDate).getTime() - new Date(b.reminderDate).getTime();
    }
    if (a.reminderDate) return -1;
    if (b.reminderDate) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const groupedReminders = React.useMemo(() => {
    if (groupBy === 'none') {
      return [{ key: 'all', label: 'Todas las tareas', reminders: sortedReminders }];
    }

    const groups = new Map<string, { key: string; label: string; reminders: Reminder[] }>();

    sortedReminders.forEach((reminder) => {
      const group = getGroupInfo(reminder);
      if (!groups.has(group.key)) {
        groups.set(group.key, { key: group.key, label: group.label, reminders: [] });
      }
      groups.get(group.key)!.reminders.push(reminder);
    });

    return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }, [groupBy, sortedReminders]);

  const {
    displayedCount,
    visibleItems: visibleSortedReminders,
    hasMore: hasMoreRemindersToDisplay,
    loadMore: loadMoreReminders,
  } = useIncrementalList({
    items: sortedReminders,
    mobileInitialCount: 12,
    desktopInitialCount: 24,
    resetKey: `${searchTerm}-${filterStatus}-${workflowFilter}-${responsibleFilter}-${groupBy}`,
  });

  const visibleGroupedReminders = React.useMemo(() => {
    if (groupBy === 'none') {
      return [{ key: 'all', label: 'Todas las tareas', reminders: visibleSortedReminders }];
    }

    const groups = new Map<string, { key: string; label: string; reminders: Reminder[] }>();

    visibleSortedReminders.forEach((reminder) => {
      const group = getGroupInfo(reminder);
      if (!groups.has(group.key)) {
        groups.set(group.key, { key: group.key, label: group.label, reminders: [] });
      }
      groups.get(group.key)!.reminders.push(reminder);
    });

    return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }, [groupBy, visibleSortedReminders]);

  useStandardInfiniteScroll({
    targetRef: loadMoreRemindersRef,
    enabled: !isLoading,
    canLoadMore: hasMoreRemindersToDisplay,
    onLoadMore: loadMoreReminders,
    dependencyKey: `${displayedCount}-${sortedReminders.length}-${groupBy}`,
    rootMargin: '100px',
  });

  return (
    <div className="bg-background" style={{ overflowX: 'clip' }}>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="bg-oficaz-primary hover:bg-oficaz-primary/90 whitespace-nowrap hidden">
              <Plus className="w-4 h-4 mr-2" />
              Crear
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden border-0">
            <DialogTitle className="sr-only">{editingReminder ? 'Editar Tarea' : 'Nueva Tarea'}</DialogTitle>

            {/* Colored header preview */}
            <div
              className="px-6 py-4 relative rounded-t-lg"
              style={{ backgroundColor: selectedColor !== '#ffffff' ? selectedColor : '#F1F5F9' }}
            >
              <div className="absolute inset-0 bg-black/5 rounded-t-lg" />
              <div className="relative z-10">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-gray-600 opacity-70" />
                  <span className="text-xs text-gray-600 font-medium uppercase tracking-wide">
                    {editingReminder ? 'Editar Tarea' : 'Nueva Tarea'}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mt-0.5">
                  {reminderData.title || 'Sin título'}
                </h3>
                <div className="flex items-center gap-3 mt-0.5">
                  {reminderData.contextName && (
                    <span className="text-xs text-gray-600">{reminderData.contextName}</span>
                  )}
                  {reminderData.reminderDate && (
                    <span className="text-xs text-gray-600 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {reminderData.reminderDate.replace('T', ' ')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex">
              {/* Left: color strip */}
              <div className="w-14 bg-muted/20 p-2 flex flex-col gap-1.5 pt-3 border-r border-border">
                {REMINDER_COLORS.map((color, index) => (
                  <button
                    type="button"
                    key={color}
                    onClick={() => { setSelectedColor(color); setReminderData(prev => ({ ...prev, color })); }}
                    className={`w-10 h-7 rounded border-2 transition-all hover:scale-105 ${
                      selectedColor === color
                        ? 'border-gray-700 dark:border-gray-200 scale-105 shadow-md'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                    style={{ backgroundColor: color }}
                    title={`Color ${index + 1}`}
                  />
                ))}

                <div className="mt-auto pt-2 border-t border-border/60 flex flex-col gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-xl border border-red-200 bg-red-50 text-red-600 shadow-sm transition-colors hover:bg-red-100 hover:text-red-700"
                    onClick={() => { setIsDialogOpen(false); setEditingReminder(null); resetForm(); }}
                    title="Cancelar"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    className="h-10 w-10 rounded-xl border border-green-200 bg-green-50 text-green-600 shadow-sm transition-colors hover:bg-green-100 hover:text-green-700"
                    onClick={handleSubmit}
                    disabled={createReminderMutation.isPending || updateReminderMutation.isPending}
                    title={editingReminder ? 'Actualizar tarea' : 'Guardar tarea'}
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Right: form */}
              <div className="flex-1 p-5 space-y-3 overflow-y-auto max-h-[70vh]">
                {/* Title */}
                <input
                  type="text"
                  value={reminderData.title}
                  onChange={(e) => setReminderData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Título de la tarea *"
                  className="w-full px-3 py-2 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                />

                {/* Row: Estado + Prioridad */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Estado de trabajo</label>
                    <Select value={reminderData.taskStatus} onValueChange={(value: any) => setReminderData(prev => ({ ...prev, taskStatus: value }))}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Prioridad</label>
                    <Select value={reminderData.priority} onValueChange={(value: any) => setReminderData(prev => ({ ...prev, priority: value }))}>
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
                    <Select value={reminderData.contextType} onValueChange={(value: any) => setReminderData(prev => ({ ...prev, contextType: value }))}>
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
                      {reminderData.contextType === 'project' ? 'Nombre del proyecto' : reminderData.contextType === 'area' ? 'Nombre del área' : 'Contexto (opcional)'}
                    </label>
                    <input
                      type="text"
                      value={reminderData.contextName}
                      onChange={(e) => setReminderData(prev => ({ ...prev, contextName: e.target.value }))}
                      placeholder={reminderData.contextType === 'project' ? 'Ej: Cliente Repsol' : reminderData.contextType === 'area' ? 'Ej: Administración' : 'Opcional'}
                      className="w-full px-3 py-1.5 text-xs border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 h-8"
                    />
                  </div>
                </div>

                {/* Row: Responsable + Fecha */}
                <div className="grid grid-cols-2 gap-3">
                  {(user?.role === 'admin' || user?.role === 'manager') ? (
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Responsable</label>
                      <Select
                        value={String(reminderData.responsibleUserId || user?.id || 0)}
                        onValueChange={(value) => setReminderData(prev => ({ ...prev, responsibleUserId: Number(value) }))}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={String(user?.id || 0)}>Tú</SelectItem>
                          {employees
                            .filter((employee) => employee.id !== user?.id)
                            .map((employee) => (
                              <SelectItem key={employee.id} value={String(employee.id)}>{employee.fullName}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : <div />}
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Fecha y hora</label>
                    <input
                      type="datetime-local"
                      value={reminderData.reminderDate}
                      onChange={(e) => setReminderData(prev => ({ ...prev, reminderDate: e.target.value }))}
                      className="w-full px-3 py-1.5 text-xs border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 h-8"
                    />
                  </div>
                </div>

                {/* Mostrar aviso */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={reminderData.showBanner}
                    onCheckedChange={(checked) => setReminderData(prev => ({ ...prev, showBanner: checked as boolean }))}
                  />
                  <span className="text-xs text-muted-foreground">
                    Mostrar aviso{!reminderData.reminderDate ? ' (requiere fecha)' : ' cuando llegue la fecha'}
                  </span>
                </label>

                {/* Description */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Descripción</label>
                  <textarea
                    value={reminderData.content}
                    onChange={(e) => setReminderData(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="Detalles adicionales de la tarea..."
                    rows={2}
                    className="w-full px-3 py-2 text-xs border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                  />
                </div>

                {/* Asignar a empleados - solo admin/manager */}
                {(user?.role === 'admin' || user?.role === 'manager') && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Asignar a empleados</label>
                    <div className="relative mb-1.5">
                      <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar empleados..."
                        value={employeeSearchTerm}
                        onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 h-7"
                      />
                    </div>
                    <div className="space-y-1 max-h-28 overflow-y-auto border border-border rounded p-2 bg-muted/10">
                      {employees
                        .filter(emp => emp.id !== user?.id)
                        .filter(emp => employeeSearchTerm === '' || emp.fullName.toLowerCase().includes(employeeSearchTerm.toLowerCase()))
                        .map((employee) => (
                          <label key={employee.id} className="flex items-center gap-2 cursor-pointer py-0.5">
                            <Checkbox
                              id={`form-employee-${employee.id}`}
                              checked={reminderData.assignedUserIds.includes(employee.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setReminderData(prev => ({ ...prev, assignedUserIds: [...prev.assignedUserIds, employee.id] }));
                                } else {
                                  setReminderData(prev => ({ ...prev, assignedUserIds: prev.assignedUserIds.filter(id => id !== employee.id) }));
                                }
                              }}
                            />
                            <span className="text-xs text-foreground">{employee.fullName}</span>
                          </label>
                        ))}
                      {employees
                        .filter(emp => emp.id !== user?.id)
                        .filter(emp => employeeSearchTerm === '' || emp.fullName.toLowerCase().includes(employeeSearchTerm.toLowerCase())).length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-2">
                          {employeeSearchTerm ? 'No se encontraron empleados' : 'No hay empleados disponibles'}
                        </p>
                      )}
                    </div>
                    {reminderData.assignedUserIds.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {(() => {
                          const count = reminderData.assignedUserIds.filter(id => id !== user?.id).length;
                          return count > 0
                            ? `${count} empleado${count !== 1 ? 's' : ''} seleccionado${count !== 1 ? 's' : ''}`
                            : 'Solo tú estás asignado a esta tarea';
                        })()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

      {/* Filters and Search */}
      <div className="mb-6">
        {/* Mobile top bar: clean controls with collapsible filters */}
        <div className="sm:hidden flex items-center gap-2 mb-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters((prev) => !prev)}
            className="flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            Filtros
          </Button>
          <Button
            onClick={() => {
              resetForm();
              setIsDialogOpen(true);
            }}
            size="sm"
            className="bg-oficaz-primary hover:bg-oficaz-primary/90 ml-auto"
          >
            <Plus className="w-4 h-4 mr-2" />
            Crear
          </Button>
        </div>

        {/* Mobile collapsible filters */}
        {showFilters && (
          <div className="sm:hidden space-y-3 py-4 bg-muted/50 rounded-lg px-4 mb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar tareas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={FILTER_SEARCH_INPUT_CLASS}
              />
            </div>
            <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
              <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="completed">Completados</SelectItem>
                <SelectItem value="archived">Archivados</SelectItem>
              </SelectContent>
            </Select>
            <Select value={workflowFilter} onValueChange={(value: any) => setWorkflowFilter(value)}>
              <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
                <SelectValue placeholder="Estado de trabajo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo el flujo</SelectItem>
                {TASK_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={responsibleFilter} onValueChange={setResponsibleFilter}>
              <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
                <SelectValue placeholder="Responsable" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los responsables</SelectItem>
                <SelectItem value={String(user?.id || 0)}>Tú</SelectItem>
                {employees
                  .filter((employee) => employee.id !== user?.id)
                  .map((employee) => (
                    <SelectItem key={employee.id} value={String(employee.id)}>{employee.fullName}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Select value={groupBy} onValueChange={(value: any) => setGroupBy(value)}>
              <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
                <SelectValue placeholder="Agrupar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin agrupar</SelectItem>
                <SelectItem value="context">Por proyecto/area</SelectItem>
                <SelectItem value="responsible">Por responsable</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Desktop filters keep existing layout */}
        <div className="hidden sm:flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Buscar tareas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={FILTER_SEARCH_INPUT_CLASS}
            />
          </div>
          <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
            <SelectTrigger className={`w-48 ${FILTER_SELECT_TRIGGER_CLASS}`}>
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
          <Select value={workflowFilter} onValueChange={(value: any) => setWorkflowFilter(value)}>
            <SelectTrigger className={`w-48 ${FILTER_SELECT_TRIGGER_CLASS}`}>
              <SelectValue placeholder="Estado de trabajo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo el flujo</SelectItem>
              {TASK_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={responsibleFilter} onValueChange={setResponsibleFilter}>
            <SelectTrigger className={`w-52 ${FILTER_SELECT_TRIGGER_CLASS}`}>
              <SelectValue placeholder="Responsable" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los responsables</SelectItem>
              <SelectItem value={String(user?.id || 0)}>Tú</SelectItem>
              {employees
                .filter((employee) => employee.id !== user?.id)
                .map((employee) => (
                  <SelectItem key={employee.id} value={String(employee.id)}>{employee.fullName}</SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Select value={groupBy} onValueChange={(value: any) => setGroupBy(value)}>
            <SelectTrigger className={`w-52 ${FILTER_SELECT_TRIGGER_CLASS}`}>
              <SelectValue placeholder="Agrupar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin agrupar</SelectItem>
              <SelectItem value="context">Por proyecto/area</SelectItem>
              <SelectItem value="responsible">Por responsable</SelectItem>
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
      </div>

        {/* Reminders Grid */}
        {!isLoading && sortedReminders.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No hay tareas</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm ? 'No se encontraron tareas que coincidan con tu búsqueda' : 'Crea tu primera tarea para empezar a organizarte'}
            </p>
            <Button onClick={() => setIsDialogOpen(true)} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Crear Tarea
            </Button>
          </div>
        ) : (
          <div className={`space-y-6 transition-opacity duration-300 ${isLoading ? 'opacity-50' : ''}`}>
            {visibleGroupedReminders.map((group) => (
              <section key={group.key} className="space-y-3">
                {groupBy !== 'none' && (
                  <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
                      <p className="text-xs text-muted-foreground">
                        {group.reminders.length} recordatorio{group.reminders.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  {group.reminders.map((reminder: Reminder) => (
                    <Card
                      key={reminder.id}
                      className={`transition-all hover:shadow-md flex flex-col h-full ${
                        reminder.isCompleted ? 'opacity-75' : ''
                      } ${reminder.isArchived ? 'opacity-60' : ''}`}
                      style={{ backgroundColor: reminder.color }}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className={`text-xs ${PRIORITY_COLORS[reminder.priority]}`}>
                              {reminder.priority === 'high' ? 'Alta' : reminder.priority === 'medium' ? 'Media' : 'Baja'}
                            </Badge>
                            {reminder.isPinned && <Pin className="w-4 h-4 text-white drop-shadow-sm" />}
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
                        <CardTitle className={`text-sm font-medium text-gray-900 dark:text-gray-900 ${isCompletedByCurrentUser(reminder) ? 'line-through' : ''}`}>
                          {reminder.title}
                        </CardTitle>
                        <div className="flex flex-wrap gap-2 pt-2">
                          {reminder.contextName && (
                            <Badge variant="outline" className="text-xs border-gray-200 bg-white/70 text-gray-700">
                              {CONTEXT_TYPE_LABELS[reminder.contextType || 'general']}: {reminder.contextName}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs border-gray-200 bg-white/70 text-gray-700">
                            Responsable: {getResponsibleName(reminder)}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 flex-1 flex flex-col">
                        <div className="flex-1">
                          {reminder.content && (
                            <p className={`text-sm text-gray-700 dark:text-gray-800 mb-3 line-clamp-3 ${isCompletedByCurrentUser(reminder) ? 'line-through' : ''}`}>
                              {reminder.content}
                            </p>
                          )}
                          
                          {reminder.reminderDate && (
                            <div className="flex items-center gap-1 mb-3">
                              <Calendar className="w-3 h-3 text-gray-600 dark:text-gray-700" />
                              <span className={`text-xs ${
                                isPast(new Date(reminder.reminderDate)) && !isCompletedByCurrentUser(reminder)
                                  ? 'text-red-600 font-medium' 
                                  : 'text-gray-600 dark:text-gray-700'
                              }`}>
                                {formatReminderDate(reminder.reminderDate)}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        <div className="mt-auto">
                          <AssignedUsersAvatars 
                            assignedUserIds={reminder.assignedUserIds} 
                            employees={employees} 
                            maxDisplay={3}
                            currentUserId={user?.id}
                            completedByUserIds={reminder.completedByUserIds}
                          />

                          <div className="flex items-center justify-between mt-4">
                            <div className="flex items-center gap-2">
                              <Select
                                value={getCardStatusValue(reminder)}
                                onValueChange={(value: 'on_hold' | 'in_progress' | 'completed') => {
                                  if (value === 'completed') {
                                    updateReminderMutation.mutate({
                                      id: reminder.id,
                                      data: { isCompleted: true }
                                    });
                                    return;
                                  }

                                  updateReminderMutation.mutate({
                                    id: reminder.id,
                                    data: {
                                      taskStatus: value,
                                      isCompleted: false,
                                    }
                                  });
                                }}
                              >
                                <SelectTrigger
                                  className={`h-6 pl-2.5 pr-1.5 gap-1 text-xs font-medium rounded-full border w-auto focus:ring-0 focus:ring-offset-0 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:shrink-0 [&>svg]:opacity-60 ${
                                    STATUS_TRIGGER_CLASSES[getCardStatusValue(reminder)] ?? STATUS_TRIGGER_CLASSES['on_hold']
                                  }`}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {CARD_STATUS_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {isCompletedByAssignedOnly(reminder) ? (
                                <span className="text-xs text-orange-600 font-medium">
                                  Completado por todos
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            ))}

            <InfiniteListFooter
              hasMore={hasMoreRemindersToDisplay}
              sentinelRef={loadMoreRemindersRef}
              onLoadMore={loadMoreReminders}
              hintText={`Mostrando ${visibleSortedReminders.length} de ${sortedReminders.length} tareas`}
            />
          </div>
        )}

        {/* Assignment Dialog */}
        <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Asignar Tarea</DialogTitle>
              <DialogDescription>
                Selecciona los empleados que recibirán esta tarea: "{selectedReminderForAssignment?.title}"
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

            {teams.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Equipos</p>
                <div className="flex flex-wrap gap-2">
                  {teams.map((team) => {
                    const memberIds = resolveTeamMemberIds(teams, team.id).filter((id) => id !== user?.id);
                    const active = memberIds.length > 0 && memberIds.every((id) => selectedEmployees.includes(id));
                    return (
                      <Button
                        key={`reminder-team-${team.id}`}
                        type="button"
                        variant={active ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => toggleTeamSelection(team.id)}
                        className="h-7 text-xs"
                      >
                        {team.name}
                      </Button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            
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