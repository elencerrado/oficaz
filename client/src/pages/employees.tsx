import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  Plane
} from 'lucide-react';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function Employees() {
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

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: employees = [], isLoading: employeesLoading } = useQuery({
    queryKey: ['/api/employees'],
  });

  const { data: companySessions = [] } = useQuery({
    queryKey: ['/api/work-sessions/company'],
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
      vacationDaysAdjustment: parseFloat(employee.vacationDaysAdjustment || '0'),
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
      vacationDaysAdjustment: prev.vacationDaysAdjustment + amount
    }));
  };

  // Filter employees based on search term
  const filteredEmployees = Array.isArray(employees) ? employees.filter((employee: any) =>
    employee.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.dni?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.companyEmail?.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  // Get role-based statistics
  const totalEmployees = filteredEmployees.length;
  const adminCount = filteredEmployees.filter((emp: any) => emp.role === 'admin').length;
  const managerCount = filteredEmployees.filter((emp: any) => emp.role === 'manager').length;
  const employeeCount = filteredEmployees.filter((emp: any) => emp.role === 'employee').length;

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
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-oficaz-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-8 w-8 text-oficaz-primary" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalEmployees}</p>
                <p className="text-sm text-gray-500">Total Empleados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Shield className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{adminCount}</p>
                <p className="text-sm text-gray-500">Administradores</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{managerCount}</p>
                <p className="text-sm text-gray-500">Gerentes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{activeSessions}</p>
                <p className="text-sm text-gray-500">Activos Hoy</p>
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
            Lista de Empleados ({filteredEmployees.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredEmployees.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No se encontraron empleados</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredEmployees.map((employee: any) => (
                <div 
                  key={employee.id} 
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleEditEmployee(employee)}
                >
                  <div className="flex items-center space-x-4">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-oficaz-primary text-white">
                        {employee.fullName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{employee.fullName}</p>
                        <Badge className={`text-xs ${getRoleBadgeColor(employee.role)}`}>
                          <span className="flex items-center gap-1">
                            {getRoleIcon(employee.role)}
                            {employee.role === 'admin' ? 'Administrador' : 
                             employee.role === 'manager' ? 'Gerente' : 'Empleado'}
                          </span>
                        </Badge>
                        <Badge className={`text-xs ${getStatusBadgeColor(employee.status || 'active')}`}>
                          <span className="flex items-center gap-1">
                            {getStatusIcon(employee.status || 'active')}
                            {getStatusText(employee.status || 'active')}
                          </span>
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <IdCard className="h-3 w-3" />
                          {employee.dni}
                        </span>
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {employee.companyEmail}
                        </span>
                        {employee.startDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Desde {format(new Date(employee.startDate), 'dd/MM/yyyy')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-gray-500">
                        Vacaciones: {employee.usedVacationDays || 0}/{employee.totalVacationDays || 22} días
                      </p>
                    </div>
                    <Edit className="h-4 w-4 text-gray-400" />
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
                  <SelectItem value="employee">Empleado</SelectItem>
                  {user?.role === 'admin' && (
                    <>
                      <SelectItem value="manager">Gerente</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </>
                  )}
                  {user?.role === 'manager' && (
                    <SelectItem value="manager">Gerente</SelectItem>
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
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Editar Empleado - {selectedEmployee?.fullName}
            </DialogTitle>
          </DialogHeader>
          
          {selectedEmployee && (
            <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
              {/* Employee Overview */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-oficaz-primary text-white">
                      {selectedEmployee.fullName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-lg">{selectedEmployee.fullName}</h3>
                    <p className="text-sm text-gray-600 flex items-center gap-1">
                      <IdCard className="h-3 w-3" />
                      {selectedEmployee.dni}
                    </p>
                  </div>
                </div>
              </div>

              {/* Admin/Manager Editable Fields */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Campos Corporativos (Solo Admin/Manager)
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="companyEmail">Email Corporativo</Label>
                    <Input
                      id="companyEmail"
                      type="email"
                      value={editEmployee.companyEmail}
                      onChange={(e) => setEditEmployee({ ...editEmployee, companyEmail: e.target.value })}
                      placeholder="empleado@empresa.com"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="companyPhone">Teléfono Corporativo</Label>
                    <Input
                      id="companyPhone"
                      value={editEmployee.companyPhone}
                      onChange={(e) => setEditEmployee({ ...editEmployee, companyPhone: e.target.value })}
                      placeholder="666 666 666"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="position">Cargo/Puesto</Label>
                    <Input
                      id="position"
                      value={editEmployee.position}
                      onChange={(e) => setEditEmployee({ ...editEmployee, position: e.target.value })}
                      placeholder="Administrativo, Técnico, etc."
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="startDate">Fecha de Incorporación</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={editEmployee.startDate}
                      onChange={(e) => setEditEmployee({ ...editEmployee, startDate: e.target.value })}
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <Label htmlFor="status">Estado del Empleado</Label>
                    <Select 
                      value={editEmployee.status} 
                      onValueChange={(value) => setEditEmployee({ ...editEmployee, status: value })}
                    >
                      <SelectTrigger>
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
                        <SelectItem value="on_leave">
                          <span className="flex items-center gap-2">
                            <Pause className="h-3 w-3 text-orange-600" />
                            De Baja
                          </span>
                        </SelectItem>
                        <SelectItem value="on_vacation">
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

              {/* Vacation Adjustment */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Ajuste de Días de Vacaciones
                </h4>
                
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium">Días Totales: {selectedEmployee.totalVacationDays || 0}</p>
                      <p className="text-sm text-gray-600">Días Utilizados: {selectedEmployee.usedVacationDays || 0}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">Ajuste Actual: {editEmployee.vacationDaysAdjustment} días</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => adjustVacationDays(-1)}
                      className="p-2"
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    
                    <Input
                      type="number"
                      value={editEmployee.vacationDaysAdjustment}
                      onChange={(e) => setEditEmployee({ ...editEmployee, vacationDaysAdjustment: parseFloat(e.target.value) || 0 })}
                      className="w-20 text-center"
                      step="0.5"
                    />
                    
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => adjustVacationDays(1)}
                      className="p-2"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    
                    <span className="text-sm text-gray-600 ml-2">
                      días extra (+ o -)
                    </span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Employee Viewable Fields (Read-only) */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Información Personal (Solo Lectura)
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                  <div>
                    <Label className="text-gray-600">Email Personal</Label>
                    <p className="text-sm mt-1 flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {selectedEmployee.personalEmail || 'No especificado'}
                    </p>
                  </div>
                  
                  <div>
                    <Label className="text-gray-600">Teléfono Personal</Label>
                    <p className="text-sm mt-1 flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {selectedEmployee.personalPhone || 'No especificado'}
                    </p>
                  </div>
                  
                  <div className="md:col-span-2">
                    <Label className="text-gray-600">Dirección Postal</Label>
                    <p className="text-sm mt-1 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {selectedEmployee.postalAddress || 'No especificada'}
                    </p>
                  </div>
                  
                  <div>
                    <Label className="text-gray-600">Contacto de Emergencia</Label>
                    <p className="text-sm mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {selectedEmployee.emergencyContactName || 'No especificado'}
                    </p>
                  </div>
                  
                  <div>
                    <Label className="text-gray-600">Teléfono de Emergencia</Label>
                    <p className="text-sm mt-1 flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {selectedEmployee.emergencyContactPhone || 'No especificado'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSaveEmployee}
                  disabled={editEmployeeMutation.isPending}
                  className="bg-oficaz-primary hover:bg-oficaz-primary/90"
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