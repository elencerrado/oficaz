import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Mail, ArrowRight, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

import { apiRequest } from '@/lib/queryClient';
import oficazLogo from '@/assets/oficaz-logo.png';
import { usePageTitle } from '@/hooks/use-page-title';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

const emailSchema = z.object({
  email: z.string().email('Email no válido'),
});

type EmailData = z.infer<typeof emailSchema>;

export default function RequestCode() {
  usePageTitle('Solicitar Código de Verificación');
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'checking' | 'available' | 'unavailable' | 'cancelled'>('idle');
  const [emailMessage, setEmailMessage] = useState('');
  const [canRecover, setCanRecover] = useState(false);

  // Check if public registration is enabled
  const { data: registrationSettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['/api/registration-status'],
    retry: false,
  });

  // Redirect to home if registration is disabled
  useEffect(() => {
    if (!isLoadingSettings && registrationSettings && !registrationSettings?.publicRegistrationEnabled) {
      // Use setTimeout to avoid immediate redirect during render
      const timer = setTimeout(() => {
        setLocation('/');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [registrationSettings, isLoadingSettings]);

  // Set dark notch for dark background
  useEffect(() => {
    document.documentElement.classList.add('dark-notch');
    return () => {
      document.documentElement.classList.remove('dark-notch');
    };
  }, []);

  const form = useForm<EmailData>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      email: '',
    },
  });

  // Función para verificar disponibilidad del email
  const checkEmailAvailability = useCallback(async (email: string) => {
    // Validate email format properly (not just checking for @)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      setEmailStatus('idle');
      setEmailMessage('');
      return;
    }

    setEmailStatus('checking');
    setEmailMessage('');

    try {
      const response = await fetch('/api/auth/check-email-availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (result.available) {
        setEmailStatus('available');
        setEmailMessage('Email disponible');
        setCanRecover(false);
      } else if (result.isCancelled && result.canRecover) {
        setEmailStatus('cancelled');
        setEmailMessage(result.error || 'La cuenta con este email está cancelada');
        setCanRecover(true);
      } else {
        setEmailStatus('unavailable');
        setEmailMessage(result.error || 'Este email ya está registrado');
        setCanRecover(false);
      }
    } catch (error) {
      setEmailStatus('idle');
      setEmailMessage('');
    }
  }, []);

  // Watch email changes for verification
  const watchedEmail = form.watch('email');
  
  // Debounce para la verificación del email
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (watchedEmail && watchedEmail.trim()) {
        checkEmailAvailability(watchedEmail.trim());
      } else {
        // ✅ Reset state when email is empty or invalid
        setEmailStatus('idle');
        setEmailMessage('');
        setCanRecover(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [watchedEmail, checkEmailAvailability]);

  const handleSubmit = async (data: EmailData) => {
    setIsLoading(true);
    try {
      console.log('Sending request to:', '/api/auth/request-verification-code', data);
      
      const response = await fetch('/api/auth/request-verification-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      console.log('Response status:', response.status);
      
      const result = await response.json();
      console.log('Response data:', result);
      
      if (response.ok) {
        console.log('Verification code sent:', result.message);
        
        // Check if this is account recovery - no alert, just proceed
        if (result.isRecovery) {
          console.log('Account recovery flow initiated');
        }
        
        // Redirect to verification page with secure session ID - instant navigation
        setLocation(`/verify-code?session=${result.sessionId}`);
      } else {
        console.error('Request error:', result.message || 'No se pudo enviar el código.');
        // ✅ Update visual state to show error with icons
        setEmailStatus('unavailable');
        setEmailMessage(result.error || result.message || 'No se pudo enviar el código');
        setCanRecover(false);
      }
    } catch (error: any) {
      console.error('Request error:', error);
      console.error('Request error:', 'Ha ocurrido un error inesperado: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading while checking registration settings
  if (isLoadingSettings) {
    return (
      <div className="h-screen flex items-center justify-center px-4 bg-gradient-to-br from-slate-900 to-slate-800">
        <Card className="w-full max-w-sm shadow-2xl rounded-2xl border-0 bg-white">
          <CardHeader className="text-center pt-6 pb-4">
            <div className="flex justify-center mb-4">
              <Link href="/">
                <img
                  src={oficazLogo}
                  alt="Oficaz"
                  className="h-10 w-auto cursor-pointer hover:opacity-80 transition-opacity animate-pulse"
                />
              </Link>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Verificando disponibilidad...
            </h1>
            <p className="text-gray-600 text-sm">
              Comprobando si el registro está disponible
            </p>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Show error page if registration is disabled
  if (registrationSettings && !registrationSettings?.publicRegistrationEnabled) {
    return (
      <div className="h-screen flex items-center justify-center px-4 bg-gradient-to-br from-slate-900 to-slate-800">
        <Card className="w-full max-w-sm shadow-2xl rounded-2xl border-0 bg-white">
          <CardHeader className="text-center pt-6 pb-4">
            <div className="flex justify-center mb-4">
              <Link href="/">
                <img
                  src={oficazLogo}
                  alt="Oficaz"
                  className="h-10 w-auto cursor-pointer hover:opacity-80 transition-opacity"
                />
              </Link>
            </div>
            <div className="w-16 h-16 mx-auto mb-4 bg-orange-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-orange-600" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Registro No Disponible
            </h1>
            <p className="text-gray-600 text-sm mb-6">
              El registro público está temporalmente deshabilitado. Solo se puede acceder mediante invitación.
            </p>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="space-y-3">
              <Link href="/">
                <Button variant="outline" className="w-full rounded-xl py-3 border-gray-300">
                  Volver al Inicio
                </Button>
              </Link>
              <Link href="/login">
                <Button className="w-full rounded-xl py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium">
                  Iniciar Sesión
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex items-center justify-center px-4 bg-gradient-to-br from-slate-900 to-slate-800">
      <Card className="w-full max-w-sm shadow-2xl rounded-2xl border-0 bg-white animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
        <CardHeader className="text-center pt-6 pb-4">
          <div className="flex justify-center mb-4">
            <Link href="/">
              <img 
                src={oficazLogo} 
                alt="Oficaz" 
                className="h-10 w-auto cursor-pointer hover:opacity-80 transition-opacity"
              />
            </Link>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Crear nueva empresa
          </h1>
          <p className="text-gray-600 text-sm">
            Introduce tu email para comenzar el registro
          </p>
        </CardHeader>

        <CardContent className="px-6 pb-6">
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email del administrador</Label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  style={{
                    border: emailStatus === 'available' ? '2px solid #22c55e' :
                           emailStatus === 'unavailable' ? '2px solid #ef4444' :
                           emailStatus === 'cancelled' ? '2px solid #f97316' :
                           '2px solid #d1d5db',
                    borderRadius: '0.75rem',
                    padding: '0.75rem 1rem',
                    paddingRight: '5rem',
                    fontSize: '0.875rem',
                    backgroundColor: 'white',
                    color: '#111827',
                    width: '100%',
                    outline: 'none'
                  }}
                  {...form.register('email')}
                  placeholder="admin@miempresa.com"
                />
                {/* Iconos a la derecha */}
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                  <div className="flex items-center gap-2">
                    {emailStatus === 'checking' && (
                      <LoadingSpinner size="xs" />
                    )}
                    {emailStatus === 'available' && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    {emailStatus === 'unavailable' && (
                      <button
                        type="button"
                        onClick={() => {
                          form.setValue('email', '');
                          setEmailStatus('idle');
                          setEmailMessage('');
                          setCanRecover(false);
                        }}
                        title="Limpiar email"
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                      >
                        <XCircle className="h-4 w-4 text-red-500" />
                      </button>
                    )}
                    {emailStatus === 'cancelled' && (
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                    )}
                    <Mail className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              </div>
              
              {/* Mensajes de validación */}
              {form.formState.errors.email && (
                <p className="text-xs text-red-500 mt-1">{form.formState.errors.email.message}</p>
              )}
              {emailMessage && emailStatus === 'unavailable' && (
                <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                  <XCircle className="h-3 w-3" />
                  {emailMessage}
                </p>
              )}
              {emailMessage && emailStatus === 'cancelled' && (
                <p className="text-xs text-orange-600 flex items-center gap-1 mt-1">
                  <AlertTriangle className="h-3 w-3" />
                  {emailMessage}
                </p>
              )}
              {emailMessage && emailStatus === 'available' && (
                <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                  <CheckCircle className="h-3 w-3" />
                  {emailMessage}
                </p>
              )}
              
              <p className="text-xs text-gray-500 mt-1">
                {canRecover 
                  ? 'Te enviaremos un código de recuperación para restaurar tu cuenta cancelada. Revisa tu carpeta de SPAM.'
                  : 'Te enviaremos un código de verificación. Revisa tu carpeta de SPAM si no lo recibes.'
                }
              </p>
            </div>

            <Button 
              type="submit" 
              className={`w-full rounded-xl py-3 text-white font-medium ${
                canRecover 
                  ? 'bg-orange-600 hover:bg-orange-700' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
              disabled={isLoading || emailStatus === 'idle' || emailStatus === 'unavailable' || emailStatus === 'checking'}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <LoadingSpinner size="xs" />
                  {canRecover ? 'Enviando código de recuperación...' : 'Enviando código...'}
                </div>
              ) : (
                <>
                  {canRecover ? 'Enviar código de recuperación' : 'Enviar código de verificación'}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>

            {/* Link inside form to match login height */}
            <div className="text-center mt-4">
              <Link href="/login" className="text-sm text-blue-600 hover:text-blue-700 hover:underline">
                ¿Ya tienes una cuenta? Iniciar sesión
              </Link>
            </div>
          </form>

          {/* Second link outside form to match login height */}
          <div className="text-center mt-6">
            <Link href="/register" className="text-sm text-blue-600 hover:text-blue-700 hover:underline">
              Registra tu empresa
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}