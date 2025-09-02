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
      <DialogContent className="sm:max-w-lg bg-white border-0 shadow-xl">
        <DialogHeader>
          <DialogTitle className="sr-only">Bienvenida a Oficaz</DialogTitle>
        </DialogHeader>
        
        <div className="py-8 px-6">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img 
              src={oficazLogo} 
              alt="Oficaz" 
              className="h-12 w-auto dark:brightness-0 dark:invert"
            />
          </div>
          
          <h2 className="text-2xl font-bold text-center mb-2 text-gray-900">
            Te damos la bienvenida a Oficaz
          </h2>
          
          <p className="text-center text-gray-600 mb-6">
            Tu empresa <span className="font-medium text-oficaz-primary">{companyName}</span> ha sido creada exitosamente
          </p>

          {/* Trial info */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-center mb-2">
              <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
              <span className="font-semibold text-green-800">14 días de prueba gratuitos</span>
            </div>
            <p className="text-sm text-green-700 text-center">
              Disfruta de todas las funcionalidades premium sin costo
            </p>
          </div>

          {/* Demo data section */}
          <div className="bg-gray-50 rounded-xl p-5 mb-6">
            <h3 className="font-semibold text-gray-900 text-center mb-4">
              Hemos preparado datos de demostración
            </h3>
            
            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              <div className="flex items-center space-x-3">
                <Users className="h-4 w-4 text-oficaz-primary flex-shrink-0" />
                <span className="text-gray-700">4 empleados demo</span>
              </div>
              <div className="flex items-center space-x-3">
                <Calendar className="h-4 w-4 text-oficaz-primary flex-shrink-0" />
                <span className="text-gray-700">Fichajes de ejemplo</span>
              </div>
              <div className="flex items-center space-x-3">
                <MessageSquare className="h-4 w-4 text-oficaz-primary flex-shrink-0" />
                <span className="text-gray-700">Mensajes internos</span>
              </div>
              <div className="flex items-center space-x-3">
                <FileText className="h-4 w-4 text-oficaz-primary flex-shrink-0" />
                <span className="text-gray-700">Solicitudes de vacaciones</span>
              </div>
            </div>
            
            <p className="text-xs text-gray-600 text-center italic">
              Podrás eliminar estos datos cuando empieces a usar el sistema con tu equipo real
            </p>
          </div>

          {/* Action button */}
          <div className="flex justify-center">
            <Button 
              onClick={onClose}
              className="px-8 py-3 bg-oficaz-primary hover:bg-blue-600 text-white rounded-xl font-medium text-base shadow-lg transition-all duration-200 hover:shadow-xl"
            >
              Comenzar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}