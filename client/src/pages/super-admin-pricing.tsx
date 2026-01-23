import { useState } from 'react';
import { usePageTitle } from '@/hooks/use-page-title';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { SuperAdminLayout } from '@/components/layout/super-admin-layout';
import { DollarSign, Users, Edit2, Check, X, AlertCircle } from 'lucide-react';
import { getAuthHeaders } from '@/lib/auth';

interface SeatPrice {
  id: number;
  roleType: string;
  displayName: string;
  monthlyPrice: string;
  description: string;
  isActive: boolean;
}

interface BasePrice {
  id: number;
  monthlyPrice: string;
}

export default function SuperAdminPricing() {
  usePageTitle('SuperAdmin - Gestión de Precios');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const [editingPrice, setEditingPrice] = useState<string>('');
  const [editingBasePrice, setEditingBasePrice] = useState<string>('');

  // Fetch seat prices
  const { data: seatPrices, isLoading: seatPricesLoading } = useQuery({
    queryKey: ['/api/super-admin/seat-prices'],
    queryFn: async () => {
      const response = await fetch('/api/super-admin/seat-prices', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch seat prices');
      return response.json();
    },
    retry: false,
  });

  // Fetch base subscription price
  const { data: basePrice } = useQuery({
    queryKey: ['/api/super-admin/base-subscription-price'],
    queryFn: async () => {
      const response = await fetch('/api/super-admin/base-subscription-price', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch base price');
      return response.json();
    },
    retry: false,
  });

  // Update seat price mutation
  const updateSeatPriceMutation = useMutation({
    mutationFn: async ({ id, monthlyPrice }: { id: number; monthlyPrice: string }) => {
      const response = await fetch(`/api/super-admin/seat-prices/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ monthlyPrice: parseFloat(monthlyPrice) }),
      });
      
      if (!response.ok) {
        throw new Error('Error al actualizar el precio');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: '✅ Precio actualizado',
        description: 'El precio ha sido actualizado en la base de datos',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/seat-prices'] });
      setEditingRoleId(null);
      setEditingPrice('');
    },
    onError: (error: any) => {
      toast({
        title: '❌ Error',
        description: error.message || 'No se pudo actualizar el precio',
        variant: 'destructive',
      });
    },
  });

  // Update base price mutation
  const updateBasePriceMutation = useMutation({
    mutationFn: async (monthlyPrice: string) => {
      const response = await fetch('/api/super-admin/base-subscription-price', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ monthlyPrice: parseFloat(monthlyPrice) }),
      });
      
      if (!response.ok) {
        throw new Error('Error al actualizar el precio base');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: '✅ Precio base actualizado',
        description: 'El precio base de suscripción se ha actualizado',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/base-subscription-price'] });
      setEditingBasePrice('');
    },
    onError: (error: any) => {
      toast({
        title: '❌ Error',
        description: error.message || 'No se pudo actualizar el precio base',
        variant: 'destructive',
      });
    },
  });

  const roleIcons: Record<string, any> = {
    admin: '👑',
    manager: '👔',
    employee: '👤',
  };


  return (
    <SuperAdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <DollarSign className="w-8 h-8 text-emerald-400" />
            Gestión de Precios
          </h1>
          <p className="text-white/70 mt-2">
            Configura los precios de suscripción y seats que se aplicarán en toda la plataforma
          </p>
        </div>

        {/* Warning Alert */}
        <Card className="!bg-yellow-500/10 !border-yellow-500/30">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-200">
                Los cambios de precios se aplicarán automáticamente a todas las empresas nuevas y a los recálculos mensuales. 
                Las suscripciones activas mantendrán sus precios actuales hasta el próximo ciclo de facturación.
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Base Subscription Price Card */}
        <Card className="!bg-white/10 backdrop-blur-xl !border-white/20">
          <CardHeader className="bg-gradient-to-r from-blue-500/20 to-blue-600/20">
            <CardTitle className="text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Precio Base de Suscripción
            </CardTitle>
            <CardDescription>Precio mensual base (módulo Oficaz)</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="bg-white/5 p-4 rounded-lg border border-white/10">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-white/80 text-sm mb-2">Precio mensual actual</p>
                  <p className="text-3xl font-bold text-white">
                    {basePrice ? `€${parseFloat(basePrice.monthlyPrice || '0').toFixed(2)}/mes` : 'Cargando...'}
                  </p>
                </div>
                <div className="flex-1">
                  {editingBasePrice ? (
                    <div className="space-y-2">
                      <Input
                        type="number"
                        placeholder="Nuevo precio"
                        value={editingBasePrice}
                        onChange={(e) => setEditingBasePrice(e.target.value)}
                        step="0.01"
                        min="0"
                        className="bg-white/10 border-white/20 text-white"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => updateBasePriceMutation.mutate(editingBasePrice)}
                          disabled={updateBasePriceMutation.isPending}
                          className="bg-emerald-600 hover:bg-emerald-700 flex-1"
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Guardar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingBasePrice('')}
                          className="text-white/60"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      onClick={() => setEditingBasePrice(basePrice?.monthlyPrice || '0')}
                      variant="outline"
                      className="bg-white/10 border-white/20 text-white hover:bg-white/20 w-full"
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      Editar precio
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Seat Prices Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {seatPrices?.map((seat: SeatPrice) => (
            <Card
              key={seat.id}
              className={`!backdrop-blur-xl !border-white/20 transition-all ${
                seat.roleType === 'admin'
                  ? '!bg-gradient-to-br from-purple-500/20 to-purple-600/20'
                  : seat.roleType === 'manager'
                    ? '!bg-gradient-to-br from-blue-500/20 to-blue-600/20'
                    : '!bg-gradient-to-br from-emerald-500/20 to-emerald-600/20'
              }`}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">{roleIcons[seat.roleType]}</span>
                    <div>
                      <CardTitle className="text-white text-lg">
                        {seat.displayName}
                      </CardTitle>
                      <p className="text-xs text-white/60 mt-1">Precio por asiento mensual</p>
                    </div>
                  </div>
                  {seat.isActive && (
                    <Badge className="bg-emerald-500 text-white">Activo</Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Price Display */}
                <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                  <p className="text-white/70 text-sm mb-2">Precio actual</p>
                  <div className="text-center">
                    <p className="text-4xl font-bold text-white">
                      €{parseFloat(seat.monthlyPrice || '0').toFixed(2)}
                    </p>
                    <p className="text-xs text-white/60 mt-1">por {seat.displayName.toLowerCase()} al mes</p>
                  </div>
                </div>

                {/* Edit Price */}
                {editingRoleId === seat.id ? (
                  <div className="space-y-2">
                    <Input
                      type="number"
                      placeholder="Nuevo precio"
                      value={editingPrice}
                      onChange={(e) => setEditingPrice(e.target.value)}
                      step="0.01"
                      min="0"
                      className="bg-white/10 border-white/20 text-white"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() =>
                          updateSeatPriceMutation.mutate({
                            id: seat.id,
                            monthlyPrice: editingPrice,
                          })
                        }
                        disabled={updateSeatPriceMutation.isPending}
                        className="bg-emerald-600 hover:bg-emerald-700 flex-1"
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Guardar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingRoleId(null)}
                        className="text-white/60"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    onClick={() => {
                      setEditingRoleId(seat.id);
                      setEditingPrice(seat.monthlyPrice);
                    }}
                    variant="outline"
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20 w-full"
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Editar precio
                  </Button>
                )}

                {/* Description */}
                {seat.description && (
                  <p className="text-xs text-white/60 text-center italic">
                    {seat.description}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Price Calculation Example */}
        <Card className="!bg-white/5 !border-white/20">
          <CardHeader>
            <CardTitle className="text-white">Ejemplo de Cálculo de Suscripción</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                  <p className="text-white/70 text-sm mb-2">Precio Base</p>
                  <p className="text-2xl font-bold text-white">
                    €{basePrice ? parseFloat(basePrice.monthlyPrice || '0').toFixed(2) : '0.00'}
                  </p>
                </div>
                <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                  <p className="text-white/70 text-sm mb-2">Ejemplo: 2 Admins + 1 Gestor</p>
                  <p className="text-2xl font-bold text-emerald-400">
                    €
                    {(
                      parseFloat(basePrice?.monthlyPrice || '0') +
                      2 * parseFloat(seatPrices?.find((s: SeatPrice) => s.roleType === 'admin')?.monthlyPrice || '0') +
                      1 * parseFloat(seatPrices?.find((s: SeatPrice) => s.roleType === 'manager')?.monthlyPrice || '0')
                    ).toFixed(2)}
                  </p>
                </div>
              </div>
              <p className="text-xs text-white/60">
                El precio total = Precio Base + (Admins × €{seatPrices?.find((s: SeatPrice) => s.roleType === 'admin')?.monthlyPrice || '0'}) + (Gestores × €{seatPrices?.find((s: SeatPrice) => s.roleType === 'manager')?.monthlyPrice || '0'}) + (Empleados × €{seatPrices?.find((s: SeatPrice) => s.roleType === 'employee')?.monthlyPrice || '0'})
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="!bg-blue-500/10 !border-blue-500/30">
          <CardContent className="pt-6">
            <div className="space-y-2 text-sm text-blue-200">
              <p>✅ Los precios se sincronizan automáticamente con:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Cálculos de suscripción por empresa</li>
                <li>Facturación y recalculos mensuales</li>
                <li>Landing page y tienda de add-ons</li>
                <li>Estimaciones de precio antes de checkout</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}
