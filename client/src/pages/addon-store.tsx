import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { usePageTitle } from '@/hooks/use-page-title';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { PaymentMethodManager } from '@/components/PaymentMethodManager';
import { 
  Store, 
  Sparkles, 
  FileText, 
  Check, 
  AlertCircle,
  Crown,
  ShoppingCart,
  XCircle,
  Clock,
  RefreshCw,
  MessageCircle,
  Bell,
  FolderOpen,
  CalendarDays,
  LayoutGrid,
  Gift,
  Users,
  Plus,
  Minus,
  UserPlus,
  Shield,
  Briefcase,
  Package,
  CreditCard,
  LogOut
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import type { Addon, CompanyAddon } from '@shared/schema';

interface AddonWithStatus extends Omit<Addon, 'isFreeFeature'> {
  isPurchased?: boolean;
  isPendingCancel?: boolean;
  isInCooldown?: boolean;
  cooldownEndsAt?: Date | string | null;
  cancellationEffectiveDate?: Date | string | null;
  companyAddon?: CompanyAddon;
  isFreeFeature: boolean;
}

const getAddonIcon = (key: string) => {
  switch (key) {
    case 'employees':
      return <Users className="h-6 w-6" />;
    case 'ai_assistant':
      return <Sparkles className="h-6 w-6" />;
    case 'work_reports':
      return <FileText className="h-6 w-6" />;
    case 'messages':
      return <MessageCircle className="h-6 w-6" />;
    case 'reminders':
      return <Bell className="h-6 w-6" />;
    case 'documents':
      return <FolderOpen className="h-6 w-6" />;
    case 'time_tracking':
      return <Clock className="h-6 w-6" />;
    case 'vacation':
      return <CalendarDays className="h-6 w-6" />;
    case 'schedules':
      return <LayoutGrid className="h-6 w-6" />;
    case 'inventory':
      return <Package className="h-6 w-6" />;
    default:
      return <Store className="h-6 w-6" />;
  }
};

const getAddonColor = (key: string, isFree: boolean = false) => {
  if (isFree) {
    return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  }
  switch (key) {
    case 'employees':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'ai_assistant':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    case 'work_reports':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'messages':
      return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
    case 'reminders':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    case 'documents':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'time_tracking':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'vacation':
      return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400';
    case 'schedules':
      return 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400';
    case 'inventory':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
  }
};

export default function AddonStore() {
  usePageTitle('Tienda - Oficaz');
  const { user, subscription, refreshUser, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  
  const handleLogout = async () => {
    await logout();
    setLocation('/login');
  };

  // Query for manager permissions
  const { data: permissionsData } = useQuery<{ managerPermissions: {
    canCreateDeleteEmployees: boolean;
    canCreateDeleteManagers: boolean;
    canBuyRemoveFeatures: boolean;
    canBuyRemoveUsers: boolean;
    canEditCompanyData: boolean;
  } }>({
    queryKey: ['/api/settings/manager-permissions'],
    enabled: isAdmin || isManager,
  });
  
  const managerPermissions = permissionsData?.managerPermissions;
  
  const [selectedAddon, setSelectedAddon] = useState<AddonWithStatus | null>(null);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showSeatsDialog, setShowSeatsDialog] = useState(false);
  const [showPaymentManager, setShowPaymentManager] = useState(false);
  
  const { data: trialStatus } = useQuery<{ isBlocked: boolean; trialEndDate: string }>({
    queryKey: ['/api/account/trial-status'],
    staleTime: 30000,
    enabled: !!user && isAdmin,
  });
  
  const { data: paymentMethods = [] } = useQuery<any[]>({
    queryKey: ['/api/account/payment-methods'],
    retry: false,
    enabled: !!user && isAdmin,
  });
  
  const isTrialExpired = trialStatus?.isBlocked === true;
  
  const seatPrices = {
    employees: 2,
    managers: 4,
    admins: 6
  };

  const { data: addons, isLoading: addonsLoading } = useQuery<Addon[]>({
    queryKey: ['/api/addons'],
    enabled: !!user
  });
  
  // Get subscription info with user counts - enabled for admins and managers (server validates role)
  // Permissions check is only for actions (buying/removing users), not for viewing data
  const { data: subscriptionInfo } = useQuery<{
    userLimits: { maxEmployees: number; maxManagers: number; maxAdmins: number };
    userCounts: { employees: number; managers: number; admins: number };
  }>({
    queryKey: ['/api/subscription/info'],
    enabled: !!user && (isAdmin || isManager)
  });
  
  // Current users by role (from actual users in system)
  const currentUserCounts = subscriptionInfo?.userCounts || { employees: 0, managers: 0, admins: 0 };
  
  // ALL seats are paid - extraAdmins/extraManagers/extraEmployees = total contracted
  const contractedSeats = {
    employees: subscription?.extraEmployees || 0,
    managers: subscription?.extraManagers || 0,
    admins: subscription?.extraAdmins || 0
  };
  
  // Minimum: must have at least 1 admin (paid €6)
  const minimumSeats = { employees: 0, managers: 0, admins: 1 };
  
  // Editable seat counts (starts with TOTAL contracted, not just extras)
  const [editedSeats, setEditedSeats] = useState<{
    employees: number;
    managers: number;
    admins: number;
  } | null>(null);
  
  // Initialize edited seats when subscription loads - show TOTAL seats
  const displaySeats = editedSeats || contractedSeats;
  
  // Check if there are pending changes (compare against total, not extras)
  const hasChanges = editedSeats !== null && (
    editedSeats.employees !== contractedSeats.employees ||
    editedSeats.managers !== contractedSeats.managers ||
    editedSeats.admins !== contractedSeats.admins
  );
  
  // Calculate price difference (all seats are paid)
  const currentPrice = 
    contractedSeats.employees * seatPrices.employees +
    contractedSeats.managers * seatPrices.managers +
    contractedSeats.admins * seatPrices.admins;
    
  // New price: all seats are paid
  const newPrice = 
    displaySeats.employees * seatPrices.employees +
    displaySeats.managers * seatPrices.managers +
    displaySeats.admins * seatPrices.admins;
    
  const priceDifference = newPrice - currentPrice;

  // Company addons - enabled for admins and managers (server validates role)
  // Permissions check is only for actions (buying/removing features), not for viewing data
  const { data: companyAddons, isLoading: companyAddonsLoading } = useQuery<(CompanyAddon & { addon: Addon })[]>({
    queryKey: ['/api/company/addons'],
    enabled: !!user && (isAdmin || isManager)
  });

  const purchaseMutation = useMutation({
    mutationFn: async (addonId: number) => {
      return await apiRequest('POST', `/api/addons/${addonId}/purchase`);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['/api/addons'] });
      queryClient.invalidateQueries({ queryKey: ['/api/company/addons'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      queryClient.invalidateQueries({ queryKey: ['/api/account/trial-status'] });
      await refreshUser();
      toast({
        title: 'Complemento añadido',
        description: 'El complemento se ha añadido correctamente a tu suscripción.',
      });
      setShowPurchaseDialog(false);
      setSelectedAddon(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo añadir el complemento',
        variant: 'destructive'
      });
    }
  });

  const cancelMutation = useMutation({
    mutationFn: async (addonId: number) => {
      return await apiRequest('POST', `/api/addons/${addonId}/cancel`);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['/api/addons'] });
      queryClient.invalidateQueries({ queryKey: ['/api/company/addons'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      queryClient.invalidateQueries({ queryKey: ['/api/account/trial-status'] });
      await refreshUser();
      toast({
        title: 'Complemento cancelado',
        description: 'El complemento se cancelará al final del período de facturación.',
      });
      setShowCancelDialog(false);
      setSelectedAddon(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo cancelar el complemento',
        variant: 'destructive'
      });
    }
  });

  // Mutation for updating seats (handles both increase and decrease)
  const updateSeatsMutation = useMutation({
    mutationFn: async (data: { action: 'set'; seats: { employees: number; managers: number; admins: number } }) => {
      // All seats are paid, calculate difference from current
      const diff = {
        employees: data.seats.employees - contractedSeats.employees,
        managers: data.seats.managers - contractedSeats.managers,
        admins: data.seats.admins - contractedSeats.admins
      };
      
      // If increasing, use add endpoint
      if (diff.employees > 0 || diff.managers > 0 || diff.admins > 0) {
        const toAdd = {
          employees: Math.max(0, diff.employees),
          managers: Math.max(0, diff.managers),
          admins: Math.max(0, diff.admins)
        };
        if (toAdd.employees > 0 || toAdd.managers > 0 || toAdd.admins > 0) {
          await apiRequest('POST', '/api/subscription/seats', toAdd);
        }
      }
      
      // If decreasing, use reduce endpoint
      if (diff.employees < 0 || diff.managers < 0 || diff.admins < 0) {
        const toReduce = {
          employees: Math.max(0, -diff.employees),
          managers: Math.max(0, -diff.managers),
          admins: Math.max(0, -diff.admins)
        };
        if (toReduce.employees > 0 || toReduce.managers > 0 || toReduce.admins > 0) {
          await apiRequest('POST', '/api/subscription/seats/reduce', toReduce);
        }
      }
      
      return { success: true };
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      queryClient.invalidateQueries({ queryKey: ['/api/company/addons'] });
      queryClient.invalidateQueries({ queryKey: ['/api/account/trial-status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/subscription/info'] });
      await refreshUser();
      toast({
        title: 'Usuarios actualizados',
        description: 'Los cambios en usuarios se han aplicado correctamente.',
      });
      setEditedSeats(null);
      setShowSeatsDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar los usuarios',
        variant: 'destructive'
      });
    }
  });

  // Update seat count with validation
  const updateSeatCount = (role: 'employees' | 'managers' | 'admins', delta: number) => {
    // Check manager permissions for buying/removing users
    if (isManager && !managerPermissions?.canBuyRemoveUsers) {
      toast({
        title: 'Sin Permisos',
        description: 'No tienes permiso para modificar usuarios. Contacta con tu administrador.',
        variant: 'destructive',
      });
      return;
    }
    
    const current = editedSeats || { ...contractedSeats };
    // Cannot go below minimum seats (1 admin minimum required)
    const minValue = minimumSeats[role];
    const newValue = Math.max(minValue, current[role] + delta);
    
    // When reducing, check if there are users occupying those seats
    if (delta < 0) {
      const currentUsers = currentUserCounts[role];
      if (newValue < currentUsers) {
        const roleNames = { employees: 'empleados', managers: 'managers', admins: 'administradores' };
        toast({
          title: 'No se puede reducir',
          description: `Tienes ${currentUsers} ${roleNames[role]} activos. Primero debes eliminar usuarios de ese rol antes de reducir las plazas.`,
          variant: 'destructive'
        });
        return;
      }
    }
    
    setEditedSeats({
      ...current,
      [role]: newValue
    });
  };

  // Cancel changes
  const cancelChanges = () => {
    setEditedSeats(null);
  };

  // Apply changes
  const applyChanges = () => {
    if (hasChanges && editedSeats) {
      setShowSeatsDialog(true);
    }
  };
  
  const confirmSeats = () => {
    if (hasChanges && editedSeats) {
      updateSeatsMutation.mutate({ action: 'set', seats: editedSeats });
    }
  };

  // Check if manager has any store-related permissions
  const managerCanAccessStore = isManager && (
    managerPermissions?.canBuyRemoveFeatures || 
    managerPermissions?.canBuyRemoveUsers
  );

  if (!isAdmin && !managerCanAccessStore) {
    return (
      <div className="px-6 py-4 min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <AlertCircle className="h-12 w-12 text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Acceso restringido</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">No tienes permisos para acceder a la tienda de complementos.</p>
        </div>
      </div>
    );
  }

  const isLoading = addonsLoading || companyAddonsLoading;

  const addonsWithStatus: AddonWithStatus[] = (addons || []).map(addon => {
    const companyAddon = companyAddons?.find(ca => ca.addonId === addon.id);
    const isActive = companyAddon?.status === 'active' || companyAddon?.status === 'pending_cancel';
    const isPendingCancel = companyAddon?.status === 'pending_cancel';
    const isInCooldown = !!(companyAddon?.cooldownEndsAt && new Date(companyAddon.cooldownEndsAt) > new Date());
    
    return {
      ...addon,
      isPurchased: isActive,
      isPendingCancel,
      isInCooldown,
      cooldownEndsAt: companyAddon?.cooldownEndsAt,
      cancellationEffectiveDate: companyAddon?.cancellationEffectiveDate,
      companyAddon,
      isFreeFeature: (addon as any).isFreeFeature ?? false
    };
  });

  const allAddons = addonsWithStatus;

  const handlePurchase = (addon: AddonWithStatus) => {
    // Check manager permissions for buying features
    if (isManager && !managerPermissions?.canBuyRemoveFeatures) {
      toast({
        title: 'Sin Permisos',
        description: 'No tienes permiso para comprar funcionalidades. Contacta con tu administrador.',
        variant: 'destructive',
      });
      return;
    }
    setSelectedAddon(addon);
    setShowPurchaseDialog(true);
  };

  const handleCancel = (addon: AddonWithStatus) => {
    // Check manager permissions for removing features
    if (isManager && !managerPermissions?.canBuyRemoveFeatures) {
      toast({
        title: 'Sin Permisos',
        description: 'No tienes permiso para eliminar funcionalidades. Contacta con tu administrador.',
        variant: 'destructive',
      });
      return;
    }
    setSelectedAddon(addon);
    setShowCancelDialog(true);
  };

  const confirmPurchase = () => {
    if (selectedAddon) {
      purchaseMutation.mutate(selectedAddon.id);
    }
  };

  const confirmCancel = () => {
    if (selectedAddon) {
      cancelMutation.mutate(selectedAddon.id);
    }
  };

  const featureIncludedInPlan = (key: string) => {
    return false;
  };
  
  const handlePaymentSuccess = async () => {
    await queryClient.invalidateQueries({ queryKey: ['/api/account/trial-status'] });
    await queryClient.invalidateQueries({ queryKey: ['/api/account/subscription'] });
    await queryClient.invalidateQueries({ queryKey: ['/api/account/payment-methods'] });
    await queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    await queryClient.invalidateQueries({ queryKey: ['/api/company/addons'] });
    await queryClient.refetchQueries({ queryKey: ['/api/account/subscription'] });
    await queryClient.refetchQueries({ queryKey: ['/api/auth/me'] });
    await refreshUser();
    setShowPaymentManager(false);
    window.location.reload();
  };
  
  const calculateTotalMonthlyPrice = () => {
    let total = 0;
    total += displaySeats.employees * seatPrices.employees;
    total += displaySeats.managers * seatPrices.managers;
    total += displaySeats.admins * seatPrices.admins;
    addonsWithStatus.filter(a => a.isPurchased && !a.isFreeFeature).forEach(addon => {
      total += Number(addon.monthlyPrice) || 0;
    });
    return total;
  };

  return (
    <div className="px-6 py-4 min-h-screen bg-gray-50 dark:bg-gray-900" style={{ overflowX: 'clip' }}>
      {isTrialExpired && (
        <Card className="mb-6 border-amber-300 dark:border-amber-700 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-xl text-amber-800 dark:text-amber-200">
                  Período de Prueba Finalizado
                </CardTitle>
                <CardDescription className="text-amber-700 dark:text-amber-300">
                  {trialStatus?.trialEndDate && `Tu prueba gratuita terminó el ${new Date(trialStatus.trialEndDate).toLocaleDateString('es-ES')}`}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
              Selecciona las funcionalidades y usuarios que necesitas. Tu suscripción comenzará el día que realices el pago.
            </p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    €{calculateTotalMonthlyPrice().toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">por mes</div>
                </div>
                <div className="hidden sm:block h-12 w-px bg-gray-200 dark:bg-gray-700" />
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <div>{displaySeats.admins} admin{displaySeats.admins !== 1 ? 's' : ''} • {displaySeats.managers} manager{displaySeats.managers !== 1 ? 's' : ''} • {displaySeats.employees} empleado{displaySeats.employees !== 1 ? 's' : ''}</div>
                  <div className="text-xs">{addonsWithStatus.filter(a => a.isPurchased).length} complementos activos</div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Button 
                  onClick={() => setShowPaymentManager(true)}
                  size="lg"
                  className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white shadow-md"
                  data-testid="button-add-payment-method"
                >
                  <CreditCard className="mr-2 h-5 w-5" />
                  Añadir Método de Pago
                </Button>
                <Button 
                  onClick={handleLogout}
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto"
                  data-testid="button-logout-store"
                >
                  <LogOut className="mr-2 h-5 w-5" />
                  Cerrar Sesión
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          {isTrialExpired ? 'Configura tu Suscripción' : 'Tienda de Complementos'}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {isTrialExpired 
            ? 'Elige las funcionalidades y usuarios que necesitas para tu empresa'
            : 'Añade funcionalidades extra a tu plan de suscripción'
          }
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="min-h-[280px] flex flex-col bg-white/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 animate-pulse">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-gray-700" />
                      <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded" />
                      <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
                    </div>
                  </CardHeader>
                  <CardContent className="flex-grow flex flex-col justify-end pt-0">
                    <div className="mt-auto">
                      <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
                      <div className="h-9 w-full bg-gray-200 dark:bg-gray-700 rounded" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="min-h-[280px] flex flex-col bg-white/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 animate-pulse">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-gray-700" />
                      <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded" />
                      <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
                    </div>
                  </CardHeader>
                  <CardContent className="flex-grow flex flex-col justify-end pt-0">
                    <div className="mt-auto">
                      <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
                      <div className="h-9 w-full bg-gray-200 dark:bg-gray-700 rounded" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* User Seats Section - Only show for admins or managers with canBuyRemoveUsers permission */}
          {(isAdmin || managerPermissions?.canBuyRemoveUsers) && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Gestionar usuarios</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Employees Card */}
              <Card className={`relative overflow-hidden transition-all hover:shadow-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 flex flex-col ${
                editedSeats && editedSeats.employees !== contractedSeats.employees ? 'ring-2 ring-blue-500' : ''
              }`} data-testid="seats-employees-card">
                <CardHeader className="pb-2 p-4 sm:p-6 sm:pb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      <Users className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base text-gray-900 dark:text-gray-100">Empleados</CardTitle>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {currentUserCounts.employees} activos de {displaySeats.employees} contratados
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1 sm:hidden">
                      <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                        {seatPrices.employees.toFixed(2)}€
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 text-xs">/mes</span>
                    </div>
                  </div>
                  <CardDescription className="text-sm text-gray-500 dark:text-gray-400 mt-2 hidden sm:block">
                    Tu equipo crece y necesitas más manos. Añade empleados sin límites y que todos fichen, pidan ausencias y reciban mensajes.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col justify-end pt-0 p-4 sm:p-6 sm:pt-0">
                  <div className="mb-3 hidden sm:block">
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        {seatPrices.employees.toFixed(2)}€
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 text-sm">/mes cada uno</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-3 sm:gap-4">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 sm:h-10 sm:w-10"
                      onClick={() => updateSeatCount('employees', -1)}
                      disabled={displaySeats.employees === 0}
                      data-testid="seats-employees-minus"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-10 sm:w-12 text-center text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100" data-testid="seats-employees-count">
                      {displaySeats.employees}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 sm:h-10 sm:w-10"
                      onClick={() => updateSeatCount('employees', 1)}
                      data-testid="seats-employees-plus"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Managers Card */}
              <Card className={`relative overflow-hidden transition-all hover:shadow-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 flex flex-col ${
                editedSeats && editedSeats.managers !== contractedSeats.managers ? 'ring-2 ring-purple-500' : ''
              }`} data-testid="seats-managers-card">
                <CardHeader className="pb-2 p-4 sm:p-6 sm:pb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                      <Briefcase className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base text-gray-900 dark:text-gray-100">Managers</CardTitle>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {currentUserCounts.managers} activos de {displaySeats.managers} contratados
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1 sm:hidden">
                      <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                        {seatPrices.managers.toFixed(2)}€
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 text-xs">/mes</span>
                    </div>
                  </div>
                  <CardDescription className="text-sm text-gray-500 dark:text-gray-400 mt-2 hidden sm:block">
                    ¿Necesitas ojos extra para supervisar? Los managers ven los fichajes, aprueban ausencias y mantienen todo bajo control sin molestarte.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col justify-end pt-0 p-4 sm:p-6 sm:pt-0">
                  <div className="mb-3 hidden sm:block">
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        {seatPrices.managers.toFixed(2)}€
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 text-sm">/mes cada uno</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-3 sm:gap-4">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 sm:h-10 sm:w-10"
                      onClick={() => updateSeatCount('managers', -1)}
                      disabled={displaySeats.managers === 0}
                      data-testid="seats-managers-minus"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-10 sm:w-12 text-center text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100" data-testid="seats-managers-count">
                      {displaySeats.managers}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 sm:h-10 sm:w-10"
                      onClick={() => updateSeatCount('managers', 1)}
                      data-testid="seats-managers-plus"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Admins Card */}
              <Card className={`relative overflow-hidden transition-all hover:shadow-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 flex flex-col ${
                editedSeats && editedSeats.admins !== contractedSeats.admins ? 'ring-2 ring-amber-500' : ''
              }`} data-testid="seats-admins-card">
                <CardHeader className="pb-2 p-4 sm:p-6 sm:pb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      <Shield className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base text-gray-900 dark:text-gray-100">Administradores</CardTitle>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {currentUserCounts.admins} activos de {displaySeats.admins} contratados
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1 sm:hidden">
                      <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                        {seatPrices.admins.toFixed(2)}€
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 text-xs">/mes</span>
                    </div>
                  </div>
                  <CardDescription className="text-sm text-gray-500 dark:text-gray-400 mt-2 hidden sm:block">
                    Para cuando necesitas a alguien de confianza con las llaves de todo. Control total sobre la empresa, igual que tú.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col justify-end pt-0 p-4 sm:p-6 sm:pt-0">
                  <div className="mb-3 hidden sm:block">
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        {seatPrices.admins.toFixed(2)}€
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 text-sm">/mes cada uno</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-3 sm:gap-4">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 sm:h-10 sm:w-10"
                      onClick={() => updateSeatCount('admins', -1)}
                      disabled={displaySeats.admins === 0}
                      data-testid="seats-admins-minus"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-10 sm:w-12 text-center text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100" data-testid="seats-admins-count">
                      {displaySeats.admins}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 sm:h-10 sm:w-10"
                      onClick={() => updateSeatCount('admins', 1)}
                      data-testid="seats-admins-plus"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Apply/Cancel Changes Bar - Shows when there are pending changes */}
            {hasChanges && (
              <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-white dark:bg-gray-800 rounded-lg border-2 border-blue-500 dark:border-blue-400">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                  <div className="text-center sm:text-left">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Cambios pendientes</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {priceDifference > 0 ? (
                        <span className="text-blue-600 dark:text-blue-400">+{priceDifference.toFixed(2)}€/mes adicionales</span>
                      ) : priceDifference < 0 ? (
                        <span className="text-green-600 dark:text-green-400">{priceDifference.toFixed(2)}€/mes de ahorro</span>
                      ) : (
                        <span>Sin cambio en el precio</span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2 sm:gap-3">
                    <Button 
                      variant="outline"
                      onClick={cancelChanges}
                      data-testid="seats-cancel-changes"
                      className="flex-1 sm:flex-none"
                    >
                      Cancelar
                    </Button>
                    <Button 
                      onClick={applyChanges}
                      className="flex-1 sm:flex-none sm:px-6"
                      data-testid="seats-apply-changes"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Aplicar
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
          )}

          {/* Addons Section - Only show for admins or managers with canBuyRemoveFeatures permission */}
          {(isAdmin || managerPermissions?.canBuyRemoveFeatures) && allAddons.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <ShoppingCart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Funcionalidades</h2>
              </div>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {allAddons.map((addon) => {
                  const isPurchased = addon.isPurchased;
                  const isPendingCancel = addon.isPendingCancel;
                  const isInCooldown = addon.isInCooldown && !isPurchased;
                  
                  const formatDate = (date: Date | string | null | undefined) => {
                    if (!date) return '';
                    return new Date(date).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    });
                  };
                  
                  return (
                    <Card 
                      key={addon.id} 
                      className={`relative overflow-hidden transition-all hover:shadow-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 min-h-[280px] flex flex-col ${
                        isPendingCancel ? 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/20' :
                        isInCooldown ? 'border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/50' : ''
                      }`}
                      data-testid={`addon-card-${addon.key}`}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${getAddonColor(addon.key, addon.isFreeFeature)}`}>
                            {getAddonIcon(addon.key)}
                          </div>
                          <CardTitle className="text-base text-gray-900 dark:text-gray-100">{addon.name}</CardTitle>
                        </div>
                        <CardDescription className="text-sm text-gray-500 dark:text-gray-400 line-clamp-5">
                          {addon.description}
                        </CardDescription>
                      </CardHeader>
                      
                      <CardContent className="flex-grow flex flex-col justify-end pt-0">
                        {isPendingCancel && addon.cancellationEffectiveDate && (
                          <div className="mb-3 p-2 bg-amber-50 dark:bg-amber-900/30 rounded-lg border border-amber-200 dark:border-amber-800">
                            <p className="text-xs text-amber-700 dark:text-amber-300">
                              Activo hasta el {formatDate(addon.cancellationEffectiveDate)}
                            </p>
                          </div>
                        )}

                        {isInCooldown && addon.cooldownEndsAt && (
                          <div className="mb-3 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              Disponible a partir del {formatDate(addon.cooldownEndsAt)}
                            </p>
                          </div>
                        )}

                        <div className="mt-auto">
                          <div className="mb-3">
                            <div className="flex items-baseline gap-1">
                              <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                                {Number(addon.monthlyPrice).toFixed(2)}€
                              </span>
                              <span className="text-gray-500 dark:text-gray-400 text-sm">/mes</span>
                            </div>
                          </div>
                          {isPendingCancel ? (
                            <Button 
                              variant="outline" 
                              className="w-full text-gray-500"
                              disabled
                              data-testid={`addon-pending-cancel-${addon.key}`}
                            >
                              <Clock className="h-4 w-4 mr-2" />
                              Cancelación programada
                            </Button>
                          ) : isPurchased ? (
                            <Button 
                              variant="outline" 
                              className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                              onClick={() => handleCancel(addon)}
                              data-testid={`addon-cancel-${addon.key}`}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Cancelar complemento
                            </Button>
                          ) : isInCooldown ? (
                            <Button 
                              variant="outline"
                              className="w-full"
                              disabled
                              data-testid={`addon-cooldown-${addon.key}`}
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              No disponible aún
                            </Button>
                          ) : (
                            <Button 
                              className="w-full"
                              onClick={() => handlePurchase(addon)}
                              data-testid={`addon-purchase-${addon.key}`}
                            >
                              <ShoppingCart className="h-4 w-4 mr-2" />
                              Añadir a mi suscripción
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {addonsWithStatus.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Store className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No hay complementos disponibles</h3>
              <p className="text-gray-500 dark:text-gray-400 mt-1">Los complementos estarán disponibles próximamente.</p>
            </div>
          )}
        </div>
      )}

      <Dialog open={showPurchaseDialog} onOpenChange={setShowPurchaseDialog}>
        <DialogContent data-testid="purchase-dialog">
          <DialogHeader>
            <DialogTitle>Confirmar compra</DialogTitle>
            <DialogDescription>
              Vas a añadir el complemento "{selectedAddon?.name}" a tu suscripción.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getAddonColor(selectedAddon?.key || '')}`}>
                  {getAddonIcon(selectedAddon?.key || '')}
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{selectedAddon?.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{selectedAddon?.description}</p>
                </div>
              </div>
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Precio mensual:</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {Number(selectedAddon?.monthlyPrice || 0).toFixed(2)}€/mes
                  </span>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
              El importe se añadirá a tu próxima factura de forma proporcional.
            </p>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-3 sm:gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowPurchaseDialog(false)}
              data-testid="purchase-cancel"
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button 
              onClick={confirmPurchase}
              disabled={purchaseMutation.isPending}
              data-testid="purchase-confirm"
              className="w-full sm:w-auto"
            >
              {purchaseMutation.isPending ? (
                <>
                  <LoadingSpinner className="h-4 w-4 mr-2" />
                  Procesando...
                </>
              ) : (
                <>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Confirmar compra
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent data-testid="cancel-dialog">
          <DialogHeader>
            <DialogTitle>Cancelar complemento</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que quieres cancelar el complemento "{selectedAddon?.name}"?
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    El complemento permanecerá activo hasta el final de tu período de facturación actual.
                    Después de esa fecha, perderás acceso a las funcionalidades del complemento.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-3 sm:gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowCancelDialog(false)}
              data-testid="cancel-dialog-close"
              className="w-full sm:w-auto"
            >
              Mantener activo
            </Button>
            <Button 
              variant="destructive"
              onClick={confirmCancel}
              disabled={cancelMutation.isPending}
              data-testid="cancel-confirm"
              className="w-full sm:w-auto"
            >
              {cancelMutation.isPending ? (
                <>
                  <LoadingSpinner className="h-4 w-4 mr-2" />
                  Procesando...
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancelar complemento
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSeatsDialog} onOpenChange={setShowSeatsDialog}>
        <DialogContent data-testid="seats-dialog">
          <DialogHeader>
            <DialogTitle>Confirmar cambios de usuarios</DialogTitle>
            <DialogDescription>
              Vas a actualizar la cantidad de usuarios de tu suscripción.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
              {editedSeats && (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-gray-700 dark:text-gray-300">Empleados</span>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-500 dark:text-gray-400 text-sm">{contractedSeats.employees} → </span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{editedSeats.employees}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      <span className="text-gray-700 dark:text-gray-300">Managers</span>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-500 dark:text-gray-400 text-sm">{contractedSeats.managers} → </span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{editedSeats.managers}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <span className="text-gray-700 dark:text-gray-300">Administradores</span>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-500 dark:text-gray-400 text-sm">{contractedSeats.admins} → </span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{editedSeats.admins}</span>
                    </div>
                  </div>
                </>
              )}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-900 dark:text-gray-100">Cambio mensual:</span>
                  <span className={`text-xl font-bold ${
                    priceDifference > 0 ? 'text-blue-600 dark:text-blue-400' : 
                    priceDifference < 0 ? 'text-green-600 dark:text-green-400' : 
                    'text-gray-900 dark:text-gray-100'
                  }`}>
                    {priceDifference >= 0 ? '+' : ''}{priceDifference.toFixed(2)}€/mes
                  </span>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
              {priceDifference > 0 
                ? 'El importe se añadirá a tu próxima factura de forma proporcional.'
                : priceDifference < 0
                ? 'El ahorro se reflejará en tu próxima factura.'
                : 'No hay cambio en el precio mensual.'}
            </p>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-3 sm:gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowSeatsDialog(false)}
              data-testid="seats-cancel"
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button 
              onClick={confirmSeats}
              disabled={updateSeatsMutation.isPending}
              data-testid="seats-confirm"
              className="w-full sm:w-auto"
            >
              {updateSeatsMutation.isPending ? (
                <>
                  <LoadingSpinner className="h-4 w-4 mr-2" />
                  Procesando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Confirmar cambios
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showPaymentManager && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Activar Suscripción</CardTitle>
                <CardDescription>
                  Total mensual: €{calculateTotalMonthlyPrice().toFixed(2)}/mes
                </CardDescription>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowPaymentManager(false)}
              >
                ✕
              </Button>
            </CardHeader>
            <CardContent>
              <PaymentMethodManager 
                paymentMethods={paymentMethods} 
                onPaymentSuccess={handlePaymentSuccess}
                selectedPlan="oficaz"
                selectedPlanPrice={calculateTotalMonthlyPrice()}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
