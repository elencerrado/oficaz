import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useFeatureCheck } from '@/hooks/use-feature-check';
import { usePageTitle } from '@/hooks/use-page-title';
import { FeatureRestrictedPage } from '@/components/feature-restricted-page';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { PageLoading } from '@/components/ui/page-loading';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Upload, 
  FileText, 
  Download, 
  Trash2, 
  Search,
  File,
  AlertCircle,
  CheckCircle,
  X,
  Receipt,
  FileSignature,
  Folder,
  Calendar,
  Eye,
  ArrowLeft,
  PenTool
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';
import { useLocation } from 'wouter';
import { getAuthData } from '@/lib/auth';
import { DocumentSignatureModal } from '@/components/document-signature-modal';

interface DocumentRequest {
  id: number;
  type: string;
  message: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
  completed: boolean;
}

export default function Documents() {
  usePageTitle('Mis Documentos');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isUploading, setIsUploading] = useState(false);
  const [activeRequest, setActiveRequest] = useState<DocumentRequest | null>(null);
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [documentToSign, setDocumentToSign] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, company } = useAuth();
  const { hasAccess, getRequiredPlan } = useFeatureCheck();
  
  // Lógica inteligente: mostrar logo solo si tiene logo Y función habilitada
  const shouldShowLogo = company?.logoUrl && hasAccess('logoUpload');
  
  // For employees, they shouldn't reach this page if feature is disabled
  // (they see disabled sidebar icon). Only admins/managers see restriction page.
  const isAdmin = user?.role === 'admin' || user?.role === 'manager';
  
  if (isAdmin && !hasAccess('documents')) {
    return (
      <FeatureRestrictedPage
        featureName="Documentos"
        description="Gestión y almacenamiento de documentos de la empresa"
        requiredPlan={getRequiredPlan('documents')}
        icon={FileText}
      />
    );
  }
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Extract company alias from URL robustly
  const [location] = useLocation();
  const urlParts = location.split('/').filter((part: string) => part.length > 0);
  const companyAlias = urlParts[0] || company?.companyAlias || 'test';

  // Get real document notifications from database
  const { data: documentNotifications } = useQuery({
    queryKey: ['/api/document-notifications'],
    enabled: !!user,
  });

  // Convert unified notifications to DocumentRequest format
  const documentRequests: DocumentRequest[] = (documentNotifications as any[] || []).map((notification: any) => {
    // Parse documentType from metadata or title
    const metadata = notification.metadata ? JSON.parse(notification.metadata) : {};
    const documentType = metadata.documentType || notification.title?.replace('Documento solicitado: ', '') || 'Documento';
    
    return {
      id: notification.id,
      type: documentType,
      message: notification.message,
      dueDate: notification.dueDate,
      priority: notification.priority || 'medium',
      completed: notification.isCompleted
    };
  });

  // Get pending document request
  const pendingRequest = documentRequests.find((req: any) => !req.completed);
  
  console.log('Pending request:', pendingRequest);

  // Mark that user visited documents page for notification clearing
  useEffect(() => {
    // Store timestamp when user visits the documents page
    localStorage.setItem('lastDocumentPageVisit', new Date().toISOString());
    console.log('📋 Documents page visited - marking timestamp for notification clearing');
  }, []);
  console.log('User data:', user);

  const { data: documents, isLoading, refetch } = useQuery({
    queryKey: ['/api/documents'],
    enabled: !!user,
    staleTime: 0, // No cache - always fetch fresh data
    refetchOnWindowFocus: true, // Refetch when user returns to app (e.g., from push notification)
  });

  // Create demo documents mutation
  const createDemoMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/documents/create-demo', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to create demo documents');
      }
      
      return response.json();
    },
    onSuccess: () => {
      refetch();
      toast({
        title: "¡Documentos de prueba creados!",
        description: "Se han añadido documentos de ejemplo para probar la funcionalidad.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudieron crear los documentos de prueba",
        variant: "destructive",
      });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      console.log('Starting upload for user:', user?.id, user?.fullName);
      
      const authData = JSON.parse(localStorage.getItem('authData') || '{}');
      console.log('Auth token exists:', !!authData.token);
      
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${authData.token}`,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Upload failed');
      }

      const result = await response.json();
      console.log('Upload result:', result);
      return result;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/document-notifications'] });
      
      // Mark request as completed if active
      if (activeRequest && pendingRequest) {
        try {
          const authData = JSON.parse(localStorage.getItem('authData') || '{}');
          const response = await fetch(`/api/document-notifications/${pendingRequest.id}/complete`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${authData.token}`,
              'Content-Type': 'application/json',
            },
          });
          if (!response.ok) {
            console.error('Failed to complete notification');
          } else {
            queryClient.invalidateQueries({ queryKey: ['/api/document-notifications'] });
          }
        } catch (error) {
          console.error('Error completing request:', error);
        }
      }
      
      toast({
        title: 'Documento subido',
        description: 'Tu documento se ha subido correctamente.',
      });
      setIsUploading(false);
      setActiveRequest(null); // Cerrar modal automáticamente
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Error al subir',
        description: error.message,
        variant: 'destructive',
      });
      setIsUploading(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/documents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      toast({
        title: 'Document Deleted',
        description: 'The document has been deleted successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Delete Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Document signature mutations
  const markViewedMutation = useMutation({
    mutationFn: (id: number) => apiRequest('POST', `/api/documents/${id}/view`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
    },
    // No error toast - this is a "fire and forget" operation
    // On iOS, navigating away can cancel the response but the server still processes it
    // The document will open regardless, so we don't want to show false errors
  });

  const signDocumentMutation = useMutation({
    mutationFn: ({ id, signature }: { id: number; signature: string }) => 
      apiRequest('POST', `/api/documents/${id}/sign`, { digitalSignature: signature }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      setSignatureModalOpen(false);
      setDocumentToSign(null);
      // No toast for employee - silent success as requested
    },
    onError: (error: any) => {
      toast({
        title: 'Error al firmar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File Too Large',
        description: 'Please select a file smaller than 10MB.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    
    const formData = new FormData();
    formData.append('file', file);
    
    // Agregar información del tipo de documento solicitado para renombrado en backend
    if (activeRequest) {
      formData.append('requestType', activeRequest.type);
      console.log('Adding request type to upload:', activeRequest.type);
    }
    
    uploadMutation.mutate(formData);
  };

  // Document signature handlers
  const handleOpenSignatureModal = (document: any) => {
    // No longer auto-mark as viewed - user must click view button first
    setDocumentToSign(document);
    setSignatureModalOpen(true);
  };

  const handleSignDocument = (signature: string) => {
    if (documentToSign) {
      signDocumentMutation.mutate({
        id: documentToSign.id,
        signature: signature,
      });
    }
  };

  // 🔒 SECURITY: Generate signed URL for secure document access
  const generateSignedUrl = async (id: number): Promise<string | null> => {
    try {
      const data = await apiRequest('POST', `/api/documents/${id}/generate-signed-url`);
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

  const handleDownload = async (id: number, filename: string) => {
    // 🔒 SECURITY: Use signed URL instead of JWT token in query params
    const signedUrl = await generateSignedUrl(id);
    if (!signedUrl) return;
    
    console.log('[SECURITY] Using signed URL for download');
    
    // Create temporary link and trigger download
    const a = document.createElement('a');
    a.href = signedUrl;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // State for pending document view (used for iOS compatibility)
  const [pendingViewId, setPendingViewId] = useState<number | null>(null);
  
  // Effect to handle document viewing after getting signed URL
  useEffect(() => {
    if (pendingViewId === null) return;
    
    const viewDocument = async () => {
      const signedUrl = await generateSignedUrl(pendingViewId);
      setPendingViewId(null);
      
      if (!signedUrl) return;
      
      const url = new URL(signedUrl, window.location.origin);
      url.searchParams.set('view', 'true');
      
      // For iOS/PWA: Navigate in same tab (only reliable method)
      window.location.href = url.toString();
    };
    
    viewDocument();
  }, [pendingViewId]);
  
  const handleViewDocument = (id: number, filename: string) => {
    // Mark document as viewed
    markViewedMutation.mutate(id);
    
    console.log('[SECURITY] Preparing to view document', id);
    
    // For desktop: Try window.open immediately (before any async operations)
    // This works because we're still in the direct click event context
    const isDesktop = !(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    
    if (isDesktop) {
      // Desktop: Open window first, then load URL
      const newWindow = window.open('about:blank', '_blank');
      if (newWindow) {
        // Get signed URL and update the window location
        generateSignedUrl(id).then(signedUrl => {
          if (signedUrl) {
            const url = new URL(signedUrl, window.location.origin);
            url.searchParams.set('view', 'true');
            newWindow.location.href = url.toString();
          } else {
            newWindow.close();
          }
        });
        return;
      }
    }
    
    // iOS/PWA: Use state-based navigation (will trigger useEffect)
    setPendingViewId(id);
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.toLowerCase().split('.').pop();
    if (ext === 'pdf') return FileText;
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext || '')) return File;
    if (['doc', 'docx'].includes(ext || '')) return FileSignature;
    return File;
  };

  const getDocumentCategory = (filename: string) => {
    const name = filename.toLowerCase();
    if (name.includes('nomina') || name.includes('nómina') || name.includes('payroll')) return 'nominas';
    if (name.includes('contrato') || name.includes('contract')) return 'contratos';
    return 'otros';
  };

  const categories = [
    { id: 'all', name: 'Todos', icon: Folder },
    { id: 'nominas', name: 'Nóminas', icon: Receipt },
    { id: 'contratos', name: 'Contratos', icon: FileSignature },
    { id: 'otros', name: 'Otros documentos', icon: File },
  ];

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredDocuments = (documents as any[] || [])
    .filter((doc: any) => {
      const matchesSearch = doc.originalName.toLowerCase().includes(searchTerm.toLowerCase());
      if (selectedCategory === 'all') return matchesSearch;
      return matchesSearch && getDocumentCategory(doc.originalName) === selectedCategory;
    });



  const handleCompleteRequest = () => {
    if (activeRequest) {
      // In real app, this would mark the request as completed via API
      setActiveRequest(null);
      toast({
        title: 'Documento subido',
        description: 'Tu documento ha sido enviado correctamente.',
      });
    }
  };

  if (isLoading) {
    return <PageLoading />;
  }

  return (
    <div className="bg-gray-50 dark:bg-employee-gradient text-gray-900 dark:text-white flex flex-col">
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
          {/* Mostrar logo solo si tiene logo Y función habilitada en super admin */}
          {shouldShowLogo ? (
            <img 
              src={company.logoUrl || ''} 
              alt={company.name || ''} 
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Documentos</h1>
        <p className="text-gray-600 dark:text-white/70 text-sm">Gestiona y descarga tus documentos laborales</p>
      </div>

      {/* Content Container */}
      <div className="flex-1 px-6 pb-6 space-y-6">
        {/* Document Request Notification - Dynamic from Admin */}
        {pendingRequest && !activeRequest && (
          <Alert className="border-orange-200 dark:border-orange-400/30 bg-orange-50 dark:bg-orange-900/20 py-3">
            <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            <AlertDescription className="text-orange-800 dark:text-orange-200">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <span className="font-medium text-sm">{pendingRequest.type}:</span>
                    <span className="text-sm">{pendingRequest.message || `Se solicita subir tu ${pendingRequest.type.toLowerCase()}`}</span>
                    {pendingRequest.dueDate && (
                      <span className="text-xs text-orange-600 dark:text-orange-400 flex items-center">
                        <Calendar className="h-3 w-3 mr-1" />
                        {format(new Date(pendingRequest.dueDate), 'd MMM yyyy', { locale: es })}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  onClick={() => setActiveRequest(pendingRequest)}
                  className="bg-orange-600 hover:bg-orange-700 dark:bg-orange-600 dark:hover:bg-orange-700 text-white ml-4 h-8"
                  size="sm"
                >
                  Subir
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Upload Section (Active Request) */}
        {activeRequest && (
          <Card className="border-blue-200 dark:border-blue-400/30 bg-blue-50 dark:bg-blue-900/20">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-blue-800 dark:text-blue-200 flex items-center">
                  <Upload className="h-5 w-5 mr-2" />
                  Subiendo: {activeRequest.type || 'Documento'}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveRequest(null)}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-center border-2 border-dashed border-blue-300 dark:border-blue-400/40 rounded-lg p-6 bg-white dark:bg-blue-950/30">
                <div className="text-center">
                  <Upload className="mx-auto h-12 w-12 text-blue-400 dark:text-blue-300 mb-4" />
                  <p className="text-sm text-blue-700 dark:text-blue-200 mb-4">{activeRequest.message || `Por favor, sube tu ${activeRequest.type?.toLowerCase() || 'documento'}`}</p>
                  <div className="flex flex-col items-center gap-2">
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700"
                    >
                      {isUploading ? 'Subiendo...' : 'Seleccionar archivo'}
                    </Button>
                    <span className="text-xs text-blue-500 dark:text-blue-400">
                      Tamaño máximo: 10MB - PDF, JPG, PNG
                    </span>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleFileUpload(e)}
                    className="hidden"
                    disabled={isUploading}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Categories */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {categories.map((category) => {
            const IconComponent = category.icon;
            return (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category.id)}
                className={`${selectedCategory === category.id ? "bg-[#007AFF] hover:bg-[#0056CC] text-white dark:bg-[#007AFF] dark:hover:bg-[#0056CC] dark:text-white" : "bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"} flex-1 min-w-0`}
              >
                <IconComponent className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate">{category.name}</span>
              </Button>
            );
          })}
        </div>

        {/* Search */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-white/60" size={16} />
              <Input
                placeholder="Buscar documentos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-400 focus:border-gray-400 dark:focus:border-gray-500 focus:ring-gray-400 dark:focus:ring-gray-500"
              />
            </div>
            <div className="text-sm text-gray-600 dark:text-white/70">
              {filteredDocuments.length} documento{filteredDocuments.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Documents Grid */}
        {filteredDocuments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocuments.map((document: any) => {
              const FileIcon = getFileIcon(document.originalName);
              const category = getDocumentCategory(document.originalName);
              
              return (
                <div key={document.id} className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700 shadow-2xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      category === 'nominas' ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                      category === 'contratos' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-orange-100 dark:bg-orange-900/30'
                    }`}>
                      <FileIcon className={`${
                        category === 'nominas' ? 'text-emerald-600 dark:text-emerald-400' :
                        category === 'contratos' ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'
                      }`} size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 dark:text-white text-sm leading-tight mb-1" title={document.originalName}>
                            {document.originalName}
                          </h3>
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            <Badge 
                              variant="secondary" 
                              className={`text-xs px-2 py-0 border-0 ${
                                category === 'nominas' ? '!bg-emerald-100 !text-emerald-700 dark:!bg-emerald-900/50 dark:!text-emerald-300' :
                                category === 'contratos' ? '!bg-blue-100 !text-blue-700 dark:!bg-blue-900/50 dark:!text-blue-300' : '!bg-orange-100 !text-orange-700 dark:!bg-orange-900/50 dark:!text-orange-300'
                              }`}
                            >
                              {category === 'nominas' ? 'Nómina' :
                               category === 'contratos' ? 'Contrato' : 'Documento'}
                            </Badge>
                            {/* Signature status badge for nóminas or documents requiring signature */}
                            {(category === 'nominas' || document.requiresSignature) && (
                              <Badge 
                                variant={document.isAccepted ? 'default' : 'outline'}
                                className={`text-xs px-2 py-0 ${
                                  document.isAccepted 
                                    ? '!bg-green-100 !text-green-700 dark:!bg-green-900/50 dark:!text-green-300 border-0' 
                                    : '!bg-yellow-100 !text-yellow-700 !border-yellow-300 dark:!bg-yellow-900/30 dark:!text-yellow-300 dark:!border-yellow-600/30'
                                }`}
                              >
                                {document.isAccepted ? '✓ Firmada' : 'Pendiente firma'}
                              </Badge>
                            )}
                            <span className="text-xs text-gray-500 dark:text-white/60">
                              {formatFileSize(document.fileSize)}
                            </span>
                            <span className="text-xs text-gray-400 dark:text-white/50">
                              {format(new Date(document.createdAt), 'd MMM yyyy', { locale: es })}
                            </span>
                          </div>
                        </div>
                        <div className="flex space-x-1 ml-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDocument(document.id, document.originalName)}
                            className="text-blue-400 dark:text-blue-400 border-blue-400/50 dark:border-blue-400/50 hover:bg-blue-400 dark:hover:bg-blue-400 hover:text-white dark:hover:text-white h-8 px-2 bg-blue-50 dark:bg-white/10"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownload(document.id, document.originalName)}
                            className="text-gray-600 dark:text-white/70 border-gray-300 dark:border-white/30 hover:bg-gray-200 dark:hover:bg-white/20 h-8 px-2 bg-gray-100 dark:bg-white/5"
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                          {/* Signature button for unsigned documents (nóminas or requiresSignature) */}
                          {(category === 'nominas' || document.requiresSignature) && !document.isAccepted && document.isViewed && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenSignatureModal(document)}
                              className="text-green-400 dark:text-green-400 border-green-400/50 dark:border-green-400/50 hover:bg-green-400 dark:hover:bg-green-400 hover:text-white dark:hover:text-white h-8 px-2 bg-green-50 dark:bg-white/10"
                            >
                              <PenTool className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12">
            <div className="text-center">
              <FileText className="mx-auto h-12 w-12 text-gray-400 dark:text-white/60 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {searchTerm ? 'No se encontraron documentos' : 
                 selectedCategory === 'nominas' ? 'No hay nóminas disponibles' :
                 selectedCategory === 'contratos' ? 'No hay contratos disponibles' :
                 selectedCategory === 'otros' ? 'No hay otros documentos' :
                 'No hay documentos disponibles'}
              </h3>
              <p className="text-gray-600 dark:text-white/70 mb-4">
                {searchTerm 
                  ? 'Intenta ajustar los términos de búsqueda.'
                  : 'Los documentos aparecerán aquí cuando estén disponibles.'
                }
              </p>
              {!searchTerm && selectedCategory === 'todos' && (
                <Button
                  onClick={() => createDemoMutation.mutate()}
                  disabled={createDemoMutation.isPending}
                  className="bg-[#007AFF] hover:bg-[#0056CC] dark:bg-[#007AFF] dark:hover:bg-[#0056CC] text-white"
                >
                  {createDemoMutation.isPending ? (
                    <LoadingSpinner size="xs" className="mr-2" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  Crear documentos de prueba
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Digital Signature Modal */}
      <DocumentSignatureModal
        isOpen={signatureModalOpen}
        onClose={() => {
          setSignatureModalOpen(false);
          setDocumentToSign(null);
        }}
        onSign={handleSignDocument}
        documentName={documentToSign?.originalName || ''}
        isLoading={signDocumentMutation.isPending}
      />
    </div>
  );
}
