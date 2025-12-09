import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { getAuthHeaders } from '@/lib/auth';
import { usePageTitle } from '@/hooks/use-page-title';
import { 
  Building2, 
  Search,
  Filter,
  Edit,
  Check,
  X,
  Eye,
  Users,
  Tag,
  ArrowLeft,
  Crown,
  Settings,
  Edit2,
  Euro,
  AlertCircle,
  Trash2,
  Shield,
  Package,
  Clock,
  Calendar,
  MessageSquare,
  FileText,
  Bell,
  Brain,
  Boxes
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SuperAdminLayout } from '@/components/layout/super-admin-layout';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

const addonIcons: Record<string, any> = {
  time_tracking: Clock,
  vacation: Calendar,
  schedule: Calendar,
  messages: MessageSquare,
  reminders: Bell,
  work_reports: FileText,
  documents: FileText,
  inventory: Boxes,
  oficaz_ai: Brain,
};

interface ActiveAddon {
  id: number;
  key: string;
  name: string;
  monthlyPrice: string;
  status: string;
  purchasedAt?: string;
}

interface Company {
  id: number;
  name: string;
  cif: string;
  email: string;
  userCount: number;
  activeUsers?: number;
  trialDurationDays?: number;
  subscription: {
    plan: string;
    status: string;
    stripeSubscriptionId?: string;
    maxUsers?: number;
    monthlyPrice?: number;
    customMonthlyPrice?: number;
    pricePerUser?: number;
    customPricePerUser?: number;
    useCustomSettings?: boolean;
    features?: any;
  };
  activeAddons?: ActiveAddon[];
  contractedRoles?: {
    admins: number;
    managers: number;
    employees: number;
  };
  calculatedMonthlyPrice?: string;
  promotionalCode?: {
    code: string;
    description: string;
  } | null;
  trialInfo?: {
    daysRemaining: number;
    isTrialActive: boolean;
    trialDuration: number;
    trialStartDate: string;
    trialEndDate: string;
  };
  deletionInfo?: {
    scheduledForDeletion: boolean;
    deletionScheduledAt?: string;
    isDeleted: boolean;
  };
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
  basic: "bg-blue-500", 
  pro: "bg-purple-500",
  master: "bg-gradient-to-r from-yellow-400 to-yellow-600"
};

const planLabels = {
  basic: "Basic", 
  pro: "Pro",
  master: "Master"
};

// Helper function to get subscription status badge info
const getSubscriptionBadge = (company: Company) => {
  if (company.deletionInfo?.isDeleted) {
    return {
      text: 'Eliminada',
      variant: 'destructive' as const,
      className: 'bg-red-900 text-white border-red-700'
    };
  }

  if (company.deletionInfo?.scheduledForDeletion) {
    return {
      text: 'Cancelada - Eliminación programada',
      variant: 'destructive' as const,
      className: 'bg-orange-600 text-white'
    };
  }

  if (company.trialInfo?.isTrialActive) {
    const days = company.trialInfo.daysRemaining;
    return {
      text: `Prueba - ${days} día${days !== 1 ? 's' : ''}`,
      variant: 'secondary' as const,
      className: 'bg-blue-500 text-white'
    };
  }

  if (company.subscription.status === 'active' && company.subscription.stripeSubscriptionId) {
    return {
      text: 'Suscrito',
      variant: 'default' as const,
      className: 'bg-emerald-500 text-white'
    };
  }

  if (!company.trialInfo?.isTrialActive && company.trialInfo?.daysRemaining !== undefined && company.trialInfo.daysRemaining <= 0 && !company.subscription.stripeSubscriptionId) {
    return {
      text: 'Trial expirado',
      variant: 'secondary' as const,
      className: 'bg-gray-600 text-white'
    };
  }

  return {
    text: company.subscription.status === 'active' ? 'Activo' : 'Inactivo',
    variant: company.subscription.status === 'active' ? 'default' as const : 'secondary' as const,
    className: company.subscription.status === 'active' ? 'bg-emerald-500' : 'bg-gray-500'
  };
};

