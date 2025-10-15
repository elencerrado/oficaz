import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Mail, Eye, MousePointerClick, UserCheck, Calendar, BarChart3 } from 'lucide-react';
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
          <div className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-500/20 rounded-lg p-3 border border-blue-400/30">
                <div className="flex items-center gap-2 text-blue-300 mb-1">
                  <Mail className="w-4 h-4" />
                  <span className="text-xs font-medium">Campañas</span>
                </div>
                <p className="text-2xl font-bold text-white">{campaignHistory.campaigns.length}</p>
              </div>
              
              <div className="bg-purple-500/20 rounded-lg p-3 border border-purple-400/30">
                <div className="flex items-center gap-2 text-purple-300 mb-1">
                  <Eye className="w-4 h-4" />
                  <span className="text-xs font-medium">Abiertos</span>
                </div>
                <p className="text-2xl font-bold text-white">
                  {campaignHistory.campaigns.filter((c: any) => c.openedAt).length}
                </p>
              </div>
              
              <div className="bg-indigo-500/20 rounded-lg p-3 border border-indigo-400/30">
                <div className="flex items-center gap-2 text-indigo-300 mb-1">
                  <MousePointerClick className="w-4 h-4" />
                  <span className="text-xs font-medium">Clicks</span>
                </div>
                <p className="text-2xl font-bold text-white">
                  {campaignHistory.campaigns.filter((c: any) => c.clickedAt).length}
                </p>
              </div>
            </div>

            {/* Registration Status */}
            {campaignHistory.registration && (
              <div className="bg-green-500/20 border border-green-400/30 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-300 mb-2">
                  <UserCheck className="w-5 h-5" />
                  <span className="font-medium">¡Registrado como cliente!</span>
                </div>
                <p className="text-white text-sm">Empresa: {campaignHistory.registration.companyName}</p>
                <p className="text-green-200/70 text-xs mt-1">
                  {format(new Date(campaignHistory.registration.registeredAt), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}
                </p>
              </div>
            )}

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
