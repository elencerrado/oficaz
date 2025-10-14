import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getAuthHeaders } from "@/lib/auth";
import { 
  Building2, 
  Users, 
  Crown, 
  TrendingUp, 
  LogOut,
  Eye,
  Settings,
  Mail,
  AlertTriangle,
  BarChart3,
  Euro,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
    basic: number;
    pro: number;
    master: number;
  };
}

const planColors = {
  basic: "bg-blue-500", 
  pro: "bg-purple-500",
  master: "bg-gradient-to-r from-yellow-400 to-yellow-600"
};

const planLabels = {
  basic: "Basic", 
  pro: "Pro",
  master: "Master"
};

export default function SuperAdminDashboard() {
  const [, setLocation] = useLocation();

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
        {/* Metrics Viewer Card */}
        <Card 
          className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border-white/20 mb-8 cursor-pointer hover:from-white/15 hover:to-white/10 transition-all duration-300 group"
          onClick={() => setLocation('/super-admin/metrics')}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-white text-xl">Resumen de Métricas</CardTitle>
                  <p className="text-white/60 text-sm mt-1">Vista general del sistema</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="w-14 h-14 mx-auto bg-blue-500/20 rounded-xl flex items-center justify-center mb-3">
                  <Building2 className="w-7 h-7 text-blue-400" />
                </div>
                <div className="text-3xl font-bold text-white mb-1">{stats?.totalCompanies || 0}</div>
                <p className="text-xs text-white/60">Empresas</p>
              </div>

              <div className="text-center">
                <div className="w-14 h-14 mx-auto bg-emerald-500/20 rounded-xl flex items-center justify-center mb-3">
                  <Users className="w-7 h-7 text-emerald-400" />
                </div>
                <div className="text-3xl font-bold text-white mb-1">{stats?.totalUsers || 0}</div>
                <p className="text-xs text-white/60">Usuarios</p>
              </div>

              <div className="text-center">
                <div className="w-14 h-14 mx-auto bg-purple-500/20 rounded-xl flex items-center justify-center mb-3">
                  <TrendingUp className="w-7 h-7 text-purple-400" />
                </div>
                <div className="text-3xl font-bold text-white mb-1">{stats?.activePaidSubscriptions || 0}</div>
                <p className="text-xs text-white/60">Suscripciones</p>
              </div>

              <div className="text-center">
                <div className="w-14 h-14 mx-auto bg-yellow-500/20 rounded-xl flex items-center justify-center mb-3">
                  <Euro className="w-7 h-7 text-yellow-400" />
                </div>
                <div className="text-3xl font-bold text-white mb-1">{stats?.monthlyRevenue?.toFixed(0) || 0}€</div>
                <p className="text-xs text-white/60">Ingresos/mes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="bg-white/10 backdrop-blur-xl border-white/20 mb-8">
          <CardHeader>
            <CardTitle className="text-white">Gestión y Configuración</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Button 
                variant="ghost" 
                className="h-auto p-4 bg-white/5 hover:bg-white/10 border border-white/20 text-white flex flex-col items-center gap-3"
                onClick={() => setLocation('/super-admin/companies')}
              >
                <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-emerald-400" />
                </div>
                <div className="text-center">
                  <p className="font-medium">Empresas</p>
                  <p className="text-xs text-white/60">Gestionar empresas</p>
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
                  <p className="font-medium">Planes</p>
                  <p className="text-xs text-white/60">Configurar suscripciones</p>
                </div>
              </Button>

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
                  <p className="text-xs text-white/60">Control de registro</p>
                </div>
              </Button>

              <Button 
                variant="ghost" 
                className="h-auto p-4 bg-white/5 hover:bg-white/10 border border-white/20 text-white flex flex-col items-center gap-3"
                onClick={() => setLocation('/super-admin/promo-codes')}
              >
                <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                  <Crown className="h-6 w-6 text-yellow-400" />
                </div>
                <div className="text-center">
                  <p className="font-medium">Promociones</p>
                  <p className="text-xs text-white/60">Códigos promocionales</p>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Plan Distribution Quick View */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-blue-500/10 backdrop-blur-xl border-blue-400/30">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white/80 mb-1">Plan Basic</p>
                  <div className="text-2xl font-bold text-white">{stats?.planDistribution?.basic || 0}</div>
                </div>
                <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-purple-500/10 backdrop-blur-xl border-purple-400/30">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white/80 mb-1">Plan Pro</p>
                  <div className="text-2xl font-bold text-white">{stats?.planDistribution?.pro || 0}</div>
                </div>
                <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/10 backdrop-blur-xl border-yellow-400/30">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white/80 mb-1">Plan Master</p>
                  <div className="text-2xl font-bold text-white">{stats?.planDistribution?.master || 0}</div>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center">
                  <Crown className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

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
      </div>
    </div>
  );
}