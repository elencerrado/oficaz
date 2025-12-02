import { useState } from 'react';
import { AlertCircle, CreditCard, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  const [showPaymentManager, setShowPaymentManager] = useState(false);

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['/api/account/payment-methods'],
    retry: false,
  });

  const handlePaymentSuccess = async () => {
    await queryClient.invalidateQueries({ queryKey: ['/api/account/trial-status'] });
    await queryClient.invalidateQueries({ queryKey: ['/api/account/subscription'] });
    await queryClient.invalidateQueries({ queryKey: ['/api/account/payment-methods'] });
    await queryClient.invalidateQueries({ queryKey: ['/api/account/cancellation-status'] });
    await queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    await queryClient.invalidateQueries({ queryKey: ['/api/subscription-plans'] });
    await queryClient.invalidateQueries({ queryKey: ['/api/companies/custom-features'] });
    await queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
    await queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
    await queryClient.invalidateQueries({ queryKey: ['/api/reminders'] });
    await queryClient.invalidateQueries({ queryKey: ['/api/vacation-requests'] });
    await queryClient.invalidateQueries({ queryKey: ['/api/work-sessions'] });
    await queryClient.refetchQueries({ queryKey: ['/api/account/subscription'] });
    await queryClient.refetchQueries({ queryKey: ['/api/auth/me'] });
    setShowPaymentManager(false);
  };

  return (
    <div className="light">
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
                Añade un método de pago para continuar usando Oficaz
              </p>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-red-100 rounded-full">
                  <Shield className="w-4 h-4 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-red-800">Cuenta temporalmente bloqueada</p>
                  <p className="text-xs text-red-600">
                    Tu plan Oficaz requiere un método de pago activo
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg text-gray-900">Plan Oficaz</h3>
                  <p className="text-sm text-gray-600">Todo lo que necesitas para gestionar tu empresa</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-gray-900">€39</span>
                  <span className="text-gray-500">/mes</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <Button 
                onClick={() => setShowPaymentManager(true)}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-3"
                size="lg"
              >
                <CreditCard className="w-5 h-5 mr-2" />
                Añadir Método de Pago
              </Button>
              
              <p className="text-xs text-gray-500 text-center mt-3">
                Al añadir un método de pago, tu cuenta se activará automáticamente
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {showPaymentManager && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Gestionar Métodos de Pago</CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowPaymentManager(false)}
              >
                ✕
              </Button>
            </CardHeader>
            <CardContent>
              <PaymentMethodManager 
                paymentMethods={paymentMethods} 
                onPaymentSuccess={handlePaymentSuccess}
                selectedPlan="oficaz"
                selectedPlanPrice={39}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
