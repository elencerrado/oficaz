import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getAuthHeaders } from "@/lib/auth";
import { 
  Building2, 
  Users, 
  Crown, 
  TrendingUp, 
  LogOut,
  Search,
  Filter,
  Eye,
  Settings,
  Edit,
  Check,
  X,
  Mail,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

interface CompanyWithStats {
  id: number;
  name: string;
  cif: string;
  email: string;
  alias: string;
  userCount: number;
  subscription: {
    plan: string;
    status: string;
    maxUsers: number;
    startDate: string;
    endDate?: string;
  };
  createdAt: string;
}

interface SuperAdminStats {
  totalCompanies: number;
  totalUsers: number;
  activeSubscriptions: number;
  activePaidSubscriptions: number;
  revenue: number;
  monthlyRevenue: number;
  yearlyRevenue: number;
  planDistribution: {
    free: number;
    basic: number;
    pro: number;
    master: number;
  };
}

const planColors = {
  free: "bg-gray-500",
  basic: "bg-blue-500", 
  pro: "bg-purple-500",
  master: "bg-gradient-to-r from-yellow-400 to-yellow-600"
};

const planLabels = {
  free: "Free",
  basic: "Basic", 
  pro: "Pro",
  master: "Master"
};

export default function SuperAdminDashboard() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPlan, setFilterPlan] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [editingCompany, setEditingCompany] = useState<number | null>(null);
  const [newPlan, setNewPlan] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useQuery<SuperAdminStats>({
    queryKey: ['/api/super-admin/stats'],
    queryFn: async () => {
      const response = await fetch('/api/super-admin/stats', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
  });

  const { data: companies, isLoading: companiesLoading } = useQuery<CompanyWithStats[]>({
    queryKey: ['/api/super-admin/companies'],
    queryFn: async () => {
      const response = await fetch('/api/super-admin/companies', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch companies');
      return response.json();
    },
  });

  const { data: pendingDeletions } = useQuery({
    queryKey: ['/api/superadmin/companies/pending-deletion'],
    queryFn: async () => {
      const response = await fetch('/api/superadmin/companies/pending-deletion', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch pending deletions');
      return response.json();
    },
  });

  const handleLogout = () => {
    localStorage.removeItem('superAdminToken');
    setLocation("/super-admin");
  };

  const updateSubscriptionMutation = useMutation({
    mutationFn: async ({ companyId, plan }: { companyId: number; plan: string }) => {
      const response = await fetch(`/api/super-admin/companies/${companyId}/subscription`, {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan }),
      });
      if (!response.ok) throw new Error('Failed to update subscription');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Plan actualizado",
        description: "El plan de suscripción se ha actualizado correctamente.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/companies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/stats'] });
      setEditingCompany(null);
      setNewPlan("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el plan",
        variant: "destructive",
      });
    },
  });

  const handlePlanChange = (companyId: number, currentPlan: string) => {
    setEditingCompany(companyId);
    setNewPlan(currentPlan);
  };

  const savePlanChange = (companyId: number) => {
    if (newPlan) {
      updateSubscriptionMutation.mutate({ companyId, plan: newPlan });
    }
  };

  const cancelPlanChange = () => {
    setEditingCompany(null);
    setNewPlan("");
  };

  const filteredCompanies = companies?.filter(company => {
    const matchesSearch = company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          company.cif.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          company.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesPlan = filterPlan === "all" || company.subscription.plan === filterPlan;
    const matchesStatus = filterStatus === "all" || company.subscription.status === filterStatus;
    
    return matchesSearch && matchesPlan && matchesStatus;
  }) || [];

  if (statsLoading || companiesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white/70">Cargando panel de administración...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-xl border-b border-white/20">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Crown className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-white">Oficaz Super Admin</h1>
                <p className="text-white/60 text-sm">Panel de administración global</p>
              </div>
            </div>
            <Button
              onClick={handleLogout}
              variant="ghost"
              className="text-white/80 hover:text-white hover:bg-white/10"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Quick Actions */}
        <Card className="bg-white/10 backdrop-blur-xl border-white/20 mb-8">
          <CardHeader>
            <CardTitle className="text-white">Acciones rápidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Button 
                variant="ghost" 
                className="h-auto p-4 bg-white/5 hover:bg-white/10 border border-white/20 text-white flex flex-col items-center gap-3"
                onClick={() => setLocation('/super-admin/invitations')}
              >
                <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
                  <Mail className="h-6 w-6 text-orange-400" />
                </div>
                <div className="text-center">
                  <p className="font-medium">Invitaciones</p>
                  <p className="text-xs text-white/60">Gestionar registro</p>
                </div>
              </Button>

              <Button 
                variant="ghost" 
                className="h-auto p-4 bg-white/5 hover:bg-white/10 border border-white/20 text-white flex flex-col items-center gap-3"
                onClick={() => {
                  console.log('Navegando a gestión de empresas');
                  setLocation('/super-admin/companies');
                }}
              >
                <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                  <Users className="h-6 w-6 text-emerald-400" />
                </div>
                <div className="text-center">
                  <p className="font-medium">Gestión de Empresas</p>
                  <p className="text-xs text-white/60">Configurar empresas</p>
                </div>
              </Button>
              
              <Button 
                variant="ghost" 
                className="h-auto p-4 bg-white/5 hover:bg-white/10 border border-white/20 text-white flex flex-col items-center gap-3"
                onClick={() => setLocation('/super-admin/plans')}
              >
                <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                  <Settings className="h-6 w-6 text-purple-400" />
                </div>
                <div className="text-center">
                  <p className="font-medium">Gestión de Planes</p>
                  <p className="text-xs text-white/60">Configurar suscripciones</p>
                </div>
              </Button>



              <Button 
                variant="ghost" 
                className="h-auto p-4 bg-white/5 hover:bg-white/10 border border-white/20 text-white flex flex-col items-center gap-3"
              >
                <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-blue-400" />
                </div>
                <div className="text-center">
                  <p className="font-medium">Nueva empresa</p>
                  <p className="text-xs text-white/60">Registrar nueva empresa</p>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <Card className="bg-white/10 backdrop-blur-xl border-white/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white/80">
                Empresas Registradas
              </CardTitle>
              <Building2 className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats?.totalCompanies || 0}</div>
              <p className="text-xs text-white/60">
                Total en la plataforma
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-xl border-white/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white/80">
                Empresas Pagando
              </CardTitle>
              <Crown className="h-4 w-4 text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats?.activePaidSubscriptions || 0}</div>
              <p className="text-xs text-white/60">
                Con suscripción activa
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-xl border-white/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white/80">
                Usuarios Activos
              </CardTitle>
              <Users className="h-4 w-4 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats?.totalUsers || 0}</div>
              <p className="text-xs text-white/60">
                Total registrados
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-xl border-white/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white/80">
                Ingresos Mensuales
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-yellow-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">€{Number(stats?.monthlyRevenue || 0).toFixed(2)}</div>
              <p className="text-xs text-white/60">
                MRR (recurrente)
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-xl border-white/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white/80">
                Ingresos Anuales
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">€{Number(stats?.yearlyRevenue || 0).toFixed(2)}</div>
              <p className="text-xs text-white/60">
                ARR (proyectado)
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Plan Distribution */}
        <Card className="bg-white/10 backdrop-blur-xl border-white/20 mb-8">
          <CardHeader>
            <CardTitle className="text-white">Distribución de Planes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(stats?.planDistribution || {}).map(([plan, count]) => (
                <div key={plan} className="text-center">
                  <div className={`w-12 h-12 ${planColors[plan as keyof typeof planColors]} rounded-xl flex items-center justify-center mx-auto mb-2`}>
                    <span className="text-white font-bold">{count}</span>
                  </div>
                  <p className="text-white/80 font-medium">{planLabels[plan as keyof typeof planLabels]}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pending Deletions Alert */}
        {pendingDeletions && pendingDeletions.length > 0 && (
          <Card className="bg-red-500/20 backdrop-blur-xl border-red-500/30 mb-6">
            <CardHeader>
              <CardTitle className="text-red-300 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Empresas Programadas para Eliminación ({pendingDeletions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendingDeletions.map((company: any) => (
                  <div key={company.id} className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-red-200 font-medium">{company.name}</p>
                        <p className="text-red-300/70 text-sm">{company.email} • {company.cif}</p>
                        <p className="text-red-300/60 text-xs mt-1">
                          Eliminación programada: {new Date(company.deletionWillOccurAt).toLocaleDateString('es-ES')}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant={company.daysRemaining <= 7 ? "destructive" : "secondary"} 
                               className={company.daysRemaining <= 7 ? "bg-red-600 text-white" : "bg-orange-600 text-white"}>
                          {company.daysRemaining} días restantes
                        </Badge>
                        <p className="text-red-300/60 text-xs mt-1">
                          Programada: {new Date(company.deletionScheduledAt).toLocaleDateString('es-ES')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card className="bg-white/10 backdrop-blur-xl border-white/20 mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50 w-4 h-4" />
                  <Input
                    placeholder="Buscar empresas por nombre, CIF o email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/50 pl-10"
                  />
                </div>
              </div>
              <Select value={filterPlan} onValueChange={setFilterPlan}>
                <SelectTrigger className="w-48 bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="Filtrar por plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los planes</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="master">Master</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-48 bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                  <SelectItem value="suspended">Suspendido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Companies List */}
        <Card className="bg-white/10 backdrop-blur-xl border-white/20">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              Empresas ({filteredCompanies.length})
              <Badge variant="secondary" className="bg-white/20 text-white">
                {filteredCompanies.length} de {companies?.length || 0}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredCompanies.map((company) => (
                <div
                  key={company.id}
                  className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{company.name}</h3>
                      <div className="flex items-center gap-4 text-sm text-white/60">
                        <span>{company.cif}</span>
                        <span>•</span>
                        <span>{company.email}</span>
                        <span>•</span>
                        <span>{company.userCount} usuarios</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {editingCompany === company.id ? (
                      <div className="flex items-center gap-2">
                        <Select value={newPlan} onValueChange={setNewPlan}>
                          <SelectTrigger className="w-32 bg-white/10 border-white/20 text-white">
                            <SelectValue placeholder="Seleccionar plan" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="free">Free</SelectItem>
                            <SelectItem value="basic">Basic</SelectItem>
                            <SelectItem value="pro">Pro</SelectItem>
                            <SelectItem value="master">Master</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          onClick={() => savePlanChange(company.id)}
                          disabled={updateSubscriptionMutation.isPending}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={cancelPlanChange}
                          className="text-white/60 hover:text-white hover:bg-white/10"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Badge 
                          className={`${planColors[company.subscription.plan as keyof typeof planColors]} text-white cursor-pointer hover:opacity-80`}
                          onClick={() => handlePlanChange(company.id, company.subscription.plan)}
                        >
                          {planLabels[company.subscription.plan as keyof typeof planLabels]}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setLocation(`/super-admin/companies/${company.id}`)}
                          className="text-white/60 hover:text-white hover:bg-white/10"
                          title="Gestionar empresa"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    <Badge 
                      variant={company.subscription.status === 'active' ? 'default' : 'secondary'}
                      className={company.subscription.status === 'active' ? 'bg-emerald-500' : 'bg-gray-500'}
                    >
                      {company.subscription.status === 'active' ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                </div>
              ))}
              
              {filteredCompanies.length === 0 && (
                <div className="text-center py-12">
                  <Filter className="w-12 h-12 text-white/30 mx-auto mb-4" />
                  <p className="text-white/60">No se encontraron empresas con los filtros aplicados</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}