import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import oficazFavicon from '@assets/favicon oficaz_1757056517547.png';

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
  const [phase, setPhase] = useState<'loading' | 'transitioning' | 'welcome' | 'exiting' | 'hidden'>('hidden');
  const [contentFadeIn, setContentFadeIn] = useState(false);

  useEffect(() => {
    if (isVisible && phase === 'hidden') {
      setPhase('loading');
      setProgress(0);
      setMessageIndex(0);
      setContentFadeIn(false);
      setTimeout(() => setContentFadeIn(true), 50);
    } else if (!isVisible) {
      setPhase('hidden');
      setProgress(0);
      setMessageIndex(0);
      setContentFadeIn(false);
    }
  }, [isVisible, phase]);

  useEffect(() => {
    if (phase !== 'loading') return;

    let animationFrameId: number;
    const startTime = Date.now();
    const targetProgress = 80;
    const totalDuration = 4500;

    const animateProgress = () => {
      const elapsed = Date.now() - startTime;
      const ratio = elapsed / totalDuration;
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
  }, [phase]);

  useEffect(() => {
    if (phase !== 'loading' || !isBackendComplete) return;

    const startProgress = progress;
    const remainingProgress = 100 - startProgress;
    const completionDuration = 800;
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
        setContentFadeIn(false);
        setTimeout(() => {
          setPhase('welcome');
          setTimeout(() => setContentFadeIn(true), 50);
        }, 300);
      }
    };

    requestAnimationFrame(animate);
  }, [isBackendComplete, phase, progress]);

  const handleComplete = () => {
    setPhase('exiting');
    setContentFadeIn(false);
    setTimeout(() => {
      onComplete?.();
    }, 600);
  };

  if (phase === 'hidden') return null;

  return (
    <div 
      className={`fixed inset-0 bg-white z-[9999] flex items-center justify-center transition-opacity duration-500 ${
        phase === 'exiting' ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {phase === 'loading' && (
        <div className={`flex flex-col items-center transition-all duration-300 ease-out ${
          contentFadeIn ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'
        }`}>
          <div className="mb-10">
            <LoadingSpinner size="lg" />
          </div>

          <p className="text-gray-600 text-lg mb-10 min-h-[1.75rem] text-center">
            {loadingMessages[messageIndex]}
          </p>

          <div className="w-72">
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-oficaz-primary to-blue-500 rounded-full transition-all duration-150 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {phase === 'welcome' && (
        <div className={`text-center px-6 max-w-lg transition-all duration-700 ease-out ${
          contentFadeIn ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-12 scale-95'
        }`}>
          <div className="mb-8">
            <img 
              src={oficazFavicon} 
              alt="Oficaz" 
              className={`w-24 h-24 mx-auto mb-8 transition-all duration-1000 ${
                contentFadeIn ? 'rotate-0 scale-100' : 'rotate-12 scale-75'
              }`}
            />
            
            <h1 className={`text-4xl lg:text-5xl font-bold text-gray-900 mb-5 transition-all duration-700 delay-100 ${
              contentFadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              ¡Bienvenido!
            </h1>
            
            <p className={`text-xl text-gray-600 mb-3 transition-all duration-700 delay-200 ${
              contentFadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              {companyName ? `${companyName} ya está listo.` : 'Tu espacio está listo.'}
            </p>
            
            <p className={`text-gray-500 transition-all duration-700 delay-300 ${
              contentFadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              A partir de ahora, gestionar tu equipo será pan comido.
            </p>
          </div>

          <div className={`space-y-4 mb-10 transition-all duration-700 delay-400 ${
            contentFadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}>
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

          <div className={`transition-all duration-700 delay-500 ${
            contentFadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}>
            <Button 
              onClick={handleComplete}
              className="h-16 px-10 rounded-2xl text-lg font-semibold bg-gray-900 hover:bg-gray-800 text-white shadow-xl shadow-gray-900/25 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-gray-900/30 active:scale-[0.98]"
            >
              Comenzar a explorar
              <ArrowRight className="w-5 h-5 ml-3" />
            </Button>

            <p className={`text-sm text-gray-400 mt-8 transition-all duration-700 delay-700 ${
              contentFadeIn ? 'opacity-100' : 'opacity-0'
            }`}>
              Esto va a ser el comienzo de algo grande.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
