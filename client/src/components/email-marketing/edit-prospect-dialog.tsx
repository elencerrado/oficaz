import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

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
