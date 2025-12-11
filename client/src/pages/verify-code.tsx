import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation, useSearch } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Shield, ArrowRight, ArrowLeft, RotateCcw, Clock, CheckCircle } from 'lucide-react';

import { apiRequest } from '@/lib/queryClient';
import oficazLogo from '@assets/oficaz logo_1750516757063.png';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

const codeSchema = z.object({
  code: z.string().length(6, 'El código debe tener exactamente 6 dígitos'),
});

type CodeData = z.infer<typeof codeSchema>;

export default function VerifyCode() {
  const [, setLocation] = useLocation();
  const search = useSearch();

  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [countdown, setCountdown] = useState(0);
  const [canResend, setCanResend] = useState(false);
  const [showRecoverySuccessModal, setShowRecoverySuccessModal] = useState(false);
  const [allowNavigation, setAllowNavigation] = useState(false);
  
  // Get sessionId from URL params
  const params = new URLSearchParams(search);
  const sessionId = params.get('session');

  const form = useForm<CodeData>({
    resolver: zodResolver(codeSchema),
    mode: 'onChange', // Validate on change to handle auto-fill
    defaultValues: {
      code: '',
    },
  });

  // Set dark notch for dark background
  useEffect(() => {
    document.documentElement.classList.add('dark-notch');
    return () => {
      document.documentElement.classList.remove('dark-notch');
    };
  }, []);

  // Redirect if no sessionId provided and start initial countdown
  useEffect(() => {
    if (!sessionId) {
      // Use setTimeout to avoid immediate redirect during render
      const timer = setTimeout(() => {
        setLocation('/request-code');
      }, 100);
      return () => clearTimeout(timer);
    } else {
      // Start initial 60 second countdown when page loads
      setCountdown(60);
      setCanResend(false);
    }
  }, [sessionId]);

  // Countdown timer for resend button
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (countdown > 0) {
      setCanResend(false);
      timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
    } else {
      setCanResend(true);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [countdown]);

  // Prevent page reload on mobile app switching
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Page became visible again, keep form state
        console.log('Page became visible again');
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Only prevent navigation if it's not an allowed programmatic navigation
      if (!allowNavigation) {
        // Prevent accidental page reload
        e.preventDefault();
        e.returnValue = '';
      }
    };

    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        // Page was restored from cache
        console.log('Page restored from cache');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [allowNavigation]);

  const handleSubmit = async (data: CodeData) => {
    if (!sessionId) return;
    
    setIsLoading(true);
    setErrorMessage(''); // Clear previous errors
    try {
      console.log('Verifying code:', { sessionId, code: data.code });
      
      const response = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          code: data.code,
        }),
      });
      
      console.log('Verify response status:', response.status);
      
      const result = await response.json();
      console.log('Verify response data:', result);
      
      if (response.ok) {
        // Check if this is account recovery
        if (result.isRecovery && result.action === 'account_restored') {
          // Show success modal for account recovery
          setShowRecoverySuccessModal(true);
        } else {
          // Normal registration flow - redirect to registration with verification token and email
          setAllowNavigation(true); // Allow the navigation
          setLocation(`/register?token=${result.verificationToken}&email=${encodeURIComponent(result.email)}`);
        }
      } else {
        setErrorMessage(result.message || 'El código no es válido o ha expirado.');
        console.error('Verification error:', result.message || 'El código no es válido o ha expirado.');
      }
    } catch (error: any) {
      setErrorMessage('Ha ocurrido un error inesperado. Inténtalo de nuevo.');
      console.error('Verify error:', error);
      console.error('Verification error:', 'Ha ocurrido un error inesperado: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!sessionId || !canResend || isResending) return;
    
    setIsResending(true);
    setErrorMessage('');
    
    try {
      const response = await fetch('/api/auth/resend-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        // Start 60 second countdown
        setCountdown(60);
        setErrorMessage('');
        // Show success message temporarily
        const successMsg = errorMessage;
        setErrorMessage('');
        setTimeout(() => {
          // Clear any success message after 3 seconds
        }, 3000);
      } else {
        if (result.remainingTime) {
          setCountdown(result.remainingTime);
        }
        setErrorMessage(result.error || 'Error al reenviar el código');
      }
    } catch (error) {
      console.error('Error resending code:', error);
      setErrorMessage('Ha ocurrido un error inesperado al reenviar el código');
    } finally {
      setIsResending(false);
    }
  };

  if (!sessionId) {
    return <div className="h-screen bg-gradient-to-br from-slate-900 to-slate-800" />;
  }

  return (
    <div className="h-screen flex items-center justify-center px-4 bg-gradient-to-br from-slate-900 to-slate-800">
      <Card className="w-full max-w-sm shadow-2xl rounded-2xl border-0 bg-white animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
        <CardHeader className="text-center pt-8 pb-6">
          <div className="flex justify-center mb-6">
            <Link href="/">
              <img 
                src={oficazLogo} 
                alt="Oficaz" 
                className="h-10 w-auto cursor-pointer hover:opacity-80 transition-opacity"
              />
            </Link>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Verificar email
          </h1>
          <p className="text-gray-600 text-sm">
            Introduce el código que hemos enviado a tu email
          </p>
        </CardHeader>

        <CardContent className="px-8 pb-8">
          <p className="text-xs text-gray-500 mb-6 text-center">
            Revisa tu carpeta de spam o correo no deseado. Copia el código antes de volver al navegador.
          </p>

          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code" className="text-sm font-medium text-gray-700">Código de verificación</Label>
              <div className="relative">
                <Input
                  id="code"
                  type="text"
                  className="rounded-xl border border-gray-300 py-3 px-4 text-center text-lg tracking-widest focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  {...form.register('code')}
                  placeholder="123456"
                  maxLength={6}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  onChange={(e) => {
                    setErrorMessage(''); // Clear error on input change
                    // Update form value for auto-filled codes
                    form.setValue('code', e.target.value);
                  }}
                />
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                  <Shield className="h-4 w-4 text-gray-400" />
                </div>
              </div>
              
              {form.formState.errors.code && (
                <p className="text-xs text-red-500 mt-1">{form.formState.errors.code.message}</p>
              )}
              {errorMessage && (
                <p className="text-xs text-red-500 mt-1">{errorMessage}</p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full rounded-xl py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <LoadingSpinner size="xs" />
                  Verificando...
                </div>
              ) : (
                <>
                  Verificar código
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </form>

          <div className="space-y-3 mt-6">
            <Button 
              type="button"
              variant="outline"
              className="w-full rounded-xl py-3 border-gray-300"
              onClick={handleResendCode}
              disabled={isLoading || isResending || !canResend}
            >
              {isResending ? (
                <div className="flex items-center gap-2">
                  <LoadingSpinner size="xs" />
                  Enviando...
                </div>
              ) : !canResend ? (
                <>
                  Solicitar nuevo código ({countdown}s)
                  <Clock className="h-4 w-4 ml-2" />
                </>
              ) : (
                <>
                  Solicitar nuevo código
                  <RotateCcw className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>

            <Button 
              variant="ghost" 
              onClick={() => {
                setIsLoading(false);
                setLocation('/request-code');
              }}
              className="w-full text-sm text-gray-600 hover:text-gray-900"
              disabled={isLoading}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Cambiar email
            </Button>
          </div>

          <div className="text-center mt-6">
            <Link href="/login" className="text-sm text-blue-600 hover:text-blue-700 hover:underline">
              ¿Ya tienes una cuenta? Iniciar sesión
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Recovery Success Modal */}
      <Dialog open={showRecoverySuccessModal} onOpenChange={setShowRecoverySuccessModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <DialogTitle className="text-xl font-semibold text-gray-900">
              ¡Cuenta recuperada exitosamente!
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 text-center">
            <p className="text-gray-600">
              Tu cuenta ha sido restaurada completamente con todos tus datos, configuraciones y suscripciones anteriores.
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800 font-medium">
                Ya puedes iniciar sesión normalmente con tus credenciales habituales.
              </p>
            </div>
          </div>

          <div className="flex justify-center mt-6">
            <Button 
              onClick={() => {
                setShowRecoverySuccessModal(false);
                setLocation('/login');
              }}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              Ir al inicio de sesión
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}