import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, Trash2, Loader2, Plus } from 'lucide-react';
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

  // Mutation to generate demo data
  const generateDemoDataMutation = useMutation({
    mutationFn: () => fetch('/api/demo-data/generate', { 
      method: 'POST',
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

  const handleClearDemoData = () => {
    if (confirm('¿Estás seguro de que quieres eliminar todos los datos de prueba? Esta acción no se puede deshacer.')) {
      clearDemoDataMutation.mutate();
    }
  };

  const handleGenerateDemoData = () => {
    if (confirm('¿Quieres generar datos de demostración dinámicos para probar las funcionalidades? Esto creará empleados, fichajes, mensajes y otros datos de ejemplo.')) {
      generateDemoDataMutation.mutate();
    }
  };

  // Don't show banner if loading
  if (isLoading) {
    return null;
  }

  const hasDemoData = (demoStatus as any)?.hasDemoData;

  // Show demo data banner if company has demo data
  if (hasDemoData) {
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

  // Show generate banner if company doesn't have demo data
  return (
    <div className={`${className}`}>
      <Alert className="bg-green-50 border-green-200 mb-6">
        <Plus className="h-4 w-4 text-green-600" />
        <AlertDescription className="flex items-center justify-between">
          <div className="text-green-800">
            <strong>¿Quieres probar las funcionalidades?</strong> Genera datos de demostración dinámicos para explorar el sistema con empleados, fichajes, mensajes y vacaciones de ejemplo. 
            Los datos se ajustarán automáticamente a la fecha actual.
          </div>
          <Button
            onClick={handleGenerateDemoData}
            disabled={generateDemoDataMutation.isPending}
            variant="outline"
            size="sm"
            className="ml-4 border-green-300 text-green-700 hover:bg-green-100 flex-shrink-0"
          >
            {generateDemoDataMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Generar datos de prueba
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}