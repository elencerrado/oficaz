import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trash2, Users } from 'lucide-react';

interface DemoDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DemoDeleteDialog({ isOpen, onClose }: DemoDeleteDialogProps) {
  const queryClient = useQueryClient();
  
  const deleteDemoDataMutation = useMutation({
    mutationFn: () => fetch('/api/demo-data/clear', { 
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    }).then(res => res.json()),
    onSuccess: () => {
      // Invalidate all queries to refresh the data
      queryClient.invalidateQueries();
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
          <DialogTitle className="text-lg font-semibold text-gray-900">
            Borrar datos demo
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-orange-600" />
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-700 mb-2">
                ¿Estás seguro de que quieres eliminar todos los datos de demostración?
              </p>
              <p className="text-xs text-gray-500">
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
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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