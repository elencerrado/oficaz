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
import { apiRequest } from '@/lib/queryClient';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

const activationSchema = z.object({
  password: z.string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
    .regex(/[a-z]/, 'Debe contener al menos una minúscula')
    .regex(/[0-9]/, 'Debe contener al menos un número')
    .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Debe contener al menos un carácter especial'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

type ActivationFormData = z.infer<typeof activationSchema>;

export default function EmployeeActivation() {
  usePageTitle('Activar Cuenta');
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [token, setToken] = useState<string>('');

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
      confirmPassword: ''
    }
  });

  const activateAccountMutation = useMutation({
    mutationFn: async (data: ActivationFormData) => {
      return apiRequest('POST', '/api/auth/activate-account', {
        token,
        password: data.password
      });
    },
    onSuccess: () => {
      setLocation('/login?activated=true');
    }
  });

  const onSubmit = async (data: ActivationFormData) => {
    activateAccountMutation.mutate(data);
  };

  if (!token) {
    return null; // Redirecting...
  }

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center space-x-2">
              <LoadingSpinner size="sm" />
              <span>Verificando token de activación...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
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
                          onClick={() => setShowPassword(!showPassword)}
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
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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

              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>Requisitos de contraseña:</strong>
                </p>
                <ul className="text-xs text-blue-600 mt-1 space-y-1">
                  <li>• Mínimo 8 caracteres</li>
                  <li>• Al menos una mayúscula</li>
                  <li>• Al menos una minúscula</li>
                  <li>• Al menos un número</li>
                  <li>• Al menos un carácter especial (!@#$%^&*...)</li>
                </ul>
              </div>

              {activateAccountMutation.error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {activateAccountMutation.error instanceof Error 
                      ? activateAccountMutation.error.message 
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