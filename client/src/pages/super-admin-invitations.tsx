import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Mail, Calendar, Trash2, Copy, Check, X, Settings, UserPlus } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { SuperAdminLayout } from '@/components/layout/super-admin-layout';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface Invitation {
  id: number;
  email: string;
  token: string;
  inviterName: string;
  companyName: string;
  used: boolean;
  expiresAt: string;
  createdAt: string;
}

interface RegistrationSettings {
  id: number;
  publicRegistrationEnabled: boolean;
  updatedAt: string;
}

export default function SuperAdminInvitations() {
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [inviterName, setInviterName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch registration settings
  const { data: settings } = useQuery<RegistrationSettings>({
    queryKey: ['/api/super-admin/registration-settings'],
    queryFn: async () => {
      const token = sessionStorage.getItem('superAdminToken');
      const response = await fetch('/api/super-admin/registration-settings', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch registration settings');
      return response.json();
    },
  });

  // Fetch invitations
  const { data: invitations = [], isLoading: isLoadingInvitations } = useQuery<Invitation[]>({
    queryKey: ['/api/super-admin/invitations'],
    queryFn: async () => {
      const token = sessionStorage.getItem('superAdminToken');
      const response = await fetch('/api/super-admin/invitations', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch invitations');
      return response.json();
    },
  });

  // Toggle registration settings
  const toggleRegistrationMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const token = sessionStorage.getItem('superAdminToken');
      const response = await fetch('/api/super-admin/registration-settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          publicRegistrationEnabled: enabled
        }),
      });
      if (!response.ok) throw new Error('Failed to update registration settings');
      return response.json();
    },
    onSuccess: (_, enabled) => {
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/registration-settings'] });
      toast({
        title: enabled ? 'Registro público habilitado' : 'Registro público deshabilitado',
        description: enabled 
          ? 'Ahora cualquier usuario puede registrarse libremente'
          : 'Solo usuarios con invitación válida pueden registrarse',
      });
    },
  });

  // Create invitation
  const createInvitationMutation = useMutation({
    mutationFn: async (invitationData: { email: string; inviterName: string; companyName: string }) => {
      return apiRequest('POST', '/api/super-admin/invitations', invitationData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/invitations'] });
      setIsInviteDialogOpen(false);
      setEmail('');
      setInviterName('');
      setCompanyName('');
      toast({
        title: 'Invitación creada',
        description: 'La invitación ha sido generada correctamente',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo crear la invitación',
        variant: 'destructive',
      });
    },
  });

  // Delete invitation
  const deleteInvitationMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/super-admin/invitations/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/invitations'] });
      toast({
        title: 'Invitación eliminada',
        description: 'La invitación ha sido eliminada correctamente',
      });
    },
  });

  const copyInvitationUrl = async (token: string) => {
    const invitationUrl = `${window.location.origin}/registro/invitacion/${token}`;
    try {
      await navigator.clipboard.writeText(invitationUrl);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
      toast({
        title: 'Enlace copiado',
        description: 'El enlace de invitación ha sido copiado al portapapeles',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo copiar el enlace',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (invitation: Invitation) => {
    if (invitation.used) {
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Utilizada</Badge>;
    }
    
    const now = new Date();
    const expiresAt = new Date(invitation.expiresAt);
    
    if (now > expiresAt) {
      return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Expirada</Badge>;
    }
    
    return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Activa</Badge>;
  };

  const activeInvitations = invitations?.filter(inv => !inv.used && new Date() <= new Date(inv.expiresAt)) || [];
  const usedInvitations = invitations?.filter(inv => inv.used) || [];
  const expiredInvitations = invitations?.filter(inv => !inv.used && new Date() > new Date(inv.expiresAt)) || [];

  return (
    <SuperAdminLayout>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Registration Settings Card */}
        <Card className="mb-8 bg-white/5 backdrop-blur-xl border border-white/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                  <Settings className="w-5 h-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-white">Configuración de Registro</CardTitle>
                  <CardDescription className="text-white/70">
                    Controla si el registro público está habilitado o restringido a invitaciones
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="public-registration" className="text-white text-sm font-medium">
                  {settings?.publicRegistrationEnabled ? 'Permitir Registro Público' : 'Bloquear Registro Público'}
                </Label>
                <Switch
                  id="public-registration"
                  checked={settings?.publicRegistrationEnabled ?? true}
                  onCheckedChange={(checked) => toggleRegistrationMutation.mutate(checked)}
                  disabled={toggleRegistrationMutation.isPending}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <div className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-2 ${settings?.publicRegistrationEnabled ? 'bg-green-400' : 'bg-orange-400'}`} />
                <div>
                  <p className="text-white text-sm font-medium mb-1">
                    {settings?.publicRegistrationEnabled ? 'Acceso Abierto' : 'Acceso Restringido'}
                  </p>
                  <p className="text-white/70 text-xs">
                    {settings?.publicRegistrationEnabled 
                      ? 'Los botones de registro están visibles en la landing page. Cualquier usuario puede registrar su empresa'
                      : 'Los botones de registro están ocultos en la landing page. Solo se puede registrar con enlaces de invitación'
                    }
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
          <Card className="bg-white/5 backdrop-blur-xl border border-white/10">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/70 text-xs md:text-sm">Invitaciones Activas</p>
                  <p className="text-xl md:text-2xl font-bold text-white">{activeInvitations.length}</p>
                </div>
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Mail className="w-5 h-5 md:w-6 md:h-6 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-xl border border-white/10">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/70 text-xs md:text-sm">Utilizadas</p>
                  <p className="text-xl md:text-2xl font-bold text-white">{usedInvitations.length}</p>
                </div>
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <Check className="w-5 h-5 md:w-6 md:h-6 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-xl border border-white/10">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/70 text-xs md:text-sm">Expiradas</p>
                  <p className="text-xl md:text-2xl font-bold text-white">{expiredInvitations.length}</p>
                </div>
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <X className="w-5 h-5 md:w-6 md:h-6 text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-xl border border-white/10">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/70 text-xs md:text-sm">Total</p>
                  <p className="text-xl md:text-2xl font-bold text-white">{invitations?.length || 0}</p>
                </div>
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 md:w-6 md:h-6 text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Invitations List */}
        <Card className="bg-white/5 backdrop-blur-xl border border-white/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white">Enlaces de Invitación</CardTitle>
                <CardDescription className="text-white/70">
                  Gestiona los enlaces de invitación para el registro de nuevas empresas
                </CardDescription>
              </div>
              <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white border-0">
                    <Plus className="w-4 h-4 mr-2" />
                    Nueva Invitación
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 border-white/20 text-white">
                  <DialogHeader>
                    <DialogTitle className="!text-white">Crear Invitación</DialogTitle>
                    <DialogDescription className="!text-white/70">
                      Genera un enlace de invitación que será válido por 7 días
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="email" className="text-white">Email del destinatario</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="empresa@ejemplo.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="inviter-name" className="text-white">Nombre del invitador</Label>
                      <Input
                        id="inviter-name"
                        placeholder="Tu nombre"
                        value={inviterName}
                        onChange={(e) => setInviterName(e.target.value)}
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="company-name" className="text-white">Nombre de la empresa (opcional)</Label>
                      <Input
                        id="company-name"
                        placeholder="Oficaz"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsInviteDialogOpen(false)}
                      className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={() => createInvitationMutation.mutate({ email, inviterName, companyName })}
                      disabled={!email || createInvitationMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {createInvitationMutation.isPending ? 'Creando...' : 'Crear Invitación'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingInvitations ? (
              <div className="text-center py-8">
                <LoadingSpinner size="md" />
                <p className="text-white/70 mt-4">Cargando invitaciones...</p>
              </div>
            ) : invitations.length === 0 ? (
              <div className="text-center py-8">
                <Mail className="w-12 h-12 text-white/40 mx-auto mb-4" />
                <p className="text-white/70">No hay invitaciones creadas</p>
                <p className="text-white/50 text-sm">Crea la primera invitación para empezar</p>
              </div>
            ) : (
              <div className="space-y-3 md:space-y-4">
                {invitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="bg-white/5 rounded-lg p-3 md:p-4 border border-white/10 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2 md:gap-3">
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-xs md:text-sm flex-shrink-0">
                          {invitation.email[0].toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-white font-medium text-sm md:text-base truncate">{invitation.email}</p>
                          <p className="text-white/70 text-xs md:text-sm">
                            Invitado por {invitation.inviterName} • {formatDate(invitation.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap md:flex-nowrap">
                        {getStatusBadge(invitation)}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyInvitationUrl(invitation.token)}
                          className="border-blue-400/30 bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 hover:border-blue-400/50 text-xs md:text-sm"
                          title={copiedToken === invitation.token ? "¡Enlace copiado!" : "Copiar enlace de invitación"}
                        >
                          {copiedToken === invitation.token ? (
                            <>
                              <Check className="w-3 h-3 md:w-4 md:h-4 md:mr-1" />
                              <span className="hidden md:inline text-xs font-medium">Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 md:w-4 md:h-4 md:mr-1" />
                              <span className="hidden md:inline text-xs font-medium">Copiar</span>
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteInvitationMutation.mutate(invitation.id)}
                          disabled={deleteInvitationMutation.isPending}
                          className="border-red-400/30 bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:border-red-400/50"
                        >
                          <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between text-xs md:text-sm gap-2 md:gap-0">
                      <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 text-white/70">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 md:w-4 md:h-4" />
                          Expira: {formatDate(invitation.expiresAt)}
                        </span>
                        {invitation.companyName && (
                          <span>Empresa: {invitation.companyName}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}