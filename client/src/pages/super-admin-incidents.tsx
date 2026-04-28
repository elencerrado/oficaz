import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Clock, MessageSquareWarning, Send } from 'lucide-react';
import { SuperAdminLayout } from '@/components/layout/super-admin-layout';
import { usePageTitle } from '@/hooks/use-page-title';
import { getAuthHeaders } from '@/lib/auth';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

type TicketStatus = 'open' | 'resolved';
type TicketFilter = 'open' | 'resolved' | 'all';

interface SupportTicket {
  id: number;
  companyName: string | null;
  userName: string;
  userEmail: string;
  subject: string;
  message: string;
  status: TicketStatus;
  source: string;
  attachments: Array<{ filename?: string }>;
  resolutionComment: string | null;
  resolvedBy: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

const FILTERS: Array<{ key: TicketFilter; label: string }> = [
  { key: 'open', label: 'Abiertas' },
  { key: 'resolved', label: 'Resueltas' },
  { key: 'all', label: 'Todas' },
];

export default function SuperAdminIncidents() {
  usePageTitle('SuperAdmin - Incidencias');
  const [filter, setFilter] = useState<TicketFilter>('open');
  const [commentByTicket, setCommentByTicket] = useState<Record<number, string>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tickets = [], isLoading } = useQuery<SupportTicket[]>({
    queryKey: ['/api/super-admin/support-tickets', filter],
    queryFn: async () => {
      const response = await fetch(`/api/super-admin/support-tickets?status=${filter}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error('No se pudieron cargar las incidencias');
      }
      return response.json();
    },
    staleTime: 60_000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const resolveTicketMutation = useMutation({
    mutationFn: async ({ id, comment }: { id: number; comment: string }) => {
      return apiRequest('PATCH', `/api/super-admin/support-tickets/${id}/resolve`, {
        comment,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/support-tickets'] });
      toast({
        title: 'Incidencia resuelta',
        description: 'Se ha enviado el email automático al cliente.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'No se pudo resolver la incidencia',
        description: error?.message || 'Revisa la configuración de email e inténtalo de nuevo.',
        variant: 'destructive',
      });
    },
  });

  const stats = useMemo(() => {
    const open = tickets.filter((ticket) => ticket.status === 'open').length;
    const resolved = tickets.filter((ticket) => ticket.status === 'resolved').length;
    return {
      open,
      resolved,
      total: tickets.length,
    };
  }, [tickets]);

  const handleResolve = (ticketId: number) => {
    const comment = (commentByTicket[ticketId] || '').trim();
    resolveTicketMutation.mutate({ id: ticketId, comment });
  };

  const formatDate = (value: string | null) => {
    if (!value) return '-';
    return new Date(value).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <SuperAdminLayout>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-white mb-2">Incidencias de clientes</h1>
          <p className="text-white/70">Gestiona tickets enviados desde el botón flotante y desde configuración.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-white/5 backdrop-blur-xl border border-white/10">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-white/70 text-sm">Abiertas</p>
                <p className="text-2xl font-bold text-white">{stats.open}</p>
              </div>
              <Clock className="w-8 h-8 text-amber-300" />
            </CardContent>
          </Card>
          <Card className="bg-white/5 backdrop-blur-xl border border-white/10">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-white/70 text-sm">Resueltas</p>
                <p className="text-2xl font-bold text-white">{stats.resolved}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-emerald-300" />
            </CardContent>
          </Card>
          <Card className="bg-white/5 backdrop-blur-xl border border-white/10">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-white/70 text-sm">Total</p>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
              </div>
              <MessageSquareWarning className="w-8 h-8 text-blue-300" />
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          {FILTERS.map((item) => (
            <Button
              key={item.key}
              type="button"
              variant={filter === item.key ? 'default' : 'outline'}
              className={filter === item.key ? 'bg-blue-600 hover:bg-blue-700' : 'bg-transparent border-white/20 text-white hover:bg-white/10'}
              onClick={() => setFilter(item.key)}
            >
              {item.label}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="min-h-[280px] flex items-center justify-center">
            <div className="text-center">
              <LoadingSpinner size="lg" />
              <p className="text-white/70 mt-4">Cargando incidencias...</p>
            </div>
          </div>
        ) : tickets.length === 0 ? (
          <Card className="bg-white/5 backdrop-blur-xl border border-white/10">
            <CardContent className="py-14 text-center">
              <AlertCircle className="w-10 h-10 text-white/50 mx-auto mb-3" />
              <p className="text-white">No hay incidencias para este filtro.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {tickets.map((ticket) => {
              const isResolving = resolveTicketMutation.isPending && resolveTicketMutation.variables?.id === ticket.id;
              const isOpen = ticket.status === 'open';
              const attachmentCount = Array.isArray(ticket.attachments) ? ticket.attachments.length : 0;

              return (
                <Card key={ticket.id} className="bg-white/5 backdrop-blur-xl border border-white/10">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                      <div>
                        <CardTitle className="text-white text-lg">#{ticket.id} - {ticket.subject}</CardTitle>
                        <p className="text-sm text-white/70 mt-1">
                          {ticket.companyName || 'Empresa no especificada'} · {ticket.userName} · {ticket.userEmail}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={isOpen ? 'bg-amber-500/20 text-amber-200 border border-amber-400/30' : 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30'}>
                          {isOpen ? 'Abierta' : 'Resuelta'}
                        </Badge>
                        {attachmentCount > 0 && (
                          <Badge variant="outline" className="border-white/20 text-white/80">
                            {attachmentCount} adjunto{attachmentCount === 1 ? '' : 's'}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-black/20 border border-white/10 rounded-lg p-3">
                      <p className="text-white/90 text-sm whitespace-pre-wrap">{ticket.message}</p>
                    </div>

                    <div className="text-xs text-white/60 flex flex-wrap gap-x-4 gap-y-1">
                      <span>Creada: {formatDate(ticket.createdAt)}</span>
                      {ticket.resolvedAt && <span>Resuelta: {formatDate(ticket.resolvedAt)}</span>}
                      {ticket.resolvedBy && <span>Por: {ticket.resolvedBy}</span>}
                    </div>

                    {isOpen ? (
                      <div className="space-y-3 border-t border-white/10 pt-4">
                        <Textarea
                          value={commentByTicket[ticket.id] || ''}
                          onChange={(event) => {
                            setCommentByTicket((prev) => ({
                              ...prev,
                              [ticket.id]: event.target.value,
                            }));
                          }}
                          placeholder="Comentario opcional para el cliente..."
                          className="min-h-[90px] bg-black/20 border-white/15 text-white placeholder:text-white/50"
                        />
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => handleResolve(ticket.id)}
                            disabled={isResolving}
                          >
                            <Send className="w-4 h-4 mr-2" />
                            {isResolving ? 'Resolviendo...' : 'Marcar como resuelta y enviar email'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="border-t border-white/10 pt-4">
                        <p className="text-sm text-white/80">
                          <strong>Comentario enviado:</strong>{' '}
                          {ticket.resolutionComment?.trim() ? ticket.resolutionComment : 'Sin comentario adicional.'}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
}
