import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

interface DemoDataStatus {
  hasDemoData: boolean;
}

export function GlobalDemoBanner() {
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  // Query to check demo data status
  const { data: demoStatus, isLoading } = useQuery<DemoDataStatus>({
    queryKey: ['/api/demo-data/status'],
    enabled: isAuthenticated && user?.role === 'admin',
    staleTime: 30000, // Cache for 30 seconds
    refetchOnWindowFocus: false,
  });

  // Mutation to delete demo data
  const deleteDemoDataMutation = useMutation({
    mutationFn: () => apiRequest('/api/demo-data', { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/demo-data/status'] });
      setIsDeleting(false);
    },
    onError: (error) => {
      console.error('Error deleting demo data:', error);
      setIsDeleting(false);
    }
  });

  const handleDeleteDemoData = () => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar todos los datos de demostración? Esta acción no se puede deshacer.')) {
      return;
    }
    setIsDeleting(true);
    deleteDemoDataMutation.mutate();
  };

  // Don't show banner if user is not authenticated or has no demo data
  if (!isAuthenticated || user?.role !== 'admin' || !demoStatus?.hasDemoData) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200 px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-gray-700 font-medium">
            Datos de demostración activos
          </span>
        </div>
        
        <Button
          size="sm"
          variant="outline"
          onClick={handleDeleteDemoData}
          disabled={isDeleting}
          className="text-xs border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
        >
          <Trash2 size={12} className="mr-1" />
          {isDeleting ? 'Eliminando...' : 'Eliminar'}
        </Button>
      </div>
    </div>
  );
}