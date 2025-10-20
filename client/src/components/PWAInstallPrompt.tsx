import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { X, Download, Smartphone } from 'lucide-react';

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    const standalone = window.matchMedia('(display-mode: standalone)').matches || 
                      (window.navigator as any).standalone ||
                      document.referrer.includes('android-app://');
    setIsStandalone(standalone);

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(iOS);

    // Check if user has dismissed the prompt before
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedDate = new Date(dismissed);
      const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        // Don't show again for 7 days
        return;
      }
    }

    // Listen for beforeinstallprompt event (Chrome, Edge)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Show prompt for iOS users after 3 seconds
    if (iOS && !standalone) {
      setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt && !isIOS) {
      return;
    }

    if (deferredPrompt) {
      // Chrome/Edge installation
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to install prompt: ${outcome}`);
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa-install-dismissed', new Date().toISOString());
    setShowPrompt(false);
  };

  if (!showPrompt || isStandalone) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:max-w-md">
      <Alert className="bg-white dark:bg-gray-800 border-2 border-blue-500 shadow-2xl">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <AlertTitle className="text-lg font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Instala Oficaz como App
            </AlertTitle>
            <AlertDescription className="mt-2 text-gray-700 dark:text-gray-300">
              {isIOS ? (
                <div className="space-y-2">
                  <p className="font-semibold">Para recibir notificaciones con el móvil bloqueado:</p>
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>Toca el botón de compartir <span className="inline-block">⎙</span> en Safari</li>
                    <li>Selecciona "Añadir a pantalla de inicio"</li>
                    <li>Toca "Añadir"</li>
                  </ol>
                  <p className="text-xs mt-2 text-gray-600 dark:text-gray-400">
                    ⚠️ Solo funciona en Safari, no en Chrome iOS
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p>Instala Oficaz en tu dispositivo para:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Recibir alertas con el móvil bloqueado</li>
                    <li>Acceso rápido desde tu pantalla de inicio</li>
                    <li>Funciona sin conexión</li>
                  </ul>
                </div>
              )}
            </AlertDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {!isIOS && deferredPrompt && (
          <Button
            onClick={handleInstallClick}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Download className="mr-2 h-4 w-4" />
            Instalar App
          </Button>
        )}
      </Alert>
    </div>
  );
}
