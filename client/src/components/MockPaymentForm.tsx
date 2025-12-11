import { useState } from 'react';
import { CreditCard, Lock, AlertCircle } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

interface MockPaymentFormProps {
  planName: string;
  planPrice: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export function MockPaymentForm({ 
  planName, 
  planPrice, 
  onSuccess, 
  onCancel 
}: MockPaymentFormProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvc, setCvc] = useState('');
  const [cardholderName, setCardholderName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!cardNumber || !expiryDate || !cvc || !cardholderName) {
      return;
    }

    setIsProcessing(true);
    
    // Simular procesamiento de pago
    setTimeout(() => {
      setIsProcessing(false);
      onSuccess();
    }, 2000);
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const formatExpiryDate = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  return (
    <div className="space-y-6">
      {/* Alert de modo demo - MUY VISIBLE */}
      <div className="bg-red-100 border-4 border-red-500 rounded-lg p-6 animate-pulse">
        <div className="flex items-center">
          <AlertCircle className="w-8 h-8 text-red-600 mr-3" />
          <div>
            <p className="text-xl font-bold text-red-800">
              🚨 MODO SIMULACIÓN - NO ES PAGO REAL 🚨
            </p>
            <p className="text-base text-red-700 mt-2 font-semibold">
              Esta es una simulación. Por eso cobra 0€ siempre. Stripe no funciona.
            </p>
          </div>
        </div>
      </div>

      {/* Resumen del plan */}
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium">{planName}</p>
              <p className="text-sm text-gray-500">Suscripción mensual</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-lg">€{planPrice.toFixed(2)}</p>
              <p className="text-xs text-gray-500">por mes</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Formulario de tarjeta */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="cardholderName">Nombre del titular</Label>
          <Input
            id="cardholderName"
            placeholder="Juan Pérez"
            value={cardholderName}
            onChange={(e) => setCardholderName(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cardNumber">Número de tarjeta</Label>
          <div className="relative">
            <Input
              id="cardNumber"
              placeholder="1234 5678 9012 3456"
              value={cardNumber}
              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
              maxLength={19}
              required
            />
            <CreditCard className="absolute right-3 top-2.5 w-5 h-5 text-gray-400" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="expiryDate">Fecha de vencimiento</Label>
            <Input
              id="expiryDate"
              placeholder="MM/AA"
              value={expiryDate}
              onChange={(e) => setExpiryDate(formatExpiryDate(e.target.value))}
              maxLength={5}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cvc">CVC</Label>
            <Input
              id="cvc"
              placeholder="123"
              value={cvc}
              onChange={(e) => setCvc(e.target.value.replace(/[^0-9]/gi, '').substring(0, 4))}
              maxLength={4}
              required
            />
          </div>
        </div>

        {/* Información de seguridad */}
        <div className="flex items-center text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
          <Lock className="w-4 h-4 mr-2" />
          <span>Tu información está protegida con cifrado SSL de 256 bits</span>
        </div>

        {/* Botones */}
        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isProcessing}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isProcessing || !cardNumber || !expiryDate || !cvc || !cardholderName}
            className="flex-1"
          >
            {isProcessing ? (
              <>
                <LoadingSpinner size="xs" className="mr-2" />
                Procesando...
              </>
            ) : (
              `Confirmar pago €${planPrice.toFixed(2)}`
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}