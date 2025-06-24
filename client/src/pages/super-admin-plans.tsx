import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Pencil, Plus, Trash2, Euro, Users, Settings, MessageSquare, FileText, Calendar, Clock, BarChart3, Zap } from 'lucide-react';

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
    reports?: boolean;
    analytics?: boolean;
    customization?: boolean;
    api?: boolean;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const featureIcons = {
  messages: MessageSquare,
  documents: FileText,
  vacation: Calendar,
  timeTracking: Clock,
  reports: BarChart3,
  analytics: BarChart3,
  customization: Settings,
  api: Zap,
};

const featureLabels = {
  messages: 'Mensajes',
  documents: 'Documentos',
  vacation: 'Vacaciones',
  timeTracking: 'Fichajes',
  reports: 'Reportes',
  analytics: 'Analíticas',
  customization: 'Personalización',
  api: 'API',
};

export default function SuperAdminPlans() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingPlanName, setEditingPlanName] = useState<number | null>(null);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [editingPrice, setEditingPrice] = useState<number | null>(null);
  const [editingMaxUsers, setEditingMaxUsers] = useState<number | null>(null);

  const { data: plans, isLoading } = useQuery({
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
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el plan",
        variant: "destructive",
      });
    },
  });

  const handleFeatureToggle = (planId: number, feature: string, enabled: boolean) => {
    const plan = plans?.find((p: SubscriptionPlan) => p.id === planId);
    if (!plan) return;

    const updatedFeatures = {
      ...plan.features,
      [feature]: enabled
    };

    updatePlanMutation.mutate({
      id: planId,
      data: { features: updatedFeatures }
    });
  };

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full" />
      </div>
    );
  }

  const features = [
    { key: 'messages', label: 'Mensajes', icon: MessageSquare },
    { key: 'documents', label: 'Documentos', icon: FileText },
    { key: 'vacation', label: 'Vacaciones', icon: Calendar },
    { key: 'timeTracking', label: 'Fichajes', icon: Clock },
    { key: 'reports', label: 'Reportes', icon: BarChart3 },
    { key: 'analytics', label: 'Analíticas', icon: BarChart3 },
    { key: 'customization', label: 'Personalización', icon: Settings },
    { key: 'api', label: 'API', icon: Zap },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-xl border-b border-white/20">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Gestión de Planes</h1>
              <p className="text-white/60 mt-1">Configura los planes de suscripción y sus funcionalidades</p>
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

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Plans Configuration Table */}
        <Card className="bg-white/10 backdrop-blur-xl border-white/20">
          <CardHeader>
            <CardTitle className="text-white">Configuración de Planes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="text-left py-4 px-4 text-white font-medium">Funcionalidad</th>
                    {plans?.map((plan: SubscriptionPlan) => (
                      <th key={plan.id} className="text-center py-4 px-4 min-w-[180px]">
                        <div className="space-y-2">
                          {editingPlanName === plan.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                value={newDisplayName}
                                onChange={(e) => setNewDisplayName(e.target.value)}
                                className="h-8 bg-white/10 border-white/20 text-white text-center"
                                onBlur={() => saveName(plan.id)}
                                onKeyDown={(e) => e.key === 'Enter' && saveName(plan.id)}
                                autoFocus
                              />
                            </div>
                          ) : (
                            <h3 
                              className="text-white font-semibold text-lg cursor-pointer hover:text-white/80"
                              onClick={() => handleNameEdit(plan.id, plan.displayName)}
                            >
                              {plan.displayName}
                            </h3>
                          )}
                          <div className="space-y-1">
                            <div className="flex items-center justify-center gap-1">
                              <Euro className="h-3 w-3 text-green-400" />
                              {editingPrice === plan.id ? (
                                <Input
                                  type="number"
                                  step="0.01"
                                  defaultValue={plan.pricePerUser}
                                  className="h-7 w-16 bg-white/10 border-white/20 text-white text-center text-xs"
                                  onBlur={(e) => handlePriceChange(plan.id, e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && handlePriceChange(plan.id, e.currentTarget.value)}
                                  autoFocus
                                />
                              ) : (
                                <span 
                                  className="cursor-pointer hover:bg-white/10 px-1 rounded text-white text-xs"
                                  onClick={() => setEditingPrice(plan.id)}
                                >
                                  {plan.pricePerUser}
                                </span>
                              )}
                              <span className="text-white/60 text-xs">€/mes</span>
                            </div>
                            <div className="flex items-center justify-center gap-1">
                              <Users className="h-3 w-3 text-blue-400" />
                              {editingMaxUsers === plan.id ? (
                                <Input
                                  type="number"
                                  placeholder="∞"
                                  defaultValue={plan.maxUsers || ''}
                                  className="h-7 w-16 bg-white/10 border-white/20 text-white text-center text-xs"
                                  onBlur={(e) => handleMaxUsersChange(plan.id, e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && handleMaxUsersChange(plan.id, e.currentTarget.value)}
                                  autoFocus
                                />
                              ) : (
                                <span 
                                  className="cursor-pointer hover:bg-white/10 px-1 rounded text-white text-xs"
                                  onClick={() => setEditingMaxUsers(plan.id)}
                                >
                                  {plan.maxUsers || '∞'}
                                </span>
                              )}
                              <span className="text-white/60 text-xs">usuarios</span>
                            </div>
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {features.map((feature) => (
                    <tr key={feature.key} className="border-b border-white/10 hover:bg-white/5">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <feature.icon className="h-5 w-5 text-white/70" />
                          <span className="text-white font-medium">{feature.label}</span>
                        </div>
                      </td>
                      {plans?.map((plan: SubscriptionPlan) => (
                        <td key={`${plan.id}-${feature.key}`} className="py-4 px-4 text-center">
                          <Switch
                            checked={plan.features[feature.key] || false}
                            onCheckedChange={(enabled) => handleFeatureToggle(plan.id, feature.key, enabled)}
                            disabled={updatePlanMutation.isPending}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}