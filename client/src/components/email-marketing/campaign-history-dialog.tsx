import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { Clock, Mail, MailOpen, MousePointerClick } from "lucide-react";
import { format, parseISO, isSameDay } from "date-fns";
import { es } from "date-fns/locale";

interface CampaignHistoryDialogProps {
  campaignId: number;
  campaignName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EmailSend {
  id: number;
  campaignId: number;
  recipientEmail: string;
  recipientName: string | null;
  sentAt: string;
  openedAt: string | null;
  clickedAt: string | null;
}

export function CampaignHistoryDialog({ campaignId, campaignName, open, onOpenChange }: CampaignHistoryDialogProps) {
  const { data: sends = [], isLoading } = useQuery<EmailSend[]>({
    queryKey: ['/api/super-admin/email-campaigns', campaignId, 'history'],
    queryFn: async () => {
      const token = sessionStorage.getItem('superAdminToken');
      const response = await fetch(`/api/super-admin/email-campaigns/${campaignId}/history`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch campaign history');
      return response.json();
    },
    enabled: open,
  });

  // Group sends by day
  const groupedSends = sends.reduce((groups: { [key: string]: EmailSend[] }, send) => {
    const date = format(parseISO(send.sentAt), 'yyyy-MM-dd');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(send);
    return groups;
  }, {});

  const sortedDates = Object.keys(groupedSends).sort((a, b) => b.localeCompare(a));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-gradient-to-br from-gray-900 to-gray-800 border-white/20">
        <DialogHeader>
          <DialogTitle className="text-white text-xl">
            Historial de Envíos - {campaignName}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="text-center py-8">
            <p className="text-white/60">Cargando historial...</p>
          </div>
        ) : sends.length === 0 ? (
          <div className="text-center py-8">
            <Mail className="w-12 h-12 text-white/40 mx-auto mb-3" />
            <p className="text-white/60">Esta campaña aún no se ha enviado</p>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedDates.map(date => {
              const daySends = groupedSends[date];
              const openedCount = daySends.filter(s => s.openedAt).length;
              const clickedCount = daySends.filter(s => s.clickedAt).length;
              
              return (
                <div key={date} className="bg-white/5 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-white/60" />
                      <h3 className="text-white font-semibold">
                        {format(parseISO(date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
                      </h3>
                    </div>
                    <div className="text-sm text-white/60">
                      {daySends.length} enviados · {openedCount} abiertos · {clickedCount} clics
                    </div>
                  </div>

                  <div className="space-y-2">
                    {daySends.map(send => (
                      <div 
                        key={send.id} 
                        className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            {send.openedAt ? (
                              <MailOpen className="w-4 h-4 text-green-400" />
                            ) : (
                              <Mail className="w-4 h-4 text-white/40" />
                            )}
                            {send.clickedAt && (
                              <MousePointerClick className="w-4 h-4 text-blue-400" />
                            )}
                          </div>
                          <div>
                            <p className="text-white font-medium">
                              {send.recipientName || send.recipientEmail}
                            </p>
                            {send.recipientName && (
                              <p className="text-sm text-white/60">{send.recipientEmail}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-white/60">
                            {format(parseISO(send.sentAt), 'HH:mm', { locale: es })}
                          </p>
                          {send.openedAt && (
                            <p className="text-xs text-green-400">
                              Abierto {format(parseISO(send.openedAt), 'HH:mm', { locale: es })}
                            </p>
                          )}
                          {send.clickedAt && (
                            <p className="text-xs text-blue-400">
                              Clic {format(parseISO(send.clickedAt), 'HH:mm', { locale: es })}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
