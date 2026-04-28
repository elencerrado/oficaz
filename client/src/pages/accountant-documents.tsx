import { useMemo, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Folder, Download, ArrowLeft, ChevronRight, File } from 'lucide-react';
import { getAuthHeaders } from '@/lib/auth';
import { DocumentPreviewModal } from '@/components/DocumentPreviewModal';

interface Company {
  id: number;
  name: string;
  cif: string;
  logoUrl?: string;
}

interface Folder {
  id: number;
  name: string;
  parentId: number | null;
  path: string;
}

interface Document {
  id: number;
  name: string;
  fileUrl: string;
  uploadedAt: string;
  originalName?: string;
  fileSize?: number;
  mimeType?: string | null;
  folderId?: number | null;
  userId?: number;
  user?: {
    fullName: string;
    profilePicture?: string | null;
  };
  uploadedByUser: {
    fullName: string;
  };
}

export default function AccountantDocuments() {
  const { user } = useAuth();
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [folderStack, setFolderStack] = useState<Folder[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<{ id: number; name: string } | null>(null);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);

  const currentFolder = folderStack[folderStack.length - 1] || null;

  const { data: companies = [], isLoading: isLoadingCompanies } = useQuery<Company[]>({
    queryKey: ['/api/accountant/companies'],
    enabled: user?.role === 'accountant',
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnMount: false,
  });

  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === selectedCompanyId) || null,
    [companies, selectedCompanyId]
  );

  const { data: folders = [], isLoading: isLoadingFolders } = useQuery<Folder[]>({
    queryKey: ['/api/accountant/companies', selectedCompanyId, 'folders', currentFolder?.id || 'root'],
    enabled: !!selectedCompanyId,
    queryFn: async () => {
      const base = `/api/accountant/companies/${selectedCompanyId}/folders`;
      const url = currentFolder ? `${base}?parentId=${currentFolder.id}` : base;
      const response = await fetch(url, { headers: getAuthHeaders(), credentials: 'include' });
      if (!response.ok) throw new Error('Error cargando carpetas');
      return response.json();
    },
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnMount: false,
  });

  const { data: documents = [], isLoading: isLoadingDocuments } = useQuery<Document[]>({
    queryKey: ['/api/accountant/companies', selectedCompanyId, 'documents', currentFolder?.id || 'root'],
    enabled: !!selectedCompanyId,
    queryFn: async () => {
      if (!selectedCompanyId) return [];
      const url = currentFolder
        ? `/api/accountant/companies/${selectedCompanyId}/folders/${currentFolder.id}/documents`
        : `/api/accountant/companies/${selectedCompanyId}/root-documents`;
      const response = await fetch(url, { headers: getAuthHeaders(), credentials: 'include' });
      if (!response.ok) throw new Error('Error cargando documentos');
      return response.json();
    },
    refetchOnWindowFocus: false,
    staleTime: 60_000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
  });

  if (user?.role !== 'accountant') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Acceso Denegado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">No tienes permisos para acceder a esta página.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const employeeGroups = useMemo(() => {
    const map = new Map<number, { id: number; name: string; documents: Document[] }>();
    documents.forEach((doc) => {
      if (!doc.userId) return;
      if (!map.has(doc.userId)) {
        map.set(doc.userId, { id: doc.userId, name: doc.user?.fullName || 'Empleado', documents: [] });
      }
      map.get(doc.userId)!.documents.push(doc);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [documents]);

  const visibleDocuments = useMemo(() => {
    if (selectedEmployee) {
      return documents.filter((d) => d.userId === selectedEmployee.id);
    }
    return documents;
  }, [documents, selectedEmployee]);

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileText className="h-8 w-8" />
          Documentos
        </h1>
        <p className="text-muted-foreground mt-2">
          Accede a los documentos de tus empresas
        </p>
      </div>

      {/* Vista de Carpetas */}
      {!selectedCompanyId ? (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-muted-foreground">Empresas</h2>
          </div>
          {isLoadingCompanies ? (
            <div className="flex justify-center py-10 text-muted-foreground">Cargando...</div>
          ) : companies.length === 0 ? (
            <div className="text-muted-foreground">No tienes empresas asignadas</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {companies.map((company) => (
                <Card
                  key={company.id}
                  className="cursor-pointer transition-all hover:shadow-lg hover:scale-105"
                  onClick={() => { setSelectedCompanyId(company.id); setFolderStack([]); }}
                >
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center text-center gap-4">
                      <div className="w-20 h-20 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <Folder className="h-12 w-12 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg mb-1">{company.name}</h3>
                        <p className="text-sm text-muted-foreground">{company.cif}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Header con breadcrumb */}
          <div className="mb-6 flex items-center gap-2 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSelectedCompanyId(null); setFolderStack([]); }}
              className="text-blue-600 hover:text-blue-700"
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Volver a empresas
            </Button>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">{selectedCompany?.name}</span>
            {selectedEmployee && (
              <>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                <button
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  onClick={() => setSelectedEmployee(null)}
                >
                  Empleados
                </button>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{selectedEmployee.name}</span>
              </>
            )}
            {folderStack.map((folder, idx) => (
              <div key={folder.id} className="flex items-center gap-2">
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                <button
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  onClick={() => setFolderStack(folderStack.slice(0, idx + 1))}
                >
                  {folder.name}
                </button>
              </div>
            ))}
          </div>
          {/* Explorador principal */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Folder className="h-5 w-5" />
                Explorador
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingFolders || isLoadingDocuments ? (
                <div className="text-center py-8 text-muted-foreground">Cargando...</div>
              ) : (
                <div className="space-y-6">
                  {/* Vista Empleados (solo en raíz y sin carpeta contable abierta) */}
                  {!selectedEmployee && folderStack.length === 0 && employeeGroups.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-muted-foreground">Empleados</h3>
                      <div className="space-y-2">
                        {employeeGroups.map((emp) => (
                          <button
                            key={`emp-${emp.id}`}
                            type="button"
                            className="w-full flex items-center justify-between p-3 bg-card dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-blue-400 dark:hover:border-blue-600 transition-all"
                            onClick={() => { setSelectedEmployee({ id: emp.id, name: emp.name }); setFolderStack([]); }}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1 text-left">
                              <Folder className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold truncate">{emp.name}</p>
                                <p className="text-sm text-muted-foreground">{emp.documents.length} documento{emp.documents.length !== 1 ? 's' : ''}</p>
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Vista Contabilidad real (carpetas físicas) */}
                  {!selectedEmployee && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-muted-foreground">Contabilidad</h3>
                      {folders.length === 0 && documents.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground">Sin documentos</div>
                      ) : (
                        <div className="space-y-2">
                          {folders.map((folder) => (
                            <button
                              key={`folder-${folder.id}`}
                              type="button"
                              className="w-full flex items-center justify-between p-3 bg-card dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-blue-400 dark:hover:border-blue-600 transition-all"
                              onClick={() => setFolderStack([...folderStack, folder])}
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1 text-left">
                                <Folder className="h-6 w-6 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <p className="font-semibold truncate">{folder.name}</p>
                                  <p className="text-sm text-muted-foreground">Carpeta</p>
                                </div>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Listado de documentos (empleado seleccionado o carpeta contable) */}
                  {(selectedEmployee || folderStack.length > 0) && (
                    <div className="space-y-2">
                      {visibleDocuments.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground">No hay documentos</div>
                      ) : (
                        visibleDocuments.map((doc) => (
                          <div
                            key={`doc-${doc.id}`}
                            className="bg-card dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-all hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600"
                          >
                            <div className="flex items-stretch" onClick={() => setPreviewDoc(doc)}>
                              <div className="flex items-center justify-center px-3 py-2 flex-shrink-0">
                                <File className="h-5 w-5 text-muted-foreground" />
                              </div>
                              <div className="flex items-start p-3 min-w-0 flex-1 cursor-pointer">
                                <div className="min-w-0 flex-1 space-y-1">
                                  <p className="font-medium text-sm md:text-base text-foreground truncate">{doc.name}</p>
                                  <div className="text-xs md:text-sm text-muted-foreground flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
                                    {doc.user?.fullName && <span className="truncate">Empleado: {doc.user.fullName}</span>}
                                    <span className="hidden md:inline text-muted-foreground/50">•</span>
                                    <span>Subido por {doc.uploadedByUser.fullName}</span>
                                    <span className="hidden md:inline text-muted-foreground/50">•</span>
                                    <span>{formatDate(doc.uploadedAt)}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 px-3 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => window.open(doc.fileUrl, '_blank')}
                                >
                                  <Download className="h-4 w-4 mr-1" /> Descargar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setPreviewDoc(doc)}
                                >
                                  Ver
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <DocumentPreviewModal
        open={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        url={previewDoc?.fileUrl || ''}
        filename={previewDoc?.name || ''}
        mimeType={previewDoc?.mimeType || undefined}
      />
    </div>
  );
}
