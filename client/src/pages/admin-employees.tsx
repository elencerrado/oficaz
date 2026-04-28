import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import StatsCard from '@/components/StatsCard';
import { TabNavigation } from '@/components/ui/tab-navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Users, 
  Search, 
  Phone, 
  MessageCircle,
  Edit,
  Shield,
  Clock,
  Calendar,
  Plus,
  UserPlus,
  UserCheck,
  IdCard,
  Mail,
  User,
  Minus,
  Check,
  AlertCircle,
  AlertTriangle,
  Trash2,
  Lock,
  ClipboardList,
  Settings,
  Sparkles,
  FileText,
  Filter,
  Bell,
  FolderOpen,
  CalendarDays,
  LayoutGrid,
  Eye,
  ShieldCheck
  ,X
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { DatePickerDayEmployee } from '@/components/ui/date-picker';
import { apiRequest } from '@/lib/queryClient';
import { logger } from '@/lib/logger';
import { useToast } from '@/hooks/use-toast';
import { usePageHeader } from '@/components/layout/page-header';
import { useFeatureCheck } from '@/hooks/use-feature-check';
import { useTeams, resolveTeamMemberIds, type TeamWithMembers } from '@/hooks/use-teams';
import { useStandardInfiniteScroll } from '@/hooks/use-standard-infinite-scroll';
import { useIncrementalList } from '@/hooks/use-incremental-list';
import { InfiniteListFooter } from '@/components/ui/infinite-list-footer';
import { ListLoadingState } from '@/components/ui/list-loading-state';
import { ModalActionButton } from '@/components/ui/modal-action-button';
import { ModalHeaderWithActions } from '@/components/ui/modal-header-with-actions';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  FILTER_LABEL_CLASS,
  FILTER_PANEL_CLASS,
  FILTER_SELECT_TRIGGER_CLASS,
} from '@/lib/filter-styles';

