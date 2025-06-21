import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { CalendarDays, Users, MapPin, Plus, Check, X, Clock, Plane, Edit, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

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

interface Holiday {
  id?: number;
  name: string;
  date: string;
  type: 'national' | 'regional' | 'local';
  region?: string;
}

const spanishHolidays2025: Holiday[] = [
  { name: "Año Nuevo", date: "2025-01-01", type: "national" },
  { name: "Día de Reyes", date: "2025-01-06", type: "national" },
  { name: "Viernes Santo", date: "2025-04-18", type: "national" },
  { name: "Día del Trabajador", date: "2025-05-01", type: "national" },
  { name: "Asunción de la Virgen", date: "2025-08-15", type: "national" },
  { name: "Día de la Hispanidad", date: "2025-10-12", type: "national" },
  { name: "Todos los Santos", date: "2025-11-01", type: "national" },
  { name: "Día de la Constitución", date: "2025-12-06", type: "national" },
  { name: "Inmaculada Concepción", date: "2025-12-08", type: "national" },
  { name: "Navidad", date: "2025-12-25", type: "national" },
];

const regions = [
  "Andalucía", "Aragón", "Asturias", "Baleares", "Canarias", "Cantabria",
  "Castilla-La Mancha", "Castilla y León", "Cataluña", "Extremadura",
  "Galicia", "Madrid", "Murcia", "Navarra", "País Vasco", "La Rioja", "Valencia"
];

export default function VacationManagement() {
  const [activeTab, setActiveTab] = useState("requests");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("Madrid");
  const [newHoliday, setNewHoliday] = useState({ name: "", date: "", type: "regional" as const });
  const [showAddHoliday, setShowAddHoliday] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<VacationRequest | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [modalAction, setModalAction] = useState<'approve' | 'deny' | 'edit'>('approve');
  const [editDates, setEditDates] = useState({ startDate: null as Date | null, endDate: null as Date | null });
  const [adminComment, setAdminComment] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch vacation requests
  const { data: vacationRequests = [], isLoading: loadingRequests } = useQuery({
    queryKey: ['/api/vacation-requests/company'],
    staleTime: 5 * 60 * 1000,
    select: (data) => {
      // Ensure data consistency and handle missing fields
      return data.map((request: any) => ({
        ...request,
        days: request.days || 0,
        requestDate: request.requestDate || request.createdAt || new Date().toISOString(),
        user: request.user || { fullName: "Usuario desconocido", email: "" }
      }));
    }
  });

  // Fetch employees for vacation overview
  const { data: employees = [], isLoading: loadingEmployees } = useQuery({
    queryKey: ['/api/employees'],
    staleTime: 5 * 60 * 1000,
  });

  // Update vacation request status
  const updateRequestMutation = useMutation({
    mutationFn: async ({ id, status, startDate, endDate, adminComment }: { 
      id: number; 
      status: string; 
      startDate?: string; 
      endDate?: string; 
      adminComment?: string;
    }) => {
      const updateData: any = { status };
      if (startDate) updateData.startDate = startDate;
      if (endDate) updateData.endDate = endDate;
      if (adminComment) updateData.adminComment = adminComment;
      
      return apiRequest(`/api/vacation-requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vacation-requests/company'] });
      setShowRequestModal(false);
      setSelectedRequest(null);
      setAdminComment("");
      toast({ title: "Solicitud actualizada correctamente" });
    },
    onError: () => {
      toast({ 
        title: "Error", 
        description: "No se pudo actualizar la solicitud",
        variant: "destructive" 
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200",
      approved: "bg-green-100 text-green-800 hover:bg-green-200", 
      denied: "bg-red-100 text-red-800 hover:bg-red-200"
    };
    const labels = {
      pending: "Pendiente",
      approved: "Aprobada",
      denied: "Denegada"
    };
    return (
      <Badge className={variants[status as keyof typeof variants]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  const filteredRequests = vacationRequests.filter((request: VacationRequest) => {
    const matchesStatus = selectedStatus === "all" || request.status === selectedStatus;
    const matchesSearch = searchTerm === "" || 
      (request.user?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
    return matchesStatus && matchesSearch;
  });

  const employeesOnVacation = employees.filter((emp: Employee) => emp.status === 'de_vacaciones');

  const getVacationStats = () => {
    const pending = vacationRequests.filter((r: VacationRequest) => r.status === 'pending').length;
    const approved = vacationRequests.filter((r: VacationRequest) => r.status === 'approved').length;
    const onVacation = employeesOnVacation.length;
    return { pending, approved, onVacation };
  };

  const stats = getVacationStats();

  const openRequestModal = (request: VacationRequest, action: 'approve' | 'deny' | 'edit') => {
    setSelectedRequest(request);
    setModalAction(action);
    setEditDates({
      startDate: request.startDate ? new Date(request.startDate) : null,
      endDate: request.endDate ? new Date(request.endDate) : null
    });
    setAdminComment("");
    setShowRequestModal(true);
  };

  const handleRequestAction = () => {
    if (!selectedRequest) return;

    const updateData: any = {
      id: selectedRequest.id,
      status: modalAction === 'approve' ? 'approved' : modalAction === 'deny' ? 'denied' : selectedRequest.status
    };

    if (modalAction === 'edit' && editDates.startDate && editDates.endDate) {
      updateData.startDate = editDates.startDate.toISOString().split('T')[0];
      updateData.endDate = editDates.endDate.toISOString().split('T')[0];
      updateData.status = 'approved'; // Auto-approve when editing dates
    }

    if (adminComment.trim()) {
      updateData.adminComment = adminComment.trim();
    }

    updateRequestMutation.mutate(updateData);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Gestión de Vacaciones</h1>
          <p className="text-sm text-gray-600 mt-1">
            Administra solicitudes, empleados de vacaciones y días festivos
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500 rounded-lg">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-yellow-700 font-medium">Solicitudes Pendientes</p>
                  <p className="text-lg font-bold text-yellow-800">{stats.pending}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500 rounded-lg">
                  <Check className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-green-700 font-medium">Solicitudes Aprobadas</p>
                  <p className="text-lg font-bold text-green-800">{stats.approved}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500 rounded-lg">
                  <Plane className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-blue-700 font-medium">Empleados de Vacaciones</p>
                  <p className="text-lg font-bold text-blue-800">{stats.onVacation}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500 rounded-lg">
                  <CalendarDays className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-purple-700 font-medium">Días Festivos 2025</p>
                  <p className="text-lg font-bold text-purple-800">{spanishHolidays2025.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="requests">Solicitudes</TabsTrigger>
          <TabsTrigger value="employees">Empleados de Vacaciones</TabsTrigger>
          <TabsTrigger value="holidays">Días Festivos</TabsTrigger>
        </TabsList>

        {/* Vacation Requests Tab */}
        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row gap-4 justify-between">
                <CardTitle className="text-lg font-medium">Solicitudes de Vacaciones</CardTitle>
                <div className="flex gap-2">
                  <Input
                    placeholder="Buscar empleado..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-48"
                  />
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="pending">Pendientes</SelectItem>
                      <SelectItem value="approved">Aprobadas</SelectItem>
                      <SelectItem value="denied">Denegadas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingRequests ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : filteredRequests.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {vacationRequests.length === 0 
                    ? "No hay solicitudes de vacaciones" 
                    : "No se encontraron solicitudes con los filtros aplicados"}
                  <div className="text-xs text-gray-400 mt-2">
                    Total de solicitudes: {vacationRequests.length}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredRequests.map((request: VacationRequest) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-medium text-gray-900">{request.user?.fullName}</h3>
                          {getStatusBadge(request.status)}
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p>
                            <span className="font-medium">Fechas:</span>{" "}
                            {request.startDate ? format(new Date(request.startDate), "dd/MM/yyyy", { locale: es }) : "N/A"} -{" "}
                            {request.endDate ? format(new Date(request.endDate), "dd/MM/yyyy", { locale: es }) : "N/A"}
                          </p>
                          <p>
                            <span className="font-medium">Días:</span> {request.days || "N/A"}
                          </p>
                          {request.reason && (
                            <p>
                              <span className="font-medium">Motivo:</span> {request.reason}
                            </p>
                          )}
                          <p>
                            <span className="font-medium">Solicitado:</span>{" "}
                            {request.requestDate ? format(new Date(request.requestDate), "dd/MM/yyyy", { locale: es }) : "N/A"}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 ml-4">
                        {request.status === 'pending' ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => openRequestModal(request, 'approve')}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Aprobar
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => openRequestModal(request, 'edit')}
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              Modificar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => openRequestModal(request, 'deny')}
                            >
                              <X className="w-4 h-4 mr-1" />
                              Denegar
                            </Button>
                          </>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            {request.status === 'approved' ? 'Aprobada' : 'Denegada'}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Employees on Vacation Tab */}
        <TabsContent value="employees" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Users className="w-5 h-5" />
                Empleados de Vacaciones
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingEmployees ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : employeesOnVacation.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No hay empleados de vacaciones actualmente
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {employeesOnVacation.map((employee: Employee) => (
                    <Card key={employee.id} className="border-blue-200 bg-blue-50">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-500 rounded-full">
                            <Plane className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900">{employee.fullName}</h3>
                            <div className="text-sm text-gray-600">
                              <p>Días totales: {employee.totalVacationDays}</p>
                              <p>Días usados: {employee.usedVacationDays}</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Holidays Tab */}
        <TabsContent value="holidays" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  <CalendarDays className="w-5 h-5" />
                  Días Festivos de España 2025
                </CardTitle>
                <div className="flex gap-2 items-center">
                  <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {regions.map((region) => (
                        <SelectItem key={region} value={region}>{region}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Dialog open={showAddHoliday} onOpenChange={setShowAddHoliday}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="bg-[#007AFF] hover:bg-[#0056CC]">
                        <Plus className="w-4 h-4 mr-1" />
                        Añadir Festivo
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Añadir Día Festivo</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <Input
                          placeholder="Nombre del festivo"
                          value={newHoliday.name}
                          onChange={(e) => setNewHoliday(prev => ({ ...prev, name: e.target.value }))}
                        />
                        <Input
                          type="date"
                          value={newHoliday.date}
                          onChange={(e) => setNewHoliday(prev => ({ ...prev, date: e.target.value }))}
                        />
                        <Select 
                          value={newHoliday.type} 
                          onValueChange={(value: 'national' | 'regional' | 'local') => 
                            setNewHoliday(prev => ({ ...prev, type: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="national">Nacional</SelectItem>
                            <SelectItem value="regional">Regional</SelectItem>
                            <SelectItem value="local">Local</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setShowAddHoliday(false)}>
                            Cancelar
                          </Button>
                          <Button className="bg-[#007AFF] hover:bg-[#0056CC]">
                            Añadir
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {spanishHolidays2025.map((holiday, index) => (
                  <Card key={index} className="border-green-200 bg-green-50">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-gray-900 mb-1">{holiday.name}</h3>
                          <p className="text-sm text-gray-600">
                            {format(new Date(holiday.date), "dd/MM/yyyy", { locale: es })}
                          </p>
                          <Badge 
                            variant="secondary" 
                            className="mt-2 text-xs bg-green-100 text-green-800"
                          >
                            {holiday.type === 'national' ? 'Nacional' : 
                             holiday.type === 'regional' ? 'Regional' : 'Local'}
                          </Badge>
                        </div>
                        <MapPin className="w-4 h-4 text-green-600" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Request Management Modal */}
      <Dialog open={showRequestModal} onOpenChange={setShowRequestModal}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {modalAction === 'approve' && <Check className="w-5 h-5 text-green-600" />}
              {modalAction === 'deny' && <X className="w-5 h-5 text-red-600" />}
              {modalAction === 'edit' && <Edit className="w-5 h-5 text-blue-600" />}
              
              {modalAction === 'approve' && 'Aprobar Solicitud'}
              {modalAction === 'deny' && 'Denegar Solicitud'}
              {modalAction === 'edit' && 'Modificar Solicitud'}
            </DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-1">{selectedRequest.user?.fullName}</h3>
                <p className="text-sm text-gray-600">
                  {selectedRequest.startDate ? format(new Date(selectedRequest.startDate), "dd/MM/yyyy", { locale: es }) : "N/A"} -{" "}
                  {selectedRequest.endDate ? format(new Date(selectedRequest.endDate), "dd/MM/yyyy", { locale: es }) : "N/A"}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Días:</span> {selectedRequest.days || "N/A"}
                </p>
                {selectedRequest.reason && (
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Motivo:</span> {selectedRequest.reason}
                  </p>
                )}
              </div>

              {modalAction === 'edit' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                      Nueva fecha de inicio
                    </label>
                    <DatePicker
                      value={editDates.startDate}
                      onChange={(date) => setEditDates(prev => ({ ...prev, startDate: date || null }))}
                      placeholder="Seleccionar fecha de inicio"
                      disabled={(date) => date < new Date()}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                      Nueva fecha de fin
                    </label>
                    <DatePicker
                      value={editDates.endDate}
                      onChange={(date) => setEditDates(prev => ({ ...prev, endDate: date || null }))}
                      placeholder="Seleccionar fecha de fin"
                      disabled={(date) => {
                        if (editDates.startDate) {
                          return date < editDates.startDate;
                        }
                        return date < new Date();
                      }}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  {modalAction === 'deny' ? 'Motivo del rechazo' : 'Comentario (opcional)'}
                </label>
                <Textarea
                  value={adminComment}
                  onChange={(e) => setAdminComment(e.target.value)}
                  placeholder={modalAction === 'deny' 
                    ? "Explica el motivo del rechazo..." 
                    : "Añade un comentario si es necesario..."
                  }
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowRequestModal(false)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleRequestAction}
                  disabled={updateRequestMutation.isPending || (modalAction === 'deny' && !adminComment.trim())}
                  className={
                    modalAction === 'approve' 
                      ? "bg-green-600 hover:bg-green-700"
                      : modalAction === 'deny'
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  }
                >
                  {updateRequestMutation.isPending ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      {modalAction === 'approve' && <Check className="w-4 h-4 mr-1" />}
                      {modalAction === 'deny' && <X className="w-4 h-4 mr-1" />}
                      {modalAction === 'edit' && <Edit className="w-4 h-4 mr-1" />}
                      
                      {modalAction === 'approve' && 'Aprobar'}
                      {modalAction === 'deny' && 'Denegar'}
                      {modalAction === 'edit' && 'Modificar'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}