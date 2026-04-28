import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { usePageTitle } from '@/hooks/use-page-title';
import { SuperAdminLayout } from '@/components/layout/super-admin-layout';
import { getAuthHeaders } from '@/lib/auth';
import { 
  Crown, 
  Briefcase, 
  Users, 
  Shield, 
  Edit2, 
  Check, 
  X,
  Store,
  Sparkles,
  FileText,
  MessageCircle,
  Bell,
  FolderOpen,
  CalendarDays,
  LayoutGrid,
  Package,
  CreditCard,
  Clock,
  Eye,
  EyeOff,
  Beaker
} from 'lucide-react';

interface SeatPrice {
  id: number;
  roleType: string;
  monthlyPrice: string;
}

interface AddonPrice {
  id: number;
  key: string;
  name: string;
  monthlyPrice: string;
  icon: string;
  isFreeFeature: boolean;
  isActive: boolean;
  isBeta: boolean;
}

const getAddonIcon = (key: string) => {
  switch (key) {
    case 'employees':
      return <Users className="h-6 w-6" />;
    case 'crm':
      return <Briefcase className="h-6 w-6" />;
    case 'accounting':
      return <CreditCard className="h-6 w-6" />;
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
      return 'bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-400';
    case 'crm':
      return 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-400';
    case 'accounting':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'ai_assistant':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    case 'work_reports':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'messages':
      return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400';
    case 'reminders':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    case 'documents':
      return 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400';
    case 'time_tracking':
      return 'bg-stone-100 text-stone-700 dark:bg-stone-900/30 dark:text-stone-300';
    case 'vacation':
      return 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400';
    case 'schedules':
      return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
    case 'inventory':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
  }
};

