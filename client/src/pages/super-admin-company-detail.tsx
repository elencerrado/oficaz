import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Building2, Users, Crown, Settings, Edit2, Check, X, Euro } from 'lucide-react';

interface CompanyDetailProps {
  companyId: string;
}

const featureLabels = {
  messages: 'Mensajes',
  documents: 'Documentos',
  vacation: 'Vacaciones',
  timeTracking: 'Fichajes',
  timeEditingPermissions: 'Editar horas empleados',
  reports: 'Reportes',
  analytics: 'Analíticas',
  customization: 'Personalización',
  api: 'API',
};

const planColors = {
  free: 'bg-gray-500',
  basic: 'bg-blue-500',
  pro: 'bg-purple-500',
  master: 'bg-yellow-500'
};

const planLabels = {
  free: 'Free',
  basic: 'Basic',
  pro: 'Pro',
  master: 'Master'
};

export default function SuperAdminCompanyDetail({ companyId }: CompanyDetailProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [editingPlan, setEditingPlan] = useState(false);
  const [editingMaxUsers, setEditingMaxUsers] = useState(false);
  const [editingPrice, setEditingPrice] = useState(false);
  
  const [newPlan, setNewPlan] = useState('');
  const [newMaxUsers, setNewMaxUsers] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [useCustomSettings, setUseCustomSettings] = useState(false);
  const [customFeatures, setCustomFeatures] = useState<any>({});

  // Fetch company details
  const { data: company, isLoading } = useQuery({
    queryKey: ['/api/super-admin/companies', companyId],
    queryFn: async () => {
      const token = localStorage.getItem('superAdminToken');
      const response = await fetch(`/api/super-admin/companies/${companyId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch company');
      return response.json();
    },
    retry: false,
  });

  // Fetch available plans for dropdown
  const { data: plans } = useQuery({
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

  // Update company subscription mutation
  const updateCompanyMutation = useMutation({
    mutationFn: async (data: any) => {
      const token = localStorage.getItem('superAdminToken');
      const response = await fetch(`/api/super-admin/companies/${companyId}/subscription`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update company');
      return response.json();
    },
    onSuccess: (data) => {
      // Actualizar estado local con los datos del servidor
      if (data.subscription) {
        setUseCustomSettings(data.subscription.useCustomSettings || false);
        setCustomFeatures(data.subscription.features || {});
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/companies', companyId] });
      toast({
        title: "Éxito",
        description: "Empresa actualizada correctamente",
      });
      setEditingPlan(false);
      setEditingMaxUsers(false);
      setEditingPrice(false);
    },
    onError: (error: any) => {
      // Revertir cambios locales en caso de error
      if (company) {
        setUseCustomSettings(company.subscription.useCustomSettings || false);
        setCustomFeatures(company.subscription.features || {});
      }
      
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFeatureToggle = (feature: keyof typeof featureLabels, enabled: boolean) => {
    if (!company) return;
    
    const updatedFeatures = {
      ...company.subscription.features,
      [feature]: enabled
    };
    
    updateCompanyMutation.mutate({
      features: updatedFeatures
    });
  };

  const handlePlanSave = () => {
    if (!newPlan) return;
    
    // Si no usa configuración personalizada, actualizar funcionalidades automáticamente
    let finalFeatures = customFeatures;
    if (!useCustomSettings) {
      const planDefaults = plans?.find(p => p.name === newPlan)?.features;
      if (planDefaults) {
        finalFeatures = planDefaults;
        setCustomFeatures(planDefaults);
      }
    }

    updateCompanyMutation.mutate({ 
      plan: newPlan,
      features: finalFeatures,
      useCustomSettings
    });
  };

  const handleMaxUsersSave = () => {
    updateCompanyMutation.mutate({ 
      maxUsers: newMaxUsers ? parseInt(newMaxUsers) : null 
    });
  };

  const handlePriceSave = () => {
    if (!newPrice) return;
    updateCompanyMutation.mutate({ 
      customPricePerUser: parseFloat(newPrice) 
    });
  };

  const toggleCustomSettings = async () => {
    const newCustomState = !useCustomSettings;
    setUseCustomSettings(newCustomState);
    
    // Si desactiva personalización, resetear a configuración del plan
    if (!newCustomState) {
      const planFeatures = plans?.find(p => p.name === company?.subscription?.plan)?.features;
      if (planFeatures) {
        setCustomFeatures(planFeatures);
        // Guardar inmediatamente el cambio al desactivar personalización
        updateCompanyMutation.mutate({ 
          features: planFeatures,
          useCustomSettings: newCustomState
        });
      }
    } else {
      // Solo actualizar el estado de personalización cuando se activa
      updateCompanyMutation.mutate({ 
        useCustomSettings: newCustomState
      });
    }
  };

  const saveCustomSettings = async () => {
    try {
      updateCompanyMutation.mutate({ 
        features: customFeatures,
        useCustomSettings
      });
    } catch (error) {
      console.error('Error updating custom settings:', error);
    }
  };

  useEffect(() => {
    if (company) {
      setNewPlan(company.subscription.plan);
      setNewMaxUsers(company.subscription.maxUsers?.toString() || '');
      setNewPrice(company.subscription.customPricePerUser?.toString() || company.subscription.pricePerUser?.toString() || '');
      setCustomFeatures(company.subscription.features || {});
      
      // Usar el estado explícito de useCustomSettings de la base de datos
      setUseCustomSettings(company.subscription.useCustomSettings || false);
    }
  }, [company, plans]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-center">
          <h2 className="text-xl font-semibold mb-2">Empresa no encontrada</h2>
          <Button onClick={() => setLocation('/super-admin')} variant="outline">
            Volver al Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            onClick={() => setLocation('/super-admin')}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-white">Gestión de Empresa</h1>
            <p className="text-white/60">Configuración personalizada para {company.name}</p>
          </div>
        </div>

        {/* Company Info Card */}
        <Card className="bg-white/10 backdrop-blur-xl border-white/20 mb-8">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-white text-xl">{company.name}</CardTitle>
                <div className="flex items-center gap-4 text-sm text-white/60 mt-1">
                  <span>CIF: {company.cif}</span>
                  <span>•</span>
                  <span>{company.email}</span>
                  <span>•</span>
                  <span>{company.userCount} usuarios</span>
                </div>
              </div>
              <Badge 
                className={`${planColors[company.subscription.plan as keyof typeof planColors]} text-white`}
              >
                {planLabels[company.subscription.plan as keyof typeof planLabels]}
              </Badge>
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Plan & Pricing Configuration */}
          <Card className="bg-white/10 backdrop-blur-xl border-white/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Crown className="w-5 h-5" />
                Configuración de Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Plan Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/80">Plan de Suscripción</label>
                <div className="flex items-center gap-2">
                  {editingPlan ? (
                    <>
                      <Select value={newPlan} onValueChange={setNewPlan}>
                        <SelectTrigger className="flex-1 bg-white/10 border-white/20 text-white">
                          <SelectValue placeholder="Seleccionar plan" />
                        </SelectTrigger>
                        <SelectContent>
                          {plans?.map((plan: any) => (
                            <SelectItem key={plan.name} value={plan.name}>
                              {plan.displayName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" onClick={handlePlanSave} disabled={updateCompanyMutation.isPending}>
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingPlan(false)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Badge className={`${planColors[company.subscription.plan as keyof typeof planColors]} text-white flex-1 justify-center`}>
                        {planLabels[company.subscription.plan as keyof typeof planLabels]}
                      </Badge>
                      <Button size="sm" variant="ghost" onClick={() => setEditingPlan(true)} className="text-white/60">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Max Users */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/80">Límite de Usuarios</label>
                <div className="flex items-center gap-2">
                  {editingMaxUsers ? (
                    <>
                      <Input
                        type="number"
                        placeholder="∞ (ilimitado)"
                        value={newMaxUsers}
                        onChange={(e) => setNewMaxUsers(e.target.value)}
                        className="flex-1 bg-white/10 border-white/20 text-white"
                      />
                      <Button size="sm" onClick={handleMaxUsersSave} disabled={updateCompanyMutation.isPending}>
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingMaxUsers(false)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white">
                        {company.subscription.maxUsers || '∞ (ilimitado)'}
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => setEditingMaxUsers(true)} className="text-white/60">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Custom Price */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/80">Precio Personalizado (€/usuario/mes)</label>
                <div className="flex items-center gap-2">
                  {editingPrice ? (
                    <>
                      <div className="flex items-center flex-1">
                        <Euro className="w-4 h-4 text-white/60 absolute ml-3 z-10" />
                        <Input
                          type="number"
                          step="0.01"
                          value={newPrice}
                          onChange={(e) => setNewPrice(e.target.value)}
                          className="pl-8 bg-white/10 border-white/20 text-white"
                        />
                      </div>
                      <Button size="sm" onClick={handlePriceSave} disabled={updateCompanyMutation.isPending}>
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingPrice(false)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white flex items-center gap-2">
                        <Euro className="w-4 h-4 text-green-400" />
                        {company.subscription.customPricePerUser || company.subscription.pricePerUser || '0'}
                        <span className="text-white/60">€ fijo/mes</span>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => setEditingPrice(true)} className="text-white/60">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Features Configuration */}
          <Card className="bg-white/10 backdrop-blur-xl border-white/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Funcionalidades
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Toggle para configuración personalizada */}
              <div className="border border-white/20 rounded-lg p-4 bg-blue-500/10">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-medium text-white">Configuración Personalizada</h3>
                    <p className="text-xs text-white/60">
                      {useCustomSettings 
                        ? 'Esta empresa usa configuración personalizada independiente del plan' 
                        : 'Esta empresa sigue la configuración por defecto del plan seleccionado'
                      }
                    </p>
                  </div>
                  <Button
                    variant={useCustomSettings ? "destructive" : "default"}
                    size="sm"
                    onClick={toggleCustomSettings}
                    disabled={updateCompanyMutation.isPending}
                  >
                    {useCustomSettings ? 'Desactivar Personalización' : 'Activar Personalización'}
                  </Button>
                </div>
                <div className="text-xs text-white/50">
                  {useCustomSettings 
                    ? '⚙️ Las funcionalidades se pueden modificar individualmente'
                    : '📋 Las funcionalidades siguen automáticamente la configuración del plan'
                  }
                </div>
              </div>

              {/* Funcionalidades */}
              <div>
                {!useCustomSettings && (
                  <div className="mb-4 p-3 bg-white/5 border border-white/10 rounded-lg">
                    <p className="text-sm text-white/70">
                      🔒 Configuración automática según el plan "{company.subscription.plan}". 
                      Activa la personalización para modificar individualmente.
                    </p>
                  </div>
                )}
                
                <div className="space-y-3">
                  {Object.entries(customFeatures).map(([key, enabled]) => (
                    <div key={key} className={`flex items-center justify-between p-3 bg-white/5 rounded-lg ${!useCustomSettings ? 'opacity-60' : ''}`}>
                      <span className="text-white/80 text-sm">{featureLabels[key as keyof typeof featureLabels] || key}</span>
                      {useCustomSettings ? (
                        <Switch
                          checked={enabled as boolean}
                          onCheckedChange={(checked) => {
                            setCustomFeatures(prev => ({
                              ...prev,
                              [key]: checked
                            }));
                          }}
                        />
                      ) : (
                        <Badge variant={enabled ? "default" : "secondary"} className="text-xs">
                          {enabled ? 'Habilitado' : 'Deshabilitado'}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
                
                {useCustomSettings && (
                  <div className="mt-4 flex justify-end">
                    <Button 
                      onClick={saveCustomSettings}
                      disabled={updateCompanyMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Guardar Configuración Personalizada
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users Stats */}
        <Card className="bg-white/10 backdrop-blur-xl border-white/20 mt-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="w-5 h-5" />
              Estadísticas de Usuarios
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                <div className="text-2xl font-bold text-white">{company.userCount}</div>
                <div className="text-sm text-white/60">Usuarios Totales</div>
              </div>
              <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                <div className="text-2xl font-bold text-emerald-400">{company.activeUsers || 0}</div>
                <div className="text-sm text-white/60">Usuarios Activos</div>
              </div>
              <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                <div className="text-2xl font-bold text-yellow-400">
                  €{((company.subscription.customPricePerUser || company.subscription.pricePerUser || 0) * company.userCount).toFixed(2)}
                </div>
                <div className="text-sm text-white/60">Ingresos Mensuales</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}