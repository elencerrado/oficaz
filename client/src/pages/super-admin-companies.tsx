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
  ArrowLeft,
  Eye,
  Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  };
}

const planColors = {
  free: "bg-gray-500",
  basic: "bg-blue-500", 
  pro: "bg-purple-500",
  master: "bg-gradient-to-r from-yellow-400 to-yellow-600"
};

const planLabels = {
  free: "Free",
  basic: "Basic", 
  pro: "Pro",
  master: "Master"
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

  const { data: companies, isLoading } = useQuery({
    queryKey: ['/api/super-admin/companies'],
    queryFn: async () => {
      const response = await fetch('/api/super-admin/companies', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch companies');
      return response.json();
    },
    retry: false,
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            onClick={() => setLocation('/super-admin/dashboard')}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-white">Gestión de Empresas</h1>
            <p className="text-white/60">Administra y configura todas las empresas registradas</p>
          </div>
        </div>

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
                  <SelectItem value="free">Free</SelectItem>
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
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {editingCompany === company.id ? (
                      <div className="flex items-center gap-2">
                        <Select value={newPlan} onValueChange={setNewPlan}>
                          <SelectTrigger className="w-32 bg-white/10 border-white/20 text-white">
                            <SelectValue placeholder="Seleccionar plan" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="free">Free</SelectItem>
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
                    <Badge 
                      variant={company.subscription.status === 'active' ? 'default' : 'secondary'}
                      className={
                        company.subscription.status === 'active' 
                          ? 'bg-emerald-500' 
                          : company.subscription.status === 'trial' 
                            ? 'bg-blue-500' 
                            : 'bg-gray-500'
                      }
                    >
                      {company.subscription.status === 'active' 
                        ? 'Activo' 
                        : company.subscription.status === 'trial' 
                          ? 'Prueba' 
                          : 'Inactivo'}
                    </Badge>
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
    </div>
  );
}