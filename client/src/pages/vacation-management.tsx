import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, User, Calendar, Clock, MapPin, Search } from "lucide-react";
import { format, differenceInDays, parseISO, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import StatsCard from "@/components/StatsCard";

interface VacationRequest {
  id: number;
  userId: number;
  startDate: string;
  endDate: string;
  days: number;
  reason?: string;
  status: 'pending' | 'approved' | 'denied';
  requestDate: string;
  user?: {
    fullName: string;
    email: string;
  };
}

interface Employee {
  id: number;
  fullName: string;
  totalVacationDays: string;
  usedVacationDays: string;
  status: string;
}

export default function VacationManagement() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Fetch data
  const { data: vacationRequests = [], isLoading: loadingRequests } = useQuery<VacationRequest[]>({
    queryKey: ['/api/vacation-requests/company'],
    staleTime: 90000,
    refetchInterval: 120000,
  });

  const { data: employees = [], isLoading: loadingEmployees } = useQuery<Employee[]>({
    queryKey: ['/api/employees'],
    staleTime: 90000,
    refetchInterval: 120000,
  });

  // Helper functions
  const calculateDays = (startDate: string, endDate: string): number => {
    return differenceInDays(parseISO(endDate), parseISO(startDate)) + 1;
  };

  // Calculate vacation data for each employee
  const employeeVacationData = employees.map((employee: Employee) => {
    const totalDays = parseFloat(employee.totalVacationDays || '0');
    const usedDays = parseFloat(employee.usedVacationDays || '0');
    const availableDays = Math.max(0, totalDays - usedDays);
    const usagePercentage = totalDays > 0 ? (usedDays / totalDays) * 100 : 0;

    // Get employee's vacation requests
    const employeeRequests = vacationRequests.filter((req: VacationRequest) => req.userId === employee.id);
    const pendingRequests = employeeRequests.filter((req: VacationRequest) => req.status === 'pending');
    const approvedRequests = employeeRequests.filter((req: VacationRequest) => req.status === 'approved');

    // Check if currently on vacation
    const isCurrentlyOnVacation = approvedRequests.some((req: VacationRequest) => {
      const today = new Date().toISOString().split('T')[0];
      const startDate = req.startDate.split('T')[0];
      const endDate = req.endDate.split('T')[0];
      return startDate <= today && today <= endDate;
    });

    return {
      ...employee,
      totalDays,
      usedDays,
      availableDays,
      usagePercentage,
      pendingRequests: pendingRequests.length,
      approvedRequests: approvedRequests.length,
      isCurrentlyOnVacation,
      requests: employeeRequests
    };
  });

  // Filter employees based on search term
  const filteredEmployees = employeeVacationData.filter((emp) =>
    emp.fullName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Timeline functions
  const getDaysInMonth = (date: Date) => {
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    return eachDayOfInterval({ start, end });
  };

  const getVacationForDay = (day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return vacationRequests.filter((req: VacationRequest) => {
      if (req.status !== 'approved' && req.status !== 'pending') return false;
      const startDate = req.startDate.split('T')[0];
      const endDate = req.endDate.split('T')[0];
      return startDate <= dayStr && dayStr <= endDate;
    });
  };

  const goToPreviousMonth = () => {
    setCurrentDate(prev => subMonths(prev, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(prev => addMonths(prev, 1));
  };

  const getVacationColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-500';
      case 'pending': return 'bg-yellow-500';
      case 'denied': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  // Statistics for dashboard
  const totalRequests = vacationRequests.length;
  const pendingCount = vacationRequests.filter(r => r.status === 'pending').length;
  const approvedCount = vacationRequests.filter(r => r.status === 'approved').length;
  const onVacationCount = employeeVacationData.filter(emp => emp.isCurrentlyOnVacation).length;

  if (loadingRequests || loadingEmployees) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="px-6 py-4 min-h-screen bg-gray-50" style={{ overflowX: 'clip' }}>
      {/* Standard header pattern */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Gestión de Vacaciones</h1>
        <p className="text-gray-500 mt-1">
          Vista general de vacaciones del equipo con timeline y análisis de solapamientos
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatsCard 
          title="Total Solicitudes" 
          value={totalRequests} 
          subtitle="este año" 
          icon={Calendar}
        />
        <StatsCard 
          title="Pendientes" 
          value={pendingCount} 
          subtitle="por aprobar" 
          icon={Clock}
        />
        <StatsCard 
          title="Aprobadas" 
          value={approvedCount} 
          subtitle="confirmadas" 
          icon={Calendar}
        />
        <StatsCard 
          title="En Vacaciones" 
          value={onVacationCount} 
          subtitle="actualmente" 
          icon={MapPin}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Employee List with Vacation Progress */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">Lista de Empleados</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Buscar empleado..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
          </div>

          <div className="space-y-3">
            {filteredEmployees.map((employee) => (
              <Card 
                key={employee.id} 
                className={`transition-all duration-200 cursor-pointer hover:shadow-md ${
                  selectedEmployee === employee.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                }`}
                onClick={() => setSelectedEmployee(selectedEmployee === employee.id ? null : employee.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{employee.fullName}</h3>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          {employee.isCurrentlyOnVacation && (
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              De vacaciones
                            </Badge>
                          )}
                          {employee.pendingRequests > 0 && (
                            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                              {employee.pendingRequests} pendiente{employee.pendingRequests > 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Vacation Progress - Inspired by employee view */}
                  <div className="space-y-3">
                    {/* Stats grid */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-lg font-semibold text-blue-600">{employee.totalDays}</div>
                        <div className="text-xs text-gray-600">Total</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-orange-600">{employee.usedDays}</div>
                        <div className="text-xs text-gray-600">Usados</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-green-600">{employee.availableDays}</div>
                        <div className="text-xs text-gray-600">Disponibles</div>
                      </div>
                    </div>
                    
                    {/* Progress bar with vacation style */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 font-medium">Progreso anual</span>
                        <span className="text-sm text-gray-600 font-medium">{employee.usagePercentage.toFixed(1)}%</span>
                      </div>
                      
                      {/* Modern thick progress bar */}
                      <div className="relative">
                        <div className="w-full bg-gray-200 rounded-xl h-4 overflow-hidden">
                          <div 
                            className="bg-blue-500 h-full rounded-xl transition-all duration-1000 ease-out"
                            style={{ 
                              width: `${Math.min(employee.usagePercentage, 100)}%`
                            }}
                          />
                        </div>
                      </div>
                      
                      {/* Legend */}
                      <div className="flex justify-between items-center text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <span>Usados</span>
                        </div>
                        <span className="text-green-600">{employee.availableDays} días disponibles</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Timeline Diagram */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">Timeline de Vacaciones</h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPreviousMonth}
                disabled={false}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[120px] text-center">
                {format(currentDate, 'MMMM yyyy', { locale: es })}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={goToNextMonth}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detección de Solapamientos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Legend */}
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-green-500 rounded"></div>
                    <span>Aprobado</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                    <span>Pendiente</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-red-500 rounded"></div>
                    <span>Denegado</span>
                  </div>
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1 text-xs">
                  {/* Day headers */}
                  {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day) => (
                    <div key={day} className="text-center font-medium text-gray-500 p-1">
                      {day}
                    </div>
                  ))}
                  
                  {/* Calendar days */}
                  {getDaysInMonth(currentDate).map((day, index) => {
                    const vacationsForDay = getVacationForDay(day);
                    const hasMultipleVacations = vacationsForDay.length > 1;
                    
                    return (
                      <div
                        key={index}
                        className={`
                          relative p-1 min-h-[32px] border border-gray-200 text-center text-xs
                          ${hasMultipleVacations ? 'bg-red-100 ring-2 ring-red-400' : 'bg-white'}
                        `}
                        title={
                          vacationsForDay.length > 0
                            ? `${vacationsForDay.length} persona${vacationsForDay.length > 1 ? 's' : ''} de vacaciones`
                            : ''
                        }
                      >
                        <div className="font-medium text-gray-700">
                          {format(day, 'd')}
                        </div>
                        
                        {/* Vacation indicators */}
                        {vacationsForDay.length > 0 && (
                          <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-0.5">
                            {vacationsForDay.slice(0, 3).map((vacation, idx) => (
                              <div
                                key={idx}
                                className={`w-1.5 h-1.5 rounded-full ${getVacationColor(vacation.status)}`}
                                title={`${vacation.user?.fullName || 'Usuario'} - ${vacation.status}`}
                              />
                            ))}
                            {vacationsForDay.length > 3 && (
                              <div className="w-1.5 h-1.5 rounded-full bg-gray-600" title={`+${vacationsForDay.length - 3} más`} />
                            )}
                          </div>
                        )}
                        
                        {/* Overlap warning */}
                        {hasMultipleVacations && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full text-white text-xs font-bold flex items-center justify-center">
                            !
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Overlap warnings */}
                {getDaysInMonth(currentDate).some(day => getVacationForDay(day).length > 1) && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <h4 className="font-medium text-red-800 mb-2">⚠️ Solapamientos Detectados</h4>
                    <div className="space-y-1 text-sm text-red-700">
                      {getDaysInMonth(currentDate)
                        .filter(day => getVacationForDay(day).length > 1)
                        .slice(0, 5) // Show first 5 conflicts
                        .map((day, index) => {
                          const vacations = getVacationForDay(day);
                          return (
                            <div key={index}>
                              <strong>{format(day, 'd MMMM', { locale: es })}:</strong>{' '}
                              {vacations.map(v => v.user?.fullName || 'Usuario').join(', ')}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Selected employee details */}
                {selectedEmployee && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-medium text-blue-800 mb-2">
                      Vacaciones de {employeeVacationData.find(emp => emp.id === selectedEmployee)?.fullName}
                    </h4>
                    <div className="space-y-1 text-sm text-blue-700">
                      {employeeVacationData
                        .find(emp => emp.id === selectedEmployee)?.requests
                        .filter(req => req.status === 'approved' || req.status === 'pending')
                        .map((request, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <Badge 
                              variant="secondary" 
                              className={`
                                ${request.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}
                              `}
                            >
                              {request.status === 'approved' ? 'Aprobado' : 'Pendiente'}
                            </Badge>
                            <span>
                              {format(parseISO(request.startDate), 'd MMM', { locale: es })} - {' '}
                              {format(parseISO(request.endDate), 'd MMM', { locale: es })} ({request.days} días)
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}