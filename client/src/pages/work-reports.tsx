import { useState, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFeatureCheck } from '@/hooks/use-feature-check';
import { usePageTitle } from '@/hooks/use-page-title';
import { FeatureRestrictedPage } from '@/components/feature-restricted-page';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ClipboardList, 
  Plus, 
  Clock, 
  MapPin,
  Calendar,
  Edit,
  Trash2,
  Search,
  Filter,
  User,
  FileText,
  CheckCircle,
  ArrowLeft,
  PenTool,
  RotateCcw,
  Send
} from 'lucide-react';
import { Link } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { DatePickerDay } from '@/components/ui/date-picker';

interface WorkReport {
  id: number;
  companyId: number;
  employeeId: number;
  reportDate: string;
  location: string;
  locationCoords?: string | null;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  description: string;
  clientName?: string | null;
  notes?: string | null;
  signedBy?: string | null;
  signatureImage?: string | null;
  status: 'draft' | 'submitted';
  createdAt: string;
  updatedAt: string;
}

const STATUS_STYLES = {
  draft: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-200 dark:border-yellow-800', text: 'text-yellow-700 dark:text-yellow-300', label: 'Borrador' },
  submitted: { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800', text: 'text-green-700 dark:text-green-300', label: 'Enviado' }
};

export default function WorkReportsPage() {
  usePageTitle('Partes de Trabajo');
  const { user, company, isAuthenticated, isLoading: authLoading, subscription } = useAuth();
  const { hasAccess } = useFeatureCheck();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSignatureDialogOpen, setIsSignatureDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<WorkReport | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('this-month');
  const [isDrawing, setIsDrawing] = useState(false);
  const [isClientSignatureModalOpen, setIsClientSignatureModalOpen] = useState(false);
  const [clientSignatureData, setClientSignatureData] = useState<string>('');
  const [clientSignedBy, setClientSignedBy] = useState('');
  const [isClientDrawing, setIsClientDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clientCanvasRef = useRef<HTMLCanvasElement>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const lastClientPointRef = useRef<{ x: number; y: number } | null>(null);

  const [formData, setFormData] = useState({
    reportDate: format(new Date(), 'yyyy-MM-dd'),
    location: '',
    startTime: '09:00',
    endTime: '17:00',
    description: '',
    clientName: '',
    notes: '',
    signedBy: '',
    status: 'draft' as 'draft' | 'submitted'
  });

  const getDateRange = () => {
    const today = new Date();
    switch (dateFilter) {
      case 'today':
        const todayStr = format(today, 'yyyy-MM-dd');
        return { startDate: todayStr, endDate: todayStr };
      case 'this-week':
        return { 
          startDate: format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
          endDate: format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        };
      case 'this-month':
        return { 
          startDate: format(startOfMonth(today), 'yyyy-MM-dd'),
          endDate: format(endOfMonth(today), 'yyyy-MM-dd')
        };
      case 'all':
      default:
        return {};
    }
  };

  const { startDate, endDate } = getDateRange();

  const queryParams = startDate || endDate 
    ? `?${new URLSearchParams({ ...(startDate && { startDate }), ...(endDate && { endDate }) }).toString()}`
    : '';
  
  const { data: reports = [], isLoading: reportsLoading } = useQuery<WorkReport[]>({
    queryKey: [`/api/work-reports${queryParams}`],
    enabled: isAuthenticated && !authLoading
  });

  const { data: allReports = [] } = useQuery<WorkReport[]>({
    queryKey: ['/api/work-reports'],
    enabled: isAuthenticated && !authLoading
  });

  const { uniqueLocations, uniqueClients } = useMemo(() => {
    const locations = new Set<string>();
    const clients = new Set<string>();
    allReports.forEach(report => {
      if (report.location) locations.add(report.location);
      if (report.clientName) clients.add(report.clientName);
    });
    return {
      uniqueLocations: Array.from(locations).sort(),
      uniqueClients: Array.from(clients).sort()
    };
  }, [allReports]);

  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);

  const filteredLocationSuggestions = useMemo(() => {
    if (!formData.location) return uniqueLocations.slice(0, 5);
    return uniqueLocations
      .filter(loc => loc.toLowerCase().includes(formData.location.toLowerCase()))
      .slice(0, 5);
  }, [formData.location, uniqueLocations]);

  const filteredClientSuggestions = useMemo(() => {
    if (!formData.clientName) return uniqueClients.slice(0, 5);
    return uniqueClients
      .filter(client => client.toLowerCase().includes(formData.clientName.toLowerCase()))
      .slice(0, 5);
  }, [formData.clientName, uniqueClients]);

  const filteredReports = useMemo(() => {
    return reports.filter(report => {
      const matchesSearch = searchTerm === '' || 
        report.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (report.clientName && report.clientName.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesSearch;
    });
  }, [reports, searchTerm]);

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData & { signatureImage?: string }) => {
      return apiRequest('POST', '/api/work-reports', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => (query.queryKey[0] as string).startsWith('/api/work-reports') });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({ title: 'Parte creado', description: 'El parte de trabajo se ha creado correctamente.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'No se pudo crear el parte.', variant: 'destructive' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData & { signatureImage?: string } }) => {
      return apiRequest('PATCH', `/api/work-reports/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => (query.queryKey[0] as string).startsWith('/api/work-reports') });
      setIsEditDialogOpen(false);
      setSelectedReport(null);
      resetForm();
      toast({ title: 'Parte actualizado', description: 'El parte de trabajo se ha actualizado correctamente.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'No se pudo actualizar el parte.', variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/work-reports/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => (query.queryKey[0] as string).startsWith('/api/work-reports') });
      setIsDeleteDialogOpen(false);
      setSelectedReport(null);
      toast({ title: 'Parte eliminado', description: 'El parte de trabajo se ha eliminado correctamente.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'No se pudo eliminar el parte.', variant: 'destructive' });
    }
  });

  const { data: signatureData } = useQuery<{ signatureUrl: string | null }>({
    queryKey: ['/api/work-reports/signature'],
    enabled: isAuthenticated && !authLoading
  });

  const signatureMutation = useMutation({
    mutationFn: async (signatureData: string) => {
      return apiRequest('POST', '/api/work-reports/signature', { signatureData });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/work-reports/signature'] });
      setIsSignatureDialogOpen(false);
      toast({ title: 'Firma guardada', description: 'Tu firma se ha guardado y se aplicará a todos tus partes de trabajo.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'No se pudo guardar la firma.', variant: 'destructive' });
    }
  });

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    lastPointRef.current = null;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    lastPointRef.current = null;
  };

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    const { x, y } = getCoordinates(e, canvas);
    lastPointRef.current = { x, y };
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoordinates(e, canvas);
    
    if (lastPointRef.current) {
      const midX = (lastPointRef.current.x + x) / 2;
      const midY = (lastPointRef.current.y + y) / 2;
      ctx.quadraticCurveTo(lastPointRef.current.x, lastPointRef.current.y, midX, midY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(midX, midY);
    }
    
    lastPointRef.current = { x, y };
  };

  const stopDrawing = () => {
    if (isDrawing && lastPointRef.current) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.lineTo(lastPointRef.current.x, lastPointRef.current.y);
          ctx.stroke();
        }
      }
    }
    setIsDrawing(false);
    lastPointRef.current = null;
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    signatureMutation.mutate(dataUrl);
  };

  const handleCreateClick = () => {
    if (!signatureData?.signatureUrl) {
      setIsSignatureDialogOpen(true);
    } else {
      setIsCreateDialogOpen(true);
    }
  };

  useEffect(() => {
    if (isSignatureDialogOpen) {
      setTimeout(initCanvas, 100);
    }
  }, [isSignatureDialogOpen]);

  const resetForm = () => {
    setFormData({
      reportDate: format(new Date(), 'yyyy-MM-dd'),
      location: '',
      startTime: '09:00',
      endTime: '17:00',
      description: '',
      clientName: '',
      notes: '',
      signedBy: '',
      status: 'draft'
    });
    setClientSignatureData('');
    setClientSignedBy('');
  };

  const initClientCanvas = () => {
    const canvas = clientCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    lastClientPointRef.current = null;
  };

  const clearClientCanvas = () => {
    const canvas = clientCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    lastClientPointRef.current = null;
  };

  const getClientCoordinates = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startClientDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = clientCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsClientDrawing(true);
    const { x, y } = getClientCoordinates(e, canvas);
    lastClientPointRef.current = { x, y };
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const drawClient = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isClientDrawing) return;
    e.preventDefault();
    const canvas = clientCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getClientCoordinates(e, canvas);
    
    if (lastClientPointRef.current) {
      const midX = (lastClientPointRef.current.x + x) / 2;
      const midY = (lastClientPointRef.current.y + y) / 2;
      ctx.quadraticCurveTo(lastClientPointRef.current.x, lastClientPointRef.current.y, midX, midY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(midX, midY);
    }
    
    lastClientPointRef.current = { x, y };
  };

  const stopClientDrawing = () => {
    if (isClientDrawing && lastClientPointRef.current) {
      const canvas = clientCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.lineTo(lastClientPointRef.current.x, lastClientPointRef.current.y);
          ctx.stroke();
        }
      }
    }
    setIsClientDrawing(false);
    lastClientPointRef.current = null;
  };

  const saveClientSignature = () => {
    const canvas = clientCanvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      setClientSignatureData(dataUrl);
      setFormData(prev => ({ ...prev, signedBy: clientSignedBy }));
    }
    setIsClientSignatureModalOpen(false);
  };

  const openClientSignatureModal = () => {
    setIsClientSignatureModalOpen(true);
  };

  useEffect(() => {
    if (isClientSignatureModalOpen) {
      setTimeout(initClientCanvas, 100);
    }
  }, [isClientSignatureModalOpen]);

  const openEditDialog = (report: WorkReport) => {
    setSelectedReport(report);
    setFormData({
      reportDate: report.reportDate,
      location: report.location,
      startTime: report.startTime,
      endTime: report.endTime,
      description: report.description,
      clientName: report.clientName || '',
      notes: report.notes || '',
      signedBy: report.signedBy || '',
      status: report.status
    });
    setClientSignatureData(report.signatureImage || '');
    setClientSignedBy(report.signedBy || '');
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (report: WorkReport) => {
    setSelectedReport(report);
    setIsDeleteDialogOpen(true);
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}min`;
  };

  const totalMinutes = filteredReports.reduce((sum, r) => sum + r.durationMinutes, 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const isPro = subscription?.plan === 'pro' || subscription?.plan === 'master';
  if (!isPro) {
    return (
      <FeatureRestrictedPage 
        featureName="Partes de Trabajo" 
        description="Registra y gestiona los partes de trabajo de tus empleados con esta funcionalidad exclusiva del plan Pro." 
        requiredPlan="Pro" 
      />
    );
  }

  const companyAlias = company?.companyAlias || 'test';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-employee-gradient text-gray-900 dark:text-white flex flex-col page-scroll">
      {/* Header - Standard employee pattern */}
      <div className="flex items-center justify-between p-6 pb-8 h-20">
        <Link href={`/${companyAlias}/inicio`}>
          <Button
            variant="ghost"
            size="lg"
            className="text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-white/20 px-6 py-3 rounded-xl bg-gray-100 dark:bg-white/10 backdrop-blur-sm transition-all duration-200 border border-gray-300 dark:border-white/20"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            <span className="font-medium">Atrás</span>
          </Button>
        </Link>
        
        <div className="flex-1 flex flex-col items-end text-right">
          {company?.logoUrl && hasAccess('logoUpload') ? (
            <img 
              src={company.logoUrl} 
              alt={company.name} 
              className="h-8 w-auto mb-1 object-contain filter dark:brightness-0 dark:invert"
            />
          ) : (
            <div className="text-gray-900 dark:text-white text-sm font-medium mb-1">
              {company?.name || 'Mi Empresa'}
            </div>
          )}
          <div className="text-gray-600 dark:text-white/70 text-xs">
            {user?.fullName}
          </div>
        </div>
      </div>

      {/* Page title */}
      <div className="px-6 pb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Partes de Trabajo</h1>
        <p className="text-gray-600 dark:text-white/70 text-sm">Registra y gestiona tus partes de trabajo diarios</p>
      </div>

      {/* Signature Dialog */}
      <Dialog open={isSignatureDialogOpen} onOpenChange={setIsSignatureDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenTool className="w-5 h-5" />
              Dibuja tu firma
            </DialogTitle>
            <DialogDescription>
              Tu firma se guardará y se aplicará automáticamente a todos tus partes de trabajo.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-white">
              <canvas
                ref={canvasRef}
                width={1400}
                height={600}
                className="w-full block touch-none cursor-crosshair"
                style={{ aspectRatio: '7/3' }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
              Dibuja tu firma con el dedo o ratón
            </p>
          </div>
          <DialogFooter className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={clearCanvas} className="w-full">
              <RotateCcw className="w-4 h-4 mr-2" />
              Limpiar
            </Button>
            <Button onClick={saveSignature} disabled={signatureMutation.isPending} className="w-full">
              {signatureMutation.isPending ? 'Guardando...' : 'Guardar Firma'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Report Button */}
      <div className="px-6 pb-4 flex items-center gap-3">
        <Button 
          onClick={() => { resetForm(); handleCreateClick(); }} 
          className="bg-gray-200 dark:bg-white/20 hover:bg-gray-300 dark:hover:bg-white/30 text-gray-900 dark:text-white border-gray-200 dark:border-white/20"
          data-testid="button-new-report"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Parte
        </Button>
        {signatureData?.signatureUrl && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSignatureDialogOpen(true)}
            className="text-gray-600 dark:text-gray-300"
          >
            <PenTool className="w-4 h-4 mr-2" />
            Cambiar firma
          </Button>
        )}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-blue-600" />
                Nuevo Parte de Trabajo
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Cuándo y dónde
                </h4>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-sm">Fecha del trabajo</Label>
                    <DatePickerDay
                      date={formData.reportDate ? parseISO(formData.reportDate) : new Date()}
                      onDateChange={(date) => setFormData({ ...formData, reportDate: date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd') })}
                      className="w-full justify-start bg-white dark:bg-gray-800"
                      placeholder="Seleccionar fecha"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-sm flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Hora inicio
                      </Label>
                      <Input
                        type="time"
                        value={formData.startTime}
                        onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                        className="bg-white dark:bg-gray-800"
                        data-testid="input-start-time"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Hora fin
                      </Label>
                      <Input
                        type="time"
                        value={formData.endTime}
                        onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                        className="bg-white dark:bg-gray-800"
                        data-testid="input-end-time"
                      />
                    </div>
                  </div>
                  <div className="space-y-2 relative">
                    <Label className="text-sm flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      Ubicación
                    </Label>
                    <Input
                      placeholder="Ej: Calle Mayor 15, Madrid"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      onFocus={() => setShowLocationSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowLocationSuggestions(false), 200)}
                      className="bg-white dark:bg-gray-800"
                      data-testid="input-location"
                    />
                    {showLocationSuggestions && filteredLocationSuggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-40 overflow-y-auto">
                        {filteredLocationSuggestions.map((loc, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                            onMouseDown={() => {
                              setFormData({ ...formData, location: loc });
                              setShowLocationSuggestions(false);
                            }}
                          >
                            <MapPin className="w-3 h-3 text-gray-400" />
                            {loc}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Detalles del trabajo
                </h4>
                <div className="space-y-3">
                  <div className="space-y-2 relative">
                    <Label className="text-sm flex items-center gap-1">
                      <User className="w-3 h-3" />
                      Cliente <span className="text-gray-400 text-xs">(opcional)</span>
                    </Label>
                    <Input
                      placeholder="Nombre del cliente"
                      value={formData.clientName}
                      onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                      onFocus={() => setShowClientSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowClientSuggestions(false), 200)}
                      className="bg-white dark:bg-gray-800"
                      data-testid="input-client-name"
                    />
                    {showClientSuggestions && filteredClientSuggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-40 overflow-y-auto">
                        {filteredClientSuggestions.map((client, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                            onMouseDown={() => {
                              setFormData({ ...formData, clientName: client });
                              setShowClientSuggestions(false);
                            }}
                          >
                            <User className="w-3 h-3 text-gray-400" />
                            {client}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">¿Qué trabajo realizaste?</Label>
                    <Textarea
                      placeholder="Describe las tareas completadas..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="bg-white dark:bg-gray-800"
                      data-testid="textarea-description"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Notas adicionales <span className="text-gray-400 text-xs">(opcional)</span></Label>
                    <Textarea
                      placeholder="Observaciones, incidencias..."
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={2}
                      className="bg-white dark:bg-gray-800"
                      data-testid="textarea-notes"
                    />
                  </div>
                  {clientSignatureData ? (
                    <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
                      <img src={clientSignatureData} alt="Firma del cliente" className="h-12 max-w-[120px] object-contain" />
                      <div className="flex-1">
                        <p className="text-sm text-gray-600 dark:text-gray-300">Firmado por: <strong>{formData.signedBy}</strong></p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => { setClientSignedBy(formData.signedBy); openClientSignatureModal(); }}
                        className="text-amber-700 border-amber-300"
                      >
                        Cambiar
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => { setClientSignedBy(''); openClientSignatureModal(); }}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                      data-testid="button-add-client-signature"
                    >
                      <PenTool className="w-4 h-4 mr-2" />
                      Añadir firma del cliente (opcional)
                    </Button>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter className="grid grid-cols-3 gap-3">
              <Button 
                onClick={() => setIsCreateDialogOpen(false)} 
                data-testid="button-cancel-create" 
                className="w-full bg-red-600 hover:bg-red-700 text-white"
              >
                Cancelar
              </Button>
              <Button 
                onClick={() => createMutation.mutate({ ...formData, status: 'draft', signatureImage: clientSignatureData || undefined })}
                disabled={createMutation.isPending || !formData.location || !formData.description}
                data-testid="button-save-draft"
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              >
                {createMutation.isPending ? 'Guardando...' : 'Guardar borrador'}
              </Button>
              <Button 
                onClick={() => createMutation.mutate({ ...formData, status: 'submitted', signatureImage: clientSignatureData || undefined })}
                disabled={createMutation.isPending || !formData.location || !formData.description}
                data-testid="button-submit-create"
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                {createMutation.isPending ? 'Enviando...' : 'Enviar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Reports List */}
      <div className="px-6 flex-1 pb-6">
      {reportsLoading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <LoadingSpinner size="lg" />
          <p className="text-gray-500 dark:text-gray-400">Cargando partes de trabajo...</p>
        </div>
      ) : reports.length === 0 ? (
        <Card className="bg-white dark:bg-white/10 border-gray-200 dark:border-white/20">
          <CardContent className="py-12 text-center">
            <ClipboardList className="w-12 h-12 mx-auto text-gray-300 dark:text-white/30 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Sin partes de trabajo
            </h3>
            <p className="text-gray-500 dark:text-white/60">
              Crea tu primer parte de trabajo para empezar a registrar tus visitas
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredReports.map((report) => {
            const statusStyle = STATUS_STYLES[report.status];
            return (
              <Card 
                key={report.id} 
                className={`bg-white dark:bg-gray-800 border ${statusStyle.border} hover:shadow-md transition-shadow`}
                data-testid={`card-report-${report.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <Badge className={`${statusStyle.bg} ${statusStyle.text} border-0`}>
                          {statusStyle.label}
                        </Badge>
                        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                          <Calendar className="w-4 h-4 mr-1" />
                          {format(parseISO(report.reportDate), 'EEEE, d MMMM yyyy', { locale: es })}
                        </div>
                        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                          <Clock className="w-4 h-4 mr-1" />
                          {report.startTime} - {report.endTime} ({formatDuration(report.durationMinutes)})
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 mt-1 text-gray-400 flex-shrink-0" />
                        <span className="font-medium text-gray-900 dark:text-white">{report.location}</span>
                      </div>

                      {report.clientName && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                          <User className="w-4 h-4 text-gray-400" />
                          Cliente: {report.clientName}
                        </div>
                      )}

                      <div className="flex items-start gap-2">
                        <FileText className="w-4 h-4 mt-1 text-gray-400 flex-shrink-0" />
                        <p className="text-gray-700 dark:text-gray-300">{report.description}</p>
                      </div>

                      {report.notes && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 italic pl-6">
                          Notas: {report.notes}
                        </p>
                      )}

                      {(report.signedBy || report.signatureImage) && (
                        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                          <PenTool className="w-4 h-4 text-amber-500" />
                          {report.signedBy && (
                            <span className="text-sm text-gray-600 dark:text-gray-300">
                              Firmado por: <strong>{report.signedBy}</strong>
                            </span>
                          )}
                          {report.signatureImage && (
                            <img 
                              src={report.signatureImage} 
                              alt="Firma"
                              className="h-8 max-w-[100px] object-contain"
                            />
                          )}
                        </div>
                      )}

                    </div>

                    <div className="flex gap-2 md:flex-shrink-0 justify-end">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => openEditDialog(report)}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        data-testid={`button-edit-${report.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => openDeleteDialog(report)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        data-testid={`button-delete-${report.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      {report.status === 'draft' && (
                        <Button 
                          size="sm" 
                          onClick={() => updateMutation.mutate({ id: report.id, data: { status: 'submitted' } })}
                          disabled={updateMutation.isPending}
                          className="bg-green-600 hover:bg-green-700 text-white"
                          data-testid={`button-submit-${report.id}`}
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-blue-600" />
              Editar Parte de Trabajo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Cuándo y dónde
              </h4>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-sm">Fecha del trabajo</Label>
                  <DatePickerDay
                    date={formData.reportDate ? parseISO(formData.reportDate) : new Date()}
                    onDateChange={(date) => setFormData({ ...formData, reportDate: date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd') })}
                    className="w-full justify-start bg-white dark:bg-gray-800"
                    placeholder="Seleccionar fecha"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-sm flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Hora inicio
                    </Label>
                    <Input
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="bg-white dark:bg-gray-800"
                      data-testid="input-edit-start-time"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Hora fin
                    </Label>
                    <Input
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      className="bg-white dark:bg-gray-800"
                      data-testid="input-edit-end-time"
                    />
                  </div>
                </div>
                <div className="space-y-2 relative">
                  <Label className="text-sm flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    Ubicación
                  </Label>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    onFocus={() => setShowLocationSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowLocationSuggestions(false), 200)}
                    className="bg-white dark:bg-gray-800"
                    data-testid="input-edit-location"
                  />
                  {showLocationSuggestions && filteredLocationSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-40 overflow-y-auto">
                      {filteredLocationSuggestions.map((loc, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                          onMouseDown={() => {
                            setFormData({ ...formData, location: loc });
                            setShowLocationSuggestions(false);
                          }}
                        >
                          <MapPin className="w-3 h-3 text-gray-400" />
                          {loc}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Detalles del trabajo
              </h4>
              <div className="space-y-3">
                <div className="space-y-2 relative">
                  <Label className="text-sm">Cliente <span className="text-gray-400 text-xs">(opcional)</span></Label>
                  <Input
                    value={formData.clientName}
                    onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                    onFocus={() => setShowClientSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowClientSuggestions(false), 200)}
                    className="bg-white dark:bg-gray-800"
                    data-testid="input-edit-client-name"
                  />
                  {showClientSuggestions && filteredClientSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-40 overflow-y-auto">
                      {filteredClientSuggestions.map((client, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                          onMouseDown={() => {
                            setFormData({ ...formData, clientName: client });
                            setShowClientSuggestions(false);
                          }}
                        >
                          <User className="w-3 h-3 text-gray-400" />
                          {client}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Descripción del trabajo</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="bg-white dark:bg-gray-800"
                    data-testid="textarea-edit-description"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Notas adicionales</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                    className="bg-white dark:bg-gray-800"
                    data-testid="textarea-edit-notes"
                  />
                </div>
                {clientSignatureData ? (
                  <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
                    <img src={clientSignatureData} alt="Firma del cliente" className="h-12 max-w-[120px] object-contain" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-600 dark:text-gray-300">Firmado por: <strong>{formData.signedBy}</strong></p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => { setClientSignedBy(formData.signedBy); openClientSignatureModal(); }}
                      className="text-amber-700 border-amber-300"
                    >
                      Cambiar
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    onClick={() => { setClientSignedBy(''); openClientSignatureModal(); }}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    data-testid="button-edit-add-client-signature"
                  >
                    <PenTool className="w-4 h-4 mr-2" />
                    Añadir firma del cliente (opcional)
                  </Button>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className={`grid gap-3 ${selectedReport?.status === 'draft' ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <Button 
              onClick={() => setIsEditDialogOpen(false)} 
              data-testid="button-cancel-edit" 
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              Cancelar
            </Button>
            {selectedReport?.status === 'draft' ? (
              <>
                <Button
                  onClick={() => selectedReport && updateMutation.mutate({ 
                    id: selectedReport.id, 
                    data: { ...formData, status: 'draft', signatureImage: clientSignatureData || undefined } 
                  })}
                  disabled={updateMutation.isPending || !formData.location || !formData.description}
                  data-testid="button-save-draft-edit"
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                >
                  {updateMutation.isPending ? 'Guardando...' : 'Guardar borrador'}
                </Button>
                <Button
                  onClick={() => selectedReport && updateMutation.mutate({ 
                    id: selectedReport.id, 
                    data: { ...formData, status: 'submitted', signatureImage: clientSignatureData || undefined } 
                  })}
                  disabled={updateMutation.isPending || !formData.location || !formData.description}
                  data-testid="button-submit-edit"
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  {updateMutation.isPending ? 'Enviando...' : 'Enviar'}
                </Button>
              </>
            ) : (
              <Button
                onClick={() => selectedReport && updateMutation.mutate({ 
                  id: selectedReport.id, 
                  data: { ...formData, signatureImage: clientSignatureData || undefined } 
                })}
                disabled={updateMutation.isPending || !formData.location || !formData.description}
                data-testid="button-submit-edit"
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                {updateMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Parte</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que quieres eliminar este parte de trabajo? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} data-testid="button-cancel-delete" className="w-full">
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              onClick={() => selectedReport && deleteMutation.mutate(selectedReport.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
              className="w-full"
            >
              {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isClientSignatureModalOpen} onOpenChange={setIsClientSignatureModalOpen}>
        <DialogContent className="fixed inset-0 w-screen h-screen max-w-none max-h-none translate-x-0 translate-y-0 top-0 left-0 p-0 rounded-none bg-white dark:bg-gray-900 flex flex-col border-0">
          <DialogHeader className="flex flex-row items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-amber-50 dark:bg-amber-900/30 space-y-0">
            <DialogTitle className="text-xl font-semibold text-amber-900 dark:text-amber-100 flex items-center gap-2">
              <PenTool className="w-6 h-6" />
              Firma del Cliente
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsClientSignatureModalOpen(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              Cancelar
            </Button>
          </DialogHeader>

          <div className="flex-1 flex flex-col p-6 gap-6 overflow-auto">
            <div className="space-y-2">
              <Label className="text-lg font-medium text-gray-700 dark:text-gray-200">Nombre del firmante</Label>
              <Input
                placeholder="Escriba su nombre completo"
                value={clientSignedBy}
                onChange={(e) => setClientSignedBy(e.target.value)}
                className="text-xl py-4 px-4 h-14 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600"
                data-testid="input-client-signed-by"
                autoFocus
              />
            </div>

            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-lg font-medium text-gray-700 dark:text-gray-200">Firme aquí</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearClientCanvas}
                  className="text-gray-500"
                >
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Limpiar
                </Button>
              </div>
              <div className="flex-1 border-2 border-dashed border-amber-400 dark:border-amber-600 rounded-xl bg-white overflow-hidden min-h-[200px]">
                <canvas
                  ref={clientCanvasRef}
                  width={1600}
                  height={800}
                  className="w-full h-full touch-none cursor-crosshair"
                  style={{ touchAction: 'none', aspectRatio: '2/1' }}
                  onMouseDown={startClientDrawing}
                  onMouseMove={drawClient}
                  onMouseUp={stopClientDrawing}
                  onMouseLeave={stopClientDrawing}
                  onTouchStart={startClientDrawing}
                  onTouchMove={drawClient}
                  onTouchEnd={stopClientDrawing}
                />
              </div>
              <p className="text-center text-gray-400 dark:text-gray-500 text-sm mt-2">
                Dibuje su firma con el dedo o ratón
              </p>
            </div>
          </div>

          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <Button
              onClick={saveClientSignature}
              disabled={!clientSignedBy.trim()}
              className="w-full h-14 text-lg bg-amber-600 hover:bg-amber-700 text-white"
              data-testid="button-save-client-signature"
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              Confirmar Firma
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
