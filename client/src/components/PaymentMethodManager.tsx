import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Plus, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { StripePaymentForm } from './StripePaymentForm';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useAuth } from '@/hooks/use-auth';

interface PaymentMethod {
  id: string;
  card_brand: string;
  card_last_four: string;
  card_exp_month: number;
  card_exp_year: number;
  is_default: boolean;
}

interface PaymentMethodManagerProps {
  paymentMethods: PaymentMethod[];
  onPaymentSuccess?: () => void;
  selectedPlan?: string;
  selectedPlanPrice?: number;
}



// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY!);

export function PaymentMethodManager({ paymentMethods, onPaymentSuccess, selectedPlan, selectedPlanPrice }: PaymentMethodManagerProps) {
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { refreshUser } = useAuth();

  // Get current subscription to determine the actual plan and price
  const { data: subscription, refetch: refetchSubscription } = useQuery({
    queryKey: ['/api/account/subscription'],
    staleTime: 30000,
  });

  // Get cancellation status to show warnings
  const { data: cancellationStatus } = useQuery({
    queryKey: ['/api/account/cancellation-status'],
    staleTime: 30000,
  });

  // Get trial status for trial end date
  const { data: trialStatus } = useQuery({
    queryKey: ['/api/account/trial-status'],
    staleTime: 30000,
  });

  // Determine the actual plan and price to display - Nuevo modelo: siempre Oficaz (39€)
  const actualPlan = selectedPlan || subscription?.plan || "oficaz";
  
  // Use custom monthly price if available, otherwise use base Oficaz price (39€)
  const standardPrice = subscription?.baseMonthlyPrice ? Number(subscription.baseMonthlyPrice) : 39.00;
  const actualPrice = selectedPlanPrice || subscription?.customMonthlyPrice || standardPrice;



  const deletePaymentMethodMutation = useMutation({
    mutationFn: async (paymentMethodId: string) => {
      return apiRequest('DELETE', `/api/payment-methods/${paymentMethodId}`);
    },
    onSuccess: () => {
      toast({
        title: "Método de pago eliminado",
        description: "El método de pago se ha eliminado correctamente.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/account/payment-methods'] });
      setSelectedMethod(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el método de pago.",
        variant: "destructive",
      });
    },
  });

  const setDefaultPaymentMethodMutation = useMutation({
    mutationFn: async (paymentMethodId: string) => {
      return apiRequest('PATCH', `/api/payment-methods/${paymentMethodId}/set-default`);
    },
    onSuccess: () => {
      toast({
        title: "Método de pago principal actualizado",
        description: "El método de pago principal se ha actualizado correctamente.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/account/payment-methods'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el método de pago principal.",
        variant: "destructive",
      });
    },
  });

  const createSetupIntentMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/account/create-setup-intent');
      return response;
    },
    onSuccess: (data: any) => {
      setClientSecret(data.clientSecret);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo inicializar el formulario de pago.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteMethod = (method: PaymentMethod) => {
    setSelectedMethod(method);
  };

  const confirmDelete = () => {
    if (selectedMethod) {
      deletePaymentMethodMutation.mutate(selectedMethod.id);
    }
  };

  const handleSetDefault = (method: PaymentMethod) => {
    if (!method.is_default) {
      setDefaultPaymentMethodMutation.mutate(method.id);
    }
  };

  const handleAddCard = () => {
    setClientSecret(null);
    createSetupIntentMutation.mutate();
    setIsAddingCard(true);
  };

  // Check if this is a test-to-production migration case
  const hasTestData = subscription?.stripeSubscriptionId && !subscription?.stripeCustomerId;

  const handleCleanupTestData = async () => {
    try {
      const response = await apiRequest('POST', '/api/account/cleanup-test-stripe', {});
      
      toast({
        title: "Datos de prueba limpiados",
        description: "Ahora puedes configurar tu método de pago para continuar con el servicio",
      });
      
      // Refresh subscription data
      refetchSubscription();
      
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al limpiar datos de prueba",
        variant: "destructive",
      });
    }
  };

  const handlePaymentSuccess = async () => {
    try {
      // Only change the plan if it's different from the current one
      if (selectedPlan && actualPlan !== subscription?.plan) {
        console.log('Checking if plan change is needed. Selected plan:', selectedPlan);
        
        // Get current subscription status to check if plan change is needed
        try {
          const currentSubscription = await apiRequest('GET', '/api/account/subscription');
          const currentPlan = currentSubscription?.plan;
          
          if (currentPlan !== selectedPlan) {
            console.log('Changing plan from', currentPlan, 'to:', selectedPlan);
            await apiRequest('PATCH', '/api/subscription/change-plan', { plan: selectedPlan });
            console.log('Plan changed successfully to:', selectedPlan);
          } else {
            console.log('Plan is already', selectedPlan, '- no change needed');
          }
        } catch (planError) {
          console.log('Could not check current plan, attempting plan change anyway');
          await apiRequest('PATCH', '/api/subscription/change-plan', { plan: selectedPlan });
          console.log('Plan changed successfully to:', selectedPlan);
        }
      }
      
      // Then close modal and invalidate ALL relevant cache
      setIsAddingCard(false);
      setClientSecret(null);
      
      // Invalidate all subscription and auth related queries
      await queryClient.invalidateQueries({ queryKey: ['/api/account/payment-methods'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/account/subscription'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/account/trial-status'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/account/cancellation-status'] });
      
      // Force complete data refetch
      await queryClient.refetchQueries({ queryKey: ['/api/auth/me'] });
      await queryClient.refetchQueries({ queryKey: ['/api/account/trial-status'] });
      
      // Force refresh user authentication context and wait for complete update
      await refreshUser();
      
      // Small delay to ensure all state updates are processed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      toast({
        title: "¡Suscripción activada!",
        description: `Tu suscripción Oficaz se ha activado correctamente.`,
      });
      
      // Call the parent's onPaymentSuccess callback if provided
      if (onPaymentSuccess) {
        onPaymentSuccess();
      }
    } catch (error: any) {
      console.error('Error during payment success flow:', error);
      toast({
        title: "Error",
        description: error.message || "Hubo un problema al activar tu suscripción.",
        variant: "destructive",
      });
    }
  };

  const handlePaymentCancel = () => {
    setIsAddingCard(false);
    setClientSecret(null);
  };



  return (
    <div className="space-y-4">
      {/* Account Scheduled for Deletion Alert */}
      {cancellationStatus?.scheduledForCancellation && (
        <Card className="!border-red-200 !bg-red-50 !border-2" style={{ borderRadius: '0.5rem !important' }}>
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-medium text-red-900 mb-2">Cuenta programada para cancelación</h4>
                <p className="text-sm text-red-800 mb-3">
                  Tu cuenta está programada para ser cancelada el {new Date(cancellationStatus.scheduledCancellationDate).toLocaleDateString('es-ES', { 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric' 
                  })}. Tienes un período de gracia de 30 días para cambiar de opinión.
                </p>
                <p className="text-sm text-red-800 mb-3">
                  Si deseas mantener tu cuenta activa, puedes cancelar la programación desde la página de configuración.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Data Migration Alert */}
      {hasTestData && (
        <Card className="!border-orange-200 !bg-orange-50 !border-2" style={{ borderRadius: '0.5rem !important' }}>
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-medium text-orange-900 mb-2">Migración de datos de prueba detectada</h4>
                <p className="text-sm text-orange-800 mb-3">
                  Tu cuenta tiene datos de una suscripción de prueba anterior. Para continuar con el servicio 
                  después del 1 de octubre, necesitas limpiar estos datos y configurar un método de pago real.
                </p>
                <Button 
                  onClick={handleCleanupTestData}
                  size="sm"
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  Limpiar datos de prueba
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Payment Methods */}
      <Card data-testid="payment-method-manager" className="!border-gray-200" style={{ borderRadius: '0.5rem !important' }}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <CreditCard className="w-5 h-5 mr-2" />
                Métodos de pago
              </CardTitle>
              <CardDescription>
                Gestiona tus tarjetas de crédito y débito
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleAddCard}>
              <Plus className="w-4 h-4 mr-2" />
              Añadir tarjeta
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {paymentMethods && paymentMethods.length > 0 ? (
            <div className="space-y-3">
              {paymentMethods.map((method) => (
                <div key={method.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <CreditCard className="h-8 w-8 text-blue-600" />
                    <div>
                      <div className="flex items-center space-x-2">
                        <p className="font-medium">
                          {method.card_brand?.toUpperCase()} •••• {method.card_last_four}
                        </p>
                        {method.is_default && (
                          <Badge variant="secondary" className="text-xs">
                            Principal
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        Expira: {method.card_exp_month.toString().padStart(2, '0')}/{method.card_exp_year}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {!method.is_default && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetDefault(method)}
                        disabled={setDefaultPaymentMethodMutation.isPending}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Marcar principal
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteMethod(method)}
                      disabled={deletePaymentMethodMutation.isPending}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CreditCard className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 mb-2">No hay métodos de pago configurados</p>
              <p className="text-sm text-gray-500 mb-4">
                Añade una tarjeta para activar tu suscripción
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!selectedMethod} onOpenChange={() => setSelectedMethod(null)}>
        <DialogContent className="z-[100]">
          <DialogHeader>
            <DialogTitle>Eliminar método de pago</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar esta tarjeta?
            </DialogDescription>
          </DialogHeader>
          {selectedMethod && (
            <div className="py-4">
              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <CreditCard className="h-6 w-6 text-gray-600" />
                <div>
                  <p className="font-medium">
                    {selectedMethod.card_brand?.toUpperCase()} •••• {selectedMethod.card_last_four}
                  </p>
                  <p className="text-sm text-gray-500">
                    Expira: {selectedMethod.card_exp_month.toString().padStart(2, '0')}/{selectedMethod.card_exp_year}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-3">
                Esta acción no se puede deshacer. Si es tu único método de pago, 
                tu suscripción podría verse afectada.
              </p>
            </div>
          )}
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setSelectedMethod(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deletePaymentMethodMutation.isPending}
            >
              {deletePaymentMethodMutation.isPending ? 'Eliminando...' : 'Eliminar tarjeta'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para añadir método de pago */}
      <Dialog open={isAddingCard} onOpenChange={setIsAddingCard}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto z-[100] !bg-white !text-gray-900 [&>*]:!bg-white [&>*]:!text-gray-900 [&_*]:!bg-white [&_*]:!text-gray-900 [&_button]:!bg-white [&_button]:!text-gray-900 [&_button]:!border-gray-300 [&_button]:!rounded-lg [&_input]:!bg-white [&_input]:!text-gray-900 [&_input]:!border-gray-300 [&_input]:!rounded-lg [&_label]:!text-gray-900 [&_p]:!text-gray-600 [&_h3]:!text-gray-900 [&_.card]:!rounded-lg [&_.card]:!border-gray-200">
          <DialogHeader>
            <DialogTitle>Añadir método de pago</DialogTitle>
            <DialogDescription>
              Añade una nueva tarjeta de crédito o débito de forma segura.
            </DialogDescription>
          </DialogHeader>
          {clientSecret ? (
            <Elements 
              stripe={stripePromise} 
              options={{ 
                clientSecret,
                appearance: {
                  theme: 'stripe',
                  variables: {
                    colorPrimary: '#007AFF',
                    colorBackground: '#ffffff',
                    colorText: '#1f2937',
                    colorDanger: '#ef4444',
                    fontFamily: 'system-ui, sans-serif',
                    spacingUnit: '4px',
                    borderRadius: '6px'
                  }
                }
              }}
            >
              <StripePaymentForm
                planName={actualPlan}
                planPrice={actualPrice}
                trialEndDate={trialStatus?.trialEnd}
                onSuccess={handlePaymentSuccess}
                onCancel={handlePaymentCancel}
              />
            </Elements>
          ) : (
            <div className="p-6 text-center">
              {createSetupIntentMutation.isPending ? (
                <>
                  <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="text-sm text-gray-600">Preparando formulario de pago...</p>
                </>
              ) : (
                <>
                  <AlertCircle className="w-12 h-12 mx-auto text-red-400 mb-4" />
                  <p className="text-sm text-gray-600 mb-4">
                    No se pudo cargar el formulario de pago.
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => createSetupIntentMutation.mutate()}
                    disabled={createSetupIntentMutation.isPending}
                  >
                    Reintentar
                  </Button>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}