export default function EmployeesSimple() {
  const { user, token } = useAuth();
  const isMobile = useIsMobile();
  const { setHeader, resetHeader } = usePageHeader();
  const { hasAccess } = useFeatureCheck();

  // Set page header
  useEffect(() => {
    setHeader({
      title: 'Gestión de Empleados',
      subtitle: 'Administra usuarios y gestiona información de empleados'
    });
    return resetHeader;
  }, []);
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('todos'); // Default to all
  const [roleFilter, setRoleFilter] = useState<'todos' | 'employee' | 'manager' | 'admin'>('todos'); // Filter by role
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const [limitMessage, setLimitMessage] = useState('');
  const [activeTab, setActiveTab] = useState('employees');
  const [showFilters, setShowFilters] = useState(false);
  const loadMoreEmployeesRef = useRef<HTMLDivElement | null>(null);
  const teamEditorRef = useRef<HTMLDivElement | null>(null);
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null);
  const [isTeamFormEditable, setIsTeamFormEditable] = useState(true);
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [teamSelectedMembers, setTeamSelectedMembers] = useState<number[]>([]);
  const [teamMemberSearchTerm, setTeamMemberSearchTerm] = useState('');
  const [managerPermissions, setManagerPermissions] = useState({
    canCreateDeleteEmployees: true,
    canCreateDeleteManagers: false,
    canBuyRemoveFeatures: false,
    canBuyRemoveUsers: false,
    canEditCompanyData: false,
    visibleFeatures: [] as string[],
  });

  const hasTeamDraft = teamName.trim().length > 0 || teamDescription.trim().length > 0 || teamSelectedMembers.length > 0;
  const showTeamHeaderActions = editingTeamId !== null || hasTeamDraft;

  const focusTeamEditorOnMobile = () => {
    if (!isMobile || !teamEditorRef.current) return;
    requestAnimationFrame(() => {
      teamEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const managerPermissionSwitchClass = "h-7 w-12 !border-0 shadow-inner data-[state=unchecked]:bg-gray-300 dark:data-[state=unchecked]:bg-gray-600 data-[state=checked]:bg-emerald-500 dark:data-[state=checked]:bg-emerald-400 focus-visible:ring-0 focus-visible:ring-offset-0";
  const [editEmployee, setEditEmployee] = useState({
    companyEmail: '',
    companyPhone: '',
    position: '',
    startDate: new Date(),
    status: 'active',
    role: 'employee',
    vacationDaysAdjustment: 0,
    personalEmail: '',
    personalPhone: '',
    address: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    workReportMode: 'disabled' as 'disabled' | 'manual' | 'on_clockout' | 'both',
  });

  const [newEmployee, setNewEmployee] = useState({
    fullName: '',
    dni: '',
    companyEmail: '',
    companyPhone: '',
    position: '',
    startDate: new Date(),
    status: 'active',
    role: 'employee',
    personalEmail: '',
    personalPhone: '',
    address: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
  });

  const normalizeWorkReportMode = (mode?: string | null): 'disabled' | 'manual' | 'both' => {
    if (mode === 'disabled') return 'disabled';
    if (mode === 'both' || mode === 'on_clockout') return 'both';
    return 'manual';
  };

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // CRM feature gate
  const canUseCrm = hasAccess('crm');

  // Employee CRM projects assignment state
  const [employeeProjectSearch, setEmployeeProjectSearch] = useState('');
  const [employeeAssignedProjects, setEmployeeAssignedProjects] = useState<Array<{ id: number; name: string; code?: string | null }>>([]);

  // Fetch all company projects (CRM)
  const { data: allProjects = [] } = useQuery<Array<{ project: { id: number; name: string; code?: string } } | { id: number; name: string; code?: string }>>({
    queryKey: ['/api/crm/projects'],
    enabled: !!selectedEmployee && !!showEditModal && canUseCrm,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Fetch projects assigned to selected employee
  const { data: assignedProjectsData = [] } = useQuery<Array<{ id: number; name: string; code?: string }>>({
    queryKey: ['/api/crm/users', selectedEmployee?.id, 'projects'],
    enabled: !!selectedEmployee && !!showEditModal && canUseCrm,
    select: (rows: any) => Array.isArray(rows) ? rows : [],
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Sync local assigned projects state when query changes
  useEffect(() => {
    if (assignedProjectsData && Array.isArray(assignedProjectsData)) {
      const next = assignedProjectsData.map(p => ({ id: p.id, name: p.name, code: p.code }));
      const sameLength = next.length === employeeAssignedProjects.length;
      const sameItems = sameLength && next.every((p, i) => {
        const cur = employeeAssignedProjects[i];
        return cur && cur.id === p.id && cur.name === p.name && (cur.code || '') === (p.code || '');
      });
      if (!sameItems) {
        setEmployeeAssignedProjects(next);
      }
    }
  }, [assignedProjectsData, employeeAssignedProjects]);

  // Normalize all projects to simple array
  const simpleAllProjects = useMemo(() => {
    if (!Array.isArray(allProjects)) return [] as Array<{ id: number; name: string; code?: string }>;
    // Endpoint may return array of enriched objects or paginated; we assume array here as per server
    return (allProjects as any[]).map((p: any) => {
      if (p?.project) return { id: p.project.id, name: p.project.name, code: p.project.code };
      return { id: p.id, name: p.name, code: p.code };
    });
  }, [allProjects]);

  // Compute available projects (not assigned)
  const availableProjects = useMemo(() => {
    const assignedIds = new Set(employeeAssignedProjects.map(p => p.id));
    return simpleAllProjects.filter(p => !assignedIds.has(p.id));
  }, [simpleAllProjects, employeeAssignedProjects]);

  // Filtered lists by global search
  const filteredAvailableProjects = useMemo(() => {
    const term = employeeProjectSearch.trim().toLowerCase();
    if (!term) return availableProjects;
    return availableProjects.filter(p => (p.name || '').toLowerCase().includes(term) || (p.code || '').toLowerCase().includes(term));
  }, [availableProjects, employeeProjectSearch]);

  const filteredAssignedProjects = useMemo(() => {
    const term = employeeProjectSearch.trim().toLowerCase();
    if (!term) return employeeAssignedProjects;
    return employeeAssignedProjects.filter(p => (p.name || '').toLowerCase().includes(term) || (p.code || '').toLowerCase().includes(term));
  }, [employeeAssignedProjects, employeeProjectSearch]);

  // Mutations to assign/remove project for employee
  const assignProjectMutation = useMutation({
    mutationFn: async (projectId: number) => {
      await apiRequest('POST', `/api/crm/projects/${projectId}/users`, { userId: selectedEmployee!.id });
    },
    onSuccess: async (_, projectId) => {
      const project = simpleAllProjects.find(p => p.id === projectId);
      if (project) setEmployeeAssignedProjects(prev => [...prev, project]);
      await queryClient.invalidateQueries({ queryKey: ['/api/crm/users', selectedEmployee?.id, 'projects'] });
    },
  });

  const removeProjectMutation = useMutation({
    mutationFn: async (projectId: number) => {
      await apiRequest('DELETE', `/api/crm/projects/${projectId}/users/${selectedEmployee!.id}`);
    },
    onSuccess: async (_, projectId) => {
      setEmployeeAssignedProjects(prev => prev.filter(p => p.id !== projectId));
      await queryClient.invalidateQueries({ queryKey: ['/api/crm/users', selectedEmployee?.id, 'projects'] });
    },
  });

  // Query for manager permissions - fetch for both admin and manager
  const { data: permissionsData } = useQuery<any>({
    queryKey: ['/api/settings/manager-permissions'],
    enabled: user?.role === 'admin' || user?.role === 'manager',
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Query for company addons (to show which features are contracted)
  const { data: companyAddons } = useQuery<Array<{
    id: number;
    addonId: number;
    status: string;
    addon: { id: number; key: string; name: string; description: string };
  }>>({
    queryKey: ['/api/company/addons'],
    enabled: user?.role === 'admin',
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
  const hasAbsencesAddon = !!companyAddons?.some((ca) => ca.status === 'active' && ca.addon?.key === 'vacation');

  const { data: teams = [], isLoading: loadingTeams } = useTeams(!!user && (user.role === 'admin' || user.role === 'manager'));

  const translateRoleToSpanish = (role?: string) => {
    switch (role) {
      case 'admin':
        return 'Administrador';
      case 'manager':
        return 'Manager';
      case 'employee':
        return 'Empleado';
      case 'accountant':
        return 'Contable';
      default:
        return role || 'Sin rol';
    }
  };

  const memberTeamNamesByEmployeeId = useMemo(() => {
    const map = new Map<number, string[]>();

    (teams || []).forEach((team) => {
      const memberIds = Array.isArray(team.memberIds)
        ? team.memberIds
        : (team.members || []).map((member) => member.id);

      memberIds.forEach((memberId) => {
        const current = map.get(memberId) || [];
        map.set(memberId, [...current, team.name]);
      });
    });

    return map;
  }, [teams]);

  // Absence requests (to reflect current status in listing)
  const { data: companyAbsences = [] } = useQuery<any[]>({
    queryKey: ['/api/vacation-requests/company'],
    enabled: !!user && (user.role === 'admin' || user.role === 'manager') && hasAbsencesAddon,
    staleTime: 60_000,
    select: (data: any) => {
      const requests = Array.isArray(data) ? data : data?.requests || [];
      return requests || [];
    }
  });

  // Track if permissions grid has been manually configured (null = never configured, array = configured)
  const [hasConfiguredFeatures, setHasConfiguredFeatures] = useState(false);

  // Update local state when permissions are fetched
  useEffect(() => {
    if (permissionsData?.managerPermissions) {
      const fetchedVisibleFeatures = permissionsData.managerPermissions.visibleFeatures;
      const isConfigured = fetchedVisibleFeatures !== null && fetchedVisibleFeatures !== undefined;

      // Only update when content actually changes to avoid loops
      if (hasConfiguredFeatures !== isConfigured) {
        setHasConfiguredFeatures(isConfigured);
      }

      const nextPermissions = {
        ...permissionsData.managerPermissions,
        visibleFeatures: fetchedVisibleFeatures || [],
      };

      const samePermissions = (
        managerPermissions.canCreateDeleteEmployees === nextPermissions.canCreateDeleteEmployees &&
        managerPermissions.canCreateDeleteManagers === nextPermissions.canCreateDeleteManagers &&
        managerPermissions.canBuyRemoveFeatures === nextPermissions.canBuyRemoveFeatures &&
        managerPermissions.canBuyRemoveUsers === nextPermissions.canBuyRemoveUsers &&
        managerPermissions.canEditCompanyData === nextPermissions.canEditCompanyData &&
        Array.isArray(managerPermissions.visibleFeatures) && Array.isArray(nextPermissions.visibleFeatures) &&
        managerPermissions.visibleFeatures.length === nextPermissions.visibleFeatures.length &&
        managerPermissions.visibleFeatures.every((v, i) => v === nextPermissions.visibleFeatures[i])
      );

      if (!samePermissions) {
        setManagerPermissions(nextPermissions);
      }
    }
  }, [permissionsData, managerPermissions, hasConfiguredFeatures]);

  // Mutation for updating manager permissions
  const updatePermissionsMutation = useMutation({
    mutationFn: (permissions: typeof managerPermissions) => 
      apiRequest('PATCH', '/api/settings/manager-permissions', { managerPermissions: permissions }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/manager-permissions'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudieron actualizar los permisos.',
        variant: 'destructive',
      });
    },
  });

  // Mutation for updating employee
  const updateEmployeeMutation = useMutation({
    mutationFn: (data: any) => apiRequest('PATCH', `/api/employees/${selectedEmployee?.id}`, data),
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      queryClient.invalidateQueries({ queryKey: ['/api/employees', selectedEmployee?.id] });

      const updatedEmployee = response?.user;
      if (updatedEmployee) {
        setSelectedEmployee((previous: any) => previous ? { ...previous, ...updatedEmployee } : updatedEmployee);
        setEditEmployee((previous) => ({
          ...previous,
          companyEmail: updatedEmployee.companyEmail || '',
          companyPhone: updatedEmployee.companyPhone || '',
          position: updatedEmployee.position || updatedEmployee.role || '',
          startDate: updatedEmployee.startDate ? new Date(updatedEmployee.startDate) : previous.startDate,
          status: updatedEmployee.status || 'active',
          role: updatedEmployee.role || 'employee',
          vacationDaysAdjustment: Number(updatedEmployee.vacationDaysAdjustment || 0),
          personalEmail: updatedEmployee.personalEmail || '',
          personalPhone: updatedEmployee.personalPhone || '',
          address: updatedEmployee.address || '',
          emergencyContactName: updatedEmployee.emergencyContactName || '',
          emergencyContactPhone: updatedEmployee.emergencyContactPhone || '',
          workReportMode: normalizeWorkReportMode(updatedEmployee.workReportMode),
        }));
      }

      toast({
        title: 'Empleado Actualizado',
        description: 'Los cambios se han guardado exitosamente.',
      });
      setShowEditModal(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar el empleado.',
        variant: 'destructive',
      });
    },
  });

  // Mutation for deleting employee
  const deleteEmployeeMutation = useMutation({
    mutationFn: (employeeId: number) => apiRequest('DELETE', `/api/employees/${employeeId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      toast({
        title: 'Empleado Eliminado',
        description: 'El empleado y todos sus datos han sido eliminados permanentemente.',
      });
      setShowDeleteModal(false);
      setShowEditModal(false);
      setDeleteConfirmText('');
      setSelectedEmployee(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo eliminar el empleado.',
        variant: 'destructive',
      });
    },
  });

  const saveTeamMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: teamName.trim(),
        description: teamDescription.trim(),
        memberIds: teamSelectedMembers,
      };

      if (!payload.name) {
        throw new Error('El nombre del equipo es obligatorio');
      }

      if (editingTeamId) {
        return apiRequest('PATCH', `/api/teams/${editingTeamId}`, payload);
      }

      return apiRequest('POST', '/api/teams', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/teams'] });
      setEditingTeamId(null);
      setIsTeamFormEditable(true);
      setTeamName('');
      setTeamDescription('');
      setTeamSelectedMembers([]);
      toast({
        title: 'Equipo guardado',
        description: 'Los cambios del equipo se han guardado correctamente.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error al guardar equipo',
        description: error.message || 'No se pudo guardar el equipo.',
        variant: 'destructive',
      });
    },
  });

  const deleteTeamMutation = useMutation({
    mutationFn: async (teamId: number) => apiRequest('DELETE', `/api/teams/${teamId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/teams'] });
      if (editingTeamId) {
        setEditingTeamId(null);
        setIsTeamFormEditable(true);
        setTeamName('');
        setTeamDescription('');
        setTeamSelectedMembers([]);
      }
      toast({
        title: 'Equipo eliminado',
        description: 'El equipo se ha eliminado correctamente.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error al eliminar equipo',
        description: error.message || 'No se pudo eliminar el equipo.',
        variant: 'destructive',
      });
    },
  });

  // Mutation for creating employee
  const createEmployeeMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/users', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      toast({
        title: 'Empleado Creado',
        description: 'El nuevo empleado se ha creado exitosamente.',
      });
      setShowCreateModal(false);
      setNewEmployee({
        fullName: '',
        dni: '',
        companyEmail: '',
        companyPhone: '',
        position: '',
        startDate: new Date(),
        status: 'active',
        role: 'employee',
        personalEmail: '',
        personalPhone: '',
        address: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo crear el empleado.',
        variant: 'destructive',
      });
    },
  });

  // Function to save employee changes
  const handleSaveEmployee = () => {
    if (!selectedEmployee) return;

    const roleToPersist = isSelectedEmployeeOriginalAdmin
      ? (selectedEmployeeDetail?.role || selectedEmployee?.role || 'admin')
      : editEmployee.role;
    
    updateEmployeeMutation.mutate({
      companyEmail: editEmployee.companyEmail,
      companyPhone: editEmployee.companyPhone,
      position: editEmployee.position,
      startDate: editEmployee.startDate instanceof Date 
        ? editEmployee.startDate.toISOString().split('T')[0]
        : editEmployee.startDate,
      status: editEmployee.status,
      role: roleToPersist,
      vacationDaysAdjustment: editEmployee.vacationDaysAdjustment,
      personalEmail: editEmployee.personalEmail,
      personalPhone: editEmployee.personalPhone,
      address: editEmployee.address,
      emergencyContactName: editEmployee.emergencyContactName,
      emergencyContactPhone: editEmployee.emergencyContactPhone,
      workReportMode: editEmployee.workReportMode,
    });
  };

  const adjustVacationDays = (increment: number) => {
    const currentAdjustment = editEmployee.vacationDaysAdjustment || 0;
    const newAdjustment = Math.max(-50, Math.min(50, currentAdjustment + increment));
    setEditEmployee({ ...editEmployee, vacationDaysAdjustment: newAdjustment });
  };

  const handleDeleteEmployee = () => {
    if (deleteConfirmText === 'ELIMINAR PERMANENTEMENTE' && selectedEmployee) {
      // Check manager permissions for deletion
      if (user?.role === 'manager') {
        const perms = permissionsData?.managerPermissions || managerPermissions;
        
        // Check if manager can delete employees
        if (selectedEmployee.role === 'employee' && !perms.canCreateDeleteEmployees) {
          toast({
            title: 'Sin Permisos',
            description: 'No tienes permiso para eliminar empleados. Contacta con tu administrador.',
            variant: 'destructive',
          });
          return;
        }
        
        // Check if manager can delete managers
        if (selectedEmployee.role === 'manager' && !perms.canCreateDeleteManagers) {
          toast({
            title: 'Sin Permisos',
            description: 'No tienes permiso para eliminar managers. Contacta con tu administrador.',
            variant: 'destructive',
          });
          return;
        }
        
        // Managers can never delete admins
        if (selectedEmployee.role === 'admin') {
          toast({
            title: 'Sin Permisos',
            description: 'Solo los administradores pueden eliminar otros administradores.',
            variant: 'destructive',
          });
          return;
        }
      }
      
      deleteEmployeeMutation.mutate(selectedEmployee.id);
    }
  };

  // Function to handle creating new employee
  const handleCreateEmployee = () => {
    // Validate required fields
    if (!newEmployee.fullName.trim() || !newEmployee.dni.trim() || !newEmployee.role) {
      toast({
        title: 'Campos Obligatorios',
        description: 'El nombre completo, DNI/NIE y tipo de usuario son obligatorios.',
        variant: 'destructive',
      });
      return;
    }

    // Check manager permissions
    if (user?.role === 'manager') {
      const perms = permissionsData?.managerPermissions || managerPermissions;
      
      // Check if manager can create employees
      if (newEmployee.role === 'employee' && !perms.canCreateDeleteEmployees) {
        toast({
          title: 'Sin Permisos',
          description: 'No tienes permiso para crear empleados. Contacta con tu administrador.',
          variant: 'destructive',
        });
        return;
      }
      
      // Check if manager can create managers
      if (newEmployee.role === 'manager' && !perms.canCreateDeleteManagers) {
        toast({
          title: 'Sin Permisos',
          description: 'No tienes permiso para crear managers. Contacta con tu administrador.',
          variant: 'destructive',
        });
        return;
      }
      
      // Managers can never create admins
      if (newEmployee.role === 'admin') {
        toast({
          title: 'Sin Permisos',
          description: 'Solo los administradores pueden crear otros administradores.',
          variant: 'destructive',
        });
        return;
      }
    }

    // Validate at least one email is provided
    if (!newEmployee.companyEmail?.trim() && !newEmployee.personalEmail?.trim()) {
      toast({
        title: 'Email Requerido',
        description: 'Debe proporcionar al menos un email (corporativo o personal) para enviar las credenciales de activación.',
        variant: 'destructive',
      });
      return;
    }

    // Check user limit - CRITICAL SECURITY: Count ALL users (backend already includes all users)
    const maxUsers = (subscription as any)?.maxUsers;
    const currentUserCount = employeeList?.length || 0; // This is ALL users from /api/employees
    

    
    if (maxUsers && currentUserCount >= maxUsers) {
      toast({
        title: 'Límite de usuarios alcanzado',
        description: `No puedes añadir más usuarios. Tu suscripción permite máximo ${maxUsers} usuarios y actualmente tienes ${currentUserCount}. Añade más desde la Tienda.`,
        variant: 'destructive',
      });
      return;
    }
    
    createEmployeeMutation.mutate({
      fullName: newEmployee.fullName,
      dni: newEmployee.dni,
      companyEmail: newEmployee.companyEmail,
      companyPhone: newEmployee.companyPhone,
      position: newEmployee.position,
      startDate: newEmployee.startDate instanceof Date 
        ? newEmployee.startDate.toISOString().split('T')[0]
        : newEmployee.startDate || new Date().toISOString().split('T')[0],
      status: newEmployee.status,
      role: newEmployee.role,
      personalEmail: newEmployee.personalEmail,
      personalPhone: newEmployee.personalPhone,
      postalAddress: newEmployee.address,
      emergencyContactName: newEmployee.emergencyContactName,
      emergencyContactPhone: newEmployee.emergencyContactPhone,
    });
  };

  const { data: employees = [], isLoading: isLoadingEmployees } = useQuery<any>({
    queryKey: ['/api/employees'],
    enabled: !!user && (user.role === 'admin' || user.role === 'manager'),
    staleTime: 60_000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Query to get subscription info for user limits
  const { data: subscription } = useQuery<any>({
    queryKey: ['/api/account/subscription'],
    staleTime: 60_000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Query to get detailed user limits (includes extra seats purchased)
  const { data: subscriptionInfo } = useQuery<{
    userLimits: {
      admins: { included: number; extra: number; total: number };
      managers: { included: number; extra: number; total: number };
      employees: { included: number; extra: number; total: number };
      totalUsers: number;
    };
  }>({
    queryKey: ['/api/subscription/info'],
    enabled: !!user && user.role === 'admin',
    staleTime: 60_000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Function to calculate role limits and availability
  const getRoleLimits = () => {
    // Use real limits from subscription info (includes extra seats purchased)
    const userLimits = subscriptionInfo?.userLimits;
    
    // If we have real limits, use them; otherwise fall back to plan-based calculation
    const limits = userLimits ? {
      admin: userLimits.admins.total,
      manager: userLimits.managers.total,
      employee: userLimits.employees.total
    } : {
      // Fallback to old plan-based logic
      admin: 1,
      manager: 1,
      employee: (subscription?.maxUsers || 12) - 2
    };

    // Count current users by role (including ALL users, not just filtered)
    const allEmployees = employees as any[] || [];
    const currentRoleCounts = {
      admin: allEmployees.filter(emp => emp.role === 'admin').length,
      manager: allEmployees.filter(emp => emp.role === 'manager').length,
      employee: allEmployees.filter(emp => emp.role === 'employee').length
    };
    
    return {
      limits,
      currentCounts: currentRoleCounts,
      available: {
        admin: Math.max(0, limits.admin - currentRoleCounts.admin),
        manager: Math.max(0, limits.manager - currentRoleCounts.manager),
        employee: Math.max(0, limits.employee - currentRoleCounts.employee)
      }
    };
  };

  // Check if a role change is allowed
  const canChangeToRole = (targetRole: string, currentEmployeeId?: number) => {
    const { available, currentCounts } = getRoleLimits();
    
    // If editing existing employee, we need to account for their current role
    if (currentEmployeeId) {
      const currentEmployee = employees.find((emp: any) => emp.id === currentEmployeeId);
      if (currentEmployee && currentEmployee.role === targetRole) {
        return true; // Same role, no change needed
      }
      
      // Calculate available slots considering the role change
      if (currentEmployee) {
        const adjustedAvailable = { ...available };
        // Free up the current role slot
        adjustedAvailable[currentEmployee.role as keyof typeof adjustedAvailable]++;
        return adjustedAvailable[targetRole as keyof typeof adjustedAvailable] > 0;
      }
    }
    
    // For new employees or role changes
    return available[targetRole as keyof typeof available] > 0;
  };

  // Build a quick map of employees currently in an approved absence
  const activeAbsenceByEmployee = useMemo(() => {
    if (!hasAbsencesAddon || !companyAbsences) return {} as Record<number, string>;
    const today = new Date();
    return (companyAbsences as any[]).reduce((acc: Record<number, string>, req: any) => {
      if (req.status !== 'approved') return acc;
      const start = req.startDate ? new Date(req.startDate) : null;
      const end = req.endDate ? new Date(req.endDate) : null;
      if (!start || !end) return acc;
      if (today >= start && today <= end) {
        const empId = req.userId || req.employeeId || req.user?.id;
        if (empId) acc[empId] = req.absenceType || 'vacation';
      }
      return acc;
    }, {});
  }, [companyAbsences, hasAbsencesAddon]);

  const computedEmployees = useMemo(() => {
    const list = (employees as any[]) || [];
    return list.map((emp) => {
      const baseStatus = emp.status || 'active';
      if (baseStatus === 'inactive') {
        return { ...emp, computedStatus: 'inactive' };
      }
      if (activeAbsenceByEmployee[emp.id]) {
        const absenceType = activeAbsenceByEmployee[emp.id];
        const mapped = absenceType === 'temporary_disability' ? 'leave' : 'absence';
        return { ...emp, computedStatus: mapped };
      }
      return { ...emp, computedStatus: baseStatus };
    });
  }, [employees, activeAbsenceByEmployee]);

  const employeeList = computedEmployees;
  const filteredTeamMembers = useMemo(() => {
    const baseMembers = (employeeList || []).filter((emp: any) => emp.role !== 'accountant');
    const query = teamMemberSearchTerm.trim().toLowerCase();

    if (!query) return baseMembers;

    return baseMembers.filter((emp: any) => {
      const roleLabel = translateRoleToSpanish(emp.role).toLowerCase();
      const teamNames = (memberTeamNamesByEmployeeId.get(emp.id) || []).join(' ').toLowerCase();
      const fullName = String(emp.fullName || '').toLowerCase();

      return fullName.includes(query) || roleLabel.includes(query) || teamNames.includes(query);
    });
  }, [employeeList, teamMemberSearchTerm, memberTeamNamesByEmployeeId]);

  const filteredEmployees = useMemo(() => {
    return (employeeList || []).filter((employee: any) => {
      // Filter by role if selected
      const matchesRole = roleFilter === 'todos' || employee.role === roleFilter;
      if (!matchesRole) return false;

      const matchesSearch = employee.fullName?.toLowerCase().includes(searchTerm.toLowerCase());

      // Check if employee is pending activation
      const isPending = employee.isPendingActivation === true;

      // Convert filter selection to actual database values
      const statusMap: Record<string, string> = {
        'activos': 'active',
        'inactivos': 'inactive',
        'pendientes': 'pending',
        'de baja': 'leave',
        'de vacaciones': 'vacation',
        'ausencia': 'absence'
      };

      const employeeStatus = employee.computedStatus || employee.status || 'active'; // Default to 'active' if no status

      // Handle both Spanish and English status values for compatibility
      const normalizedEmployeeStatus = (() => {
        // First check if pending activation
        if (isPending) return 'pending';

        const value = (employeeStatus || '').toLowerCase();
        switch (value) {
          case 'activo': return 'active';
          case 'inactivo': return 'inactive';
          case 'on_leave':
          case 'leave':
          case 'de baja':
            return 'leave';
          case 'on_vacation':
          case 'vacation':
          case 'de vacaciones':
            return 'vacation';
          case 'ausencia':
          case 'absence':
            return 'absence';
          default:
            return value || 'active';
        }
      })();

      // Check status match
      const matchesStatus = statusFilter === 'todos' ||
        normalizedEmployeeStatus === statusMap[statusFilter] ||
        normalizedEmployeeStatus === statusFilter;

      return matchesSearch && matchesStatus;
    }).sort((a: any, b: any) => {
      // Custom status priority: pendientes > activos > de vacaciones > inactivos
      const getPriority = (employee: any) => {
        const isPending = employee.isPendingActivation === true;
        if (isPending) return 1; // Pendientes primero

        const status = (employee.computedStatus || employee.status || 'active').toLowerCase();

        if (status === 'active' || status === 'activo') return 2; // Activos segundo
        if (status === 'vacation' || status === 'on_vacation' || status === 'de vacaciones') return 3; // Vacaciones tercero
        return 4; // Inactivos y otros al final
      };

      const priorityA = getPriority(a);
      const priorityB = getPriority(b);

      // Sort by priority (lower number = higher priority)
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // If same priority, sort alphabetically by name
      return (a.fullName || '').localeCompare(b.fullName || '');
    });
  }, [employeeList, roleFilter, searchTerm, statusFilter]);

  const displaySelectedStatus = selectedEmployee
    ? selectedEmployee.isPendingActivation ? 'pending' : (selectedEmployee.computedStatus || selectedEmployee.status || 'active')
    : 'active';

  const {
    displayedCount: displayedEmployeesCount,
    visibleItems: visibleEmployees,
    hasMore: hasMoreEmployeesToDisplay,
    loadMore: loadMoreEmployees,
  } = useIncrementalList({
    items: filteredEmployees,
    mobileInitialCount: 10,
    desktopInitialCount: 20,
    resetKey: `${searchTerm}-${statusFilter}-${roleFilter}-${activeTab}`,
  });

  useStandardInfiniteScroll({
    targetRef: loadMoreEmployeesRef,
    enabled: activeTab === 'employees',
    canLoadMore: hasMoreEmployeesToDisplay,
    onLoadMore: loadMoreEmployees,
    dependencyKey: `${activeTab}-${displayedEmployeesCount}-${filteredEmployees.length}`,
    rootMargin: '100px',
  });

  // Fetch detailed employee info for modal (ensures DNI available)
  const { data: selectedEmployeeDetail } = useQuery<any>({
    queryKey: ['/api/employees', selectedEmployee?.id],
    enabled: !!selectedEmployee && !!showEditModal,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const isSelectedEmployeeOriginalAdmin = useMemo(() => {
    const employeeData = selectedEmployeeDetail || selectedEmployee;
    if (!employeeData) return false;
    return Boolean(
      employeeData.isOriginalAdmin ||
      (employeeData.role === 'admin' && employeeData.createdBy === null)
    );
  }, [selectedEmployeeDetail, selectedEmployee]);

  const totalUsers = (employeeList || []).length;

  // 🔒 Function to check if current user can edit target employee
  const canEditEmployee = (employee: any) => {
    // Admins can edit anyone
    if (user?.role === 'admin') {
      return true;
    }
    
    // Managers have restrictions
    if (user?.role === 'manager') {
      // Managers cannot edit other managers
      if (employee.role === 'manager') {
        return false;
      }
      // Managers cannot edit their own profile
      if (employee.id === user.id) {
        return false;
      }
      // Managers cannot edit admins
      if (employee.role === 'admin') {
        return false;
      }
      // Managers can only edit employees
      return employee.role === 'employee';
    }
    
    // Employees cannot edit anyone
    return false;
  };

  // Function to handle opening edit modal
  const handleEditEmployee = (employee: any) => {
    // 🔒 Check permissions before opening modal
    if (!canEditEmployee(employee)) {
      toast({
        title: "Sin permisos",
        description: employee.id === user?.id 
          ? "No puedes editar tu propio perfil. Solo un administrador puede hacerlo."
          : employee.role === 'manager' 
          ? "No puedes editar perfiles de otros managers. Solo un administrador puede hacerlo."
          : "No tienes permisos para editar este perfil.",
        variant: "destructive",
      });
      return;
    }

    setSelectedEmployee(employee);
    setEditEmployee({
      companyEmail: employee.companyEmail || '',
      companyPhone: employee.companyPhone || '',
      position: employee.position || employee.role,
      startDate: employee.startDate ? new Date(employee.startDate) : new Date(),
      status: employee.status || 'active',
      role: employee.role || 'employee',
      vacationDaysAdjustment: Number(employee.vacationDaysAdjustment || 0),
      personalEmail: employee.personalEmail || '',
      personalPhone: employee.personalPhone || '',
      address: employee.address || '',
      emergencyContactName: employee.emergencyContactName || '',
      emergencyContactPhone: employee.emergencyContactPhone || '',
      workReportMode: normalizeWorkReportMode(employee.workReportMode),
    });
    setShowEditModal(true);
  };

  const handleOpenCreateUserModal = async () => {
    // Fetch once through React Query cache to avoid duplicate request paths
    const freshSubscription = await queryClient.fetchQuery<any>({
      queryKey: ['/api/account/subscription'],
    });

    const maxUsers = freshSubscription?.maxUsers || freshSubscription?.max_users || freshSubscription?.dynamic_max_users;
    const currentUserCount = employeeList?.length || 0;

    const usersByRole = (employeeList || []).reduce((acc: Record<string, number>, emp: any) => {
      acc[emp.role] = (acc[emp.role] || 0) + 1;
      return acc;
    }, {});

    logger.debug('USER LIMIT CHECK:', {
      maxUsers,
      currentUserCount,
      usersByRole,
      freshSubscription,
    });

    if (maxUsers && currentUserCount >= maxUsers) {
      setLimitMessage(`No puedes añadir más usuarios.\n\nTu suscripción permite máximo ${maxUsers} usuarios y actualmente tienes ${currentUserCount}.\n\nAñade más usuarios desde la Tienda.`);
      setShowLimitDialog(true);
      return;
    }

    const extraAdmins = freshSubscription?.extraAdmins || 0;
    const extraManagers = freshSubscription?.extraManagers || 0;
    const extraEmployees = freshSubscription?.extraEmployees || 0;

    const adminSeatsTotal = subscriptionInfo?.userLimits?.admins?.total ?? (extraAdmins + 1);
    const managerSeatsTotal = subscriptionInfo?.userLimits?.managers?.total ?? extraManagers;
    const employeeSeatsTotal = subscriptionInfo?.userLimits?.employees?.total ?? extraEmployees;

    const currentPlanLimits = {
      admin: adminSeatsTotal,
      manager: managerSeatsTotal,
      employee: employeeSeatsTotal,
    };
    logger.debug('ROLE LIMITS FOR PLAN:', currentPlanLimits);

    (window as any).currentRoleLimits = { planLimits: currentPlanLimits, usersByRole };
    setShowCreateModal(true);
  };

  // Helper function to translate status
  const translateStatus = (status: string) => {
    const translations: Record<string, string> = {
      'active': 'Activo',
      'inactive': 'Inactivo', 
      'leave': 'De baja',
      'vacation': 'De vacaciones',
      'absence': 'En ausencia',
      'on_leave': 'De baja',
      'on_vacation': 'De vacaciones',
      'pending': 'Pendiente',
      'pending_activation': 'Pendiente',
      // Spanish versions (in case they exist)
      'activo': 'Activo',
      'inactivo': 'Inactivo',
      'de baja': 'De baja',
      'de vacaciones': 'De vacaciones',
      'ausencia': 'En ausencia',
      'pendiente': 'Pendiente'
    };
    return translations[status] || status || 'Activo';
  };

  // Helper function to get status color
  const getStatusColor = (status: string) => {
    // Check both original status and translated status
    const normalizedStatus = status?.toLowerCase();
    switch (normalizedStatus) {
      case 'active':
      case 'activo': 
        return 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300';
      case 'inactive':
      case 'inactivo': 
        return 'bg-gray-100 dark:bg-gray-900/40 text-gray-700 dark:text-gray-300';
      case 'leave':
      case 'de baja': 
        return 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300';
      case 'absence':
      case 'ausencia':
        return 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300';
      case 'vacation':
      case 'de vacaciones': 
        return 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300';
      case 'on_leave':
        return 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300';
      case 'on_vacation':
        return 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300';
      case 'pending':
      case 'pending_activation':
      case 'pendiente':
        return 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300';
      default: 
        return 'bg-green-100 text-green-800';
    }
  };

  return (
    <div className="min-h-screen bg-background" style={{ overflowX: 'clip' }}>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-2 md:gap-6 mb-3">
        <StatsCard
          title="Total Usuarios"
          subtitle={`de ${subscriptionInfo?.userLimits?.totalUsers || subscription?.maxUsers || 12}`}
          value={totalUsers}
          color="blue"
          icon={Users}
          isActive={roleFilter === 'todos'}
          onClick={() => setRoleFilter('todos')}
        />
        <StatsCard
          title="Empleados"
          subtitle={`de ${subscriptionInfo?.userLimits?.employees?.total || 10}`}
          value={employeeList?.filter(emp => emp.role === 'employee').length || 0}
          color="orange"
          icon={User}
          isActive={roleFilter === 'employee'}
          onClick={() => setRoleFilter('employee')}
        />
        <StatsCard
          title="Managers"
          subtitle={`de ${subscriptionInfo?.userLimits?.managers?.total || 1}`}
          value={employeeList?.filter(emp => emp.role === 'manager').length || 0}
          color="green"
          icon={UserCheck}
          isActive={roleFilter === 'manager'}
          onClick={() => setRoleFilter('manager')}
        />
        <StatsCard
          title="Admins"
          subtitle={`de ${subscriptionInfo?.userLimits?.admins?.total || 1}`}
          value={employeeList?.filter(emp => emp.role === 'admin').length || 0}
          color="purple"
          icon={Shield}
          isActive={roleFilter === 'admin'}
          onClick={() => setRoleFilter('admin')}
        />
      </div>

      {/* Tab Navigation - Admin only shows both tabs */}
      {user?.role === 'admin' ? (
        <TabNavigation
          tabs={[
            { id: 'employees', label: isMobile ? 'Empleados' : 'Lista de Empleados', icon: Users },
            { id: 'teams', label: 'Equipos', icon: Users },
            { id: 'managers', label: isMobile ? 'Managers' : 'Gestión de Managers', icon: ShieldCheck },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      ) : null}

      {/* Tab Content: Employee List */}
      {activeTab === 'employees' && (
        <div className="space-y-4">
          {/* Unified Toolbar: search + filters + create in one line */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 min-h-[40px]">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Buscar empleados..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Desktop: Filters + Create grouped */}
            <div className="hidden sm:flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2"
              >
                <Filter className="w-4 h-4" />
                Filtros
              </Button>
              <Button onClick={handleOpenCreateUserModal} size="sm" className="bg-oficaz-primary hover:bg-oficaz-primary/90">
              <UserPlus className="h-4 w-4 mr-2" />
              Crear Usuario
            </Button>
            </div>

            {/* Mobile: search and buttons in grid */}
            <div className="sm:hidden space-y-2 w-full">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Buscar empleados..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center justify-center gap-1"
                >
                  <Filter className="w-4 h-4" />
                  <span className="text-xs">Filtros</span>
                </Button>
                <Button size="sm" className="bg-oficaz-primary hover:bg-oficaz-primary/90" onClick={handleOpenCreateUserModal}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Crear
                </Button>
              </div>
            </div>
          </div>

          {/* Filters Section - role + status */}
          {showFilters && (
            <div className={FILTER_PANEL_CLASS}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={FILTER_LABEL_CLASS}>Rol</label>
                  <Select value={roleFilter} onValueChange={(v: any) => setRoleFilter(v)}>
                    <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
                      <SelectValue placeholder="Seleccionar rol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="employee">Empleado</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className={FILTER_LABEL_CLASS}>Estado</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
                      <SelectValue placeholder="Filtrar por estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="pendientes">Pendientes</SelectItem>
                      <SelectItem value="activos">Activos</SelectItem>
                      <SelectItem value="inactivos">Inactivos</SelectItem>
                      <SelectItem value="de baja">De baja</SelectItem>
                      <SelectItem value="ausencia">En ausencia</SelectItem>
                      <SelectItem value="de vacaciones">De vacaciones</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          
          <div className="space-y-3">
            {isLoadingEmployees ? (
              <ListLoadingState message="empleados" />
            ) : filteredEmployees.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No hay empleados que coincidan con los filtros seleccionados.
              </div>
            ) : (
              visibleEmployees.map((employee: any) => {
              const displayStatus = employee.isPendingActivation ? 'pending' : (employee.computedStatus || employee.status || 'active');
              return (
              <div key={employee.id} className="relative bg-card dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-all hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600">
                {/* Mobile Swipe Container */}
                <div className="sm:hidden">
                  {/* Background Colors - Full width to prevent white showing */}
                  <div className="absolute inset-0 flex rounded-lg overflow-hidden">
                    {/* Green Call Background - Left side, icon positioned near edge */}
                    {(employee.companyPhone || employee.personalPhone) ? (
                      <div className="w-24 bg-green-500 flex items-center justify-start pl-4">
                        <Phone className="h-6 w-6 text-white" />
                      </div>
                    ) : (
                      <div className="w-24 bg-gray-400 flex items-center justify-start pl-4">
                        <Phone className="h-6 w-6 text-white opacity-50" />
                      </div>
                    )}
                    
                    {/* Blue Message Background - Right side, icon positioned near edge */}
                    <div className="flex-1"></div>
                    <div className="w-24 bg-blue-500 flex items-center justify-end pr-4">
                      <MessageCircle className="h-6 w-6 text-white" />
                    </div>
                  </div>

                  {/* Swipeable Content */}
                  <div 
                    className="employee-card bg-card dark:bg-gray-800 relative z-10 p-4"
                    onDoubleClick={() => handleEditEmployee(employee)}
                    onTouchStart={(e) => {
                      const touch = e.touches[0];
                      e.currentTarget.setAttribute('data-start-x', touch.clientX.toString());
                      e.currentTarget.setAttribute('data-tap-count', '0');
                      e.currentTarget.setAttribute('data-is-swiping', 'false');
                    }}
                    onTouchMove={(e) => {
                      const touch = e.touches[0];
                      const startX = parseFloat(e.currentTarget.getAttribute('data-start-x') || '0');
                      const diff = touch.clientX - startX;
                      
                      if (Math.abs(diff) > 5) {
                        e.preventDefault();
                        e.currentTarget.setAttribute('data-is-swiping', 'true');
                        
                        // Block left swipe if no phone available
                        if (diff > 0 && !(employee.companyPhone || employee.personalPhone)) {
                          return; // Don't allow swipe right for call if no phone
                        }
                        
                        // Limit swipe distance more strictly - 30% less
                        const maxSwipe = 56; // Reduced from 80px to 56px (30% less)
                        const constrainedDiff = Math.max(-maxSwipe, Math.min(maxSwipe, diff));
                        e.currentTarget.style.transform = `translateX(${constrainedDiff}px)`;
                        e.currentTarget.style.transition = 'none';
                        logger.debug(`Swipe: ${constrainedDiff}px`);
                      }
                    }}
                    onTouchEnd={(e) => {
                      const transform = e.currentTarget.style.transform;
                      const match = transform.match(/translateX\((.+?)px\)/);
                      const currentX = match ? parseFloat(match[1]) : 0;
                      const isSwiping = e.currentTarget.getAttribute('data-is-swiping') === 'true';
                      
                      // Always reset first to avoid getting stuck
                      e.currentTarget.style.transition = 'transform 0.2s ease-out';
                      e.currentTarget.style.transform = 'translateX(0px)';
                      
                      if (isSwiping && Math.abs(currentX) > 35) {
                        logger.debug(`Swipe detected: currentX=${currentX}, isSwiping=${isSwiping}`);
                        
                        // Swipe actions
                        if (currentX > 0 && (employee.companyPhone || employee.personalPhone)) {
                          const phone = employee.companyPhone || employee.personalPhone;
                          logger.debug(`RIGHT SWIPE CALL: ${phone}`);
                          
                          // Android-specific workaround: Show call confirmation
                          const isAndroid = /Android/i.test(navigator.userAgent);
                          
                          if (isAndroid) {
                            // For Android: Show confirmation and direct dial
                            if (confirm(`¿Llamar a ${employee.fullName}?\n${phone}`)) {
                              // Try multiple methods for Android
                              try {
                                window.open(`tel:${phone}`, '_self');
                              } catch (e) {
                                try {
                                  window.location.assign(`tel:${phone}`);
                                } catch (e2) {
                                  window.location.href = `tel:${phone}`;
                                }
                              }
                            }
                          } else {
                            // For iOS and other platforms: Direct call
                            const triggerCall = () => {
                              const link = document.createElement('a');
                              link.href = `tel:${phone}`;
                              link.style.display = 'none';
                              document.body.appendChild(link);
                              
                              link.addEventListener('click', function() {
                                logger.debug('Call link clicked successfully');
                              });
                              
                              link.click();
                              
                              setTimeout(() => {
                                if (document.body.contains(link)) {
                                  document.body.removeChild(link);
                                }
                              }, 500);
                            };
                            
                            requestAnimationFrame(() => {
                              setTimeout(triggerCall, 100);
                            });
                          }
                          
                        } else if (currentX < 0) {
                          logger.debug(`LEFT SWIPE MESSAGE: ${employee.id}`);
                          setTimeout(() => {
                            navigate(`/test/mensajes?chat=${employee.id}`);
                          }, 100);
                        }
                      } else if (!isSwiping) {
                        // Handle double tap for edit - simplified approach
                        const now = Date.now();
                        const lastTap = parseInt(e.currentTarget.getAttribute('data-last-tap') || '0');
                        
                        if (now - lastTap < 300) {
                          // Double tap detected
                          handleEditEmployee(employee);
                          e.currentTarget.setAttribute('data-last-tap', '0');
                        } else {
                          // First tap
                          e.currentTarget.setAttribute('data-last-tap', now.toString());
                        }
                      }
                      
                      e.currentTarget.setAttribute('data-is-swiping', 'false');
                    }}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex flex-col items-center">
                        <UserAvatar fullName={employee.fullName || ''} size="md" userId={employee.id} profilePicture={employee.profilePicture} role={employee.role} />
                        <Badge className={`${getStatusColor(displayStatus)} capitalize border-0 text-xs mt-2`}>
                          {translateStatus(displayStatus)}
                        </Badge>
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="font-medium text-foreground">{employee.fullName}</p>
                        <div className="text-sm text-muted-foreground">
                          {employee.position || 'Sin cargo especificado'}
                        </div>
                        <div className="min-h-[20px]">
                          {(employee.companyEmail || employee.personalEmail) ? (
                            <a 
                              href={`mailto:${employee.companyEmail || employee.personalEmail}`}
                              className="text-sm text-blue-600 dark:text-blue-400 block hover:underline dark:hover:text-blue-300 break-words truncate max-w-full"
                              onClick={(e) => e.stopPropagation()}
                              title={employee.companyEmail || employee.personalEmail}
                            >
                              {employee.companyEmail || employee.personalEmail}
                            </a>
                          ) : (
                            <span className="text-sm text-gray-400 dark:text-gray-600">Sin email</span>
                          )}
                        </div>
                        <div className="min-h-[20px]">
                          {(employee.companyPhone || employee.personalPhone) ? (
                            <a 
                              href={`tel:${employee.companyPhone || employee.personalPhone}`}
                              className="text-sm text-blue-600 dark:text-blue-400 block hover:underline dark:hover:text-blue-300 break-words truncate max-w-full"
                              onClick={(e) => e.stopPropagation()}
                              title={employee.companyPhone || employee.personalPhone}
                            >
                              {employee.companyPhone || employee.personalPhone}
                            </a>
                          ) : (
                            <span className="text-sm text-gray-400 dark:text-gray-600">Sin teléfono</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Desktop View */}
                <div 
                  className={`hidden sm:flex items-stretch ${
                    canEditEmployee(employee) 
                      ? "cursor-pointer" 
                      : "cursor-not-allowed opacity-75"
                  }`}
                  onClick={() => handleEditEmployee(employee)}
                >
                  {/* Contenido principal */}
                  <div className="flex items-center p-4 flex-1">
                    <div className="flex items-center space-x-4 flex-1">
                      <UserAvatar fullName={employee.fullName || ''} size="md" userId={employee.id} profilePicture={employee.profilePicture} role={employee.role} />
                      <div className="flex-1 grid grid-cols-[minmax(150px,1fr)_minmax(200px,1fr)_minmax(120px,1fr)] gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground">{employee.fullName}</p>
                            {!canEditEmployee(employee) && employee.id === user?.id && (
                              <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                                Tu perfil
                              </Badge>
                            )}
                            {!canEditEmployee(employee) && employee.role === 'manager' && employee.id !== user?.id && (
                              <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                                Solo admin
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground min-h-[20px]">
                            {employee.position || 'Sin cargo especificado'}
                          </div>
                        </div>
                        <div className="min-h-[40px] flex items-center">
                          {(employee.companyEmail || employee.personalEmail) ? (
                            <a 
                              href={`mailto:${employee.companyEmail || employee.personalEmail}`}
                              className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Mail className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{employee.companyEmail || employee.personalEmail}</span>
                            </a>
                          ) : (
                            <span className="text-sm text-gray-400 dark:text-gray-600">Sin email</span>
                          )}
                        </div>
                        <div className="min-h-[40px] flex items-center">
                          {(employee.companyPhone || employee.personalPhone) ? (
                            <a 
                              href={`tel:${employee.companyPhone || employee.personalPhone}`}
                              className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Phone className="h-3 w-3 flex-shrink-0" />
                              <span>{employee.companyPhone || employee.personalPhone}</span>
                            </a>
                          ) : (
                            <span className="text-sm text-gray-400 dark:text-gray-600">Sin teléfono</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Sección coloreada de estado - punta derecha */}
                  <div className={`w-[90px] flex items-center justify-center flex-shrink-0 ${getStatusColor(displayStatus)}`}>
                    <span className="text-xs font-semibold capitalize">
                      {translateStatus(displayStatus)}
                    </span>
                  </div>
                </div>
              </div>
              );
            })
            )}

            {!isLoadingEmployees ? (
              <InfiniteListFooter
                hasMore={hasMoreEmployeesToDisplay}
                sentinelRef={loadMoreEmployeesRef}
                onLoadMore={loadMoreEmployees}
                hintText={`Mostrando ${visibleEmployees.length} de ${filteredEmployees.length} empleados`}
              />
            ) : null}
          </div>
        </div>
      )}

      {/* Tab Content: Teams - Admin only */}
      {activeTab === 'teams' && user?.role === 'admin' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <div ref={teamEditorRef}>
          <Card className="bg-card dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3 min-h-8">
                <CardTitle className="text-base sm:text-lg tracking-tight">
                  {editingTeamId ? 'Detalle del equipo' : 'Crear equipo'}
                </CardTitle>
                <div
                  className={`h-8 w-[108px] flex items-center justify-end gap-1.5 ${showTeamHeaderActions ? '' : 'invisible pointer-events-none'}`}
                  aria-hidden={!showTeamHeaderActions}
                >
                  {showTeamHeaderActions ? (
                    <>
                    <ModalActionButton
                      intent="neutral"
                      title="Cancelar"
                      onClick={() => {
                        setEditingTeamId(null);
                        setIsTeamFormEditable(true);
                        setTeamName('');
                        setTeamDescription('');
                        setTeamSelectedMembers([]);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </ModalActionButton>

                    {(editingTeamId === null || isTeamFormEditable) ? (
                      <ModalActionButton
                        intent="save"
                        title="Guardar"
                        onClick={() => saveTeamMutation.mutate()}
                        disabled={saveTeamMutation.isPending || !teamName.trim() || !isTeamFormEditable}
                      >
                        <Check className="h-4 w-4" />
                      </ModalActionButton>
                    ) : null}

                    {editingTeamId !== null && !isTeamFormEditable ? (
                      <ModalActionButton
                        intent="edit"
                        title="Editar"
                        onClick={() => setIsTeamFormEditable(true)}
                      >
                        <Edit className="h-4 w-4" />
                      </ModalActionButton>
                    ) : null}

                    </>
                  ) : null}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-600 dark:text-slate-300">Nombre del equipo</Label>
                  <Input
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="Ej: Equipo Norte"
                    className="h-11 rounded-2xl border-slate-300/80 dark:border-slate-600/80 bg-white/90 dark:bg-slate-950/70"
                    disabled={!isTeamFormEditable}
                  />
                </div>
                <div>
                  <Label className="text-slate-600 dark:text-slate-300">Descripción (opcional)</Label>
                  <Input
                    value={teamDescription}
                    onChange={(e) => setTeamDescription(e.target.value)}
                    placeholder="Zona o función del equipo"
                    className="h-11 rounded-2xl border-slate-300/80 dark:border-slate-600/80 bg-white/90 dark:bg-slate-950/70"
                    disabled={!isTeamFormEditable}
                  />
                </div>
              </div>

              <div>
                <Label className="text-slate-600 dark:text-slate-300">Miembros</Label>
                <div className="mt-2 mb-2 relative">
                  <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    value={teamMemberSearchTerm}
                    onChange={(e) => setTeamMemberSearchTerm(e.target.value)}
                    placeholder="Buscar por nombre, rol o grupo"
                    className="h-10 pl-9 rounded-xl border-slate-300/80 dark:border-slate-600/80 bg-white/90 dark:bg-slate-950/70"
                    disabled={!isTeamFormEditable}
                  />
                </div>
                <div className="mt-2 max-h-56 overflow-y-auto rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-900/60 p-2 space-y-1.5">
                  {filteredTeamMembers.map((emp: any) => {
                    const selected = teamSelectedMembers.includes(emp.id);
                    const memberTeamNames = memberTeamNamesByEmployeeId.get(emp.id) || [];
                    return (
                      <button
                        key={`team-member-${emp.id}`}
                        type="button"
                        onClick={() => {
                          if (!isTeamFormEditable) return;
                          setTeamSelectedMembers((prev) =>
                            prev.includes(emp.id) ? prev.filter((id) => id !== emp.id) : [...prev, emp.id]
                          );
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all ${
                          selected
                            ? 'bg-white dark:bg-slate-800 border border-sky-300/70 dark:border-sky-700/70 shadow-sm'
                            : 'border border-transparent hover:bg-white/80 dark:hover:bg-slate-800/70'
                        }`}
                        disabled={!isTeamFormEditable}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <UserAvatar fullName={emp.fullName || ''} size="sm" userId={emp.id} profilePicture={emp.profilePicture} role={emp.role} />
                          <div className="truncate">
                            <p className="text-sm font-medium truncate">{emp.fullName}</p>
                            <p className="text-xs text-muted-foreground truncate">{translateRoleToSpanish(emp.role)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {teams.length > 0 ? (
                            <div className="flex items-center gap-1">
                              {memberTeamNames.length > 0 ? (
                                memberTeamNames.slice(0, 2).map((teamName) => (
                                  <span
                                    key={`employee-${emp.id}-team-${teamName}`}
                                    className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-200 max-w-[96px] truncate"
                                  >
                                    {teamName}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200/60 dark:bg-slate-700/60 text-slate-500 dark:text-slate-300">
                                  Sin grupo
                                </span>
                              )}
                              {memberTeamNames.length > 2 ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-300/80 dark:bg-slate-600/80 text-slate-700 dark:text-slate-200">
                                  +{memberTeamNames.length - 2}
                                </span>
                              ) : null}
                            </div>
                          ) : null}

                          <span className="inline-flex w-4 h-4 items-center justify-center">
                            {selected ? <Check className="h-4 w-4 text-blue-600" /> : null}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                  {filteredTeamMembers.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-2 py-2">No se encontraron empleados con ese criterio.</p>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
          </div>

          <div className="space-y-3">
            <div className="px-1">
              <h3 className="text-base sm:text-lg font-semibold tracking-tight text-foreground">Equipos creados</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Selecciona un equipo para verlo y editarlo en la columna izquierda.</p>
            </div>

            {loadingTeams ? (
              <p className="text-sm text-muted-foreground px-1">Cargando equipos...</p>
            ) : teams.length === 0 ? (
              <p className="text-sm text-muted-foreground px-1">Todavía no hay equipos creados.</p>
            ) : (
              <div className="space-y-3">
                {teams.map((team: TeamWithMembers) => (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => {
                      setEditingTeamId(team.id);
                      setIsTeamFormEditable(false);
                      setTeamName(team.name || '');
                      setTeamDescription(team.description || '');
                      setTeamSelectedMembers(resolveTeamMemberIds(teams, team.id));
                      focusTeamEditorOnMobile();
                    }}
                    className={`w-full bg-card dark:bg-gray-800 rounded-2xl shadow-sm border px-4 py-3.5 text-left transition-all ${
                      editingTeamId === team.id
                        ? 'border-sky-300/70 dark:border-sky-700/70 ring-1 ring-sky-200/80 dark:ring-sky-800/80'
                        : 'border-gray-200 dark:border-gray-700 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{team.name}</p>
                      <Badge variant="outline" className="rounded-full border-slate-300/80 dark:border-slate-600/80 text-slate-700 dark:text-slate-300">
                        {team.memberCount} {team.memberCount === 1 ? 'persona' : 'personas'}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab Content: Manager Permissions - Admin only */}
      {activeTab === 'managers' && user?.role === 'admin' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                <Settings className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <span className="text-sm sm:text-lg font-medium">Permisos de Managers</span>
                <p className="text-sm text-muted-foreground font-normal">Configura qué acciones y funcionalidades pueden ver los managers</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Features Grid - Visible Features for Managers */}
              {/* Note: messages and reminders are always enabled for managers, not configurable */}
              {companyAddons && companyAddons.filter(ca => ca.status === 'active' && !['messages', 'reminders'].includes(ca.addon.key)).length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Eye className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      Nivel de Acceso por Funcionalidad
                    </p>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    <strong>Completo</strong>: acceso total como administrador. <strong>Solo lectura</strong>: solo pueden ver (sin editar).
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
                    {companyAddons.filter(ca => ca.status === 'active' && !['messages', 'reminders'].includes(ca.addon.key)).map((ca) => {
                      const isVisible = hasConfiguredFeatures 
                        ? managerPermissions.visibleFeatures.includes(ca.addon.key)
                        : true;
                      const getFeatureIcon = (key: string) => {
                        switch (key) {
                          case 'time_tracking': return <Clock className="h-6 w-6" />;
                          case 'vacation': return <CalendarDays className="h-6 w-6" />;
                          case 'schedules': return <LayoutGrid className="h-6 w-6" />;
                          case 'messages': return <MessageCircle className="h-6 w-6" />;
                          case 'reminders': return <Bell className="h-6 w-6" />;
                          case 'work_reports': return <FileText className="h-6 w-6" />;
                          case 'documents': return <FolderOpen className="h-6 w-6" />;
                          case 'ai_assistant': return <Sparkles className="h-6 w-6" />;
                          default: return <Settings className="h-6 w-6" />;
                        }
                      };
                      const getFeatureColor = (_key: string, active: boolean) => {
                        if (!active) {
                          return 'bg-gray-200/90 text-gray-500 dark:bg-gray-800/90 dark:text-gray-500 border border-transparent shadow-none';
                        }
                        return 'bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100 border border-gray-200/90 dark:border-gray-700/90 shadow-[0_4px_12px_rgba(15,23,42,0.08)] dark:shadow-[0_4px_14px_rgba(0,0,0,0.35)]';
                      };
                      const getFeatureName = (key: string) => {
                        switch (key) {
                          case 'time_tracking': return 'Fichajes';
                          case 'vacation': return 'Vacaciones';
                          case 'schedules': return 'Cuadrante';
                          case 'messages': return 'Mensajes';
                          case 'reminders': return 'Tareas';
                          case 'work_reports': return 'Partes';
                          case 'documents': return 'Documentos';
                          case 'ai_assistant': return 'OficazIA';
                          default: return ca.addon.name;
                        }
                      };
                      return (
                        <button
                          key={ca.addon.key}
                          onClick={() => {
                            const activeAddonKeys = companyAddons.filter(ca => ca.status === 'active').map(ca => ca.addon.key);
                            let currentFeatures = hasConfiguredFeatures 
                              ? managerPermissions.visibleFeatures 
                              : activeAddonKeys;
                            
                            const newVisibleFeatures = isVisible
                              ? currentFeatures.filter(f => f !== ca.addon.key)
                              : [...currentFeatures, ca.addon.key];
                            
                            setHasConfiguredFeatures(true);
                            const newPermissions = { ...managerPermissions, visibleFeatures: newVisibleFeatures };
                            setManagerPermissions(newPermissions);
                            updatePermissionsMutation.mutate(newPermissions);
                          }}
                          className={`flex flex-col items-center justify-center p-4 rounded-2xl transition-all duration-200 ${getFeatureColor(ca.addon.key, isVisible)} ${isVisible ? 'scale-[1.01]' : 'opacity-75 hover:opacity-95'}`}
                          title={isVisible 
                            ? `Restringir ${getFeatureName(ca.addon.key)} a solo lectura con datos propios` 
                            : `Dar acceso completo a ${getFeatureName(ca.addon.key)}`}
                        >
                          {getFeatureIcon(ca.addon.key)}
                          <span className="text-xs font-medium mt-2 truncate w-full text-center">
                            {getFeatureName(ca.addon.key)}
                          </span>
                          <span className="text-[10px] mt-1 opacity-70">
                            {isVisible ? 'Completo' : 'Solo lectura'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Management Permissions */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    Permisos de Gestión
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Permission: Create/Delete Employees */}
                  <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex-1 pr-4">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Crear/borrar empleados
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Permite gestionar usuarios con rol empleado
                      </p>
                    </div>
                    <Switch
                      checked={managerPermissions.canCreateDeleteEmployees}
                      onCheckedChange={(checked) => {
                        const newPermissions = { ...managerPermissions, canCreateDeleteEmployees: checked };
                        setManagerPermissions(newPermissions);
                        updatePermissionsMutation.mutate(newPermissions);
                      }}
                      className={managerPermissionSwitchClass}
                    />
                  </div>

                  {/* Permission: Create/Delete Managers */}
                  <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex-1 pr-4">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Crear/borrar managers
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Permite gestionar otros managers
                      </p>
                    </div>
                    <Switch
                      checked={managerPermissions.canCreateDeleteManagers}
                      onCheckedChange={(checked) => {
                        const newPermissions = { ...managerPermissions, canCreateDeleteManagers: checked };
                        setManagerPermissions(newPermissions);
                        updatePermissionsMutation.mutate(newPermissions);
                      }}
                      className={managerPermissionSwitchClass}
                    />
                  </div>

                  {/* Permission: Buy/Remove Features */}
                  <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex-1 pr-4">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Comprar/eliminar funcionalidades
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Permite gestionar add-ons de la suscripción
                      </p>
                    </div>
                    <Switch
                      checked={managerPermissions.canBuyRemoveFeatures}
                      onCheckedChange={(checked) => {
                        const newPermissions = { ...managerPermissions, canBuyRemoveFeatures: checked };
                        setManagerPermissions(newPermissions);
                        updatePermissionsMutation.mutate(newPermissions);
                      }}
                      className={managerPermissionSwitchClass}
                    />
                  </div>

                  {/* Permission: Buy/Remove Users */}
                  <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex-1 pr-4">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Comprar/eliminar usuarios
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Permite añadir o quitar asientos de usuarios
                      </p>
                    </div>
                    <Switch
                      checked={managerPermissions.canBuyRemoveUsers}
                      onCheckedChange={(checked) => {
                        const newPermissions = { ...managerPermissions, canBuyRemoveUsers: checked };
                        setManagerPermissions(newPermissions);
                        updatePermissionsMutation.mutate(newPermissions);
                      }}
                      className={managerPermissionSwitchClass}
                    />
                  </div>

                  {/* Permission: Edit Company Data */}
                  <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex-1 pr-4">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Editar datos de empresa
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Permite acceder a la pestaña Empresa en configuración
                      </p>
                    </div>
                    <Switch
                      checked={managerPermissions.canEditCompanyData}
                      onCheckedChange={(checked) => {
                        const newPermissions = { ...managerPermissions, canEditCompanyData: checked };
                        setManagerPermissions(newPermissions);
                        updatePermissionsMutation.mutate(newPermissions);
                      }}
                      className={managerPermissionSwitchClass}
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create User Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-4xl w-full max-h-[95vh] overflow-hidden">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Crear Nuevo Empleado
            </DialogTitle>
          </DialogHeader>
          
          <div className="overflow-y-auto max-h-[calc(95vh-140px)] px-1">
            {/* Simplified Form Layout */}
            <div className="space-y-6">
              {/* Required Fields */}
              <div className="bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 rounded-xl p-6">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                    <Shield className="h-3 w-3 text-red-600 dark:text-red-400" />
                  </div>
                  Campos Obligatorios
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="newFullName" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Nombre Completo <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="newFullName"
                      value={newEmployee.fullName}
                      onChange={(e) => setNewEmployee({ ...newEmployee, fullName: e.target.value })}
                      placeholder="Juan Pérez García"
                      className="mt-1"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="newDni" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      DNI/NIE <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="newDni"
                      value={newEmployee.dni}
                      onChange={(e) => setNewEmployee({ ...newEmployee, dni: e.target.value })}
                      placeholder="12345678Z"
                      className="mt-1"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="newStartDate" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Fecha de Incorporación <span className="text-red-500">*</span>
                    </Label>
                    <div className="mt-1">
                      <DatePickerDayEmployee
                        date={newEmployee.startDate}
                        onDateChange={(date) => setNewEmployee({ ...newEmployee, startDate: date || new Date() })}
                        placeholder="Seleccionar fecha"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="newRole" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Tipo de Usuario <span className="text-red-500">*</span>
                    </Label>
                    {user?.role === 'admin' ? (
                      <>
                        <Select 
                          value={newEmployee.role}
                          onValueChange={(value) => {
                            setNewEmployee({ ...newEmployee, role: value });
                          }}
                        >
                          <SelectTrigger className="w-full mt-1">
                            <SelectValue placeholder="Seleccionar tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            {(() => {
                              const limits = (window as any).currentRoleLimits;
                              if (!limits) {
                                return (
                                  <>
                                    <SelectItem value="employee">Empleado</SelectItem>
                                    <SelectItem value="manager">Manager</SelectItem>
                                    <SelectItem value="admin">Administrador</SelectItem>
                                  </>
                                );
                              }
                              
                              const adminCount = limits.usersByRole.admin || 0;
                              const managerCount = limits.usersByRole.manager || 0;
                              const employeeCount = limits.usersByRole.employee || 0;
                              const adminLimit = limits.planLimits.admin;
                              const managerLimit = limits.planLimits.manager;
                              const employeeLimit = limits.planLimits.employee;
                              
                              const adminRemaining = adminLimit === 999 ? 999 : Math.max(0, adminLimit - adminCount);
                              const managerRemaining = managerLimit === 999 ? 999 : Math.max(0, managerLimit - managerCount);
                              const employeeRemaining = employeeLimit === 999 ? 999 : Math.max(0, employeeLimit - employeeCount);
                              
                              return (
                                <>
                                  <SelectItem 
                                    value="employee" 
                                    disabled={employeeRemaining === 0}
                                  >
                                    Empleado {employeeRemaining === 999 ? '' : `(${employeeRemaining} restantes)`}
                                  </SelectItem>
                                  <SelectItem 
                                    value="manager" 
                                    disabled={managerRemaining === 0}
                                  >
                                    Manager {managerRemaining === 999 ? '' : `(${managerRemaining} restantes)`}
                                  </SelectItem>
                                  <SelectItem 
                                    value="admin" 
                                    disabled={adminRemaining === 0}
                                  >
                                    Administrador {adminRemaining === 999 ? '' : `(${adminRemaining} restantes)`}
                                  </SelectItem>
                                </>
                              );
                            })()}
                          </SelectContent>
                        </Select>
                      </>
                    ) : (
                      <div className="mt-1">
                        <div className="flex items-center justify-between p-3 bg-muted border border-border rounded-md">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Empleado</span>
                          <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                            Por defecto
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Como manager, solo puedes crear usuarios con rol de empleado
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Email for Activation */}
              <div className="bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <Mail className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                  </div>
                  Email de Activación
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  <span className="text-red-500">*</span> Debe proporcionar al menos uno de estos emails donde se enviará el correo de bienvenida para configurar la contraseña
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="newCompanyEmail" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Email Corporativo
                    </Label>
                    <Input
                      id="newCompanyEmail"
                      type="email"
                      value={newEmployee.companyEmail}
                      onChange={(e) => setNewEmployee({ ...newEmployee, companyEmail: e.target.value })}
                      placeholder="empleado@empresa.com"
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="newPersonalEmail" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Email Personal
                    </Label>
                    <Input
                      id="newPersonalEmail"
                      type="email"
                      value={newEmployee.personalEmail}
                      onChange={(e) => setNewEmployee({ ...newEmployee, personalEmail: e.target.value })}
                      placeholder="email@personal.com"
                      className="mt-1"
                    />
                  </div>
                </div>
                
                <div className="mt-3 text-center">
                  <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
                    Al menos uno de los emails es obligatorio
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center sm:justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700 mt-6">
              <Button 
                variant="outline" 
                onClick={() => setShowCreateModal(false)} 
                disabled={createEmployeeMutation.isPending}
                className="w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleCreateEmployee} 
                disabled={createEmployeeMutation.isPending}
                className="w-full sm:w-auto"
              >
                {createEmployeeMutation.isPending ? 'Creando...' : 'Crear Empleado'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Employee Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent showCloseButton={false} className="max-w-7xl w-[96vw] max-h-[94vh] overflow-hidden p-0 rounded-2xl sm:rounded-[28px] border border-black/10 dark:border-white/10 bg-[#f8f8fa] dark:bg-[#111216] shadow-2xl">
          <ModalHeaderWithActions
            title="Editar Empleado"
            className="px-5 md:px-6 py-4 border-b border-black/5 dark:border-white/10 bg-white/75 dark:bg-zinc-950/75 backdrop-blur-xl"
            titleClassName="text-xl font-semibold text-gray-900 dark:text-gray-100"
            actions={(
              <>
                <ModalActionButton
                  intent="neutral"
                  title="Cerrar"
                  onClick={() => setShowEditModal(false)}
                  disabled={updateEmployeeMutation.isPending}
                >
                  <X className="h-4 w-4" />
                </ModalActionButton>
                <ModalActionButton
                  intent="save"
                  title="Guardar cambios"
                  onClick={handleSaveEmployee}
                  disabled={updateEmployeeMutation.isPending}
                >
                  <Check className="h-4 w-4" />
                </ModalActionButton>
              </>
            )}
          />
          
          {selectedEmployee && (
            <div className="overflow-y-auto max-h-[calc(94vh-72px)] px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-5">
              {/* Employee Header */}
              <div className="bg-gradient-to-r from-oficaz-primary/8 via-white to-sky-50 dark:from-oficaz-primary/12 dark:via-zinc-900 dark:to-sky-950/30 p-3 sm:p-5 rounded-[20px] sm:rounded-[24px] mb-4 sm:mb-5 border border-black/5 dark:border-white/10 shadow-sm">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="hidden sm:block"><UserAvatar fullName={selectedEmployee.fullName || ''} size="lg" userId={selectedEmployee.id} profilePicture={selectedEmployee.profilePicture} showUpload={true} /></div>
                  <div className="block sm:hidden"><UserAvatar fullName={selectedEmployee.fullName || ''} size="md" userId={selectedEmployee.id} profilePicture={selectedEmployee.profilePicture} showUpload={false} /></div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base sm:text-xl text-gray-900 dark:text-gray-100 truncate">{selectedEmployee.fullName}</h3>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm text-gray-600 dark:text-gray-400 mt-1 sm:mt-1.5">
                      <div className="flex items-center gap-1">
                        <IdCard className="h-3 w-3" />
                        <span>{selectedEmployeeDetail?.dni || selectedEmployee?.dni || ''}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        <span>{translateRoleToSpanish(editEmployee.role)}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <Badge className={`${getStatusColor(displaySelectedStatus)} capitalize border-0 rounded-full px-3 py-1`}>
                      {translateStatus(displaySelectedStatus)}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 items-start xl:items-stretch">
                <div className="bg-white/88 dark:bg-zinc-900/88 border border-black/5 dark:border-white/10 rounded-[24px] p-5 shadow-sm backdrop-blur h-full">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                        <Shield className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                      </div>
                    Entorno laboral
                  </h4>

                  <div className="space-y-4">
                    <div className="space-y-3 rounded-2xl bg-slate-50/90 dark:bg-zinc-950/70 border border-black/5 dark:border-white/10 p-4">
                      <div>
                        <Label htmlFor="companyEmail" className="text-sm font-medium text-gray-700 dark:text-gray-300">Email Corporativo</Label>
                        <Input
                          id="companyEmail"
                          type="email"
                          value={editEmployee.companyEmail}
                          onChange={(e) => setEditEmployee({ ...editEmployee, companyEmail: e.target.value })}
                          placeholder="empleado@empresa.com"
                          className="mt-1 rounded-xl"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="companyPhone" className="text-sm font-medium text-gray-700 dark:text-gray-300">Teléfono Corporativo</Label>
                        <Input
                          id="companyPhone"
                          value={editEmployee.companyPhone}
                          onChange={(e) => setEditEmployee({ ...editEmployee, companyPhone: e.target.value })}
                          placeholder="666 666 666"
                          className="mt-1 rounded-xl"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="position" className="text-sm font-medium text-gray-700 dark:text-gray-300">Cargo/Puesto</Label>
                        <Input
                          id="position"
                          value={editEmployee.position}
                          onChange={(e) => setEditEmployee({ ...editEmployee, position: e.target.value })}
                          placeholder="Administrativo, Técnico, etc."
                          className="mt-1 rounded-xl"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="startDate" className="text-sm font-medium text-gray-700 dark:text-gray-300">Fecha de Incorporación</Label>
                        <div className="mt-1 rounded-xl overflow-hidden">
                          <DatePickerDayEmployee
                            date={editEmployee.startDate}
                            onDateChange={(date) => setEditEmployee({ ...editEmployee, startDate: date || new Date() })}
                            placeholder="Seleccionar fecha"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor="status" className="text-sm font-medium text-gray-700 dark:text-gray-300">Estado del Empleado</Label>
                        <Select 
                          value={editEmployee.status}
                          onValueChange={(value) => setEditEmployee({ ...editEmployee, status: value })}
                        >
                          <SelectTrigger className="w-full mt-1 rounded-xl">
                            <SelectValue placeholder="Seleccionar estado" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Activo</SelectItem>
                            <SelectItem value="inactive">Inactivo</SelectItem>
                            <SelectItem value="leave">De baja</SelectItem>
                            <SelectItem value="vacation">De vacaciones</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                    </div>

                    <div className="space-y-3 rounded-2xl bg-slate-50/90 dark:bg-zinc-950/70 border border-black/5 dark:border-white/10 p-4">
                      <div>
                        <Label htmlFor="role" className="text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de Usuario</Label>
                        {/* ⚠️ PROTECTED: Original admin (createdBy === null) cannot have role changed */}
                        {isSelectedEmployeeOriginalAdmin ? (
                          <div className="mt-1">
                            <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                              <span className="text-sm font-medium text-amber-700 dark:text-amber-300">Administrador Original</span>
                              <Badge variant="secondary" className="bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">
                                Protegido
                              </Badge>
                            </div>
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                              El administrador original de la empresa no puede cambiar de rol
                            </p>
                          </div>
                        ) : user?.role === 'admin' ? (
                          <Select 
                            value={editEmployee.role}
                            onValueChange={(value) => setEditEmployee({ ...editEmployee, role: value })}
                          >
                            <SelectTrigger className="w-full mt-1 rounded-xl">
                              <SelectValue placeholder="Seleccionar tipo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem 
                                value="employee"
                                disabled={!canChangeToRole('employee', selectedEmployee?.id)}
                              >
                                Empleado {!canChangeToRole('employee', selectedEmployee?.id) && '(Límite alcanzado)'}
                              </SelectItem>
                              <SelectItem 
                                value="manager"
                                disabled={!canChangeToRole('manager', selectedEmployee?.id)}
                              >
                                Manager {!canChangeToRole('manager', selectedEmployee?.id) && '(Límite alcanzado)'}
                              </SelectItem>
                              <SelectItem 
                                value="admin"
                                disabled={!canChangeToRole('admin', selectedEmployee?.id)}
                              >
                                Administrador {!canChangeToRole('admin', selectedEmployee?.id) && '(Límite alcanzado)'}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Select 
                            value={editEmployee.role}
                            onValueChange={(value) => setEditEmployee({ ...editEmployee, role: value })}
                          >
                            <SelectTrigger className="w-full mt-1 rounded-xl">
                              <SelectValue placeholder="Seleccionar tipo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem 
                                value="employee"
                                disabled={!canChangeToRole('employee', selectedEmployee?.id)}
                              >
                                Empleado {!canChangeToRole('employee', selectedEmployee?.id) && '(Límite alcanzado)'}
                              </SelectItem>
                              <SelectItem 
                                value="manager"
                                disabled={!canChangeToRole('manager', selectedEmployee?.id)}
                              >
                                Manager {!canChangeToRole('manager', selectedEmployee?.id) && '(Límite alcanzado)'}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        {user?.role === 'manager' && !isSelectedEmployeeOriginalAdmin && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Como manager, no puedes asignar rol de administrador
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white/88 dark:bg-zinc-900/88 border border-black/5 dark:border-white/10 rounded-[24px] p-5 shadow-sm backdrop-blur h-full">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                      <User className="h-3 w-3 text-green-600 dark:text-green-400" />
                    </div>
                    Información personal
                  </h4>

                  <div className="space-y-4">
                    <div className="space-y-3 rounded-2xl bg-slate-50/90 dark:bg-zinc-950/70 border border-black/5 dark:border-white/10 p-4">
                      <div>
                        <Label htmlFor="personalEmail" className="text-sm font-medium text-gray-700 dark:text-gray-300">Email Personal</Label>
                        <Input
                          id="personalEmail"
                          type="email"
                          value={editEmployee.personalEmail}
                          onChange={(e) => setEditEmployee({ ...editEmployee, personalEmail: e.target.value })}
                          placeholder="email@personal.com"
                          className="mt-1 rounded-xl"
                        />
                      </div>

                      <div>
                        <Label htmlFor="personalPhone" className="text-sm font-medium text-gray-700 dark:text-gray-300">Teléfono Personal</Label>
                        <Input
                          id="personalPhone"
                          value={editEmployee.personalPhone}
                          onChange={(e) => setEditEmployee({ ...editEmployee, personalPhone: e.target.value })}
                          placeholder="+34 666 666 666"
                          className="mt-1 rounded-xl"
                        />
                      </div>

                      <div>
                        <Label htmlFor="address" className="text-sm font-medium text-gray-700 dark:text-gray-300">Dirección</Label>
                        <Input
                          id="address"
                          value={editEmployee.address}
                          onChange={(e) => setEditEmployee({ ...editEmployee, address: e.target.value })}
                          placeholder="Calle, número, ciudad..."
                          className="mt-1 rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="space-y-3 rounded-2xl bg-slate-50/90 dark:bg-zinc-950/70 border border-black/5 dark:border-white/10 p-4">
                      <h5 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Contacto de emergencia</h5>
                      <div>
                        <Label htmlFor="emergencyContactName" className="text-sm font-medium text-gray-700 dark:text-gray-300">Persona de Contacto</Label>
                        <Input
                          id="emergencyContactName"
                          value={editEmployee.emergencyContactName}
                          onChange={(e) => setEditEmployee({ ...editEmployee, emergencyContactName: e.target.value })}
                          placeholder="Nombre del contacto de emergencia"
                          className="mt-1 rounded-xl"
                        />
                      </div>

                      <div>
                        <Label htmlFor="emergencyContactPhone" className="text-sm font-medium text-gray-700 dark:text-gray-300">Teléfono de Contacto</Label>
                        <Input
                          id="emergencyContactPhone"
                          value={editEmployee.emergencyContactPhone}
                          onChange={(e) => setEditEmployee({ ...editEmployee, emergencyContactPhone: e.target.value })}
                          placeholder="+34 666 666 666"
                          className="mt-1 rounded-xl"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 h-full">
                  <div className="bg-white/88 dark:bg-zinc-900/88 border border-black/5 dark:border-white/10 rounded-[24px] p-5 shadow-sm backdrop-blur">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
                      <div className="w-7 h-7 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center">
                        <ClipboardList className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                      </div>
                      Partes de Obra
                    </h4>
                    
                    <div className="space-y-3">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                        Configura cómo este empleado puede crear partes de obra/trabajo.
                      </p>
                      
                      <div className="space-y-2">
                        <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors">
                          <input
                            type="radio"
                            name="workReportMode"
                            value="disabled"
                            checked={editEmployee.workReportMode === 'disabled'}
                            onChange={() => setEditEmployee({ ...editEmployee, workReportMode: 'disabled' })}
                            className="mt-0.5"
                          />
                          <div>
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Sin acceso</span>
                            <p className="text-xs text-gray-500 dark:text-gray-400">El empleado no puede crear partes de obra.</p>
                          </div>
                        </label>
                        
                        <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors">
                          <input
                            type="radio"
                            name="workReportMode"
                            value="manual"
                            checked={editEmployee.workReportMode === 'manual'}
                            onChange={() => setEditEmployee({ ...editEmployee, workReportMode: 'manual' })}
                            className="mt-0.5"
                          />
                          <div>
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Acceso manual</span>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Icono en el dashboard. Crea partes cuando quiera.</p>
                          </div>
                        </label>
                        
                        <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors">
                          <input
                            type="radio"
                            name="workReportMode"
                            value="both"
                            checked={editEmployee.workReportMode === 'both' || editEmployee.workReportMode === 'on_clockout'}
                            onChange={() => setEditEmployee({ ...editEmployee, workReportMode: 'both' })}
                            className="mt-0.5"
                          />
                          <div>
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Ambas opciones</span>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Icono en dashboard + popup al fichar salida.</p>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/88 dark:bg-zinc-900/88 border border-black/5 dark:border-white/10 rounded-[24px] p-5 shadow-sm backdrop-blur">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
                      <div className="w-7 h-7 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                        <Calendar className="h-3 w-3 text-green-600 dark:text-green-400" />
                      </div>
                      Gestión de Vacaciones
                    </h4>
                    
                    <div className="space-y-3">
                      {/* Current Vacation Status */}
                      <div className="bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-900/30 dark:to-green-900/30 p-3 rounded-2xl border border-blue-100 dark:border-blue-800">
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-lg font-bold text-blue-600">
                              {(() => {
                                const total = Number(selectedEmployee?.totalVacationDays || 0);
                                const adjustment = Number(editEmployee?.vacationDaysAdjustment || 0);
                                return Math.round(total + adjustment);
                              })()}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">Total</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-orange-600">
                              {Math.round(Number(selectedEmployee?.usedVacationDays || 0))}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">Usados</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-green-600">
                              {(() => {
                                const total = Number(selectedEmployee?.totalVacationDays || 0);
                                const adjustment = Number(editEmployee?.vacationDaysAdjustment || 0);
                                const used = Number(selectedEmployee?.usedVacationDays || 0);
                                return Math.max(0, Math.round((total + adjustment) - used));
                              })()}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">Disponibles</p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Vacation Adjustment Controls */}
                      <div>
                        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                          Ajuste Manual
                        </Label>
                        <div className="bg-muted p-3 rounded-2xl">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => adjustVacationDays(-1)}
                              className="w-8 h-8 p-0 rounded-full"
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            
                            <Input
                              type="number"
                              value={editEmployee.vacationDaysAdjustment || 0}
                              onChange={(e) => {
                                const value = e.target.value === '' ? '0' : e.target.value;
                                const numValue = parseInt(value, 10);
                                if (!isNaN(numValue)) {
                                  setEditEmployee({ ...editEmployee, vacationDaysAdjustment: numValue });
                                }
                              }}
                              className="w-16 text-center font-bold"
                              step="1"
                              min="-50"
                              max="50"
                            />
                            
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => adjustVacationDays(1)}
                              className="w-8 h-8 p-0 rounded-full"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1">
                            Días extra (+ o -)
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {canUseCrm && (
                    <div className="bg-white/88 dark:bg-zinc-900/88 border border-black/5 dark:border-white/10 rounded-[24px] p-5 shadow-sm backdrop-blur">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                          <Users className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                        </div>
                        Proyectos (CRM)
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                        Gestiona los proyectos a los que tiene acceso este empleado.
                      </p>

                      {/* Búsqueda global */}
                      <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400" />
                        <Input
                          placeholder="Buscar proyecto..."
                          value={employeeProjectSearch}
                          onChange={(e) => setEmployeeProjectSearch(e.target.value)}
                          className="pl-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                        />
                      </div>

                      {/* Dos columnas: Disponibles | Asignados */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Disponibles */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Disponibles ({filteredAvailableProjects.length})
                            </span>
                            {filteredAvailableProjects.length > 0 && (
                              <button
                                type="button"
                                onClick={() => filteredAvailableProjects.forEach(p => assignProjectMutation.mutate(p.id))}
                                disabled={assignProjectMutation.isPending}
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                              >
                                Añadir todos
                              </button>
                            )}
                          </div>
                          <div className="h-64 overflow-y-auto space-y-1 bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-2 border border-gray-200 dark:border-gray-700">
                            {filteredAvailableProjects.length === 0 ? (
                              <div className="text-center py-8 text-xs text-gray-500 dark:text-gray-400">
                                {employeeProjectSearch ? 'No hay proyectos que coincidan' : 'Todos asignados'}
                              </div>
                            ) : (
                              filteredAvailableProjects.map((project) => (
                                <div
                                  key={project.id}
                                  onClick={() => assignProjectMutation.mutate(project.id)}
                                  className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20 group"
                                >
                                  <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center transition-colors group-hover:border-blue-600" />
                                  <span className="text-sm text-gray-900 dark:text-white flex-1">
                                    {project.name}
                                    {project.code ? <span className="ml-2 text-xs text-gray-500">({project.code})</span> : null}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        {/* Asignados */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Asignados ({filteredAssignedProjects.length})
                            </span>
                            {filteredAssignedProjects.length > 0 && (
                              <button
                                type="button"
                                onClick={() => filteredAssignedProjects.forEach(p => removeProjectMutation.mutate(p.id))}
                                disabled={removeProjectMutation.isPending}
                                className="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                              >
                                Eliminar todos
                              </button>
                            )}
                          </div>
                          <div className="h-64 overflow-y-auto space-y-1 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl p-2 border border-blue-200 dark:border-blue-800">
                            {filteredAssignedProjects.length === 0 ? (
                              <div className="text-center py-8 text-xs text-gray-500 dark:text-gray-400">
                                {employeeProjectSearch ? 'No hay proyectos que coincidan' : 'Ningún proyecto asignado'}
                              </div>
                            ) : (
                              filteredAssignedProjects.map((project) => (
                                <div
                                  key={project.id}
                                  onClick={() => removeProjectMutation.mutate(project.id)}
                                  className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 group"
                                >
                                  <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center transition-colors">
                                    <Check className="h-3 w-3 text-white" />
                                  </div>
                                  <span className="text-sm text-gray-900 dark:text-white flex-1">
                                    {project.name}
                                    {project.code ? <span className="ml-2 text-xs text-gray-500">({project.code})</span> : null}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons - Responsive layout */}
              <div className="flex flex-col sm:flex-row sm:justify-between gap-3 pt-4 sm:pt-5 border-t border-black/5 dark:border-white/10 mt-4 sm:mt-6">
                {/* Delete Button */}
                <Button 
                  variant="destructive" 
                  onClick={() => setShowDeleteModal(true)} 
                  disabled={updateEmployeeMutation.isPending || deleteEmployeeMutation.isPending}
                  className="bg-red-600 hover:bg-red-700 w-full sm:w-auto"
                >
                  Eliminar Empleado
                </Button>
                
                {/* Save/Cancel Buttons */}
                <div className="flex gap-3 w-full sm:w-auto">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowEditModal(false)} 
                    disabled={updateEmployeeMutation.isPending}
                    className="flex-1 sm:flex-initial"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleSaveEmployee} 
                    disabled={updateEmployeeMutation.isPending}
                    className="flex-1 sm:flex-initial"
                  >
                    {updateEmployeeMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 dark:text-red-400">Confirmar Eliminación</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                    ¡Atención! Esta acción no se puede deshacer
                  </h3>
                  <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                    <p>
                      Estás a punto de eliminar permanentemente al empleado{' '}
                      <strong>{selectedEmployee?.fullName}</strong> y todos sus datos asociados:
                    </p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Registros de tiempo y fichajes</li>
                      <li>Solicitudes de vacaciones</li>
                      <li>Documentos subidos</li>
                      <li>Mensajes y comunicaciones</li>
                      <li>Cuenta de usuario y acceso</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmText" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Para confirmar, escribe: <strong>ELIMINAR PERMANENTEMENTE</strong>
              </Label>
              <Input
                id="confirmText"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Escribe ELIMINAR PERMANENTEMENTE"
                className="font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowDeleteModal(false);
                setDeleteConfirmText('');
              }}
              disabled={deleteEmployeeMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteEmployee}
              disabled={
                deleteConfirmText !== 'ELIMINAR PERMANENTEMENTE' || 
                deleteEmployeeMutation.isPending
              }
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteEmployeeMutation.isPending ? 'Eliminando...' : 'Eliminar Permanentemente'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para mostrar límite de usuarios alcanzado */}
      <Dialog open={showLimitDialog} onOpenChange={setShowLimitDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
                <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Límite de usuarios alcanzado
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-600 dark:text-gray-400">
                  No puedes crear más usuarios con tu suscripción actual.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="py-4">
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">
                {limitMessage}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button 
              onClick={() => setShowLimitDialog(false)}
              className="w-full"
            >
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}