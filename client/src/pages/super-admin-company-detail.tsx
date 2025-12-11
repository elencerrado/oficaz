import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Building2, Users, Crown, Settings, Edit2, Check, X, Euro, AlertCircle, Trash2 } from 'lucide-react';
import { getAuthHeaders } from '@/lib/auth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

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
  basic: 'bg-blue-500',
  pro: 'bg-purple-500',
  master: 'bg-yellow-500'
};

const planLabels = {
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
  const [editingTrialDuration, setEditingTrialDuration] = useState(false);
  
  const [newPlan, setNewPlan] = useState('');
  const [newMaxUsers, setNewMaxUsers] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newTrialDuration, setNewTrialDuration] = useState('');
  const [useCustomSettings, setUseCustomSettings] = useState(false);
  const [customFeatures, setCustomFeatures] = useState<any>({});
  
  // Delete company modal states
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch company details
  const { data: company, isLoading } = useQuery({
    queryKey: ['/api/super-admin/companies', companyId],
    queryFn: async () => {
      const response = await fetch(`/api/super-admin/companies/${companyId}`, {
        headers: getAuthHeaders(),
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
      const response = await fetch('/api/super-admin/subscription-plans', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch plans');
      return response.json();
    },
    retry: false,
  });

  // Update company subscription mutation
  const updateCompanyMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/super-admin/companies/${companyId}/subscription`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update company');
      }
      return response.json();
    },
    onSuccess: (data) => {
      // Actualizar estado local con los datos del servidor
      if (data.subscription) {
        setUseCustomSettings(data.subscription.useCustomSettings || false);
        setCustomFeatures(data.subscription.features || {});
      }
      
      // Invalidar tanto la query específica como las generales
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/companies', companyId] });
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/companies'] });
      // Forzar recarga inmediata de los datos de la empresa
      queryClient.refetchQueries({ queryKey: ['/api/super-admin/companies', companyId] });
      
      toast({
        title: "Éxito",
        description: "Empresa actualizada correctamente",
      });
      setEditingPlan(false);
      setEditingMaxUsers(false);
      setEditingPrice(false);
      setEditingTrialDuration(false);
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

  // Delete company mutation
  const deleteCompanyMutation = useMutation({
    mutationFn: async (confirmationText: string) => {
      const token = sessionStorage.getItem('superAdminToken');
      const response = await fetch(`/api/super-admin/companies/${companyId}/delete-permanently`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ confirmationText }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al eliminar la empresa');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
      setConfirmationText('');
      
      toast({
        title: "Empresa eliminada",
        description: data.message,
      });
      
      // Redirect to companies list after successful deletion
      setTimeout(() => {
        setLocation('/super-admin/companies');
      }, 2000);
    },
    onError: (error: Error) => {
      setIsDeleting(false);
      
      toast({
        title: "Error al eliminar empresa",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDeleteCompany = () => {
    if (confirmationText !== 'ELIMINAR PERMANENTEMENTE') {
      toast({
        title: "Error de confirmación",
        description: 'Debes escribir exactamente "ELIMINAR PERMANENTEMENTE"',
        variant: "destructive",
      });
      return;
    }
    
    setIsDeleting(true);
    deleteCompanyMutation.mutate(confirmationText);
  };

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
      const planDefaults = plans?.find((p: any) => p.name === newPlan)?.features;
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
      customMonthlyPrice: parseFloat(newPrice) 
    });
  };

  const handleClearCustomPrice = () => {
    updateCompanyMutation.mutate({ 
      customMonthlyPrice: null 
    });
  };

  const handleTrialDurationSave = () => {
    updateCompanyMutation.mutate({ 
      trialDurationDays: newTrialDuration ? parseInt(newTrialDuration) : null 
    });
  };

  const toggleCustomSettings = async () => {
    const newCustomState = !useCustomSettings;
    setUseCustomSettings(newCustomState);
    
    // Si desactiva personalización, resetear a configuración del plan
    if (!newCustomState) {
      const planFeatures = plans?.find((p: any) => p.name === company?.subscription?.plan)?.features;
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
      setNewPrice(company.subscription.customMonthlyPrice?.toString() || company.subscription.monthlyPrice?.toString() || '');
      setNewTrialDuration(company.trialDurationDays?.toString() || '14');
      setCustomFeatures(company.subscription.features || {});
      
      // Usar el estado explícito de useCustomSettings de la base de datos
      setUseCustomSettings(company.subscription.useCustomSettings || false);
    }
  }, [company, plans]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-center">
          <h2 className="text-xl font-semibold mb-2">Empresa no encontrada</h2>
          <Button onClick={() => setLocation('/super-admin/companies')} variant="outline">
            Volver a Empresas
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
            onClick={() => setLocation('/super-admin/dashboard')}
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
                <label className="text-sm font-medium text-white/80">Precio Mensual Personalizado (€/mes)</label>
                <p className="text-xs text-white/60">
                  Precio fijo mensual para toda la empresa. Si no se establece, se usa el precio estándar del plan ({company.subscription.monthlyPrice || '0'}€/mes).
                </p>
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
                        {company.subscription.customMonthlyPrice ? (
                          <>
                            {company.subscription.customMonthlyPrice}
                            <span className="text-white/60">€/mes (personalizado)</span>
                          </>
                        ) : (
                          <>
                            {company.subscription.monthlyPrice || '0'}
                            <span className="text-white/60">€/mes (estándar {company.subscription.plan})</span>
                          </>
                        )}
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => setEditingPrice(true)} className="text-white/60">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      {company.subscription.customMonthlyPrice && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={handleClearCustomPrice} 
                          className="text-red-400 hover:text-red-300"
                          title="Usar precio estándar del plan"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Trial Duration */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/80">Duración del Período de Prueba (días)</label>
                <div className="flex items-center gap-2">
                  {editingTrialDuration ? (
                    <>
                      <Input
                        type="number"
                        min="1"
                        max="365"
                        placeholder="14"
                        value={newTrialDuration}
                        onChange={(e) => setNewTrialDuration(e.target.value)}
                        className="flex-1 bg-white/10 border-white/20 text-white"
                      />
                      <Button size="sm" onClick={handleTrialDurationSave} disabled={updateCompanyMutation.isPending}>
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingTrialDuration(false)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white flex items-center gap-2">
                        🕐 {company.trialDurationDays || 14} días
                        <span className="text-white/60">de prueba</span>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => setEditingTrialDuration(true)} className="text-white/60">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Trial Status - Real Time Information */}
              {company.trialInfo && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/80">Estado del Período de Prueba</label>
                  <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {company.trialInfo.isTrialActive ? (
                          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        ) : (
                          <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                        )}
                        <span className="text-white font-medium">
                          {company.trialInfo.isTrialActive ? 'Prueba Activa' : 'Prueba Expirada'}
                        </span>
                      </div>
                      <div className="text-white/60 text-sm">
                        {company.trialInfo.daysRemaining} días restantes
                      </div>
                    </div>
                    <div className="text-xs text-white/50 space-y-1">
                      <div>Inicio: {new Date(company.trialInfo.trialStartDate).toLocaleDateString('es-ES')}</div>
                      <div>Fin: {new Date(company.trialInfo.trialEndDate).toLocaleDateString('es-ES')}</div>
                      <div>Duración total: {company.trialInfo.trialDuration} días</div>
                    </div>
                  </div>
                </div>
              )}
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
                            setCustomFeatures((prev: any) => ({
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

        {/* Danger Zone - Delete Company */}
        <Card className="bg-red-500/10 backdrop-blur-xl border-red-500/30 mt-8">
          <CardHeader>
            <CardTitle className="text-red-400 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Zona de Peligro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-red-400 mb-2">Eliminar empresa permanentemente</h3>
                <p className="text-sm text-white/60 mb-4">
                  Esta acción eliminará completamente la empresa y todos sus datos asociados. Esta acción no se puede deshacer.
                </p>
                <p className="text-sm text-red-400 mb-4">
                  Se eliminarán:
                </p>
                <ul className="text-sm text-white/60 list-disc list-inside mb-4 space-y-1">
                  <li>Todos los usuarios y sus datos personales</li>
                  <li>Fichajes y registros de tiempo</li>
                  <li>Solicitudes de vacaciones</li>
                  <li>Documentos y archivos subidos</li>
                  <li>Mensajes y notificaciones</li>
                  <li>Configuración de empresa</li>
                  <li>Datos de suscripción y facturación</li>
                </ul>
              </div>
              <Button 
                onClick={() => setIsDeleteModalOpen(true)}
                variant="destructive"
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Eliminar Empresa Permanentemente
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 border-white/20 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-400 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Confirmar Eliminación Permanente
            </DialogTitle>
            <DialogDescription className="text-gray-300">
              Esta acción eliminará permanentemente la empresa <strong>{company?.name}</strong> y todos sus datos.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-red-500/10 p-4 rounded-lg border border-red-500/30">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-red-400">
                    ⚠️ ADVERTENCIA: Esta acción es irreversible
                  </p>
                  <p className="text-sm text-gray-300">
                    Se eliminarán TODOS los datos de la empresa, usuarios, fichajes, documentos y configuraciones.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="confirmation" className="text-sm font-medium text-gray-300">
                Para confirmar, escribe: <span className="text-red-400 font-mono">ELIMINAR PERMANENTEMENTE</span>
              </Label>
              <Input
                id="confirmation"
                type="text"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                placeholder="ELIMINAR PERMANENTEMENTE"
                className="mt-2 bg-gray-800 border-gray-600 text-white"
                disabled={isDeleting}
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setConfirmationText('');
                  setIsDeleting(false);
                }}
                disabled={isDeleting}
                className="border-gray-600 text-gray-300 hover:bg-gray-800"
              >
                Cancelar
              </Button>
              <Button 
                variant="destructive"
                onClick={handleDeleteCompany}
                disabled={confirmationText !== 'ELIMINAR PERMANENTEMENTE' || isDeleting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isDeleting ? 'Eliminando...' : 'Eliminar Permanentemente'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}