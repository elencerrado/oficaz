import { useState, useEffect } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { usePageTitle } from '@/hooks/use-page-title';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Lock, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import oficazLogo from '@/assets/oficaz-logo.png';

// Extended schema to include acceptTerms and acceptSimplePassword
const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(1, 'Contraseña requerida'),
  confirmPassword: z.string().min(1, 'Confirma tu contraseña'),
  acceptTerms: z.boolean().refine(val => val === true, {
    message: 'Debes aceptar los términos y la política de privacidad',
  }),
  acceptSimplePassword: z.boolean().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
}).refine((data) => {
  // Si no acepta contraseña simple, aplicar validaciones estrictas
  if (!data.acceptSimplePassword) {
    if (data.password.length < 8) return false;
    if (!/[A-Z]/.test(data.password)) return false;
    if (!/[a-z]/.test(data.password)) return false;
    if (!/[0-9]/.test(data.password)) return false;
    if (!/[^A-Za-z0-9]/.test(data.password)) return false;
  } else {
    // Si acepta contraseña simple, solo requerir mínimo 6 caracteres
    if (data.password.length < 6) return false;
  }
  return true;
}, {
  message: 'La contraseña no cumple con los requisitos',
  path: ['password'],
});

type ResetPasswordData = z.infer<typeof resetPasswordSchema>;

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
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { 
      token: token || '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
      acceptSimplePassword: false,
    },
  });

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
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Nueva contraseña</label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    {...form.register('password')}
                    placeholder="Mínimo 8 caracteres"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {form.formState.errors.password && (
                  <p className="text-xs text-red-500 mt-1">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>

              {/* Confirm Password Field */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Confirmar contraseña</label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    {...form.register('confirmPassword')}
                    placeholder="Repite la contraseña"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {form.formState.errors.confirmPassword && (
                  <p className="text-xs text-red-500 mt-1">
                    {form.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>

              {/* Simple Password Option */}
              <div className="flex items-start gap-2 py-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <Checkbox
                  id="acceptSimplePassword"
                  checked={form.watch('acceptSimplePassword') || false}
                  onCheckedChange={(checked) => form.setValue('acceptSimplePassword', checked as boolean)}
                />
                <Label htmlFor="acceptSimplePassword" className="text-sm text-amber-800 leading-relaxed cursor-pointer">
                  Acepto usar contraseña simple
                </Label>
              </div>

              {/* Password Requirements */}
              <div className={`${form.watch('acceptSimplePassword') ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'} border p-3 rounded-lg`}>
                <p className={`text-sm ${form.watch('acceptSimplePassword') ? 'text-amber-700' : 'text-blue-700'}`}>
                  <strong>{form.watch('acceptSimplePassword') ? 'Requisitos (contraseña simple):' : 'Requisitos de contraseña:'}</strong>
                </p>
                {form.watch('acceptSimplePassword') ? (
                  <ul className="text-xs text-amber-600 mt-1 space-y-1">
                    <li>• Mínimo 6 caracteres</li>
                    <li>• No uses datos personales</li>
                    <li>• No uses números sencillos tipo 123456</li>
                  </ul>
                ) : (
                  <ul className="text-xs text-blue-600 mt-1 space-y-1">
                    <li>• Mínimo 8 caracteres</li>
                    <li>• Al menos una mayúscula</li>
                    <li>• Al menos una minúscula</li>
                    <li>• Al menos un número</li>
                    <li>• Al menos un carácter especial (!@#$%^&*...)</li>
                  </ul>
                )}
              </div>

              {/* Accept Terms Checkbox */}
              <div className="flex items-start gap-2 py-2">
                <Checkbox
                  id="acceptTerms"
                  checked={form.watch('acceptTerms') || false}
                  onCheckedChange={(checked) => form.setValue('acceptTerms', checked as boolean)}
                />
                <Label htmlFor="acceptTerms" className="text-sm text-gray-700 leading-relaxed cursor-pointer">
                  Acepto la{' '}
                  <a href="/politica-privacidad" target="_blank" className="text-blue-600 hover:underline">Política de Privacidad</a>
                  {' '}y los{' '}
                  <a href="/terminos" target="_blank" className="text-blue-600 hover:underline">Términos de Servicio</a>
                </Label>
              </div>
              {form.formState.errors.acceptTerms && (
                <p className="text-sm text-red-500 text-center">{form.formState.errors.acceptTerms.message}</p>
              )}

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