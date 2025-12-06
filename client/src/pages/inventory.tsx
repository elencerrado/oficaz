import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { TabNavigation } from '@/components/ui/tab-navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { 
  Package, 
  Warehouse, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  AlertTriangle, 
  ArrowRightLeft,
  FileText,
  Download,
  ClipboardList,
  Tag,
  LayoutGrid,
  Clock,
  ChevronRight,
  Settings,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  SkipForward,
  RefreshCw
} from 'lucide-react';
import { useRef } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';

type Product = {
  id: number;
  name: string;
  sku: string;
  barcode: string | null;
  description: string | null;
  categoryId: number | null;
  unitOfMeasure: string;
  unitAbbreviation: string;
  costPrice: string;
  salePrice: string;
  vatRate: string;
  minStock: number;
  maxStock: number | null;
  isActive: boolean;
  isReturnable: boolean;
  isService: boolean;
};

type Category = {
  id: number;
  name: string;
  description: string | null;
  color: string | null;
};

type WarehouseType = {
  id: number;
  name: string;
  location: string | null;
  isDefault: boolean;
  isActive: boolean;
};

type Movement = {
  id: number;
  movementNumber: string;
  movementType: string;
  movementDate: string;
  status: string;
  total: string;
  relatedPartyName: string | null;
  createdBy: { fullName: string };
  lines: any[];
};

type DashboardStats = {
  totalProducts: number;
  totalCategories: number;
  totalWarehouses: number;
  lowStockCount: number;
  lowStockProducts: any[];
  overdueLoansCount: number;
  overdueLoans: any[];
  activeLoansCount: number;
  recentMovements: any[];
};

