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
  X
} from 'lucide-react';
import { CreditCard, Crown, AlertCircle, CheckCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getAuthHeaders } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { TabNavigation } from '@/components/ui/tab-navigation';

export default function Settings() {
  const { user, company } = useAuth();
  const { toast } = useToast();

// Component for Account Management
const AccountManagement = () => {
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
      {/* Subscription Status */}
      <Card>
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
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border">
            <div className="flex items-center space-x-3">
              <Crown className="h-6 w-6 text-blue-600" />
              <div>
                <p className="font-semibold text-gray-900">Plan {subscription?.plan?.charAt(0).toUpperCase() + subscription?.plan?.slice(1) || 'Premium'}</p>
                <p className="text-sm text-gray-600">
                  {subscription?.endDate ? `Activo hasta: ${formatDate(subscription.endDate)}` : 'Plan activo'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                {subscription?.status?.toUpperCase() || 'ACTIVO'}
              </Badge>
            </div>
          </div>
          
          {/* Usage Statistics */}
          {usageData?.current && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">{usageData.current.employeeCount}</p>
                <p className="text-sm text-gray-600">Empleados</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{usageData.current.storageUsedMB} MB</p>
                <p className="text-sm text-gray-600">Almacenamiento</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-purple-600">{usageData.current.timeEntriesCount}</p>
                <p className="text-sm text-gray-600">Fichajes este mes</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-orange-600">{usageData.current.documentsUploaded}</p>
                <p className="text-sm text-gray-600">Documentos subidos</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Company Registration Info */}
      <Card>
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
              <p className="text-sm text-gray-600">{accountInfo?.account_id || 'OFZ-2024-001234'}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Fecha de registro</Label>
              <p className="text-sm text-gray-600">{accountInfo?.registration_date ? formatDate(accountInfo.registration_date) : '15 de enero de 2024'}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Administrador principal</Label>
              <p className="text-sm text-gray-600">{accountInfo?.billing_name || 'Admin Test'}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Email de facturación</Label>
              <p className="text-sm text-gray-600">{accountInfo?.billing_email || 'admin@testcompany.com'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Billing Information */}
      <Card>
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
                  <span className="font-medium">Nombre:</span> {accountInfo?.billing_name || 'Test Company S.L.'}
                </div>
                <div>
                  <span className="font-medium">CIF/NIF:</span> {accountInfo?.tax_id || 'B12345678'}
                </div>
                <div className="md:col-span-2">
                  <span className="font-medium">Dirección:</span> {accountInfo?.billing_address || 'Calle Mayor 123, 3º B'}
                </div>
                <div>
                  <span className="font-medium">Ciudad:</span> {accountInfo?.billing_city || 'Madrid'}
                </div>
                <div>
                  <span className="font-medium">Código postal:</span> {accountInfo?.billing_postal_code || '28001'}
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
                        {method.card_brand?.toUpperCase() || 'VISA'} **** {method.card_last_four || '4242'}
                      </p>
                      <p className="text-xs text-gray-500">
                        Expira: {method.card_exp_month || '12'}/{method.card_exp_year || '2026'}
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
            <Button variant="outline" className="justify-start">
              <Calendar className="mr-2 h-4 w-4" />
              Ver historial de facturación
            </Button>
            <Button variant="outline" className="justify-start">
              <FileText className="mr-2 h-4 w-4" />
              Exportar datos de la cuenta
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
                    <p className="font-medium">{invoice.invoice_number || 'OFZ-2024-001'}</p>
                    <p className="text-sm text-gray-600">{invoice.description || 'Plan Premium'}</p>
                    <p className="text-xs text-gray-500">
                      {invoice.created_at ? formatDate(invoice.created_at) : '1 de diciembre de 2024'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatAmount(invoice.amount || '49.99')}</p>
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

      {/* Management Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Gestión de cuenta</CardTitle>
          <CardDescription>
            Opciones avanzadas para la administración de tu cuenta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="justify-start">
              <Crown className="mr-2 h-4 w-4" />
              Cambiar plan de suscripción
            </Button>
            <Button variant="outline" className="justify-start">
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
              <Button variant="outline" className="justify-start border-orange-200 text-orange-700 hover:bg-orange-50">
                <AlertCircle className="mr-2 h-4 w-4" />
                Pausar cuenta temporalmente
              </Button>
              <Button variant="outline" className="justify-start border-red-200 text-red-700 hover:bg-red-50">
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
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  
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
    phone: '',
    address: '',
    province: '',
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
        phone: company.phone || '',
        address: company.address || '',
        province: company.province || '',
        employeeTimeEditPermission: company.employeeTimeEditPermission || 'no',
        workingHoursPerDay: Number(company.workingHoursPerDay) || 8,
        defaultVacationDays: Number(company.defaultVacationDays) || 30,
        vacationDaysPerMonth: Number(company.vacationDaysPerMonth) || 2.5,
      });
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
      const response = await fetch('/api/companies/update', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error('Error al actualizar la empresa');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Empresa actualizada',
        description: 'La información de la empresa ha sido guardada correctamente.',
      });
      setIsEditingCompany(false);
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      
      // Force refresh of company data to sync UI
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ['/api/auth/me'] });
      }, 100);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la empresa. Inténtalo de nuevo.',
        variant: 'destructive',
      });
    }
  });

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
    <div className="px-6 py-4 min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto">
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
                    <p className="text-sm text-gray-500 mt-1">
                      {companyData.employeeTimeEditPermission === 'yes' && 'Los empleados pueden editar sus horarios registrados'}
                      {companyData.employeeTimeEditPermission === 'no' && 'Solo administradores y managers pueden modificar horarios'}
                    </p>
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
    </div>
  );
}