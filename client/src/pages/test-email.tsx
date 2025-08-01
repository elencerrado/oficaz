import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

const emailSchema = z.object({
  testEmail: z.string().email('Email no válido'),
});

type EmailData = z.infer<typeof emailSchema>;

export default function TestEmail() {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const form = useForm<EmailData>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      testEmail: '',
    },
  });

  const handleSubmit = async (data: EmailData) => {
    setIsLoading(true);
    setStatus('idle');
    setMessage('');

    try {
      const response = await fetch('/api/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok) {
        setStatus('success');
        setMessage(`Email de prueba enviado correctamente. Message ID: ${result.messageId}`);
      } else {
        setStatus('error');
        setMessage(result.error || 'Error al enviar email de prueba');
      }
    } catch (error) {
      setStatus('error');
      setMessage('Error de conexión al servidor');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center flex items-center justify-center gap-2">
            <Mail className="h-5 w-5" />
            Probar Envío de Email
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-yellow-700 font-medium">
                  Página de diagnóstico
                </p>
                <p className="text-xs text-yellow-600 mt-1">
                  Esta página permite probar si el sistema de email funciona correctamente. 
                  El código de prueba será <strong>123456</strong>.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="testEmail">Email de prueba</Label>
              <Input
                id="testEmail"
                type="email"
                placeholder="test@ejemplo.com"
                {...form.register('testEmail')}
              />
              {form.formState.errors.testEmail && (
                <p className="text-sm text-red-600">
                  {form.formState.errors.testEmail.message}
                </p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading ? 'Enviando...' : 'Enviar Email de Prueba'}
            </Button>
          </form>

          {status !== 'idle' && (
            <div className={`rounded-lg p-3 ${
              status === 'success' 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-start gap-2">
                {status === 'success' ? (
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                )}
                <p className={`text-sm ${
                  status === 'success' ? 'text-green-700' : 'text-red-700'
                }`}>
                  {message}
                </p>
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-700 font-medium mb-1">
              💡 Importante
            </p>
            <p className="text-xs text-blue-600">
              Si el envío es exitoso pero no recibes el email, 
              revisa tu carpeta de <strong>spam o correo no deseado</strong>.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}