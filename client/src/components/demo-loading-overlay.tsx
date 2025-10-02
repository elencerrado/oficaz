import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import oficazLogo from '@/assets/oficaz-logo.png';

interface DemoLoadingOverlayProps {
  isVisible: boolean;
  isBackendComplete?: boolean; // Signal from parent that backend is done
  onComplete?: () => void;
}

const loadingSteps = [
  { text: "Creando tu nuevo espacio...", duration: 2500 },
  { text: "Generando empleados de demostración...", duration: 3000 },
  { text: "Creando fichajes de tiempo...", duration: 2500 },
  { text: "Generando recordatorios y asignaciones...", duration: 2500 },
  { text: "Creando mensajes de ejemplo...", duration: 2000 },
  { text: "Ya casi lo tenemos...", duration: 1500 },
  { text: "¡Listo! Preparando tu espacio...", duration: 1000 }
];

export function DemoLoadingOverlay({ isVisible, isBackendComplete = false, onComplete }: DemoLoadingOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [currentText, setCurrentText] = useState(loadingSteps[0]?.text || "");

  // Main progress animation to 95%
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
    const targetProgress = 95; // Animate to 95% then wait for backend signal
    const totalDuration = 10000; // 10 seconds to reach 95%

    // Smooth progress animation using requestAnimationFrame (no jitter)
    const animateProgress = () => {
      const elapsed = Date.now() - startTime;
      const calculatedProgress = Math.min((elapsed / totalDuration) * targetProgress, targetProgress);
      
      setProgress(calculatedProgress);

      // Keep animating until we reach target progress
      if (calculatedProgress < targetProgress) {
        animationFrameId = requestAnimationFrame(animateProgress);
      }
    };

    animationFrameId = requestAnimationFrame(animateProgress);

    // Handle step text changes
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

  // Complete to 100% when backend signals completion
  useEffect(() => {
    if (!isVisible || !isBackendComplete) return;

    const startProgress = progress;
    const remainingProgress = 100 - startProgress;
    const completionDuration = 600; // 600ms to smoothly complete to 100%
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const ratio = Math.min(elapsed / completionDuration, 1);
      const currentProgress = startProgress + (remainingProgress * ratio);
      
      setProgress(currentProgress);

      if (ratio < 1) {
        requestAnimationFrame(animate);
      } else {
        // Progress is at 100%, now trigger onComplete after a brief pause
        setTimeout(() => {
          onComplete?.();
        }, 400);
      }
    };

    requestAnimationFrame(animate);
  }, [isBackendComplete, isVisible, onComplete, progress]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center">
        {/* Oficaz Logo */}
        <div className="mb-6 flex justify-center">
          <img 
            src={oficazLogo} 
            alt="Oficaz" 
            className="h-12 w-auto dark:brightness-0 dark:invert"
          />
        </div>

        {/* Small loading spinner */}
        <div className="mb-4 flex justify-center">
          <LoadingSpinner size="md" />
        </div>

        {/* Loading text */}
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Configurando tu cuenta
        </h3>
        
        <p className="text-gray-600 mb-6 min-h-[1.5rem] transition-all duration-500 ease-in-out">
          {currentText}
        </p>

        {/* Progress bar */}
        <div className="mb-4">
          <Progress 
            value={progress} 
            className="h-2 bg-gray-200"
          />
        </div>

        {/* Progress percentage */}
        <p className="text-sm text-gray-500">
          {Math.round(progress)}% completado
        </p>

        {/* Subtle animation dots */}
        <div className="flex justify-center items-center mt-4 space-x-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 bg-oficaz-primary rounded-full animate-bounce"
              style={{
                animationDelay: `${i * 0.2}s`,
                animationDuration: '1s'
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}