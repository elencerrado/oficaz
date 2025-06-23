import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
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
  ArrowLeft
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';
import { useLocation } from 'wouter';

interface DocumentRequest {
  id: number;
  type: string;
  message: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
  completed: boolean;
}

export default function Documents() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isUploading, setIsUploading] = useState(false);
  const [activeRequest, setActiveRequest] = useState<DocumentRequest | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, company } = useAuth();
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

  // Convert notifications to DocumentRequest format
  const documentRequests: DocumentRequest[] = (documentNotifications as any[] || []).map((notification: any) => ({
    id: notification.id,
    type: notification.documentType,
    message: notification.message,
    dueDate: notification.dueDate,
    priority: notification.priority,
    completed: notification.isCompleted
  }));

  const { data: documents, isLoading, refetch } = useQuery({
    queryKey: ['/api/documents'],
    enabled: !!user,
    staleTime: 30000,
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
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      toast({
        title: 'Documento subido',
        description: 'Tu documento se ha subido correctamente.',
      });
      setIsUploading(false);
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
    uploadMutation.mutate(file);
  };

  const handleDownload = (id: number, filename: string) => {
    // Create download link with token authentication  
    const token = localStorage.getItem('token');
    const url = `/api/documents/${id}/download?token=${token}`;
    
    // Create temporary link and trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleViewDocument = (id: number, filename: string) => {
    // Open PDF directly in new tab with token authentication
    const token = localStorage.getItem('token');
    const url = `/api/documents/${id}/download?token=${token}&view=true`;
    window.open(url, '_blank');
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

  // Get pending document request
  const pendingRequest = documentRequests.find(req => !req.completed);

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
    <div className="min-h-screen bg-employee-gradient text-white flex flex-col">
      {/* Header - Employee Style */}
      <div className="flex items-center justify-between p-6 pb-8 h-20">
        <Link href={`/${companyAlias}/inicio`}>
          <Button
            variant="ghost"
            size="lg"
            className="text-white hover:bg-white/20 px-6 py-3 rounded-xl bg-white/10 backdrop-blur-sm transition-all duration-200 transform hover:scale-105"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            <span className="font-medium">Atrás</span>
          </Button>
        </Link>
        
        <div className="flex-1 flex flex-col items-end text-right">
          {company?.logoUrl ? (
            <img 
              src={company.logoUrl} 
              alt={company.name} 
              className="w-8 h-8 mb-1 rounded-full object-cover"
            />
          ) : (
            <div className="text-white text-sm font-medium mb-1">
              {company?.name || 'Mi Empresa'}
            </div>
          )}
          <div className="text-white/70 text-xs">
            {user?.fullName}
          </div>
        </div>
      </div>

      {/* Title Section */}
      <div className="px-6 pb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Documentos</h1>
        <p className="text-white/70 text-sm">
          Gestiona y descarga tus documentos laborales
        </p>
      </div>

      {/* Content Container */}
      <div className="flex-1 px-6 pb-6 space-y-6">
        {/* Document Request Notification - Compact */}
        {pendingRequest && !activeRequest && (
          <Alert className="border-orange-200 bg-orange-50 py-3">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <span className="font-medium text-sm">DNI:</span>
                    <span className="text-sm">{pendingRequest.message}</span>
                    {pendingRequest.dueDate && (
                      <span className="text-xs text-orange-600 flex items-center">
                        <Calendar className="h-3 w-3 mr-1" />
                        {format(new Date(pendingRequest.dueDate), 'd MMM yyyy', { locale: es })}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  onClick={() => setActiveRequest(pendingRequest)}
                  className="bg-orange-600 hover:bg-orange-700 text-white ml-4 h-8"
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
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-blue-800 flex items-center">
                  <Upload className="h-5 w-5 mr-2" />
                  Subiendo: {activeRequest.type}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveRequest(null)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-center border-2 border-dashed border-blue-300 rounded-lg p-6 bg-white">
                <div className="text-center">
                  <Upload className="mx-auto h-12 w-12 text-blue-400 mb-4" />
                  <p className="text-sm text-blue-700 mb-4">{activeRequest.message}</p>
                  <div className="flex flex-col items-center gap-2">
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {isUploading ? 'Subiendo...' : 'Seleccionar archivo'}
                    </Button>
                    <span className="text-xs text-blue-500">
                      Tamaño máximo: 10MB - PDF, JPG, PNG
                    </span>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={async (e) => {
                      if (e.target.files?.[0]) {
                        await handleFileUpload(e);
                        handleCompleteRequest();
                      }
                    }}
                    className="hidden"
                    disabled={isUploading}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Categories */}
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => {
            const IconComponent = category.icon;
            return (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category.id)}
                className={selectedCategory === category.id ? "bg-[#007AFF] hover:bg-[#0056CC] text-white" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}
              >
                <IconComponent className="h-4 w-4 mr-2" />
                {category.name}
              </Button>
            );
          })}
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <Input
                  placeholder="Buscar documentos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="text-sm text-gray-500">
                {filteredDocuments.length} documento{filteredDocuments.length !== 1 ? 's' : ''}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Documents Grid */}
        {filteredDocuments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocuments.map((document: any) => {
              const FileIcon = getFileIcon(document.originalName);
              const category = getDocumentCategory(document.originalName);
              
              return (
                <div key={document.id} className="bg-white/8 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-2xl hover:bg-white/10 transition-all duration-200">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      category === 'nominas' ? 'bg-green-100' :
                      category === 'contratos' ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                      <FileIcon className={`${
                        category === 'nominas' ? 'text-green-600' :
                        category === 'contratos' ? 'text-blue-600' : 'text-gray-600'
                      }`} size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-white text-sm leading-tight mb-1" title={document.originalName}>
                            {document.originalName}
                          </h3>
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            <Badge 
                              variant="secondary" 
                              className={`text-xs px-2 py-0 ${
                                category === 'nominas' ? 'bg-green-100 text-green-700' :
                                category === 'contratos' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {category === 'nominas' ? 'Nómina' :
                               category === 'contratos' ? 'Contrato' : 'Documento'}
                            </Badge>
                            <span className="text-xs text-white/60">
                              {formatFileSize(document.fileSize)}
                            </span>
                            <span className="text-xs text-white/50">
                              {format(new Date(document.createdAt), 'd MMM yyyy', { locale: es })}
                            </span>
                          </div>
                        </div>
                        <div className="flex space-x-1 ml-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDocument(document.id, document.originalName)}
                            className="text-blue-400 border-blue-400/50 hover:bg-blue-400 hover:text-white h-8 px-2 bg-white/10"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownload(document.id, document.originalName)}
                            className="text-white/70 border-white/30 hover:bg-white/20 h-8 px-2 bg-white/5"
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12">
              <div className="text-center">
                <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchTerm ? 'No se encontraron documentos' : 
                   selectedCategory === 'nominas' ? 'No hay nóminas disponibles' :
                   selectedCategory === 'contratos' ? 'No hay contratos disponibles' :
                   selectedCategory === 'otros' ? 'No hay otros documentos' :
                   'No hay documentos disponibles'}
                </h3>
                <p className="text-gray-500 mb-4">
                  {searchTerm 
                    ? 'Intenta ajustar los términos de búsqueda.'
                    : 'Los documentos aparecerán aquí cuando estén disponibles.'
                  }
                </p>
                {!searchTerm && selectedCategory === 'todos' && (
                  <Button
                    onClick={() => createDemoMutation.mutate()}
                    disabled={createDemoMutation.isPending}
                    className="bg-[#007AFF] hover:bg-[#0056CC] text-white"
                  >
                    {createDemoMutation.isPending ? (
                      <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    ) : (
                      <FileText className="h-4 w-4 mr-2" />
                    )}
                    Crear documentos de prueba
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
