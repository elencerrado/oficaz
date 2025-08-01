import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface DemoLoadingOverlayProps {
  isVisible: boolean;
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

export function DemoLoadingOverlay({ isVisible, onComplete }: DemoLoadingOverlayProps) {
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

    let progressInterval: NodeJS.Timeout;
    let stepTimeout: NodeJS.Timeout;

    const totalDuration = loadingSteps.reduce((sum, step) => sum + step.duration, 0);
    let elapsedTime = 0;

    // Start progress animation
    progressInterval = setInterval(() => {
      elapsedTime += 50;
      const newProgress = Math.min((elapsedTime / totalDuration) * 100, 100);
      setProgress(newProgress);

      // Only complete when progress reaches exactly 100%
      if (newProgress >= 100) {
        clearInterval(progressInterval);
        // Ensure we show 100% briefly before completing
        setTimeout(() => {
          onComplete?.();
        }, 800);
      }
    }, 50);

    // Handle step changes
    let currentStepTime = 0;
    
    const advanceStep = (stepIndex: number) => {
      if (stepIndex >= loadingSteps.length) return;
      
      setCurrentStep(stepIndex);
      setCurrentText(loadingSteps[stepIndex].text);
      
      if (stepIndex < loadingSteps.length - 1) {
        stepTimeout = setTimeout(() => {
          advanceStep(stepIndex + 1);
        }, loadingSteps[stepIndex].duration);
      }
    };

    advanceStep(0);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(stepTimeout);
    };
  }, [isVisible, onComplete]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center">
        {/* Professional loading spinner */}
        <div className="mb-6 flex justify-center">
          <LoadingSpinner size="lg" />
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