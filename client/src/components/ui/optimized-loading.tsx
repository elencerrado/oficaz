// Optimized loading components to improve perceived performance
// during lazy loading of heavy components

export function ChartLoading() {
  return (
    <div className="w-full space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse"></div>
      </div>
      <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse flex items-center justify-center">
        <div className="text-gray-400 dark:text-gray-500 text-sm">Cargando gráfico...</div>
      </div>
    </div>
  );
}

export function DashboardLoading() {
  return (
    <div className="px-6 py-4 min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="space-y-2">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-72 animate-pulse"></div>
        </div>
        
        {/* Stats cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                </div>
                <div className="h-12 w-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Chart skeleton */}
        <ChartLoading />
      </div>
    </div>
  );
}

export function FormLoading() {
  return (
    <div className="space-y-4 p-6">
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse"></div>
        <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded animate-pulse"></div>
      </div>
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse"></div>
        <div className="h-24 bg-gray-100 dark:bg-gray-800 rounded animate-pulse"></div>
      </div>
      <div className="flex gap-2 pt-4">
        <div className="h-10 bg-blue-200 dark:bg-blue-900 rounded w-24 animate-pulse"></div>
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-20 animate-pulse"></div>
      </div>
    </div>
  );
}

export function SettingsLoading() {
  return (
    <div className="px-6 py-4 min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-40 animate-pulse"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-64 animate-pulse"></div>
        </div>
        
        {/* Settings sections */}
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
              <div className="space-y-4">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                </div>
                <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded w-full"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TableLoading() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse"></div>
        <div className="h-10 bg-blue-200 dark:bg-blue-900 rounded w-28 animate-pulse"></div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Table header */}
        <div className="bg-gray-50 dark:bg-gray-900 px-6 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-4 bg-gray-200 dark:bg-gray-700 rounded flex-1 animate-pulse"></div>
            ))}
          </div>
        </div>
        
        {/* Table rows */}
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex gap-4">
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="h-4 bg-gray-100 dark:bg-gray-800 rounded flex-1 animate-pulse"></div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}