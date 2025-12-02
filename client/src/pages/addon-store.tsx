import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { usePageTitle } from '@/hooks/use-page-title';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
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
  Briefcase
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
    default:
      return <Store className="h-6 w-6" />;
  }
};

const getAddonColor = (key: string) => {
  switch (key) {
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
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
  }
};

export default function AddonStore() {
  usePageTitle('Tienda - Oficaz');
  const { user, subscription } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const isAdmin = user?.role === 'admin';
  
  const [selectedAddon, setSelectedAddon] = useState<AddonWithStatus | null>(null);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showSeatsDialog, setShowSeatsDialog] = useState(false);
  
  const [additionalSeats, setAdditionalSeats] = useState({
    employees: 0,
    managers: 0,
    admins: 0
  });

  const seatPrices = {
    employees: 2,
    managers: 6,
    admins: 12
  };

  const totalSeatsPrice = 
    additionalSeats.employees * seatPrices.employees +
    additionalSeats.managers * seatPrices.managers +
    additionalSeats.admins * seatPrices.admins;

  const { data: addons, isLoading: addonsLoading } = useQuery<Addon[]>({
    queryKey: ['/api/addons'],
    enabled: !!user
  });

  const { data: companyAddons, isLoading: companyAddonsLoading } = useQuery<(CompanyAddon & { addon: Addon })[]>({
    queryKey: ['/api/company/addons'],
    enabled: !!user && isAdmin
  });

  const purchaseMutation = useMutation({
    mutationFn: async (addonId: number) => {
      return await apiRequest('POST', `/api/addons/${addonId}/purchase`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/addons'] });
      queryClient.invalidateQueries({ queryKey: ['/api/company/addons'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/addons'] });
      queryClient.invalidateQueries({ queryKey: ['/api/company/addons'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
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

  const seatsMutation = useMutation({
    mutationFn: async (seats: { employees: number; managers: number; admins: number }) => {
      return await apiRequest('POST', '/api/subscription/seats', seats);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      toast({
        title: 'Usuarios actualizados',
        description: 'Los usuarios adicionales se han añadido a tu suscripción.',
      });
      setShowSeatsDialog(false);
      setAdditionalSeats({ employees: 0, managers: 0, admins: 0 });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar los usuarios',
        variant: 'destructive'
      });
    }
  });

  const updateSeatCount = (role: 'employees' | 'managers' | 'admins', delta: number) => {
    setAdditionalSeats(prev => ({
      ...prev,
      [role]: Math.max(0, prev[role] + delta)
    }));
  };

  const confirmSeats = () => {
    if (totalSeatsPrice > 0) {
      seatsMutation.mutate(additionalSeats);
    }
  };

  if (!isAdmin) {
    return (
      <div className="px-6 py-4 min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <AlertCircle className="h-12 w-12 text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Acceso restringido</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Solo los administradores pueden acceder a la tienda de complementos.</p>
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

  const freeAddons = addonsWithStatus.filter(a => a.isFreeFeature);
  const paidAddons = addonsWithStatus.filter(a => !a.isFreeFeature);

  const handlePurchase = (addon: AddonWithStatus) => {
    setSelectedAddon(addon);
    setShowPurchaseDialog(true);
  };

  const handleCancel = (addon: AddonWithStatus) => {
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
    // Add-ons are NEVER included in plans - they must always be purchased separately
    // So we always return false for add-on keys
    return false;
  };

  return (
    <div className="px-6 py-4 min-h-screen bg-gray-50 dark:bg-gray-900" style={{ overflowX: 'clip' }}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Tienda de Complementos</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Añade funcionalidades extra a tu plan de suscripción</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="space-y-8">
          {freeAddons.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Gift className="h-5 w-5 text-green-600 dark:text-green-400" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Incluido en tu plan</h2>
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Gratis</Badge>
              </div>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {freeAddons.map((addon) => (
                  <Card 
                    key={addon.id} 
                    className="relative overflow-hidden border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-900/20 h-[280px] flex flex-col"
                    data-testid={`addon-card-${addon.key}`}
                  >
                    <div className="absolute top-3 right-3">
                      <Badge className="bg-green-500 text-white">
                        <Check className="h-3 w-3 mr-1" />
                        Incluido
                      </Badge>
                    </div>
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${getAddonColor(addon.key)}`}>
                          {getAddonIcon(addon.key)}
                        </div>
                        <CardTitle className="text-base text-gray-900 dark:text-gray-100">{addon.name}</CardTitle>
                      </div>
                      <CardDescription className="text-sm text-gray-500 dark:text-gray-400 h-10 line-clamp-2">
                        {addon.shortDescription || addon.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow flex flex-col justify-end pt-0">
                      <div className="mt-auto">
                        <div className="mb-3">
                          <div className="flex items-baseline gap-1">
                            <span className="text-xl font-bold text-green-600 dark:text-green-400">Gratis</span>
                          </div>
                        </div>
                        <Button 
                          variant="outline" 
                          className="w-full text-green-600 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-900/30" 
                          disabled
                          data-testid={`addon-included-${addon.key}`}
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Incluido en tu plan
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Additional User Seats Section - FIRST */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <UserPlus className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Usuarios adicionales</h2>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Employees Card */}
              <Card className="relative overflow-hidden transition-all hover:shadow-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 h-[280px] flex flex-col" data-testid="seats-employees-card">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      <Users className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-base text-gray-900 dark:text-gray-100">Empleados</CardTitle>
                  </div>
                  <CardDescription className="text-sm text-gray-500 dark:text-gray-400 h-10 line-clamp-2">
                    Añade empleados adicionales a tu equipo
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col justify-end pt-0">
                  <div className="mb-3">
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        {seatPrices.employees.toFixed(2)}€
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 text-sm">/mes cada uno</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => updateSeatCount('employees', -1)}
                      disabled={additionalSeats.employees === 0}
                      data-testid="seats-employees-minus"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-10 text-center text-xl font-bold text-gray-900 dark:text-gray-100" data-testid="seats-employees-count">
                      {additionalSeats.employees}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => updateSeatCount('employees', 1)}
                      data-testid="seats-employees-plus"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2 h-5">
                    {additionalSeats.employees > 0 ? `+${(additionalSeats.employees * seatPrices.employees).toFixed(2)}€/mes` : ''}
                  </p>
                </CardContent>
              </Card>

              {/* Managers Card */}
              <Card className="relative overflow-hidden transition-all hover:shadow-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 h-[280px] flex flex-col" data-testid="seats-managers-card">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                      <Briefcase className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-base text-gray-900 dark:text-gray-100">Managers</CardTitle>
                  </div>
                  <CardDescription className="text-sm text-gray-500 dark:text-gray-400 h-10 line-clamp-2">
                    Añade managers para supervisar equipos
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col justify-end pt-0">
                  <div className="mb-3">
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        {seatPrices.managers.toFixed(2)}€
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 text-sm">/mes cada uno</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => updateSeatCount('managers', -1)}
                      disabled={additionalSeats.managers === 0}
                      data-testid="seats-managers-minus"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-10 text-center text-xl font-bold text-gray-900 dark:text-gray-100" data-testid="seats-managers-count">
                      {additionalSeats.managers}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => updateSeatCount('managers', 1)}
                      data-testid="seats-managers-plus"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2 h-5">
                    {additionalSeats.managers > 0 ? `+${(additionalSeats.managers * seatPrices.managers).toFixed(2)}€/mes` : ''}
                  </p>
                </CardContent>
              </Card>

              {/* Admins Card */}
              <Card className="relative overflow-hidden transition-all hover:shadow-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 h-[280px] flex flex-col" data-testid="seats-admins-card">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      <Shield className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-base text-gray-900 dark:text-gray-100">Administradores</CardTitle>
                  </div>
                  <CardDescription className="text-sm text-gray-500 dark:text-gray-400 h-10 line-clamp-2">
                    Añade administradores con control total
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col justify-end pt-0">
                  <div className="mb-3">
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        {seatPrices.admins.toFixed(2)}€
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 text-sm">/mes cada uno</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => updateSeatCount('admins', -1)}
                      disabled={additionalSeats.admins === 0}
                      data-testid="seats-admins-minus"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-10 text-center text-xl font-bold text-gray-900 dark:text-gray-100" data-testid="seats-admins-count">
                      {additionalSeats.admins}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => updateSeatCount('admins', 1)}
                      data-testid="seats-admins-plus"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2 h-5">
                    {additionalSeats.admins > 0 ? `+${(additionalSeats.admins * seatPrices.admins).toFixed(2)}€/mes` : ''}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Total and Confirm Button */}
            {totalSeatsPrice > 0 && (
              <div className="mt-6 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total adicional mensual</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      +{totalSeatsPrice.toFixed(2)}€<span className="text-sm font-normal text-gray-500 dark:text-gray-400">/mes</span>
                    </p>
                  </div>
                  <Button 
                    onClick={() => setShowSeatsDialog(true)}
                    className="px-6"
                    data-testid="seats-confirm-button"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Añadir usuarios
                  </Button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  El importe se añadirá de forma proporcional a tu próxima factura.
                </p>
              </div>
            )}
          </div>

          {paidAddons.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <ShoppingCart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Complementos disponibles</h2>
              </div>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {paidAddons.map((addon) => {
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
                      className={`relative overflow-hidden transition-all hover:shadow-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 h-[280px] flex flex-col ${
                        isPendingCancel ? 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/20' :
                        isInCooldown ? 'border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/50' : ''
                      }`}
                      data-testid={`addon-card-${addon.key}`}
                    >
                      {isPurchased && !isPendingCancel && (
                        <div className="absolute top-3 right-3">
                          <Badge className="bg-blue-500 text-white">
                            <Check className="h-3 w-3 mr-1" />
                            Activo
                          </Badge>
                        </div>
                      )}
                      
                      {isPendingCancel && (
                        <div className="absolute top-3 right-3">
                          <Badge className="bg-amber-500 text-white">
                            <Clock className="h-3 w-3 mr-1" />
                            Se cancela pronto
                          </Badge>
                        </div>
                      )}
                      
                      {isInCooldown && (
                        <div className="absolute top-3 right-3">
                          <Badge variant="secondary" className="bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                            <RefreshCw className="h-3 w-3 mr-1" />
                            No disponible
                          </Badge>
                        </div>
                      )}

                      <CardHeader className="pb-3">
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${getAddonColor(addon.key)}`}>
                            {getAddonIcon(addon.key)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-base text-gray-900 dark:text-gray-100">{addon.name}</CardTitle>
                            <CardDescription className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                              {addon.shortDescription || addon.description}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="flex-grow flex flex-col justify-end pt-0">
                        <div className="mb-3">
                          <div className="flex items-baseline gap-1">
                            <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                              {Number(addon.monthlyPrice).toFixed(2)}€
                            </span>
                            <span className="text-gray-500 dark:text-gray-400 text-sm">/mes</span>
                          </div>
                        </div>

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

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowPurchaseDialog(false)}
              data-testid="purchase-cancel"
            >
              Cancelar
            </Button>
            <Button 
              onClick={confirmPurchase}
              disabled={purchaseMutation.isPending}
              data-testid="purchase-confirm"
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

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowCancelDialog(false)}
              data-testid="cancel-dialog-close"
            >
              Mantener activo
            </Button>
            <Button 
              variant="destructive"
              onClick={confirmCancel}
              disabled={cancelMutation.isPending}
              data-testid="cancel-confirm"
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
            <DialogTitle>Confirmar usuarios adicionales</DialogTitle>
            <DialogDescription>
              Vas a añadir los siguientes usuarios a tu suscripción.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
              {additionalSeats.employees > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-gray-700 dark:text-gray-300">{additionalSeats.employees} empleado(s)</span>
                  </div>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    +{(additionalSeats.employees * seatPrices.employees).toFixed(2)}€/mes
                  </span>
                </div>
              )}
              {additionalSeats.managers > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    <span className="text-gray-700 dark:text-gray-300">{additionalSeats.managers} manager(s)</span>
                  </div>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    +{(additionalSeats.managers * seatPrices.managers).toFixed(2)}€/mes
                  </span>
                </div>
              )}
              {additionalSeats.admins > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-gray-700 dark:text-gray-300">{additionalSeats.admins} administrador(es)</span>
                  </div>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    +{(additionalSeats.admins * seatPrices.admins).toFixed(2)}€/mes
                  </span>
                </div>
              )}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-900 dark:text-gray-100">Total mensual adicional:</span>
                  <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    +{totalSeatsPrice.toFixed(2)}€/mes
                  </span>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
              El importe se añadirá a tu próxima factura de forma proporcional.
            </p>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowSeatsDialog(false)}
              data-testid="seats-cancel"
            >
              Cancelar
            </Button>
            <Button 
              onClick={confirmSeats}
              disabled={seatsMutation.isPending}
              data-testid="seats-confirm"
            >
              {seatsMutation.isPending ? (
                <>
                  <LoadingSpinner className="h-4 w-4 mr-2" />
                  Procesando...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Confirmar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
