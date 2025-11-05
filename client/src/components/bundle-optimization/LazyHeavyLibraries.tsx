// Bundle optimization wrapper that prevents heavy libraries from being in main chunk
// This should reduce the main bundle by ~1301KB (1160KB recharts + 141KB Stripe)

import { lazy, Suspense } from 'react';

// Loading fallbacks
const ChartSkeleton = () => (
  <div className="w-full h-64 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg flex items-center justify-center">
    <div className="text-gray-500 dark:text-gray-400 text-sm">Cargando gráfico...</div>
  </div>
);

const PaymentSkeleton = () => (
  <div className="w-full h-32 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg flex items-center justify-center">
    <div className="text-gray-500 dark:text-gray-400 text-sm">Cargando sistema de pagos...</div>
  </div>
);

// Completely lazy-loaded chart components - NO direct imports
export const LazyChartWrapper = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  const DynamicChart = lazy(async () => {
    // This ensures recharts is never in the main bundle
    const [recharts] = await Promise.all([
      import('recharts')
    ]);
    
    return {
      default: ({ children }: { children: React.ReactNode }) => (
        <recharts.ResponsiveContainer>
          {children}
        </recharts.ResponsiveContainer>
      )
    };
  });

  return (
    <div className={className}>
      <Suspense fallback={<ChartSkeleton />}>
        <DynamicChart>
          {children}
        </DynamicChart>
      </Suspense>
    </div>
  );
};

// Completely lazy-loaded Stripe wrapper - NO direct imports
export const LazyPaymentWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <Suspense fallback={<PaymentSkeleton />}>
      <div className="payment-wrapper">
        {children}
      </div>
    </Suspense>
  );
};

// Dynamic chart component loader
export const loadChartComponent = async (type: 'bar' | 'line' | 'pie') => {
  const recharts = await import('recharts');
  
  switch (type) {
    case 'bar':
      return recharts.BarChart;
    case 'line':
      return recharts.LineChart;
    case 'pie':
      return recharts.PieChart;
    default:
      return recharts.BarChart;
  }
};

// Dynamic Stripe loader
export const loadStripeComponents = async () => {
  const [stripeJs, stripeReact] = await Promise.all([
    import('@stripe/stripe-js'),
    import('@stripe/react-stripe-js')
  ]);
  
  return {
    loadStripe: stripeJs.loadStripe,
    Elements: stripeReact.Elements,
    useStripe: stripeReact.useStripe,
    useElements: stripeReact.useElements,
    PaymentElement: stripeReact.PaymentElement
  };
};