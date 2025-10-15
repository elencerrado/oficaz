import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Mail, Eye, MousePointerClick, UserCheck, Calendar, BarChart3, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ProspectStatsDialogProps {
  prospect: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProspectStatsDialog({ prospect, open, onOpenChange }: ProspectStatsDialogProps) {
  const { data: campaignHistory, isLoading } = useQuery({
    queryKey: ['/api/super-admin/email-prospects', prospect?.id, 'campaign-history'],
    queryFn: async () => {
      const token = localStorage.getItem('superAdminToken');
      const response = await fetch(`/api/super-admin/email-prospects/${prospect.id}/campaign-history`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch campaign history');
      return response.json();
    },
    enabled: open && !!prospect,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 border-white/20 text-white">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Estadísticas de {prospect?.name || prospect?.email}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="text-center py-8 text-white/60">Cargando estadísticas...</div>
        ) : !campaignHistory || campaignHistory.campaigns.length === 0 ? (
          <div className="text-center py-8">
            <BarChart3 className="w-12 h-12 text-white/40 mx-auto mb-3" />
            <p className="text-white/60">Este prospect no ha participado en ninguna campaña</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Registration Status - Prominente */}
            <div className={`rounded-lg p-4 border-2 ${
              campaignHistory.registration 
                ? 'bg-green-500/20 border-green-400/50' 
                : 'bg-gray-500/20 border-gray-400/30'
            }`}>
              <div className="flex items-center gap-3">
                {campaignHistory.registration ? (
                  <>
                    <CheckCircle className="w-6 h-6 text-green-400" />
                    <div className="flex-1">
                      <p className="text-green-300 font-semibold text-lg">✓ Cliente Registrado</p>
                      <p className="text-white text-sm mt-1">Empresa: {campaignHistory.registration.companyName}</p>
                      <p className="text-green-200/70 text-xs mt-0.5">
                        {format(new Date(campaignHistory.registration.registeredAt), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="w-6 h-6 text-gray-400" />
                    <div>
                      <p className="text-gray-300 font-semibold text-lg">No Registrado</p>
                      <p className="text-gray-400 text-sm">Aún no se ha convertido en cliente</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Conversion Funnel */}
            <div className="bg-white/5 rounded-lg p-4">
              <h3 className="text-white font-medium mb-4">Embudo de Conversión</h3>
              
              {(() => {
                const totalCampaigns = campaignHistory.campaigns.length;
                const totalOpened = campaignHistory.campaigns.filter((c: any) => c.openedAt).length;
                const totalClicked = campaignHistory.campaigns.filter((c: any) => c.clickedAt).length;
                const isRegistered = !!campaignHistory.registration;
                
                const openRate = totalCampaigns > 0 ? Math.round((totalOpened / totalCampaigns) * 100) : 0;
                const clickRate = totalOpened > 0 ? Math.round((totalClicked / totalOpened) * 100) : 0;
                const conversionRate = totalClicked > 0 && isRegistered ? 100 : 0;
                
                return (
                  <div className="space-y-3">
                    {/* Enviado */}
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-32">
                        <div className="flex items-center gap-2 text-blue-300">
                          <Mail className="w-4 h-4" />
                          <span className="text-sm font-medium">Enviado</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="bg-blue-500/30 h-8 rounded flex items-center px-3">
                          <span className="text-white font-bold">{totalCampaigns}</span>
                        </div>
                      </div>
                      <div className="w-16 text-right">
                        <span className="text-white font-semibold">100%</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-center">
                      <ArrowRight className="w-5 h-5 text-white/40 rotate-90" />
                    </div>
                    
                    {/* Abierto */}
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-32">
                        <div className="flex items-center gap-2 text-purple-300">
                          <Eye className="w-4 h-4" />
                          <span className="text-sm font-medium">Abierto</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="bg-purple-500/30 h-8 rounded flex items-center px-3" style={{ width: `${openRate}%`, minWidth: '20%' }}>
                          <span className="text-white font-bold">{totalOpened}</span>
                        </div>
                      </div>
                      <div className="w-16 text-right">
                        <span className="text-white font-semibold">{openRate}%</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-center">
                      <ArrowRight className="w-5 h-5 text-white/40 rotate-90" />
                    </div>
                    
                    {/* Click */}
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-32">
                        <div className="flex items-center gap-2 text-indigo-300">
                          <MousePointerClick className="w-4 h-4" />
                          <span className="text-sm font-medium">Click</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="bg-indigo-500/30 h-8 rounded flex items-center px-3" style={{ width: `${clickRate > 0 ? clickRate : 10}%`, minWidth: '20%' }}>
                          <span className="text-white font-bold">{totalClicked}</span>
                        </div>
                      </div>
                      <div className="w-16 text-right">
                        <span className="text-white font-semibold">{clickRate}%</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-center">
                      <ArrowRight className="w-5 h-5 text-white/40 rotate-90" />
                    </div>
                    
                    {/* Registrado */}
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-32">
                        <div className="flex items-center gap-2 text-green-300">
                          <UserCheck className="w-4 h-4" />
                          <span className="text-sm font-medium">Registrado</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className={`h-8 rounded flex items-center px-3 ${isRegistered ? 'bg-green-500/30' : 'bg-gray-500/20'}`} style={{ width: isRegistered ? '100%' : '20%', minWidth: '20%' }}>
                          <span className="text-white font-bold">{isRegistered ? 1 : 0}</span>
                        </div>
                      </div>
                      <div className="w-16 text-right">
                        <span className="text-white font-semibold">{isRegistered ? '✓' : '-'}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Campaign List */}
            <div>
              <h3 className="text-white font-medium mb-3">Historial de Campañas</h3>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {campaignHistory.campaigns.map((campaign: any) => (
                  <div key={campaign.id} className="bg-white/5 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-white font-medium">{campaign.campaignName}</p>
                      {campaign.sentAt && (
                        <span className="text-xs text-white/60 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(campaign.sentAt), 'dd/MM/yyyy', { locale: es })}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className={`flex items-center gap-1.5 text-sm ${campaign.sentAt ? 'text-blue-300' : 'text-white/40'}`}>
                        <Mail className="w-4 h-4" />
                        <span>Enviado</span>
                        {campaign.sentAt && (
                          <span className="text-xs text-white/60">
                            {format(new Date(campaign.sentAt), 'HH:mm', { locale: es })}
                          </span>
                        )}
                      </div>
                      
                      <div className={`flex items-center gap-1.5 text-sm ${campaign.openedAt ? 'text-purple-300' : 'text-white/40'}`}>
                        <Eye className="w-4 h-4" />
                        <span>Abierto</span>
                        {campaign.openedAt && (
                          <span className="text-xs text-white/60">
                            {format(new Date(campaign.openedAt), 'HH:mm', { locale: es })}
                          </span>
                        )}
                      </div>
                      
                      <div className={`flex items-center gap-1.5 text-sm ${campaign.clickedAt ? 'text-indigo-300' : 'text-white/40'}`}>
                        <MousePointerClick className="w-4 h-4" />
                        <span>Click</span>
                        {campaign.clickedAt && (
                          <span className="text-xs text-white/60">
                            {format(new Date(campaign.clickedAt), 'HH:mm', { locale: es })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
