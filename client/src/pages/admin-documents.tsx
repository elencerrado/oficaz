import { useState, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
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
  Trash2
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
    id: 'nomina', 
    name: 'Nómina', 
    icon: FileText,
    keywords: ['nomina', 'payroll', 'salary', 'salario', 'sueldo']
  },
  { 
    id: 'contrato', 
    name: 'Contrato', 
    icon: FileCheck,
    keywords: ['contrato', 'contract', 'agreement', 'acuerdo']
  },
  { 
    id: 'certificado', 
    name: 'Certificado Médico', 
    icon: Heart,
    keywords: ['certificado', 'medico', 'medical', 'doctor', 'baja']
  },
  { 
    id: 'vacaciones', 
    name: 'Solicitud Vacaciones', 
    icon: Plane,
    keywords: ['vacaciones', 'vacation', 'holiday', 'permiso']
  },
  { 
    id: 'dni', 
    name: 'DNI', 
    icon: User,
    keywords: ['dni', 'documento', 'identidad', 'cedula', 'id']
  },
  { 
    id: 'otros', 
    name: 'Otros', 
    icon: File,
    keywords: []
  }
];

export default function AdminDocuments() {
  const { user, company } = useAuth();
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
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; docId: number | null; docName: string }>({
    show: false,
    docId: null,
    docName: ''
  });

  // Fetch employees
  const { data: employees = [] } = useQuery({
    queryKey: ['/api/employees'],
  });

  // Fetch all documents
  const { data: allDocuments = [] } = useQuery({
    queryKey: ['/api/documents/all'],
    queryFn: async () => {
      return await apiRequest('GET', '/api/documents/all');
    },
  });

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
      queryClient.invalidateQueries({ queryKey: ['/api/documents/all'] });
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
      return await apiRequest(`/api/documents/${docId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents/all'] });
      toast({
        title: 'Documento eliminado',
        description: 'El documento se ha eliminado completamente del sistema',
      });
      setDeleteConfirm({ show: false, docId: null, docName: '' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error al eliminar',
        description: error.message || 'No se pudo eliminar el documento',
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

  const generateCleanFileName = (originalName: string, employee: Employee, docType: string) => {
    const extension = originalName.split('.').pop()?.toLowerCase() || 'pdf';
    
    // Get document type name
    const docTypeName = documentTypes.find(type => type.id === docType)?.name || 'Documento';
    
    // Format employee name (capitalize each word)
    const cleanEmployeeName = employee.fullName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    // Extract date info if present
    const dateMatch = originalName.match(/(\d{4}|\d{1,2}\/\d{4}|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i);
    const dateInfo = dateMatch ? ` ${dateMatch[0]}` : '';
    
    // Format: "Nómina Enero 2025 - Juan José Ramírez Martín.pdf"
    return `${docTypeName}${dateInfo} - ${cleanEmployeeName}.${extension}`;
  };

  const handleFileUpload = async (file: File, targetEmployeeId?: number, cleanFileName?: string) => {
    if (!file) return;
    
    setIsUploading(true);
    const formData = new FormData();
    
    // Create a new file with the clean name if provided
    if (cleanFileName) {
      const renamedFile = new File([file], cleanFileName, { type: file.type });
      formData.append('file', renamedFile);
    } else {
      formData.append('file', file);
    }
    
    if (targetEmployeeId) {
      formData.append('targetEmployeeId', targetEmployeeId.toString());
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

    sendDocumentMutation.mutate({
      employeeIds: selectedEmployees,
      documentType,
      message: message || `Por favor, sube tu ${documentTypes.find(t => t.id === documentType)?.name}`,
    });
  };

  const filteredDocuments = allDocuments.filter((doc: Document) => {
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

  const handleViewDocument = (docId: number, fileName: string) => {
    window.open(`/api/documents/${docId}/download?token=${JSON.parse(localStorage.getItem('authData') || '{}').token}`, '_blank');
  };

  const handleDownload = (docId: number, fileName: string) => {
    const link = document.createElement('a');
    link.href = `/api/documents/${docId}/download?token=${JSON.parse(localStorage.getItem('authData') || '{}').token}`;
    link.download = fileName;
    link.click();
  };

  const confirmDelete = (docId: number, docName: string) => {
    setDeleteConfirm({ show: true, docId, docName });
  };

  const handleDelete = () => {
    if (deleteConfirm.docId) {
      deleteMutation.mutate(deleteConfirm.docId);
    }
  };

  return (
    <PageWrapper>
      <div className="px-6 py-4 min-h-screen bg-gray-50" style={{ overflowX: 'clip' }}>
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Gestión de Documentos</h1>
          <p className="text-gray-500 mt-1">
            Gestiona documentos de empleados y envía solicitudes
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-blue-100">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Documentos</p>
                  <p className="text-2xl font-bold text-gray-900">{allDocuments.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-green-100">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Empleados</p>
                  <p className="text-2xl font-bold text-gray-900">{employees.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-orange-100">
                  <Send className="h-6 w-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Solicitudes Activas</p>
                  <p className="text-2xl font-bold text-gray-900">0</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-purple-100">
                  <Upload className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Subidos Hoy</p>
                  <p className="text-2xl font-bold text-gray-900">0</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Send Document Request */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Send className="h-5 w-5 mr-2" />
                Solicitar Documentos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1">
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
            </CardContent>
          </Card>

          {/* Upload Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Upload className="h-5 w-5 mr-2" />
                Subir Documentos
              </CardTitle>
            </CardHeader>
            <CardContent>
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
        </div>

        {/* Documents Explorer */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Search className="h-5 w-5 mr-2" />
              Explorador de Documentos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters */}
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
            </div>

            {/* Results count */}
            <div className="text-sm text-gray-600">
              Mostrando {filteredDocuments.length} documento{filteredDocuments.length !== 1 ? 's' : ''}
            </div>

            {/* Documents List */}
            {filteredDocuments.length > 0 ? (
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
                          {document.originalName}
                        </h3>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-sm text-gray-600">
                            {document.user?.fullName || 'Empleado desconocido'}
                          </span>
                          <span className="text-sm text-gray-500">
                            {formatFileSize(document.fileSize)}
                          </span>
                          <span className="text-sm text-gray-500">
                            {format(new Date(document.createdAt), 'd MMM yyyy', { locale: es })}
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
                          <p className="text-sm text-blue-600 mb-1">
                            📝 Nombre sugerido: {analysis.suggestedName}
                          </p>
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

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteConfirm.show} onOpenChange={(open) => !open && setDeleteConfirm({ show: false, docId: null, docName: '' })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center text-red-600">
                <Trash2 className="h-5 w-5 mr-2" />
                Confirmar Eliminación
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
    </div>
    </PageWrapper>
  );
}