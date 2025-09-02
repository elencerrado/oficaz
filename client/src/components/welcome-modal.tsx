import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, Users, Calendar, MessageSquare, FileText, Sparkles } from 'lucide-react';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyName: string;
}

export function WelcomeModal({ isOpen, onClose, companyName }: WelcomeModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      icon: <Sparkles className="h-12 w-12 text-oficaz-primary mx-auto mb-4" />,
      title: `¡Bienvenido a Oficaz, ${companyName}! 🎉`,
      content: (
        <div className="text-center space-y-4">
          <p className="text-gray-600">
            Tu empresa ha sido creada exitosamente y estás listo para comenzar a optimizar la gestión de tu equipo.
          </p>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-center mb-2">
              <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
              <span className="font-medium text-green-800">14 días de prueba gratuitos activados</span>
            </div>
            <p className="text-sm text-green-700">
              Disfruta de todas las funcionalidades premium sin costo alguno.
            </p>
          </div>
        </div>
      )
    },
    {
      icon: <Users className="h-12 w-12 text-blue-500 mx-auto mb-4" />,
      title: "Hemos preparado datos de demostración",
      content: (
        <div className="space-y-4">
          <p className="text-gray-600 text-center">
            Para que puedas explorar todas las funcionalidades, hemos añadido contenido de ejemplo:
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-blue-500" />
              <span>4 empleados demo</span>
            </div>
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-green-500" />
              <span>Fichajes de ejemplo</span>
            </div>
            <div className="flex items-center space-x-2">
              <MessageSquare className="h-4 w-4 text-purple-500" />
              <span>Mensajes internos</span>
            </div>
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4 text-orange-500" />
              <span>Solicitudes de vacaciones</span>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-700 text-center">
              💡 Puedes eliminar estos datos cuando empieces a usar el sistema con tu equipo real.
            </p>
          </div>
        </div>
      )
    }
  ];

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const currentStepData = steps[currentStep];

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="sr-only">Bienvenida a Oficaz</DialogTitle>
        </DialogHeader>
        
        <div className="py-6 px-2">
          {currentStepData.icon}
          
          <h2 className="text-xl font-bold text-center mb-4 text-gray-900">
            {currentStepData.title}
          </h2>
          
          <div className="mb-6">
            {currentStepData.content}
          </div>

          {/* Progress indicators */}
          <div className="flex justify-center space-x-2 mb-6">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentStep ? 'bg-oficaz-primary' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>

          <div className="flex justify-center">
            <Button 
              onClick={handleNext}
              className="px-8 py-2 bg-oficaz-primary hover:bg-blue-600 text-white rounded-lg font-medium"
            >
              {currentStep < steps.length - 1 ? 'Continuar' : 'Comenzar'}
              {currentStep === steps.length - 1 && <Sparkles className="h-4 w-4 ml-2" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}