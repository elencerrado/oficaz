import { lazy, Suspense } from 'react';
import { PageLoading } from '@/components/ui/page-loading';

// Lazy load Stripe components to reduce initial bundle size
// For now, simple wrapper without complex Stripe loading
// const StripePaymentForm = lazy(() => import('./StripePaymentForm'));

interface StripeProviderProps {
  children?: React.ReactNode;
  enabled?: boolean;
}

export function StripeProvider({ children, enabled = false }: StripeProviderProps) {
  // Only load Stripe when actually needed
  if (!enabled) {
    return <>{children}</>;
  }
  
  return (
    <div>
      {children}
    </div>
  );
}

export default StripeProvider;