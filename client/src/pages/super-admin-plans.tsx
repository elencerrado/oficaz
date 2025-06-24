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
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    pricePerUser: '',
    maxUsers: '',
    features: {
      messages: true,
      documents: true,
      vacation: true,
      timeTracking: true,
      reports: false,
      analytics: false,
      customization: false,
      api: false,
    }
  });

  const { data: plans, isLoading } = useQuery({
    queryKey: ['/api/super-admin/subscription-plans'],
    retry: false,
  });

  const createPlanMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/super-admin/subscription-plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('superAdminToken')}`,
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Error al crear el plan');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Plan creado",
        description: "El plan de suscripción ha sido creado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/subscription-plans'] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el plan",
        variant: "destructive",
      });
    },
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
      setIsDialogOpen(false);
      setEditingPlan(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el plan",
        variant: "destructive",
      });
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/super-admin/subscription-plans/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('superAdminToken')}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Error al eliminar el plan');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Plan eliminado",
        description: "El plan de suscripción ha sido eliminado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/subscription-plans'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el plan",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      displayName: '',
      pricePerUser: '',
      maxUsers: '',
      features: {
        messages: true,
        documents: true,
        vacation: true,
        timeTracking: true,
        reports: false,
        analytics: false,
        customization: false,
        api: false,
      }
    });
  };

  const handleEdit = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      displayName: plan.displayName,
      pricePerUser: plan.pricePerUser,
      maxUsers: plan.maxUsers?.toString() || '',
      features: { ...plan.features }
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const data = {
      name: formData.name.toLowerCase(),
      displayName: formData.displayName,
      pricePerUser: formData.pricePerUser,
      maxUsers: formData.maxUsers ? parseInt(formData.maxUsers) : null,
      features: formData.features
    };

    if (editingPlan) {
      updatePlanMutation.mutate({ id: editingPlan.id, data });
    } else {
      createPlanMutation.mutate(data);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Planes</h1>
          <p className="text-gray-600 mt-1">Configura los planes de suscripción y sus funcionalidades</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingPlan(null); resetForm(); }}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Plan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingPlan ? 'Editar Plan' : 'Crear Nuevo Plan'}
              </DialogTitle>
              <DialogDescription>
                Configura los detalles del plan de suscripción y las funcionalidades incluidas
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Nombre interno</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="basic, pro, master"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="displayName">Nombre visible</Label>
                  <Input
                    id="displayName"
                    value={formData.displayName}
                    onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                    placeholder="Plan Básico"
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pricePerUser">Precio por usuario (€)</Label>
                  <Input
                    id="pricePerUser"
                    type="number"
                    step="0.01"
                    value={formData.pricePerUser}
                    onChange={(e) => setFormData(prev => ({ ...prev, pricePerUser: e.target.value }))}
                    placeholder="3.00"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="maxUsers">Límite de usuarios</Label>
                  <Input
                    id="maxUsers"
                    type="number"
                    value={formData.maxUsers}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxUsers: e.target.value }))}
                    placeholder="Dejar vacío para ilimitado"
                  />
                </div>
              </div>
              
              <div>
                <Label className="text-base font-medium">Funcionalidades incluidas</Label>
                <div className="mt-3 grid grid-cols-2 gap-4">
                  {Object.entries(featureLabels).map(([key, label]) => {
                    const Icon = featureIcons[key as keyof typeof featureIcons];
                    return (
                      <div key={key} className="flex items-center space-x-3">
                        <Switch
                          checked={formData.features[key as keyof typeof formData.features]}
                          onCheckedChange={(checked) =>
                            setFormData(prev => ({
                              ...prev,
                              features: { ...prev.features, [key]: checked }
                            }))
                          }
                        />
                        <Icon className="h-4 w-4 text-gray-500" />
                        <span className="text-sm">{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createPlanMutation.isPending || updatePlanMutation.isPending}
                >
                  {editingPlan ? 'Actualizar' : 'Crear'} Plan
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6">
        {plans?.map((plan: SubscriptionPlan) => (
          <Card key={plan.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <span>{plan.displayName}</span>
                    <Badge variant={plan.isActive ? "default" : "secondary"}>
                      {plan.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Plan {plan.name}
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(plan)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deletePlanMutation.mutate(plan.id)}
                    disabled={deletePlanMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center text-sm">
                    <Euro className="h-4 w-4 mr-2 text-green-600" />
                    <span className="font-medium">{plan.pricePerUser}€ por usuario/mes</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <Users className="h-4 w-4 mr-2 text-blue-600" />
                    <span>
                      {plan.maxUsers ? `Máximo ${plan.maxUsers} usuarios` : 'Usuarios ilimitados'}
                    </span>
                  </div>
                </div>
                
                <div className="md:col-span-2">
                  <h4 className="font-medium text-sm text-gray-900 mb-2">Funcionalidades</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(plan.features).map(([key, enabled]) => {
                      const Icon = featureIcons[key as keyof typeof featureIcons];
                      const label = featureLabels[key as keyof typeof featureLabels];
                      
                      if (!Icon) return null;
                      
                      return (
                        <div
                          key={key}
                          className={`flex items-center space-x-2 text-xs ${
                            enabled ? 'text-green-700' : 'text-gray-400'
                          }`}
                        >
                          <Icon className="h-3 w-3" />
                          <span>{label}</span>
                          {enabled && <span className="text-green-600">✓</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}