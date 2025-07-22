import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, Trash2, Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface DemoDataBannerProps {
  className?: string;
}

export function DemoDataBanner({ className = '' }: DemoDataBannerProps) {
  const queryClient = useQueryClient();

  // Query to check if company has demo data
  const { data: demoStatus, isLoading } = useQuery({
    queryKey: ['/api/demo-data/status'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Mutation to clear demo data
  const clearDemoDataMutation = useMutation({
    mutationFn: () => fetch('/api/demo-data/clear', { 
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    }).then(res => res.json()),
    onSuccess: () => {
      // Invalidate queries to refresh the dashboard
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions/company'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vacation-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reminders/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/demo-data/status'] });
    },
  });

  // Don't show banner if loading or no demo data
  if (isLoading || !(demoStatus as any)?.hasDemoData) {
    return null;
  }

  const handleClearDemoData = () => {
    if (confirm('¿Estás seguro de que quieres eliminar todos los datos de prueba? Esta acción no se puede deshacer.')) {
      clearDemoDataMutation.mutate();
    }
  };

  return (
    <div className={`${className}`}>
      <Alert className="bg-blue-50 border-blue-200 mb-6">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="flex items-center justify-between">
          <div className="text-blue-800">
            <strong>Datos de demostración activos:</strong> Tu empresa incluye empleados y datos de ejemplo para que puedas probar todas las funcionalidades. 
            Puedes eliminarlos cuando estés listo para empezar con datos reales.
          </div>
          <Button
            onClick={handleClearDemoData}
            disabled={clearDemoDataMutation.isPending}
            variant="outline"
            size="sm"
            className="ml-4 border-blue-300 text-blue-700 hover:bg-blue-100 flex-shrink-0"
          >
            {clearDemoDataMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            Limpiar datos de prueba
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}