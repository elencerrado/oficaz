import { lazy, Suspense } from 'react';

// Lazy load charts only when needed to reduce main bundle by ~1MB
const ChartContainer = lazy(() => import('@/components/ui/chart').then(module => ({ default: module.ChartContainer })));
const BarChart = lazy(() => import('recharts').then(module => ({ default: module.BarChart })));
const LineChart = lazy(() => import('recharts').then(module => ({ default: module.LineChart })));
const PieChart = lazy(() => import('recharts').then(module => ({ default: module.PieChart })));
const Bar = lazy(() => import('recharts').then(module => ({ default: module.Bar })));
const Line = lazy(() => import('recharts').then(module => ({ default: module.Line })));
const Pie = lazy(() => import('recharts').then(module => ({ default: module.Pie })));
const XAxis = lazy(() => import('recharts').then(module => ({ default: module.XAxis })));
const YAxis = lazy(() => import('recharts').then(module => ({ default: module.YAxis })));
const CartesianGrid = lazy(() => import('recharts').then(module => ({ default: module.CartesianGrid })));
const Tooltip = lazy(() => import('recharts').then(module => ({ default: module.Tooltip })));
const ResponsiveContainer = lazy(() => import('recharts').then(module => ({ default: module.ResponsiveContainer })));

interface LazyChartProps {
  children: React.ReactNode;
  config?: any;
  className?: string;
}

// Loading fallback specifically for charts
const ChartSkeleton = () => (
  <div className="w-full h-[300px] bg-gray-100 animate-pulse rounded-lg flex items-center justify-center">
    <div className="text-gray-500 text-sm">Cargando gráfico...</div>
  </div>
);

export function LazyChartContainer({ children, config, className }: LazyChartProps) {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <ChartContainer config={config} className={className}>
        {children}
      </ChartContainer>
    </Suspense>
  );
}

export function LazyBarChart({ children, ...props }: any) {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <BarChart {...props}>
        {children}
      </BarChart>
    </Suspense>
  );
}

export function LazyLineChart({ children, ...props }: any) {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <LineChart {...props}>
        {children}
      </LineChart>
    </Suspense>
  );
}

export function LazyPieChart({ children, ...props }: any) {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <PieChart {...props}>
        {children}
      </PieChart>
    </Suspense>
  );
}

// Export chart elements with lazy loading
export const LazyBar = ({ ...props }: any) => (
  <Suspense fallback={null}>
    <Bar {...props} />
  </Suspense>
);

export const LazyLine = ({ ...props }: any) => (
  <Suspense fallback={null}>
    <Line {...props} />
  </Suspense>
);

export const LazyPie = ({ ...props }: any) => (
  <Suspense fallback={null}>
    <Pie {...props} />
  </Suspense>
);

export const LazyXAxis = ({ ...props }: any) => (
  <Suspense fallback={null}>
    <XAxis {...props} />
  </Suspense>
);

export const LazyYAxis = ({ ...props }: any) => (
  <Suspense fallback={null}>
    <YAxis {...props} />
  </Suspense>
);

export const LazyCartesianGrid = ({ ...props }: any) => (
  <Suspense fallback={null}>
    <CartesianGrid {...props} />
  </Suspense>
);

export const LazyTooltip = ({ ...props }: any) => (
  <Suspense fallback={null}>
    <Tooltip {...props} />
  </Suspense>
);

export const LazyResponsiveContainer = ({ children, ...props }: any) => (
  <Suspense fallback={<ChartSkeleton />}>
    <ResponsiveContainer {...props}>
      {children}
    </ResponsiveContainer>
  </Suspense>
);