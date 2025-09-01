import { useState } from 'react';
import { AlertCircle, CreditCard, Shield, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PaymentMethodManager } from './PaymentMethodManager';

interface BlockedAccountOverlayProps {
  trialStatus: {
    plan: string;
    trialEndDate: string;
    daysRemaining: number;
    isBlocked: boolean;
  };
}

export default function BlockedAccountOverlay({ trialStatus }: BlockedAccountOverlayProps) {
  const queryClient = useQueryClient();

  const { data: subscriptionPlans = [] } = useQuery({
    queryKey: ['/api/subscription-plans'],
    retry: false,
  });

  const [selectedPlan, setSelectedPlan] = useState(trialStatus.plan || 'basic');
  const [showPaymentManager, setShowPaymentManager] = useState(false);

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['/api/account/payment-methods'],
    retry: false,
  });

  const getPlanPrice = (planName: string) => {
    if (!Array.isArray(subscriptionPlans)) return '0';
    const plan = subscriptionPlans.find((p: any) => p.name === planName);
    return plan?.pricePerUser || '0';
  };

  const getPlanDisplayName = (planName: string) => {
    if (!Array.isArray(subscriptionPlans)) return planName;
    const plan = subscriptionPlans.find((p: any) => p.name === planName);
    return plan?.displayName || planName;
  };

  // Function to invalidate all relevant queries after successful payment
  const handlePaymentSuccess = async () => {
    // Invalidate ALL subscription-related queries to refresh the state
    await queryClient.invalidateQueries({ queryKey: ['/api/account/trial-status'] });
    await queryClient.invalidateQueries({ queryKey: ['/api/account/subscription'] });
    await queryClient.invalidateQueries({ queryKey: ['/api/account/payment-methods'] });
    await queryClient.invalidateQueries({ queryKey: ['/api/account/cancellation-status'] });
    await queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    await queryClient.invalidateQueries({ queryKey: ['/api/subscription-plans'] });
    await queryClient.invalidateQueries({ queryKey: ['/api/companies/custom-features'] });
    
    // Invalidate feature-dependent queries that might be cached
    await queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
    await queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
    await queryClient.invalidateQueries({ queryKey: ['/api/reminders'] });
    await queryClient.invalidateQueries({ queryKey: ['/api/vacation-requests'] });
    await queryClient.invalidateQueries({ queryKey: ['/api/work-sessions'] });
    
    // Force immediate refetch of critical queries to update UI
    await queryClient.refetchQueries({ queryKey: ['/api/account/subscription'] });
    await queryClient.refetchQueries({ queryKey: ['/api/auth/me'] });
    
    // Close the payment manager modal
    setShowPaymentManager(false);
  };

  return (
    <div className="light">
      {/* Overlay que cubre toda la pantalla - FORZAR MODO CLARO */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl border-red-200 bg-white shadow-2xl">
          <CardHeader className="text-center space-y-4 pb-6">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            
            <div className="space-y-2">
              <CardTitle className="text-2xl text-red-800">
                Período de Prueba Expirado
              </CardTitle>
              <p className="text-gray-600">
                Tu período de prueba gratuito ha terminado el {new Date(trialStatus.trialEndDate).toLocaleDateString('es-ES')}
              </p>
              <p className="text-sm text-gray-500">
                Selecciona un plan y añade un método de pago para continuar usando Oficaz
              </p>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Información del estado actual */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-red-100 rounded-full">
                  <Shield className="w-4 h-4 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-red-800">Cuenta temporalmente bloqueada</p>
                  <p className="text-xs text-red-600">
                    Tu plan {getPlanDisplayName(trialStatus.plan)} requiere un método de pago activo
                  </p>
                </div>
              </div>
            </div>

            {/* Selector de plan */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-900">
                Selecciona tu plan de suscripción:
              </label>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Array.isArray(subscriptionPlans) && subscriptionPlans.filter((plan: any) => plan.name !== 'master').map((plan: any) => (
                  <Card 
                    key={plan.name}
                    className={`cursor-pointer transition-all ${
                      selectedPlan === plan.name 
                        ? 'border-blue-500 bg-blue-50 shadow-md' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedPlan(plan.name)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="font-semibold text-gray-900">{plan.displayName}</h3>
                            {selectedPlan === plan.name && (
                              <Badge className="bg-blue-500">Seleccionado</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            €{plan.pricePerUser}/mes
                          </p>
                        </div>
                        <div className={`w-4 h-4 rounded-full border-2 ${
                          selectedPlan === plan.name 
                            ? 'border-blue-500 bg-blue-500' 
                            : 'border-gray-300'
                        }`}>
                          {selectedPlan === plan.name && (
                            <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5" />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Botón para proceder con el pago */}
            <div className="pt-4 border-t">
              <Button 
                onClick={() => setShowPaymentManager(true)}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-3"
                size="lg"
              >
                <CreditCard className="w-5 h-5 mr-2" />
                Añadir Método de Pago y Activar Plan {getPlanDisplayName(selectedPlan)}
              </Button>
              
              <p className="text-xs text-gray-500 text-center mt-3">
                Una vez añadas un método de pago, tu cuenta se activará inmediatamente
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal para gestionar métodos de pago */}
      <Dialog open={showPaymentManager} onOpenChange={setShowPaymentManager}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Activar Plan {getPlanDisplayName(selectedPlan)}</DialogTitle>
            <DialogDescription>
              Añade un método de pago para activar tu plan {getPlanDisplayName(selectedPlan)} (€{getPlanPrice(selectedPlan)}/mes)
            </DialogDescription>
          </DialogHeader>
          <PaymentMethodManager 
            paymentMethods={Array.isArray(paymentMethods) ? paymentMethods : []} 
            onPaymentSuccess={handlePaymentSuccess}
            selectedPlan={selectedPlan}
            selectedPlanPrice={getPlanPrice(selectedPlan)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}