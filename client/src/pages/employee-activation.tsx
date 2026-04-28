import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { usePageTitle } from '@/hooks/use-page-title';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/lib/queryClient';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { logger } from '@/lib/logger';
import { setAuthData } from '@/lib/auth';

const activationSchema = z.object({
  password: z.string().min(1, 'Contraseña requerida'),
  confirmPassword: z.string().min(1, 'Confirmación requerida'),
  acceptSimplePassword: z.boolean().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
}).refine((data) => {
  // Si no acepta contraseña simple, aplicar validaciones estrictas
  if (!data.acceptSimplePassword) {
    if (data.password.length < 8) return false;
    if (!/[A-Z]/.test(data.password)) return false;
    if (!/[a-z]/.test(data.password)) return false;
    if (!/[0-9]/.test(data.password)) return false;
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(data.password)) return false;
  } else {
    // Si acepta contraseña simple, solo requerir mínimo 6 caracteres
    if (data.password.length < 6) return false;
  }
  return true;
}, {
  message: 'La contraseña no cumple con los requisitos',
  path: ['password'],
});

type ActivationFormData = z.infer<typeof activationSchema>;

export default function EmployeeActivation() {
  usePageTitle('Activar Cuenta');
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [token, setToken] = useState<string>('');
  const [acceptSimplePassword, setAcceptSimplePassword] = useState(false);

  // Extract token from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      // Redirect to login if no token
      setLocation('/login');
    }
  }, [setLocation]);

  // Verify token validity
  const { data: tokenData, isLoading: isVerifying, error: tokenError } = useQuery({
    queryKey: ['/api/auth/verify-activation-token', token],
    queryFn: async () => {
      const response = await fetch(`/api/auth/verify-activation-token?token=${encodeURIComponent(token)}`);
      if (!response.ok) {
        throw new Error('Token inválido o expirado');
      }
      return response.json();
    },
    enabled: !!token,
    retry: false
  });

  const form = useForm<ActivationFormData>({
    resolver: zodResolver(activationSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
      acceptSimplePassword: false,
    }
  });

  const activateAccountMutation = useMutation({
    mutationFn: async (data: ActivationFormData) => {
      try {
        logger.log('📤 Sending activation request...');
        const response = await apiRequest('POST', '/api/auth/activate-account', {
          token,
          password: data.password,
          acceptSimplePassword: data.acceptSimplePassword,
        });
        logger.log('✅ Activation response:', response);
        return response;
      } catch (error) {
        console.error('❌ Activation request error:', error);
        throw error;
      }
    },
    onSuccess: (response: any) => {
      logger.log('🎉 Activation mutation succeeded:', response);
      
      // Check if we have the necessary data for auto-login
      if (!response.token || !response.user) {
        console.error('❌ No token or user in activation response');
        setLocation('/login?activated=true');
        return;
      }

      if (!response.company) {
        console.error('❌ No company in activation response');
        setLocation('/login?activated=true');
        return;
      }

      try {
        logger.log('💾 Saving auth data...');

        setAuthData({
          user: response.user,
          token: response.token,
          refreshToken: response.refreshToken,
          company: response.company,
          subscription: response.subscription,
        });

        const hasAuthData = !!localStorage.getItem('authData') || !!sessionStorage.getItem('authData');

        if (!hasAuthData) {
          console.error('❌ Failed to verify authData persistence');
          setLocation('/login?activated=true');
          return;
        }

        logger.log('✅ Auth data saved successfully');
        logger.log('🔄 Redirecting to dashboard with hard reload...');

        // Use replace to avoid adding to history
        setTimeout(() => {
          window.location.replace('/');
        }, 100);
      } catch (error) {
        console.error('❌ Error saving auth data:', error);
        setLocation('/login?activated=true');
      }
    },
    onError: (error: any) => {
      console.error('❌ Activation mutation failed:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Error al activar la cuenta';
      console.error('Error details:', errorMessage);
      setLocation('/login?activation-error=true');
    }
  });

  const onSubmit = async (data: ActivationFormData) => {
    logger.log('📝 Form submitted:', { hasPassword: !!data.password, hasConfirmPassword: !!data.confirmPassword, acceptSimplePassword: data.acceptSimplePassword });
    activateAccountMutation.mutate(data);
  };

  if (!token) {
    return null; // Redirecting...
  }

  if (isVerifying) {
    // Return null to avoid showing custom loading - use global app loader
    return null;
  }

  if (tokenError || !tokenData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <CardTitle className="text-red-600">Token inválido</CardTitle>
            <CardDescription>
              El enlace de activación no es válido o ha expirado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Por favor, contacta con tu administrador para solicitar un nuevo enlace de activación.
                </AlertDescription>
              </Alert>
              <Button 
                onClick={() => setLocation('/login')} 
                className="w-full"
                variant="outline"
              >
                Volver al login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <CardTitle className="text-2xl">¡Configura tu contraseña!</CardTitle>
          <CardDescription>
            Bienvenido <strong>{(tokenData as any)?.employeeName}</strong> a <strong>{(tokenData as any)?.companyName}</strong>
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nueva contraseña</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          type={showPassword ? "text" : "password"}
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
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar contraseña</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          type={showConfirmPassword ? "text" : "password"}
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
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Simple Password Option */}
              <div className="flex items-start gap-2 py-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <Checkbox
                  id="acceptSimplePassword"
                  checked={form.watch('acceptSimplePassword') || false}
                  onCheckedChange={(checked) => {
                    form.setValue('acceptSimplePassword', checked as boolean);
                    setAcceptSimplePassword(checked as boolean);
                  }}
                />
                <Label htmlFor="acceptSimplePassword" className="text-sm text-amber-800 leading-relaxed cursor-pointer">
                  Acepto usar contraseña simple
                </Label>
              </div>

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

              {activateAccountMutation.error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {activateAccountMutation.error instanceof Error 
                      ? activateAccountMutation.error.message 
                      : typeof activateAccountMutation.error === 'object' && activateAccountMutation.error !== null
                      ? (activateAccountMutation.error as any).message || 'Error al activar la cuenta. Inténtalo de nuevo.'
                      : 'Error al activar la cuenta. Inténtalo de nuevo.'}
                  </AlertDescription>
                </Alert>
              )}

              <Button 
                type="submit" 
                className="w-full"
                disabled={activateAccountMutation.isPending}
              >
                {activateAccountMutation.isPending ? (
                  <>
                    <LoadingSpinner size="xs" className="mr-2" />
                    Configurando...
                  </>
                ) : (
                  'Configurar contraseña'
                )}
              </Button>

            </form>
          </Form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              ¿Tienes problemas? Contacta con tu administrador.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}