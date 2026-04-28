import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { UserAvatar } from '@/components/ui/user-avatar';
import { DocumentSignatureModal } from '@/components/document-signature-modal';
import { SignaturePositionEditor } from '@/components/signature-position-editor';
import { DatePickerPeriod } from '@/components/ui/date-picker';
import { useQuery, useMutation, useInfiniteQuery } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { getAuthHeaders } from '@/lib/auth';
import { logger } from '@/lib/logger';
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
  Folder,
  FolderOpen,
  Receipt,
  FileSignature,
  Loader2,
  Undo2,
  Clock,
  Home,
  ArrowLeft,
  ImageIcon,
  ChevronDown,
  RotateCcw,
  Pencil
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { analyzeFileName, documentTypes as importedDocumentTypes } from '@/utils/documentUtils';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { DocumentPreviewModal } from '@/components/DocumentPreviewModal';
import { useTeams, resolveTeamMemberIds } from '@/hooks/use-teams';
import { EmployeeScopeDropdown } from '@/components/ui/employee-scope-dropdown';
import { useStandardInfiniteScroll } from '@/hooks/use-standard-infinite-scroll';
import { useIsMobile } from '@/hooks/use-mobile';

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
  folderId?: number | null;
  accountingType?: 'expense' | 'income' | null;
  user?: {
    fullName: string;
    profilePicture?: string;
  };
}

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
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const search = useSearch();
  
  // Use documentTypes from shared utilities with icons - moved inside component
  const documentTypes = useMemo(() => (importedDocumentTypes || []).map(type => ({
    ...type,
    icon: type.id === 'dni' ? User :
          type.id === 'nomina' ? DollarSign :
          type.id === 'contrato' ? FileText :
          type.id === 'justificante' ? FileCheck :
          File
  })), []);
  const payrollDocumentTypeName = useMemo(
    () => documentTypes.find((type) => type.id === 'nomina')?.name ?? '',
    [documentTypes]
  );
  
  // Get document access mode: 'full', 'self', or 'none'
  const documentAccessMode = getDocumentAccessMode();
  const isSelfAccessOnly = documentAccessMode === 'self';
  
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);
  const [documentType, setDocumentType] = useState('');
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [selectedEmployeeTeamFilter, setSelectedEmployeeTeamFilter] = useState<string>('all');
  const [filterPendingSignature, setFilterPendingSignature] = useState(false); // Filter for unsigned payrolls
  const [downloadingZipMonth, setDownloadingZipMonth] = useState<string | null>(null); // Track ZIP downloads
  const [documentStartDate, setDocumentStartDate] = useState<Date | undefined>(undefined); // Document date range filter
  const [documentEndDate, setDocumentEndDate] = useState<Date | undefined>(undefined);
  const [signatureFilter, setSignatureFilter] = useState<'all' | 'signed' | 'unsigned'>('all'); // Filter documents by signature status
  const [documentTypeFilter, setDocumentTypeFilter] = useState<string>('all'); // Filter documents by type
  const [bulkActionMode, setBulkActionMode] = useState(false); // Enable/disable bulk selection mode
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<Set<number>>(new Set()); // Selected document IDs for bulk actions
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState<{ show: boolean; documentCount: number }>({ show: false, documentCount: 0 }); // Bulk delete confirmation modal
  const [showMobileFilters, setShowMobileFilters] = useState(false); // Show/hide filters modal on mobile
  
  // Estados para filtros de requests
  const [requestEmployeeFilter, setRequestEmployeeFilter] = useState<string>('all');
  const [requestTeamFilter, setRequestTeamFilter] = useState<string>('all');
  const [requestTypeFilter, setRequestTypeFilter] = useState('all');
  const [requestStatusFilter, setRequestStatusFilter] = useState('all');
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadAnalysis, setUploadAnalysis] = useState<any[]>([]);
  const [showUploadPreview, setShowUploadPreview] = useState(false);
  // For self-access only mode, start on explorer tab (their own files)
  const [activeTab, setActiveTab] = useState(isSelfAccessOnly ? 'explorer' : 'upload'); // 'upload', 'explorer', 'requests'
  const [viewMode, setViewMode] = useState<'list' | 'folders'>('list');
  const [currentFolderPath, setCurrentFolderPath] = useState<string>('');
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
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  
  // Upload Preview Dialog state - Individual/Circular mode
  const [uploadMode, setUploadMode] = useState<'individual' | 'circular'>('individual');
  const [uploadRequiresSignature, setUploadRequiresSignature] = useState(false);
  const [uploadSelectedEmployees, setUploadSelectedEmployees] = useState<number[]>([]);
  const [uploadEmployeeSearch, setUploadEmployeeSearch] = useState('');
  
  // Signature position editor state
  const [signaturePosition, setSignaturePosition] = useState<{ x: number; y: number; width: number; height: number; page: number } | null>(null);
  const [showSignatureEditor, setShowSignatureEditor] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  
  // Last circular upload tracking for undo functionality
  const [lastCircularUpload, setLastCircularUpload] = useState<{
    documentIds: number[];
    fileName: string;
    employeeCount: number;
    timestamp: Date;
  } | null>(null);
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);
  
  // Inline edit state for document names
  const [editingDocumentId, setEditingDocumentId] = useState<number | null>(null);
  const [editingDocumentName, setEditingDocumentName] = useState<string>('');
  
  // Folder expansion state for folder view
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Set page header based on access mode
  useEffect(() => {
    setHeader({
      title: isSelfAccessOnly ? 'Mis Documentos' : 'Gestión de Documentos',
      subtitle: isSelfAccessOnly ? 'Visualiza tus documentos personales' : 'Gestiona documentos de empleados y envía solicitudes'
    });
    return () => resetHeader();
  }, [isSelfAccessOnly, setHeader, resetHeader]);
  
  // Only block if no access at all (subscription not active)
  if (documentAccessMode === 'none') {
    return (
      <FeatureRestrictedPage
        featureName="Documentos"
        description="Gestión y almacenamiento de documentos de la empresa"
        icon={FileText}
      />
    );
  }
  
  // Loading state for document operations
  const [viewingDocId, setViewingDocId] = useState<number | null>(null);
  const [downloadingDocId, setDownloadingDocId] = useState<number | null>(null);

  // Fetch employees (optimized - employees don't change often)
  const { data: employees = [], isLoading: loadingEmployees } = useQuery<Employee[]>({
    queryKey: ['/api/employees'],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    select: (data: Employee[] = []) => data.filter((e: any) => !e?.isPendingActivation)
  });

  const { data: teams = [] } = useTeams(!isSelfAccessOnly);

  // Fetch document notifications (sent requests)
  // WebSocket handles document_* events - no polling needed!
  const { data: sentRequests = [], isLoading: loadingRequests } = useQuery<any[]>({
    queryKey: ['/api/document-notifications'],
    staleTime: 60000, // Cache for 1 min - WebSocket invalidates on changes
    gcTime: 120000,
  });

  // Memoize filtered requests to avoid recalculation on every render
  const filteredRequests = useMemo(() => {
    const selectedTeamId = requestTeamFilter !== 'all' ? parseInt(requestTeamFilter, 10) : null;
    const selectedTeamMembers = selectedTeamId ? new Set(resolveTeamMemberIds(teams, selectedTeamId)) : null;

    return (sentRequests || []).filter((request: any) => {
      const matchesEmployee = requestEmployeeFilter === "all" || request.userId === parseInt(requestEmployeeFilter);
      const matchesTeam = !selectedTeamMembers || selectedTeamMembers.has(request.userId);
      const matchesType = requestTypeFilter === "all" || request.documentType === requestTypeFilter;
      
      // Determinar el estado de la solicitud
      let requestStatus: string;
      if (!request.isCompleted) {
        requestStatus = 'pending';
      } else if (request.document) {
        requestStatus = 'completed';
      } else {
        requestStatus = 'incomplete';
      }
      
      const matchesStatus = requestStatusFilter === "all" || requestStatus === requestStatusFilter;
      
      return matchesEmployee && matchesTeam && matchesType && matchesStatus;
    });
  }, [sentRequests, requestEmployeeFilter, requestTeamFilter, requestTypeFilter, requestStatusFilter, teams]);

  // Fetch all documents - WebSocket handles real-time updates
  // Infinite scroll state
  const isMobile = useIsMobile();
  const ITEMS_PER_LOAD = isMobile ? 8 : 12;
  const INITIAL_ITEMS = isMobile ? 8 : 12;
  const [displayedCount, setDisplayedCount] = useState(INITIAL_ITEMS);
  const [displayedRequestsCount, setDisplayedRequestsCount] = useState(INITIAL_ITEMS);
  const [previewModal, setPreviewModal] = useState<{ open: boolean; url: string; filename: string; mimeType?: string | null; docId: number | null }>({ open: false, url: '', filename: '', mimeType: null, docId: null });
  const DOCUMENTS_PER_PAGE = 50;
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const loadMoreRequestsRef = useRef<HTMLDivElement>(null);

  // useInfiniteQuery for proper infinite scroll
  const {
    data: infiniteData,
    isLoading: loadingDocuments,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ['/api/documents/all'],
    queryFn: async ({ pageParam = 0 }) => {
      const url = `/api/documents/all?limit=${DOCUMENTS_PER_PAGE}&offset=${pageParam}`;
      const response = await apiRequest('GET', url);
      const documents = Array.isArray(response) ? response : (response?.documents || []);
      const totalCount = response?.totalCount || documents.length;
      return {
        documents,
        totalCount,
        hasMore: documents.length === DOCUMENTS_PER_PAGE
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      return allPages.length * DOCUMENTS_PER_PAGE;
    },
    staleTime: 30000, // Cache for 30s
    gcTime: 10 * 60 * 1000,
    retry: 2,
    refetchOnMount: false, // Reuse warm cache on remount within stale window
  });

  // Flatten all pages into single documents array
  const allDocuments = useMemo(() => {
    if (!infiniteData?.pages) return [];
    return infiniteData.pages.flatMap(page => page.documents || []);
  }, [infiniteData]);

  // Get total count from last page
  const totalDocumentsCount = infiniteData?.pages?.[infiniteData.pages.length - 1]?.totalCount || 0;

  // Helper function for text normalization
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
    const selectedTeamId = selectedEmployeeTeamFilter !== 'all' ? parseInt(selectedEmployeeTeamFilter, 10) : null;
    const selectedTeamMembers = selectedTeamId ? new Set(resolveTeamMemberIds(teams, selectedTeamId)) : null;
    
    // Split search term into words and check if ALL words are found
    const searchWords = normalizeText(searchTerm).split(/\s+/).filter(word => word.length > 0);
    const matchesSearch = searchWords.length === 0 || 
                         searchWords.every(word => combinedText.includes(word));
    
    // In self-access mode, don't filter by employee (already filtered to self)
    const matchesEmployee = isSelfAccessOnly || (
      (selectedEmployee === 'all' || doc.userId.toString() === selectedEmployee) &&
      (!selectedTeamMembers || selectedTeamMembers.has(doc.userId))
    );
    
    // Filter by pending signature (unsigned payrolls OR documents with requiresSignature flag)
    let matchesPendingSignature = true;
    if (filterPendingSignature && employees && employees.length > 0) {
      const fileName = doc.originalName || doc.fileName || '';
      const analysis = analyzeFileName(fileName, employees);
      const isPayroll = analysis.documentType === payrollDocumentTypeName;
      const requiresSignature = (doc as any).requiresSignature === true;
      matchesPendingSignature = (isPayroll || requiresSignature) && !doc.signedAt;
    }

    // Filter by date range
    let matchesDateRange = true;
    if (documentStartDate !== undefined || documentEndDate !== undefined) {
      const docDate = new Date(doc.createdAt);
      const startOfDay = documentStartDate ? new Date(documentStartDate) : null;
      const endOfDay = documentEndDate ? new Date(documentEndDate) : null;
      if (startOfDay) startOfDay.setHours(0, 0, 0, 0);
      if (endOfDay) endOfDay.setHours(23, 59, 59, 999);
      
      if (startOfDay && docDate < startOfDay) matchesDateRange = false;
      if (endOfDay && docDate > endOfDay) matchesDateRange = false;
    }

    // Filter by signature status
    let matchesSignatureFilter = true;
    if (signatureFilter === 'signed') {
      matchesSignatureFilter = doc.signedAt !== null && doc.signedAt !== undefined;
    } else if (signatureFilter === 'unsigned') {
      matchesSignatureFilter = !doc.signedAt;
    }
    // 'all' matches everything

    // Filter by document type
    let matchesDocumentType = true;
    if (documentTypeFilter !== 'all' && employees && employees.length > 0) {
      const fileName = doc.originalName || doc.fileName || '';
      const analysis = analyzeFileName(fileName, employees);
      matchesDocumentType = analysis.documentType === importedDocumentTypes.find(dt => dt.id === documentTypeFilter)?.name;
    }
    
    return matchesSearch && matchesEmployee && matchesPendingSignature && matchesDateRange && matchesSignatureFilter && matchesDocumentType;
  });

  // hasMore is true if we have more items to display (either locally or on server)
  const hasMoreToDisplay = displayedCount < totalDocumentsCount || (hasNextPage ?? false);

  // Apply pagination for display (limit shown documents)
  const displayedDocuments = filteredDocuments.slice(0, displayedCount);

  // Load more function for infinite scroll - first show more from loaded data, then fetch from server
  const loadMoreDocuments = useCallback(() => {
    logger.log('[DOCS] loadMoreDocuments called', {
      displayedCount, 
      filteredLength: filteredDocuments.length, 
      hasNextPage, 
      isFetchingNextPage 
    });
    
    // First, check if we have more documents loaded that we haven't displayed yet
    if (displayedCount < filteredDocuments.length) {
      const newCount = Math.min(displayedCount + ITEMS_PER_LOAD, filteredDocuments.length);
      setDisplayedCount(newCount);
      return;
    }

    // If we've displayed all loaded documents and there are more on the server, fetch next page
    if (!isFetchingNextPage && hasNextPage) {
      fetchNextPage();
      return;
    }

    // Fallback: if server reports more total items than we have loaded, try fetch next page
    if (!isFetchingNextPage && displayedCount < totalDocumentsCount) {
      fetchNextPage();
    }
  }, [displayedCount, filteredDocuments.length, hasNextPage, isFetchingNextPage, fetchNextPage, ITEMS_PER_LOAD, totalDocumentsCount]);

  // Reset displayed count when filters change
  useEffect(() => {
    setDisplayedCount(INITIAL_ITEMS);
  }, [searchTerm, selectedEmployee, selectedEmployeeTeamFilter, filterPendingSignature, documentStartDate, documentEndDate, signatureFilter, documentTypeFilter, INITIAL_ITEMS]);

  useStandardInfiniteScroll({
    targetRef: loadMoreRef,
    enabled: activeTab === 'explorer' && !loadingDocuments,
    canLoadMore: hasMoreToDisplay,
    isLoadingMore: isFetchingNextPage,
    onLoadMore: loadMoreDocuments,
    dependencyKey: `${activeTab}-${displayedCount}-${totalDocumentsCount}-${filteredDocuments.length}`,
    rootMargin: '100px',
  });

  useStandardInfiniteScroll({
    targetRef: loadMoreRequestsRef,
    enabled: activeTab === 'requests',
    canLoadMore: filteredRequests.length > displayedRequestsCount,
    onLoadMore: () => {
      setDisplayedRequestsCount((prev) => Math.min(prev + ITEMS_PER_LOAD, filteredRequests.length));
    },
    dependencyKey: `${activeTab}-${displayedRequestsCount}-${filteredRequests.length}`,
    rootMargin: '100px',
  });

  // Reset displayed requests count when filters change
  useEffect(() => {
    setDisplayedRequestsCount(INITIAL_ITEMS);
  }, [requestEmployeeFilter, requestTeamFilter, requestTypeFilter, requestStatusFilter, INITIAL_ITEMS]);

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
        title: 'Solicitud enviada',
        description: 'Se ha enviado la solicitud de documento a los empleados seleccionados',
      });
      setSelectedEmployees([]);
      setDocumentType('');
      setMessage('');
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

  // Rename document mutation
  const renameMutation = useMutation({
    mutationFn: async ({ docId, originalName, fileName }: { docId: number; originalName: string; fileName: string }) => {
      const response = await fetch(`/api/documents/${docId}/rename`, {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ originalName, fileName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al renombrar documento');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents/all'] });
      queryClient.refetchQueries({ queryKey: ['/api/documents/all'] });
      toast({
        title: 'Documento renombrado',
        description: 'El nombre del documento se actualizó correctamente',
      });
      setEditingDocumentId(null);
      setEditingDocumentName('');
    },
    onError: (error: any) => {
      console.error('Rename error:', error);
      toast({
        title: 'Error al renombrar',
        description: error.message || 'No se pudo renombrar el documento',
        variant: 'destructive',
      });
      setEditingDocumentId(null);
      setEditingDocumentName('');
    },
  });

  // Download payroll documents for a specific month as ZIP
  const handleDownloadPayrollMonth = async (year: string, month: string) => {
    try {
      const monthKey = `${year}-${month}`;
      setDownloadingZipMonth(monthKey);
      
      const response = await fetch(`/api/documents/payroll/download-month?year=${year}&month=${month}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error downloading payroll file');
      }

      // Create blob from response
      const blob = await response.blob();
      
      // Create download link and trigger download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Nominas_${year}_${month}.zip`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Descargado',
        description: `Nóminas de ${month}/${year} descargadas correctamente`,
      });
    } catch (error: any) {
      console.error('Error downloading payroll ZIP:', error);
      toast({
        title: 'Error',
        description: error.message || 'Error al descargar las nóminas',
        variant: 'destructive',
      });
    } finally {
      setDownloadingZipMonth(null);
    }
  };

  // Use analyzeFileName from shared utilities

  // PROTECTED - DO NOT MODIFY: Generate clean filename with document type, employee name and date
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
    
    // PROTECTED - DO NOT MODIFY: Month detection logic fixed to avoid false positives
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

  const handleFileUpload = async (file: File, targetEmployeeId?: number, cleanFileName?: string, requiresSignature?: boolean, signaturePosition?: { x: number; y: number; width: number; height: number; page: number }) => {
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
      // Send signature position if available
      if (signaturePosition) {
        formData.append('signaturePosition', JSON.stringify(signaturePosition));
      }
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
            // Send signature position if available
            if (signaturePosition) {
              formData.append('signaturePosition', JSON.stringify(signaturePosition));
            }
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
            await handleFileUpload(analysis.file, analysis.employee.id, cleanFileName, uploadRequiresSignature, signaturePosition || undefined);
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
      // PROTECTED - DO NOT MODIFY: Convert document type name to ID for Select component
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

  const addTeamToRequestSelection = (teamId: number) => {
    const memberIds = resolveTeamMemberIds(teams, teamId);
    if (memberIds.length === 0) return;
    setSelectedEmployees((prev) => Array.from(new Set([...prev, ...memberIds])));
  };

  const toggleTeamInUploadSelection = (teamId: number) => {
    const memberIds = resolveTeamMemberIds(teams, teamId);
    if (memberIds.length === 0) return;
    const allSelected = memberIds.every((id) => uploadSelectedEmployees.includes(id));
    if (allSelected) {
      setUploadSelectedEmployees((prev) => prev.filter((id) => !memberIds.includes(id)));
      return;
    }
    setUploadSelectedEmployees((prev) => Array.from(new Set([...prev, ...memberIds])));
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
      message: message || `Por favor, sube tu ${documentTypeName.toLowerCase()}`,
      requiresSignature: false,
      isCircular: false,
    });
  };

  // Organize documents into folder structure for file browser view
  const organizeFolderStructure = () => {
    interface FolderStructure {
      [key: string]: {
        name: string;
        icon: any;
        documents: Document[];
        subfolders?: FolderStructure;
        employeeData?: { userId: number; fullName: string; profilePicture: string | null };
      };
    }

    const structure: FolderStructure = {};

    // 1. Contabilidad folder (accounting documents with folderId)
    const accountingDocs = filteredDocuments.filter((doc: any) => {
      // Document must have a folderId
      if (!doc.folderId) return false;
      
      // If we have folder.path info, only include contabilidad paths
      // If we don't have folder.path yet, include all documents with folderId (backward compatibility)
      if (doc.folder?.path) {
        return doc.folder.path.startsWith('contabilidad');
      }
      
      // Fallback: include any document with folderId
      return true;
    });
    
    if (accountingDocs.length > 0) {
      const yearSubfolders: FolderStructure = {};
      
      // Organize by year and month
      accountingDocs.forEach((doc: any) => {
        const pathParts = doc.folder?.path?.split('/') || [];
        
        // If we don't have path info, put in a default location
        if (pathParts.length < 3) {
          return; // Skip if no proper path
        }
        
        const year = pathParts[1]; // e.g., "2025"
        const month = pathParts[2]; // e.g., "12"
        
        // Create year folder if doesn't exist
        if (!yearSubfolders[year]) {
          yearSubfolders[year] = {
            name: year,
            icon: Folder,
            documents: [],
            subfolders: {}
          };
        }
        
        // Create month folder if doesn't exist
        if (month && !yearSubfolders[year].subfolders![month]) {
          const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                             'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
          const monthIndex = parseInt(month) - 1;
          
          yearSubfolders[year].subfolders![month] = {
            name: monthNames[monthIndex] || month,
            icon: Folder,
            documents: []
          };
        }
        
        // Add document to month folder
        if (month) {
          yearSubfolders[year].subfolders![month].documents.push(doc);
        }
      });
      
      structure['contabilidad'] = {
        name: 'Contabilidad',
        icon: Receipt,
        documents: [],
        subfolders: yearSubfolders
      };
    }

    // 2. Nóminas folder (payrolls organized by month)
    const payrollDocs = filteredDocuments.filter((doc: Document) => {
      if (doc.folderId) return false; // Skip accounting docs
      const fileName = doc.originalName || doc.fileName || '';
      const analysis = analyzeFileName(fileName, employees);
      return analysis.documentType === payrollDocumentTypeName;
    });

    if (payrollDocs.length > 0 && !isSelfAccessOnly) {
      const payrollYearSubfolders: FolderStructure = {};
      const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                          'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      const monthKeywords = [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
      ];

      // Organize payrolls by year and month
      payrollDocs.forEach((doc: Document) => {
        const fileName = (doc.originalName || doc.fileName || '').toLowerCase();
        
        // Try to extract year and month from filename
        // Patterns: "Nomina Enero 2025", "Nómina_Febrero_2026.pdf", etc.
        let year = '';
        let monthIndex = -1;

        // Extract year (look for 4-digit year like 2025, 2026)
        const yearMatch = fileName.match(/20\d{2}/);
        if (yearMatch) {
          year = yearMatch[0];
        } else {
          // Fallback to creation date year
          const createdDate = new Date(doc.createdAt);
          year = createdDate.getFullYear().toString();
        }

        // Extract month (look for month names)
        for (let i = 0; i < monthKeywords.length; i++) {
          if (fileName.includes(monthKeywords[i])) {
            monthIndex = i;
            break;
          }
        }

        // If no month found in filename, use creation date month
        if (monthIndex === -1) {
          const createdDate = new Date(doc.createdAt);
          monthIndex = createdDate.getMonth();
        }

        const monthKey = (monthIndex + 1).toString().padStart(2, '0'); // "01", "02", etc.

        // Create year folder if doesn't exist
        if (!payrollYearSubfolders[year]) {
          payrollYearSubfolders[year] = {
            name: year,
            icon: Folder,
            documents: [],
            subfolders: {}
          };
        }

        // Create month folder if doesn't exist
        if (!payrollYearSubfolders[year].subfolders![monthKey]) {
          payrollYearSubfolders[year].subfolders![monthKey] = {
            name: monthNames[monthIndex],
            icon: Folder,
            documents: []
          };
        }

        // Add document to month folder
        payrollYearSubfolders[year].subfolders![monthKey].documents.push(doc);
      });

      structure['nominas'] = {
        name: 'Nóminas',
        icon: DollarSign,
        documents: [],
        subfolders: payrollYearSubfolders
      };
    }

    // 3. Empleados folder (employee documents)
    const employeeDocs = filteredDocuments.filter((doc: Document) => !doc.folderId && doc.userId !== user?.id);
    if (employeeDocs.length > 0 && !isSelfAccessOnly) {
      const employeeSubfolders: FolderStructure = {};
      
      // Group by employee
      employeeDocs.forEach((doc: Document) => {
        const employeeId = `employee-${doc.userId}`;
        const employeeName = doc.user?.fullName || 'Empleado desconocido';
        
        if (!employeeSubfolders[employeeId]) {
          employeeSubfolders[employeeId] = {
            name: employeeName,
            icon: User,
            documents: [],
            subfolders: {},
            employeeData: {
              userId: doc.userId,
              fullName: employeeName,
              profilePicture: doc.user?.profilePicture || null
            }
          };
        }
        
        // Categorize by document type within employee
        const fileName = doc.originalName || doc.fileName || '';
        const analysis = analyzeFileName(fileName, employees);
        const foundDocType = documentTypes.find(dt => dt.name === analysis.documentType);
        const type = foundDocType ? foundDocType.id : 'otros';
        
        if (!employeeSubfolders[employeeId].subfolders![type]) {
          const typeNames: { [key: string]: string } = {
            dni: 'DNI',
            nomina: 'Nóminas',
            contrato: 'Contratos',
            justificante: 'Justificantes',
            otros: 'Otros'
          };
          
          employeeSubfolders[employeeId].subfolders![type] = {
            name: typeNames[type] || 'Otros',
            icon: foundDocType?.icon || File,
            documents: []
          };
        }
        
        employeeSubfolders[employeeId].subfolders![type].documents.push(doc);
      });
      
      structure['empleados'] = {
        name: 'Empleados',
        icon: Users,
        documents: [],
        subfolders: employeeSubfolders
      };
    }

    // 4. Mis Documentos (current user's documents)
    const myDocs = filteredDocuments.filter((doc: Document) => !doc.folderId && doc.userId === user?.id);
    if (myDocs.length > 0) {
      const mySubfolders: FolderStructure = {};
      
      myDocs.forEach((doc: Document) => {
        const fileName = doc.originalName || doc.fileName || '';
        const analysis = analyzeFileName(fileName, employees);
        const foundDocType = documentTypes.find(dt => dt.name === analysis.documentType);
        const type = foundDocType ? foundDocType.id : 'otros';
        
        if (!mySubfolders[type]) {
          const typeNames: { [key: string]: string } = {
            dni: 'DNI',
            nomina: 'Nóminas',
            contrato: 'Contratos',
            justificante: 'Justificantes',
            otros: 'Otros'
          };
          
          mySubfolders[type] = {
            name: typeNames[type] || 'Otros',
            icon: foundDocType?.icon || File,
            documents: []
          };
        }
        
        mySubfolders[type].documents.push(doc);
      });
      
      structure['mis-documentos'] = {
        name: 'Mis Documentos',
        icon: Folder,
        documents: [],
        subfolders: mySubfolders
      };
    }

    return structure;
  };

  const folderStructure = organizeFolderStructure();

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (extension === 'pdf') return FileText;
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension || '')) return ImageIcon;
    return FileText;
  };



  // SECURITY: Generate signed URL for secure document access
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
      // SECURITY: Use signed URL instead of JWT token
      const signedUrl = await generateSignedUrl(docId);
      if (!signedUrl) {
        setDownloadingDocId(null);
        return;
      }

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
      const signedUrl = await generateSignedUrl(docId);
      if (!signedUrl) {
        setViewingDocId(null);
        return;
      }
      const docToView = allDocuments?.find((d: any) => d.id === docId);
      setPreviewModal({
        open: true,
        url: signedUrl,
        filename: docToView?.folderId ? docToView.fileName : (docToView?.originalName || docToView?.fileName || 'Documento'),
        mimeType: docToView?.mimeType,
        docId: docId,
      });
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

  // Handle inline document name editing
  const handleStartEditDocument = (docId: number, currentName: string) => {
    setEditingDocumentId(docId);
    setEditingDocumentName(currentName);
  };

  const handleCancelEditDocument = () => {
    setEditingDocumentId(null);
    setEditingDocumentName('');
  };

  const handleSaveEditDocument = async (docId: number, currentDocument: any) => {
    if (!editingDocumentName.trim()) {
      toast({
        title: 'Error',
        description: 'El nombre del documento no puede estar vacío',
        variant: 'destructive',
      });
      return;
    }

    const trimmedName = editingDocumentName.trim();

    // Extract filename and extension
    const parts = trimmedName.split('.');
    const extension = parts.length > 1 ? parts.pop() : '';
    const nameWithoutExt = parts.join('.');

    const fileName = extension ? `${nameWithoutExt}.${extension}` : trimmedName;
    const originalName = trimmedName;

    renameMutation.mutate({ docId, originalName, fileName });
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
                const isPayroll = analysis.documentType === payrollDocumentTypeName;
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
                const isPayroll = analysis.documentType === payrollDocumentTypeName;
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
          <div className="space-y-4">
            {/* Undo Last Circular Upload */}
            {lastCircularUpload && (
              <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700">
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
                      <LoadingSpinner size="xs" className="mr-1" />
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
                  Detección inteligente: Los archivos se asignarán automáticamente al empleado correcto
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
                        // PROTECTED - DO NOT MODIFY: Convert document type name to ID for Select component
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
                      <li>⬢ Archivo: <strong>{lastCircularUpload.fileName}</strong></li>
                      <li>⬢ {lastCircularUpload.documentIds.length} copias enviadas a {lastCircularUpload.employeeCount} empleado(s)</li>
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
                      <LoadingSpinner size="xs" className="mr-2" />
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
          </div>
        )}

        {activeTab === 'explorer' && (
          <div className="space-y-4">
            {/* Filters Section - Two rows layout */}
            <div className="flex flex-col gap-3">
              {/* Row 1: Document count, search bar, view mode toggle */}
              <div className="flex flex-wrap items-center gap-2 w-full">
                {/* Contador */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg">
                  <span className="text-sm font-medium text-foreground">{totalDocumentsCount}</span>
                  <span className="text-sm text-muted-foreground">documento{totalDocumentsCount !== 1 ? 's' : ''}</span>
                </div>

                {/* Buscador */}
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
                    <Input
                      placeholder="Buscar documentos..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Toggle vista */}
                <div className="flex bg-muted rounded-lg p-0.5 ml-auto">
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className="px-3 h-9"
                    title="Vista de lista"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'folders' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('folders')}
                    className="px-3 h-9"
                    title="Vista de carpetas"
                  >
                    <Folder className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Row 2: Desktop filters (visible on md and up), Mobile filters button - No wrap, single line */}
              {viewMode === 'list' && (
              <div className="flex flex-nowrap items-center gap-1.5 w-full overflow-x-auto pb-1">
                {/* Reset filters button - Always visible */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedEmployee('all');
                    setSelectedEmployeeTeamFilter('all');
                    setDocumentTypeFilter('all');
                    setDocumentStartDate(undefined);
                    setDocumentEndDate(undefined);
                    setSignatureFilter('all');
                    setBulkActionMode(false);
                    setSelectedDocumentIds(new Set());
                  }}
                  className="h-9 w-9 p-0 flex-shrink-0"
                  title="Resetear todos los filtros"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>

                {/* Desktop filters - Hidden on mobile, visible on md and up - No wrap */}
                <div className="hidden md:flex flex-nowrap items-center gap-1.5 flex-1 overflow-x-auto">
                  {/* Filtro empleado - Searchable */}
                  {!isSelfAccessOnly && (
                    <EmployeeScopeDropdown
                      employees={employees.map((employee) => ({ id: employee.id, fullName: employee.fullName }))}
                      teams={teams.map((team) => ({ id: team.id, name: team.name }))}
                      value={
                        selectedEmployeeTeamFilter !== 'all'
                          ? { type: 'team', id: parseInt(selectedEmployeeTeamFilter, 10) }
                          : selectedEmployee !== 'all'
                            ? { type: 'employee', id: parseInt(selectedEmployee, 10) }
                            : { type: 'all' }
                      }
                      onChange={(value) => {
                        if (value.type === 'all') {
                          setSelectedEmployee('all');
                          setSelectedEmployeeTeamFilter('all');
                          return;
                        }

                        if (value.type === 'team') {
                          setSelectedEmployeeTeamFilter(String(value.id));
                          setSelectedEmployee('all');
                          return;
                        }

                        setSelectedEmployee(String(value.id));
                        setSelectedEmployeeTeamFilter('all');
                      }}
                      allLabel="Todos los empleados"
                      buttonPlaceholder="Empleados"
                      searchPlaceholder="Buscar empleado..."
                      buttonClassName="w-[110px] sm:w-[130px] justify-between h-9 text-sm font-normal"
                      contentClassName="w-[240px] p-0"
                    />
                  )}

                  {/* Document type filter */}
                  <Select value={documentTypeFilter} onValueChange={setDocumentTypeFilter}>
                    <SelectTrigger className="w-[100px] h-9 text-sm">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {importedDocumentTypes.map(type => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Date range picker - Styled to match other filters */}
                  <DatePickerPeriod
                    startDate={documentStartDate}
                    endDate={documentEndDate}
                    onStartDateChange={setDocumentStartDate}
                    onEndDateChange={setDocumentEndDate}
                    className="w-[110px] h-9 text-sm"
                  />

                  {/* Signature status filter */}
                  <Select value={signatureFilter} onValueChange={(value) => setSignatureFilter(value as 'all' | 'signed' | 'unsigned')}>
                    <SelectTrigger className="w-[100px] h-9 text-sm">
                      <SelectValue placeholder="Firma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="signed">Firmados</SelectItem>
                      <SelectItem value="unsigned">Sin firmar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Mobile filters button - Only visible on mobile */}
                <Button
                  variant="outline"
                  size="sm"
                  className="md:hidden h-9 text-sm flex-shrink-0"
                  onClick={() => setShowMobileFilters(true)}
                >
                  Filtros
                </Button>

                {/* Bulk action mode toggle */}
                <Button
                  variant={bulkActionMode ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setBulkActionMode(!bulkActionMode);
                    if (!bulkActionMode) {
                      setSelectedDocumentIds(new Set());
                    }
                  }}
                  className="h-9 text-sm flex-shrink-0"
                >
                  {bulkActionMode ? 'Cancelar' : 'Seleccionar'}
                </Button>

                {/* Bulk action icons - Download */}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!bulkActionMode || selectedDocumentIds.size === 0}
                  onClick={() => {
                    const documentsToDownload = displayedDocuments.filter(doc => selectedDocumentIds.has(doc.id));
                    documentsToDownload.forEach(doc => {
                      handleDownload(doc.id, doc.originalName || doc.fileName);
                    });
                  }}
                  className="h-9 w-9 p-0 flex-shrink-0"
                  title={selectedDocumentIds.size > 0 ? `Descargar ${selectedDocumentIds.size} archivo${selectedDocumentIds.size !== 1 ? 's' : ''}` : 'Descargar (selecciona documentos primero)'}
                >
                  <Download className="h-4 w-4" />
                </Button>

                {/* Bulk action icons - Delete */}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!bulkActionMode || selectedDocumentIds.size === 0}
                  onClick={() => {
                    setBulkDeleteConfirm({
                      show: true,
                      documentCount: selectedDocumentIds.size
                    });
                  }}
                  className="h-9 w-9 p-0 text-destructive hover:text-destructive flex-shrink-0"
                  title={selectedDocumentIds.size > 0 ? `Eliminar ${selectedDocumentIds.size} archivo${selectedDocumentIds.size !== 1 ? 's' : ''}` : 'Eliminar (selecciona documentos primero)'}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              )}
            </div>
            
            {/* Toggle Pending Signature Filter */}
            {filterPendingSignature && (
              <Alert className="bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 -mt-1">
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

            {/* Documents Display */}
            {(filteredDocuments || []).length > 0 ? (
                viewMode === 'list' ? (
                  /* Lista consistente con vista de carpetas */
                  <div className="space-y-2">
                    {displayedDocuments.map((document: Document) => {
                      const FileIcon = getFileIcon(document.originalName);
                      return (
                        <div 
                          key={document.id} 
                          className={`rounded-xl shadow-sm border overflow-hidden transition-all ${
                            editingDocumentId === document.id
                              ? 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700/60'
                              : selectedDocumentIds.has(document.id)
                                ? 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 hover:shadow-md'
                                : 'bg-card dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600'
                          }`}
                        >
                          <div className="flex items-stretch">
                            {/* Checkbox o Icono */}
                            <div className="flex items-center justify-center px-2 md:px-3 flex-shrink-0">
                              {bulkActionMode ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const newSelected = new Set(selectedDocumentIds);
                                    if (newSelected.has(document.id)) {
                                      newSelected.delete(document.id);
                                    } else {
                                      newSelected.add(document.id);
                                    }
                                    setSelectedDocumentIds(newSelected);
                                  }}
                                  className={`w-5 h-5 md:w-6 md:h-6 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors flex-shrink-0 ${
                                    selectedDocumentIds.has(document.id)
                                      ? 'border-blue-500 bg-blue-500'
                                      : 'border-gray-300 dark:border-gray-600 bg-transparent hover:border-blue-400'
                                  }`}
                                >
                                  {selectedDocumentIds.has(document.id) && (
                                    <Check className="h-3 w-3 text-white" />
                                  )}
                                </button>
                              ) : (
                                <FileIcon className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground" />
                              )}
                            </div>
                            
                            {/* Contenido principal */}
                            <div 
                              className="flex items-start p-2 md:p-3 py-2 min-w-0 flex-1 cursor-pointer"
                              onClick={() => {
                                if (bulkActionMode) {
                                  const newSelected = new Set(selectedDocumentIds);
                                  if (newSelected.has(document.id)) {
                                    newSelected.delete(document.id);
                                  } else {
                                    newSelected.add(document.id);
                                  }
                                  setSelectedDocumentIds(newSelected);
                                } else {
                                  handleViewDocument(document.id);
                                }
                              }}
                            >
                              <div className="min-w-0 flex-1 space-y-1">
                                {editingDocumentId === document.id ? (
                                  <div 
                                    className="flex items-center gap-1 min-w-0 h-7" 
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => {
                                      e.stopPropagation();
                                      if (e.key === 'Enter') {
                                        handleSaveEditDocument(document.id, document);
                                      } else if (e.key === 'Escape') {
                                        handleCancelEditDocument();
                                      }
                                    }}
                                  >
                                    <Input
                                      autoFocus
                                      value={editingDocumentName}
                                      onChange={(e) => setEditingDocumentName(e.target.value)}
                                      className="text-sm md:text-base font-medium p-0.5 h-7 border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                                      placeholder="Nombre del documento"
                                    />
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleSaveEditDocument(document.id, document)}
                                      disabled={renameMutation.isPending}
                                      className="h-7 w-7 p-0 flex-shrink-0"
                                    >
                                      <Check className="h-4 w-4 text-green-600" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={handleCancelEditDocument}
                                      disabled={renameMutation.isPending}
                                      className="h-7 w-7 p-0 flex-shrink-0"
                                    >
                                      <X className="h-4 w-4 text-red-600" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex items-start gap-1">
                                    <p 
                                      onClick={(e) => e.stopPropagation()}
                                      onDoubleClick={(e) => { e.stopPropagation(); handleStartEditDocument(document.id, document.folderId ? document.fileName : (document.originalName || document.fileName)); }}
                                      className="font-medium text-sm md:text-base text-gray-900 dark:text-gray-100 line-clamp-2 md:truncate leading-tight cursor-text hover:bg-muted/50 rounded px-1 py-0.5 transition-colors select-none min-w-0 flex-1"
                                      title="Doble clic para editar"
                                    >
                                      {document.folderId ? document.fileName : (document.originalName || document.fileName)}
                                    </p>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="md:hidden h-6 w-6 p-0 flex-shrink-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleStartEditDocument(document.id, document.folderId ? document.fileName : (document.originalName || document.fileName));
                                      }}
                                      aria-label="Editar nombre"
                                      title="Editar nombre"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                )}
                                {/* Info en layout adaptativo */}
                                <div className="flex flex-col md:flex-row md:items-center gap-0.5 md:gap-2 text-xs md:text-sm">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-muted-foreground">{formatFileSize(document.fileSize)}</span>
                                    <span className="text-muted-foreground/60">"</span>
                                    <span className="text-muted-foreground">{format(new Date(document.createdAt), 'd MMM yyyy', { locale: es })}</span>
                                    {/* Badge de documento no visto */}
                                    {!document.isViewed && (
                                      <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                                        Nuevo
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-muted-foreground">
                                    <span className="hidden md:inline text-muted-foreground/60">"</span>
                                    <span className="truncate">Por: {document.user?.fullName || 'Usuario desconocido'}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          
                            {/* Botones de accion: solo Firmar cuando aplica (descargar/borrar se mueven al modal) */}
                            <div className="flex gap-0.5 md:gap-1 items-center px-1 md:px-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                              {/* Firmar (solo si aplica) */}
                              {(() => {
                                const fileName = document.originalName || document.fileName || '';
                                const analysis = analyzeFileName(fileName, employees);
                                const requiresSignature = analysis.documentType === payrollDocumentTypeName || document.requiresSignature;
                                return requiresSignature && 
                                       document.userId === user?.id && 
                                       !document.isAccepted && 
                                       document.isViewed ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSignDocument(document.id, document.originalName || document.fileName);
                                    }}
                                    className="h-8 w-8 p-0 text-gray-500 hover:text-green-500 dark:text-gray-500 dark:hover:text-green-400 transition-colors"
                                  >
                                    <FileSignature className="h-4 w-4" />
                                  </Button>
                                ) : null;
                              })()}
                              
                              {/* Descargar/Borrar removidos en la lista; disponibles en el modal de vista previa */}
                            </div>
                          
                            {/* Seccion coloreada de estado - extremo derecho, ultra compacta en movil */}
                            <div className={`hidden md:flex md:w-[110px] flex items-center justify-center flex-shrink-0 px-2 md:px-3 ${
                              (() => {
                                if (document.folderId && document.accountingType) {
                                  return document.accountingType === 'expense' 
                                    ? 'bg-red-100 dark:bg-red-900/40' 
                                    : 'bg-green-100 dark:bg-green-900/40';
                                }
                                const fileName = document.originalName || document.fileName || '';
                                const analysis = analyzeFileName(fileName, employees);
                                const requiresSignatureBadge = analysis.documentType === payrollDocumentTypeName || document.requiresSignature;
                                if (requiresSignatureBadge) {
                                  return document.isAccepted 
                                    ? 'bg-green-100 dark:bg-green-900/40' 
                                    : 'bg-yellow-100 dark:bg-yellow-900/40';
                                }
                                return 'bg-gray-100 dark:bg-gray-800';
                              })()
                            }`}>
                              <span className={`text-[10px] md:text-xs font-semibold text-center leading-tight ${
                                (() => {
                                  if (document.folderId && document.accountingType) {
                                    return document.accountingType === 'expense' 
                                      ? 'text-red-700 dark:text-red-300' 
                                      : 'text-green-700 dark:text-green-300';
                                  }
                                  const fileName = document.originalName || document.fileName || '';
                                  const analysis = analyzeFileName(fileName, employees);
                                  const requiresSignatureBadge = analysis.documentType === payrollDocumentTypeName || document.requiresSignature;
                                  if (requiresSignatureBadge) {
                                    return document.isAccepted 
                                      ? 'text-green-700 dark:text-green-300' 
                                      : 'text-yellow-700 dark:text-yellow-300';
                                  }
                                  return 'text-gray-600 dark:text-gray-400';
                                })()
                              }`}>
                                {(() => {
                                  if (document.folderId && document.accountingType) {
                                    return document.accountingType === 'expense' ? 'Gasto' : 'Ingreso';
                                  }
                                  const fileName = document.originalName || document.fileName || '';
                                  const analysis = analyzeFileName(fileName, employees);
                                  const requiresSignatureBadge = analysis.documentType === payrollDocumentTypeName || document.requiresSignature;
                                  if (requiresSignatureBadge) {
                                    return document.signedAt ? 'Firmada' : 'Pendiente firma';
                                  }
                                  return 'Documento';
                                })()}
                              </span>
                            </div>
                            {/* Indicador compacto móvil - Ocupa toda la altura */}
                            <div className={`md:hidden flex items-stretch flex-shrink-0 w-1 rounded-full ${
                              (() => {
                                // Si es documento de contabilidad, color según tipo de movimiento
                                if (document.folderId && document.accountingType) {
                                  return document.accountingType === 'expense' 
                                    ? 'bg-red-500 dark:bg-red-600' 
                                    : 'bg-green-500 dark:bg-green-600';
                                }
                                // Para otros documentos, color según estado de firma
                                const fileName = document.originalName || document.fileName || '';
                                const analysis = analyzeFileName(fileName, employees);
                                const requiresSignatureBadge = analysis.documentType === payrollDocumentTypeName || document.requiresSignature;
                                if (requiresSignatureBadge) {
                                  return document.signedAt 
                                    ? 'bg-green-500 dark:bg-green-600' 
                                    : 'bg-amber-500 dark:bg-amber-600';
                                }
                                // Por defecto, gris
                                return 'bg-gray-400 dark:bg-gray-600';
                              })()
                            }`} title={(() => {
                              // Si es documento de contabilidad
                              if (document.folderId && document.accountingType) {
                                return document.accountingType === 'expense' ? 'Gasto' : 'Ingreso';
                              }
                              // Para otros documentos, mostrar estado de firma
                              const fileName = document.originalName || document.fileName || '';
                              const analysis = analyzeFileName(fileName, employees);
                              const requiresSignatureBadge = analysis.documentType === payrollDocumentTypeName || document.requiresSignature;
                              if (requiresSignatureBadge) {
                                return document.signedAt ? 'Firmada' : 'Pendiente firma';
                              }
                              return 'Documento';
                            })()} />
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Elemento observador para scroll infinito */}
                    {hasMoreToDisplay && (
                      <div ref={loadMoreRef} className="py-4">
                        <div className="flex flex-col items-center justify-center gap-2 text-gray-400 dark:text-gray-500 text-sm">
                          {isFetchingNextPage ? (
                            <>
                              <LoadingSpinner size="sm" />
                              <span>Cargando más documentos...</span>
                            </>
                          ) : (
                            <>
                              <span>Mostrando {displayedDocuments.length} de {filteredDocuments.length}</span>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={loadMoreDocuments}
                              >
                                Cargar más
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : viewMode === 'folders' ? (
                  /* Vista de navegador de archivos con carpetas */
                  <div className="space-y-4">
                    {/* Breadcrumb navigation - Always visible */}
                    <div className="flex items-center gap-3">
                      {/* Icon buttons without borders */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setCurrentFolderPath('');
                        }}
                        type="button"
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                        title="Inicio"
                      >
                        <Home className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          const parts = currentFolderPath.split('/');
                          parts.pop();
                          setCurrentFolderPath(parts.join('/'));
                        }}
                        type="button"
                        disabled={!currentFolderPath}
                        className="p-2 hover:bg-muted rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Atrás"
                      >
                        <ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                      </button>
                      
                      {/* Breadcrumb with proper names */}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {!currentFolderPath ? (
                          <span className="font-medium">Inicio</span>
                        ) : (
                          (() => {
                            const parts = currentFolderPath.split('/');
                            const breadcrumbData: { name: string; path: string }[] = [];
                            let tempPath = '';
                            let tempLevel: any = folderStructure;
                            
                            for (const part of parts) {
                              tempPath = tempPath ? `${tempPath}/${part}` : part;
                              
                              if (tempLevel[part]) {
                                breadcrumbData.push({ name: tempLevel[part].name, path: tempPath });
                                tempLevel = tempLevel[part];
                              } else if (tempLevel.subfolders && tempLevel.subfolders[part]) {
                                breadcrumbData.push({ name: tempLevel.subfolders[part].name, path: tempPath });
                                tempLevel = tempLevel.subfolders[part];
                              } else {
                                breadcrumbData.push({ name: part, path: tempPath });
                              }
                            }
                            
                            return (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setCurrentFolderPath('');
                                  }}
                                  className="hover:text-foreground transition-colors"
                                >
                                  Inicio
                                </button>
                                {breadcrumbData.map((item, idx) => (
                                  <span key={idx} className="flex items-center gap-2">
                                    <span>/</span>
                                    {idx === breadcrumbData.length - 1 ? (
                                      <span className="font-medium text-foreground">
                                        {item.name}
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          setCurrentFolderPath(item.path);
                                        }}
                                        className="hover:text-foreground transition-colors"
                                      >
                                        {item.name}
                                      </button>
                                    )}
                                  </span>
                                ))}
                              </>
                            );
                          })()
                        )}
                      </div>
                    </div>
                    
                    {(() => {
                      // Show root folders or navigate into subfolder
                      if (!currentFolderPath) {
                        // Root level - show main folders
                        return (
                          <div className="space-y-2">
                            {Object.entries(folderStructure).map(([folderId, folderData]) => {
                              const FolderIcon = folderData.icon;
                              const totalDocs = folderData.documents.length + 
                                (folderData.subfolders ? Object.values(folderData.subfolders).reduce((sum: number, sf: any) => 
                                  sum + (sf.documents?.length || 0) + (sf.subfolders ? Object.values(sf.subfolders).reduce((s: number, ssf: any) => s + (ssf.documents?.length || 0), 0) : 0), 0) : 0);
                              
                              return (
                                <button
                                  key={folderId}
                                  type="button"
                                  className="w-full flex items-center justify-between p-3 bg-card dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-blue-400 dark:hover:border-blue-600 transition-all"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setCurrentFolderPath(folderId);
                                  }}
                                >
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <Folder className="h-6 w-6 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                    <div className="min-w-0 flex-1 text-left">
                                      <p className="font-medium text-foreground truncate">{folderData.name}</p>
                                      <p className="text-sm text-muted-foreground">{totalDocs} archivo{totalDocs !== 1 ? 's' : ''}</p>
                                    </div>
                                  </div>
                                  <div className="flex-shrink-0">
                                    <FolderIcon className="h-5 w-5 text-muted-foreground" />
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        );
                      }
                      
                      // Navigate into folders
                      const pathParts = currentFolderPath.split('/');
                      let currentLevel: any = folderStructure;
                      
                      // Navigate to current folder
                      for (const part of pathParts) {
                        if (currentLevel[part]) {
                          currentLevel = currentLevel[part];
                        } else if (currentLevel.subfolders && currentLevel.subfolders[part]) {
                          currentLevel = currentLevel.subfolders[part];
                        } else {
                          // Invalid path, go back to root
                          setCurrentFolderPath('');
                          return null;
                        }
                      }
                      
                      // Show subfolders and documents at current level
                      return (
                        <div className="space-y-4">
                          {/* Subfolders */}
                          {currentLevel.subfolders && Object.keys(currentLevel.subfolders).length > 0 && (
                            <div className="space-y-2">
                              {Object.entries(currentLevel.subfolders).map(([subfolderId, subfolderData]: [string, any]) => {
                                const SubfolderIcon = subfolderData.icon;
                                const subfolderTotalDocs = subfolderData.documents.length + 
                                  (subfolderData.subfolders ? Object.values(subfolderData.subfolders).reduce((s: number, ssf: any) => s + (ssf.documents?.length || 0), 0) : 0);
                                
                                // Check if this is an employee folder
                                const isEmployeeFolder = subfolderData.employeeData;
                                
                                return (
                                  <button
                                    key={subfolderId}
                                    type="button"
                                    className="w-full flex items-center justify-between p-3 bg-card dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-blue-400 dark:hover:border-blue-600 transition-all"
                                    onClick={(e) => {
                                      // Check if this is a payroll month and click was on the download button
                                      if ((e.target as HTMLElement).closest('button[data-download-btn]')) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        return;
                                      }
                                      e.preventDefault();
                                      setCurrentFolderPath(`${currentFolderPath}/${subfolderId}`);
                                    }}
                                  >
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                      {isEmployeeFolder && subfolderData.employeeData ? (
                                        <UserAvatar
                                          fullName={subfolderData.employeeData.fullName}
                                          userId={subfolderData.employeeData.userId}
                                          profilePicture={subfolderData.employeeData.profilePicture}
                                          size="sm"
                                        />
                                      ) : (
                                        <Folder className="h-6 w-6 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                      )}
                                      <div className="min-w-0 flex-1 text-left">
                                        <p className="font-medium text-foreground truncate">{subfolderData.name}</p>
                                        <p className="text-sm text-muted-foreground">{subfolderTotalDocs} archivo{subfolderTotalDocs !== 1 ? 's' : ''}</p>
                                      </div>
                                    </div>
                                    {(() => {
                                      // Check if this is a payroll month folder
                                      const pathParts = currentFolderPath.split('/');
                                      const isPayrollMonthFolder = pathParts.length === 2 && pathParts[0] === 'nominas' && !isNaN(parseInt(subfolderId));
                                      
                                      if (isPayrollMonthFolder) {
                                        const year = pathParts[1];
                                        const month = subfolderId;
                                        const isDownloading = downloadingZipMonth === `${year}-${month}`;
                                        
                                        return (
                                          <button
                                            key={`download-${year}-${month}`}
                                            data-download-btn
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              handleDownloadPayrollMonth(year, month);
                                            }}
                                            disabled={isDownloading}
                                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/40 dark:hover:bg-blue-900/60 transition-colors text-blue-700 dark:text-blue-300 flex-shrink-0 disabled:opacity-50"
                                            title="Descargar nóminas del mes"
                                          >
                                            {isDownloading ? (
                                              <LoadingSpinner size="sm" />
                                            ) : (
                                              <Download className="h-4 w-4" />
                                            )}
                                          </button>
                                        );
                                      }
                                      
                                      return (
                                        <div className="flex-shrink-0">
                                          <SubfolderIcon className="h-5 w-5 text-muted-foreground" />
                                        </div>
                                      );
                                    })()}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          
                          {/* Documents */}
                          {currentLevel.documents && currentLevel.documents.length > 0 && (
                            <div className="space-y-2">
                                {currentLevel.documents.map((document: Document) => {
                                  const FileIcon = getFileIcon(document.originalName);
                                  return (
                                    <div 
                                      key={document.id} 
                                      className={`rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-all ${
                                        editingDocumentId === document.id
                                          ? 'bg-gray-100 dark:bg-gray-700/60'
                                          : 'bg-card dark:bg-gray-800 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600'
                                      }`}
                                    >
                                      <div className="flex items-stretch">
                                        {/* Columna de icono - centrado verticalmente */}
                                        <div className="flex items-center justify-center px-2 md:px-3 flex-shrink-0">
                                          <FileIcon className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground" />
                                        </div>
                                        
                                        {/* Contenido principal */}
                                        <div 
                                          className="flex items-start p-2 md:p-3 py-2 min-w-0 flex-1 cursor-pointer"
                                          onClick={() => handleViewDocument(document.id)}
                                        >
                                          <div className="min-w-0 flex-1 space-y-1">
                                            {editingDocumentId === document.id ? (
                                              <div 
                                                className="flex items-center gap-1 min-w-0 h-7" 
                                                onClick={(e) => e.stopPropagation()}
                                                onKeyDown={(e) => {
                                                  e.stopPropagation();
                                                  if (e.key === 'Enter') {
                                                    handleSaveEditDocument(document.id, document);
                                                  } else if (e.key === 'Escape') {
                                                    handleCancelEditDocument();
                                                  }
                                                }}
                                              >
                                                <Input
                                                  autoFocus
                                                  value={editingDocumentName}
                                                  onChange={(e) => setEditingDocumentName(e.target.value)}
                                                  className="text-sm md:text-base font-medium p-0.5 h-7 border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                                                  placeholder="Nombre del documento"
                                                />
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  onClick={() => handleSaveEditDocument(document.id, document)}
                                                  disabled={renameMutation.isPending}
                                                  className="h-7 w-7 p-0 flex-shrink-0"
                                                >
                                                  <Check className="h-4 w-4 text-green-600" />
                                                </Button>
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  onClick={handleCancelEditDocument}
                                                  disabled={renameMutation.isPending}
                                                  className="h-7 w-7 p-0 flex-shrink-0"
                                                >
                                                  <X className="h-4 w-4 text-red-600" />
                                                </Button>
                                              </div>
                                            ) : (
                                              <div className="flex items-start gap-1">
                                                <p 
                                                  onClick={(e) => e.stopPropagation()}
                                                  onDoubleClick={(e) => {
                                                    e.stopPropagation();
                                                    handleStartEditDocument(document.id, document.folderId ? document.fileName : (document.originalName || document.fileName));
                                                  }}
                                                  className="font-medium text-sm md:text-base text-gray-900 dark:text-gray-100 line-clamp-2 md:truncate leading-tight cursor-text hover:bg-muted/50 rounded px-1 py-0.5 transition-colors select-none min-w-0 flex-1"
                                                  title="Doble clic para editar"
                                                >
                                                  {document.folderId ? document.fileName : (document.originalName || document.fileName)}
                                                </p>
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="md:hidden h-6 w-6 p-0 flex-shrink-0"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleStartEditDocument(document.id, document.folderId ? document.fileName : (document.originalName || document.fileName));
                                                  }}
                                                  aria-label="Editar nombre"
                                                  title="Editar nombre"
                                                >
                                                  <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                              </div>
                                            )}
                                            {/* Info en layout adaptativo */}
                                            <div className="flex flex-col md:flex-row md:items-center gap-0.5 md:gap-2 text-xs md:text-sm">
                                              <div className="flex items-center gap-1.5">
                                                <span className="font-semibold text-muted-foreground">{formatFileSize(document.fileSize)}</span>
                                                <span className="text-muted-foreground/60">⬢</span>
                                                <span className="text-muted-foreground">{format(new Date(document.createdAt), 'd MMM yyyy', { locale: es })}</span>
                                              </div>
                                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                                <span className="hidden md:inline text-muted-foreground/60">⬢</span>
                                                <span className="truncate">Por: {document.user?.fullName || 'Usuario desconocido'}</span>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      
                                        {/* Botones de acción removidos en la lista; disponibles en el modal de vista previa */}
                                        <div className="flex gap-0.5 md:gap-1 items-center px-1 md:px-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                          {/* Acciones trasladadas al modal de vista previa */}
                                        </div>
                                      
                                        {/* Sección coloreada de estado - extremo derecho, ultra compacta en móvil */}
                                        <div className={`hidden md:flex md:w-[110px] flex items-center justify-center flex-shrink-0 px-2 md:px-3 ${
                                          (() => {
                                            // Si es documento de contabilidad, color según tipo de movimiento
                                            if (document.folderId && document.accountingType) {
                                              return document.accountingType === 'expense' 
                                                ? 'bg-red-100 dark:bg-red-900/40' 
                                                : 'bg-green-100 dark:bg-green-900/40';
                                            }
                                            // Para otros documentos, color según estado de firma
                                            const fileName = document.originalName || document.fileName || '';
                                            const analysis = analyzeFileName(fileName, employees);
                                            const requiresSignatureBadge = analysis.documentType === payrollDocumentTypeName || document.requiresSignature;
                                            if (requiresSignatureBadge) {
                                              return document.isAccepted 
                                                ? 'bg-green-100 dark:bg-green-900/40' 
                                                : 'bg-yellow-100 dark:bg-yellow-900/40';
                                            }
                                            // Por defecto, fondo gris suave
                                            return 'bg-gray-100 dark:bg-gray-800';
                                          })()
                                        }`}>
                                          <span className={`text-[10px] md:text-xs font-semibold text-center leading-tight ${
                                            (() => {
                                              // Si es documento de contabilidad
                                              if (document.folderId && document.accountingType) {
                                                return document.accountingType === 'expense' 
                                                  ? 'text-red-700 dark:text-red-300' 
                                                  : 'text-green-700 dark:text-green-300';
                                              }
                                              // Para otros documentos, color según estado de firma
                                              const fileName = document.originalName || document.fileName || '';
                                              const analysis = analyzeFileName(fileName, employees);
                                              const requiresSignatureBadge = analysis.documentType === payrollDocumentTypeName || document.requiresSignature;
                                              if (requiresSignatureBadge) {
                                                return document.isAccepted 
                                                  ? 'text-green-700 dark:text-green-300' 
                                                  : 'text-yellow-700 dark:text-yellow-300';
                                              }
                                              return 'text-gray-600 dark:text-gray-400';
                                            })()
                                          }`}>
                                            {(() => {
                                              // Si es documento de contabilidad
                                              if (document.folderId && document.accountingType) {
                                                return document.accountingType === 'expense' ? 'Gasto' : 'Ingreso';
                                              }
                                              // Para otros documentos, mostrar estado de firma
                                              const fileName = document.originalName || document.fileName || '';
                                              const analysis = analyzeFileName(fileName, employees);
                                              const requiresSignatureBadge = analysis.documentType === payrollDocumentTypeName || document.requiresSignature;
                                              if (requiresSignatureBadge) {
                                                return document.signedAt ? 'Firmada' : 'Pendiente firma';
                                              }
                                              return 'Documento';
                                            })()}
                                          </span>
                                        </div>

                                        {/* Indicador compacto móvil - Ocupa toda la altura */}
                                        <div className={`md:hidden flex items-stretch flex-shrink-0 w-1 rounded-full ${
                                          (() => {
                                            // Si es documento de contabilidad, color según tipo de movimiento
                                            if (document.folderId && document.accountingType) {
                                              return document.accountingType === 'expense' 
                                                ? 'bg-red-500 dark:bg-red-600' 
                                                : 'bg-green-500 dark:bg-green-600';
                                            }
                                            // Para otros documentos, color según estado de firma
                                            const fileName = document.originalName || document.fileName || '';
                                            const analysis = analyzeFileName(fileName, employees);
                                            const requiresSignatureBadge = analysis.documentType === payrollDocumentTypeName || document.requiresSignature;
                                            if (requiresSignatureBadge) {
                                              return document.isAccepted 
                                                ? 'bg-green-500 dark:bg-green-600' 
                                                : 'bg-amber-500 dark:bg-amber-600';
                                            }
                                            // Por defecto, gris
                                            return 'bg-gray-400 dark:bg-gray-600';
                                          })()
                                        }`} title={(() => {
                                          // Si es documento de contabilidad
                                          if (document.folderId && document.accountingType) {
                                            return document.accountingType === 'expense' ? 'Gasto' : 'Ingreso';
                                          }
                                          // Para otros documentos, mostrar estado de firma
                                          const fileName = document.originalName || document.fileName || '';
                                          const analysis = analyzeFileName(fileName, employees);
                                          const requiresSignatureBadge = analysis.documentType === payrollDocumentTypeName || document.requiresSignature;
                                          if (requiresSignatureBadge) {
                                            return document.isAccepted ? 'Firmada' : 'Pendiente firma';
                                          }
                                          return 'Documento';
                                        })()} />
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          )}
                          
                          {/* Empty state */}
                          {(!currentLevel.subfolders || Object.keys(currentLevel.subfolders).length === 0) && 
                           (!currentLevel.documents || currentLevel.documents.length === 0) && (
                            <div className="text-center py-12 text-muted-foreground">
                              <Folder className="h-12 w-12 mx-auto mb-3 opacity-50" />
                              <p>Esta carpeta está vacía</p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
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
                        // PROTECTED - DO NOT MODIFY: Smart document categorization using analyzeFileName
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
                          <div key={employeeId} className="bg-card dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-all hover:shadow-md">
                            {/* Employee Header */}
                            <div 
                              className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
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
                                    <div key={type} className="bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700">
                                      {/* Type Header */}
                                      <div 
                                        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded-t-xl"
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
                                                className="bg-card dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 transition-all hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 cursor-pointer"
                                                onClick={() => handleViewDocument(document.id)}
                                              >
                                                <div className="flex items-start justify-between mb-2">
                                                  <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
                                                    <FileIcon className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                                                  </div>
                                                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                                    {/* Descargar/Borrar removidos en la tarjeta; disponibles en el modal */}
                                                    {/* Sign button for documents requiring signature owned by current user in grid view */}
                                                    {(type === 'nomina' || document.requiresSignature) && 
                                                     document.userId === user?.id && 
                                                     !document.isAccepted && 
                                                     document.isViewed && (
                                                      <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          handleSignDocument(document.id, document.originalName || document.fileName);
                                                        }}
                                                        className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                      >
                                                        <FileSignature className="h-3 w-3" />
                                                      </Button>
                                                    )}
                                                    {/* Eliminar trasladado al modal de vista previa */}
                                                  </div>
                                                </div>
                                                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate mb-1">
                                                  {document.originalName || document.fileName || 'Documento sin nombre'}
                                                </h4>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                                                  <div>{formatFileSize(document.fileSize)}</div>
                                                  <div>
                                                    {format(new Date(document.createdAt), 'd MMM yyyy', { locale: es })}
                                                  </div>
                                                  {/* Signature status for nóminas or documents requiring signature in grid view */}
                                                  {(type === 'nomina' || document.requiresSignature) && (
                                                    <div>
                                                      <Badge 
                                                        variant={document.signedAt ? 'default' : 'outline'}
                                                        className={`text-xs ${
                                                          document.signedAt 
                                                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' 
                                                            : 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300'
                                                        }`}
                                                      >
                                                        {document.signedAt ? '✓ Firmada' : 'Pendiente firma'}
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
                    
                    {/* Elemento observador para scroll infinito */}
                    {hasMoreToDisplay && (
                      <div ref={loadMoreRef} className="py-4">
                        <div className="flex flex-col items-center justify-center gap-2 text-gray-400 dark:text-gray-500 text-sm">
                          {isFetchingNextPage ? (
                            <>
                              <LoadingSpinner size="sm" />
                              <span>Cargando más documentos...</span>
                            </>
                          ) : (
                            <>
                              <span>Mostrando {displayedDocuments.length} de {filteredDocuments.length}</span>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={loadMoreDocuments}
                              >
                                Cargar más
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
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
          <div className="space-y-4">
            {/* Filtros - Optimizado para móvil */}
            <div className="flex flex-col gap-3">
              {/* Fila 1: Contador, empleado (desktop) y botón nueva solicitud (móvil) */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Contador de solicitudes */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg">
                  <span className="text-sm font-medium text-foreground">{filteredRequests.length}</span>
                  <span className="text-sm text-muted-foreground">solicitudes</span>
                </div>
                
                {/* Filtro Empleado - Solo desktop */}
                <div className="hidden md:block">
                  <EmployeeScopeDropdown
                    employees={employees.map((employee) => ({ id: employee.id, fullName: employee.fullName }))}
                    teams={teams.map((team) => ({ id: team.id, name: team.name }))}
                    value={
                      requestTeamFilter !== 'all'
                        ? { type: 'team', id: parseInt(requestTeamFilter, 10) }
                        : requestEmployeeFilter !== 'all'
                          ? { type: 'employee', id: parseInt(requestEmployeeFilter, 10) }
                          : { type: 'all' }
                    }
                    onChange={(value) => {
                      if (value.type === 'all') {
                        setRequestEmployeeFilter('all');
                        setRequestTeamFilter('all');
                        return;
                      }

                      if (value.type === 'team') {
                        setRequestTeamFilter(String(value.id));
                        setRequestEmployeeFilter('all');
                        return;
                      }

                      setRequestEmployeeFilter(String(value.id));
                      setRequestTeamFilter('all');
                    }}
                    buttonClassName="w-[180px] justify-between font-normal"
                    contentClassName="w-[240px] p-0"
                  />
                </div>
                
                {/* Filtro Tipo de Documento - Solo desktop */}
                <Select value={requestTypeFilter} onValueChange={setRequestTypeFilter}>
                  <SelectTrigger className="w-[160px] hidden md:flex">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los tipos</SelectItem>
                    {documentTypes.map((type) => (
                      <SelectItem key={`request-type-${type.id}`} value={type.name}>{type.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {/* Filtro Estado - Solo desktop */}
                <Select value={requestStatusFilter} onValueChange={setRequestStatusFilter}>
                  <SelectTrigger className="w-[130px] hidden md:flex">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="pending">Pendientes</SelectItem>
                    <SelectItem value="completed">Completadas</SelectItem>
                    <SelectItem value="incomplete">Sin archivo</SelectItem>
                  </SelectContent>
                </Select>
                
                {/* Botón Nueva Solicitud - Compacto en móvil */}
                <Button 
                  onClick={() => setShowRequestDialog(true)}
                  data-testid="button-new-request"
                  className="ml-auto rounded-xl h-8 md:h-10 px-2 md:px-4 text-xs md:text-sm"
                >
                  <Send className="mr-0 md:mr-2 h-3.5 w-3.5 md:h-4 md:w-4" />
                  <span className="hidden sm:inline">Nueva Solicitud</span>
                </Button>
              </div>
              
              {/* Fila 2: Filtros móviles */}
              <div className="flex md:hidden items-center gap-2">
                {/* Filtro Empleado móvil */}
                <EmployeeScopeDropdown
                  employees={employees.map((employee) => ({ id: employee.id, fullName: employee.fullName }))}
                  teams={teams.map((team) => ({ id: team.id, name: team.name }))}
                  value={
                    requestTeamFilter !== 'all'
                      ? { type: 'team', id: parseInt(requestTeamFilter, 10) }
                      : requestEmployeeFilter !== 'all'
                        ? { type: 'employee', id: parseInt(requestEmployeeFilter, 10) }
                        : { type: 'all' }
                  }
                  onChange={(value) => {
                    if (value.type === 'all') {
                      setRequestEmployeeFilter('all');
                      setRequestTeamFilter('all');
                      return;
                    }

                    if (value.type === 'team') {
                      setRequestTeamFilter(String(value.id));
                      setRequestEmployeeFilter('all');
                      return;
                    }

                    setRequestEmployeeFilter(String(value.id));
                    setRequestTeamFilter('all');
                  }}
                  allLabel="Todos los empleados"
                  buttonPlaceholder="Empleado"
                  buttonClassName="flex-1 justify-between font-normal text-xs h-9"
                  contentClassName="w-[240px] p-0"
                />
                
                {/* Filtro Tipo móvil */}
                <Select value={requestTypeFilter} onValueChange={setRequestTypeFilter}>
                  <SelectTrigger className="w-[100px] text-xs h-9">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {documentTypes.map((type) => (
                      <SelectItem key={`request-type-mob-${type.id}`} value={type.name}>{type.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {/* Filtro Estado móvil */}
                <Select value={requestStatusFilter} onValueChange={setRequestStatusFilter}>
                  <SelectTrigger className="w-[100px] text-xs h-9">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="pending">Pendientes</SelectItem>
                    <SelectItem value="completed">Completadas</SelectItem>
                    <SelectItem value="incomplete">Sin archivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Request Cards - Optimizado para móvil */}
            {filteredRequests.length > 0 ? (
              <div className="space-y-2" key={`cards-${filteredRequests.length}`}>
                {filteredRequests.slice(0, displayedRequestsCount).map((request: any) => {
                  const FileIcon = getFileIcon(request.documentType);
                  return (
                    <div 
                      key={`request-card-${request.id}`} 
                      className="bg-card dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-all hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600"
                    >
                      <div className="flex items-stretch">
                        {/* Columna de icono - centrado verticalmente */}
                        <div className="flex items-center justify-center px-2 md:px-3 flex-shrink-0">
                          <FileIcon className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground" />
                        </div>
                        
                        {/* Contenido principal - clickeable si hay documento */}
                        <div 
                          className={`flex items-start p-2 md:p-3 py-2 min-w-0 flex-1 ${request.document ? 'cursor-pointer' : ''}`}
                          onClick={() => request.document && handleViewDocument(request.document.id)}
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="font-medium text-sm md:text-base text-gray-900 dark:text-gray-100 line-clamp-2 md:truncate leading-tight">
                              {request.documentType} - {request.user?.fullName || 'Empleado'}
                            </p>
                            {/* Info en layout adaptativo */}
                            <div className="flex flex-col md:flex-row md:items-center gap-0.5 md:gap-2 text-xs md:text-sm">
                              <div className="flex items-center gap-1.5">
                                <span className="text-muted-foreground">{format(new Date(request.createdAt), 'd MMM yyyy', { locale: es })}</span>
                              </div>
                              {request.message && (
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                  <span className="hidden md:inline text-muted-foreground/60">⬢</span>
                                  <span className="italic truncate">"{request.message}"</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Botones de acción: Descargar, Borrar - compactos en móvil */}
                        <div className="flex gap-0.5 md:gap-1 items-center px-1 md:px-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          {/* Descargar (solo si hay documento) */}
                          {request.document && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(request.document.id, request.document.originalName);
                              }}
                              className="h-7 w-7 md:h-8 md:w-8 p-0 text-gray-500 hover:text-gray-900 dark:text-gray-500 dark:hover:text-white transition-colors"
                              title="Descargar"
                            >
                              <Download className="h-3.5 w-3.5 md:h-4 md:w-4" />
                            </Button>
                          )}
                          
                          {/* Eliminar */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteRequest(request.id, request.documentType);
                            }}
                            className="h-7 w-7 md:h-8 md:w-8 p-0 text-gray-500 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors"
                            title="Eliminar solicitud"
                          >
                            <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                          </Button>
                        </div>
                        
                        {/* Badge de estado - extremo derecho, ultra compacto en móvil */}
                        <div className={`hidden md:flex md:w-[110px] flex items-center justify-center flex-shrink-0 px-2 md:px-3 ${
                          request.isCompleted 
                            ? request.document
                              ? 'bg-green-100 dark:bg-green-900/40'
                              : 'bg-red-100 dark:bg-red-900/40'
                            : 'bg-yellow-100 dark:bg-yellow-900/40'
                        }`}>
                          <span className={`text-[10px] md:text-xs font-semibold text-center leading-tight ${
                            request.isCompleted 
                              ? request.document
                                ? 'text-green-700 dark:text-green-300'
                                : 'text-red-700 dark:text-red-300'
                              : 'text-yellow-700 dark:text-yellow-300'
                          }`}>
                            {request.isCompleted ? (
                              request.document ? '✓ Completada' : 'Sin archivo'
                            ) : (
                              'Pendiente'
                            )}
                          </span>
                        </div>

                        {/* Indicador compacto móvil - Ocupa toda la altura */}
                        <div className={`md:hidden flex items-stretch flex-shrink-0 w-1 rounded-full ${
                          request.isCompleted 
                            ? request.document
                              ? 'bg-green-500 dark:bg-green-600'
                              : 'bg-red-500 dark:bg-red-600'
                            : 'bg-yellow-500 dark:bg-yellow-600'
                        }`} title={
                          request.isCompleted ? (
                            request.document ? '✓ Completada' : 'Sin archivo'
                          ) : (
                            'Pendiente'
                          )
                        } />
                      </div>
                    </div>
                  );
                })}
                
                {/* Load more trigger */}
                {displayedRequestsCount < filteredRequests.length && (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <div ref={loadMoreRequestsRef} className="h-px w-full" />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDisplayedRequestsCount((prev) => Math.min(prev + ITEMS_PER_LOAD, filteredRequests.length))}
                    >
                      Cargar más solicitudes
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 bg-card dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
                <Send className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {requestStatusFilter === 'pending' && 'No hay solicitudes pendientes'}
                  {requestStatusFilter === 'completed' && 'No hay solicitudes completadas'}
                  {requestStatusFilter === 'incomplete' && 'No hay solicitudes sin archivo'}
                  {requestStatusFilter === 'all' && 'No hay solicitudes enviadas'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {requestStatusFilter !== 'all' ? 'Ajusta los filtros para ver más resultados' : 'Las solicitudes que envíes aparecerán aquí'}
                </p>
              </div>
            )}
          </div>
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
            <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex-shrink-0 relative">
              <DialogTitle className="text-base font-semibold text-foreground flex items-center gap-2 pr-12">
                <span>Subir Documento</span>
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

                  {teams.length > 0 ? (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Equipos</p>
                      <div className="flex flex-wrap gap-2">
                        {teams.map((team) => {
                          const teamMemberIds = resolveTeamMemberIds(teams, team.id);
                          const allSelected = teamMemberIds.length > 0 && teamMemberIds.every((id) => uploadSelectedEmployees.includes(id));
                          return (
                            <Button
                              key={`upload-team-${team.id}`}
                              type="button"
                              variant={allSelected ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => toggleTeamInUploadSelection(team.id)}
                              className="h-7 text-xs"
                            >
                              {team.name}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                  
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
                onClick={() => {
                  const newValue = !uploadRequiresSignature;
                  setUploadRequiresSignature(newValue);
                  
                  // If enabling signature and we have a PDF, show position editor
                  if (newValue && uploadAnalysis.length > 0) {
                    const firstPdf = uploadAnalysis.find(a => a.file.type === 'application/pdf');
                    if (firstPdf) {
                      // Store the file directly
                      setPdfFile(firstPdf.file);
                      const url = URL.createObjectURL(firstPdf.file);
                      setPdfPreviewUrl(url);
                      setShowSignatureEditor(true);
                      
                      // Set default signature position (bottom right)
                      setSignaturePosition({
                        x: 75,  // percentage from left
                        y: 80,  // percentage from top
                        width: 18, // percentage width - más estrecha
                        height: 15, // percentage height - más alta para firma + texto
                        page: 1    // first page by default
                      });
                    }
                  }
                }}
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

        {/* Signature Position Editor Dialog */}
        <Dialog open={showSignatureEditor} onOpenChange={setShowSignatureEditor}>
          <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 w-[90vw]">
            <DialogHeader className="px-6 pt-6 pb-4">
              <DialogTitle>Posicionar Firma en el Documento</DialogTitle>
            </DialogHeader>
            
            <div className="flex-1 min-h-0 overflow-hidden px-6 pb-6">
              {pdfPreviewUrl && signaturePosition && (
                <SignaturePositionEditor
                  pdfUrl={pdfPreviewUrl}
                  pdfFile={pdfFile || undefined}
                  signaturePosition={signaturePosition}
                  onPositionChange={setSignaturePosition}
                  onClose={() => {
                    setShowSignatureEditor(false);
                    setPdfFile(null);
                    setPdfPreviewUrl('');
                    toast({
                      title: 'Posición guardada',
                      description: 'La firma se colocará en la posición indicada',
                    });
                  }}
                />
              )}
              {!pdfPreviewUrl && (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">Cargando PDF...</p>
                </div>
              )}
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

        {/* Bulk Delete Confirmation Dialog */}
        <Dialog open={bulkDeleteConfirm.show} onOpenChange={(open) => !open && setBulkDeleteConfirm({ show: false, documentCount: 0 })}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="flex items-center text-red-600">
                <Trash2 className="h-5 w-5 mr-2" />
                Confirmar Eliminación de Documentos
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <p className="text-foreground">
                ¿Estás seguro de que quieres eliminar {bulkDeleteConfirm.documentCount} documento{bulkDeleteConfirm.documentCount !== 1 ? 's' : ''}?
              </p>
              
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded-lg">
                <p className="text-sm text-red-700 dark:text-red-300">
                  ⚠️ Esta acción no se puede deshacer. Los archivos se eliminarán permanentemente del sistema.
                </p>
              </div>
              
              <div className="flex justify-end space-x-3">
                <Button 
                  variant="outline" 
                  onClick={() => setBulkDeleteConfirm({ show: false, documentCount: 0 })}
                  disabled={deleteMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button 
                  variant="destructive"
                  onClick={() => {
                    const documentsToDelete = displayedDocuments.filter(doc => selectedDocumentIds.has(doc.id));
                    documentsToDelete.forEach(doc => {
                      deleteMutation.mutate(doc.id);
                    });
                    setSelectedDocumentIds(new Set());
                    setBulkDeleteConfirm({ show: false, documentCount: 0 });
                  }}
                  disabled={deleteMutation.isPending}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar Permanentemente'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Mobile Filters Dialog */}
        <Dialog open={showMobileFilters} onOpenChange={setShowMobileFilters}>
          <DialogContent className="sm:max-w-[350px]">
            <DialogHeader>
              <DialogTitle>Filtros</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {/* Employee filter - Mobile */}
              {!isSelfAccessOnly && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Empleado</Label>
                  <EmployeeScopeDropdown
                    employees={employees.map((employee) => ({ id: employee.id, fullName: employee.fullName }))}
                    teams={teams.map((team) => ({ id: team.id, name: team.name }))}
                    value={
                      selectedEmployeeTeamFilter !== 'all'
                        ? { type: 'team', id: parseInt(selectedEmployeeTeamFilter, 10) }
                        : selectedEmployee !== 'all'
                          ? { type: 'employee', id: parseInt(selectedEmployee, 10) }
                          : { type: 'all' }
                    }
                    onChange={(value) => {
                      if (value.type === 'all') {
                        setSelectedEmployee('all');
                        setSelectedEmployeeTeamFilter('all');
                        return;
                      }

                      if (value.type === 'team') {
                        setSelectedEmployeeTeamFilter(String(value.id));
                        setSelectedEmployee('all');
                        return;
                      }

                      setSelectedEmployee(String(value.id));
                      setSelectedEmployeeTeamFilter('all');
                    }}
                    allLabel="Todos los empleados"
                    buttonPlaceholder="Empleados"
                    searchPlaceholder="Buscar empleado..."
                    buttonClassName="w-full justify-between h-9 text-sm font-normal"
                    contentClassName="w-[240px] p-0"
                  />
                </div>
              )}

              {/* Document type filter - Mobile */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tipo de documento</Label>
                <Select value={documentTypeFilter} onValueChange={setDocumentTypeFilter}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {importedDocumentTypes.map(type => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date range filter - Mobile */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Rango de fechas</Label>
                <DatePickerPeriod
                  startDate={documentStartDate}
                  endDate={documentEndDate}
                  onStartDateChange={setDocumentStartDate}
                  onEndDateChange={setDocumentEndDate}
                  className="w-full h-9 text-sm"
                />
              </div>

              {/* Signature status filter - Mobile */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Estado de firma</Label>
                <Select value={signatureFilter} onValueChange={(value) => setSignatureFilter(value as 'all' | 'signed' | 'unsigned')}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Seleccionar estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="signed">Firmados</SelectItem>
                    <SelectItem value="unsigned">Sin firmar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button
                variant="outline"
                className="flex-1 h-9"
                onClick={() => {
                  setSelectedEmployee('all');
                  setSelectedEmployeeTeamFilter('all');
                  setDocumentTypeFilter('all');
                  setDocumentStartDate(undefined);
                  setDocumentEndDate(undefined);
                  setSignatureFilter('all');
                }}
              >
                Limpiar
              </Button>
              <Button
                className="flex-1 h-9"
                onClick={() => setShowMobileFilters(false)}
              >
                Aplicar
              </Button>
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

        {/* Request Document Dialog - SOLICITAR documento al empleado */}
        <Dialog open={showRequestDialog} onOpenChange={(open) => {
          if (!open) {
            setSelectedEmployees([]);
            setDocumentType('');
            setMessage('');
            setEmployeeSearchTerm('');
          }
          setShowRequestDialog(open);
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <Send className="h-5 w-5 mr-2" />
                Solicitar Documento
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Document Type Selection */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Tipo de Documento *
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

              {/* Employee Selection with Search */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Empleados * ({selectedEmployees.length} seleccionados)
                </label>

                {teams.length > 0 ? (
                  <div className="mb-2">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Equipos</p>
                    <div className="flex flex-wrap gap-2">
                      {teams.map((team) => (
                        <Button
                          key={`request-dialog-team-${team.id}`}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addTeamToRequestSelection(team.id)}
                          className="h-7 text-xs"
                        >
                          {team.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}
                
                {/* Search Input */}
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={employeeSearchTerm}
                    onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                    placeholder="Buscar empleado..."
                    className="pl-9"
                  />
                </div>
                
                <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1">
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
                            ? 'bg-blue-50 dark:bg-blue-900/30'
                            : 'hover:bg-muted'
                        }`}
                      >
                        <div className={`w-4 h-4 border rounded mr-3 flex items-center justify-center ${
                          selectedEmployees.includes(employee.id)
                            ? 'bg-blue-600 border-blue-600'
                            : 'border-gray-300'
                        }`}>
                          {selectedEmployees.includes(employee.id) && (
                            <Check className="h-3 w-3 text-white" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">{employee.fullName}</div>
                          <div className="text-xs text-muted-foreground">{employee.email}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Mensaje (opcional)
                </label>
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Mensaje personalizado para los empleados"
                />
              </div>

              {/* Summary */}
              {selectedEmployees.length > 0 && documentType && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    Se solicitará <span className="font-medium">{documentTypes.find(t => t.id === documentType)?.name}</span>
                    {' '}a <span className="font-medium">{selectedEmployees.length} empleado{selectedEmployees.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => setShowRequestDialog(false)}
                  disabled={sendDocumentMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSendRequest}
                  disabled={sendDocumentMutation.isPending || selectedEmployees.length === 0 || !documentType}
                >
                  {sendDocumentMutation.isPending ? 'Enviando...' : 'Enviar Solicitud'}
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

        {/* Document Preview Modal */}
        <DocumentPreviewModal
          open={previewModal.open}
          url={previewModal.url}
          filename={previewModal.filename}
          mimeType={previewModal.mimeType}
          docId={previewModal.docId ?? null}
          onDelete={(id) => {
            const docName = previewModal.filename || 'Documento';
            confirmDelete(id, docName);
          }}
          onClose={() => setPreviewModal({ open: false, url: '', filename: '', mimeType: null, docId: null })}
        />
    </div>
    </PageWrapper>
  );
}

