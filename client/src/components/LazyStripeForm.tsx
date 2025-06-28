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
        // Usar claves de test en desarrollo, claves de producción en deploy
        const isDevelopment = import.meta.env.DEV;
        console.log('import.meta.env.DEV:', import.meta.env.DEV);
        console.log('import.meta.env.MODE:', import.meta.env.MODE);
        console.log('NODE_ENV detection:', import.meta.env.NODE_ENV);
        console.log('VITE_STRIPE_PUBLIC_KEY_TEST available:', !!import.meta.env.VITE_STRIPE_PUBLIC_KEY_TEST);
        console.log('VITE_STRIPE_PUBLIC_KEY available:', !!import.meta.env.VITE_STRIPE_PUBLIC_KEY);
        
        // Forzar uso de claves de test si están disponibles
        const publicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY_TEST || import.meta.env.VITE_STRIPE_PUBLIC_KEY;
        
        console.log('Environment:', isDevelopment ? 'Development' : 'Production');
        console.log('Using test keys:', isDevelopment);
        console.log('Public key available:', !!publicKey);
        console.log('Public key type:', publicKey?.substring(0, 7));
        
        if (!publicKey) {
          setError(`Claves de Stripe no configuradas para ${isDevelopment ? 'desarrollo' : 'producción'}`);
          setLoading(false);
          return;
        }

        const stripeInstance = await loadStripe(publicKey);
        
        if (!stripeInstance) {
          setError('No se pudo cargar Stripe - verificar configuración de claves');
          setLoading(false);
          return;
        }

        setStripe(stripeInstance);
        setLoading(false);
      } catch (err) {
        console.error('Error loading Stripe:', err);
        console.error('Test key available:', !!import.meta.env.VITE_STRIPE_PUBLIC_KEY_TEST);
        console.error('Test key value:', import.meta.env.VITE_STRIPE_PUBLIC_KEY_TEST?.substring(0, 10) + '...');
        console.error('Prod key available:', !!import.meta.env.VITE_STRIPE_PUBLIC_KEY);
        console.error('Prod key value:', import.meta.env.VITE_STRIPE_PUBLIC_KEY?.substring(0, 10) + '...');
        
        // Solo mostrar error si realmente hay un problema, no un objeto vacío
        if (err && Object.keys(err).length > 0) {
          setError(`Error al cargar el sistema de pagos: ${err instanceof Error ? err.message : 'Error desconocido'}`);
        }
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