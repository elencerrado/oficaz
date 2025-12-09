import { useState, useRef, useEffect } from 'react';
import { useSearch } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useFeatureCheck } from '@/hooks/use-feature-check';
import { usePageHeader } from '@/components/layout/page-header';
import { usePageTitle } from '@/hooks/use-page-title';
import { FeatureRestrictedPage } from '@/components/feature-restricted-page';
import { PageWrapper } from '@/components/ui/page-wrapper';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UserAvatar } from '@/components/ui/user-avatar';
import { DocumentSignatureModal } from '@/components/document-signature-modal';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { getAuthHeaders } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import StatsCard, { StatsCardGrid } from '@/components/StatsCard';
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
  FolderOpen,
  Receipt,
  FileSignature,
  Loader2,
  Undo2
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { analyzeFileName, documentTypes as importedDocumentTypes } from '@/utils/documentUtils';

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
  isViewed?: boolean;
  isAccepted?: boolean;
  acceptedAt?: string;
  signedAt?: string;
  requiresSignature?: boolean;
  user?: {
    fullName: string;
    profilePicture?: string;
  };
}

// Use documentTypes from shared utilities with icons
const documentTypes = importedDocumentTypes.map(type => ({
  ...type,
  icon: type.id === 'dni' ? User :
        type.id === 'nomina' ? DollarSign :
        type.id === 'contrato' ? FileText :
        type.id === 'justificante' ? FileCheck :
        File
}));

// Function to get type badge color
const getTypeBadgeColor = (type: string) => {
  switch (type) {
    case 'dni': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200';
    case 'nomina': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200';
    case 'contrato': return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200';
    case 'justificante': return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200';
    case 'otros': return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200';
    default: return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200';
  }
};

