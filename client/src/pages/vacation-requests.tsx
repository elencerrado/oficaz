import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ArrowLeft, CalendarPlus, Calendar, Check, X, Clock, CalendarDays } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation, Link } from 'wouter';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function VacationRequests() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const { user, company } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const companyAlias = location.split('/')[1] || 'test';

  const { data: requests = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/vacation-requests'],
  });

  const createRequestMutation = useMutation({
    mutationFn: (data: { startDate: string; endDate: string; reason?: string }) =>
      apiRequest('POST', '/api/vacation-requests', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vacation-requests'] });
      setIsModalOpen(false);
      setStartDate('');
      setEndDate('');
      setReason('');
      toast({
        title: '¡Solicitud enviada!',
        description: 'Tu solicitud de vacaciones ha sido enviada correctamente.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo enviar la solicitud',
        variant: 'destructive',
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'approved':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'denied':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pendiente';
      case 'approved':
        return 'Aprobado';
      case 'denied':
        return 'Rechazado';
      default:
        return status;
    }
  };

  const calculateDays = (startDate: string, endDate: string) => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    return differenceInDays(end, start) + 1;
  };

  const formatDate = (dateString: string) => {
    return format(parseISO(dateString), 'd MMM', { locale: es });
  };

  const formatDateRange = (start: string, end: string) => {
    const startFormatted = format(parseISO(start), 'd MMM', { locale: es });
    const endFormatted = format(parseISO(end), 'd MMM yyyy', { locale: es });
    return `${startFormatted} - ${endFormatted}`;
  };

  // Calculate vacation days
  const totalDays = parseFloat(user?.totalVacationDays || '22');
  const usedDays = parseFloat(user?.usedVacationDays || '0');
  const pendingDays = (requests as any[])
    .filter((r: any) => r.status === 'pending')
    .reduce((sum: number, r: any) => sum + calculateDays(r.startDate, r.endDate), 0);
  const availableDays = totalDays - usedDays - pendingDays;
  const usagePercentage = totalDays > 0 ? (usedDays / totalDays) * 100 : 0;

  const canRequestDays = startDate && endDate ? calculateDays(startDate, endDate) : 0;
  const exceedsAvailable = canRequestDays > availableDays;

  const handleSubmit = () => {
    if (!startDate || !endDate) {
      toast({
        title: 'Error',
        description: 'Por favor selecciona las fechas de inicio y fin',
        variant: 'destructive',
      });
      return;
    }

    if (exceedsAvailable) {
      toast({
        title: 'Error',
        description: `No tienes suficientes días disponibles. Disponibles: ${availableDays}`,
        variant: 'destructive',
      });
      return;
    }

    createRequestMutation.mutate({
      startDate,
      endDate,
      reason: reason || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{
        background: 'radial-gradient(circle at center, #323A46 0%, #232B36 100%)'
      }}>
        <div className="text-center text-white">
          <LoadingSpinner size="lg" className="mx-auto mb-3 text-white" />
          <p>Cargando vacaciones...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen text-white"
      style={{
        background: 'radial-gradient(circle at center, #323A46 0%, #232B36 100%)',
        overscrollBehavior: 'none'
      }}
    >
      {/* Header - Fixed height */}
      <div className="flex items-center justify-between p-6 pb-8 h-20">
        <Link href={`/${companyAlias}/dashboard`}>
          <Button
            variant="ghost"
            size="lg"
            className="text-white hover:bg-white/20 px-6 py-3 rounded-xl bg-white/10 backdrop-blur-sm transition-all duration-200 transform hover:scale-105"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            <span className="font-medium">Atrás</span>
          </Button>
        </Link>
        
        <div className="flex-1 flex flex-col items-end text-right">
          {company?.logoUrl ? (
            <img 
              src={company.logoUrl} 
              alt={company.name} 
              className="w-8 h-8 mb-1 rounded-full object-cover"
            />
          ) : (
            <div className="text-white text-sm font-medium mb-1">
              {company?.name || 'Mi Empresa'}
            </div>
          )}
          <div className="text-base font-medium text-white">{user?.fullName}</div>
        </div>
      </div>

      {/* Modern Title - Fixed height */}
      <div className="text-center mb-8 h-12 flex items-center justify-center">
        <h1 className="text-2xl font-light text-white/90 tracking-wide">Vacaciones</h1>
      </div>

      {/* Vacation Summary */}
      <div className="px-6 mb-6">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-300">{totalDays}</div>
              <div className="text-xs text-white/70">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-300">{usedDays}</div>
              <div className="text-xs text-white/70">Usados</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-300">{availableDays}</div>
              <div className="text-xs text-white/70">Disponibles</div>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-white/70">Progreso anual</span>
              <span className="text-sm text-white/70">{usagePercentage.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(usagePercentage, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Request button */}
      <div className="px-6 mb-6">
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl font-semibold">
              <CalendarPlus className="mr-2 h-5 w-5" />
              Solicitar Vacaciones
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-gray-800 border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-white">Nueva Solicitud de Vacaciones</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start-date" className="text-white">Fecha inicio</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="end-date" className="text-white">Fecha fin</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
              </div>
              
              {canRequestDays > 0 && (
                <div className={`text-sm p-2 rounded ${exceedsAvailable ? 'bg-red-500/20 text-red-300' : 'bg-blue-500/20 text-blue-300'}`}>
                  Días solicitados: {canRequestDays} | Disponibles: {availableDays}
                </div>
              )}
              
              <div>
                <Label htmlFor="reason" className="text-white">Motivo (opcional)</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Describe el motivo de tu solicitud..."
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={() => setIsModalOpen(false)}
                  variant="outline"
                  className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={createRequestMutation.isPending || !startDate || !endDate || exceedsAvailable}
                  className="flex-1 bg-blue-500 hover:bg-blue-600"
                >
                  {createRequestMutation.isPending ? (
                    <LoadingSpinner size="sm" className="text-white" />
                  ) : (
                    'Solicitar'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Requests table */}
      <div className="px-4 mb-6 flex-1">
        <div className="bg-white/5 rounded-lg overflow-hidden" style={{ backgroundColor: 'rgba(50, 58, 70, 0.8)' }}>
          {/* Table Header */}
          <div className="grid grid-cols-4 bg-white/10 py-3 px-4">
            <div className="text-sm font-semibold text-center">Período</div>
            <div className="text-sm font-semibold text-center">Días</div>
            <div className="text-sm font-semibold text-center">Estado</div>
            <div className="text-sm font-semibold text-center">Fecha</div>
          </div>

          {/* Table Body */}
          <div className="overflow-y-auto scrollbar-thin" style={{ 
            maxHeight: 'calc(100vh - 400px)', 
            minHeight: '300px',
            backgroundColor: 'rgba(50, 58, 70, 0.6)',
            overscrollBehavior: 'contain'
          }}>
            {(requests as any[]).length > 0 ? (
              (requests as any[])
                .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((request: any) => (
                  <div key={request.id} className="grid grid-cols-4 py-3 px-4 border-b border-white/10 hover:bg-white/5">
                    <div className="text-sm text-center text-white/90">
                      {formatDateRange(request.startDate, request.endDate)}
                    </div>
                    <div className="text-sm text-center font-mono text-white/90">
                      {calculateDays(request.startDate, request.endDate)}
                    </div>
                    <div className="flex justify-center">
                      <Badge className={`text-xs px-2 py-1 ${getStatusColor(request.status)}`}>
                        {getStatusText(request.status)}
                      </Badge>
                    </div>
                    <div className="text-sm text-center text-white/70">
                      {formatDate(request.createdAt)}
                    </div>
                  </div>
                ))
            ) : (
              <div className="flex items-center justify-center h-full min-h-48">
                <div className="text-center text-white/60">
                  <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No tienes solicitudes de vacaciones</p>
                  <p className="text-sm mt-1">Solicita tus primeras vacaciones</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Copyright at bottom */}
      <div className="text-center pb-4 mt-auto">
        <div className="flex items-center justify-center space-x-1 text-gray-400 text-xs">
          <span className="font-semibold text-blue-400">Oficaz</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </div>
    </div>
  );
}
