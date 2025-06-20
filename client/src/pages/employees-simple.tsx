import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Users, 
  Search, 
  Phone, 
  MessageCircle,
  Edit,
  Shield,
  Clock,
  Calendar
} from 'lucide-react';

export default function EmployeesSimple() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: employees = [] } = useQuery({
    queryKey: ['/api/employees'],
    enabled: !!user && (user.role === 'admin' || user.role === 'manager')
  });

  const filteredEmployees = employees.filter((employee: any) =>
    employee.fullName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
          Gestión de Empleados
        </h1>
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
                  {/* Background Colors */}
                  <div className="absolute inset-0 flex">
                    {/* Green Call Background - Left */}
                    {(employee.companyPhone || employee.personalPhone) && (
                      <div className="w-20 bg-green-500 flex items-center justify-center rounded-l-lg">
                        <Phone className="h-6 w-6 text-white" />
                      </div>
                    )}
                    
                    {/* Blue Message Background - Right */}
                    <div className="flex-1"></div>
                    <div className="w-20 bg-blue-500 flex items-center justify-center rounded-r-lg">
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
                        e.currentTarget.style.transform = `translateX(${diff}px)`;
                        e.currentTarget.style.transition = 'none';
                        console.log(`Swipe: ${diff}px`);
                      }
                    }}
                    onTouchEnd={(e) => {
                      const transform = e.currentTarget.style.transform;
                      const match = transform.match(/translateX\((.+?)px\)/);
                      const currentX = match ? parseFloat(match[1]) : 0;
                      
                      if (Math.abs(currentX) > 80) {
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
    </div>
  );
}