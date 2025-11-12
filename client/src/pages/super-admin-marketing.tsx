import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePageTitle } from '@/hooks/use-page-title';
import { SuperAdminLayout } from '@/components/layout/super-admin-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreateCampaignDialog } from '@/components/email-marketing/create-campaign-dialog';
import { AddProspectDialog } from '@/components/email-marketing/add-prospect-dialog';
import { EditProspectDialog } from '@/components/email-marketing/edit-prospect-dialog';
import { FullScreenProspectDialog } from '@/components/email-marketing/fullscreen-prospect-dialog';
import { EditCampaignDialog } from '@/components/email-marketing/edit-campaign-dialog';
import { CampaignConversionsDialog } from '@/components/email-marketing/campaign-conversions-dialog';
import { ProspectStatsDialog } from '@/components/email-marketing/prospect-stats-dialog';
import { SendingProgressDialog } from '@/components/email-marketing/sending-progress-dialog';
import { AiProspectDiscoveryDialog } from '@/components/email-marketing/ai-prospect-discovery-dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Send, 
  Users, 
  Mail, 
  BarChart3,
  Clock,
  CheckCircle,
  Eye,
  MousePointerClick,
  Trash2,
  Edit,
  Edit2,
  Copy,
  TrendingUp,
  Table2,
  LayoutList,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MessageCircle,
  Sparkles
} from 'lucide-react';
import { FaWhatsapp, FaInstagram } from 'react-icons/fa';

