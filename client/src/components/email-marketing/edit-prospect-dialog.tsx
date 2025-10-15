import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Mail, Eye, MousePointerClick, UserCheck, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface EditProspectDialogProps {
  prospect: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditProspectDialog({ prospect, open, onOpenChange }: EditProspectDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    email: '',
    name: '',
    company: '',
    phone: '',
    location: '',
    tags: '',
    notes: '',
  });

  // Get campaign history for this prospect
  const { data: campaignHistory } = useQuery({
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

  useEffect(() => {
    if (prospect) {
      setFormData({
        email: prospect.email || '',
        name: prospect.name || '',
        company: prospect.company || '',
        phone: prospect.phone || '',
        location: prospect.location || '',
        tags: Array.isArray(prospect.tags) ? prospect.tags.join(', ') : '',
        notes: prospect.notes || '',
      });
    }
  }, [prospect]);

  const updateProspectMutation = useMutation({
    mutationFn: async (data: any) => {
      const token = localStorage.getItem('superAdminToken');
      const prospectData = {
        ...data,
        tags: data.tags ? data.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
      };
      
      const response = await fetch(`/api/super-admin/email-prospects/${prospect.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(prospectData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update prospect');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Prospect actualizado',
        description: 'El contacto se actualizó correctamente',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/email-prospects'] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar el prospect',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProspectMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 border-white/20 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Editar Prospect</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="edit-email" className="text-white">Email *</Label>
            <Input
              id="edit-email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="contacto@empresa.com"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
              required
              data-testid="input-edit-prospect-email"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-name" className="text-white">Nombre</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Juan Pérez"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                data-testid="input-edit-prospect-name"
              />
            </div>
            <div>
              <Label htmlFor="edit-company" className="text-white">Empresa</Label>
              <Input
                id="edit-company"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                placeholder="Mi Empresa S.L."
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                data-testid="input-edit-prospect-company"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-phone" className="text-white">Teléfono</Label>
              <Input
                id="edit-phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+34 600 000 000"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                data-testid="input-edit-prospect-phone"
              />
            </div>
            <div>
              <Label htmlFor="edit-location" className="text-white">Localización</Label>
              <Input
                id="edit-location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Madrid, Barcelona, Valencia..."
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                data-testid="input-edit-prospect-location"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="edit-tags" className="text-white">Tags (separadas por comas)</Label>
            <Input
              id="edit-tags"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder="lead, interesado, premium"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
              data-testid="input-edit-prospect-tags"
            />
          </div>

          <div>
            <Label htmlFor="edit-notes" className="text-white">Notas</Label>
            <Textarea
              id="edit-notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Información adicional sobre el contacto..."
              rows={3}
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
              data-testid="textarea-edit-prospect-notes"
            />
          </div>

          {/* Campaign History Section */}
          {campaignHistory && campaignHistory.campaigns.length > 0 && (
            <div className="border-t border-white/20 pt-4">
              <Label className="text-white mb-3 block">Historial de Campañas</Label>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {campaignHistory.campaigns.map((campaign: any) => (
                  <div key={campaign.id} className="bg-white/5 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-white font-medium text-sm">{campaign.campaignName}</p>
                      {campaign.sentAt && (
                        <span className="text-xs text-white/60 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(campaign.sentAt), 'dd/MM/yyyy', { locale: es })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <div className={`flex items-center gap-1 ${campaign.sentAt ? 'text-blue-300' : 'text-white/40'}`}>
                        <Mail className="w-3 h-3" />
                        Enviado
                      </div>
                      <div className={`flex items-center gap-1 ${campaign.openedAt ? 'text-purple-300' : 'text-white/40'}`}>
                        <Eye className="w-3 h-3" />
                        Abierto
                      </div>
                      <div className={`flex items-center gap-1 ${campaign.clickedAt ? 'text-indigo-300' : 'text-white/40'}`}>
                        <MousePointerClick className="w-3 h-3" />
                        Click
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Registration Status */}
              {campaignHistory.registration && (
                <div className="mt-3 bg-green-500/20 border border-green-400/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-green-300">
                    <UserCheck className="w-4 h-4" />
                    <span className="text-sm font-medium">Registrado como: {campaignHistory.registration.companyName}</span>
                  </div>
                  <p className="text-xs text-green-200/70 mt-1">
                    {format(new Date(campaignHistory.registration.registeredAt), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-white/20 text-white hover:bg-white/10">
              Cancelar
            </Button>
            <Button type="submit" disabled={updateProspectMutation.isPending} className="bg-purple-600 hover:bg-purple-700" data-testid="button-submit-edit-prospect">
              {updateProspectMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
