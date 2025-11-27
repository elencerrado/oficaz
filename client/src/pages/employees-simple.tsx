import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import StatsCard from '@/components/StatsCard';
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
  AlertCircle,
  AlertTriangle,
  Trash2,
  Lock,
  ClipboardList
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { DatePickerDayEmployee } from '@/components/ui/date-picker';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { usePageHeader } from '@/components/layout/page-header';

export default function EmployeesSimple() {
  const { user, token } = useAuth();
  const { setHeader, resetHeader } = usePageHeader();

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
  const [statusFilter, setStatusFilter] = useState('activos'); // Default to active
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const [limitMessage, setLimitMessage] = useState('');
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

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mutation for updating employee
  const updateEmployeeMutation = useMutation({
    mutationFn: (data: any) => apiRequest('PATCH', `/api/employees/${selectedEmployee?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
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
    
    updateEmployeeMutation.mutate({
      companyEmail: editEmployee.companyEmail,
      companyPhone: editEmployee.companyPhone,
      position: editEmployee.position,
      startDate: editEmployee.startDate instanceof Date 
        ? editEmployee.startDate.toISOString().split('T')[0]
        : editEmployee.startDate,
      status: editEmployee.status,
      role: editEmployee.role,
      vacationDaysAdjustment: editEmployee.vacationDaysAdjustment,
      personalEmail: editEmployee.personalEmail,
      personalPhone: editEmployee.personalPhone,
      address: editEmployee.address,
      emergencyContactName: editEmployee.emergencyContactName,
      emergencyContactPhone: editEmployee.emergencyContactPhone,
      workReportMode: editEmployee.workReportMode === 'disabled' ? null : editEmployee.workReportMode,
    });
  };

  const adjustVacationDays = (increment: number) => {
    const currentAdjustment = editEmployee.vacationDaysAdjustment || 0;
    const newAdjustment = Math.max(-50, Math.min(50, currentAdjustment + increment));
    setEditEmployee({ ...editEmployee, vacationDaysAdjustment: newAdjustment });
  };

  const handleDeleteEmployee = () => {
    if (deleteConfirmText === 'ELIMINAR PERMANENTEMENTE' && selectedEmployee) {
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
        description: `No puedes añadir más usuarios. Tu plan permite máximo ${maxUsers} usuarios y actualmente tienes ${currentUserCount}.`,
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

  const { data: employees = [] } = useQuery({
    queryKey: ['/api/employees'],
    enabled: !!user && (user.role === 'admin' || user.role === 'manager')
  });

  // Query to get subscription info for user limits
  const { data: subscription } = useQuery({
    queryKey: ['/api/account/subscription'],
    staleTime: 0, // Always fetch fresh data for user limits
  });

  // Function to calculate role limits and availability
  const getRoleLimits = () => {
    const planName = subscription?.plan || 'basic';
    
    // Define role limits by plan (same as server logic)
    const roleLimits: Record<string, Record<string, number>> = {
      'basic': {
        admin: 1,
        manager: 1,
        employee: (subscription?.maxUsers || 5) - 2
      },
      'pro': {
        admin: 1,
        manager: 3,
        employee: (subscription?.maxUsers || 30) - 4
      },
      'master': {
        admin: 999, // Unlimited
        manager: 999, // Unlimited
        employee: 999 // Unlimited
      }
    };

    // Count current users by role (including ALL users, not just filtered)
    const allEmployees = employees as any[] || [];
    const currentRoleCounts = {
      admin: allEmployees.filter(emp => emp.role === 'admin').length,
      manager: allEmployees.filter(emp => emp.role === 'manager').length,
      employee: allEmployees.filter(emp => emp.role === 'employee').length
    };

    const limits = roleLimits[planName] || roleLimits['basic'];
    
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

  const employeeList = employees as any[];
  const filteredEmployees = (employeeList || []).filter((employee: any) => {
    // First check if it's not an admin
    const notAdmin = employee.role !== 'admin';
    if (!notAdmin) return false;
    
    const matchesSearch = employee.fullName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Convert filter selection to actual database values
    const statusMap: Record<string, string> = {
      'activos': 'active',
      'inactivos': 'inactive', 
      'de baja': 'on_leave',
      'de vacaciones': 'on_vacation'
    };
    
    const employeeStatus = employee.status || 'active'; // Default to 'active' if no status
    
    // Handle both Spanish and English status values for compatibility
    const normalizedEmployeeStatus = employeeStatus === 'activo' ? 'active' : employeeStatus;
    
    // Check status match
    const matchesStatus = statusFilter === 'todos' || 
                         normalizedEmployeeStatus === statusMap[statusFilter] ||
                         normalizedEmployeeStatus === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

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
      workReportMode: employee.workReportMode || 'disabled',
    });
    setShowEditModal(true);
  };

  // Helper function to translate status
  const translateStatus = (status: string) => {
    const translations: Record<string, string> = {
      'active': 'Activo',
      'inactive': 'Inactivo', 
      'leave': 'De baja',
      'vacation': 'De vacaciones',
      // Spanish versions (in case they exist)
      'activo': 'Activo',
      'inactivo': 'Inactivo',
      'de baja': 'De baja',
      'de vacaciones': 'De vacaciones'
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
        return 'bg-green-100 text-green-800';
      case 'inactive':
      case 'inactivo': 
        return 'bg-gray-100 text-gray-800';
      case 'leave':
      case 'de baja': 
        return 'bg-red-100 text-red-800';
      case 'vacation':
      case 'de vacaciones': 
        return 'bg-blue-100 text-blue-800';
      default: 
        return 'bg-green-100 text-green-800';
    }
  };

  return (
    <div className="min-h-screen bg-background" style={{ overflowX: 'clip' }}>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-2 md:gap-6 mb-3">
        <StatsCard
          title="Usuarios"
          subtitle={`de ${subscription?.maxUsers || 30}`}
          value={totalUsers}
          color="blue"
          icon={Users}
        />
        <StatsCard
          title="Managers"
          subtitle="de 3"
          value={employeeList?.filter(emp => emp.role === 'manager').length || 0}
          color="green"
          icon={UserCheck}
        />
        <StatsCard
          title="Empleados"
          subtitle={`de ${(subscription?.maxUsers || 30) - 4}`}
          value={employeeList?.filter(emp => emp.role === 'employee').length || 0}
          color="orange"
          icon={User}
        />
        <StatsCard
          title="Admins"
          subtitle="de 1"
          value={employeeList?.filter(emp => emp.role === 'admin').length || 0}
          color="purple"
          icon={Shield}
        />
      </div>

      {/* Employee List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
            <span className="text-sm sm:text-lg font-medium">Lista de Empleados</span>
            
            {/* Button in card header */}
            <Button onClick={async () => {
              // CRITICAL: Force fresh subscription data
              queryClient.invalidateQueries({ queryKey: ['/api/account/subscription'] });
              
              // Get fresh data directly from API with auth token
              const freshSubscription = await fetch('/api/account/subscription', {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              }).then(r => r.json());
              
              const maxUsers = freshSubscription?.maxUsers || freshSubscription?.max_users || freshSubscription?.dynamic_max_users;
              const currentUserCount = employeeList?.length || 0;
              const planName = freshSubscription?.plan || 'basic';
              
              // Count users by role for validation
              const usersByRole = (employeeList || []).reduce((acc: Record<string, number>, emp: any) => {
                acc[emp.role] = (acc[emp.role] || 0) + 1;
                return acc;
              }, {});
              
              console.log('USER LIMIT CHECK:', { 
                maxUsers, 
                currentUserCount, 
                planName,
                usersByRole,
                freshSubscription 
              });
              
              // Check total user limit first
              if (maxUsers && currentUserCount >= maxUsers) {
                setLimitMessage(`No puedes añadir más usuarios.\n\nTu plan permite máximo ${maxUsers} usuarios y actualmente tienes ${currentUserCount}.\n\nContacta con soporte para ampliar tu plan.`);
                setShowLimitDialog(true);
                return; // Do NOT open modal
              }
              
              // Define role limits by plan (same as backend)
              const roleLimits: Record<string, Record<string, number>> = {
                'basic': {
                  admin: 1,
                  manager: 1,
                  employee: (maxUsers || 5) - 2
                },
                'pro': {
                  admin: 1,
                  manager: 3,
                  employee: (maxUsers || 30) - 4
                },
                'master': {
                  admin: 999,
                  manager: 999,
                  employee: 999
                }
              };
              
              // Store role limits for modal validation
              const currentPlanLimits = roleLimits[planName] || roleLimits['basic'];
              console.log('ROLE LIMITS FOR PLAN:', currentPlanLimits);
              
              // Store in component state for modal use
              (window as any).currentRoleLimits = { planLimits: currentPlanLimits, usersByRole };
              
              setShowCreateModal(true);
            }} size="sm">
              <UserPlus className="h-4 w-4 mr-2" />
              Crear Usuario
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search and Filter Bar - Integrated */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Buscar empleados..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                <SelectItem value="activos">Activos</SelectItem>
                <SelectItem value="inactivos">Inactivos</SelectItem>
                <SelectItem value="de baja">De baja</SelectItem>
                <SelectItem value="de vacaciones">De vacaciones</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-3">
            {filteredEmployees.map((employee: any) => (
              <div key={employee.id} className="relative">
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
                    className="employee-card bg-card border rounded-lg relative z-10 p-4"
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
                        console.log(`Swipe: ${constrainedDiff}px`);
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
                        console.log(`Swipe detected: currentX=${currentX}, isSwiping=${isSwiping}`);
                        
                        // Swipe actions
                        if (currentX > 0 && (employee.companyPhone || employee.personalPhone)) {
                          const phone = employee.companyPhone || employee.personalPhone;
                          console.log(`RIGHT SWIPE CALL: ${phone}`);
                          
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
                                console.log('Call link clicked successfully');
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
                          console.log(`LEFT SWIPE MESSAGE: ${employee.id}`);
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
                        <Badge className={`${getStatusColor(employee.status)} capitalize border-0 text-xs mt-2`}>
                          {translateStatus(employee.status)}
                        </Badge>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">{employee.fullName}</p>
                        <p className="text-sm text-muted-foreground">{employee.position || 'Sin cargo especificado'}</p>
                        {(employee.companyEmail || employee.personalEmail) && (
                          <a 
                            href={`mailto:${employee.companyEmail || employee.personalEmail}`}
                            className="text-sm text-blue-600 mt-1 block hover:underline break-words truncate max-w-full"
                            onClick={(e) => e.stopPropagation()}
                            title={employee.companyEmail || employee.personalEmail}
                          >
                            {employee.companyEmail || employee.personalEmail}
                          </a>
                        )}
                        {(employee.companyPhone || employee.personalPhone) && (
                          <a 
                            href={`tel:${employee.companyPhone || employee.personalPhone}`}
                            className="text-sm text-blue-600 block hover:underline break-words truncate max-w-full"
                            onClick={(e) => e.stopPropagation()}
                            title={employee.companyPhone || employee.personalPhone}
                          >
                            {employee.companyPhone || employee.personalPhone}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Desktop View */}
                <div 
                  className={`hidden sm:block bg-card border rounded-lg p-4 ${
                    canEditEmployee(employee) 
                      ? "hover:bg-muted cursor-pointer" 
                      : "cursor-not-allowed opacity-75"
                  }`}
                  onClick={() => handleEditEmployee(employee)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <UserAvatar fullName={employee.fullName || ''} size="md" userId={employee.id} profilePicture={employee.profilePicture} role={employee.role} />
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
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{employee.position || 'Sin cargo especificado'}</span>
                          {(employee.companyEmail || employee.personalEmail) && (
                            <a 
                              href={`mailto:${employee.companyEmail || employee.personalEmail}`}
                              className="text-blue-600 hover:text-blue-800 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {employee.companyEmail || employee.personalEmail}
                            </a>
                          )}
                          {(employee.companyPhone || employee.personalPhone) && (
                            <a 
                              href={`tel:${employee.companyPhone || employee.personalPhone}`}
                              className="text-blue-600 hover:text-blue-800 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {employee.companyPhone || employee.personalPhone}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={`${getStatusColor(employee.status)} capitalize border-0`}>
                        {translateStatus(employee.status)}
                      </Badge>
                      {canEditEmployee(employee) ? (
                        <Edit className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Lock className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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
        <DialogContent className="max-w-4xl w-full max-h-[95vh] overflow-hidden">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Editar Empleado
            </DialogTitle>
          </DialogHeader>
          
          {selectedEmployee && (
            <div className="overflow-y-auto max-h-[calc(95vh-140px)] px-1">
              {/* Employee Header */}
              <div className="bg-gradient-to-r from-oficaz-primary/5 to-blue-50 dark:from-oficaz-primary/10 dark:to-blue-950/30 p-4 rounded-lg mb-4">
                <div className="flex items-center gap-3">
                  <UserAvatar fullName={selectedEmployee.fullName || ''} size="lg" userId={selectedEmployee.id} profilePicture={selectedEmployee.profilePicture} showUpload={true} />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 truncate">{selectedEmployee.fullName}</h3>
                    <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400 mt-1">
                      <div className="flex items-center gap-1">
                        <IdCard className="h-3 w-3" />
                        <span>{selectedEmployee.dni}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <Badge className={`${getStatusColor(selectedEmployee.status)} capitalize border-0`}>
                      {translateStatus(selectedEmployee.status)}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Left Column - Corporate Fields */}
                <div className="space-y-4">
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                        <Shield className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                      </div>
                      Información Corporativa
                    </h4>
                    
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="companyEmail" className="text-sm font-medium text-gray-700 dark:text-gray-300">Email Corporativo</Label>
                        <Input
                          id="companyEmail"
                          type="email"
                          value={editEmployee.companyEmail}
                          onChange={(e) => setEditEmployee({ ...editEmployee, companyEmail: e.target.value })}
                          placeholder="empleado@empresa.com"
                          className="mt-1"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="companyPhone" className="text-sm font-medium text-gray-700 dark:text-gray-300">Teléfono Corporativo</Label>
                        <Input
                          id="companyPhone"
                          value={editEmployee.companyPhone}
                          onChange={(e) => setEditEmployee({ ...editEmployee, companyPhone: e.target.value })}
                          placeholder="666 666 666"
                          className="mt-1"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="position" className="text-sm font-medium text-gray-700 dark:text-gray-300">Cargo/Puesto</Label>
                        <Input
                          id="position"
                          value={editEmployee.position}
                          onChange={(e) => setEditEmployee({ ...editEmployee, position: e.target.value })}
                          placeholder="Administrativo, Técnico, etc."
                          className="mt-1"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="startDate" className="text-sm font-medium text-gray-700 dark:text-gray-300">Fecha de Incorporación</Label>
                        <div className="mt-1">
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
                          <SelectTrigger className="w-full mt-1">
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

                      <div>
                        <Label htmlFor="role" className="text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de Usuario</Label>
                        {user?.role === 'admin' ? (
                          <Select 
                            value={editEmployee.role}
                            onValueChange={(value) => setEditEmployee({ ...editEmployee, role: value })}
                          >
                            <SelectTrigger className="w-full mt-1">
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
                            <SelectTrigger className="w-full mt-1">
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
                        {user?.role === 'manager' && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Como manager, no puedes asignar rol de administrador
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column - Personal Info */}
                <div className="space-y-4">
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                        <User className="h-3 w-3 text-green-600 dark:text-green-400" />
                      </div>
                      Información Personal
                    </h4>
                    
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="personalEmail" className="text-sm font-medium text-gray-700 dark:text-gray-300">Email Personal</Label>
                        <Input
                          id="personalEmail"
                          type="email"
                          value={editEmployee.personalEmail}
                          onChange={(e) => setEditEmployee({ ...editEmployee, personalEmail: e.target.value })}
                          placeholder="email@personal.com"
                          className="mt-1"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="personalPhone" className="text-sm font-medium text-gray-700 dark:text-gray-300">Teléfono Personal</Label>
                        <Input
                          id="personalPhone"
                          value={editEmployee.personalPhone}
                          onChange={(e) => setEditEmployee({ ...editEmployee, personalPhone: e.target.value })}
                          placeholder="+34 666 666 666"
                          className="mt-1"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="address" className="text-sm font-medium text-gray-700 dark:text-gray-300">Dirección</Label>
                        <Input
                          id="address"
                          value={editEmployee.address}
                          onChange={(e) => setEditEmployee({ ...editEmployee, address: e.target.value })}
                          placeholder="Calle, número, ciudad..."
                          className="mt-1"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="emergencyContactName" className="text-sm font-medium text-gray-700 dark:text-gray-300">Persona de Contacto</Label>
                        <Input
                          id="emergencyContactName"
                          value={editEmployee.emergencyContactName}
                          onChange={(e) => setEditEmployee({ ...editEmployee, emergencyContactName: e.target.value })}
                          placeholder="Nombre del contacto de emergencia"
                          className="mt-1"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="emergencyContactPhone" className="text-sm font-medium text-gray-700 dark:text-gray-300">Teléfono de Contacto</Label>
                        <Input
                          id="emergencyContactPhone"
                          value={editEmployee.emergencyContactPhone}
                          onChange={(e) => setEditEmployee({ ...editEmployee, emergencyContactPhone: e.target.value })}
                          placeholder="+34 666 666 666"
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Vacation Management */}
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                        <Calendar className="h-3 w-3 text-green-600 dark:text-green-400" />
                      </div>
                      Gestión de Vacaciones
                    </h4>
                    
                    <div className="space-y-3">
                      {/* Current Vacation Status */}
                      <div className="bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-900/30 dark:to-green-900/30 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
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
                        <div className="bg-muted p-3 rounded-lg">
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

                  {/* Work Reports Configuration */}
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                        <ClipboardList className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                      </div>
                      Partes de Obra
                    </h4>
                    
                    <div className="space-y-3">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                        Configura cómo este empleado puede crear partes de obra/trabajo.
                      </p>
                      
                      <div className="space-y-2">
                        <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors">
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
                        
                        <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors">
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
                        
                        <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors">
                          <input
                            type="radio"
                            name="workReportMode"
                            value="on_clockout"
                            checked={editEmployee.workReportMode === 'on_clockout'}
                            onChange={() => setEditEmployee({ ...editEmployee, workReportMode: 'on_clockout' })}
                            className="mt-0.5"
                          />
                          <div>
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Al fichar salida</span>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Popup automático al fichar salida. Sin borradores.</p>
                          </div>
                        </label>
                        
                        <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors">
                          <input
                            type="radio"
                            name="workReportMode"
                            value="both"
                            checked={editEmployee.workReportMode === 'both'}
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
                </div>
              </div>

              {/* Action Buttons - Responsive layout */}
              <div className="flex flex-col sm:flex-row sm:justify-between gap-3 pt-4 border-t border-gray-200 dark:border-gray-700 mt-6">
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
                  No puedes crear más usuarios en tu plan actual.
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