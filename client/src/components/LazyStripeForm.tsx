import { useState, useEffect, lazy, Suspense } from 'react';
import { MockPaymentForm } from './MockPaymentForm';
import { CreditCard, AlertCircle } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';

// Lazy load ALL Stripe components to remove 141KB from main bundle
const Elements = lazy(() => import('@stripe/react-stripe-js').then(m => ({ default: m.Elements })));
const loadStripe = lazy(() => import('@stripe/stripe-js').then(m => ({ default: m.loadStripe })));
const LazyStripePaymentForm = lazy(() => import('./StripePaymentForm').then(m => ({ default: m.StripePaymentForm })));

interface LazyStripeFormProps {
  clientSecret: string;
  planName: string;
  planPrice: number;
  trialEndDate?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function LazyStripeForm({ 
  clientSecret, 
  planName, 
  planPrice, 
  trialEndDate,
  onSuccess, 
  onCancel 
}: LazyStripeFormProps) {
  const [stripe, setStripe] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeStripe = async () => {
      console.log('🔧 STRIPE INIT - Starting Stripe initialization...');
      try {
        const publicKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
        console.log('🔧 STRIPE - Using key:', publicKey ? publicKey.substring(0, 10) + '...' : 'NONE');
        
        if (!publicKey) {
          console.log('🚨 STRIPE ERROR - No public key found!');
          setError('FALTAN CLAVES DE TEST DE STRIPE');
          setLoading(false);
          return;
        }

        // Lazy load Stripe
        console.log('🔧 STRIPE LOAD - Loading Stripe library...');
        const { default: loadStripeFunc } = await loadStripe;
        console.log('🔧 STRIPE LOAD - Library loaded, calling loadStripeFunc with key');
        const stripeInstance = await loadStripeFunc(publicKey);
        console.log('🔧 STRIPE INSTANCE - Result:', !!stripeInstance);
        
        if (!stripeInstance) {
          console.log('🚨 STRIPE ERROR - Instance is null!');
          setError('STRIPE NO SE PUDO CARGAR CON CLAVES DE TEST');
          setLoading(false);
          return;
        }

        console.log('✅ STRIPE SUCCESS - Instance created successfully');
        setStripe(stripeInstance);
        setLoading(false);
      } catch (err) {
        console.error('🚨 STRIPE INIT ERROR:', err);
        console.error('🚨 STRIPE INIT ERROR Type:', typeof err);
        console.error('🚨 STRIPE INIT ERROR Message:', err instanceof Error ? err.message : JSON.stringify(err));
        setError(`ERROR CRITICO DE STRIPE: ${err instanceof Error ? err.message : JSON.stringify(err)}`);
        setLoading(false);
      }
    };

    initializeStripe();
  }, []);

  if (loading) {
    return (
      <div className="p-6 text-center">
        <LoadingSpinner size="md" />
        <p className="text-sm text-gray-600 mt-4">Cargando formulario de pago...</p>
      </div>
    );
  }

  // Si hay error o no se pudo cargar Stripe, usar formulario de demostración
  if (error || !stripe) {
    console.log('🚨 USANDO MOCKPAYMENTFORM - REASON:', { error, stripeExists: !!stripe });
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
        <LoadingSpinner size="md" />
        <p className="text-sm text-gray-600 mt-4">Cargando sistema de pagos...</p>
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
          trialEndDate={trialEndDate}
          onSuccess={onSuccess}
          onCancel={onCancel}
        />
      </Elements>
    </Suspense>
  );
}