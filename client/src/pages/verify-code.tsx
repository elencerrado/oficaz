import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation, useSearch } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, ArrowRight, ArrowLeft, RotateCcw, Clock } from 'lucide-react';

import { apiRequest } from '@/lib/queryClient';
import oficazLogo from '@assets/oficaz logo_1750516757063.png';

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

  // Redirect if no sessionId provided and start initial countdown
  useEffect(() => {
    if (!sessionId) {
      setLocation('/request-code');
    } else {
      // Start initial 60 second countdown when page loads
      setCountdown(60);
      setCanResend(false);
    }
  }, [sessionId, setLocation]);

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
      // Prevent accidental page reload
      e.preventDefault();
      e.returnValue = '';
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
  }, []);

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

        
        // Redirect to registration with verification token
        setLocation(`/register?token=${result.verificationToken}`);
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
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8">
          {/* Logo and header */}
          <div className="text-center mb-8">
            <img 
              src={oficazLogo} 
              alt="Oficaz" 
              className="h-12 mx-auto mb-4"
            />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Verificar email
            </h1>
            <p className="text-gray-600 mb-2">
              Introduce el código que hemos enviado a tu email.
            </p>
            <p className="text-sm text-gray-500">
              Tip: Copia el código antes de volver al navegador
            </p>
          </div>

          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="code">Código de verificación</Label>
              <div className="relative">
                <Shield className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="code"
                  type="text"
                  className="pl-10 rounded-xl text-center text-lg tracking-widest"
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
              </div>
              {form.formState.errors.code && (
                <p className="text-sm text-red-600">{form.formState.errors.code.message}</p>
              )}
              {errorMessage && (
                <p className="text-sm text-red-600">{errorMessage}</p>
              )}
            </div>

            <div className="space-y-3">
              <Button 
                type="submit" 
                className="w-full rounded-xl" 
                disabled={isLoading}
              >
                {isLoading ? 'Verificando...' : 'Verificar código'}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>

              <Button 
                type="button"
                variant="outline"
                className="w-full rounded-xl"
                onClick={handleResendCode}
                disabled={isLoading || isResending || !canResend}
              >
                {isResending ? (
                  <>
                    Enviando...
                    <RotateCcw className="h-4 w-4 ml-2 animate-spin" />
                  </>
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
            </div>
          </form>

          <div className="mt-6 text-center space-y-3">
            <Button 
              variant="ghost" 
              onClick={() => {
                setIsLoading(false);
                setLocation('/request-code');
              }}
              className="text-sm text-gray-600 hover:text-gray-900"
              disabled={isLoading}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Cambiar email
            </Button>

          </div>

          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600">
              ¿Ya tienes una cuenta?{' '}
              <Link href="/login" className="font-medium text-oficaz-primary hover:text-blue-500">
                Iniciar sesión
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}