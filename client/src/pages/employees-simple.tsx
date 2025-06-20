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
  UserPlus
} from 'lucide-react';

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
    const matchesStatus = statusFilter === 'todos' || (employee.status || 'activo') === statusFilter;
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
              <option value="activo">Activos</option>
              <option value="inactivo">Inactivos</option>
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
                        // Handle double tap for edit
                        const currentTapCount = parseInt(e.currentTarget.getAttribute('data-tap-count') || '0');
                        const newTapCount = currentTapCount + 1;
                        e.currentTarget.setAttribute('data-tap-count', newTapCount.toString());
                        
                        if (newTapCount === 1) {
                          setTimeout(() => {
                            const finalTapCount = parseInt(e.currentTarget.getAttribute('data-tap-count') || '0');
                            if (finalTapCount === 1) {
                              // Single tap - no action
                            }
                            e.currentTarget.setAttribute('data-tap-count', '0');
                          }, 300);
                        } else if (newTapCount === 2) {
                          // Double tap - open edit modal
                          setSelectedEmployee(employee);
                          setShowEditModal(true);
                          e.currentTarget.setAttribute('data-tap-count', '0');
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Empleado</DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Nombre completo</label>
                <Input value={selectedEmployee.fullName} readOnly className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input value={selectedEmployee.companyEmail || selectedEmployee.personalEmail} readOnly className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Estado</label>
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
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowEditModal(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button className="flex-1">
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