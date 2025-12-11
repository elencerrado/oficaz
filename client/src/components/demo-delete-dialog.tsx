import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trash2, Users } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface DemoDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DemoDeleteDialog({ isOpen, onClose }: DemoDeleteDialogProps) {
  const queryClient = useQueryClient();
  
  const deleteDemoDataMutation = useMutation({
    mutationFn: () => apiRequest('DELETE', '/api/demo-data/clear'),
    onSuccess: () => {
      // Invalidate ALL relevant queries to refresh the data and hide banner
      queryClient.invalidateQueries({ queryKey: ['/api/demo-data/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      queryClient.invalidateQueries({ queryKey: ['/api/company/employees'] });
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions/company'] });
      queryClient.invalidateQueries({ queryKey: ['/api/work-shifts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vacation-requests/company'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reminders/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/document-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      onClose();
    },
    onError: (error) => {
      console.error('Error deleting demo data:', error);
    }
  });

  const handleDelete = () => {
    deleteDemoDataMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            Borrar datos demo
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm text-foreground mb-2">
                ¿Estás seguro de que quieres eliminar todos los datos de demostración?
              </p>
              <p className="text-xs text-muted-foreground">
                Se eliminarán empleados, fichajes, mensajes y solicitudes de ejemplo.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="w-full"
              disabled={deleteDemoDataMutation.isPending}
            >
              <Users className="mr-2 h-4 w-4" />
              Continuar con demo
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleteDemoDataMutation.isPending}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteDemoDataMutation.isPending ? (
                <>
                  <LoadingSpinner size="xs" className="mr-2" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Borrar demo
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}