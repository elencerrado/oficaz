import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { usePageTitle } from '@/hooks/use-page-title';
import StatsCard, { StatsCardGrid } from '@/components/StatsCard';
import { TabNavigation } from '@/components/ui/tab-navigation';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { DatePickerPeriod, DatePickerDay } from '@/components/ui/date-picker';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { DocumentPreviewModal } from '@/components/DocumentPreviewModal';
import { DocumentViewer } from '@/components/DocumentViewer';
import { AccountingAnalyticsExpandedView } from '@/components/AccountingAnalyticsExpandedView';
import { Document, Page, pdfjs } from 'react-pdf';

// Configurar worker de PDF para iOS
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

import { 
  Calculator, 
  TrendingDown, 
  TrendingUp, 
  Calendar as CalendarIcon,
  AlertCircle,
  Plus,
  FileText,
  FileX,
  Paperclip,
  X,
  Check,
  Clock,
  Edit2,
  Trash2,
  Download,
  Filter,
  BarChart3,
  List,
  FolderOpen,
  Upload,
  Zap,
  Users,
  Building2,
  Package,
  Car,
  Megaphone,
  DollarSign,
  Briefcase,
  PlusCircle,
  RotateCcw,
  Tag,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Hash,
  Settings,
  type LucideIcon
} from 'lucide-react';

// Mapeo de nombres de iconos a componentes de Lucide
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'Zap': Zap,
  'Users': Users,
  'Building2': Building2,
  'Package': Package,
  'Car': Car,
  'Megaphone': Megaphone,
  'DollarSign': DollarSign,
  'Briefcase': Briefcase,
  'PlusCircle': PlusCircle,
  'Tag': Tag,
  'Calculator': Calculator,
  'TrendingUp': TrendingUp,
  'TrendingDown': TrendingDown,
};

// Opciones de iconos disponibles para categorías
const ICON_OPTIONS = [
  { value: 'Zap', label: 'Rayo (Suministros)' },
  { value: 'Users', label: 'Personas (Personal)' },
  { value: 'Building2', label: 'Edificio (Alquiler)' },
  { value: 'Package', label: 'Paquete (Material)' },
  { value: 'Car', label: 'Coche (Vehículos)' },
  { value: 'Megaphone', label: 'Megáfono (Marketing)' },
  { value: 'DollarSign', label: 'Dólar (Ventas/Dinero)' },
  { value: 'Briefcase', label: 'Maletín (Servicios)' },
  { value: 'PlusCircle', label: 'Más (Otros)' },
  { value: 'Tag', label: 'Etiqueta (General)' },
  { value: 'Calculator', label: 'Calculadora' },
  { value: 'TrendingUp', label: 'Tendencia arriba' },
  { value: 'TrendingDown', label: 'Tendencia abajo' },
];

const DEFAULT_VAT_RATE = '21';

const VAT_OPTIONS = [
  { value: '21', label: '21% - General' },
  { value: '10', label: '10% - Reducido' },
  { value: '4', label: '4% - Superreducido' },
  { value: '0', label: '0% - Exento' },
];

type FiscalSettings = {
  taxpayerType: 'autonomo' | 'sociedad';
  vatRegime: string;
  vatProration: number;
  model130Rate: number;
  manualWithholdings: number;
  previousPayments: number;
  manualSocialSecurity: number;
  otherAdjustments: number;
  community: string | null;
  retentionDefaultRate?: number | null;
  professionalRetentionRate?: number | null;
  newProfessionalRetentionRate?: number | null;
  rentRetentionRate?: number | null;
  autoApplyRetentionDefaults?: boolean;
};

const DEFAULT_FISCAL_SETTINGS: FiscalSettings = {
  taxpayerType: 'autonomo',
  vatRegime: 'general',
  vatProration: 100,
  model130Rate: 20,
  manualWithholdings: 0,
  previousPayments: 0,
  manualSocialSecurity: 0,
  otherAdjustments: 0,
  community: null,
  retentionDefaultRate: null,
  professionalRetentionRate: null,
  newProfessionalRetentionRate: null,
  rentRetentionRate: null,
  autoApplyRetentionDefaults: false,
};

const PAYMENT_METHOD_OPTIONS = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'transfer', label: 'Transferencia' },
];

const parseInputNumber = (value: string): number | null => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  
  const normalized = trimmed.replace(',', '.');
  const parsed = parseFloat(normalized);
  
  // Validar que es un número finito y no negativo para cantidades
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  
  return parsed;
};

const formatCurrencyInput = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return '';
  return value.toFixed(2);
};

const getVatDecimalFromRate = (rate?: string): number => {
  if (!rate || typeof rate !== 'string') {
    return parseFloat(DEFAULT_VAT_RATE) / 100;
  }
  
  const parsedRate = parseFloat(rate.trim());
  // Validar que el VAT rate está en un rango razonable (0-100%)
  if (Number.isFinite(parsedRate) && parsedRate >= 0 && parsedRate <= 100) {
    return parsedRate / 100;
  }
  
  return parseFloat(DEFAULT_VAT_RATE) / 100;
};

const matchKnownVatRate = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return DEFAULT_VAT_RATE;
  const normalized = Number(value.toFixed(2));
  const match = VAT_OPTIONS.find(option => Math.abs(parseFloat(option.value) - normalized) < 0.01);
  return match ? match.value : DEFAULT_VAT_RATE;
};

const deriveBaseFromTotal = (total: number | null, vatRate: string) => {
  if (total === null || Number.isNaN(total)) return null;
  const vatDecimal = getVatDecimalFromRate(vatRate);
  const divisor = 1 + vatDecimal;
  if (divisor === 0) {
    return total;
  }
  return total / divisor;
};

// Helper para obtener el componente de icono
const getCategoryIcon = (iconName: string): LucideIcon => {
  return CATEGORY_ICONS[iconName] || Tag;
};

// Helper para obtener radio del gráfico según viewport
const getChartRadii = (isMobile: boolean) => {
  if (isMobile) {
    return { innerRadius: 18, outerRadius: 32 };
  }
  return { innerRadius: 35, outerRadius: 55 };
};

// Helper para obtener el monto correcto (con o sin IVA)
const getDisplayAmount = (entry: AccountingEntry, withVAT: boolean): number => {
  if (withVAT) {
    // Con IVA: usar totalAmount si existe, si no calcular
    if (entry.totalAmount !== undefined && entry.totalAmount !== null) {
      return typeof entry.totalAmount === 'string' ? parseFloat(entry.totalAmount) : entry.totalAmount;
    }
    // Si no hay totalAmount, sumar amount + vatAmount
    const amount = typeof entry.amount === 'string' ? parseFloat(entry.amount) : entry.amount || 0;
    const vatAmount = entry.vatAmount !== undefined && entry.vatAmount !== null
      ? (typeof entry.vatAmount === 'string' ? parseFloat(entry.vatAmount) : entry.vatAmount)
      : 0;
    return amount + vatAmount;
  } else {
    // Sin IVA: usar amount
    return typeof entry.amount === 'string' ? parseFloat(entry.amount) : entry.amount || 0;
  }
};

// Función helper para formatear moneda
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
};

