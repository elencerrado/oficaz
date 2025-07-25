import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { DemoDeleteDialog } from '@/components/demo-delete-dialog';

interface DemoDataStatus {
  hasDemoData: boolean;
}

export function GlobalDemoBanner() {
  const [showDeleteDialog, setShowDeleteDialog] = useState<boolean>(false);
  const { user, isAuthenticated } = useAuth();

  // Query to check demo data status
  const { data: demoStatus, isLoading } = useQuery<DemoDataStatus>({
    queryKey: ['/api/demo-data/status'],
    enabled: isAuthenticated && user?.role === 'admin',
    staleTime: 30000, // Cache for 30 seconds
    refetchOnWindowFocus: false,
  });

  const handleOpenDeleteDialog = () => {
    setShowDeleteDialog(true);
  };

  const handleCloseDeleteDialog = () => {
    setShowDeleteDialog(false);
  };

  // Don't show banner if user is not authenticated or has no demo data
  if (!isAuthenticated || user?.role !== 'admin' || !demoStatus?.hasDemoData) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-200 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-bold">✓</span>
          </div>
          <div>
            <p className="text-sm text-gray-700 font-medium">
              Te hemos añadido algunos datos de demostración para que curiosees cómo funciona la app
            </p>
          </div>
        </div>
        
        <Button
          size="sm"
          variant="outline"
          onClick={handleOpenDeleteDialog}
          className="text-xs border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
        >
          Borrar datos demo
        </Button>
      </div>
      
      <DemoDeleteDialog 
        isOpen={showDeleteDialog} 
        onClose={handleCloseDeleteDialog} 
      />
    </div>
  );
}