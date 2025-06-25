import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation, useSearch } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, ArrowRight, ArrowLeft, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import oficazLogo from '@assets/oficaz logo_1750516757063.png';

const codeSchema = z.object({
  code: z.string().min(6, 'El código debe tener 6 dígitos').max(6, 'El código debe tener 6 dígitos'),
});

type CodeData = z.infer<typeof codeSchema>;

export default function VerifyCode() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  
  // Get sessionId from URL params
  const params = new URLSearchParams(search);
  const sessionId = params.get('session');

  const form = useForm<CodeData>({
    resolver: zodResolver(codeSchema),
    defaultValues: {
      code: '',
    },
  });

  // Redirect if no sessionId provided
  useEffect(() => {
    if (!sessionId) {
      setLocation('/request-code');
    }
  }, [sessionId, setLocation]);

  const handleSubmit = async (data: CodeData) => {
    if (!sessionId) return;
    
    setIsLoading(true);
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
        toast({
          title: 'Código verificado',
          description: 'Email verificado correctamente. Continúa con el registro.',
        });
        
        // Redirect to registration with verification token
        setLocation(`/register?token=${result.verificationToken}`);
      } else {
        toast({
          title: 'Código incorrecto',
          description: result.message || 'El código no es válido o ha expirado.',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('Verify error:', error);
      toast({
        title: 'Error',
        description: 'Ha ocurrido un error inesperado: ' + error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = () => {
    // Redirect to request-code page for new verification
    setLocation('/request-code');
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
              Revisa también tu carpeta de spam
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
                />
              </div>
              {form.formState.errors.code && (
                <p className="text-sm text-red-600">{form.formState.errors.code.message}</p>
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
                disabled={isLoading}
              >
                Solicitar nuevo código
                <RotateCcw className="h-4 w-4 ml-2" />
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
            <div className="text-sm text-gray-500">
              ¿No has recibido el código?{' '}
              <Button 
                variant="link" 
                onClick={() => setLocation('/request-code')}
                className="p-0 h-auto text-blue-600 hover:text-blue-800"
              >
                Solicitar nuevo código
              </Button>
            </div>
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