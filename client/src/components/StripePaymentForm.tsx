import { useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, CheckCircle, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface StripePaymentFormProps {
  planName: string;
  planPrice: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export function StripePaymentForm({ planName, planPrice, onSuccess, onCancel }: StripePaymentFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      console.log('Stripe not ready:', { stripe: !!stripe, elements: !!elements });
      return;
    }

    setIsLoading(true);
    console.log('Starting payment setup process...');

    try {
      console.log('Confirming setup with Stripe...');
      
      // Add timeout to prevent infinite loading
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout: Stripe setup took too long')), 30000)
      );

      const stripePromise = stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: window.location.origin + '/configuracion',
        },
        redirect: 'if_required',
      });

      const result = await Promise.race([stripePromise, timeoutPromise]) as any;

      console.log('Stripe response:', result);

      if (result.error) {
        console.error('Stripe error:', result.error);
        toast({
          title: "Error al procesar el pago",
          description: result.error.message || "Ha ocurrido un error inesperado",
          variant: "destructive",
        });
      } else if (result.setupIntent) {
        console.log('Setup successful:', result.setupIntent);
        
        // Call the backend to confirm the payment method
        try {
          await apiRequest('POST', '/api/account/confirm-payment-method', {
            setupIntentId: result.setupIntent.id,
          });

          toast({
            title: "¡Método de pago añadido!",
            description: "Tu método de pago ha sido configurado correctamente",
          });
          
          // Invalidate auth data to refresh subscription status
          queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
          queryClient.invalidateQueries({ queryKey: ['/api/account/trial-status'] });
          queryClient.invalidateQueries({ queryKey: ['/api/account/subscription'] });
          queryClient.invalidateQueries({ queryKey: ['/api/account/payment-methods'] });
          
          onSuccess();
        } catch (backendError) {
          console.error('Backend confirmation error:', backendError);
          toast({
            title: "Error",
            description: "El método de pago se procesó pero no se pudo confirmar en el servidor",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      toast({
        title: "Error",
        description: "No se pudo procesar el pago. Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="max-w-md mx-auto !bg-white !text-gray-900 [&_*]:!bg-white [&_*]:!text-gray-900 [&_button]:!bg-white [&_button]:!text-gray-900 [&_button]:!border-gray-300 [&_input]:!bg-white [&_input]:!text-gray-900 [&_input]:!border-gray-300 [&_label]:!text-gray-900 [&_p]:!text-gray-600 [&_h3]:!text-gray-900 [&_.stripe-payment-element_*]:!bg-white [&_.stripe-payment-element_*]:!text-gray-900">
      <CardHeader className="text-center pb-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <CreditCard className="w-5 h-5 mr-2 text-blue-600" />
            Añadir método de pago
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </Button>
        </CardTitle>
        <div className="bg-blue-50 rounded-lg p-3 mt-3">
          <p className="text-sm text-blue-800 font-medium">
            Plan {planName.charAt(0).toUpperCase() + planName.slice(1)}
          </p>
          <p className="text-xs text-blue-600">
            €{planPrice}/mes • Facturación mensual
          </p>
        </div>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="stripe-payment-element">
            <PaymentElement 
              options={{
                layout: 'tabs',
                paymentMethodOrder: ['card'],
              }}
            />
          </div>
          
          <div className="flex space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex-1"
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!stripe || !elements || isLoading}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                  Procesando...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Confirmar pago
                </>
              )}
            </Button>
          </div>
        </form>
        
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center text-xs text-gray-500">
            <div className="w-4 h-4 mr-2 bg-gray-200 rounded flex items-center justify-center">
              🔒
            </div>
            Procesado de forma segura por Stripe
          </div>
        </div>
      </CardContent>
    </Card>
  );
}