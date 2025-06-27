import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import StatsCard from '@/components/StatsCard';
import { 
  Building2, 
  Users, 
  Settings as SettingsIcon, 
  Clock, 
  Calendar, 
  Mail, 
  Phone, 
  MapPin,
  Shield,
  FileText,
  Save,
  Edit,
  X,
  Upload,
  Trash2,
  ArrowLeft
} from 'lucide-react';
import { CreditCard, Crown, AlertCircle, CheckCircle, Lightbulb, Info } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getAuthHeaders } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { TabNavigation } from '@/components/ui/tab-navigation';
import { useFeatureCheck } from '@/hooks/use-feature-check';
import oficazLogo from '@assets/Imagotipo Oficaz_1750321812493.png';

export default function Settings() {
  const { user, company } = useAuth();
  const { toast } = useToast();
  const { hasAccess } = useFeatureCheck();

// Component for Account Management
const AccountManagement = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Force refresh of account data when component mounts
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/account/info'] });
    queryClient.refetchQueries({ queryKey: ['/api/account/info'] });
  }, [queryClient]);
  
  const { data: accountInfo } = useQuery({
    queryKey: ['/api/account/info'],
    retry: false,
  });

  const { data: subscription } = useQuery({
    queryKey: ['/api/account/subscription'],
    retry: false,
  });

  const { data: paymentMethods } = useQuery({
    queryKey: ['/api/account/payment-methods'],
    retry: false,
  });

  const { data: invoices } = useQuery({
    queryKey: ['/api/account/invoices'],
    retry: false,
  });

  const { data: usageData } = useQuery({
    queryKey: ['/api/account/usage-stats'],
    retry: false,
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatAmount = (amount: string) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(parseFloat(amount));
  };

  if (!accountInfo && !subscription) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Subscription Status - Fichajes Style */}
      <Card className="backdrop-blur-xl bg-white/10 border border-white/20 shadow-2xl">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            <span>Estado de suscripción</span>
          </CardTitle>
          <CardDescription>
            Información sobre tu plan actual y características disponibles
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 backdrop-blur-xl bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl border border-white/30 shadow-lg">
            <div className="flex items-center space-x-3">
              <Crown className="h-6 w-6 text-blue-600" />
              <div>
                <p className="font-semibold text-gray-900">Plan {subscription?.plan?.charAt(0).toUpperCase() + subscription?.plan?.slice(1)}</p>
                <p className="text-sm text-gray-600">
                  {subscription?.end_date ? `Activo hasta: ${formatDate(subscription.end_date)}` : 'Plan activo'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                {subscription?.status?.toUpperCase()}
              </Badge>
            </div>
          </div>
          
          {/* Usage Statistics with Fichajes Style */}
          {usageData?.current && (
            <div className="grid grid-cols-4 md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-6 mb-6">
              <StatsCard
                title="Usuarios"
                subtitle="Activos"
                value={usageData.current.employee_count}
                color="blue"
                icon={Users}
              />
              <StatsCard
                title="Almacenamiento"
                subtitle="MB usados"
                value={`${usageData.current.storage_used_mb} MB`}
                color="green"
                icon={FileText}
              />
              <StatsCard
                title="Fichajes"
                subtitle="Este mes"
                value={usageData.current.time_entries_count}
                color="purple"
                icon={Clock}
              />
              <StatsCard
                title="Documentos"
                subtitle="Subidos"
                value={usageData.current.documents_uploaded}
                color="orange"
                icon={Upload}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Company Registration Info - Fichajes Style */}
      <Card className="backdrop-blur-xl bg-white/10 border border-white/20 shadow-2xl">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Información de registro</span>
          </CardTitle>
          <CardDescription>
            Detalles de la cuenta y registro en Oficaz
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">ID de cuenta</Label>
              <p className="text-sm text-gray-600">{accountInfo?.account_id}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Fecha de registro</Label>
              <p className="text-sm text-gray-600">{formatDate(accountInfo?.registration_date)}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Administrador principal</Label>
              <p className="text-sm text-gray-600">{user?.fullName}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Email de facturación</Label>
              <p className="text-sm text-gray-600">{accountInfo?.billing_email}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Billing Information - Fichajes Style */}
      <Card className="backdrop-blur-xl bg-white/10 border border-white/20 shadow-2xl">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CreditCard className="h-5 w-5" />
            <span>Información de facturación</span>
          </CardTitle>
          <CardDescription>
            Direcciones fiscales y métodos de pago
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Billing Address */}
          <div>
            <Label className="text-sm font-semibold">Dirección fiscal</Label>
            <div className="mt-2 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="font-medium">Nombre:</span> {user?.fullName}
                </div>
                <div>
                  <span className="font-medium">CIF/NIF:</span> {accountInfo?.tax_id}
                </div>
                <div className="md:col-span-2">
                  <span className="font-medium">Dirección:</span> {accountInfo?.billing_address}
                </div>
                <div>
                  <span className="font-medium">Ciudad:</span> {accountInfo?.billing_city}
                </div>
                <div>
                  <span className="font-medium">Código postal:</span> {accountInfo?.billing_postal_code}
                </div>
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <Label className="text-sm font-semibold">Método de pago</Label>
            {paymentMethods && paymentMethods.length > 0 ? (
              <div className="mt-2 p-4 bg-gray-50 rounded-lg">
                {paymentMethods.map((method: any) => (
                  <div key={method.id} className="flex items-center space-x-3">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium">
                        {method.card_brand?.toUpperCase()} **** {method.card_last_four}
                      </p>
                      <p className="text-xs text-gray-500">
                        Expira: {method.card_exp_month}/{method.card_exp_year}
                      </p>
                    </div>
                    {method.is_default && (
                      <Badge variant="secondary" className="text-xs">
                        Principal
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 mt-2">No hay métodos de pago configurados</p>
            )}
          </div>

          {/* Management Actions */}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="justify-start">
              <CreditCard className="mr-2 h-4 w-4" />
              Actualizar método de pago
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Invoice History */}
      {invoices && invoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Historial de facturas</CardTitle>
            <CardDescription>
              Últimas facturas emitidas para tu cuenta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invoices?.slice(0, 5).map((invoice: any) => (
                <div key={invoice.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{invoice.invoice_number}</p>
                    <p className="text-sm text-gray-600">{invoice.description}</p>
                    <p className="text-xs text-gray-500">
                      {formatDate(invoice.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatAmount(invoice.amount)}</p>
                    <Badge 
                      variant={invoice.status === 'paid' ? 'secondary' : 'destructive'}
                      className={invoice.status === 'paid' ? 'bg-green-100 text-green-800' : ''}
                    >
                      {invoice.status === 'paid' ? 'Pagada' : 'Pendiente'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Management Actions - Fichajes Style */}
      <Card className="backdrop-blur-xl bg-white/10 border border-white/20 shadow-2xl">
        <CardHeader>
          <CardTitle>Gestión de cuenta</CardTitle>
          <CardDescription>
            Opciones avanzadas para la administración de tu cuenta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="justify-start backdrop-blur-xl bg-white/10 border border-white/30 hover:bg-white/20 transition-all duration-200">
              <Crown className="mr-2 h-4 w-4" />
              Cambiar plan de suscripción
            </Button>
            <Button variant="outline" className="justify-start backdrop-blur-xl bg-white/10 border border-white/30 hover:bg-white/20 transition-all duration-200">
              <FileText className="mr-2 h-4 w-4" />
              Descargar datos de la empresa
            </Button>
          </div>
          
          {/* Danger Zone */}
          <div className="border-t pt-4 mt-6">
            <h4 className="text-lg font-semibold text-red-600 mb-2">Zona de peligro</h4>
            <p className="text-sm text-gray-600 mb-4">
              Estas acciones son permanentes y no se pueden deshacer.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="justify-start backdrop-blur-xl bg-orange-500/10 border border-orange-500/30 text-orange-700 hover:bg-orange-500/20 transition-all duration-200">
                <AlertCircle className="mr-2 h-4 w-4" />
                Pausar cuenta temporalmente
              </Button>
              <Button variant="outline" className="justify-start backdrop-blur-xl bg-red-500/10 border border-red-500/30 text-red-700 hover:bg-red-500/20 transition-all duration-200">
                <X className="mr-2 h-4 w-4" />
                Cancelar cuenta permanentemente
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState('company');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // User profile data
  const [profileData, setProfileData] = useState({
    personalPhone: user?.personalPhone || '',
    personalEmail: user?.personalEmail || '',
    postalAddress: user?.postalAddress || '',
    emergencyContactName: user?.emergencyContactName || '',
    emergencyContactPhone: user?.emergencyContactPhone || ''
  });

  // Company configuration data
  const [companyData, setCompanyData] = useState({
    name: '',
    cif: '',
    email: '',
    contactName: '',
    companyAlias: '',
    phone: '',
    address: '',
    province: '',
    logoUrl: '',
    // Configuration settings
    defaultVacationDays: 30,
    vacationDaysPerMonth: 2.5,
    workingHoursPerDay: 8,
    employeeTimeEditPermission: 'no' as 'yes' | 'no'
  });

  // Initialize form data when company data loads
  useEffect(() => {
    if (company) {
      setCompanyData({
        name: company.name || '',
        cif: company.cif || '',
        email: company.email || '',
        contactName: company.contactName || '',
        companyAlias: company.companyAlias || '',
        phone: company.phone || '',
        address: company.address || '',
        province: company.province || '',
        logoUrl: company.logoUrl || '',
        employeeTimeEditPermission: company.employeeTimeEditPermission || 'no',
        workingHoursPerDay: Number(company.workingHoursPerDay) || 8,
        defaultVacationDays: Number(company.defaultVacationDays) || 30,
        vacationDaysPerMonth: Number(company.vacationDaysPerMonth) || 2.5,
      });
      
      // Clear any preview when company data changes
      setLogoPreview(null);
      setLogoFile(null);
    }
  }, [company]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof profileData) => {
      const response = await fetch('/api/users/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Error al actualizar el perfil');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Perfil actualizado",
        description: "Los cambios se han guardado correctamente",
      });
      setIsEditingProfile(false);
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudieron guardar los cambios",
        variant: "destructive",
      });
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async (data: typeof companyData) => {
      let logoUrl = data.logoUrl;
      
      // Si hay un nuevo archivo de logo, súbelo primero
      if (logoFile) {
        const formData = new FormData();
        formData.append('logo', logoFile);
        
        const uploadResponse = await fetch('/api/companies/upload-logo', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: formData
        });
        
        if (!uploadResponse.ok) {
          throw new Error('Error al subir el logo');
        }
        
        const uploadResult = await uploadResponse.json();
        logoUrl = uploadResult.logoUrl;
      }
      
      const response = await fetch('/api/companies/update', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ ...data, logoUrl })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Error al actualizar la empresa');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Empresa actualizada',
        description: 'La información de la empresa ha sido guardada correctamente.',
      });
      setIsEditingCompany(false);
      setLogoFile(null);
      setLogoPreview(null);
      
      // Update company data in the local state immediately to show the logo
      if (data.company) {
        setCompanyData(prev => ({
          ...prev,
          logoUrl: data.company.logoUrl || logoUrl
        }));
      }
      
      // Force immediate refresh of auth data to update company info including logo
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      queryClient.refetchQueries({ queryKey: ['/api/auth/me'] });
    },
    onError: (error: Error) => {
      const errorMessage = error.message.includes('CIF') 
        ? error.message 
        : 'No se pudo actualizar la empresa. Inténtalo de nuevo.';
      
      toast({
        title: 'Error al actualizar empresa',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  });

  const handleDeleteLogo = async () => {
    setIsUploading(true);
    try {
      const response = await fetch('/api/companies/delete-logo', {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        throw new Error('Error al eliminar el logo');
      }
      
      // Update local state immediately
      setCompanyData(prev => ({
        ...prev,
        logoUrl: ''
      }));
      
      setLogoPreview(null);
      setLogoFile(null);
      
      toast({
        title: "Logo eliminado",
        description: "El logo de la empresa ha sido eliminado correctamente",
      });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el logo",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Employee profile view for non-admin users
  if (user?.role === 'employee') {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Mi Perfil</h1>
            <p className="text-gray-600">Gestiona tu información personal</p>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-oficaz-primary rounded-full flex items-center justify-center">
                  <span className="text-white font-medium">
                    {user?.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </span>
                </div>
                <div>
                  <CardTitle>{user?.fullName}</CardTitle>
                  <CardDescription>{user?.position || 'Empleado'}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Company Information (Read-only) */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Información de la empresa</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">DNI</Label>
                    <div className="mt-1 p-3 bg-gray-50 border rounded-lg text-gray-900">
                      {user?.dni}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Email corporativo</Label>
                    <div className="mt-1 p-3 bg-gray-50 border rounded-lg text-gray-900">
                      {user?.companyEmail}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Teléfono corporativo</Label>
                    <div className="mt-1 p-3 bg-gray-50 border rounded-lg text-gray-900">
                      {user?.companyPhone || 'No asignado'}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Fecha de incorporación</Label>
                    <div className="mt-1 p-3 bg-gray-50 border rounded-lg text-gray-900">
                      {user?.startDate ? new Date(user.startDate).toLocaleDateString('es-ES') : 'No disponible'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Personal Information (Editable) */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Información personal</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditingProfile(!isEditingProfile)}
                  >
                    {isEditingProfile ? <X className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
                    {isEditingProfile ? 'Cancelar' : 'Editar'}
                  </Button>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="personalEmail">Email personal</Label>
                    {isEditingProfile ? (
                      <Input
                        id="personalEmail"
                        value={profileData.personalEmail}
                        onChange={(e) => setProfileData(prev => ({ ...prev, personalEmail: e.target.value }))}
                        placeholder="tu@email.com"
                      />
                    ) : (
                      <div className="mt-1 p-3 bg-gray-50 border rounded-lg text-gray-900">
                        {profileData.personalEmail || 'No especificado'}
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="personalPhone">Teléfono personal</Label>
                    {isEditingProfile ? (
                      <Input
                        id="personalPhone"
                        value={profileData.personalPhone}
                        onChange={(e) => setProfileData(prev => ({ ...prev, personalPhone: e.target.value }))}
                        placeholder="+34 600 000 000"
                      />
                    ) : (
                      <div className="mt-1 p-3 bg-gray-50 border rounded-lg text-gray-900">
                        {profileData.personalPhone || 'No especificado'}
                      </div>
                    )}
                  </div>
                  
                  <div className="md:col-span-2">
                    <Label htmlFor="postalAddress">Dirección</Label>
                    {isEditingProfile ? (
                      <Textarea
                        id="postalAddress"
                        value={profileData.postalAddress}
                        onChange={(e) => setProfileData(prev => ({ ...prev, postalAddress: e.target.value }))}
                        placeholder="Calle, número, piso, código postal, ciudad"
                        rows={3}
                      />
                    ) : (
                      <div className="mt-1 p-3 bg-gray-50 border rounded-lg text-gray-900 min-h-[80px]">
                        {profileData.postalAddress || 'No especificada'}
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="emergencyContactName">Contacto de emergencia</Label>
                    {isEditingProfile ? (
                      <Input
                        id="emergencyContactName"
                        value={profileData.emergencyContactName}
                        onChange={(e) => setProfileData(prev => ({ ...prev, emergencyContactName: e.target.value }))}
                        placeholder="Nombre completo"
                      />
                    ) : (
                      <div className="mt-1 p-3 bg-gray-50 border rounded-lg text-gray-900">
                        {profileData.emergencyContactName || 'No especificado'}
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="emergencyContactPhone">Teléfono de emergencia</Label>
                    {isEditingProfile ? (
                      <Input
                        id="emergencyContactPhone"
                        value={profileData.emergencyContactPhone}
                        onChange={(e) => setProfileData(prev => ({ ...prev, emergencyContactPhone: e.target.value }))}
                        placeholder="+34 600 000 000"
                      />
                    ) : (
                      <div className="mt-1 p-3 bg-gray-50 border rounded-lg text-gray-900">
                        {profileData.emergencyContactPhone || 'No especificado'}
                      </div>
                    )}
                  </div>
                </div>

                {isEditingProfile && (
                  <div className="flex justify-end space-x-2 mt-6">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsEditingProfile(false);
                        setProfileData({
                          personalPhone: user?.personalPhone || '',
                          personalEmail: user?.personalEmail || '',
                          postalAddress: user?.postalAddress || '',
                          emergencyContactName: user?.emergencyContactName || '',
                          emergencyContactPhone: user?.emergencyContactPhone || ''
                        });
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={() => updateProfileMutation.mutate(profileData)}
                      disabled={updateProfileMutation.isPending}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {updateProfileMutation.isPending ? 'Guardando...' : 'Guardar'}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Admin/Manager configuration view
  return (
    <div className="px-6 py-4 min-h-screen bg-gray-50" style={{ overflowX: 'clip' }}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Configuración</h1>
        <p className="text-gray-500 mt-1">Gestiona la configuración de tu empresa y perfil</p>
      </div>

      <TabNavigation
          tabs={[
            { id: 'company', label: 'Empresa', icon: Building2 },
            { id: 'policies', label: 'Políticas', icon: SettingsIcon },
            { id: 'profile', label: 'Mi Perfil', icon: Users },
            { id: 'account', label: 'Mi Cuenta', icon: CreditCard }
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
      />

      <div className="mt-6">
        {/* Company Information Tab */}
        {activeTab === 'company' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <Building2 className="h-5 w-5" />
                      <span>Información de la empresa</span>
                    </CardTitle>
                    <CardDescription>
                      Datos fiscales y de contacto de tu empresa
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditingCompany(!isEditingCompany)}
                  >
                    {isEditingCompany ? <X className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
                    {isEditingCompany ? 'Cancelar' : 'Editar'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Logo Section */}
                <div>
                  <Label>Logo de la empresa</Label>
                  <div className="mt-2 flex items-center space-x-4">
                    {logoPreview || companyData.logoUrl ? (
                      <div className="w-32 h-16 border rounded-lg bg-white flex items-center justify-center p-2">
                        <img 
                          src={logoPreview || companyData.logoUrl} 
                          alt="Logo de la empresa" 
                          className="max-w-full max-h-full object-contain"
                          onLoad={() => console.log('Logo loaded successfully:', logoPreview || companyData.logoUrl)}
                          onError={(e) => {
                            console.error('Error loading logo:', logoPreview || companyData.logoUrl);
                            console.error('Image element:', e.currentTarget);
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-32 h-16 bg-gray-100 border-2 border-dashed rounded-lg flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                    {/* Logo upload/change only for Pro+ plans */}
                    {isEditingCompany && hasAccess('logoUpload') && (
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center space-x-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => document.getElementById('logo-upload')?.click()}
                            className="flex items-center space-x-2"
                          >
                            <Upload className="w-4 h-4" />
                            <span>Subir logo</span>
                          </Button>
                          {(companyData.logoUrl || logoPreview) && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setCompanyData(prev => ({ ...prev, logoUrl: '' }));
                                setLogoFile(null);
                                setLogoPreview(null);
                              }}
                              className="flex items-center space-x-2 text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>Eliminar</span>
                            </Button>
                          )}
                        </div>
                        <input
                          id="logo-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              // Validate file size
                              if (file.size > 2 * 1024 * 1024) {
                                toast({
                                  title: 'Archivo demasiado grande',
                                  description: 'El logo debe ser menor a 2MB',
                                  variant: 'destructive'
                                });
                                return;
                              }
                              
                              // Validate file type
                              const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/svg+xml'];
                              if (!allowedTypes.includes(file.type)) {
                                toast({
                                  title: 'Formato no soportado',
                                  description: 'Solo se permiten archivos JPG, PNG, GIF, SVG',
                                  variant: 'destructive'
                                });
                                return;
                              }
                              
                              setLogoFile(file);
                              const reader = new FileReader();
                              reader.onload = (e) => {
                                setLogoPreview(e.target?.result as string);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                        <div className="space-y-3">
                          <p className="text-xs text-gray-500">
                            Formatos: JPG, PNG, SVG (máx. 2MB)
                          </p>
                          
                          {/* Logo recommendations */}
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <div className="flex items-start space-x-2 mb-2">
                              <Lightbulb className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                              <div className="text-sm">
                                <p className="font-medium text-blue-900 mb-2">Para que tu logo se vea perfecto en la app, recomendamos usar:</p>
                                <div className="space-y-2">
                                  <div>
                                    <span className="font-medium text-blue-800">• Logotipo:</span>
                                    <span className="text-blue-700"> Solo letras, sin imágenes.</span>
                                  </div>
                                  <div>
                                    <span className="font-medium text-blue-800">• Imagotipo:</span>
                                    <span className="text-blue-700"> Letras junto con un icono, todo en una misma línea.</span>
                                  </div>
                                </div>
                                <div className="mt-3 p-2 bg-white rounded border flex items-center space-x-2">
                                  <img 
                                    src={oficazLogo} 
                                    alt="Ejemplo de imagotipo" 
                                    className="h-5 w-auto object-contain"
                                  />
                                  <span className="text-xs text-gray-600">Ejemplo: imagotipo de Oficaz</span>
                                </div>
                                <div className="mt-3 p-2 bg-blue-100 rounded border">
                                  <p className="text-xs font-medium text-blue-800 mb-1">📏 Tamaño recomendado:</p>
                                  <p className="text-xs text-blue-700">
                                    • <strong>Ancho:</strong> 200-400 píxeles<br/>
                                    • <strong>Alto:</strong> 60-120 píxeles<br/>
                                    • <strong>Formato:</strong> PNG o SVG para mejor calidad
                                  </p>
                                </div>
                                <p className="text-xs text-blue-600 mt-2">
                                  Esto asegura que tu logo se vea nítido, se cargue rápido y se ajuste perfectamente en toda la aplicación.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Delete existing logo (available for all plans) */}
                    {isEditingCompany && (logoPreview || companyData.logoUrl) && (
                      <div className="flex-1 space-y-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleDeleteLogo}
                          disabled={isUploading}
                          className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Eliminar logo
                        </Button>
                      </div>
                    )}
                    {/* Restriction message for Basic plan users without logo */}
                    {!hasAccess('logoUpload') && isEditingCompany && !companyData.logoUrl && (
                      <div className="flex-1">
                        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <AlertCircle className="h-4 w-4 text-amber-600" />
                          <p className="text-sm text-amber-700">
                            La subida de logos requiere el plan Pro o superior.
                          </p>
                        </div>
                      </div>
                    )}
                    {/* Info for Basic plan users with existing logo */}
                    {!hasAccess('logoUpload') && isEditingCompany && companyData.logoUrl && (
                      <div className="flex-1">
                        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <Info className="h-4 w-4 text-blue-600" />
                          <p className="text-sm text-blue-700">
                            Tu logo actual se mantiene. Para cambiar o subir un nuevo logo, actualiza al plan Pro.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="companyName">Nombre de la empresa</Label>
                    {isEditingCompany ? (
                      <Input
                        id="companyName"
                        value={companyData.name}
                        onChange={(e) => setCompanyData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Mi Empresa S.L."
                      />
                    ) : (
                      <div className="mt-1 p-3 bg-gray-50 border rounded-lg text-gray-900 font-medium">
                        {companyData.name || 'No especificado'}
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="companyAlias">Alias de la empresa</Label>
                    <div className="mt-1 p-3 bg-gray-50 border rounded-lg text-gray-900">
                      {companyData.companyAlias || 'No especificado'}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Usado en las URLs de la aplicación (no se puede modificar)
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="companyCif">CIF</Label>
                    {isEditingCompany ? (
                      <Input
                        id="companyCif"
                        value={companyData.cif}
                        onChange={(e) => setCompanyData(prev => ({ ...prev, cif: e.target.value }))}
                        placeholder="B12345678"
                      />
                    ) : (
                      <div className="mt-1 p-3 bg-gray-50 border rounded-lg text-gray-900">
                        {companyData.cif || 'No especificado'}
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="contactName">Persona de contacto</Label>
                    {isEditingCompany ? (
                      <Input
                        id="contactName"
                        value={companyData.contactName}
                        onChange={(e) => setCompanyData(prev => ({ ...prev, contactName: e.target.value }))}
                        placeholder="Juan Pérez"
                      />
                    ) : (
                      <div className="mt-1 p-3 bg-gray-50 border rounded-lg text-gray-900">
                        {companyData.contactName || 'No especificado'}
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="companyEmail">Email corporativo</Label>
                    {isEditingCompany ? (
                      <Input
                        id="companyEmail"
                        type="email"
                        value={companyData.email}
                        onChange={(e) => setCompanyData(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="info@miempresa.com"
                      />
                    ) : (
                      <div className="mt-1 p-3 bg-gray-50 border rounded-lg text-gray-900">
                        {companyData.email || 'No especificado'}
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="companyPhone">Teléfono corporativo</Label>
                    {isEditingCompany ? (
                      <Input
                        id="companyPhone"
                        value={companyData.phone}
                        onChange={(e) => setCompanyData(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="+34 900 000 000"
                      />
                    ) : (
                      <div className="mt-1 p-3 bg-gray-50 border rounded-lg text-gray-900">
                        {companyData.phone || 'No especificado'}
                      </div>
                    )}
                  </div>
                  
                  <div className="md:col-span-2">
                    <Label htmlFor="companyAddress">Dirección fiscal</Label>
                    {isEditingCompany ? (
                      <Textarea
                        id="companyAddress"
                        value={companyData.address}
                        onChange={(e) => setCompanyData(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="Calle, número, código postal, ciudad"
                        rows={3}
                      />
                    ) : (
                      <div className="mt-1 p-3 bg-gray-50 border rounded-lg text-gray-900 min-h-[80px]">
                        {companyData.address || 'No especificada'}
                      </div>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="companyProvince">Provincia</Label>
                    {isEditingCompany ? (
                      <Select 
                        value={companyData.province}
                        onValueChange={(value) => setCompanyData(prev => ({ ...prev, province: value }))}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Seleccionar provincia" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60 overflow-y-auto">
                          <SelectItem value="alava">Álava</SelectItem>
                          <SelectItem value="albacete">Albacete</SelectItem>
                          <SelectItem value="alicante">Alicante</SelectItem>
                          <SelectItem value="almeria">Almería</SelectItem>
                          <SelectItem value="asturias">Asturias</SelectItem>
                          <SelectItem value="avila">Ávila</SelectItem>
                          <SelectItem value="badajoz">Badajoz</SelectItem>
                          <SelectItem value="barcelona">Barcelona</SelectItem>
                          <SelectItem value="burgos">Burgos</SelectItem>
                          <SelectItem value="caceres">Cáceres</SelectItem>
                          <SelectItem value="cadiz">Cádiz</SelectItem>
                          <SelectItem value="cantabria">Cantabria</SelectItem>
                          <SelectItem value="castellon">Castellón</SelectItem>
                          <SelectItem value="ceuta">Ceuta</SelectItem>
                          <SelectItem value="ciudad_real">Ciudad Real</SelectItem>
                          <SelectItem value="cordoba">Córdoba</SelectItem>
                          <SelectItem value="cuenca">Cuenca</SelectItem>
                          <SelectItem value="girona">Girona</SelectItem>
                          <SelectItem value="granada">Granada</SelectItem>
                          <SelectItem value="guadalajara">Guadalajara</SelectItem>
                          <SelectItem value="guipuzcoa">Guipúzcoa</SelectItem>
                          <SelectItem value="huelva">Huelva</SelectItem>
                          <SelectItem value="huesca">Huesca</SelectItem>
                          <SelectItem value="islas_baleares">Islas Baleares</SelectItem>
                          <SelectItem value="jaen">Jaén</SelectItem>
                          <SelectItem value="la_coruna">La Coruña</SelectItem>
                          <SelectItem value="la_rioja">La Rioja</SelectItem>
                          <SelectItem value="las_palmas">Las Palmas</SelectItem>
                          <SelectItem value="leon">León</SelectItem>
                          <SelectItem value="lleida">Lleida</SelectItem>
                          <SelectItem value="lugo">Lugo</SelectItem>
                          <SelectItem value="madrid">Madrid</SelectItem>
                          <SelectItem value="malaga">Málaga</SelectItem>
                          <SelectItem value="melilla">Melilla</SelectItem>
                          <SelectItem value="murcia">Murcia</SelectItem>
                          <SelectItem value="navarra">Navarra</SelectItem>
                          <SelectItem value="ourense">Ourense</SelectItem>
                          <SelectItem value="palencia">Palencia</SelectItem>
                          <SelectItem value="pontevedra">Pontevedra</SelectItem>
                          <SelectItem value="salamanca">Salamanca</SelectItem>
                          <SelectItem value="santa_cruz_tenerife">Santa Cruz de Tenerife</SelectItem>
                          <SelectItem value="segovia">Segovia</SelectItem>
                          <SelectItem value="sevilla">Sevilla</SelectItem>
                          <SelectItem value="soria">Soria</SelectItem>
                          <SelectItem value="tarragona">Tarragona</SelectItem>
                          <SelectItem value="teruel">Teruel</SelectItem>
                          <SelectItem value="toledo">Toledo</SelectItem>
                          <SelectItem value="valencia">Valencia</SelectItem>
                          <SelectItem value="valladolid">Valladolid</SelectItem>
                          <SelectItem value="vizcaya">Vizcaya</SelectItem>
                          <SelectItem value="zamora">Zamora</SelectItem>
                          <SelectItem value="zaragoza">Zaragoza</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="mt-1 p-3 bg-gray-50 border rounded-lg text-gray-900">
                        {companyData.province ? companyData.province.charAt(0).toUpperCase() + companyData.province.slice(1).replace('_', ' ') : 'No especificada'}
                      </div>
                    )}
                  </div>
                </div>

                {isEditingCompany && (
                  <div className="flex justify-end space-x-2 pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => setIsEditingCompany(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={() => updateCompanyMutation.mutate(companyData)}
                      disabled={updateCompanyMutation.isPending}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {updateCompanyMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Company Policies Tab */}
          {activeTab === 'policies' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Clock className="h-5 w-5" />
                    <span>Gestión de horarios</span>
                  </CardTitle>
                  <CardDescription>
                    Configura cómo los empleados pueden gestionar sus horarios
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="timeEditPermission">Los empleados pueden editar sus horas</Label>
                    {hasAccess('timeEditingPermissions') ? (
                      <Select 
                        value={companyData.employeeTimeEditPermission} 
                        onValueChange={(value: 'yes' | 'no') => 
                          setCompanyData(prev => ({ ...prev, employeeTimeEditPermission: value }))
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">Sí</SelectItem>
                          <SelectItem value="no">No</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="mt-1">
                        <div className="p-3 bg-gray-100 border rounded-lg text-gray-500 cursor-not-allowed">
                          No - No disponible en tu plan
                        </div>
                        <div className="flex items-center gap-2 mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                          <AlertCircle className="h-4 w-4 text-amber-600" />
                          <p className="text-sm text-amber-700">
                            Esta funcionalidad requiere el plan Pro o superior. Los empleados no pueden editar sus horarios.
                          </p>
                        </div>
                      </div>
                    )}
                    {hasAccess('timeEditingPermissions') ? (
                      <p className="text-sm text-gray-500 mt-1">
                        {companyData.employeeTimeEditPermission === 'yes' && 'Los empleados pueden editar sus horarios registrados'}
                        {companyData.employeeTimeEditPermission === 'no' && 'Solo administradores y managers pueden modificar horarios'}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500 mt-1">
                        Solo administradores y managers pueden modificar horarios
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="workingHours">Horas de trabajo por día</Label>
                    <Input
                      id="workingHours"
                      type="number"
                      min="1"
                      max="12"
                      value={companyData.workingHoursPerDay}
                      onChange={(e) => setCompanyData(prev => ({ ...prev, workingHoursPerDay: parseInt(e.target.value) }))}
                      className="mt-1"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Usado para calcular las horas esperadas y generar alertas
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Calendar className="h-5 w-5" />
                    <span>Política de vacaciones</span>
                  </CardTitle>
                  <CardDescription>
                    Configuración del sistema de vacaciones según normativa española
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <Shield className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-blue-900">Normativa española</span>
                    </div>
                    <p className="text-sm text-blue-800">
                      El sistema calcula automáticamente 30 días naturales por año trabajado (2.5 días por mes) 
                      desde la fecha de incorporación del empleado.
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="defaultVacationDays">Días de vacaciones anuales</Label>
                    <Input
                      id="defaultVacationDays"
                      type="number"
                      min="22"
                      max="35"
                      value={companyData.defaultVacationDays}
                      onChange={(e) => setCompanyData(prev => ({ ...prev, defaultVacationDays: parseInt(e.target.value) }))}
                      className="mt-1"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Mínimo legal: 22 días laborables (30 días naturales)
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="vacationDaysPerMonth">Días por mes trabajado</Label>
                    <Input
                      id="vacationDaysPerMonth"
                      type="number"
                      step="0.1"
                      min="1.8"
                      max="3"
                      value={companyData.vacationDaysPerMonth}
                      onChange={(e) => setCompanyData(prev => ({ ...prev, vacationDaysPerMonth: parseFloat(e.target.value) }))}
                      className="mt-1"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Valor estándar: 2.5 días (30 días ÷ 12 meses)
                    </p>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button
                  onClick={() => updateCompanyMutation.mutate(companyData)}
                  disabled={updateCompanyMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateCompanyMutation.isPending ? 'Guardando...' : 'Guardar configuración'}
                </Button>
              </div>
            </div>
          )}

          {/* Personal Profile Tab */}
          {activeTab === 'profile' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>Mi perfil personal</span>
                </CardTitle>
                <CardDescription>
                  Tu información personal como administrador
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* User info header */}
                <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                  <div className="w-12 h-12 bg-oficaz-primary rounded-full flex items-center justify-center">
                    <span className="text-white font-medium">
                      {user?.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{user?.fullName}</h3>
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary">
                        {user?.role === 'admin' ? 'Administrador' : 'Manager'}
                      </Badge>
                      <span className="text-sm text-gray-500">DNI: {user?.dni}</span>
                    </div>
                  </div>
                </div>

                {/* Editable personal info - same structure as employee view */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="adminPersonalEmail">Email personal</Label>
                    {isEditingProfile ? (
                      <Input
                        id="adminPersonalEmail"
                        value={profileData.personalEmail}
                        onChange={(e) => setProfileData(prev => ({ ...prev, personalEmail: e.target.value }))}
                        placeholder="tu@email.com"
                      />
                    ) : (
                      <div className="mt-1 p-3 bg-gray-50 border rounded-lg text-gray-900">
                        {profileData.personalEmail || 'No especificado'}
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="adminPersonalPhone">Teléfono personal</Label>
                    {isEditingProfile ? (
                      <Input
                        id="adminPersonalPhone"
                        value={profileData.personalPhone}
                        onChange={(e) => setProfileData(prev => ({ ...prev, personalPhone: e.target.value }))}
                        placeholder="+34 600 000 000"
                      />
                    ) : (
                      <div className="mt-1 p-3 bg-gray-50 border rounded-lg text-gray-900">
                        {profileData.personalPhone || 'No especificado'}
                      </div>
                    )}
                  </div>
                  
                  <div className="md:col-span-2">
                    <Label htmlFor="adminPostalAddress">Dirección personal</Label>
                    {isEditingProfile ? (
                      <Textarea
                        id="adminPostalAddress"
                        value={profileData.postalAddress}
                        onChange={(e) => setProfileData(prev => ({ ...prev, postalAddress: e.target.value }))}
                        placeholder="Calle, número, piso, código postal, ciudad"
                        rows={3}
                      />
                    ) : (
                      <div className="mt-1 p-3 bg-gray-50 border rounded-lg text-gray-900 min-h-[80px]">
                        {profileData.postalAddress || 'No especificada'}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-4 border-t">
                  {isEditingProfile ? (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => setIsEditingProfile(false)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        onClick={() => updateProfileMutation.mutate(profileData)}
                        disabled={updateProfileMutation.isPending}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {updateProfileMutation.isPending ? 'Guardando...' : 'Guardar'}
                      </Button>
                    </>
                  ) : (
                    <Button onClick={() => setIsEditingProfile(true)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Editar perfil
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Account Management Tab */}
        {activeTab === 'account' && (
          <AccountManagement />
        )}
      </div>
    </div>
  );
}