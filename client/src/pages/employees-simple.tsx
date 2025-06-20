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

  const { data: employees = [] } = useQuery({
    queryKey: ['/api/employees'],
    enabled: !!user && (user.role === 'admin' || user.role === 'manager')
  });

  const employeeList = employees as any[];
  const filteredEmployees = employeeList.filter((employee: any) =>
    employee.fullName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalUsers = employeeList.length;

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

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar empleados..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Employee List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            Lista de Empleados ({filteredEmployees.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredEmployees.map((employee: any) => (
              <div key={employee.id} className="relative">
                {/* Mobile Swipe Container */}
                <div className="sm:hidden">
                  {/* Background Colors - Full width to prevent white showing */}
                  <div className="absolute inset-0 flex rounded-lg overflow-hidden">
                    {/* Green Call Background - Left side, extends beyond swipe limit */}
                    {(employee.companyPhone || employee.personalPhone) && (
                      <div className="w-40 bg-green-500 flex items-center justify-center">
                        <Phone className="h-6 w-6 text-white" />
                      </div>
                    )}
                    
                    {/* Blue Message Background - Right side, extends beyond swipe limit */}
                    <div className="flex-1"></div>
                    <div className="w-40 bg-blue-500 flex items-center justify-center">
                      <MessageCircle className="h-6 w-6 text-white" />
                    </div>
                  </div>

                  {/* Swipeable Content */}
                  <div 
                    className="employee-card bg-white border rounded-lg relative z-10 p-4"
                    onTouchStart={(e) => {
                      const touch = e.touches[0];
                      e.currentTarget.setAttribute('data-start-x', touch.clientX.toString());
                    }}
                    onTouchMove={(e) => {
                      const touch = e.touches[0];
                      const startX = parseFloat(e.currentTarget.getAttribute('data-start-x') || '0');
                      const diff = touch.clientX - startX;
                      
                      if (Math.abs(diff) > 10) {
                        e.preventDefault();
                        // Limit swipe distance to prevent showing white background
                        const maxSwipe = 120; // Reduced from unlimited
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
                      
                      if (Math.abs(currentX) > 70) { // Reduced threshold
                        if (currentX < 0 && (employee.companyPhone || employee.personalPhone)) {
                          // Call action
                          const phone = employee.companyPhone || employee.personalPhone;
                          window.location.href = `tel:${phone}`;
                          return;
                        } else if (currentX > 0) {
                          // Message action
                          navigate(`/test/messages?to=${employee.id}`);
                          return;
                        }
                      }
                      
                      // Reset
                      e.currentTarget.style.transition = 'transform 0.3s ease-out';
                      e.currentTarget.style.transform = 'translateX(0px)';
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
                      <Badge variant="outline" className="capitalize">
                        {employee.status || 'activo'}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Desktop View */}
                <div className="hidden sm:block bg-white border rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
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
                      <Badge variant="outline" className="capitalize">
                        {employee.status || 'activo'}
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
    </div>
  );
}