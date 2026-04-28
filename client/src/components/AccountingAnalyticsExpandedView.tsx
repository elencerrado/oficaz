// Accounting Analytics Expanded View Component
import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
// Reemplazamos los Tabs por el slider de pestañas usado en contabilidad
import { TabNavigation } from '@/components/ui/tab-navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import {
  TrendingDown,
  TrendingUp,
  Calculator,
  Building2,
  Users,
  Briefcase,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  BarChart3,
  Clock,
  Hash
} from 'lucide-react';

interface AnalyticsEntry {
  id: number;
  companyId?: number;
  categoryId?: number;
  employeeId?: number | null;
  projectId?: number | null;
  crmClientId?: number | null;
  crmSupplierId?: number | null;
  type: 'expense' | 'income';
  concept: string;
  amount: number | string;
  vatRate?: number | string;
  totalAmount?: number | string;
  vatAmount?: number | string;
  description?: string;
  refCode?: string;
  entryDate: string;
  paymentMethod?: string;
  invoiceNumber?: string;
  status?: 'pending' | 'approved' | 'rejected';
  reviewedBy?: number | null;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  category?: { name: string; color: string };
  employee?: { id: number; fullName: string; email?: string };
  submittedByUser?: { id: number; fullName: string; profilePicture?: string | null };
  attachments?: any[];
  project?: { id: number; name: string; code: string };
  crmClient?: { id: number; name: string; email: string };
  crmSupplier?: { id: number; name: string; email: string };
}

interface AnalyticsExpandedViewProps {
  entries: AnalyticsEntry[];
  stats?: {
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
  } | null;
  crmActive?: boolean;
  showPricesWithVAT?: boolean;
  onClose: () => void;
}

interface GroupedData {
  name: string;
  expenses: number;
  incomes: number;
  balance: number;
  count: number;
  approved: number;      // Cantidad aprobada
  pending: number;       // Cantidad pendiente
  icon?: typeof Building2;
}

// Helper para obtener el monto correcto (con o sin IVA)
const getDisplayAmount = (entry: any, withVAT: boolean): number => {
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

const formatCurrency = (amount: number | string | undefined | null) => {
  if (!amount && amount !== 0) return '€0,00';
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) return '€0,00';
  
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR'
  }).format(numAmount);
};

