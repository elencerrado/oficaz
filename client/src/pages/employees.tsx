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
import { 
  Users, 
  UserPlus, 
  Search,
  Mail,
  Shield,
  User,
  Clock,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function Employees() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [newEmployee, setNewEmployee] = useState({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    role: 'employee',
    password: '',
  });
  
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Redirect if not admin/manager
  if (user?.role !== 'admin' && user?.role !== 'manager') {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <Shield className="mx-auto mb-4 text-red-500" size={48} />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-500">You don't have permission to view this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: employees, isLoading } = useQuery({
    queryKey: ['/api/employees'],
  });

  const { data: companySessions } = useQuery({
    queryKey: ['/api/work-sessions/company'],
  });

  const addEmployeeMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/employees', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      toast({
        title: 'Employee Added',
        description: 'New employee has been added successfully.',
      });
      setIsAddModalOpen(false);
      setNewEmployee({
        username: '',
        email: '',
        firstName: '',
        lastName: '',
        role: 'employee',
        password: '',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Add Employee',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    addEmployeeMutation.mutate(newEmployee);
  };

  const filteredEmployees = employees?.filter((employee: any) =>
    `${employee.firstName} ${employee.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.username.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'manager':
        return 'bg-blue-100 text-blue-800';
      case 'employee':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getEmployeeStats = (employeeId: number) => {
    const sessions = companySessions?.filter((session: any) => session.userId === employeeId) || [];
    const totalHours = sessions.reduce((sum: number, session: any) => 
      sum + (parseFloat(session.totalHours || '0')), 0
    );
    const activeSessions = sessions.filter((session: any) => session.status === 'active').length;
    
    return { totalHours: totalHours.toFixed(1), activeSessions };
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 rounded-lg"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Employees</h1>
          <p className="text-gray-500 mt-1">
            Manage your team members and their roles.
          </p>
        </div>
        {user?.role === 'admin' && (
          <Button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-oficaz-primary hover:bg-blue-700"
          >
            <UserPlus className="mr-2" size={16} />
            Add Employee
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="text-oficaz-primary" size={20} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Employees</p>
                <p className="text-xl font-semibold text-gray-900">
                  {employees?.length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <User className="text-oficaz-success" size={20} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Active</p>
                <p className="text-xl font-semibold text-gray-900">
                  {employees?.filter((emp: any) => emp.isActive).length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <Shield className="text-red-600" size={20} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Admins</p>
                <p className="text-xl font-semibold text-gray-900">
                  {employees?.filter((emp: any) => emp.role === 'admin').length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Clock className="text-purple-600" size={20} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Currently Working</p>
                <p className="text-xl font-semibold text-gray-900">
                  {companySessions?.filter((session: any) => session.status === 'active').length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <Input
              placeholder="Search employees by name, email, or username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Employees Grid */}
      {filteredEmployees.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEmployees.map((employee: any) => {
            const stats = getEmployeeStats(employee.id);
            
            return (
              <Card key={employee.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <Avatar className="w-12 h-12">
                      <AvatarFallback className="bg-oficaz-primary text-white text-lg">
                        {employee.firstName[0]}{employee.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {employee.firstName} {employee.lastName}
                        </h3>
                        <Badge className={getRoleColor(employee.role)}>
                          {employee.role}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">@{employee.username}</p>
                      <div className="flex items-center text-sm text-gray-500 mb-3">
                        <Mail size={14} className="mr-1" />
                        {employee.email}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-100">
                        <div className="text-center">
                          <p className="text-lg font-semibold text-gray-900">
                            {stats.totalHours}h
                          </p>
                          <p className="text-xs text-gray-500">Total Hours</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-semibold text-gray-900">
                            {employee.vacationDaysTotal - employee.vacationDaysUsed}
                          </p>
                          <p className="text-xs text-gray-500">Vacation Days</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                        <div className="flex items-center space-x-1">
                          <div className={`w-2 h-2 rounded-full ${
                            stats.activeSessions > 0 ? 'bg-oficaz-success' : 'bg-gray-400'
                          }`}></div>
                          <span className="text-xs text-gray-500">
                            {stats.activeSessions > 0 ? 'Working' : 'Offline'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">
                          Joined {format(new Date(employee.createdAt), 'MMM yyyy')}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12">
            <div className="text-center">
              <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm ? 'No employees found' : 'No employees yet'}
              </h3>
              <p className="text-gray-500 mb-4">
                {searchTerm 
                  ? 'Try adjusting your search terms.'
                  : 'Add your first employee to get started.'
                }
              </p>
              {!searchTerm && user?.role === 'admin' && (
                <Button
                  onClick={() => setIsAddModalOpen(true)}
                  className="bg-oficaz-primary hover:bg-blue-700"
                >
                  <UserPlus className="mr-2" size={16} />
                  Add Employee
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Employee Dialog */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Employee</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleAddEmployee} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={newEmployee.firstName}
                  onChange={(e) => setNewEmployee(prev => ({ ...prev, firstName: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={newEmployee.lastName}
                  onChange={(e) => setNewEmployee(prev => ({ ...prev, lastName: e.target.value }))}
                  required
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={newEmployee.email}
                onChange={(e) => setNewEmployee(prev => ({ ...prev, email: e.target.value }))}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={newEmployee.username}
                onChange={(e) => setNewEmployee(prev => ({ ...prev, username: e.target.value }))}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={newEmployee.password}
                onChange={(e) => setNewEmployee(prev => ({ ...prev, password: e.target.value }))}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="role">Role</Label>
              <Select
                value={newEmployee.role}
                onValueChange={(value) => setNewEmployee(prev => ({ ...prev, role: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  {user?.role === 'admin' && (
                    <SelectItem value="admin">Admin</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddModalOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addEmployeeMutation.isPending}
                className="flex-1 bg-oficaz-primary hover:bg-blue-700"
              >
                {addEmployeeMutation.isPending ? 'Adding...' : 'Add Employee'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
