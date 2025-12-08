import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { TabNavigation } from '@/components/ui/tab-navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import StatsCard, { StatsCardGrid } from '@/components/StatsCard';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { getAuthHeaders } from '@/lib/auth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { usePageHeader } from '@/components/layout/page-header';
import { usePageTitle } from '@/hooks/use-page-title';
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
  RefreshCw,
  RotateCcw,
  Eye,
  Check,
  ChevronsUpDown
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
  usePageTitle('Inventario');
  const { setHeader, resetHeader } = usePageHeader();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  // Set page header
  useEffect(() => {
    setHeader({
      title: 'Inventario',
      subtitle: 'Gestiona productos, almacenes y movimientos de stock'
    });
    return resetHeader;
  }, []);

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/inventory/dashboard'],
  });

  return (
    <div>
      <StatsCardGrid columns={4}>
        <StatsCard
          icon={Package}
          label="Productos"
          value={stats?.totalProducts || 0}
          color="blue"
          isLoading={statsLoading}
          index={0}
          data-testid="stat-total-products"
        />
        <StatsCard
          icon={Warehouse}
          label="Almacenes"
          value={stats?.totalWarehouses || 0}
          color="green"
          isLoading={statsLoading}
          index={1}
          data-testid="stat-total-warehouses"
        />
        <StatsCard
          icon={AlertTriangle}
          label="Stock bajo"
          value={stats?.lowStockCount || 0}
          color="amber"
          isLoading={statsLoading}
          index={2}
          data-testid="stat-low-stock"
        />
        <StatsCard
          icon={Clock}
          label="Préstamos"
          value={stats?.activeLoansCount || 0}
          color="purple"
          isLoading={statsLoading}
          index={3}
          data-testid="stat-active-loans"
        />
      </StatsCardGrid>

      <TabNavigation
        tabs={[
          { id: 'dashboard', label: 'Panel', icon: LayoutGrid },
          { id: 'products', label: 'Productos', icon: Package },
          { id: 'movements', label: 'Mov.', icon: ArrowRightLeft },
          { id: 'settings', label: 'Config', icon: Settings },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {activeTab === 'dashboard' && <DashboardTab stats={stats} isLoading={statsLoading} />}
      {activeTab === 'products' && <ProductsTab searchTerm={searchTerm} setSearchTerm={setSearchTerm} />}
      {activeTab === 'movements' && <MovementsTab />}
      {activeTab === 'settings' && <SettingsTab />}
    </div>
  );
}

function DashboardTab({ stats, isLoading }: { stats: DashboardStats | undefined; isLoading: boolean }) {
  const movementTypeLabels: Record<string, string> = {
    'in': 'Compra',
    'out': 'Venta',
    'internal': 'Interno',
    'loan': 'Préstamo',
    'return': 'Devolución',
  };
  
  const getMovementLabel = (movement: Movement) => {
    if (movement.movementType === 'internal') {
      const reason = (movement as any).internalReason;
      if (reason === 'transfer') {
        return 'Transferencia';
      }
      const direction = (movement as any).adjustmentDirection;
      return direction === 'remove' ? 'Ajuste (-)' : 'Ajuste (+)';
    }
    return movementTypeLabels[movement.movementType] || movement.movementType;
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><LoadingSpinner /></div>;
  }

  return (
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
                        <Badge variant="outline" className="dark:border-gray-600 dark:text-gray-300">{getMovementLabel(movement)}</Badge>
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
  const [warehouseFilter, setWarehouseFilter] = useState<string>('default');
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [selectedVatRate, setSelectedVatRate] = useState<string>('21');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const { toast } = useToast();
  
  // Bulk upload states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [currentConflictIndex, setCurrentConflictIndex] = useState(0);
  const [resolutions, setResolutions] = useState<Record<string, 'replace' | 'skip'>>({});
  const [isImporting, setIsImporting] = useState(false);
  const [productModalTab, setProductModalTab] = useState<'individual' | 'bulk'>('individual');

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['/api/inventory/products', { search: searchTerm, categoryId: categoryFilter !== 'all' ? categoryFilter : undefined }],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/inventory/categories'],
  });

  const { data: warehouses = [] } = useQuery<WarehouseType[]>({
    queryKey: ['/api/inventory/warehouses'],
  });

  // Find default warehouse
  const defaultWarehouse = warehouses.find(w => w.isDefault);

  // Stock data to show quantities
  const { data: stockData = [] } = useQuery<{ productId: number; warehouseId: number; quantity: string; warehouseName: string }[]>({
    queryKey: ['/api/inventory/stock'],
  });

  // Get the effective warehouse ID for filtering
  const effectiveWarehouseId = warehouseFilter === 'default' 
    ? defaultWarehouse?.id 
    : warehouseFilter === 'all' 
      ? null 
      : parseInt(warehouseFilter);

  // Aggregate stock by product (filtered by warehouse)
  const stockByProduct = stockData.reduce((acc, item) => {
    // If filtering by a specific warehouse, only count that warehouse's stock
    if (effectiveWarehouseId !== null && item.warehouseId !== effectiveWarehouseId) {
      return acc;
    }
    if (!acc[item.productId]) acc[item.productId] = 0;
    acc[item.productId] += parseFloat(item.quantity) || 0;
    return acc;
  }, {} as Record<number, number>);

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
  const handleDownloadTemplate = () => {
    const a = document.createElement('a');
    a.href = '/templates/plantilla-productos.xlsx';
    a.download = 'plantilla-productos.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
        headers: getAuthHeaders(),
        body: formData,
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Error validating file');
      }
      
      const result: ValidationResult = await response.json();
      setValidationResult(result);
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
      
      setIsDialogOpen(false);
      setValidationResult(null);
      setProductModalTab('individual');
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

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const stock = stockByProduct[p.id] || 0;
    const matchesStock = !inStockOnly || stock > 0;
    return matchesSearch && matchesStock;
  });

  return (
    <div className="space-y-4">
      {/* Desktop filters */}
      <div className="hidden md:flex gap-3 justify-between">
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
          <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
            <SelectTrigger className="w-[200px]" data-testid="select-warehouse-filter">
              <SelectValue placeholder="Almacén" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">{defaultWarehouse?.name || 'Almacén Principal'}</SelectItem>
              <SelectItem value="all">Todos los almacenes</SelectItem>
              {warehouses.filter(w => !w.isDefault).map(wh => (
                <SelectItem key={wh.id} value={String(wh.id)}>{wh.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={inStockOnly ? "default" : "outline"}
            onClick={() => setInStockOnly(!inStockOnly)}
            className={inStockOnly ? "bg-green-600 hover:bg-green-700" : ""}
            data-testid="button-in-stock-filter"
          >
            <Package className="h-4 w-4 mr-2" />
            En stock
          </Button>
        </div>
        <div className="flex gap-2">
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
      
      {/* Mobile filters */}
      <div className="md:hidden space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search-products-mobile"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger data-testid="select-category-filter-mobile">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
            <SelectTrigger data-testid="select-warehouse-filter-mobile">
              <SelectValue placeholder="Almacén" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">{defaultWarehouse?.name || 'Principal'}</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
              {warehouses.filter(w => !w.isDefault).map(wh => (
                <SelectItem key={wh.id} value={String(wh.id)}>{wh.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={inStockOnly ? "default" : "outline"}
            onClick={() => setInStockOnly(!inStockOnly)}
            className={`${inStockOnly ? "bg-green-600 hover:bg-green-700" : ""} text-sm`}
            data-testid="button-in-stock-filter-mobile"
          >
            <Package className="h-4 w-4 mr-1" />
            En stock
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
            }} data-testid="button-add-product-mobile" className="text-sm">
            <Plus className="h-4 w-4 mr-1" />
            Añadir
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
        <Card className="dark:bg-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            {/* Desktop Table */}
            <table className="w-full hidden md:table">
              <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="text-left py-4 px-5 font-medium text-gray-600 dark:text-gray-400 text-sm">Producto</th>
                  <th className="text-left py-4 px-5 font-medium text-gray-600 dark:text-gray-400 text-sm">SKU</th>
                  <th className="text-right py-4 px-5 font-medium text-gray-600 dark:text-gray-400 text-sm">Stock</th>
                  <th className="text-right py-4 px-5 font-medium text-gray-600 dark:text-gray-400 text-sm">Mín.</th>
                  <th className="text-right py-4 px-5 font-medium text-gray-600 dark:text-gray-400 text-sm">Coste</th>
                  <th className="text-right py-4 px-5 font-medium text-gray-600 dark:text-gray-400 text-sm">Venta</th>
                  <th className="text-center py-4 px-5 font-medium text-gray-600 dark:text-gray-400 text-sm w-[100px]">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredProducts.map(product => {
                  const stock = stockByProduct[product.id] || 0;
                  const isLowStock = stock < product.minStock;
                  return (
                    <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-medium dark:text-white">{product.name}</p>
                            <div className="flex gap-1 mt-1">
                              {product.isReturnable && <Badge variant="secondary" className="text-[10px] py-0">Retornable</Badge>}
                              {!product.isActive && <Badge variant="destructive" className="text-[10px] py-0">Inactivo</Badge>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <span className="font-mono text-sm text-gray-600 dark:text-gray-400">{product.sku}</span>
                      </td>
                      <td className="py-4 px-5 text-right">
                        <span className={`font-semibold text-lg ${isLowStock ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                          {stock}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">{product.unitAbbreviation}</span>
                        {isLowStock && <AlertTriangle className="h-4 w-4 inline-block ml-1 text-red-500" />}
                      </td>
                      <td className="py-4 px-5 text-right">
                        <span className="text-gray-600 dark:text-gray-400">{product.minStock}</span>
                      </td>
                      <td className="py-4 px-5 text-right">
                        <span className="text-gray-600 dark:text-gray-400">{parseFloat(product.costPrice).toFixed(2)} €</span>
                      </td>
                      <td className="py-4 px-5 text-right">
                        <span className="font-medium dark:text-white">{parseFloat(product.salePrice).toFixed(2)} €</span>
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { 
                              setEditingProduct(product); 
                              const vatValue = product.vatRate ? String(parseInt(product.vatRate)) : '21';
                              setSelectedVatRate(vatValue); 
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
                              setProductToDelete(product);
                              setDeleteConfirmOpen(true);
                            }}
                            data-testid={`button-delete-product-${product.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile List */}
            <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-700">
              {filteredProducts.map(product => {
                const stock = stockByProduct[product.id] || 0;
                const isLowStock = stock < product.minStock;
                return (
                  <div key={product.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="font-medium dark:text-white">{product.name}</p>
                        <p className="text-sm font-mono text-gray-500 dark:text-gray-400">{product.sku}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold text-lg ${isLowStock ? 'text-red-600' : 'dark:text-white'}`}>
                          {stock} <span className="text-xs font-normal text-gray-500">{product.unitAbbreviation}</span>
                          {isLowStock && <AlertTriangle className="h-4 w-4 inline-block ml-1 text-red-500" />}
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex gap-3 text-sm text-gray-500 dark:text-gray-400">
                        <span>Mín: {product.minStock}</span>
                        <span>Venta: {parseFloat(product.salePrice).toFixed(2)} €</span>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { 
                            setEditingProduct(product); 
                            const vatValue = product.vatRate ? String(parseInt(product.vatRate)) : '21';
                            setSelectedVatRate(vatValue); 
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
                            setProductToDelete(product);
                            setDeleteConfirmOpen(true);
                          }}
                          data-testid={`button-delete-product-${product.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={(open) => { 
        setIsDialogOpen(open); 
        if (!open) {
          setValidationResult(null);
          setProductModalTab('individual');
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Editar Producto' : 'Añadir Productos'}</DialogTitle>
          </DialogHeader>
          
          {editingProduct ? (
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
          ) : (
            <div className="space-y-4">
              {/* Mode Toggle - Apple-style segmented control */}
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-1 flex">
                <button
                  type="button"
                  onClick={() => setProductModalTab('individual')}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    productModalTab === 'individual'
                      ? 'bg-white dark:bg-gray-700 text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  data-testid="product-mode-individual"
                >
                  <Package className="h-4 w-4" />
                  Individual
                </button>
                <button
                  type="button"
                  onClick={() => setProductModalTab('bulk')}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    productModalTab === 'bulk'
                      ? 'bg-white dark:bg-gray-700 text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  data-testid="product-mode-bulk"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Carga masiva
                </button>
              </div>

              {productModalTab === 'individual' && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nombre *</Label>
                      <Input 
                        id="name" 
                        name="name" 
                        required 
                        data-testid="input-product-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sku">SKU *</Label>
                      <Input 
                        id="sku" 
                        name="sku" 
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
                        defaultValue="0"
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
                        defaultValue="0"
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
                        defaultValue={0}
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
                        defaultValue="unidad"
                        data-testid="input-product-unit"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="unitAbbreviation">Abreviatura</Label>
                      <Input 
                        id="unitAbbreviation" 
                        name="unitAbbreviation" 
                        defaultValue="ud."
                        data-testid="input-product-unit-abbr"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Switch name="isActive" defaultChecked={true} />
                      <span className="text-sm dark:text-gray-300">Activo</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Switch name="isReturnable" defaultChecked={false} />
                      <span className="text-sm dark:text-gray-300">Retornable</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Switch name="isService" defaultChecked={false} />
                      <span className="text-sm dark:text-gray-300">Es servicio</span>
                    </label>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-product">
                      {createMutation.isPending ? 'Guardando...' : 'Guardar'}
                    </Button>
                  </DialogFooter>
                </form>
              )}

              {productModalTab === 'bulk' && (
                <>
                {!validationResult ? (
                  <div className="space-y-6">
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4" />
                        ¿Cómo funciona?
                      </h4>
                      <ol className="text-sm text-blue-700 dark:text-blue-400 space-y-1 list-decimal pl-4">
                        <li>Descarga la plantilla Excel con el formato correcto</li>
                        <li>Rellena los productos en la hoja "Productos"</li>
                        <li>Los campos Nombre y SKU son obligatorios</li>
                        <li>Si pones una categoría que no existe, se creará automáticamente</li>
                        <li>Sube el archivo para validar e importar</li>
                      </ol>
                    </div>

                    <div className="flex flex-col gap-4">
                      <div className="border-2 border-dashed dark:border-gray-700 rounded-lg p-8 text-center">
                        <Upload className="h-10 w-10 mx-auto text-gray-400 mb-3" />
                        <p className="text-gray-600 dark:text-gray-400 mb-3">
                          Arrastra un archivo Excel o haz clic para seleccionar
                        </p>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".xlsx,.xls"
                          className="hidden"
                          onChange={handleFileUpload}
                        />
                        <Button 
                          variant="outline" 
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isValidating}
                        >
                          {isValidating ? <LoadingSpinner /> : <Upload className="h-4 w-4 mr-2" />}
                          Seleccionar archivo
                        </Button>
                      </div>

                      <div className="flex justify-center">
                        <Button variant="link" onClick={handleDownloadTemplate} className="text-blue-600 dark:text-blue-400">
                          <Download className="h-4 w-4 mr-2" />
                          Descargar plantilla Excel
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
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

                    {/* Lista de productos a importar */}
                    {validationResult.products.length > 0 && (
                      <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                        <div className="bg-gray-50 dark:bg-gray-800 px-3 py-2 border-b dark:border-gray-700">
                          <h4 className="font-medium text-sm dark:text-white">Productos a importar</h4>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                              <tr className="text-left text-gray-500 dark:text-gray-400">
                                <th className="px-3 py-2 font-medium">SKU</th>
                                <th className="px-3 py-2 font-medium">Nombre</th>
                                <th className="px-3 py-2 font-medium">Categoría</th>
                                <th className="px-3 py-2 font-medium text-right">Precio</th>
                                <th className="px-3 py-2 font-medium text-center">Estado</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-gray-700">
                              {validationResult.products.map((product, idx) => (
                                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                  <td className="px-3 py-2 font-mono text-xs dark:text-gray-300">{product.sku}</td>
                                  <td className="px-3 py-2 dark:text-white">{product.name}</td>
                                  <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{product.categoryName || '-'}</td>
                                  <td className="px-3 py-2 text-right dark:text-gray-300">€{parseFloat(product.salePrice).toFixed(2)}</td>
                                  <td className="px-3 py-2 text-center">
                                    {product.isDuplicate ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                                        Duplicado
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                        Nuevo
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

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
                                    <p className="text-gray-500 dark:text-gray-400">Nuevo:</p>
                                    <p className="font-medium dark:text-white">{currentConflict.name}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-500 dark:text-gray-400">Existente:</p>
                                    <p className="font-medium dark:text-white">{currentConflict.existingProduct?.name}</p>
                                  </div>
                                </div>
                                <div className="flex gap-2 mt-3">
                                  <Button size="sm" variant="outline" onClick={() => handleResolveConflict('skip')}>
                                    Omitir
                                  </Button>
                                  <Button size="sm" onClick={() => handleResolveConflict('replace')}>
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
                      <Button variant="outline" onClick={() => setValidationResult(null)}>
                        Volver
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
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription>
              {productToDelete && (
                <>
                  Vas a eliminar <strong>{productToDelete.name}</strong> (SKU: {productToDelete.sku}).
                  Esta acción no se puede deshacer.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (productToDelete) {
                  deleteMutation.mutate(productToDelete.id);
                  setDeleteConfirmOpen(false);
                  setProductToDelete(null);
                }
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  const [editingMovement, setEditingMovement] = useState<Movement | null>(null);
  const [movementType, setMovementType] = useState<string>('in');
  const [internalReason, setInternalReason] = useState<string>('adjustment');
  const [adjustmentDirection, setAdjustmentDirection] = useState<string>('add');
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [destinationWarehouseId, setDestinationWarehouseId] = useState<string>('');
  const [relatedPartyName, setRelatedPartyName] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<MovementLine[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [lineQuantity, setLineQuantity] = useState('1');
  const [revertConfirm, setRevertConfirm] = useState<{ open: boolean; movement: Movement | null }>({ open: false, movement: null });
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; movement: Movement | null }>({ open: false, movement: null });
  const [viewDialog, setViewDialog] = useState<{ open: boolean; movement: any | null; loading: boolean }>({ open: false, movement: null, loading: false });
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

  // Stock data para verificar disponibilidad
  const { data: stockData = [] } = useQuery<{ productId: number; warehouseId: number; quantity: string; warehouseName: string }[]>({
    queryKey: ['/api/inventory/stock'],
  });

  // Aggregate stock by product and warehouse
  const getProductStock = (productId: number, warehouseId?: number) => {
    if (warehouseId) {
      const stock = stockData.find(s => s.productId === productId && s.warehouseId === warehouseId);
      return stock ? parseFloat(stock.quantity) : 0;
    }
    // Total across all warehouses
    return stockData
      .filter(s => s.productId === productId)
      .reduce((sum, s) => sum + parseFloat(s.quantity), 0);
  };

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

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest('PATCH', `/api/inventory/movements/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/movements'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/stock'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/dashboard'] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: 'Movimiento actualizado correctamente' });
    },
    onError: () => toast({ title: 'Error al actualizar movimiento', variant: 'destructive' }),
  });

  const revertToDraftMutation = useMutation({
    mutationFn: (id: number) => apiRequest('PATCH', `/api/inventory/movements/${id}`, { status: 'draft' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/movements'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/stock'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/dashboard'] });
      toast({ title: 'Movimiento revertido a borrador. El stock ha sido restaurado.' });
    },
    onError: () => toast({ title: 'Error al revertir movimiento', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/inventory/movements/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/movements'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/stock'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/dashboard'] });
      toast({ title: 'Movimiento eliminado correctamente' });
    },
    onError: () => toast({ title: 'Error al eliminar movimiento', variant: 'destructive' }),
  });

  const resetForm = () => {
    setEditingMovement(null);
    setMovementType('in');
    setInternalReason('adjustment');
    setAdjustmentDirection('add');
    setWarehouseId('');
    setDestinationWarehouseId('');
    setRelatedPartyName('');
    setNotes('');
    setLines([]);
    setSelectedProductId('');
    setLineQuantity('1');
  };

  const openEditDialog = async (movement: Movement) => {
    try {
      const fullMovement = await apiRequest('GET', `/api/inventory/movements/${movement.id}`) as any;
      
      setEditingMovement(fullMovement);
      setMovementType(fullMovement.movementType);
      setInternalReason(fullMovement.internalReason || 'adjustment');
      setAdjustmentDirection(fullMovement.adjustmentDirection || 'add');
      setWarehouseId((fullMovement.sourceWarehouseId || fullMovement.destinationWarehouseId || '').toString());
      setDestinationWarehouseId((fullMovement.destinationWarehouseId || '').toString());
      setRelatedPartyName(fullMovement.relatedPartyName || '');
      setNotes(fullMovement.notes || '');
      
      if (fullMovement.lines && Array.isArray(fullMovement.lines)) {
        const loadedLines: MovementLine[] = fullMovement.lines.map((line: any) => ({
          productId: line.productId,
          productName: line.product?.name || `Producto ${line.productId}`,
          quantity: parseFloat(line.quantity),
          unitPrice: line.unitPrice,
          vatRate: line.vatRate,
        }));
        setLines(loadedLines);
      }
      
      setIsDialogOpen(true);
    } catch {
      toast({ title: 'Error al cargar el movimiento', variant: 'destructive' });
    }
  };

  const openViewDialog = async (movement: Movement) => {
    setViewDialog({ open: true, movement: null, loading: true });
    try {
      const fullMovement = await apiRequest('GET', `/api/inventory/movements/${movement.id}`) as any;
      setViewDialog({ open: true, movement: fullMovement, loading: false });
    } catch {
      toast({ title: 'Error al cargar el movimiento', variant: 'destructive' });
      setViewDialog({ open: false, movement: null, loading: false });
    }
  };

  const handleAddLine = () => {
    if (!selectedProductId) return;
    const product = products.find(p => p.id === parseInt(selectedProductId));
    if (!product) return;
    
    const qty = parseFloat(lineQuantity) || 1;
    
    // Check stock for outgoing movements (out, internal transfer, loan)
    const isOutgoing = movementType === 'out' || movementType === 'loan' || (movementType === 'internal' && internalReason === 'transfer');
    if (isOutgoing) {
      const currentStock = getProductStock(product.id, warehouseId ? parseInt(warehouseId) : undefined);
      // Sum quantities already added for this product
      const alreadyAdded = lines.filter(l => l.productId === product.id).reduce((sum, l) => sum + l.quantity, 0);
      const totalRequested = alreadyAdded + qty;
      
      if (totalRequested > currentStock) {
        toast({
          title: '⚠️ Stock insuficiente',
          description: `Solo hay ${currentStock} unidades de "${product.name}" disponibles. Estás añadiendo ${totalRequested}.`,
          variant: 'destructive',
          duration: 5000,
        });
      }
    }
    
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
    if (movementType === 'internal' && internalReason === 'transfer' && !destinationWarehouseId) {
      toast({ title: 'Selecciona almacén de destino para transferencias', variant: 'destructive' });
      return;
    }

    const warehouseIdNum = parseInt(warehouseId);
    const destWarehouseIdNum = destinationWarehouseId ? parseInt(destinationWarehouseId) : null;

    // Determine source/destination warehouses based on movement type
    let sourceWarehouseId: number | null = null;
    let destinationWarehouseId_: number | null = null;
    
    if (movementType === 'internal') {
      if (internalReason === 'transfer') {
        sourceWarehouseId = warehouseIdNum;
        destinationWarehouseId_ = destWarehouseIdNum;
      } else {
        // Adjustment: only destination
        destinationWarehouseId_ = warehouseIdNum;
      }
    } else if (['out', 'loan'].includes(movementType)) {
      sourceWarehouseId = warehouseIdNum;
    } else if (['in', 'return'].includes(movementType)) {
      destinationWarehouseId_ = warehouseIdNum;
    }

    const movementData = {
      movementType,
      internalReason: movementType === 'internal' ? internalReason : null,
      adjustmentDirection: (movementType === 'internal' && internalReason === 'adjustment') ? adjustmentDirection : null,
      status,
      sourceWarehouseId,
      destinationWarehouseId: destinationWarehouseId_,
      relatedPartyName: relatedPartyName || null,
      notes: notes || null,
      lines: lines.map(l => ({
        productId: l.productId,
        quantity: l.quantity,
        unitPrice: movementType === 'internal' ? '0' : l.unitPrice,
        vatRate: movementType === 'internal' ? '0' : l.vatRate,
      })),
    };

    if (editingMovement) {
      updateMutation.mutate({ id: editingMovement.id, data: movementData });
    } else {
      createMutation.mutate(movementData);
    }
  };

  const downloadPdf = async (movementId: number, movementNumber: string) => {
    try {
      const response = await fetch(`/api/inventory/movements/${movementId}/pdf`, {
        headers: getAuthHeaders(),
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
    'in': 'Compra',
    'out': 'Venta',
    'internal': 'Interno',
    'loan': 'Préstamo',
    'return': 'Devolución',
  };
  
  const getMovementTypeLabel = (movement: Movement) => {
    if (movement.movementType === 'internal') {
      const reason = (movement as any).internalReason;
      if (reason === 'transfer') {
        return 'Transferencia';
      }
      const direction = (movement as any).adjustmentDirection;
      return direction === 'remove' ? 'Ajuste (-)' : 'Ajuste (+)';
    }
    return typeLabels[movement.movementType] || movement.movementType;
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
      {/* Header con botones - cambia según si estamos editando o no */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        {isDialogOpen ? (
          <>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold dark:text-white">
                {editingMovement ? `Editar Borrador - ${editingMovement.movementNumber}` : 'Nuevo Movimiento'}
              </h3>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
                Cancelar
              </Button>
              <Button 
                variant="secondary"
                onClick={() => handleSubmit('draft')} 
                disabled={createMutation.isPending || updateMutation.isPending || lines.length === 0}
                data-testid="button-save-draft"
              >
                {(createMutation.isPending || updateMutation.isPending) ? 'Guardando...' : 'Guardar borrador'}
              </Button>
              <Button 
                onClick={() => handleSubmit('posted')} 
                disabled={createMutation.isPending || updateMutation.isPending || lines.length === 0}
                data-testid="button-confirm-movement"
              >
                {(createMutation.isPending || updateMutation.isPending) ? 'Confirmando...' : 'Confirmar y enviar'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-movement-type-filter">
                  <SelectValue placeholder="Tipo de movimiento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  <SelectItem value="in">Compra</SelectItem>
                  <SelectItem value="out">Venta</SelectItem>
                  <SelectItem value="internal">Interno</SelectItem>
                  <SelectItem value="loan">Préstamo</SelectItem>
                  <SelectItem value="return">Devolución</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} data-testid="button-new-movement">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Movimiento
            </Button>
          </>
        )}
      </div>

      {/* Contenido: Formulario inline o Lista de movimientos */}
      {isDialogOpen ? (
        <Card className="dark:bg-gray-800">
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="dark:text-gray-300">Tipo de movimiento *</Label>
                <Select value={movementType} onValueChange={setMovementType}>
                  <SelectTrigger data-testid="select-movement-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">Compra</SelectItem>
                    <SelectItem value="out">Venta</SelectItem>
                    <SelectItem value="internal">Interno (sin coste)</SelectItem>
                    <SelectItem value="loan">Préstamo</SelectItem>
                    <SelectItem value="return">Devolución</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {movementType === 'internal' && (
                <div>
                  <Label className="dark:text-gray-300">Tipo de operación interna *</Label>
                  <Select value={internalReason} onValueChange={setInternalReason}>
                    <SelectTrigger data-testid="select-internal-reason">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="adjustment">Ajuste de inventario</SelectItem>
                      <SelectItem value="transfer">Transferencia entre almacenes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            
            {(movementType === 'internal' && internalReason === 'adjustment') && (
              <div>
                <Label className="dark:text-gray-300">Dirección del ajuste *</Label>
                <Select value={adjustmentDirection} onValueChange={setAdjustmentDirection}>
                  <SelectTrigger data-testid="select-adjustment-direction">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add">Añadir stock (encontré material)</SelectItem>
                    <SelectItem value="remove">Quitar stock (material perdido/dañado)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="dark:text-gray-300">{(movementType === 'internal' && internalReason === 'transfer') ? 'Almacén origen *' : 'Almacén *'}</Label>
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

            {(movementType === 'internal' && internalReason === 'transfer') && (
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
                <Popover open={productSearchOpen} onOpenChange={setProductSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={productSearchOpen}
                      className="flex-1 justify-between dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                      data-testid="select-product"
                    >
                      {selectedProductId
                        ? products.find(p => p.id.toString() === selectedProductId)?.name || "Seleccionar producto"
                        : "Buscar producto..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar producto por nombre o SKU..." />
                      <CommandList>
                        <CommandEmpty>No se encontraron productos.</CommandEmpty>
                        <CommandGroup>
                          {products.filter(p => p.isActive).map(p => {
                            const stockInWarehouse = getProductStock(p.id, warehouseId ? parseInt(warehouseId) : undefined);
                            return (
                              <CommandItem
                                key={p.id}
                                value={`${p.name} ${p.sku}`}
                                onSelect={() => {
                                  setSelectedProductId(p.id.toString());
                                  setProductSearchOpen(false);
                                }}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${selectedProductId === p.id.toString() ? "opacity-100" : "opacity-0"}`}
                                />
                                <div className="flex flex-col flex-1">
                                  <span>{p.name}</span>
                                  <span className="text-xs text-gray-500">{p.sku}</span>
                                </div>
                                <Badge variant="outline" className={`ml-2 ${stockInWarehouse > 0 ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                                  {stockInWarehouse} uds
                                </Badge>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
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
                  {lines.map((line, index) => {
                    // Check if this line exceeds stock for outgoing movements
                    const isOutgoing = ['out', 'loan'].includes(movementType) || (movementType === 'internal' && internalReason === 'transfer');
                    const currentStock = getProductStock(line.productId, warehouseId ? parseInt(warehouseId) : undefined);
                    const totalForProduct = lines.filter(l => l.productId === line.productId).reduce((sum, l) => sum + l.quantity, 0);
                    const exceedsStock = isOutgoing && totalForProduct > currentStock;
                    
                    return (
                      <div key={index} className={`flex items-center justify-between p-3 rounded ${exceedsStock ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' : 'bg-gray-50 dark:bg-gray-900'}`}>
                        <div className="flex items-center gap-3 flex-1">
                          {exceedsStock && <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />}
                          <div className="flex-1">
                            <span className={`font-medium ${exceedsStock ? 'text-red-700 dark:text-red-400' : 'dark:text-white'}`}>{line.productName}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                              (Stock: {currentStock})
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="1"
                              value={line.quantity}
                              onChange={(e) => {
                                const newQty = parseInt(e.target.value) || 1;
                                setLines(prev => prev.map((l, i) => i === index ? { ...l, quantity: newQty } : l));
                              }}
                              className="w-16 h-8 text-center dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                            />
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              @ €{parseFloat(line.unitPrice).toFixed(2)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-3">
                          <span className="font-medium dark:text-white min-w-[70px] text-right">
                            €{(line.quantity * parseFloat(line.unitPrice)).toFixed(2)}
                          </span>
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveLine(index)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex justify-end pt-2 border-t dark:border-gray-700">
                    <span className="font-bold text-lg dark:text-white">Total: €{calculateTotal().toFixed(2)}</span>
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
          </CardContent>
        </Card>
      ) : isLoading ? (
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
                    <Badge variant="outline" className="dark:border-gray-600 dark:text-gray-300">{getMovementTypeLabel(movement)}</Badge>
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
                        onClick={() => openViewDialog(movement)}
                        title="Ver detalles"
                        data-testid={`button-view-movement-${movement.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {movement.status === 'draft' && (
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => openEditDialog(movement)}
                          title="Editar borrador"
                          data-testid={`button-edit-movement-${movement.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {movement.status === 'posted' && (
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => setRevertConfirm({ open: true, movement })}
                          disabled={revertToDraftMutation.isPending}
                          title="Revertir a borrador"
                          data-testid={`button-revert-movement-${movement.id}`}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => downloadPdf(movement.id, movement.movementNumber)}
                        title="Descargar PDF"
                        data-testid={`button-download-pdf-${movement.id}`}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => setDeleteConfirm({ open: true, movement })}
                        disabled={deleteMutation.isPending}
                        title="Eliminar"
                        data-testid={`button-delete-movement-${movement.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View Movement Dialog */}
      <Dialog open={viewDialog.open} onOpenChange={(open) => setViewDialog({ open, movement: open ? viewDialog.movement : null, loading: false })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {viewDialog.movement?.movementNumber || 'Detalles del movimiento'}
            </DialogTitle>
          </DialogHeader>
          
          {viewDialog.loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : viewDialog.movement && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Tipo:</span>
                  <p className="font-medium dark:text-white">{typeLabels[viewDialog.movement.movementType] || viewDialog.movement.movementType}</p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Estado:</span>
                  <p className={`inline-block px-2 py-1 rounded text-xs ${statusLabels[viewDialog.movement.status]?.color || 'bg-gray-100 dark:bg-gray-700'}`}>
                    {statusLabels[viewDialog.movement.status]?.label || viewDialog.movement.status}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Fecha:</span>
                  <p className="font-medium dark:text-white">{new Date(viewDialog.movement.movementDate).toLocaleDateString('es-ES')}</p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Creado por:</span>
                  <p className="font-medium dark:text-white">{viewDialog.movement.createdBy?.fullName || 'N/A'}</p>
                </div>
                {viewDialog.movement.relatedPartyName && (
                  <div className="col-span-2">
                    <span className="text-gray-500 dark:text-gray-400">Cliente/Proveedor:</span>
                    <p className="font-medium dark:text-white">{viewDialog.movement.relatedPartyName}</p>
                  </div>
                )}
                {viewDialog.movement.sourceWarehouse && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Almacén origen:</span>
                    <p className="font-medium dark:text-white">{viewDialog.movement.sourceWarehouse.name}</p>
                  </div>
                )}
                {viewDialog.movement.destinationWarehouse && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Almacén destino:</span>
                    <p className="font-medium dark:text-white">{viewDialog.movement.destinationWarehouse.name}</p>
                  </div>
                )}
              </div>

              {viewDialog.movement.lines && viewDialog.movement.lines.length > 0 && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400 text-sm">Productos:</span>
                  <div className="mt-2 border dark:border-gray-700 rounded-lg divide-y dark:divide-gray-700">
                    {viewDialog.movement.lines.map((line: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 text-sm">
                        <div>
                          <p className="font-medium dark:text-white">{line.product?.name || `Producto ${line.productId}`}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {parseFloat(line.quantity)} x €{parseFloat(line.unitPrice).toFixed(2)}
                          </p>
                        </div>
                        <span className="font-medium dark:text-white">
                          €{(parseFloat(line.quantity) * parseFloat(line.unitPrice)).toFixed(2)}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between p-3 bg-gray-50 dark:bg-gray-900 font-medium">
                      <span className="dark:text-gray-300">Total:</span>
                      <span className="dark:text-white">€{parseFloat(viewDialog.movement.total).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              {viewDialog.movement.notes && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400 text-sm">Notas:</span>
                  <p className="mt-1 text-sm dark:text-gray-300">{viewDialog.movement.notes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialog({ open: false, movement: null, loading: false })}>
              Cerrar
            </Button>
            <Button onClick={() => downloadPdf(viewDialog.movement?.id, viewDialog.movement?.movementNumber)} disabled={!viewDialog.movement}>
              <Download className="h-4 w-4 mr-2" />
              Descargar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revert to Draft Confirmation */}
      <AlertDialog open={revertConfirm.open} onOpenChange={(open) => setRevertConfirm({ open, movement: open ? revertConfirm.movement : null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Revertir a borrador?</AlertDialogTitle>
            <AlertDialogDescription>
              {revertConfirm.movement && (
                <>
                  El movimiento <strong>{revertConfirm.movement.movementNumber}</strong> será revertido a borrador.
                  El stock será restaurado al estado anterior a la confirmación.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-orange-600 hover:bg-orange-700"
              onClick={() => {
                if (revertConfirm.movement) {
                  revertToDraftMutation.mutate(revertConfirm.movement.id);
                  setRevertConfirm({ open: false, movement: null });
                }
              }}
            >
              Revertir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Movement Confirmation */}
      <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => setDeleteConfirm({ open, movement: open ? deleteConfirm.movement : null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar movimiento?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm.movement && (
                <>
                  Vas a eliminar <strong>{deleteConfirm.movement.movementNumber}</strong>.
                  {deleteConfirm.movement.status === 'posted' 
                    ? ' El stock será restaurado al estado anterior.'
                    : ' Esta acción no se puede deshacer.'}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (deleteConfirm.movement) {
                  deleteMutation.mutate(deleteConfirm.movement.id);
                  setDeleteConfirm({ open: false, movement: null });
                }
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SettingsTab() {
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [warehouseDialogOpen, setWarehouseDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseType | null>(null);
  const [deleteCategoryConfirm, setDeleteCategoryConfirm] = useState<{ open: boolean; category: Category | null }>({ open: false, category: null });
  const [deleteWarehouseConfirm, setDeleteWarehouseConfirm] = useState<{ open: boolean; warehouse: WarehouseType | null }>({ open: false, warehouse: null });
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
                      onClick={() => setDeleteCategoryConfirm({ open: true, category: cat })}
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
                      onClick={() => setDeleteWarehouseConfirm({ open: true, warehouse: wh })}
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

      {/* Delete Category Confirmation */}
      <AlertDialog open={deleteCategoryConfirm.open} onOpenChange={(open) => setDeleteCategoryConfirm({ open, category: open ? deleteCategoryConfirm.category : null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteCategoryConfirm.category && (
                <>
                  Vas a eliminar la categoría <strong>{deleteCategoryConfirm.category.name}</strong>.
                  Esta acción no se puede deshacer.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (deleteCategoryConfirm.category) {
                  deleteCategoryMutation.mutate(deleteCategoryConfirm.category.id);
                  setDeleteCategoryConfirm({ open: false, category: null });
                }
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Warehouse Confirmation */}
      <AlertDialog open={deleteWarehouseConfirm.open} onOpenChange={(open) => setDeleteWarehouseConfirm({ open, warehouse: open ? deleteWarehouseConfirm.warehouse : null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar almacén?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteWarehouseConfirm.warehouse && (
                <>
                  Vas a eliminar el almacén <strong>{deleteWarehouseConfirm.warehouse.name}</strong>.
                  Esta acción no se puede deshacer.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (deleteWarehouseConfirm.warehouse) {
                  deleteWarehouseMutation.mutate(deleteWarehouseConfirm.warehouse.id);
                  setDeleteWarehouseConfirm({ open: false, warehouse: null });
                }
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
