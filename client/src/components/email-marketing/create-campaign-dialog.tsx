import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Plus } from 'lucide-react';

export function CreateCampaignDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    preheader: '',
    htmlContent: '',
    targetAudience: 'registered_users' as string,
    includeActiveSubscriptions: true,
    includeTrialSubscriptions: true,
    includeBlockedSubscriptions: false,
    includeCancelledSubscriptions: false,
    includeProspects: false,
  });

  const createCampaignMutation = useMutation({
    mutationFn: async (data: any) => {
      const token = localStorage.getItem('superAdminToken');
      const response = await fetch('/api/super-admin/email-campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create campaign');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Campaña creada',
        description: 'La campaña se ha creado correctamente',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/email-campaigns'] });
      setOpen(false);
      setFormData({
        name: '',
        subject: '',
        preheader: '',
        htmlContent: '',
        targetAudience: 'registered_users',
        includeActiveSubscriptions: true,
        includeTrialSubscriptions: true,
        includeBlockedSubscriptions: false,
        includeCancelledSubscriptions: false,
        includeProspects: false,
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo crear la campaña',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createCampaignMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-blue-600 hover:bg-blue-700" data-testid="button-create-campaign">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Campaña
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 border-white/20 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Crear Nueva Campaña de Email</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name" className="text-white">Nombre de la Campaña</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Newsletter Septiembre 2024"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
              required
            />
          </div>

          <div>
            <Label htmlFor="subject" className="text-white">Asunto del Email</Label>
            <Input
              id="subject"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="Ej: Novedades de Oficaz - Septiembre"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
              required
            />
          </div>

          <div>
            <Label htmlFor="preheader" className="text-white">Preheader (texto preview)</Label>
            <Input
              id="preheader"
              value={formData.preheader}
              onChange={(e) => setFormData({ ...formData, preheader: e.target.value })}
              placeholder="Texto que aparece junto al asunto en el inbox"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
            />
          </div>

          <div>
            <Label htmlFor="htmlContent" className="text-white">Contenido del Email (HTML)</Label>
            <Textarea
              id="htmlContent"
              value={formData.htmlContent}
              onChange={(e) => setFormData({ ...formData, htmlContent: e.target.value })}
              placeholder="<h1>¡Hola!</h1><p>Contenido del email...</p>"
              rows={8}
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
              required
            />
          </div>

          <div className="space-y-3">
            <Label className="text-white">Destinatarios - Usuarios Registrados</Label>
            <div className="space-y-2 border border-white/20 rounded-lg p-4 bg-white/5">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="active"
                  checked={formData.includeActiveSubscriptions}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, includeActiveSubscriptions: checked as boolean })
                  }
                  className="border-white/30 data-[state=checked]:bg-blue-600"
                />
                <label htmlFor="active" className="text-sm cursor-pointer text-white">
                  Suscripciones Activas
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="trial"
                  checked={formData.includeTrialSubscriptions}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, includeTrialSubscriptions: checked as boolean })
                  }
                  className="border-white/30 data-[state=checked]:bg-blue-600"
                />
                <label htmlFor="trial" className="text-sm cursor-pointer text-white">
                  En Período de Prueba
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="blocked"
                  checked={formData.includeBlockedSubscriptions}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, includeBlockedSubscriptions: checked as boolean })
                  }
                  className="border-white/30 data-[state=checked]:bg-blue-600"
                />
                <label htmlFor="blocked" className="text-sm cursor-pointer text-white">
                  Bloqueadas
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="cancelled"
                  checked={formData.includeCancelledSubscriptions}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, includeCancelledSubscriptions: checked as boolean })
                  }
                  className="border-white/30 data-[state=checked]:bg-blue-600"
                />
                <label htmlFor="cancelled" className="text-sm cursor-pointer text-white">
                  Canceladas
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-white">Prospects Externos</Label>
            <div className="flex items-center space-x-2 border border-white/20 rounded-lg p-4 bg-white/5">
              <Checkbox
                id="prospects"
                checked={formData.includeProspects}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, includeProspects: checked as boolean })
                }
                className="border-white/30 data-[state=checked]:bg-blue-600"
              />
              <label htmlFor="prospects" className="text-sm cursor-pointer text-white">
                Incluir Prospects Externos
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-white/20 text-white hover:bg-white/10">
              Cancelar
            </Button>
            <Button type="submit" disabled={createCampaignMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
              {createCampaignMutation.isPending ? 'Creando...' : 'Crear Campaña'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
