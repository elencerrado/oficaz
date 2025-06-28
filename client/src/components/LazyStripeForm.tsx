import { useState, useEffect } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { StripePaymentForm } from './StripePaymentForm';
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
        const publicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
        
        if (!publicKey) {
          setError('Claves de Stripe no configuradas');
          setLoading(false);
          return;
        }

        const stripeInstance = await loadStripe(publicKey);
        
        if (!stripeInstance) {
          setError('No se pudo cargar Stripe');
          setLoading(false);
          return;
        }

        setStripe(stripeInstance);
        setLoading(false);
      } catch (err) {
        console.error('Error loading Stripe:', err);
        setError('Error al cargar el sistema de pagos');
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

  if (error) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="w-12 h-12 mx-auto text-red-400 mb-4" />
        <p className="text-sm text-gray-600 mb-4">{error}</p>
        <Button variant="outline" onClick={onCancel}>
          Cerrar
        </Button>
      </div>
    );
  }

  if (!stripe) {
    return (
      <div className="p-6 text-center">
        <CreditCard className="w-12 h-12 mx-auto text-gray-400 mb-4" />
        <p className="text-sm text-gray-600 mb-4">
          Sistema de pagos no disponible
        </p>
        <Button variant="outline" onClick={onCancel}>
          Cerrar
        </Button>
      </div>
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