// Remove direct Stripe imports to keep them out of main bundle
// import { loadStripe } from '@stripe/stripe-js';
// import { Elements } from '@stripe/react-stripe-js';
import { useState, useEffect } from 'react';

// Initialize Stripe lazily
let stripePromise: Promise<any> | null = null;

const getStripe = async () => {
  if (!stripePromise) {
    const { loadStripe } = await import('@stripe/stripe-js');
    stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');
  }
  return stripePromise;
};

interface StripePaymentFormProps {
  children: React.ReactNode;
}

export default function StripePaymentForm({ children }: StripePaymentFormProps) {
  const [stripe, setStripe] = useState<any>(null);
  const [Elements, setElements] = useState<any>(null);

  useEffect(() => {
    // Load Stripe asynchronously after component mounts
    getStripe().then(setStripe);
    // Load Elements component asynchronously
    import('@stripe/react-stripe-js').then(module => {
      setElements(() => module.Elements);
    });
  }, []);

  if (!stripe || !Elements) {
    return <div className="animate-pulse">Cargando procesador de pagos...</div>;
  }

  return (
    <Elements stripe={stripe}>
      {children}
    </Elements>
  );
}