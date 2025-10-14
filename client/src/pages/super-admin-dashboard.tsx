import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getAuthHeaders } from "@/lib/auth";
import { 
  Building2, 
  Users, 
  TrendingUp,
  AlertTriangle,
  BarChart3,
  Euro,
  ArrowRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SuperAdminLayout } from "@/components/layout/super-admin-layout";

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

  if (statsLoading || companiesLoading) {
    return (
      <SuperAdminLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white/70">Cargando panel de administración...</p>
          </div>
        </div>
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Metrics Viewer Card - Compact */}
          <Card 
            className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border-white/20 cursor-pointer hover:from-white/15 hover:to-white/10 transition-all duration-300 group"
            onClick={() => setLocation('/super-admin/metrics')}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-white text-base">Panel de Métricas</CardTitle>
                    <p className="text-white/60 text-xs">Click para análisis completo</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Stats Grid - 2x2 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-400/20">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-400" />
                    <div>
                      <div className="text-xl font-bold text-white">{stats?.totalCompanies || 0}</div>
                      <p className="text-[10px] text-white/60">Empresas</p>
                    </div>
                  </div>
                </div>

                <div className="bg-emerald-500/10 rounded-lg p-3 border border-emerald-400/20">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-emerald-400" />
                    <div>
                      <div className="text-xl font-bold text-white">{stats?.totalUsers || 0}</div>
                      <p className="text-[10px] text-white/60">Usuarios</p>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-500/10 rounded-lg p-3 border border-purple-400/20">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-purple-400" />
                    <div>
                      <div className="text-xl font-bold text-white">{stats?.activePaidSubscriptions || 0}</div>
                      <p className="text-[10px] text-white/60">Activas</p>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-500/10 rounded-lg p-3 border border-yellow-400/20">
                  <div className="flex items-center gap-2">
                    <Euro className="w-5 h-5 text-yellow-400" />
                    <div>
                      <div className="text-xl font-bold text-white">{stats?.monthlyRevenue?.toFixed(2) || '0.00'}€</div>
                      <p className="text-[10px] text-white/60">MRR</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Plan Distribution - Compact */}
              <div className="border-t border-white/10 pt-3">
                <p className="text-xs text-white/60 mb-2">Distribución por Plan</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-blue-500/5 rounded-lg p-2 border border-blue-400/10 text-center">
                    <div className="w-8 h-8 bg-blue-500 rounded-md mx-auto mb-1 flex items-center justify-center">
                      <span className="text-white font-bold text-xs">{stats?.planDistribution?.basic || 0}</span>
                    </div>
                    <p className="text-[10px] text-white/70 font-medium">Basic</p>
                  </div>

                  <div className="bg-purple-500/5 rounded-lg p-2 border border-purple-400/10 text-center">
                    <div className="w-8 h-8 bg-purple-500 rounded-md mx-auto mb-1 flex items-center justify-center">
                      <span className="text-white font-bold text-xs">{stats?.planDistribution?.pro || 0}</span>
                    </div>
                    <p className="text-[10px] text-white/70 font-medium">Pro</p>
                  </div>

                  <div className="bg-gradient-to-br from-yellow-500/5 to-yellow-600/5 rounded-lg p-2 border border-yellow-400/10 text-center">
                    <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-md mx-auto mb-1 flex items-center justify-center">
                      <span className="text-white font-bold text-xs">{stats?.planDistribution?.master || 0}</span>
                    </div>
                    <p className="text-[10px] text-white/70 font-medium">Master</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Placeholder for future panel */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg border-dashed flex items-center justify-center min-h-[300px]">
            <p className="text-white/40 text-sm">Espacio disponible para otro panel</p>
          </div>
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
    </SuperAdminLayout>
  );
}