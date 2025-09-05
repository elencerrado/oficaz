import { useState, useEffect } from 'react';
import { Link, useLocation, useRoute } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { passwordResetRequestSchema } from '@shared/schema';
import oficazLogo from '@/assets/oficaz-logo.png';

type ForgotPasswordData = z.infer<typeof passwordResetRequestSchema>;

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extract company alias from URL
  const [match, params] = useRoute('/:companyAlias/forgot-password');
  const companyAlias = params?.companyAlias;

  const form = useForm<ForgotPasswordData>({
    resolver: zodResolver(passwordResetRequestSchema),
    defaultValues: { 
      email: '', 
      companyAlias: companyAlias || undefined 
    },
  });

  // Set dark notch for dark background and prevent scroll
  useEffect(() => {
    document.documentElement.classList.add('dark-notch');
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.classList.remove('dark-notch');
      document.body.style.overflow = '';
    };
  }, []);

  const handleSubmit = async (data: ForgotPasswordData) => {
    setSubmitting(true);
    setError(null);
    
    try {
      await apiRequest('POST', '/api/auth/forgot-password', {
        ...data,
        companyAlias: companyAlias || data.companyAlias
      });
      
      setSuccess(true);
    } catch (error: any) {
      console.error('Password reset request failed:', error);
      
      if (error.message?.includes('User not found')) {
        setError('No se encontró ningún usuario con este email.');
      } else if (error.message?.includes('429')) {
        setError('Demasiados intentos. Espera unos minutos antes de intentar de nuevo.');
      } else {
        setError('Error al enviar el email. Inténtalo de nuevo.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="h-screen flex items-center justify-center px-4 bg-gradient-to-br from-slate-900 to-slate-800 overflow-hidden" style={{ height: '100dvh', marginTop: 'calc(-1 * env(safe-area-inset-top, 0px) / 2)' }}>
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
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Email enviado
            </h1>
            <p className="text-gray-600 text-sm">
              Te hemos enviado un enlace para recuperar tu contraseña
            </p>
          </CardHeader>

          <CardContent className="px-8 pb-8">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-green-700">
                Revisa tu bandeja de entrada y haz clic en el enlace para cambiar tu contraseña. 
                El enlace expirará en 1 hora.
              </p>
            </div>

            <div className="text-center">
              <Button
                onClick={() => setLocation(companyAlias ? `/${companyAlias}/login` : '/login')}
                variant="outline"
                className="w-full"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver al login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex items-center justify-center px-4 bg-gradient-to-br from-slate-900 to-slate-800 overflow-hidden" style={{ height: '100dvh', marginTop: 'calc(-1 * env(safe-area-inset-top, 0px) / 2)' }}>
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
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Recuperar contraseña
          </h1>
          <p className="text-gray-600 text-sm">
            Introduce tu email para recibir un enlace de recuperación
          </p>
        </CardHeader>

        <CardContent className="px-8 pb-8">
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Email Field */}
            <div className="relative">
              <Input
                {...form.register('email')}
                type="email"
                placeholder="tu.email@empresa.com"
                className="rounded-xl border-gray-300 py-3 px-4 pr-12 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                onChange={(e) => {
                  form.setValue('email', e.target.value);
                  setError(null);
                }}
              />
              <Mail className="absolute right-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              {form.formState.errors.email && (
                <p className="text-xs text-red-500 mt-1">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            {/* Spacer to match login form height */}
            <div className="space-y-4">
              <div className="h-12"></div> {/* Equivalent to password field */}
              <div className="h-6"></div>  {/* Equivalent to checkbox */}
            </div>

            {/* Submit Button */}
            <Button 
              type="submit" 
              className="w-full rounded-xl py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium"
              disabled={submitting}
            >
              {submitting ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  Enviando email...
                </div>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Enviar enlace de recuperación
                </>
              )}
            </Button>

            {/* Back to Login Link - with spacing to match login layout */}
            <div className="text-center mt-4">
              <Link 
                href={companyAlias ? `/${companyAlias}/login` : '/login'}
                className="text-sm text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center"
              >
                <ArrowLeft className="h-3 w-3 mr-1" />
                Volver al login
              </Link>
            </div>
            
            {/* Extra spacer to match login's second link */}
            <div className="text-center mt-6">
              <div className="h-4"></div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}