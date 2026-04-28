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
import { ArrowLeft, Building2, Users, Crown, Settings, Edit2, Check, X, Euro, AlertCircle, Trash2, Database, HardDrive, Cpu, Brain, DollarSign } from 'lucide-react';
import { getAuthHeaders } from '@/lib/auth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface CompanyDetailProps {
  companyId: string;
}

interface UsageStatsProps {
  companyId: string;
}

function UsageStatsCard({ companyId }: UsageStatsProps) {
  const { data: usageStats, isLoading, error } = useQuery({
    queryKey: ['/api/super-admin/companies', companyId, 'usage-stats'],
    queryFn: async () => {
      const response = await fetch(`/api/super-admin/companies/${companyId}/usage-stats`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error('Failed to fetch usage stats');
      }
      return response.json();
    },
    staleTime: 30000,
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner size="sm" />
        <p className="ml-2 text-white">Cargando estadísticas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-white/60">
        <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-400" />
        <p>Error al cargar estadísticas de uso</p>
        <p className="text-xs mt-2 text-red-400">{error.toString()}</p>
      </div>
    );
  }

  if (!usageStats?.stats) {
    return (
      <div className="text-center py-8 text-white/60">
        <p>No hay datos de uso disponibles</p>
      </div>
    );
  }

  const { storage, compute, ai, total } = usageStats.stats;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Storage Section */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <HardDrive className="w-5 h-5" />
          Almacenamiento
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* R2 Storage */}
          <div className="bg-white/5 p-4 rounded-lg border border-white/10">
            <div className="text-sm text-white/60 mb-1">Cloudflare R2</div>
            <div className="text-xl font-bold text-white">{formatBytes(storage.r2.bytes)}</div>
            <div className="text-xs text-emerald-400 mt-1">
              ${storage.r2.costUSD.toFixed(4)}/mes
            </div>
          </div>

          {/* Database Storage */}
          <div className="bg-white/5 p-4 rounded-lg border border-white/10">
            <div className="text-sm text-white/60 mb-1">Base de Datos (Neon)</div>
            <div className="text-xl font-bold text-white">{formatBytes(storage.database.bytes)}</div>
            <div className="text-xs text-emerald-400 mt-1">
              ${storage.database.costUSD.toFixed(4)}/mes
            </div>
          </div>

          {/* Total Storage */}
          <div className="bg-blue-500/10 p-4 rounded-lg border border-blue-500/30">
            <div className="text-sm text-blue-300 mb-1">Total Almacenamiento</div>
            <div className="text-xl font-bold text-blue-400">{formatBytes(storage.total.bytes)}</div>
            <div className="text-xs text-blue-300 mt-1">
              ${storage.total.costUSD.toFixed(4)}/mes
            </div>
          </div>
        </div>
      </div>

      {/* Compute & API Section */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <Cpu className="w-5 h-5" />
          Procesamiento
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/5 p-4 rounded-lg border border-white/10">
            <div className="text-sm text-white/60 mb-1">Peticiones API</div>
            <div className="text-xl font-bold text-white">{compute.apiRequests.toLocaleString()}</div>
            <div className="text-xs text-white/40 mt-1">Este mes</div>
          </div>

          <div className="bg-white/5 p-4 rounded-lg border border-white/10">
            <div className="text-sm text-white/60 mb-1">Tiempo de Cómputo</div>
            <div className="text-xl font-bold text-white">{compute.apiComputeTimeSec.toFixed(2)}s</div>
            <div className="text-xs text-white/40 mt-1">Total acumulado</div>
          </div>

          <div className="bg-purple-500/10 p-4 rounded-lg border border-purple-500/30">
            <div className="text-sm text-purple-300 mb-1">Costo Cómputo</div>
            <div className="text-xl font-bold text-purple-400">${compute.costUSD.toFixed(4)}</div>
            <div className="text-xs text-purple-300 mt-1">/mes</div>
          </div>
        </div>
      </div>

      {/* AI Section */}
      {ai.tokensUsed > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Brain className="w-5 h-5" />
            Inteligencia Artificial
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/5 p-4 rounded-lg border border-white/10">
              <div className="text-sm text-white/60 mb-1">Tokens Consumidos</div>
              <div className="text-xl font-bold text-white">{ai.tokensUsed.toLocaleString()}</div>
              <div className="text-xs text-white/40 mt-1">OpenAI GPT-4</div>
            </div>

            <div className="bg-white/5 p-4 rounded-lg border border-white/10">
              <div className="text-sm text-white/60 mb-1">Peticiones IA</div>
              <div className="text-xl font-bold text-white">{ai.requestsCount.toLocaleString()}</div>
              <div className="text-xs text-white/40 mt-1">Este mes</div>
            </div>

            <div className="bg-orange-500/10 p-4 rounded-lg border border-orange-500/30">
              <div className="text-sm text-orange-300 mb-1">Costo IA</div>
              <div className="text-xl font-bold text-orange-400">${ai.costUSD.toFixed(4)}</div>
              <div className="text-xs text-orange-300 mt-1">/mes</div>
            </div>
          </div>
        </div>
      )}

      {/* Total Cost Summary */}
      <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 p-6 rounded-lg border border-emerald-500/30">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-white/60 mb-1">Costo Total Mensual</div>
            <div className="text-3xl font-bold text-white">
              ${total.costUSD.toFixed(2)} USD
            </div>
            <div className="text-lg text-emerald-400 mt-1">
              ≈ €{total.costEUR.toFixed(2)} EUR
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-white/40 mb-2">Desglose:</div>
            <div className="space-y-1 text-sm">
              <div className="text-white/60">Storage: ${storage.total.costUSD.toFixed(4)}</div>
              <div className="text-white/60">Compute: ${compute.costUSD.toFixed(4)}</div>
              {ai.tokensUsed > 0 && (
                <div className="text-white/60">AI: ${ai.costUSD.toFixed(4)}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Info Footer */}
      <div className="text-xs text-white/40 text-center pt-2">
        <p>Datos actualizados: {new Date(usageStats.stats.lastUpdated || Date.now()).toLocaleString('es-ES')}</p>
        <p className="mt-1">
          Precios estimados • R2: $0.015/GB • Neon: $0.12/GB • Compute: $0.00001/s • OpenAI: $0.002/1K tokens
        </p>
      </div>
    </div>
  );
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

