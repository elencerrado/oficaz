import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { 
  Mail, 
  Eye, 
  MousePointerClick, 
  UserCheck, 
  Calendar, 
  Building2, 
  User, 
  Phone, 
  MapPin, 
  Tag, 
  StickyNote,
  MessageCircle,
  X
} from 'lucide-react';
import { FaWhatsapp, FaInstagram } from 'react-icons/fa';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface FullScreenProspectDialogProps {
  prospect: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FullScreenProspectDialog({ prospect, open, onOpenChange }: FullScreenProspectDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    email: '',
    name: '',
    company: '',
    phone: '',
    location: '',
    tags: [] as string[],
    notes: '',
    whatsappContacted: false,
    whatsappConversationStatus: 'not_contacted',
    instagramContacted: false,
    instagramConversationStatus: 'not_contacted',
  });

  const [tagInput, setTagInput] = useState('');

  // Get all existing tags
  const { data: allProspects } = useQuery({
    queryKey: ['/api/super-admin/email-prospects'],
  });

  const allTags = Array.from(
    new Set(
      (allProspects || [])
        .flatMap((p: any) => p.tags || [])
        .filter(Boolean)
    )
  ) as string[];

  // Get campaign history for this prospect
  const { data: campaignHistory } = useQuery({
    queryKey: ['/api/super-admin/email-prospects', prospect?.id, 'campaign-history'],
    queryFn: async () => {
      const token = sessionStorage.getItem('superAdminToken');
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
        tags: Array.isArray(prospect.tags) ? prospect.tags : [],
        notes: prospect.notes || '',
        whatsappContacted: prospect.whatsappContacted || false,
        whatsappConversationStatus: prospect.whatsappConversationStatus || 'not_contacted',
        instagramContacted: prospect.instagramContacted || false,
        instagramConversationStatus: prospect.instagramConversationStatus || 'not_contacted',
      });
    }
  }, [prospect]);

  const updateProspectMutation = useMutation({
    mutationFn: async (data: any) => {
      const token = sessionStorage.getItem('superAdminToken');
      
      const response = await fetch(`/api/super-admin/email-prospects/${prospect.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
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

  const addTag = (tag: string) => {
    if (tag && !formData.tags.includes(tag)) {
      setFormData({ ...formData, tags: [...formData.tags, tag] });
    }
    setTagInput('');
  };

  const removeTag = (tagToRemove: string) => {
    setFormData({ ...formData, tags: formData.tags.filter(t => t !== tagToRemove) });
  };

  const getTagColor = (tag: string) => {
    const colors = [
      { bg: 'bg-purple-500/20', text: 'text-purple-200' },
      { bg: 'bg-blue-500/20', text: 'text-blue-200' },
      { bg: 'bg-green-500/20', text: 'text-green-200' },
      { bg: 'bg-yellow-500/20', text: 'text-yellow-200' },
      { bg: 'bg-pink-500/20', text: 'text-pink-200' },
      { bg: 'bg-indigo-500/20', text: 'text-indigo-200' },
      { bg: 'bg-red-500/20', text: 'text-red-200' },
      { bg: 'bg-orange-500/20', text: 'text-orange-200' },
      { bg: 'bg-teal-500/20', text: 'text-teal-200' },
      { bg: 'bg-cyan-500/20', text: 'text-cyan-200' },
      { bg: 'bg-emerald-500/20', text: 'text-emerald-200' },
      { bg: 'bg-violet-500/20', text: 'text-violet-200' },
    ];
    
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const hasWhatsApp = formData.phone && !formData.phone.trim().startsWith('9');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 border-white/20 text-white overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl text-white flex items-center gap-2">
            <Building2 className="w-6 h-6" />
            Editar Prospect - {formData.company || formData.name || formData.email}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* DATOS BÁSICOS */}
          <div className="bg-white/5 rounded-lg p-6 space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <User className="w-5 h-5" />
              Datos Básicos
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="fs-email" className="text-white flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email *
                </Label>
                <Input
                  id="fs-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="contacto@empresa.com"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50 h-11"
                  required
                  data-testid="input-fullscreen-email"
                />
              </div>
              
              <div>
                <Label htmlFor="fs-name" className="text-white flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Nombre de Contacto
                </Label>
                <Input
                  id="fs-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Juan Pérez"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50 h-11"
                  data-testid="input-fullscreen-name"
                />
              </div>
              
              <div>
                <Label htmlFor="fs-company" className="text-white flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Nombre de Empresa
                </Label>
                <Input
                  id="fs-company"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  placeholder="Mi Empresa S.L."
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50 h-11"
                  data-testid="input-fullscreen-company"
                />
              </div>
            </div>
          </div>

          {/* INFORMACIÓN DE CONTACTO */}
          <div className="bg-white/5 rounded-lg p-6 space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <MessageCircle className="w-5 h-5" />
              Información de Contacto
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Teléfono y Localización */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="fs-phone" className="text-white flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Teléfono
                  </Label>
                  <Input
                    id="fs-phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+34 600 000 000"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/50 h-11"
                    data-testid="input-fullscreen-phone"
                  />
                  {formData.phone && formData.phone.trim().startsWith('9') && (
                    <p className="text-xs text-yellow-300 mt-1">⚠️ Teléfono fijo detectado - Sin WhatsApp</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="fs-location" className="text-white flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Localización
                  </Label>
                  <Input
                    id="fs-location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Madrid, Barcelona, Valencia..."
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/50 h-11"
                    data-testid="input-fullscreen-location"
                  />
                </div>
              </div>
              
              {/* Estados de conversación */}
              <div className="space-y-4">
                {/* WhatsApp */}
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <FaWhatsapp className={`w-5 h-5 ${hasWhatsApp ? 'text-green-400' : 'text-white/30'}`} />
                    <Label className="text-white text-base">WhatsApp</Label>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, whatsappContacted: !formData.whatsappContacted })}
                        disabled={!hasWhatsApp}
                        className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                          formData.whatsappContacted 
                            ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30' 
                            : 'bg-white/10 text-white/60 hover:bg-white/15'
                        } ${!hasWhatsApp ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        {formData.whatsappContacted ? '✓ Contactado' : 'No contactado'}
                      </button>
                      
                      {hasWhatsApp && (
                        <Button
                          type="button"
                          onClick={() => window.open(`https://wa.me/${formData.phone.replace(/\s+/g, '')}`, '_blank')}
                          className="bg-green-600 hover:bg-green-700 text-white"
                          size="sm"
                        >
                          Abrir WhatsApp
                        </Button>
                      )}
                    </div>
                    
                    <div>
                      <Label className="text-white/80 text-sm mb-2 block">Estado de conversación</Label>
                      <select
                        value={formData.whatsappConversationStatus}
                        onChange={(e) => setFormData({ ...formData, whatsappConversationStatus: e.target.value })}
                        disabled={!hasWhatsApp}
                        className={`w-full px-3 py-2 rounded border-0 ${
                          formData.whatsappConversationStatus === 'in_conversation' ? 'bg-green-500/20 text-green-300' :
                          formData.whatsappConversationStatus === 'no_response' ? 'bg-yellow-500/20 text-yellow-300' :
                          formData.whatsappConversationStatus === 'not_interested' ? 'bg-red-500/20 text-red-300' :
                          formData.whatsappConversationStatus === 'closed' ? 'bg-gray-500/20 text-gray-300' :
                          'bg-white/10 text-white/60'
                        } ${!hasWhatsApp ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <option value="not_contacted" className="bg-gray-800">Sin hablar</option>
                        <option value="no_response" className="bg-gray-800">Sin respuesta</option>
                        <option value="in_conversation" className="bg-gray-800">Hablando</option>
                        <option value="not_interested" className="bg-gray-800">No interesado</option>
                        <option value="closed" className="bg-gray-800">Cerrado</option>
                      </select>
                    </div>
                  </div>
                </div>
                
                {/* Instagram */}
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <FaInstagram className="w-5 h-5 text-pink-400" />
                    <Label className="text-white text-base">Instagram</Label>
                  </div>
                  
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, instagramContacted: !formData.instagramContacted })}
                      className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                        formData.instagramContacted 
                          ? 'bg-pink-500/20 text-pink-300 hover:bg-pink-500/30' 
                          : 'bg-white/10 text-white/60 hover:bg-white/15'
                      }`}
                    >
                      {formData.instagramContacted ? '✓ Contactado' : 'No contactado'}
                    </button>
                    
                    <div>
                      <Label className="text-white/80 text-sm mb-2 block">Estado de conversación</Label>
                      <select
                        value={formData.instagramConversationStatus}
                        onChange={(e) => setFormData({ ...formData, instagramConversationStatus: e.target.value })}
                        className={`w-full px-3 py-2 rounded border-0 ${
                          formData.instagramConversationStatus === 'in_conversation' ? 'bg-green-500/20 text-green-300' :
                          formData.instagramConversationStatus === 'no_response' ? 'bg-yellow-500/20 text-yellow-300' :
                          formData.instagramConversationStatus === 'not_interested' ? 'bg-red-500/20 text-red-300' :
                          formData.instagramConversationStatus === 'closed' ? 'bg-gray-500/20 text-gray-300' :
                          'bg-white/10 text-white/60'
                        }`}
                      >
                        <option value="not_contacted" className="bg-gray-800">Sin hablar</option>
                        <option value="no_response" className="bg-gray-800">Sin respuesta</option>
                        <option value="in_conversation" className="bg-gray-800">Hablando</option>
                        <option value="not_interested" className="bg-gray-800">No interesado</option>
                        <option value="closed" className="bg-gray-800">Cerrado</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* TAGS */}
          <div className="bg-white/5 rounded-lg p-6 space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <Tag className="w-5 h-5" />
              Tags y Categorías
            </h3>
            
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 min-h-[40px] bg-white/5 rounded-lg p-3">
                {formData.tags.map((tag) => {
                  const tagColor = getTagColor(tag);
                  return (
                    <span key={tag} className={`inline-flex items-center gap-2 px-3 py-1.5 ${tagColor.bg} ${tagColor.text} text-sm rounded-full`}>
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="hover:opacity-80"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
                {formData.tags.length === 0 && (
                  <span className="text-white/40 text-sm italic">Sin tags añadidos</span>
                )}
              </div>
              
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (tagInput.trim()) {
                          addTag(tagInput.trim());
                        }
                      }
                    }}
                    placeholder="Escribe un tag y presiona Enter..."
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/50 h-11"
                  />
                  
                  {/* Tag suggestions dropdown */}
                  {tagInput && allTags.filter(tag => 
                    tag.toLowerCase().includes(tagInput.toLowerCase()) && 
                    !formData.tags.includes(tag)
                  ).length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-white/20 rounded shadow-lg z-50 max-h-48 overflow-y-auto">
                      {allTags
                        .filter(tag => tag.toLowerCase().includes(tagInput.toLowerCase()) && !formData.tags.includes(tag))
                        .map(tag => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => addTag(tag)}
                            className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors"
                          >
                            {tag}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
                
                <Button
                  type="button"
                  onClick={() => {
                    if (tagInput.trim()) {
                      addTag(tagInput.trim());
                    }
                  }}
                  disabled={!tagInput.trim()}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Añadir Tag
                </Button>
              </div>
              
              {/* Sugerencias de tags comunes */}
              {allTags.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs text-white/60 mb-2">Tags existentes (click para añadir):</p>
                  <div className="flex flex-wrap gap-2">
                    {allTags.filter(tag => !formData.tags.includes(tag)).slice(0, 10).map((tag) => {
                      const tagColor = getTagColor(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => addTag(tag)}
                          className={`px-2 py-1 ${tagColor.bg} ${tagColor.text} text-xs rounded hover:opacity-80 transition-opacity`}
                        >
                          + {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* NOTAS */}
          <div className="bg-white/5 rounded-lg p-6 space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <StickyNote className="w-5 h-5" />
              Notas Internas
            </h3>
            
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Información adicional sobre el contacto, conversaciones previas, intereses específicos..."
              rows={6}
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50 resize-none"
              data-testid="textarea-fullscreen-notes"
            />
          </div>

          {/* HISTORIAL DE CAMPAÑAS */}
          {campaignHistory && campaignHistory.campaigns.length > 0 && (
            <div className="bg-white/5 rounded-lg p-6 space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <Mail className="w-5 h-5" />
                Historial de Campañas ({campaignHistory.campaigns.length})
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto">
                {campaignHistory.campaigns.map((campaign: any) => (
                  <div key={campaign.id} className="bg-white/5 rounded-lg p-4 space-y-2 border border-white/10">
                    <div className="flex items-center justify-between">
                      <p className="text-white font-medium">{campaign.campaignName}</p>
                      {campaign.sentAt && (
                        <span className="text-xs text-white/60 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(campaign.sentAt), 'dd/MM/yyyy', { locale: es })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs">
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
                <div className="bg-green-500/20 border border-green-400/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-300">
                    <UserCheck className="w-5 h-5" />
                    <span className="font-medium">Registrado como: {campaignHistory.registration.companyName}</span>
                  </div>
                  <p className="text-sm text-green-200/70 mt-1">
                    {format(new Date(campaignHistory.registration.registeredAt), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ACCIONES */}
          <div className="flex justify-end gap-3 pt-4 border-t border-white/20">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)} 
              className="border-white/20 text-white hover:bg-white/10 px-6"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={updateProspectMutation.isPending} 
              className="bg-purple-600 hover:bg-purple-700 px-8"
              data-testid="button-submit-fullscreen-prospect"
            >
              {updateProspectMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
