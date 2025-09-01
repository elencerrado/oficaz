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

const emailSchema = z.object({
  email: z.string().email('Email no válido'),
});

type EmailData = z.infer<typeof emailSchema>;

export default function RequestCode() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'checking' | 'available' | 'unavailable'>('idle');
  const [emailMessage, setEmailMessage] = useState('');

  // Check if public registration is enabled
  const { data: registrationSettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['/api/registration-status'],
    retry: false,
  });

  // Redirect to home if registration is disabled
  useEffect(() => {
    if (!isLoadingSettings && registrationSettings && !registrationSettings.publicRegistrationEnabled) {
      setLocation('/');
    }
  }, [registrationSettings, isLoadingSettings, setLocation]);

  const form = useForm<EmailData>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      email: '',
    },
  });

  // Función para verificar disponibilidad del email
  const checkEmailAvailability = useCallback(async (email: string) => {
    if (!email || !email.includes('@')) {
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
      } else {
        setEmailStatus('unavailable');
        setEmailMessage(result.error || 'Este email ya está registrado');
      }
    } catch (error) {
      setEmailStatus('idle');
      setEmailMessage('');
    }
  }, []);

  // Debounce para la verificación del email
  useEffect(() => {
    const email = form.watch('email');
    const timeoutId = setTimeout(() => {
      checkEmailAvailability(email);
    }, 500); // Esperar 500ms después de que el usuario deje de escribir

    return () => clearTimeout(timeoutId);
  }, [form.watch('email'), checkEmailAvailability]);

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
        
        // Check if this is account recovery
        if (result.isRecovery) {
          alert(`Se ha detectado que tu cuenta está programada para eliminación.\n\n✓ Se ha enviado un código de recuperación a tu email\n✓ Usa este código para restaurar tu cuenta con todos tus datos\n✓ Tu suscripción y configuraciones se mantendrán\n\nRevisa tu bandeja de entrada y sigue las instrucciones.`);
        }
        
        // Redirect to verification page with secure session ID
        const sessionId = result.sessionId;
        setLocation(`/verify-code?session=${sessionId}`);
      } else {
        console.error('Request error:', result.message || 'No se pudo enviar el código.');
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
      <div className="min-h-screen flex items-center justify-center py-12 px-4 bg-gradient-to-br from-slate-900 to-slate-800">
        <Card className="w-full max-w-sm shadow-2xl rounded-2xl border-0 bg-white">
          <CardHeader className="text-center pt-8 pb-6">
            <div className="flex justify-center mb-6">
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
  if (registrationSettings && !registrationSettings.publicRegistrationEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4 bg-gradient-to-br from-slate-900 to-slate-800">
        <Card className="w-full max-w-sm shadow-2xl rounded-2xl border-0 bg-white">
          <CardHeader className="text-center pt-8 pb-2">
            <div className="flex justify-center mb-6">
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
          <CardContent className="px-8 pb-8">
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
    <div className="min-h-screen flex items-center justify-center py-12 px-4 bg-gradient-to-br from-slate-900 to-slate-800">
      <Card className="w-full max-w-sm shadow-2xl rounded-2xl border-0 bg-white">
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
            Crear nueva empresa
          </h1>
          <p className="text-gray-600 text-sm">
            Introduce tu email para comenzar el registro
          </p>
        </CardHeader>

        <CardContent className="px-8 pb-8">
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email del administrador</Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  className={`rounded-xl border-gray-300 py-3 px-4 pr-20 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
                    emailStatus === 'available' ? 'border-green-500 focus:border-green-500' :
                    emailStatus === 'unavailable' ? 'border-red-500 focus:border-red-500' :
                    ''
                  }`}
                  {...form.register('email')}
                  placeholder="admin@miempresa.com"
                />
                {/* Iconos a la derecha */}
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                  <div className="flex items-center gap-2">
                    {emailStatus === 'checking' && (
                      <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-500 rounded-full"></div>
                    )}
                    {emailStatus === 'available' && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    {emailStatus === 'unavailable' && (
                      <XCircle className="h-4 w-4 text-red-500" />
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
              {emailMessage && emailStatus === 'available' && (
                <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                  <CheckCircle className="h-3 w-3" />
                  {emailMessage}
                </p>
              )}
              
              <p className="text-xs text-gray-500 mt-1">
                Te enviaremos un código de verificación. Mantendremos tu sesión activa mientras verificas.
              </p>
            </div>

            <Button 
              type="submit" 
              className="w-full rounded-xl py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium" 
              disabled={isLoading || emailStatus === 'unavailable' || emailStatus === 'checking'}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  Enviando código...
                </div>
              ) : (
                <>
                  Enviar código de verificación
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </form>

          <div className="text-center mt-6">
            <Link href="/login" className="text-sm text-blue-600 hover:text-blue-700 hover:underline">
              ¿Ya tienes una cuenta? Iniciar sesión
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}