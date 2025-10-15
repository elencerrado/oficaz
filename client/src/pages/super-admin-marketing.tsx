import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SuperAdminLayout } from '@/components/layout/super-admin-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreateCampaignDialog } from '@/components/email-marketing/create-campaign-dialog';
import { AddProspectDialog } from '@/components/email-marketing/add-prospect-dialog';
import { EditProspectDialog } from '@/components/email-marketing/edit-prospect-dialog';
import { EditCampaignDialog } from '@/components/email-marketing/edit-campaign-dialog';
import { CampaignConversionsDialog } from '@/components/email-marketing/campaign-conversions-dialog';
import { ProspectStatsDialog } from '@/components/email-marketing/prospect-stats-dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Send, 
  Users, 
  Mail, 
  BarChart3,
  Clock,
  CheckCircle,
  Eye,
  MousePointerClick,
  Trash2,
  Edit,
  Edit2,
  Copy,
  TrendingUp
} from 'lucide-react';

export default function SuperAdminMarketing() {
  const [activeTab, setActiveTab] = useState('campaigns');
  const [editingCampaign, setEditingCampaign] = useState<any>(null);
  const [conversionsCampaign, setConversionsCampaign] = useState<any>(null);
  const [editingProspect, setEditingProspect] = useState<any>(null);
  const [statsProspect, setStatsProspect] = useState<any>(null);
  const [isTableView, setIsTableView] = useState(false);
  const [editingCell, setEditingCell] = useState<{ id: number | string; field: string } | null>(null);
  const [tagInput, setTagInput] = useState('');
  const { toast} = useToast();
  const queryClient = useQueryClient();

  const { data: campaigns } = useQuery({
    queryKey: ['/api/super-admin/email-campaigns'],
    queryFn: async () => {
      const token = sessionStorage.getItem('superAdminToken');
      const response = await fetch('/api/super-admin/email-campaigns', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch campaigns');
      return response.json();
    },
    staleTime: 30000,
    refetchOnMount: false,
  });

  const { data: prospects } = useQuery({
    queryKey: ['/api/super-admin/email-prospects'],
    queryFn: async () => {
      const token = sessionStorage.getItem('superAdminToken');
      const response = await fetch('/api/super-admin/email-prospects', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch prospects');
      return response.json();
    },
    staleTime: 30000,
    refetchOnMount: false,
  });

  const { data: registeredUsers } = useQuery({
    queryKey: ['/api/super-admin/registered-users-stats'],
    queryFn: async () => {
      const token = sessionStorage.getItem('superAdminToken');
      const response = await fetch('/api/super-admin/registered-users-stats', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch users stats');
      return response.json();
    },
    staleTime: 30000,
    refetchOnMount: false,
  });

  // Get all unique tags from all prospects
  const allTags = React.useMemo(() => {
    if (!prospects) return [];
    const tagsSet = new Set<string>();
    prospects.forEach((prospect: any) => {
      prospect.tags?.forEach((tag: string) => tagsSet.add(tag));
    });
    return Array.from(tagsSet).sort();
  }, [prospects]);

  // Send campaign mutation
  const sendCampaignMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      const token = sessionStorage.getItem('superAdminToken');
      const response = await fetch(`/api/super-admin/email-campaigns/${campaignId}/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send campaign');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Campaña enviada',
        description: data.message || 'La campaña se envió correctamente',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/email-campaigns'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo enviar la campaña',
        variant: 'destructive',
      });
    },
  });

  // Duplicate campaign mutation
  const duplicateCampaignMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      const token = sessionStorage.getItem('superAdminToken');
      const response = await fetch(`/api/super-admin/email-campaigns/${campaignId}/duplicate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to duplicate campaign');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Campaña duplicada',
        description: 'La campaña se duplicó correctamente',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/email-campaigns'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo duplicar la campaña',
        variant: 'destructive',
      });
    },
  });

  // Delete prospect mutation
  const deleteProspectMutation = useMutation({
    mutationFn: async (prospectId: number) => {
      const token = sessionStorage.getItem('superAdminToken');
      const response = await fetch(`/api/super-admin/email-prospects/${prospectId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to delete prospect');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Prospect eliminado',
        description: 'El prospect se eliminó correctamente',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/email-prospects'] });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el prospect',
        variant: 'destructive',
      });
    },
  });

  // Update prospect inline mutation
  const updateProspectInlineMutation = useMutation({
    mutationFn: async ({ prospectId, field, value }: { prospectId: number; field: string; value: any }) => {
      const token = sessionStorage.getItem('superAdminToken');
      const response = await fetch(`/api/super-admin/email-prospects/${prospectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ [field]: value }),
      });
      if (!response.ok) throw new Error('Failed to update prospect');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/email-prospects'] });
      setEditingCell(null);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el prospect',
        variant: 'destructive',
      });
      setEditingCell(null);
    },
  });

  // Create prospect from empty row mutation
  const createProspectFromRowMutation = useMutation({
    mutationFn: async ({ field, value }: { field: string; value: any }) => {
      const token = sessionStorage.getItem('superAdminToken');
      const prospectData: any = { [field]: value };
      
      // If field is not email, we need a placeholder email
      if (field !== 'email') {
        prospectData.email = `temp-${Date.now()}@placeholder.com`;
      }
      
      const response = await fetch('/api/super-admin/email-prospects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(prospectData),
      });
      if (!response.ok) throw new Error('Failed to create prospect');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/email-prospects'] });
      setEditingCell(null);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo crear el prospect',
        variant: 'destructive',
      });
      setEditingCell(null);
    },
  });

  // Handler functions
  const handleEditProspect = (prospect: any) => {
    setEditingProspect(prospect);
  };

  const handleDeleteProspect = (prospectId: number) => {
    if (confirm('¿Estás seguro de que quieres eliminar este prospect?')) {
      deleteProspectMutation.mutate(prospectId);
    }
  };

  // Calculate statistics
  const totalCampaigns = campaigns?.length || 0;
  const draftCampaigns = campaigns?.filter((c: any) => c.status === 'draft').length || 0;
  const sentCampaigns = campaigns?.filter((c: any) => c.status === 'sent').length || 0;
  const totalProspects = prospects?.length || 0;
  const activeProspects = prospects?.filter((p: any) => p.status === 'active').length || 0;

  // Calculate email statistics
  const totalSent = campaigns?.reduce((sum: number, c: any) => sum + (c.sentRecipientsCount || 0), 0) || 0;
  const totalOpened = campaigns?.reduce((sum: number, c: any) => sum + (c.openedCount || 0), 0) || 0;
  const totalClicked = campaigns?.reduce((sum: number, c: any) => sum + (c.clickedCount || 0), 0) || 0;
  
  const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;
  const clickRate = totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0;

  return (
    <SuperAdminLayout>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
          <Card className="bg-white/10 backdrop-blur-xl border-white/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white/80">
                Campañas Totales
              </CardTitle>
              <Mail className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{totalCampaigns}</div>
              <p className="text-xs text-white/60 mt-1">{draftCampaigns} borradores, {sentCampaigns} enviadas</p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-xl border-white/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white/80">
                Usuarios Registrados
              </CardTitle>
              <Users className="h-4 w-4 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{registeredUsers?.total || 0}</div>
              <p className="text-xs text-white/60 mt-1">
                {registeredUsers?.active || 0} activos, {registeredUsers?.trial || 0} en prueba
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-xl border-white/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white/80">
                Prospects Externos
              </CardTitle>
              <Send className="h-4 w-4 text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{totalProspects}</div>
              <p className="text-xs text-white/60 mt-1">{activeProspects} activos</p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-xl border-white/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white/80">
                Tasa de Apertura
              </CardTitle>
              <Eye className="h-4 w-4 text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{openRate}%</div>
              <p className="text-xs text-white/60 mt-1">{totalOpened} de {totalSent} enviados</p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-xl border-white/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white/80">
                Tasa de Clics (CTR)
              </CardTitle>
              <MousePointerClick className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{clickRate}%</div>
              <p className="text-xs text-white/60 mt-1">{totalClicked} clics de {totalSent} enviados</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-white/10">
            <TabsTrigger value="campaigns" className="data-[state=active]:bg-white/20">
              Campañas
            </TabsTrigger>
            <TabsTrigger value="contacts" className="data-[state=active]:bg-white/20">
              Listas de Contactos
            </TabsTrigger>
            <TabsTrigger value="stats" className="data-[state=active]:bg-white/20">
              Estadísticas
            </TabsTrigger>
          </TabsList>

          {/* Campaigns Tab */}
          <TabsContent value="campaigns" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Campañas de Email</h2>
                <p className="text-white/60 text-sm">Crea y gestiona tus campañas de marketing</p>
              </div>
              <CreateCampaignDialog />
            </div>

            <Card className="bg-white/10 backdrop-blur-xl border-white/20">
              <CardContent className="p-6">
                {!campaigns || campaigns.length === 0 ? (
                  <div className="text-center py-12">
                    <Mail className="w-12 h-12 text-white/40 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-white mb-2">No hay campañas</h3>
                    <p className="text-white/60 mb-4">Crea tu primera campaña de email marketing</p>
                    <CreateCampaignDialog />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {campaigns.map((campaign: any) => (
                      <div 
                        key={campaign.id}
                        className="flex items-center justify-between p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            campaign.status === 'sent' ? 'bg-green-500/20' :
                            campaign.status === 'scheduled' ? 'bg-yellow-500/20' :
                            'bg-gray-500/20'
                          }`}>
                            {campaign.status === 'sent' ? <CheckCircle className="w-5 h-5 text-green-400" /> :
                             campaign.status === 'scheduled' ? <Clock className="w-5 h-5 text-yellow-400" /> :
                             <Mail className="w-5 h-5 text-gray-400" />}
                          </div>
                          <div>
                            <h4 className="font-semibold text-white">{campaign.name}</h4>
                            <p className="text-sm text-white/60">{campaign.subject}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right mr-4">
                            <p className="text-sm text-white/80">
                              {campaign.selectedEmails?.length || 0} seleccionados
                            </p>
                            {campaign.status === 'sent' && (
                              <p className="text-xs text-white/60">
                                {campaign.sentRecipientsCount || 0} enviados · {campaign.openedCount || 0} aperturas · {campaign.clickedCount || 0} clics
                              </p>
                            )}
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => sendCampaignMutation.mutate(campaign.id)}
                            disabled={!campaign.hasNewRecipients || sendCampaignMutation.isPending}
                            className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 disabled:opacity-30 disabled:cursor-not-allowed"
                            data-testid={`button-send-campaign-${campaign.id}`}
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setEditingCampaign(campaign)}
                            className="text-white/70 hover:text-white hover:bg-white/10"
                            data-testid={`button-edit-campaign-${campaign.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => duplicateCampaignMutation.mutate(campaign.id)}
                            disabled={duplicateCampaignMutation.isPending}
                            className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                            data-testid={`button-duplicate-campaign-${campaign.id}`}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          {campaign.status === 'sent' && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setConversionsCampaign(campaign)}
                              className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                              data-testid={`button-conversions-campaign-${campaign.id}`}
                            >
                              <TrendingUp className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contacts Tab */}
          <TabsContent value="contacts" className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">Listas de Contactos</h2>
              
              {/* Registered Users Section */}
              <Card className="bg-white/10 backdrop-blur-xl border-white/20 mb-6">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Usuarios Registrados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-blue-500/20 rounded-lg p-4 border border-blue-400/30">
                      <p className="text-sm text-blue-200 mb-1">Activos</p>
                      <p className="text-2xl font-bold text-white">{registeredUsers?.active || 0}</p>
                    </div>
                    <div className="bg-yellow-500/20 rounded-lg p-4 border border-yellow-400/30">
                      <p className="text-sm text-yellow-200 mb-1">En Prueba</p>
                      <p className="text-2xl font-bold text-white">{registeredUsers?.trial || 0}</p>
                    </div>
                    <div className="bg-red-500/20 rounded-lg p-4 border border-red-400/30">
                      <p className="text-sm text-red-200 mb-1">Bloqueados</p>
                      <p className="text-2xl font-bold text-white">{registeredUsers?.blocked || 0}</p>
                    </div>
                    <div className="bg-gray-500/20 rounded-lg p-4 border border-gray-400/30">
                      <p className="text-sm text-gray-200 mb-1">Cancelados</p>
                      <p className="text-2xl font-bold text-white">{registeredUsers?.cancelled || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Prospects Section */}
              <Card className="bg-white/10 backdrop-blur-xl border-white/20">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                      <Send className="w-5 h-5" />
                      Prospects Externos
                    </CardTitle>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white/70">Vista Tabla</span>
                        <Switch
                          checked={isTableView}
                          onCheckedChange={setIsTableView}
                          className="data-[state=checked]:bg-purple-600"
                        />
                      </div>
                      <AddProspectDialog />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {!prospects || prospects.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="w-10 h-10 text-white/40 mx-auto mb-3" />
                      <p className="text-white/60">No hay prospects externos añadidos</p>
                    </div>
                  ) : isTableView ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-white/20 hover:bg-white/5">
                            <TableHead className="text-white/90">Email</TableHead>
                            <TableHead className="text-white/90">Nombre</TableHead>
                            <TableHead className="text-white/90">Empresa</TableHead>
                            <TableHead className="text-white/90">Teléfono</TableHead>
                            <TableHead className="text-white/90">Localización</TableHead>
                            <TableHead className="text-white/90">Tags</TableHead>
                            <TableHead className="text-white/90">Notas</TableHead>
                            <TableHead className="text-white/90 w-24">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[...prospects, { id: 'new', email: '', name: '', company: '', phone: '', location: '', tags: [], notes: '' }].map((prospect: any) => (
                            <TableRow key={prospect.id} className="border-white/20 hover:bg-white/5">
                              <TableCell
                                className="text-white font-medium cursor-pointer hover:bg-white/10"
                                onClick={() => {
                                  if (prospect.id === 'new') {
                                    setEditingCell({ id: 'new', field: 'email' });
                                  }
                                }}
                                onDoubleClick={() => {
                                  if (prospect.id !== 'new') {
                                    setEditingCell({ id: prospect.id, field: 'email' });
                                  }
                                }}
                              >
                                {editingCell?.id === prospect.id && editingCell?.field === 'email' ? (
                                  <Input
                                    defaultValue={prospect.email || ''}
                                    autoFocus
                                    type="email"
                                    placeholder={prospect.id === 'new' ? 'Email...' : ''}
                                    className="bg-white/10 border-white/20 text-white h-8"
                                    onBlur={(e) => {
                                      const value = e.target.value.trim();
                                      if (prospect.id === 'new' && value) {
                                        createProspectFromRowMutation.mutate({
                                          field: 'email',
                                          value,
                                        });
                                      } else if (prospect.id !== 'new' && value !== prospect.email) {
                                        updateProspectInlineMutation.mutate({
                                          prospectId: prospect.id,
                                          field: 'email',
                                          value: value || null,
                                        });
                                      } else {
                                        setEditingCell(null);
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.currentTarget.blur();
                                      } else if (e.key === 'Escape') {
                                        setEditingCell(null);
                                      }
                                    }}
                                  />
                                ) : (
                                  prospect.email || (prospect.id === 'new' ? <span className="text-white/40 italic">Email...</span> : '')
                                )}
                              </TableCell>
                              <TableCell
                                className="text-white cursor-pointer hover:bg-white/10"
                                onClick={() => {
                                  if (prospect.id === 'new') {
                                    setEditingCell({ id: 'new', field: 'name' });
                                  }
                                }}
                                onDoubleClick={() => {
                                  if (prospect.id !== 'new') {
                                    setEditingCell({ id: prospect.id, field: 'name' });
                                  }
                                }}
                              >
                                {editingCell?.id === prospect.id && editingCell?.field === 'name' ? (
                                  <Input
                                    defaultValue={prospect.name || ''}
                                    autoFocus
                                    placeholder={prospect.id === 'new' ? 'Nombre...' : ''}
                                    className="bg-white/10 border-white/20 text-white h-8"
                                    onBlur={(e) => {
                                      const value = e.target.value.trim();
                                      if (prospect.id === 'new' && value) {
                                        createProspectFromRowMutation.mutate({
                                          field: 'name',
                                          value,
                                        });
                                      } else if (prospect.id !== 'new' && value !== prospect.name) {
                                        updateProspectInlineMutation.mutate({
                                          prospectId: prospect.id,
                                          field: 'name',
                                          value: value || null,
                                        });
                                      } else {
                                        setEditingCell(null);
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.currentTarget.blur();
                                      } else if (e.key === 'Escape') {
                                        setEditingCell(null);
                                      }
                                    }}
                                  />
                                ) : (
                                  prospect.name || (prospect.id === 'new' ? <span className="text-white/40 italic">Nombre...</span> : '-')
                                )}
                              </TableCell>
                              <TableCell
                                className="text-white cursor-pointer hover:bg-white/10"
                                onClick={() => {
                                  if (prospect.id === 'new') {
                                    setEditingCell({ id: 'new', field: 'company' });
                                  }
                                }}
                                onDoubleClick={() => {
                                  if (prospect.id !== 'new') {
                                    setEditingCell({ id: prospect.id, field: 'company' });
                                  }
                                }}
                              >
                                {editingCell?.id === prospect.id && editingCell?.field === 'company' ? (
                                  <Input
                                    defaultValue={prospect.company || ''}
                                    autoFocus
                                    placeholder={prospect.id === 'new' ? 'Empresa...' : ''}
                                    className="bg-white/10 border-white/20 text-white h-8"
                                    onBlur={(e) => {
                                      const value = e.target.value.trim();
                                      if (prospect.id === 'new' && value) {
                                        createProspectFromRowMutation.mutate({
                                          field: 'company',
                                          value,
                                        });
                                      } else if (prospect.id !== 'new' && value !== prospect.company) {
                                        updateProspectInlineMutation.mutate({
                                          prospectId: prospect.id,
                                          field: 'company',
                                          value: value || null,
                                        });
                                      } else {
                                        setEditingCell(null);
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.currentTarget.blur();
                                      } else if (e.key === 'Escape') {
                                        setEditingCell(null);
                                      }
                                    }}
                                  />
                                ) : (
                                  prospect.company || (prospect.id === 'new' ? <span className="text-white/40 italic">Empresa...</span> : '-')
                                )}
                              </TableCell>
                              <TableCell
                                className="text-white cursor-pointer hover:bg-white/10"
                                onClick={() => {
                                  if (prospect.id === 'new') {
                                    setEditingCell({ id: 'new', field: 'phone' });
                                  }
                                }}
                                onDoubleClick={() => {
                                  if (prospect.id !== 'new') {
                                    setEditingCell({ id: prospect.id, field: 'phone' });
                                  }
                                }}
                              >
                                {editingCell?.id === prospect.id && editingCell?.field === 'phone' ? (
                                  <Input
                                    defaultValue={prospect.phone || ''}
                                    autoFocus
                                    placeholder={prospect.id === 'new' ? 'Teléfono...' : ''}
                                    className="bg-white/10 border-white/20 text-white h-8"
                                    onBlur={(e) => {
                                      const value = e.target.value.trim();
                                      if (prospect.id === 'new' && value) {
                                        createProspectFromRowMutation.mutate({
                                          field: 'phone',
                                          value,
                                        });
                                      } else if (prospect.id !== 'new' && value !== prospect.phone) {
                                        updateProspectInlineMutation.mutate({
                                          prospectId: prospect.id,
                                          field: 'phone',
                                          value: value || null,
                                        });
                                      } else {
                                        setEditingCell(null);
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.currentTarget.blur();
                                      } else if (e.key === 'Escape') {
                                        setEditingCell(null);
                                      }
                                    }}
                                  />
                                ) : (
                                  prospect.phone || (prospect.id === 'new' ? <span className="text-white/40 italic">Teléfono...</span> : '-')
                                )}
                              </TableCell>
                              <TableCell
                                className="text-white cursor-pointer hover:bg-white/10"
                                onClick={() => {
                                  if (prospect.id === 'new') {
                                    setEditingCell({ id: 'new', field: 'location' });
                                  }
                                }}
                                onDoubleClick={() => {
                                  if (prospect.id !== 'new') {
                                    setEditingCell({ id: prospect.id, field: 'location' });
                                  }
                                }}
                              >
                                {editingCell?.id === prospect.id && editingCell?.field === 'location' ? (
                                  <Input
                                    defaultValue={prospect.location || ''}
                                    autoFocus
                                    placeholder={prospect.id === 'new' ? 'Localización...' : ''}
                                    className="bg-white/10 border-white/20 text-white h-8"
                                    onBlur={(e) => {
                                      const value = e.target.value.trim();
                                      if (prospect.id === 'new' && value) {
                                        createProspectFromRowMutation.mutate({
                                          field: 'location',
                                          value,
                                        });
                                      } else if (prospect.id !== 'new' && value !== prospect.location) {
                                        updateProspectInlineMutation.mutate({
                                          prospectId: prospect.id,
                                          field: 'location',
                                          value: value || null,
                                        });
                                      } else {
                                        setEditingCell(null);
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.currentTarget.blur();
                                      } else if (e.key === 'Escape') {
                                        setEditingCell(null);
                                      }
                                    }}
                                  />
                                ) : (
                                  prospect.location || (prospect.id === 'new' ? <span className="text-white/40 italic">Localización...</span> : '-')
                                )}
                              </TableCell>
                              <TableCell
                                className={`text-white ${prospect.id !== 'new' ? 'cursor-pointer hover:bg-white/10' : 'opacity-40'}`}
                                onDoubleClick={() => {
                                  if (prospect.id !== 'new') {
                                    setEditingCell({ id: prospect.id, field: 'tags' });
                                    setTagInput('');
                                  }
                                }}
                              >
                                {editingCell?.id === prospect.id && editingCell?.field === 'tags' ? (
                                  <div className="flex flex-wrap gap-1 items-center min-h-[32px]">
                                    {(prospect.tags || []).map((tag: string) => (
                                      <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-500/20 text-purple-200 text-xs rounded">
                                        {tag}
                                        <button
                                          onClick={() => {
                                            const newTags = prospect.tags.filter((t: string) => t !== tag);
                                            updateProspectInlineMutation.mutate({
                                              prospectId: prospect.id,
                                              field: 'tags',
                                              value: newTags.length > 0 ? newTags : null,
                                            });
                                          }}
                                          className="hover:text-purple-100"
                                        >
                                          ×
                                        </button>
                                      </span>
                                    ))}
                                    <div className="relative">
                                      <Input
                                        value={tagInput}
                                        onChange={(e) => setTagInput(e.target.value)}
                                        placeholder="Añadir tag..."
                                        autoFocus
                                        className="bg-white/10 border-white/20 text-white h-6 text-xs w-32"
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' && tagInput.trim()) {
                                            e.preventDefault();
                                            const newTag = tagInput.trim();
                                            const currentTags = prospect.tags || [];
                                            if (!currentTags.includes(newTag)) {
                                              updateProspectInlineMutation.mutate({
                                                prospectId: prospect.id,
                                                field: 'tags',
                                                value: [...currentTags, newTag],
                                              });
                                            }
                                            setTagInput('');
                                          } else if (e.key === 'Escape') {
                                            setEditingCell(null);
                                            setTagInput('');
                                          }
                                        }}
                                        onBlur={() => {
                                          setTimeout(() => setEditingCell(null), 200);
                                        }}
                                      />
                                      {tagInput && (
                                        <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-white/20 rounded shadow-lg z-50 max-h-32 overflow-y-auto">
                                          {allTags
                                            .filter(tag => 
                                              tag.toLowerCase().includes(tagInput.toLowerCase()) &&
                                              !(prospect.tags || []).includes(tag)
                                            )
                                            .map(tag => (
                                              <button
                                                key={tag}
                                                className="block w-full text-left px-3 py-1.5 text-xs text-white hover:bg-white/10"
                                                onMouseDown={(e) => {
                                                  e.preventDefault();
                                                  const currentTags = prospect.tags || [];
                                                  updateProspectInlineMutation.mutate({
                                                    prospectId: prospect.id,
                                                    field: 'tags',
                                                    value: [...currentTags, tag],
                                                  });
                                                  setTagInput('');
                                                }}
                                              >
                                                {tag}
                                              </button>
                                            ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {prospect.tags?.map((tag: string) => (
                                      <span key={tag} className="px-2 py-0.5 bg-purple-500/20 text-purple-200 text-xs rounded">
                                        {tag}
                                      </span>
                                    )) || '-'}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell
                                className="text-white text-xs cursor-pointer hover:bg-white/10 max-w-xs truncate"
                                onClick={() => {
                                  if (prospect.id === 'new') {
                                    setEditingCell({ id: 'new', field: 'notes' });
                                  }
                                }}
                                onDoubleClick={() => {
                                  if (prospect.id !== 'new') {
                                    setEditingCell({ id: prospect.id, field: 'notes' });
                                  }
                                }}
                              >
                                {editingCell?.id === prospect.id && editingCell?.field === 'notes' ? (
                                  <Input
                                    defaultValue={prospect.notes || ''}
                                    autoFocus
                                    placeholder={prospect.id === 'new' ? 'Notas...' : ''}
                                    className="bg-white/10 border-white/20 text-white h-8"
                                    onBlur={(e) => {
                                      const value = e.target.value.trim();
                                      if (prospect.id === 'new' && value) {
                                        createProspectFromRowMutation.mutate({
                                          field: 'notes',
                                          value,
                                        });
                                      } else if (prospect.id !== 'new' && value !== prospect.notes) {
                                        updateProspectInlineMutation.mutate({
                                          prospectId: prospect.id,
                                          field: 'notes',
                                          value: value || null,
                                        });
                                      } else {
                                        setEditingCell(null);
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.currentTarget.blur();
                                      } else if (e.key === 'Escape') {
                                        setEditingCell(null);
                                      }
                                    }}
                                  />
                                ) : (
                                  prospect.notes || (prospect.id === 'new' ? <span className="text-white/40 italic">Notas...</span> : '-')
                                )}
                              </TableCell>
                              <TableCell>
                                {prospect.id !== 'new' && (
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setStatsProspect(prospect)}
                                      className="h-7 w-7 p-0 text-purple-400 hover:text-purple-300 hover:bg-purple-500/20"
                                    >
                                      <BarChart3 className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDeleteProspect(prospect.id)}
                                      className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {prospects.slice(0, 5).map((prospect: any) => (
                        <div key={prospect.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors group">
                          <div className="flex-1">
                            <p className="font-medium text-white">{prospect.name || prospect.email}</p>
                            <p className="text-sm text-white/60">{prospect.email}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {prospect.tags && prospect.tags.length > 0 && (
                              <div className="flex gap-1">
                                {prospect.tags.slice(0, 2).map((tag: string) => (
                                  <span key={tag} className="px-2 py-1 bg-purple-500/20 text-purple-200 text-xs rounded">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                            {prospect.status !== 'active' && (
                              <span className={`text-xs px-2 py-1 rounded ${
                                prospect.status === 'unsubscribed' ? 'bg-gray-500/20 text-gray-200' :
                                'bg-red-500/20 text-red-200'
                              }`}>
                                {prospect.status === 'unsubscribed' ? 'Desuscrito' : prospect.status === 'bounced' ? 'Rebotado' : prospect.status}
                              </span>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setStatsProspect(prospect)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-purple-400 hover:text-purple-300 hover:bg-purple-500/20"
                              data-testid={`button-stats-prospect-${prospect.id}`}
                            >
                              <BarChart3 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditProspect(prospect)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-400 hover:text-blue-300 hover:bg-blue-500/20"
                              data-testid={`button-edit-prospect-${prospect.id}`}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteProspect(prospect.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 hover:bg-red-500/20"
                              data-testid={`button-delete-prospect-${prospect.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Statistics Tab */}
          <TabsContent value="stats" className="space-y-4">
            <h2 className="text-xl font-semibold text-white mb-4">Estadísticas de Campañas</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 backdrop-blur-xl border-blue-400/30">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-white/90">
                    Tasa de Apertura
                  </CardTitle>
                  <Eye className="h-5 w-5 text-blue-300" />
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-white">{openRate}%</div>
                  <p className="text-xs text-white/70 mt-2">{totalOpened} de {totalSent} emails abiertos</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 backdrop-blur-xl border-emerald-400/30">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-white/90">
                    Tasa de Clics
                  </CardTitle>
                  <MousePointerClick className="h-5 w-5 text-emerald-300" />
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-white">{clickRate}%</div>
                  <p className="text-xs text-white/70 mt-2">{totalClicked} de {totalSent} emails con clics</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 backdrop-blur-xl border-purple-400/30">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-white/90">
                    Emails Enviados
                  </CardTitle>
                  <Send className="h-5 w-5 text-purple-300" />
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-white">{totalSent}</div>
                  <p className="text-xs text-white/70 mt-2">Total de envíos realizados</p>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-white/10 backdrop-blur-xl border-white/20">
              <CardHeader>
                <CardTitle className="text-white">Rendimiento por Campaña</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-white/60">
                  <BarChart3 className="w-12 h-12 mx-auto mb-3 text-white/40" />
                  <p>Las estadísticas aparecerán cuando envíes campañas</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Campaign Dialog */}
      {editingCampaign && (
        <EditCampaignDialog
          campaign={editingCampaign}
          open={!!editingCampaign}
          onOpenChange={(open) => !open && setEditingCampaign(null)}
        />
      )}

      {/* Edit Prospect Dialog */}
      {editingProspect && (
        <EditProspectDialog
          prospect={editingProspect}
          open={!!editingProspect}
          onOpenChange={(open) => !open && setEditingProspect(null)}
        />
      )}

      {/* Campaign Conversions Dialog */}
      {conversionsCampaign && (
        <CampaignConversionsDialog
          campaign={conversionsCampaign}
          open={!!conversionsCampaign}
          onOpenChange={(open) => !open && setConversionsCampaign(null)}
        />
      )}

      {/* Prospect Stats Dialog */}
      {statsProspect && (
        <ProspectStatsDialog
          prospect={statsProspect}
          open={!!statsProspect}
          onOpenChange={(open) => !open && setStatsProspect(null)}
        />
      )}
    </SuperAdminLayout>
  );
}
