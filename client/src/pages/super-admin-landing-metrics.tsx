import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SuperAdminLayout } from '@/components/layout/super-admin-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Users, Globe, TrendingUp, MousePointerClick, RefreshCw } from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

export default function SuperAdminLandingMetrics() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: metrics } = useQuery({
    queryKey: ['/api/super-admin/landing-metrics'],
    queryFn: async () => {
      const token = sessionStorage.getItem('superAdminToken');
      const response = await fetch('/api/super-admin/landing-metrics', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      if (!response.ok) throw new Error('Failed to fetch metrics');
      return response.json();
    },
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true, // Refetch when component mounts
    refetchInterval: 30000, // Refetch every 30 seconds
    gcTime: 0, // Don't cache (garbage collection time)
  });

  const updateGeolocation = useMutation({
    mutationFn: async () => {
      const token = sessionStorage.getItem('superAdminToken');
      const response = await fetch('/api/super-admin/update-geolocation', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to update geolocation');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Geolocalización actualizada",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/landing-metrics'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar la geolocalización",
        variant: "destructive",
      });
    },
  });

  const conversionRate = metrics?.totalVisits > 0 
    ? ((metrics.totalRegistrations / metrics.totalVisits) * 100).toFixed(2)
    : '0.00';

  return (
    <SuperAdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-white">Métricas de Landing Page</h1>
          <p className="text-white/70 mt-1">Análisis de visitas y conversiones</p>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-white/10 backdrop-blur-xl border-white/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white/80">
                Visitas Totales
              </CardTitle>
              <Users className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{metrics?.totalVisits || 0}</div>
              <p className="text-xs text-white/60 mt-1">Últimos 30 días</p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-xl border-white/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white/80">
                Registros
              </CardTitle>
              <MousePointerClick className="h-4 w-4 text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{metrics?.totalRegistrations || 0}</div>
              <p className="text-xs text-white/60 mt-1">Conversiones completadas</p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-xl border-white/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white/80">
                Tasa de Conversión
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{conversionRate}%</div>
              <p className="text-xs text-white/60 mt-1">Visitas a registros</p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-xl border-white/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white/80">
                Hoy
              </CardTitle>
              <BarChart className="h-4 w-4 text-yellow-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{metrics?.todayVisits || 0}</div>
              <p className="text-xs text-white/60 mt-1">Visitas de hoy</p>
            </CardContent>
          </Card>
        </div>

        {/* Daily Visits Chart */}
        <Card className="bg-white/10 backdrop-blur-xl border-white/20">
          <CardHeader>
            <CardTitle className="text-white">Visitas Diarias (Últimos 7 Días)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics?.dailyVisits?.map((day: any) => (
                <div key={day.date} className="flex items-center gap-4">
                  <div className="w-24 text-sm text-white/70">
                    {format(new Date(day.date), 'dd MMM', { locale: es })}
                  </div>
                  <div className="flex-1">
                    <div className="h-8 bg-white/5 rounded-lg overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg transition-all duration-500"
                        style={{ width: `${Math.min((day.count / (metrics.maxDailyVisits || 1)) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-16 text-right text-sm font-semibold text-white">
                    {day.count}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Geographic Distribution */}
        <Card className="bg-white/10 backdrop-blur-xl border-white/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Distribución Geográfica
              </CardTitle>
              <Button
                onClick={() => updateGeolocation.mutate()}
                disabled={updateGeolocation.isPending}
                variant="outline"
                size="sm"
                className="bg-blue-500/20 hover:bg-blue-500/30 border-blue-400/30 text-white"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${updateGeolocation.isPending ? 'animate-spin' : ''}`} />
                {updateGeolocation.isPending ? 'Actualizando...' : 'Actualizar Geolocalización'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!metrics?.countries || metrics.countries.length === 0 ? (
              <div className="text-center py-8 text-white/60">
                No hay datos geográficos disponibles
              </div>
            ) : (
              <div className="space-y-3">
                {metrics.countries.map((country: any) => (
                  <div key={country.country || 'unknown'} className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{country.flag || '🌍'}</div>
                      <div>
                        <p className="font-medium text-white">{country.country || 'Desconocido'}</p>
                        <p className="text-sm text-white/60">{country.visits} visitas</p>
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-white/70">
                      {((country.visits / metrics.totalVisits) * 100).toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}
