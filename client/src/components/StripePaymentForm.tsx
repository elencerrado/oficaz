import { useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface StripePaymentFormProps {
  planName: string;
  planPrice: number;
  trialEndDate?: string;
  isTrialExpired?: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

export function StripePaymentForm({ planName, planPrice, trialEndDate, isTrialExpired, onSuccess, onCancel }: StripePaymentFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  const stripe = useStripe();
  const elements = useElements();

  // Check if trial has expired - use prop if provided, otherwise calculate from date
  const trialHasExpired = isTrialExpired ?? (trialEndDate ? new Date(trialEndDate) < new Date() : false);
  
  // Format the trial end date
  const formattedTrialEndDate = trialEndDate 
    ? format(new Date(trialEndDate), "d 'de' MMMM", { locale: es })
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      console.log('Stripe not ready:', { stripe: !!stripe, elements: !!elements });
      return;
    }

    setIsLoading(true);
    console.log('Starting card verification process...');

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

      console.log('Stripe setup response:', result);

      if (result.error) {
        console.error('Stripe setup error:', result.error);
        toast({
          title: "Error al verificar la tarjeta",
          description: result.error.message || "Ha ocurrido un error inesperado",
          variant: "destructive",
        });
      } else if (result.setupIntent) {
        console.log('Card verification response:', result.setupIntent);
        
        // Check setup intent status
        const status = result.setupIntent.status;
        console.log('SetupIntent status:', status);
        
        if (status === 'succeeded') {
          // Verification successful - proceed with backend confirmation
          try {
            await apiRequest('POST', '/api/account/confirm-payment-method', {
              setupIntentId: result.setupIntent.id,
            });

            toast({
              title: trialHasExpired ? "¡Suscripción activada!" : "¡Tarjeta verificada!",
              description: trialHasExpired 
                ? `Tu suscripción ha sido activada correctamente.`
                : `Tu tarjeta ha sido verificada correctamente. El primer cobro será cuando termine tu prueba gratuita.`,
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
              description: "La tarjeta se verificó pero no se pudo confirmar en el servidor",
              variant: "destructive",
            });
          }
        } else if (status === 'requires_action' || status === 'requires_source_action') {
          // 3D Secure authentication still in progress - this is normal
          console.log('3D Secure authentication in progress - waiting for user action');
          toast({
            title: "Verificación en curso",
            description: "Completa la verificación en tu banco para continuar",
          });
        } else {
          // Unexpected status
          console.error('Unexpected SetupIntent status:', status);
          toast({
            title: "Estado inesperado",
            description: `Estado de la verificación: ${status}. Inténtalo de nuevo.`,
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error('Error processing card verification:', error);
      toast({
        title: "Error",
        description: "No se pudo verificar la tarjeta. Inténtalo de nuevo.",
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
        {trialHasExpired ? (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              💳 <strong>Activar suscripción:</strong> El cobro de €{planPrice} se realizará ahora
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Tu periodo de prueba ha finalizado. Al añadir tu tarjeta, se activará tu suscripción.
            </p>
          </div>
        ) : (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">
              🔒 <strong>Verificación sin cobro:</strong> Solo validaremos tu tarjeta (€0)
            </p>
            {formattedTrialEndDate ? (
              <p className="text-xs text-green-600 mt-1">
                El primer cobro de €{planPrice} será el {formattedTrialEndDate} cuando termine tu prueba gratuita
              </p>
            ) : (
              <p className="text-xs text-green-600 mt-1">
                El primer cobro de €{planPrice} será cuando termine tu prueba gratuita
              </p>
            )}
          </div>
        )}
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
                <LoadingSpinner size="xs" className="mr-2" />
                {trialHasExpired ? 'Activando...' : 'Verificando...'}
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                {trialHasExpired ? 'Activar suscripción' : 'Verificar tarjeta'}
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