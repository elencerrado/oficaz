import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertCircle, CreditCard, Clock, Calendar, CheckCircle, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PaymentMethodManager } from '@/components/PaymentMethodManager';
import { useAuth } from '@/hooks/use-auth';

interface TrialStatus {
  isTrialActive: boolean;
  daysRemaining: number;
  trialEndDate: string;
  status: string;
  plan: string;
  hasPaymentMethod: boolean;
  isBlocked: boolean;
}

interface PaymentIntent {
  clientSecret: string;
  amount: number;
  currency: string;
  plan: string;
  employeeCount: number;
  pricePerUser: number;
}

export function TrialManager() {
  const [selectedPlan, setSelectedPlan] = useState('basic');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { subscription } = useAuth();

  // Fetch trial status
  const { data: trialStatus, isLoading: loadingTrial } = useQuery<TrialStatus>({
    queryKey: ['/api/account/trial-status'],
    refetchInterval: 30000, // Check every 30 seconds
  });

  // Obtener planes de suscripción disponibles
  const { data: subscriptionPlans = [] } = useQuery({
    queryKey: ['/api/public/subscription-plans'],
    staleTime: 300000, // 5 minutos
  });

  // Obtener métodos de pago para el modal
  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['/api/account/payment-methods'],
    staleTime: 60000,
  });

  // Función para obtener el precio de un plan
  const getPlanPrice = (planName: string) => {
    // Use custom monthly price if available (regardless of useCustomSettings)
    if (subscription?.customMonthlyPrice) {
      const customPrice = Number(subscription.customMonthlyPrice);
      if (customPrice > 0) {
        return customPrice.toFixed(2);
      }
    }
    
    const plan = subscriptionPlans.find((p: any) => p.name.toLowerCase() === planName.toLowerCase());
    if (plan && plan.monthlyPrice) {
      return Number(plan.monthlyPrice).toFixed(2);
    }
    // Fallback prices for known plans
    const fallbackPrices: { [key: string]: string } = {
      'basic': '19.99',
      'pro': '39.99',
      'master': '79.99'
    };
    return fallbackPrices[planName.toLowerCase()] || '0.00';
  };

  // Estado para procesar pago
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Mutación para crear intención de pago
  const createPaymentMutation = useMutation({
    mutationFn: async ({ plan }: { plan: string }) => {
      const response = await fetch('/api/account/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
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

  // Función para manejar la actualización del plan
  const handleUpgrade = () => {
    setIsProcessingPayment(true);
    createPaymentMutation.mutate({ plan: selectedPlan });
  };



  if (loadingTrial) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
          <span className="ml-2">Cargando estado de prueba...</span>
        </CardContent>
      </Card>
    );
  }

  if (!trialStatus) return null;

  // If account is active (paid), don't show anything - subscription is working
  if (trialStatus.status === 'active' && !trialStatus.isTrialActive) {
    return null;
  }

  // If in trial and has payment method, don't show in dashboard
  if (trialStatus.isTrialActive && trialStatus.hasPaymentMethod) {
    return null;
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Seleccionar Plan:</label>
              <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic - €3/empleado/mes</SelectItem>
                  <SelectItem value="pro">Pro - €5/empleado/mes</SelectItem>
                  <SelectItem value="master">Master - €8/empleado/mes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 flex items-end">
              <Button 
                onClick={handleUpgrade}
                disabled={isProcessingPayment || createPaymentMutation.isPending}
                className="w-full bg-red-600 hover:bg-red-700"
              >
                {isProcessingPayment ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
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
                <span className="hidden sm:inline">Período de Prueba {trialStatus.plan.charAt(0).toUpperCase() + trialStatus.plan.slice(1)}</span>
                <span className="sm:hidden">Prueba {trialStatus.plan.charAt(0).toUpperCase() + trialStatus.plan.slice(1)}</span>
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
                  <span className="hidden sm:inline">Hasta el {new Date(trialStatus.trialEndDate).toLocaleDateString('es-ES')} • €{getPlanPrice(trialStatus.plan)}/mes después</span>
                  <span className="sm:hidden">€{getPlanPrice(trialStatus.plan)}/mes después</span>
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
            <PaymentMethodManager paymentMethods={paymentMethods} />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}