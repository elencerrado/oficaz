import { useState, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFeaturePreview } from '@/hooks/use-feature-preview';
import { PageWrapper } from '@/components/ui/page-wrapper';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import StatsCard from '@/components/StatsCard';
import { TabNavigation } from '@/components/ui/tab-navigation';
import {
  Upload,
  Search,
  FileText,
  Download,
  Eye,
  Users,
  Send,
  X,
  DollarSign,
  FileCheck,
  User,
  Calendar,
  File,
  Heart,
  Plane,
  Check,
  AlertTriangle,
  Trash2,
  List,
  Grid3X3,
  Folder,
  FolderOpen
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Employee {
  id: number;
  fullName: string;
  email: string;
  role: string;
}

interface Document {
  id: number;
  userId: number;
  fileName: string;
  originalName: string;
  fileSize: number;
  createdAt: string;
  user?: {
    fullName: string;
  };
}

const documentTypes = [
  { 
    id: 'dni', 
    name: 'DNI', 
    icon: User,
    keywords: ['dni', 'documento', 'identidad', 'cedula', 'id']
  },
  { 
    id: 'justificante', 
    name: 'Justificante', 
    icon: FileCheck,
    keywords: ['justificante', 'certificado', 'comprobante', 'vacaciones', 'vacation', 'holiday', 'permiso', 'baja', 'medico']
  },
  { 
    id: 'otros', 
    name: 'Otros', 
    icon: File,
    keywords: ['nomina', 'nómina', 'contrato', 'irpf', 'hacienda', 'impuesto', 'declaracion', 'renta', 'tributacion', 'fiscal', 'formulario', 'modelo', 'aeat']
  }
];

// Datos de demostración para preview
const demoDocuments = [
  {
    id: 'demo-1',
    filename: 'Contrato_Empleado_2025.pdf',
    originalName: 'Contrato de Trabajo - Juan Pérez.pdf',
    fileSize: 245678,
    uploadedBy: 'Administrador',
    createdAt: '2025-06-24T10:00:00Z',
    category: 'contratos'
  },
  {
    id: 'demo-2',
    filename: 'Manual_Empresa.pdf',
    originalName: 'Manual del Empleado.pdf',
    fileSize: 1234567,
    uploadedBy: 'Recursos Humanos',
    createdAt: '2025-06-23T14:30:00Z',
    category: 'manuales'
  },
  {
    id: 'demo-3',
    filename: 'Politica_Vacaciones.docx',
    originalName: 'Política de Vacaciones 2025.docx',
    fileSize: 89012,
    uploadedBy: 'Administrador',
    createdAt: '2025-06-22T09:15:00Z',
    category: 'politicas'
  }
];

export default function AdminDocuments() {
  const { user } = useAuth();
  
  const { canAccess, showPreview, PreviewOverlay, data: previewData } = useFeaturePreview({
    feature: 'documents',
    featureName: 'Documentos',
    description: 'Gestión completa de documentos de empresa con carga, organización y control de acceso',
    requiredPlan: 'Pro',
    icon: FileText,
    demoData: demoDocuments
  });
  

  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);
  const [documentType, setDocumentType] = useState('');
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadAnalysis, setUploadAnalysis] = useState<any[]>([]);
  const [showUploadPreview, setShowUploadPreview] = useState(false);
  const [activeTab, setActiveTab] = useState('upload'); // 'upload', 'explorer', 'requests'
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; docId: number | null; docName: string }>({
    show: false,
    docId: null,
    docName: ''
  });
  
  const [deleteRequestConfirm, setDeleteRequestConfirm] = useState<{
    show: boolean;
    requestId: number | null;
    documentType: string;
  }>({ show: false, requestId: null, documentType: '' });

  // Fetch employees
  const { data: employees = [] } = useQuery({
    queryKey: ['/api/employees'],
    enabled: canAccess,
  });

  // Fetch document notifications (sent requests)
  const { data: sentRequests = [] } = useQuery({
    queryKey: ['/api/document-notifications'],
    enabled: canAccess,
    refetchInterval: 3000,
    staleTime: 0,
    gcTime: 0,
  });

  // Fetch documents o usar datos demo
  const { data: fetchedDocuments = [] } = useQuery({
    queryKey: ['/api/documents/all'],
    enabled: !!user && canAccess,
    staleTime: 0,
    gcTime: 0,
  });

  const documents = canAccess ? fetchedDocuments : demoDocuments;

  // Send document notification mutation
  const sendDocumentMutation = useMutation({
    mutationFn: async (data: {
      employeeIds: number[];
      documentType: string;
      message: string;
      dueDate?: string;
    }) => {
      return await apiRequest('POST', '/api/documents/request', data);
    },
    onSuccess: () => {
      // Invalidar y refrescar inmediatamente ambas queries
      queryClient.invalidateQueries({ queryKey: ['/api/document-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/documents/all'] });
      queryClient.refetchQueries({ queryKey: ['/api/documents/all'] });
      
      toast({
        title: 'Solicitud enviada',
        description: 'Se ha enviado la solicitud de documento a los empleados seleccionados',
      });
      setSelectedEmployees([]);
      setDocumentType('');
      setMessage('');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Error al enviar la solicitud',
        variant: 'destructive',
      });
    },
  });

  // Upload document mutation  
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch('/api/documents/upload-admin', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authData') ? JSON.parse(localStorage.getItem('authData')!).token : ''}`,
        },
        body: formData,
      });
      if (!response.ok) throw new Error('Error al subir documento');
      return response.json();
    },
    onSuccess: () => {
      // Forzar actualización inmediata tras subir
      queryClient.invalidateQueries({ queryKey: ['/api/documents/all'] });
      queryClient.refetchQueries({ queryKey: ['/api/documents/all'] });
      
      toast({
        title: 'Documento subido',
        description: 'El documento se ha subido correctamente',
      });
      setIsUploading(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Error al subir el documento',
        variant: 'destructive',
      });
      setIsUploading(false);
    },
  });

  // Delete document mutation
  const deleteMutation = useMutation({
    mutationFn: async (docId: number) => {
      const response = await fetch(`/api/documents/${docId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authData') ? JSON.parse(localStorage.getItem('authData')!).token : ''}`,
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al eliminar documento');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Force refresh the documents list
      queryClient.invalidateQueries({ queryKey: ['/api/documents/all'] });
      queryClient.refetchQueries({ queryKey: ['/api/documents/all'] });
      toast({
        title: 'Documento eliminado',
        description: 'El documento se ha eliminado completamente del sistema',
      });
      setDeleteConfirm({ show: false, docId: null, docName: '' });
    },
    onError: (error: any) => {
      console.error('Delete error:', error);
      toast({
        title: 'Error al eliminar',
        description: error.message || 'No se pudo eliminar el documento',
        variant: 'destructive',
      });
      setDeleteConfirm({ show: false, docId: null, docName: '' });
    },
  });

  // Delete document request mutation
  const deleteRequestMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const response = await fetch(`/api/document-notifications/${requestId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authData') ? JSON.parse(localStorage.getItem('authData')!).token : ''}`,
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al eliminar solicitud');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Force refresh the requests list
      queryClient.invalidateQueries({ queryKey: ['/api/document-notifications'] });
      queryClient.refetchQueries({ queryKey: ['/api/document-notifications'] });
      toast({
        title: 'Solicitud eliminada',
        description: 'La solicitud se ha eliminado correctamente',
      });
    },
    onError: (error: any) => {
      console.error('Delete request error:', error);
      toast({
        title: 'Error al eliminar solicitud',
        description: error.message || 'No se pudo eliminar la solicitud',
        variant: 'destructive',
      });
    },
  });

  // Smart file analysis functions
  const analyzeFileName = (fileName: string) => {
    const normalizedName = fileName.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, ""); // Remove accents
    
    // Find employee by name matching
    const matchedEmployee = employees.find((emp: Employee) => {
      const empName = emp.fullName.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      
      // Split employee name into words
      const nameWords = empName.split(' ');
      
      // Check if at least 2 words from employee name appear in filename
      const matchedWords = nameWords.filter(word => 
        word.length > 2 && normalizedName.includes(word)
      );
      
      return matchedWords.length >= 2;
    });
    
    // Detect document type
    const documentType = documentTypes.find(type => {
      const typeKeywords = type.keywords || [];
      return typeKeywords.some(keyword => 
        normalizedName.includes(keyword.toLowerCase())
      );
    });
    
    return {
      employee: matchedEmployee,
      documentType: documentType?.id || 'otros',
      confidence: matchedEmployee ? (documentType ? 'high' : 'medium') : 'low'
    };
  };

  const generateCleanFileName = (fileName: string, employee: Employee, docType: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase() || 'pdf';
    
    // Get document type name
    const docTypeName = documentTypes.find(type => type.id === docType)?.name || 'Documento';
    
    // Format employee name (capitalize each word)
    const cleanEmployeeName = employee.fullName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    // Extract and format date info if present
    let dateInfo = '';
    
    // Try to find year first
    const yearMatch = fileName.match(/20\d{2}/);
    const currentYear = new Date().getFullYear();
    const year = yearMatch ? yearMatch[0] : currentYear.toString();
    
    // Try to find month
    const monthMatch = fileName.match(/(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2})/i);
    
    if (monthMatch) {
      const monthStr = monthMatch[0].toLowerCase();
      // Convert month to proper Spanish format
      const monthMap: { [key: string]: string } = {
        'enero': 'Enero', 'jan': 'Enero', '01': 'Enero', '1': 'Enero',
        'febrero': 'Febrero', 'feb': 'Febrero', '02': 'Febrero', '2': 'Febrero',
        'marzo': 'Marzo', 'mar': 'Marzo', '03': 'Marzo', '3': 'Marzo',
        'abril': 'Abril', 'apr': 'Abril', '04': 'Abril', '4': 'Abril',
        'mayo': 'Mayo', 'may': 'Mayo', '05': 'Mayo', '5': 'Mayo',
        'junio': 'Junio', 'jun': 'Junio', '06': 'Junio', '6': 'Junio',
        'julio': 'Julio', 'jul': 'Julio', '07': 'Julio', '7': 'Julio',
        'agosto': 'Agosto', 'aug': 'Agosto', '08': 'Agosto', '8': 'Agosto',
        'septiembre': 'Septiembre', 'sep': 'Septiembre', '09': 'Septiembre', '9': 'Septiembre',
        'octubre': 'Octubre', 'oct': 'Octubre', '10': 'Octubre',
        'noviembre': 'Noviembre', 'nov': 'Noviembre', '11': 'Noviembre',
        'diciembre': 'Diciembre', 'dec': 'Diciembre', '12': 'Diciembre'
      };
      
      const cleanMonth = monthMap[monthStr] || monthStr.charAt(0).toUpperCase() + monthStr.slice(1);
      dateInfo = ` ${cleanMonth} ${year}`;
    } else if (yearMatch) {
      dateInfo = ` ${year}`;
    }
    
    // Extract special keywords for "Otros" category (like IRPF, etc.)
    let specialKeyword = '';
    if (docType === 'otros') {
      const normalizedFileName = fileName.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      const specialKeywords = ['irpf', 'hacienda', 'impuesto', 'declaracion', 'renta', 'modelo'];
      const foundKeyword = specialKeywords.find(keyword => 
        normalizedFileName.includes(keyword)
      );
      if (foundKeyword) {
        specialKeyword = ` (${foundKeyword.toUpperCase()})`;
      }
    }
    
    // Format: "Nómina Junio 2025 - Juan José Ramírez Martín.pdf" or "Otros Marzo 2025 (IRPF) - Juan José Ramírez Martín.pdf"
    return `${docTypeName}${dateInfo}${specialKeyword} - ${cleanEmployeeName}.${extension}`;
  };

  const handleFileUpload = async (file: File, targetEmployeeId?: number, cleanFileName?: string) => {
    if (!file) return;
    
    setIsUploading(true);
    const formData = new FormData();
    
    // Don't rename the file here, just send metadata
    formData.append('file', file);
    
    if (targetEmployeeId) {
      formData.append('targetEmployeeId', targetEmployeeId.toString());
    }
    
    // Send the desired clean filename as metadata
    if (cleanFileName) {
      formData.append('cleanFileName', cleanFileName);
    }
    
    uploadMutation.mutate(formData);
  };

  const handleBatchUpload = async () => {
    setIsUploading(true);
    try {
      for (const analysis of uploadAnalysis) {
        if (analysis.employee) {
          const cleanFileName = generateCleanFileName(
            analysis.file.name, 
            analysis.employee, 
            analysis.documentType
          );
          await handleFileUpload(analysis.file, analysis.employee.id, cleanFileName);
        }
      }
      
      // Forzar actualización inmediata tras batch upload
      queryClient.invalidateQueries({ queryKey: ['/api/documents/all'] });
      queryClient.refetchQueries({ queryKey: ['/api/documents/all'] });
      
      toast({
        title: "Documentos procesados",
        description: `${uploadAnalysis.length} documento(s) subido(s) correctamente con nombres corregidos`,
      });
      
      setShowUploadPreview(false);
      setUploadAnalysis([]);
    } catch (error) {
      toast({
        title: "Error en el procesamiento",
        description: "Algunos documentos no se pudieron subir",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const updateAnalysisEmployee = (index: number, employeeId: number) => {
    setUploadAnalysis(prev => prev.map((item, i) => {
      if (i === index) {
        const employee = employees.find(emp => emp.id === employeeId);
        return { 
          ...item, 
          employee,
          // Update suggested clean filename
          suggestedName: employee ? generateCleanFileName(item.file.name, employee, item.documentType) : undefined
        };
      }
      return item;
    }));
  };

  const updateSuggestedName = (index: number, newName: string) => {
    setUploadAnalysis(prev => prev.map((item, i) => 
      i === index ? { ...item, suggestedName: newName } : item
    ));
  };;

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(file => file.size <= 10 * 1024 * 1024);
    const oversizedFiles = files.filter(file => file.size > 10 * 1024 * 1024);
    
    if (oversizedFiles.length > 0) {
      toast({
        title: "Archivos demasiado grandes",
        description: `${oversizedFiles.length} archivo(s) exceden el límite de 10MB`,
        variant: "destructive",
      });
    }
    
    if (validFiles.length === 0) return;
    
    // Analyze all files and show preview
    const analysisResults = validFiles.map(file => {
      const analysis = analyzeFileName(file.name);
      return {
        file,
        ...analysis,
        suggestedName: analysis.employee ? generateCleanFileName(file.name, analysis.employee, analysis.documentType) : undefined
      };
    });
    
    setUploadAnalysis(analysisResults);
    setShowUploadPreview(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const toggleEmployee = (employeeId: number) => {
    setSelectedEmployees(prev =>
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const handleSendRequest = () => {
    if (selectedEmployees.length === 0) {
      toast({
        title: 'Error',
        description: 'Selecciona al menos un empleado',
        variant: 'destructive',
      });
      return;
    }
    if (!documentType) {
      toast({
        title: 'Error',
        description: 'Selecciona el tipo de documento',
        variant: 'destructive',
      });
      return;
    }

    const documentTypeName = documentTypes.find(t => t.id === documentType)?.name || documentType;
    
    sendDocumentMutation.mutate({
      employeeIds: selectedEmployees,
      documentType: documentTypeName,
      message: message || `Por favor, sube tu ${documentTypeName.toLowerCase()}`,
    });
  };

  const filteredDocuments = documents.filter((doc: Document) => {
    const matchesSearch = doc.originalName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.user?.fullName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEmployee = selectedEmployee === 'all' || doc.userId.toString() === selectedEmployee;
    return matchesSearch && matchesEmployee;
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    return FileText; // Simplified for now
  };



  const handleDownload = async (docId: number, fileName: string) => {
    try {
      const token = JSON.parse(localStorage.getItem('authData') || '{}').token;
      const response = await fetch(`/api/documents/${docId}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
      toast({
        title: 'Error al descargar',
        description: 'No se pudo descargar el documento',
        variant: 'destructive',
      });
    }
  };

  const confirmDelete = (docId: number, docName: string) => {
    setDeleteConfirm({ show: true, docId, docName });
  };

  const handleDelete = () => {
    if (deleteConfirm.docId) {
      deleteMutation.mutate(deleteConfirm.docId);
    }
  };

  const handleDeleteRequest = (requestId: number, documentType: string) => {
    setDeleteRequestConfirm({ show: true, requestId, documentType });
  };

  const confirmDeleteRequest = () => {
    if (deleteRequestConfirm.requestId) {
      deleteRequestMutation.mutate(deleteRequestConfirm.requestId);
      setDeleteRequestConfirm({ show: false, requestId: null, documentType: '' });
    }
  };

  // Handle secure document viewing
  const handleViewDocument = async (docId: number) => {
    try {
      const authData = localStorage.getItem('authData');
      const token = authData ? JSON.parse(authData).token : '';
      
      if (!token) {
        toast({
          title: "Error de autenticación",
          description: "No se pudo obtener el token de acceso",
          variant: "destructive"
        });
        return;
      }

      // Fetch document with authentication and open in new tab
      const response = await fetch(`/api/documents/${docId}/download?preview=true`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Error al acceder al documento');
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      // Open in new tab
      const newWindow = window.open(blobUrl, '_blank');
      
      // Clean up blob URL after opening
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      
    } catch (error: any) {
      toast({
        title: "Error al visualizar",
        description: error.message || "No se pudo abrir el documento",
        variant: "destructive"
      });
    }
  };

  return (
    <PageWrapper>
      <div className="px-6 py-4 min-h-screen bg-gray-50 relative" style={{ overflowX: 'clip' }}>
        {PreviewOverlay}
        
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Gestión de Documentos</h1>
          <p className="text-gray-500 mt-1">
            Gestiona documentos de empleados y envía solicitudes
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-6 mb-6">
          <StatsCard
            title="Total Documentos"
            subtitle="En sistema"
            value={(documents || []).length}
            color="blue"
            onClick={() => setActiveTab('explorer')}
          />

          <StatsCard
            title="Subidos Hoy"
            subtitle="Nuevos archivos"
            value={(documents || []).filter(doc => {
              const today = new Date();
              const docDate = new Date(doc.createdAt);
              return docDate.toDateString() === today.toDateString();
            }).length}
            color="green"
            onClick={() => setActiveTab('upload')}
          />

          <StatsCard
            title="Solicitudes"
            subtitle="Pendientes"
            value={(sentRequests || []).filter(req => !req.isCompleted).length}
            color="yellow"
            onClick={() => setActiveTab('requests')}
          />

          <StatsCard
            title="Empleados"
            subtitle="Total activos"
            value={(employees || []).length}
            color="purple"
            onClick={() => setActiveTab('explorer')}
          />
        </div>

        {/* Tabs Navigation */}
        <TabNavigation
          tabs={[
            { id: 'upload', label: 'Subir Documentos', icon: Upload },
            { id: 'explorer', label: 'Explorador', icon: Search },
            { id: 'requests', label: 'Solicitudes', icon: Send }
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* Tab Content */}
        {activeTab === 'upload' && (
          <Card>
            <CardContent className="p-6">
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragOver
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-lg font-medium text-gray-900 mb-2">
                  Arrastra documentos aquí
                </p>
                <p className="text-gray-600 mb-2">
                  o haz click para seleccionar archivos
                </p>
                <p className="text-xs text-blue-600 mb-4">
                  🤖 Detección inteligente: Los archivos se asignarán automáticamente al empleado correcto
                </p>
                <Button
                  onClick={() => {
                    if (showPreview) return;
                    fileInputRef.current?.click();
                  }}
                  disabled={isUploading || showPreview}
                  variant="outline"
                >
                  {isUploading ? 'Subiendo...' : 'Seleccionar Archivos'}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length > 0) {
                      const analysisResults = files.map(file => {
                        const analysis = analyzeFileName(file.name);
                        return {
                          file,
                          ...analysis,
                          suggestedName: analysis.employee ? generateCleanFileName(file.name, analysis.employee, analysis.documentType) : undefined
                        };
                      });
                      setUploadAnalysis(analysisResults);
                      setShowUploadPreview(true);
                    }
                  }}
                  className="hidden"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Máximo 10MB por archivo. PDF, JPG, PNG, DOC, DOCX
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'explorer' && (
          <Card>
            <CardContent className="p-6 space-y-4">
              {/* Filters and View Mode */}
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                    <Input
                      placeholder="Buscar por nombre de archivo o empleado..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger className="w-full md:w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los empleados</SelectItem>
                    {employees.map((employee: Employee) => (
                      <SelectItem key={employee.id} value={employee.id.toString()}>
                        {employee.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {/* View Mode Toggle */}
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className="px-3"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className="px-3"
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Results count */}
              <div className="text-sm text-gray-600">
                Mostrando {(filteredDocuments || []).length} documento{(filteredDocuments || []).length !== 1 ? 's' : ''}
              </div>

              {/* Documents Display */}
              {(filteredDocuments || []).length > 0 ? (
                viewMode === 'list' ? (
                  /* Lista tradicional */
                  <div className="space-y-3">
                    {filteredDocuments.map((document: Document) => {
                      const FileIcon = getFileIcon(document.originalName);
                      return (
                        <div
                          key={document.id}
                          className="flex items-center p-4 border rounded-lg hover:bg-gray-50"
                        >
                          <div className="p-2 rounded-lg bg-gray-100 mr-4">
                            <FileIcon className="h-6 w-6 text-gray-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-gray-900 truncate">
                              {document.originalName || document.fileName || 'Documento sin nombre'}
                            </h3>
                            <div className="flex items-center gap-4 mt-1">
                              <span className="text-sm text-gray-600">
                                {document.user?.fullName || 'Empleado desconocido'}
                              </span>
                              <span className="text-sm text-gray-500">
                                {formatFileSize(document.fileSize)}
                              </span>
                              <span className="text-sm text-gray-500">
                                {(() => {
                                  // La fecha del servidor está en UTC, convertir a hora local española
                                  const utcDate = new Date(document.createdAt);
                                  // Agregar 2 horas para convertir de UTC a hora española (GMT+2)
                                  const localDate = new Date(utcDate.getTime() + (2 * 60 * 60 * 1000));
                                  return format(localDate, 'd MMM yyyy HH:mm', { locale: es });
                                })()}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDocument(document.id, document.originalName)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownload(document.id, document.originalName)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => confirmDelete(document.id, document.originalName)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Vista de cuadrícula por empleado */
                  <div className="space-y-6">
                    {(() => {
                      // Agrupar documentos por empleado usando userId directamente
                      const documentsByEmployee = filteredDocuments.reduce((acc: any, doc: Document) => {
                        const employeeId = doc.userId || 'unknown';
                        const employeeName = doc.user?.fullName || 'Empleado desconocido';
                        
                        if (!acc[employeeId]) {
                          acc[employeeId] = {
                            name: employeeName,
                            documents: []
                          };
                        }
                        acc[employeeId].documents.push(doc);
                        return acc;
                      }, {});

                      return Object.entries(documentsByEmployee).map(([employeeId, employeeData]: [string, any]) => {
                        // Agrupar documentos por tipo
                        const docsByType = employeeData.documents.reduce((acc: any, doc: Document) => {
                          const fileName = doc.originalName?.toLowerCase() || '';
                          let type = 'otros';
                          
                          if (fileName.includes('dni') || fileName.includes('documento') || fileName.includes('identidad')) {
                            type = 'dni';
                          } else if (fileName.includes('justificante') || fileName.includes('certificado') || fileName.includes('comprobante') || fileName.includes('vacaciones') || fileName.includes('baja') || fileName.includes('permiso')) {
                            type = 'justificante';
                          }
                          
                          if (!acc[type]) {
                            acc[type] = [];
                          }
                          acc[type].push(doc);
                          return acc;
                        }, {});

                        const employeeFolderId = `employee-${employeeId}`;
                        const isEmployeeExpanded = expandedFolders.has(employeeFolderId);

                        return (
                          <div key={employeeId} className="border rounded-lg bg-white">
                            {/* Employee Header */}
                            <div 
                              className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                              onClick={() => {
                                const newExpanded = new Set(expandedFolders);
                                if (isEmployeeExpanded) {
                                  newExpanded.delete(employeeFolderId);
                                } else {
                                  newExpanded.add(employeeFolderId);
                                }
                                setExpandedFolders(newExpanded);
                              }}
                            >
                              <div className="flex items-center gap-3">
                                {isEmployeeExpanded ? (
                                  <FolderOpen className="h-5 w-5 text-blue-600" />
                                ) : (
                                  <Folder className="h-5 w-5 text-gray-600" />
                                )}
                                <h3 className="font-medium text-gray-900">{employeeData.name}</h3>
                                <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                  {employeeData.documents.length} documentos
                                </span>
                              </div>
                            </div>

                            {/* Document Types */}
                            {isEmployeeExpanded && (
                              <div className="p-4 space-y-4">
                                {Object.entries(docsByType).map(([type, docs]: [string, any]) => {
                                  const typeFolderId = `${employeeFolderId}-${type}`;
                                  const isTypeExpanded = expandedFolders.has(typeFolderId);
                                  
                                  const typeNames: { [key: string]: string } = {
                                    dni: 'DNI',
                                    justificante: 'Justificantes',
                                    otros: 'Otros'
                                  };

                                  return (
                                    <div key={type} className="border rounded-lg bg-gray-50">
                                      {/* Type Header */}
                                      <div 
                                        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-100"
                                        onClick={() => {
                                          const newExpanded = new Set(expandedFolders);
                                          if (isTypeExpanded) {
                                            newExpanded.delete(typeFolderId);
                                          } else {
                                            newExpanded.add(typeFolderId);
                                          }
                                          setExpandedFolders(newExpanded);
                                        }}
                                      >
                                        <div className="flex items-center gap-2">
                                          {isTypeExpanded ? (
                                            <FolderOpen className="h-4 w-4 text-blue-600" />
                                          ) : (
                                            <Folder className="h-4 w-4 text-gray-600" />
                                          )}
                                          <span className="font-medium text-gray-800">{typeNames[type]}</span>
                                          <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded">
                                            {docs.length}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Documents Grid */}
                                      {isTypeExpanded && (
                                        <div className="p-3 pt-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                          {docs.map((document: Document) => {
                                            const FileIcon = getFileIcon(document.originalName);
                                            return (
                                              <div
                                                key={document.id}
                                                className="bg-white border rounded-lg p-3 hover:shadow-md transition-shadow"
                                              >
                                                <div className="flex items-start justify-between mb-2">
                                                  <div className="p-2 rounded-lg bg-gray-100">
                                                    <FileIcon className="h-4 w-4 text-gray-600" />
                                                  </div>
                                                  <div className="flex gap-1">
                                                    <Button
                                                      variant="outline"
                                                      size="sm"
                                                      onClick={() => handleViewDocument(document.id, document.originalName)}
                                                      className="h-7 w-7 p-0"
                                                    >
                                                      <Eye className="h-3 w-3" />
                                                    </Button>
                                                    <Button
                                                      variant="outline"
                                                      size="sm"
                                                      onClick={() => handleDownload(document.id, document.originalName)}
                                                      className="h-7 w-7 p-0"
                                                    >
                                                      <Download className="h-3 w-3" />
                                                    </Button>
                                                    <Button
                                                      variant="outline"
                                                      size="sm"
                                                      onClick={() => confirmDelete(document.id, document.originalName)}
                                                      className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                    >
                                                      <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                  </div>
                                                </div>
                                                <h4 className="text-sm font-medium text-gray-900 truncate mb-1">
                                                  {document.originalName || document.fileName || 'Documento sin nombre'}
                                                </h4>
                                                <div className="text-xs text-gray-500 space-y-1">
                                                  <div>{formatFileSize(document.fileSize)}</div>
                                                  <div>
                                                    {(() => {
                                                      const utcDate = new Date(document.createdAt);
                                                      const localDate = new Date(utcDate.getTime() + (2 * 60 * 60 * 1000));
                                                      return format(localDate, 'd MMM yyyy', { locale: es });
                                                    })()}
                                                  </div>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                )
              ) : (
                <div className="text-center py-12">
                  <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No se encontraron documentos
                  </h3>
                  <p className="text-gray-600">
                    {searchTerm || selectedEmployee !== 'all'
                      ? 'Ajusta los filtros para ver más resultados'
                      : 'Los documentos aparecerán aquí cuando los empleados los suban'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'requests' && (
          <Card>
            <CardContent className="p-6 space-y-6">
              {/* Send New Request */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <h3 className="font-medium text-gray-900 mb-4">Enviar Nueva Solicitud</h3>
                <div className="space-y-4">
                  {/* Document Type Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tipo de Documento
                    </label>
                    <Select value={documentType} onValueChange={setDocumentType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona el tipo de documento" />
                      </SelectTrigger>
                      <SelectContent>
                        {documentTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            <div className="flex items-center">
                              <type.icon className="h-4 w-4 mr-2" />
                              {type.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Message */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Mensaje (opcional)
                    </label>
                    <Input
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Mensaje personalizado para los empleados"
                    />
                  </div>

                  {/* Employee Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Empleados ({selectedEmployees.length} seleccionados)
                    </label>
                    <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1 bg-white">
                      {employees.map((employee: Employee) => (
                        <div
                          key={employee.id}
                          onClick={() => toggleEmployee(employee.id)}
                          className={`flex items-center p-2 rounded cursor-pointer transition-colors ${
                            selectedEmployees.includes(employee.id)
                              ? 'bg-blue-50 border-blue-200'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className={`w-4 h-4 border rounded mr-3 flex items-center justify-center ${
                            selectedEmployees.includes(employee.id)
                              ? 'bg-blue-600 border-blue-600'
                              : 'border-gray-300'
                          }`}>
                            {selectedEmployees.includes(employee.id) && (
                              <div className="w-2 h-2 bg-white rounded-sm" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{employee.fullName}</div>
                            <div className="text-sm text-gray-600">{employee.email}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button
                    onClick={handleSendRequest}
                    disabled={sendDocumentMutation.isPending || selectedEmployees.length === 0 || !documentType}
                    className="w-full"
                  >
                    {sendDocumentMutation.isPending ? 'Enviando...' : 'Enviar Solicitud'}
                  </Button>
                </div>
              </div>

              {/* Sent Requests History */}
              <div>
                <h3 className="font-medium text-gray-900 mb-4">Historial de Solicitudes ({(sentRequests || []).length})</h3>
                {(sentRequests || []).length > 0 ? (
                  <div className="space-y-3">
                    {sentRequests.map((request: any) => (
                      <div key={request.id} className="border rounded-lg p-4 bg-white">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant={request.isCompleted ? 'default' : 'secondary'}>
                                {request.isCompleted ? 'Completada' : 'Pendiente'}
                              </Badge>
                              <span className="text-sm font-medium text-gray-700">
                                {request.documentType}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              Para: <span className="font-medium">{request.user?.fullName || 'Empleado'}</span>
                            </p>
                            {request.message && (
                              <p className="text-sm text-gray-600 mb-2">
                                Mensaje: "{request.message}"
                              </p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span>
                                Enviada: {(() => {
                                  const utcDate = new Date(request.createdAt);
                                  const localDate = new Date(utcDate.getTime() + (2 * 60 * 60 * 1000));
                                  return format(localDate, 'd MMM yyyy HH:mm', { locale: es });
                                })()}
                              </span>
                              {request.dueDate && (
                                <span>
                                  Fecha límite: {format(new Date(request.dueDate), 'd MMM yyyy', { locale: es })}
                                </span>
                              )}
                            </div>
                            
                            {/* Estado del documento */}
                            <div className="mt-3">
                              {request.document ? (
                                <div className="p-2 bg-green-50 border border-green-200 rounded space-y-2">
                                  <div className="flex items-center">
                                    <FileCheck className="h-4 w-4 mr-2 text-green-600" />
                                    <span className="text-green-700 text-sm">
                                      Documento recibido: {request.document.originalName}
                                    </span>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDownload(request.document.id, request.document.originalName)}
                                      className="text-blue-600 hover:text-blue-700 border-blue-200 hover:border-blue-300"
                                    >
                                      <Download className="h-3 w-3 mr-1" />
                                      Descargar
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleViewDocument(request.document.id)}
                                      className="text-green-600 hover:text-green-700 border-green-200 hover:border-green-300"
                                    >
                                      <Eye className="h-3 w-3 mr-1" />
                                      Ver
                                    </Button>
                                  </div>
                                </div>
                              ) : request.isCompleted ? (
                                <div className="flex items-center p-2 bg-red-50 border border-red-200 rounded">
                                  <X className="h-4 w-4 mr-2 text-red-600" />
                                  <span className="text-red-700 text-sm">
                                    Archivo eliminado o no encontrado
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center p-2 bg-yellow-50 border border-yellow-200 rounded">
                                  <AlertTriangle className="h-4 w-4 mr-2 text-yellow-600" />
                                  <span className="text-yellow-700 text-sm">
                                    Esperando respuesta del empleado
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {!request.isCompleted ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  // TODO: Implementar cancelación de solicitud
                                  toast({
                                    title: "Funcionalidad pendiente",
                                    description: "La cancelación de solicitudes estará disponible pronto",
                                    variant: "default"
                                  });
                                }}
                                className="text-orange-600 hover:text-orange-700"
                              >
                                Cancelar
                              </Button>
                            ) : request.document ? (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteRequest(request.id, request.documentType)}
                                className="text-white hover:text-white bg-red-600 hover:bg-red-700"
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Eliminar
                              </Button>
                            ) : (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteRequest(request.id, request.documentType)}
                                className="text-white hover:text-white bg-red-600 hover:bg-red-700"
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Eliminar
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Send className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                    <p>No hay solicitudes enviadas</p>
                    <p className="text-sm">Las solicitudes que envíes aparecerán aquí</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Smart Upload Preview Dialog */}
        <Dialog open={showUploadPreview} onOpenChange={setShowUploadPreview}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <Upload className="h-5 w-5 mr-2" />
                Análisis Inteligente de Archivos ({uploadAnalysis.length})
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                He analizado los nombres de archivo para detectar automáticamente el empleado y tipo de documento. 
                Puedes revisar y ajustar antes de subir.
              </p>
              
              <div className="space-y-3">
                {uploadAnalysis.map((analysis, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 mb-1">
                          {analysis.file.name}
                        </h3>
                        {analysis.suggestedName && (
                          <div className="mb-2">
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              📝 Nombre sugerido (editable):
                            </label>
                            <input
                              type="text"
                              value={analysis.suggestedName}
                              onChange={(e) => updateSuggestedName(index, e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Edita el nombre del archivo..."
                            />
                          </div>
                        )}
                        <p className="text-sm text-gray-500">
                          {formatFileSize(analysis.file.size)}
                        </p>
                      </div>
                      <Badge variant={
                        analysis.confidence === 'high' ? 'default' : 
                        analysis.confidence === 'medium' ? 'secondary' : 'destructive'
                      }>
                        {analysis.confidence === 'high' ? 'Alta confianza' :
                         analysis.confidence === 'medium' ? 'Media confianza' : 'Revisar manualmente'}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Employee Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Empleado Destinatario
                        </label>
                        <Select 
                          value={analysis.employee?.id?.toString() || ''} 
                          onValueChange={(value) => updateAnalysisEmployee(index, parseInt(value))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar empleado" />
                          </SelectTrigger>
                          <SelectContent>
                            {employees.map((employee: Employee) => (
                              <SelectItem key={employee.id} value={employee.id.toString()}>
                                <div className="flex items-center">
                                  <User className="h-4 w-4 mr-2" />
                                  {employee.fullName}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {analysis.employee && (
                          <div className="flex items-center mt-1 text-xs text-green-600">
                            <Check className="h-3 w-3 mr-1" />
                            Detectado automáticamente
                          </div>
                        )}
                      </div>
                      
                      {/* Document Type */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tipo de Documento
                        </label>
                        <Select value={analysis.documentType} disabled>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {documentTypes.map((type) => (
                              <SelectItem key={type.id} value={type.id}>
                                <div className="flex items-center">
                                  <type.icon className="h-4 w-4 mr-2" />
                                  {type.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {analysis.documentType !== 'otros' && (
                          <div className="flex items-center mt-1 text-xs text-green-600">
                            <Check className="h-3 w-3 mr-1" />
                            Detectado automáticamente
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {!analysis.employee && (
                      <div className="flex items-center p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        No se pudo detectar automáticamente el empleado. Por favor, selecciona uno manualmente.
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => setShowUploadPreview(false)}
                  disabled={isUploading}
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleBatchUpload}
                  disabled={isUploading || uploadAnalysis.some(a => !a.employee)}
                >
                  {isUploading ? 'Subiendo...' : `Subir ${uploadAnalysis.length} Documento(s)`}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Document Confirmation Dialog */}
        <Dialog open={deleteConfirm.show} onOpenChange={(open) => !open && setDeleteConfirm({ show: false, docId: null, docName: '' })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center text-red-600">
                <Trash2 className="h-5 w-5 mr-2" />
                Confirmar Eliminación de Documento
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <p className="text-gray-700">
                ¿Estás seguro de que quieres eliminar este documento?
              </p>
              
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="font-medium text-gray-900">{deleteConfirm.docName}</p>
                <p className="text-sm text-red-600 mt-1">
                  ⚠️ Esta acción no se puede deshacer. El archivo se eliminará permanentemente del sistema.
                </p>
              </div>
              
              <div className="flex justify-end space-x-3">
                <Button 
                  variant="outline" 
                  onClick={() => setDeleteConfirm({ show: false, docId: null, docName: '' })}
                  disabled={deleteMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button 
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar Permanentemente'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Request Confirmation Dialog */}
        <Dialog open={deleteRequestConfirm.show} onOpenChange={(open) => !open && setDeleteRequestConfirm({ show: false, requestId: null, documentType: '' })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center text-red-600">
                <Trash2 className="h-5 w-5 mr-2" />
                Confirmar Eliminación de Solicitud
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <p className="text-gray-700">
                ¿Estás seguro de que quieres eliminar permanentemente esta solicitud?
              </p>
              
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="font-medium text-gray-900">Solicitud de: {deleteRequestConfirm.documentType}</p>
                <p className="text-sm text-red-600 mt-1">
                  ⚠️ Esta acción no se puede deshacer. La solicitud se eliminará permanentemente del historial.
                </p>
              </div>
              
              <div className="flex justify-end space-x-3">
                <Button 
                  variant="outline" 
                  onClick={() => setDeleteRequestConfirm({ show: false, requestId: null, documentType: '' })}
                  disabled={deleteRequestMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button 
                  variant="destructive"
                  onClick={confirmDeleteRequest}
                  disabled={deleteRequestMutation.isPending}
                  className="text-white hover:text-white bg-red-600 hover:bg-red-700"
                >
                  {deleteRequestMutation.isPending ? 'Eliminando...' : 'Eliminar Solicitud'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
    </div>
    </PageWrapper>
  );
}

