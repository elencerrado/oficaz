import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Plus, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { LazyStripeForm } from './LazyStripeForm';

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
}



export function PaymentMethodManager({ paymentMethods }: PaymentMethodManagerProps) {
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();



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

  const handlePaymentSuccess = () => {
    setIsAddingCard(false);
    setClientSecret(null);
    queryClient.invalidateQueries({ queryKey: ['/api/account/payment-methods'] });
    toast({
      title: "¡Método de pago añadido!",
      description: "Tu tarjeta se ha añadido correctamente.",
    });
  };

  const handlePaymentCancel = () => {
    setIsAddingCard(false);
    setClientSecret(null);
  };

  if (!hasStripeKeys) {
    return (
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="flex items-center text-orange-800">
            <AlertCircle className="w-5 h-5 mr-2" />
            Configuración de pagos pendiente
          </CardTitle>
          <CardDescription className="text-orange-600">
            Las claves de Stripe no están configuradas. Contacta con el administrador del sistema.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Current Payment Methods */}
      <Card>
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
        <DialogContent>
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Añadir método de pago</DialogTitle>
            <DialogDescription>
              Añade una nueva tarjeta de crédito o débito de forma segura.
            </DialogDescription>
          </DialogHeader>
          {clientSecret ? (
            <LazyStripeForm
              clientSecret={clientSecret}
              planName="Basic"
              planPrice={29.99}
              onSuccess={handlePaymentSuccess}
              onCancel={handlePaymentCancel}
            />
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