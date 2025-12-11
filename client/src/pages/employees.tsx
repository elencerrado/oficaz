import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { usePageTitle } from '@/hooks/use-page-title';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { UserAvatar } from '@/components/ui/user-avatar';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { 
  Users, 
  UserPlus, 
  Search,
  Mail,
  Shield,
  User,
  Clock,
  Calendar,
  IdCard,
  Edit,
  Phone,
  MapPin,
  AlertTriangle,
  Plus,
  Minus,
  CheckCircle,
  XCircle,
  Pause,
  Plane,
  MessageCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

// Función para traducir roles al español
const translateRole = (role: string | undefined) => {
  if (!role) return 'Empleado';
  switch (role.toLowerCase()) {
    case 'admin':
    case 'administrator':
      return 'Administrador';
    case 'manager':
      return 'Manager';
    case 'employee':
      return 'Empleado';
    default:
      return 'Empleado';
  }
};

export default function Employees() {
  usePageTitle('Gestión de Empleados');
  const [, navigate] = useLocation();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [newEmployee, setNewEmployee] = useState({
    fullName: '',
    dni: '',
    companyEmail: '',
    role: 'employee',
    password: '',
    startDate: new Date().toISOString().split('T')[0],
    totalVacationDays: '22',
  });

  const [editEmployee, setEditEmployee] = useState({
    companyEmail: '',
    companyPhone: '',
    position: '',
    startDate: '',
    status: 'active',
    vacationDaysAdjustment: 0,
  });

  const { user, subscription } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: employees = [], isLoading: employeesLoading } = useQuery({
    queryKey: ['/api/employees'],
    staleTime: 5 * 60 * 1000, // ⚡ Cache for 5 minutes
  });

  const { data: companySessions = [] } = useQuery({
    queryKey: ['/api/work-sessions/company'],
    staleTime: 60 * 1000, // ⚡ Cache for 1 minute
  });

  const addEmployeeMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/employees', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      toast({
        title: 'Empleado Agregado',
        description: 'El nuevo empleado ha sido agregado exitosamente.',
      });
      setIsAddModalOpen(false);
      setNewEmployee({
        fullName: '',
        dni: '',
        companyEmail: '',
        role: 'employee',
        password: '',
        startDate: new Date().toISOString().split('T')[0],
        totalVacationDays: '22',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error al Agregar Empleado',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const editEmployeeMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => 
      apiRequest('PATCH', `/api/employees/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      toast({
        title: 'Empleado Actualizado',
        description: 'Los datos del empleado han sido actualizados exitosamente.',
      });
      setIsEditModalOpen(false);
      setSelectedEmployee(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error al Actualizar Empleado',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleAddEmployee = () => {
    if (!newEmployee.fullName || !newEmployee.dni || !newEmployee.companyEmail || !newEmployee.password) {
      toast({
        title: 'Campos Requeridos',
        description: 'Por favor completa todos los campos obligatorios.',
        variant: 'destructive',
      });
      return;
    }

    addEmployeeMutation.mutate({
      companyEmail: newEmployee.companyEmail,
      fullName: newEmployee.fullName,
      dni: newEmployee.dni,
      role: newEmployee.role,
      password: newEmployee.password,
      startDate: newEmployee.startDate,
      totalVacationDays: newEmployee.totalVacationDays,
      companyPhone: null,
    });
  };

  const handleEditEmployee = (employee: any) => {
    setSelectedEmployee(employee);
    setEditEmployee({
      companyEmail: employee.companyEmail || '',
      companyPhone: employee.companyPhone || '',
      position: employee.position || '',
      startDate: employee.startDate ? new Date(employee.startDate).toISOString().split('T')[0] : '',
      status: employee.status || 'active',
      vacationDaysAdjustment: Number(employee.vacationDaysAdjustment || 0),
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEmployee = () => {
    if (!selectedEmployee) return;

    editEmployeeMutation.mutate({
      id: selectedEmployee.id,
      data: editEmployee,
    });
  };

  const adjustVacationDays = (amount: number) => {
    setEditEmployee(prev => ({
      ...prev,
      vacationDaysAdjustment: Number(prev.vacationDaysAdjustment || 0) + amount
    }));
  };

  // Filter employees based on search term and exclude admin
  const filteredEmployees = Array.isArray(employees) ? employees.filter((employee: any) =>
    employee.role !== 'admin' && (
      employee.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.dni?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.companyEmail?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  ) : [];

  // Get role-based statistics
  const totalUsers = filteredEmployees.length;
  const adminCount = filteredEmployees.filter((emp: any) => emp.role === 'admin').length;
  const managerCount = filteredEmployees.filter((emp: any) => emp.role === 'manager').length;
  const employeeCount = filteredEmployees.filter((emp: any) => emp.role === 'employee').length;

  // Calculate available slots for each role based on subscription
  // All seats are paid - extraXXX contains the contracted seats
  const maxEmployees = subscription?.extraEmployees || 0;
  const maxManagers = subscription?.extraManagers || 0;
  const maxAdmins = subscription?.extraAdmins || 1; // Minimum 1 admin required

  // All employees count (from the full list, not filtered)
  const allEmployees = Array.isArray(employees) ? employees : [];
  const totalAdmins = allEmployees.filter((emp: any) => emp.role === 'admin').length;
  const totalManagers = allEmployees.filter((emp: any) => emp.role === 'manager').length;
  const totalEmployeesOnly = allEmployees.filter((emp: any) => emp.role === 'employee').length;

  const availableAdminSlots = Math.max(0, maxAdmins - totalAdmins);
  const availableManagerSlots = Math.max(0, maxManagers - totalManagers);
  const availableEmployeeSlots = Math.max(0, maxEmployees - totalEmployeesOnly);

  // Active sessions today
  const today = new Date().toDateString();
  const activeSessions = Array.isArray(companySessions) ? companySessions.filter((session: any) => 
    new Date(session.clockIn).toDateString() === today && !session.clockOut
  ).length : 0;

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'manager': return 'bg-blue-100 text-blue-800';
      case 'employee': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Shield className="h-4 w-4" />;
      case 'manager': return <Users className="h-4 w-4" />;
      case 'employee': return <User className="h-4 w-4" />;
      default: return <User className="h-4 w-4" />;
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'on_leave': return 'bg-orange-100 text-orange-800';
      case 'on_vacation': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-3 w-3" />;
      case 'inactive': return <XCircle className="h-3 w-3" />;
      case 'on_leave': return <Pause className="h-3 w-3" />;
      case 'on_vacation': return <Plane className="h-3 w-3" />;
      default: return <CheckCircle className="h-3 w-3" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Activo';
      case 'inactive': return 'Inactivo';
      case 'on_leave': return 'De Baja';
      case 'on_vacation': return 'De Vacaciones';
      default: return 'Activo';
    }
  };

  if (employeesLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gray-50">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Empleados</h1>
          <p className="text-gray-600">Administra los empleados de tu empresa</p>
        </div>
        {(user?.role === 'admin' || user?.role === 'manager') && (
          <Button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-oficaz-primary hover:bg-oficaz-primary/90"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Agregar Empleado
          </Button>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <Card>
          <CardContent className="p-3 lg:p-4">
            <div className="flex items-center space-x-2 lg:space-x-3">
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Users className="h-5 w-5 lg:h-6 lg:w-6 text-oficaz-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xl lg:text-2xl font-bold text-gray-900">{totalUsers}</p>
                <p className="text-xs lg:text-sm text-gray-500">Total Usuarios</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 lg:p-4">
            <div className="flex items-center space-x-2 lg:space-x-3">
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Shield className="h-5 w-5 lg:h-6 lg:w-6 text-red-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xl lg:text-2xl font-bold text-gray-900">{adminCount}</p>
                <p className="text-xs lg:text-sm text-gray-500">Administradores</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 lg:p-4">
            <div className="flex items-center space-x-2 lg:space-x-3">
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Users className="h-5 w-5 lg:h-6 lg:w-6 text-blue-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xl lg:text-2xl font-bold text-gray-900">{employeeCount}</p>
                <p className="text-xs lg:text-sm text-gray-500">Solo Empleados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 lg:p-4">
            <div className="flex items-center space-x-2 lg:space-x-3">
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Clock className="h-5 w-5 lg:h-6 lg:w-6 text-green-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xl lg:text-2xl font-bold text-gray-900">{activeSessions}</p>
                <p className="text-xs lg:text-sm text-gray-500">Activos Hoy</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar empleados por nombre, DNI o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Employees List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Lista de Empleados ({totalUsers})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredEmployees.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No se encontraron empleados</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEmployees.map((employee: any) => (
                <div 
                  key={employee.id} 
                  className="relative bg-white border rounded-lg hover:bg-gray-50 transition-colors overflow-hidden"
                >
                  {/* Desktop/Tablet View */}
                  <div 
                    className="hidden sm:flex items-center justify-between p-4 cursor-pointer"
                    onClick={() => handleEditEmployee(employee)}
                  >
                    <div className="flex items-center space-x-4 flex-1">
                      <UserAvatar fullName={employee.fullName || ''} size="md" userId={employee.id} profilePicture={employee.profilePicture} />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 mb-1">{employee.fullName}</p>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span 
                            className="flex items-center gap-1 hover:text-oficaz-primary cursor-pointer transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              const email = employee.companyEmail || employee.personalEmail;
                              if (email) window.location.href = `mailto:${email}`;
                            }}
                          >
                            <Mail className="h-3 w-3" />
                            {employee.companyEmail || employee.personalEmail || 'Sin email'}
                          </span>
                          {(employee.companyPhone || employee.personalPhone) && (
                            <span 
                              className="flex items-center gap-1 hover:text-oficaz-primary cursor-pointer transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                const phone = employee.companyPhone || employee.personalPhone;
                                if (phone) window.location.href = `tel:${phone}`;
                              }}
                            >
                              <Phone className="h-3 w-3" />
                              {employee.companyPhone || employee.personalPhone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`text-xs ${getRoleBadgeColor(employee.role)}`}>
                        <span className="flex items-center gap-1">
                          {getRoleIcon(employee.role)}
                          {translateRole(employee.role)}
                        </span>
                      </Badge>
                      <Badge className={`text-xs ${getStatusBadgeColor(employee.status || 'active')}`}>
                        <span className="flex items-center gap-1">
                          {getStatusIcon(employee.status || 'active')}
                          {getStatusText(employee.status || 'active')}
                        </span>
                      </Badge>
                      <Edit className="h-4 w-4 text-gray-400 ml-2" />
                    </div>
                  </div>

                  {/* Mobile View with Swipe Gestures and iPhone-style Animation */}
                  <div 
                    className="sm:hidden relative overflow-hidden rounded-lg"
                    onTouchStart={(e) => {
                      const touch = e.touches[0];
                      const target = e.currentTarget;
                      target.setAttribute('data-start-x', touch.clientX.toString());
                      target.setAttribute('data-start-time', Date.now().toString());
                      target.setAttribute('data-tap-count', (parseInt(target.getAttribute('data-tap-count') || '0')).toString());
                    }}
                    onTouchMove={(e) => {
                      e.preventDefault();
                      const touch = e.touches[0];
                      const target = e.currentTarget;
                      const startX = parseFloat(target.getAttribute('data-start-x') || '0');
                      const currentX = touch.clientX;
                      const diff = currentX - startX;
                      const content = target.querySelector('.swipe-content') as HTMLElement;
                      
                      if (content && Math.abs(diff) > 3) {
                        // Apply transform with more movement like iPhone Mail
                        const maxSwipe = 150;
                        const constrainedDiff = Math.max(-maxSwipe, Math.min(maxSwipe, diff));
                        content.style.transform = `translateX(${constrainedDiff * 0.8}px)`;
                        content.style.transition = 'none';
                        
                        // Show action hints based on swipe direction
                        const callHint = target.querySelector('.call-hint') as HTMLElement;
                        const messageHint = target.querySelector('.message-hint') as HTMLElement;
                        
                        const threshold = 5;
                        const maxDistance = 80;
                        
                        console.log(`Swipe detected: ${diff}`); // Debug log
                        
                        if (diff < -threshold) {
                          // Swipe left - reveal call action on LEFT (verde)
                          console.log('Activating CALL (green) on left'); // Debug
                          if (callHint && (employee.companyPhone || employee.personalPhone)) {
                            const progress = Math.min(1, Math.abs(diff) / 100);
                            callHint.style.opacity = Math.max(0.95, progress).toString();
                            callHint.style.visibility = 'visible';
                            callHint.style.display = 'flex';
                            callHint.style.transition = 'none';
                            callHint.style.zIndex = '10';
                            console.log(`Call hint opacity set to: ${callHint.style.opacity}`); // Debug
                          }
                          if (messageHint) {
                            messageHint.style.opacity = '0';
                            messageHint.style.visibility = 'hidden';
                            messageHint.style.transition = 'none';
                          }
                        } else if (diff > threshold) {
                          // Swipe right - reveal message action on RIGHT (azul)
                          console.log('Activating MESSAGE (blue) on right'); // Debug
                          if (messageHint) {
                            const progress = Math.min(1, Math.abs(diff) / 100);
                            messageHint.style.opacity = Math.max(0.95, progress).toString();
                            messageHint.style.visibility = 'visible';
                            messageHint.style.display = 'flex';
                            messageHint.style.transition = 'none';
                            messageHint.style.zIndex = '10';
                            console.log(`Message hint opacity set to: ${messageHint.style.opacity}`); // Debug
                          }
                          if (callHint) {
                            callHint.style.opacity = '0';
                            callHint.style.visibility = 'hidden';
                            callHint.style.transition = 'none';
                          }
                        } else {
                          // Reset both hints without transition
                          if (callHint) {
                            callHint.style.transition = 'none';
                            callHint.style.opacity = '0';
                            callHint.style.visibility = 'hidden';
                          }
                          if (messageHint) {
                            messageHint.style.transition = 'none';
                            messageHint.style.opacity = '0';
                            messageHint.style.visibility = 'hidden';
                          }
                        }
                      }
                    }}
                    onTouchEnd={(e) => {
                      const target = e.currentTarget;
                      const startX = parseFloat(target.getAttribute('data-start-x') || '0');
                      const startTime = parseFloat(target.getAttribute('data-start-time') || '0');
                      const endX = e.changedTouches[0].clientX;
                      const diff = startX - endX;
                      const timeDiff = Date.now() - startTime;
                      const content = target.querySelector('.swipe-content') as HTMLElement;
                      const phone = employee.companyPhone || employee.personalPhone;
                      
                      // Reset visual state with animation
                      if (content) {
                        content.style.transform = 'translateX(0)';
                        content.style.transition = 'transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)';
                      }
                      
                      // Reset hints with smooth transition back to hidden state
                      const callHint = target.querySelector('.call-hint') as HTMLElement;
                      const messageHint = target.querySelector('.message-hint') as HTMLElement;
                      if (callHint) {
                        callHint.style.transition = 'opacity 0.2s ease-out, visibility 0.2s ease-out';
                        callHint.style.opacity = '0';
                        setTimeout(() => {
                          if (callHint) callHint.style.visibility = 'hidden';
                        }, 200);
                      }
                      if (messageHint) {
                        messageHint.style.transition = 'opacity 0.2s ease-out, visibility 0.2s ease-out';
                        messageHint.style.opacity = '0';
                        setTimeout(() => {
                          if (messageHint) messageHint.style.visibility = 'hidden';
                        }, 200);
                      }
                      
                      console.log(`Touch end: diff=${diff}, timeDiff=${timeDiff}`); // Debug
                      
                      if (Math.abs(diff) > 50 && timeDiff < 1000) {
                        // Swipe action triggered - reduced threshold and added time limit
                        console.log('Swipe action triggered'); // Debug
                        if (diff < 0 && phone) {
                          // Swipe left - Call
                          console.log('Triggering call'); // Debug
                          window.location.href = `tel:${phone}`;
                        } else if (diff > 0) {
                          // Swipe right - Message
                          console.log('Triggering message navigation for employee:', employee.fullName, 'ID:', employee.id); // Debug
                          navigate(`/test/mensajes?chat=${employee.id}`);
                        }
                      } else if (Math.abs(diff) < 10 && timeDiff < 500) {
                        // Handle tap detection for double tap
                        const currentTapCount = parseInt(target.getAttribute('data-tap-count') || '0');
                        const newTapCount = currentTapCount + 1;
                        target.setAttribute('data-tap-count', newTapCount.toString());
                        
                        if (newTapCount === 1) {
                          // First tap - wait for potential second tap
                          setTimeout(() => {
                            const finalTapCount = parseInt(target.getAttribute('data-tap-count') || '0');
                            if (finalTapCount === 1) {
                              // Single tap - reset count
                              target.setAttribute('data-tap-count', '0');
                            }
                          }, 400);
                        } else if (newTapCount === 2) {
                          // Double tap - edit employee
                          target.setAttribute('data-tap-count', '0');
                          handleEditEmployee(employee);
                        }
                      } else {
                        // Reset tap count if movement or long press
                        target.setAttribute('data-tap-count', '0');
                      }
                    }}
                  >
                    {/* Background Action Hints - Behind content */}
                    <div className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none">
                      {/* Call Action (Left side - revealed when swiping LEFT) */}
                      <div 
                        className="call-hint absolute left-0 top-0 bottom-0 flex items-center justify-center text-white"
                        style={{
                          width: '100px',
                          backgroundColor: '#22c55e',
                          opacity: '0',
                          visibility: 'hidden',
                          zIndex: '5'
                        }}
                      >
                        <Phone className="h-7 w-7 text-white" />
                      </div>
                      
                      {/* Message Action (Right side - revealed when swiping RIGHT) */}
                      <div 
                        className="message-hint absolute right-0 top-0 bottom-0 flex items-center justify-center text-white"
                        style={{
                          width: '100px',
                          backgroundColor: '#3b82f6',
                          opacity: '0',
                          visibility: 'hidden',
                          zIndex: '5'
                        }}
                      >
                        <MessageCircle className="h-7 w-7 text-white" />
                      </div>
                    </div>
                    
                    {/* Main Content - Above hints */}
                    <div className="swipe-content bg-white relative z-10 transition-transform duration-300 ease-out">
                      {/* Swipe Indicators */}
                      <div className="absolute inset-0 flex items-center pointer-events-none z-30">
                        {/* Left indicator - Call (only if phone available) */}
                        {(employee.companyPhone || employee.personalPhone) && (
                          <div className="absolute left-2 top-1/2 transform -translate-y-1/2">
                            <Phone className="h-4 w-4 text-green-500/50" />
                          </div>
                        )}
                        
                        {/* Right indicator - Message (always available) */}
                        <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                          <MessageCircle className="h-4 w-4 text-blue-500/50" />
                        </div>
                      </div>
                      
                      <div className="p-4">
                        <div className="flex items-center space-x-3">
                          <UserAvatar fullName={employee.fullName || ''} size="md" userId={employee.id} profilePicture={employee.profilePicture} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-gray-900 truncate">{employee.fullName}</p>
                              <div className="flex items-center gap-1">
                                <Badge className={`text-xs ${getRoleBadgeColor(employee.role)}`}>
                                  {translateRole(employee.role)?.charAt(0)}
                                </Badge>
                                <Badge className={`text-xs ${getStatusBadgeColor(employee.status || 'active')}`}>
                                  {getStatusIcon(employee.status || 'active')}
                                </Badge>
                              </div>
                            </div>
                            <p className="text-sm text-gray-500 truncate">{employee.position || 'Sin cargo especificado'}</p>
                            <div className="space-y-1 mt-1">
                              <div className="flex items-center gap-1 text-sm text-gray-500">
                                <Mail className="h-3 w-3" />
                                <span className="truncate">{employee.companyEmail || employee.personalEmail || 'Sin email'}</span>
                              </div>
                              {(employee.companyPhone || employee.personalPhone) && (
                                <div className="flex items-center gap-1 text-sm text-oficaz-primary font-medium">
                                  <Phone className="h-3 w-3" />
                                  <span>{employee.companyPhone || employee.personalPhone}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-gray-400 mt-2 text-center">
                          {(employee.companyPhone || employee.personalPhone) ? 
                            '← Desliza para llamar | Desliza para mensaje → | Doble tap para editar' :
                            'Doble tap para editar | Desliza → para mensaje'
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Employee Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agregar Nuevo Empleado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            <div>
              <Label htmlFor="fullName">Nombre Completo *</Label>
              <Input
                id="fullName"
                value={newEmployee.fullName}
                onChange={(e) => setNewEmployee({ ...newEmployee, fullName: e.target.value })}
                placeholder="Ej: Juan Pérez García"
              />
            </div>
            
            <div>
              <Label htmlFor="dni">DNI/NIE *</Label>
              <Input
                id="dni"
                value={newEmployee.dni}
                onChange={(e) => setNewEmployee({ ...newEmployee, dni: e.target.value })}
                placeholder="12345678A"
              />
            </div>

            <div>
              <Label htmlFor="companyEmail">Email Corporativo *</Label>
              <Input
                id="companyEmail"
                type="email"
                value={newEmployee.companyEmail}
                onChange={(e) => setNewEmployee({ ...newEmployee, companyEmail: e.target.value })}
                placeholder="empleado@empresa.com"
              />
            </div>

            <div>
              <Label htmlFor="password">Contraseña *</Label>
              <Input
                id="password"
                type="password"
                value={newEmployee.password}
                onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })}
                placeholder="Contraseña temporal"
              />
            </div>

            <div>
              <Label htmlFor="role">Rol</Label>
              <Select 
                value={newEmployee.role} 
                onValueChange={(value) => setNewEmployee({ ...newEmployee, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee" disabled={availableEmployeeSlots === 0}>
                    <div className="flex items-center justify-between w-full gap-2">
                      <span>Empleado</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${availableEmployeeSlots > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {availableEmployeeSlots} libre{availableEmployeeSlots !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </SelectItem>
                  {user?.role === 'admin' && (
                    <>
                      <SelectItem value="manager" disabled={availableManagerSlots === 0}>
                        <div className="flex items-center justify-between w-full gap-2">
                          <span>Gerente</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${availableManagerSlots > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {availableManagerSlots} libre{availableManagerSlots !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </SelectItem>
                      <SelectItem value="admin" disabled={availableAdminSlots === 0}>
                        <div className="flex items-center justify-between w-full gap-2">
                          <span>Administrador</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${availableAdminSlots > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {availableAdminSlots} libre{availableAdminSlots !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </SelectItem>
                    </>
                  )}
                  {user?.role === 'manager' && (
                    <SelectItem value="manager" disabled={availableManagerSlots === 0}>
                      <div className="flex items-center justify-between w-full gap-2">
                        <span>Gerente</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${availableManagerSlots > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {availableManagerSlots} libre{availableManagerSlots !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="startDate">Fecha de Inicio</Label>
              <Input
                id="startDate"
                type="date"
                value={newEmployee.startDate}
                onChange={(e) => setNewEmployee({ ...newEmployee, startDate: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="totalVacationDays">Días de Vacaciones Anuales</Label>
              <Input
                id="totalVacationDays"
                type="number"
                min="0"
                max="50"
                value={newEmployee.totalVacationDays}
                onChange={(e) => setNewEmployee({ ...newEmployee, totalVacationDays: e.target.value })}
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleAddEmployee}
                disabled={addEmployeeMutation.isPending}
                className="bg-oficaz-primary hover:bg-oficaz-primary/90"
              >
                {addEmployeeMutation.isPending ? 'Agregando...' : 'Agregar Empleado'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Employee Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 bg-oficaz-primary/10 rounded-lg flex items-center justify-center">
                <Edit className="h-5 w-5 text-oficaz-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Editar Empleado</h2>
                <p className="text-sm text-gray-500 font-normal">Gestionar información corporativa y personal</p>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {selectedEmployee && (
            <div className="overflow-y-auto max-h-[calc(95vh-140px)] px-1">
              {/* Employee Header */}
              <div className="bg-gradient-to-r from-oficaz-primary/5 to-blue-50 p-4 rounded-lg mb-4">
                <div className="flex items-center gap-3">
                  <UserAvatar fullName={selectedEmployee.fullName || ''} size="lg" userId={selectedEmployee.id} profilePicture={selectedEmployee.profilePicture} showUpload={true} />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg text-gray-900 truncate">{selectedEmployee.fullName}</h3>
                    <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                      <div className="flex items-center gap-1">
                        <IdCard className="h-3 w-3" />
                        <span>{selectedEmployee.dni}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        <span className="truncate">{selectedEmployee.companyEmail}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    {(() => {
                      const status = selectedEmployee.status || 'active';
                      const statusConfig = {
                        active: { label: 'Activo', color: 'bg-green-100 text-green-800', icon: CheckCircle },
                        inactive: { label: 'Inactivo', color: 'bg-gray-100 text-gray-800', icon: XCircle },
                        leave: { label: 'De Baja', color: 'bg-orange-100 text-orange-800', icon: Pause },
                        vacation: { label: 'De Vacaciones', color: 'bg-blue-100 text-blue-800', icon: Plane }
                      };
                      const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active;
                      const Icon = config.icon;
                      return (
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
                          <Icon className="h-3 w-3" />
                          {config.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Left Column - Corporate Fields */}
                <div className="space-y-4">
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <h4 className="font-medium text-gray-900 flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Shield className="h-3 w-3 text-blue-600" />
                      </div>
                      Información Corporativa
                    </h4>
                    
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="companyEmail" className="text-sm font-medium text-gray-700">Email Corporativo</Label>
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
                        <Label htmlFor="companyPhone" className="text-sm font-medium text-gray-700">Teléfono Corporativo</Label>
                        <Input
                          id="companyPhone"
                          value={editEmployee.companyPhone}
                          onChange={(e) => setEditEmployee({ ...editEmployee, companyPhone: e.target.value })}
                          placeholder="666 666 666"
                          className="mt-1"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="position" className="text-sm font-medium text-gray-700">Cargo/Puesto</Label>
                        <Input
                          id="position"
                          value={editEmployee.position}
                          onChange={(e) => setEditEmployee({ ...editEmployee, position: e.target.value })}
                          placeholder="Administrativo, Técnico, etc."
                          className="mt-1"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="startDate" className="text-sm font-medium text-gray-700">Fecha de Incorporación</Label>
                        <Input
                          id="startDate"
                          type="date"
                          value={editEmployee.startDate}
                          onChange={(e) => setEditEmployee({ ...editEmployee, startDate: e.target.value })}
                          className="mt-1"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="status" className="text-sm font-medium text-gray-700">Estado del Empleado</Label>
                        <Select 
                          value={editEmployee.status} 
                          onValueChange={(value) => setEditEmployee({ ...editEmployee, status: value })}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">
                              <span className="flex items-center gap-2">
                                <CheckCircle className="h-3 w-3 text-green-600" />
                                Activo
                              </span>
                            </SelectItem>
                            <SelectItem value="inactive">
                              <span className="flex items-center gap-2">
                                <XCircle className="h-3 w-3 text-gray-600" />
                                Inactivo
                              </span>
                            </SelectItem>
                            <SelectItem value="leave">
                              <span className="flex items-center gap-2">
                                <Pause className="h-3 w-3 text-orange-600" />
                                De Baja
                              </span>
                            </SelectItem>
                            <SelectItem value="vacation">
                              <span className="flex items-center gap-2">
                                <Plane className="h-3 w-3 text-blue-600" />
                                De Vacaciones
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column - Vacation Management */}
                <div className="space-y-4">
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <h4 className="font-medium text-gray-900 flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 bg-green-100 rounded-lg flex items-center justify-center">
                        <Calendar className="h-3 w-3 text-green-600" />
                      </div>
                      Gestión de Vacaciones
                    </h4>
                    
                    <div className="space-y-3">
                      {/* Current Vacation Status */}
                      <div className="bg-gradient-to-r from-blue-50 to-green-50 p-3 rounded-lg border border-blue-100">
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-lg font-bold text-blue-600">
                              {Math.round(Number(selectedEmployee.totalVacationDays || 0) + Number(editEmployee.vacationDaysAdjustment || 0))}
                            </p>
                            <p className="text-xs text-gray-600">Total</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-orange-600">{Math.round(Number(selectedEmployee.usedVacationDays || 0))}</p>
                            <p className="text-xs text-gray-600">Usados</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-green-600">
                              {Math.max(0, Math.round((Number(selectedEmployee.totalVacationDays || 0) + Number(editEmployee.vacationDaysAdjustment || 0)) - Number(selectedEmployee.usedVacationDays || 0)))}
                            </p>
                            <p className="text-xs text-gray-600">Disponibles</p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Vacation Adjustment Controls */}
                      <div>
                        <Label className="text-sm font-medium text-gray-700 mb-2 block">
                          Ajuste Manual
                        </Label>
                        <div className="bg-gray-50 p-3 rounded-lg">
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
                              value={Number(editEmployee.vacationDaysAdjustment || 0)}
                              onChange={(e) => {
                                const value = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                                if (!isNaN(value)) {
                                  setEditEmployee({ ...editEmployee, vacationDaysAdjustment: value });
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
                          <p className="text-xs text-gray-500 text-center mt-1">
                            Días extra (+ o -)
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Personal Information Section */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 mt-4">
                <h4 className="font-medium text-gray-900 flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 bg-gray-100 rounded-lg flex items-center justify-center">
                    <User className="h-3 w-3 text-gray-600" />
                  </div>
                  Información Personal (Solo Lectura)
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-gray-50 p-2 rounded-lg">
                    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Email Personal</Label>
                    <p className="text-sm mt-1 flex items-center gap-1 font-medium">
                      <Mail className="h-3 w-3 text-gray-400" />
                      {selectedEmployee.personalEmail || 'No especificado'}
                    </p>
                  </div>
                  
                  <div className="bg-gray-50 p-2 rounded-lg">
                    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Teléfono Personal</Label>
                    <p className="text-sm mt-1 flex items-center gap-1 font-medium">
                      <Phone className="h-3 w-3 text-gray-400" />
                      {selectedEmployee.personalPhone || 'No especificado'}
                    </p>
                  </div>
                  
                  <div className="bg-gray-50 p-2 rounded-lg md:col-span-2">
                    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Dirección Postal</Label>
                    <p className="text-sm mt-1 flex items-center gap-1 font-medium">
                      <MapPin className="h-3 w-3 text-gray-400" />
                      {selectedEmployee.postalAddress || 'No especificada'}
                    </p>
                  </div>
                  
                  <div className="bg-gray-50 p-2 rounded-lg">
                    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Contacto de Emergencia</Label>
                    <p className="text-sm mt-1 flex items-center gap-1 font-medium">
                      <AlertTriangle className="h-3 w-3 text-gray-400" />
                      {selectedEmployee.emergencyContactName || 'No especificado'}
                    </p>
                  </div>
                  
                  <div className="bg-gray-50 p-2 rounded-lg">
                    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Teléfono de Emergencia</Label>
                    <p className="text-sm mt-1 flex items-center gap-1 font-medium">
                      <Phone className="h-3 w-3 text-gray-400" />
                      {selectedEmployee.emergencyContactPhone || 'No especificado'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-2 pt-4 border-t mt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSaveEmployee}
                  disabled={editEmployeeMutation.isPending}
                  className="bg-oficaz-primary hover:bg-oficaz-primary/90 px-4"
                >
                  {editEmployeeMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}