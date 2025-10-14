import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { getAuthHeaders } from '@/lib/auth';
import { 
  Building2, 
  Search,
  Filter,
  Edit,
  Check,
  X,
  Eye,
  Users,
  Tag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SuperAdminLayout } from '@/components/layout/super-admin-layout';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface Company {
  id: number;
  name: string;
  cif: string;
  email: string;
  userCount: number;
  subscription: {
    plan: string;
    status: string;
    stripeSubscriptionId?: string;
  };
  promotionalCode?: {
    code: string;
    description: string;
  } | null;
  trialInfo?: {
    daysRemaining: number;
    isTrialActive: boolean;
    trialDuration: number;
  };
  deletionInfo?: {
    scheduledForDeletion: boolean;
    deletionScheduledAt?: string;
    isDeleted: boolean;
  };
}

const planColors = {
  basic: "bg-blue-500", 
  pro: "bg-purple-500",
  master: "bg-gradient-to-r from-yellow-400 to-yellow-600"
};

const planLabels = {
  basic: "Basic", 
  pro: "Pro",
  master: "Master"
};

// Helper function to get subscription status badge info
const getSubscriptionBadge = (company: Company) => {
  // Priority 1: Company deleted
  if (company.deletionInfo?.isDeleted) {
    return {
      text: 'Eliminada',
      variant: 'destructive' as const,
      className: 'bg-red-900 text-white border-red-700'
    };
  }

  // Priority 2: Scheduled for deletion
  if (company.deletionInfo?.scheduledForDeletion) {
    return {
      text: 'Cancelada - Eliminación programada',
      variant: 'destructive' as const,
      className: 'bg-orange-600 text-white'
    };
  }

  // Priority 3: Trial active
  if (company.trialInfo?.isTrialActive) {
    const days = company.trialInfo.daysRemaining;
    return {
      text: `Prueba - ${days} día${days !== 1 ? 's' : ''}`,
      variant: 'secondary' as const,
      className: 'bg-blue-500 text-white'
    };
  }

  // Priority 4: Paid subscription active (has Stripe subscription)
  if (company.subscription.status === 'active' && company.subscription.stripeSubscriptionId) {
    return {
      text: 'Suscrito',
      variant: 'default' as const,
      className: 'bg-emerald-500 text-white'
    };
  }

  // Priority 5: Trial expired (only if trial was active before and now expired)
  if (!company.trialInfo?.isTrialActive && company.trialInfo?.daysRemaining !== undefined && company.trialInfo.daysRemaining <= 0 && !company.subscription.stripeSubscriptionId) {
    return {
      text: 'Trial expirado',
      variant: 'secondary' as const,
      className: 'bg-gray-600 text-white'
    };
  }

  // Default: show subscription status
  return {
    text: company.subscription.status === 'active' ? 'Activo' : 'Inactivo',
    variant: company.subscription.status === 'active' ? 'default' as const : 'secondary' as const,
    className: company.subscription.status === 'active' ? 'bg-emerald-500' : 'bg-gray-500'
  };
};

