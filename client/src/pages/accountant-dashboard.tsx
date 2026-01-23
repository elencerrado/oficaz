import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Building2, Calendar, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAuthHeaders } from '@/lib/auth';
import { useLocation } from 'wouter';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
// NOTE: Imports consolidated above

interface AccountingEntry {
  id: number;
  companyId: number;
  entryDate: string;
  description: string;
  type: 'income' | 'expense';
  category: string;
  amount: string;
  taxBase?: string;
  taxAmount?: string;
  totalAmount: string;
  status: 'pending' | 'submitted' | 'approved' | 'rejected';
  refCode?: string;
  accountantNotes?: string;
  accountantReviewedAt?: string;
  createdAt: string;
}

interface Company {
  id: number;
  name: string;
  cif: string;
  logoUrl?: string;
}

interface EntryWithCompany extends AccountingEntry {
  company: Company;
}

export default function AccountantDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [reviewDialog, setReviewDialog] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<EntryWithCompany | null>(null);
  const [reviewAction, setReviewAction] = useState<'approved' | 'rejected' | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  // Query para obtener TODAS las empresas asignadas
  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ['/api/accountant/companies'],
    enabled: user?.role === 'accountant',
  });

  // Query para obtener los ÚLTIMOS MOVIMIENTOS de TODAS las empresas (mezclados)
  const { data: recentEntries = [], isLoading } = useQuery<EntryWithCompany[]>({
    queryKey: ['/api/accountant/recent-entries'],
    enabled: user?.role === 'accountant',
  });

  // Mutation para revisar entrada
  const reviewMutation = useMutation({
    mutationFn: async ({ entryId, status, notes }: { entryId: number; status: string; notes?: string }) => {
      const response = await fetch(`/api/accountant/entries/${entryId}/review`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ status, notes }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al revisar movimiento');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/accountant/recent-entries'] });
      toast({
        title: 'Éxito',
        description: reviewAction === 'approved' ? 'Movimiento aprobado' : 'Movimiento rechazado',
      });
      setReviewDialog(false);
      setSelectedEntry(null);
      setReviewNotes('');
      setReviewAction(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleReviewClick = (entry: EntryWithCompany, action: 'approved' | 'rejected') => {
    setSelectedEntry(entry);
    setReviewAction(action);
    setReviewDialog(true);
  };

  const handleConfirmReview = () => {
    if (!selectedEntry || !reviewAction) return;
    reviewMutation.mutate({
      entryId: selectedEntry.id,
      status: reviewAction,
      notes: reviewNotes || undefined,
    });
  };

  // Verificar que el usuario es accountant
  if (user?.role !== 'accountant') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Acceso Denegado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">No tienes permisos para acceder a esta página.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: 'outline', label: 'Pendiente' },
      approved: { variant: 'secondary', label: 'Enviado' },
      approved_accountant: { variant: 'default', label: 'Aprobado Gestoría' },
      rejected: { variant: 'destructive', label: 'Rechazado' },
    };
    const config = configs[status] || configs.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(parseFloat(amount));
  };

  // Filtrar solo las entradas que necesitan revisión (approved = "Enviado")
  const pendingReviewEntries = recentEntries.filter(e => e.status === 'approved');
  const reviewedEntries = recentEntries.filter(e => e.status === 'approved_accountant' || e.status === 'rejected');

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Panel del Gestor</h1>
        <p className="text-muted-foreground mt-2">
          Revisión de movimientos contables de {companies.length} {companies.length === 1 ? 'empresa' : 'empresas'}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Empresas Asignadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{companies.length}</div>
          </CardContent>
        </Card>
        
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendientes de Revisar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-500">{pendingReviewEntries.length}</div>
          </CardContent>
        </Card>

        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Revisados Recientemente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600 dark:text-green-500">{reviewedEntries.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Últimos Movimientos a Revisar */}
      <Card className="mb-8 dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <FileText className="h-5 w-5" />
            Movimientos Pendientes de Revisión
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : pendingReviewEntries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay movimientos pendientes de revisión
            </div>
          ) : (
            <div className="space-y-3">
              {pendingReviewEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="border dark:border-gray-700 rounded-lg p-4 hover:bg-accent/50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                  onClick={() => setLocation(`/accountant/contabilidad?companyId=${entry.company.id}&entryId=${entry.id}`)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold text-gray-900 dark:text-gray-100">{entry.company.name}</span>
                        <Badge variant="outline" className="text-xs">{entry.company.cif}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Calendar className="h-4 w-4" />
                        {formatDate(entry.entryDate)}
                        {entry.refCode && <Badge variant="secondary" className="text-xs">#{entry.refCode}</Badge>}
                      </div>
                      <p className="font-medium mb-1 text-gray-900 dark:text-gray-100">{entry.description}</p>
                      <div className="flex items-center gap-3 text-sm">
                        <Badge variant={entry.type === 'income' ? 'default' : 'outline'}>
                          {entry.type === 'income' ? 'Ingreso' : 'Gasto'}
                        </Badge>
                        <span className="text-muted-foreground">{entry.category}</span>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">
                        {formatCurrency(entry.totalAmount)}
                      </div>
                      {getStatusBadge(entry.status)}
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end pt-3 border-t dark:border-gray-700">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReviewClick(entry, 'rejected')}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Rechazar
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleReviewClick(entry, 'approved')}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Aprobar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Últimos Movimientos Revisados */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <CheckCircle2 className="h-5 w-5" />
            Últimos Movimientos Revisados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reviewedEntries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay movimientos revisados recientemente
            </div>
          ) : (
            <div className="space-y-3">
              {reviewedEntries.slice(0, 10).map((entry) => (
                <div
                  key={entry.id}
                  className="border dark:border-gray-700 rounded-lg p-4 cursor-pointer"
                  onClick={() => setLocation(`/accountant/contabilidad?companyId=${entry.company.id}&entryId=${entry.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold text-gray-900 dark:text-gray-100">{entry.company.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Calendar className="h-4 w-4" />
                        {formatDate(entry.entryDate)}
                      </div>
                      <p className="text-sm mb-1 text-gray-900 dark:text-gray-100">{entry.description}</p>
                      {entry.accountantNotes && (
                        <p className="text-sm text-muted-foreground italic mt-2">
                          Notas: {entry.accountantNotes}
                        </p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-lg font-bold mb-2 text-gray-900 dark:text-gray-100">
                        {formatCurrency(entry.totalAmount)}
                      </div>
                      {getStatusBadge(entry.status)}
                      {entry.accountantReviewedAt && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatDate(entry.accountantReviewedAt)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Revisión */}
      <Dialog open={reviewDialog} onOpenChange={setReviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'approved' ? 'Aprobar Movimiento' : 'Rechazar Movimiento'}
            </DialogTitle>
            <DialogDescription>
              {selectedEntry && (
                <div className="mt-4 space-y-2">
                  <p><strong>Empresa:</strong> {selectedEntry.company.name}</p>
                  <p><strong>Descripción:</strong> {selectedEntry.description}</p>
                  <p><strong>Importe:</strong> {formatCurrency(selectedEntry.totalAmount)}</p>
                  <p><strong>Fecha:</strong> {formatDate(selectedEntry.entryDate)}</p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="notes">Notas (opcional)</Label>
              <Textarea
                id="notes"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Añade cualquier comentario o nota sobre esta revisión..."
                className="mt-2"
                rows={4}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setReviewDialog(false)}>
                Cancelar
              </Button>
              <Button
                variant={reviewAction === 'approved' ? 'default' : 'destructive'}
                onClick={handleConfirmReview}
                disabled={reviewMutation.isPending}
              >
                {reviewMutation.isPending ? 'Procesando...' : 
                  reviewAction === 'approved' ? 'Confirmar Aprobación' : 'Confirmar Rechazo'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
