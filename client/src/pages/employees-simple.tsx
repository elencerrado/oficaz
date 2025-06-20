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
  User
} from 'lucide-react';
import { Label } from '@/components/ui/label';

export default function EmployeesSimple() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('activo'); // Default to active
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const { data: employees = [] } = useQuery({
    queryKey: ['/api/employees'],
    enabled: !!user && (user.role === 'admin' || user.role === 'manager')
  });

  const employeeList = employees as any[];
  const filteredEmployees = employeeList.filter((employee: any) => {
    const matchesSearch = employee.fullName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Convert filter selection to actual database values
    let statusToMatch = statusFilter;
    if (statusFilter === 'activos') statusToMatch = 'active';
    else if (statusFilter === 'inactivos') statusToMatch = 'inactive';
    else if (statusFilter === 'de baja') statusToMatch = 'on_leave';
    else if (statusFilter === 'de vacaciones') statusToMatch = 'on_vacation';
    
    const employeeStatus = employee.status || 'active'; // Default to 'active' if no status
    const matchesStatus = statusFilter === 'todos' || employeeStatus === statusToMatch;
    const notAdmin = employee.role !== 'admin';
    return matchesSearch && matchesStatus && notAdmin;
  });

  const totalUsers = employeeList.filter((employee: any) => employee.role !== 'admin').length;

  // Helper function to translate status
  const translateStatus = (status: string) => {
    const translations: Record<string, string> = {
      'active': 'activo',
      'inactive': 'inactivo', 
      'on_leave': 'de baja',
      'vacation': 'de vacaciones'
    };
    return translations[status] || status || 'activo';
  };

  // Helper function to get status color
  const getStatusColor = (status: string) => {
    const translatedStatus = translateStatus(status);
    switch (translatedStatus) {
      case 'activo': return 'bg-green-100 text-green-800';
      case 'inactivo': return 'bg-gray-100 text-gray-800';
      case 'de baja': return 'bg-red-100 text-red-800';
      case 'de vacaciones': return 'bg-blue-100 text-blue-800';
      default: return 'bg-green-100 text-green-800';
    }
  };

  return (
    <div className="container mx-auto p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
          Gestión de Empleados
        </h1>
        
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
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="todos">Todos los estados</option>
              <option value="activos">Activos</option>
              <option value="inactivos">Inactivos</option>
              <option value="de baja">De baja</option>
              <option value="de vacaciones">De vacaciones</option>
            </select>
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
                        // Swipe actions
                        if (currentX > 0 && (employee.companyPhone || employee.personalPhone)) {
                          const phone = employee.companyPhone || employee.personalPhone;
                          setTimeout(() => {
                            window.location.href = `tel:${phone}`;
                          }, 100);
                        } else if (currentX < 0) {
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
                          setSelectedEmployee(employee);
                          setShowEditModal(true);
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
                        <p className="text-sm text-gray-500">{employee.role}</p>
                        {(employee.companyEmail || employee.personalEmail) && (
                          <div className="text-sm text-blue-600 mt-1">
                            {employee.companyEmail || employee.personalEmail}
                          </div>
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
                  onDoubleClick={() => {
                    setSelectedEmployee(employee);
                    setShowEditModal(true);
                  }}
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
                          <span>{employee.role}</span>
                          {(employee.companyEmail || employee.personalEmail) && (
                            <span>{employee.companyEmail || employee.personalEmail}</span>
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Usuario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Nombre completo" />
            <Input placeholder="DNI/NIE" />
            <Input placeholder="Email empresarial" type="email" />
            <Input placeholder="Teléfono" type="tel" />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1">
                Cancelar
              </Button>
              <Button className="flex-1">
                Crear Usuario
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
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        <span className="truncate">{selectedEmployee.companyEmail}</span>
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
                          value={selectedEmployee.companyEmail || ''}
                          readOnly
                          className="mt-1 bg-gray-50"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="companyPhone" className="text-sm font-medium text-gray-700">Teléfono Corporativo</Label>
                        <Input
                          id="companyPhone"
                          value={selectedEmployee.companyPhone || ''}
                          readOnly
                          className="mt-1 bg-gray-50"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="position" className="text-sm font-medium text-gray-700">Cargo/Puesto</Label>
                        <Input
                          id="position"
                          value={selectedEmployee.position || selectedEmployee.role}
                          readOnly
                          className="mt-1 bg-gray-50"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="startDate" className="text-sm font-medium text-gray-700">Fecha de Incorporación</Label>
                        <Input
                          id="startDate"
                          type="date"
                          value={selectedEmployee.startDate ? new Date(selectedEmployee.startDate).toISOString().split('T')[0] : ''}
                          readOnly
                          className="mt-1 bg-gray-50"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="status" className="text-sm font-medium text-gray-700">Estado del Empleado</Label>
                        <select 
                          className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          defaultValue={selectedEmployee.status || 'activo'}
                        >
                          <option value="activo">Activo</option>
                          <option value="inactivo">Inactivo</option>
                          <option value="de baja">De baja</option>
                          <option value="de vacaciones">De vacaciones</option>
                        </select>
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
                    
                    <div className="space-y-3 text-sm">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <Label className="text-xs text-gray-500 uppercase tracking-wide">Email Personal</Label>
                        <p className="mt-1 text-gray-900">{selectedEmployee.personalEmail || 'No especificado'}</p>
                      </div>
                      
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <Label className="text-xs text-gray-500 uppercase tracking-wide">Teléfono Personal</Label>
                        <p className="mt-1 text-gray-900">{selectedEmployee.personalPhone || 'No especificado'}</p>
                      </div>
                      
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <Label className="text-xs text-gray-500 uppercase tracking-wide">Dirección</Label>
                        <p className="mt-1 text-gray-900 text-wrap break-words">
                          {selectedEmployee.address || 'No especificada'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Vacation Summary */}
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <h4 className="font-medium text-gray-900 flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 bg-purple-100 rounded-lg flex items-center justify-center">
                        <Calendar className="h-3 w-3 text-purple-600" />
                      </div>
                      Resumen de Vacaciones
                    </h4>
                    
                    <div className="bg-gradient-to-r from-blue-50 to-green-50 p-3 rounded-lg border border-blue-100">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-lg font-bold text-blue-600">
                            {Math.round(Number(selectedEmployee.totalVacationDays || 0))}
                          </p>
                          <p className="text-xs text-gray-600">Total</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-orange-600">{Math.round(Number(selectedEmployee.usedVacationDays || 0))}</p>
                          <p className="text-xs text-gray-600">Usados</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-green-600">
                            {Math.max(0, Math.round(Number(selectedEmployee.totalVacationDays || 0) - Number(selectedEmployee.usedVacationDays || 0)))}
                          </p>
                          <p className="text-xs text-gray-600">Disponibles</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-6">
                <Button variant="outline" onClick={() => setShowEditModal(false)}>
                  Cancelar
                </Button>
                <Button>
                  Guardar Cambios
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}