interface AccountingCategory {
  id: number;
  companyId: number;
  name: string;
  type: 'expense' | 'income';
  color: string;
  icon: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface AccountingEntry {
  id: number;
  companyId: number;
  categoryId: number;
  employeeId: number | null;
  projectId: number | null;
  crmClientId?: number | null;
  crmSupplierId?: number | null;
  type: 'expense' | 'income';
  concept: string;
  amount: number;
  vatRate?: number | string;
  totalAmount?: number | string;
  vatAmount?: number | string;
  description: string;
  refCode?: string;
  entryDate: string;
  paymentMethod?: string;
  invoiceNumber?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy: number | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string;
  // IRPF fields
  irpfRetentionRate?: number | string | null;
  irpfRetentionAmount?: number | string | null;
  irpfDeductible?: boolean;
  irpfDeductionPercentage?: number | string | null;
  irpfIsSocialSecurity?: boolean;
  irpfIsAmortization?: boolean;
  irpfFiscalAdjustment?: number | string | null;
  fiscalNotes?: string | null;
  // Retenciones (111/115)
  retentionType?: 'professional' | 'rent' | 'other' | null;
  retentionAppliedByUs?: boolean;
  // Relations
  category?: AccountingCategory;
  employee?: { id: number; fullName: string; email: string };
  submittedByUser?: { id: number; fullName: string; profilePicture: string | null };
  attachments?: AccountingAttachment[];
  project?: { id: number; name: string; code: string };
}

interface AccountingAttachment {
  id: number;
  entryId: number;
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  fileUrl?: string;
}

interface DashboardStats {
  totalExpenses: { amount: number; count: number };
  totalIncomes: { amount: number; count: number };
  balance: number;
  pendingExpenses: { count: number; amount: number };
  expensesByCategory?: Array<{
    categoryId: number | null;
    categoryName: string | null;
    categoryColor: string | null;
    total: number;
    count: number;
  }>;
}

type TabType = 'dashboard' | 'movements' | 'categories' | 'fiscalidad';

// Mapeo de provincias a comunidades autónomas
const PROVINCE_TO_COMMUNITY: Record<string, string> = {
  // Andalucía
  'Almería': 'Andalucía',
  'Cádiz': 'Andalucía',
  'Córdoba': 'Andalucía',
  'Granada': 'Andalucía',
  'Huelva': 'Andalucía',
  'Jaén': 'Andalucía',
  'Málaga': 'Andalucía',
  'Sevilla': 'Andalucía',
  'sevilla': 'Andalucía',
  // Aragón
  'Huesca': 'Aragón',
  'Teruel': 'Aragón',
  'Zaragoza': 'Aragón',
  // Asturias
  'Asturias': 'Asturias',
  // Baleares
  'Baleares': 'Baleares',
  'Islas Baleares': 'Baleares',
  // Canarias
  'Las Palmas': 'Canarias',
  'Santa Cruz de Tenerife': 'Canarias',
  // Cantabria
  'Cantabria': 'Cantabria',
  // Castilla y León
  'Ávila': 'Castilla y León',
  'Burgos': 'Castilla y León',
  'León': 'Castilla y León',
  'Palencia': 'Castilla y León',
  'Salamanca': 'Castilla y León',
  'Segovia': 'Castilla y León',
  'Soria': 'Castilla y León',
  'Valladolid': 'Castilla y León',
  'Zamora': 'Castilla y León',
  // Castilla-La Mancha
  'Albacete': 'Castilla-La Mancha',
  'Ciudad Real': 'Castilla-La Mancha',
  'Cuenca': 'Castilla-La Mancha',
  'Guadalajara': 'Castilla-La Mancha',
  'Toledo': 'Castilla-La Mancha',
  // Cataluña
  'Barcelona': 'Cataluña',
  'Girona': 'Cataluña',
  'Lleida': 'Cataluña',
  'Tarragona': 'Cataluña',
  // Comunidad Valenciana
  'Alicante': 'Comunidad Valenciana',
  'Castellón': 'Comunidad Valenciana',
  'Valencia': 'Comunidad Valenciana',
  // Extremadura
  'Badajoz': 'Extremadura',
  'Cáceres': 'Extremadura',
  // Galicia
  'A Coruña': 'Galicia',
  'Coruña': 'Galicia',
  'Lugo': 'Galicia',
  'Ourense': 'Galicia',
  'Pontevedra': 'Galicia',
  // Madrid
  'Madrid': 'Madrid',
  // Murcia
  'Murcia': 'Murcia',
  // Navarra
  'Navarra': 'Navarra',
  // País Vasco
  'Álava': 'País Vasco',
};

// Función para mapear provincia a comunidad autónoma (case-insensitive)
const getAutonomousCommunity = (province: string | null | undefined): string | null => {
  if (!province) return null;
  
  // Intentar buscar exactamente
  if (PROVINCE_TO_COMMUNITY[province]) {
    return PROVINCE_TO_COMMUNITY[province];
  }
  
  // Si no encuentra exacto, buscar case-insensitive
  const lowerProvince = province.toLowerCase();
  for (const [key, value] of Object.entries(PROVINCE_TO_COMMUNITY)) {
    if (key.toLowerCase() === lowerProvince) {
      return value;
    }
  }
  
  // Si no encuentra nada, devolver la provincia como está
  return province;
};

interface AccountingProps {
  accountantMode?: boolean;
  accountantCompanyId?: number;
  accountantCompanyName?: string;
  initialEntryId?: number;
  onBackToCompanies?: () => void;
}

export default function Accounting({ 
  accountantMode = false,
  accountantCompanyId,
  accountantCompanyName,
  initialEntryId,
  onBackToCompanies
}: AccountingProps = {}) {
  usePageTitle(accountantMode ? `Contabilidad - ${accountantCompanyName || 'Gestor'}` : 'Contabilidad');
  const { user, token, company: authCompany } = useAuth();
  
  const effectiveCompanyId = accountantMode ? accountantCompanyId : authCompany?.id;
  
  // Si es modo accountant, cargar los datos completos de la empresa seleccionada
  const { data: selectedCompanyData } = useQuery({
    queryKey: ['/api/accountant/companies', accountantCompanyId, 'details'],
    queryFn: async () => {
      const response = await fetch(`/api/accountant/companies/${accountantCompanyId}/details`, {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include',
      });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: accountantMode && !!accountantCompanyId,
  });
  
  // Si es modo contable, usar datos de la empresa seleccionada, sino usar el de auth
  const company = accountantMode && selectedCompanyData 
    ? selectedCompanyData
    : authCompany;
  
  console.log('🏢 Company Info:', { 
    accountantMode, 
    effectiveCompanyId, 
    companyName: company?.name,
    hasSelectedData: !!selectedCompanyData,
    companyData: company
  });
    
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [showExpandedAnalytics, setShowExpandedAnalytics] = useState(false);
  const [expandedFiscalCard, setExpandedFiscalCard] = useState<'iva' | 'irpf' | 'retenciones' | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Detectar cambios de viewport
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Helper para obtener headers con token
  const getAuthHeaders = () => {
    return {
      'Authorization': `Bearer ${token}`,
    };
  };

  // Helper para determinar si un movimiento debe contar en estadísticas/gráficas
  const isApprovedStatus = (status: string) => {
    return status === 'approved' || status === 'approved_accountant';
  };

  // React Query para categorías
  const { data: categories = [], isLoading: isLoadingCategories } = useQuery<AccountingCategory[]>({
    queryKey: ['/api/accounting/categories', effectiveCompanyId],
    queryFn: async () => {
      const url = accountantMode 
        ? `/api/accountant/companies/${effectiveCompanyId}/categories`
        : '/api/accounting/categories';
      console.log('🔍 Fetching categories:', { accountantMode, effectiveCompanyId, url });
      const response = await fetch(url, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!response.ok) {
        console.error('❌ Categories fetch failed:', response.status, response.statusText);
        throw new Error('Failed to fetch categories');
      }
      const data = await response.json();
      console.log('✅ Categories loaded:', data.length);
      return data;
    },
    enabled: !!effectiveCompanyId,
    staleTime: 5 * 60 * 1000,
  });

  // React Query para estadísticas
  const { data: stats = null, isLoading: isLoadingStats } = useQuery<DashboardStats | null>({
    queryKey: ['/api/accounting/dashboard', effectiveCompanyId],
    queryFn: async () => {
      const url = accountantMode
        ? `/api/accountant/companies/${effectiveCompanyId}/dashboard`
        : '/api/accounting/dashboard';
      const response = await fetch(url, {
        headers: {
          ...getAuthHeaders(),
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
        cache: 'no-store',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch dashboard');
      return response.json();
    },
    enabled: !!effectiveCompanyId,
    staleTime: 0, // Sin caché para refrescar inmediatamente
    gcTime: 5 * 60 * 1000, // Mantener en caché 5 minutos cuando no está en uso
  });

  // Verificar si CRM addon está activo
  const { data: crmAddonStatus, isLoading: isLoadingCRM } = useQuery({
    queryKey: accountantMode 
      ? ['/api/accountant/companies', effectiveCompanyId, 'crm-status']
      : ['/api/company/addons/crm/status'],
    queryFn: async () => {
      try {
        const url = accountantMode
          ? `/api/accountant/companies/${effectiveCompanyId}/crm-status`
          : '/api/company/addons/crm/status';
        console.log('🔍 Fetching CRM status:', { accountantMode, effectiveCompanyId, url });
        const response = await fetch(url, {
          headers: getAuthHeaders(),
          credentials: 'include',
        });
        if (!response.ok) {
          console.error('❌ CRM status fetch failed:', response.status, response.statusText);
          return { active: false };
        }
        const data = await response.json();
        console.log('✅ CRM status:', data);
        return data;
      } catch (error) {
        console.error('❌ CRM status error:', error);
        return { active: false };
      }
    },
    enabled: !!effectiveCompanyId,
    staleTime: 0, // Sin caché para refrescar inmediatamente cuando se desactiva CRM
    gcTime: 1 * 60 * 1000, // Mantener en caché 1 minuto
    refetchInterval: 30 * 1000, // Revalidar cada 30 segundos
    retry: false,
  });

  const hasCRMAddon = Boolean(crmAddonStatus?.active);
  console.log('📊 CRM Addon Status:', { hasCRMAddon, crmAddonStatus });

  // Hardcoded: Solo Servited usa gestoría externa
  const usesExternalAccountant = company?.name?.toLowerCase() === 'servited';
  console.log('🔧 External Accountant Check:', { 
    companyName: company?.name,
    companyNameLower: company?.name?.toLowerCase(),
    usesExternalAccountant 
  });

  // Obtener proyectos si CRM está activo
  const { data: projectsData, isLoading: isLoadingProjects } = useQuery<Array<{ project: { id: number; name: string; code: string } }>>({
    queryKey: accountantMode
      ? ['/api/accountant/companies', effectiveCompanyId, 'projects']
      : ['/api/crm/projects'],
    queryFn: async () => {
      try {
        const url = accountantMode
          ? `/api/accountant/companies/${effectiveCompanyId}/projects`
          : '/api/crm/projects';
        console.log('🔍 Fetching projects:', { accountantMode, effectiveCompanyId, url, hasCRMAddon });
        const response = await fetch(url, {
          headers: getAuthHeaders(),
          credentials: 'include',
        });
        if (!response.ok) {
          console.error('❌ Projects fetch failed:', response.status, response.statusText);
          return [];
        }
        const data = await response.json();
        console.log('✅ Projects loaded:', { count: data.length, projects: data });
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error('❌ Projects error:', error);
        return [];
      }
    },
    enabled: !!effectiveCompanyId && hasCRMAddon,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Transformar proyectos a formato simple { id, name, code, clients, suppliers }
  const projects = Array.isArray(projectsData) 
    ? projectsData.map((p: any) => ({
        id: p.project.id,
        name: p.project.name,
        code: p.project.code || '',
        clients: p.clients || [],
        suppliers: p.providers || []
      }))
    : [];

  console.log('📋 Transformed projects:', { count: projects.length, projects });

  // Debug: mostrar info de proyectos
  useEffect(() => {
    if (hasCRMAddon) {
      // CRM addon logic
    }
  }, [hasCRMAddon, projects, user?.companyId]);

  

  // React Query para movimientos
  const { data: entries = [], isLoading: isLoadingEntries } = useQuery<AccountingEntry[]>({
    queryKey: ['/api/accounting/entries', effectiveCompanyId],
    queryFn: async () => {
      const url = accountantMode
        ? `/api/accountant/companies/${effectiveCompanyId}/entries`
        : '/api/accounting/entries';
      const response = await fetch(url, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch entries');
      return response.json();
    },
    enabled: !!effectiveCompanyId,
    staleTime: 2 * 60 * 1000,
  });

  // Abrir modal automáticamente si llegamos con entryId desde el dashboard del gestor
  useEffect(() => {
    if (!initialEntryId || hasOpenedInitialEntryRef.current) return;
    if (!entries || entries.length === 0) return;
    const entry = entries.find((e) => e.id === initialEntryId);
    if (!entry) return;

    const readOnly = accountantMode
      ? entry.status === 'approved_accountant'
      : entry.status === 'approved';

    openEditEntryModal(entry, { readOnly });
    hasOpenedInitialEntryRef.current = true;
  }, [initialEntryId, entries, accountantMode]);

  // Filtros para movimientos
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [projectSearchTerm, setProjectSearchTerm] = useState<string>('');
  const [selectedStartDate, setSelectedStartDate] = useState<Date | null>(null);
  const [selectedEndDate, setSelectedEndDate] = useState<Date | null>(null);
  const [activeStatsFilter, setActiveStatsFilter] = useState<'expenses' | 'incomes' | 'pending' | null>(null);
  const [showPricesWithVAT, setShowPricesWithVAT] = useState(true); // true = con IVA, false = sin IVA

  // Modal de añadir/editar movimiento
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<AccountingEntry | null>(null);
  const hasOpenedInitialEntryRef = useRef(false);
  const [entryForm, setEntryForm] = useState<{
    type: 'expense' | 'income';
    categoryId: string;
    concept: string;
    amount: string;
    totalAmount: string;
    vatRate: string;
    description: string;
    refCode: string;
    projectId: string | null;
    crmClientId: number | null;
    crmSupplierId: number | null;
    paymentMethod: string;
    irpfRetentionRate: string;
    irpfRetentionAmount: string;
    irpfDeductible: boolean;
    irpfDeductionPercentage: string;
    irpfIsSocialSecurity: boolean;
    irpfIsAmortization: boolean;
    irpfFiscalAdjustment: string;
    fiscalNotes: string;
    retentionType?: 'professional' | 'rent' | 'other' | '';
    retentionAppliedByUs?: boolean;
  }>({
    type: 'expense',
    categoryId: '',
    concept: '',
    amount: '',
    totalAmount: '',
    vatRate: DEFAULT_VAT_RATE,
    description: '',
    refCode: '',
    projectId: null,
    crmClientId: null,
    crmSupplierId: null,
    paymentMethod: '',
    irpfRetentionRate: '',
    irpfRetentionAmount: '',
    irpfDeductible: true,
    irpfDeductionPercentage: '100',
    irpfIsSocialSecurity: false,
    irpfIsAmortization: false,
    irpfFiscalAdjustment: '0',
    fiscalNotes: '',
    retentionType: '',
    retentionAppliedByUs: false,
  });
  const [showFiscalConfigModal, setShowFiscalConfigModal] = useState(false);
  const [fiscalConfigDraft, setFiscalConfigDraft] = useState<FiscalSettings>(DEFAULT_FISCAL_SETTINGS);
  const fiscalSettingsQuery = useQuery<FiscalSettings>({
    queryKey: ['/api/accounting/fiscal-settings', effectiveCompanyId],
    queryFn: async () => {
      const url = accountantMode
        ? `/api/accountant/companies/${effectiveCompanyId}/fiscal-settings`
        : '/api/accounting/fiscal-settings';
      const response = await fetch(url, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('No se pudo obtener la configuración fiscal');
      const result = await response.json();
      
      // Si no hay comunidad guardada, mapear automáticamente desde la provincia
      let community = result.community;
      if (!community && company?.province) {
        community = getAutonomousCommunity(company.province);
      }
      
      return {
        ...DEFAULT_FISCAL_SETTINGS,
        taxpayerType: result.taxpayerType || 'autonomo',
        vatRegime: result.vatRegime || 'general',
        vatProration: Number(result.vatProration ?? 100),
        model130Rate: Number(result.irpfModel130Rate ?? result.model130Rate ?? 20),
        manualWithholdings: Number(result.irpfManualWithholdings ?? result.manualWithholdings ?? 0),
        previousPayments: Number(result.irpfPreviousPayments ?? result.previousPayments ?? 0),
        manualSocialSecurity: Number(result.irpfManualSocialSecurity ?? result.manualSocialSecurity ?? 0),
        otherAdjustments: Number(result.irpfOtherAdjustments ?? result.otherAdjustments ?? 0),
        community: community ?? null,
        retentionDefaultRate: result.retentionDefaultRate ?? null,
        professionalRetentionRate: result.professionalRetentionRate ?? null,
        newProfessionalRetentionRate: result.newProfessionalRetentionRate ?? null,
        rentRetentionRate: result.rentRetentionRate ?? null,
        autoApplyRetentionDefaults: Boolean(result.autoApplyRetentionDefaults ?? false),
      } as FiscalSettings;
    },
    enabled: !!effectiveCompanyId,
    staleTime: 0,
  });

  const fiscalSettingsMutation = useMutation({
    mutationFn: async (payload: FiscalSettings) => {
      const response = await fetch('/api/accounting/fiscal-settings', {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          taxpayerType: payload.taxpayerType,
          vatRegime: payload.vatRegime,
          vatProration: payload.vatProration,
          irpfModel130Rate: payload.model130Rate,
          irpfManualWithholdings: payload.manualWithholdings,
          irpfPreviousPayments: payload.previousPayments,
          irpfManualSocialSecurity: payload.manualSocialSecurity,
          irpfOtherAdjustments: payload.otherAdjustments,
          community: payload.community,
          retentionDefaultRate: payload.retentionDefaultRate,
          professionalRetentionRate: payload.professionalRetentionRate,
          newProfessionalRetentionRate: payload.newProfessionalRetentionRate,
          rentRetentionRate: payload.rentRetentionRate,
          autoApplyRetentionDefaults: payload.autoApplyRetentionDefaults,
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'No se pudo guardar la configuración fiscal');
      }
      return response.json();
    },
    onSuccess: (data) => {
      const normalized: FiscalSettings = {
        ...DEFAULT_FISCAL_SETTINGS,
        taxpayerType: data.taxpayerType || 'autonomo',
        vatRegime: data.vatRegime || 'general',
        vatProration: Number(data.vatProration ?? 100),
        model130Rate: Number(data.irpfModel130Rate ?? data.model130Rate ?? 20),
        manualWithholdings: Number(data.irpfManualWithholdings ?? data.manualWithholdings ?? 0),
        previousPayments: Number(data.irpfPreviousPayments ?? data.previousPayments ?? 0),
        manualSocialSecurity: Number(data.irpfManualSocialSecurity ?? data.manualSocialSecurity ?? 0),
        otherAdjustments: Number(data.irpfOtherAdjustments ?? data.otherAdjustments ?? 0),
        community: data.community ?? null,
        retentionDefaultRate: data.retentionDefaultRate ?? null,
        professionalRetentionRate: data.professionalRetentionRate ?? null,
        newProfessionalRetentionRate: data.newProfessionalRetentionRate ?? null,
        rentRetentionRate: data.rentRetentionRate ?? null,
        autoApplyRetentionDefaults: Boolean(data.autoApplyRetentionDefaults ?? false),
      };
      queryClient.setQueryData(['/api/accounting/fiscal-settings'], normalized);
      setFiscalConfigDraft(normalized);
      setShowFiscalConfigModal(false);
      toast({ title: 'Configuración guardada', description: 'Datos fiscales actualizados correctamente' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'No se pudo guardar la configuración fiscal', variant: 'destructive' });
    }
  });

  useEffect(() => {
    if (fiscalSettingsQuery.data) {
      setFiscalConfigDraft(fiscalSettingsQuery.data);
    }
  }, [fiscalSettingsQuery.data]);
  const activeFiscalConfig = fiscalSettingsQuery.data ?? fiscalConfigDraft;
  const handleOpenFiscalConfig = () => {
    setFiscalConfigDraft(activeFiscalConfig);
    setShowFiscalConfigModal(true);
  };
  const [entryDate, setEntryDate] = useState<Date>(new Date());
  const [entryFiles, setEntryFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [projectComboboxOpen, setProjectComboboxOpen] = useState(false);
  const [refCodeComboboxOpen, setRefCodeComboboxOpen] = useState(false);
  const [refCodeSearchTerm, setRefCodeSearchTerm] = useState('');
  const previewObjectUrlRef = useRef<string | null>(null);
  const newFilePreviewUrlsRef = useRef<string[]>([]);

  // Estados para OCR de tickets
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [manualEntryMode, setManualEntryMode] = useState(false);

  // Estados para scroll infinito en movimientos
  const MOVEMENTS_PER_PAGE = 50;
  const MOVEMENTS_PER_LOAD = 15;
  const [displayedMovementsCount, setDisplayedMovementsCount] = useState(MOVEMENTS_PER_LOAD);
  const loadMoreMovementsRef = useRef<HTMLDivElement>(null);

  // Estado para el visor embebido en el panel lateral
  const [selectedFileForViewer, setSelectedFileForViewer] = useState<{
    url: string;
    filename: string;
    mimeType?: string;
    type?: 'new' | 'existing';
    index?: number;
  } | null>(null);

  // Estado para modal de preview de imágenes
  const [previewModalState, setPreviewModalState] = useState<{
    open: boolean;
    url: string;
    filename: string;
    mimeType?: string;
  } | null>(null);

  // Detect iOS - Safari on iOS doesn't support inline PDF viewing properly
  const isIOS = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    const platform = navigator.platform || '';
    const userAgent = navigator.userAgent || '';
    const isIOSPlatform = /iPad|iPhone|iPod/.test(platform) || 
      (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isIOSUserAgent = /iPad|iPhone|iPod/.test(userAgent);
    return isIOSPlatform || isIOSUserAgent;
  }, []);

  // Estados para preview móvil con soporte iOS/PDF
  const [mobilePreviewBlobUrl, setMobilePreviewBlobUrl] = useState<string | null>(null);
  const [mobilePreviewPdfArray, setMobilePreviewPdfArray] = useState<Uint8Array | null>(null);
  const [mobilePreviewLoading, setMobilePreviewLoading] = useState(false);
  const [mobilePreviewError, setMobilePreviewError] = useState<string | null>(null);
  const [mobilePreviewNumPages, setMobilePreviewNumPages] = useState<number | null>(null);
  const [mobilePreviewPage, setMobilePreviewPage] = useState(1);

  // Memoizar file y options para react-pdf
  const mobilePreviewPdfFile = useMemo(() => {
    if (!mobilePreviewPdfArray) return null;
    return { data: mobilePreviewPdfArray.slice(0) };
  }, [mobilePreviewPdfArray]);

  const mobilePreviewPdfOptions = useMemo(() => ({
    cMapPacked: false,
  }), []);

  // Cargar archivo para preview móvil (con soporte iOS/PDF usando ArrayBuffer)
  useEffect(() => {
    if (!selectedFileForViewer) {
      setMobilePreviewBlobUrl(null);
      setMobilePreviewPdfArray(null);
      setMobilePreviewError(null);
      setMobilePreviewNumPages(null);
      setMobilePreviewPage(1);
      return;
    }

    setMobilePreviewLoading(true);
    setMobilePreviewError(null);
    setMobilePreviewBlobUrl(null);
    setMobilePreviewPdfArray(null);
    
    const url = selectedFileForViewer.url;
    const isPdf = selectedFileForViewer.mimeType?.includes('pdf') || selectedFileForViewer.filename.toLowerCase().endsWith('.pdf');
    
    const headers: HeadersInit = getAuthHeaders() || {};
    fetch(url, { headers })
      .then(res => {
        if (!res.ok) throw new Error('Error al cargar');
        return res.blob();
      })
      .then(blob => {
        if (isPdf) {
          // Para PDFs: SIEMPRE convertir a ArrayBuffer (iOS y desktop)
          blob.arrayBuffer().then(arrayBuffer => {
            // Clonar para prevenir ArrayBuffer detached error
            const uint8Array = new Uint8Array(arrayBuffer.slice(0));
            setMobilePreviewPdfArray(uint8Array);
            setMobilePreviewLoading(false);
          }).catch(() => {
            setMobilePreviewError('Error al procesar PDF');
            setMobilePreviewLoading(false);
          });
        } else {
          // Solo para imágenes: blob URL
          const objectUrl = URL.createObjectURL(blob);
          setMobilePreviewBlobUrl(objectUrl);
          setMobilePreviewLoading(false);
        }
      })
      .catch(() => {
        setMobilePreviewError('Error al cargar archivo');
        setMobilePreviewLoading(false);
      });

    return () => {
      if (mobilePreviewBlobUrl && mobilePreviewBlobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(mobilePreviewBlobUrl);
      }
    };
  }, [selectedFileForViewer?.url, selectedFileForViewer?.filename, selectedFileForViewer?.mimeType]);

  // Autoseleccionar cliente/proveedor si solo hay uno disponible
  useEffect(() => {
    if (!hasCRMAddon || !entryForm.projectId || !projects.length) return;
    
    const selectedProject = projects.find(p => String(p.id) === entryForm.projectId);
    if (!selectedProject) return;
    
    const clientsList = (selectedProject.clients as any[]) || [];
    const suppliersList = (selectedProject.suppliers as any[]) || [];
    
    // Autoseleccionar cliente si hay exactamente uno y no hay uno seleccionado
    if (entryForm.type === 'income' && clientsList.length === 1 && !entryForm.crmClientId) {
      setEntryForm(prev => ({ ...prev, crmClientId: clientsList[0].id }));
    }
    
    // Autoseleccionar proveedor si hay exactamente uno y no hay uno seleccionado
    if (entryForm.type === 'expense' && suppliersList.length === 1 && !entryForm.crmSupplierId) {
      setEntryForm(prev => ({ ...prev, crmSupplierId: suppliersList[0].id }));
    }
  }, [hasCRMAddon, entryForm.projectId, entryForm.type, entryForm.crmClientId, entryForm.crmSupplierId, projects]);

  const recalcIrpfRetention = (state: typeof entryForm) => {
    if (state.type !== 'income') {
      state.irpfRetentionAmount = '';
      return state;
    }
    const baseNumber = parseInputNumber(state.amount);
    const rateNumber = parseInputNumber(state.irpfRetentionRate);
    if (baseNumber !== null && rateNumber !== null) {
      const withheld = baseNumber * (rateNumber / 100);
      state.irpfRetentionAmount = formatCurrencyInput(withheld);
    } else {
      state.irpfRetentionAmount = '';
    }
    return state;
  };

  const handleEntryTypeChange = (type: 'expense' | 'income') => {
    setEntryForm(prev => {
      const nextState = {
        ...prev,
        type,
        categoryId: '',
        irpfRetentionRate: type === 'income' ? prev.irpfRetentionRate : '',
        irpfRetentionAmount: type === 'income' ? prev.irpfRetentionAmount : '',
        irpfDeductible: type === 'expense' ? true : prev.irpfDeductible,
        irpfIsSocialSecurity: type === 'expense' ? false : prev.irpfIsSocialSecurity,
      };
      return recalcIrpfRetention(nextState);
    });
  };

  const handleBaseAmountInput = (value: string) => {
    setEntryForm(prev => {
      const nextState = recalcIrpfRetention({ ...prev, amount: value });
      const baseNumber = parseInputNumber(value);
      if (baseNumber !== null) {
        const vatDecimal = getVatDecimalFromRate(prev.vatRate);
        const total = baseNumber * (1 + vatDecimal);
        nextState.totalAmount = formatCurrencyInput(total);
      } else if (!value) {
        nextState.totalAmount = '';
      }
      return nextState;
    });
  };

  const handleTotalAmountInput = (value: string) => {
    setEntryForm(prev => {
      const nextState = recalcIrpfRetention({ ...prev, totalAmount: value });
      const totalNumber = parseInputNumber(value);
      if (totalNumber !== null) {
        const vatDecimal = getVatDecimalFromRate(prev.vatRate);
        const divisor = 1 + vatDecimal;
        const base = divisor === 0 ? totalNumber : totalNumber / divisor;
        nextState.amount = formatCurrencyInput(base);
      } else if (!value) {
        nextState.amount = '';
      }
      return nextState;
    });
  };

  const handleVatRateDropdownChange = (value: string) => {
    setEntryForm(prev => {
      const nextState = recalcIrpfRetention({ ...prev, vatRate: value });
      const totalNumber = parseInputNumber(prev.totalAmount);
      const vatDecimal = getVatDecimalFromRate(value);
      if (totalNumber !== null) {
        const divisor = 1 + vatDecimal;
        const base = divisor === 0 ? totalNumber : totalNumber / divisor;
        nextState.amount = formatCurrencyInput(base);
      } else {
        const baseNumber = parseInputNumber(prev.amount);
        if (baseNumber !== null) {
          const total = baseNumber * (1 + vatDecimal);
          nextState.totalAmount = formatCurrencyInput(total);
        }
      }
      return nextState;
    });
  };

  const handleIrpfRetentionRateChange = (value: string) => {
    setEntryForm(prev => {
      const next = recalcIrpfRetention({ ...prev, irpfRetentionRate: value });
      // Para gastos con retención aplicada por nosotros, calcular importe automáticamente
      if (next.type === 'expense' && next.retentionAppliedByUs) {
        const baseNumber = parseInputNumber(next.amount);
        const rateNumber = parseInputNumber(value);
        if (baseNumber !== null && rateNumber !== null) {
          const withheld = baseNumber * (rateNumber / 100);
          next.irpfRetentionAmount = formatCurrencyInput(withheld);
        }
      }
      return next;
    });
  };

  const handleIrpfRetentionAmountChange = (value: string) => {
    setEntryForm(prev => ({ ...prev, irpfRetentionAmount: value }));
  };

  const vatAmountDisplay = useMemo(() => {
    const totalNumber = parseInputNumber(entryForm.totalAmount);
    const baseNumber = parseInputNumber(entryForm.amount);

    if (totalNumber !== null && baseNumber !== null) {
      const diff = totalNumber - baseNumber;
      return diff >= 0 ? formatCurrencyInput(diff) : '';
    }

    if (baseNumber !== null) {
      const vatDecimal = getVatDecimalFromRate(entryForm.vatRate);
      return formatCurrencyInput(baseNumber * vatDecimal);
    }

    if (totalNumber !== null) {
      const derivedBase = deriveBaseFromTotal(totalNumber, entryForm.vatRate);
      if (derivedBase !== null) {
        return formatCurrencyInput(totalNumber - derivedBase);
      }
    }

    return '';
  }, [entryForm.amount, entryForm.totalAmount, entryForm.vatRate]);

  const hasValidAmount = useMemo(() => {
    return parseInputNumber(entryForm.amount) !== null || parseInputNumber(entryForm.totalAmount) !== null;
  }, [entryForm.amount, entryForm.totalAmount]);

  // Determinar tipo de retención según categoría
  const determineRetentionTypeFromCategory = (categoryId: string | number | null): 'professional' | 'rent' | 'other' => {
    if (!categoryId) return 'professional';
    const cat = categories.find(c => String(c.id) === String(categoryId));
    if (!cat) return 'professional';
    const name = (cat.name || '').toLowerCase();
    if (name.includes('alquiler') || name.includes('renta') || name.includes('rent')) return 'rent';
    return 'professional';
  };

  // Aplicar por defecto tipo y porcentaje de retención según configuración fiscal
  const applyRetentionDefaults = (state: typeof entryForm): typeof entryForm => {
    if (state.type !== 'expense' || !state.retentionAppliedByUs) return state;
    const config = activeFiscalConfig;
    const inferredType = state.retentionType ? state.retentionType : determineRetentionTypeFromCategory(state.categoryId);
    let rate: number | null = null;
    if (inferredType === 'rent') rate = config.rentRetentionRate ?? null;
    else if (inferredType === 'professional') rate = config.professionalRetentionRate ?? null;
    else rate = config.retentionDefaultRate ?? null;
    const rateStr = rate !== null && Number.isFinite(rate) ? String(rate) : '';
    const next = { ...state, retentionType: inferredType, irpfRetentionRate: rateStr };
    // Calcular importe de retención para gastos
    if (rate !== null) {
      const baseNumber = parseInputNumber(next.amount);
      if (baseNumber !== null) {
        next.irpfRetentionAmount = formatCurrencyInput(baseNumber * (rate / 100));
      }
    }
    return next;
  };

  // Modal de categorías
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AccountingCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    type: 'expense' as 'expense' | 'income',
    color: '#6366f1',
    icon: '💰',
  });

  // Modal de exportación
  const [showExportModal, setShowExportModal] = useState(false);
  // Confirmaciones de borrado
  const [deleteEntryConfirmOpen, setDeleteEntryConfirmOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<number | null>(null);
  const [deleteCategoryConfirmOpen, setDeleteCategoryConfirmOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<number | null>(null);

  // Estados del modal de movimiento
  const [revertConfirm, setRevertConfirm] = useState<{ open: boolean; entry: any | null }>({ open: false, entry: null });
  const [deleteFileConfirm, setDeleteFileConfirm] = useState<{ open: boolean; fileIndex: number | null }>({ open: false, fileIndex: null });
  const [isEntryModalReadOnly, setIsEntryModalReadOnly] = useState(false);
  const [inlineRevertLoading, setInlineRevertLoading] = useState(false);

  // Handlers para filtros de stats cards
  const handleExpensesFilter = () => {
    if (activeStatsFilter === 'expenses') {
      setActiveStatsFilter(null);
      setFilterType('all');
    } else {
      setActiveStatsFilter('expenses');
      setFilterType('expense');
      setFilterStatus('all');
      setActiveTab('movements');
    }
  };

  const handleIncomesFilter = () => {
    if (activeStatsFilter === 'incomes') {
      setActiveStatsFilter(null);
      setFilterType('all');
    } else {
      setActiveStatsFilter('incomes');
      setFilterType('income');
      setFilterStatus('all');
      setActiveTab('movements');
    }
  };

  const handlePendingFilter = () => {
    if (activeStatsFilter === 'pending') {
      setActiveStatsFilter(null);
      setFilterStatus('all');
    } else {
      setActiveStatsFilter('pending');
      setFilterStatus('pending');
      setFilterType('all');
      setActiveTab('movements');
    }
  };

  // Filtrar movimientos
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      if (filterType !== 'all' && entry.type !== filterType) return false;
      if (filterStatus !== 'all' && entry.status !== filterStatus) return false;
      if (filterProject !== 'all' && (!entry.projectId || entry.projectId.toString() !== filterProject)) return false;
      
      // Filtrar por rango de fechas
      if (selectedStartDate || selectedEndDate) {
        const entryDate = new Date(entry.entryDate);
        // Establecer hora a medianoche para comparación correcta
        entryDate.setHours(0, 0, 0, 0);
        
        if (selectedStartDate) {
          const startDate = new Date(selectedStartDate);
          startDate.setHours(0, 0, 0, 0);
          if (entryDate < startDate) return false;
        }
        
        if (selectedEndDate) {
          const endDate = new Date(selectedEndDate);
          endDate.setHours(23, 59, 59, 999);
          if (entryDate > endDate) return false;
        }
      }
      
      return true;
    });
  }, [entries, filterType, filterStatus, filterProject, selectedStartDate, selectedEndDate]);

  // Lista única de códigos de referencia existentes (normalizados a mayúsculas)
  const existingRefCodes = useMemo(() => {
    const codes = new Set<string>();
    entries.forEach(entry => {
      if (entry.refCode && entry.refCode.trim() !== '') {
        codes.add(entry.refCode.toUpperCase().trim());
      }
    });
    return Array.from(codes).sort();
  }, [entries]);

  // Datos para gráficas
  const categoryChartData = useMemo(() => {
    const incomesTotal = filteredEntries.filter(e => e.type === 'income').reduce((sum, e) => sum + getDisplayAmount(e, showPricesWithVAT), 0);
    const expensesTotal = filteredEntries.filter(e => e.type === 'expense').reduce((sum, e) => sum + getDisplayAmount(e, showPricesWithVAT), 0);
    return [
      { name: 'Ingresos', value: incomesTotal, color: '#16a34a' },
      { name: 'Gastos', value: expensesTotal, color: '#dc2626' }
    ].filter(item => item.value > 0);
  }, [filteredEntries, showPricesWithVAT]);

  // Gráfica de categorías de gastos (sin CRM)
  const categoryExpenseChartData = useMemo(() => {
    if (hasCRMAddon) return [];
    
    const categoryTotals: Record<string, number> = {};
    filteredEntries
      .filter(e => e.type === 'expense' && e.categoryId)
      .forEach(e => {
        const category = categories.find(c => c.id === e.categoryId);
        const categoryName = category?.name || 'Sin categoría';
        categoryTotals[categoryName] = (categoryTotals[categoryName] || 0) + getDisplayAmount(e, showPricesWithVAT);
      });

    const colors = ['#dc2626', '#ef4444', '#f87171', '#fca5a5', '#fecaca', '#fee2e2', '#b91c1c', '#991b1b'];
    return Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value], index) => ({
        name,
        value,
        color: colors[index % colors.length]
      }));
  }, [filteredEntries, hasCRMAddon, categories, showPricesWithVAT]);

  // Gráfica de categorías de ingresos (sin CRM)
  const categoryIncomeChartData = useMemo(() => {
    if (hasCRMAddon) return [];
    
    const categoryTotals: Record<string, number> = {};
    filteredEntries
      .filter(e => e.type === 'income' && e.categoryId)
      .forEach(e => {
        const category = categories.find(c => c.id === e.categoryId);
        const categoryName = category?.name || 'Sin categoría';
        categoryTotals[categoryName] = (categoryTotals[categoryName] || 0) + getDisplayAmount(e, showPricesWithVAT);
      });

    const colors = ['#16a34a', '#22c55e', '#4ade80', '#86efac', '#bbf7d0', '#dcfce7', '#15803d', '#166534'];
    return Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value], index) => ({
        name,
        value,
        color: colors[index % colors.length]
      }));
  }, [filteredEntries, hasCRMAddon, categories, showPricesWithVAT]);

  // Gráfica de gastos por código de referencia (sin CRM)
  const refCodeExpenseChartData = useMemo(() => {
    if (hasCRMAddon) return [];
    
    const refCodeTotals: Record<string, number> = {};
    filteredEntries
      .filter(e => e.type === 'expense' && e.refCode)
      .forEach(e => {
        const refCode = e.refCode ? e.refCode.toUpperCase().trim() : 'Sin código';
        refCodeTotals[refCode] = (refCodeTotals[refCode] || 0) + getDisplayAmount(e, showPricesWithVAT);
      });

    const colors = ['#f59e0b', '#fbbf24', '#fcd34d', '#fde68a', '#fef3c7', '#fffbeb', '#d97706', '#b45309'];
    return Object.entries(refCodeTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value], index) => ({
        name,
        value,
        color: colors[index % colors.length]
      }));
  }, [filteredEntries, hasCRMAddon, showPricesWithVAT]);

  // Gráfica de ingresos por código de referencia (sin CRM)
  const refCodeIncomeChartData = useMemo(() => {
    if (hasCRMAddon) return [];
    
    const refCodeTotals: Record<string, number> = {};
    filteredEntries
      .filter(e => e.type === 'income' && e.refCode)
      .forEach(e => {
        const refCode = e.refCode ? e.refCode.toUpperCase().trim() : 'Sin código';
        refCodeTotals[refCode] = (refCodeTotals[refCode] || 0) + getDisplayAmount(e, showPricesWithVAT);
      });

    const colors = ['#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe', '#f5f3ff', '#7c3aed', '#6d28d9'];
    return Object.entries(refCodeTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value], index) => ({
        name,
        value,
        color: colors[index % colors.length]
      }));
  }, [filteredEntries, hasCRMAddon, showPricesWithVAT]);

  const clientChartData = useMemo(() => {
    if (!hasCRMAddon) return [];
    
    const clientTotals: Record<string, number> = {};
    filteredEntries
      .filter(e => e.crmClientId && isApprovedStatus(e.status))
      .forEach(e => {
        const clientName = `Cliente ${e.crmClientId}`;
        clientTotals[clientName] = (clientTotals[clientName] || 0) + getDisplayAmount(e, showPricesWithVAT);
      });

    const colors = ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe', '#eff6ff', '#0ea5e9', '#06b6d4'];
    return Object.entries(clientTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value], index) => ({
        name,
        value,
        color: colors[index % colors.length]
      }));
  }, [filteredEntries, hasCRMAddon, showPricesWithVAT]);

  const supplierChartData = useMemo(() => {
    if (!hasCRMAddon) return [];
    
    const supplierTotals: Record<string, number> = {};
    filteredEntries
      .filter(e => e.crmSupplierId && isApprovedStatus(e.status))
      .forEach(e => {
        const supplierName = `Proveedor ${e.crmSupplierId}`;
        supplierTotals[supplierName] = (supplierTotals[supplierName] || 0) + getDisplayAmount(e, showPricesWithVAT);
      });

    const colors = ['#f97316', '#fb923c', '#fdba74', '#fcd34d', '#fef08a', '#fef3c7', '#fed7aa', '#ffedd5'];
    return Object.entries(supplierTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value], index) => ({
        name,
        value,
        color: colors[index % colors.length]
      }));
  }, [filteredEntries, hasCRMAddon, showPricesWithVAT]);

  const projectChartData = useMemo(() => {
    const projectTotals: Record<string, number> = {};
    const approvedEntriesWithProject = filteredEntries
      .filter(e => e.project && isApprovedStatus(e.status));
    
    console.log('📊 Project Chart Data:', {
      totalFilteredEntries: filteredEntries.length,
      approvedEntries: filteredEntries.filter(e => isApprovedStatus(e.status)).length,
      withProject: approvedEntriesWithProject.length,
      entries: approvedEntriesWithProject.map(e => ({
        id: e.id,
        status: e.status,
        project: e.project?.name,
        amount: getDisplayAmount(e, showPricesWithVAT)
      }))
    });
    
    approvedEntriesWithProject.forEach(e => {
      const projectName = e.project?.name || 'Sin proyecto';
      projectTotals[projectName] = (projectTotals[projectName] || 0) + getDisplayAmount(e, showPricesWithVAT);
    });

    const colors = ['#a855f7', '#c084fc', '#d8b4fe', '#e9d5ff', '#f3e8ff', '#fae8ff', '#ede9fe', '#f5f3ff'];
    const chartData = Object.entries(projectTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value], index) => ({
        name,
        value,
        color: colors[index % colors.length]
      }));
    
    console.log('📊 Final chart data:', chartData);
    return chartData;
  }, [filteredEntries, showPricesWithVAT]);

  // Estadísticas calculadas respetando el toggle de IVA
  const calculatedStats = useMemo(() => {
    const approvedEntries = entries.filter(e => isApprovedStatus(e.status));
    const totalIncomesAmount = approvedEntries
      .filter(e => e.type === 'income')
      .reduce((sum, e) => sum + getDisplayAmount(e, showPricesWithVAT), 0);
    const totalExpensesAmount = approvedEntries
      .filter(e => e.type === 'expense')
      .reduce((sum, e) => sum + getDisplayAmount(e, showPricesWithVAT), 0);
    const pendingExpensesAmount = entries
      .filter(e => e.type === 'expense' && e.status === 'pending')
      .reduce((sum, e) => sum + getDisplayAmount(e, showPricesWithVAT), 0);
    
    return {
      balance: totalIncomesAmount - totalExpensesAmount,
      totalIncomes: { amount: totalIncomesAmount },
      totalExpenses: { amount: totalExpensesAmount },
      pendingExpenses: { amount: pendingExpensesAmount },
    };
  }, [entries, showPricesWithVAT]);

  // Lógica de scroll infinito para movimientos
  const hasMoreMovementsToDisplay = displayedMovementsCount < filteredEntries.length;
  const displayedMovements = filteredEntries.slice(0, displayedMovementsCount);

  const loadMoreMovements = useCallback(() => {
    if (displayedMovementsCount < filteredEntries.length) {
      setDisplayedMovementsCount(prev => 
        Math.min(prev + MOVEMENTS_PER_LOAD, filteredEntries.length + MOVEMENTS_PER_LOAD)
      );
    }
  }, [displayedMovementsCount, filteredEntries.length, MOVEMENTS_PER_LOAD]);

  // IntersectionObserver para detectar cuando el usuario llega al final
  useEffect(() => {
    if (activeTab !== 'movements') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some(entry => entry.isIntersecting) && hasMoreMovementsToDisplay) {
          loadMoreMovements();
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    const timeoutId = setTimeout(() => {
      if (loadMoreMovementsRef.current) {
        observer.observe(loadMoreMovementsRef.current);
      }
    }, 50);

    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [activeTab, hasMoreMovementsToDisplay, loadMoreMovements]);

  // Reset displayedMovementsCount cuando se aplican cambios de filtro
  useEffect(() => {
    setDisplayedMovementsCount(MOVEMENTS_PER_LOAD);
  }, [filterType, filterStatus, filterProject, selectedStartDate, selectedEndDate]);

  useEffect(() => {
    return () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
        previewObjectUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!showEntryModal && previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
  }, [showEntryModal]);

  // Seleccionar automáticamente el primer archivo para mostrar en el visor
  useEffect(() => {
    if (showEntryModal) {
      // Solo auto-seleccionar si no hay nada seleccionado (evitar sobrescribir imagen procesada)
      if (selectedFileForViewer) {
        return;
      }
      
      // Priorizar archivos nuevos
      if (entryFiles.length > 0) {
        const firstFile = entryFiles[0];
        const url = URL.createObjectURL(firstFile);
        setSelectedFileForViewer({
          url,
          filename: firstFile.name,
          mimeType: firstFile.type,
          type: 'new',
          index: 0
        });
      }
      // Si no hay archivos nuevos, mostrar el primer attachment existente
      else if (editingEntry?.attachments && editingEntry.attachments.length > 0) {
        const firstAttachment = editingEntry.attachments[0];
        setSelectedFileForViewer({
          url: firstAttachment.fileUrl || `/api/accounting/attachments/${firstAttachment.id}/download`,
          filename: firstAttachment.fileName,
          mimeType: firstAttachment.mimeType,
          type: 'existing',
          index: 0
        });
      }
      // Si no hay archivos, limpiar el visor
      else {
        setSelectedFileForViewer(null);
      }
    }
  }, [showEntryModal, entryFiles, editingEntry?.attachments, selectedFileForViewer]);

  // Limpiar recursos al cambiar/eliminar archivos
  useEffect(() => {
    return () => {
      // Limpiar URLs al desmontar
      newFilePreviewUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      newFilePreviewUrlsRef.current = [];
    };
  }, [entryFiles]);

  // Reiniciar estado de modo lectura cuando se cierre el modal
  useEffect(() => {
    if (!showEntryModal) {
      setIsEntryModalReadOnly(false);
      setInlineRevertLoading(false);
    }
  }, [showEntryModal]);

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

  // Convertir PDF a imagen (primera página) para usar OCR visual cuando el PDF es una foto
  const convertPdfToImage = async (pdfFile: File): Promise<File | null> => {
    try {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 2 });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) throw new Error('No se pudo crear el lienzo para renderizar el PDF');

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        canvas: canvas as any
      };

      await (page.render(renderContext) as any).promise;

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) resolve(result);
          else reject(new Error('No se pudo convertir el PDF a imagen'));
        }, 'image/png', 0.95);
      });

      const imageFile = new File([blob], `${pdfFile.name.replace(/\.pdf$/i, '') || 'documento'}.png`, { type: 'image/png' });
      return imageFile;
    } catch (err) {
      return null;
    }
  };

  // Procesar OCR de un archivo de ticket
  const processReceiptOCR = async (file: File, options: { allowPdfFallback?: boolean } = {}) => {
    const { allowPdfFallback = true } = options;

    // Procesar imágenes y PDFs
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      return;
    }

    setIsProcessingOCR(true);
    setOcrError(null);

    try {
      const formData = new FormData();
      formData.append('receipt', file);

      const response = await fetch('/api/accounting/ocr-receipt', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: formData,
      });

      // OCR Response received

      if (!response.ok) {
        let errorMessage = 'Error al procesar el ticket';
        let errorDetails = '';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
          errorDetails = errorData.details || errorData.rawResponse || '';
        } catch (e) {
          errorMessage = `Error ${response.status}: ${response.statusText}`;
        }
        throw new Error(`${errorMessage}${errorDetails ? ` - ${errorDetails}` : ''}`);
      }

      const ocrData = await response.json();
      // OCR Data received

      // Los datos de OCR ya se han extraído, usar los archivos subidos como están
      // (el servidor los procesa internamente pero no devuelve la imagen base64 por tamaño)

      // Autocompletar campos del formulario con los datos del OCR
      setEntryForm(prev => ({
        ...prev,
        concept: ocrData.concept || prev.concept,
        amount: ocrData.amount ? String(ocrData.amount) : prev.amount,
        totalAmount: ocrData.totalAmount ? String(ocrData.totalAmount) : prev.totalAmount,
        paymentMethod: mapPaymentMethod(ocrData.paymentMethod),
      }));

      // Si hay fecha, actualizarla con validación robusta
      if (ocrData.date && typeof ocrData.date === 'string') {
        try {
          const parsedDate = new Date(ocrData.date);
          // Validar que la fecha es válida y está en un rango razonable
          const now = new Date();
          const minDate = new Date(now.getFullYear() - 10, 0, 1); // 10 años atrás
          const maxDate = new Date(now.getFullYear() + 1, 11, 31); // 1 año adelante
          
          if (!isNaN(parsedDate.getTime()) && 
              parsedDate >= minDate && 
              parsedDate <= maxDate) {
            setEntryDate(parsedDate);
          }
        } catch (error) {
          console.warn('Error parsing OCR date:', error);
        }
      }

      // Calcular VAT si tenemos amount y totalAmount con validación robusta
      if (ocrData.amount && ocrData.totalAmount && 
          typeof ocrData.amount === 'string' && typeof ocrData.totalAmount === 'string') {
        const amount = parseInputNumber(ocrData.amount);
        const total = parseInputNumber(ocrData.totalAmount);
        
        // Validar que los números son válidos y tienen sentido
        if (amount !== null && total !== null && 
            amount <= total && 
            total <= 1000000) { // Límite razonable para prevenir valores excesivos
          const vat = total - amount;
          if (vat > 0) {
            const vatRate = (vat / amount) * 100;
            setEntryForm(prev => ({
              ...prev,
              vatRate: vatRate.toFixed(0)
            }));
          }
        }
      }

      // OCR processing completed successfully - no toast shown
    } catch (error: any) {
      // Fallback: si el PDF es una foto y OpenAI rechaza el mime, reintentar como imagen
      const mimeMessage = (error?.message || '').toLowerCase();
      if (
        file.type === 'application/pdf' &&
        allowPdfFallback &&
        (mimeMessage.includes('mime') || mimeMessage.includes('image types') || mimeMessage.includes('mime type'))
      ) {
        const imageVersion = await convertPdfToImage(file);
        if (imageVersion) {
          return await processReceiptOCR(imageVersion, { allowPdfFallback: false });
        }
      }

      // OCR processing failed silently
      setOcrError(error.message);
      toast({
        title: 'Error al procesar ticket',
        description: error.message || 'No se pudo extraer la información automáticamente. Completa los campos manualmente.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessingOCR(false);
    }
  };

  // Manejar envío de movimiento
  const handleSubmitEntry = async () => {
    if (isEntryModalReadOnly) return;

    try {
      // Validaciones de entrada básicas
      if (!entryForm.concept.trim()) {
        throw new Error('El concepto es requerido');
      }
      
      if (!entryForm.categoryId) {
        throw new Error('La categoría es requerida');
      }
      
      if (entryForm.concept.trim().length > 255) {
        throw new Error('El concepto no puede exceder 255 caracteres');
      }
      
      if (entryForm.description.trim().length > 1000) {
        throw new Error('La descripción no puede exceder 1000 caracteres');
      }

      const vatDecimal = getVatDecimalFromRate(entryForm.vatRate);
      let baseAmount = parseInputNumber(entryForm.amount);
      let totalAmount = parseInputNumber(entryForm.totalAmount);

      if (baseAmount === null && totalAmount !== null) {
        baseAmount = deriveBaseFromTotal(totalAmount, entryForm.vatRate);
      }

      if (totalAmount === null && baseAmount !== null) {
        totalAmount = baseAmount * (1 + vatDecimal);
      }

      if (baseAmount === null || baseAmount <= 0) {
        throw new Error('Importe inválido - debe ser mayor a 0');
      }
      
      if (baseAmount > 1000000) {
        throw new Error('El importe no puede exceder 1,000,000');
      }

      const resolvedTotal = totalAmount ?? baseAmount * (1 + vatDecimal);
      const vatAmount = Math.max(resolvedTotal - baseAmount, 0);
      const normalizedBase = Number(baseAmount.toFixed(2));
      const normalizedTotal = Number(resolvedTotal.toFixed(2));
      const normalizedVat = Number(vatAmount.toFixed(2));
      const parsedCategoryId = parseInt(entryForm.categoryId, 10);
      
      // Validar categoryId
      if (!Number.isInteger(parsedCategoryId) || parsedCategoryId <= 0) {
        throw new Error('ID de categoría inválido');
      }
      
      // Normalizar refCode a mayúsculas para consistencia
      const sanitizedRefCode = entryForm.refCode && entryForm.refCode.trim() !== '' 
        ? entryForm.refCode.trim().toUpperCase().slice(0, 50) 
        : null;

      // El backend espera los datos en un campo 'data' como JSON
      const data: any = {
        type: entryForm.type,
        categoryId: parsedCategoryId,
        concept: entryForm.concept.trim().slice(0, 255), // Sanitizar y limitar longitud
        amount: normalizedBase,
        vatRate: parseFloat(entryForm.vatRate),
        vatAmount: normalizedVat,
        totalAmount: normalizedTotal,
        description: entryForm.description.trim().slice(0, 1000), // Sanitizar y limitar longitud
        refCode: sanitizedRefCode,
        entryDate: format(entryDate, 'yyyy-MM-dd'),
        projectId: entryForm.projectId ? 
          (() => {
            const parsed = parseInt(entryForm.projectId, 10);
            return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
          })() : null,
        paymentMethod: entryForm.paymentMethod && entryForm.paymentMethod.trim() !== '' ? entryForm.paymentMethod : null,
        crmClientId: entryForm.crmClientId && 
          Number.isInteger(entryForm.crmClientId) && 
          entryForm.crmClientId > 0 ? entryForm.crmClientId : null,
        crmSupplierId: entryForm.crmSupplierId && 
          Number.isInteger(entryForm.crmSupplierId) && 
          entryForm.crmSupplierId > 0 ? entryForm.crmSupplierId : null,
        irpfRetentionRate: entryForm.type === 'income' ? parseInputNumber(entryForm.irpfRetentionRate) : (entryForm.retentionAppliedByUs ? parseInputNumber(entryForm.irpfRetentionRate) : null),
        irpfRetentionAmount: entryForm.type === 'income' ? parseInputNumber(entryForm.irpfRetentionAmount) : (entryForm.retentionAppliedByUs ? parseInputNumber(entryForm.irpfRetentionAmount) : null),
        irpfDeductible: entryForm.type === 'expense' ? entryForm.irpfDeductible : true,
        irpfDeductionPercentage: entryForm.type === 'expense' ? parseInputNumber(entryForm.irpfDeductionPercentage) : 100,
        irpfIsSocialSecurity: entryForm.type === 'expense' ? entryForm.irpfIsSocialSecurity : false,
        irpfIsAmortization: entryForm.type === 'expense' ? entryForm.irpfIsAmortization : false,
        irpfFiscalAdjustment: parseInputNumber(entryForm.irpfFiscalAdjustment) || 0,
        fiscalNotes: entryForm.fiscalNotes.trim().slice(0, 500),
        retentionType: entryForm.retentionAppliedByUs ? (entryForm.retentionType || null) : null,
        retentionAppliedByUs: Boolean(entryForm.retentionAppliedByUs),
      };
      
      const url = editingEntry 
        ? (accountantMode 
            ? `/api/accountant/companies/${effectiveCompanyId}/entries/${editingEntry.id}`
            : `/api/accounting/entries/${editingEntry.id}`)
        : (accountantMode
            ? `/api/accountant/companies/${effectiveCompanyId}/entries`
            : '/api/accounting/entries');
      
      const method = editingEntry ? 'PATCH' : 'POST';

      let response;
      
      if (editingEntry) {
        // Para PATCH, enviar JSON directamente
        response = await fetch(url, {
          method: 'PATCH',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(data),
        });
      } else {
        // Para POST, usar FormData para archivos
        const formData = new FormData();
        formData.append('data', JSON.stringify(data));
        
        entryFiles.forEach(file => {
          formData.append('receipts', file);
        });
        
        response = await fetch(url, {
          method: 'POST',
          headers: getAuthHeaders(),
          credentials: 'include',
          body: formData,
        });
      }

      if (!response.ok) {
        let errorMessage = 'Error al guardar movimiento';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (e) {
          // No se pudo parsear el error
        }
        throw new Error(errorMessage);
      }

      toast({
        title: 'Éxito',
        description: editingEntry 
          ? 'Movimiento actualizado correctamente' 
          : 'Movimiento creado correctamente',
      });

      setShowEntryModal(false);
      resetEntryForm();
      queryClient.invalidateQueries({ queryKey: ['/api/accounting/entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/accounting/dashboard'] });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo guardar el movimiento',
        variant: 'destructive',
      });
    }
  };

  // Manejar revisión de movimiento (aprobar/rechazar)
  const handleReviewEntry = async (entryId: number, status: 'approved' | 'rejected' | 'approved_accountant', notes?: string) => {
    try {
      // Si es admin aprobando y tiene gestoría externa, cambiar a "approved" (que se mostrará como "Enviado")
      // Si es accountant aprobando, usar "approved_accountant"
      let finalStatus = status;
      
      if (status === 'approved' && !accountantMode && usesExternalAccountant) {
        // Admin aprueba -> se queda como 'approved' (se muestra como "Enviado")
        finalStatus = 'approved';
      }
      
      const endpoint = accountantMode 
        ? `/api/accountant/companies/${effectiveCompanyId}/entries/${entryId}/review`
        : `/api/accounting/entries/${entryId}/review`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ status: finalStatus, notes }),
      });

      if (!response.ok) {
        throw new Error('Error al revisar movimiento');
      }

      const result = await response.json();

      const successMessage = 
        finalStatus === 'approved_accountant' ? 'Movimiento aprobado por gestoría' :
        finalStatus === 'approved' && usesExternalAccountant ? 'Movimiento enviado al gestor' : 
        finalStatus === 'approved' ? 'Movimiento aprobado' : 'Movimiento rechazado';

      toast({
        title: 'Éxito',
        description: successMessage,
      });

      // Actualizar caché
      const dashboardEndpoint = accountantMode
        ? `/api/accountant/companies/${effectiveCompanyId}/dashboard`
        : '/api/accounting/dashboard';
        
      const dashboardResponse = await fetch(dashboardEndpoint, {
        headers: {
          ...getAuthHeaders(),
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
        cache: 'no-store',
        credentials: 'include',
      });
      
      if (dashboardResponse.ok) {
        const freshStats = await dashboardResponse.json();
        queryClient.setQueryData(['/api/accounting/dashboard', effectiveCompanyId], freshStats);
      }
      
      // Invalidar entries
      await queryClient.refetchQueries({ 
        queryKey: accountantMode 
          ? ['/api/accounting/entries', effectiveCompanyId]
          : ['/api/accounting/entries'] 
      });
      
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo revisar el movimiento',
        variant: 'destructive',
      });
    }
  };

  // Custom Tooltip para los gráficos - estilo Apple con dark mode
  const CustomChartTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0];
    return (
      <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm px-3 py-2 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 relative z-[9999]">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {data.name}
        </p>
        <p className="text-xs font-medium" style={{ color: data.payload.fill }}>
          {formatCurrency(data.value)}
        </p>
      </div>
    );
  };

  // Abrir confirmación de eliminación de movimiento
  const openDeleteEntryConfirm = (entryId: number) => {
    setEntryToDelete(entryId);
    setDeleteEntryConfirmOpen(true);
  };

  // Manejar eliminación de movimiento
  const handleDeleteEntry = async () => {
    if (!entryToDelete) return;

    try {
      const response = await fetch(`/api/accounting/entries/${entryToDelete}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Error al eliminar movimiento');
      }

      toast({
        title: 'Éxito',
        description: 'Movimiento eliminado correctamente',
      });

      queryClient.invalidateQueries({ queryKey: ['/api/accounting/entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/accounting/dashboard'] });
      setDeleteEntryConfirmOpen(false);
      setEntryToDelete(null);
    } catch (error) {
      // console.error('Error deleting entry:', error);
      setDeleteEntryConfirmOpen(false);
      setEntryToDelete(null);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el movimiento',
        variant: 'destructive',
      });
    }
  };

  // Descargar archivo adjunto
  const handleDownloadAttachment = async (attachment: AccountingAttachment | null) => {
    if (!attachment) return;

    try {
      const attachmentUrl = attachment.fileUrl || `/api/accounting/attachments/${attachment.id}/download`;
      const response = await fetch(attachmentUrl, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.fileName;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo descargar el archivo',
        variant: 'destructive',
      });
    }
  };

  // Función para abrir preview de imagen/PDF
  const handleOpenPreview = (file: File | null, attachment: AccountingAttachment | null) => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewModalState({
        open: true,
        url,
        filename: file.name,
        mimeType: file.type,
      });
    } else if (attachment) {
      const url = attachment.fileUrl || `/api/accounting/attachments/${attachment.id}/download`;
      setPreviewModalState({
        open: true,
        url,
        filename: attachment.fileName,
        mimeType: attachment.mimeType,
      });
    }
  };

  const handleClosePreview = () => {
    // Cleanup blob URL if it was created for a file
    if (previewModalState?.url?.startsWith('blob:')) {
      URL.revokeObjectURL(previewModalState.url);
    }
    setPreviewModalState(null);
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    if (!editingEntry) return;
    
    try {
      const response = await fetch(`/api/accounting/attachments/${attachmentId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Error al eliminar adjunto');
      }

      // Update editingEntry to remove the deleted attachment
      setEditingEntry(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          attachments: prev.attachments?.filter(a => a.id !== attachmentId) || []
        };
      });

      // Clear viewer if the deleted file was being viewed
      if (selectedFileForViewer?.url?.includes(String(attachmentId))) {
        setSelectedFileForViewer(null);
      }

      toast({
        title: 'Éxito',
        description: 'Adjunto eliminado correctamente',
      });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/accounting/entries'] });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el adjunto',
        variant: 'destructive',
      });
    }
  };

  const revertEntryToPendingOnServer = async (entryId: number) => {
    const response = await fetch(`/api/accounting/entries/${entryId}`, {
      method: 'PATCH',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ status: 'pending' }),
    });

    if (!response.ok) {
      let errorMessage = 'Error al revertir movimiento';
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch (parseError) {
        // console.error('Error leyendo respuesta de revertir:', parseError);
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();

    const dashboardResponse = await fetch('/api/accounting/dashboard', {
      headers: {
        ...getAuthHeaders(),
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
      cache: 'no-store',
      credentials: 'include',
    });

    if (dashboardResponse.ok) {
      const freshStats = await dashboardResponse.json();
      queryClient.setQueryData(['/api/accounting/dashboard'], freshStats);
    }

    await queryClient.refetchQueries({ queryKey: ['/api/accounting/entries'] });

    return result;
  };

  // Revertir a pendiente
  const handleRevertToPending = async () => {
    if (!revertConfirm.entry) return;

    try {
      // Revertir en el servidor
      await revertEntryToPendingOnServer(revertConfirm.entry.id);

      // Si estamos en el modal editando, también activar el formulario
      if (editingEntry && editingEntry.id === revertConfirm.entry.id) {
        setIsEntryModalReadOnly(false);
        // Actualizar el estado del movimiento en el formulario
        setEditingEntry({ ...editingEntry, status: 'pending' });
      }

      toast({
        title: 'Éxito',
        description: 'Movimiento revertido a pendiente',
      });

      setRevertConfirm({ open: false, entry: null });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo revertir el movimiento',
        variant: 'destructive',
      });
      setRevertConfirm({ open: false, entry: null });
    }
  };

  const handleInlineRevertToPending = async () => {
    if (!editingEntry || user?.role !== 'admin') return;

    try {
      setInlineRevertLoading(true);
      await revertEntryToPendingOnServer(editingEntry.id);

      toast({
        title: 'Éxito',
        description: 'Movimiento revertido a pendiente',
      });

      setEditingEntry(prev => (prev ? { ...prev, status: 'pending' } : prev));
      setIsEntryModalReadOnly(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo revertir el movimiento',
        variant: 'destructive',
      });
    } finally {
      setInlineRevertLoading(false);
    }
  };

  // Manejar envío de categoría
  const handleSubmitCategory = async () => {
    try {
      const url = editingCategory 
        ? `/api/accounting/categories/${editingCategory.id}`
        : '/api/accounting/categories';
      
      const method = editingCategory ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(categoryForm),
      });

      if (!response.ok) {
        throw new Error('Error al guardar categoría');
      }

      toast({
        title: 'Éxito',
        description: editingCategory 
          ? 'Categoría actualizada correctamente' 
          : 'Categoría creada correctamente',
      });

      setShowCategoryModal(false);
      resetCategoryForm();
      queryClient.invalidateQueries({ queryKey: ['/api/accounting/categories'] });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo guardar la categoría',
        variant: 'destructive',
      });
    }
  };

  // Exportar Libro IVA a Excel
  const exportIVAToExcel = () => {
    try {
      // Filtrar movimientos aprobados dentro del período
      const fiscalEntries = entries.filter((entry: any) => {
        if (entry.status !== 'approved') return false;
        
        const entryDate = new Date(entry.entryDate);
        entryDate.setHours(0, 0, 0, 0);
        
        if (selectedStartDate) {
          const startDate = new Date(selectedStartDate);
          startDate.setHours(0, 0, 0, 0);
          if (entryDate < startDate) return false;
        }
        if (selectedEndDate) {
          const endDate = new Date(selectedEndDate);
          endDate.setHours(23, 59, 59, 999);
          if (entryDate > endDate) return false;
        }
        
        return true;
      });

      // Crear datos para Excel
      const workbook = XLSX.utils.book_new();

      // HOJA 1: Resumen IVA
      const summaryData: any[] = [];
      
      // Calcular totales
      const ivaRepercutido: any = {
        total: 0,
        byRate: { '21': { base: 0, vat: 0 }, '10': { base: 0, vat: 0 }, '4': { base: 0, vat: 0 }, '0': { base: 0, vat: 0 } }
      };

      const ivaSoportado: any = {
        total: 0,
        byRate: { '21': { base: 0, vat: 0 }, '10': { base: 0, vat: 0 }, '4': { base: 0, vat: 0 }, '0': { base: 0, vat: 0 } }
      };

      fiscalEntries.filter((e: any) => e.type === 'income').forEach((entry: any) => {
        const vatRate = entry.vatRate?.toString() || (entry.vatAmount && entry.totalAmount 
          ? Math.round((parseFloat(entry.vatAmount.toString()) / (parseFloat(entry.totalAmount.toString()) - parseFloat(entry.vatAmount.toString()))) * 100).toString()
          : '21');
        const rateKey = ['21', '10', '4', '0'].includes(vatRate) ? vatRate : '21';
        const base = parseFloat(entry.amount.toString());
        const vat = parseFloat(entry.vatAmount?.toString() || '0');
        
        ivaRepercutido.byRate[rateKey].base += base;
        ivaRepercutido.byRate[rateKey].vat += vat;
        ivaRepercutido.total += vat;
      });

      fiscalEntries.filter((e: any) => e.type === 'expense').forEach((entry: any) => {
        const vatRate = entry.vatRate?.toString() || (entry.vatAmount && entry.totalAmount 
          ? Math.round((parseFloat(entry.vatAmount.toString()) / (parseFloat(entry.totalAmount.toString()) - parseFloat(entry.vatAmount.toString()))) * 100).toString()
          : '21');
        const rateKey = ['21', '10', '4', '0'].includes(vatRate) ? vatRate : '21';
        const base = parseFloat(entry.amount.toString());
        const vat = parseFloat(entry.vatAmount?.toString() || '0');
        
        ivaSoportado.byRate[rateKey].base += base;
        ivaSoportado.byRate[rateKey].vat += vat;
        ivaSoportado.total += vat;
      });

      const liquidacion = ivaRepercutido.total - ivaSoportado.total;

      summaryData.push({ Concepto: 'RESUMEN IVA' });
      summaryData.push({ Concepto: 'Período', Desde: format(selectedStartDate || new Date(), 'dd/MM/yyyy', { locale: es }), Hasta: format(selectedEndDate || new Date(), 'dd/MM/yyyy', { locale: es }) });
      summaryData.push({ Concepto: '' });
      summaryData.push({ Concepto: 'IVA REPERCUTIDO (Ingresos)' });
      summaryData.push({ Concepto: 'Tasa', 'Base Imponible': 'Base Imponible', 'Importe IVA': 'Importe IVA' });
      
      ['21', '10', '4', '0'].forEach(rate => {
        const data = ivaRepercutido.byRate[rate];
        if (data.base > 0 || data.vat > 0) {
          summaryData.push({
            Concepto: `${rate}%`,
            'Base Imponible': data.base.toFixed(2),
            'Importe IVA': data.vat.toFixed(2)
          });
        }
      });
      summaryData.push({ Concepto: 'TOTAL REPERCUTIDO', 'Base Imponible': '', 'Importe IVA': ivaRepercutido.total.toFixed(2) });
      summaryData.push({ Concepto: '' });
      summaryData.push({ Concepto: 'IVA SOPORTADO (Gastos)' });
      summaryData.push({ Concepto: 'Tasa', 'Base Imponible': 'Base Imponible', 'Importe IVA': 'Importe IVA' });
      
      ['21', '10', '4', '0'].forEach(rate => {
        const data = ivaSoportado.byRate[rate];
        if (data.base > 0 || data.vat > 0) {
          summaryData.push({
            Concepto: `${rate}%`,
            'Base Imponible': data.base.toFixed(2),
            'Importe IVA': data.vat.toFixed(2)
          });
        }
      });
      summaryData.push({ Concepto: 'TOTAL SOPORTADO', 'Base Imponible': '', 'Importe IVA': ivaSoportado.total.toFixed(2) });
      summaryData.push({ Concepto: '' });
      summaryData.push({ Concepto: 'LIQUIDACIÓN IVA' });
      summaryData.push({ Concepto: 'IVA a Pagar/Devolver', Importe: liquidacion.toFixed(2) });

      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');

      // HOJA 2: Libro IVA Detallado
      const bookData = fiscalEntries.map((entry: any) => {
        const vatRate = entry.vatRate?.toString() || (entry.vatAmount && entry.totalAmount 
          ? Math.round((parseFloat(entry.vatAmount.toString()) / (parseFloat(entry.totalAmount.toString()) - parseFloat(entry.vatAmount.toString()))) * 100).toString()
          : '21');
        
        return {
          Fecha: format(new Date(entry.entryDate), 'dd/MM/yyyy', { locale: es }),
          Tipo: entry.type === 'income' ? 'Ingreso' : entry.type === 'expense' ? 'Gasto' : 'Pendiente',
          Concepto: entry.concept || '',
          'Base Imponible': parseFloat(entry.amount.toString()).toFixed(2),
          'Tasa IVA': `${vatRate}%`,
          'Importe IVA': parseFloat(entry.vatAmount?.toString() || '0').toFixed(2),
          Total: parseFloat(entry.totalAmount?.toString() || '0').toFixed(2),
          Categoría: entry.categoryName || '',
          Estado: entry.status || '',
        };
      });

      const bookSheet = XLSX.utils.json_to_sheet(bookData);
      XLSX.utils.book_append_sheet(workbook, bookSheet, 'Libro IVA');

      // Descargar archivo
      const fileName = `Libro_IVA_${format(selectedStartDate || new Date(), 'yyyy-MM-dd')}_${format(selectedEndDate || new Date(), 'yyyy-MM-dd')}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast({
        title: 'Éxito',
        description: 'Libro IVA exportado correctamente',
      });
    } catch (error) {
      logger.error('Error exportando IVA:', error);
      toast({
        title: 'Error',
        description: 'No se pudo exportar el Libro IVA',
        variant: 'destructive',
      });
    }
  };

  // Abrir confirmación de eliminación de categoría
  const openDeleteCategoryConfirm = (categoryId: number) => {
    setCategoryToDelete(categoryId);
    setDeleteCategoryConfirmOpen(true);
  };

  // Manejar eliminación de categoría
  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;

    try {
      const response = await fetch(`/api/accounting/categories/${categoryToDelete}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Error al eliminar categoría');
      }

      toast({
        title: 'Éxito',
        description: 'Categoría eliminada correctamente',
      });

      queryClient.invalidateQueries({ queryKey: ['/api/accounting/categories'] });
      setDeleteCategoryConfirmOpen(false);
      setCategoryToDelete(null);
    } catch (error) {
      // console.error('Error deleting category:', error);
      setDeleteCategoryConfirmOpen(false);
      setCategoryToDelete(null);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la categoría',
        variant: 'destructive',
      });
    }
  };

  const resetEntryForm = () => {
    setEntryForm({
      type: 'expense',
      categoryId: '',
      concept: '',
      amount: '',
      totalAmount: '',
      vatRate: DEFAULT_VAT_RATE,
      description: '',
      refCode: '',
      projectId: null,
      crmClientId: null,
      crmSupplierId: null,
      paymentMethod: '',
      irpfRetentionRate: '',
      irpfRetentionAmount: '',
      irpfDeductible: true,
      irpfDeductionPercentage: '100',
      irpfIsSocialSecurity: false,
      irpfIsAmortization: false,
      irpfFiscalAdjustment: '0',
      fiscalNotes: '',
    });
    setEntryDate(new Date());
    
    // Limpiar archivos nuevos y sus vistas previas
    newFilePreviewUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    newFilePreviewUrlsRef.current = [];
    setEntryFiles([]);
    setSelectedFileForViewer(null);
    setManualEntryMode(false);
    
    setEditingEntry(null);
    setIsEntryModalReadOnly(false);
    setInlineRevertLoading(false);
  };

  const resetCategoryForm = () => {
    setCategoryForm({
      name: '',
      type: 'expense',
      color: '#6366f1',
      icon: '💰',
    });
    setEditingCategory(null);
  };

  const openAddEntryModal = () => {
    resetEntryForm();
    setShowEntryModal(true);
  };

  const openEditEntryModal = async (entry: AccountingEntry, options?: { readOnly?: boolean }) => {
    // Si es accountant y el entry está en approved, permitir edición
    const lockFields = options?.readOnly ?? (entry.status === 'approved' && !accountantMode);
    setIsEntryModalReadOnly(lockFields);
    setInlineRevertLoading(false);
    setEditingEntry(entry);


    const storedBase = entry.amount !== undefined && entry.amount !== null ? Number(entry.amount) : null;
    const storedVat = entry.vatAmount !== undefined && entry.vatAmount !== null ? Number(entry.vatAmount) : null;
    const storedTotal = entry.totalAmount !== undefined && entry.totalAmount !== null
      ? Number(entry.totalAmount)
      : storedBase !== null && storedVat !== null
        ? storedBase + storedVat
        : null;

    const derivedRate = storedBase !== null && storedVat !== null && storedBase !== 0
      ? (storedVat / storedBase) * 100
      : null;
    const vatRateValue = derivedRate !== null
      ? matchKnownVatRate(derivedRate)
      : entry.employeeId
        ? DEFAULT_VAT_RATE
        : DEFAULT_VAT_RATE;

    const resolvedTotal = storedTotal !== null
      ? storedTotal
      : storedBase !== null
        ? storedBase * (1 + getVatDecimalFromRate(vatRateValue))
        : null;
    const resolvedBase = resolvedTotal !== null
      ? deriveBaseFromTotal(resolvedTotal, vatRateValue)
      : storedBase;

    setEntryForm({
      type: entry.type,
      categoryId: entry.categoryId ? String(entry.categoryId) : '',
      concept: entry.concept,
      amount: resolvedBase !== null ? formatCurrencyInput(resolvedBase) : storedBase !== null ? String(storedBase) : '',
      totalAmount: resolvedTotal !== null ? formatCurrencyInput(resolvedTotal) : '',
      vatRate: vatRateValue,
      description: entry.description,
      refCode: entry.refCode || '',
      projectId: entry.projectId ? String(entry.projectId) : null,
      crmClientId: entry.crmClientId || null,
      crmSupplierId: entry.crmSupplierId || null,
      paymentMethod: entry.paymentMethod || '',
      irpfRetentionRate: entry.irpfRetentionRate !== null && entry.irpfRetentionRate !== undefined
        ? String(entry.irpfRetentionRate)
        : '',
      irpfRetentionAmount: entry.irpfRetentionAmount !== null && entry.irpfRetentionAmount !== undefined
        ? formatCurrencyInput(Number(entry.irpfRetentionAmount))
        : '',
      irpfDeductible: entry.type === 'expense' ? entry.irpfDeductible !== false : true,
      irpfDeductionPercentage: entry.irpfDeductionPercentage !== null && entry.irpfDeductionPercentage !== undefined
        ? String(entry.irpfDeductionPercentage)
        : '100',
      irpfIsSocialSecurity: entry.type === 'expense' ? Boolean(entry.irpfIsSocialSecurity) : false,
      irpfIsAmortization: entry.type === 'expense' ? Boolean(entry.irpfIsAmortization) : false,
      irpfFiscalAdjustment: entry.irpfFiscalAdjustment !== null && entry.irpfFiscalAdjustment !== undefined
        ? String(entry.irpfFiscalAdjustment)
        : '0',
      fiscalNotes: entry.fiscalNotes || '',
      retentionType: (entry.retentionType as any) || '',
      retentionAppliedByUs: Boolean((entry as any).retentionAppliedByUs),
    });
    setEntryDate(new Date(entry.entryDate));
    
    // Load full entry with attachments if not already loaded
    if (!entry.attachments || entry.attachments.length === 0) {
      try {
        const response = await fetch(`/api/accounting/entries/${entry.id}`, {
          headers: getAuthHeaders(),
          credentials: 'include',
        });
        if (response.ok) {
          const fullEntry = await response.json();
          setEditingEntry(prev => ({
            ...prev,
            ...fullEntry,
            submittedByUser: fullEntry.submittedByUser ?? prev?.submittedByUser ?? null,
          }));
          // Actualizar el formulario con los datos completos, incluyendo refCode
          if (fullEntry.refCode) {
            setEntryForm(prev => ({
              ...prev,
              refCode: fullEntry.refCode || '',
            }));
          }
        }
      } catch (error) {
        // Error loading attachments
      }
    }
    
    setShowEntryModal(true);
  };

  const handleEntryCardClick = (entry: AccountingEntry) => {
    if (!['pending', 'approved', 'rejected'].includes(entry.status)) {
      return;
    }

    // El accountant puede editar "approved" (Enviado), otros roles solo pueden editar "pending"
    if (accountantMode) {
      if (entry.status === 'approved') {
        openEditEntryModal(entry, { readOnly: false });
      } else {
        openEditEntryModal(entry, { readOnly: entry.status !== 'pending' });
      }
    } else {
      // Admin/manager no pueden editar approved, deben revertir primero
      openEditEntryModal(entry, { readOnly: entry.status === 'approved' });
    }
  };

  const openAddCategoryModal = () => {
    resetCategoryForm();
    setShowCategoryModal(true);
  };

  const handleOpenAttachmentInNewTab = () => {
    if (!previewModalState || !previewModalState.url) return;
    const newTab = window.open(previewModalState.url, '_blank', 'noopener,noreferrer');
    if (!newTab) {
      toast({
        title: 'Aviso del navegador',
        description: 'Permite las ventanas emergentes para abrir el documento en otra pestaña.',
        variant: 'destructive',
      });
    }
  };

  const openEditCategoryModal = (category: AccountingCategory) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      type: category.type,
      color: category.color,
      icon: category.icon,
    });
    setShowCategoryModal(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        // Si tiene gestoría externa, "Aprobado" se muestra como "Enviado" en azul
        return <Badge className={usesExternalAccountant 
          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" 
          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"}>
          {usesExternalAccountant ? 'Enviado' : 'Aprobado'}
        </Badge>;
      case 'approved_accountant':
        return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Aprobado Gestoría</Badge>;
      case 'accountant_approved':
        return <Badge className="bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400">Revisado</Badge>;
      case 'submitted':
        return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Enviado</Badge>;
      case 'rejected':
        return <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">Rechazado</Badge>;
      case 'pending':
      default:
        return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Pendiente</Badge>;
    }
  };

  const getStatusColors = (status: string) => {
    switch (status) {
      case 'approved':
        return { 
          bg: usesExternalAccountant ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-emerald-100 dark:bg-emerald-900/40', 
          text: usesExternalAccountant ? 'text-blue-700 dark:text-blue-300' : 'text-emerald-700 dark:text-emerald-300', 
          label: usesExternalAccountant ? 'Enviado' : 'Aprobado' 
        };
      case 'approved_accountant':
        return { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300', label: 'Aprobado Gestoría' };
      case 'accountant_approved':
        return { bg: 'bg-cyan-100 dark:bg-cyan-900/40', text: 'text-cyan-700 dark:text-cyan-300', label: 'Revisado' };
      case 'submitted':
        return { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300', label: 'Enviado' };
      case 'rejected':
        return { bg: 'bg-rose-100 dark:bg-rose-900/40', text: 'text-rose-700 dark:text-rose-300', label: 'Rechazado' };
      case 'pending':
      default:
        return { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300', label: 'Pendiente' };
    }
  };

  return (
    <div>
      {/* Stats Cards */}
      <StatsCardGrid columns={4}>
        <StatsCard 
          label="Balance" 
          value={formatCurrency(calculatedStats.balance || 0)}
          color={(calculatedStats.balance || 0) >= 0 ? 'green' : 'red'}
          icon={Calculator}
          isLoading={isLoadingStats}
          index={0}
        />
        <StatsCard 
          label="Total Ingresos" 
          value={formatCurrency(calculatedStats.totalIncomes.amount || 0)}
          color="green" 
          icon={TrendingUp}
          isLoading={isLoadingStats}
          index={1}
          onClick={handleIncomesFilter}
          isActive={activeStatsFilter === 'incomes'}
        />
        <StatsCard 
          label="Total Gastos" 
          value={formatCurrency(calculatedStats.totalExpenses.amount || 0)}
          color="red" 
          icon={TrendingDown}
          isLoading={isLoadingStats}
          index={2}
          onClick={handleExpensesFilter}
          isActive={activeStatsFilter === 'expenses'}
        />
        <StatsCard 
          label="Gastos Pendientes" 
          value={formatCurrency(calculatedStats.pendingExpenses.amount || 0)}
          color="orange" 
          icon={AlertCircle}
          isLoading={isLoadingStats}
          index={3}
          onClick={handlePendingFilter}
          isActive={activeStatsFilter === 'pending'}
        />
      </StatsCardGrid>

      {/* Botón para volver a empresas si es modo accountant */}
      {accountantMode && onBackToCompanies && (
        <div className="mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBackToCompanies}
            className="text-blue-600 hover:text-blue-700"
          >
            ← Volver a empresas
          </Button>
        </div>
      )}

      {/* Tab Navigation */}
      <TabNavigation
        tabs={[
          { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
          { id: 'movements', label: 'Movimientos', icon: List, badge: filteredEntries.filter(e => e.status === 'pending').length > 0 ? filteredEntries.filter(e => e.status === 'pending').length : undefined },
          { id: 'fiscalidad', label: 'Fiscalidad', icon: Calculator },
          { id: 'categories', label: 'Categorías', icon: FolderOpen },
        ]}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as TabType)}
      />

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {isLoadingStats || isLoadingEntries ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : (
            <>
              {/* Resumen del mes actual - CLICKEABLE PARA DESPLEGAR ANALYTICS */}
              <Card 
                className={`dark:bg-gray-800 dark:border-gray-700 transition-all duration-500 overflow-hidden ${
                  showExpandedAnalytics 
                    ? 'cursor-default' 
                    : 'cursor-pointer hover:shadow-lg hover:dark:shadow-lg/20'
                }`}
              >
                <CardContent className="p-6">
                  {/* Gráficas de resumen */}
                  <div className="grid grid-cols-4 gap-0.5 md:gap-3 mb-3">
                      {/* CON CRM: Categorías, Clientes, Proveedores, Proyectos */}
                      {/* SIN CRM: Cat.Gastos, Cat.Ingresos, Gastos RefCode, Ingresos RefCode */}
                      
                      {hasCRMAddon ? (
                        <>
                          {/* Gráfica de Categorías (todas) */}
                          <div>
                            <h3 className="text-xs md:text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1 text-center">
                              Categorías
                            </h3>
                            {categoryChartData && categoryChartData.length > 0 ? (
                              <div className="relative h-[90px] md:h-[150px] flex items-center justify-center">
                                <div className="absolute inset-0 flex items-center justify-center animate-in fade-in duration-700">
                                  <Calculator
                                    className="w-4 h-4 md:w-8 md:h-8"
                                    style={{ color: categoryChartData?.[0]?.color || '#9CA3AF' }}
                                  />
                                </div>
                                <div className="relative z-10 w-full h-full">
                                  <ResponsiveContainer width="100%" height="100%" style={{ outline: 'none' }}>
                                    <PieChart>
                                      <Pie
                                        data={categoryChartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={getChartRadii(isMobile).innerRadius}
                                        outerRadius={getChartRadii(isMobile).outerRadius}
                                        dataKey="value"
                                        startAngle={90}
                                        endAngle={-270}
                                        stroke="transparent"
                                      >
                                        {categoryChartData.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                      </Pie>
                                      <Tooltip content={<CustomChartTooltip />} />
                                    </PieChart>
                                  </ResponsiveContainer>
                                </div>
                              </div>
                            ) : (
                              <div className="h-[90px] md:h-[150px] flex items-center justify-center text-gray-500 text-xs">Sin datos</div>
                            )}
                          </div>

                          {/* Gráfica de Clientes */}
                          <div>
                            <h3 className="text-xs md:text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1 text-center">
                              Clientes
                            </h3>
                            {clientChartData && clientChartData.length > 0 ? (
                              <div className="relative h-[90px] md:h-[150px] flex items-center justify-center">
                                <div className="absolute inset-0 flex items-center justify-center animate-in fade-in duration-700">
                                  <Users
                                    className="w-4 h-4 md:w-8 md:h-8"
                                    style={{ color: clientChartData?.[0]?.color || '#9CA3AF' }}
                                  />
                                </div>
                                <div className="relative z-10 w-full h-full">
                                  <ResponsiveContainer width="100%" height="100%" style={{ outline: 'none' }}>
                                    <PieChart>
                                      <Pie
                                        data={clientChartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={getChartRadii(isMobile).innerRadius}
                                        outerRadius={getChartRadii(isMobile).outerRadius}
                                        dataKey="value"
                                        startAngle={90}
                                        endAngle={-270}
                                        stroke="transparent"
                                      >
                                        {clientChartData.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                      </Pie>
                                      <Tooltip content={<CustomChartTooltip />} />
                                    </PieChart>
                                  </ResponsiveContainer>
                                </div>
                              </div>
                            ) : (
                              <div className="h-[90px] md:h-[150px] flex items-center justify-center text-gray-500 text-xs">Sin datos</div>
                            )}
                          </div>

                          {/* Gráfica de Proveedores */}
                          <div>
                            <h3 className="text-xs md:text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1 text-center">
                              Proveedores
                            </h3>
                            {supplierChartData && supplierChartData.length > 0 ? (
                              <div className="relative h-[90px] md:h-[150px] flex items-center justify-center">
                                <div className="absolute inset-0 flex items-center justify-center animate-in fade-in duration-700">
                                  <Building2
                                    className="w-4 h-4 md:w-8 md:h-8"
                                    style={{ color: supplierChartData?.[0]?.color || '#9CA3AF' }}
                                  />
                                </div>
                                <div className="relative z-10 w-full h-full">
                                  <ResponsiveContainer width="100%" height="100%" style={{ outline: 'none' }}>
                                    <PieChart>
                                      <Pie
                                        data={supplierChartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={getChartRadii(isMobile).innerRadius}
                                        outerRadius={getChartRadii(isMobile).outerRadius}
                                        dataKey="value"
                                        startAngle={90}
                                        endAngle={-270}
                                        stroke="transparent"
                                      >
                                        {supplierChartData.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                      </Pie>
                                      <Tooltip content={<CustomChartTooltip />} />
                                    </PieChart>
                                  </ResponsiveContainer>
                                </div>
                              </div>
                            ) : (
                              <div className="h-[90px] md:h-[150px] flex items-center justify-center text-gray-500 text-xs">Sin datos</div>
                            )}
                          </div>

                          {/* Gráfica de Proyectos */}
                          <div>
                            <h3 className="text-xs md:text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1 text-center">
                              Proyectos
                            </h3>
                            {projectChartData && projectChartData.length > 0 ? (
                              <div className="relative h-[90px] md:h-[150px] flex items-center justify-center">
                                <div className="absolute inset-0 flex items-center justify-center animate-in fade-in duration-700">
                                  <Briefcase
                                    className="w-4 h-4 md:w-8 md:h-8"
                                    style={{ color: projectChartData?.[0]?.color || '#9CA3AF' }}
                                  />
                                </div>
                                <div className="relative z-10 w-full h-full">
                                  <ResponsiveContainer width="100%" height="100%" style={{ outline: 'none' }}>
                                    <PieChart>
                                      <Pie
                                        data={projectChartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={getChartRadii(isMobile).innerRadius}
                                        outerRadius={getChartRadii(isMobile).outerRadius}
                                        dataKey="value"
                                        startAngle={90}
                                        endAngle={-270}
                                        stroke="transparent"
                                      >
                                        {projectChartData.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                      </Pie>
                                      <Tooltip content={<CustomChartTooltip />} />
                                    </PieChart>
                                  </ResponsiveContainer>
                                </div>
                              </div>
                            ) : (
                              <div className="h-[90px] md:h-[150px] flex items-center justify-center text-gray-500 text-xs">Sin datos</div>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          {/* SIN CRM: Gráficas alternativas */}
                          
                          {/* Gráfica de Categorías Gastos */}
                          <div>
                            <h3 className="text-xs md:text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1 text-center">
                              Cat. Gastos
                            </h3>
                            {categoryExpenseChartData && categoryExpenseChartData.length > 0 ? (
                              <div className="relative h-[90px] md:h-[150px] flex items-center justify-center">
                                <div className="absolute inset-0 flex items-center justify-center animate-in fade-in duration-700">
                                  <TrendingDown
                                    className="w-4 h-4 md:w-8 md:h-8"
                                    style={{ color: categoryExpenseChartData?.[0]?.color || '#9CA3AF' }}
                                  />
                                </div>
                                <div className="relative z-10 w-full h-full">
                                  <ResponsiveContainer width="100%" height="100%" style={{ outline: 'none' }}>
                                    <PieChart>
                                      <Pie
                                        data={categoryExpenseChartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={getChartRadii(isMobile).innerRadius}
                                        outerRadius={getChartRadii(isMobile).outerRadius}
                                        dataKey="value"
                                        startAngle={90}
                                        endAngle={-270}
                                        stroke="transparent"
                                      >
                                        {categoryExpenseChartData.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                      </Pie>
                                      <Tooltip content={<CustomChartTooltip />} />
                                    </PieChart>
                                  </ResponsiveContainer>
                                </div>
                              </div>
                            ) : (
                              <div className="h-[90px] md:h-[150px] flex items-center justify-center text-gray-500 text-xs">Sin datos</div>
                            )}
                          </div>

                          {/* Gráfica de Categorías Ingresos */}
                          <div>
                            <h3 className="text-xs md:text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1 text-center">
                              Cat. Ingresos
                            </h3>
                            {categoryIncomeChartData && categoryIncomeChartData.length > 0 ? (
                              <div className="relative h-[90px] md:h-[150px] flex items-center justify-center">
                                <div className="absolute inset-0 flex items-center justify-center animate-in fade-in duration-700">
                                  <TrendingUp
                                    className="w-4 h-4 md:w-8 md:h-8"
                                    style={{ color: categoryIncomeChartData?.[0]?.color || '#9CA3AF' }}
                                  />
                                </div>
                                <div className="relative z-10 w-full h-full">
                                  <ResponsiveContainer width="100%" height="100%" style={{ outline: 'none' }}>
                                    <PieChart>
                                      <Pie
                                        data={categoryIncomeChartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={getChartRadii(isMobile).innerRadius}
                                        outerRadius={getChartRadii(isMobile).outerRadius}
                                        dataKey="value"
                                        startAngle={90}
                                        endAngle={-270}
                                        stroke="transparent"
                                      >
                                        {categoryIncomeChartData.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                      </Pie>
                                      <Tooltip content={<CustomChartTooltip />} />
                                    </PieChart>
                                  </ResponsiveContainer>
                                </div>
                              </div>
                            ) : (
                              <div className="h-[90px] md:h-[150px] flex items-center justify-center text-gray-500 text-xs">Sin datos</div>
                            )}
                          </div>

                          {/* Gráfica de Gastos por RefCode */}
                          <div>
                            <h3 className="text-xs md:text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1 text-center">
                              Gastos Cód.Ref
                            </h3>
                            {refCodeExpenseChartData && refCodeExpenseChartData.length > 0 ? (
                              <div className="relative h-[90px] md:h-[150px] flex items-center justify-center">
                                <div className="absolute inset-0 flex items-center justify-center animate-in fade-in duration-700">
                                  <TrendingDown
                                    className="w-4 h-4 md:w-8 md:h-8"
                                    style={{ color: refCodeExpenseChartData?.[0]?.color || '#9CA3AF' }}
                                  />
                                </div>
                                <div className="relative z-10 w-full h-full">
                                  <ResponsiveContainer width="100%" height="100%" style={{ outline: 'none' }}>
                                    <PieChart>
                                      <Pie
                                        data={refCodeExpenseChartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={getChartRadii(isMobile).innerRadius}
                                        outerRadius={getChartRadii(isMobile).outerRadius}
                                        dataKey="value"
                                        startAngle={90}
                                        endAngle={-270}
                                        stroke="transparent"
                                      >
                                        {refCodeExpenseChartData.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                      </Pie>
                                      <Tooltip content={<CustomChartTooltip />} />
                                    </PieChart>
                                  </ResponsiveContainer>
                                </div>
                              </div>
                            ) : (
                              <div className="h-[90px] md:h-[150px] flex items-center justify-center text-gray-500 text-xs">Sin datos</div>
                            )}
                          </div>

                          {/* Gráfica de Ingresos por RefCode */}
                          <div>
                            <h3 className="text-xs md:text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1 text-center">
                              Ingresos Cód.Ref
                            </h3>
                            {refCodeIncomeChartData && refCodeIncomeChartData.length > 0 ? (
                              <div className="relative h-[90px] md:h-[150px] flex items-center justify-center">
                                <div className="absolute inset-0 flex items-center justify-center animate-in fade-in duration-700">
                                  <TrendingUp
                                    className="w-4 h-4 md:w-8 md:h-8"
                                    style={{ color: refCodeIncomeChartData?.[0]?.color || '#9CA3AF' }}
                                  />
                                </div>
                                <div className="relative z-10 w-full h-full">
                                  <ResponsiveContainer width="100%" height="100%" style={{ outline: 'none' }}>
                                    <PieChart>
                                      <Pie
                                        data={refCodeIncomeChartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={getChartRadii(isMobile).innerRadius}
                                        outerRadius={getChartRadii(isMobile).outerRadius}
                                        dataKey="value"
                                        startAngle={90}
                                        endAngle={-270}
                                        stroke="transparent"
                                      >
                                        {refCodeIncomeChartData.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                      </Pie>
                                      <Tooltip content={<CustomChartTooltip />} />
                                    </PieChart>
                                  </ResponsiveContainer>
                                </div>
                              </div>
                            ) : (
                              <div className="h-[90px] md:h-[150px] flex items-center justify-center text-gray-500 text-xs">Sin datos</div>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                  {/* Botón para ver análisis avanzado */}
                  {!showExpandedAnalytics && (
                    <div className="mt-3 flex justify-center">
                      <button
                        onClick={() => setShowExpandedAnalytics(true)}
                        className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <ChevronDown className="w-3 h-3" />
                        Ver más datos
                      </button>
                    </div>
                  )}

                  {/* Análisis expandido */}
                  {showExpandedAnalytics && (
                    <div className="mt-3">
                      <div className="flex justify-center mb-0">
                        <button
                          onClick={() => setShowExpandedAnalytics(false)}
                          className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <ChevronUp className="w-3 h-3" />
                          Ver menos
                        </button>
                      </div>
                      <AccountingAnalyticsExpandedView
                        entries={entries as any}
                        stats={stats}
                        crmActive={hasCRMAddon}
                        showPricesWithVAT={showPricesWithVAT}
                        onClose={() => setShowExpandedAnalytics(false)}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

          {/* Últimos movimientos */}
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold dark:text-gray-100">Últimos Movimientos</h3>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setActiveTab('movements')}
                  className="dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Ver todos
                </Button>
              </div>
              <div className="space-y-3">
                {entries.slice(0, 5).map((entry) => {
                  const category = categories.find(c => c.id === entry.categoryId);
                  return (
                    <div 
                      key={entry.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full ${entry.type === 'income' ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-rose-100 dark:bg-rose-900/30'} flex items-center justify-center`}>
                          {entry.type === 'income' ? (
                            <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <TrendingDown className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{category?.name || 'Sin categoría'}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{new Date(entry.entryDate).toLocaleDateString('es-ES')}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${entry.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {entry.type === 'income' ? '+' : '-'}{formatCurrency(getDisplayAmount(entry, showPricesWithVAT))}
                        </p>
                        {getStatusBadge(entry.status)}
                      </div>
                    </div>
                  );
                })}
                {entries.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500 dark:text-gray-400">No hay movimientos registrados</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
            </>
          )}
        </div>
      )}

      {/* Movements Tab */}
      {activeTab === 'movements' && (
        <div className="space-y-4">
          {/* Filtros - Desktop */}
          <div className="hidden md:flex items-center gap-3 min-h-[40px]">
            {/* Contador de movimientos */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg">
              <span className="text-sm font-medium text-foreground">{filteredEntries.length}</span>
              <span className="text-sm text-muted-foreground">movimientos</span>
            </div>
            
            {/* Filtro Tipo */}
            <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="expense">Gastos</SelectItem>
                <SelectItem value="income">Ingresos</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Filtro Estado */}
            <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="pending">Pendientes</SelectItem>
                <SelectItem value="submitted">Enviados</SelectItem>
                <SelectItem value="accountant_approved">Revisados</SelectItem>
                <SelectItem value="approved">Aprobados</SelectItem>
                <SelectItem value="rejected">Rechazados</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Filtro Proyecto (solo si CRM addon está activo) */}
            {hasCRMAddon && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-[180px] justify-between"
                  >
                    {filterProject === 'all' 
                      ? 'Todos los proyectos' 
                      : projects.find(p => p.id.toString() === filterProject)?.name || 'Seleccionar...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-[220px] p-0" 
                  side="bottom" 
                  align="start"
                >
                  <div className="p-2 border-b">
                    <input
                      type="text"
                      placeholder="Buscar proyecto..."
                      value={projectSearchTerm}
                      onChange={(e) => setProjectSearchTerm(e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded dark:bg-gray-900 dark:border-gray-700"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    <button 
                      type="button"
                      className="w-full text-left px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-sm"
                      onClick={() => {
                        setFilterProject('all');
                        setProjectSearchTerm('');
                      }}
                    >
                      <Check
                        className={`inline mr-2 h-4 w-4 ${filterProject === 'all' ? 'opacity-100' : 'opacity-0'}`}
                      />
                      Todos los proyectos
                    </button>
                    {projects
                      .filter(p => {
                        const searchLower = projectSearchTerm.toLowerCase();
                        return (p.code?.toLowerCase().includes(searchLower) || p.name.toLowerCase().includes(searchLower));
                      })
                      .map(project => (
                      <button
                        key={project.id}
                        type="button"
                        className="w-full text-left px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-sm"
                        onClick={() => {
                          setFilterProject(project.id.toString());
                          setProjectSearchTerm('');
                        }}
                      >
                        <Check
                          className={`inline mr-2 h-4 w-4 ${filterProject === project.id.toString() ? 'opacity-100' : 'opacity-0'}`}
                        />
                        {project.code ? `[${project.code}] ${project.name}` : project.name}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
            
            {/* Filtro Fecha */}
            <DatePickerPeriod
              startDate={selectedStartDate || undefined}
              endDate={selectedEndDate || undefined}
              onStartDateChange={(date) => setSelectedStartDate(date || null)}
              onEndDateChange={(date) => setSelectedEndDate(date || null)}
            />
            
            {/* Toggle IVA */}
            <Button
              variant={showPricesWithVAT ? "default" : "outline"}
              size="sm"
              onClick={() => setShowPricesWithVAT(!showPricesWithVAT)}
              className="whitespace-nowrap"
            >
              {showPricesWithVAT ? "Con IVA" : "Sin IVA"}
            </Button>
            
            {/* Spacer para empujar el botón a la derecha */}
            <div className="flex-1" />
            
            {/* Botón Añadir */}
            <Button onClick={openAddEntryModal} size="sm" className="bg-[#007AFF] hover:bg-[#0056CC]">
              <Plus className="w-4 h-4 mr-1" />
              Añadir Movimiento
            </Button>
          </div>
          
          {/* Filtros - Mobile */}
          <div className="md:hidden space-y-2">
            {/* Fila 1: Contador y Botón Añadir */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg">
                <span className="text-sm font-medium text-foreground">{filteredEntries.length}</span>
                <span className="text-sm text-muted-foreground">mov</span>
              </div>
              <Button onClick={openAddEntryModal} size="sm" className="bg-[#007AFF] hover:bg-[#0056CC]">
                <Plus className="w-4 h-4 mr-1" />
                Añadir
              </Button>
            </div>
            
            {/* Fila 2: Tipo, Estado e IVA */}
            <div className="grid grid-cols-3 gap-2">
              <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="expense">Gastos</SelectItem>
                  <SelectItem value="income">Ingresos</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendientes</SelectItem>
                  <SelectItem value="submitted">Enviados</SelectItem>
                  <SelectItem value="accountant_approved">Revisados</SelectItem>
                  <SelectItem value="approved">Aprobados</SelectItem>
                  <SelectItem value="rejected">Rechazados</SelectItem>
                </SelectContent>
              </Select>
              
              <Button
                variant={showPricesWithVAT ? "default" : "outline"}
                size="sm"
                onClick={() => setShowPricesWithVAT(!showPricesWithVAT)}
                className="h-9 text-xs px-2"
              >
                {showPricesWithVAT ? "IVA" : "s/IVA"}
              </Button>
            </div>
            
            {/* Fila 3: Proyecto (si CRM) y Fechas */}
            <div className={`grid gap-2 ${hasCRMAddon ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {hasCRMAddon && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full h-9 text-xs justify-between"
                    >
                      {filterProject === 'all' 
                        ? 'Proyectos' 
                        : projects.find(p => p.id.toString() === filterProject)?.name || 'Proyecto...'}
                      <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" side="bottom" align="start">
                    <div className="p-2 border-b">
                      <input
                        type="text"
                        placeholder="Buscar proyecto..."
                        value={projectSearchTerm}
                        onChange={(e) => setProjectSearchTerm(e.target.value)}
                        className="w-full px-2 py-1 text-xs border rounded dark:bg-gray-900 dark:border-gray-700"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                      <button
                        type="button"
                        className="w-full text-left px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-sm"
                        onClick={() => {
                          setFilterProject('all');
                          setProjectSearchTerm('');
                        }}
                      >
                        <Check
                          className={`inline mr-2 h-4 w-4 ${filterProject === 'all' ? 'opacity-100' : 'opacity-0'}`}
                        />
                        Todos los proyectos
                      </button>
                      {projects
                        .filter(p => {
                          const searchLower = projectSearchTerm.toLowerCase();
                          return (p.code?.toLowerCase().includes(searchLower) || p.name.toLowerCase().includes(searchLower));
                        })
                        .map(project => (
                        <button
                          key={project.id}
                          type="button"
                          className="w-full text-left px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-sm"
                          onClick={() => {
                            setFilterProject(project.id.toString());
                            setProjectSearchTerm('');
                          }}
                        >
                          <Check
                            className={`inline mr-2 h-4 w-4 ${filterProject === project.id.toString() ? 'opacity-100' : 'opacity-0'}`}
                          />
                          {project.code ? `[${project.code}] ${project.name}` : project.name}
                        </button>
                        ))}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              
              <DatePickerPeriod
                startDate={selectedStartDate || undefined}
                endDate={selectedEndDate || undefined}
                onStartDateChange={(date) => setSelectedStartDate(date || null)}
                onEndDateChange={(date) => setSelectedEndDate(date || null)}
                className="h-9 w-full"
              />
            </div>
          </div>

          {/* Lista de movimientos */}
          {isLoadingEntries ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-12">
              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                  <List className="w-6 h-6 text-muted-foreground" />
                </div>
                <div className="text-foreground font-medium">
                  {entries.length === 0 
                    ? "No hay movimientos" 
                    : "No se encontraron movimientos con los filtros aplicados"}
                </div>
                <div className="text-muted-foreground text-sm">
                  {entries.length === 0 
                    ? "Los movimientos aparecerán aquí"
                    : `Total de movimientos: ${entries.length}`}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedMovements.map((entry) => {
                const category = categories.find(c => c.id === entry.categoryId);
                const isInteractive = ['pending', 'approved', 'rejected'].includes(entry.status);
                const statusColors = getStatusColors(entry.status);
                return (
                  <Card 
                    key={entry.id}
                    className="dark:bg-gray-800 dark:border-gray-700 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all overflow-hidden rounded-2xl border border-gray-200"
                  >
                    <CardContent className="p-0">
                      <div className="flex items-stretch">
                        {/* Contenido principal - flex-1 que contiene mobile y desktop */}
                        <div 
                          className={`flex-1 flex flex-col ${isInteractive ? 'cursor-pointer' : ''}`}
                          onClick={isInteractive ? () => handleEntryCardClick(entry) : undefined}
                        >
                          {/* MÓVIL: Layout compacto */}
                          <div className="sm:hidden p-3 space-y-2">
                            {/* Línea 1: Concepto + Cantidad */}
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate flex-1">
                                {entry.concept || category?.name || 'Sin categoría'}
                              </span>
                              <span className={`text-base font-bold whitespace-nowrap flex-shrink-0 ${
                                entry.type === 'income'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}>
                                {entry.type === 'income' ? '+' : '-'}{formatCurrency(getDisplayAmount(entry, showPricesWithVAT))}
                              </span>
                            </div>

                            {/* Línea 2: Proyecto/RefCode + Fecha + Acciones */}
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 flex-1 min-w-0">
                                {hasCRMAddon && entry.project && (
                                  <span className="text-purple-600 dark:text-purple-400 truncate">
                                    {entry.project.code ? `[${entry.project.code}]` : entry.project.name}
                                  </span>
                                )}
                                {!hasCRMAddon && entry.refCode && (
                                  <span className="text-blue-600 dark:text-blue-400 truncate">
                                    {entry.refCode}
                                  </span>
                                )}
                                <span className="whitespace-nowrap">
                                  {new Date(entry.entryDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })}
                                </span>
                              </div>
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                {(entry.status === 'approved' || entry.status === 'rejected') && user?.role === 'admin' && !accountantMode && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setRevertConfirm({ open: true, entry })}
                                    className="h-6 w-6 p-0 text-orange-600 hover:text-orange-700 dark:text-orange-400"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                  </Button>
                                )}
                                {entry.status === 'pending' && user?.role === 'admin' && !accountantMode && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleReviewEntry(entry.id, 'approved')}
                                      className="h-6 w-6 p-0 text-emerald-600 dark:text-emerald-400"
                                      title={usesExternalAccountant ? 'Enviar al gestor' : 'Aprobar'}
                                    >
                                      <Check className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleReviewEntry(entry.id, 'rejected')}
                                      className="h-6 w-6 p-0 text-rose-600 dark:text-rose-400"
                                    >
                                      <X className="w-3 h-3" />
                                    </Button>
                                  </>
                                )}
                                {/* Accountant puede aprobar/rechazar movimientos en estado 'approved' (enviados) */}
                                {accountantMode && entry.status === 'approved' && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleReviewEntry(entry.id, 'approved_accountant' as 'approved')}
                                      className="h-6 w-6 p-0 text-green-600 dark:text-green-400"
                                      title="Aprobar Gestoría"
                                    >
                                      <Check className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleReviewEntry(entry.id, 'rejected')}
                                      className="h-6 w-6 p-0 text-rose-600 dark:text-rose-400"
                                      title="Rechazar"
                                    >
                                      <X className="w-3 h-3" />
                                    </Button>
                                  </>
                                )}
                                {/* Accountant puede revertir movimientos rechazados a 'approved' (enviado) */}
                                {accountantMode && entry.status === 'rejected' && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleReviewEntry(entry.id, 'approved')}
                                    className="h-6 w-6 p-0 text-blue-600 dark:text-blue-400"
                                    title="Revertir a Enviado"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                  </Button>
                                )}
                                {/* Accountant puede revertir movimientos 'approved_accountant' a 'approved' para editarlos */}
                                {accountantMode && entry.status === 'approved_accountant' && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleReviewEntry(entry.id, 'approved')}
                                    className="h-6 w-6 p-0 text-blue-600 dark:text-blue-400"
                                    title="Revertir a Enviado"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                  </Button>
                                )}
                                {(entry.status === 'pending' || user?.role === 'admin') && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => openDeleteEntryConfirm(entry.id)}
                                    className="h-6 w-6 p-0 text-rose-600 dark:text-rose-400"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* DESKTOP: fila con grid proporcional */}
                          <div className="hidden sm:flex items-stretch min-w-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                            {/* Contenido principal con grid proporcional */}
                            <div className="flex-1 grid items-center px-3 sm:px-4 py-3 gap-2 lg:gap-3 min-w-0" style={{ gridTemplateColumns: 'minmax(40px,40px) minmax(200px,2fr) minmax(100px,1.5fr) minmax(40px,40px) minmax(100px,1.5fr) minmax(100px,1.5fr) minmax(120px,1.5fr)' }}>
                              {/* Icono tipo */}
                              <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center ${
                                entry.type === 'income'
                                  ? 'bg-emerald-100 dark:bg-emerald-900/30'
                                  : 'bg-rose-100 dark:bg-rose-900/30'
                              }`}>
                                {entry.type === 'income' ? (
                                  <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                ) : (
                                  <TrendingDown className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                                )}
                              </div>
                              
                              {/* Categoría y concepto */}
                              <div className="min-w-0">
                                {hasCRMAddon && entry.project && (
                                  <p className="text-xs text-purple-600 dark:text-purple-400 font-medium mb-0.5">
                                    {entry.project.code ? `[${entry.project.code}] ${entry.project.name}` : entry.project.name}
                                  </p>
                                )}
                                {!hasCRMAddon && entry.refCode && (
                                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-0.5">
                                    {entry.refCode}
                                  </p>
                                )}
                                <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate text-sm">
                                  {entry.concept || category?.name || 'Sin categoría'}
                                </h3>
                                {entry.description && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                    {entry.description}
                                  </p>
                                )}
                                {hasCRMAddon && entry.refCode && (
                                  <p className="text-xs text-blue-600 dark:text-blue-400 truncate font-medium mt-0.5">
                                    Ref: {entry.refCode}
                                  </p>
                                )}
                              </div>
                              
                              {/* Fecha */}
                              <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                                <CalendarIcon className="w-4 h-4 flex-shrink-0" />
                                <span className="whitespace-nowrap">
                                  {new Date(entry.entryDate).toLocaleDateString('es-ES', { 
                                    day: '2-digit', 
                                    month: 'short',
                                    year: 'numeric'
                                  })}
                                </span>
                              </div>
                              
                              {/* Archivos adjuntos */}
                              <div className="flex justify-center items-center">
                                {entry.attachments && entry.attachments.length > 0 ? (
                                  <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                    <Paperclip className="w-3.5 h-3.5" />
                                    <span>{entry.attachments.length}</span>
                                  </div>
                                ) : (
                                  <div className="w-6 h-4" /> 
                                )}
                              </div>
                              
                              {/* Usuario */}
                              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {entry.submittedByUser?.fullName || 'N/A'}
                              </div>
                              
                              {/* Importe */}
                              <div className="text-right">
                                <p className={`text-lg font-bold whitespace-nowrap ${
                                  entry.type === 'income'
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-rose-600 dark:text-rose-400'
                                }`}>
                                  {entry.type === 'income' ? '+' : '-'}{formatCurrency(getDisplayAmount(entry, showPricesWithVAT))}
                                </p>
                              </div>
                              
                              {/* Acciones */}
                              <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                {(entry.status === 'approved' || entry.status === 'rejected') && user?.role === 'admin' && !accountantMode ? (
                                  <button
                                    onClick={() => setRevertConfirm({ open: true, entry })}
                                    className="p-1.5 rounded-lg text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/30 transition-colors"
                                    title="Revertir a pendiente"
                                  >
                                    <RotateCcw className="w-4 h-4" />
                                  </button>
                                ) : <div className="w-8" />}
                                {entry.status === 'pending' && user?.role === 'admin' && !accountantMode ? (
                                  <>
                                    <button
                                      onClick={() => handleReviewEntry(entry.id, 'approved')}
                                      className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
                                      title={usesExternalAccountant ? 'Enviar al gestor' : 'Aprobar'}
                                    >
                                      <Check className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleReviewEntry(entry.id, 'rejected')}
                                      className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
                                      title="Rechazar"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </>
                                ) : <><div className="w-8" /><div className="w-8" /></>}
                                {/* Accountant puede aprobar/rechazar movimientos en estado 'approved' (enviados) */}
                                {accountantMode && entry.status === 'approved' && (
                                  <>
                                    <button
                                      onClick={() => handleReviewEntry(entry.id, 'approved_accountant' as 'approved')}
                                      className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors"
                                      title="Aprobar Gestoría"
                                    >
                                      <Check className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleReviewEntry(entry.id, 'rejected')}
                                      className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
                                      title="Rechazar"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                                {/* Accountant puede revertir movimientos rechazados a 'approved' (enviado) */}
                                {accountantMode && entry.status === 'rejected' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleReviewEntry(entry.id, 'approved');
                                    }}
                                    className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                                    title="Revertir a Enviado"
                                  >
                                    <RotateCcw className="w-4 h-4" />
                                  </button>
                                )}
                                {/* Accountant puede revertir movimientos 'approved_accountant' a 'approved' para editarlos */}
                                {accountantMode && entry.status === 'approved_accountant' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleReviewEntry(entry.id, 'approved');
                                    }}
                                    className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                                    title="Revertir a Enviado"
                                  >
                                    <RotateCcw className="w-4 h-4" />
                                  </button>
                                )}
                                {(entry.status === 'pending' || user?.role === 'admin') && !accountantMode ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openDeleteEntryConfirm(entry.id);
                                    }}
                                    className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
                                    title="Eliminar"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                ) : <div className="w-8" />}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Estado: Barra en móvil (w-1), sección en desktop */}
                        {/* Móvil */}
                        <div className={`sm:hidden w-1 flex-shrink-0 ${
                          entry.status === 'pending' 
                            ? 'bg-yellow-500 dark:bg-yellow-500' 
                            : entry.status === 'approved'
                            ? 'bg-green-500 dark:bg-green-500'
                            : 'bg-red-500 dark:bg-red-500'
                        }`}>
                        </div>

                        {/* Desktop */}
                        <div 
                          className={`hidden sm:flex sm:w-[100px] items-center justify-center flex-shrink-0 px-3 ${statusColors.bg}`}
                        >
                          <span className={`text-[10px] sm:text-xs font-semibold text-center leading-tight ${statusColors.text}`}>
                            {statusColors.label}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              
              {/* Load more indicator para scroll infinito */}
              {hasMoreMovementsToDisplay && (
                <div ref={loadMoreMovementsRef} className="text-center py-8">
                  <div className="text-sm text-muted-foreground">
                    Cargando más movimientos...
                  </div>
                </div>
              )}
              
              {/* Mensaje de fin de lista */}
              {!hasMoreMovementsToDisplay && displayedMovements.length > 0 && (
                <div className="text-center py-8">
                  <div className="text-sm text-muted-foreground">
                    Mostrando {displayedMovements.length} de {filteredEntries.length} movimientos
                  </div>
                </div>
              )}
              </div>
            )}
        </div>
      )}

      {/* Fiscalidad Tab */}
      {activeTab === 'fiscalidad' && (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Button
              onClick={handleOpenFiscalConfig}
              variant="secondary"
              size="sm"
              className="gap-2"
            >
              <Settings className="h-4 w-4" />
              Configurar fiscalidad
            </Button>
            <div className="flex items-center gap-3">
              <DatePickerPeriod
                startDate={selectedStartDate || undefined}
                endDate={selectedEndDate || undefined}
                onStartDateChange={(date) => setSelectedStartDate(date || null)}
                onEndDateChange={(date) => setSelectedEndDate(date || null)}
                className="w-auto"
              />
              <Button
                onClick={() => setShowExportModal(true)}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Exportar
              </Button>
            </div>
          </div>

          {isLoadingEntries ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : (
            <>
            {(() => {
                // Filtrar movimientos aprobados dentro del período
                const fiscalEntries = entries.filter(entry => {
                  if (entry.status !== 'approved') return false;
                  
                  const entryDate = new Date(entry.entryDate);
                  entryDate.setHours(0, 0, 0, 0);
                  
                  if (selectedStartDate) {
                    const startDate = new Date(selectedStartDate);
                    startDate.setHours(0, 0, 0, 0);
                    if (entryDate < startDate) return false;
                  }
                  if (selectedEndDate) {
                    const endDate = new Date(selectedEndDate);
                    endDate.setHours(23, 59, 59, 999);
                    if (entryDate > endDate) return false;
                  }
                  
                  return true;
                });

                // Calcular IVA Repercutido (ingresos)
                const ivaRepercutido = {
                  total: 0,
                  byRate: {
                    '21': { base: 0, vat: 0, count: 0 },
                    '10': { base: 0, vat: 0, count: 0 },
                    '4': { base: 0, vat: 0, count: 0 },
                    '0': { base: 0, vat: 0, count: 0 },
                  }
                };

                fiscalEntries
                  .filter(e => e.type === 'income')
                  .forEach(entry => {
                    // Use stored VAT rate, fallback to calculated or default 21%
                    const vatRate = entry.vatRate?.toString() || 
                      (entry.vatAmount && entry.totalAmount 
                        ? Math.round((parseFloat(entry.vatAmount.toString()) / (parseFloat(entry.totalAmount.toString()) - parseFloat(entry.vatAmount.toString()))) * 100).toString()
                        : '21');
                    const rateKey = ['21', '10', '4', '0'].includes(vatRate) ? vatRate : '21';
                    const base = parseFloat(entry.amount.toString());
                    const vat = parseFloat(entry.vatAmount?.toString() || '0');
                    
                    ivaRepercutido.byRate[rateKey as '21' | '10' | '4' | '0'].base += base;
                    ivaRepercutido.byRate[rateKey as '21' | '10' | '4' | '0'].vat += vat;
                    ivaRepercutido.byRate[rateKey as '21' | '10' | '4' | '0'].count += 1;
                    ivaRepercutido.total += vat;
                  });

                // Calcular IVA Soportado (gastos)
                const ivaSoportado = {
                  total: 0,
                  byRate: {
                    '21': { base: 0, vat: 0, count: 0 },
                    '10': { base: 0, vat: 0, count: 0 },
                    '4': { base: 0, vat: 0, count: 0 },
                    '0': { base: 0, vat: 0, count: 0 },
                  }
                };

                fiscalEntries
                  .filter(e => e.type === 'expense')
                  .forEach(entry => {
                    // Use stored VAT rate, fallback to calculated or default 21%
                    const vatRate = entry.vatRate?.toString() || 
                      (entry.vatAmount && entry.totalAmount 
                        ? Math.round((parseFloat(entry.vatAmount.toString()) / (parseFloat(entry.totalAmount.toString()) - parseFloat(entry.vatAmount.toString()))) * 100).toString()
                        : '21');
                    const rateKey = ['21', '10', '4', '0'].includes(vatRate) ? vatRate : '21';
                    const base = parseFloat(entry.amount.toString());
                    const vat = parseFloat(entry.vatAmount?.toString() || '0');
                    
                    ivaSoportado.byRate[rateKey as '21' | '10' | '4' | '0'].base += base;
                    ivaSoportado.byRate[rateKey as '21' | '10' | '4' | '0'].vat += vat;
                    ivaSoportado.byRate[rateKey as '21' | '10' | '4' | '0'].count += 1;
                    ivaSoportado.total += vat;
                  });

                // Liquidación final
                const liquidacion = ivaRepercutido.total - ivaSoportado.total;

                const safeNumber = (value: any) => {
                  const parsed = typeof value === 'string' ? parseFloat(value) : Number(value);
                  return Number.isFinite(parsed) ? parsed : 0;
                };

                const irpfConfig = activeFiscalConfig;

                const irpfIncomeBase = fiscalEntries
                  .filter(e => e.type === 'income')
                  .reduce((sum, entry) => sum + safeNumber(entry.amount), 0);

                const irpfExpenseBase = fiscalEntries
                  .filter(e => e.type === 'expense')
                  .reduce((sum, entry) => sum + safeNumber(entry.amount), 0);

                // Calculate deductible expenses with proper percentage and exclusions
                const irpfDeductibleExpenses = fiscalEntries
                  .filter(e => e.type === 'expense')
                  .reduce((sum, entry) => {
                    // If marked as not deductible, skip
                    if (entry.irpfDeductible === false) return sum;
                    
                    // If marked as amortization, skip (handled separately)
                    if (entry.irpfIsAmortization) return sum;
                    
                    // Apply deduction percentage (default 100%)
                    const deductionPercentage = safeNumber(entry.irpfDeductionPercentage) || 100;
                    const deductibleAmount = safeNumber(entry.amount) * (deductionPercentage / 100);
                    
                    return sum + deductibleAmount;
                  }, 0);

                // Calculate amortizations separately (they are deductible)
                const irpfAmortizations = fiscalEntries
                  .filter(e => e.type === 'expense' && e.irpfIsAmortization && e.irpfDeductible !== false)
                  .reduce((sum, entry) => {
                    const deductionPercentage = safeNumber(entry.irpfDeductionPercentage) || 100;
                    const deductibleAmount = safeNumber(entry.amount) * (deductionPercentage / 100);
                    return sum + deductibleAmount;
                  }, 0);

                // Calculate fiscal adjustments (can be positive or negative)
                const totalFiscalAdjustments = fiscalEntries
                  .reduce((sum, entry) => {
                    return sum + safeNumber(entry.irpfFiscalAdjustment);
                  }, 0);

                const socialSecurityFromMovements = fiscalEntries
                  .filter(e => e.type === 'expense' && e.irpfIsSocialSecurity)
                  .reduce((sum, entry) => sum + safeNumber(entry.amount), 0);

                const withholdingsFromMovements = fiscalEntries
                  .filter(e => e.type === 'income')
                  .reduce((sum, entry) => {
                    if (entry.irpfRetentionAmount !== undefined && entry.irpfRetentionAmount !== null) {
                      return sum + safeNumber(entry.irpfRetentionAmount);
                    }
                    if (entry.irpfRetentionRate !== undefined && entry.irpfRetentionRate !== null) {
                      const retention = safeNumber(entry.amount) * (safeNumber(entry.irpfRetentionRate) / 100);
                      return sum + retention;
                    }
                    return sum;
                  }, 0);

                const irpfRateDecimal = Math.max(irpfConfig.model130Rate || 0, 0) / 100;
                const totalSocialSecurity = Math.max(irpfConfig.manualSocialSecurity ?? 0, 0) + socialSecurityFromMovements;
                
                // IRPF Base = Ingresos - Gastos deducibles - Amortizaciones - Cuotas SS + Ajustes fiscales
                const irpfBase = Math.max(
                  irpfIncomeBase - irpfDeductibleExpenses - irpfAmortizations - totalSocialSecurity + totalFiscalAdjustments, 
                  0
                );
                
                const irpfQuota = irpfBase * irpfRateDecimal;
                const irpfTotalWithholdings = Math.max(irpfConfig.manualWithholdings ?? 0, 0) + withholdingsFromMovements;
                const irpfResult = irpfQuota - irpfTotalWithholdings - Math.max(irpfConfig.previousPayments ?? 0, 0) + (irpfConfig.otherAdjustments || 0);

                return (
                  <div className="space-y-4">
                    {/* CARD 1: IVA */}
                    <Card className="border-border">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                              <Calculator className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-lg">IVA - Impuesto sobre el Valor Añadido</h3>
                              <p className="text-xs text-muted-foreground">Modelo 303 - Liquidación trimestral</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setExpandedFiscalCard(expandedFiscalCard === 'iva' ? null : 'iva')}
                            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            {expandedFiscalCard === 'iva' ? (
                              <>
                                <ChevronUp className="w-4 h-4" />
                                Ver menos
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-4 h-4" />
                                Ver detalles
                              </>
                            )}
                          </button>
                        </div>

                        {/* Resumen compacto */}
                        {expandedFiscalCard !== 'iva' && (
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="text-center p-4 bg-muted/50 rounded-lg">
                              <div className="text-sm text-muted-foreground mb-1">IVA Repercutido</div>
                              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                €{ivaRepercutido.total.toFixed(2)}
                              </div>
                            </div>
                            <div className="text-center p-4 bg-muted/50 rounded-lg">
                              <div className="text-sm text-muted-foreground mb-1">IVA Soportado</div>
                              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                                €{ivaSoportado.total.toFixed(2)}
                              </div>
                            </div>
                            <div className="text-center p-4 bg-muted/50 rounded-lg">
                              <div className="text-sm text-muted-foreground mb-1">Diferencia</div>
                              <div className={`text-2xl font-bold ${
                                liquidacion > 0 
                                  ? 'text-red-600 dark:text-red-400' 
                                  : liquidacion < 0
                                  ? 'text-blue-600 dark:text-blue-400'
                                  : 'text-gray-600 dark:text-gray-400'
                              }`}>
                                {liquidacion > 0 ? '+' : ''}€{liquidacion.toFixed(2)}
                              </div>
                            </div>
                            <div className="text-center p-4 bg-muted/50 rounded-lg">
                              <div className="text-sm text-muted-foreground mb-1">Estado</div>
                              <div className={`text-lg font-semibold ${
                                liquidacion > 0 
                                  ? 'text-red-600 dark:text-red-400' 
                                  : liquidacion < 0
                                  ? 'text-blue-600 dark:text-blue-400'
                                  : 'text-gray-600 dark:text-gray-400'
                              }`}>
                                {liquidacion > 0 ? 'A pagar' : liquidacion < 0 ? 'A compensar' : 'Neutral'}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Contenido expandido */}
                        {expandedFiscalCard === 'iva' && (
                          <div className="space-y-6">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              {/* IVA Repercutido */}
                              <Card className="border-green-200 dark:border-green-900">
                                <CardContent className="p-6">
                                  <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                                      <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                                    </div>
                                    <div>
                                      <h3 className="font-semibold text-lg">IVA Repercutido</h3>
                                      <p className="text-xs text-muted-foreground">IVA cobrado en ventas/ingresos</p>
                                    </div>
                                  </div>

                                  <div className="space-y-3">
                                    {Object.entries(ivaRepercutido.byRate).map(([rate, data]) => {
                                      if (data.count === 0) return null;
                                      return (
                                        <div key={rate} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                          <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="font-mono">
                                              {rate}%
                                            </Badge>
                                            <span className="text-sm text-muted-foreground">
                                              ({data.count} {data.count === 1 ? 'movimiento' : 'movimientos'})
                                            </span>
                                          </div>
                                          <div className="text-right">
                                            <div className="text-xs text-muted-foreground">Base: €{data.base.toFixed(2)}</div>
                                            <div className="font-semibold text-green-600 dark:text-green-400">
                                              €{data.vat.toFixed(2)}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                    
                                    <div className="pt-3 border-t border-border">
                                      <div className="flex items-center justify-between">
                                        <span className="font-semibold">Total IVA Repercutido:</span>
                                        <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                                          €{ivaRepercutido.total.toFixed(2)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>

                              {/* IVA Soportado */}
                              <Card className="border-orange-200 dark:border-orange-900">
                                <CardContent className="p-6">
                                  <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                                      <TrendingDown className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                                    </div>
                                    <div>
                                      <h3 className="font-semibold text-lg">IVA Soportado</h3>
                                      <p className="text-xs text-muted-foreground">IVA pagado en compras/gastos (deducible)</p>
                                    </div>
                                  </div>

                                  <div className="space-y-3">
                                    {Object.entries(ivaSoportado.byRate).map(([rate, data]) => {
                                      if (data.count === 0) return null;
                                      return (
                                        <div key={rate} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                          <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="font-mono">
                                              {rate}%
                                            </Badge>
                                            <span className="text-sm text-muted-foreground">
                                              ({data.count} {data.count === 1 ? 'movimiento' : 'movimientos'})
                                            </span>
                                          </div>
                                          <div className="text-right">
                                            <div className="text-xs text-muted-foreground">Base: €{data.base.toFixed(2)}</div>
                                            <div className="font-semibold text-orange-600 dark:text-orange-400">
                                              €{data.vat.toFixed(2)}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                    
                                    <div className="pt-3 border-t border-border">
                                      <div className="flex items-center justify-between">
                                        <span className="font-semibold">Total IVA Soportado:</span>
                                        <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                                          €{ivaSoportado.total.toFixed(2)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>

                            {/* Liquidación */}
                            <Card className={`border-2 ${
                              liquidacion > 0 
                                ? 'border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20' 
                                : liquidacion < 0
                                ? 'border-blue-300 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20'
                                : 'border-gray-300 dark:border-gray-700'
                            }`}>
                              <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <h3 className="text-2xl font-bold mb-2">
                                      {liquidacion > 0 ? 'A PAGAR A HACIENDA' : liquidacion < 0 ? 'A COMPENSAR / DEVOLVER' : 'LIQUIDACIÓN NEUTRAL'}
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                      {liquidacion > 0 
                                        ? 'Resultado positivo: debe ingresar esta cantidad a Hacienda'
                                        : liquidacion < 0
                                        ? 'Resultado negativo: puede solicitar devolución o compensar en próximos trimestres'
                                        : 'El IVA repercutido y soportado están equilibrados'
                                      }
                                    </p>
                                    {liquidacion > 0 && (
                                      <p className="text-xs text-muted-foreground mt-2">
                                        ⚠️ Vencimiento: hasta el día 20 del mes siguiente al trimestre (consultar calendario fiscal)
                                      </p>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <div className="text-sm text-muted-foreground mb-1">Modelo 303</div>
                                    <div className={`text-5xl font-bold ${
                                      liquidacion > 0 
                                        ? 'text-red-600 dark:text-red-400' 
                                        : liquidacion < 0
                                        ? 'text-blue-600 dark:text-blue-400'
                                        : 'text-gray-600 dark:text-gray-400'
                                    }`}>
                                      €{Math.abs(liquidacion).toFixed(2)}
                                    </div>
                                  </div>
                                </div>

                                {/* Cálculo detallado */}
                                <div className="mt-6 pt-6 border-t border-border">
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                    <div className="text-center p-3 bg-background rounded-lg">
                                      <div className="text-muted-foreground">IVA Repercutido</div>
                                      <div className="text-xl font-semibold text-green-600 dark:text-green-400 mt-1">
                                        €{ivaRepercutido.total.toFixed(2)}
                                      </div>
                                    </div>
                                    <div className="text-center p-3 bg-background rounded-lg">
                                      <div className="text-muted-foreground">IVA Soportado</div>
                                      <div className="text-xl font-semibold text-orange-600 dark:text-orange-400 mt-1">
                                        €{ivaSoportado.total.toFixed(2)}
                                      </div>
                                    </div>
                                    <div className="text-center p-3 bg-background rounded-lg">
                                      <div className="text-muted-foreground">Diferencia</div>
                                      <div className={`text-xl font-semibold mt-1 ${
                                        liquidacion > 0 
                                          ? 'text-red-600 dark:text-red-400' 
                                          : liquidacion < 0
                                          ? 'text-blue-600 dark:text-blue-400'
                                          : 'text-gray-600 dark:text-gray-400'
                                      }`}>
                                        {liquidacion > 0 ? '+' : ''}€{liquidacion.toFixed(2)}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>

                            {/* Información legal */}
                            <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/30 dark:bg-blue-950/10">
                              <CardContent className="p-4">
                                <div className="flex gap-3">
                                  <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                                  <div className="text-sm space-y-2">
                                    <p className="font-semibold text-blue-900 dark:text-blue-100">
                                      Información importante sobre la liquidación de IVA
                                    </p>
                                    <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-200">
                                      <li>Este resumen incluye únicamente movimientos <strong>aprobados</strong> dentro del período seleccionado</li>
                                      <li>La presentación del modelo 303 es obligatoria incluso si el resultado es 0 o negativo</li>
                                      <li>Los plazos de presentación son trimestrales: 1-20 de abril, julio, octubre y enero (para el trimestre anterior)</li>
                                      <li>El cuarto trimestre tiene plazo especial: normalmente hasta el 30 de enero del año siguiente</li>
                                      <li>Esta herramienta es orientativa. Consulte con su asesor fiscal antes de presentar la declaración</li>
                                      <li>Algunos gastos pueden tener IVA no deducible (actualmente no se aplica ningún filtro adicional)</li>
                                    </ul>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* CARD 2: IRPF */}
                    <Card className="border-border">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                              <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-lg">IRPF - Impuesto sobre la Renta</h3>
                              <p className="text-xs text-muted-foreground">Modelo 130 (estimación rápida)</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setExpandedFiscalCard(expandedFiscalCard === 'irpf' ? null : 'irpf')}
                            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1 cursor-pointer"
                          >
                            {expandedFiscalCard === 'irpf' ? (
                              <>
                                <ChevronUp className="w-4 h-4" />
                                Ver menos
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-4 h-4" />
                                Ver detalles
                              </>
                            )}
                          </button>
                        </div>

                        {expandedFiscalCard !== 'irpf' && (
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="text-center p-4 bg-muted/50 rounded-lg">
                              <div className="text-sm text-muted-foreground mb-1">Ingresos base</div>
                              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">€{irpfIncomeBase.toFixed(2)}</div>
                            </div>
                            <div className="text-center p-4 bg-muted/50 rounded-lg">
                              <div className="text-sm text-muted-foreground mb-1">Gastos deducibles</div>
                              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">€{irpfDeductibleExpenses.toFixed(2)}</div>
                            </div>
                            <div className="text-center p-4 bg-muted/50 rounded-lg">
                              <div className="text-sm text-muted-foreground mb-1">Base 130</div>
                              <div className="text-2xl font-bold">€{irpfBase.toFixed(2)}</div>
                            </div>
                            <div className="text-center p-4 bg-muted/50 rounded-lg">
                              <div className="text-sm text-muted-foreground mb-1">Resultado</div>
                              <div className={`text-2xl font-bold ${irpfResult > 0 ? 'text-red-600 dark:text-red-400' : irpfResult < 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
                                {irpfResult > 0 ? 'A ingresar' : irpfResult < 0 ? 'A compensar' : '0,00'}
                                {irpfResult !== 0 ? ` €${Math.abs(irpfResult).toFixed(2)}` : ''}
                              </div>
                            </div>
                          </div>
                        )}

                        {expandedFiscalCard === 'irpf' && (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                              <Card className="border-purple-200 dark:border-purple-900">
                                <CardContent className="p-4 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <h4 className="font-semibold">Configuración fiscal</h4>
                                      <p className="text-xs text-muted-foreground">Aplicada a cálculos de IVA e IRPF</p>
                                    </div>
                                    <Badge variant="outline" className="text-[11px]">
                                      {irpfConfig.taxpayerType === 'autonomo' ? 'Autónomo' : 'Sociedad'}
                                    </Badge>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                                      <span className="text-muted-foreground">Régimen IVA</span>
                                      <span className="font-semibold">{irpfConfig.vatRegime || 'general'}</span>
                                    </div>
                                    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                                      <span className="text-muted-foreground">Prorrata IVA</span>
                                      <span className="font-semibold">{Math.min(Math.max(irpfConfig.vatProration ?? 0, 0), 100).toFixed(0)}%</span>
                                    </div>
                                    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                                      <span className="text-muted-foreground">Tipo modelo 130</span>
                                      <span className="font-semibold">{(irpfConfig.model130Rate ?? 0).toFixed(1)}%</span>
                                    </div>
                                    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                                      <span className="text-muted-foreground">Retenciones previas</span>
                                      <span className="font-semibold">€{Math.max(irpfConfig.manualWithholdings ?? 0, 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                                      <span className="text-muted-foreground">Pagos fracc. previos</span>
                                      <span className="font-semibold">€{Math.max(irpfConfig.previousPayments ?? 0, 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                                      <span className="text-muted-foreground">Cuotas SS manuales</span>
                                      <span className="font-semibold">€{Math.max(irpfConfig.manualSocialSecurity ?? 0, 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                                      <span className="text-muted-foreground">Ajustes/regularizaciones</span>
                                      <span className="font-semibold">€{(irpfConfig.otherAdjustments ?? 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                                      <span className="text-muted-foreground">Retención por defecto</span>
                                      <span className="font-semibold">{irpfConfig.retentionDefaultRate ? `${irpfConfig.retentionDefaultRate.toFixed(1)}%` : 'No definida'}</span>
                                    </div>
                                  </div>
                                  <div className="flex justify-end pt-2">
                                    <Button variant="outline" size="sm" className="gap-2" onClick={handleOpenFiscalConfig}>
                                      <Settings className="h-4 w-4" />
                                      Editar configuración
                                    </Button>
                                  </div>
                                </CardContent>
                              </Card>

                              <Card className="border-purple-200 dark:border-purple-900">
                                <CardContent className="p-4 space-y-2">
                                  <h4 className="font-semibold">Bases</h4>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex items-center justify-between">
                                      <span className="text-muted-foreground">Ingresos</span>
                                      <span className="font-semibold">€{irpfIncomeBase.toFixed(2)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-muted-foreground">Gastos deducibles</span>
                                      <span className="font-semibold">€{irpfDeductibleExpenses.toFixed(2)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-muted-foreground">Amortizaciones</span>
                                      <span className="font-semibold">€{irpfAmortizations.toFixed(2)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-muted-foreground">Cuotas SS</span>
                                      <span className="font-semibold">€{totalSocialSecurity.toFixed(2)}</span>
                                    </div>
                                    {totalFiscalAdjustments !== 0 && (
                                      <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Ajustes fiscales</span>
                                        <span className={`font-semibold ${totalFiscalAdjustments > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                          {totalFiscalAdjustments > 0 ? '+' : ''}€{totalFiscalAdjustments.toFixed(2)}
                                        </span>
                                      </div>
                                    )}
                                    <div className="flex items-center justify-between border-t pt-2">
                                      <span className="font-semibold">Base modelo 130</span>
                                      <span className="font-bold">€{irpfBase.toFixed(2)}</span>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>

                              <Card className="border-purple-200 dark:border-purple-900">
                                <CardContent className="p-4 space-y-3">
                                  <h4 className="font-semibold">Cuota y resultado</h4>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex items-center justify-between">
                                      <span className="text-muted-foreground">Cuota (base x tipo)</span>
                                      <span className="font-semibold">€{irpfQuota.toFixed(2)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-muted-foreground">Retenciones acumuladas</span>
                                      <span className="font-semibold">€{irpfTotalWithholdings.toFixed(2)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-muted-foreground">Pagos previos</span>
                                      <span className="font-semibold">€{Math.max(irpfConfig.previousPayments, 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-muted-foreground">Ajustes</span>
                                      <span className="font-semibold">€{(irpfConfig.otherAdjustments || 0).toFixed(2)}</span>
                                    </div>
                                    <div className={`flex items-center justify-between border-t pt-2 font-bold ${irpfResult > 0 ? 'text-red-600 dark:text-red-400' : irpfResult < 0 ? 'text-green-600 dark:text-green-400' : ''}`}>
                                      <span>Resultado estimado</span>
                                      <span>€{irpfResult.toFixed(2)}</span>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>

                            <Card className="border-purple-200 dark:border-purple-900 bg-purple-50/40 dark:bg-purple-900/10">
                              <CardContent className="p-4 text-sm space-y-2">
                                <div className="flex gap-2 items-start">
                                  <AlertCircle className="h-4 w-4 text-purple-600 dark:text-purple-400 mt-0.5" />
                                  <div className="space-y-1">
                                    <p className="font-semibold text-purple-900 dark:text-purple-100">Cálculo del IRPF - Modelo 130</p>
                                    <ul className="list-disc list-inside space-y-1 text-purple-900 dark:text-purple-100/90 text-xs">
                                      <li>Solo se consideran movimientos <strong>aprobados</strong> en el período.</li>
                                      <li>Marca "Cuota SS" en gastos de cotización para separarlas de otros gastos.</li>
                                      <li>Marca "Amortización" en gastos de inmovilizado para contabilizarlas correctamente.</li>
                                      <li>Algunos gastos solo son deducibles parcialmente (ej: comidas 30%, representación 100%).</li>
                                      <li>Usa "Ajustes fiscales" para regularizar diferencias temporales o permanentes.</li>
                                      <li>Las retenciones se calculan automáticamente desde los ingresos con % o importe fijo.</li>
                                      <li><strong>Importante:</strong> Este cálculo es orientativo. Consulta con tu asesor fiscal.</li>
                                    </ul>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* CARD 3: Retenciones */}
                    {(() => {
                      // Calcular retenciones practicadas (Modelos 111/115) sobre gastos aprobados del período
                      const safeNum = (v: any) => {
                        const n = typeof v === 'string' ? parseFloat(v) : Number(v);
                        return Number.isFinite(n) ? n : 0;
                      };
                      // Solo retenciones aplicadas por nosotros (gastos), separadas por tipo
                      const retenciones = fiscalEntries
                        .filter(e => e.type === 'expense' && e.retentionAppliedByUs)
                        .reduce((acc: { professional: number; rent: number; other: number; total: number }, entry: any) => {
                          const importe = entry.irpfRetentionAmount !== undefined && entry.irpfRetentionAmount !== null
                            ? safeNum(entry.irpfRetentionAmount)
                            : (entry.irpfRetentionRate !== undefined && entry.irpfRetentionRate !== null
                              ? safeNum(entry.amount) * (safeNum(entry.irpfRetentionRate) / 100)
                              : 0);
                          const type = entry.retentionType || 'other';
                          if (type === 'professional') acc.professional += importe;
                          else if (type === 'rent') acc.rent += importe;
                          else acc.other += importe;
                          acc.total += importe;
                          return acc;
                        }, { professional: 0, rent: 0, other: 0, total: 0 });
                      // Ingresos a cuenta = retenciones practicadas
                      const ingresosACuenta = retenciones.total;
                      const totalRetencionesTrimestre = retenciones.total;

                      return (
                        <Card className="border-border">
                          <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                                  <DollarSign className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                </div>
                                <div>
                                  <h3 className="font-semibold text-lg">Retenciones e Ingresos a Cuenta</h3>
                                  <p className="text-xs text-muted-foreground">Modelos 111 y 115 - Presentación trimestral</p>
                                </div>
                              </div>
                              <button
                                disabled
                                className="text-xs text-gray-400 dark:text-gray-600 flex items-center gap-1 cursor-not-allowed"
                              >
                                <ChevronDown className="w-4 h-4" />
                                Próximamente
                              </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="text-center p-4 bg-muted/50 rounded-lg">
                                <div className="text-sm text-muted-foreground mb-1">Retenciones practicadas</div>
                                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">€{retenciones.total.toFixed(2)}</div>
                              </div>
                              <div className="text-center p-4 bg-muted/50 rounded-lg">
                                <div className="text-sm text-muted-foreground mb-1">Ingresos a cuenta</div>
                                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">€{ingresosACuenta.toFixed(2)}</div>
                              </div>
                              <div className="text-center p-4 bg-muted/50 rounded-lg">
                                <div className="text-sm text-muted-foreground mb-1">Total trimestre</div>
                                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">€{totalRetencionesTrimestre.toFixed(2)}</div>
                              </div>
                            </div>
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                              <div className="p-3 bg-background rounded-lg border">
                                <div className="text-muted-foreground">111 - Profesionales</div>
                                <div className="font-semibold">€{retenciones.professional.toFixed(2)}</div>
                              </div>
                              <div className="p-3 bg-background rounded-lg border">
                                <div className="text-muted-foreground">115 - Alquileres</div>
                                <div className="font-semibold">€{retenciones.rent.toFixed(2)}</div>
                              </div>
                              <div className="p-3 bg-background rounded-lg border">
                                <div className="text-muted-foreground">Otros</div>
                                <div className="font-semibold">€{retenciones.other.toFixed(2)}</div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })()}
                    
                    {/* Placeholder legacy card kept for structure; now replaced by computed card above */}
                    <Card className="hidden">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                              <DollarSign className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-lg">Retenciones e Ingresos a Cuenta</h3>
                              <p className="text-xs text-muted-foreground">Modelos 111 y 115 - Presentación trimestral</p>
                            </div>
                          </div>
                          <button
                            disabled
                            className="text-xs text-gray-400 dark:text-gray-600 flex items-center gap-1 cursor-not-allowed"
                          >
                            <ChevronDown className="w-4 h-4" />
                            Próximamente
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="text-center p-4 bg-muted/50 rounded-lg">
                            <div className="text-sm text-muted-foreground mb-1">Retenciones practicadas</div>
                            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">€0.00</div>
                          </div>
                          <div className="text-center p-4 bg-muted/50 rounded-lg">
                            <div className="text-sm text-muted-foreground mb-1">Ingresos a cuenta</div>
                            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">€0.00</div>
                          </div>
                          <div className="text-center p-4 bg-muted/50 rounded-lg">
                            <div className="text-sm text-muted-foreground mb-1">Total trimestre</div>
                            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">€0.00</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          {/* Filtros - Desktop */}
          <div className="hidden md:flex items-center gap-3 min-h-[40px]">
            {/* Contador de categorías */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg">
              <span className="text-sm font-medium text-foreground">{categories.length}</span>
              <span className="text-sm text-muted-foreground">categorías</span>
            </div>
            
            {/* Spacer para empujar el botón a la derecha */}
            <div className="flex-1" />
            
            {/* Botón Añadir */}
            <Button onClick={openAddCategoryModal} size="sm" className="bg-[#007AFF] hover:bg-[#0056CC]">
              <Plus className="w-4 h-4 mr-1" />
              Añadir Categoría
            </Button>
          </div>
          
          {/* Filtros - Mobile */}
          <div className="md:hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg">
                <span className="text-sm font-medium text-foreground">{categories.length}</span>
                <span className="text-sm text-muted-foreground">categorías</span>
              </div>
              <Button onClick={openAddCategoryModal} size="sm" className="bg-[#007AFF] hover:bg-[#0056CC]">
                <Plus className="w-4 h-4 mr-1" />
                Añadir
              </Button>
            </div>
          </div>

          {/* Loading state */}
          {isLoadingCategories ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : (
            <>
              {/* Grid de 2 columnas en desktop */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Categorías de gastos */}
            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4 text-rose-700 dark:text-rose-400">
                  Categorías de Gastos
                </h3>
                <div className="space-y-3">
                  {categories.filter(c => c.type === 'expense').map((category) => (
                    <div
                      key={category.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      style={{ borderLeftColor: category.color, borderLeftWidth: '4px' }}
                      onClick={() => openEditCategoryModal(category)}
                    >
                      <div className="flex items-center gap-3">
                        {(() => {
                          const IconComponent = getCategoryIcon(category.icon);
                          return <IconComponent className="w-6 h-6" style={{ color: category.color }} />;
                        })()}
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{category.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeleteCategoryConfirm(category.id);
                          }}
                          className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/30"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Categorías de ingresos */}
            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4 text-emerald-700 dark:text-emerald-400">
                  Categorías de Ingresos
                </h3>
                <div className="space-y-3">
                  {categories.filter(c => c.type === 'income').map((category) => (
                    <div
                      key={category.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      style={{ borderLeftColor: category.color, borderLeftWidth: '4px' }}
                      onClick={() => openEditCategoryModal(category)}
                    >
                      <div className="flex items-center gap-3">
                        {(() => {
                          const IconComponent = getCategoryIcon(category.icon);
                          return <IconComponent className="w-6 h-6" style={{ color: category.color }} />;
                        })()}
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{category.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeleteCategoryConfirm(category.id);
                          }}
                          className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/30"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
            </>
          )}
        </div>
      )}

      {/* Modal para añadir/editar movimiento */}
      <Dialog open={showEntryModal} onOpenChange={(open) => {
        if (!open) {
          // Si se está cerrando el modal, limpiar archivos temporales
          resetEntryForm();
        }
        setShowEntryModal(open);
      }}>
        <DialogContent className="max-w-[95vw] lg:max-w-[1400px] max-h-[90vh] overflow-hidden flex flex-col lg:flex-row p-0 [&>button]:hidden">
          
          {/* ============================================ */}
          {/* MÓVIL: Header sticky con botones de iconos  */}
          {/* ============================================ */}
          <div className="lg:hidden flex-shrink-0 sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white truncate flex-1">
                {editingEntry ? `Movimiento #${editingEntry.id}` : 'Nuevo movimiento'}
              </h2>
              <div className="flex gap-1.5 flex-shrink-0">
                {editingEntry && (editingEntry.status === 'approved' || editingEntry.status === 'rejected') && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRevertConfirm({ open: true, entry: editingEntry })}
                    className="h-7 w-7 p-0"
                    title="Revertir"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEntryModal(false)}
                  className="h-7 w-7 p-0"
                  title="Cancelar"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  onClick={() => handleSubmitEntry()}
                  size="sm"
                  className="h-7 w-7 p-0"
                  title="Guardar"
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* ======================================= */}
          {/* MÓVIL: Preview de documento (arriba)    */}
          {/* ======================================= */}
          {selectedFileForViewer && (
            <div className="lg:hidden flex-shrink-0 h-[40vh] bg-muted/50 border-b border-gray-200 dark:border-gray-700">
              {isProcessingOCR || mobilePreviewLoading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center space-y-3">
                    <LoadingSpinner size="lg" color="blue" />
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                        {isProcessingOCR ? 'Leyendo datos' : 'Cargando...'}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {isProcessingOCR ? 'Procesando documento...' : 'Preparando vista previa...'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : mobilePreviewError ? (
                <div className="h-full flex items-center justify-center p-4">
                  <div className="text-center">
                    <FileX className="h-12 w-12 text-red-500 mx-auto mb-2" />
                    <p className="text-sm text-red-600 dark:text-red-400">{mobilePreviewError}</p>
                  </div>
                </div>
              ) : (
                <div className="h-full overflow-auto flex items-center justify-center">
                  {mobilePreviewPdfArray ? (
                    // PDF con ArrayBuffer
                    <div className="w-full h-full flex flex-col">
                      <div className="flex-1 flex items-center justify-center py-2">
                        <Document
                          file={mobilePreviewPdfFile}
                          onLoadSuccess={({ numPages }) => setMobilePreviewNumPages(numPages)}
                          onLoadError={() => setMobilePreviewError('Error al cargar PDF')}
                          loading={<LoadingSpinner />}
                          options={mobilePreviewPdfOptions}
                        >
                          <Page
                            pageNumber={mobilePreviewPage}
                            width={Math.min(window.innerWidth * 0.9, 600)}
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                          />
                        </Document>
                      </div>
                      {mobilePreviewNumPages && mobilePreviewNumPages > 1 && (
                        <div className="flex-shrink-0 flex items-center justify-center gap-3 py-2 border-t bg-background/80">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setMobilePreviewPage(p => Math.max(1, p - 1))}
                            disabled={mobilePreviewPage <= 1}
                            className="h-7 w-7 p-0"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            {mobilePreviewPage} / {mobilePreviewNumPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setMobilePreviewPage(p => Math.min(mobilePreviewNumPages!, p + 1))}
                            disabled={mobilePreviewPage >= mobilePreviewNumPages}
                            className="h-7 w-7 p-0"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : mobilePreviewBlobUrl ? (
                    // Imagen o PDF en desktop
                    selectedFileForViewer.mimeType?.startsWith('image/') ? (
                      <img 
                        src={mobilePreviewBlobUrl} 
                        alt={selectedFileForViewer.filename}
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <iframe
                        src={mobilePreviewBlobUrl}
                        className="w-full h-full border-0"
                        title={selectedFileForViewer.filename}
                      />
                    )
                  ) : null}
                </div>
              )}
            </div>
          )}

          {/* ========================================== */}
          {/* MÓVIL: Formulario scrolleable              */}
          {/* ========================================== */}
          <div className="lg:hidden flex-1 overflow-y-auto overflow-x-hidden">
            <div className="px-1.5 py-3 space-y-3 min-w-0">
              <fieldset
                disabled={isEntryModalReadOnly}
                className={`space-y-3 border-0 p-0 m-0 ${isEntryModalReadOnly ? 'opacity-70' : ''}`}
              >
                {/* Tipo, Categoría, Fecha */}
                    <div className="grid grid-cols-3 gap-1">
                  <div>
                    <Label className="text-xs mb-1 block text-gray-700 dark:text-gray-300">Tipo</Label>
                    <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-700 p-0.5 w-full h-9">
                      <button
                        type="button"
                        onClick={() => handleEntryTypeChange('expense')}
                        className={`flex-1 px-1.5 py-1 rounded-md text-[10px] font-medium transition-all flex flex-col items-center justify-center gap-0.5 ${
                          entryForm.type === 'expense'
                            ? 'bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 shadow-sm'
                            : 'text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        <TrendingDown className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline text-[9px]">Gasto</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEntryTypeChange('income')}
                        className={`flex-1 px-1.5 py-1 rounded-md text-[10px] font-medium transition-all flex flex-col items-center justify-center gap-0.5 ${
                          entryForm.type === 'income'
                            ? 'bg-white dark:bg-gray-800 text-green-600 dark:text-green-400 shadow-sm'
                            : 'text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline text-[9px]">Ingr</span>
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block text-gray-700 dark:text-gray-300">Categoría</Label>
                    <Select
                      value={entryForm.categoryId}
                      onValueChange={(value) => {
                        setEntryForm(prev => {
                          const next = { ...prev, categoryId: value };
                          if (activeFiscalConfig.autoApplyRetentionDefaults && next.type === 'expense' && next.retentionAppliedByUs) {
                            return applyRetentionDefaults(next);
                          }
                          return next;
                        });
                      }}
                      disabled={isEntryModalReadOnly}
                    >
                      <SelectTrigger className="h-9 text-xs px-1.5">
                        <SelectValue placeholder="Cat" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories
                          .filter(c => c.type === entryForm.type && c.isActive)
                          .map(category => {
                            const IconComponent = getCategoryIcon(category.icon);
                            return (
                              <SelectItem key={category.id} value={String(category.id)}>
                                <div className="flex items-center gap-2">
                                  <IconComponent className="w-4 h-4" style={{ color: category.color }} />
                                  {category.name}
                                </div>
                              </SelectItem>
                            );
                          })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block text-gray-700 dark:text-gray-300">Fecha</Label>
                    <DatePickerDay
                      date={entryDate}
                      onDateChange={(date) => setEntryDate(date || new Date())}
                      className="w-full h-9 text-xs px-2"
                    />
                  </div>
                </div>

                {/* Concepto */}
                <div>
                  <Label className="text-xs mb-1 block text-gray-700 dark:text-gray-300">Concepto *</Label>
                  <Input
                    value={entryForm.concept}
                    onChange={(e) => setEntryForm({ ...entryForm, concept: e.target.value })}
                    placeholder="Ej: Factura proveedor..."
                    className="h-9 text-sm px-2"
                    disabled={isEntryModalReadOnly}
                  />
                </div>

                {/* Código de referencia */}
                <div>
                  <Label className="text-xs mb-1 block text-gray-700 dark:text-gray-300">Código de referencia</Label>
                  <Popover open={refCodeComboboxOpen} onOpenChange={setRefCodeComboboxOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={refCodeComboboxOpen}
                        className={`w-full justify-between h-9 text-xs font-normal px-1.5 ${isEntryModalReadOnly ? 'pointer-events-none opacity-70' : ''}`}
                      >
                        <span className="truncate">{entryForm.refCode || 'Sin código'}</span>
                        <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[calc(100vw-32px)] max-w-sm p-0" align="start">
                      <Command>
                        <CommandInput 
                          placeholder="Buscar o crear..." 
                          className="h-9 text-xs"
                          value={refCodeSearchTerm}
                          onValueChange={setRefCodeSearchTerm}
                        />
                        <CommandList>
                          <CommandEmpty>
                            <div className="p-2">
                              <button
                                type="button"
                                className="w-full text-left px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-xs"
                                onClick={() => {
                                  const normalized = refCodeSearchTerm.trim().toUpperCase();
                                  if (normalized) {
                                    setEntryForm(prev => ({ ...prev, refCode: normalized }));
                                    setRefCodeComboboxOpen(false);
                                    setRefCodeSearchTerm('');
                                  }
                                }}
                              >
                                Crear: <strong>{refCodeSearchTerm.trim().toUpperCase()}</strong>
                              </button>
                            </div>
                          </CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="none"
                              onSelect={() => {
                                setEntryForm(prev => ({ ...prev, refCode: '' }));
                                setRefCodeComboboxOpen(false);
                                setRefCodeSearchTerm('');
                              }}
                            >
                              <Check className={`mr-2 h-3.5 w-3.5 ${!entryForm.refCode ? 'opacity-100' : 'opacity-0'}`} />
                              Sin código
                            </CommandItem>
                            {existingRefCodes.map(code => (
                              <CommandItem
                                key={code}
                                value={code}
                                onSelect={() => {
                                  setEntryForm(prev => ({ ...prev, refCode: code }));
                                  setRefCodeComboboxOpen(false);
                                  setRefCodeSearchTerm('');
                                }}
                              >
                                <Check className={`mr-2 h-3.5 w-3.5 ${entryForm.refCode?.toUpperCase() === code ? 'opacity-100' : 'opacity-0'}`} />
                                {code}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Proyecto (si CRM) */}
                {hasCRMAddon && projects.length > 0 && (
                  <div>
                    <Label className="text-xs mb-1 block text-gray-700 dark:text-gray-300">Proyecto</Label>
                    <Popover open={projectComboboxOpen} onOpenChange={setProjectComboboxOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={projectComboboxOpen}
                          className={`w-full justify-between h-9 text-xs font-normal px-2 ${isEntryModalReadOnly ? 'pointer-events-none opacity-70' : ''}`}
                        >
                          <span className="truncate">
                            {entryForm.projectId
                              ? (() => {
                                  const selectedProject = projects.find(p => String(p.id) === entryForm.projectId);
                                  return selectedProject
                                    ? (selectedProject.code ? `[${selectedProject.code}] ${selectedProject.name}` : selectedProject.name)
                                    : 'Sin proyecto';
                                })()
                              : 'Sin proyecto'}
                          </span>
                          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[calc(100vw-24px)] max-w-sm p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar..." className="h-9 text-xs" />
                          <CommandList>
                            <CommandEmpty>No se encontraron proyectos.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="none"
                                onSelect={() => {
                                  setEntryForm(prev => ({ ...prev, projectId: null }));
                                  setProjectComboboxOpen(false);
                                }}
                              >
                                <Check className={`mr-2 h-3.5 w-3.5 ${!entryForm.projectId ? 'opacity-100' : 'opacity-0'}`} />
                                Sin proyecto
                              </CommandItem>
                              {projects.map(project => (
                                <CommandItem
                                  key={project.id}
                                  value={`${project.code || ''} ${project.name}`.toLowerCase()}
                                  onSelect={() => {
                                    setEntryForm(prev => ({ ...prev, projectId: String(project.id) }));
                                    setProjectComboboxOpen(false);
                                  }}
                                >
                                  <Check className={`mr-2 h-3.5 w-3.5 ${entryForm.projectId === String(project.id) ? 'opacity-100' : 'opacity-0'}`} />
                                  {project.code ? `[${project.code}] ${project.name}` : project.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {/* Cliente/Proveedor (si hay proyecto) */}
                {hasCRMAddon && entryForm.projectId && projects.length > 0 && (() => {
                  const selectedProject = projects.find(p => String(p.id) === entryForm.projectId);
                  const clientsList = (selectedProject?.clients as any[]) || [];
                  const suppliersList = (selectedProject?.suppliers as any[]) || [];
                  
                  const showClientSelect = entryForm.type === 'income';
                  const showSupplierSelect = entryForm.type === 'expense';
                  
                  if (!showClientSelect && !showSupplierSelect) return null;
                  
                  return (
                    <div>
                      <Label className="text-xs mb-1 block text-gray-700 dark:text-gray-300">
                        {entryForm.type === 'income' ? 'Cliente' : 'Proveedor'}
                      </Label>
                      <Select
                        value={entryForm.type === 'income' ? (entryForm.crmClientId?.toString() || 'none') : (entryForm.crmSupplierId?.toString() || 'none')}
                        onValueChange={(value) => {
                          if (entryForm.type === 'income') {
                            setEntryForm(prev => ({ ...prev, crmClientId: value === 'none' ? null : parseInt(value) }));
                          } else {
                            setEntryForm(prev => ({ ...prev, crmSupplierId: value === 'none' ? null : parseInt(value) }));
                          }
                        }}
                        disabled={isEntryModalReadOnly}
                      >
                        <SelectTrigger className="h-9 text-xs px-1.5">
                          <SelectValue placeholder="Seleccionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin {entryForm.type === 'income' ? 'cliente' : 'proveedor'}</SelectItem>
                          {entryForm.type === 'income' && clientsList.map((client) => (
                            <SelectItem key={client.id} value={client.id.toString()}>
                              {client.name}
                            </SelectItem>
                          ))}
                          {entryForm.type === 'expense' && suppliersList.map((supplier) => (
                            <SelectItem key={supplier.id} value={supplier.id.toString()}>
                              {supplier.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })()}

                {/* Método de pago */}
                <div>
                  <Label className="text-xs mb-1 block text-gray-700 dark:text-gray-300">Método de pago</Label>
                  <Select
                    value={entryForm.paymentMethod}
                    onValueChange={(value) => setEntryForm({ ...entryForm, paymentMethod: value })}
                    disabled={isEntryModalReadOnly}
                  >
                    <SelectTrigger className="h-9 text-xs px-2">
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHOD_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Montos */}
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-1.5 space-y-1.5 bg-gray-50/50 dark:bg-gray-800/30">
                  <div className="grid grid-cols-2 gap-1">
                    <div>
                      <Label className="text-xs mb-1 block text-gray-700 dark:text-gray-300">Base (sin IVA)</Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={entryForm.amount}
                        onChange={(e) => handleBaseAmountInput(e.target.value)}
                        placeholder="0.00"
                        className="h-9 text-sm px-2"
                        disabled={isEntryModalReadOnly}
                      />
                    </div>
                    <div>
                      <Label className="text-xs mb-1 block text-gray-700 dark:text-gray-300">Tipo IVA</Label>
                      <Select value={entryForm.vatRate} onValueChange={handleVatRateDropdownChange} disabled={isEntryModalReadOnly}>
                        <SelectTrigger className="h-9 text-xs px-2">
                          <SelectValue placeholder="IVA" />
                        </SelectTrigger>
                        <SelectContent>
                          {VAT_OPTIONS.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <div>
                      <Label className="text-xs mb-1 block text-gray-700 dark:text-gray-300">IVA (€)</Label>
                      <Input
                        readOnly
                        value={vatAmountDisplay}
                        placeholder="0.00"
                        className="h-9 text-sm px-2 bg-gray-100 dark:bg-gray-700"
                      />
                    </div>
                    <div>
                      <Label className="text-xs mb-1 block text-gray-700 dark:text-gray-300">Total (con IVA)</Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={entryForm.totalAmount}
                        onChange={(e) => handleTotalAmountInput(e.target.value)}
                        placeholder="0.00"
                        className="h-9 text-sm font-semibold px-2"
                        disabled={isEntryModalReadOnly}
                      />
                    </div>
                  </div>
                </div>

                {/* IRPF - retenciones y deducibilidad */}
                {entryForm.type === 'income' ? (
                  <div className="rounded-lg border border-purple-200 dark:border-purple-900/50 p-2 space-y-2 bg-purple-50/40 dark:bg-purple-900/10">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-purple-800 dark:text-purple-200">Retención IRPF (factura emitida)</Label>
                      <span className="text-[10px] text-muted-foreground">Opcional</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <Label className="text-[11px] text-gray-700 dark:text-gray-300">Tipo %</Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.1"
                          value={entryForm.irpfRetentionRate}
                          onChange={(e) => handleIrpfRetentionRateChange(e.target.value)}
                          placeholder="0"
                          className="h-9 text-sm px-2"
                          disabled={isEntryModalReadOnly}
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] text-gray-700 dark:text-gray-300">Retención (€)</Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          value={entryForm.irpfRetentionAmount}
                          onChange={(e) => handleIrpfRetentionAmountChange(e.target.value)}
                          placeholder="0.00"
                          className="h-9 text-sm px-2"
                          disabled={isEntryModalReadOnly}
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-tight">
                      Si aplicas retención en la factura, indícala aquí para que compute en el modelo 130.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-purple-200 dark:border-purple-900/50 p-3 space-y-3 bg-purple-50/30 dark:bg-purple-900/5">
                    <Label className="text-xs text-purple-800 dark:text-purple-200">IRPF - Configuración fiscal del gasto</Label>
                    
                    {/* Primera fila: Checkboxes principales */}
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <label className="flex items-center gap-1.5 text-gray-700 dark:text-gray-200">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5"
                          checked={entryForm.irpfDeductible}
                          onChange={(e) => setEntryForm(prev => ({ ...prev, irpfDeductible: e.target.checked }))}
                          disabled={isEntryModalReadOnly}
                        />
                        Deducible IRPF
                      </label>
                      <label className="flex items-center gap-1.5 text-gray-700 dark:text-gray-200">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5"
                          checked={entryForm.irpfIsSocialSecurity}
                          onChange={(e) => setEntryForm(prev => ({ ...prev, irpfIsSocialSecurity: e.target.checked }))}
                          disabled={isEntryModalReadOnly}
                        />
                        Cuota SS
                      </label>
                      <label className="flex items-center gap-1.5 text-gray-700 dark:text-gray-200">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5"
                          checked={entryForm.irpfIsAmortization}
                          onChange={(e) => setEntryForm(prev => ({ ...prev, irpfIsAmortization: e.target.checked }))}
                          disabled={isEntryModalReadOnly}
                        />
                        Amortización
                      </label>
                    </div>

                    {/* Segunda fila: Porcentaje deducible y ajuste fiscal */}
                    {entryForm.irpfDeductible && !entryForm.irpfIsSocialSecurity && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-[11px] text-gray-700 dark:text-gray-300 mb-1">% Deducible</Label>
                          <Input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max="100"
                            step="1"
                            value={entryForm.irpfDeductionPercentage}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setEntryForm(prev => ({ 
                                ...prev, 
                                irpfDeductionPercentage: String(Math.min(Math.max(val, 0), 100))
                              }));
                            }}
                            placeholder="100"
                            className="h-9 text-sm px-2"
                            disabled={isEntryModalReadOnly}
                          />
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Ej: comidas 30%, otros 100%
                          </p>
                        </div>
                        <div>
                          <Label className="text-[11px] text-gray-700 dark:text-gray-300 mb-1">Ajuste fiscal (€)</Label>
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            value={entryForm.irpfFiscalAdjustment}
                            onChange={(e) => setEntryForm(prev => ({ ...prev, irpfFiscalAdjustment: e.target.value }))}
                            placeholder="0.00"
                            className="h-9 text-sm px-2"
                            disabled={isEntryModalReadOnly}
                          />
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            +aumenta base, -reduce base
                          </p>
                        </div>
                      </div>
                    )}
                    {/* Retención practicada por nosotros (111/115) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-purple-800 dark:text-purple-200">Retención practicada (111/115)</Label>
                        <label className="flex items-center gap-1.5 text-gray-700 dark:text-gray-200">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5"
                            checked={Boolean(entryForm.retentionAppliedByUs)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setEntryForm(prev => {
                                const base = { ...prev, retentionAppliedByUs: checked };
                                if (checked && activeFiscalConfig.autoApplyRetentionDefaults) {
                                  return applyRetentionDefaults(base);
                                }
                                return base;
                              });
                            }}
                            disabled={isEntryModalReadOnly}
                          />
                          Aplicada por nosotros
                        </label>
                      </div>
                      {entryForm.retentionAppliedByUs && (
                        <div className="grid grid-cols-3 gap-3">
                          <div className="col-span-1">
                            <Label className="text-[11px] text-gray-700 dark:text-gray-300 mb-1">Tipo retención</Label>
                            <Select
                              value={entryForm.retentionType || ''}
                              onValueChange={(value) => {
                                setEntryForm(prev => {
                                  const next = { ...prev, retentionType: value as any };
                                  if (activeFiscalConfig.autoApplyRetentionDefaults && next.type === 'expense' && next.retentionAppliedByUs) {
                                    return applyRetentionDefaults(next);
                                  }
                                  return next;
                                });
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="professional">Profesional (111)</SelectItem>
                                <SelectItem value="rent">Alquiler (115)</SelectItem>
                                <SelectItem value="other">Otro</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-[11px] text-gray-700 dark:text-gray-300">Tipo %</Label>
                            <Input
                              type="number"
                              inputMode="decimal"
                              step="0.1"
                              value={entryForm.irpfRetentionRate}
                              onChange={(e) => handleIrpfRetentionRateChange(e.target.value)}
                              placeholder="0"
                              className="h-9 text-sm px-2"
                              disabled={isEntryModalReadOnly}
                            />
                          </div>
                          <div>
                            <Label className="text-[11px] text-gray-700 dark:text-gray-300">Retención (€)</Label>
                            <Input
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              value={entryForm.irpfRetentionAmount}
                              onChange={(e) => handleIrpfRetentionAmountChange(e.target.value)}
                              placeholder="0.00"
                              className="h-9 text-sm px-2"
                              disabled={isEntryModalReadOnly}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <p className="text-[11px] text-muted-foreground leading-tight">
                      <strong>Cuota SS:</strong> cotizaciones sociales (deducibles al 100%). <strong>Amortización:</strong> depreciación de inmovilizado. <strong>% Deducible:</strong> algunos gastos solo son parcialmente deducibles.
                    </p>
                  </div>
                )}

                {/* Descripción */}
                <div>
                  <Label className="text-xs mb-1 block text-gray-700 dark:text-gray-300">Descripción</Label>
                  <Textarea
                    value={entryForm.description}
                    onChange={(e) => setEntryForm({ ...entryForm, description: e.target.value })}
                    placeholder="Detalles adicionales..."
                    className="h-16 resize-none text-sm px-2 py-2"
                    disabled={isEntryModalReadOnly}
                  />
                </div>

                {/* Archivos adjuntos - Lista compacta */}
                {((editingEntry?.attachments && editingEntry.attachments.length > 0) || entryFiles.length > 0) && (
                  <div>
                    <Label className="text-xs mb-1 block text-gray-700 dark:text-gray-300">Archivos adjuntos</Label>
                    <div className="space-y-1.5">
                      {/* Existentes */}
                      {editingEntry?.attachments && editingEntry.attachments.length > 0 && editingEntry.attachments.map((attachment) => {
                        const isPdf = attachment.mimeType?.includes('pdf');
                        const isImage = attachment.mimeType?.startsWith('image/');
                        const isSelected = Boolean((selectedFileForViewer as any)?.type === 'existing' && (selectedFileForViewer as any)?.url?.includes(String(attachment.id)));
                        return (
                          <div
                            key={attachment.id}
                            className={`flex items-center gap-2 p-2 border rounded-lg text-left transition-colors ${
                              isSelected 
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                                : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setSelectedFileForViewer({
                                url: attachment.fileUrl || `/api/accounting/attachments/${attachment.id}/download`,
                                filename: attachment.fileName,
                                mimeType: attachment.mimeType,
                                type: 'existing'
                              })}
                              className="flex-1 flex items-center gap-2 min-w-0"
                            >
                              <div className="flex-shrink-0">
                                {isImage ? (
                                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded flex items-center justify-center">
                                    <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                  </div>
                                ) : isPdf ? (
                                  <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded flex items-center justify-center">
                                    <FileText className="w-4 h-4 text-red-600 dark:text-red-400" />
                                  </div>
                                ) : (
                                  <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center">
                                    <FileText className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                                  {attachment.fileName}
                                </p>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                                  {(attachment.fileSize / 1024).toFixed(1)} KB
                                </p>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm('¿Eliminar este adjunto?')) {
                                  handleDeleteAttachment(attachment.id);
                                }
                              }}
                              className="flex-shrink-0 p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                            >
                              <X className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                            </button>
                          </div>
                        );
                      })}
                      {/* Nuevos */}
                      {entryFiles.map((file, index) => {
                        const isPdf = file.type === 'application/pdf';
                        const isImage = file.type.startsWith('image/');
                        return (
                          <div
                            key={index}
                            className="flex items-center gap-2 p-2 border rounded-lg border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                          >
                            <button
                              type="button"
                              onClick={() => handleOpenPreview(file, null)}
                              className="flex-1 flex items-center gap-2 min-w-0"
                            >
                              <div className="flex-shrink-0">
                                {isImage ? (
                                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded flex items-center justify-center">
                                    <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                  </div>
                                ) : isPdf ? (
                                  <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded flex items-center justify-center">
                                    <FileText className="w-4 h-4 text-red-600 dark:text-red-400" />
                                  </div>
                                ) : (
                                  <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center">
                                    <FileText className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                                  {file.name}
                                </p>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                                  {(file.size / 1024).toFixed(1)} KB
                                </p>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteFileConfirm({ open: true, fileIndex: index })}
                              className="flex-shrink-0 p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                            >
                              <X className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Input para añadir archivos */}
                <div>
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    onChange={async (e) => {
                      if (e.target.files) {
                        const files = Array.from(e.target.files);
                        setEntryFiles(prev => [...prev, ...files]);
                        if (files.length > 0) {
                          const file = files[0];
                          if (file.type.startsWith('image/') || file.type === 'application/pdf') {
                            await processReceiptOCR(file);
                          }
                        }
                      }
                    }}
                    className="hidden"
                    id="file-upload-mobile"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('file-upload-mobile')?.click()}
                    className="w-full h-9 text-xs"
                  >
                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                    Adjuntar archivo
                  </Button>
                </div>
              </fieldset>
            </div>
          </div>

          {/* ================================================ */}
          {/* DESKTOP: Columna izquierda con visor documentos  */}
          {/* ================================================ */}
          {/* Columna izquierda: Panel de documentos adjuntos con visor (solo en lg) */}
          <div className="hidden lg:flex lg:w-1/2 overflow-hidden flex-col">
              <div className="flex-1 flex flex-col min-h-[360px] overflow-hidden">
                {isProcessingOCR && entryFiles.length > 0 ? (
                  /* Loader mientras se procesa OCR - usando componente Oficaz */
                  <div className="flex-1 flex items-center justify-center flex-col gap-4">
                    <LoadingSpinner size="lg" color="blue" />
                    <div className="text-center space-y-2">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                        Leyendo datos de la imagen
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Procesando documento...
                      </p>
                    </div>
                  </div>
                ) : selectedFileForViewer ? (
                  /* Vista del documento */
                  <DocumentViewer
                    url={selectedFileForViewer.url}
                    filename={selectedFileForViewer.filename}
                    mimeType={selectedFileForViewer.mimeType}
                    showControls={true}
                  />
                ) : (
                  /* Lista de archivos o área de upload */
                  <>
                    <div className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Archivos adjuntos
                      </p>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {/* Mostrar área de upload si no hay archivos */}
                      {(!editingEntry?.attachments || editingEntry.attachments.length === 0) && entryFiles.length === 0 && !isProcessingOCR && (
                        <div className="flex items-center justify-center h-full p-8">
                          <div className="text-center space-y-4 max-w-sm">
                            <div className="flex justify-center">
                              <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                <Upload className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Agregar archivo adjunto
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Arrastra aquí o haz clic para seleccionar
                              </p>
                              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                Se extraerán automáticamente los datos
                              </p>
                            </div>
                            <input
                              type="file"
                              multiple
                              accept="image/*,.pdf"
                              onChange={async (e) => {
                                if (e.target.files) {
                                  const files = Array.from(e.target.files);
                                  setEntryFiles(files);
                                  if (files.length > 0) {
                                    const file = files[0];
                                    if (file.type.startsWith('image/')) {
                                      await processReceiptOCR(file);
                                    } else if (file.type === 'application/pdf') {
                                      // Try OCR with PDF, fallback to image conversion is handled inside
                                      await processReceiptOCR(file);
                                    }
                                  }
                                }
                              }}
                              className="hidden"
                              id="file-upload-viewer"
                            />
                            <div
                              onClick={() => document.getElementById('file-upload-viewer')?.click()}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              onDrop={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (e.dataTransfer.files) {
                                  const files = Array.from(e.dataTransfer.files);
                                  setEntryFiles(files);
                                  if (files.length > 0) {
                                    const file = files[0];
                                    if (file.type.startsWith('image/')) {
                                      await processReceiptOCR(file);
                                    } else if (file.type === 'application/pdf') {
                                      await processReceiptOCR(file);
                                    }
                                  }
                                }
                              }}
                              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all"
                            >
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                PNG, JPG, PDF • Máx. 5MB
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Estado de procesamiento OCR */}
                      {isProcessingOCR && (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center space-y-4">
                            <div className="flex justify-center">
                              <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center animate-pulse">
                                <Upload className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                                Procesando documento...
                              </h3>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                Extrayendo información
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      {/* Adjuntos existentes */}
                      {editingEntry?.attachments && editingEntry.attachments.length > 0 && (
                        <div>
                          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                            Existentes ({editingEntry.attachments.length})
                          </p>
                          <div className="space-y-2">
                            {editingEntry.attachments.map((attachment) => {
                              const isPdf = attachment.mimeType?.includes('pdf');
                              const isImage = attachment.mimeType?.startsWith('image/');
                              const isSelected = Boolean((selectedFileForViewer as any)?.type === 'existing' && (selectedFileForViewer as any)?.url?.includes(String(attachment.id)));
                              return (
                                <div
                                  key={attachment.id}
                                  className={`w-full flex items-center gap-3 p-3 border rounded-lg transition-colors ${
                                    isSelected 
                                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                                  }`}
                                >
                                  <button
                                    onClick={() => setSelectedFileForViewer({
                                      url: attachment.fileUrl || `/api/accounting/attachments/${attachment.id}/download`,
                                      filename: attachment.fileName,
                                      mimeType: attachment.mimeType
                                    })}
                                    className="flex-1 flex items-center gap-3 text-left"
                                  >
                                    <div className="flex-shrink-0">
                                      {isImage ? (
                                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded flex items-center justify-center">
                                          <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                        </div>
                                      ) : isPdf ? (
                                        <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded flex items-center justify-center">
                                          <FileText className="w-5 h-5 text-red-600 dark:text-red-400" />
                                        </div>
                                      ) : (
                                        <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center">
                                          <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                        {attachment.fileName}
                                      </p>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {(attachment.fileSize / 1024).toFixed(1)} KB
                                      </p>
                                    </div>
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (window.confirm('¿Eliminar este adjunto?')) {
                                        handleDeleteAttachment(attachment.id);
                                      }
                                    }}
                                    className="flex-shrink-0 p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                                    title="Eliminar adjunto"
                                  >
                                    <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Archivos nuevos */}
                      {entryFiles.length > 0 && (
                        <div>
                          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                            Nuevos ({entryFiles.length})
                          </p>
                          <div className="space-y-2">
                            {entryFiles.map((file, index) => {
                              const isPdf = file.type === 'application/pdf';
                              const isImage = file.type.startsWith('image/');
                              return (
                                <div key={index} className="w-full p-3 border rounded-lg text-left flex items-center gap-3 transition-colors border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                                  <div className="flex-shrink-0">
                                    {isImage ? (
                                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded flex items-center justify-center">
                                        <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                      </div>
                                    ) : isPdf ? (
                                      <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded flex items-center justify-center">
                                        <FileText className="w-5 h-5 text-red-600 dark:text-red-400" />
                                      </div>
                                    ) : (
                                      <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center">
                                        <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                      {file.name}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      {(file.size / 1024).toFixed(1)} KB
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteFileConfirm({ open: true, fileIndex: index })}
                                    className="flex-shrink-0 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                                  >
                                    <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
          </div>

          {/* Columna derecha: Header + Formulario */}
          <div className="hidden lg:flex flex-col lg:w-1/2 w-full overflow-hidden">
            {/* Header sticky con botones */}
            <div className="flex-shrink-0 sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 p-4">
              <div className="flex flex-row items-start justify-between gap-4">
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {editingEntry
                      ? `Movimiento #${editingEntry.id}`
                      : 'Nuevo movimiento'}
                  </h2>
                  {editingEntry?.createdAt && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Creado: {new Date(editingEntry.createdAt).toLocaleString('es-ES')}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowEntryModal(false)}
                    className="border-gray-300 dark:border-gray-600"
                  >
                    Cancelar
                  </Button>
                  {editingEntry && (editingEntry.status === 'approved' || editingEntry.status === 'rejected') && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setRevertConfirm({ open: true, entry: editingEntry })}
                      className="border-gray-300 dark:border-gray-600"
                    >
                      Revertir
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={() => handleSubmitEntry()}
                    size="sm"
                  >
                    Guardar
                  </Button>
                </div>
              </div>
            </div>

            {/* Contenido scrolleable del formulario */}
            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-col gap-6 py-4 px-4">
                <fieldset
                  disabled={isEntryModalReadOnly}
                  className={`flex flex-col gap-6 border-0 p-0 m-0 ${isEntryModalReadOnly ? 'opacity-70' : ''}`}
                >
                  {/* Mostrar campos del formulario siempre */}
                    <>
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div>
                          <Label className="dark:text-gray-300 mb-2 block">Tipo</Label>
                          <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-700 p-1 w-full h-10">
                            <button
                              type="button"
                              onClick={() => handleEntryTypeChange('expense')}
                              className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                                entryForm.type === 'expense'
                                  ? 'bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 shadow-sm'
                                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                              }`}
                            >
                              <TrendingDown className="w-4 h-4" />
                              Gasto
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEntryTypeChange('income')}
                              className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                                entryForm.type === 'income'
                                  ? 'bg-white dark:bg-gray-800 text-green-600 dark:text-green-400 shadow-sm'
                                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                              }`}
                            >
                              <TrendingUp className="w-4 h-4" />
                              Ingreso
                            </button>
                          </div>
                        </div>
                        <div>
                          <Label className="dark:text-gray-300 mb-2 block">Categoría</Label>
                          <Select
                            value={entryForm.categoryId}
                            onValueChange={(value) => {
                              setEntryForm(prev => {
                                const next = { ...prev, categoryId: value };
                                if (activeFiscalConfig.autoApplyRetentionDefaults && next.type === 'expense' && next.retentionAppliedByUs) {
                                  return applyRetentionDefaults(next);
                                }
                                return next;
                              });
                            }}
                            disabled={isEntryModalReadOnly}
                          >
                            <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 h-10">
                              <SelectValue placeholder="Selecciona una categoría" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories
                                .filter(c => c.type === entryForm.type && c.isActive)
                                .map(category => {
                                  const IconComponent = getCategoryIcon(category.icon);
                                  return (
                                    <SelectItem key={category.id} value={String(category.id)}>
                                      <div className="flex items-center gap-2">
                                        <IconComponent className="w-4 h-4" style={{ color: category.color }} />
                                        {category.name}
                                      </div>
                                    </SelectItem>
                                  );
                                })}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="dark:text-gray-300 mb-2 block">Fecha</Label>
                          <DatePickerDay
                            date={entryDate}
                            onDateChange={(date) => setEntryDate(date || new Date())}
                            className="w-full h-10 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <Label className="mb-2 block">Concepto *</Label>
                      <Input
                        value={entryForm.concept}
                        onChange={(e) => setEntryForm({ ...entryForm, concept: e.target.value })}
                        placeholder="Ej: Factura proveedor, Venta producto..."
                        className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 h-10"
                        disabled={isEntryModalReadOnly}
                      />
                    </div>
                    <div>
                      <Label className="dark:text-gray-300 mb-2 block">Código de referencia (opcional)</Label>
                      <Popover open={refCodeComboboxOpen} onOpenChange={setRefCodeComboboxOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={refCodeComboboxOpen}
                            className={`w-full justify-between dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 h-10 font-normal ${isEntryModalReadOnly ? 'pointer-events-none opacity-70' : ''}`}
                          >
                            {entryForm.refCode || 'Sin código de referencia'}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
                          <Command>
                            <CommandInput 
                              placeholder="Buscar o crear código..." 
                              className="h-9"
                              value={refCodeSearchTerm}
                              onValueChange={setRefCodeSearchTerm}
                            />
                            <CommandList>
                              <CommandEmpty>
                                <div className="p-2">
                                  <button
                                    type="button"
                                    className="w-full text-left px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-sm"
                                    onClick={() => {
                                      const normalized = refCodeSearchTerm.trim().toUpperCase();
                                      if (normalized) {
                                        setEntryForm(prev => ({ ...prev, refCode: normalized }));
                                        setRefCodeComboboxOpen(false);
                                        setRefCodeSearchTerm('');
                                      }
                                    }}
                                  >
                                    Crear código: <strong>{refCodeSearchTerm.trim().toUpperCase()}</strong>
                                  </button>
                                </div>
                              </CommandEmpty>
                              <CommandGroup>
                                <CommandItem
                                  value="none"
                                  onSelect={() => {
                                    setEntryForm(prev => ({ ...prev, refCode: '' }));
                                    setRefCodeComboboxOpen(false);
                                    setRefCodeSearchTerm('');
                                  }}
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${!entryForm.refCode ? 'opacity-100' : 'opacity-0'}`}
                                  />
                                  Sin código de referencia
                                </CommandItem>
                                {existingRefCodes.map(code => (
                                  <CommandItem
                                    key={code}
                                    value={code}
                                    onSelect={() => {
                                      setEntryForm(prev => ({ ...prev, refCode: code }));
                                      setRefCodeComboboxOpen(false);
                                      setRefCodeSearchTerm('');
                                    }}
                                  >
                                    <Check
                                      className={`mr-2 h-4 w-4 ${entryForm.refCode?.toUpperCase() === code ? 'opacity-100' : 'opacity-0'}`}
                                    />
                                    {code}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {hasCRMAddon && projects.length > 0 && (
                      <div>
                        <Label className="dark:text-gray-300 mb-2 block">Proyecto (opcional)</Label>
                        <Popover open={projectComboboxOpen} onOpenChange={setProjectComboboxOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={projectComboboxOpen}
                              className={`w-full justify-between dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 h-10 font-normal ${isEntryModalReadOnly ? 'pointer-events-none opacity-70' : ''}`}
                            >
                              {entryForm.projectId
                                ? (() => {
                                    const selectedProject = projects.find(p => String(p.id) === entryForm.projectId);
                                    return selectedProject
                                      ? (selectedProject.code ? `[${selectedProject.code}] ${selectedProject.name}` : selectedProject.name)
                                      : 'Sin proyecto asociado';
                                  })()
                                : 'Sin proyecto asociado'}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Buscar proyecto..." className="h-9" />
                              <CommandList>
                                <CommandEmpty>No se encontraron proyectos.</CommandEmpty>
                                <CommandGroup>
                                  <CommandItem
                                    value="none"
                                    onSelect={() => {
                                      setEntryForm(prev => ({ ...prev, projectId: null }));
                                      setProjectComboboxOpen(false);
                                    }}
                                  >
                                    <Check className={`mr-2 h-4 w-4 ${!entryForm.projectId ? 'opacity-100' : 'opacity-0'}`} />
                                    Sin proyecto
                                  </CommandItem>
                                  {projects.map(project => (
                                    <CommandItem
                                      key={project.id}
                                      value={`${project.code || ''} ${project.name}`.toLowerCase()}
                                      onSelect={() => {
                                        setEntryForm(prev => ({ ...prev, projectId: String(project.id) }));
                                        setProjectComboboxOpen(false);
                                      }}
                                    >
                                      <Check className={`mr-2 h-4 w-4 ${entryForm.projectId === String(project.id) ? 'opacity-100' : 'opacity-0'}`} />
                                      {project.code ? `[${project.code}] ${project.name}` : project.name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                    )}
                    
                    {/* Cliente/Proveedor - mostrar siempre que haya proyecto seleccionado */}
                    {hasCRMAddon && entryForm.projectId && projects.length > 0 && (() => {
                      const selectedProject = projects.find(p => String(p.id) === entryForm.projectId);
                      const clientsList = (selectedProject?.clients as any[]) || [];
                      const suppliersList = (selectedProject?.suppliers as any[]) || [];
                      
                      const showClientSelect = entryForm.type === 'income';
                      const showSupplierSelect = entryForm.type === 'expense';
                      
                      if (!showClientSelect && !showSupplierSelect) return null;
                      
                      return (
                        <div>
                          <Label className="dark:text-gray-300 mb-2 block">
                            {entryForm.type === 'income' ? 'Cliente (opcional)' : 'Proveedor (opcional)'}
                          </Label>
                          <Select
                            value={entryForm.type === 'income' ? (entryForm.crmClientId?.toString() || 'none') : (entryForm.crmSupplierId?.toString() || 'none')}
                            onValueChange={(value) => {
                              if (entryForm.type === 'income') {
                                setEntryForm(prev => ({ ...prev, crmClientId: value === 'none' ? null : parseInt(value) }));
                              } else {
                                setEntryForm(prev => ({ ...prev, crmSupplierId: value === 'none' ? null : parseInt(value) }));
                              }
                            }}
                            disabled={isEntryModalReadOnly}
                          >
                            <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 h-10">
                              <SelectValue placeholder="Seleccionar..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sin {entryForm.type === 'income' ? 'cliente' : 'proveedor'}</SelectItem>
                              {entryForm.type === 'income' && clientsList.map((client) => (
                                <SelectItem key={client.id} value={client.id.toString()}>
                                  {client.name}
                                </SelectItem>
                              ))}
                              {entryForm.type === 'expense' && suppliersList.map((supplier) => (
                                <SelectItem key={supplier.id} value={supplier.id.toString()}>
                                  {supplier.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })()}
                    
                    <div className={`${hasCRMAddon && projects.length > 0 ? '' : 'lg:col-span-2'}`}>
                      <Label className="dark:text-gray-300 mb-2 block">Método de pago</Label>
                      <Select
                        value={entryForm.paymentMethod}
                        onValueChange={(value) => setEntryForm({ ...entryForm, paymentMethod: value })}
                        disabled={isEntryModalReadOnly}
                      >
                        <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 h-10">
                          <SelectValue placeholder="Selecciona método" />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHOD_OPTIONS.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-4 bg-white dark:bg-gray-800/60">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="md:col-span-2">
                        <Label className="dark:text-gray-300 mb-2 block">Base imponible (sin IVA)</Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          value={entryForm.amount}
                          onChange={(e) => handleBaseAmountInput(e.target.value)}
                          placeholder="0.00"
                          className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 h-10"
                          disabled={isEntryModalReadOnly}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label className="dark:text-gray-300">Tipo de IVA</Label>
                        <Select value={entryForm.vatRate} onValueChange={handleVatRateDropdownChange} disabled={isEntryModalReadOnly}>
                          <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 h-10">
                            <SelectValue placeholder="Selecciona IVA" />
                          </SelectTrigger>
                          <SelectContent>
                            {VAT_OPTIONS.map(option => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="dark:text-gray-300 mb-2 block">IVA (€)</Label>
                        <Input
                          readOnly
                          value={vatAmountDisplay}
                          placeholder="0.00"
                          className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 h-10"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="dark:text-gray-300 mb-2 block">Total (con IVA)</Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          value={entryForm.totalAmount}
                          onChange={(e) => handleTotalAmountInput(e.target.value)}
                          placeholder="0.00"
                          className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 h-10"
                          disabled={isEntryModalReadOnly}
                        />
                      </div>
                    </div>
                  </div>

                  {/* IRPF: retenciones y deducibilidad */}
                  {entryForm.type === 'income' ? (
                    <div className="rounded-2xl border border-purple-200 dark:border-purple-900/50 p-4 bg-purple-50/40 dark:bg-purple-900/10">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <Label className="dark:text-purple-100 text-purple-900 mb-0">Retención IRPF</Label>
                          <p className="text-xs text-muted-foreground">Impuesto repercutido en la factura (modelo 130)</p>
                        </div>
                        <span className="text-[11px] text-muted-foreground">Opcional</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <Label className="dark:text-gray-300 mb-1 block">Tipo %</Label>
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="0.1"
                            value={entryForm.irpfRetentionRate}
                            onChange={(e) => handleIrpfRetentionRateChange(e.target.value)}
                            placeholder="0"
                            className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 h-10"
                            disabled={isEntryModalReadOnly}
                          />
                        </div>
                        <div>
                          <Label className="dark:text-gray-300 mb-1 block">Retención (€)</Label>
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            value={entryForm.irpfRetentionAmount}
                            onChange={(e) => handleIrpfRetentionAmountChange(e.target.value)}
                            placeholder="0.00"
                            className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 h-10"
                            disabled={isEntryModalReadOnly}
                          />
                        </div>
                        <div className="rounded-lg bg-white/60 dark:bg-gray-900/40 border border-purple-200 dark:border-purple-800 p-3 text-sm">
                          <p className="text-xs text-muted-foreground leading-tight">
                            Se resta de la cuota a ingresar. Si dejas 0, no se aplicará retención para este movimiento.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="rounded-2xl border border-purple-200 dark:border-purple-900/50 p-4 bg-purple-50/30 dark:bg-purple-900/5">
                        <div className="flex items-center justify-between mb-2">
                          <Label className="dark:text-purple-100 text-purple-900">IRPF - Gasto deducible</Label>
                          <span className="text-[11px] text-muted-foreground">Solo efecto fiscal</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm">
                          <label className="flex items-center gap-2 text-gray-800 dark:text-gray-200">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={entryForm.irpfDeductible}
                              onChange={(e) => setEntryForm(prev => ({ ...prev, irpfDeductible: e.target.checked }))}
                              disabled={isEntryModalReadOnly}
                            />
                            Deducible IRPF
                          </label>
                          <label className="flex items-center gap-2 text-gray-800 dark:text-gray-200">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={entryForm.irpfIsSocialSecurity}
                              onChange={(e) => setEntryForm(prev => ({ ...prev, irpfIsSocialSecurity: e.target.checked }))}
                              disabled={isEntryModalReadOnly}
                            />
                            Cuota Seguridad Social
                          </label>
                          <p className="text-xs text-muted-foreground">
                            Las cuotas de SS se separan en el resumen IRPF.
                          </p>
                        </div>
                      </div>

                      {/* Retención practicada por nosotros (111/115) */}
                      <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/50 p-4 bg-indigo-50/30 dark:bg-indigo-900/5">
                        <div className="flex items-center justify-between mb-3">
                          <Label className="dark:text-indigo-100 text-indigo-900">Retención practicada (111/115)</Label>
                          <label className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={Boolean(entryForm.retentionAppliedByUs)}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setEntryForm(prev => {
                                  const base = { ...prev, retentionAppliedByUs: checked };
                                  if (checked && activeFiscalConfig.autoApplyRetentionDefaults) {
                                    return applyRetentionDefaults(base);
                                  }
                                  return base;
                                });
                              }}
                              disabled={isEntryModalReadOnly}
                            />
                            Aplicada por nosotros
                          </label>
                        </div>
                        {entryForm.retentionAppliedByUs && (
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <Label className="dark:text-gray-300 mb-2 block text-sm">Tipo retención</Label>
                              <Select
                                value={entryForm.retentionType || ''}
                                onValueChange={(value) => {
                                  setEntryForm(prev => {
                                    const next = { ...prev, retentionType: value as any };
                                    if (activeFiscalConfig.autoApplyRetentionDefaults && next.type === 'expense' && next.retentionAppliedByUs) {
                                      return applyRetentionDefaults(next);
                                    }
                                    return next;
                                  });
                                }}
                                disabled={isEntryModalReadOnly}
                              >
                                <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 h-10">
                                  <SelectValue placeholder="Selecciona" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="professional">Profesional (111)</SelectItem>
                                  <SelectItem value="rent">Alquiler (115)</SelectItem>
                                  <SelectItem value="other">Otro</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="dark:text-gray-300 mb-2 block text-sm">Tipo %</Label>
                              <Input
                                type="number"
                                inputMode="decimal"
                                step="0.1"
                                value={entryForm.irpfRetentionRate}
                                onChange={(e) => handleIrpfRetentionRateChange(e.target.value)}
                                placeholder="0"
                                className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 h-10"
                                disabled={isEntryModalReadOnly}
                              />
                            </div>
                            <div>
                              <Label className="dark:text-gray-300 mb-2 block text-sm">Retención (€)</Label>
                              <Input
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                value={entryForm.irpfRetentionAmount}
                                onChange={(e) => handleIrpfRetentionAmountChange(e.target.value)}
                                placeholder="0.00"
                                className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 h-10"
                                disabled={isEntryModalReadOnly}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="lg:col-span-2">
                      <Label className="dark:text-gray-300 mb-2 block">Descripción (opcional)</Label>
                      <Textarea
                        value={entryForm.description}
                        onChange={(e) => setEntryForm({ ...entryForm, description: e.target.value })}
                        placeholder="Añade detalles adicionales sobre este movimiento..."
                        className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 h-[72px] resize-none"
                        disabled={isEntryModalReadOnly}
                      />
                    </div>
                  </div>

                  {editingEntry?.attachments && editingEntry.attachments.length > 0 && (
                    <div className="-mt-1">
                      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                        Adjuntos existentes ({editingEntry.attachments.length})
                      </p>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {editingEntry.attachments.map((attachment) => {
                          const isPdf = attachment.mimeType?.includes('pdf') || attachment.fileName.toLowerCase().endsWith('.pdf');
                          const isImage = attachment.mimeType?.startsWith('image/') || /\.(png|jpe?g|gif|bmp|webp)$/i.test(attachment.fileName);
                          return (
                            <div
                              key={attachment.id}
                              className="w-full p-3 border rounded-lg text-left flex items-center gap-3 transition-colors border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                            >
                              <button
                                type="button"
                                onClick={() => setSelectedFileForViewer({
                                  url: attachment.fileUrl || `/api/accounting/attachments/${attachment.id}/download`,
                                  filename: attachment.fileName,
                                  mimeType: attachment.mimeType,
                                  type: 'existing'
                                })}
                                className="flex-1 flex items-center gap-3"
                              >
                              <div className="flex-shrink-0">
                                {isImage ? (
                                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                  </div>
                                ) : isPdf ? (
                                  <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-red-600 dark:text-red-400" />
                                  </div>
                                ) : (
                                  <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                  {attachment.fileName}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {(attachment.fileSize / 1024).toFixed(1)} KB
                                </p>
                              </div>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm('¿Eliminar este adjunto?')) {
                                    handleDeleteAttachment(attachment.id);
                                  }
                                }}
                                className="flex-shrink-0 p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                                title="Eliminar adjunto"
                              >
                                <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {entryFiles.length > 0 && (
                    <div className="-mt-1">
                      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                        Archivos nuevos ({entryFiles.length})
                      </p>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {entryFiles.map((file, index) => {
                          const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
                          const isImage = file.type.startsWith('image/');
                          return (
                            <div
                              key={index}
                              role="button"
                              tabIndex={0}
                              onClick={() => handleOpenPreview(file, null)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  handleOpenPreview(file, null);
                                }
                              }}
                              className="w-full p-3 border rounded-lg text-left flex items-center gap-3 transition-colors border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                            >
                              <div className="flex-shrink-0">
                                {isImage ? (
                                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                  </div>
                                ) : isPdf ? (
                                  <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-red-600 dark:text-red-400" />
                                  </div>
                                ) : (
                                  <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                  {file.name}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {(file.size / 1024).toFixed(1)} KB
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteFileConfirm({ open: true, fileIndex: index });
                                }}
                                className="flex-shrink-0 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                              >
                                <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                    </>
                </fieldset>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de vista previa de documentos */}
      <DocumentPreviewModal
        open={previewModalState?.open || false}
        url={previewModalState?.url || ''}
        filename={previewModalState?.filename || ''}
        mimeType={previewModalState?.mimeType}
        onClose={handleClosePreview}
      />

      {/* Modal para añadir/editar categoría */}
      <Dialog open={showCategoryModal} onOpenChange={setShowCategoryModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="sticky top-0 z-10 pb-2">
            <DialogTitle>
              {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
            </DialogTitle>
            <DialogDescription>
              {editingCategory ? 'Modifica los detalles de la categoría' : 'Crea una nueva categoría para organizar tus movimientos'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 overflow-y-auto flex-1">
            {/* Tipo */}
            <div>
              <Label className="dark:text-gray-300">Tipo</Label>
              <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-700 p-1 w-full mt-2 h-10">
                <button
                  type="button"
                  onClick={() => setCategoryForm({ ...categoryForm, type: 'expense' })}
                  className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                    categoryForm.type === 'expense'
                      ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  <TrendingDown className="w-4 h-4" />
                  Gasto
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryForm({ ...categoryForm, type: 'income' })}
                  className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                    categoryForm.type === 'income'
                      ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                  Ingreso
                </button>
              </div>
            </div>

            {/* Nombre */}
            <div>
              <Label className="dark:text-gray-300">Nombre</Label>
              <Input
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                placeholder="Nombre de la categoría"
                className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 mt-2 h-10"
              />
            </div>

            {/* Color e Iconos */}
            <div className="grid grid-cols-[100px_1fr] gap-4">
              <div>
                <Label className="dark:text-gray-300">Color</Label>
                <div 
                  onClick={() => document.getElementById('categoryColorPicker')?.click()}
                  className="mt-2 h-10 w-full rounded-md cursor-pointer border border-gray-300 dark:border-gray-600"
                  style={{ backgroundColor: categoryForm.color }}
                >
                  <input
                    id="categoryColorPicker"
                    type="color"
                    value={categoryForm.color}
                    onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                    className="opacity-0 w-0 h-0"
                  />
                </div>
              </div>
              <div>
                <Label className="dark:text-gray-300">Icono</Label>
                <div className="grid grid-cols-8 gap-1 mt-2">
                  {ICON_OPTIONS.map(option => {
                    const IconComponent = getCategoryIcon(option.value);
                    const isSelected = categoryForm.icon === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setCategoryForm({ ...categoryForm, icon: option.value })}
                        className={`
                          p-2 rounded-md transition-colors relative
                          ${isSelected 
                            ? 'bg-[#007AFF]' 
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                          }
                        `}
                        title={option.label}
                      >
                        <IconComponent 
                          className="w-5 h-5 mx-auto" 
                          style={{ color: isSelected ? '#ffffff' : categoryForm.color }}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="sticky bottom-0 z-10 pt-2">
            <Button variant="outline" onClick={() => setShowCategoryModal(false)} className="dark:border-gray-600 dark:text-gray-300">
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmitCategory}
              disabled={!categoryForm.name}
            >
              {editingCategory ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog para confirmar eliminar movimiento */}
      <AlertDialog open={deleteEntryConfirmOpen} onOpenChange={setDeleteEntryConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar movimiento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el movimiento de forma permanente. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDeleteEntry}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog para confirmar eliminar categoría */}
      <AlertDialog open={deleteCategoryConfirmOpen} onOpenChange={setDeleteCategoryConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la categoría de forma permanente. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDeleteCategory}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog para confirmar revertir a pendiente */}
      <AlertDialog open={revertConfirm.open} onOpenChange={(open) => setRevertConfirm({ open, entry: open ? revertConfirm.entry : null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Revertir a pendiente?</AlertDialogTitle>
            <AlertDialogDescription>
              {revertConfirm.entry && (
                <>
                  El movimiento <strong>{revertConfirm.entry.concept}</strong> será revertido a estado pendiente
                  y podrá ser revisado nuevamente.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-orange-600 hover:bg-orange-700"
              onClick={handleRevertToPending}
            >
              Revertir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog para confirmar eliminar archivo nuevo */}
      <AlertDialog open={deleteFileConfirm.open} onOpenChange={(open) => setDeleteFileConfirm({ open, fileIndex: open ? deleteFileConfirm.fileIndex : null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar archivo?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteFileConfirm.fileIndex !== null && entryFiles[deleteFileConfirm.fileIndex] && (
                <>
                  Se eliminará el archivo <strong>{entryFiles[deleteFileConfirm.fileIndex].name}</strong>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (deleteFileConfirm.fileIndex !== null) {
                  // Limpiar preview si se elimina el archivo que está siendo visualizado
                  if (selectedFileForViewer?.type === 'new' && selectedFileForViewer?.index === deleteFileConfirm.fileIndex) {
                    setSelectedFileForViewer(null);
                  }
                  setEntryFiles(prev => prev.filter((_, i) => i !== deleteFileConfirm.fileIndex));
                }
                setDeleteFileConfirm({ open: false, fileIndex: null });
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Configuración Fiscal */}
      <Dialog
        open={showFiscalConfigModal}
        onOpenChange={(open) => {
          if (open && fiscalSettingsQuery.data) {
            setFiscalConfigDraft(fiscalSettingsQuery.data);
          }
          setShowFiscalConfigModal(open);
        }}
      >
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>Configuración fiscal de la empresa</DialogTitle>
            <DialogDescription>
              Define el tipo de contribuyente, régimen de IVA y parámetros de IRPF aplicables a los cálculos y movimientos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <Card className="border-border">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold">Datos generales</h4>
                      <p className="text-xs text-muted-foreground">Tipo de contribuyente y régimen de IVA</p>
                    </div>
                    <Badge variant="outline" className="text-[11px]">
                      {fiscalConfigDraft.taxpayerType === 'autonomo' ? 'Autónomo' : 'Sociedad'}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs whitespace-nowrap">Tipo de contribuyente</Label>
                      <Select
                        value={fiscalConfigDraft.taxpayerType}
                        onValueChange={(value) => setFiscalConfigDraft(prev => ({ ...prev, taxpayerType: value as FiscalSettings['taxpayerType'] }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="autonomo">Autónomo</SelectItem>
                          <SelectItem value="sociedad">Sociedad</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs whitespace-nowrap">Régimen de IVA</Label>
                      <Select
                        value={fiscalConfigDraft.vatRegime || 'general'}
                        onValueChange={(value) => setFiscalConfigDraft(prev => ({ ...prev, vatRegime: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona régimen" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="general">General</SelectItem>
                          <SelectItem value="simplificado">Régimen simplificado</SelectItem>
                          <SelectItem value="criterio_caja">Criterio de caja</SelectItem>
                          <SelectItem value="recargo_equivalencia">Recargo de equivalencia</SelectItem>
                          <SelectItem value="exento">Exento/No sujeto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs whitespace-nowrap">Prorrata IVA (%)</Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="1"
                          min={0}
                          max={100}
                          value={fiscalConfigDraft.vatProration}
                          onChange={(e) => setFiscalConfigDraft(prev => ({ ...prev, vatProration: Math.min(Math.max(Number(e.target.value) || 0, 0), 100) }))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs whitespace-nowrap">Comunidad autónoma</Label>
                        <Input
                          placeholder={getAutonomousCommunity(company?.province) || 'Selecciona comunidad...'}
                          value={fiscalConfigDraft.community || ''}
                          onChange={(e) => setFiscalConfigDraft(prev => ({ ...prev, community: e.target.value || null }))}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold">IRPF (Modelo 130)</h4>
                      <p className="text-xs text-muted-foreground">Tipos y ajustes aplicados</p>
                    </div>
                    <Badge variant="outline" className="text-[11px]">{(fiscalConfigDraft.model130Rate ?? 0).toFixed(1)}%</Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs whitespace-nowrap">Tipo general (%)</Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        value={fiscalConfigDraft.model130Rate}
                        onChange={(e) => setFiscalConfigDraft(prev => ({ ...prev, model130Rate: Number(e.target.value) || 0 }))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs whitespace-nowrap">Retenciones acumuladas (€)</Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={fiscalConfigDraft.manualWithholdings}
                        onChange={(e) => setFiscalConfigDraft(prev => ({ ...prev, manualWithholdings: Number(e.target.value) || 0 }))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs whitespace-nowrap">Pagos fraccionados previos (€)</Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={fiscalConfigDraft.previousPayments}
                        onChange={(e) => setFiscalConfigDraft(prev => ({ ...prev, previousPayments: Number(e.target.value) || 0 }))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs whitespace-nowrap">Cuotas Seguridad Social (€)</Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={fiscalConfigDraft.manualSocialSecurity}
                        onChange={(e) => setFiscalConfigDraft(prev => ({ ...prev, manualSocialSecurity: Number(e.target.value) || 0 }))}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs whitespace-nowrap">Ajustes/regularizaciones (€)</Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={fiscalConfigDraft.otherAdjustments}
                        onChange={(e) => setFiscalConfigDraft(prev => ({ ...prev, otherAdjustments: Number(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold">Retenciones y otros</h4>
                    <p className="text-xs text-muted-foreground">Valores por defecto aplicados al crear movimientos</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs whitespace-nowrap">Retención por defecto (%)</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      value={fiscalConfigDraft.retentionDefaultRate ?? ''}
                      onChange={(e) => setFiscalConfigDraft(prev => ({ ...prev, retentionDefaultRate: e.target.value === '' ? null : Number(e.target.value) || 0 }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs whitespace-nowrap">Tipo de IVA (referencia)</Label>
                    <Input value={fiscalConfigDraft.vatRegime || 'general'} disabled />
                  </div>
                  <div>
                    <Label className="text-xs whitespace-nowrap">Comunidad</Label>
                    <Input value={fiscalConfigDraft.community || 'No indicada'} disabled />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Guarda estos valores para asegurar que las declaraciones de IVA/IRPF y las retenciones se calculen con los parámetros correctos.
                </p>
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFiscalConfigModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => fiscalSettingsMutation.mutate(fiscalConfigDraft)}
              disabled={fiscalSettingsMutation.isPending}
              className="gap-2"
            >
              {fiscalSettingsMutation.isPending ? 'Guardando...' : 'Guardar configuración'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Exportación */}
      <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Exportar Datos Fiscales</DialogTitle>
            <DialogDescription>
              Selecciona qué deseas exportar a Excel
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <button
              onClick={() => {
                exportIVAToExcel();
                setShowExportModal(false);
              }}
              className="w-full p-4 text-left border border-border rounded-lg hover:bg-muted/50 transition-colors group"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                  <Calculator className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm">Libro IVA Detallado</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Resumen + listado completo de operaciones con IVA
                  </p>
                </div>
              </div>
            </button>

            {/* Placeholder para futuras exportaciones */}
            <button
              disabled
              className="w-full p-4 text-left border border-dashed border-muted-foreground rounded-lg opacity-50 cursor-not-allowed"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-gray-100 dark:bg-gray-900/30 rounded-lg">
                  <Download className="h-5 w-5 text-gray-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground">Movimientos por Proyecto</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Próximamente
                  </p>
                </div>
              </div>
            </button>

            <button
              disabled
              className="w-full p-4 text-left border border-dashed border-muted-foreground rounded-lg opacity-50 cursor-not-allowed"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-gray-100 dark:bg-gray-900/30 rounded-lg">
                  <Download className="h-5 w-4 text-gray-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground">Resumen Estado de Cuenta</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Próximamente
                  </p>
                </div>
              </div>
            </button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportModal(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de vista previa de documentos */}
    </div>
  );
}

