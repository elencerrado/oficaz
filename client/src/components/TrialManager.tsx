import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertCircle, CreditCard, Clock, Plus, TrendingUp } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { getAuthHeaders } from '@/lib/auth';
import { PaymentMethodManager } from '@/components/PaymentMethodManager';
import { useAuth } from '@/hooks/use-auth';
import type { Addon, CompanyAddon } from '@shared/schema';

interface TrialStatus {
  isTrialActive: boolean;
  daysRemaining: number;
  trialEndDate: string;
  status: string;
  plan: string;
  hasPaymentMethod: boolean;
  isBlocked: boolean;
  demoMode?: boolean;
  subscriptionInFlight?: boolean; // True if subscription is being created
}

interface PaymentIntent {
  clientSecret: string;
  amount: number;
  currency: string;
  plan: string;
  employeeCount: number;
  pricePerUser: number;
}

interface PaymentMethod {
  id: string;
  card_brand: string;
  card_last_four: string;
  card_exp_month: number;
  card_exp_year: number;
  is_default: boolean;
}

export function TrialManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { subscription } = useAuth();

  // Fetch trial status - trial doesn't change often, long cache is fine
  const { data: trialStatus, isLoading: loadingTrial, isFetching } = useQuery<TrialStatus>({
    queryKey: ['/api/account/trial-status'],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes - trial status rarely changes
    refetchOnMount: 'always', // Always check on mount to ensure fresh data after login
  });

  // Obtener métodos de pago para el modal
  const { data: paymentMethods = [] } = useQuery<PaymentMethod[]>({
    queryKey: ['/api/account/payment-methods'],
    staleTime: 60000,
  });

  // Obtener addons activos para calcular precio proyectado
  const { data: companyAddons = [] } = useQuery<(CompanyAddon & { addon: Addon })[]>({
    queryKey: ['/api/company/addons'],
    staleTime: 30000,
  });

  // Obtener info de suscripción (incluye conteos reales por rol)
  const { data: subscriptionInfo } = useQuery({
    queryKey: ['/api/subscription/info'],
    enabled: !!subscription,
    staleTime: 30000,
    queryFn: async () => {
      const res = await fetch('/api/subscription/info', {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('No se pudo obtener la info de suscripción');
      return res.json();
    }
  });

  // Build seat pricing map from subscription info (already includes seat prices)
  const seatPriceMap = {
    admin: ((subscriptionInfo as any)?.seatPricing?.find((s: any) => s.roleType === 'admin')?.monthlyPrice) || 6,
    manager: ((subscriptionInfo as any)?.seatPricing?.find((s: any) => s.roleType === 'manager')?.monthlyPrice) || 4,
    employee: ((subscriptionInfo as any)?.seatPricing?.find((s: any) => s.roleType === 'employee')?.monthlyPrice) || 2,
  };

  // Calcular precio proyectado total usando datos reales (addons + asientos)
  // Debe coincidir exactamente con el cálculo del backend (línea 12801-12810 en routes.ts)
  const projectedPrice = useMemo(() => {
    // Use pre-calculated monthly price from backend for consistency
    // Backend calculates: addons + (adminSeats * 6) + (managerSeats * 4) + (employeeSeats * 2)
    return Number(subscription?.monthlyPrice ?? 0);
  }, [subscription?.monthlyPrice]);

  // Función para obtener el precio del plan Oficaz
  const getPlanPrice = (_planName: string) => projectedPrice.toFixed(2);

  // Estado para procesar pago
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Mutación para crear intención de pago
  const createPaymentMutation = useMutation({
    mutationFn: async ({ plan }: { plan: string }) => {
      const response = await fetch('/api/account/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ plan })
      });
      
      if (!response.ok) {
        throw new Error('Error al crear intención de pago');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setIsProcessingPayment(false);
      toast({
        title: "Pago procesado",
        description: "Tu suscripción ha sido activada correctamente.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/account/trial-status'] });
    },
    onError: (error: any) => {
      setIsProcessingPayment(false);
      toast({
        title: "Error en el pago",
        description: error.message || "No se pudo procesar el pago",
        variant: "destructive",
      });
    }
  });

  // Función para manejar la activación del plan Oficaz
  const handleUpgrade = () => {
    setIsProcessingPayment(true);
    createPaymentMutation.mutate({ plan: 'oficaz' });
  };

  // Show loading skeleton during initial load or when fetching without data
  if ((loadingTrial || isFetching) && !trialStatus) {
    return (
      <div className="rounded-lg border p-3 sm:p-4 mb-4 sm:mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800/50 animate-pulse">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2 sm:space-x-3 flex-1">
            <div className="p-1.5 sm:p-2 rounded-full bg-blue-100 dark:bg-blue-900/50">
              <div className="w-3 h-3 sm:w-4 sm:h-4 bg-blue-300 dark:bg-blue-700 rounded"></div>
            </div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-blue-200 dark:bg-blue-800/50 rounded w-1/3"></div>
              <div className="h-3 bg-blue-200 dark:bg-blue-800/50 rounded w-1/2"></div>
            </div>
          </div>
          <div className="h-8 w-32 bg-blue-200 dark:bg-blue-800/50 rounded"></div>
        </div>
      </div>
    );
  }

  // Only render if we have trial status data (avoid hydration mismatch)
  if (!trialStatus) return null;

  // Demo companies should behave as subscribed and never show trial UX.
  if (trialStatus.demoMode) {
    return null;
  }

  // If account is active (paid), don't show anything - subscription is working
  if (trialStatus.status === 'active' && !trialStatus.isTrialActive) {
    return null;
  }

  // If in trial and has payment method, don't show in dashboard
  if (trialStatus.isTrialActive && trialStatus.hasPaymentMethod) {
    return null;
  }

  // If subscription is being created, show processing message
  if (trialStatus.subscriptionInFlight) {
    return (
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center text-blue-800">
            <Clock className="w-5 h-5 mr-2 animate-spin" />
            Procesando Suscripción
          </CardTitle>
          <CardDescription className="text-blue-600">
            Tu suscripción se está siendo activada. Por favor, espera un momento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-3">
            <LoadingSpinner size="md" />
            <p className="text-sm text-blue-700">Activando tu cuenta...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If account is blocked, show urgent payment required
  if (trialStatus.isBlocked) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="flex items-center text-red-800">
            <AlertCircle className="w-5 h-5 mr-2" />
            Cuenta Bloqueada - Pago Requerido
          </CardTitle>
          <CardDescription className="text-red-600">
            Tu período de prueba ha expirado. Realiza el pago para continuar usando Oficaz.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-white rounded-lg border border-red-100">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-semibold text-lg">Plan Oficaz</h4>
                <p className="text-sm text-muted-foreground">Todo lo que necesitas para gestionar tu empresa</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold">€{getPlanPrice('oficaz')}</span>
                <span className="text-muted-foreground">/mes</span>
              </div>
            </div>
            <Button 
              onClick={handleUpgrade}
              disabled={isProcessingPayment || createPaymentMutation.isPending}
              className="w-full bg-red-600 hover:bg-red-700"
            >
              {isProcessingPayment ? (
                <>
                  <LoadingSpinner size="xs" className="mr-2" />
                  Procesando pago...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Pagar y Activar Cuenta
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If trial is active, show discrete notification about adding payment method
  return (
    <div className={`rounded-lg border p-3 sm:p-4 mb-4 sm:mb-6 transition-colors ${
      trialStatus.daysRemaining <= 3 
        ? "bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800/50" 
        : "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800/50"
    }`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
          <div className={`p-1.5 sm:p-2 rounded-full flex-shrink-0 transition-colors ${
            trialStatus.daysRemaining <= 3 
              ? "bg-amber-100 dark:bg-amber-900/50" 
              : "bg-blue-100 dark:bg-blue-900/50"
          }`}>
            <Clock className={`w-3 h-3 sm:w-4 sm:h-4 ${
              trialStatus.daysRemaining <= 3 
                ? "text-amber-600 dark:text-amber-400" 
                : "text-blue-600 dark:text-blue-400"
            }`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-1 sm:space-x-2 flex-wrap">
              <span className="text-xs sm:text-sm font-medium text-foreground">
                <span className="hidden sm:inline">Período de Prueba Oficaz</span>
                <span className="sm:hidden">Prueba Oficaz</span>
              </span>
              <Badge variant="outline" className={`text-xs border-current ${
                trialStatus.daysRemaining <= 3
                  ? "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30"
                  : "text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/30"
              }`}>
                <span className="hidden sm:inline">{trialStatus.daysRemaining} días restantes</span>
                <span className="sm:hidden">{trialStatus.daysRemaining}d</span>
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 sm:mt-1 truncate">
              {trialStatus.daysRemaining <= 3 ? (
                <>
                  <span className="hidden sm:inline">Período de prueba termina pronto. Añade un método de pago para continuar</span>
                  <span className="sm:hidden">Añade método de pago pronto</span>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">
                    Hasta el {new Date(trialStatus.trialEndDate).toLocaleDateString('es-ES')} • 
                    <span className="font-medium text-foreground ml-1">€{projectedPrice.toFixed(2)}/mes</span>
                  </span>
                  <span className="sm:hidden font-medium text-foreground">€{projectedPrice.toFixed(2)}/mes</span>
                </>
              )}
            </p>
          </div>
        </div>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button 
              variant="outline"
              size="sm"
              className={`text-xs flex-shrink-0 p-2 transition-colors ${
                trialStatus.daysRemaining <= 3 
                  ? "text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/30 border-amber-300 dark:border-amber-700" 
                  : "text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/30 border-blue-300 dark:border-blue-700"
              }`}
            >
              <Plus className="w-3 h-3 mr-1" />
              <span className="inline sm:inline">Añadir tarjeta</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Gestionar métodos de pago</DialogTitle>
              <DialogDescription>
                Añade un método de pago para continuar usando Oficaz cuando termine tu período de prueba.
              </DialogDescription>
            </DialogHeader>
            <PaymentMethodManager 
              paymentMethods={paymentMethods} 
              selectedPlan="oficaz"
              selectedPlanPrice={projectedPrice}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}