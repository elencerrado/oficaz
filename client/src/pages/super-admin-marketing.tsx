import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SuperAdminLayout } from '@/components/layout/super-admin-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { CreateCampaignDialog } from '@/components/email-marketing/create-campaign-dialog';
import { AddProspectDialog } from '@/components/email-marketing/add-prospect-dialog';
import { EditCampaignDialog } from '@/components/email-marketing/edit-campaign-dialog';
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
  Edit
} from 'lucide-react';

export default function SuperAdminMarketing() {
  const [activeTab, setActiveTab] = useState('campaigns');
  const [editingCampaign, setEditingCampaign] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: campaigns } = useQuery({
    queryKey: ['/api/super-admin/email-campaigns'],
    queryFn: async () => {
      const token = localStorage.getItem('superAdminToken');
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
      const token = localStorage.getItem('superAdminToken');
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
      const token = localStorage.getItem('superAdminToken');
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

  // Send campaign mutation
  const sendCampaignMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      const token = localStorage.getItem('superAdminToken');
      const response = await fetch(`/api/super-admin/email-campaigns/${campaignId}/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to send campaign');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Campaña enviada',
        description: 'La campaña se está enviando a los destinatarios',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/email-campaigns'] });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo enviar la campaña',
        variant: 'destructive',
      });
    },
  });

  // Calculate statistics
  const totalCampaigns = campaigns?.length || 0;
  const draftCampaigns = campaigns?.filter((c: any) => c.status === 'draft').length || 0;
  const sentCampaigns = campaigns?.filter((c: any) => c.status === 'sent').length || 0;
  const totalProspects = prospects?.length || 0;
  const activeProspects = prospects?.filter((p: any) => p.status === 'active').length || 0;

  return (
    <SuperAdminLayout>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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
              <BarChart3 className="h-4 w-4 text-yellow-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">0%</div>
              <p className="text-xs text-white/60 mt-1">Promedio global</p>
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
                            <p className="text-sm text-white/80">{campaign.recipientsCount || 0} destinatarios</p>
                            {campaign.status === 'sent' && (
                              <p className="text-xs text-white/60">
                                {campaign.openedCount || 0} aperturas · {campaign.clickedCount || 0} clics
                              </p>
                            )}
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setEditingCampaign(campaign)}
                            className="text-white/70 hover:text-white hover:bg-white/10"
                            data-testid={`button-edit-campaign-${campaign.id}`}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Editar
                          </Button>
                          {campaign.status === 'draft' && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => sendCampaignMutation.mutate(campaign.id)}
                              disabled={sendCampaignMutation.isPending}
                              className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                              data-testid={`button-send-campaign-${campaign.id}`}
                            >
                              <Send className="w-4 h-4 mr-1" />
                              {sendCampaignMutation.isPending ? 'Enviando...' : 'Enviar'}
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
                    <AddProspectDialog />
                  </div>
                </CardHeader>
                <CardContent>
                  {!prospects || prospects.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="w-10 h-10 text-white/40 mx-auto mb-3" />
                      <p className="text-white/60">No hay prospects externos añadidos</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {prospects.slice(0, 5).map((prospect: any) => (
                        <div key={prospect.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                          <div>
                            <p className="font-medium text-white">{prospect.name || prospect.email}</p>
                            <p className="text-sm text-white/60">{prospect.email}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            {prospect.tags && prospect.tags.length > 0 && (
                              <div className="flex gap-1">
                                {prospect.tags.slice(0, 2).map((tag: string) => (
                                  <span key={tag} className="px-2 py-1 bg-purple-500/20 text-purple-200 text-xs rounded">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                            <span className={`text-xs px-2 py-1 rounded ${
                              prospect.status === 'active' ? 'bg-green-500/20 text-green-200' :
                              prospect.status === 'unsubscribed' ? 'bg-gray-500/20 text-gray-200' :
                              'bg-red-500/20 text-red-200'
                            }`}>
                              {prospect.status}
                            </span>
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
                  <div className="text-4xl font-bold text-white">0%</div>
                  <p className="text-xs text-white/70 mt-2">Promedio de campañas enviadas</p>
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
                  <div className="text-4xl font-bold text-white">0%</div>
                  <p className="text-xs text-white/70 mt-2">CTR promedio</p>
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
                  <div className="text-4xl font-bold text-white">0</div>
                  <p className="text-xs text-white/70 mt-2">Total de envíos</p>
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
    </SuperAdminLayout>
  );
}
