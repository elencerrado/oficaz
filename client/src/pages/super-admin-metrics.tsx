import { useQuery } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";
import { 
  Building2, 
  Users, 
  TrendingUp, 
  Euro,
  Calendar,
  CreditCard,
  BarChart3
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SuperAdminLayout } from "@/components/layout/super-admin-layout";

interface SuperAdminStats {
  totalCompanies: number;
  totalUsers: number;
  activeSubscriptions: number;
  activePaidSubscriptions: number;
  revenue: number;
  monthlyRevenue: number;
  yearlyRevenue: number;
  totalAccumulatedRevenue: number;
  currentMonthRevenue: number;
  planDistribution: {
    basic: number;
    pro: number;
    master: number;
  };
}

export default function SuperAdminMetrics() {
  const { data: stats } = useQuery<SuperAdminStats>({
    queryKey: ['/api/super-admin/stats'],
    queryFn: async () => {
      const response = await fetch('/api/super-admin/stats', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true, // Refetch when component mounts
  });

  return (
    <SuperAdminLayout>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
          <Card className="!bg-white/10 backdrop-blur-xl !border-white/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white/80">
                Empresas Totales
              </CardTitle>
              <Building2 className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{stats?.totalCompanies || 0}</div>
              <p className="text-xs text-white/60 mt-1">Empresas registradas</p>
            </CardContent>
          </Card>

          <Card className="!bg-white/10 backdrop-blur-xl !border-white/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white/80">
                Usuarios Totales
              </CardTitle>
              <Users className="h-4 w-4 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{stats?.totalUsers || 0}</div>
              <p className="text-xs text-white/60 mt-1">Usuarios activos</p>
            </CardContent>
          </Card>

          <Card className="!bg-white/10 backdrop-blur-xl !border-white/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white/80">
                Suscripciones Activas
              </CardTitle>
              <CreditCard className="h-4 w-4 text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{stats?.activeSubscriptions || 0}</div>
              <p className="text-xs text-white/60 mt-1">Total de suscripciones</p>
            </CardContent>
          </Card>

          <Card className="!bg-white/10 backdrop-blur-xl !border-white/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white/80">
                Suscripciones de Pago
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-yellow-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{stats?.activePaidSubscriptions || 0}</div>
              <p className="text-xs text-white/60 mt-1">Con Stripe activo</p>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
          <Card className="!bg-gradient-to-br !from-blue-500/20 !to-blue-600/20 backdrop-blur-xl !border-blue-400/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-white/90">
                Ingresos Totales
              </CardTitle>
              <Euro className="h-4 w-4 md:h-5 md:w-5 text-blue-300" />
            </CardHeader>
            <CardContent className="pb-4 md:pb-6">
              <div className="text-2xl md:text-4xl font-bold text-white">{stats?.totalAccumulatedRevenue?.toFixed(2) || '0.00'}€</div>
              <p className="text-xs text-white/70 mt-1 md:mt-2">Ingresos acumulados reales</p>
            </CardContent>
          </Card>

          <Card className="!bg-gradient-to-br !from-emerald-500/20 !to-emerald-600/20 backdrop-blur-xl !border-emerald-400/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-white/90">
                Ingresos Mes Actual
              </CardTitle>
              <Calendar className="h-4 w-4 md:h-5 md:w-5 text-emerald-300" />
            </CardHeader>
            <CardContent className="pb-4 md:pb-6">
              <div className="text-2xl md:text-4xl font-bold text-white">{stats?.currentMonthRevenue?.toFixed(2) || '0.00'}€</div>
              <p className="text-xs text-white/70 mt-1 md:mt-2">Ingresos reales del mes</p>
            </CardContent>
          </Card>

          <Card className="!bg-gradient-to-br !from-purple-500/20 !to-purple-600/20 backdrop-blur-xl !border-purple-400/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-white/90">
                Ingresos Anuales
              </CardTitle>
              <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-purple-300" />
            </CardHeader>
            <CardContent className="pb-4 md:pb-6">
              <div className="text-2xl md:text-4xl font-bold text-white">{stats?.yearlyRevenue?.toFixed(2) || '0.00'}€</div>
              <p className="text-xs text-white/70 mt-1 md:mt-2">Estimado anual</p>
            </CardContent>
          </Card>
        </div>

        {/* Plan Distribution */}
        <Card className="!bg-white/10 backdrop-blur-xl !border-white/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-white">Distribución de Planes</CardTitle>
                <p className="text-sm text-white/60 mt-1">Análisis por tipo de suscripción</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              <div className="bg-blue-500/20 rounded-xl p-4 md:p-6 border border-blue-400/30">
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <h3 className="text-white text-sm md:text-base font-semibold">Plan Basic</h3>
                  <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                    <Building2 className="w-4 h-4 md:w-5 md:h-5 text-white" />
                  </div>
                </div>
                <div className="text-2xl md:text-4xl font-bold text-white mb-1 md:mb-2">{stats?.planDistribution?.basic || 0}</div>
                <p className="text-xs md:text-sm text-blue-200">Empresas con plan básico</p>
              </div>

              <div className="bg-purple-500/20 rounded-xl p-4 md:p-6 border border-purple-400/30">
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <h3 className="text-white text-sm md:text-base font-semibold">Plan Pro</h3>
                  <div className="w-8 h-8 md:w-10 md:h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-white" />
                  </div>
                </div>
                <div className="text-2xl md:text-4xl font-bold text-white mb-1 md:mb-2">{stats?.planDistribution?.pro || 0}</div>
                <p className="text-xs md:text-sm text-purple-200">Empresas con plan profesional</p>
              </div>

              <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 rounded-xl p-4 md:p-6 border border-yellow-400/30">
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <h3 className="text-white text-sm md:text-base font-semibold">Plan Master</h3>
                  <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center">
                    <CreditCard className="w-4 h-4 md:w-5 md:h-5 text-white" />
                  </div>
                </div>
                <div className="text-2xl md:text-4xl font-bold text-white mb-1 md:mb-2">{stats?.planDistribution?.master || 0}</div>
                <p className="text-xs md:text-sm text-yellow-200">Empresas con plan master</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}
