import { useQuery, useMutation } from '@tanstack/react-query';
import { SuperAdminLayout } from '@/components/layout/super-admin-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Users, Globe, TrendingUp, MousePointerClick, Trash2 } from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

export default function SuperAdminLandingMetrics() {
  const { toast } = useToast();

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

  // Generate complete last 7 days array
  const last7Days = Array.from({ length: 7 }).map((_, index) => {
    const date = startOfDay(subDays(new Date(), 6 - index)); // Start from 6 days ago to today
    return format(date, 'yyyy-MM-dd');
  });

  // Map backend data to complete 7 days
  const completeDailyVisits = last7Days.map(dateStr => {
    const backendData = metrics?.dailyVisits?.find((d: any) => {
      const backendDate = format(new Date(d.date), 'yyyy-MM-dd');
      return backendDate === dateStr;
    });
    return {
      date: dateStr,
      count: backendData?.count || 0
    };
  });

  const maxDailyVisits = Math.max(...completeDailyVisits.map(d => d.count), 1);

  const conversionRate = metrics?.totalVisits > 0 
    ? ((metrics.totalRegistrations / metrics.totalVisits) * 100).toFixed(2)
    : '0.00';

  // Mutation to clean test visits
  const cleanTestVisitsMutation = useMutation({
    mutationFn: async () => {
      const token = sessionStorage.getItem('superAdminToken');
      const response = await fetch('/api/super-admin/landing-metrics/clean-test-visits', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error('Failed to clean test visits');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: '✅ Visitas de testing eliminadas',
        description: data.message,
      });
      // Refresh metrics
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/landing-metrics'] });
    },
    onError: (error: any) => {
      toast({
        title: '❌ Error',
        description: error.message || 'No se pudieron eliminar las visitas de testing',
        variant: 'destructive',
      });
    },
  });

  return (
    <SuperAdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Métricas de Landing Page</h1>
            <p className="text-white/70 mt-1">Análisis de visitas y conversiones (solo visitas reales)</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => cleanTestVisitsMutation.mutate()}
            disabled={cleanTestVisitsMutation.isPending}
            className="bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20 hover:text-red-300"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {cleanTestVisitsMutation.isPending ? 'Limpiando...' : 'Limpiar Testing'}
          </Button>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
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
            <div className="grid grid-cols-7 gap-4 h-64">
              {completeDailyVisits.map((day, index) => {
                const count = day.count;
                const heightPercentage = count > 0 && maxDailyVisits 
                  ? (count / maxDailyVisits) * 100 
                  : 0;
                
                return (
                  <div key={day.date} className="flex flex-col items-center gap-2">
                    {/* Number at top */}
                    <div className="text-sm font-semibold text-white mb-1 h-5">
                      {count}
                    </div>
                    
                    {/* Vertical bar */}
                    <div className="w-full flex-1 flex items-end">
                      {count > 0 && (
                        <div 
                          className="w-full bg-gradient-to-t from-blue-500 to-purple-500 rounded-t-lg transition-all duration-500"
                          style={{ height: `${heightPercentage}%` }}
                        />
                      )}
                    </div>
                    
                    {/* Date at bottom */}
                    <div className="text-xs text-white/70 text-center whitespace-nowrap h-5">
                      {format(new Date(day.date), 'dd MMM', { locale: es })}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Geographic Distribution */}
        <Card className="bg-white/10 backdrop-blur-xl border-white/20">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Distribución Geográfica
            </CardTitle>
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
