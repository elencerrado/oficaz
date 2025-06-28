import { useState, useEffect } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { StripePaymentForm } from './StripePaymentForm';
import { MockPaymentForm } from './MockPaymentForm';
import { CreditCard, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LazyStripeFormProps {
  clientSecret: string;
  planName: string;
  planPrice: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export function LazyStripeForm({ 
  clientSecret, 
  planName, 
  planPrice, 
  onSuccess, 
  onCancel 
}: LazyStripeFormProps) {
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeStripe = async () => {
      try {
        // FORZAR CLAVES DE TEST EN DESARROLLO - SIN FALLBACK A DEMO
        const publicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY_TEST;
        
        console.log('FORCED TEST MODE');
        console.log('Test key available:', !!publicKey);
        console.log('Test key value:', publicKey?.substring(0, 15) + '...');

        if (!publicKey) {
          setError('FALTAN CLAVES DE TEST DE STRIPE');
          setLoading(false);
          return;
        }

        const stripeInstance = await loadStripe(publicKey);
        if (!stripeInstance) {
          setError('STRIPE NO SE PUDO CARGAR CON CLAVES DE TEST');
          setLoading(false);
          return;
        }

        console.log('STRIPE CARGADO EXITOSAMENTE CON CLAVES TEST');
        setStripe(stripeInstance);
        setLoading(false);
      } catch (err) {
        console.error('ERROR REAL DE STRIPE:', err);
        setError(`ERROR CRITICO DE STRIPE: ${err instanceof Error ? err.message : JSON.stringify(err)}`);
        setLoading(false);
      }
    };

    initializeStripe();
  }, []);

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-sm text-gray-600">Cargando formulario de pago...</p>
      </div>
    );
  }

  // Si hay error o no se pudo cargar Stripe, usar formulario de demostración
  if (error || !stripe) {
    return (
      <MockPaymentForm
        planName={planName}
        planPrice={planPrice}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    );
  }

  return (
    <Elements 
      stripe={stripe} 
      options={{
        clientSecret,
        appearance: {
          theme: 'stripe',
        },
      }}
    >
      <StripePaymentForm
        planName={planName}
        planPrice={planPrice}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    </Elements>
  );
}