export default function SuperAdminCompanies() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPlan, setFilterPlan] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [editingCompany, setEditingCompany] = useState<number | null>(null);
  const [newPlan, setNewPlan] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: companies } = useQuery({
    queryKey: ['/api/super-admin/companies'],
    queryFn: async () => {
      const response = await fetch('/api/super-admin/companies', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch companies');
      return response.json();
    },
    retry: false,
    staleTime: 30000, // Cache for 30 seconds
    refetchOnMount: false,
  });

  const updateSubscriptionMutation = useMutation({
    mutationFn: async ({ companyId, plan }: { companyId: number; plan: string }) => {
      const response = await fetch(`/api/super-admin/companies/${companyId}/subscription`, {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan }),
      });
      if (!response.ok) throw new Error('Failed to update subscription');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/companies'] });
      toast({
        title: "Éxito",
        description: "Plan actualizado correctamente",
      });
      setEditingCompany(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredCompanies = companies?.filter((company: Company) => {
    const matchesSearch = 
      company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.cif.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesPlan = filterPlan === "all" || company.subscription.plan === filterPlan;
    const matchesStatus = filterStatus === "all" || company.subscription.status === filterStatus;
    
    return matchesSearch && matchesPlan && matchesStatus;
  }) || [];

  const handlePlanChange = (companyId: number, currentPlan: string) => {
    setEditingCompany(companyId);
    setNewPlan(currentPlan);
  };

  const savePlanChange = (companyId: number) => {
    if (!newPlan) return;
    updateSubscriptionMutation.mutate({ companyId, plan: newPlan });
  };

  const cancelPlanChange = () => {
    setEditingCompany(null);
    setNewPlan("");
  };

  return (
    <SuperAdminLayout>
      <div className="container mx-auto px-6 py-8">
        {/* Filters */}
        <Card className="bg-white/10 backdrop-blur-xl border-white/20 mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50 w-4 h-4" />
                  <Input
                    placeholder="Buscar empresas por nombre, CIF o email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/50 pl-10"
                  />
                </div>
              </div>
              <Select value={filterPlan} onValueChange={setFilterPlan}>
                <SelectTrigger className="w-48 bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="Filtrar por plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los planes</SelectItem>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="master">Master</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-48 bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                  <SelectItem value="suspended">Suspendido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Companies List */}
        <Card className="bg-white/10 backdrop-blur-xl border-white/20">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              Empresas ({filteredCompanies.length})
              <Badge variant="secondary" className="bg-white/20 text-white">
                {filteredCompanies.length} de {companies?.length || 0}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredCompanies.map((company: Company) => (
                <div
                  key={company.id}
                  className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{company.name}</h3>
                      <div className="flex items-center gap-4 text-sm text-white/60">
                        <span>{company.cif}</span>
                        <span>•</span>
                        <span>{company.email}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {company.userCount} usuarios
                        </span>
                        {company.promotionalCode && (
                          <span className="flex items-center gap-1 text-sm">
                            <Tag className="w-3 h-3 text-yellow-400" />
                            <span className="text-yellow-400">{company.promotionalCode.code}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {company.promotionalCode && (
                      <Badge 
                        variant="secondary" 
                        className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 flex items-center gap-1"
                      >
                        <Tag className="w-3 h-3" />
                        {company.promotionalCode.code}
                      </Badge>
                    )}
                    {editingCompany === company.id ? (
                      <div className="flex items-center gap-2">
                        <Select value={newPlan} onValueChange={setNewPlan}>
                          <SelectTrigger className="w-32 bg-white/10 border-white/20 text-white">
                            <SelectValue placeholder="Seleccionar plan" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="basic">Basic</SelectItem>
                            <SelectItem value="pro">Pro</SelectItem>
                            <SelectItem value="master">Master</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          onClick={() => savePlanChange(company.id)}
                          disabled={updateSubscriptionMutation.isPending}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={cancelPlanChange}
                          className="text-white/60 hover:text-white hover:bg-white/10"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Badge 
                          className={`${planColors[company.subscription.plan as keyof typeof planColors]} text-white cursor-pointer hover:opacity-80`}
                          onClick={() => handlePlanChange(company.id, company.subscription.plan)}
                        >
                          {planLabels[company.subscription.plan as keyof typeof planLabels]}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setLocation(`/super-admin/companies/${company.id}`)}
                          className="text-white/60 hover:text-white hover:bg-white/10"
                          title="Configuración avanzada"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setLocation(`/super-admin/companies/${company.id}`)}
                          className="text-white/60 hover:text-white hover:bg-white/10"
                          title="Ver detalles"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    {(() => {
                      const badge = getSubscriptionBadge(company);
                      return (
                        <Badge 
                          variant={badge.variant}
                          className={badge.className}
                        >
                          {badge.text}
                        </Badge>
                      );
                    })()}
                  </div>
                </div>
              ))}
              
              {filteredCompanies.length === 0 && (
                <div className="text-center py-12">
                  <Filter className="w-12 h-12 text-white/30 mx-auto mb-4" />
                  <p className="text-white/60">No se encontraron empresas con los filtros aplicados</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}