export function AccountingAnalyticsExpandedView({
  entries,
  stats,
  crmActive,
  showPricesWithVAT = true,
  onClose
}: AnalyticsExpandedViewProps) {
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [viewType, setViewType] = useState('overview');

  // Filtrar entries por período
  const filteredEntries = useMemo(() => {
    if (filterPeriod === 'all') return entries;
    
    const now = new Date();
    const startDate = new Date();
    
    switch (filterPeriod) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case 'month':
        startDate.setMonth(now.getMonth());
        startDate.setDate(1);
        break;
      case 'quarter':
        startDate.setMonth(Math.floor(now.getMonth() / 3) * 3);
        startDate.setDate(1);
        break;
      case 'year':
        startDate.setMonth(0);
        startDate.setDate(1);
        break;
    }
    
    return entries.filter(e => new Date(e.entryDate) >= startDate);
  }, [entries, filterPeriod]);

  // Analizar por clientes (usando crmClientId directo de los movimientos)
  const clientAnalysis = useMemo(() => {
    const grouped: Record<string, GroupedData> = {};
    
    // Agrupar movimientos por cliente - separando aprobados/pendientes
    filteredEntries.forEach(entry => {
      if (!crmActive || !entry.crmClientId) return;
      
      const key = entry.crmClientId.toString();
      if (!grouped[key]) {
        grouped[key] = {
          name: entry.crmClient?.name || `Cliente ${entry.crmClientId}`,
          expenses: 0,
          incomes: 0,
          balance: 0,
          count: 0,
          approved: 0,
          pending: 0,
          icon: Users
        };
      }
      
      const amount = getDisplayAmount(entry, showPricesWithVAT);
      if (!isNaN(amount)) {
        if (entry.type === 'income') {
          grouped[key].incomes += amount;
        } else {
          grouped[key].expenses += amount;
        }
        grouped[key].balance = grouped[key].incomes - grouped[key].expenses;
        grouped[key].count++;
        
        // Separar aprobados vs pendientes
        if (entry.status === 'approved') {
          grouped[key].approved += amount;
        } else if (entry.status === 'pending') {
          grouped[key].pending += amount;
        }
      }
    });
    
    return Object.values(grouped).sort((a, b) => Math.abs(b.approved) - Math.abs(a.approved));
  }, [filteredEntries, crmActive, showPricesWithVAT]);

  // Analizar por proveedores (usando crmSupplierId directo de los movimientos)
  const supplierAnalysis = useMemo(() => {
    const grouped: Record<string, GroupedData> = {};
    
    // Agrupar movimientos por proveedor - solo gastos con crmSupplierId asignado
    filteredEntries.forEach(entry => {
      if (!crmActive || !entry.crmSupplierId || entry.type !== 'expense') return;
      
      const key = entry.crmSupplierId.toString();
      if (!grouped[key]) {
        grouped[key] = {
          name: entry.crmSupplier?.name || `Proveedor ${entry.crmSupplierId}`,
          expenses: 0,
          incomes: 0,
          balance: 0,
          count: 0,
          approved: 0,
          pending: 0,
          icon: Building2
        };
      }
      
      const amount = getDisplayAmount(entry, showPricesWithVAT);
      if (!isNaN(amount)) {
        grouped[key].expenses += amount;
        grouped[key].balance = -grouped[key].expenses;
        grouped[key].count++;
        
        // Separar aprobados vs pendientes
        if (entry.status === 'approved') {
          grouped[key].approved += amount;
        } else if (entry.status === 'pending') {
          grouped[key].pending += amount;
        }
      }
    });
    
    return Object.values(grouped).sort((a, b) => b.approved - a.approved);
  }, [filteredEntries, crmActive, showPricesWithVAT]);

  // Analizar por proyectos con 4 columnas (ingresos, ingresos pendientes, gastos, gastos pendientes)
  const projectQuadAnalysis = useMemo(() => {
    const grouped: Record<string, {
      name: string;
      count: number;
      approvedIncome: number;
      pendingIncome: number;
      approvedExpense: number;
      pendingExpense: number;
    }> = {};

    filteredEntries.forEach(entry => {
      if (!entry.project) return;

      const key = entry.project.id.toString();
      if (!grouped[key]) {
        grouped[key] = {
          name: `${entry.project.name} (${entry.project.code})`,
          count: 0,
          approvedIncome: 0,
          pendingIncome: 0,
          approvedExpense: 0,
          pendingExpense: 0,
        };
      }

      const amount = getDisplayAmount(entry, showPricesWithVAT);
      if (isNaN(amount)) return;

      if (entry.type === 'income') {
        if (entry.status === 'approved') grouped[key].approvedIncome += amount;
        else if (entry.status === 'pending') grouped[key].pendingIncome += amount;
      } else if (entry.type === 'expense') {
        if (entry.status === 'approved') grouped[key].approvedExpense += amount;
        else if (entry.status === 'pending') grouped[key].pendingExpense += amount;
      }
      grouped[key].count++;
    });

    return Object.values(grouped).sort((a, b) => (
      (b.approvedIncome + b.pendingIncome + b.approvedExpense + b.pendingExpense) -
      (a.approvedIncome + a.pendingIncome + a.approvedExpense + a.pendingExpense)
    ));
  }, [filteredEntries, showPricesWithVAT]);

  // Analizar por códigos de referencia con 4 columnas (igual que proyectos, para cuando NO hay CRM)
  const refCodeQuadAnalysis = useMemo(() => {
    const grouped: Record<string, {
      name: string;
      count: number;
      approvedIncome: number;
      pendingIncome: number;
      approvedExpense: number;
      pendingExpense: number;
    }> = {};

    filteredEntries.forEach(entry => {
      if (!entry.refCode) return;

      const key = entry.refCode;
      if (!grouped[key]) {
        grouped[key] = {
          name: entry.refCode,
          count: 0,
          approvedIncome: 0,
          pendingIncome: 0,
          approvedExpense: 0,
          pendingExpense: 0,
        };
      }

      const amount = getDisplayAmount(entry, showPricesWithVAT);
      if (isNaN(amount)) return;

      if (entry.type === 'income') {
        if (entry.status === 'approved') grouped[key].approvedIncome += amount;
        else if (entry.status === 'pending') grouped[key].pendingIncome += amount;
      } else if (entry.type === 'expense') {
        if (entry.status === 'approved') grouped[key].approvedExpense += amount;
        else if (entry.status === 'pending') grouped[key].pendingExpense += amount;
      }
      grouped[key].count++;
    });

    return Object.values(grouped).sort((a, b) => (
      (b.approvedIncome + b.pendingIncome + b.approvedExpense + b.pendingExpense) -
      (a.approvedIncome + a.pendingIncome + a.approvedExpense + a.pendingExpense)
    ));
  }, [filteredEntries, showPricesWithVAT]);

  // Analizar por categorías
  const categoryTypeAnalysis = useMemo(() => {
    const grouped: Record<string, {
      name: string;
      approvedIncome: number;
      pendingIncome: number;
      countIncome: number;
      approvedExpense: number;
      pendingExpense: number;
      countExpense: number;
    }> = {};

    filteredEntries.forEach(entry => {
      if (!entry.category) return;

      const key = entry.category.name;
      if (!grouped[key]) {
        grouped[key] = {
          name: entry.category.name,
          approvedIncome: 0,
          pendingIncome: 0,
          countIncome: 0,
          approvedExpense: 0,
          pendingExpense: 0,
          countExpense: 0,
        };
      }

      const amount = getDisplayAmount(entry, showPricesWithVAT);
      if (isNaN(amount)) return;

      if (entry.type === 'income') {
        if (entry.status === 'approved') grouped[key].approvedIncome += amount;
        else if (entry.status === 'pending') grouped[key].pendingIncome += amount;
        grouped[key].countIncome++;
      } else if (entry.type === 'expense') {
        if (entry.status === 'approved') grouped[key].approvedExpense += amount;
        else if (entry.status === 'pending') grouped[key].pendingExpense += amount;
        grouped[key].countExpense++;
      }
    });

    const income = Object.values(grouped)
      .filter(c => (c.approvedIncome + c.pendingIncome) > 0)
      .sort((a, b) => (b.approvedIncome + b.pendingIncome) - (a.approvedIncome + a.pendingIncome));
    const expense = Object.values(grouped)
      .filter(c => (c.approvedExpense + c.pendingExpense) > 0)
      .sort((a, b) => (b.approvedExpense + b.pendingExpense) - (a.approvedExpense + a.pendingExpense));

    return { income, expense };
  }, [filteredEntries, showPricesWithVAT]);

  // Preparar datos para gráfica de categorías (Ingresos vs Gastos)
  const categoryChartData = useMemo(() => {
    const incomesTotal = categoryTypeAnalysis.income.reduce((sum, cat) => sum + cat.approvedIncome + cat.pendingIncome, 0);
    const expensesTotal = categoryTypeAnalysis.expense.reduce((sum, cat) => sum + cat.approvedExpense + cat.pendingExpense, 0);
    return [
      { name: 'Ingresos', value: incomesTotal, color: '#16a34a' },
      { name: 'Gastos', value: expensesTotal, color: '#dc2626' }
    ].filter(item => item.value > 0);
  }, [categoryTypeAnalysis]);

  // Preparar datos para gráfica de clientes
  const clientChartData = useMemo(() => {
    return clientAnalysis
      .filter(client => client.approved > 0)
      .map(client => ({
        name: client.name,
        value: client.approved,
        color: '#3b82f6'
      }))
      .slice(0, 8);
  }, [clientAnalysis]);

  // Preparar datos para gráfica de proveedores
  const supplierChartData = useMemo(() => {
    return supplierAnalysis
      .filter(supplier => supplier.approved > 0)
      .map(supplier => ({
        name: supplier.name,
        value: supplier.approved,
        color: '#f59e0b'
      }))
      .slice(0, 8);
  }, [supplierAnalysis]);

  // Preparar datos para gráfica de proyectos
  const projectChartData = useMemo(() => {
    return projectQuadAnalysis
      .map(project => ({
        name: project.name,
        value: project.approvedIncome + project.pendingIncome + project.approvedExpense + project.pendingExpense,
        color: '#8b5cf6'
      }))
      .filter(p => p.value > 0)
      .slice(0, 8);
  }, [projectQuadAnalysis]);

  // DataRow con 2 columnas: Aprobado (verde) y Pendiente (naranja)
  const ApprovedPendingDataRow = ({ item }: { item: GroupedData }) => {
    return (
      <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{item.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <span className="hidden sm:inline">{item.count} transacción{item.count !== 1 ? 'es' : ''}</span>
            <span className="sm:hidden whitespace-nowrap">{item.count} mov</span>
          </p>
        </div>
        
        <div className="flex items-center gap-6 ml-4">
          <div className="text-right">
            <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <ArrowDownLeft className="w-4 h-4" />
              <span className="text-sm font-semibold">{formatCurrency(item.approved)}</span>
            </div>
          </div>
          
          <div className="text-right">
            <div className="flex items-center gap-1 text-amber-500 dark:text-amber-400">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-semibold">{formatCurrency(item.pending)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const DataRow = ({ item }: { item: GroupedData }) => {
    const isProfit = item.balance > 0;
    
    return (
      <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{item.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <span className="hidden sm:inline">{item.count} transacción{item.count !== 1 ? 'es' : ''}</span>
            <span className="sm:hidden whitespace-nowrap">{item.count} mov</span>
          </p>
        </div>
        
        <div className="flex items-center gap-6 ml-4">
          {item.incomes > 0 && (
            <div className="text-right">
              <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <ArrowDownLeft className="w-4 h-4" />
                <span className="text-sm font-semibold">{formatCurrency(item.incomes)}</span>
              </div>
            </div>
          )}
          
          {item.expenses > 0 && (
            <div className="text-right">
              <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                <ArrowUpRight className="w-4 h-4" />
                <span className="text-sm font-semibold">{formatCurrency(item.expenses)}</span>
              </div>
            </div>
          )}
          
          <div className={`text-right min-w-24`}>
            <div className={`flex items-center gap-1 font-semibold ${isProfit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {isProfit ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span className="text-sm">{formatCurrency(item.balance)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // DataRow simplificado para clientes (aprobado y pendiente)
  const ClientDataRow = ({ item }: { item: GroupedData }) => {
    return (
      <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{item.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <span className="hidden sm:inline">{item.count} transacción{item.count !== 1 ? 'es' : ''}</span>
            <span className="sm:hidden whitespace-nowrap">{item.count} mov</span>
          </p>
        </div>
        
        <div className="flex items-center gap-6 ml-4">
          <div className="text-right">
            <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <span className="text-sm font-semibold">{formatCurrency(item.approved)}</span>
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          
          <div className="text-right">
            <div className="flex items-center gap-1 text-amber-500 dark:text-amber-400">
              <span className="text-sm font-semibold">{formatCurrency(item.pending)}</span>
              <Clock className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>
    );
  };

  // DataRow simplificado para proveedores (aprobado y pendiente)
  const SupplierDataRow = ({ item }: { item: GroupedData }) => {
    return (
      <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{item.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <span className="hidden sm:inline">{item.count} transacción{item.count !== 1 ? 'es' : ''}</span>
            <span className="sm:hidden whitespace-nowrap">{item.count} mov</span>
          </p>
        </div>
        
        <div className="flex items-center gap-6 ml-4">
          <div className="text-right">
            <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <span className="text-sm font-semibold">{formatCurrency(item.approved)}</span>
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          
          <div className="text-right">
            <div className="flex items-center gap-1 text-amber-500 dark:text-amber-400">
              <span className="text-sm font-semibold">{formatCurrency(item.pending)}</span>
              <Clock className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Filas específicas para categorías (Ingresos y Gastos)
  const CategoryIncomeRow = ({ item }: { item: GroupedData }) => {
    return (
      <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{item.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <span className="hidden sm:inline">{item.count} transacción{item.count !== 1 ? 'es' : ''}</span>
            <span className="sm:hidden whitespace-nowrap">{item.count} mov</span>
          </p>
        </div>
        <div className="flex items-center gap-6 ml-4">
          <div className="text-right">
            <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <span className="text-sm font-semibold">{formatCurrency(item.approved)}</span>
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 text-amber-500 dark:text-amber-400">
              <span className="text-sm font-semibold">{formatCurrency(item.pending)}</span>
              <Clock className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const CategoryExpenseRow = ({ item }: { item: GroupedData }) => {
    return (
      <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{item.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <span className="hidden sm:inline">{item.count} transacción{item.count !== 1 ? 'es' : ''}</span>
            <span className="sm:hidden whitespace-nowrap">{item.count} mov</span>
          </p>
        </div>
        <div className="flex items-center gap-6 ml-4">
          <div className="text-right">
            <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
              <span className="text-sm font-semibold">{formatCurrency(item.approved)}</span>
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 text-amber-500 dark:text-amber-400">
              <span className="text-sm font-semibold">{formatCurrency(item.pending)}</span>
              <Clock className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Fila para proyectos con 4 columnas: ingresos, ingresos pendientes, gastos, gastos pendientes
  const ProjectQuadRow = ({ project }: { project: { name: string; count: number; approvedIncome: number; pendingIncome: number; approvedExpense: number; pendingExpense: number; } }) => {
    return (
      <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{project.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <span className="hidden sm:inline">{project.count} transacción{project.count !== 1 ? 'es' : ''}</span>
            <span className="sm:hidden whitespace-nowrap">{project.count} mov</span>
          </p>
        </div>
        <div className="grid grid-cols-4 gap-6 ml-4">
          <div className="text-right">
            <div className="flex items-center justify-end gap-1 text-green-600 dark:text-green-400" title="Ingresos">
              <span className="text-sm font-semibold min-w-[75px]">{formatCurrency(project.approvedIncome)}</span>
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-1 text-amber-500 dark:text-amber-400" title="Ingresos pendientes">
              <span className="text-sm font-semibold min-w-[75px]">{formatCurrency(project.pendingIncome)}</span>
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-1 text-red-600 dark:text-red-400" title="Gastos">
              <span className="text-sm font-semibold min-w-[75px]">{formatCurrency(project.approvedExpense)}</span>
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-1 text-amber-500 dark:text-amber-400" title="Gastos pendientes">
              <span className="text-sm font-semibold min-w-[75px]">{formatCurrency(project.pendingExpense)}</span>
              <Clock className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const AnalysisSection = ({ title, data, icon: Icon, rowType = 'default' }: { title: string; data: GroupedData[]; icon: any; rowType?: 'default' | 'client' | 'supplier' | 'approved-pending' | 'category-income' | 'category-expense' }) => {
    if (data.length === 0) {
      return (
        <div className="text-center py-8">
          <Icon className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-gray-500 dark:text-gray-400">No hay datos disponibles</p>
        </div>
      );
    }

    return (
      <div>
        <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Icon className="w-5 h-5" />
          {title}
        </h3>
        <div className="space-y-2">
          {data.map((item, idx) => {
            if (rowType === 'client') {
              return <ClientDataRow key={`${title}-${idx}`} item={item} />;
            } else if (rowType === 'supplier') {
              return <SupplierDataRow key={`${title}-${idx}`} item={item} />;
            } else if (rowType === 'approved-pending') {
              return <ApprovedPendingDataRow key={`${title}-${idx}`} item={item} />;
            } else if (rowType === 'category-income') {
              return <CategoryIncomeRow key={`${title}-${idx}`} item={item} />;
            } else if (rowType === 'category-expense') {
              return <CategoryExpenseRow key={`${title}-${idx}`} item={item} />;
            }
            return <DataRow key={`${title}-${idx}`} item={item} />;
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Filtro de período */}
      <div className="flex items-center gap-3 bg-white dark:bg-gray-800 p-3 rounded-lg">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Período:</label>
        <Select value={filterPeriod} onValueChange={setFilterPeriod}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo el tiempo</SelectItem>
            <SelectItem value="7d">Últimos 7 días</SelectItem>
            <SelectItem value="30d">Últimos 30 días</SelectItem>
            <SelectItem value="month">Este mes</SelectItem>
            <SelectItem value="quarter">Este trimestre</SelectItem>
            <SelectItem value="year">Este año</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs para diferentes vistas - usar el slider de pestañas de contabilidad */}
      <div>
        <TabNavigation
          tabs={[
            { id: 'overview', label: 'General', icon: BarChart3 },
            ...(crmActive ? [{ id: 'clients', label: 'Clientes', icon: Users }] : []),
            ...(crmActive ? [{ id: 'suppliers', label: 'Proveedores', icon: Building2 }] : []),
            ...(crmActive ? [{ id: 'projects', label: 'Proyectos', icon: Briefcase }] : [{ id: 'refcodes', label: 'Códigos Ref', icon: Hash }]),
          ] as any}
          activeTab={viewType}
          onTabChange={(tabId) => setViewType(tabId)}
          className="[&>div]:bg-gray-800 [&>div]:dark:bg-gray-900 [&_div[style]]:bg-gray-100 [&_div[style]]:dark:bg-gray-700 [&_button.text-primary]:text-white"
        />

        {/* Contenido según pestaña activa */}
        {viewType === 'overview' && (
          <div className="space-y-4 mt-3">
            <div>
              <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Calculator className="w-5 h-5" />
                Movimientos por Categoría
              </h3>
              <div className="space-y-2">
                {(() => {
                  const rows: Array<{ type: 'income' | 'expense'; item: GroupedData }> = [];
                  categoryTypeAnalysis.income.forEach(cat => {
                    rows.push({
                      type: 'income',
                      item: {
                        name: cat.name,
                        approved: cat.approvedIncome,
                        pending: cat.pendingIncome,
                        count: cat.countIncome,
                        incomes: 0,
                        expenses: 0,
                        balance: 0,
                      }
                    });
                  });
                  categoryTypeAnalysis.expense.forEach(cat => {
                    rows.push({
                      type: 'expense',
                      item: {
                        name: cat.name,
                        approved: cat.approvedExpense,
                        pending: cat.pendingExpense,
                        count: cat.countExpense,
                        incomes: 0,
                        expenses: 0,
                        balance: 0,
                      }
                    });
                  });
                  // Ordenar por mayor movimiento (aprobado+pendiente)
                  rows.sort((a, b) => (b.item.approved + b.item.pending) - (a.item.approved + a.item.pending));
                  return rows.map((row, idx) => (
                    row.type === 'income'
                      ? <CategoryIncomeRow key={`cat-inc-${idx}`} item={row.item} />
                      : <CategoryExpenseRow key={`cat-exp-${idx}`} item={row.item} />
                  ));
                })()}
              </div>
            </div>
          </div>
        )}

        {crmActive && viewType === 'clients' && (
          <div className="space-y-4 mt-3">
            <AnalysisSection
              title="Ingresos por Cliente"
              data={clientAnalysis}
              icon={Users}
              rowType="client"
            />
          </div>
        )}

        {crmActive && viewType === 'suppliers' && (
          <div className="space-y-4 mt-3">
            <AnalysisSection
              title="Gastos por Proveedor"
              data={supplierAnalysis}
              icon={Building2}
              rowType="supplier"
            />
          </div>
        )}

        {crmActive && viewType === 'projects' && (
          <div className="space-y-4 mt-3">
            <div>
              <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                Movimientos por Proyecto
              </h3>
              <div className="space-y-2">
                {projectQuadAnalysis.length === 0 ? (
                  <div className="text-center py-8">
                    <Briefcase className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-500 dark:text-gray-400">No hay datos disponibles</p>
                  </div>
                ) : (
                  projectQuadAnalysis.map((p, idx) => (
                    <ProjectQuadRow key={`proj-${idx}`} project={p} />
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {!crmActive && viewType === 'refcodes' && (
          <div className="space-y-4 mt-3">
            <div>
              <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Hash className="w-5 h-5" />
                Movimientos por Código de Referencia
              </h3>
              <div className="space-y-2">
                {refCodeQuadAnalysis.length === 0 ? (
                  <div className="text-center py-8">
                    <Hash className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-500 dark:text-gray-400">No hay datos disponibles</p>
                  </div>
                ) : (
                  refCodeQuadAnalysis.map((rc, idx) => (
                    <ProjectQuadRow key={`refcode-${idx}`} project={rc} />
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