export default function SuperAdminCompanies() {
  usePageTitle('SuperAdmin - Empresas');
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPlan, setFilterPlan] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [editingCompany, setEditingCompany] = useState<number | null>(null);
  const [newPlan, setNewPlan] = useState<string>("");
  
  // Edit mode states
  const [editingCompanyId, setEditingCompanyId] = useState<number | null>(null);
  const [editingPlanField, setEditingPlanField] = useState(false);
  const [editingMaxUsers, setEditingMaxUsers] = useState(false);
  const [editingPrice, setEditingPrice] = useState(false);
  const [editingTrialDuration, setEditingTrialDuration] = useState(false);
  const [newPlanValue, setNewPlanValue] = useState('');
  const [newMaxUsers, setNewMaxUsers] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newTrialDuration, setNewTrialDuration] = useState('');
  const [useCustomSettings, setUseCustomSettings] = useState(false);
  const [customFeatures, setCustomFeatures] = useState<any>({});
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: companies } = useQuery({
    queryKey: ['/api/super-admin/companies'],
    queryFn: async () => {
      const response = await fetch('/api/super-admin/companies', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch companies');
      return response.json();
    },
    retry: false,
    staleTime: 30000,
    refetchOnMount: false,
  });

  // Fetch company details when editing
  const { data: selectedCompanyDetail } = useQuery({
    queryKey: ['/api/super-admin/companies', editingCompanyId],
    queryFn: async () => {
      const response = await fetch(`/api/super-admin/companies/${editingCompanyId}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch company');
      return response.json();
    },
    enabled: !!editingCompanyId,
    retry: false,
  });

  // Fetch available plans
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

  const updateSubscriptionMutation = useMutation({
    mutationFn: async ({ companyId, plan }: { companyId: number; plan: string }) => {
      const response = await fetch(`/api/super-admin/companies/${companyId}/subscription`, {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan }),
      });
      if (!response.ok) throw new Error('Failed to update subscription');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/companies'] });
      toast({
        title: "Éxito",
        description: "Plan actualizado correctamente",
      });
      setEditingCompany(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/super-admin/companies/${editingCompanyId}/subscription`, {
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
      if (data.subscription) {
        setUseCustomSettings(data.subscription.useCustomSettings || false);
        setCustomFeatures(data.subscription.features || {});
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/companies', editingCompanyId] });
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/companies'] });
      queryClient.refetchQueries({ queryKey: ['/api/super-admin/companies', editingCompanyId] });
      
      toast({
        title: "Éxito",
        description: "Empresa actualizada correctamente",
      });
      setEditingPlanField(false);
      setEditingMaxUsers(false);
      setEditingPrice(false);
      setEditingTrialDuration(false);
    },
    onError: (error: any) => {
      if (selectedCompanyDetail) {
        setUseCustomSettings(selectedCompanyDetail.subscription.useCustomSettings || false);
        setCustomFeatures(selectedCompanyDetail.subscription.features || {});
      }
      
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: async (confirmationText: string) => {
      const token = sessionStorage.getItem('superAdminToken');
      const response = await fetch(`/api/super-admin/companies/${editingCompanyId}/delete-permanently`, {
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
      setEditingCompanyId(null);
      
      toast({
        title: "Empresa eliminada",
        description: data.message,
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/companies'] });
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

  useEffect(() => {
    if (selectedCompanyDetail) {
      setUseCustomSettings(selectedCompanyDetail.subscription.useCustomSettings || false);
      setCustomFeatures(selectedCompanyDetail.subscription.features || {});
    }
  }, [selectedCompanyDetail]);

  const filteredCompanies = companies?.filter((company: Company) => {
    const matchesSearch = 
      company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.cif.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesPlan = filterPlan === "all" || company.subscription.plan === filterPlan;
    const matchesStatus = filterStatus === "all" || company.subscription.status === filterStatus;
    
    return matchesSearch && matchesPlan && matchesStatus;
  }) || [];

  const handlePlanChange = (companyId: number, currentPlan: string) => {
    setEditingCompany(companyId);
    setNewPlan(currentPlan);
  };

  const savePlanChange = (companyId: number) => {
    if (!newPlan) return;
    updateSubscriptionMutation.mutate({ companyId, plan: newPlan });
  };

  const cancelPlanChange = () => {
    setEditingCompany(null);
    setNewPlan("");
  };

  const openEditMode = (company: Company) => {
    setEditingCompanyId(company.id);
  };

  const handlePlanSave = () => {
    if (!newPlanValue) return;
    
    let finalFeatures = customFeatures;
    if (!useCustomSettings) {
      const planDefaults = plans?.find((p: any) => p.name === newPlanValue)?.features;
      if (planDefaults) {
        finalFeatures = planDefaults;
        setCustomFeatures(planDefaults);
      }
    }

    updateCompanyMutation.mutate({ 
      plan: newPlanValue,
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
    
    if (!newCustomState) {
      const planFeatures = plans?.find((p: any) => p.name === selectedCompanyDetail?.subscription?.plan)?.features;
      if (planFeatures) {
        setCustomFeatures(planFeatures);
        updateCompanyMutation.mutate({ 
          features: planFeatures,
          useCustomSettings: newCustomState
        });
      }
    } else {
      updateCompanyMutation.mutate({ 
        useCustomSettings: newCustomState
      });
    }
  };

  const saveCustomSettings = async () => {
    updateCompanyMutation.mutate({ 
      features: customFeatures,
      useCustomSettings
    });
  };

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

  // If in edit mode, show edit form
  if (editingCompanyId && selectedCompanyDetail) {
    const company = selectedCompanyDetail;
    
    return (
      <SuperAdminLayout>
        <div className="container mx-auto px-6 py-8">
          <Button
            variant="ghost"
            onClick={() => setEditingCompanyId(null)}
            className="!text-white/70 hover:!text-white hover:!bg-white/10 mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>

          <div className="mb-8">
            <h1 className="text-2xl font-semibold !text-white mb-1">Gestión de Empresa</h1>
            <p className="!text-white/60">Configuración personalizada para {company.name}</p>
          </div>

          {/* Company Info Card */}
          <Card className="!bg-white/10 backdrop-blur-xl !border-white/20 mb-8">
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <Building2 className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <CardTitle className="!text-white text-xl">{company.name}</CardTitle>
                  <div className="flex items-center gap-4 text-sm !text-white/60 mt-1">
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
            <Card className="!bg-white/10 backdrop-blur-xl !border-white/20">
              <CardHeader>
                <CardTitle className="!text-white flex items-center gap-2">
                  <Crown className="w-5 h-5" />
                  Configuración de Plan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Plan Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium !text-white/80">Plan de Suscripción</label>
                  <div className="flex items-center gap-2">
                    {editingPlanField ? (
                      <>
                        <Select value={newPlanValue} onValueChange={setNewPlanValue}>
                          <SelectTrigger className="flex-1 !bg-white/10 !border-white/20 !text-white">
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
                        <Button size="sm" variant="ghost" onClick={() => setEditingPlanField(false)} className="!text-white/60">
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Badge className={`${planColors[company.subscription.plan as keyof typeof planColors]} text-white flex-1 justify-center`}>
                          {planLabels[company.subscription.plan as keyof typeof planLabels]}
                        </Badge>
                        <Button size="sm" variant="ghost" onClick={() => setEditingPlanField(true)} className="!text-white/60">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Max Users */}
                <div className="space-y-2">
                  <label className="text-sm font-medium !text-white/80">Límite de Usuarios</label>
                  <div className="flex items-center gap-2">
                    {editingMaxUsers ? (
                      <>
                        <Input
                          type="number"
                          placeholder="∞ (ilimitado)"
                          value={newMaxUsers}
                          onChange={(e) => setNewMaxUsers(e.target.value)}
                          className="flex-1 !bg-white/10 !border-white/20 !text-white placeholder:!text-white/40"
                        />
                        <Button size="sm" onClick={handleMaxUsersSave} disabled={updateCompanyMutation.isPending}>
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingMaxUsers(false)} className="!text-white/60">
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="flex-1 px-3 py-2 !bg-white/10 border !border-white/20 rounded-lg !text-white">
                          {company.subscription.maxUsers || '∞ (ilimitado)'}
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => setEditingMaxUsers(true)} className="!text-white/60">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Custom Price */}
                <div className="space-y-2">
                  <label className="text-sm font-medium !text-white/80">Precio Mensual Personalizado (€/mes)</label>
                  <p className="text-xs !text-white/60">
                    Precio fijo mensual para toda la empresa. Si no se establece, se usa el precio estándar del plan ({company.subscription.monthlyPrice || '0'}€/mes).
                  </p>
                  <div className="flex items-center gap-2">
                    {editingPrice ? (
                      <>
                        <div className="flex items-center flex-1">
                          <Euro className="w-4 h-4 !text-white/60 absolute ml-3 z-10" />
                          <Input
                            type="number"
                            step="0.01"
                            value={newPrice}
                            onChange={(e) => setNewPrice(e.target.value)}
                            className="pl-8 !bg-white/10 !border-white/20 !text-white"
                          />
                        </div>
                        <Button size="sm" onClick={handlePriceSave} disabled={updateCompanyMutation.isPending}>
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingPrice(false)} className="!text-white/60">
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="flex-1 px-3 py-2 !bg-white/10 border !border-white/20 rounded-lg !text-white flex items-center gap-2">
                          <Euro className="w-4 h-4 text-green-400" />
                          {company.subscription.customMonthlyPrice ? (
                            <>
                              {company.subscription.customMonthlyPrice}
                              <span className="!text-white/60">€/mes (personalizado)</span>
                            </>
                          ) : (
                            <>
                              {company.subscription.monthlyPrice || '0'}
                              <span className="!text-white/60">€/mes (estándar {company.subscription.plan})</span>
                            </>
                          )}
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => setEditingPrice(true)} className="!text-white/60">
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
                  <label className="text-sm font-medium !text-white/80">Duración del Período de Prueba (días)</label>
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
                          className="flex-1 !bg-white/10 !border-white/20 !text-white placeholder:!text-white/40"
                        />
                        <Button size="sm" onClick={handleTrialDurationSave} disabled={updateCompanyMutation.isPending}>
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingTrialDuration(false)} className="!text-white/60">
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="flex-1 px-3 py-2 !bg-white/10 border !border-white/20 rounded-lg !text-white flex items-center gap-2">
                          🕐 {company.trialDurationDays || 14} días
                          <span className="!text-white/60">de prueba</span>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => setEditingTrialDuration(true)} className="!text-white/60">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Trial Status */}
                {company.trialInfo && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium !text-white/80">Estado del Período de Prueba</label>
                    <div className="p-4 !bg-white/5 border !border-white/10 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {company.trialInfo.isTrialActive ? (
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                          ) : (
                            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                          )}
                          <span className="!text-white font-medium">
                            {company.trialInfo.isTrialActive ? 'Prueba Activa' : 'Prueba Expirada'}
                          </span>
                        </div>
                        <div className="!text-white/60 text-sm">
                          {company.trialInfo.daysRemaining} días restantes
                        </div>
                      </div>
                      <div className="text-xs !text-white/50 space-y-1">
                        <div>Inicio: {new Date(company.trialInfo.trialStartDate).toLocaleDateString('es-ES')}</div>
                        <div>Fin: {new Date(company.trialInfo.trialEndDate).toLocaleDateString('es-ES')}</div>
                        <div>Duración total: {company.trialInfo.trialDuration} días</div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>

          {/* Subscription Dashboard - 3 Column iOS Style */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-6 xl:max-h-[400px]">
            {/* Column 1: User Mix */}
            <Card className="!bg-white/10 backdrop-blur-xl !border-white/15 rounded-3xl">
              <CardHeader className="pb-2">
                <CardTitle className="!text-white text-base flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Usuarios
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {/* Admin */}
                <div className="flex items-center gap-2 p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <Crown className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium !text-white">Admins</div>
                    <div className="text-[10px] !text-white/50">€6/mes c/u</div>
                  </div>
                  <div className="text-xl font-bold text-amber-400">{company.contractedRoles?.admins || 0}</div>
                </div>
                
                {/* Manager */}
                <div className="flex items-center gap-2 p-2.5 bg-purple-500/10 rounded-xl border border-purple-500/20">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <Shield className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium !text-white">Managers</div>
                    <div className="text-[10px] !text-white/50">€4/mes c/u</div>
                  </div>
                  <div className="text-xl font-bold text-purple-400">{company.contractedRoles?.managers || 0}</div>
                </div>
                
                {/* Employee */}
                <div className="flex items-center gap-2 p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <Users className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium !text-white">Empleados</div>
                    <div className="text-[10px] !text-white/50">€2/mes c/u</div>
                  </div>
                  <div className="text-xl font-bold text-blue-400">{company.contractedRoles?.employees || 0}</div>
                </div>

                {/* Stats footer */}
                <div className="pt-2 border-t border-white/10 flex justify-between text-[10px] !text-white/50">
                  <span>{company.userCount} totales</span>
                  <span className="text-emerald-400">{company.activeUsers || 0} activos</span>
                </div>
              </CardContent>
            </Card>

            {/* Column 2: Funcionalidades - Vertical Carousel */}
            <Card className="!bg-white/10 backdrop-blur-xl !border-white/15 rounded-3xl">
              <CardHeader className="pb-2">
                <CardTitle className="!text-white text-base flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Funcionalidades
                  {company.activeAddons && company.activeAddons.length > 0 && (
                    <Badge className="ml-auto bg-emerald-500/20 text-emerald-400 text-xs">
                      {company.activeAddons.length} activas
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px] pr-2">
                  {company.activeAddons && company.activeAddons.length > 0 ? (
                    <div className="space-y-2">
                      {company.activeAddons.map((addon: ActiveAddon) => {
                        const IconComponent = addonIcons[addon.key] || Package;
                        return (
                          <div 
                            key={addon.id} 
                            className="flex items-center gap-2 p-2.5 bg-white/5 rounded-xl border border-white/10"
                          >
                            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                              <IconComponent className="w-4 h-4 text-blue-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium !text-white truncate">{addon.name}</div>
                              {addon.status === 'pending_cancel' && (
                                <div className="text-[10px] text-orange-400">Cancelación pendiente</div>
                              )}
                            </div>
                            <div className="text-xs font-semibold text-emerald-400 whitespace-nowrap">
                              €{addon.monthlyPrice}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center py-6">
                      <Package className="w-8 h-8 !text-white/20 mb-2" />
                      <p className="text-xs !text-white/40">Sin complementos</p>
                      <p className="text-[10px] !text-white/30 mt-1">Solo tiene acceso base</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Column 3: Price Summary */}
            <Card className="!bg-white/10 backdrop-blur-xl !border-white/15 rounded-3xl">
              <CardHeader className="pb-2">
                <CardTitle className="!text-white text-base flex items-center gap-2">
                  <Euro className="w-4 h-4" />
                  Resumen
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {/* Breakdown */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center p-2 rounded-lg bg-white/5">
                    <span className="!text-white/70">Usuarios</span>
                    <span className="!text-white font-medium">
                      €{(
                        (company.contractedRoles?.admins || 0) * 6 +
                        (company.contractedRoles?.managers || 0) * 4 +
                        (company.contractedRoles?.employees || 0) * 2
                      ).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded-lg bg-white/5">
                    <span className="!text-white/70">Complementos</span>
                    <span className="!text-white font-medium">
                      €{company.activeAddons?.reduce((sum: number, a: ActiveAddon) => sum + parseFloat(a.monthlyPrice), 0).toFixed(2) || '0.00'}
                    </span>
                  </div>
                </div>
                
                {/* Total */}
                <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30">
                  <div className="text-center">
                    <div className="text-[10px] !text-white/60">Total mensual</div>
                    <div className="text-2xl font-black text-emerald-400">
                      €{company.calculatedMonthlyPrice || '0.00'}
                    </div>
                  </div>
                </div>

                {/* Status badges */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {company.trialInfo?.isTrialActive ? (
                    <Badge className="bg-blue-500/20 text-blue-400 text-[10px] px-2 py-0.5">
                      Prueba: {company.trialInfo.daysRemaining}d
                    </Badge>
                  ) : company.subscription.stripeSubscriptionId ? (
                    <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5">
                      Activa
                    </Badge>
                  ) : (
                    <Badge className="bg-orange-500/20 text-orange-400 text-[10px] px-2 py-0.5">
                      Sin pago
                    </Badge>
                  )}
                  <Badge className="bg-white/10 !text-white/60 text-[10px] px-2 py-0.5">
                    {company.subscription.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Danger Zone */}
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
                  <p className="text-sm !text-white/60 mb-4">
                    Esta acción eliminará completamente la empresa y todos sus datos asociados. Esta acción no se puede deshacer.
                  </p>
                  <p className="text-sm text-red-400 mb-4">
                    Se eliminarán:
                  </p>
                  <ul className="text-sm !text-white/60 list-disc list-inside mb-4 space-y-1">
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
      </SuperAdminLayout>
    );
  }

  // Default: show companies list
  return (
    <SuperAdminLayout>
      <div className="px-6 py-8">
        {/* Filters */}
        <Card className="!bg-white/10 backdrop-blur-xl !border-white/20 mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 !text-white/50 w-4 h-4" />
                  <Input
                    placeholder="Buscar empresas por nombre, CIF o email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="!bg-white/10 !border-white/20 !text-white placeholder:!text-white/50 pl-10"
                  />
                </div>
              </div>
              <Select value={filterPlan} onValueChange={setFilterPlan}>
                <SelectTrigger className="w-48 !bg-white/10 !border-white/20 !text-white">
                  <SelectValue placeholder="Filtrar por plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los planes</SelectItem>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="master">Master</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-48 !bg-white/10 !border-white/20 !text-white">
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                  <SelectItem value="suspended">Suspendido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Companies List */}
        <Card className="!bg-white/10 backdrop-blur-xl !border-white/20">
          <CardHeader>
            <CardTitle className="!text-white flex items-center justify-between">
              Empresas ({filteredCompanies.length})
              <Badge variant="secondary" className="bg-white/20 text-white">
                {filteredCompanies.length} de {companies?.length || 0}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredCompanies.map((company: Company) => (
                <div
                  key={company.id}
                  className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-4 !bg-white/5 rounded-xl border !border-white/10 hover:!bg-white/10 transition-colors"
                >
                  <div className="flex items-start gap-3 lg:gap-4 min-w-0 flex-1">
                    <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold !text-white">{company.name}</h3>
                        {editingCompany === company.id ? (
                          <div className="flex items-center gap-2">
                            <Select value={newPlan} onValueChange={setNewPlan}>
                              <SelectTrigger className="w-32 !bg-white/10 !border-white/20 !text-white">
                                <SelectValue placeholder="Seleccionar plan" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="basic">Basic</SelectItem>
                                <SelectItem value="pro">Pro</SelectItem>
                                <SelectItem value="master">Master</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              onClick={() => savePlanChange(company.id)}
                              disabled={updateSubscriptionMutation.isPending}
                              className="bg-emerald-600 hover:bg-emerald-700"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={cancelPlanChange}
                              className="!text-white/60 hover:!text-white hover:!bg-white/10"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <Badge 
                              className={`${planColors[company.subscription.plan as keyof typeof planColors]} text-white cursor-pointer hover:opacity-80`}
                              onClick={() => handlePlanChange(company.id, company.subscription.plan)}
                            >
                              {planLabels[company.subscription.plan as keyof typeof planLabels]}
                            </Badge>
                            {(() => {
                              const badge = getSubscriptionBadge(company);
                              return (
                                <Badge 
                                  variant={badge.variant}
                                  className={badge.className}
                                >
                                  {badge.text}
                                </Badge>
                              );
                            })()}
                            {company.promotionalCode && (
                              <Badge 
                                variant="secondary" 
                                className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 flex items-center gap-1"
                              >
                                <Tag className="w-3 h-3" />
                                {company.promotionalCode.code}
                              </Badge>
                            )}
                          </>
                        )}
                        
                        {editingCompany !== company.id && (
                          <div className="flex items-center gap-2 ml-auto">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditMode(company)}
                              className="!text-white/60 hover:!text-white hover:!bg-white/10"
                              title="Editar empresa"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setLocation(`/super-admin/companies/${company.id}`)}
                              className="!text-white/60 hover:!text-white hover:!bg-white/10"
                              title="Ver detalles"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1 sm:gap-4 text-sm !text-white/60 mt-1">
                        <span className="truncate">{company.cif}</span>
                        <span className="hidden sm:inline">•</span>
                        <span className="truncate">{company.email}</span>
                        <span className="hidden sm:inline">•</span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {company.userCount} usuarios
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {filteredCompanies.length === 0 && (
                <div className="text-center py-12">
                  <Filter className="w-12 h-12 !text-white/30 mx-auto mb-4" />
                  <p className="!text-white/60">No se encontraron empresas con los filtros aplicados</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}
