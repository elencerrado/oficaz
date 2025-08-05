import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { useState, useEffect } from 'react';

// Initialize Stripe lazily
let stripePromise: Promise<any> | null = null;

const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');
  }
  return stripePromise;
};

interface StripePaymentFormProps {
  children: React.ReactNode;
}

export default function StripePaymentForm({ children }: StripePaymentFormProps) {
  const [stripe, setStripe] = useState<any>(null);

  useEffect(() => {
    // Load Stripe asynchronously after component mounts
    getStripe().then(setStripe);
  }, []);

  if (!stripe) {
    return <div className="animate-pulse">Cargando procesador de pagos...</div>;
  }

  return (
    <Elements stripe={stripe}>
      {children}
    </Elements>
  );
}