import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, Users, Clock, Palmtree, Calendar, Star, Sparkles } from 'lucide-react';
import oficazFavicon from '@assets/favicon oficaz_1757056517547.png';
import { useEffect } from 'react';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyName: string;
  trialDays?: number;
}

export function WelcomeModal({ isOpen, onClose, companyName, trialDays = 7 }: WelcomeModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.setAttribute('data-welcome-modal-open', 'true');
    } else {
      document.body.removeAttribute('data-welcome-modal-open');
    }
    return () => {
      document.body.removeAttribute('data-welcome-modal-open');
    };
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border-0 dark:border dark:border-gray-700 z-[9999]">
        <DialogHeader>
          <DialogTitle className="sr-only">Bienvenida a Oficaz</DialogTitle>
        </DialogHeader>
        
        <div className="py-6 px-5">
          {/* Logo - Favicon de Oficaz */}
          <div className="flex justify-center mb-5">
            <img 
              src={oficazFavicon} 
              alt="Oficaz" 
              className="h-16 w-16"
            />
          </div>
          
          <h2 className="text-2xl font-bold text-center mb-2 text-gray-900 dark:text-gray-100">
            ¡Bienvenido a Oficaz!
          </h2>
          
          <p className="text-center text-gray-600 dark:text-gray-400 text-sm mb-5">
            <span className="font-semibold text-oficaz-primary dark:text-blue-400">{companyName}</span> está listo para empezar
          </p>

          {/* Trial info - prominent */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-5">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Star className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span className="font-bold text-green-800 dark:text-green-300 text-lg">
                {trialDays} días de prueba GRATIS
              </span>
            </div>
            <p className="text-sm text-green-700 dark:text-green-400 text-center">
              Acceso completo a todas las funcionalidades. Sin tarjeta de crédito.
            </p>
          </div>

          {/* Plan Oficaz features */}
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 mb-5">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-center mb-3 text-sm flex items-center justify-center gap-2">
              <Sparkles className="h-4 w-4 text-oficaz-primary" />
              Tu Plan Oficaz incluye
            </h3>
            
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0">
                  <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-gray-700 dark:text-gray-300">Control de fichajes</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0">
                  <Palmtree className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-gray-700 dark:text-gray-300">Gestión de vacaciones</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0">
                  <Calendar className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-gray-700 dark:text-gray-300">Cuadrante de horarios</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0">
                  <Users className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-gray-700 dark:text-gray-300">Gestión de empleados</span>
              </div>
            </div>
          </div>

          {/* Demo data note */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-5">
            <p className="text-xs text-amber-800 dark:text-amber-300 text-center">
              <span className="font-medium">Datos de demostración listos:</span> Hemos añadido empleados y fichajes de ejemplo para que explores el sistema. Podrás eliminarlos cuando quieras.
            </p>
          </div>

          {/* Motivational message */}
          <p className="text-center text-gray-500 dark:text-gray-400 text-xs mb-5 italic">
            Menudo chollazo por todo el tiempo que vas a ahorrar. ¡Disfruta!
          </p>

          {/* Action button */}
          <div className="flex justify-center">
            <Button 
              onClick={onClose}
              className="px-8 py-3 bg-oficaz-primary hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-xl font-semibold shadow-lg transition-all duration-200 hover:shadow-xl text-base"
            >
              Empezar a explorar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
