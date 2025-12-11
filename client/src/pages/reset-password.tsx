import { useState, useEffect } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { usePageTitle } from '@/hooks/use-page-title';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Eye, EyeOff, Lock, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { passwordResetSchema } from '@shared/schema';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import oficazLogo from '@/assets/oficaz-logo.png';

type ResetPasswordData = z.infer<typeof passwordResetSchema>;

export default function ResetPassword() {
  usePageTitle('Restablecer Contraseña');
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);

  // Extract token from URL parameters
  const token = new URLSearchParams(searchParams).get('token');

  const form = useForm<ResetPasswordData>({
    resolver: zodResolver(passwordResetSchema),
    defaultValues: { 
      token: token || '',
      password: '',
      confirmPassword: ''
    },
  });

  // Set dark notch for dark background
  useEffect(() => {
    document.documentElement.classList.add('dark-notch');
    return () => {
      document.documentElement.classList.remove('dark-notch');
    };
  }, []);

  // Validate token on component mount
  useEffect(() => {
    if (!token) {
      setTokenValid(false);
      setError('Token de recuperación no válido o faltante.');
      return;
    }

    const validateToken = async () => {
      try {
        await apiRequest('POST', '/api/auth/validate-reset-token', { token });
        setTokenValid(true);
      } catch (error: any) {
        console.error('Token validation failed:', error);
        setTokenValid(false);
        
        if (error.message?.includes('expired')) {
          setError('El enlace de recuperación ha expirado. Solicita uno nuevo.');
        } else if (error.message?.includes('invalid')) {
          setError('El enlace de recuperación no es válido.');
        } else {
          setError('Error al validar el enlace de recuperación.');
        }
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (data: ResetPasswordData) => {
    setSubmitting(true);
    setError(null);
    
    try {
      await apiRequest('POST', '/api/auth/reset-password', data);
      setSuccess(true);
    } catch (error: any) {
      console.error('Password reset failed:', error);
      
      if (error.message?.includes('expired')) {
        setError('El enlace de recuperación ha expirado. Solicita uno nuevo.');
      } else if (error.message?.includes('invalid')) {
        setError('El enlace de recuperación no es válido.');
      } else {
        setError('Error al cambiar la contraseña. Inténtalo de nuevo.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4 bg-gradient-to-br from-slate-900 to-slate-800">
        <Card className="w-full max-w-md shadow-2xl rounded-2xl border-0 bg-white">
          <CardHeader className="text-center pt-8 pb-6">
            <div className="flex justify-center mb-6">
              <img 
                src={oficazLogo} 
                alt="Oficaz" 
                className="h-10 w-auto"
              />
            </div>
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Contraseña actualizada
            </h1>
            <p className="text-gray-600 text-sm">
              Tu contraseña ha sido cambiada exitosamente
            </p>
          </CardHeader>

          <CardContent className="px-8 pb-8">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-green-700">
                Ya puedes usar tu nueva contraseña para iniciar sesión en tu cuenta.
              </p>
            </div>

            <div className="text-center">
              <Button
                onClick={() => setLocation('/login')}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                Ir al login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (tokenValid === false) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4 bg-gradient-to-br from-slate-900 to-slate-800">
        <Card className="w-full max-w-md shadow-2xl rounded-2xl border-0 bg-white">
          <CardHeader className="text-center pt-8 pb-6">
            <div className="flex justify-center mb-6">
              <img 
                src={oficazLogo} 
                alt="Oficaz" 
                className="h-10 w-auto"
              />
            </div>
            <div className="flex justify-center mb-4">
              <AlertCircle className="h-16 w-16 text-red-500" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Enlace no válido
            </h1>
            <p className="text-gray-600 text-sm">
              El enlace de recuperación no es válido o ha expirado
            </p>
          </CardHeader>

          <CardContent className="px-8 pb-8">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-700">
                {error || 'El enlace de recuperación no es válido o ha expirado. Solicita uno nuevo.'}
              </p>
            </div>

            <div className="text-center space-y-3">
              <Button
                onClick={() => setLocation('/forgot-password')}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                Solicitar nuevo enlace
              </Button>
              <Link 
                href="/login"
                className="block text-sm text-blue-600 hover:text-blue-700 hover:underline"
              >
                Volver al login
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
            <img 
              src={oficazLogo} 
              alt="Oficaz" 
              className="h-10 w-auto"
            />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Nueva contraseña
          </h1>
          <p className="text-gray-600 text-sm">
            Introduce tu nueva contraseña
          </p>
        </CardHeader>

        <CardContent className="px-8 pb-8">
          {tokenValid === null ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="sm" />
              <span className="ml-2 text-gray-600">Validando enlace...</span>
            </div>
          ) : (
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Password Field */}
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  {...form.register('password')}
                  placeholder="Nueva contraseña"
                  className="rounded-xl border border-gray-300 py-3 px-4 pr-16 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  onChange={(e) => {
                    form.setValue('password', e.target.value);
                    setError(null);
                  }}
                />
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </Button>
                  <Lock className="h-4 w-4 text-gray-400" />
                </div>
                {form.formState.errors.password && (
                  <p className="text-xs text-red-500 mt-1">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>

              {/* Confirm Password Field */}
              <div className="relative">
                <Input
                  type={showConfirmPassword ? 'text' : 'password'}
                  {...form.register('confirmPassword')}
                  placeholder="Confirmar contraseña"
                  className="rounded-xl border border-gray-300 py-3 px-4 pr-16 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  onChange={(e) => {
                    form.setValue('confirmPassword', e.target.value);
                    setError(null);
                  }}
                />
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </Button>
                  <Lock className="h-4 w-4 text-gray-400" />
                </div>
                {form.formState.errors.confirmPassword && (
                  <p className="text-xs text-red-500 mt-1">
                    {form.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>

              {/* Password Requirements */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-700 font-medium mb-1">Requisitos de contraseña:</p>
                <ul className="text-xs text-blue-600 space-y-1">
                  <li>• Mínimo 8 caracteres</li>
                  <li>• Al menos una mayúscula y minúscula</li>
                  <li>• Al menos un número</li>
                  <li>• Al menos un carácter especial</li>
                </ul>
              </div>

              {/* Submit Button */}
              <Button 
                type="submit" 
                className="w-full rounded-xl py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                disabled={submitting}
              >
                {submitting ? (
                  <div className="flex items-center gap-2">
                    <LoadingSpinner size="xs" />
                    Cambiando contraseña...
                  </div>
                ) : (
                  'Cambiar contraseña'
                )}
              </Button>

              {/* Back to Login Link */}
              <div className="text-center mt-6">
                <Link 
                  href="/login"
                  className="text-sm text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center"
                >
                  <ArrowLeft className="h-3 w-3 mr-1" />
                  Volver al login
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}