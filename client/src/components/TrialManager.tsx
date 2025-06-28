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

  // Fetch trial status
  const { data: trialStatus, isLoading: loadingTrial } = useQuery<TrialStatus>({
    queryKey: ['/api/account/trial-status'],
    refetchInterval: 30000, // Check every 30 seconds
  });

  // Obtener planes de suscripción disponibles
  const { data: subscriptionPlans = [] } = useQuery({
    queryKey: ['/api/subscription-plans'],
    staleTime: 300000, // 5 minutos
  });

  // Obtener métodos de pago para el modal
  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['/api/account/payment-methods'],
    staleTime: 60000,
  });

  // Función para obtener el precio de un plan
  const getPlanPrice = (planName: string) => {
    const plan = subscriptionPlans.find((p: any) => p.name.toLowerCase() === planName.toLowerCase());
    return plan ? plan.pricePerUser : 0;
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
    <div className={`rounded-lg border p-4 ${trialStatus.daysRemaining <= 3 ? "bg-amber-50/50 border-amber-200/50" : "bg-blue-50/30 border-blue-200/50"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-full ${trialStatus.daysRemaining <= 3 ? "bg-amber-100" : "bg-blue-100"}`}>
            <Clock className={`w-4 h-4 ${trialStatus.daysRemaining <= 3 ? "text-amber-600" : "text-blue-600"}`} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-900">
                Plan {trialStatus.plan.charAt(0).toUpperCase() + trialStatus.plan.slice(1)}
              </span>
              <Badge variant="outline" className="text-xs">
                {trialStatus.daysRemaining} días restantes
              </Badge>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {trialStatus.daysRemaining <= 3 ? (
                "Añade un método de pago para continuar sin interrupciones"
              ) : (
                `Expira el ${new Date(trialStatus.trialEndDate).toLocaleDateString('es-ES')} • €${getPlanPrice(trialStatus.plan)}/mes`
              )}
            </p>
          </div>
        </div>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button 
              variant="ghost"
              size="sm"
              className={`text-xs ${trialStatus.daysRemaining <= 3 ? "text-amber-700 hover:text-amber-800 hover:bg-amber-100" : "text-blue-700 hover:text-blue-800 hover:bg-blue-100"}`}
            >
              <Plus className="w-3 h-3 mr-1" />
              Añadir pago
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