export default function SuperAdminMarketing() {
  usePageTitle('SuperAdmin - Marketing');
  const [activeTab, setActiveTab] = useState('campaigns');
  const [editingCampaign, setEditingCampaign] = useState<any>(null);
  const [conversionsCampaign, setConversionsCampaign] = useState<any>(null);
  const [editingProspect, setEditingProspect] = useState<any>(null);
  const [fullScreenEditingProspect, setFullScreenEditingProspect] = useState<any>(null);
  const [statsProspect, setStatsProspect] = useState<any>(null);
  const [isTableView, setIsTableView] = useState(true);
  const [editingCell, setEditingCell] = useState<{ id: number | string; field: string } | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [prospectToDelete, setProspectToDelete] = useState<number | null>(null);
  const [whatsappFilter, setWhatsappFilter] = useState<string>('all');
  const [instagramFilter, setInstagramFilter] = useState<string>('all');
  const [isAiDiscoveryOpen, setIsAiDiscoveryOpen] = useState(false);
  
  // Sending progress dialog states
  const [sendingProgress, setSendingProgress] = useState<{
    isOpen: boolean;
    status: 'preparing' | 'sending' | 'success' | 'error';
    totalEmails: number;
    successCount: number;
    failCount: number;
    errorMessage?: string;
  }>({
    isOpen: false,
    status: 'preparing',
    totalEmails: 0,
    successCount: 0,
    failCount: 0,
  });
  
  const { toast} = useToast();
  const queryClient = useQueryClient();

  const { data: campaigns } = useQuery({
    queryKey: ['/api/super-admin/email-campaigns'],
    queryFn: async () => {
      const token = sessionStorage.getItem('superAdminToken');
      const response = await fetch('/api/super-admin/email-campaigns', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch campaigns');
      return response.json();
    },
    staleTime: 30000,
    refetchOnMount: false,
  });

  const { data: prospects } = useQuery({
    queryKey: ['/api/super-admin/email-prospects'],
    queryFn: async () => {
      const token = sessionStorage.getItem('superAdminToken');
      const response = await fetch('/api/super-admin/email-prospects', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch prospects');
      return response.json();
    },
    staleTime: 30000,
    refetchOnMount: false,
  });

  const { data: registeredUsers } = useQuery({
    queryKey: ['/api/super-admin/registered-users-stats'],
    queryFn: async () => {
      const token = sessionStorage.getItem('superAdminToken');
      const response = await fetch('/api/super-admin/registered-users-stats', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch users stats');
      return response.json();
    },
    staleTime: 30000,
    refetchOnMount: false,
  });

  // Get all unique tags from all prospects
  const allTags = React.useMemo(() => {
    if (!prospects) return [];
    const tagsSet = new Set<string>();
    prospects.forEach((prospect: any) => {
      prospect.tags?.forEach((tag: string) => tagsSet.add(tag));
    });
    return Array.from(tagsSet).sort();
  }, [prospects]);

  // Filter and sort prospects
  const filteredProspects = React.useMemo(() => {
    if (!prospects) return [];
    
    let result = [...prospects];
    
    // Apply search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter((prospect: any) => {
        return (
          prospect.email?.toLowerCase().includes(term) ||
          prospect.name?.toLowerCase().includes(term) ||
          prospect.company?.toLowerCase().includes(term) ||
          prospect.phone?.toLowerCase().includes(term) ||
          prospect.location?.toLowerCase().includes(term) ||
          prospect.notes?.toLowerCase().includes(term) ||
          prospect.tags?.some((tag: string) => tag.toLowerCase().includes(term))
        );
      });
    }
    
    // Apply WhatsApp filter
    if (whatsappFilter !== 'all') {
      result = result.filter((prospect: any) => {
        return prospect.whatsappConversationStatus === whatsappFilter;
      });
    }
    
    // Apply Instagram filter
    if (instagramFilter !== 'all') {
      result = result.filter((prospect: any) => {
        return prospect.instagramConversationStatus === instagramFilter;
      });
    }
    
    // Apply sorting
    if (sortField) {
      result.sort((a: any, b: any) => {
        // Special handling for WhatsApp conversation status
        if (sortField === 'whatsappStatus') {
          const statusOrder = ['not_contacted', 'no_response', 'in_conversation', 'not_interested', 'closed'];
          const aStatus = a.whatsappConversationStatus || 'not_contacted';
          const bStatus = b.whatsappConversationStatus || 'not_contacted';
          const aIndex = statusOrder.indexOf(aStatus);
          const bIndex = statusOrder.indexOf(bStatus);
          
          if (sortDirection === 'asc') {
            return aIndex - bIndex;
          } else {
            return bIndex - aIndex;
          }
        }
        
        // Special handling for Instagram conversation status
        if (sortField === 'instagramStatus') {
          const statusOrder = ['not_contacted', 'no_response', 'in_conversation', 'not_interested', 'closed'];
          const aStatus = a.instagramConversationStatus || 'not_contacted';
          const bStatus = b.instagramConversationStatus || 'not_contacted';
          const aIndex = statusOrder.indexOf(aStatus);
          const bIndex = statusOrder.indexOf(bStatus);
          
          if (sortDirection === 'asc') {
            return aIndex - bIndex;
          } else {
            return bIndex - aIndex;
          }
        }
        
        // Special handling for Email status
        if (sortField === 'emailStatus') {
          const statusOrder = [null, 'pending', 'sent', 'opened', 'clicked', 'bounced'];
          const aStatus = a.lastEmailStatus;
          const bStatus = b.lastEmailStatus;
          const aIndex = statusOrder.indexOf(aStatus);
          const bIndex = statusOrder.indexOf(bStatus);
          
          if (sortDirection === 'asc') {
            return aIndex - bIndex;
          } else {
            return bIndex - aIndex;
          }
        }
        
        // Special handling for tags (array field)
        if (sortField === 'tags') {
          const aTagCount = (a.tags || []).length;
          const bTagCount = (b.tags || []).length;
          
          // Sort by number of tags first
          if (aTagCount !== bTagCount) {
            if (sortDirection === 'asc') {
              return aTagCount - bTagCount;
            } else {
              return bTagCount - aTagCount;
            }
          }
          
          // If same number of tags, sort alphabetically by first tag
          const aFirstTag = (a.tags && a.tags[0]) ? a.tags[0].toLowerCase() : '';
          const bFirstTag = (b.tags && b.tags[0]) ? b.tags[0].toLowerCase() : '';
          
          if (sortDirection === 'asc') {
            return aFirstTag > bFirstTag ? 1 : aFirstTag < bFirstTag ? -1 : 0;
          } else {
            return aFirstTag < bFirstTag ? 1 : aFirstTag > bFirstTag ? -1 : 0;
          }
        }
        
        // Standard sorting for other fields
        const aVal = a[sortField] || '';
        const bVal = b[sortField] || '';
        
        if (sortDirection === 'asc') {
          return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        } else {
          return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
        }
      });
    }
    
    return result;
  }, [prospects, searchTerm, whatsappFilter, instagramFilter, sortField, sortDirection]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Get consistent color for each tag based on its name
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
    
    // Simple hash function to get consistent color for each tag
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  // Send campaign mutation
  const sendCampaignMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      // Get campaign to show number of emails
      const campaign = campaigns?.find((c: any) => c.id === campaignId);
      const totalEmails = campaign?.selectedEmails?.length || 0;
      
      // Show preparing dialog
      setSendingProgress({
        isOpen: true,
        status: 'preparing',
        totalEmails,
        successCount: 0,
        failCount: 0,
      });
      
      // Small delay to show preparing state
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Update to sending state
      setSendingProgress(prev => ({
        ...prev,
        status: 'sending',
      }));
      
      const token = sessionStorage.getItem('superAdminToken');
      const response = await fetch(`/api/super-admin/email-campaigns/${campaignId}/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send campaign');
      }
      return response.json();
    },
    onSuccess: (data) => {
      // Update to success state with counts
      setSendingProgress(prev => ({
        ...prev,
        status: 'success',
        successCount: data.successCount || 0,
        failCount: data.failCount || 0,
      }));
      
      toast({
        title: 'Campaña enviada',
        description: data.message || 'La campaña se envió correctamente',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/email-campaigns'] });
    },
    onError: (error: any) => {
      // Update to error state
      setSendingProgress(prev => ({
        ...prev,
        status: 'error',
        errorMessage: error.message || 'Error al enviar la campaña',
      }));
      
      toast({
        title: 'Error',
        description: error.message || 'No se pudo enviar la campaña',
        variant: 'destructive',
      });
    },
  });

  // Duplicate campaign mutation
  const duplicateCampaignMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      const token = sessionStorage.getItem('superAdminToken');
      const response = await fetch(`/api/super-admin/email-campaigns/${campaignId}/duplicate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to duplicate campaign');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Campaña duplicada',
        description: 'La campaña se duplicó correctamente',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/email-campaigns'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo duplicar la campaña',
        variant: 'destructive',
      });
    },
  });

  // Delete prospect mutation
  const deleteProspectMutation = useMutation({
    mutationFn: async (prospectId: number) => {
      const token = sessionStorage.getItem('superAdminToken');
      const response = await fetch(`/api/super-admin/email-prospects/${prospectId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to delete prospect');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Prospect eliminado',
        description: 'El prospect se eliminó correctamente',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/email-prospects'] });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el prospect',
        variant: 'destructive',
      });
    },
  });

  // Update prospect inline mutation with optimistic updates
  const updateProspectInlineMutation = useMutation({
    mutationFn: async ({ prospectId, field, value }: { prospectId: number; field: string; value: any }) => {
      const token = sessionStorage.getItem('superAdminToken');
      const response = await fetch(`/api/super-admin/email-prospects/${prospectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ [field]: value }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update prospect');
      }
      return response.json();
    },
    onMutate: async ({ prospectId, field, value }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['/api/super-admin/email-prospects'] });
      
      // Snapshot previous value
      const previousProspects = queryClient.getQueryData(['/api/super-admin/email-prospects']);
      
      // Optimistically update to the new value
      queryClient.setQueryData(['/api/super-admin/email-prospects'], (old: any) => {
        if (!old) return old;
        return old.map((prospect: any) => 
          prospect.id === prospectId 
            ? { ...prospect, [field]: value }
            : prospect
        );
      });
      
      return { previousProspects };
    },
    onSuccess: () => {
      setEditingCell(null);
    },
    onError: (error: Error, variables, context: any) => {
      // Rollback to previous value on error
      if (context?.previousProspects) {
        queryClient.setQueryData(['/api/super-admin/email-prospects'], context.previousProspects);
      }
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar el prospect',
        variant: 'destructive',
      });
      setEditingCell(null);
    },
  });

  // Create prospect from empty row mutation
  const createProspectFromRowMutation = useMutation({
    mutationFn: async ({ field, value }: { field: string; value: any }) => {
      const token = sessionStorage.getItem('superAdminToken');
      const prospectData: any = { [field]: value };
      
      // If field is not email, we need a placeholder email
      if (field !== 'email') {
        prospectData.email = `temp-${Date.now()}@placeholder.com`;
      }
      
      const response = await fetch('/api/super-admin/email-prospects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(prospectData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create prospect');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/email-prospects'] });
      setEditingCell(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo crear el prospect',
        variant: 'destructive',
      });
      setEditingCell(null);
    },
  });

  // Handler functions
  const handleEditProspect = (prospect: any) => {
    setEditingProspect(prospect);
  };

  const handleDeleteProspect = (prospectId: number) => {
    setProspectToDelete(prospectId);
  };

  const confirmDeleteProspect = () => {
    if (prospectToDelete) {
      deleteProspectMutation.mutate(prospectToDelete);
      setProspectToDelete(null);
    }
  };

  // Calculate statistics
  const totalCampaigns = campaigns?.length || 0;
  const draftCampaigns = campaigns?.filter((c: any) => c.status === 'draft').length || 0;
  const sentCampaigns = campaigns?.filter((c: any) => c.status === 'sent').length || 0;
  const totalProspects = prospects?.length || 0;
  const activeProspects = prospects?.filter((p: any) => p.status === 'active').length || 0;

  // Calculate email statistics
  const totalSent = campaigns?.reduce((sum: number, c: any) => sum + (c.sentRecipientsCount || 0), 0) || 0;
  const totalOpened = campaigns?.reduce((sum: number, c: any) => sum + (c.openedCount || 0), 0) || 0;
  const totalClicked = campaigns?.reduce((sum: number, c: any) => sum + (c.clickedCount || 0), 0) || 0;
  
  const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;
  const clickRate = totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0;

  return (
    <SuperAdminLayout>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-4 gap-3 mb-8">
          <Card className="bg-white/10 backdrop-blur-xl border-white/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 px-3 pt-3">
              <CardTitle className="text-xs font-medium text-white/80">
                Campañas
              </CardTitle>
              <Mail className="h-3 w-3 text-blue-400" />
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-xl font-bold text-white">{totalCampaigns}</div>
              <p className="text-[10px] text-white/60 mt-0.5">{draftCampaigns} borradores</p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-xl border-white/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 px-3 pt-3">
              <CardTitle className="text-xs font-medium text-white/80">
                Prospects
              </CardTitle>
              <Send className="h-3 w-3 text-purple-400" />
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-xl font-bold text-white">{totalProspects}</div>
              <p className="text-[10px] text-white/60 mt-0.5">{activeProspects} activos</p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-xl border-white/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 px-3 pt-3">
              <CardTitle className="text-xs font-medium text-white/80">
                Apertura
              </CardTitle>
              <Eye className="h-3 w-3 text-green-400" />
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-xl font-bold text-white">{openRate}%</div>
              <p className="text-[10px] text-white/60 mt-0.5">{totalOpened} abiertos</p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-xl border-white/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 px-3 pt-3">
              <CardTitle className="text-xs font-medium text-white/80">
                Clics (CTR)
              </CardTitle>
              <MousePointerClick className="h-3 w-3 text-blue-400" />
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-xl font-bold text-white">{clickRate}%</div>
              <p className="text-[10px] text-white/60 mt-0.5">{totalClicked} clics</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-white/10">
            <TabsTrigger value="campaigns" className="data-[state=active]:bg-white/20 text-xs md:text-sm px-2 md:px-3">
              <span className="hidden sm:inline">Campañas</span>
              <span className="sm:hidden">Campañas</span>
            </TabsTrigger>
            <TabsTrigger value="contacts" className="data-[state=active]:bg-white/20 text-xs md:text-sm px-2 md:px-3">
              <span className="hidden sm:inline">Listas de Contactos</span>
              <span className="sm:hidden">Contactos</span>
            </TabsTrigger>
            <TabsTrigger value="stats" className="data-[state=active]:bg-white/20 text-xs md:text-sm px-2 md:px-3">
              <span className="hidden sm:inline">Estadísticas</span>
              <span className="sm:hidden">Stats</span>
            </TabsTrigger>
          </TabsList>

          {/* Campaigns Tab */}
          <TabsContent value="campaigns" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">Campañas de Email</h2>
              <CreateCampaignDialog />
            </div>

            <Card className="bg-white/10 backdrop-blur-xl border-white/20">
              <CardContent className="p-6">
                {!campaigns || campaigns.length === 0 ? (
                  <div className="text-center py-12">
                    <Mail className="w-12 h-12 text-white/40 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-white mb-2">No hay campañas</h3>
                    <p className="text-white/60 mb-4">Crea tu primera campaña de email marketing</p>
                    <CreateCampaignDialog />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {campaigns.map((campaign: any) => (
                      <div 
                        key={campaign.id}
                        className="flex flex-col md:flex-row md:items-center justify-between p-3 md:p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors gap-3"
                      >
                        <div className="flex items-center gap-3 md:gap-4 min-w-0">
                          <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            campaign.status === 'sent' ? 'bg-green-500/20' :
                            campaign.status === 'scheduled' ? 'bg-yellow-500/20' :
                            'bg-gray-500/20'
                          }`}>
                            {campaign.status === 'sent' ? <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-green-400" /> :
                             campaign.status === 'scheduled' ? <Clock className="w-4 h-4 md:w-5 md:h-5 text-yellow-400" /> :
                             <Mail className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-semibold text-white text-sm md:text-base truncate">{campaign.name}</h4>
                            <p className="text-xs md:text-sm text-white/60 truncate">{campaign.subject}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between md:justify-end gap-2 md:gap-3">
                          <div className="text-left md:text-right md:mr-4">
                            <p className="text-xs md:text-sm text-white/80">
                              {campaign.selectedEmails?.length || 0} seleccionados
                            </p>
                            {campaign.status === 'sent' && (
                              <p className="text-xs text-white/60 hidden md:block">
                                {campaign.sentRecipientsCount || 0} enviados · {campaign.openedCount || 0} aperturas · {campaign.clickedCount || 0} clics
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 md:gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => sendCampaignMutation.mutate(campaign.id)}
                              disabled={!campaign.hasNewRecipients || sendCampaignMutation.isPending}
                              className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 disabled:opacity-30 disabled:cursor-not-allowed h-8 w-8 md:h-9 md:w-9 p-0"
                              data-testid={`button-send-campaign-${campaign.id}`}
                            >
                              <Send className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setEditingCampaign(campaign)}
                              className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8 md:h-9 md:w-9 p-0"
                              data-testid={`button-edit-campaign-${campaign.id}`}
                            >
                              <Edit className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => duplicateCampaignMutation.mutate(campaign.id)}
                              disabled={duplicateCampaignMutation.isPending}
                              className="text-green-400 hover:text-green-300 hover:bg-green-500/10 h-8 w-8 md:h-9 md:w-9 p-0 hidden md:flex"
                              data-testid={`button-duplicate-campaign-${campaign.id}`}
                            >
                              <Copy className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            </Button>
                            {campaign.status === 'sent' && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setConversionsCampaign(campaign)}
                                className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 h-8 w-8 md:h-9 md:w-9 p-0 hidden md:flex"
                                data-testid={`button-conversions-campaign-${campaign.id}`}
                              >
                                <TrendingUp className="w-3.5 h-3.5 md:w-4 md:h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contacts Tab */}
          <TabsContent value="contacts" className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">Listas de Contactos</h2>
              
              {/* Prospects Section */}
              <Card className="bg-white/10 backdrop-blur-xl border-white/20">
                <CardHeader>
                  <div className="space-y-4">
                    {/* Title and Actions Row */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <CardTitle className="text-white flex items-center gap-2">
                        <Send className="w-5 h-5" />
                        Prospects Externos
                        <span className="text-sm font-normal text-white/60">
                          ({searchTerm ? `${filteredProspects.length} de ${totalProspects}` : totalProspects})
                        </span>
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-white/10 rounded-lg p-1">
                          <button
                            onClick={() => setIsTableView(true)}
                            className={`p-2 rounded-md transition-all ${
                              isTableView 
                                ? 'bg-purple-600 text-white' 
                                : 'text-white/60 hover:text-white/90'
                            }`}
                            title="Vista Tabla"
                          >
                            <Table2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setIsTableView(false)}
                            className={`p-2 rounded-md transition-all ${
                              !isTableView 
                                ? 'bg-purple-600 text-white' 
                                : 'text-white/60 hover:text-white/90'
                            }`}
                            title="Vista Lista"
                          >
                            <LayoutList className="w-4 h-4" />
                          </button>
                        </div>
                        <Button
                          onClick={() => setIsAiDiscoveryOpen(true)}
                          variant="outline"
                          className="bg-purple-600/20 hover:bg-purple-600/30 border-purple-500/50 text-white"
                          data-testid="button-ai-discovery"
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          Buscar con IA
                        </Button>
                        <AddProspectDialog />
                      </div>
                    </div>
                    
                    {/* Search and Filters Row */}
                    <div className="space-y-3">
                      <div className="relative w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
                        <Input
                          type="text"
                          placeholder="Buscar por cualquier campo..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="bg-white/10 border-white/20 text-white placeholder:text-white/40 pl-10 w-full"
                          data-testid="input-search-prospects"
                        />
                      </div>
                      
                      {/* Conversation Status Filters */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-white/70 text-sm">Filtrar por estado:</span>
                        
                        {/* WhatsApp Filter */}
                        <div className="flex items-center gap-1.5">
                          <FaWhatsapp className="w-4 h-4 text-green-400" />
                          <select
                            value={whatsappFilter}
                            onChange={(e) => setWhatsappFilter(e.target.value)}
                            className="text-xs px-2 py-1.5 rounded bg-white/10 border border-white/20 text-white cursor-pointer"
                            data-testid="select-filter-whatsapp"
                          >
                            <option value="all" className="bg-gray-800">Todos</option>
                            <option value="not_contacted" className="bg-gray-800">Sin hablar</option>
                            <option value="no_response" className="bg-gray-800">Sin respuesta</option>
                            <option value="in_conversation" className="bg-gray-800">Hablando</option>
                            <option value="not_interested" className="bg-gray-800">No interesa</option>
                            <option value="closed" className="bg-gray-800">Cerrado</option>
                          </select>
                        </div>
                        
                        {/* Instagram Filter */}
                        <div className="flex items-center gap-1.5">
                          <FaInstagram className="w-4 h-4 text-pink-400" />
                          <select
                            value={instagramFilter}
                            onChange={(e) => setInstagramFilter(e.target.value)}
                            className="text-xs px-2 py-1.5 rounded bg-white/10 border border-white/20 text-white cursor-pointer"
                            data-testid="select-filter-instagram"
                          >
                            <option value="all" className="bg-gray-800">Todos</option>
                            <option value="not_contacted" className="bg-gray-800">Sin hablar</option>
                            <option value="no_response" className="bg-gray-800">Sin respuesta</option>
                            <option value="in_conversation" className="bg-gray-800">Hablando</option>
                            <option value="not_interested" className="bg-gray-800">No interesa</option>
                            <option value="closed" className="bg-gray-800">Cerrado</option>
                          </select>
                        </div>
                        
                        {/* Clear filters button */}
                        {(whatsappFilter !== 'all' || instagramFilter !== 'all') && (
                          <button
                            onClick={() => {
                              setWhatsappFilter('all');
                              setInstagramFilter('all');
                            }}
                            className="text-xs px-2 py-1.5 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
                            data-testid="button-clear-filters"
                          >
                            Limpiar filtros
                          </button>
                        )}
                        
                        {/* Clear sorting button */}
                        {sortField && (
                          <button
                            onClick={() => {
                              setSortField(null);
                              setSortDirection('asc');
                            }}
                            className="text-xs px-2 py-1.5 rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors flex items-center gap-1"
                            data-testid="button-clear-sorting"
                          >
                            <ArrowUpDown className="w-3 h-3" />
                            Limpiar ordenación
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {!prospects || prospects.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="w-10 h-10 text-white/40 mx-auto mb-3" />
                      <p className="text-white/60">No hay prospects externos añadidos</p>
                    </div>
                  ) : filteredProspects.length === 0 ? (
                    <div className="text-center py-8">
                      <Search className="w-10 h-10 text-white/40 mx-auto mb-3" />
                      <p className="text-white/60">No se encontraron resultados</p>
                    </div>
                  ) : isTableView ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-white/20 hover:bg-white/5">
                            <TableHead 
                              className="text-white/90 cursor-pointer hover:text-white select-none min-w-[180px]"
                              onClick={() => handleSort('company')}
                            >
                              <div className="flex items-center gap-1">
                                Empresa
                                {sortField === 'company' ? (
                                  sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                ) : (
                                  <ArrowUpDown className="w-3 h-3 opacity-40" />
                                )}
                              </div>
                            </TableHead>
                            <TableHead 
                              className="text-white/90 cursor-pointer hover:text-white select-none w-24"
                              onClick={() => handleSort('whatsappStatus')}
                            >
                              <div className="flex items-center gap-1">
                                <FaWhatsapp className="w-3.5 h-3.5" />
                                WA
                                {sortField === 'whatsappStatus' ? (
                                  sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                ) : (
                                  <ArrowUpDown className="w-3 h-3 opacity-40" />
                                )}
                              </div>
                            </TableHead>
                            <TableHead 
                              className="text-white/90 cursor-pointer hover:text-white select-none w-24"
                              onClick={() => handleSort('instagramStatus')}
                            >
                              <div className="flex items-center gap-1">
                                <FaInstagram className="w-3.5 h-3.5" />
                                IG
                                {sortField === 'instagramStatus' ? (
                                  sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                ) : (
                                  <ArrowUpDown className="w-3 h-3 opacity-40" />
                                )}
                              </div>
                            </TableHead>
                            <TableHead 
                              className="text-white/90 cursor-pointer hover:text-white select-none w-28"
                              onClick={() => handleSort('emailStatus')}
                            >
                              <div className="flex items-center gap-1">
                                <Mail className="w-3.5 h-3.5" />
                                Email
                                {sortField === 'emailStatus' ? (
                                  sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                ) : (
                                  <ArrowUpDown className="w-3 h-3 opacity-40" />
                                )}
                              </div>
                            </TableHead>
                            <TableHead 
                              className="text-white/90 cursor-pointer hover:text-white select-none min-w-[100px]"
                              onClick={() => handleSort('location')}
                            >
                              <div className="flex items-center gap-1">
                                Ubicación
                                {sortField === 'location' ? (
                                  sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                ) : (
                                  <ArrowUpDown className="w-3 h-3 opacity-40" />
                                )}
                              </div>
                            </TableHead>
                            <TableHead 
                              className="text-white/90 cursor-pointer hover:text-white select-none min-w-[150px]"
                              onClick={() => handleSort('tags')}
                            >
                              <div className="flex items-center gap-1">
                                Tags
                                {sortField === 'tags' ? (
                                  sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                ) : (
                                  <ArrowUpDown className="w-3 h-3 opacity-40" />
                                )}
                              </div>
                            </TableHead>
                            <TableHead className="text-white/90 w-24">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[{ id: 'new', company: '', phone: '', location: '', tags: [] }, ...filteredProspects].map((prospect: any) => (
                            <TableRow key={prospect.id} className={`border-white/20 hover:bg-white/5 ${prospect.id === 'new' ? 'bg-purple-500/10' : ''}`}>
                              {/* EMPRESA */}
                              <TableCell
                                className="text-white font-medium cursor-pointer hover:bg-white/10 py-2"
                                onClick={() => {
                                  if (prospect.id === 'new') {
                                    setEditingCell({ id: 'new', field: 'company' });
                                  }
                                }}
                                onDoubleClick={() => {
                                  if (prospect.id !== 'new') {
                                    setEditingCell({ id: prospect.id, field: 'company' });
                                  }
                                }}
                              >
                                {editingCell?.id === prospect.id && editingCell?.field === 'company' ? (
                                  <Input
                                    defaultValue={prospect.company || ''}
                                    autoFocus
                                    placeholder={prospect.id === 'new' ? 'Empresa...' : ''}
                                    className="bg-transparent border-0 text-white p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
                                    onBlur={(e) => {
                                      const value = e.target.value.trim();
                                      if (prospect.id === 'new' && value) {
                                        createProspectFromRowMutation.mutate({
                                          field: 'company',
                                          value,
                                        });
                                      } else if (prospect.id !== 'new' && value !== prospect.company) {
                                        updateProspectInlineMutation.mutate({
                                          prospectId: prospect.id,
                                          field: 'company',
                                          value: value || null,
                                        });
                                      } else {
                                        setEditingCell(null);
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.currentTarget.blur();
                                      } else if (e.key === 'Escape') {
                                        setEditingCell(null);
                                      }
                                    }}
                                  />
                                ) : (
                                  prospect.company || (prospect.id === 'new' ? <span className="text-white/40 italic">Empresa...</span> : '-')
                                )}
                              </TableCell>
                              
                              {/* WHATSAPP */}
                              <TableCell className="text-white py-2">
                                {prospect.id !== 'new' ? (
                                  <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-1">
                                      {prospect.phone && !prospect.phone.trim().startsWith('9') && (
                                        <button
                                          onClick={() => {
                                            const cleanPhone = prospect.phone.replace(/\s+/g, '');
                                            window.open(`https://wa.me/${cleanPhone}`, '_blank');
                                          }}
                                          className="p-1 rounded transition-colors bg-green-500/20 text-green-400 hover:bg-green-500/30"
                                          title="Abrir WhatsApp"
                                          data-testid={`button-whatsapp-open-${prospect.id}`}
                                        >
                                          <FaWhatsapp className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                      <select
                                        value={prospect.whatsappConversationStatus || 'not_contacted'}
                                        onChange={(e) => {
                                          updateProspectInlineMutation.mutate({
                                            prospectId: prospect.id,
                                            field: 'whatsappConversationStatus',
                                            value: e.target.value,
                                          });
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        disabled={prospect.phone && prospect.phone.trim().startsWith('9')}
                                        className={`text-[10px] px-1.5 py-0.5 rounded cursor-pointer border-0 flex-1 ${
                                          prospect.whatsappConversationStatus === 'in_conversation' ? 'bg-green-500/20 text-green-300' :
                                          prospect.whatsappConversationStatus === 'no_response' ? 'bg-yellow-500/20 text-yellow-300' :
                                          prospect.whatsappConversationStatus === 'not_interested' ? 'bg-red-500/20 text-red-300' :
                                          prospect.whatsappConversationStatus === 'closed' ? 'bg-gray-500/20 text-gray-300' :
                                          'bg-white/10 text-white/60'
                                        }`}
                                        data-testid={`select-whatsapp-status-${prospect.id}`}
                                      >
                                        <option value="not_contacted" className="bg-gray-800">Sin contacto</option>
                                        <option value="no_response" className="bg-gray-800">Sin resp.</option>
                                        <option value="in_conversation" className="bg-gray-800">Hablando</option>
                                        <option value="not_interested" className="bg-gray-800">No interesa</option>
                                        <option value="closed" className="bg-gray-800">Cerrado</option>
                                      </select>
                                    </div>
                                    {prospect.whatsappConversationStatusUpdatedAt && (
                                      <span className="text-[9px] text-white/40">
                                        {new Date(prospect.whatsappConversationStatusUpdatedAt).toLocaleDateString('es-ES')}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-white/40 text-xs">-</span>
                                )}
                              </TableCell>
                              
                              {/* INSTAGRAM */}
                              <TableCell className="text-white py-2">
                                {prospect.id !== 'new' ? (
                                  <div className="flex flex-col gap-1">
                                    <select
                                      value={prospect.instagramConversationStatus || 'not_contacted'}
                                      onChange={(e) => {
                                        updateProspectInlineMutation.mutate({
                                          prospectId: prospect.id,
                                          field: 'instagramConversationStatus',
                                          value: e.target.value,
                                        });
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      className={`text-[10px] px-1.5 py-0.5 rounded cursor-pointer border-0 w-full ${
                                        prospect.instagramConversationStatus === 'in_conversation' ? 'bg-green-500/20 text-green-300' :
                                        prospect.instagramConversationStatus === 'no_response' ? 'bg-yellow-500/20 text-yellow-300' :
                                        prospect.instagramConversationStatus === 'not_interested' ? 'bg-red-500/20 text-red-300' :
                                        prospect.instagramConversationStatus === 'closed' ? 'bg-gray-500/20 text-gray-300' :
                                        'bg-white/10 text-white/60'
                                      }`}
                                      data-testid={`select-instagram-status-${prospect.id}`}
                                    >
                                      <option value="not_contacted" className="bg-gray-800">Sin contacto</option>
                                      <option value="no_response" className="bg-gray-800">Sin resp.</option>
                                      <option value="in_conversation" className="bg-gray-800">Hablando</option>
                                      <option value="not_interested" className="bg-gray-800">No interesa</option>
                                      <option value="closed" className="bg-gray-800">Cerrado</option>
                                    </select>
                                    {prospect.instagramConversationStatusUpdatedAt && (
                                      <span className="text-[9px] text-white/40">
                                        {new Date(prospect.instagramConversationStatusUpdatedAt).toLocaleDateString('es-ES')}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-white/40 text-xs">-</span>
                                )}
                              </TableCell>
                              
                              {/* EMAIL STATUS */}
                              <TableCell className="text-white py-2">
                                {prospect.id !== 'new' ? (
                                  <div className="flex flex-col gap-1">
                                    <span className={`text-[10px] px-2 py-0.5 rounded inline-block ${
                                      prospect.lastEmailStatus === 'clicked' ? 'bg-purple-500/20 text-purple-300' :
                                      prospect.lastEmailStatus === 'opened' ? 'bg-blue-500/20 text-blue-300' :
                                      prospect.lastEmailStatus === 'sent' ? 'bg-green-500/20 text-green-300' :
                                      prospect.lastEmailStatus === 'bounced' ? 'bg-red-500/20 text-red-300' :
                                      prospect.lastEmailStatus === 'pending' ? 'bg-yellow-500/20 text-yellow-300' :
                                      'bg-gray-500/20 text-gray-300'
                                    }`}>
                                      {prospect.lastEmailStatus === 'clicked' ? 'Click' :
                                       prospect.lastEmailStatus === 'opened' ? 'Abierto' :
                                       prospect.lastEmailStatus === 'sent' ? 'Enviado' :
                                       prospect.lastEmailStatus === 'bounced' ? 'Rebotado' :
                                       prospect.lastEmailStatus === 'pending' ? 'Pendiente' :
                                       'Sin enviar'}
                                    </span>
                                    {(() => {
                                      const emailDate = prospect.lastEmailClickedAt || prospect.lastEmailOpenedAt || prospect.lastEmailSentAt;
                                      return emailDate ? (
                                        <span className="text-[9px] text-white/40">
                                          {new Date(emailDate).toLocaleDateString('es-ES')}
                                        </span>
                                      ) : null;
                                    })()}
                                  </div>
                                ) : (
                                  <span className="text-white/40 text-xs">-</span>
                                )}
                              </TableCell>
                              
                              <TableCell
                                className="text-white cursor-pointer hover:bg-white/10"
                                onClick={() => {
                                  if (prospect.id === 'new') {
                                    setEditingCell({ id: 'new', field: 'location' });
                                  }
                                }}
                                onDoubleClick={() => {
                                  if (prospect.id !== 'new') {
                                    setEditingCell({ id: prospect.id, field: 'location' });
                                  }
                                }}
                              >
                                {editingCell?.id === prospect.id && editingCell?.field === 'location' ? (
                                  <Input
                                    defaultValue={prospect.location || ''}
                                    autoFocus
                                    placeholder={prospect.id === 'new' ? 'Localización...' : ''}
                                    className="bg-transparent border-0 text-white p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
                                    onBlur={(e) => {
                                      const value = e.target.value.trim();
                                      if (prospect.id === 'new' && value) {
                                        createProspectFromRowMutation.mutate({
                                          field: 'location',
                                          value,
                                        });
                                      } else if (prospect.id !== 'new' && value !== prospect.location) {
                                        updateProspectInlineMutation.mutate({
                                          prospectId: prospect.id,
                                          field: 'location',
                                          value: value || null,
                                        });
                                      } else {
                                        setEditingCell(null);
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.currentTarget.blur();
                                      } else if (e.key === 'Escape') {
                                        setEditingCell(null);
                                      }
                                    }}
                                  />
                                ) : (
                                  prospect.location || (prospect.id === 'new' ? <span className="text-white/40 italic">Localización...</span> : '-')
                                )}
                              </TableCell>
                              <TableCell
                                className={`text-white ${prospect.id !== 'new' ? 'cursor-pointer hover:bg-white/10' : 'opacity-40'}`}
                                onDoubleClick={() => {
                                  if (prospect.id !== 'new') {
                                    setEditingCell({ id: prospect.id, field: 'tags' });
                                    setTagInput('');
                                  }
                                }}
                              >
                                {editingCell?.id === prospect.id && editingCell?.field === 'tags' ? (
                                  <div className="flex flex-wrap gap-1 items-center min-h-[32px]">
                                    {(prospect.tags || []).map((tag: string) => {
                                      const tagColor = getTagColor(tag);
                                      return (
                                        <span key={tag} className={`inline-flex items-center gap-1 px-2 py-0.5 ${tagColor.bg} ${tagColor.text} text-xs rounded`}>
                                          {tag}
                                          <button
                                            onClick={() => {
                                              const newTags = prospect.tags.filter((t: string) => t !== tag);
                                              updateProspectInlineMutation.mutate({
                                                prospectId: prospect.id,
                                                field: 'tags',
                                                value: newTags.length > 0 ? newTags : null,
                                              });
                                            }}
                                            className="hover:opacity-80"
                                          >
                                            ×
                                          </button>
                                        </span>
                                      );
                                    })}
                                    <div className="relative">
                                      <Input
                                        value={tagInput}
                                        onChange={(e) => setTagInput(e.target.value)}
                                        placeholder="Escribe o selecciona..."
                                        autoFocus
                                        className="bg-transparent border-0 text-white p-0 h-auto text-xs w-40 focus-visible:ring-0 focus-visible:ring-offset-0"
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' && tagInput.trim()) {
                                            e.preventDefault();
                                            const newTag = tagInput.trim();
                                            const currentTags = prospect.tags || [];
                                            if (!currentTags.includes(newTag)) {
                                              updateProspectInlineMutation.mutate({
                                                prospectId: prospect.id,
                                                field: 'tags',
                                                value: [...currentTags, newTag],
                                              });
                                            }
                                            setTagInput('');
                                          } else if (e.key === 'Escape') {
                                            setEditingCell(null);
                                            setTagInput('');
                                          }
                                        }}
                                        onBlur={(e) => {
                                          // Check if we're clicking on a dropdown item
                                          const relatedTarget = e.relatedTarget as HTMLElement;
                                          if (!relatedTarget || !relatedTarget.closest('.tags-dropdown')) {
                                            setTimeout(() => {
                                              setEditingCell(null);
                                              setTagInput('');
                                            }, 200);
                                          }
                                        }}
                                      />
                                      {/* Show dropdown always when editing, with all available tags */}
                                      <div className="tags-dropdown absolute top-full left-0 mt-1 bg-gray-800 border border-white/20 rounded shadow-lg z-50 max-h-48 overflow-y-auto min-w-[150px]">
                                        {/* Show filtered suggestions based on input */}
                                        {allTags
                                          .filter(tag => {
                                            const matchesSearch = tagInput === '' || tag.toLowerCase().includes(tagInput.toLowerCase());
                                            const notAlreadyAdded = !(prospect.tags || []).includes(tag);
                                            return matchesSearch && notAlreadyAdded;
                                          })
                                          .map(tag => (
                                            <button
                                              key={tag}
                                              type="button"
                                              className="block w-full text-left px-3 py-1.5 text-xs text-white hover:bg-white/10 transition-colors"
                                              onMouseDown={(e) => {
                                                e.preventDefault();
                                                const currentTags = prospect.tags || [];
                                                updateProspectInlineMutation.mutate({
                                                  prospectId: prospect.id,
                                                  field: 'tags',
                                                  value: [...currentTags, tag],
                                                });
                                                setTagInput('');
                                              }}
                                            >
                                              {tag}
                                            </button>
                                          ))}
                                        {/* Show "Create new" option when typing */}
                                        {tagInput.trim() && !allTags.some(tag => tag.toLowerCase() === tagInput.toLowerCase()) && (
                                          <button
                                            type="button"
                                            className="block w-full text-left px-3 py-1.5 text-xs text-green-400 hover:bg-white/10 transition-colors border-t border-white/10"
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              const newTag = tagInput.trim();
                                              const currentTags = prospect.tags || [];
                                              if (!currentTags.includes(newTag)) {
                                                updateProspectInlineMutation.mutate({
                                                  prospectId: prospect.id,
                                                  field: 'tags',
                                                  value: [...currentTags, newTag],
                                                });
                                              }
                                              setTagInput('');
                                            }}
                                          >
                                            + Crear "{tagInput.trim()}"
                                          </button>
                                        )}
                                        {/* Show empty state */}
                                        {allTags.length === 0 && !tagInput && (
                                          <div className="px-3 py-2 text-xs text-white/40 italic">
                                            Escribe para crear el primer tag
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {prospect.tags?.map((tag: string) => {
                                      const tagColor = getTagColor(tag);
                                      return (
                                        <span key={tag} className={`px-2 py-0.5 ${tagColor.bg} ${tagColor.text} text-xs rounded`}>
                                          {tag}
                                        </span>
                                      );
                                    }) || '-'}
                                  </div>
                                )}
                              </TableCell>
                              
                              {/* ACCIONES */}
                              <TableCell>
                                {prospect.id !== 'new' && (
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setFullScreenEditingProspect(prospect)}
                                      className="h-7 w-7 p-0 text-blue-400 hover:text-blue-300 hover:bg-blue-500/20"
                                      title="Editar a pantalla completa"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setStatsProspect(prospect)}
                                      className="h-7 w-7 p-0 text-purple-400 hover:text-purple-300 hover:bg-purple-500/20"
                                      title="Ver estadísticas"
                                    >
                                      <BarChart3 className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDeleteProspect(prospect.id)}
                                      className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                                      title="Eliminar"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredProspects.slice(0, 5).map((prospect: any) => (
                        <div key={prospect.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors group">
                          <div className="flex-1">
                            <p className="font-medium text-white">{prospect.name || prospect.email}</p>
                            <p className="text-sm text-white/60">{prospect.email}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {prospect.tags && prospect.tags.length > 0 && (
                              <div className="flex gap-1">
                                {prospect.tags.slice(0, 2).map((tag: string) => {
                                  const tagColor = getTagColor(tag);
                                  return (
                                    <span key={tag} className={`px-2 py-1 ${tagColor.bg} ${tagColor.text} text-xs rounded`}>
                                      {tag}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                            {prospect.status !== 'active' && (
                              <span className={`text-xs px-2 py-1 rounded ${
                                prospect.status === 'unsubscribed' ? 'bg-gray-500/20 text-gray-200' :
                                'bg-red-500/20 text-red-200'
                              }`}>
                                {prospect.status === 'unsubscribed' ? 'Desuscrito' : prospect.status === 'bounced' ? 'Rebotado' : prospect.status}
                              </span>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setStatsProspect(prospect)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-purple-400 hover:text-purple-300 hover:bg-purple-500/20"
                              data-testid={`button-stats-prospect-${prospect.id}`}
                            >
                              <BarChart3 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditProspect(prospect)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-400 hover:text-blue-300 hover:bg-blue-500/20"
                              data-testid={`button-edit-prospect-${prospect.id}`}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteProspect(prospect.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 hover:bg-red-500/20"
                              data-testid={`button-delete-prospect-${prospect.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Statistics Tab */}
          <TabsContent value="stats" className="space-y-4">
            <h2 className="text-xl font-semibold text-white mb-4">Estadísticas de Campañas</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 backdrop-blur-xl border-blue-400/30">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-white/90">
                    Tasa de Apertura
                  </CardTitle>
                  <Eye className="h-5 w-5 text-blue-300" />
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-white">{openRate}%</div>
                  <p className="text-xs text-white/70 mt-2">{totalOpened} de {totalSent} emails abiertos</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 backdrop-blur-xl border-emerald-400/30">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-white/90">
                    Tasa de Clics
                  </CardTitle>
                  <MousePointerClick className="h-5 w-5 text-emerald-300" />
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-white">{clickRate}%</div>
                  <p className="text-xs text-white/70 mt-2">{totalClicked} de {totalSent} emails con clics</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 backdrop-blur-xl border-purple-400/30">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-white/90">
                    Emails Enviados
                  </CardTitle>
                  <Send className="h-5 w-5 text-purple-300" />
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-white">{totalSent}</div>
                  <p className="text-xs text-white/70 mt-2">Total de envíos realizados</p>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-white/10 backdrop-blur-xl border-white/20">
              <CardHeader>
                <CardTitle className="text-white">Rendimiento por Campaña</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-white/60">
                  <BarChart3 className="w-12 h-12 mx-auto mb-3 text-white/40" />
                  <p>Las estadísticas aparecerán cuando envíes campañas</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Campaign Dialog */}
      {editingCampaign && (
        <EditCampaignDialog
          campaign={editingCampaign}
          open={!!editingCampaign}
          onOpenChange={(open) => !open && setEditingCampaign(null)}
        />
      )}

      {/* Edit Prospect Dialog */}
      {editingProspect && (
        <EditProspectDialog
          prospect={editingProspect}
          open={!!editingProspect}
          onOpenChange={(open) => !open && setEditingProspect(null)}
        />
      )}

      {/* Campaign Conversions Dialog */}
      {conversionsCampaign && (
        <CampaignConversionsDialog
          campaign={conversionsCampaign}
          open={!!conversionsCampaign}
          onOpenChange={(open) => !open && setConversionsCampaign(null)}
        />
      )}

      {/* Prospect Stats Dialog */}
      {statsProspect && (
        <ProspectStatsDialog
          prospect={statsProspect}
          open={!!statsProspect}
          onOpenChange={(open) => !open && setStatsProspect(null)}
        />
      )}

      {/* Full Screen Prospect Edit Dialog */}
      {fullScreenEditingProspect && (
        <FullScreenProspectDialog
          prospect={fullScreenEditingProspect}
          open={!!fullScreenEditingProspect}
          onOpenChange={(open) => !open && setFullScreenEditingProspect(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={prospectToDelete !== null} onOpenChange={(open) => !open && setProspectToDelete(null)}>
        <DialogContent className="bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 border-white/20 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Confirmar eliminación</DialogTitle>
            <DialogDescription className="text-white/70">
              ¿Estás seguro de que quieres eliminar este contacto? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setProspectToDelete(null)}
              className="bg-white/10 hover:bg-white/20 border-white/20 text-white"
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmDeleteProspect}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sending Progress Dialog */}
      <SendingProgressDialog
        isOpen={sendingProgress.isOpen}
        status={sendingProgress.status}
        totalEmails={sendingProgress.totalEmails}
        successCount={sendingProgress.successCount}
        failCount={sendingProgress.failCount}
        errorMessage={sendingProgress.errorMessage}
        onClose={() => setSendingProgress(prev => ({ ...prev, isOpen: false }))}
      />

      {/* AI Prospect Discovery Dialog */}
      <AiProspectDiscoveryDialog
        isOpen={isAiDiscoveryOpen}
        onOpenChange={setIsAiDiscoveryOpen}
        onComplete={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/super-admin/email-prospects'] });
        }}
        existingProspects={prospects || []}
      />
    </SuperAdminLayout>
  );
}
