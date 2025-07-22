import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Pencil, Euro, Users } from 'lucide-react';

interface SubscriptionPlan {
  id: number;
  name: string;
  displayName: string;
  pricePerUser: string;
  maxUsers: number | null;
  features: {
    messages?: boolean;
    documents?: boolean;
    vacation?: boolean;
    timeTracking?: boolean;
    timeEditingPermissions?: boolean;
    analytics?: boolean;
    customization?: boolean;
    logoUpload?: boolean;
    api?: boolean;
    reminders?: boolean;
    employee_time_edit_permission?: boolean;
    employee_time_edit?: boolean;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function SuperAdminPlans() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingPlanName, setEditingPlanName] = useState<number | null>(null);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [editingPrice, setEditingPrice] = useState<number | null>(null);
  const [editingMaxUsers, setEditingMaxUsers] = useState<number | null>(null);

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ['/api/super-admin/subscription-plans'],
    queryFn: async () => {
      const token = localStorage.getItem('superAdminToken');
      const response = await fetch('/api/super-admin/subscription-plans', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch plans');
      return response.json();
    },
    retry: false,
  });

  const updatePlanMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await fetch(`/api/super-admin/subscription-plans/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('superAdminToken')}`,
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Error al actualizar el plan');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Plan actualizado",
        description: "El plan de suscripción ha sido actualizado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/subscription-plans'] });
      setEditingPlanName(null);
      setEditingPrice(null);
      setEditingMaxUsers(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el plan",
        variant: "destructive",
      });
    },
  });

  const handlePriceChange = (planId: number, newPrice: string) => {
    if (newPrice && !isNaN(parseFloat(newPrice))) {
      updatePlanMutation.mutate({
        id: planId,
        data: { pricePerUser: parseFloat(newPrice) }
      });
    }
    setEditingPrice(null);
  };

  const handleNameEdit = (planId: number, currentName: string) => {
    setEditingPlanName(planId);
    setNewDisplayName(currentName);
  };

  const saveName = (planId: number) => {
    updatePlanMutation.mutate({
      id: planId,
      data: { displayName: newDisplayName }
    });
  };

  const handleMaxUsersChange = (planId: number, maxUsers: string) => {
    updatePlanMutation.mutate({
      id: planId,
      data: { maxUsers: maxUsers ? parseInt(maxUsers) : null }
    });
    setEditingMaxUsers(null);
  };

  if (plansLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-xl border-b border-white/20">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Gestión de Planes</h1>
              <p className="text-white/60 mt-1">Configura los planes de suscripción y precios</p>
            </div>
            <Button 
              variant="ghost" 
              className="text-white/80 hover:text-white hover:bg-white/10"
              onClick={() => window.history.back()}
            >
              ← Volver
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="grid gap-6">
          {plans?.map((plan: SubscriptionPlan) => (
            <Card key={plan.id} className="bg-white/10 backdrop-blur-xl border-white/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {editingPlanName === plan.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={newDisplayName}
                          onChange={(e) => setNewDisplayName(e.target.value)}
                          className="h-8 bg-white/10 border-white/20 text-white"
                          onBlur={() => saveName(plan.id)}
                          onKeyDown={(e) => e.key === 'Enter' && saveName(plan.id)}
                          autoFocus
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-white text-xl capitalize">
                          {plan.displayName}
                        </CardTitle>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-white/60 hover:text-white h-6 w-6 p-0"
                          onClick={() => handleNameEdit(plan.id, plan.displayName)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    <Badge 
                      variant={plan.isActive ? "default" : "secondary"}
                      className={plan.isActive ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400"}
                    >
                      {plan.isActive ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Precio */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Euro className="h-4 w-4 text-blue-400" />
                      <label className="text-white/80 text-sm font-medium">Precio mensual</label>
                    </div>
                    {editingPrice === plan.id ? (
                      <Input
                        type="number"
                        step="0.01"
                        defaultValue={plan.pricePerUser}
                        className="bg-white/10 border-white/20 text-white"
                        onBlur={(e) => handlePriceChange(plan.id, e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handlePriceChange(plan.id, e.currentTarget.value)}
                        autoFocus
                      />
                    ) : (
                      <div 
                        className="cursor-pointer hover:bg-white/10 p-2 rounded border border-white/20"
                        onClick={() => setEditingPrice(plan.id)}
                      >
                        <span className="text-white font-semibold text-lg">
                          €{plan.pricePerUser}
                        </span>
                        <span className="text-white/60 text-sm ml-1">/mes</span>
                      </div>
                    )}
                  </div>

                  {/* Límite de usuarios */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-green-400" />
                      <label className="text-white/80 text-sm font-medium">Límite de usuarios</label>
                    </div>
                    {editingMaxUsers === plan.id ? (
                      <Input
                        type="number"
                        placeholder="Sin límite"
                        defaultValue={plan.maxUsers || ''}
                        className="bg-white/10 border-white/20 text-white"
                        onBlur={(e) => handleMaxUsersChange(plan.id, e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleMaxUsersChange(plan.id, e.currentTarget.value)}
                        autoFocus
                      />
                    ) : (
                      <div 
                        className="cursor-pointer hover:bg-white/10 p-2 rounded border border-white/20"
                        onClick={() => setEditingMaxUsers(plan.id)}
                      >
                        <span className="text-white font-semibold text-lg">
                          {plan.maxUsers || '∞'}
                        </span>
                        <span className="text-white/60 text-sm ml-1">usuarios</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Features disponibles */}
                <div className="pt-4 border-t border-white/20">
                  <h4 className="text-white/80 text-sm font-medium mb-3">Funcionalidades incluidas:</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {Object.entries(plan.features)
                      .filter(([, enabled]) => enabled)
                      .map(([feature]) => (
                        <Badge 
                          key={feature} 
                          variant="outline" 
                          className="border-white/20 text-white/80 bg-white/5"
                        >
                          {feature === 'timeTracking' ? 'Fichajes' :
                           feature === 'vacation' ? 'Vacaciones' :
                           feature === 'messages' ? 'Mensajes' :
                           feature === 'documents' ? 'Documentos' :
                           feature === 'reminders' ? 'Recordatorios' :
                           feature === 'analytics' ? 'Analíticas' :
                           feature === 'logoUpload' ? 'Logo personalizado' :
                           feature === 'api' ? 'API' :
                           feature === 'customization' ? 'Personalización' :
                           feature === 'employee_time_edit' ? 'Edición de tiempos' :
                           feature}
                        </Badge>
                      ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}