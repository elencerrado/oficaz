import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import StatsCard from '@/components/StatsCard';
import { 
  Building2, 
  Settings, 
  User, 
  MapPin, 
  Mail, 
  Phone, 
  Hash, 
  Globe, 
  Calendar,
  Crown,
  CreditCard,
  FileText,
  Upload,
  Download,
  Users,
  Clock,
  Shield,
  Camera,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info
} from 'lucide-react';
import { CreditCard as CreditCardIcon, Crown as CrownIcon, AlertCircle, CheckCircle as CheckCircleIcon, Lightbulb, Info as InfoIcon } from 'lucide-react';
import TabNavigation from '@/components/TabNavigation';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface Company {
  id: number;
  name: string;
  cif: string;
  email: string;
  contactName: string;
  companyAlias: string;
  phone?: string;
  address?: string;
  province?: string;
  logoUrl?: string;
}

interface Subscription {
  plan: string;
  end_date: string;
  status: string;
}

interface UsageData {
  current: {
    active_employees: number;
    monthly_sessions: number;
    monthly_messages: number;
    documents_uploaded: number;
  };
}

interface AccountInfo {
  account_id: string;
  registration_date: string;
  billing_email: string;
  tax_id: string;
  billing_address: string;
  billing_city: string;
  billing_postal_code: string;
}

interface PaymentMethod {
  id: string;
  type: string;
  last_four: string;
  expiry: string;
}

interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: string;
  description: string;
}

const spanishProvinces = [
  'Álava', 'Albacete', 'Alicante', 'Almería', 'Asturias', 'Ávila', 'Badajoz', 'Barcelona',
  'Burgos', 'Cáceres', 'Cádiz', 'Cantabria', 'Castellón', 'Ciudad Real', 'Córdoba',
  'A Coruña', 'Cuenca', 'Girona', 'Granada', 'Guadalajara', 'Gipuzkoa', 'Huelva',
  'Huesca', 'Islas Baleares', 'Jaén', 'León', 'Lleida', 'Lugo', 'Madrid', 'Málaga',
  'Murcia', 'Navarra', 'Ourense', 'Palencia', 'Las Palmas', 'Pontevedra', 'La Rioja',
  'Salamanca', 'Segovia', 'Sevilla', 'Soria', 'Tarragona', 'Santa Cruz de Tenerife',
  'Teruel', 'Toledo', 'Valencia', 'Valladolid', 'Bizkaia', 'Zamora', 'Zaragoza'
];

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('company');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Datos de suscripción
  const { data: subscription = {} } = useQuery({
    queryKey: ['/api/account/subscription'],
    staleTime: 5 * 60 * 1000,
  });

  // Datos de uso
  const { data: usageData = {} } = useQuery({
    queryKey: ['/api/account/usage-stats'],
    staleTime: 60 * 1000,
  });

  // Standard employee header pattern
  return (
    <div className="px-6 py-4 min-h-screen bg-gray-50" style={{ overflowX: 'clip' }}>
      {/* Page title */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Configuración</h1>
        <p className="text-gray-500 mt-1">Gestiona la configuración de tu empresa</p>
      </div>

      <TabNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabs={[
          { id: 'company', label: 'Empresa', icon: Building2 },
          { id: 'account', label: 'Mi Cuenta', icon: User },
          { id: 'policies', label: 'Políticas', icon: Shield }
        ]}
      />

      {activeTab === 'account' && (
        <div className="space-y-6">
          {/* Subscription Status - Using exact glassmorphism from employee-time-tracking */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6">
            <div className="mb-6">
              <h3 className="flex items-center space-x-2 text-lg font-semibold text-gray-900">
                <Crown className="h-5 w-5" />
                <span>Estado de suscripción</span>
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Plan: {subscription.plan || 'Cargando...'} - Activo hasta{' '}
                {subscription.end_date ? new Date(subscription.end_date).toLocaleDateString('es-ES') : 'Cargando...'}
              </p>
            </div>
            
            {subscription.status && (
              <div className="mb-4">
                <Badge variant={subscription.status === 'active' ? 'default' : 'secondary'}>
                  {subscription.status === 'active' ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
            )}

            {usageData.current && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <StatsCard
                  title="Empleados"
                  subtitle="Activos"
                  value={usageData.current.active_employees}
                  color="blue"
                  icon={Users}
                />
                <StatsCard
                  title="Fichajes"
                  subtitle="Este mes"
                  value={usageData.current.monthly_sessions}
                  color="green"
                  icon={Clock}
                />
                <StatsCard
                  title="Mensajes"
                  subtitle="Este mes"
                  value={usageData.current.monthly_messages}
                  color="purple"
                  icon={Mail}
                />
                <StatsCard
                  title="Documentos"
                  subtitle="Subidos"
                  value={usageData.current.documents_uploaded}
                  color="orange"
                  icon={Upload}
                />
              </div>
            )}
          </div>

          {/* More account sections would go here */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6">
            <div className="mb-6">
              <h3 className="flex items-center space-x-2 text-lg font-semibold text-gray-900">
                <Calendar className="h-5 w-5" />
                <span>Información de registro</span>
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Detalles de la cuenta y registro en Oficaz
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-gray-600">ID de cuenta</Label>
                <p className="font-mono text-gray-900">Cargando...</p>
              </div>
              <div>
                <Label className="text-gray-600">Fecha de registro</Label>
                <p className="text-gray-900">Cargando...</p>
              </div>
              <div>
                <Label className="text-gray-600">Email de facturación</Label>
                <p className="text-gray-900">Cargando...</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'company' && (
        <div className="space-y-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Información de la empresa</h3>
              <p className="text-sm text-gray-500 mt-1">
                Datos básicos de tu empresa
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="name">Nombre de la empresa</Label>
                <Input
                  id="name"
                  placeholder="Nombre de la empresa"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="cif">CIF</Label>
                <Input
                  id="cif"
                  placeholder="CIF de la empresa"
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'policies' && (
        <div className="space-y-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Políticas de empresa</h3>
              <p className="text-sm text-gray-500 mt-1">
                Configura las políticas y reglas de tu empresa
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <Label>Política de edición de horas</Label>
                <Select defaultValue="no">
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No permitir</SelectItem>
                    <SelectItem value="yes">Permitir</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}