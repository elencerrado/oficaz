import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
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
  PenTool
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { getAuthHeaders } from '@/lib/auth';
import { DocumentSignatureModal } from '@/components/document-signature-modal';
import { DocumentPreviewModal } from '@/components/DocumentPreviewModal';
import { TabNavigation } from '@/components/ui/tab-navigation';
import { EmployeeTopBar } from '@/components/employee/employee-top-bar';
import { useStandardInfiniteScroll } from '@/hooks/use-standard-infinite-scroll';

type DocumentsPage = {
  items: any[];
  nextCursor: number | null;
};

interface DocumentRequest {
  id: number;
  type: string;
  message: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
  completed: boolean;
}

export default function AdminEmployeeDocuments() {
  usePageTitle('Documentos');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isUploading, setIsUploading] = useState(false);
  const [activeRequest, setActiveRequest] = useState<DocumentRequest | null>(null);
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [documentToSign, setDocumentToSign] = useState<{ id: number; originalName: string } | null>(null);
  const [previewModal, setPreviewModal] = useState<{ open: boolean; url: string; filename: string; mimeType?: string | null }>({ open: false, url: '', filename: '', mimeType: null });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, company } = useAuth();
  const { hasAccess, getRequiredPlan, isManagerPermissionsLoading } = useFeatureCheck();
  
  // Check feature access for admins/managers viewing documents
  if (!hasAccess('documents')) {
    return (
      <FeatureRestrictedPage
        featureName="Documentos"
        description="Gestión y almacenamiento de documentos de la empresa"
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
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: false,
  });

  // Convert unified notifications to DocumentRequest format
  const documentRequests: DocumentRequest[] = Array.isArray(documentNotifications) ? documentNotifications.map(notification => {
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
  }) : [];

  // Get pending document request
  const pendingRequest = documentRequests.find((req: any) => !req.completed);

  // ⚡ Debounce search term para evitar filtrado excesivo
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Mark that user visited documents page for notification clearing
  useEffect(() => {
    // Store timestamp when user visits the documents page
    localStorage.setItem('lastDocumentPageVisit', new Date().toISOString());
  }, []);

  const {
    data: documentsPages,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery<DocumentsPage>({
    queryKey: ['/api/documents'],
    enabled: !!user,
    // Shorter staleTime for documents to feel more responsive on first load
    staleTime: 30000, // 30 seconds (matches schedule page)
    gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    initialPageParam: null as number | null,
    getNextPageParam: (lastPage) => lastPage?.nextCursor ?? null,
    queryFn: async ({ pageParam = null }) => {
      const params = new URLSearchParams({ limit: '10' });
      if (pageParam) params.set('cursor', String(pageParam));
      const data = await apiRequest('GET', `/api/documents?${params.toString()}`);
      // Normalizar cualquier shape esperado
      const items = Array.isArray(data)
        ? data
        : data?.items
          ? data.items
          : data?.documents
            ? data.documents
            : [];
      const nextCursor = data?.nextCursor ?? null;
      return { items, nextCursor };
    },
  });

  // Create demo documents mutation
  const createDemoMutation = useMutation({
    mutationFn: async () => apiRequest('POST', '/api/documents/create-demo'),
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
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        // console.error('❌ Upload failed:', response.status, errorText);
        throw new Error(errorText || 'Upload failed');
      }

      const result = await response.json();
      return result;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/document-notifications'] });
      
      // Mark request as completed if active
      if (activeRequest && pendingRequest) {
        try {
          await apiRequest('PATCH', `/api/document-notifications/${pendingRequest.id}/complete`);
          queryClient.invalidateQueries({ queryKey: ['/api/document-notifications'] });
        } catch (error) {
          // console.error('Error completing request:', error);
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
      formData.append('notificationId', activeRequest.id.toString());
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
      // console.error('Error generating signed URL:', error);
      toast({
        title: "Error de autenticación",
        description: "No se pudo generar el enlace de descarga seguro.",
        variant: "destructive",
      });
      return null;
    }
  };

  const handleViewDocument = async (id: number, filename: string, mimeType?: string | null) => {
    markViewedMutation.mutate(id);
    const signedUrl = await generateSignedUrl(id);
    if (!signedUrl) return;
    setPreviewModal({ open: true, url: signedUrl, filename, mimeType: mimeType || null });
  };

  const handleDownload = async (id: number, filename: string) => {
    // 🔒 SECURITY: Use signed URL instead of JWT token in query params
    const signedUrl = await generateSignedUrl(id);
    if (!signedUrl) return;

    // Create temporary link and trigger download
    const a = document.createElement('a');
    a.href = signedUrl;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Legacy view flow removed; all document previews now use the in-app modal with signed URLs

  const getFileIcon = (filename: string) => {
    const ext = filename.toLowerCase().split('.').pop();
    if (ext === 'pdf') return FileText;
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext || '')) return File;
    if (['doc', 'docx'].includes(ext || '')) return FileSignature;
    return File;
  };

  const documents = useMemo(() => {
    return documentsPages?.pages.flatMap((page: any) => page?.items || []) ?? [];
  }, [documentsPages]);

  const getDocumentCategory = (filename: string) => {
    const name = filename.toLowerCase();
    if (name.includes('nomina') || name.includes('nómina') || name.includes('payroll')) return 'nominas';
    if (name.includes('contrato') || name.includes('contract')) return 'contratos';
    return 'otros';
  };

  const categories = [
    { id: 'all', name: 'Todo', icon: Folder },
    { id: 'nominas', name: 'Nom.', icon: Receipt },
    { id: 'contratos', name: 'Contr.', icon: FileSignature },
    { id: 'otros', name: 'Otros', icon: File },
  ];

  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // ⚡ Memoizar filtrado para evitar recalcular en cada render
  const filteredDocuments = useMemo(() => {
    if (!Array.isArray(documents)) return [];
    return documents.filter((doc: any) => {
      const matchesSearch = doc.originalName.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
      if (selectedCategory === 'all') return matchesSearch;
      return matchesSearch && getDocumentCategory(doc.originalName) === selectedCategory;
    });
  }, [documents, debouncedSearchTerm, selectedCategory]);

  const skeletonCards = Array.from({ length: 6 });

  useStandardInfiniteScroll({
    targetRef: loadMoreRef,
    enabled: true,
    canLoadMore: !!hasNextPage,
    isLoadingMore: isFetchingNextPage,
    onLoadMore: fetchNextPage,
    dependencyKey: filteredDocuments.length,
    rootMargin: '200px 0px 0px 0px',
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

  const isInitialLoading = isLoading && documents.length === 0;

  return (
    <div className="bg-gray-50 dark:bg-employee-gradient text-gray-900 dark:text-white flex flex-col">
      <EmployeeTopBar homeHref={`/${companyAlias}/inicio`} />

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

        {/* Categories slider (matching admin tab style) */}
        <TabNavigation
          tabs={categories.map((category) => ({
            id: category.id,
            label: category.name,
            icon: category.icon,
          }))}
          activeTab={selectedCategory}
          onTabChange={(tabId) => setSelectedCategory(tabId)}
          className="-mx-1 px-1"
        />

        {/* Search - inline filter bar style */}
        <div className="flex items-center gap-4 flex-wrap p-1 w-full">
          <div className="relative flex-1 min-w-[260px] w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/60" size={16} />
            <Input
              placeholder="Buscar documentos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-gray-400 dark:focus:border-gray-500 focus:ring-gray-400 dark:focus:ring-gray-500"
            />
          </div>
          <div className="text-sm text-gray-600 dark:text-white/70 px-1">
            {filteredDocuments.length} documento{filteredDocuments.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Documents Grid */}
        {isInitialLoading ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block relative w-12 h-12 mb-4">
                  <div className="absolute inset-0 rounded-full border-4 border-gray-200 dark:border-gray-700" />
                  <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
                </div>
                <p className="text-gray-600 dark:text-white/70">Cargando documentos...</p>
              </div>
            </div>
          </div>
        ) : filteredDocuments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocuments.map((document: any) => {
              const FileIcon = getFileIcon(document.originalName);
              const category = getDocumentCategory(document.originalName);
              const needsSignature = category === 'nominas' || document.requiresSignature;
              const isSigned = !!document.isAccepted;

              return (
                <div 
                  key={document.id} 
                  className="relative bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700 shadow-2xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 cursor-pointer overflow-hidden"
                  onClick={() => handleViewDocument(document.id, document.originalName, document.mimeType)}
                >
                  {/* Mobile signature indicator on the right */}
                  {needsSignature && (
                    <div
                      className={`sm:hidden absolute inset-y-0 right-0 w-10 flex items-center justify-center ${
                        isSigned ? 'bg-emerald-500/90' : 'bg-amber-500/90'
                      }`}
                    >
                      <PenTool className="h-4 w-4 text-white" />
                    </div>
                  )}

                  <div className="flex items-center space-x-3 pr-12 sm:pr-0">
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
                          <h3 className="font-medium text-gray-900 dark:text-white text-sm leading-tight mb-1 truncate" title={document.originalName}>
                            {document.originalName}
                          </h3>
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            {/* Category badge hidden on mobile to save space */}
                            <Badge 
                              variant="secondary" 
                              className={`hidden sm:inline-flex text-xs px-2 py-0 border-0 ${
                                category === 'nominas' ? '!bg-emerald-100 !text-emerald-700 dark:!bg-emerald-900/50 dark:!text-emerald-300' :
                                category === 'contratos' ? '!bg-blue-100 !text-blue-700 dark:!bg-blue-900/50 dark:!text-blue-300' : '!bg-orange-100 !text-orange-700 dark:!bg-orange-900/50 dark:!text-orange-300'
                              }`}
                            >
                              {category === 'nominas' ? 'Nómina' :
                               category === 'contratos' ? 'Contrato' : 'Documento'}
                            </Badge>
                            {/* Signature status badge (desktop/tablet) */}
                            {needsSignature && (
                              <Badge 
                                variant={isSigned ? 'default' : 'outline'}
                                className={`hidden sm:inline-flex text-xs px-2 py-0 ${
                                  isSigned 
                                    ? '!bg-green-100 !text-green-700 dark:!bg-green-900/50 dark:!text-green-300 border-0' 
                                    : '!bg-yellow-100 !text-yellow-700 !border-yellow-300 dark:!bg-yellow-900/30 dark:!text-yellow-300 dark:!border-yellow-600/30'
                                }`}
                              >
                                {isSigned ? '✓ Firmada' : 'Pendiente firma'}
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
                        {/* Signature button for unsigned documents (nóminas or requiresSignature) */}
                        {needsSignature && !document.isAccepted && document.isViewed && (
                          <div className="flex space-x-1 ml-2" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenSignatureModal(document)}
                              className="text-green-400 dark:text-green-400 border-green-400/50 dark:border-green-400/50 hover:bg-green-400 dark:hover:bg-green-400 hover:text-white dark:hover:text-white h-8 px-2 bg-green-50 dark:bg-white/10"
                            >
                              <PenTool className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={loadMoreRef} className="col-span-full h-8" />
            {isFetchingNextPage && (
              <div className="col-span-full text-center text-sm text-gray-500 dark:text-gray-400 py-2">
                Cargando más...
              </div>
            )}
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

      <DocumentPreviewModal
        open={previewModal.open}
        url={previewModal.url}
        filename={previewModal.filename}
        mimeType={previewModal.mimeType}
        onClose={() => setPreviewModal({ open: false, url: '', filename: '', mimeType: null })}
      />
    </div>
  );
}
