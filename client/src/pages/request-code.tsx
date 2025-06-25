import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Mail, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import oficazLogo from '@assets/oficaz logo_1750516757063.png';

const emailSchema = z.object({
  email: z.string().email('Email no válido'),
});

type EmailData = z.infer<typeof emailSchema>;

export default function RequestCode() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<EmailData>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      email: '',
    },
  });

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
        toast({
          title: 'Código generado',
          description: 'Revisa los logs del servidor para obtener tu código de verificación.',
        });
        
        // Redirect to verification page with email
        setLocation(`/verify-code?email=${encodeURIComponent(data.email)}`);
      } else {
        toast({
          title: 'Error',
          description: result.message || 'No se pudo enviar el código.',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('Request error:', error);
      toast({
        title: 'Error',
        description: 'Ha ocurrido un error inesperado: ' + error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

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
              Crear nueva empresa
            </h1>
            <p className="text-gray-600">
              Introduce tu email para comenzar el registro
            </p>
          </div>

          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email del administrador</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  className="pl-10 rounded-xl"
                  {...form.register('email')}
                  placeholder="admin@miempresa.com"
                />
              </div>
              {form.formState.errors.email && (
                <p className="text-sm text-red-600">{form.formState.errors.email.message}</p>
              )}
              <p className="text-xs text-gray-500">
                Te enviaremos un código de verificación a este email
              </p>
            </div>

            <Button 
              type="submit" 
              className="w-full rounded-xl" 
              disabled={isLoading}
            >
              {isLoading ? 'Enviando código...' : 'Enviar código de verificación'}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </form>

          <div className="mt-6 text-center">
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