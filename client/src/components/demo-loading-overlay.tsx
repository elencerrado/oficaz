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
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [loadingFadeIn, setLoadingFadeIn] = useState(false);
  const [exitTransition, setExitTransition] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setOverlayVisible(true);
      setTimeout(() => setLoadingFadeIn(true), 50);
    } else {
      setOverlayVisible(false);
      setLoadingFadeIn(false);
      setProgress(0);
      setMessageIndex(0);
      setShowWelcome(false);
      setFadeIn(false);
      setExitTransition(false);
    }
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible || !overlayVisible) return;

    let animationFrameId: number;
    const startTime = Date.now();
    const targetProgress = 80;
    const totalDuration = 4500; // Slower loader for better UX

    const animateProgress = () => {
      const elapsed = Date.now() - startTime;
      const ratio = elapsed / totalDuration;
      // Smoother ease-out curve
      const easeOut = 1 - Math.pow(1 - Math.min(ratio, 1), 4);
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
  }, [isVisible, overlayVisible]);

  useEffect(() => {
    if (!isVisible || !isBackendComplete) return;

    const startProgress = progress;
    const remainingProgress = 100 - startProgress;
    const completionDuration = 800; // Slower completion for smooth finish
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const ratio = Math.min(elapsed / completionDuration, 1);
      const easeOut = 1 - Math.pow(1 - ratio, 3);
      const currentProgress = startProgress + (remainingProgress * easeOut);
      
      setProgress(currentProgress);

      if (ratio < 1) {
        requestAnimationFrame(animate);
      } else {
        // Pause at 100% for a moment before transitioning
        setTimeout(() => {
          setLoadingFadeIn(false);
          setTimeout(() => {
            setShowWelcome(true);
            setTimeout(() => setFadeIn(true), 150);
          }, 500);
        }, 400);
      }
    };

    requestAnimationFrame(animate);
  }, [isBackendComplete, isVisible, progress]);

  const handleComplete = () => {
    setExitTransition(true);
    setTimeout(() => {
      onComplete?.();
    }, 600);
  };

  if (!overlayVisible) return null;

  if (showWelcome) {
    return (
      <div className={`fixed inset-0 bg-white z-50 flex items-center justify-center transition-all duration-500 ${exitTransition ? 'opacity-0 scale-105' : 'opacity-100 scale-100'}`}>
        <div className={`text-center px-6 max-w-lg transition-all duration-700 ease-out ${fadeIn && !exitTransition ? 'opacity-100 translate-y-0 scale-100' : fadeIn && exitTransition ? 'opacity-0 -translate-y-4 scale-95' : 'opacity-0 translate-y-12 scale-95'}`}>
          <div className="mb-8">
            <div className={`w-24 h-24 mx-auto bg-gradient-to-br from-oficaz-primary to-blue-600 rounded-[28px] flex items-center justify-center mb-8 shadow-2xl shadow-oficaz-primary/40 transition-all duration-1000 delay-200 ${fadeIn ? 'rotate-0 scale-100' : 'rotate-12 scale-75'}`}>
              <Sparkles className="w-12 h-12 text-white" />
            </div>
            
            <h1 className={`text-4xl lg:text-5xl font-bold text-gray-900 mb-5 transition-all duration-700 delay-300 ${fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              ¡Bienvenido!
            </h1>
            
            <p className={`text-xl text-gray-600 mb-3 transition-all duration-700 delay-400 ${fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              {companyName ? `${companyName} ya está listo.` : 'Tu espacio está listo.'}
            </p>
            
            <p className={`text-gray-500 transition-all duration-700 delay-500 ${fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              A partir de ahora, gestionar tu equipo será pan comido.
            </p>
          </div>

          <div className={`space-y-4 mb-10 transition-all duration-700 delay-600 ${fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div className="flex items-center gap-4 text-left bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100 rounded-2xl p-5">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <span className="font-semibold text-gray-900 block text-lg">7 días de prueba activados</span>
                <span className="text-gray-500">Explora todo sin límites ni compromisos</span>
              </div>
            </div>
          </div>

          <div className={`transition-all duration-700 delay-700 ${fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <Button 
              onClick={handleComplete}
              className="h-16 px-10 rounded-2xl text-lg font-semibold bg-gray-900 hover:bg-gray-800 text-white shadow-xl shadow-gray-900/25 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-gray-900/30 active:scale-[0.98]"
            >
              Comenzar a explorar
              <ArrowRight className="w-5 h-5 ml-3" />
            </Button>

            <p className={`text-sm text-gray-400 mt-8 transition-all duration-700 delay-1000 ${fadeIn ? 'opacity-100' : 'opacity-0'}`}>
              Esto va a ser el comienzo de algo grande.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 bg-white z-50 flex flex-col items-center justify-center transition-all duration-500 ${loadingFadeIn ? 'opacity-100' : 'opacity-0'}`}>
      <div className={`flex flex-col items-center transition-all duration-700 ease-out ${loadingFadeIn ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-8 scale-95'}`}>
        <div className={`mb-12 transition-all duration-700 delay-100 ${loadingFadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
          <img 
            src={oficazLogo} 
            alt="Oficaz" 
            className="h-10 w-auto"
          />
        </div>

        <div className={`mb-10 transition-all duration-700 delay-200 ${loadingFadeIn ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
          <div className="w-14 h-14 relative">
            <svg 
              className="w-14 h-14" 
              viewBox="0 0 50 50"
              style={{ animation: 'spin 0.8s linear infinite' }}
            >
              <circle
                cx="25"
                cy="25"
                r="20"
                fill="none"
                stroke="#f3f4f6"
                strokeWidth="3"
              />
              <circle
                cx="25"
                cy="25"
                r="20"
                fill="none"
                stroke="url(#gradient)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="60, 200"
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#2563eb" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        <p className={`text-gray-600 text-lg mb-10 min-h-[1.75rem] text-center transition-all duration-500 ${loadingFadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          {loadingMessages[messageIndex]}
        </p>

        <div className={`w-72 transition-all duration-700 delay-400 ${loadingFadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-oficaz-primary to-blue-500 rounded-full transition-all duration-150 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
