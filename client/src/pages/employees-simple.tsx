import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
  IdCard,
  Mail,
  User,
  Minus,
  AlertCircle
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function EmployeesSimple() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('activos'); // Default to active
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editEmployee, setEditEmployee] = useState({
    companyEmail: '',
    companyPhone: '',
    position: '',
    startDate: '',
    status: 'active',
    role: 'employee',
    vacationDaysAdjustment: 0,
    personalEmail: '',
    personalPhone: '',
    address: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
  });

  const [newEmployee, setNewEmployee] = useState({
    fullName: '',
    dni: '',
    companyEmail: '',
    companyPhone: '',
    position: '',
    startDate: '',
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
        startDate: '',
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
      startDate: editEmployee.startDate,
      status: editEmployee.status,
      role: editEmployee.role,
      vacationDaysAdjustment: editEmployee.vacationDaysAdjustment,
      personalEmail: editEmployee.personalEmail,
      personalPhone: editEmployee.personalPhone,
      address: editEmployee.address,
      emergencyContactName: editEmployee.emergencyContactName,
      emergencyContactPhone: editEmployee.emergencyContactPhone,
    });
  };

  // Function to handle creating new employee
  const handleCreateEmployee = () => {
    if (!newEmployee.fullName.trim() || !newEmployee.dni.trim()) {
      toast({
        title: 'Campos Obligatorios',
        description: 'El nombre completo y el DNI son obligatorios.',
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
      startDate: newEmployee.startDate || new Date().toISOString().split('T')[0],
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

  const employeeList = employees as any[];
  const filteredEmployees = employeeList.filter((employee: any) => {
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

  const totalUsers = employeeList.filter((employee: any) => employee.role !== 'admin').length;

  // Function to adjust vacation days
  const adjustVacationDays = (amount: number) => {
    setEditEmployee(prev => {
      const currentAdjustment = Number(prev.vacationDaysAdjustment) || 0;
      const newAdjustment = currentAdjustment + amount;
      return {
        ...prev,
        vacationDaysAdjustment: newAdjustment
      };
    });
  };

  // Function to handle opening edit modal
  const handleEditEmployee = (employee: any) => {
    setSelectedEmployee(employee);
    setEditEmployee({
      companyEmail: employee.companyEmail || '',
      companyPhone: employee.companyPhone || '',
      position: employee.position || employee.role,
      startDate: employee.startDate ? new Date(employee.startDate).toISOString().split('T')[0] : '',
      status: employee.status || 'active',
      role: employee.role || 'employee',
      vacationDaysAdjustment: Number(employee.vacationDaysAdjustment || 0),
      personalEmail: employee.personalEmail || '',
      personalPhone: employee.personalPhone || '',
      address: employee.address || '',
      emergencyContactName: employee.emergencyContactName || '',
      emergencyContactPhone: employee.emergencyContactPhone || '',
    });
    setShowEditModal(true);
  };

  // Helper function to translate status
  const translateStatus = (status: string) => {
    const translations: Record<string, string> = {
      'active': 'Activo',
      'inactive': 'Inactivo', 
      'on_leave': 'De baja',
      'on_vacation': 'De vacaciones',
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
      case 'on_leave':
      case 'de baja': 
        return 'bg-red-100 text-red-800';
      case 'on_vacation':
      case 'vacation':
      case 'de vacaciones': 
        return 'bg-blue-100 text-blue-800';
      default: 
        return 'bg-green-100 text-green-800';
    }
  };

  return (
    <div className="container mx-auto p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Gestión de Empleados</h1>
        <p className="text-gray-500 mt-1">
          Administra usuarios y gestiona información de empleados
        </p>
      </div>
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">{/* Moved button section below header */}
        {/* Desktop: Button and count side by side */}
        <div className="hidden sm:flex items-center gap-3">
          <span className="text-sm text-gray-500">{totalUsers} usuarios</span>
          <Button onClick={() => setShowCreateModal(true)} size="sm">
            <UserPlus className="h-4 w-4 mr-2" />
            Crear Usuario
          </Button>
        </div>
        
        {/* Mobile: Button and count in same line, compact */}
        <div className="flex sm:hidden items-center justify-between">
          <span className="text-xs text-gray-500">{totalUsers} usuarios</span>
          <Button onClick={() => setShowCreateModal(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Crear
          </Button>
        </div>
      </div>



      {/* Employee List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            Lista de Empleados ({filteredEmployees.length} de {totalUsers})
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
                    className="employee-card bg-white border rounded-lg relative z-10 p-4"
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
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-blue-600 text-white">
                          {employee.fullName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{employee.fullName}</p>
                        <p className="text-sm text-gray-500">{employee.position || 'Sin cargo especificado'}</p>
                        {(employee.companyEmail || employee.personalEmail) && (
                          <a 
                            href={`mailto:${employee.companyEmail || employee.personalEmail}`}
                            className="text-sm text-blue-600 mt-1 block hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {employee.companyEmail || employee.personalEmail}
                          </a>
                        )}
                        {(employee.companyPhone || employee.personalPhone) && (
                          <a 
                            href={`tel:${employee.companyPhone || employee.personalPhone}`}
                            className="text-sm text-blue-600 block hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {employee.companyPhone || employee.personalPhone}
                          </a>
                        )}
                      </div>
                      <Badge className={`${getStatusColor(employee.status)} capitalize border-0`}>
                        {translateStatus(employee.status)}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Desktop View */}
                <div 
                  className="hidden sm:block bg-white border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                  onDoubleClick={() => handleEditEmployee(employee)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-blue-600 text-white">
                          {employee.fullName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-gray-900">{employee.fullName}</p>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
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
                      <Edit className="h-4 w-4 text-gray-400" />
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
            <DialogTitle className="text-xl font-bold text-gray-900">
              Crear Nuevo Empleado
            </DialogTitle>
          </DialogHeader>
          
          <div className="overflow-y-auto max-h-[calc(95vh-140px)] px-1">
            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left Column - Required & Corporate Fields */}
              <div className="space-y-4">
                {/* Required Fields */}
                <div className="bg-white border border-red-200 rounded-xl p-4">
                  <h4 className="font-medium text-gray-900 flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 bg-red-100 rounded-lg flex items-center justify-center">
                      <AlertCircle className="h-3 w-3 text-red-600" />
                    </div>
                    Campos Obligatorios
                  </h4>
                  
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="newFullName" className="text-sm font-medium text-gray-700">Nombre Completo *</Label>
                      <Input
                        id="newFullName"
                        value={newEmployee.fullName}
                        onChange={(e) => setNewEmployee({ ...newEmployee, fullName: e.target.value })}
                        placeholder="Juan José Ramírez Martín"
                        className="mt-1"
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="newDni" className="text-sm font-medium text-gray-700">DNI/NIE *</Label>
                      <Input
                        id="newDni"
                        value={newEmployee.dni}
                        onChange={(e) => setNewEmployee({ ...newEmployee, dni: e.target.value })}
                        placeholder="12345678A"
                        className="mt-1"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Corporate Fields */}
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <h4 className="font-medium text-gray-900 flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Shield className="h-3 w-3 text-blue-600" />
                    </div>
                    Información Corporativa
                  </h4>
                  
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="newCompanyEmail" className="text-sm font-medium text-gray-700">Email Corporativo</Label>
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
                      <Label htmlFor="newCompanyPhone" className="text-sm font-medium text-gray-700">Teléfono Corporativo</Label>
                      <Input
                        id="newCompanyPhone"
                        value={newEmployee.companyPhone}
                        onChange={(e) => setNewEmployee({ ...newEmployee, companyPhone: e.target.value })}
                        placeholder="666 666 666"
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="newPosition" className="text-sm font-medium text-gray-700">Cargo/Puesto</Label>
                      <Input
                        id="newPosition"
                        value={newEmployee.position}
                        onChange={(e) => setNewEmployee({ ...newEmployee, position: e.target.value })}
                        placeholder="Administrativo, Técnico, etc."
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="newStartDate" className="text-sm font-medium text-gray-700">Fecha de Incorporación</Label>
                      <Input
                        id="newStartDate"
                        type="date"
                        value={newEmployee.startDate}
                        onChange={(e) => setNewEmployee({ ...newEmployee, startDate: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="newStatus" className="text-sm font-medium text-gray-700">Estado del Empleado</Label>
                      <Select 
                        value={newEmployee.status}
                        onValueChange={(value) => setNewEmployee({ ...newEmployee, status: value })}
                      >
                        <SelectTrigger className="w-full mt-1">
                          <SelectValue placeholder="Seleccionar estado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Activo</SelectItem>
                          <SelectItem value="inactive">Inactivo</SelectItem>
                          <SelectItem value="on_leave">De baja</SelectItem>
                          <SelectItem value="on_vacation">De vacaciones</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="newRole" className="text-sm font-medium text-gray-700">Tipo de Usuario</Label>
                      <Select 
                        value={newEmployee.role}
                        onValueChange={(value) => setNewEmployee({ ...newEmployee, role: value })}
                      >
                        <SelectTrigger className="w-full mt-1">
                          <SelectValue placeholder="Seleccionar tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="employee">Empleado</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="admin">Administrador</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Personal Info */}
              <div className="space-y-4">
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <h4 className="font-medium text-gray-900 flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 bg-green-100 rounded-lg flex items-center justify-center">
                      <User className="h-3 w-3 text-green-600" />
                    </div>
                    Información Personal
                  </h4>
                  
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="newPersonalEmail" className="text-sm font-medium text-gray-700">Email Personal</Label>
                      <Input
                        id="newPersonalEmail"
                        type="email"
                        value={newEmployee.personalEmail}
                        onChange={(e) => setNewEmployee({ ...newEmployee, personalEmail: e.target.value })}
                        placeholder="email@personal.com"
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="newPersonalPhone" className="text-sm font-medium text-gray-700">Teléfono Personal</Label>
                      <Input
                        id="newPersonalPhone"
                        value={newEmployee.personalPhone}
                        onChange={(e) => setNewEmployee({ ...newEmployee, personalPhone: e.target.value })}
                        placeholder="+34 666 666 666"
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="newAddress" className="text-sm font-medium text-gray-700">Dirección</Label>
                      <Input
                        id="newAddress"
                        value={newEmployee.address}
                        onChange={(e) => setNewEmployee({ ...newEmployee, address: e.target.value })}
                        placeholder="Calle, número, ciudad..."
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="newEmergencyContactName" className="text-sm font-medium text-gray-700">Persona de Contacto</Label>
                      <Input
                        id="newEmergencyContactName"
                        value={newEmployee.emergencyContactName}
                        onChange={(e) => setNewEmployee({ ...newEmployee, emergencyContactName: e.target.value })}
                        placeholder="Nombre del contacto de emergencia"
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="newEmergencyContactPhone" className="text-sm font-medium text-gray-700">Teléfono de Contacto</Label>
                      <Input
                        id="newEmergencyContactPhone"
                        value={newEmployee.emergencyContactPhone}
                        onChange={(e) => setNewEmployee({ ...newEmployee, emergencyContactPhone: e.target.value })}
                        placeholder="+34 666 666 666"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-6">
              <Button variant="outline" onClick={() => setShowCreateModal(false)} disabled={createEmployeeMutation.isPending}>
                Cancelar
              </Button>
              <Button onClick={handleCreateEmployee} disabled={createEmployeeMutation.isPending}>
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
            <DialogTitle className="text-xl font-bold text-gray-900">
              Editar Empleado
            </DialogTitle>
          </DialogHeader>
          
          {selectedEmployee && (
            <div className="overflow-y-auto max-h-[calc(95vh-140px)] px-1">
              {/* Employee Header */}
              <div className="bg-gradient-to-r from-oficaz-primary/5 to-blue-50 p-4 rounded-lg mb-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 border-2 border-white shadow">
                    <AvatarFallback className="bg-oficaz-primary text-white font-semibold">
                      {selectedEmployee.fullName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg text-gray-900 truncate">{selectedEmployee.fullName}</h3>
                    <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
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
                          <SelectTrigger className="w-full mt-1">
                            <SelectValue placeholder="Seleccionar estado" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Activo</SelectItem>
                            <SelectItem value="inactive">Inactivo</SelectItem>
                            <SelectItem value="on_leave">De baja</SelectItem>
                            <SelectItem value="on_vacation">De vacaciones</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="role" className="text-sm font-medium text-gray-700">Tipo de Usuario</Label>
                        <Select 
                          value={editEmployee.role}
                          onValueChange={(value) => setEditEmployee({ ...editEmployee, role: value })}
                        >
                          <SelectTrigger className="w-full mt-1">
                            <SelectValue placeholder="Seleccionar tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="employee">Empleado</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="admin">Administrador</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column - Personal Info */}
                <div className="space-y-4">
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <h4 className="font-medium text-gray-900 flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 bg-green-100 rounded-lg flex items-center justify-center">
                        <User className="h-3 w-3 text-green-600" />
                      </div>
                      Información Personal
                    </h4>
                    
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="personalEmail" className="text-sm font-medium text-gray-700">Email Personal</Label>
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
                        <Label htmlFor="personalPhone" className="text-sm font-medium text-gray-700">Teléfono Personal</Label>
                        <Input
                          id="personalPhone"
                          value={editEmployee.personalPhone}
                          onChange={(e) => setEditEmployee({ ...editEmployee, personalPhone: e.target.value })}
                          placeholder="+34 666 666 666"
                          className="mt-1"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="address" className="text-sm font-medium text-gray-700">Dirección</Label>
                        <Input
                          id="address"
                          value={editEmployee.address}
                          onChange={(e) => setEditEmployee({ ...editEmployee, address: e.target.value })}
                          placeholder="Calle, número, ciudad..."
                          className="mt-1"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="emergencyContactName" className="text-sm font-medium text-gray-700">Persona de Contacto</Label>
                        <Input
                          id="emergencyContactName"
                          value={editEmployee.emergencyContactName}
                          onChange={(e) => setEditEmployee({ ...editEmployee, emergencyContactName: e.target.value })}
                          placeholder="Nombre del contacto de emergencia"
                          className="mt-1"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="emergencyContactPhone" className="text-sm font-medium text-gray-700">Teléfono de Contacto</Label>
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
                              {(() => {
                                const total = Number(selectedEmployee?.totalVacationDays || 0);
                                const adjustment = Number(editEmployee?.vacationDaysAdjustment || 0);
                                return Math.round(total + adjustment);
                              })()}
                            </p>
                            <p className="text-xs text-gray-600">Total</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-orange-600">
                              {Math.round(Number(selectedEmployee?.usedVacationDays || 0))}
                            </p>
                            <p className="text-xs text-gray-600">Usados</p>
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
                          <p className="text-xs text-gray-500 text-center mt-1">
                            Días extra (+ o -)
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-6">
                <Button variant="outline" onClick={() => setShowEditModal(false)} disabled={updateEmployeeMutation.isPending}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveEmployee} disabled={updateEmployeeMutation.isPending}>
                  {updateEmployeeMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}