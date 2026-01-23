import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from '@/hooks/use-auth';
import { useFeatureCheck } from '@/hooks/use-feature-check';
import { usePageTitle } from '@/hooks/use-page-title';
import FeatureRestrictedPage from '@/components/feature-restricted-page';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Receipt, Calendar, Upload, X, Paperclip, TrendingDown, Search, ChevronDown } from "lucide-react";
import { EmployeeTopBar } from '@/components/employee/employee-top-bar';
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { DatePickerDay } from '@/components/ui/date-picker';
import { apiRequest } from '@/lib/queryClient';
import { logger } from '@/lib/logger';

interface AccountingEntry {
  type: 'expense' | 'income';
  categoryId: number;
  category?: {
    id: number;
    name: string;
    color: string;
  };
  concept: string;
  description?: string;
  refCode?: string;
  totalAmount: string;
  amount: string;
  vatAmount?: string;
  entryDate: string;
  paymentMethod?: string;
  invoiceNumber?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewNotes?: string;
  isReimbursable?: boolean;
  attachmentsCount?: number;
  createdAt: string;
}

export default function EmployeeExpenses() {
  usePageTitle('Mis Gastos');
  const { user, company, token } = useAuth();
  const { hasAccess } = useFeatureCheck();
  const companyAlias = company?.companyAlias || '';
  
  const canAccessAccounting = hasAccess('accounting');

  if (!canAccessAccounting) {
    return (
      <FeatureRestrictedPage
        featureName="Gastos"
        description="No tienes acceso a la funcionalidad de gastos. Contacta con el administrador para activar este addon."
      />
    );
  }

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [manualMode, setManualMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados para OCR de tickets
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);

  // Buscar CRM addon
  const { data: crmAddonStatus } = useQuery({
    queryKey: ['/api/company/addons/crm/status'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/company/addons/crm/status', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          credentials: 'include',
        });
        if (!response.ok) return { active: false };
        return response.json();
      } catch (error) {
        console.error('Error fetching CRM addon status:', error);
        return { active: false };
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
    enabled: !!user?.companyId,
  });
  const hasCRMAddon = Boolean(crmAddonStatus?.active);

  // Estados para búsqueda de proyectos
  const [projectSearch, setProjectSearch] = useState('');
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);

  // Helper para obtener headers con token
  const getAuthHeaders = () => {
    return {
      'Authorization': `Bearer ${token}`,
    };
  };

  // Form state
  const [formData, setFormData] = useState({
    concept: '',
    amount: '',
    entryDate: new Date(),
    paymentMethod: 'cash',
    refCode: '',
  });

  // Obtener proyectos si CRM está activo
  const { data: projectsData = [] } = useQuery<Array<{ project: { id: number; name: string; code: string } }>>({
    queryKey: ['/api/employee/projects'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/employee/projects', {
          headers: getAuthHeaders(),
          credentials: 'include',
        });
        if (!response.ok) {
          return [];
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error('Error fetching projects:', error);
        return [];
      }
    },
    enabled: !!user?.companyId && hasCRMAddon,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  // Transformar y filtrar proyectos
  const projects = Array.isArray(projectsData)
    ? projectsData.map(p => ({
        id: p.project.id,
        name: p.project.name,
        code: p.project.code || '',
      }))
    : [];

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
    p.code.toLowerCase().includes(projectSearch.toLowerCase())
  );

  const selectedProject = formData.refCode
    ? projects.find(p => p.id.toString() === formData.refCode)
    : null;

  // Fetch my expenses
  const { data: expenses = [] } = useQuery<AccountingEntry[]>({
    queryKey: ['/api/accounting/entries', { type: 'expense' }],
  });

  // Create expense mutation
  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await fetch('/api/accounting/entries', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: data,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al crear el gasto');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/accounting/entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/accounting/dashboard'] });
      toast({ title: "Gasto enviado correctamente" });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete expense mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/accounting/entries/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Error al eliminar');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/accounting/entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/accounting/dashboard'] });
      toast({ title: "Gasto eliminado correctamente" });
    },
  });

  // Mapear valores del OCR a opciones válidas del select
  const mapPaymentMethod = (ocrValue: string | null): string => {
    if (!ocrValue) return 'card';
    const normalized = ocrValue.toLowerCase();
    
    if (normalized.includes('efectivo') || normalized.includes('cash')) return 'cash';
    if (normalized.includes('tarjeta') || normalized.includes('card') || normalized.includes('débito') || normalized.includes('crédito')) return 'card';
    if (normalized.includes('transferencia') || normalized.includes('transfer') || normalized.includes('bizum')) return 'transfer';
    
    // Por defecto, tarjeta (el más común)
    return 'card';
  };

  // Procesar OCR de un archivo de ticket
  const processReceiptOCR = async (file: File) => {
    // Solo procesar imágenes
    if (!file.type.startsWith('image/')) {
      return;
    }

    setIsProcessingOCR(true);

    try {
      const formDataOCR = new FormData();
      formDataOCR.append('receipt', file);

      const response = await fetch('/api/accounting/ocr-receipt', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: formDataOCR,
      });

      if (!response.ok) {
        let errorMessage = 'Error al procesar el ticket';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (e) {
          errorMessage = `Error ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const ocrData = await response.json();

      // Autocompletar campos del formulario con los datos del OCR
      setFormData(prev => ({
        ...prev,
        concept: ocrData.concept || prev.concept,
        amount: ocrData.totalAmount ? String(ocrData.totalAmount) : (ocrData.amount ? String(ocrData.amount) : prev.amount),
        entryDate: ocrData.date || prev.entryDate,
        paymentMethod: mapPaymentMethod(ocrData.paymentMethod),
      }));

      toast({
        title: 'Ticket procesado',
        description: 'Los datos se han extraído automáticamente. Revisa y confirma.',
      });
    } catch (error: any) {
      console.error('Error processing OCR:', error);
      toast({
        title: 'Error al procesar ticket',
        description: error.message || 'No se pudo extraer la información automáticamente. Completa los campos manualmente.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessingOCR(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...newFiles]);
      
      // Procesar OCR automáticamente si es la primera imagen
      if (selectedFiles.length === 0 && newFiles.length > 0 && newFiles[0].type.startsWith('image/')) {
        await processReceiptOCR(newFiles[0]);
      }
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      resetForm();
    }
  };

  const handleSubmit = () => {
    // Validate
    if (!formData.concept || !formData.amount || !formData.entryDate || !formData.paymentMethod) {
      toast({
        title: "Error",
        description: "Concepto, importe, fecha y método de pago son obligatorios",
        variant: "destructive",
      });
      return;
    }

    // Convert Date to string for API
    const entryDateStr = formData.entryDate instanceof Date 
      ? format(formData.entryDate, 'yyyy-MM-dd')
      : formData.entryDate;

    // Create FormData
    const formDataObj = new FormData();
    const payload: any = {
      concept: formData.concept.trim(),
      amount: parseFloat(formData.amount),
      vatAmount: 0,
      entryDate: entryDateStr,
      paymentMethod: formData.paymentMethod,
      type: 'expense',
    };

    if (formData.refCode.trim()) {
      payload.refCode = formData.refCode.trim();
    }

    formDataObj.append('data', JSON.stringify(payload));

    // Append files
    selectedFiles.forEach((file) => {
      formDataObj.append('receipts', file);
    });

    createMutation.mutate(formDataObj);
  };

  function resetForm() {
    setFormData({
      concept: '',
      amount: '',
      entryDate: new Date(),
      paymentMethod: 'cash',
      refCode: '',
    });
    setSelectedFiles([]);
    setManualMode(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  const getStatusBadge = (status: string) => {
    const config: Record<string, { className: string, label: string }> = {
      pending: { 
        className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800', 
        label: 'Pendiente' 
      },
      approved: { 
        className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800', 
        label: 'Aprobado' 
      },
      rejected: { 
        className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800', 
        label: 'Rechazado' 
      },
    };
    const { className, label } = config[status] || { 
      className: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400', 
      label: status 
    };
    return <Badge className={className}>{label}</Badge>;
  };

  const formatCurrency = (value: number | string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(num);
  };

  const pendingExpenses = expenses.filter((e) => e.status === 'pending');
  const approvedExpenses = expenses.filter((e) => e.status === 'approved');
  const rejectedExpenses = expenses.filter((e) => e.status === 'rejected');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-employee-gradient text-gray-900 dark:text-white flex flex-col page-scroll">
      {/* Header - Standard employee pattern */}
      <EmployeeTopBar homeHref={`/${companyAlias || 'test'}/inicio`} />

      {/* Page title */}
      <div className="px-6 pb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Mis Gastos</h1>
        <p className="text-gray-600 dark:text-white/70 text-sm">Sube tus tickets y gestiona tus gastos</p>
      </div>

      {/* Stats Cards */}
      <div className="px-6 pb-4">
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-white dark:bg-white/10 backdrop-blur-sm border-gray-200 dark:border-white/20">
            <CardContent className="p-4">
              <div className="text-xs text-gray-600 dark:text-white/70 mb-1">Pendientes</div>
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{pendingExpenses.length}</div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-white/10 backdrop-blur-sm border-gray-200 dark:border-white/20">
            <CardContent className="p-4">
              <div className="text-xs text-gray-600 dark:text-white/70 mb-1">Aprobados</div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{approvedExpenses.length}</div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-white/10 backdrop-blur-sm border-gray-200 dark:border-white/20">
            <CardContent className="p-4">
              <div className="text-xs text-gray-600 dark:text-white/70 mb-1">Rechazados</div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{rejectedExpenses.length}</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add button */}
      <div className="px-6 pb-4">
        <Button 
          onClick={() => setDialogOpen(true)}
          className="w-full bg-[#007AFF] hover:bg-[#0056CC] text-white border-0 py-6 text-lg font-medium rounded-xl shadow-lg"
        >
          <Plus className="h-5 w-5 mr-2" />
          Subir Nuevo Gasto
        </Button>
      </div>

      {/* Expenses List */}
      <div className="flex-1 px-6 pb-6 space-y-3">
        {expenses.length === 0 && (
          <Card className="bg-white dark:bg-white/10 backdrop-blur-sm border-gray-200 dark:border-white/20">
            <CardContent className="p-8 text-center">
              <Receipt className="h-12 w-12 mx-auto mb-4 text-gray-400 dark:text-white/40" />
              <p className="text-gray-600 dark:text-white/70">No tienes gastos registrados</p>
              <p className="text-sm text-gray-500 dark:text-white/50 mt-1">Sube tu primer ticket</p>
            </CardContent>
          </Card>
        )}

        {expenses.map((expense) => (
          <Card key={expense.id} className="bg-white dark:bg-white/10 backdrop-blur-sm border-gray-200 dark:border-white/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center flex-shrink-0">
                  <TrendingDown className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Header: Concept + Amount */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-base text-gray-900 dark:text-white">{expense.concept}</h3>
                    <div className="text-lg font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                      -{formatCurrency(expense.totalAmount)}
                    </div>
                  </div>

                  {/* Description */}
                  {expense.description && (
                    <p className="text-sm text-gray-600 dark:text-white/70 mb-2">{expense.description}</p>
                  )}

                  {/* Reference Code */}
                  {expense.refCode && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-2">
                      📋 Ref: {expense.refCode}
                    </p>
                  )}
                  
                  {/* Metadata row */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-white/50 mb-3">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(expense.entryDate), 'dd MMM yyyy', { locale: es })}
                    </div>
                    {expense.category && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: expense.category.color }} />
                        <span>{expense.category.name}</span>
                      </div>
                    )}
                    {expense.attachmentsCount && expense.attachmentsCount > 0 && (
                      <div className="flex items-center gap-1">
                        <Paperclip className="w-3 h-3" />
                        {expense.attachmentsCount}
                      </div>
                    )}
                  </div>

                  {/* Rejection notes */}
                  {expense.reviewNotes && expense.status === 'rejected' && (
                    <div className="mb-3 p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-400">
                      <strong className="font-semibold">Motivo rechazo:</strong> {expense.reviewNotes}
                    </div>
                  )}

                  {/* Actions row: Status badge + Delete button */}
                  <div className="flex items-center justify-between gap-2">
                    <div>{getStatusBadge(expense.status)}</div>
                    {expense.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(expense.id)}
                        className="h-8 px-3 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        <span className="text-xs">Eliminar</span>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Expense Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo Gasto</DialogTitle>
            <DialogDescription>
              {manualMode
                ? 'Introduce los datos del gasto y adjunta el ticket si lo tienes'
                : selectedFiles.length === 0 
                  ? 'Sube una foto del ticket para extraer los datos automáticamente'
                  : 'Revisa y confirma la información'}
            </DialogDescription>
          </DialogHeader>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload-employee"
            disabled={isProcessingOCR}
          />

          <div className="space-y-4">
            {/* Upload Area - Main focus when no files and not in manual mode */}
            {selectedFiles.length === 0 && !manualMode && (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
                    <Upload className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-white">
                    Subir ticket o recibo
                  </h3>
                </div>
                
                <div className="border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-lg bg-white dark:bg-gray-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors cursor-pointer">
                  <div
                    onClick={() => !isProcessingOCR && document.getElementById('file-upload-employee')?.click()}
                    className={`flex flex-col items-center justify-center py-4 px-4 ${isProcessingOCR ? 'opacity-60' : ''}`}
                  >
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-full mb-2">
                      <Paperclip className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mb-0.5">
                      Toca para subir o tomar una foto
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Imágenes (PNG, JPG) o PDF • Máx. 5MB
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <Button
                    variant="outline"
                    className="w-full justify-center border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-900/30"
                    onClick={() => {
                      setManualMode(true);
                      setSelectedFiles([]);
                    }}
                    disabled={isProcessingOCR}
                  >
                    Añadir gasto manual
                  </Button>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                    Rellena los datos a mano y adjunta el ticket si lo necesitas.
                  </p>
                </div>
              </div>
            )}

            {/* Estado de procesamiento OCR */}
            {selectedFiles.length > 0 && isProcessingOCR && (
              <div className="text-center space-y-4 py-12">
                <div className="flex justify-center">
                  <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center animate-pulse">
                    <Upload className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                    Leyendo el documento...
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Extrayendo información automáticamente
                  </p>
                </div>
              </div>
            )}

            {/* Form Fields - Show when manual mode or files present, after OCR */}
            {(manualMode || selectedFiles.length > 0) && !isProcessingOCR && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label>Concepto *</Label>
                    <Input
                      value={formData.concept}
                      onChange={(e) => setFormData({ ...formData, concept: e.target.value })}
                      placeholder="Ej: Dieta, gasolina, peaje..."
                    />
                  </div>

                  <div className="md:col-span-2">
                    {hasCRMAddon ? (
                      <div className="space-y-2">
                        <Label>Proyecto</Label>
                        <div className="relative">
                          <button
                            onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                            className="w-full flex items-center justify-between px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:border-gray-300 dark:hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <span className={selectedProject ? 'font-medium' : 'text-gray-500 dark:text-gray-400'}>
                              {selectedProject ? `${selectedProject.name}${selectedProject.code ? ` (${selectedProject.code})` : ''}` : 'Selecciona un proyecto'}
                            </span>
                            <ChevronDown className="w-4 h-4" />
                          </button>

                          {showProjectDropdown && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50">
                              <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                                <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 dark:bg-gray-700 rounded">
                                  <Search className="w-4 h-4 text-gray-500" />
                                  <input
                                    type="text"
                                    placeholder="Buscar proyecto..."
                                    value={projectSearch}
                                    onChange={(e) => setProjectSearch(e.target.value)}
                                    className="flex-1 bg-transparent outline-none text-sm text-gray-900 dark:text-white"
                                    autoFocus
                                  />
                                </div>
                              </div>
                              <div className="max-h-48 overflow-y-auto">
                                {filteredProjects.length > 0 ? (
                                  filteredProjects.map(project => (
                                    <button
                                      key={project.id}
                                      onClick={() => {
                                        setFormData({ ...formData, refCode: project.id.toString() });
                                        setShowProjectDropdown(false);
                                        setProjectSearch('');
                                      }}
                                      className={`w-full text-left px-3 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors ${
                                        selectedProject?.id === project.id ? 'bg-blue-100 dark:bg-blue-900/40 font-medium' : ''
                                      }`}
                                    >
                                      <div className="font-medium text-sm text-gray-900 dark:text-white">
                                        {project.name}
                                      </div>
                                      {project.code && (
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                          {project.code}
                                        </div>
                                      )}
                                    </button>
                                  ))
                                ) : (
                                  <div className="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                                    No se encontraron proyectos
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => {
                                  setFormData({ ...formData, refCode: '' });
                                  setShowProjectDropdown(false);
                                  setProjectSearch('');
                                }}
                                className="w-full text-left px-3 py-2 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                              >
                                Limpiar selección
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <Label>Código de referencia</Label>
                        <Input
                          value={formData.refCode}
                          onChange={(e) => setFormData({ ...formData, refCode: e.target.value })}
                          placeholder="Código de obra/pedido (opcional)"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <Label>Importe con IVA *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <Label>Fecha *</Label>
                    <DatePickerDay
                      date={formData.entryDate}
                      onDateChange={(date) => setFormData({ ...formData, entryDate: date || new Date() })}
                      placeholder="Selecciona fecha"
                      className="w-full justify-start h-10"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label>Método de Pago *</Label>
                    <Select
                      value={formData.paymentMethod}
                      onValueChange={(value) => setFormData({ ...formData, paymentMethod: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona método" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Efectivo</SelectItem>
                        <SelectItem value="card">Tarjeta</SelectItem>
                        <SelectItem value="transfer">Transferencia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Files List */}
                <div className="space-y-2">
                  {selectedFiles.length > 0 && (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {selectedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Paperclip className="h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                            <span className="text-sm truncate text-gray-900 dark:text-gray-100">{file.name}</span>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveFile(index)}
                            className="flex-shrink-0 h-8 w-8 p-0"
                          >
                            <X className="h-4 w-4 text-red-600 dark:text-red-400" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button
                    variant="outline"
                    className="w-full justify-center border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-900/30"
                    onClick={() => document.getElementById('file-upload-employee')?.click()}
                    disabled={isProcessingOCR}
                  >
                    <Paperclip className="h-4 w-4 mr-2" />
                    Adjuntar archivo
                  </Button>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="grid grid-cols-2 gap-3">
            <Button 
              variant="outline" 
              onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={createMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-600"
            >
              {createMutation.isPending ? 'Enviando...' : 'Enviar Gasto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

