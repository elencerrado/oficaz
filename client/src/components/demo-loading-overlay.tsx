import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowRight } from 'lucide-react';
import oficazLogo from '@/assets/oficaz-logo.png';

interface DemoLoadingOverlayProps {
  isVisible: boolean;
  isBackendComplete?: boolean;
  onComplete?: () => void;
  companyName?: string;
}

const loadingMessages = [
  "Preparando tu espacio de trabajo...",
  "Configurando todo a tu medida...",
  "Casi listo, unos retoques más...",
  "¡Ya está! Dando los últimos detalles..."
];

export function DemoLoadingOverlay({ isVisible, isBackendComplete = false, onComplete, companyName }: DemoLoadingOverlayProps) {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const [showWelcome, setShowWelcome] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);

  useEffect(() => {
    if (!isVisible) {
      setProgress(0);
      setMessageIndex(0);
      setShowWelcome(false);
      setFadeIn(false);
      return;
    }

    let animationFrameId: number;
    const startTime = Date.now();
    const targetProgress = 85;
    const totalDuration = 2500;

    const animateProgress = () => {
      const elapsed = Date.now() - startTime;
      const ratio = elapsed / totalDuration;
      const easeOut = 1 - Math.pow(1 - Math.min(ratio, 1), 3);
      const calculatedProgress = Math.min(easeOut * targetProgress, targetProgress);
      
      setProgress(calculatedProgress);

      const newMessageIndex = Math.min(
        Math.floor((calculatedProgress / targetProgress) * loadingMessages.length),
        loadingMessages.length - 1
      );
      setMessageIndex(newMessageIndex);

      if (calculatedProgress < targetProgress) {
        animationFrameId = requestAnimationFrame(animateProgress);
      }
    };

    animationFrameId = requestAnimationFrame(animateProgress);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible || !isBackendComplete) return;

    const startProgress = progress;
    const remainingProgress = 100 - startProgress;
    const completionDuration = 400;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const ratio = Math.min(elapsed / completionDuration, 1);
      const easeOut = 1 - Math.pow(1 - ratio, 2);
      const currentProgress = startProgress + (remainingProgress * easeOut);
      
      setProgress(currentProgress);

      if (ratio < 1) {
        requestAnimationFrame(animate);
      } else {
        setTimeout(() => {
          setShowWelcome(true);
          setTimeout(() => setFadeIn(true), 50);
        }, 300);
      }
    };

    requestAnimationFrame(animate);
  }, [isBackendComplete, isVisible, progress]);

  if (!isVisible) return null;

  if (showWelcome) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
        <div className={`text-center px-6 max-w-lg transition-all duration-700 ${fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="mb-8">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-oficaz-primary to-blue-600 rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-oficaz-primary/30">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              ¡Bienvenido a Oficaz!
            </h1>
            
            <p className="text-xl text-gray-600 mb-2">
              {companyName ? `${companyName} ya está listo.` : 'Tu espacio está listo.'}
            </p>
            
            <p className="text-gray-500">
              A partir de ahora, gestionar tu equipo será pan comido.
            </p>
          </div>

          <div className="space-y-4 mb-8">
            <div className="flex items-center gap-3 text-left bg-gray-50 rounded-2xl p-4">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <span className="font-medium text-gray-900 block">7 días de prueba activados</span>
                <span className="text-sm text-gray-500">Explora todo sin límites ni compromisos</span>
              </div>
            </div>
          </div>

          <Button 
            onClick={onComplete}
            className="h-14 px-8 rounded-2xl text-lg font-medium bg-gray-900 hover:bg-gray-800 text-white shadow-lg shadow-gray-900/20 transition-all hover:scale-105"
          >
            Comenzar a explorar
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>

          <p className="text-sm text-gray-400 mt-6">
            Esto va a ser el comienzo de algo grande.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center">
      <div className="flex flex-col items-center">
        <div className="mb-10">
          <img 
            src={oficazLogo} 
            alt="Oficaz" 
            className="h-10 w-auto"
          />
        </div>

        <div className="mb-8 relative">
          <div className="w-12 h-12 relative">
            <svg 
              className="w-12 h-12 animate-spin" 
              viewBox="0 0 50 50"
              style={{ animationDuration: '1s' }}
            >
              <circle
                cx="25"
                cy="25"
                r="20"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="4"
              />
              <circle
                cx="25"
                cy="25"
                r="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="80, 200"
                className="text-oficaz-primary"
              />
            </svg>
          </div>
        </div>

        <p className="text-gray-600 mb-8 min-h-[1.5rem] transition-opacity duration-300 text-center">
          {loadingMessages[messageIndex]}
        </p>

        <div className="w-64">
          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-oficaz-primary rounded-full transition-all duration-100 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
