import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Building2, ChevronRight } from 'lucide-react';
import AdminAccounting from './admin-accounting';
import { useLocation } from 'wouter';

interface AccountantCompany {
  id: number;
  name: string;
  cif: string;
}

export default function AccountantAccounting() {
  const { token, user } = useAuth();
  const [location] = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(location.split('?')[1] || ''), [location]);
  const initialCompanyId = searchParams.get('companyId');
  const initialEntryId = searchParams.get('entryId');

  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(initialCompanyId ? Number(initialCompanyId) : null);

  const { data: companies = [], isLoading } = useQuery<AccountantCompany[]>({
    queryKey: ['/api/accountant/companies'],
    queryFn: async () => {
      const response = await fetch('/api/accountant/companies', {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch companies');
      return response.json();
    },
    enabled: user?.role === 'accountant',
  });

  const selectedCompany = companies.find(c => c.id === selectedCompanyId);

  // Si no hay empresa seleccionada, mostrar lista
  if (!selectedCompanyId) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Contabilidad - Seleccionar Empresa</h1>
          <p className="text-muted-foreground mt-1">
            Selecciona la empresa cuya contabilidad deseas gestionar
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : companies.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No tienes empresas asignadas
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {companies.map((company) => (
              <Card
                key={company.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setSelectedCompanyId(company.id)}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{company.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{company.cif}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Si hay empresa seleccionada, renderizar LA MISMA página de admin-accounting
  return (
    <AdminAccounting
      accountantMode={true}
      accountantCompanyId={selectedCompanyId}
      accountantCompanyName={selectedCompany?.name}
      initialEntryId={initialEntryId ? Number(initialEntryId) : undefined}
      onBackToCompanies={() => setSelectedCompanyId(null)}
    />
  );
}
