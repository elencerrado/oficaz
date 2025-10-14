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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Nueva Campaña de Email</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nombre de la Campaña</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Newsletter Septiembre 2024"
              required
            />
          </div>

          <div>
            <Label htmlFor="subject">Asunto del Email</Label>
            <Input
              id="subject"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="Ej: Novedades de Oficaz - Septiembre"
              required
            />
          </div>

          <div>
            <Label htmlFor="preheader">Preheader (texto preview)</Label>
            <Input
              id="preheader"
              value={formData.preheader}
              onChange={(e) => setFormData({ ...formData, preheader: e.target.value })}
              placeholder="Texto que aparece junto al asunto en el inbox"
            />
          </div>

          <div>
            <Label htmlFor="htmlContent">Contenido del Email (HTML)</Label>
            <Textarea
              id="htmlContent"
              value={formData.htmlContent}
              onChange={(e) => setFormData({ ...formData, htmlContent: e.target.value })}
              placeholder="<h1>¡Hola!</h1><p>Contenido del email...</p>"
              rows={8}
              required
            />
          </div>

          <div className="space-y-3">
            <Label>Destinatarios - Usuarios Registrados</Label>
            <div className="space-y-2 border rounded-lg p-4 bg-gray-50">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="active"
                  checked={formData.includeActiveSubscriptions}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, includeActiveSubscriptions: checked as boolean })
                  }
                />
                <label htmlFor="active" className="text-sm cursor-pointer">
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
                />
                <label htmlFor="trial" className="text-sm cursor-pointer">
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
                />
                <label htmlFor="blocked" className="text-sm cursor-pointer">
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
                />
                <label htmlFor="cancelled" className="text-sm cursor-pointer">
                  Canceladas
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Prospects Externos</Label>
            <div className="flex items-center space-x-2 border rounded-lg p-4 bg-gray-50">
              <Checkbox
                id="prospects"
                checked={formData.includeProspects}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, includeProspects: checked as boolean })
                }
              />
              <label htmlFor="prospects" className="text-sm cursor-pointer">
                Incluir Prospects Externos
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createCampaignMutation.isPending}>
              {createCampaignMutation.isPending ? 'Creando...' : 'Crear Campaña'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
