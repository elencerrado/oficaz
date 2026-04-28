import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { getAuthHeaders } from '@/lib/auth';
import { usePageTitle } from '@/hooks/use-page-title';
import { 
  Building2, 
  Search,
  Filter,
  Check,
  X,
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
  Boxes,
  HardDrive,
  Database,
  Cpu,
  DollarSign
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
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useStandardInfiniteScroll } from '@/hooks/use-standard-infinite-scroll';
import { useIncrementalList } from '@/hooks/use-incremental-list';
import { InfiniteListFooter } from '@/components/ui/infinite-list-footer';
import { GLASS_FILTER_SEARCH_INPUT_CLASS, GLASS_FILTER_SELECT_TRIGGER_CLASS } from '@/lib/filter-styles';

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
  createdAt: string;
  name: string;
  cif: string;
  email: string;
  demoMode?: boolean;
  userCount: number;
  activeUsers?: number;
  trialDurationDays?: number;
  subscription: {
    plan: string;
    status: string;
    stripeSubscriptionId?: string;
    startDate?: string;
    firstPaymentDate?: string;
    nextPaymentDate?: string;
    updatedAt?: string;
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
  billingSummary?: {
    monthlyBaseAmount?: number;
    latestInvoiceAmount?: number | null;
    latestInvoiceDate?: string | null;
    latestInvoiceHasProration?: boolean;
  };
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

interface SubscriptionPlan {
  id: number;
  name: string;
  features?: Record<string, unknown>;
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

// Subscription status badge colors
const subscriptionStatusColors = {
  active: 'bg-emerald-500',
  trial: 'bg-blue-500',
  expired: 'bg-gray-600',
  cancelled: 'bg-orange-600',
  deleted: 'bg-red-900'
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

  // 🔧 FIX: Check actual subscription status FIRST before checking trial expiration
  // Status is the source of truth for whether they have access
  if (company.subscription.status === 'active') {
    return {
      text: company.subscription.stripeSubscriptionId ? 'Suscrito' : 'Activo',
      variant: 'default' as const,
      className: 'bg-emerald-500 text-white'
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

function UsageStatsCardInline({ companyId }: { companyId: number }) {
  const buildFallbackStats = () => {
    const now = new Date();
    return {
      period: {
        monthName: now.toLocaleString('es-ES', { month: 'long', year: 'numeric' }),
      },
      storage: {
        r2: { bytes: 0, costUSD: 0 },
        database: { bytes: 0, costUSD: 0 },
        total: { bytes: 0, costUSD: 0 },
      },
      compute: { apiRequests: 0, apiComputeTimeMs: 0, costUSD: 0 },
      ai: { tokensUsed: 0, requestsCount: 0, costUSD: 0 },
      total: { costUSD: 0, costEUR: 0 },
      lastUpdated: now.toISOString(),
      degraded: true,
      degradedReason: 'fetch_timeout_or_error',
    };
  };

  const { data, isLoading } = useQuery({
    queryKey: ['/api/super-admin/companies', companyId, 'usage-stats'],
    queryFn: async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      try {
        const response = await fetch(`/api/super-admin/companies/${companyId}/usage-stats`, {
          headers: getAuthHeaders(),
          signal: controller.signal,
        });

        if (!response.ok) {
          return buildFallbackStats();
        }

        return response.json();
      } catch (_fetchError) {
        return buildFallbackStats();
      } finally {
        clearTimeout(timeout);
      }
    },
    staleTime: 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-white/80">
        <LoadingSpinner size="sm" />
        <span>Cargando estadísticas...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-4 text-white/70">
        <div className="flex items-center gap-2 text-red-300">
          <AlertCircle className="w-5 h-5" />
          <span>Error al cargar estadísticas</span>
        </div>
      </div>
    );
  }

  const period = data?.period || { monthName: 'Mes actual' };
  const storage = data?.storage || {
    r2: { bytes: 0, costUSD: 0 },
    database: { bytes: 0, costUSD: 0 },
    total: { bytes: 0, costUSD: 0 },
  };
  const compute = data?.compute || { apiRequests: 0, apiComputeTimeMs: 0, costUSD: 0 };
  const ai = data?.ai || { tokensUsed: 0, requestsCount: 0, costUSD: 0 };
  const total = data?.total || { costUSD: 0, costEUR: 0 };

  const formatBytes = (bytes: number) => {
    const safeBytes = Number.isFinite(bytes) ? bytes : 0;
    if (safeBytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(safeBytes) / Math.log(k));
    return `${parseFloat((safeBytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <div className="space-y-4">
      {/* Period header */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-white/70">
          <span className="font-medium capitalize">{period.monthName}</span>
        </div>
        <div className="text-xs text-white/50">
          Actualizado: {data.lastUpdated ? new Date(data.lastUpdated).toLocaleString('es-ES') : 'N/A'}
        </div>
      </div>

      {data?.degraded && (
        <div className="rounded-lg border border-yellow-400/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">
          Mostrando datos temporales mientras se recalculan las estadisticas.
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/5 p-4 rounded-lg border border-white/10">
          <div className="text-xs text-white/60 flex items-center gap-2">
            <HardDrive className="w-4 h-4" /> R2 Storage
          </div>
          <div className="text-lg font-bold text-white mt-1">{formatBytes(storage.r2.bytes)}</div>
          <div className="text-xs text-emerald-400 mt-1">${storage.r2.costUSD.toFixed(4)}/mes</div>
        </div>
        <div className="bg-white/5 p-4 rounded-lg border border-white/10">
          <div className="text-xs text-white/60 flex items-center gap-2">
            <Database className="w-4 h-4" /> Base de Datos
          </div>
          <div className="text-lg font-bold text-white mt-1">{formatBytes(storage.database.bytes)}</div>
          <div className="text-xs text-emerald-400 mt-1">${storage.database.costUSD.toFixed(4)}/mes</div>
        </div>
        <div className="bg-blue-500/10 p-4 rounded-lg border border-blue-500/30">
          <div className="text-xs text-blue-200 flex items-center gap-2">
            <DollarSign className="w-4 h-4" /> Total Storage
          </div>
          <div className="text-lg font-bold text-blue-100 mt-1">{formatBytes(storage.total.bytes)}</div>
          <div className="text-xs text-blue-200 mt-1">${storage.total.costUSD.toFixed(4)}/mes</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white/5 p-4 rounded-lg border border-white/10">
          <div className="text-xs text-white/60 flex items-center gap-2">
            <Cpu className="w-4 h-4" /> API / Compute
          </div>
          <div className="text-lg font-bold text-white mt-1">{(compute.apiRequests || 0).toLocaleString()} req</div>
          <div className="text-xs text-white/50">{((compute.apiComputeTimeMs || 0) / 1000).toFixed(1)} s CPU</div>
          <div className="text-xs text-emerald-400 mt-1">${(compute.costUSD || 0).toFixed(4)}/mes</div>
        </div>

        <div className="bg-white/5 p-4 rounded-lg border border-white/10">
          <div className="text-xs text-white/60 flex items-center gap-2">
            <Brain className="w-4 h-4" /> IA
          </div>
          <div className="text-lg font-bold text-white mt-1">{(ai.tokensUsed || 0).toLocaleString()} tokens</div>
          <div className="text-xs text-white/50">{(ai.requestsCount || 0).toLocaleString()} peticiones</div>
          <div className="text-xs text-emerald-400 mt-1">${(ai.costUSD || 0).toFixed(4)}/mes</div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-emerald-500/15 to-blue-500/10 p-4 rounded-lg border border-emerald-500/30">
        <div className="flex items-center justify-between text-white">
          <div>
            <div className="text-xs text-white/60">Costo Total Estimado</div>
            <div className="text-2xl font-bold">${(total.costUSD || 0).toFixed(2)} USD</div>
            <div className="text-sm text-emerald-300">≈ €{(total.costEUR || 0).toFixed(2)} EUR</div>
          </div>
          <div className="text-xs text-white/50 text-right">
            <div>Storage: ${(storage.total?.costUSD || 0).toFixed(4)}</div>
            <div>Compute: ${(compute.costUSD || 0).toFixed(4)}</div>
            {(ai.tokensUsed || 0) > 0 && <div>AI: ${(ai.costUSD || 0).toFixed(4)}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SuperAdminCompanies() {
  usePageTitle('SuperAdmin - Empresas');
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  
  const loadMoreCompaniesRef = useRef<HTMLDivElement | null>(null);
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
  const [newTrialEndDate, setNewTrialEndDate] = useState('');
  const [useCustomSettings, setUseCustomSettings] = useState(false);
  const [customFeatures, setCustomFeatures] = useState<any>({});
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: companies } = useQuery<Company[]>({
    queryKey: ['/api/super-admin/companies'],
    queryFn: async () => {
      const response = await fetch('/api/super-admin/companies', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch companies');
      return response.json();
    },
    retry: false,
    staleTime: 60000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Fetch company details when editing
  const { data: selectedCompanyDetail, refetch: refetchCompanyDetail } = useQuery<Company>({
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
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Fetch available plans
  const { data: plans } = useQuery<SubscriptionPlan[]>({
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
      const response = await fetch(`/api/super-admin/companies/${editingCompanyId}/delete-permanently`, {
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
      
      // Calculate trial end date from createdAt + trialDurationDays
      const createdAt = new Date(selectedCompanyDetail.createdAt);
      const trialDays = selectedCompanyDetail.trialDurationDays || 14;
      const trialEndDate = new Date(createdAt);
      trialEndDate.setDate(trialEndDate.getDate() + trialDays);
      setNewTrialEndDate(trialEndDate.toISOString().split('T')[0]);
    }
  }, [selectedCompanyDetail]);

  const filteredCompanies = useMemo(() => {
    if (!companies) return [];

    const normalizedSearch = searchTerm.trim().toLowerCase();

    return companies.filter((company: Company) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        company.name.toLowerCase().includes(normalizedSearch) ||
        company.cif.toLowerCase().includes(normalizedSearch) ||
        company.email.toLowerCase().includes(normalizedSearch);

      const matchesStatus = filterStatus === "all" || company.subscription.status === filterStatus;

      return matchesSearch && matchesStatus;
    });
  }, [companies, searchTerm, filterStatus]);

  const {
    displayedCount: displayedCompaniesCount,
    visibleItems: visibleCompanies,
    hasMore: hasMoreCompaniesToDisplay,
    loadMore: loadMoreCompanies,
  } = useIncrementalList({
    items: filteredCompanies,
    mobileInitialCount: 10,
    desktopInitialCount: 24,
    resetKey: `${searchTerm}-${filterStatus}`,
  });

  useStandardInfiniteScroll({
    targetRef: loadMoreCompaniesRef,
    enabled: true,
    canLoadMore: hasMoreCompaniesToDisplay,
    onLoadMore: loadMoreCompanies,
    dependencyKey: `${displayedCompaniesCount}-${filteredCompanies.length}`,
    rootMargin: '100px',
  });

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
    // Force refetch to get fresh data with correct contractedRoles
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/companies', company.id] });
    }, 0);
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
    if (!newTrialEndDate || !selectedCompanyDetail) return;
    
    const createdAt = new Date(selectedCompanyDetail.createdAt);
    const endDate = new Date(newTrialEndDate);
    const diffTime = endDate.getTime() - createdAt.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) {
      toast({ 
        title: "Error", 
        description: "La fecha de fin debe ser posterior a la creación de la empresa",
        variant: "destructive"
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
    const subscriptionStatus = company.subscription?.status;
    const hasSubscriptionHistory = Boolean(
      company.subscription?.stripeSubscriptionId ||
      company.subscription?.firstPaymentDate ||
      ['active', 'pending_cancel', 'cancelled', 'inactive'].includes(subscriptionStatus)
    );
    const showSubscriptionCard = hasSubscriptionHistory && subscriptionStatus !== 'trial';

    const subscriptionStartDate = company.subscription?.firstPaymentDate || company.subscription?.startDate || company.createdAt;
    const nextPaymentDate = company.subscription?.nextPaymentDate;
    const monthlyAmount = Number(
      company.subscription?.customMonthlyPrice ??
      company.calculatedMonthlyPrice ??
      company.subscription?.monthlyPrice ??
      0
    );
    const latestInvoiceAmount = company.billingSummary?.latestInvoiceAmount;
    const latestInvoiceDate = company.billingSummary?.latestInvoiceDate;
    const latestInvoiceHasProration = company.billingSummary?.latestInvoiceHasProration;

    const getMonthsSince = (dateValue?: string) => {
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
    const displayNextPaymentDate = (() => {
      if (nextPaymentDate) return new Date(nextPaymentDate);
      if (subscriptionStatus === 'active' || subscriptionStatus === 'pending_cancel') {
        const fallback = new Date();
        fallback.setMonth(fallback.getMonth() + 1);
        return fallback;
      }
      return null;
    })();

    const subscriptionBadge = (() => {
      if (subscriptionStatus === 'active') return { text: 'Activa', className: 'bg-emerald-500/20 text-emerald-300' };
      if (subscriptionStatus === 'pending_cancel') return { text: 'Cancelacion programada', className: 'bg-orange-500/20 text-orange-300' };
      if (subscriptionStatus === 'cancelled') return { text: 'Cancelada', className: 'bg-red-500/20 text-red-300' };
      if (subscriptionStatus === 'inactive') return { text: 'Inactiva', className: 'bg-slate-500/20 text-slate-300' };
      return { text: 'Sin suscripcion', className: 'bg-blue-500/20 text-blue-300' };
    })();
    
    return (
      <SuperAdminLayout>
        <div className="container mx-auto px-6 py-8 space-y-6">
          <Button
            variant="ghost"
            onClick={() => setEditingCompanyId(null)}
            className="!text-white/70 hover:!text-white hover:!bg-white/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>

          {/* Company Info - No Background */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold !text-white">{company.name}</h2>
              <div className="flex items-center gap-4 text-sm !text-white/60 mt-1">
                <span>CIF: {company.cif}</span>
                <span>•</span>
                <span>{company.email}</span>
                <span>•</span>
                <span>{company.userCount} usuarios</span>
              </div>
            </div>
          </div>

          {/* Trial or Subscription Status - Full Width Minimal */}
          <Card className="!bg-white/10 backdrop-blur-xl !border-white/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Crown className="w-5 h-5 !text-white/70" />
                  <span className="text-sm font-medium !text-white/80">{showSubscriptionCard ? 'Suscripcion' : 'Trial'}</span>
                </div>
                
                {!showSubscriptionCard && editingTrialDuration ? (
                  <>
                    <div className="flex-1 max-w-xs">
                      <Input
                        type="date"
                        value={newTrialEndDate}
                        min={new Date(company.createdAt).toISOString().split('T')[0]}
                        onChange={(e) => setNewTrialEndDate(e.target.value)}
                        className="!bg-white/10 !border-white/20 !text-white"
                      />
                    </div>
                    {newTrialEndDate && company && (
                      <span className="text-sm !text-white/70">
                        {(() => {
                          const createdAt = new Date(company.createdAt);
                          const endDate = new Date(newTrialEndDate);
                          const diffTime = endDate.getTime() - createdAt.getTime();
                          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                          return `${diffDays > 0 ? diffDays : 0} días`;
                        })()}
                      </span>
                    )}
                    <Button size="sm" onClick={handleTrialDurationSave} disabled={updateCompanyMutation.isPending}>
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingTrialDuration(false)} className="!text-white/60">
                      <X className="w-4 h-4" />
                    </Button>
                  </>
                ) : showSubscriptionCard ? (
                  <>
                    <div className="flex-1 flex items-center gap-4 flex-wrap">
                      <span className="!text-white font-medium">
                        {subscriptionStartDate ? new Date(subscriptionStartDate).toLocaleDateString('es-ES') : 'No disponible'}
                      </span>
                      <span className="text-sm !text-white/60">
                        ({monthsSubscribed} {monthsSubscribed === 1 ? 'mes' : 'meses'})
                      </span>
                      <span className="text-sm !text-white/70">
                        {displayNextPaymentDate
                          ? `Proximo pago: ${displayNextPaymentDate.toLocaleDateString('es-ES')}`
                          : 'Sin proximo cobro'}
                      </span>
                      <span className="text-sm !text-white/80 font-medium">
                        €{monthlyAmount.toFixed(2)}/mes
                      </span>
                      <Badge className={subscriptionBadge.className}>{subscriptionBadge.text}</Badge>
                      {latestInvoiceAmount !== null && latestInvoiceAmount !== undefined && (
                        <span className="text-sm !text-white/60">
                          Ultima factura: €{Number(latestInvoiceAmount).toFixed(2)}
                          {latestInvoiceDate ? ` (${new Date(latestInvoiceDate).toLocaleDateString('es-ES')})` : ''}
                          {latestInvoiceHasProration ? ' - incluye prorrateos' : ''}
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex-1 flex items-center gap-4">
                      <span className="!text-white font-medium">
                        {(() => {
                          const createdAt = new Date(company.createdAt);
                          const trialDays = company.trialDurationDays || 14;
                          const trialEnd = new Date(createdAt);
                          trialEnd.setDate(trialEnd.getDate() + trialDays);
                          return trialEnd.toLocaleDateString('es-ES');
                        })()}
                      </span>
                      <span className="text-sm !text-white/60">
                        ({company.trialDurationDays || 14} días)
                      </span>
                      {company.trialInfo && (
                        <Badge className={company.trialInfo.isTrialActive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>
                          {company.trialInfo.isTrialActive ? `Activo - ${company.trialInfo.daysRemaining}d restantes` : 'Expirado'}
                        </Badge>
                      )}
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setEditingTrialDuration(true)} className="!text-white/60">
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="!bg-white/10 backdrop-blur-xl !border-white/20">
            <CardHeader>
              <CardTitle className="!text-white text-base flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Modo demo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="!text-white font-medium">Empresa demo sin cobro</p>
                  <p className="text-sm !text-white/60">
                    Mantiene la empresa activa sin generar suscripciones ni cobros en Stripe.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {company.demoMode && (
                    <Badge className="bg-amber-500/20 text-amber-300">Demo</Badge>
                  )}
                  <Switch
                    checked={company.demoMode === true}
                    onCheckedChange={handleDemoModeToggle}
                    disabled={updateCompanyMutation.isPending}
                  />
                </div>
              </div>
              <div className="text-xs !text-white/50">
                Al activarlo, se limpia cualquier borrado programado y se excluye a la empresa de los automatismos de trial a Stripe.
              </div>
            </CardContent>
          </Card>

          {/* Subscription Dashboard - 3 Column iOS Style */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 xl:max-h-[400px]">
            {/* Column 1: User Mix */}
            <Card className="!bg-white/10 backdrop-blur-xl !border-white/15 rounded-3xl">
              <CardHeader className="pb-2">
                <CardTitle className="!text-white text-base flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Usuarios (asientos contratados)
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
                  <div className="text-xl font-bold text-amber-400">{Math.max(0, company.contractedRoles?.admins || 0)}</div>
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
                  <div className="text-xl font-bold text-purple-400">{Math.max(0, company.contractedRoles?.managers || 0)}</div>
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
                  <div className="text-xl font-bold text-blue-400">{Math.max(0, company.contractedRoles?.employees || 0)}</div>
                </div>

                {/* Stats footer - contracted seats total */}
                {(() => {
                  const admins = Math.max(0, company.contractedRoles?.admins || 0);
                  const managers = Math.max(0, company.contractedRoles?.managers || 0);
                  const employees = Math.max(0, company.contractedRoles?.employees || 0);
                  const totalSeats = admins + managers + employees;
                  return (
                    <div className="pt-2 border-t border-white/10 flex justify-start text-[10px] !text-white/50">
                      <span>{totalSeats} asientos contratados</span>
                    </div>
                  );
                })()}
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
                  {(() => {
                    const admins = Math.max(0, company.contractedRoles?.admins || 0);
                    const managers = Math.max(0, company.contractedRoles?.managers || 0);
                    const employees = Math.max(0, company.contractedRoles?.employees || 0);
                    const usersCost = (admins * 6) + (managers * 4) + (employees * 2);
                    const addonsCost = company.activeAddons?.reduce((sum: number, a: ActiveAddon) => sum + (parseFloat(a.monthlyPrice) || 0), 0) || 0;
                    const totalCost = usersCost + addonsCost;
                    
                    return (
                      <>
                        <div className="flex justify-between items-center p-2 rounded-lg bg-white/5">
                          <span className="!text-white/70">Usuarios</span>
                          <span className="!text-white font-medium">€{usersCost.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center p-2 rounded-lg bg-white/5">
                          <span className="!text-white/70">Complementos</span>
                          <span className="!text-white font-medium">€{addonsCost.toFixed(2)}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
                
                {/* Total */}
                <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30">
                  <div className="text-center">
                    <div className="text-[10px] !text-white/60">Total mensual</div>
                    <div className="text-2xl font-black text-emerald-400">
                      {(() => {
                        const admins = Math.max(0, company.contractedRoles?.admins || 0);
                        const managers = Math.max(0, company.contractedRoles?.managers || 0);
                        const employees = Math.max(0, company.contractedRoles?.employees || 0);
                        const usersCost = (admins * 6) + (managers * 4) + (employees * 2);
                        const addonsCost = company.activeAddons?.reduce((sum: number, a: ActiveAddon) => sum + (parseFloat(a.monthlyPrice) || 0), 0) || 0;
                        return `€${(usersCost + addonsCost).toFixed(2)}`;
                      })()}
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

          {/* Usage Statistics & Costs */}
          <Card className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-xl border-purple-500/30">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Estadísticas de Uso y Costos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <UsageStatsCardInline companyId={company.id} />
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="bg-red-500/10 backdrop-blur-xl border-red-500/30">
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
                    className={GLASS_FILTER_SEARCH_INPUT_CLASS}
                  />
                </div>
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className={`w-48 ${GLASS_FILTER_SELECT_TRIGGER_CLASS}`}>
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

        {/* Title and counter */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold !text-white">
            Empresas ({filteredCompanies.length})
          </h2>
          <Badge variant="secondary" className="bg-white/20 text-white">
            {filteredCompanies.length} de {companies?.length || 0}
          </Badge>
        </div>

        {/* Companies Cards - Direct Grid */}
        <div className="space-y-4">
          {visibleCompanies.map((company: Company) => (
            <Card
              key={company.id}
              className="!bg-white/10 backdrop-blur-xl !border-white/20 cursor-pointer hover:!bg-white/15 hover:!border-white/30 transition-all duration-200 transform hover:scale-[1.01]"
              onClick={() => openEditMode(company)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3 lg:gap-4 min-w-0">
                  <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold !text-white">{company.name}</h3>
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
              </CardContent>
            </Card>
          ))}

          <InfiniteListFooter
            hasMore={hasMoreCompaniesToDisplay}
            sentinelRef={loadMoreCompaniesRef}
            onLoadMore={loadMoreCompanies}
            hintText={`Mostrando ${visibleCompanies.length} de ${filteredCompanies.length} empresas`}
            textClassName="text-white/70"
            className="pt-3"
          />
          
          {filteredCompanies.length === 0 && (
            <div className="text-center py-12 !bg-white/10 backdrop-blur-xl !border-white/20 rounded-xl">
              <Filter className="w-12 h-12 !text-white/30 mx-auto mb-4" />
              <p className="!text-white/60">No se encontraron empresas con los filtros aplicados</p>
            </div>
          )}
        </div>
      </div>
    </SuperAdminLayout>
  );
}
