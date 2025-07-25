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

  console.log('🟢 GlobalDemoBanner ALWAYS RENDERS - isAuthenticated:', isAuthenticated, 'user role:', user?.role, 'timestamp:', Date.now());

  // Query to check demo data status
  const { data: demoStatus, isLoading } = useQuery<DemoDataStatus>({
    queryKey: ['/api/demo-data/status'],
    enabled: isAuthenticated && user?.role === 'admin',
    staleTime: 30000, // Cache for 30 seconds
    refetchOnWindowFocus: false,
  });

  console.log('🔧 Demo data query - enabled:', isAuthenticated && user?.role === 'admin', 'data:', demoStatus, 'loading:', isLoading);
  console.log('🔧 GlobalDemoBanner debug - isAuthenticated:', isAuthenticated, 'user:', user, 'demoStatus:', demoStatus);

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
  console.log('🔧 Render check - isAuthenticated:', isAuthenticated, 'hasDemoData:', demoStatus?.hasDemoData, 'user role:', user?.role);
  
  if (!isAuthenticated || user?.role !== 'admin' || !demoStatus?.hasDemoData) {
    console.log('🔧 Banner not showing - conditions not met');
    return null;
  }
  
  console.log('🔧 Banner SHOULD BE VISIBLE!');

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        backgroundColor: '#2563eb',
        color: 'white',
        padding: '12px 16px',
        fontSize: '14px',
        fontWeight: '500',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}
    >
      <span>
        🗂️ Estás utilizando datos de demostración. 
      </span>
      <Button
        size="sm"
        variant="destructive"
        onClick={handleDeleteDemoData}
        disabled={isDeleting}
        style={{
          backgroundColor: '#dc2626',
          color: 'white',
          border: 'none',
          padding: '4px 8px',
          fontSize: '12px'
        }}
      >
        <Trash2 size={12} className="mr-1" />
        {isDeleting ? 'Eliminando...' : 'Eliminar datos demo'}
      </Button>
    </div>
  );
}