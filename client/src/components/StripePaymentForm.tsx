import { useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';

import { CheckCircle } from 'lucide-react';
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
    <div data-testid="stripe-payment-form" className="space-y-6">
      <div className="text-center">
        <div className="bg-blue-50 rounded-lg p-4 inline-block">
          <p className="text-sm text-blue-800 font-medium">
            Plan {planName.charAt(0).toUpperCase() + planName.slice(1)}
          </p>
          <p className="text-xs text-blue-600">
            €{planPrice}/mes • Facturación mensual
          </p>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
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
      
      <div className="pt-4 border-t">
        <div className="flex items-center justify-center text-xs text-gray-500">
          <div className="w-4 h-4 mr-2 bg-gray-200 rounded flex items-center justify-center">
            🔒
          </div>
          Procesado de forma segura por Stripe
        </div>
      </div>
    </div>
  );
}