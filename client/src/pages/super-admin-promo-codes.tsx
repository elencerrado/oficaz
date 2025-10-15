import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { getAuthHeaders } from '@/lib/auth';
import { apiRequest } from '@/lib/queryClient';
import { 
  Tag, 
  Plus, 
  Edit2, 
  Trash2, 
  Calendar, 
  Users, 
  Activity,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useLocation } from 'wouter';
import { SuperAdminLayout } from '@/components/layout/super-admin-layout';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface PromotionalCode {
  id: number;
  code: string;
  description: string;
  trialDurationDays: number;
  isActive: boolean;
  maxUses: number | null;
  currentUses: number;
  validFrom: string | null;
  validUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CreatePromotionalCodeData {
  code: string;
  description: string;
  trialDurationDays: number;
  isActive: boolean;
  maxUses: number | null;
  validFrom: string | null;
  validUntil: string | null;
}

const SuperAdminPromoCodes = () => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<PromotionalCode | null>(null);
  
  const [formData, setFormData] = useState<CreatePromotionalCodeData>({
    code: '',
    description: '',
    trialDurationDays: 60,
    isActive: true,
    maxUses: null,
    validFrom: null,
    validUntil: null
  });

  // Fetch promotional codes
  const { data: promoCodes = [], isLoading } = useQuery({
    queryKey: ['/api/super-admin/promotional-codes'],
    queryFn: async () => {
      const response = await fetch('/api/super-admin/promotional-codes', {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch promotional codes');
      return response.json();
    }
  });

  // Create promotional code mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreatePromotionalCodeData) => {
      const response = await fetch('/api/super-admin/promotional-codes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al crear el código promocional');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/promotional-codes'] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({
        title: "Código promocional creado",
        description: "El código se ha creado correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al crear el código promocional",
        variant: "destructive"
      });
    }
  });

  // Update promotional code mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<CreatePromotionalCodeData> }) => {
      const response = await fetch(`/api/super-admin/promotional-codes/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al actualizar el código promocional');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/promotional-codes'] });
      setIsEditDialogOpen(false);
      setEditingCode(null);
      toast({
        title: "Código actualizado",
        description: "El código se ha actualizado correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al actualizar el código promocional",
        variant: "destructive"
      });
    }
  });

  // Delete promotional code mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/super-admin/promotional-codes/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al eliminar el código promocional');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/promotional-codes'] });
      toast({
        title: "Código eliminado",
        description: "El código se ha eliminado correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al eliminar el código promocional",
        variant: "destructive"
      });
    }
  });

  const resetForm = () => {
    setFormData({
      code: '',
      description: '',
      trialDurationDays: 60,
      isActive: true,
      maxUses: null,
      validFrom: null,
      validUntil: null
    });
  };

  const handleEdit = (code: PromotionalCode) => {
    setEditingCode(code);
    setFormData({
      code: code.code,
      description: code.description,
      trialDurationDays: code.trialDurationDays,
      isActive: code.isActive,
      maxUses: code.maxUses,
      validFrom: code.validFrom ? code.validFrom.split('T')[0] : null,
      validUntil: code.validUntil ? code.validUntil.split('T')[0] : null
    });
    setIsEditDialogOpen(true);
  };

  const handleCreate = () => {
    createMutation.mutate(formData);
  };

  const handleUpdate = () => {
    if (!editingCode) return;
    updateMutation.mutate({ id: editingCode.id, data: formData });
  };

  const handleDelete = (id: number) => {
    if (confirm('¿Estás seguro de que quieres eliminar este código promocional?')) {
      deleteMutation.mutate(id);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Sin límite';
    return new Date(dateString).toLocaleDateString('es-ES');
  };

  return (
    <SuperAdminLayout>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-white">Códigos Promocionales</h1>
          <p className="text-white/70 mt-1">Gestiona los códigos promocionales y sus beneficios</p>
        </div>

      {/* Create Button */}
      <div className="mb-6">
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-promo-code">
              <Plus className="h-4 w-4 mr-2" />
              Crear Código Promocional
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Crear Código Promocional</DialogTitle>
              <DialogDescription>
                Crea un nuevo código promocional para extender períodos de prueba
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Código</label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="OFICAZ60"
                  data-testid="input-code"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Descripción</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Código promocional para 2 meses de prueba gratuita"
                  data-testid="input-description"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Días de prueba</label>
                <Input
                  type="number"
                  value={formData.trialDurationDays}
                  onChange={(e) => setFormData({ ...formData, trialDurationDays: parseInt(e.target.value) || 60 })}
                  min="1"
                  data-testid="input-trial-days"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Usos máximos (opcional)</label>
                <Input
                  type="number"
                  value={formData.maxUses || ''}
                  onChange={(e) => setFormData({ ...formData, maxUses: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="Ilimitado"
                  min="1"
                  data-testid="input-max-uses"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Válido desde</label>
                  <Input
                    type="date"
                    value={formData.validFrom || ''}
                    onChange={(e) => setFormData({ ...formData, validFrom: e.target.value || null })}
                    data-testid="input-valid-from"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Válido hasta</label>
                  <Input
                    type="date"
                    value={formData.validUntil || ''}
                    onChange={(e) => setFormData({ ...formData, validUntil: e.target.value || null })}
                    data-testid="input-valid-until"
                  />
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  data-testid="switch-active"
                />
                <label className="text-sm font-medium">Código activo</label>
              </div>
            </div>
            
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsCreateDialogOpen(false)}
                data-testid="button-cancel-create"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleCreate}
                disabled={createMutation.isPending || !formData.code}
                data-testid="button-confirm-create"
              >
                {createMutation.isPending ? 'Creando...' : 'Crear Código'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Promotional Codes List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="text-white/60">Cargando códigos promocionales...</div>
          </div>
        ) : promoCodes.length === 0 ? (
          <Card className="bg-white/10 backdrop-blur-xl border-white/20">
            <CardContent className="py-8 text-center">
              <Tag className="h-12 w-12 text-white/40 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No hay códigos promocionales</h3>
              <p className="text-white/60 mb-4">Crea tu primer código promocional para empezar</p>
            </CardContent>
          </Card>
        ) : (
          promoCodes.map((code: PromotionalCode) => (
            <Card key={code.id} className="bg-white/10 backdrop-blur-xl border-white/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-500/20 p-2 rounded-lg border border-blue-400/30">
                      <Tag className="h-5 w-5 text-blue-300" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-white">{code.code}</CardTitle>
                      <CardDescription className="text-white/60">{code.description}</CardDescription>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={code.isActive ? "default" : "secondary"}
                      className={`flex items-center gap-1 ${
                        code.isActive 
                          ? 'bg-green-500/20 text-green-200 border-green-400/30' 
                          : 'bg-gray-500/20 text-gray-300 border-gray-400/30'
                      }`}
                    >
                      {code.isActive ? (
                        <CheckCircle className="h-3 w-3" />
                      ) : (
                        <XCircle className="h-3 w-3" />
                      )}
                      {code.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(code)}
                      className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                      data-testid={`button-edit-${code.id}`}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(code.id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      data-testid={`button-delete-${code.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-white/40" />
                    <div>
                      <div className="font-medium text-white">{code.trialDurationDays} días</div>
                      <div className="text-white/60">Período de prueba</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-white/40" />
                    <div>
                      <div className="font-medium text-white">
                        {code.currentUses}{code.maxUses ? `/${code.maxUses}` : ''}
                      </div>
                      <div className="text-white/60">Usos</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-white/40" />
                    <div>
                      <div className="font-medium text-white">{formatDate(code.validFrom)}</div>
                      <div className="text-white/60">Válido desde</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-white/40" />
                    <div>
                      <div className="font-medium text-white">{formatDate(code.validUntil)}</div>
                      <div className="text-white/60">Válido hasta</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Código Promocional</DialogTitle>
            <DialogDescription>
              Modifica los detalles del código promocional
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Código</label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="OFICAZ60"
                data-testid="input-edit-code"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Descripción</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Código promocional para 2 meses de prueba gratuita"
                data-testid="input-edit-description"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Días de prueba</label>
              <Input
                type="number"
                value={formData.trialDurationDays}
                onChange={(e) => setFormData({ ...formData, trialDurationDays: parseInt(e.target.value) || 60 })}
                min="1"
                data-testid="input-edit-trial-days"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Usos máximos (opcional)</label>
              <Input
                type="number"
                value={formData.maxUses || ''}
                onChange={(e) => setFormData({ ...formData, maxUses: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="Ilimitado"
                min="1"
                data-testid="input-edit-max-uses"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Válido desde</label>
                <Input
                  type="date"
                  value={formData.validFrom || ''}
                  onChange={(e) => setFormData({ ...formData, validFrom: e.target.value || null })}
                  data-testid="input-edit-valid-from"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Válido hasta</label>
                <Input
                  type="date"
                  value={formData.validUntil || ''}
                  onChange={(e) => setFormData({ ...formData, validUntil: e.target.value || null })}
                  data-testid="input-edit-valid-until"
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                data-testid="switch-edit-active"
              />
              <label className="text-sm font-medium">Código activo</label>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsEditDialogOpen(false)}
              data-testid="button-cancel-edit"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleUpdate}
              disabled={updateMutation.isPending || !formData.code}
              data-testid="button-confirm-edit"
            >
              {updateMutation.isPending ? 'Actualizando...' : 'Actualizar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </SuperAdminLayout>
  );
};

export default SuperAdminPromoCodes;