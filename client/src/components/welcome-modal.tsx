import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, Users, Calendar, MessageSquare, FileText } from 'lucide-react';
import oficazLogo from '@assets/oficaz logo_1750516757063.png';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyName: string;
}

export function WelcomeModal({ isOpen, onClose, companyName }: WelcomeModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border-0 dark:border dark:border-gray-700">
        <DialogHeader>
          <DialogTitle className="sr-only">Bienvenida a Oficaz</DialogTitle>
        </DialogHeader>
        
        <div className="py-6 px-5">
          {/* Logo */}
          <div className="flex justify-center mb-5">
            <img 
              src={oficazLogo} 
              alt="Oficaz" 
              className="h-8 w-auto dark:brightness-0 dark:invert"
            />
          </div>
          
          <h2 className="text-xl font-bold text-center mb-2 text-gray-900 dark:text-gray-100">Te damos la bienvenida a Oficaz</h2>
          
          <p className="text-center text-gray-600 dark:text-gray-400 text-sm mb-5">
            Tu empresa <span className="font-medium text-oficaz-primary dark:text-blue-400">{companyName}</span> ha sido creada con éxito
          </p>

          {/* Trial info */}
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-center mb-1">
              <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400 mr-2" />
              <span className="font-semibold text-green-800 dark:text-green-300 text-sm">14 días de prueba gratuitos</span>
            </div>
            <p className="text-xs text-green-700 dark:text-green-400 text-center">
              Disfruta de todas las funcionalidades premium sin costo
            </p>
          </div>

          {/* Demo data section */}
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 mb-5">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-center mb-3 text-sm">
              Hemos preparado datos de demostración
            </h3>
            
            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
              <div className="flex items-center space-x-2">
                <Users className="h-3.5 w-3.5 text-oficaz-primary dark:text-blue-400 flex-shrink-0" />
                <span className="text-gray-700 dark:text-gray-300">4 empleados demo</span>
              </div>
              <div className="flex items-center space-x-2">
                <Calendar className="h-3.5 w-3.5 text-oficaz-primary dark:text-blue-400 flex-shrink-0" />
                <span className="text-gray-700 dark:text-gray-300">Fichajes de ejemplo</span>
              </div>
              <div className="flex items-center space-x-2">
                <MessageSquare className="h-3.5 w-3.5 text-oficaz-primary dark:text-blue-400 flex-shrink-0" />
                <span className="text-gray-700 dark:text-gray-300">Mensajes internos</span>
              </div>
              <div className="flex items-center space-x-2">
                <FileText className="h-3.5 w-3.5 text-oficaz-primary dark:text-blue-400 flex-shrink-0" />
                <span className="text-gray-700 dark:text-gray-300">Solicitudes de vacaciones</span>
              </div>
            </div>
            
            <p className="text-xs text-gray-600 dark:text-gray-400 text-center italic">
              Podrás eliminar estos datos cuando empieces a usar el sistema con tu equipo real
            </p>
          </div>

          {/* Action button */}
          <div className="flex justify-center">
            <Button 
              onClick={onClose}
              className="px-6 py-2.5 bg-oficaz-primary hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-lg font-medium shadow-md transition-all duration-200 hover:shadow-lg"
            >
              Comenzar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}