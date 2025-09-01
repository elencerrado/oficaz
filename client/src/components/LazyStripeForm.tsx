import { useState, useEffect, lazy, Suspense } from 'react';
import { MockPaymentForm } from './MockPaymentForm';
import { CreditCard, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Lazy load ALL Stripe components to remove 141KB from main bundle
const Elements = lazy(() => import('@stripe/react-stripe-js').then(m => ({ default: m.Elements })));
const loadStripe = lazy(() => import('@stripe/stripe-js').then(m => ({ default: m.loadStripe })));
const LazyStripePaymentForm = lazy(() => import('./StripePaymentForm').then(m => ({ default: m.StripePaymentForm })));

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
  const [stripe, setStripe] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeStripe = async () => {
      try {
        // Use production key first, fallback to test key (same logic as backend)
        const publicKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY_TEST;
        
        if (!publicKey) {
          setError('FALTAN CLAVES DE TEST DE STRIPE');
          setLoading(false);
          return;
        }

        // Lazy load Stripe
        const { default: loadStripeFunc } = await loadStripe;
        const stripeInstance = await loadStripeFunc(publicKey);
        
        if (!stripeInstance) {
          setError('STRIPE NO SE PUDO CARGAR CON CLAVES DE TEST');
          setLoading(false);
          return;
        }

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
    <Suspense fallback={
      <div className="p-6 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-sm text-gray-600">Cargando sistema de pagos...</p>
      </div>
    }>
      <Elements 
        stripe={stripe} 
        options={{
          clientSecret,
          appearance: {
            theme: 'stripe',
          },
        }}
      >
        <LazyStripePaymentForm
          planName={planName}
          planPrice={planPrice}
          onSuccess={onSuccess}
          onCancel={onCancel}
        />
      </Elements>
    </Suspense>
  );
}