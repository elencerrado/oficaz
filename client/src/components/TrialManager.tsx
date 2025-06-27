import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CreditCard, Clock, Calendar, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
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

  // Función para obtener el precio de un plan
  const getPlanPrice = (planName: string) => {
    const plan = subscriptionPlans.find((p: any) => p.name.toLowerCase() === planName.toLowerCase());
    return plan ? plan.pricePerUser : 0;
  };

  // Create payment intent mutation
  const createPaymentMutation = useMutation({
    mutationFn: async (plan: string) => {
      return apiRequest('POST', '/api/account/create-payment-intent', { plan });
    },
    onSuccess: (data: PaymentIntent) => {
      toast({
        title: "Preparando pago",
        description: `Total: €${data.amount.toFixed(2)} para ${data.employeeCount} empleado(s)`,
      });
      
      // Simulate payment process (in real app, would integrate with Stripe)
      setIsProcessingPayment(true);
      setTimeout(() => {
        confirmPaymentMutation.mutate({
          plan: data.plan,
          paymentIntentId: `pi_${Date.now()}_demo`
        });
      }, 2000);
    },
    onError: (error) => {
      toast({
        title: "Error en el pago",
        description: "No se pudo procesar el pago. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  // Confirm payment mutation
  const confirmPaymentMutation = useMutation({
    mutationFn: async (data: { plan: string; paymentIntentId: string }) => {
      return apiRequest('POST', '/api/account/confirm-payment', data);
    },
    onSuccess: (data) => {
      setIsProcessingPayment(false);
      toast({
        title: "¡Pago exitoso!",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/account/trial-status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    },
    onError: (error) => {
      setIsProcessingPayment(false);
      toast({
        title: "Error confirmando pago",
        description: "Contacta con soporte si el problema persiste.",
        variant: "destructive",
      });
    },
  });

  const handleUpgrade = () => {
    if (!selectedPlan) return;
    createPaymentMutation.mutate(selectedPlan);
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

  // If account is active (paid), show success status
  if (trialStatus.status === 'active' && !trialStatus.isTrialActive) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center text-green-800">
            <CheckCircle className="w-5 h-5 mr-2" />
            Suscripción Activa
          </CardTitle>
          <CardDescription className="text-green-600">
            Tu suscripción {trialStatus.plan} está activa y funcionando correctamente.
          </CardDescription>
        </CardHeader>
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

  // If trial is active, show days remaining with option to pay early
  return (
    <Card className={trialStatus.daysRemaining <= 3 ? "border-orange-200 bg-orange-50" : "border-blue-200 bg-blue-50"}>
      <CardHeader>
        <CardTitle className={`flex items-center ${trialStatus.daysRemaining <= 3 ? "text-orange-800" : "text-blue-800"}`}>
          <Clock className="w-5 h-5 mr-2" />
          Período de Prueba
          <Badge variant={trialStatus.daysRemaining <= 3 ? "destructive" : "secondary"} className="ml-2">
            {trialStatus.daysRemaining} días restantes
          </Badge>
        </CardTitle>
        <CardDescription className={trialStatus.daysRemaining <= 3 ? "text-orange-600" : "text-blue-600"}>
          <div className="flex items-center">
            <Calendar className="w-4 h-4 mr-1" />
            Expira el {new Date(trialStatus.trialEndDate).toLocaleDateString('es-ES')}
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {trialStatus.daysRemaining <= 3 && (
          <div className="bg-orange-100 border border-orange-200 rounded-lg p-3 mb-4">
            <div className="flex items-center text-orange-800 text-sm">
              <AlertCircle className="w-4 h-4 mr-2" />
              <strong>Acción requerida:</strong> Tu prueba expira pronto. Realiza el pago para evitar interrupciones.
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Seleccionar Plan:</label>
            <Select value={selectedPlan} onValueChange={setSelectedPlan}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {subscriptionPlans.map((plan: any) => (
                  <SelectItem key={plan.name} value={plan.name.toLowerCase()}>
                    {plan.displayName} - €{plan.pricePerUser}/mes
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 flex items-end">
            <Button 
              onClick={handleUpgrade}
              disabled={isProcessingPayment || createPaymentMutation.isPending}
              variant={trialStatus.daysRemaining <= 3 ? "default" : "outline"}
              className="w-full"
            >
              {isProcessingPayment ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                  Procesando pago...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  {trialStatus.daysRemaining <= 3 ? "Pagar Ahora" : "Pagar Anticipadamente"}
                </>
              )}
            </Button>
          </div>
        </div>

        {trialStatus.daysRemaining > 3 && (
          <p className="text-sm text-gray-600 mt-2">
            Puedes continuar usando la prueba gratuita o pagar anticipadamente para desbloquear funcionalidades completas.
          </p>
        )}
      </CardContent>
    </Card>
  );
}