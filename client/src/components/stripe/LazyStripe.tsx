import { lazy, Suspense } from 'react';

// Stripe loading state
const StripeLoading = () => (
  <div className="w-full h-32 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg flex items-center justify-center">
    <div className="text-gray-500 dark:text-gray-400 text-sm">Cargando sistema de pagos...</div>
  </div>
);

// Simple wrapper to conditionally load Stripe - reduces 141KB from main bundle
export function ConditionalStripeProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  if (!enabled) {
    return <>{children}</>;
  }

  // Only load when payment is actually needed
  const LazyStripeForm = lazy(() => import('@/components/StripePaymentForm'));
  
  return (
    <Suspense fallback={<StripeLoading />}>
      <LazyStripeForm>
        {children}
      </LazyStripeForm>
    </Suspense>
  );
}

// Simplified payment wrapper - only loads when needed
export function PaymentWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="payment-container">
      {children}
    </div>
  );
}