export default function Inventory() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  return (
    <div className="px-6 py-4 min-h-screen bg-gray-50 dark:bg-gray-900" style={{ overflowX: 'clip' }}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Inventario</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Gestiona productos, almacenes y movimientos de stock
        </p>
      </div>

      <TabNavigation
        tabs={[
          { id: 'dashboard', label: 'Panel', icon: LayoutGrid },
          { id: 'products', label: 'Productos', icon: Package },
          { id: 'movements', label: 'Movimientos', icon: ArrowRightLeft },
          { id: 'settings', label: 'Configuración', icon: Settings },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {activeTab === 'dashboard' && <DashboardTab />}
      {activeTab === 'products' && <ProductsTab searchTerm={searchTerm} setSearchTerm={setSearchTerm} />}
      {activeTab === 'movements' && <MovementsTab />}
      {activeTab === 'settings' && <SettingsTab />}
    </div>
  );
}

function DashboardTab() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/inventory/dashboard'],
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><LoadingSpinner /></div>;
  }

  const movementTypeLabels: Record<string, string> = {
    'in': 'Entrada',
    'out': 'Salida',
    'transfer': 'Transferencia',
    'adjustment': 'Ajuste',
    'loan': 'Préstamo',
    'return': 'Devolución',
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold dark:text-white">{stats?.totalProducts || 0}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Productos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <Warehouse className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold dark:text-white">{stats?.totalWarehouses || 0}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Almacenes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold dark:text-white">{stats?.lowStockCount || 0}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Stock bajo</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold dark:text-white">{stats?.activeLoansCount || 0}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Préstamos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {stats?.lowStockCount ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-5 w-5" />
                Alertas de Stock Bajo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.lowStockProducts.map((product: any) => (
                  <div key={product.id} className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                    <div>
                      <p className="font-medium dark:text-white">{product.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">SKU: {product.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{product.totalStock}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Mín: {product.minStock}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <Package className="h-5 w-5" />
                Stock Saludable
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500 dark:text-gray-400 text-center py-6">No hay productos con stock bajo</p>
            </CardContent>
          </Card>
        )}

        {stats?.overdueLoansCount ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <Clock className="h-5 w-5" />
                Préstamos Vencidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.overdueLoans.map((loan: any) => (
                  <div key={loan.id} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <div>
                      <p className="font-medium dark:text-white">{loan.product.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {loan.assignedToName || 'Sin asignar'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-red-600 dark:text-red-400">Vencido</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(loan.expectedReturnDate).toLocaleDateString('es-ES')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 dark:text-white">
                <ArrowRightLeft className="h-5 w-5" />
                Últimos Movimientos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.recentMovements.length ? (
                <div className="space-y-2">
                  {stats.recentMovements.slice(0, 5).map((movement: any) => (
                    <div key={movement.id} className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="dark:border-gray-600 dark:text-gray-300">{movementTypeLabels[movement.movementType] || movement.movementType}</Badge>
                        <span className="text-sm dark:text-white">{movement.movementNumber}</span>
                      </div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(movement.movementDate).toLocaleDateString('es-ES')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-6">No hay movimientos recientes</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

type BulkProduct = {
  rowNumber: number;
  name: string;
  sku: string;
  barcode: string | null;
  description: string | null;
  categoryId: number | null;
  categoryName: string | null;
  unitOfMeasure: string;
  unitAbbreviation: string;
  costPrice: string;
  salePrice: string;
  vatRate: string;
  minStock: number;
  maxStock: number | null;
  isActive: boolean;
  isReturnable: boolean;
  isService: boolean;
  isDuplicate: boolean;
  duplicateType: string | null;
  existingProduct: { id: number; name: string; sku: string; barcode?: string } | null;
};

type ValidationResult = {
  totalRows: number;
  validProducts: number;
  newProducts: number;
  duplicates: number;
  errors: { row: number; message: string }[];
  products: BulkProduct[];
};

function ProductsTab({ searchTerm, setSearchTerm }: { searchTerm: string; setSearchTerm: (s: string) => void }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedVatRate, setSelectedVatRate] = useState<string>('21');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const { toast } = useToast();
  
  // Bulk upload states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [currentConflictIndex, setCurrentConflictIndex] = useState(0);
  const [resolutions, setResolutions] = useState<Record<string, 'replace' | 'skip'>>({});
  const [isImporting, setIsImporting] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['/api/inventory/products', { search: searchTerm, categoryId: categoryFilter !== 'all' ? categoryFilter : undefined }],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/inventory/categories'],
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Product>) => apiRequest('POST', '/api/inventory/products', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/dashboard'] });
      setIsDialogOpen(false);
      setEditingProduct(null);
      toast({ title: 'Producto creado correctamente' });
    },
    onError: () => toast({ title: 'Error al crear producto', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Product> }) => 
      apiRequest('PATCH', `/api/inventory/products/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/dashboard'] });
      setIsDialogOpen(false);
      setEditingProduct(null);
      toast({ title: 'Producto actualizado correctamente' });
    },
    onError: () => toast({ title: 'Error al actualizar producto', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/inventory/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/dashboard'] });
      toast({ title: 'Producto eliminado' });
    },
    onError: () => toast({ title: 'Error al eliminar producto', variant: 'destructive' }),
  });

  // Bulk upload functions
  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch('/api/inventory/products/template', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Error downloading template');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'plantilla-productos.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast({ title: 'Error al descargar plantilla', variant: 'destructive' });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsValidating(true);
    setValidationResult(null);
    setResolutions({});
    setCurrentConflictIndex(0);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/inventory/products/bulk-validate', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Error validating file');
      }
      
      const result: ValidationResult = await response.json();
      setValidationResult(result);
      setShowBulkDialog(true);
    } catch (error: any) {
      toast({ title: error.message || 'Error al validar archivo', variant: 'destructive' });
    } finally {
      setIsValidating(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const duplicateProducts = validationResult?.products.filter(p => p.isDuplicate) || [];
  const currentConflict = duplicateProducts[currentConflictIndex];

  const handleResolveConflict = (action: 'replace' | 'skip') => {
    if (!currentConflict) return;
    setResolutions(prev => ({ ...prev, [currentConflict.sku]: action }));
    if (currentConflictIndex < duplicateProducts.length - 1) {
      setCurrentConflictIndex(prev => prev + 1);
    }
  };

  const handleResolveAll = (action: 'replace' | 'skip') => {
    const newResolutions: Record<string, 'replace' | 'skip'> = {};
    duplicateProducts.forEach(p => { newResolutions[p.sku] = action; });
    setResolutions(newResolutions);
    setCurrentConflictIndex(duplicateProducts.length - 1);
  };

  const handleImport = async () => {
    if (!validationResult) return;
    setIsImporting(true);
    
    try {
      const response = await apiRequest('POST', '/api/inventory/products/bulk-import', {
        products: validationResult.products,
        resolutions,
      });
      
      const result = response as { created: number; updated: number; skipped: number; errors: any[] };
      
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/dashboard'] });
      
      toast({
        title: 'Importación completada',
        description: `${result.created} creados, ${result.updated} actualizados, ${result.skipped} omitidos`,
      });
      
      setShowBulkDialog(false);
      setValidationResult(null);
    } catch (error: any) {
      toast({ title: 'Error en la importación', variant: 'destructive' });
    } finally {
      setIsImporting(false);
    }
  };

  const allConflictsResolved = duplicateProducts.every(p => resolutions[p.sku]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      sku: formData.get('sku') as string,
      barcode: formData.get('barcode') as string || null,
      description: formData.get('description') as string || null,
      categoryId: selectedCategoryId ? parseInt(selectedCategoryId) : null,
      unitOfMeasure: formData.get('unitOfMeasure') as string || 'unidad',
      unitAbbreviation: formData.get('unitAbbreviation') as string || 'ud.',
      costPrice: formData.get('costPrice') as string || '0',
      salePrice: formData.get('salePrice') as string || '0',
      vatRate: selectedVatRate,
      minStock: parseInt(formData.get('minStock') as string) || 0,
      maxStock: formData.get('maxStock') ? parseInt(formData.get('maxStock') as string) : null,
      isActive: formData.get('isActive') === 'on',
      isReturnable: formData.get('isReturnable') === 'on',
      isService: formData.get('isService') === 'on',
    };

    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por nombre o SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              data-testid="input-search-products"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-category-filter">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={handleDownloadTemplate} data-testid="button-download-template">
            <Download className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Plantilla</span>
          </Button>
          <Button 
            variant="outline" 
            onClick={() => fileInputRef.current?.click()}
            disabled={isValidating}
            data-testid="button-upload-excel"
          >
            {isValidating ? <LoadingSpinner /> : <Upload className="h-4 w-4 mr-2" />}
            <span className="hidden sm:inline">Carga masiva</span>
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button onClick={() => { 
              setEditingProduct(null); 
              setSelectedVatRate('21'); 
              setSelectedCategoryId(''); 
              setIsDialogOpen(true); 
            }} data-testid="button-add-product">
            <Plus className="h-4 w-4 mr-2" />
            Añadir Producto
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : filteredProducts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No hay productos todavía</p>
            <Button variant="outline" className="mt-4" onClick={() => { 
              setEditingProduct(null); 
              setSelectedVatRate('21'); 
              setSelectedCategoryId(''); 
              setIsDialogOpen(true); 
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Crear primer producto
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map(product => (
            <Card key={product.id} className="hover:shadow-md transition-shadow dark:bg-gray-800">
              <CardContent className="pt-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-medium dark:text-white">{product.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">SKU: {product.sku}</p>
                  </div>
                  <div className="flex gap-1">
                    {product.isReturnable && (
                      <Badge variant="secondary" className="text-xs">Retornable</Badge>
                    )}
                    {!product.isActive && (
                      <Badge variant="destructive" className="text-xs">Inactivo</Badge>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Coste:</span>
                    <span className="ml-1 font-medium dark:text-white">{parseFloat(product.costPrice).toFixed(2)} €</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Venta:</span>
                    <span className="ml-1 font-medium dark:text-white">{parseFloat(product.salePrice).toFixed(2)} €</span>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-3 border-t dark:border-gray-700">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Mín: {product.minStock} {product.unitAbbreviation}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { 
                        setEditingProduct(product); 
                        setSelectedVatRate(product.vatRate || '21'); 
                        setSelectedCategoryId(product.categoryId?.toString() || ''); 
                        setIsDialogOpen(true); 
                      }}
                      data-testid={`button-edit-product-${product.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-600"
                      onClick={() => {
                        if (confirm('¿Eliminar este producto?')) {
                          deleteMutation.mutate(product.id);
                        }
                      }}
                      data-testid={`button-delete-product-${product.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input 
                  id="name" 
                  name="name" 
                  defaultValue={editingProduct?.name} 
                  required 
                  data-testid="input-product-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sku">SKU *</Label>
                <Input 
                  id="sku" 
                  name="sku" 
                  defaultValue={editingProduct?.sku} 
                  required 
                  data-testid="input-product-sku"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="barcode">Código de barras</Label>
                <Input 
                  id="barcode" 
                  name="barcode" 
                  defaultValue={editingProduct?.barcode || ''} 
                  data-testid="input-product-barcode"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="categoryId">Categoría</Label>
                <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                  <SelectTrigger data-testid="select-product-category">
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea 
                id="description" 
                name="description" 
                defaultValue={editingProduct?.description || ''} 
                rows={2}
                data-testid="input-product-description"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="costPrice">Precio coste</Label>
                <Input 
                  id="costPrice" 
                  name="costPrice" 
                  type="number" 
                  step="0.01" 
                  defaultValue={editingProduct?.costPrice || '0'} 
                  data-testid="input-product-cost"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="salePrice">Precio venta</Label>
                <Input 
                  id="salePrice" 
                  name="salePrice" 
                  type="number" 
                  step="0.01" 
                  defaultValue={editingProduct?.salePrice || '0'} 
                  data-testid="input-product-sale"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vatRate">IVA (%)</Label>
                <Select value={selectedVatRate} onValueChange={setSelectedVatRate}>
                  <SelectTrigger data-testid="select-product-vat">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0%</SelectItem>
                    <SelectItem value="4">4%</SelectItem>
                    <SelectItem value="10">10%</SelectItem>
                    <SelectItem value="21">21%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="minStock">Stock mín.</Label>
                <Input 
                  id="minStock" 
                  name="minStock" 
                  type="number" 
                  defaultValue={editingProduct?.minStock || 0} 
                  data-testid="input-product-minstock"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="unitOfMeasure">Unidad de medida</Label>
                <Input 
                  id="unitOfMeasure" 
                  name="unitOfMeasure" 
                  defaultValue={editingProduct?.unitOfMeasure || 'unidad'} 
                  data-testid="input-product-unit"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unitAbbreviation">Abreviatura</Label>
                <Input 
                  id="unitAbbreviation" 
                  name="unitAbbreviation" 
                  defaultValue={editingProduct?.unitAbbreviation || 'ud.'} 
                  data-testid="input-product-unit-abbr"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch name="isActive" defaultChecked={editingProduct?.isActive ?? true} />
                <span className="text-sm dark:text-gray-300">Activo</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch name="isReturnable" defaultChecked={editingProduct?.isReturnable ?? false} />
                <span className="text-sm dark:text-gray-300">Retornable</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch name="isService" defaultChecked={editingProduct?.isService ?? false} />
                <span className="text-sm dark:text-gray-300">Es servicio</span>
              </label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-product">
                {createMutation.isPending || updateMutation.isPending ? 'Guardando...' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Carga Masiva de Productos
            </DialogTitle>
          </DialogHeader>

          {validationResult && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold dark:text-white">{validationResult.validProducts}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total válidos</p>
                </div>
                <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">{validationResult.newProducts}</p>
                  <p className="text-xs text-green-600 dark:text-green-400">Nuevos</p>
                </div>
                <div className="bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{validationResult.duplicates}</p>
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">Duplicados</p>
                </div>
                <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold text-red-700 dark:text-red-400">{validationResult.errors.length}</p>
                  <p className="text-xs text-red-600 dark:text-red-400">Errores</p>
                </div>
              </div>

              {/* Errors */}
              {validationResult.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium mb-1">Errores encontrados:</p>
                    <ul className="text-sm list-disc pl-4">
                      {validationResult.errors.slice(0, 5).map((err, i) => (
                        <li key={i}>Fila {err.row}: {err.message}</li>
                      ))}
                      {validationResult.errors.length > 5 && (
                        <li>...y {validationResult.errors.length - 5} más</li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Conflict Resolution */}
              {duplicateProducts.length > 0 && (
                <div className="border dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium dark:text-white">
                      Resolver conflictos ({currentConflictIndex + 1}/{duplicateProducts.length})
                    </h4>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleResolveAll('skip')}>
                        <SkipForward className="h-3 w-3 mr-1" />
                        Omitir todos
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleResolveAll('replace')}>
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Reemplazar todos
                      </Button>
                    </div>
                  </div>

                  {currentConflict && !resolutions[currentConflict.sku] && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-medium text-yellow-800 dark:text-yellow-300">
                            SKU duplicado: {currentConflict.sku}
                          </p>
                          <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-gray-500 dark:text-gray-400">Nuevo producto:</p>
                              <p className="font-medium dark:text-white">{currentConflict.name}</p>
                              <p className="text-xs text-gray-400">€{currentConflict.salePrice}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 dark:text-gray-400">Existente:</p>
                              <p className="font-medium dark:text-white">{currentConflict.existingProduct?.name}</p>
                              <p className="text-xs text-gray-400">SKU: {currentConflict.existingProduct?.sku}</p>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-3">
                            <Button size="sm" variant="outline" onClick={() => handleResolveConflict('skip')}>
                              <SkipForward className="h-3 w-3 mr-1" />
                              Omitir
                            </Button>
                            <Button size="sm" onClick={() => handleResolveConflict('replace')}>
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Reemplazar
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {allConflictsResolved && (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <span className="text-green-800 dark:text-green-300">
                        Todos los conflictos resueltos
                      </span>
                    </div>
                  )}
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => { setShowBulkDialog(false); setValidationResult(null); }}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleImport} 
                  disabled={isImporting || (duplicateProducts.length > 0 && !allConflictsResolved)}
                  data-testid="button-confirm-import"
                >
                  {isImporting ? 'Importando...' : `Importar ${validationResult.validProducts} productos`}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

type MovementLine = {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: string;
  vatRate: string;
};

function MovementsTab() {
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [movementType, setMovementType] = useState<string>('in');
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [destinationWarehouseId, setDestinationWarehouseId] = useState<string>('');
  const [relatedPartyName, setRelatedPartyName] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<MovementLine[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [lineQuantity, setLineQuantity] = useState('1');
  const { toast } = useToast();

  const { data: movements = [], isLoading } = useQuery<Movement[]>({
    queryKey: ['/api/inventory/movements', { type: typeFilter !== 'all' ? typeFilter : undefined }],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['/api/inventory/products'],
  });

  const { data: warehouses = [] } = useQuery<WarehouseType[]>({
    queryKey: ['/api/inventory/warehouses'],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/inventory/movements', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/movements'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/stock'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/dashboard'] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: 'Movimiento creado correctamente' });
    },
    onError: () => toast({ title: 'Error al crear movimiento', variant: 'destructive' }),
  });

  const resetForm = () => {
    setMovementType('in');
    setWarehouseId('');
    setDestinationWarehouseId('');
    setRelatedPartyName('');
    setNotes('');
    setLines([]);
    setSelectedProductId('');
    setLineQuantity('1');
  };

  const handleAddLine = () => {
    if (!selectedProductId) return;
    const product = products.find(p => p.id === parseInt(selectedProductId));
    if (!product) return;
    
    const qty = parseFloat(lineQuantity) || 1;
    setLines([...lines, {
      productId: product.id,
      productName: product.name,
      quantity: qty,
      unitPrice: product.salePrice,
      vatRate: product.vatRate,
    }]);
    setSelectedProductId('');
    setLineQuantity('1');
  };

  const handleRemoveLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleSubmit = (status: 'draft' | 'posted') => {
    if (!warehouseId || lines.length === 0) {
      toast({ title: 'Selecciona un almacén y añade al menos un producto', variant: 'destructive' });
      return;
    }
    if (movementType === 'transfer' && !destinationWarehouseId) {
      toast({ title: 'Selecciona almacén de destino para transferencias', variant: 'destructive' });
      return;
    }

    const warehouseIdNum = parseInt(warehouseId);
    const destWarehouseIdNum = movementType === 'transfer' ? parseInt(destinationWarehouseId) : null;

    createMutation.mutate({
      movementType,
      status,
      sourceWarehouseId: ['out', 'transfer', 'loan'].includes(movementType) ? warehouseIdNum : null,
      destinationWarehouseId: ['in', 'transfer', 'return'].includes(movementType) ? (destWarehouseIdNum || warehouseIdNum) : null,
      relatedPartyName: relatedPartyName || null,
      notes: notes || null,
      lines: lines.map(l => ({
        productId: l.productId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        vatRate: l.vatRate,
      })),
    });
  };

  const downloadPdf = async (movementId: number, movementNumber: string) => {
    try {
      const response = await fetch(`/api/inventory/movements/${movementId}/pdf`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Error downloading PDF');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `albaran-${movementNumber}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Error al descargar PDF', variant: 'destructive' });
    }
  };

  const typeLabels: Record<string, string> = {
    'in': 'Entrada',
    'out': 'Salida',
    'transfer': 'Transferencia',
    'adjustment': 'Ajuste',
    'loan': 'Préstamo',
    'return': 'Devolución',
  };

  const statusLabels: Record<string, { label: string; color: string }> = {
    'draft': { label: 'Borrador', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
    'posted': { label: 'Confirmado', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
    'cancelled': { label: 'Anulado', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  };

  const calculateTotal = () => {
    return lines.reduce((sum, line) => {
      const subtotal = line.quantity * parseFloat(line.unitPrice);
      const vat = subtotal * (parseFloat(line.vatRate) / 100);
      return sum + subtotal + vat;
    }, 0);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-movement-type-filter">
              <SelectValue placeholder="Tipo de movimiento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              <SelectItem value="in">Entrada</SelectItem>
              <SelectItem value="out">Salida</SelectItem>
              <SelectItem value="transfer">Transferencia</SelectItem>
              <SelectItem value="adjustment">Ajuste</SelectItem>
              <SelectItem value="loan">Préstamo</SelectItem>
              <SelectItem value="return">Devolución</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} data-testid="button-new-movement">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Movimiento
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : movements.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ArrowRightLeft className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No hay movimientos todavía</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {movements.map(movement => (
            <Card key={movement.id} className="hover:shadow-md transition-shadow dark:bg-gray-800">
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                      <span className="font-mono text-sm font-medium dark:text-white">{movement.movementNumber}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(movement.movementDate).toLocaleDateString('es-ES')}
                      </span>
                    </div>
                    <Badge variant="outline" className="dark:border-gray-600 dark:text-gray-300">{typeLabels[movement.movementType] || movement.movementType}</Badge>
                    <span className={`px-2 py-1 rounded text-xs ${statusLabels[movement.status]?.color || 'bg-gray-100 dark:bg-gray-700 dark:text-gray-300'}`}>
                      {statusLabels[movement.status]?.label || movement.status}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {movement.relatedPartyName && (
                      <span className="text-sm text-gray-600 dark:text-gray-400">{movement.relatedPartyName}</span>
                    )}
                    <span className="font-medium dark:text-white">{parseFloat(movement.total).toFixed(2)} €</span>
                    
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => downloadPdf(movement.id, movement.movementNumber)}
                        data-testid={`button-download-pdf-${movement.id}`}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" data-testid={`button-view-movement-${movement.id}`}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New Movement Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo Movimiento de Inventario</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="dark:text-gray-300">Tipo de movimiento *</Label>
                <Select value={movementType} onValueChange={setMovementType}>
                  <SelectTrigger data-testid="select-movement-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">Entrada</SelectItem>
                    <SelectItem value="out">Salida</SelectItem>
                    <SelectItem value="transfer">Transferencia</SelectItem>
                    <SelectItem value="adjustment">Ajuste</SelectItem>
                    <SelectItem value="loan">Préstamo</SelectItem>
                    <SelectItem value="return">Devolución</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="dark:text-gray-300">{movementType === 'transfer' ? 'Almacén origen *' : 'Almacén *'}</Label>
                <Select value={warehouseId} onValueChange={setWarehouseId}>
                  <SelectTrigger data-testid="select-warehouse">
                    <SelectValue placeholder="Seleccionar almacén" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.filter(w => w.isActive).map(w => (
                      <SelectItem key={w.id} value={w.id.toString()}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {movementType === 'transfer' && (
              <div>
                <Label className="dark:text-gray-300">Almacén destino *</Label>
                <Select value={destinationWarehouseId} onValueChange={setDestinationWarehouseId}>
                  <SelectTrigger data-testid="select-destination-warehouse">
                    <SelectValue placeholder="Seleccionar almacén destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.filter(w => w.isActive && w.id.toString() !== warehouseId).map(w => (
                      <SelectItem key={w.id} value={w.id.toString()}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label className="dark:text-gray-300">Cliente/Proveedor (opcional)</Label>
              <Input
                value={relatedPartyName}
                onChange={(e) => setRelatedPartyName(e.target.value)}
                placeholder="Nombre del cliente o proveedor"
                className="dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                data-testid="input-related-party"
              />
            </div>

            <div className="border dark:border-gray-700 rounded-lg p-4">
              <Label className="dark:text-gray-300 mb-2 block">Añadir productos</Label>
              <div className="flex gap-2">
                <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                  <SelectTrigger className="flex-1" data-testid="select-product">
                    <SelectValue placeholder="Seleccionar producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.filter(p => p.isActive).map(p => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.name} ({p.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="1"
                  value={lineQuantity}
                  onChange={(e) => setLineQuantity(e.target.value)}
                  className="w-20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                  placeholder="Cant."
                  data-testid="input-line-quantity"
                />
                <Button type="button" onClick={handleAddLine} disabled={!selectedProductId} data-testid="button-add-line">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {lines.length > 0 && (
                <div className="mt-4 space-y-2">
                  {lines.map((line, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-2 rounded">
                      <div>
                        <span className="font-medium dark:text-white">{line.productName}</span>
                        <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                          x{line.quantity} @ €{parseFloat(line.unitPrice).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium dark:text-white">
                          €{(line.quantity * parseFloat(line.unitPrice)).toFixed(2)}
                        </span>
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveLine(index)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-end pt-2 border-t dark:border-gray-700">
                    <span className="font-bold dark:text-white">Total: €{calculateTotal().toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label className="dark:text-gray-300">Notas (opcional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observaciones adicionales..."
                className="dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                data-testid="input-notes"
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button 
              variant="secondary"
              onClick={() => handleSubmit('draft')} 
              disabled={createMutation.isPending || lines.length === 0}
              data-testid="button-save-draft"
            >
              {createMutation.isPending ? 'Guardando...' : 'Guardar borrador'}
            </Button>
            <Button 
              onClick={() => handleSubmit('posted')} 
              disabled={createMutation.isPending || lines.length === 0}
              data-testid="button-confirm-movement"
            >
              {createMutation.isPending ? 'Confirmando...' : 'Confirmar y enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SettingsTab() {
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [warehouseDialogOpen, setWarehouseDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseType | null>(null);
  const { toast } = useToast();

  const { data: categories = [], isLoading: loadingCategories } = useQuery<Category[]>({
    queryKey: ['/api/inventory/categories'],
  });

  const { data: warehouses = [], isLoading: loadingWarehouses } = useQuery<WarehouseType[]>({
    queryKey: ['/api/inventory/warehouses'],
  });

  const createCategoryMutation = useMutation({
    mutationFn: (data: Partial<Category>) => apiRequest('POST', '/api/inventory/categories', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/categories'] });
      setCategoryDialogOpen(false);
      setEditingCategory(null);
      toast({ title: 'Categoría creada' });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Category> }) => 
      apiRequest('PATCH', `/api/inventory/categories/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/categories'] });
      setCategoryDialogOpen(false);
      setEditingCategory(null);
      toast({ title: 'Categoría actualizada' });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/inventory/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/categories'] });
      toast({ title: 'Categoría eliminada' });
    },
  });

  const createWarehouseMutation = useMutation({
    mutationFn: (data: Partial<WarehouseType>) => apiRequest('POST', '/api/inventory/warehouses', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/warehouses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/dashboard'] });
      setWarehouseDialogOpen(false);
      setEditingWarehouse(null);
      toast({ title: 'Almacén creado' });
    },
  });

  const updateWarehouseMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<WarehouseType> }) => 
      apiRequest('PATCH', `/api/inventory/warehouses/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/warehouses'] });
      setWarehouseDialogOpen(false);
      setEditingWarehouse(null);
      toast({ title: 'Almacén actualizado' });
    },
  });

  const deleteWarehouseMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/inventory/warehouses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/warehouses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/dashboard'] });
      toast({ title: 'Almacén eliminado' });
    },
  });

  const handleCategorySubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      description: formData.get('description') as string || null,
      color: formData.get('color') as string || null,
    };

    if (editingCategory) {
      updateCategoryMutation.mutate({ id: editingCategory.id, data });
    } else {
      createCategoryMutation.mutate(data);
    }
  };

  const handleWarehouseSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      location: formData.get('location') as string || null,
      isDefault: formData.get('isDefault') === 'on',
      isActive: formData.get('isActive') === 'on',
    };

    if (editingWarehouse) {
      updateWarehouseMutation.mutate({ id: editingWarehouse.id, data });
    } else {
      createWarehouseMutation.mutate(data);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="dark:bg-gray-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 dark:text-white">
            <Tag className="h-5 w-5" />
            Categorías
          </CardTitle>
          <Button size="sm" onClick={() => { setEditingCategory(null); setCategoryDialogOpen(true); }} data-testid="button-add-category">
            <Plus className="h-4 w-4 mr-1" />
            Añadir
          </Button>
        </CardHeader>
        <CardContent>
          {loadingCategories ? (
            <div className="flex justify-center py-4"><LoadingSpinner /></div>
          ) : categories.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">No hay categorías</p>
          ) : (
            <div className="space-y-2">
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center justify-between p-3 border dark:border-gray-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    {cat.color && (
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                    )}
                    <div>
                      <p className="font-medium dark:text-white">{cat.name}</p>
                      {cat.description && <p className="text-xs text-gray-500 dark:text-gray-400">{cat.description}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => { setEditingCategory(cat); setCategoryDialogOpen(true); }}
                      data-testid={`button-edit-category-${cat.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-red-500"
                      onClick={() => confirm('¿Eliminar esta categoría?') && deleteCategoryMutation.mutate(cat.id)}
                      data-testid={`button-delete-category-${cat.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="dark:bg-gray-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 dark:text-white">
            <Warehouse className="h-5 w-5" />
            Almacenes
          </CardTitle>
          <Button size="sm" onClick={() => { setEditingWarehouse(null); setWarehouseDialogOpen(true); }} data-testid="button-add-warehouse">
            <Plus className="h-4 w-4 mr-1" />
            Añadir
          </Button>
        </CardHeader>
        <CardContent>
          {loadingWarehouses ? (
            <div className="flex justify-center py-4"><LoadingSpinner /></div>
          ) : warehouses.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">No hay almacenes</p>
          ) : (
            <div className="space-y-2">
              {warehouses.map(wh => (
                <div key={wh.id} className="flex items-center justify-between p-3 border dark:border-gray-700 rounded-lg">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium dark:text-white">{wh.name}</p>
                      {wh.isDefault && <Badge variant="secondary" className="text-xs">Principal</Badge>}
                      {!wh.isActive && <Badge variant="destructive" className="text-xs">Inactivo</Badge>}
                    </div>
                    {wh.location && <p className="text-xs text-gray-500 dark:text-gray-400">{wh.location}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => { setEditingWarehouse(wh); setWarehouseDialogOpen(true); }}
                      data-testid={`button-edit-warehouse-${wh.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-red-500"
                      onClick={() => confirm('¿Eliminar este almacén?') && deleteWarehouseMutation.mutate(wh.id)}
                      data-testid={`button-delete-warehouse-${wh.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCategorySubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cat-name">Nombre *</Label>
              <Input id="cat-name" name="name" defaultValue={editingCategory?.name} required data-testid="input-category-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-description">Descripción</Label>
              <Textarea id="cat-description" name="description" defaultValue={editingCategory?.description || ''} rows={2} data-testid="input-category-description" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-color">Color</Label>
              <Input id="cat-color" name="color" type="color" defaultValue={editingCategory?.color || '#007AFF'} className="h-10 w-20" data-testid="input-category-color" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCategoryDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" data-testid="button-save-category">Guardar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={warehouseDialogOpen} onOpenChange={setWarehouseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingWarehouse ? 'Editar Almacén' : 'Nuevo Almacén'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleWarehouseSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wh-name">Nombre *</Label>
              <Input id="wh-name" name="name" defaultValue={editingWarehouse?.name} required data-testid="input-warehouse-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wh-location">Ubicación</Label>
              <Input id="wh-location" name="location" defaultValue={editingWarehouse?.location || ''} data-testid="input-warehouse-location" />
            </div>
            <div className="flex flex-wrap gap-4 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch name="isDefault" defaultChecked={editingWarehouse?.isDefault ?? false} />
                <span className="text-sm dark:text-gray-300">Almacén principal</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch name="isActive" defaultChecked={editingWarehouse?.isActive ?? true} />
                <span className="text-sm dark:text-gray-300">Activo</span>
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setWarehouseDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" data-testid="button-save-warehouse">Guardar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