export default function SuperAdminPricing() {
  usePageTitle('SuperAdmin - Gestión de Precios');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const [editingPrice, setEditingPrice] = useState('');
  const [editingAddonId, setEditingAddonId] = useState<number | null>(null);
  const [editingAddonPrice, setEditingAddonPrice] = useState('');

  // Fetch seat prices
  const { data: seatPrices, isLoading: loadingSeatPrices } = useQuery({
    queryKey: ['/api/super-admin/seat-prices'],
    queryFn: async () => {
      const response = await fetch('/api/super-admin/seat-prices', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch seat prices');
      return response.json();
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Fetch addon prices
  const { data: addonPrices, isLoading: loadingAddonPrices } = useQuery({
    queryKey: ['/api/super-admin/addon-prices'],
    queryFn: async () => {
      const response = await fetch('/api/super-admin/addon-prices', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch addon prices');
      return response.json();
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Update seat price mutation
  const updateSeatPriceMutation = useMutation({
    mutationFn: async ({ id, monthlyPrice }: { id: number; monthlyPrice: string }) => {
      const response = await fetch(`/api/super-admin/seat-prices/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ monthlyPrice: parseFloat(monthlyPrice) }),
      });
      
      if (!response.ok) {
        throw new Error('Error al actualizar el precio');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: '✅ Precio actualizado',
        description: 'El precio ha sido actualizado en la base de datos y en Stripe',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/seat-prices'] });
      setEditingRoleId(null);
      setEditingPrice('');
    },
    onError: (error: any) => {
      toast({
        title: '❌ Error',
        description: error.message || 'No se pudo actualizar el precio',
        variant: 'destructive',
      });
    },
  });

  // Update addon price mutation
  const updateAddonPriceMutation = useMutation({
    mutationFn: async ({ id, monthlyPrice }: { id: number; monthlyPrice: string }) => {
      const response = await fetch(`/api/super-admin/addon-prices/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ monthlyPrice: parseFloat(monthlyPrice) }),
      });
      
      if (!response.ok) {
        throw new Error('Error al actualizar el precio del add-on');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: '✅ Precio de add-on actualizado',
        description: 'El precio ha sido actualizado en la base de datos y en Stripe',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/addon-prices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/company/addons'] });
      setEditingAddonId(null);
      setEditingAddonPrice('');
    },
    onError: (error: any) => {
      toast({
        title: '❌ Error',
        description: error.message || 'No se pudo actualizar el precio',
        variant: 'destructive',
      });
    },
  });

  // Toggle addon isActive mutation
  const toggleAddonActiveMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/super-admin/addon/${id}/toggle-active`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
      });
      
      if (!response.ok) {
        throw new Error('Error al cambiar estado del add-on');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.isActive ? '✅ Add-on activado' : '⚠️ Add-on desactivado',
        description: data.isActive 
          ? 'El add-on ahora es visible en la tienda' 
          : 'El add-on está oculto de la tienda',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/addon-prices'] });
    },
    onError: (error: any) => {
      toast({
        title: '❌ Error',
        description: error.message || 'No se pudo cambiar el estado',
        variant: 'destructive',
      });
    },
  });

  // Toggle addon isBeta mutation
  const toggleAddonBetaMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/super-admin/addon/${id}/toggle-beta`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
      });
      
      if (!response.ok) {
        throw new Error('Error al cambiar estado Beta del add-on');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.isBeta ? '🧪 Modo Beta activado' : '✅ Modo Beta desactivado',
        description: data.isBeta 
          ? 'Se mostrará el badge "Beta" en la tienda' 
          : 'El badge "Beta" ha sido eliminado',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/addon-prices'] });
    },
    onError: (error: any) => {
      toast({
        title: '❌ Error',
        description: error.message || 'No se pudo cambiar el estado Beta',
        variant: 'destructive',
      });
    },
  });

  const handleEditSeat = (seat: SeatPrice) => {
    setEditingRoleId(seat.id);
    setEditingPrice(seat.monthlyPrice);
  };

  const handleSaveSeat = (seat: SeatPrice) => {
    updateSeatPriceMutation.mutate({
      id: seat.id,
      monthlyPrice: editingPrice,
    });
  };

  const handleCancelSeat = () => {
    setEditingRoleId(null);
    setEditingPrice('');
  };

  const handleEditAddon = (addon: AddonPrice) => {
    setEditingAddonId(addon.id);
    setEditingAddonPrice(addon.monthlyPrice);
  };

  const handleSaveAddon = (addon: AddonPrice) => {
    updateAddonPriceMutation.mutate({
      id: addon.id,
      monthlyPrice: editingAddonPrice,
    });
  };

  const handleCancelAddon = () => {
    setEditingAddonId(null);
    setEditingAddonPrice('');
  };

  if (loadingSeatPrices || loadingAddonPrices) {
    return (
      <SuperAdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-oficaz-primary"></div>
        </div>
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white/90 mb-2">
            Gestión de Precios
          </h1>
          <p className="text-white/60 text-sm sm:text-base">
            Edita los precios de asientos y funcionalidades. Los cambios se aplican inmediatamente a todas las suscripciones activas.
          </p>
        </div>

        {/* Seat Prices Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white/90 mb-4 flex items-center gap-2">
            <Users className="h-5 w-5" />
            Precios de Asientos
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {seatPrices?.map((seat: SeatPrice) => {
              const isEditing = editingRoleId === seat.id;
              const IconComponent = 
                seat.roleType === 'admin' ? Shield :
                seat.roleType === 'manager' ? Briefcase :
                Users;
              const colorClass = 
                seat.roleType === 'admin' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                seat.roleType === 'manager' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
              const roleName = 
                seat.roleType === 'admin' ? 'Administradores' :
                seat.roleType === 'manager' ? 'Managers' :
                'Empleados';
              const roleDescription =
                seat.roleType === 'admin' ? 'Control total y facturación' :
                seat.roleType === 'manager' ? 'Gestión de equipos e informes' :
                'Fichajes, ausencias, nóminas';

              return (
                <Card 
                  key={seat.id}
                  className={`relative overflow-hidden transition-all hover:shadow-lg !bg-white/10 backdrop-blur-xl !border-white/20 flex flex-col ${
                    isEditing ? 'ring-2 ring-oficaz-primary' : ''
                  }`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                        <IconComponent className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base text-white/90">
                          {roleName}
                        </CardTitle>
                        <span className="text-xs text-white/60">
                          {roleDescription}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="flex-grow flex flex-col justify-end pt-0">
                    <div className="mt-auto">
                      {isEditing ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              step="0.01"
                              value={editingPrice}
                              onChange={(e) => setEditingPrice(e.target.value)}
                              className="flex-1 bg-white/5 border-white/20 text-white"
                              autoFocus
                            />
                            <span className="text-sm text-white/60">/mes</span>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleSaveSeat(seat)}
                              className="flex-1"
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Guardar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleCancelSeat}
                              className="bg-white/5 border-white/20 text-white hover:bg-white/10"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="mb-3">
                            <div className="flex items-baseline gap-1">
                              <span className="text-xl font-bold text-white">
                                €{parseFloat(seat.monthlyPrice || '0').toFixed(2)}
                              </span>
                              <span className="text-white/60 text-sm">/mes cada uno</span>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            className="w-full bg-white/5 border-white/20 text-white hover:bg-white/10"
                            onClick={() => handleEditSeat(seat)}
                          >
                            <Edit2 className="h-4 w-4 mr-2" />
                            Editar precio
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Addon Prices Section */}
        <div>
          <h2 className="text-xl font-semibold text-white/90 mb-4 flex items-center gap-2">
            <Store className="h-5 w-5" />
            Precios de Funcionalidades
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {addonPrices?.map((addon: AddonPrice) => {
              const isEditing = editingAddonId === addon.id;

              return (
                <Card 
                  key={addon.id}
                  className={`relative overflow-hidden transition-all hover:shadow-lg !bg-white/10 backdrop-blur-xl !border-white/20 min-h-[280px] flex flex-col ${
                    isEditing ? 'ring-2 ring-oficaz-primary' : ''
                  } ${!addon.isActive ? 'opacity-60' : ''}`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${getAddonColor(addon.key, addon.isFreeFeature)}`}>
                        {getAddonIcon(addon.key)}
                      </div>
                      <div className="flex items-center gap-2 flex-1 flex-wrap">
                        <CardTitle className="text-base text-white/90">
                          {addon.name}
                        </CardTitle>
                        {addon.isBeta && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800">
                            BETA
                          </Badge>
                        )}
                        {addon.isFreeFeature && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800">
                            GRATIS
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="flex-grow flex flex-col justify-end pt-0 space-y-3">
                    {/* Toggle Controls */}
                    <div className="space-y-2 border-b border-white/10 pb-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-white/60 flex items-center gap-1.5">
                          {addon.isActive ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                          Visible en tienda
                        </label>
                        <Switch
                          checked={addon.isActive}
                          onCheckedChange={() => toggleAddonActiveMutation.mutate(addon.id)}
                          className="scale-75"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-white/60 flex items-center gap-1.5">
                          <Beaker className="h-3.5 w-3.5" />
                          Modo Beta
                        </label>
                        <Switch
                          checked={addon.isBeta}
                          onCheckedChange={() => toggleAddonBetaMutation.mutate(addon.id)}
                          className="scale-75"
                        />
                      </div>
                    </div>

                    {/* Price Editor */}
                    <div className="mt-auto">
                      {isEditing ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              step="0.01"
                              value={editingAddonPrice}
                              onChange={(e) => setEditingAddonPrice(e.target.value)}
                              className="flex-1 bg-white/5 border-white/20 text-white"
                              autoFocus
                            />
                            <span className="text-sm text-white/60">/mes</span>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleSaveAddon(addon)}
                              className="flex-1"
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Guardar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleCancelAddon}
                              className="bg-white/5 border-white/20 text-white hover:bg-white/10"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="mb-3">
                            <div className="flex items-baseline gap-1">
                              <span className="text-xl font-bold text-white">
                                {Number(addon.monthlyPrice).toFixed(2)}€
                              </span>
                              <span className="text-white/60 text-sm">/mes</span>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            className="w-full bg-white/5 border-white/20 text-white hover:bg-white/10"
                            onClick={() => handleEditAddon(addon)}
                          >
                            <Edit2 className="h-4 w-4 mr-2" />
                            Editar precio
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
