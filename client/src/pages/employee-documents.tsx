import { useAuth } from '@/hooks/use-auth';
import { useFeatureCheck } from "@/hooks/use-feature-check";
import FeatureUnavailable from "@/components/feature-unavailable";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { 
  ArrowLeft, 
  FileText, 
  Download, 
  Upload, 
  Search, 
  Filter, 
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  File
} from 'lucide-react';
import { useLocation } from 'wouter';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Document {
  id: number;
  fileName: string;
  originalName: string;
  size: number;
  uploadedAt: string;
  category: string;
}

interface DocumentNotification {
  id: number;
  documentType: string;
  dueDate: string;
  message: string;
  isCompleted: boolean;
  createdAt: string;
}

export default function EmployeeDocuments() {
  const { user, company } = useAuth();
  const { hasAccess } = useFeatureCheck();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedDocumentType, setSelectedDocumentType] = useState('');
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);

  const canAccess = hasAccess('documents');

  if (!canAccess) {
    return <FeatureUnavailable feature="documents" />;
  }

  // Get user documents
  const { data: documents = [] } = useQuery<Document[]>({
    queryKey: ['/api/documents'],
    enabled: !!user,
  });

  // Get document notifications (requests from admin)
  const { data: notifications = [] } = useQuery<DocumentNotification[]>({
    queryKey: ['/api/document-notifications'],
    enabled: !!user,
  });

  // Upload document mutation
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return await apiRequest('POST', '/api/documents/upload', formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/document-notifications'] });
      toast({ title: 'Documento subido correctamente' });
      setUploadDialogOpen(false);
      setUploadingFile(null);
      setSelectedDocumentType('');
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error al subir documento', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast({
          title: 'Archivo demasiado grande',
          description: 'El archivo no puede superar los 10MB',
          variant: 'destructive'
        });
        return;
      }
      setUploadingFile(file);
    }
  };

  const handleUpload = () => {
    if (!uploadingFile) return;

    const formData = new FormData();
    formData.append('file', uploadingFile);
    if (selectedDocumentType) {
      formData.append('documentType', selectedDocumentType);
    }

    uploadMutation.mutate(formData);
  };

  const handleDownload = async (documentId: number, fileName: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/download`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authData') ? JSON.parse(localStorage.getItem('authData')!).token : ''}`
        }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      toast({
        title: 'Error al descargar',
        description: 'No se pudo descargar el documento',
        variant: 'destructive'
      });
    }
  };

  const getDocumentIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf': return <FileText className="w-5 h-5 text-red-500" />;
      case 'doc':
      case 'docx': return <FileText className="w-5 h-5 text-blue-500" />;
      case 'xls':
      case 'xlsx': return <FileText className="w-5 h-5 text-green-500" />;
      default: return <File className="w-5 h-5 text-gray-500" />;
    }
  };

  const getCategory = (fileName: string) => {
    const name = fileName.toLowerCase();
    if (name.includes('nomina') || name.includes('nómina')) return 'Nóminas';
    if (name.includes('contrato')) return 'Contratos';
    if (name.includes('irpf')) return 'IRPF';
    return 'Otros';
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.originalName.toLowerCase().includes(searchTerm.toLowerCase());
    const docCategory = getCategory(doc.originalName);
    const matchesCategory = categoryFilter === 'all' || docCategory.toLowerCase() === categoryFilter.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  const pendingNotifications = notifications.filter(n => !n.isCompleted);
  const completedNotifications = notifications.filter(n => n.isCompleted);

  return (
    <div className="h-screen bg-employee-gradient text-white flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const urlParts = window.location.pathname.split('/').filter(part => part.length > 0);
                const companyAlias = urlParts[0] || company?.companyAlias || 'test';
                setLocation(`/${companyAlias}`);
              }}
              className="text-white hover:bg-white/10"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Documentos</h1>
              <p className="text-white/70 text-sm">Gestiona tus documentos laborales</p>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6">
          {/* Pending notifications */}
          {pendingNotifications.length > 0 && (
            <div className="mb-6 mt-6">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-400" />
                Documentos Solicitados
              </h2>
              <div className="space-y-3">
                {pendingNotifications.map((notification) => (
                  <Card key={notification.id} className="bg-red-500/10 border-red-500/20">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-white">{notification.documentType}</h3>
                          <p className="text-sm text-white/70 mt-1">{notification.message}</p>
                          {notification.dueDate && (
                            <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Fecha límite: {format(new Date(notification.dueDate), 'dd/MM/yyyy', { locale: es })}
                            </p>
                          )}
                        </div>
                        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                          <DialogTrigger asChild>
                            <Button 
                              size="sm" 
                              className="bg-blue-600 hover:bg-blue-700"
                              onClick={() => setSelectedDocumentType(notification.documentType)}
                            >
                              <Upload className="w-4 h-4 mr-1" />
                              Subir
                            </Button>
                          </DialogTrigger>
                        </Dialog>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Search and filters */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar documentos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48 bg-white/10 border-white/20 text-white">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                <SelectItem value="nóminas">Nóminas</SelectItem>
                <SelectItem value="contratos">Contratos</SelectItem>
                <SelectItem value="irpf">IRPF</SelectItem>
                <SelectItem value="otros">Otros</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Documents list */}
          <div className="space-y-3">
            {filteredDocuments.length === 0 ? (
              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-8 text-center">
                  <FileText className="w-12 h-12 text-white/40 mx-auto mb-3" />
                  <p className="text-white/70">
                    {searchTerm || categoryFilter !== 'all' 
                      ? 'No se encontraron documentos con los filtros aplicados'
                      : 'No tienes documentos subidos aún'
                    }
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredDocuments.map((doc) => (
                <Card key={doc.id} className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getDocumentIcon(doc.originalName)}
                        <div>
                          <h3 className="font-medium text-white">{doc.originalName}</h3>
                          <div className="flex items-center gap-4 mt-1">
                            <Badge variant="outline" className="text-xs border-white/20 text-white/70">
                              {getCategory(doc.originalName)}
                            </Badge>
                            <span className="text-xs text-white/50">
                              {format(new Date(doc.uploadedAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                            </span>
                            <span className="text-xs text-white/50">
                              {(doc.size / 1024 / 1024).toFixed(1)} MB
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(doc.id, doc.originalName)}
                        className="border-white/20 text-white hover:bg-white/10"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="bg-gray-800 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Subir Documento</DialogTitle>
            <DialogDescription className="text-gray-300">
              {selectedDocumentType ? `Subir: ${selectedDocumentType}` : 'Selecciona un archivo para subir'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                onChange={handleFileUpload}
                className="bg-gray-700 border-gray-600"
              />
              <p className="text-xs text-gray-400 mt-1">
                Archivos soportados: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG (máx. 10MB)
              </p>
            </div>
            {uploadingFile && (
              <div className="p-3 bg-gray-700 rounded-lg">
                <p className="text-sm font-medium">{uploadingFile.name}</p>
                <p className="text-xs text-gray-400">
                  {(uploadingFile.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setUploadDialogOpen(false);
                  setUploadingFile(null);
                  setSelectedDocumentType('');
                }}
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!uploadingFile || uploadMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {uploadMutation.isPending ? (
                  <>
                    <Clock className="w-4 h-4 mr-2 animate-spin" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Subir
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}