// Subscription status colors
const subscriptionStatusColors = {
  active: 'bg-emerald-500',
  trial: 'bg-blue-500',
  expired: 'bg-gray-600',
  cancelled: 'bg-orange-600',
  deleted: 'bg-red-900'
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
  const [newTrialEndDate, setNewTrialEndDate] = useState('');
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
    staleTime: 30000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
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
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  interface CompanySubscriptionUpdate {
    plan?: string;
    maxUsers?: number | null;
    customMonthlyPrice?: number | null;
    useCustomSettings?: boolean;
    trialDurationDays?: number;
    demoMode?: boolean;
    features?: Record<string, boolean>;
  }

  // Update company subscription mutation
  const updateCompanyMutation = useMutation({
    mutationFn: async (data: CompanySubscriptionUpdate) => {
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
      const response = await fetch(`/api/super-admin/companies/${companyId}/delete-permanently`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
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
    if (!newTrialEndDate || !company) return;
    
    // Calculate days from company creation date to selected end date
    const createdAt = new Date(company.createdAt);
    const endDate = new Date(newTrialEndDate);
    const diffTime = endDate.getTime() - createdAt.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) {
      toast({
        title: "Error",
        description: "La fecha de fin del trial debe ser posterior a la fecha de creación de la empresa",
        variant: "destructive",
      });
      return;
    }
    
    updateCompanyMutation.mutate({ 
      trialDurationDays: diffDays
    });
  };

  const handleDemoModeToggle = (checked: boolean) => {
    updateCompanyMutation.mutate({
      demoMode: checked,
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

      // Calculate trial end date from company creation + trial duration
      const createdAt = new Date(company.createdAt);
      const trialDays = company.trialDurationDays || 14;
      const trialEndDate = new Date(createdAt);
      trialEndDate.setDate(trialEndDate.getDate() + trialDays);
      setNewTrialEndDate(trialEndDate.toISOString().split('T')[0]);
      
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
      const createdAt = new Date(company.createdAt);
      const trialDays = company.trialDurationDays || 14;
      const trialEndDate = new Date(createdAt);
      trialEndDate.setDate(trialEndDate.getDate() + trialDays);
      setNewTrialEndDate(trialEndDate.toISOString().split('T')[0]);
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

  const subscriptionStatus = company.subscription?.status;
  const hasSubscriptionHistory = Boolean(
    company.subscription?.stripeSubscriptionId ||
    company.subscription?.firstPaymentDate ||
    ['active', 'pending_cancel', 'cancelled', 'inactive'].includes(subscriptionStatus)
  );
  const isSubscribedCompany = hasSubscriptionHistory && subscriptionStatus !== 'trial';
  const subscriptionStartDate = company.subscription?.firstPaymentDate || company.subscription?.startDate;
  const nextPaymentDate = company.subscription?.nextPaymentDate;
  const subscriptionUpdatedAt = company.subscription?.updatedAt;
  const monthlyAmount = Number(
    company.subscription?.customMonthlyPrice ??
    company.calculatedMonthlyPrice ??
    company.subscription?.monthlyPrice ??
    0
  );

  const getMonthsSince = (dateValue: string | Date | null | undefined) => {
    if (!dateValue) return 0;
    const start = new Date(dateValue);
    if (Number.isNaN(start.getTime())) return 0;

    const now = new Date();
    let months = (now.getFullYear() - start.getFullYear()) * 12;
    months += now.getMonth() - start.getMonth();
    if (now.getDate() < start.getDate()) months -= 1;
    return Math.max(0, months);
  };

  const monthsSubscribed = getMonthsSince(subscriptionStartDate);
  const isFutureNextPayment = (() => {
    if (!nextPaymentDate) return false;
    return new Date(nextPaymentDate).getTime() > Date.now();
  })();

  const subscriptionUi = (() => {
    if (subscriptionStatus === 'active') {
      return {
        title: 'Estado de Suscripcion',
        description: 'Resumen del estado actual de la suscripcion',
        sinceLabel: 'Suscrita desde',
        sinceSuffixSingular: 'mes activa',
        sinceSuffixPlural: 'meses activa',
        nextPaymentLabel: 'Proximo pago',
        statusBadge: 'Suscripcion activa',
        statusBadgeClass: 'bg-emerald-500 text-white',
        amountLabel: 'Importe mensual actual',
      };
    }

    if (subscriptionStatus === 'pending_cancel') {
      return {
        title: 'Estado de Suscripcion',
        description: 'Suscripcion activa con cancelacion programada',
        sinceLabel: 'Suscrita desde',
        sinceSuffixSingular: 'mes activa',
        sinceSuffixPlural: 'meses activa',
        nextPaymentLabel: 'Fin del periodo',
        statusBadge: 'Cancelacion programada',
        statusBadgeClass: 'bg-orange-500 text-white',
        amountLabel: 'Importe mensual actual',
      };
    }

    if (subscriptionStatus === 'cancelled') {
      return {
        title: 'Estado de Suscripcion',
        description: 'Suscripcion cancelada',
        sinceLabel: 'Cancelada desde',
        sinceSuffixSingular: 'mes desde cancelacion',
        sinceSuffixPlural: 'meses desde cancelacion',
        nextPaymentLabel: 'Proximo pago',
        statusBadge: 'Suscripcion cancelada',
        statusBadgeClass: 'bg-red-600 text-white',
        amountLabel: 'Ultimo importe mensual',
      };
    }

    if (subscriptionStatus === 'inactive') {
      return {
        title: 'Estado de Suscripcion',
        description: 'Suscripcion inactiva',
        sinceLabel: 'Inactiva desde',
        sinceSuffixSingular: 'mes inactiva',
        sinceSuffixPlural: 'meses inactiva',
        nextPaymentLabel: 'Proximo pago',
        statusBadge: 'Suscripcion inactiva',
        statusBadgeClass: 'bg-slate-600 text-white',
        amountLabel: 'Ultimo importe mensual',
      };
    }

    return {
      title: 'Configuracion de Trial',
      description: 'Gestiona el periodo de prueba de esta empresa',
      sinceLabel: 'Suscrita desde',
      sinceSuffixSingular: 'mes activa',
      sinceSuffixPlural: 'meses activa',
      nextPaymentLabel: 'Proximo pago',
      statusBadge: 'Sin suscripcion',
      statusBadgeClass: 'bg-blue-500 text-white',
      amountLabel: 'Importe mensual actual',
    };
  })();

  const wasUpdatedThisMonth = (() => {
    if (!subscriptionUpdatedAt) return false;
    const updated = new Date(subscriptionUpdatedAt);
    const now = new Date();
    return updated.getMonth() === now.getMonth() && updated.getFullYear() === now.getFullYear();
  })();

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
            </div>
          </CardHeader>
        </Card>

        <Card className="bg-white/10 backdrop-blur-xl border-white/20 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Modo demo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-white font-medium">Empresa demo sin cobro</p>
                <p className="text-sm text-white/60 mt-1">
                  Mantiene la empresa activa sin cobros ni creación automática de suscripciones en Stripe.
                </p>
              </div>
              <div className="flex items-center gap-3">
                {company.demoMode && (
                  <Badge className="bg-amber-500 text-white">Demo</Badge>
                )}
                <Switch
                  checked={company.demoMode === true}
                  onCheckedChange={handleDemoModeToggle}
                  disabled={updateCompanyMutation.isPending}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Plan & Pricing Configuration */}
          <Card className="bg-white/10 backdrop-blur-xl border-white/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Crown className="w-5 h-5" />
                {isSubscribedCompany ? subscriptionUi.title : 'Configuracion de Trial'}
              </CardTitle>
              <p className="text-sm text-white/60 mt-2">
                {isSubscribedCompany
                  ? subscriptionUi.description
                  : 'Gestiona el periodo de prueba de esta empresa'}
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {isSubscribedCompany ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                      <div className="text-xs text-white/60 mb-1">{subscriptionUi.sinceLabel}</div>
                      <div className="text-white font-semibold">
                        {subscriptionStartDate ? new Date(subscriptionStartDate).toLocaleDateString('es-ES') : 'No disponible'}
                      </div>
                      <div className="text-xs text-white/50 mt-1">
                        {monthsSubscribed} {monthsSubscribed === 1 ? subscriptionUi.sinceSuffixSingular : subscriptionUi.sinceSuffixPlural}
                      </div>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                      <div className="text-xs text-white/60 mb-1">{subscriptionUi.nextPaymentLabel}</div>
                      <div className="text-white font-semibold">
                        {nextPaymentDate && isFutureNextPayment
                          ? new Date(nextPaymentDate).toLocaleDateString('es-ES')
                          : 'Sin proximo cobro'}
                      </div>
                      <div className="text-xs text-white/50 mt-1">
                        {isFutureNextPayment ? 'Ciclo mensual' : 'No hay cobros programados'}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <div className="text-xs text-white/60 mb-1">{subscriptionUi.amountLabel}</div>
                        <div className="text-2xl font-bold text-white">€{monthlyAmount.toFixed(2)}</div>
                      </div>
                      <Badge className={subscriptionUi.statusBadgeClass}>{subscriptionUi.statusBadge}</Badge>
                    </div>
                    <div className="text-xs text-white/50 mt-2">
                      Incluye usuarios y funcionalidades contratadas
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <div className="text-xs text-white/60 mb-1">Última actualización de plan</div>
                        <div className="text-white font-medium">
                          {subscriptionUpdatedAt ? new Date(subscriptionUpdatedAt).toLocaleDateString('es-ES') : 'No disponible'}
                        </div>
                      </div>
                      {wasUpdatedThisMonth && (
                        <Badge variant="secondary" className="bg-blue-500/20 text-blue-200 border border-blue-400/30">
                          Actualizada este mes
                        </Badge>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Trial Duration */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/80">Fecha de Fin del Trial</label>
                    <p className="text-xs text-white/60">
                      Selecciona la fecha en la que terminará el período de prueba
                    </p>
                    <div className="flex items-center gap-2">
                      {editingTrialDuration ? (
                        <>
                          <div className="flex-1 space-y-2">
                            <Input
                              type="date"
                              value={newTrialEndDate}
                              min={new Date(company.createdAt).toISOString().split('T')[0]}
                              onChange={(e) => setNewTrialEndDate(e.target.value)}
                              className="bg-white/10 border-white/20 text-white"
                            />
                            {newTrialEndDate && company && (
                              <div className="text-xs text-white/70 px-2">
                                {(() => {
                                  const createdAt = new Date(company.createdAt);
                                  const endDate = new Date(newTrialEndDate);
                                  const diffTime = endDate.getTime() - createdAt.getTime();
                                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                  return `Total: ${diffDays > 0 ? diffDays : 0} días de trial`;
                                })()}
                              </div>
                            )}
                          </div>
                          <Button size="sm" onClick={handleTrialDurationSave} disabled={updateCompanyMutation.isPending}>
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingTrialDuration(false)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <div className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium">
                                  {(() => {
                                    const createdAt = new Date(company.createdAt);
                                    const trialDays = company.trialDurationDays || 14;
                                    const trialEnd = new Date(createdAt);
                                    trialEnd.setDate(trialEnd.getDate() + trialDays);
                                    return trialEnd.toLocaleDateString('es-ES');
                                  })()}
                                </div>
                                <div className="text-xs text-white/60 mt-0.5">
                                  🕐 {company.trialDurationDays || 14} días de trial
                                </div>
                              </div>
                            </div>
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
                </>
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

        {/* Usage Statistics & Costs - JUST BELOW FEATURES */}
        <Card className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-xl border-purple-500/30 mt-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              📊 Estadísticas de Uso y Costos Reales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <UsageStatsCard companyId={companyId} />
          </CardContent>
        </Card>

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

        {/* Usage Statistics & Costs */}
        <Card className="bg-white/10 backdrop-blur-xl border-white/20 mt-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Estadísticas de Uso y Costos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <UsageStatsCard companyId={companyId} />
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