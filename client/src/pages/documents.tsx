import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
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
import { Link, useRoute } from 'wouter';

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
  
  // Extract company alias from URL
  const [match, params] = useRoute('/:companyAlias/documents');
  const companyAlias = params?.companyAlias;

  // Mock document requests - in real app this would come from API
  const documentRequests: DocumentRequest[] = [
    {
      id: 1,
      type: 'DNI',
      message: 'Tu DNI está próximo a caducar. Por favor, sube una copia actualizada.',
      dueDate: '2025-07-15',
      priority: 'high',
      completed: false
    }
  ];

  const { data: documents, isLoading, refetch } = useQuery({
    queryKey: ['/api/documents'],
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

  const handleDownload = async (id: number, filename: string) => {
    try {
      const response = await fetch(`/api/documents/${id}/download`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast({
        title: 'Error de descarga',
        description: 'No se pudo descargar el archivo.',
        variant: 'destructive',
      });
    }
  };

  const handleViewDocument = async (id: number, filename: string) => {
    try {
      const response = await fetch(`/api/documents/${id}/download`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('View failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      // Open in new tab for viewing
      window.open(url, '_blank');
      
      // Clean up after a delay
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 1000);
    } catch (error) {
      toast({
        title: 'Error al visualizar',
        description: 'No se pudo abrir el documento.',
        variant: 'destructive',
      });
    }
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
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 rounded-lg"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-employee-gradient text-white flex flex-col">
      {/* Header - Employee Style */}
      <div className="flex items-center justify-between p-6 pb-8 h-20">
        <Link href={`/${companyAlias}/dashboard`}>
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

      {/* Content Container */}
      <div className="flex-1 p-6 pt-0 space-y-6">
        {/* Document Request Notification */}
        {pendingRequest && !activeRequest && (
          <Alert className="border-orange-200 bg-orange-50">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-medium mb-1">Documento requerido</p>
                  <p className="text-sm">{pendingRequest.message}</p>
                  {pendingRequest.dueDate && (
                    <p className="text-xs mt-1 flex items-center">
                      <Calendar className="h-3 w-3 mr-1" />
                      Fecha límite: {format(new Date(pendingRequest.dueDate), 'd MMM yyyy', { locale: es })}
                    </p>
                  )}
                </div>
                <Button
                  onClick={() => setActiveRequest(pendingRequest)}
                  className="bg-orange-600 hover:bg-orange-700 text-white ml-4"
                  size="sm"
                >
                  Subir documento
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
                    onChange={(e) => {
                      handleFileUpload(e);
                      if (e.target.files?.[0]) {
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
                className={selectedCategory === category.id ? "bg-[#007AFF] hover:bg-[#0056CC]" : ""}
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
                <Card key={document.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        category === 'nominas' ? 'bg-green-100' :
                        category === 'contratos' ? 'bg-blue-100' : 'bg-gray-100'
                      }`}>
                        <FileIcon className={`${
                          category === 'nominas' ? 'text-green-600' :
                          category === 'contratos' ? 'text-blue-600' : 'text-gray-600'
                        }`} size={24} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 truncate mb-1">
                          {document.originalName}
                        </h3>
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge 
                            variant="secondary" 
                            className={`text-xs ${
                              category === 'nominas' ? 'bg-green-100 text-green-700' :
                              category === 'contratos' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {category === 'nominas' ? 'Nómina' :
                             category === 'contratos' ? 'Contrato' : 'Documento'}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500">
                          {formatFileSize(document.fileSize)}
                        </p>
                        <p className="text-xs text-gray-400">
                          {format(new Date(document.createdAt), 'd MMM yyyy', { locale: es })}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between mt-4">
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDocument(document.id, document.originalName)}
                          className="text-[#007AFF] border-[#007AFF] hover:bg-[#007AFF] hover:text-white"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Ver
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(document.id, document.originalName)}
                          className="text-gray-600 border-gray-300 hover:bg-gray-50"
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Descargar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
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
                      <LoadingSpinner size="sm" className="mr-2" />
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