export default function AdminDocuments() {
  usePageTitle('Gestión de Documentos');
  const { user, company } = useAuth();
  const { hasAccess, getRequiredPlan, getDocumentAccessMode } = useFeatureCheck();
  const { setHeader, resetHeader } = usePageHeader();
  
  // Get document access mode: 'full', 'self', or 'none'
  const documentAccessMode = getDocumentAccessMode();
  const isSelfAccessOnly = documentAccessMode === 'self';

  // Set page header based on access mode
  useEffect(() => {
    setHeader({
      title: isSelfAccessOnly ? 'Mis Documentos' : 'Gestión de Documentos',
      subtitle: isSelfAccessOnly ? 'Visualiza tus documentos personales' : 'Gestiona documentos de empleados y envía solicitudes'
    });
    return resetHeader;
  }, [isSelfAccessOnly]);
  
  console.log('Admin Documents page: checking access...', { documentAccessMode });
  
  // Only block if no access at all (subscription not active)
  if (documentAccessMode === 'none') {
    console.log('Admin Documents: Access denied - no subscription');
    return (
      <FeatureRestrictedPage
        featureName="Documentos"
        description="Gestión y almacenamiento de documentos de la empresa"
        requiredPlan={getRequiredPlan('documents')}
        icon={FileText}
      />
    );
  }
  
  console.log('Admin Documents: Access granted', { mode: documentAccessMode });
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const search = useSearch();
  
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);
  const [documentType, setDocumentType] = useState('');
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [filterPendingSignature, setFilterPendingSignature] = useState(false); // Filter for unsigned payrolls
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadAnalysis, setUploadAnalysis] = useState<any[]>([]);
  const [showUploadPreview, setShowUploadPreview] = useState(false);
  // For self-access only mode, start on explorer tab (their own files)
  const [activeTab, setActiveTab] = useState(isSelfAccessOnly ? 'explorer' : 'upload'); // 'upload', 'explorer', 'requests'
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

  // Signature modal states
  const [signatureModal, setSignatureModal] = useState<{
    isOpen: boolean;
    documentId: number | null;
    documentName: string;
  }>({ isOpen: false, documentId: null, documentName: '' });

  // Request dialog state
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [sendMode, setSendMode] = useState<'individual' | 'circular'>('individual');
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  const [requiresSignature, setRequiresSignature] = useState(false);
  
  // Upload Preview Dialog state - Individual/Circular mode
  const [uploadMode, setUploadMode] = useState<'individual' | 'circular'>('individual');
  const [uploadRequiresSignature, setUploadRequiresSignature] = useState(false);
  const [uploadSelectedEmployees, setUploadSelectedEmployees] = useState<number[]>([]);
  const [uploadEmployeeSearch, setUploadEmployeeSearch] = useState('');
  
  // Last circular upload tracking for undo functionality
  const [lastCircularUpload, setLastCircularUpload] = useState<{
    documentIds: number[];
    fileName: string;
    employeeCount: number;
    timestamp: Date;
  } | null>(null);
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);
  
  // Loading state for document operations
  const [viewingDocId, setViewingDocId] = useState<number | null>(null);
  const [downloadingDocId, setDownloadingDocId] = useState<number | null>(null);

  // Fetch employees (optimized - employees don't change often)
  const { data: employees = [], isLoading: loadingEmployees } = useQuery<Employee[]>({
    queryKey: ['/api/employees'],
    staleTime: 5 * 60 * 1000, // ⚡ Cache for 5 minutes
  });

  // Fetch document notifications (sent requests)
  // WebSocket handles document_* events - no polling needed!
  const { data: sentRequests = [], isLoading: loadingRequests } = useQuery<any[]>({
    queryKey: ['/api/document-notifications'],
    staleTime: 60000, // Cache for 1 min - WebSocket invalidates on changes
    gcTime: 120000,
  });

  // Fetch all documents - WebSocket handles real-time updates
  const { data: allDocuments = [], isLoading: loadingDocuments } = useQuery<any[]>({
    queryKey: ['/api/documents/all'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/documents/all');
      // Handle both old array format and new { documents, accessMode } format
      return Array.isArray(response) ? response : (response?.documents || []);
    },
    staleTime: 60000, // Cache for 1 min - WebSocket invalidates on changes
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  // Auto-activate filter from URL parameters (dashboard navigation)
  useEffect(() => {
    const urlParams = new URLSearchParams(search);
    const filter = urlParams.get('filter');
    
    if (filter === 'unsigned') {
      setActiveTab('explorer');
      setFilterPendingSignature(true);
      // Clean URL after applying filter
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [search]);

  // Send document notification mutation
  const sendDocumentMutation = useMutation({
    mutationFn: async (data: {
      employeeIds: number[];
      documentType: string;
      message: string;
      dueDate?: string;
      requiresSignature?: boolean;
      isCircular?: boolean;
    }) => {
      return await apiRequest('POST', '/api/documents/request', data);
    },
    onSuccess: () => {
      // Invalidar y refrescar inmediatamente ambas queries
      queryClient.invalidateQueries({ queryKey: ['/api/document-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/documents/all'] });
      queryClient.refetchQueries({ queryKey: ['/api/documents/all'] });
      
      toast({
        title: sendMode === 'circular' ? 'Circular enviada' : 'Solicitud enviada',
        description: sendMode === 'circular' 
          ? `Se ha enviado la circular a ${selectedEmployees.length} empleados`
          : 'Se ha enviado la solicitud de documento a los empleados seleccionados',
      });
      setSelectedEmployees([]);
      setDocumentType('');
      setMessage('');
      setRequiresSignature(false);
      setSendMode('individual');
      setEmployeeSearchTerm('');
      setShowRequestDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Error al enviar la solicitud',
        variant: 'destructive',
      });
    },
  });

  // Helper: Handle mode change
  const handleModeChange = (mode: 'individual' | 'circular') => {
    setSendMode(mode);
    if (mode === 'circular') {
      // Select all employees in circular mode
      setSelectedEmployees(employees.map((e: Employee) => e.id));
    } else {
      // Clear selection in individual mode
      setSelectedEmployees([]);
    }
  };

  // Filter employees by search term
  const filteredEmployeesForDialog = employees.filter((employee: Employee) =>
    employee.fullName.toLowerCase().includes(employeeSearchTerm.toLowerCase()) ||
    employee.email.toLowerCase().includes(employeeSearchTerm.toLowerCase())
  );

  // Upload document mutation (silent version for batch uploads)
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch('/api/documents/upload-admin', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });
      if (!response.ok) throw new Error('Error al subir documento');
      return response.json();
    },
    // Note: Toast is shown by handleBatchUpload, not here, to avoid multiple toasts
  });

  // Delete document mutation
  const deleteMutation = useMutation({
    mutationFn: async (docId: number) => {
      const response = await fetch(`/api/documents/${docId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
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
        headers: getAuthHeaders(),
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

  // Sign document mutations
  const markViewedMutation = useMutation({
    mutationFn: async (documentId: number) => {
      return await apiRequest('POST', `/api/documents/${documentId}/view`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents/all'] });
    },
  });

  const signDocumentMutation = useMutation({
    mutationFn: async ({ documentId, signature }: { documentId: number; signature: string }) => {
      return await apiRequest('POST', `/api/documents/${documentId}/sign`, { digitalSignature: signature });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents/all'] });
      toast({
        title: 'Documento firmado',
        description: 'El documento se ha firmado digitalmente con éxito',
      });
      setSignatureModal({ isOpen: false, documentId: null, documentName: '' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Error al firmar el documento',
        variant: 'destructive',
      });
    },
  });

  // Undo last circular upload - delete multiple documents
  const undoCircularMutation = useMutation({
    mutationFn: async (documentIds: number[]) => {
      const headers = getAuthHeaders();
      
      // Delete each document
      const results = await Promise.all(
        documentIds.map(async (docId) => {
          const response = await fetch(`/api/documents/${docId}`, {
            method: 'DELETE',
            headers,
          });
          return response.ok;
        })
      );
      
      const successCount = results.filter(Boolean).length;
      return { successCount, totalCount: documentIds.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents/all'] });
      queryClient.refetchQueries({ queryKey: ['/api/documents/all'] });
      toast({
        title: 'Envío deshecho',
        description: `Se han eliminado ${data.successCount} de ${data.totalCount} documentos`,
      });
      setLastCircularUpload(null);
      setShowUndoConfirm(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error al deshacer',
        description: error.message || 'No se pudieron eliminar todos los documentos',
        variant: 'destructive',
      });
      setShowUndoConfirm(false);
    },
  });

  // Use analyzeFileName from shared utilities

  // ⚠️ PROTECTED - DO NOT MODIFY: Generate clean filename with document type, employee name and date
  // CRITICAL FUNCTION: User confirmed satisfaction with current functionality 
  // Fixed issues: "mar" false positive detection, correct type mapping, proper date extraction
  // This function is ESSENTIAL for document naming - preserve all logic completely
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
    
    // ⚠️ PROTECTED - DO NOT MODIFY: Month detection logic fixed to avoid false positives
    // CRITICAL: Removed "mar" abbreviation to prevent detecting "mar" in "Marti" as "marzo"
    // Uses word boundaries and separators to ensure accurate month detection
    const monthMatch = fileName.match(/\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/i) ||
                       fileName.match(/\b(jan|feb|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i) ||
                       fileName.match(/[-\s_](0?[1-9]|1[0-2])[-\s_]/); // Numbers only with separators
    
    if (monthMatch) {
      let monthStr = monthMatch[0].toLowerCase();
      
      // Clean separators from numeric months
      monthStr = monthStr.replace(/[-\s_]/g, '');
      
      // Convert month to proper Spanish format
      const monthMap: { [key: string]: string } = {
        'enero': 'Enero', 'jan': 'Enero', '01': 'Enero', '1': 'Enero',
        'febrero': 'Febrero', 'feb': 'Febrero', '02': 'Febrero', '2': 'Febrero',
        'marzo': 'Marzo', '03': 'Marzo', '3': 'Marzo',
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

  const handleFileUpload = async (file: File, targetEmployeeId?: number, cleanFileName?: string, requiresSignature?: boolean) => {
    if (!file) return;
    
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
    
    // Send requires signature flag
    if (requiresSignature) {
      formData.append('requiresSignature', 'true');
    }
    
    // Use mutateAsync to wait for each upload to complete
    // This ensures each circular document gets its own physical file
    await uploadMutation.mutateAsync(formData);
  };

  const handleBatchUpload = async () => {
    setIsUploading(true);
    try {
      if (uploadMode === 'circular') {
        // Circular mode: Upload file ONCE, create records for ALL selected employees
        // One physical file shared by all recipients, signature overlaid dynamically on download
        const allCreatedDocIds: number[] = [];
        let lastFileName = '';
        
        for (const analysis of uploadAnalysis) {
          const formData = new FormData();
          formData.append('file', analysis.file);
          formData.append('employeeIds', JSON.stringify(uploadSelectedEmployees));
          if (uploadRequiresSignature) {
            formData.append('requiresSignature', 'true');
          }
          
          const response = await fetch('/api/documents/upload-circular', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: formData,
          });
          
          if (!response.ok) {
            throw new Error('Error al enviar circular');
          }
          
          // Capture created document IDs for undo functionality
          const result = await response.json();
          if (result.documents && Array.isArray(result.documents)) {
            allCreatedDocIds.push(...result.documents.map((doc: any) => doc.id));
          }
          lastFileName = analysis.file.name;
        }
        
        // Store last circular upload info for undo
        if (allCreatedDocIds.length > 0) {
          setLastCircularUpload({
            documentIds: allCreatedDocIds,
            fileName: lastFileName,
            employeeCount: uploadSelectedEmployees.length,
            timestamp: new Date()
          });
        }
        
        // Refresh document list
        queryClient.invalidateQueries({ queryKey: ['/api/documents/all'] });
        queryClient.refetchQueries({ queryKey: ['/api/documents/all'] });
        
        toast({
          title: "Circular enviada",
          description: `${uploadAnalysis.length} documento(s) enviado(s) a ${uploadSelectedEmployees.length} empleado(s)${uploadRequiresSignature ? ' (requiere firma)' : ''}`,
        });
      } else {
        // Individual mode: Upload each file to its assigned employee
        for (const analysis of uploadAnalysis) {
          if (analysis.employee) {
            const cleanFileName = generateCleanFileName(
              analysis.file.name, 
              analysis.employee, 
              analysis.documentType
            );
            await handleFileUpload(analysis.file, analysis.employee.id, cleanFileName, uploadRequiresSignature);
          }
        }
        
        toast({
          title: "Documentos procesados",
          description: `${uploadAnalysis.length} documento(s) subido(s) correctamente${uploadRequiresSignature ? ' (requiere firma)' : ''}`,
        });
      }
      
      // Forzar actualización inmediata tras batch upload
      queryClient.invalidateQueries({ queryKey: ['/api/documents/all'] });
      queryClient.refetchQueries({ queryKey: ['/api/documents/all'] });
      
      setShowUploadPreview(false);
      setUploadAnalysis([]);
      setUploadMode('individual');
      setUploadSelectedEmployees([]);
      setUploadRequiresSignature(false);
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
  };

  const updateAnalysisDocumentType = (index: number, documentTypeId: string) => {
    setUploadAnalysis(prev => prev.map((item, i) => {
      if (i === index) {
        return { 
          ...item, 
          documentType: documentTypeId,
          documentTypeName: documentTypes.find(t => t.id === documentTypeId)?.name || 'Otros',
          suggestedName: item.employee ? generateCleanFileName(item.file.name, item.employee, documentTypeId) : item.suggestedName
        };
      }
      return item;
    }));
  };

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
      const analysis = analyzeFileName(file.name, employees || []);
      // ⚠️ PROTECTED - DO NOT MODIFY: Convert document type name to ID for Select component
      const documentTypeId = documentTypes.find(type => type.name === analysis.documentType)?.id || 'otros';
      return {
        file,
        ...analysis,
        documentType: documentTypeId, // Use ID instead of name for Select compatibility
        documentTypeName: analysis.documentType, // Keep original name for display
        suggestedName: analysis.employee ? generateCleanFileName(file.name, analysis.employee, documentTypeId) : undefined
      };
    });
    
    // Smart detection: if NO employee was detected in any file, auto-set to Circular mode
    const hasNoEmployee = analysisResults.some(a => !a.employee);
    if (hasNoEmployee) {
      setUploadMode('circular');
      // Auto-select all employees for circular mode
      setUploadSelectedEmployees(employees.map((e: Employee) => e.id));
    } else {
      setUploadMode('individual');
      setUploadSelectedEmployees([]);
    }
    setUploadRequiresSignature(false);
    setUploadEmployeeSearch('');
    
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
  
  // Toggle employee selection for upload circular mode
  const toggleUploadEmployee = (employeeId: number) => {
    setUploadSelectedEmployees(prev =>
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };
  
  // Filtered employees for upload dialog search
  const filteredUploadEmployees = employees.filter((employee: Employee) => {
    const search = uploadEmployeeSearch.toLowerCase();
    return employee.fullName.toLowerCase().includes(search) ||
           (employee.email?.toLowerCase().includes(search) || false);
  });

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
      message: message || (sendMode === 'circular' 
        ? `Circular: ${documentTypeName}` 
        : `Por favor, sube tu ${documentTypeName.toLowerCase()}`),
      requiresSignature,
      isCircular: sendMode === 'circular',
    });
  };

  const normalizeText = (text: string): string => {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  };

  // For self-access mode, only show user's own documents
  const documentsSource = isSelfAccessOnly 
    ? allDocuments.filter((doc: Document) => doc.userId === user?.id)
    : allDocuments;
    
  const filteredDocuments = documentsSource.filter((doc: Document) => {
    const normalizedFileName = normalizeText(doc.originalName || '');
    const normalizedEmployeeName = normalizeText(doc.user?.fullName || '');
    const combinedText = `${normalizedFileName} ${normalizedEmployeeName}`;
    
    // Split search term into words and check if ALL words are found
    const searchWords = normalizeText(searchTerm).split(/\s+/).filter(word => word.length > 0);
    const matchesSearch = searchWords.length === 0 || 
                         searchWords.every(word => combinedText.includes(word));
    
    // In self-access mode, don't filter by employee (already filtered to self)
    const matchesEmployee = isSelfAccessOnly || selectedEmployee === 'all' || doc.userId.toString() === selectedEmployee;
    
    // Filter by pending signature (unsigned payrolls OR documents with requiresSignature flag)
    let matchesPendingSignature = true;
    if (filterPendingSignature) {
      const fileName = doc.originalName || doc.fileName || '';
      const analysis = analyzeFileName(fileName, employees);
      const isPayroll = analysis.documentType === 'Nómina';
      const requiresSignature = (doc as any).requiresSignature === true;
      matchesPendingSignature = (isPayroll || requiresSignature) && !doc.isAccepted;
    }
    
    return matchesSearch && matchesEmployee && matchesPendingSignature;
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



  // 🔒 SECURITY: Generate signed URL for secure document access
  const generateSignedUrl = async (docId: number): Promise<string | null> => {
    try {
      const data = await apiRequest('POST', `/api/documents/${docId}/generate-signed-url`);
      return data.url;
    } catch (error) {
      console.error('Error generating signed URL:', error);
      toast({
        title: "Error de autenticación",
        description: "No se pudo generar el enlace de descarga seguro.",
        variant: "destructive",
      });
      return null;
    }
  };

  const handleDownload = async (docId: number, fileName: string) => {
    setDownloadingDocId(docId);
    try {
      // 🔒 SECURITY: Use signed URL instead of JWT token
      const signedUrl = await generateSignedUrl(docId);
      if (!signedUrl) {
        setDownloadingDocId(null);
        return;
      }

      console.log('[SECURITY] Using signed URL for download');

      // Fetch document using signed URL
      const response = await fetch(signedUrl);
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
    } finally {
      setDownloadingDocId(null);
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
  // Detect iOS devices
  const isIOS = () => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  };

  const handleViewDocument = async (docId: number) => {
    // Only mark as viewed if the document belongs to the current user
    // Admins viewing employee documents should not mark them as viewed
    const docToView = allDocuments?.find((d: any) => d.id === docId);
    if (docToView && docToView.userId === user?.id) {
      markViewedMutation.mutate(docId);
    }
    
    setViewingDocId(docId);
    
    try {
      // 🔒 SECURITY: Use signed URL instead of JWT token
      const signedUrl = await generateSignedUrl(docId);
      if (!signedUrl) {
        setViewingDocId(null);
        return;
      }

      console.log('[SECURITY] Using signed URL for view');

      // Use direct link approach for all browsers - prevents popup blocking
      const url = new URL(signedUrl, window.location.origin);
      url.searchParams.set('preview', 'true');
      
      // Create a temporary link element and click it
      // This approach works reliably and isn't blocked as a popup
      const link = document.createElement('a');
      link.href = url.toString();
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error: any) {
      toast({
        title: "Error al visualizar",
        description: error.message || "No se pudo abrir el documento",
        variant: "destructive"
      });
    } finally {
      setViewingDocId(null);
    }
  };

  // Sign document functions
  const handleSignDocument = (docId: number, docName: string) => {
    // User must have clicked view button first - no auto-marking as viewed
    setSignatureModal({
      isOpen: true,
      documentId: docId,
      documentName: docName
    });
  };

  const handleSignature = async (signature: string) => {
    if (!signatureModal.documentId) return;
    
    signDocumentMutation.mutate({
      documentId: signatureModal.documentId,
      signature
    });
  };

  // Use documentsSource for self-access mode (defined above with filteredDocuments)

  return (
    <PageWrapper>
      <div>

        {isSelfAccessOnly ? (
          <StatsCardGrid columns={2}>
            <StatsCard
              label="Mis Documentos"
              value={(documentsSource || []).length}
              color="blue"
              icon={FileText}
              onClick={() => {
                setActiveTab('explorer');
                setFilterPendingSignature(false);
              }}
              isLoading={loadingDocuments}
              index={0}
              data-testid="stat-my-documents"
            />
            <StatsCard
              label="Pendientes Firma"
              value={(documentsSource || []).filter(doc => {
                const fileName = doc.originalName || doc.fileName || '';
                const analysis = analyzeFileName(fileName, employees);
                const isPayroll = analysis.documentType === 'Nómina';
                const requiresSignature = doc.requiresSignature === true;
                return (isPayroll || requiresSignature) && !doc.isAccepted;
              }).length}
              color="orange"
              icon={FileSignature}
              onClick={() => {
                setActiveTab('explorer');
                setFilterPendingSignature(true);
              }}
              isLoading={loadingDocuments}
              index={1}
              data-testid="stat-pending-signature"
            />
          </StatsCardGrid>
        ) : (
          <StatsCardGrid columns={4}>
            <StatsCard
              label="Total Documentos"
              value={(allDocuments || []).length}
              color="blue"
              icon={FileText}
              onClick={() => {
                setActiveTab('explorer');
                setFilterPendingSignature(false);
              }}
              isLoading={loadingDocuments}
              index={0}
              data-testid="stat-total-documents"
            />
            <StatsCard
              label="Pendientes Firma"
              value={(allDocuments || []).filter(doc => {
                const fileName = doc.originalName || doc.fileName || '';
                const analysis = analyzeFileName(fileName, employees);
                const isPayroll = analysis.documentType === 'Nómina';
                const requiresSignature = doc.requiresSignature === true;
                return (isPayroll || requiresSignature) && !doc.isAccepted;
              }).length}
              color="orange"
              icon={FileSignature}
              onClick={() => {
                setActiveTab('explorer');
                setFilterPendingSignature(true);
                setSearchTerm('');
                setSelectedEmployee('all');
              }}
              isLoading={loadingDocuments}
              index={1}
              data-testid="stat-pending-signature"
            />
            <StatsCard
              label="Solicitudes"
              value={(sentRequests || []).filter(req => !req.isCompleted).length}
              color="yellow"
              icon={Send}
              onClick={() => setActiveTab('requests')}
              isLoading={loadingRequests}
              index={2}
              data-testid="stat-requests"
            />
            <StatsCard
              label="Empleados"
              value={(employees || []).length}
              color="purple"
              icon={Users}
              onClick={() => {
                setActiveTab('explorer');
                setFilterPendingSignature(false);
              }}
              isLoading={loadingEmployees}
              index={3}
              data-testid="stat-employees"
            />
          </StatsCardGrid>
        )}

        {/* Tabs Navigation - Only show explorer tab for self-access mode */}
        {isSelfAccessOnly ? (
          <TabNavigation
            tabs={[
              { id: 'explorer', label: 'Mis Archivos', icon: Folder }
            ]}
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab)}
          />
        ) : (
          <TabNavigation
            tabs={[
              { id: 'upload', label: 'Subir Documentos', icon: Upload },
              { id: 'explorer', label: 'Archivos', icon: Folder },
              { id: 'requests', label: 'Pedir Documentos', icon: Download }
            ]}
            activeTab={activeTab}
            onTabChange={(tab) => {
              setActiveTab(tab);
              if (tab !== 'explorer') {
                setFilterPendingSignature(false);
              }
            }}
          />
        )}

        {/* Tab Content */}
        {activeTab === 'upload' && (
          <>
            {/* Undo Last Circular Upload */}
            {lastCircularUpload && (
              <Alert className="mb-4 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700">
                <Undo2 className="h-4 w-4 text-amber-600" />
                <AlertDescription className="flex items-center justify-between">
                  <span className="text-amber-700 dark:text-amber-300">
                    Último envío: <strong>{lastCircularUpload.fileName}</strong> a {lastCircularUpload.employeeCount} empleado(s)
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowUndoConfirm(true)}
                    className="text-amber-600 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/30 border-amber-300 dark:border-amber-600 h-8"
                    disabled={undoCircularMutation.isPending}
                  >
                    {undoCircularMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Undo2 className="h-4 w-4 mr-1" />
                    )}
                    Deshacer envío
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            
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
                  <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-foreground mb-2 hidden md:block">
                  Arrastra documentos aquí
                </p>
                <p className="text-lg font-medium text-foreground mb-2 md:hidden">
                  Sube documentos
                </p>
                <p className="text-muted-foreground mb-2 hidden md:block">
                  o haz click para seleccionar archivos
                </p>
                <p className="text-muted-foreground mb-2 md:hidden">
                  Pulsa para seleccionar archivos
                </p>
                <p className="text-xs text-blue-600 mb-4">
                  🤖 Detección inteligente: Los archivos se asignarán automáticamente al empleado correcto
                </p>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
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
                        const analysis = analyzeFileName(file.name, employees);
                        // ⚠️ PROTECTED - DO NOT MODIFY: Convert document type name to ID for Select component
                        const documentTypeId = documentTypes.find(type => type.name === analysis.documentType)?.id || 'otros';
                        return {
                          file,
                          ...analysis,
                          documentType: documentTypeId, // Use ID instead of name for Select compatibility
                          documentTypeName: analysis.documentType, // Keep original name for display
                          suggestedName: analysis.employee ? generateCleanFileName(file.name, analysis.employee, documentTypeId) : undefined
                        };
                      });
                      
                      // Smart detection: if NO employee was detected, auto-set to Circular mode
                      const hasNoEmployee = analysisResults.some(a => !a.employee);
                      if (hasNoEmployee) {
                        setUploadMode('circular');
                        setUploadSelectedEmployees(employees.map((emp: Employee) => emp.id));
                      } else {
                        setUploadMode('individual');
                        setUploadSelectedEmployees([]);
                      }
                      setUploadRequiresSignature(false);
                      setUploadEmployeeSearch('');
                      
                      setUploadAnalysis(analysisResults);
                      setShowUploadPreview(true);
                    }
                  }}
                  className="hidden"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Máximo 10MB por archivo. PDF, JPG, PNG, DOC, DOCX
                </p>
              </div>
            </CardContent>
          </Card>
          
          {/* Undo Confirmation Dialog */}
          <Dialog open={showUndoConfirm} onOpenChange={setShowUndoConfirm}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="h-5 w-5" />
                  Confirmar deshacer envío
                </DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <p className="text-muted-foreground mb-4">
                  ¿Estás seguro de que quieres eliminar el último envío?
                </p>
                {lastCircularUpload && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-700">
                    <p className="font-medium text-amber-800 dark:text-amber-200 mb-2">
                      Se eliminarán:
                    </p>
                    <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                      <li>• Archivo: <strong>{lastCircularUpload.fileName}</strong></li>
                      <li>• {lastCircularUpload.documentIds.length} copias enviadas a {lastCircularUpload.employeeCount} empleado(s)</li>
                    </ul>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-4">
                  Esta acción eliminará permanentemente todos los documentos de este envío.
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowUndoConfirm(false)}
                  disabled={undoCircularMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (lastCircularUpload) {
                      undoCircularMutation.mutate(lastCircularUpload.documentIds);
                    }
                  }}
                  disabled={undoCircularMutation.isPending}
                >
                  {undoCircularMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Eliminando...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Eliminar envío
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          </>
        )}

        {activeTab === 'explorer' && (
          <div className="space-y-4">
              {/* Filters Section - Same style as time-tracking */}
              <div className="p-4 bg-card dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
                <div className="flex flex-col md:flex-row gap-4">
                  {/* 1. Search Bar - Takes remaining space */}
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
                      <Input
                        placeholder="Buscar por nombre de archivo o empleado..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 w-full h-10 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                      />
                    </div>
                  </div>
                  
                  {/* 2. Employee Filter - Hidden in self-access mode */}
                  {!isSelfAccessOnly && (
                    <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                      <SelectTrigger className="w-full md:w-64 h-10 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
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
                  )}
                  
                  {/* 3. View Mode Toggle Buttons */}
                  <div className="flex bg-muted rounded-lg p-1">
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
              </div>

              {/* Active filter indicator */}
              {filterPendingSignature && (
                <Alert className="bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
                  <FileSignature className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="flex items-center justify-between">
                    <span className="text-orange-700 dark:text-orange-300">
                      Mostrando solo nóminas pendientes de firma
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFilterPendingSignature(false)}
                      className="text-orange-600 hover:text-orange-700 hover:bg-orange-100 dark:hover:bg-orange-900/30 h-7"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Limpiar filtro
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {/* Results count */}
              <div className="text-sm text-muted-foreground">
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
                          className="flex flex-col sm:flex-row p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow gap-3"
                        >
                          {/* Header section - icon and title */}
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="p-2 rounded-lg bg-muted flex-shrink-0">
                              <FileIcon className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="font-medium text-foreground truncate">
                                {document.originalName || document.fileName || 'Documento sin nombre'}
                              </h3>
                              <div className="text-sm text-muted-foreground">
                                {document.user?.fullName || 'Empleado desconocido'}
                              </div>
                            </div>
                          </div>

                          {/* Metadata section - fixed width columns for alignment */}
                          <div className="hidden sm:flex items-center text-sm text-muted-foreground">
                            <span className="w-20 text-right">{formatFileSize(document.fileSize)}</span>
                            <span className="w-36 text-center">
                              {(() => {
                                const utcDate = new Date(document.createdAt);
                                const localDate = new Date(utcDate.getTime() + (2 * 60 * 60 * 1000));
                                return format(localDate, 'd MMM yyyy HH:mm', { locale: es });
                              })()}
                            </span>
                            <span className="w-28 text-center">
                              {(() => {
                                const fileName = document.originalName || document.fileName || '';
                                const analysis = analyzeFileName(fileName, employees);
                                const requiresSignatureBadge = analysis.documentType === 'Nómina' || document.requiresSignature;
                                return requiresSignatureBadge ? (
                                  <Badge 
                                    variant={document.isAccepted ? 'default' : 'outline'}
                                    className={`text-xs ${
                                      document.isAccepted 
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' 
                                        : 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300'
                                    }`}
                                  >
                                    {document.isAccepted ? '✓ Firmada' : 'Pendiente'}
                                  </Badge>
                                ) : null;
                              })()}
                            </span>
                          </div>
                          {/* Mobile: stacked layout */}
                          <div className="sm:hidden flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            <span>{formatFileSize(document.fileSize)}</span>
                            <span>•</span>
                            <span>
                              {(() => {
                                const utcDate = new Date(document.createdAt);
                                const localDate = new Date(utcDate.getTime() + (2 * 60 * 60 * 1000));
                                return format(localDate, 'd MMM yyyy', { locale: es });
                              })()}
                            </span>
                            {(() => {
                              const fileName = document.originalName || document.fileName || '';
                              const analysis = analyzeFileName(fileName, employees);
                              const requiresSignatureBadge = analysis.documentType === 'Nómina' || document.requiresSignature;
                              return requiresSignatureBadge && (
                                <Badge 
                                  variant={document.isAccepted ? 'default' : 'outline'}
                                  className={`text-xs ${
                                    document.isAccepted 
                                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' 
                                      : 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300'
                                  }`}
                                >
                                  {document.isAccepted ? '✓ Firmada' : 'Pendiente'}
                                </Badge>
                              );
                            })()}
                          </div>

                          {/* Actions section - fixed width for alignment */}
                          <div className="flex items-center justify-end gap-1 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50 sm:w-36">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDocument(document.id)}
                              className="h-8 w-8 p-0"
                              disabled={viewingDocId === document.id}
                            >
                              {viewingDocId === document.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownload(document.id, document.originalName)}
                              className="h-8 w-8 p-0"
                              disabled={downloadingDocId === document.id}
                            >
                              {downloadingDocId === document.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                            </Button>
                            {/* Sign button for documents requiring signature owned by current user */}
                            {(() => {
                              const fileName = document.originalName || document.fileName || '';
                              const analysis = analyzeFileName(fileName, employees);
                              const requiresSignature = analysis.documentType === 'Nómina' || document.requiresSignature;
                              return requiresSignature && 
                                     document.userId === user?.id && 
                                     !document.isAccepted && 
                                     document.isViewed && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleSignDocument(document.id, document.originalName || document.fileName)}
                                  className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                >
                                  <FileSignature className="h-4 w-4" />
                                </Button>
                              );
                            })()}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => confirmDelete(document.id, document.originalName)}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
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
                        const employeeProfile = doc.user?.profilePicture || null;
                        
                        if (!acc[employeeId]) {
                          acc[employeeId] = {
                            id: parseInt(employeeId.toString()),
                            name: employeeName,
                            profilePicture: employeeProfile,
                            documents: []
                          };
                        }
                        acc[employeeId].documents.push(doc);
                        return acc;
                      }, {});

                      return Object.entries(documentsByEmployee).map(([employeeId, employeeData]: [string, any]) => {
                        // ⚠️ PROTECTED - DO NOT MODIFY: Smart document categorization using analyzeFileName
                        // Agrupar documentos por tipo usando la función inteligente de análisis
                        const docsByType = employeeData.documents.reduce((acc: any, doc: Document) => {
                          const fileName = doc.originalName || doc.fileName || '';
                          
                          // Usar la función de análisis inteligente para detectar el tipo
                          const analysis = analyzeFileName(fileName, employees);
                          
                          // Mapear el nombre del tipo al ID correcto
                          let type = 'otros';
                          const foundDocType = documentTypes.find(dt => dt.name === analysis.documentType);
                          if (foundDocType) {
                            type = foundDocType.id;
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
                          <div key={employeeId} className="border border-border rounded-lg bg-card">
                            {/* Employee Header */}
                            <div 
                              className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted"
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
                                <UserAvatar 
                                  fullName={employeeData.name} 
                                  userId={employeeData.id} 
                                  profilePicture={employeeData.profilePicture}
                                  size="sm"
                                  className="flex-shrink-0"
                                />
                                <h3 className="font-medium text-gray-900 dark:text-gray-100">{employeeData.name}</h3>
                                <span className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
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
                                    nomina: 'Nóminas',
                                    contrato: 'Contratos',
                                    justificante: 'Justificantes',
                                    otros: 'Otros'
                                  };

                                  return (
                                    <div key={type} className="border border-border rounded-lg bg-muted">
                                      {/* Type Header */}
                                      <div 
                                        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
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
                                            <FolderOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                          ) : (
                                            <Folder className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                                          )}
                                          <span className="font-medium text-gray-800 dark:text-gray-200">{typeNames[type]}</span>
                                          <span className={`text-xs px-2 py-1 rounded ${getTypeBadgeColor(type)}`}>
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
                                                className="bg-card border border-border rounded-lg p-3 hover:shadow-md transition-shadow"
                                              >
                                                <div className="flex items-start justify-between mb-2">
                                                  <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
                                                    <FileIcon className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                                                  </div>
                                                  <div className="flex gap-1">
                                                    <Button
                                                      variant="outline"
                                                      size="sm"
                                                      onClick={() => handleViewDocument(document.id)}
                                                      className="h-7 w-7 p-0"
                                                      disabled={viewingDocId === document.id}
                                                    >
                                                      {viewingDocId === document.id ? (
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                      ) : (
                                                        <Eye className="h-3 w-3" />
                                                      )}
                                                    </Button>
                                                    <Button
                                                      variant="outline"
                                                      size="sm"
                                                      onClick={() => handleDownload(document.id, document.originalName)}
                                                      className="h-7 w-7 p-0"
                                                      disabled={downloadingDocId === document.id}
                                                    >
                                                      {downloadingDocId === document.id ? (
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                      ) : (
                                                        <Download className="h-3 w-3" />
                                                      )}
                                                    </Button>
                                                    {/* Sign button for documents requiring signature owned by current user in grid view */}
                                                    {(type === 'nomina' || document.requiresSignature) && 
                                                     document.userId === user?.id && 
                                                     !document.isAccepted && 
                                                     document.isViewed && (
                                                      <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleSignDocument(document.id, document.originalName || document.fileName)}
                                                        className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                      >
                                                        <FileSignature className="h-3 w-3" />
                                                      </Button>
                                                    )}
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
                                                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate mb-1">
                                                  {document.originalName || document.fileName || 'Documento sin nombre'}
                                                </h4>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                                                  <div>{formatFileSize(document.fileSize)}</div>
                                                  <div>
                                                    {(() => {
                                                      const utcDate = new Date(document.createdAt);
                                                      const localDate = new Date(utcDate.getTime() + (2 * 60 * 60 * 1000));
                                                      return format(localDate, 'd MMM yyyy', { locale: es });
                                                    })()}
                                                  </div>
                                                  {/* Signature status for nóminas or documents requiring signature in grid view */}
                                                  {(type === 'nomina' || document.requiresSignature) && (
                                                    <div>
                                                      <Badge 
                                                        variant={document.isAccepted ? 'default' : 'outline'}
                                                        className={`text-xs ${
                                                          document.isAccepted 
                                                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' 
                                                            : 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300'
                                                        }`}
                                                      >
                                                        {document.isAccepted ? '✓ Firmada' : 'Pendiente firma'}
                                                      </Badge>
                                                    </div>
                                                  )}
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
                  <FileText className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    No se encontraron documentos
                  </h3>
                  <p className="text-muted-foreground">
                    {searchTerm || selectedEmployee !== 'all'
                      ? 'Ajusta los filtros para ver más resultados'
                      : 'Los documentos aparecerán aquí cuando los empleados los suban'}
                  </p>
                </div>
              )}
          </div>
        )}

        {activeTab === 'requests' && (
          <Card>
            <CardContent className="p-6 space-y-6">
              {/* Sent Requests History */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-foreground">Historial de Solicitudes ({(sentRequests || []).length})</h3>
                  <Button 
                    onClick={() => setShowRequestDialog(true)}
                    data-testid="button-new-request"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Nueva Solicitud
                  </Button>
                </div>
                {(sentRequests || []).length > 0 ? (
                  <div className="space-y-3">
                    {sentRequests.map((request: any) => (
                      <div key={request.id} className="border rounded-lg p-4 bg-card">
                        <div className="flex flex-col sm:flex-row gap-4">
                          <div className="flex-1 space-y-3">
                            {/* Header with status and type */}
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={request.isCompleted ? 'default' : 'secondary'}>
                                {request.isCompleted ? 'Completada' : 'Pendiente'}
                              </Badge>
                              <span className="text-sm font-medium text-muted-foreground">
                                {request.documentType}
                              </span>
                            </div>

                            {/* Employee and message info */}
                            <div className="space-y-1">
                              <p className="text-sm text-muted-foreground">
                                Para: <span className="font-medium">{request.user?.fullName || 'Empleado'}</span>
                              </p>
                              {request.message && (
                                <p className="text-sm text-muted-foreground">
                                  Mensaje: "{request.message}"
                                </p>
                              )}
                            </div>

                            {/* Dates section */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs text-muted-foreground">
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
                            
                            {/* Document status */}
                            <div>
                              {request.document ? (
                                <div className="p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded space-y-2">
                                  <div className="flex items-center flex-wrap">
                                    <FileCheck className="h-4 w-4 mr-2 text-green-600 flex-shrink-0" />
                                    <span className="text-green-700 dark:text-green-300 text-sm break-all">
                                      Documento recibido: {request.document.originalName}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
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
                                <div className="flex items-center p-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded">
                                  <X className="h-4 w-4 mr-2 text-red-600 flex-shrink-0" />
                                  <span className="text-red-700 dark:text-red-300 text-sm">
                                    Archivo eliminado o no encontrado
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center p-2 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded">
                                  <AlertTriangle className="h-4 w-4 mr-2 text-yellow-600 flex-shrink-0" />
                                  <span className="text-yellow-700 dark:text-yellow-300 text-sm">
                                    Esperando respuesta del empleado
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action button - separated for mobile */}
                          <div className="flex justify-end sm:items-start pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                            {!request.isCompleted ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteRequest(request.id, request.documentType)}
                                className="text-orange-600 hover:text-orange-700"
                              >
                                <X className="h-4 w-4 mr-1" />
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
                  <div className="text-center py-8 text-muted-foreground">
                    <Send className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                    <p>No hay solicitudes enviadas</p>
                    <p className="text-sm">Las solicitudes que envíes aparecerán aquí</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Smart Upload Preview Dialog - Enhanced with Individual/Circular modes */}
        <Dialog open={showUploadPreview} onOpenChange={(open) => {
          if (!open) {
            setUploadEmployeeSearch('');
            setUploadRequiresSignature(false);
          }
          setShowUploadPreview(open);
        }}>
          <DialogContent className="max-w-xl max-h-[85vh] overflow-hidden p-0 flex flex-col">
            {/* Compact Header */}
            <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
              <DialogTitle className="text-base font-semibold text-foreground flex items-center justify-between">
                Subir Documento
                <span className="text-xs font-normal text-muted-foreground">
                  {uploadAnalysis.length} archivo{uploadAnalysis.length !== 1 ? 's' : ''}
                </span>
              </DialogTitle>
            </div>
            
            <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1 min-h-0">
              {/* Mode Toggle - Apple-style segmented control */}
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-1 flex">
                <button
                  type="button"
                  onClick={() => {
                    setUploadMode('individual');
                    setUploadSelectedEmployees([]);
                  }}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    uploadMode === 'individual'
                      ? 'bg-white dark:bg-gray-700 text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  data-testid="upload-mode-individual"
                >
                  <User className="h-4 w-4" />
                  Individual
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUploadMode('circular');
                    setUploadSelectedEmployees(employees.map((e: Employee) => e.id));
                  }}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    uploadMode === 'circular'
                      ? 'bg-white dark:bg-gray-700 text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  data-testid="upload-mode-circular"
                >
                  <Users className="h-4 w-4" />
                  Para Todos
                </button>
              </div>

              {/* File Cards - Compact */}
              <div className="space-y-2">
                {uploadAnalysis.map((analysis, index) => (
                  <div key={index} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
                    {/* File info row */}
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                        <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{analysis.file.name}</p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(analysis.file.size)}</p>
                      </div>
                    </div>
                    
                    {/* Controls grid */}
                    <div className="grid grid-cols-2 gap-2">
                      {uploadMode === 'individual' && (
                        <div>
                          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Empleado</label>
                          <Select 
                            value={analysis.employee?.id?.toString() || ''} 
                            onValueChange={(value) => updateAnalysisEmployee(index, parseInt(value))}
                          >
                            <SelectTrigger className="h-10 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
                              <SelectValue placeholder="Seleccionar" />
                            </SelectTrigger>
                            <SelectContent>
                              {employees.map((employee: Employee) => (
                                <SelectItem key={employee.id} value={employee.id.toString()}>
                                  {employee.fullName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      
                      <div className={uploadMode === 'circular' ? 'col-span-2' : ''}>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Tipo de documento</label>
                        <Select 
                          value={analysis.documentType} 
                          onValueChange={(value) => updateAnalysisDocumentType(index, value)}
                        >
                          <SelectTrigger className="h-10 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {documentTypes.map((type) => (
                              <SelectItem key={type.id} value={type.id}>
                                {type.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    {/* Warning for individual mode without employee */}
                    {uploadMode === 'individual' && !analysis.employee && (
                      <div className="flex items-center gap-2 mt-3 text-amber-600 dark:text-amber-400 text-xs">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Selecciona un empleado
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Circular Mode - Employee Selection */}
              {uploadMode === 'circular' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-foreground">
                      Destinatarios
                    </span>
                    <button
                      type="button"
                      onClick={() => setUploadSelectedEmployees(employees.map((e: Employee) => e.id))}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Seleccionar todos
                    </button>
                  </div>
                  
                  {/* Search */}
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={uploadEmployeeSearch}
                      onChange={(e) => setUploadEmployeeSearch(e.target.value)}
                      placeholder="Buscar empleado..."
                      className="pl-10 h-10 bg-gray-50 dark:bg-gray-800 border-0"
                      data-testid="upload-employee-search"
                    />
                  </div>
                  
                  {/* Employee list */}
                  <div className="max-h-36 overflow-y-auto space-y-1 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-2">
                    {filteredUploadEmployees.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        No se encontraron empleados
                      </div>
                    ) : (
                      filteredUploadEmployees.map((employee: Employee) => (
                        <div
                          key={employee.id}
                          onClick={() => toggleUploadEmployee(employee.id)}
                          className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                            uploadSelectedEmployees.includes(employee.id)
                              ? 'bg-blue-50 dark:bg-blue-900/20'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
                          }`}
                          data-testid={`upload-employee-${employee.id}`}
                        >
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                            uploadSelectedEmployees.includes(employee.id)
                              ? 'bg-blue-600'
                              : 'border-2 border-gray-300 dark:border-gray-600'
                          }`}>
                            {uploadSelectedEmployees.includes(employee.id) && (
                              <Check className="h-3 w-3 text-white" />
                            )}
                          </div>
                          <span className="text-sm text-foreground">{employee.fullName}</span>
                        </div>
                      ))
                    )}
                  </div>
                  
                  <p className="text-xs text-muted-foreground mt-2">
                    {uploadSelectedEmployees.length} de {employees.length} empleados seleccionados
                  </p>
                </div>
              )}

              {/* Signature Toggle - Apple-style switch row */}
              <div 
                onClick={() => setUploadRequiresSignature(!uploadRequiresSignature)}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl cursor-pointer"
                data-testid="upload-requires-signature"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <FileSignature className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <span className="text-sm font-medium text-foreground">Requiere firma</span>
                </div>
                <div className={`w-11 h-6 rounded-full transition-colors flex items-center px-0.5 ${
                  uploadRequiresSignature ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}>
                  <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                    uploadRequiresSignature ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex-shrink-0">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-muted-foreground">
                  {uploadMode === 'circular' 
                    ? `${uploadSelectedEmployees.length} destinatarios`
                    : `${uploadAnalysis.filter(a => a.employee).length}/${uploadAnalysis.length}`
                  }
                  {uploadRequiresSignature && ' · Firma'}
                </span>
                <div className="flex gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setShowUploadPreview(false)}
                    disabled={isUploading}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    size="sm"
                    onClick={handleBatchUpload}
                    disabled={
                      isUploading || 
                      (uploadMode === 'individual' && uploadAnalysis.some(a => !a.employee)) ||
                      (uploadMode === 'circular' && uploadSelectedEmployees.length === 0)
                    }
                  >
                    {isUploading ? 'Subiendo...' : 'Subir'}
                  </Button>
                </div>
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
              <p className="text-foreground">
                ¿Estás seguro de que quieres eliminar este documento?
              </p>
              
              <div className="bg-muted p-3 rounded-lg">
                <p className="font-medium text-foreground">{deleteConfirm.docName}</p>
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
              <p className="text-foreground">
                ¿Estás seguro de que quieres eliminar permanentemente esta solicitud?
              </p>
              
              <div className="bg-muted p-3 rounded-lg">
                <p className="font-medium text-foreground">Solicitud de: {deleteRequestConfirm.documentType}</p>
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

        {/* Send Request Dialog - Enhanced with Individual/Circular modes */}
        <Dialog open={showRequestDialog} onOpenChange={(open) => {
          if (!open) {
            setEmployeeSearchTerm('');
            setSendMode('individual');
            setRequiresSignature(false);
          }
          setShowRequestDialog(open);
        }}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <Send className="h-5 w-5 mr-2" />
                {sendMode === 'circular' ? 'Enviar Circular / Documento Masivo' : 'Enviar Documento Individual'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Mode Toggle: Individual vs Circular */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Tipo de Envío
                </label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={sendMode === 'individual' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => handleModeChange('individual')}
                    data-testid="button-mode-individual"
                  >
                    <User className="h-4 w-4 mr-2" />
                    Individual
                  </Button>
                  <Button
                    type="button"
                    variant={sendMode === 'circular' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => handleModeChange('circular')}
                    data-testid="button-mode-circular"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Circular (Todos)
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {sendMode === 'circular' 
                    ? 'Envía un documento a todos los empleados. Puedes desmarcar los que no lo necesiten.'
                    : 'Envía un documento a empleados específicos seleccionándolos manualmente.'}
                </p>
              </div>

              {/* Document Type Selection */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Tipo de Documento
                </label>
                <Select value={documentType} onValueChange={setDocumentType}>
                  <SelectTrigger data-testid="select-document-type">
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
                <label className="block text-sm font-medium text-foreground mb-2">
                  {sendMode === 'circular' ? 'Descripción de la Circular' : 'Mensaje (opcional)'}
                </label>
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={sendMode === 'circular' 
                    ? "Ej: Nuevas condiciones laborales, Circular informativa..."
                    : "Mensaje personalizado para los empleados"}
                  data-testid="input-request-message"
                />
              </div>

              {/* Requires Signature Checkbox */}
              <div className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg border">
                <div
                  onClick={() => setRequiresSignature(!requiresSignature)}
                  className={`w-5 h-5 border-2 rounded flex items-center justify-center cursor-pointer transition-colors ${
                    requiresSignature
                      ? 'bg-blue-600 border-blue-600'
                      : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                  }`}
                  data-testid="checkbox-requires-signature"
                >
                  {requiresSignature && (
                    <Check className="h-3 w-3 text-white" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-foreground flex items-center">
                    <FileSignature className="h-4 w-4 mr-2 text-blue-600" />
                    Requiere Firma Digital
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Los empleados deberán firmar digitalmente el documento para confirmarlo
                  </p>
                </div>
              </div>

              {/* Employee Selection with Search */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-foreground">
                    Empleados ({selectedEmployees.length} de {employees.length} seleccionados)
                  </label>
                  {sendMode === 'circular' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedEmployees(employees.map((e: Employee) => e.id))}
                      className="text-xs h-7"
                    >
                      Seleccionar todos
                    </Button>
                  )}
                </div>
                
                {/* Search Input */}
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={employeeSearchTerm}
                    onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                    placeholder="Buscar empleado por nombre o email..."
                    className="pl-9"
                    data-testid="input-employee-search"
                  />
                </div>
                
                <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1 bg-card">
                  {filteredEmployeesForDialog.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      No se encontraron empleados
                    </div>
                  ) : (
                    filteredEmployeesForDialog.map((employee: Employee) => (
                      <div
                        key={employee.id}
                        onClick={() => toggleEmployee(employee.id)}
                        className={`flex items-center p-2 rounded cursor-pointer transition-colors ${
                          selectedEmployees.includes(employee.id)
                            ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700'
                            : 'hover:bg-muted border border-transparent'
                        }`}
                        data-testid={`employee-item-${employee.id}`}
                      >
                        <div className={`w-4 h-4 border rounded mr-3 flex items-center justify-center transition-colors ${
                          selectedEmployees.includes(employee.id)
                            ? 'bg-blue-600 border-blue-600'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}>
                          {selectedEmployees.includes(employee.id) && (
                            <Check className="h-3 w-3 text-white" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-foreground">{employee.fullName}</div>
                          <div className="text-sm text-muted-foreground">{employee.email}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Summary before sending */}
              {selectedEmployees.length > 0 && documentType && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>Resumen:</strong> Se enviará {sendMode === 'circular' ? 'la circular' : 'la solicitud'} de{' '}
                    <span className="font-medium">{documentTypes.find(t => t.id === documentType)?.name}</span>
                    {' '}a <span className="font-medium">{selectedEmployees.length} empleado{selectedEmployees.length !== 1 ? 's' : ''}</span>
                    {requiresSignature && (
                      <span className="ml-1">
                        <FileSignature className="h-3 w-3 inline mr-1" />
                        (requiere firma)
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => setShowRequestDialog(false)}
                  disabled={sendDocumentMutation.isPending}
                  data-testid="button-cancel-request"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSendRequest}
                  disabled={sendDocumentMutation.isPending || selectedEmployees.length === 0 || !documentType}
                  data-testid="button-send-request"
                >
                  {sendDocumentMutation.isPending 
                    ? 'Enviando...' 
                    : sendMode === 'circular'
                      ? `Enviar Circular (${selectedEmployees.length})`
                      : 'Enviar Solicitud'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Document Signature Modal */}
        <DocumentSignatureModal
          isOpen={signatureModal.isOpen}
          onClose={() => setSignatureModal({ isOpen: false, documentId: null, documentName: '' })}
          onSign={handleSignature}
          documentName={signatureModal.documentName}
          isLoading={signDocumentMutation.isPending}
        />
    </div>
    </PageWrapper>
  );
}

