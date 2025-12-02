import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import oficazLogo from '@/assets/oficaz-logo.png';

interface DemoLoadingOverlayProps {
  isVisible: boolean;
  isBackendComplete?: boolean;
  onComplete?: () => void;
}

const loadingSteps = [
  { text: "Creando tu cuenta...", duration: 800 },
  { text: "Configurando tu espacio...", duration: 800 },
  { text: "¡Listo! Preparando tu panel...", duration: 600 }
];

export function DemoLoadingOverlay({ isVisible, isBackendComplete = false, onComplete }: DemoLoadingOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [currentText, setCurrentText] = useState(loadingSteps[0]?.text || "");

  useEffect(() => {
    if (!isVisible) {
      setCurrentStep(0);
      setProgress(0);
      setCurrentText(loadingSteps[0]?.text || "");
      return;
    }

    let animationFrameId: number;
    let stepTimeouts: NodeJS.Timeout[] = [];
    const startTime = Date.now();
    const targetProgress = 90;
    const totalDuration = 2000;

    const animateProgress = () => {
      const elapsed = Date.now() - startTime;
      const calculatedProgress = Math.min((elapsed / totalDuration) * targetProgress, targetProgress);
      
      setProgress(calculatedProgress);

      if (calculatedProgress < targetProgress) {
        animationFrameId = requestAnimationFrame(animateProgress);
      }
    };

    animationFrameId = requestAnimationFrame(animateProgress);

    const advanceStep = (stepIndex: number) => {
      if (stepIndex >= loadingSteps.length) return;
      
      setCurrentStep(stepIndex);
      setCurrentText(loadingSteps[stepIndex].text);
      
      if (stepIndex < loadingSteps.length - 1) {
        const timeout = setTimeout(() => {
          advanceStep(stepIndex + 1);
        }, loadingSteps[stepIndex].duration);
        stepTimeouts.push(timeout);
      }
    };

    advanceStep(0);

    return () => {
      cancelAnimationFrame(animationFrameId);
      stepTimeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible || !isBackendComplete) return;

    const startProgress = progress;
    const remainingProgress = 100 - startProgress;
    const completionDuration = 300;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const ratio = Math.min(elapsed / completionDuration, 1);
      const currentProgress = startProgress + (remainingProgress * ratio);
      
      setProgress(currentProgress);

      if (ratio < 1) {
        requestAnimationFrame(animate);
      } else {
        setTimeout(() => {
          onComplete?.();
        }, 200);
      }
    };

    requestAnimationFrame(animate);
  }, [isBackendComplete, isVisible, onComplete, progress]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center">
        <div className="mb-6 flex justify-center">
          <img 
            src={oficazLogo} 
            alt="Oficaz" 
            className="h-12 w-auto dark:brightness-0 dark:invert"
          />
        </div>

        <div className="mb-4 flex justify-center">
          <LoadingSpinner size="md" />
        </div>

        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Configurando tu cuenta
        </h3>
        
        <p className="text-gray-600 mb-6 min-h-[1.5rem] transition-all duration-300 ease-in-out">
          {currentText}
        </p>

        <div className="mb-4">
          <Progress 
            value={progress} 
            className="h-2 bg-gray-200"
          />
        </div>

        <p className="text-sm text-gray-500">
          {Math.round(progress)}% completado
        </p>
      </div>
    </div>
  );
}
