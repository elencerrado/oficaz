import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

interface DemoDataStatus {
  hasDemoData: boolean;
}

export function GlobalDemoBanner() {
  const [hasDemoData, setHasDemoData] = useState<boolean>(false);
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const { isAuthenticated } = useAuth();

  // Check demo data status
  useEffect(() => {
    if (!isAuthenticated) return;

    const checkDemoData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const response = await fetch('/api/demo-data/status', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data: DemoDataStatus = await response.json();
          setHasDemoData(data.hasDemoData);
          setIsVisible(data.hasDemoData);
        }
      } catch (error) {
        console.error('Error checking demo data:', error);
      }
    };

    checkDemoData();
  }, [isAuthenticated]);

  const handleDeleteDemoData = async () => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar todos los datos de demostración? Esta acción no se puede deshacer.')) {
      return;
    }

    setIsDeleting(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('/api/demo-data', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setIsVisible(false);
        setHasDemoData(false);
        // Refresh the page to update all data
        window.location.reload();
      } else {
        alert('Error al eliminar los datos de demostración');
      }
    } catch (error) {
      console.error('Error deleting demo data:', error);
      alert('Error al eliminar los datos de demostración');
    } finally {
      setIsDeleting(false);
    }
  };

  // Don't show banner if user is not authenticated or has no demo data
  if (!isAuthenticated || !isVisible || !hasDemoData) {
    return null;
  }

  return (
    <div className="bg-blue-600 text-white py-2 px-4 relative z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-bold">D</span>
          </div>
          <div>
            <span className="font-medium">Datos de demostración activos</span>
            <span className="ml-2 text-blue-100">
              Esta cuenta incluye empleados y datos de ejemplo para explorar las funcionalidades
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleDeleteDemoData}
            disabled={isDeleting}
            className="flex items-center space-x-1 bg-blue-700 hover:bg-blue-800 px-3 py-1 rounded text-sm transition-colors disabled:opacity-50"
          >
            <Trash2 size={14} />
            <span>{isDeleting ? 'Eliminando...' : 'Borrar datos demo'}</span>
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="text-blue-200 hover:text-white transition-colors"
          >
            <span className="text-lg">&times;</span>
          </button>
        </div>
      </div>
    </div>
  );
}