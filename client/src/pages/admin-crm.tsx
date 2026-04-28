import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useMutation, useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TabNavigation } from '@/components/ui/tab-navigation';
import StatsCard, { StatsCardGrid } from '@/components/StatsCard';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { logger } from '@/lib/logger';
import { useStandardInfiniteScroll } from '@/hooks/use-standard-infinite-scroll';
import { usePageHeader } from '@/components/layout/page-header';
import { usePageTitle } from '@/hooks/use-page-title';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { CategoryMultiSelect, CategoryTag, type CRMCategoryData } from '@/components/crm-category-manager';
import { DatePickerDay } from '@/components/ui/date-picker';
import { CRMCapturePanel } from '@/components/crm-capture-panel';
import { CRMInteractionHistory } from '@/components/crm-interaction-history';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Users,
  Building2,
  FolderKanban,
  Plus,
  Edit2,
  Trash2,
  Search,
  Calendar,
  CheckCircle,
  AlertCircle,
  X,
  Check,
} from 'lucide-react';

interface Contact {
  id: number;
  name: string;
  role: 'client' | 'provider';
  label?: string | null;
  email?: string | null;
  phone?: string | null;
  taxId?: string | null;
  city?: string | null;
  postalAddress?: string | null;
  notes?: string | null;
  status: string;
  categories?: number[] | null;
  statusCategories?: number[] | null;
}

interface ProjectWithLinks {
  project: {
    id: number;
    name: string;
    code?: string | null;
    status: string;
    statusCategories?: CRMCategoryData[] | null;
    stage?: string | null;
    description?: string | null;
    startDate?: string | null;
    dueDate?: string | null;
    budget?: number | string | null;
    progress?: number | null;
  };
  clients?: Contact[];
  providers?: Contact[];
}

interface CapturePipelineItem {
  id: number;
  stage: string;
  statusCategoryName?: string | null;
  hasStaleAlert?: boolean;
  daysWithoutInteraction?: number | null;
  lastInteractionAt?: string | null;
}

interface CapturePipelineResponse {
  stages: Array<{ id: string; items: CapturePipelineItem[] }>;
  total: number;
}

type ContactRole = 'client' | 'provider';

interface ContactFormState {
  label: string;
  name: string;
  email: string;
  phone: string;
  taxId: string;
  city: string;
  postalAddress: string;
  notes: string;
  categories: CRMCategoryData[];
  statusCategories: CRMCategoryData[];
}

interface ProjectFormState {
  name: string;
  code: string;
  stage: string;
  description: string;
  startDate: string;
  dueDate: string;
  budget: string | number;
  progress: number;
  statusCategories: CRMCategoryData[];
  clientIds: number[];
  providerIds: number[];
}

const emptyContactForm: ContactFormState = {
  label: '',
  name: '',
  email: '',
  phone: '',
  taxId: '',
  city: '',
  postalAddress: '',
  notes: '',
  categories: [],
  statusCategories: [],
};

const emptyProjectForm: ProjectFormState = {
  name: '',
  code: '',
  stage: '',
  description: '',
  startDate: '',
  dueDate: '',
  budget: '',
  progress: 0,
  statusCategories: [],
  clientIds: [],
  providerIds: [],
};

export default function CRMPage() {
  usePageTitle('Relaciones');

  const { setHeader, resetHeader } = usePageHeader();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'clients' | 'providers' | 'projects' | 'capture'>('clients');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const [showNewContactCard, setShowNewContactCard] = useState(false);
  const [contactForm, setContactForm] = useState<ContactFormState>(emptyContactForm);
  const [contactRole, setContactRole] = useState<ContactRole>('client');

  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [projectForm, setProjectForm] = useState<ProjectFormState>(emptyProjectForm);
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [projectEmployeeSearch, setProjectEmployeeSearch] = useState('');
  const [projectAssignedUsers, setProjectAssignedUsers] = useState<Array<{ id: number; fullName: string }>>([]);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  type PaginatedPage<T> = { items: T[]; totalCount: number; hasMore: boolean };
  const CONTACT_PAGE_SIZE = 50;
  const PROJECT_PAGE_SIZE = 30;

  useEffect(() => {
    setHeader({
      title: 'Relaciones',
      subtitle: 'Clientes, proveedores y proyectos en un solo lugar',
    });
    return resetHeader;
  }, [resetHeader, setHeader]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [searchTerm]);

  const { data: categories = [], isLoading: loadingCategories } = useQuery<CRMCategoryData[]>({
    queryKey: ['/api/crm/categories'],
    queryFn: ({ queryKey }) => apiRequest('GET', queryKey[0] as string),
    staleTime: 60_000,
  });

  const { data: statusCategories = [], isLoading: loadingStatusCategories } = useQuery<CRMCategoryData[]>({
    queryKey: ['/api/crm/status-categories'],
    queryFn: ({ queryKey }) => apiRequest('GET', queryKey[0] as string),
    staleTime: 60_000,
  });

  const { data: projectStatusCategories = [], isLoading: loadingProjectStatusCategories } = useQuery<CRMCategoryData[]>({
    queryKey: ['/api/crm/project-status-categories'],
    queryFn: ({ queryKey }) => apiRequest('GET', queryKey[0] as string),
    staleTime: 60_000,
  });

  const normalizePage = <T,>(page: any): PaginatedPage<T> => {
    if (Array.isArray(page)) {
      return { items: page, totalCount: page.length, hasMore: false };
    }
    return {
      items: page?.items ?? [],
      totalCount: typeof page?.totalCount === 'number' ? page.totalCount : (page?.items?.length ?? 0),
      hasMore: Boolean(page?.hasMore),
    } as PaginatedPage<T>;
  };

  const {
    data: clientPagesData,
    isLoading: loadingClients,
    hasNextPage: clientsHasNext,
    isFetchingNextPage: clientsFetchingNext,
    fetchNextPage: fetchMoreClients,
  } = useInfiniteQuery<PaginatedPage<Contact>>({
    queryKey: ['/api/crm/contacts', 'client', debouncedSearchTerm],
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams();
      params.set('role', 'client');
      params.set('limit', String(CONTACT_PAGE_SIZE));
      params.set('offset', String(pageParam));
      if (debouncedSearchTerm) params.set('search', debouncedSearchTerm);
      const response = await apiRequest('GET', `/api/crm/contacts?${params.toString()}`);
      return normalizePage<Contact>(response);
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore
        ? allPages.reduce((acc, page) => acc + (page.items?.length ?? 0), 0)
        : undefined,
    initialPageParam: 0,
    staleTime: 60_000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const {
    data: providerPagesData,
    isLoading: loadingProviders,
    hasNextPage: providersHasNext,
    isFetchingNextPage: providersFetchingNext,
    fetchNextPage: fetchMoreProviders,
  } = useInfiniteQuery<PaginatedPage<Contact>>({
    queryKey: ['/api/crm/contacts', 'provider', debouncedSearchTerm],
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams();
      params.set('role', 'provider');
      params.set('limit', String(CONTACT_PAGE_SIZE));
      params.set('offset', String(pageParam));
      if (debouncedSearchTerm) params.set('search', debouncedSearchTerm);
      const response = await apiRequest('GET', `/api/crm/contacts?${params.toString()}`);
      return normalizePage<Contact>(response);
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore
        ? allPages.reduce((acc, page) => acc + (page.items?.length ?? 0), 0)
        : undefined,
    initialPageParam: 0,
    staleTime: 60_000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const {
    data: projectPagesData,
    isLoading: loadingProjects,
    hasNextPage: projectsHasNext,
    isFetchingNextPage: projectsFetchingNext,
    fetchNextPage: fetchMoreProjects,
  } = useInfiniteQuery<PaginatedPage<ProjectWithLinks>>({
    queryKey: ['/api/crm/projects', debouncedSearchTerm],
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams();
      params.set('limit', String(PROJECT_PAGE_SIZE));
      params.set('offset', String(pageParam));
      if (debouncedSearchTerm) params.set('search', debouncedSearchTerm);
      const response = await apiRequest('GET', `/api/crm/projects?${params.toString()}`);
      return normalizePage<ProjectWithLinks>(response);
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore
        ? allPages.reduce((acc, page) => acc + (page.items?.length ?? 0), 0)
        : undefined,
    initialPageParam: 0,
    staleTime: 60_000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const clientPages = useMemo(() => (clientPagesData?.pages || []).map(page => normalizePage<Contact>(page)), [clientPagesData]);
  const providerPages = useMemo(() => (providerPagesData?.pages || []).map(page => normalizePage<Contact>(page)), [providerPagesData]);
  const projectPages = useMemo(() => (projectPagesData?.pages || []).map(page => normalizePage<ProjectWithLinks>(page)), [projectPagesData]);

  const clients = useMemo(() => clientPages.flatMap(p => p.items), [clientPages]);
  const providers = useMemo(() => providerPages.flatMap(p => p.items), [providerPages]);
  const projects = useMemo(() => projectPages.flatMap(p => p.items), [projectPages]);

  const clientsTotal = clientPages[0]?.totalCount ?? clients.length;
  const providersTotal = providerPages[0]?.totalCount ?? providers.length;
  const projectsTotal = projectPages[0]?.totalCount ?? projects.length;

  const contactMatchesFilters = (contact: Contact) => {
    const statusMatch =
      statusFilter === 'all'
        ? true
        : (contact.statusCategories || []).includes(Number(statusFilter));

    const categoryMatch =
      categoryFilter === 'all'
        ? true
        : (contact.categories || []).includes(Number(categoryFilter));

    return statusMatch && categoryMatch;
  };

  const filteredClients = useMemo(() => {
    return clients.filter((item) => contactMatchesFilters(item));
  }, [clients, statusFilter, categoryFilter]);

  const filteredProviders = useMemo(() => {
    return providers.filter((item) => contactMatchesFilters(item));
  }, [providers, statusFilter, categoryFilter]);

  const filteredProjects = useMemo(() => {
    return projects;
  }, [projects]);

  const contactMutation = useMutation({
    mutationFn: (payload: Partial<Contact> & { role: ContactRole }) => {
      return apiRequest('POST', '/api/crm/contacts', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/contacts'] });
      setShowNewContactCard(false);
      setContactForm(emptyContactForm);
      toast({ title: 'Guardado', description: 'Contacto creado correctamente.' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'No se pudo guardar el contacto',
        variant: 'destructive',
      });
    },
  });

  const quickCreateContact = useMutation({
    mutationFn: ({ name, role }: { name: string; role: ContactRole }) =>
      apiRequest('POST', '/api/crm/contacts', {
        name,
        role,
        email: '',
        phone: '',
        taxId: '',
        city: '',
        notes: '',
        status: 'active',
        categories: [],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/contacts'] });
      toast({ title: 'Contacto creado', description: 'Se agregó a la lista para asignarlo al proyecto.' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error al crear',
        description: error?.message || 'No se pudo crear el contacto rápido',
        variant: 'destructive',
      });
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: (payload: { name: string; color: string }) =>
      apiRequest('POST', '/api/crm/categories', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/categories'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'No se pudo crear la categoría',
        variant: 'destructive',
      });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: (payload: { id: number; name: string; color: string }) =>
      apiRequest('PATCH', `/api/crm/categories/${payload.id}`, {
        name: payload.name,
        color: payload.color,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/categories'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'No se pudo actualizar la categoría',
        variant: 'destructive',
      });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/crm/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/categories'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'No se pudo eliminar la categoría',
        variant: 'destructive',
      });
    },
  });

  // Status Categories mutations
  const createStatusCategoryMutation = useMutation({
    mutationFn: (payload: { name: string; color: string }) =>
      apiRequest('POST', '/api/crm/status-categories', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/status-categories'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'No se pudo crear el estado',
        variant: 'destructive',
      });
    },
  });

  const updateStatusCategoryMutation = useMutation({
    mutationFn: (payload: { id: number; name: string; color: string }) =>
      apiRequest('PATCH', `/api/crm/status-categories/${payload.id}`, {
        name: payload.name,
        color: payload.color,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/status-categories'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'No se pudo actualizar el estado',
        variant: 'destructive',
      });
    },
  });

  const deleteStatusCategoryMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/crm/status-categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/status-categories'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'No se pudo eliminar el estado',
        variant: 'destructive',
      });
    },
  });

  // Project Status Categories mutations
  const createProjectStatusCategoryMutation = useMutation({
    mutationFn: (payload: { name: string; color: string }) =>
      apiRequest('POST', '/api/crm/project-status-categories', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/project-status-categories'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'No se pudo crear el estado de proyecto',
        variant: 'destructive',
      });
    },
  });

  const updateProjectStatusCategoryMutation = useMutation({
    mutationFn: (payload: { id: number; name: string; color: string }) =>
      apiRequest('PATCH', `/api/crm/project-status-categories/${payload.id}`, {
        name: payload.name,
        color: payload.color,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/project-status-categories'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'No se pudo actualizar el estado de proyecto',
        variant: 'destructive',
      });
    },
  });

  const deleteProjectStatusCategoryMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/crm/project-status-categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/project-status-categories'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'No se pudo eliminar el estado de proyecto',
        variant: 'destructive',
      });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/crm/contacts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/contacts'] });
      toast({ title: 'Eliminado', description: 'Contacto eliminado.' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'No se pudo eliminar el contacto',
        variant: 'destructive',
      });
    },
  });

  const projectPayload = (form: ProjectFormState) => {
    const budgetNumber = form.budget ? Number(form.budget) : null;
    const normalizeText = (value: string) => {
      const trimmed = value?.trim?.() || '';
      return trimmed.length ? trimmed : null;
    };

    const toUniqueIds = (ids: number[]) =>
      Array.from(new Set(ids))
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id));

    const clampProgress = (value: number) => {
      if (!Number.isFinite(value)) return 0;
      return Math.min(100, Math.max(0, value));
    };

    const statusCategoryIds = form.statusCategories
      .map(c => c.id)
      .filter((id): id is number => id !== undefined);

    return {
      name: normalizeText(form.name) || '',
      code: normalizeText(form.code),
      stage: normalizeText(form.stage),
      description: normalizeText(form.description),
      startDate: form.startDate ? form.startDate : null,
      dueDate: form.dueDate ? form.dueDate : null,
      budget: Number.isFinite(budgetNumber as number) ? budgetNumber : null,
      progress: clampProgress(form.progress),
      statusCategories: statusCategoryIds,
      clientIds: toUniqueIds(form.clientIds),
      providerIds: toUniqueIds(form.providerIds),
    };
  };

  const projectMutation = useMutation({
    mutationFn: (payload: ProjectFormState) => {
      const body = projectPayload(payload);
      if (editingProjectId) {
        return apiRequest('PATCH', `/api/crm/projects/${editingProjectId}`, body);
      }
      return apiRequest('POST', '/api/crm/projects', body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/projects'] });
      setProjectDialogOpen(false);
      setEditingProjectId(null);
      setProjectForm(emptyProjectForm);
      toast({ title: 'Guardado', description: 'Proyecto actualizado correctamente.' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error al guardar',
        description: error?.message || 'No se pudo guardar el proyecto',
        variant: 'destructive',
      });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/crm/projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/projects'] });
      toast({ title: 'Eliminado', description: 'Proyecto eliminado.' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'No se pudo eliminar el proyecto',
        variant: 'destructive',
      });
    },
  });

  // Company employees query
  const { data: companyEmployeesData = [] } = useQuery<Array<{ id: number; fullName: string }>>({
    queryKey: ['/api/company/employees', projectEmployeeSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (projectEmployeeSearch) params.set('search', projectEmployeeSearch);
      try {
        const response = await apiRequest('GET', `/api/company/employees?${params.toString()}`);
        return Array.isArray(response) ? response : [];
      } catch (error) {
        console.error('Error fetching employees:', error);
        return [];
      }
    },
    enabled: projectDialogOpen && editingProjectId !== null,
  });

  // Get assigned users to current project
  const { data: assignedUsersData = [] } = useQuery<Array<{ id: number; fullName: string }>>({
    queryKey: [`/api/crm/projects/${editingProjectId}/users`],
    queryFn: async () => {
      if (!editingProjectId) return [];
      const response = await apiRequest('GET', `/api/crm/projects/${editingProjectId}/users`);
      return Array.isArray(response) ? response : [];
    },
    enabled: projectDialogOpen && editingProjectId !== null,
  });

  // Update projectAssignedUsers when data changes
  useEffect(() => {
    setProjectAssignedUsers(assignedUsersData);
  }, [assignedUsersData]);

  // Assign user to project
  const assignUserMutation = useMutation({
    mutationFn: (userId: number) => 
      apiRequest('POST', `/api/crm/projects/${editingProjectId}/users`, { userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/crm/projects/${editingProjectId}/users`] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'No se pudo asignar el usuario',
        variant: 'destructive',
      });
    },
  });

  // Remove user from project
  const removeUserMutation = useMutation({
    mutationFn: (userId: number) => 
      apiRequest('DELETE', `/api/crm/projects/${editingProjectId}/users/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/crm/projects/${editingProjectId}/users`] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'No se pudo remover el usuario',
        variant: 'destructive',
      });
    },
  });

  const filteredCompanyEmployees = useMemo(() => {
    const assignedIds = new Set(projectAssignedUsers.map(u => u.id));
    return companyEmployeesData.filter(emp => !assignedIds.has(emp.id));
  }, [companyEmployeesData, projectAssignedUsers]);

  const openNewContactCard = (role: ContactRole) => {
    setContactRole(role);
    setContactForm(emptyContactForm);
    setShowNewContactCard(true);
  };

  const openProjectDialog = (project?: ProjectWithLinks) => {
    if (project) {
      setEditingProjectId(project.project.id);
      // Las categorías de estado ya vienen como objetos completos desde el backend
      const projectStatusCats = project.project.statusCategories && Array.isArray(project.project.statusCategories)
        ? project.project.statusCategories
        : [];
      setProjectForm({
        name: project.project.name || '',
        code: project.project.code || '',
        statusCategories: projectStatusCats,
        stage: project.project.stage || '',
        description: project.project.description || '',
        startDate: project.project.startDate ? project.project.startDate.substring(0, 10) : '',
        dueDate: project.project.dueDate ? project.project.dueDate.substring(0, 10) : '',
        budget: project.project.budget || '',
        progress: project.project.progress ?? 0,
        clientIds: (project.clients || []).map((c) => c.id),
        providerIds: (project.providers || []).map((c) => c.id),
      });
    } else {
      setEditingProjectId(null);
      setProjectForm(emptyProjectForm);
    }
    setProjectDialogOpen(true);
  };

  const stats = {
    clients: clientsTotal,
    providers: providersTotal,
    projects: projectsTotal,
  };

  useStandardInfiniteScroll({
    targetRef: loadMoreRef,
    enabled: activeTab === 'clients' || activeTab === 'providers' || activeTab === 'projects',
    canLoadMore:
      (activeTab === 'clients' && !!clientsHasNext) ||
      (activeTab === 'providers' && !!providersHasNext) ||
      (activeTab === 'projects' && !!projectsHasNext),
    isLoadingMore:
      (activeTab === 'clients' && clientsFetchingNext) ||
      (activeTab === 'providers' && providersFetchingNext) ||
      (activeTab === 'projects' && projectsFetchingNext),
    onLoadMore: () => {
      if (activeTab === 'clients' && clientsHasNext && !clientsFetchingNext) {
        fetchMoreClients();
      }
      if (activeTab === 'providers' && providersHasNext && !providersFetchingNext) {
        fetchMoreProviders();
      }
      if (activeTab === 'projects' && projectsHasNext && !projectsFetchingNext) {
        fetchMoreProjects();
      }
    },
    dependencyKey: `${activeTab}-${filteredClients.length}-${filteredProviders.length}-${filteredProjects.length}`,
    rootMargin: '120px',
  });

  return (
    <div>
      <StatsCardGrid columns={3}>
        <StatsCard icon={Users} label="Clientes" value={stats.clients} color="blue" isLoading={loadingClients} index={0} />
        <StatsCard icon={Building2} label="Proveedores" value={stats.providers} color="emerald" isLoading={loadingProviders} index={1} />
        <StatsCard icon={FolderKanban} label="Proyectos" value={stats.projects} color="purple" isLoading={loadingProjects} index={2} />
      </StatsCardGrid>

      <TabNavigation
        tabs={[
          { id: 'clients', label: 'Clientes', icon: Users },
          { id: 'providers', label: 'Proveedores', icon: Building2 },
          { id: 'projects', label: 'Proyectos', icon: FolderKanban },
          { id: 'capture', label: 'Captación', icon: AlertCircle },
        ]}
        activeTab={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId as any)}
      />

      <div className="space-y-4">
        {(activeTab === 'clients' || activeTab === 'providers') && (
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg">
              <span className="text-sm font-medium text-foreground">
                {activeTab === 'clients' ? filteredClients.length : filteredProviders.length}
              </span>
              <span className="text-sm text-muted-foreground">
                {activeTab === 'clients' ? 'clientes' : 'proveedores'}
              </span>
            </div>

            <div className="relative w-[240px]">
              <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Buscar por nombre..."
                className="h-9 pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {statusCategories
                  .filter((cat): cat is CRMCategoryData & { id: number } => cat.id !== undefined)
                  .map((cat) => (
                    <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categories
                  .filter((cat): cat is CRMCategoryData & { id: number } => cat.id !== undefined)
                  .map((cat) => (
                    <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setStatusFilter('all');
                setCategoryFilter('all');
              }}
              disabled={statusFilter === 'all' && categoryFilter === 'all'}
            >
              Limpiar
            </Button>

            <div className="flex-1" />

            <Button size="sm" onClick={() => openNewContactCard(activeTab === 'clients' ? 'client' : 'provider')}>
              <Plus className="h-4 w-4 mr-1" />
              Contacto
            </Button>
          </div>
        )}

        {(activeTab === 'clients' || activeTab === 'providers') && (
          <div className="md:hidden space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg">
                <span className="text-sm font-medium text-foreground">
                  {activeTab === 'clients' ? filteredClients.length : filteredProviders.length}
                </span>
                <span className="text-sm text-muted-foreground">
                  {activeTab === 'clients' ? 'clientes' : 'proveedores'}
                </span>
              </div>
              <Button size="sm" onClick={() => openNewContactCard(activeTab === 'clients' ? 'client' : 'provider')}>
                <Plus className="h-4 w-4 mr-1" />
                Contacto
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <div className="relative">
                <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Buscar por nombre..."
                  className="h-9 pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {statusCategories
                      .filter((cat): cat is CRMCategoryData & { id: number } => cat.id !== undefined)
                      .map((cat) => (
                        <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>

                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {categories
                      .filter((cat): cat is CRMCategoryData & { id: number } => cat.id !== undefined)
                      .map((cat) => (
                        <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setStatusFilter('all');
                  setCategoryFilter('all');
                }}
                disabled={statusFilter === 'all' && categoryFilter === 'all'}
              >
                Limpiar filtros
              </Button>
            </div>
          </div>
        )}

        {activeTab === 'projects' && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg">
              <span className="text-sm font-medium text-foreground dark:text-white">{filteredProjects.length}</span>
              <span className="text-sm text-muted-foreground dark:text-gray-400">proyectos</span>
            </div>

            <div className="relative flex-1 max-w-md">
              <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Buscar proyectos..."
                className="pl-9 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="hidden sm:block flex-1" />

            <Button onClick={() => openProjectDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo proyecto
            </Button>
          </div>
        )}

        {/* Lists Content */}
        <div>
        {activeTab === 'clients' && (
          <>
            <ContactsList
              data={filteredClients}
              loading={loadingClients}
              onDelete={(id) => deleteContactMutation.mutate(id)}
              emptyLabel="Aún no tienes clientes"
              role="client"
              showNewContactCard={showNewContactCard && contactRole === 'client'}
              newContactDraft={contactForm}
              newContactSaving={contactMutation.isPending}
              onNewContactChange={setContactForm}
              onSaveNewContact={() =>
                contactMutation.mutate({
                  ...contactForm,
                  categories: contactForm.categories
                    .map(c => c.id)
                    .filter((id): id is number => id !== undefined),
                  statusCategories: contactForm.statusCategories
                    .map(c => c.id)
                    .filter((id): id is number => id !== undefined),
                  role: 'client',
                })
              }
              onCancelNewContact={() => {
                setShowNewContactCard(false);
                setContactForm(emptyContactForm);
              }}
              categories={categories}
              statusCategories={statusCategories}
              onCreateCategory={(name, color) => createCategoryMutation.mutate({ name, color })}
              onUpdateCategory={(id, name, color) => updateCategoryMutation.mutate({ id, name, color })}
              onDeleteCategory={(id) => deleteCategoryMutation.mutate(id)}
              onCreateStatusCategory={(name, color) => createStatusCategoryMutation.mutate({ name, color })}
              onUpdateStatusCategory={(id, name, color) => updateStatusCategoryMutation.mutate({ id, name, color })}
              onDeleteStatusCategory={(id) => deleteStatusCategoryMutation.mutate(id)}
            />
            <div ref={loadMoreRef} className="h-8" />
            {clientsFetchingNext && (
              <div className="py-4 text-center text-sm text-muted-foreground">Cargando más...</div>
            )}
          </>
        )}

        {activeTab === 'providers' && (
          <>
            <ContactsList
              data={filteredProviders}
              loading={loadingProviders}
              onDelete={(id) => deleteContactMutation.mutate(id)}
              emptyLabel="Aún no tienes proveedores"
              role="provider"
              showNewContactCard={showNewContactCard && contactRole === 'provider'}
              newContactDraft={contactForm}
              newContactSaving={contactMutation.isPending}
              onNewContactChange={setContactForm}
              onSaveNewContact={() =>
                contactMutation.mutate({
                  ...contactForm,
                  categories: contactForm.categories
                    .map(c => c.id)
                    .filter((id): id is number => id !== undefined),
                  statusCategories: contactForm.statusCategories
                    .map(c => c.id)
                    .filter((id): id is number => id !== undefined),
                  role: 'provider',
                })
              }
              onCancelNewContact={() => {
                setShowNewContactCard(false);
                setContactForm(emptyContactForm);
              }}
              categories={categories}
              statusCategories={statusCategories}
              onCreateCategory={(name, color) => createCategoryMutation.mutate({ name, color })}
              onUpdateCategory={(id, name, color) => updateCategoryMutation.mutate({ id, name, color })}
              onDeleteCategory={(id) => deleteCategoryMutation.mutate(id)}
              onCreateStatusCategory={(name, color) => createStatusCategoryMutation.mutate({ name, color })}
              onUpdateStatusCategory={(id, name, color) => updateStatusCategoryMutation.mutate({ id, name, color })}
              onDeleteStatusCategory={(id) => deleteStatusCategoryMutation.mutate(id)}
            />
            <div ref={loadMoreRef} className="h-8" />
            {providersFetchingNext && (
              <div className="py-4 text-center text-sm text-muted-foreground">Cargando más...</div>
            )}
          </>
        )}

        {activeTab === 'projects' && (
          <>
            <ProjectsList
              data={filteredProjects}
              loading={loadingProjects}
              onEdit={openProjectDialog}
              onDelete={(id) => deleteProjectMutation.mutate(id)}
            />
            <div ref={loadMoreRef} className="h-8" />
            {projectsFetchingNext && (
              <div className="py-4 text-center text-sm text-muted-foreground">Cargando más...</div>
            )}
          </>
        )}

        {activeTab === 'capture' && <CRMCapturePanel />}
      </div>
      </div>

      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
        <DialogContent className="max-w-3xl dark:bg-gray-900 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProjectId ? 'Editar proyecto' : 'Nuevo proyecto'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="dark:text-white">Nombre *</Label>
                <Input
                  value={projectForm.name}
                  onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                  placeholder="Ej: Reforma local"
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div>
                <Label className="dark:text-white">Código</Label>
                <Input
                  value={projectForm.code}
                  onChange={(e) => setProjectForm({ ...projectForm, code: e.target.value })}
                  placeholder="PR-2025-001"
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
            </div>

            {/* Estados del proyecto - movido aquí arriba */}
            <div>
              <Label className="dark:text-white mb-2 block">Estado</Label>
              <CategoryMultiSelect
                selectedCategories={projectForm.statusCategories}
                availableCategories={projectStatusCategories}
                multiSelect={false}
                onAdd={(category) => {
                  // En modo single-select, reemplazar la categoría existente
                  const newStatusCategories = [category];
                  setProjectForm({
                    ...projectForm,
                    statusCategories: newStatusCategories,
                  });
                }}
                onRemove={(categoryId) => {
                  const newStatusCategories = projectForm.statusCategories.filter(c => c.id !== categoryId);
                  setProjectForm({
                    ...projectForm,
                    statusCategories: newStatusCategories,
                  });
                }}
                onCreateNew={(name, color) => {
                  createProjectStatusCategoryMutation.mutate({ name, color }, {
                    onSuccess: (newCategory) => {
                      // En modo single-select, reemplazar la categoría existente
                      setProjectForm({
                        ...projectForm,
                        statusCategories: [newCategory as CRMCategoryData],
                      });
                    },
                  });
                }}
                onEditCategory={(category) => {
                  if (category.id) {
                    setProjectForm({
                      ...projectForm,
                      statusCategories: projectForm.statusCategories.map((c) =>
                        c.id === category.id ? { ...c, name: category.name, color: category.color } : c
                      ),
                    });
                    updateProjectStatusCategoryMutation.mutate({
                      id: category.id,
                      name: category.name,
                      color: category.color,
                    });
                  }
                }}
                onDeleteCategory={(categoryId) => {
                  setProjectForm({
                    ...projectForm,
                    statusCategories: projectForm.statusCategories.filter(c => c.id !== categoryId),
                  });
                  deleteProjectStatusCategoryMutation.mutate(categoryId);
                }}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="dark:text-white">Inicio</Label>
                <DatePickerDay
                  date={projectForm.startDate ? new Date(projectForm.startDate) : undefined}
                  onDateChange={(d) =>
                    setProjectForm({
                      ...projectForm,
                      startDate: d ? d.toISOString().slice(0, 10) : '',
                    })
                  }
                  className="w-full"
                  placeholder="Seleccionar fecha"
                />
              </div>
              <div>
                <Label className="dark:text-white">Entrega</Label>
                <DatePickerDay
                  date={projectForm.dueDate ? new Date(projectForm.dueDate) : undefined}
                  onDateChange={(d) =>
                    setProjectForm({
                      ...projectForm,
                      dueDate: d ? d.toISOString().slice(0, 10) : '',
                    })
                  }
                  className="w-full"
                  placeholder="Seleccionar fecha"
                />
              </div>
              <div>
                <Label className="dark:text-white">Fase</Label>
                <Input
                  value={projectForm.stage}
                  onChange={(e) => setProjectForm({ ...projectForm, stage: e.target.value })}
                  placeholder="Descubrimiento, Ejecución..."
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div>
                <Label className="dark:text-white">Presupuesto (€)</Label>
                <Input
                  type="number"
                  value={projectForm.budget}
                  onChange={(e) => setProjectForm({ ...projectForm, budget: e.target.value })}
                  placeholder="10000"
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div>
                <Label>Progreso (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={projectForm.progress}
                  onChange={(e) => setProjectForm({ ...projectForm, progress: Number(e.target.value) || 0 })}
                  placeholder="0"
                  className="dark:bg-gray-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="dark:text-white">Clientes</Label>
                <ContactSelectField
                  role="client"
                  options={clients}
                  selectedIds={projectForm.clientIds}
                  onChange={(ids) => setProjectForm((prev) => ({ ...prev, clientIds: ids }))}
                  onCreate={async (name) => quickCreateContact.mutateAsync({ name, role: 'client' })}
                />
              </div>
              <div className="space-y-2">
                <Label className="dark:text-white">Proveedores</Label>
                <ContactSelectField
                  role="provider"
                  options={providers}
                  selectedIds={projectForm.providerIds}
                  onChange={(ids) => setProjectForm((prev) => ({ ...prev, providerIds: ids }))}
                  onCreate={async (name) => quickCreateContact.mutateAsync({ name, role: 'provider' })}
                />
              </div>
            </div>

            <div>
              <Label className="dark:text-white">Descripción</Label>
              <Textarea
                value={projectForm.description}
                onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                placeholder="Notas, alcance, entregables..."
                className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                rows={3}
              />
            </div>

            {/* Sección de empleados asignados al proyecto */}
            {editingProjectId && (
              <div className="border-t dark:border-gray-700 pt-4 mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <Label className="dark:text-white font-semibold">Empleados del proyecto</Label>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  Los empleados seleccionados podrán añadir gastos a este proyecto
                </p>

                {/* Búsqueda global */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400" />
                  <Input
                    placeholder="Buscar empleado..."
                    value={projectEmployeeSearch}
                    onChange={(e) => setProjectEmployeeSearch(e.target.value)}
                    className="pl-10 h-10 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                  />
                </div>

                {/* Dos columnas: Disponibles | Asignados */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Columna izquierda: Empleados disponibles */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Disponibles ({filteredCompanyEmployees.filter(emp => 
                          projectEmployeeSearch ? emp.fullName.toLowerCase().includes(projectEmployeeSearch.toLowerCase()) : true
                        ).length})
                      </span>
                      {filteredCompanyEmployees.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            filteredCompanyEmployees.forEach(emp => assignUserMutation.mutate(emp.id));
                          }}
                          disabled={assignUserMutation.isPending}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                        >
                          Añadir todos
                        </button>
                      )}
                    </div>
                    
                    <div className="h-64 overflow-y-auto space-y-1 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-2 border border-gray-200 dark:border-gray-700">
                      {filteredCompanyEmployees.filter(emp => 
                        projectEmployeeSearch ? emp.fullName.toLowerCase().includes(projectEmployeeSearch.toLowerCase()) : true
                      ).length === 0 ? (
                        <div className="text-center py-8 text-xs text-gray-500 dark:text-gray-400">
                          {projectEmployeeSearch ? 'No hay empleados que coincidan' : 'Todos asignados'}
                        </div>
                      ) : (
                        filteredCompanyEmployees
                          .filter(emp => 
                            projectEmployeeSearch ? emp.fullName.toLowerCase().includes(projectEmployeeSearch.toLowerCase()) : true
                          )
                          .map((employee) => (
                            <div
                              key={employee.id}
                              onClick={() => assignUserMutation.mutate(employee.id)}
                              className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20 group"
                            >
                              <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center transition-colors group-hover:border-blue-600">
                              </div>
                              <span className="text-sm text-gray-900 dark:text-white flex-1">{employee.fullName}</span>
                            </div>
                          ))
                      )}
                    </div>
                  </div>

                  {/* Columna derecha: Empleados asignados */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Asignados ({projectAssignedUsers.filter(user => 
                          projectEmployeeSearch ? user.fullName.toLowerCase().includes(projectEmployeeSearch.toLowerCase()) : true
                        ).length})
                      </span>
                      {projectAssignedUsers.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            projectAssignedUsers.forEach(user => removeUserMutation.mutate(user.id));
                          }}
                          disabled={removeUserMutation.isPending}
                          className="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                        >
                          Eliminar todos
                        </button>
                      )}
                    </div>
                    
                    <div className="h-64 overflow-y-auto space-y-1 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl p-2 border border-blue-200 dark:border-blue-800">
                      {projectAssignedUsers.filter(user => 
                        projectEmployeeSearch ? user.fullName.toLowerCase().includes(projectEmployeeSearch.toLowerCase()) : true
                      ).length === 0 ? (
                        <div className="text-center py-8 text-xs text-gray-500 dark:text-gray-400">
                          {projectEmployeeSearch ? 'No hay empleados que coincidan' : 'Ningún empleado asignado'}
                        </div>
                      ) : (
                        projectAssignedUsers
                          .filter(user => 
                            projectEmployeeSearch ? user.fullName.toLowerCase().includes(projectEmployeeSearch.toLowerCase()) : true
                          )
                          .map((user) => (
                            <div
                              key={user.id}
                              onClick={() => removeUserMutation.mutate(user.id)}
                              className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 group"
                            >
                              <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center transition-colors">
                                <Check className="h-3 w-3 text-white" />
                              </div>
                              <span className="text-sm text-gray-900 dark:text-white flex-1">{user.fullName}</span>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setProjectDialogOpen(false);
                setEditingProjectId(null);
                setProjectForm(emptyProjectForm);
                setProjectEmployeeSearch('');
                setProjectAssignedUsers([]);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                projectMutation.mutate(projectForm);
              }}
              disabled={!projectForm.name || projectMutation.isPending}
            >
              {projectMutation.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Componente para mostrar lista de contactos (clientes o proveedores) en formato card
function ContactsList({
  data,
  loading,
  onDelete,
  emptyLabel,
  role,
  showNewContactCard = false,
  newContactDraft,
  newContactSaving = false,
  onNewContactChange,
  onSaveNewContact,
  onCancelNewContact,
  categories,
  statusCategories,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onCreateStatusCategory,
  onUpdateStatusCategory,
  onDeleteStatusCategory,
}: {
  data: Contact[];
  loading: boolean;
  onDelete: (id: number) => void;
  emptyLabel: string;
  role: ContactRole;
  showNewContactCard?: boolean;
  newContactDraft?: ContactFormState;
  newContactSaving?: boolean;
  onNewContactChange?: (form: ContactFormState) => void;
  onSaveNewContact?: () => void;
  onCancelNewContact?: () => void;
  categories: CRMCategoryData[];
  statusCategories: CRMCategoryData[];
  onCreateCategory?: (name: string, color: string) => void;
  onUpdateCategory?: (id: number, name: string, color: string) => void;
  onDeleteCategory?: (id: number) => void;
  onCreateStatusCategory?: (name: string, color: string) => void;
  onUpdateStatusCategory?: (id: number, name: string, color: string) => void;
  onDeleteStatusCategory?: (id: number) => void;
}) {
  const { toast } = useToast();
  const [expandedContactId, setExpandedContactId] = useState<number | null>(null);
  const [contactPendingDelete, setContactPendingDelete] = useState<{ id: number; name: string } | null>(null);
  const [drafts, setDrafts] = useState<Record<number, {
    label: string;
    name: string;
    email: string;
    phone: string;
    taxId: string;
    city: string;
    postalAddress: string;
    notes: string;
    categories: number[];
    statusCategories: number[];
  }>>({});
  const listRef = useRef<HTMLDivElement | null>(null);
  const saveTimeoutsRef = useRef<Record<number, ReturnType<typeof setTimeout> | undefined>>({});
  const pendingPayloadRef = useRef<Record<number, Partial<Contact>>>({});

  const getNextStatusCategoryId = (currentStatusId?: number | null) => {
    const available = statusCategories.filter((cat): cat is CRMCategoryData & { id: number } => cat.id !== undefined);
    if (available.length === 0) return null;

    const currentIndex = available.findIndex((cat) => cat.id === currentStatusId);
    if (currentIndex === -1) return available[0].id;

    const nextIndex = (currentIndex + 1) % available.length;
    return available[nextIndex].id;
  };

  const getInitialDraft = (contact: Contact) => ({
    label: contact.label || '',
    name: contact.name || '',
    email: contact.email || '',
    phone: contact.phone || '',
    taxId: contact.taxId || '',
    city: contact.city || '',
    postalAddress: contact.postalAddress || '',
    notes: contact.notes || '',
    categories: (Array.isArray(contact.categories) ? contact.categories : []).filter((id): id is number => typeof id === 'number'),
    statusCategories: (Array.isArray(contact.statusCategories) ? contact.statusCategories : []).filter((id): id is number => typeof id === 'number'),
  });

  const inlineUpdateMutation = useMutation({
    mutationFn: ({ contactId, payload }: { contactId: number; payload: Partial<Contact> }) =>
      apiRequest('PATCH', `/api/crm/contacts/${contactId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/capture/pipeline'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error al guardar',
        description: error?.message || 'No se pudo guardar el contacto',
        variant: 'destructive',
      });
    },
  });

  const flushPendingSave = useCallback((contactId: number) => {
    const pending = pendingPayloadRef.current[contactId];
    if (!pending || Object.keys(pending).length === 0) return;
    pendingPayloadRef.current[contactId] = {};
    inlineUpdateMutation.mutate({ contactId, payload: pending });
  }, [inlineUpdateMutation]);

  const scheduleSave = useCallback((contactId: number, partialPayload: Partial<Contact>, immediate = false) => {
    pendingPayloadRef.current[contactId] = {
      ...(pendingPayloadRef.current[contactId] || {}),
      ...partialPayload,
    };

    const currentTimeout = saveTimeoutsRef.current[contactId];
    if (currentTimeout) clearTimeout(currentTimeout);

    if (immediate) {
      flushPendingSave(contactId);
      return;
    }

    saveTimeoutsRef.current[contactId] = setTimeout(() => {
      flushPendingSave(contactId);
    }, 500);
  }, [flushPendingSave]);

  const updateDraftField = (
    contactId: number,
    field: 'label' | 'name' | 'email' | 'phone' | 'taxId' | 'city' | 'postalAddress' | 'notes' | 'categories' | 'statusCategories',
    value: string | number[]
  ) => {
    setDrafts((prev) => {
      const base = prev[contactId] || getInitialDraft(data.find((item) => item.id === contactId)!);
      return {
        ...prev,
        [contactId]: {
          ...base,
          [field]: value,
        },
      };
    });
  };

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (expandedContactId === null) return;
      const target = event.target as Node;
      if (listRef.current && !listRef.current.contains(target)) {
        flushPendingSave(expandedContactId);
        setExpandedContactId(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [expandedContactId, flushPendingSave]);

  useEffect(() => {
    return () => {
      Object.values(saveTimeoutsRef.current).forEach((timeoutId) => {
        if (timeoutId) clearTimeout(timeoutId);
      });
    };
  }, []);

  // Mapa de colores para convertir nombres a clases Tailwind (bg y text)
  const colorMap: Record<string, { bg: string; text: string }> = {
    'predeterminado': { bg: 'bg-gray-100 dark:bg-gray-900/40', text: 'text-gray-700 dark:text-gray-300' },
    'naranja': { bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-700 dark:text-orange-300' },
    'gris': { bg: 'bg-slate-100 dark:bg-slate-900/40', text: 'text-slate-700 dark:text-slate-300' },
    'marron': { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300' },
    'amarillo': { bg: 'bg-yellow-100 dark:bg-yellow-900/40', text: 'text-yellow-700 dark:text-yellow-300' },
    'verde': { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300' },
    'azul': { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300' },
    'morado': { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-300' },
    'rosa': { bg: 'bg-pink-100 dark:bg-pink-900/40', text: 'text-pink-700 dark:text-pink-300' },
    'rojo': { bg: 'bg-rose-100 dark:bg-rose-900/40', text: 'text-rose-700 dark:text-rose-300' },
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (!data.length && !showNewContactCard) {
    return (
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardContent className="py-12 text-center">
          {role === 'client' ? <Users className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" /> : <Building2 className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />}
          <p className="text-gray-500 dark:text-gray-400 mb-4">{emptyLabel}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div ref={listRef} className="space-y-3">
      {showNewContactCard && newContactDraft && (
        <Card className="border border-blue-200 dark:border-blue-700 dark:bg-gray-800 rounded-2xl ring-1 ring-blue-400/40 overflow-visible">
          <CardContent className="bg-gray-50/70 dark:bg-gray-900/20 p-4 overflow-visible">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 overflow-visible">
              <div>
                <Label className="text-xs text-gray-500">Nombre *</Label>
                <Input
                  value={newContactDraft.name}
                  onChange={(e) => onNewContactChange?.({ ...newContactDraft, name: e.target.value })}
                  placeholder="Ej: Cliente ABC"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Email</Label>
                <Input
                  type="email"
                  value={newContactDraft.email}
                  onChange={(e) => onNewContactChange?.({ ...newContactDraft, email: e.target.value })}
                  placeholder="correo@empresa.com"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Teléfono</Label>
                <Input
                  value={newContactDraft.phone}
                  onChange={(e) => onNewContactChange?.({ ...newContactDraft, phone: e.target.value })}
                  placeholder="+34 600 000 000"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500">CIF/NIF</Label>
                <Input
                  value={newContactDraft.taxId}
                  onChange={(e) => onNewContactChange?.({ ...newContactDraft, taxId: e.target.value })}
                  placeholder="B12345678"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Estado</Label>
                <CategoryMultiSelect
                  selectedCategories={newContactDraft.statusCategories}
                  availableCategories={statusCategories}
                  multiSelect={false}
                  onAdd={(category) => {
                    onNewContactChange?.({
                      ...newContactDraft,
                      statusCategories: [category],
                    });
                  }}
                  onRemove={(categoryId) => {
                    onNewContactChange?.({
                      ...newContactDraft,
                      statusCategories: newContactDraft.statusCategories.filter(c => c.id !== categoryId),
                    });
                  }}
                  onCreateNew={(name, color) => {
                    if (onCreateStatusCategory) {
                      onCreateStatusCategory(name, color);
                    }
                  }}
                  onEditCategory={(category) => {
                    if (category.id && onUpdateStatusCategory) {
                      onUpdateStatusCategory(category.id, category.name, category.color);
                    }
                  }}
                  onDeleteCategory={(categoryId) => {
                    onNewContactChange?.({
                      ...newContactDraft,
                      statusCategories: newContactDraft.statusCategories.filter(c => c.id !== categoryId),
                    });
                    if (onDeleteStatusCategory) onDeleteStatusCategory(categoryId);
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-3">
              <div className="md:col-span-2">
                <Label className="text-xs text-gray-500">Dirección postal</Label>
                <Input
                  value={newContactDraft.postalAddress}
                  onChange={(e) => onNewContactChange?.({ ...newContactDraft, postalAddress: e.target.value })}
                  placeholder="Calle, número, CP"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Ciudad</Label>
                <Input
                  value={newContactDraft.city}
                  onChange={(e) => onNewContactChange?.({ ...newContactDraft, city: e.target.value })}
                  placeholder="Madrid"
                />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs text-gray-500">Categorías</Label>
                <CategoryMultiSelect
                  selectedCategories={newContactDraft.categories}
                  availableCategories={categories}
                  onAdd={(category) => {
                    if (!newContactDraft.categories.find(c => c.id === category.id)) {
                      onNewContactChange?.({
                        ...newContactDraft,
                        categories: [...newContactDraft.categories, category],
                      });
                    }
                  }}
                  onRemove={(categoryId) => {
                    onNewContactChange?.({
                      ...newContactDraft,
                      categories: newContactDraft.categories.filter(c => c.id !== categoryId),
                    });
                  }}
                  onCreateNew={(name, color) => {
                    if (onCreateCategory) {
                      onCreateCategory(name, color);
                    }
                  }}
                  onEditCategory={(category) => {
                    if (category.id && onUpdateCategory) {
                      onUpdateCategory(category.id, category.name, category.color);
                    }
                  }}
                  onDeleteCategory={(categoryId) => {
                    onNewContactChange?.({
                      ...newContactDraft,
                      categories: newContactDraft.categories.filter(c => c.id !== categoryId),
                    });
                    if (onDeleteCategory) onDeleteCategory(categoryId);
                  }}
                />
              </div>
            </div>

            <div className="mt-3">
              <Label className="text-xs text-gray-500">Notas</Label>
              <Textarea
                rows={3}
                value={newContactDraft.notes}
                onChange={(e) => onNewContactChange?.({ ...newContactDraft, notes: e.target.value })}
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={onCancelNewContact}>Cancelar</Button>
              <Button onClick={onSaveNewContact} disabled={!newContactDraft.name || newContactSaving}>
                {newContactSaving ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {data.map((contact) => {
        const isExpanded = expandedContactId === contact.id;
        const draft = drafts[contact.id] || getInitialDraft(contact);

        // Convertir IDs de estado a objetos
        const statusCats = contact.statusCategories && Array.isArray(contact.statusCategories) && contact.statusCategories.length > 0
          ? contact.statusCategories
              .map(id => statusCategories.find(cat => cat.id === id))
              .filter((cat): cat is CRMCategoryData => cat !== undefined)
          : null;
        const primaryStatus = statusCats && statusCats.length > 0 ? statusCats[0] : null;
        const canQuickStatusChange = statusCategories.some((cat) => cat.id !== undefined);

        return (
        <Card
          key={contact.id}
          className={`border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-2xl hover:shadow-md transition-all cursor-pointer ${isExpanded ? 'ring-1 ring-blue-400/40 overflow-visible' : 'overflow-hidden'}`}
          role="button"
          onClick={() => {
            setDrafts((prev) => ({
              ...prev,
              [contact.id]: prev[contact.id] || getInitialDraft(contact),
            }));
            setExpandedContactId((prev) => (prev === contact.id ? null : contact.id));
          }}
        >
          {!isExpanded && (
          <CardContent className="p-0">
            <div className="flex items-stretch">
              {/* Contenido principal */}
              <div className="p-4 flex flex-col gap-2 md:flex-row md:items-center md:gap-6 text-sm text-gray-700 dark:text-gray-300 flex-1 min-w-0 overflow-hidden">
                {/* Nombre y CIF */}
                <div className="flex items-center gap-3 min-w-[160px] md:min-w-[180px] flex-shrink-0">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">{contact.name}</p>
                    {contact.taxId && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5 truncate">{contact.taxId}</p>
                    )}
                  </div>
                </div>

                {/* Datos de contacto - columnas fijas alineadas */}
                <div className="hidden md:flex items-center gap-4 flex-1 min-w-0 overflow-hidden">
                  {/* Email */}
                  <span className="text-xs text-gray-600 dark:text-gray-400 truncate flex-shrink-0 w-[160px] hidden lg:block">
                    {contact.email || '-'}
                  </span>
                  
                  {/* Teléfono */}
                  <span className="text-xs text-gray-600 dark:text-gray-400 truncate w-[120px] flex-shrink-0">
                    {contact.phone || '-'}
                  </span>
                  
                  {/* Ciudad */}
                  <span className="text-xs text-gray-600 dark:text-gray-400 truncate w-[90px] flex-shrink-0 hidden xl:block">
                    {contact.city || '-'}
                  </span>
                  
                  {/* Categorías - prioridad, ocupa el resto del espacio */}
                  <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto">
                    {contact.categories && contact.categories.length > 0 ? (
                      <>
                        {contact.categories
                          .slice(0, 3)
                          .map((categoryId: number) => {
                            const category = categories.find(c => c.id === categoryId);
                            return category ? (
                              <CategoryTag
                                key={category.id}
                                category={category}
                                onEdit={() => {}}
                                onDelete={() => {}}
                                showMenu={false}
                              />
                            ) : null;
                          })}
                        {contact.categories.length > 3 && (
                          <span className="text-gray-500 dark:text-gray-400 text-xs font-medium flex-shrink-0">
                            +{contact.categories.length - 3}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </div>
                </div>

              </div>

              {/* Sección coloreada de estado - extremo derecho */}
              <div 
                className={`w-[128px] flex items-center justify-center flex-shrink-0 px-3 ${canQuickStatusChange ? 'cursor-pointer hover:opacity-90 transition' : ''} ${
                  primaryStatus?.color && colorMap[primaryStatus.color]
                    ? colorMap[primaryStatus.color].bg
                    : 'bg-gray-100 dark:bg-gray-900/40'
                }`}
                onClick={(e) => {
                  e.stopPropagation();

                  const nextStatusId = getNextStatusCategoryId(primaryStatus?.id);
                  if (!nextStatusId) return;

                  const updatedStatus = [nextStatusId];
                  updateDraftField(contact.id, 'statusCategories', updatedStatus);
                  scheduleSave(contact.id, { statusCategories: updatedStatus }, true);
                }}
              >
                <span className={`text-xs font-semibold text-center ${
                  primaryStatus?.color && colorMap[primaryStatus.color]
                    ? colorMap[primaryStatus.color].text
                    : 'text-gray-700 dark:text-gray-300'
                }`}>
                  {primaryStatus?.name || 'Sin estado'}
                </span>
              </div>
            </div>
          </CardContent>
          )}

            {isExpanded && (
              <CardContent 
                className="border-t border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/20 p-4 overflow-visible"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 overflow-visible">
                  <div>
                    <Label className="text-xs text-gray-500">Nombre</Label>
                    <Input
                      value={draft.name}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const value = e.target.value;
                        updateDraftField(contact.id, 'name', value);
                        scheduleSave(contact.id, { name: value });
                      }}
                      onBlur={() => scheduleSave(contact.id, {}, true)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Email</Label>
                    <Input
                      value={draft.email}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const value = e.target.value;
                        updateDraftField(contact.id, 'email', value);
                        scheduleSave(contact.id, { email: value });
                      }}
                      onBlur={() => scheduleSave(contact.id, {}, true)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Teléfono</Label>
                    <Input
                      value={draft.phone}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const value = e.target.value;
                        updateDraftField(contact.id, 'phone', value);
                        scheduleSave(contact.id, { phone: value });
                      }}
                      onBlur={() => scheduleSave(contact.id, {}, true)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">CIF / NIF</Label>
                    <Input
                      value={draft.taxId}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const value = e.target.value;
                        updateDraftField(contact.id, 'taxId', value);
                        scheduleSave(contact.id, { taxId: value });
                      }}
                      onBlur={() => scheduleSave(contact.id, {}, true)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Estado</Label>
                    <CategoryMultiSelect
                      selectedCategories={draft.statusCategories
                        .map((id) => statusCategories.find((c) => c.id === id))
                        .filter((c): c is CRMCategoryData => c !== undefined)}
                      availableCategories={statusCategories}
                      multiSelect={false}
                      onAdd={(category) => {
                        const updated = [category.id].filter((id): id is number => id !== undefined);
                        updateDraftField(contact.id, 'statusCategories', updated);
                        scheduleSave(contact.id, { statusCategories: updated }, true);
                      }}
                      onRemove={(categoryId) => {
                        if (!categoryId) return;
                        const updated: number[] = [];
                        updateDraftField(contact.id, 'statusCategories', updated);
                        scheduleSave(contact.id, { statusCategories: updated }, true);
                      }}
                      onCreateNew={(name, color) => {
                        if (onCreateStatusCategory) onCreateStatusCategory(name, color);
                      }}
                      onEditCategory={(category) => {
                        if (category.id && onUpdateStatusCategory) {
                          onUpdateStatusCategory(category.id, category.name, category.color);
                        }
                      }}
                      onDeleteCategory={(categoryId) => {
                        const updated: number[] = [];
                        updateDraftField(contact.id, 'statusCategories', updated);
                        scheduleSave(contact.id, { statusCategories: updated }, true);
                        if (onDeleteStatusCategory) onDeleteStatusCategory(categoryId);
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-3">
                  <div className="md:col-span-2">
                    <Label className="text-xs text-gray-500">Dirección postal</Label>
                    <Input
                      value={draft.postalAddress}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const value = e.target.value;
                        updateDraftField(contact.id, 'postalAddress', value);
                        scheduleSave(contact.id, { postalAddress: value });
                      }}
                      onBlur={() => scheduleSave(contact.id, {}, true)}
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-gray-500">Ciudad</Label>
                    <Input
                      value={draft.city}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const value = e.target.value;
                        updateDraftField(contact.id, 'city', value);
                        scheduleSave(contact.id, { city: value });
                      }}
                      onBlur={() => scheduleSave(contact.id, {}, true)}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label className="text-xs text-gray-500">Categorías</Label>
                    <CategoryMultiSelect
                      selectedCategories={draft.categories
                        .map((id) => categories.find((c) => c.id === id))
                        .filter((c): c is CRMCategoryData => c !== undefined)}
                      availableCategories={categories}
                      onAdd={(category) => {
                        const updated = [...draft.categories];
                        if (category.id && !updated.includes(category.id)) {
                          updated.push(category.id);
                          updateDraftField(contact.id, 'categories', updated);
                          scheduleSave(contact.id, { categories: updated }, true);
                        }
                      }}
                      onRemove={(categoryId) => {
                        if (!categoryId) return;
                        const updated = draft.categories.filter((id) => id !== categoryId);
                        updateDraftField(contact.id, 'categories', updated);
                        scheduleSave(contact.id, { categories: updated }, true);
                      }}
                      onCreateNew={(name, color) => {
                        if (onCreateCategory) onCreateCategory(name, color);
                      }}
                      onEditCategory={(category) => {
                        if (category.id && onUpdateCategory) {
                          onUpdateCategory(category.id, category.name, category.color);
                          const updated = draft.categories.map((id) => id);
                          updateDraftField(contact.id, 'categories', updated);
                        }
                      }}
                      onDeleteCategory={(categoryId) => {
                        const updated = draft.categories.filter((id) => id !== categoryId);
                        updateDraftField(contact.id, 'categories', updated);
                        scheduleSave(contact.id, { categories: updated }, true);
                        if (onDeleteCategory) onDeleteCategory(categoryId);
                      }}
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <Label className="text-xs text-gray-500">Notas</Label>
                  <Textarea
                    rows={3}
                    value={draft.notes}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const value = e.target.value;
                      updateDraftField(contact.id, 'notes', value);
                      scheduleSave(contact.id, { notes: value });
                    }}
                    onBlur={() => scheduleSave(contact.id, {}, true)}
                  />
                </div>

                <div className="mt-4">
                  <ContactStatusHistory contactId={contact.id} />
                </div>

                <div className="mt-4 flex justify-end">
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setContactPendingDelete({ id: contact.id, name: contact.name });
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar contacto
                  </Button>
                </div>
              </CardContent>
            )}
        </Card>
        );
      })}

      <Dialog
        open={!!contactPendingDelete}
        onOpenChange={(open) => {
          if (!open) setContactPendingDelete(null);
        }}
      >
        <DialogContent className="max-w-md dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Confirmar borrado</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            ¿Seguro que quieres eliminar {contactPendingDelete ? `"${contactPendingDelete.name}"` : 'este contacto'}? Esta acción no se puede deshacer.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setContactPendingDelete(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (!contactPendingDelete) return;
                setExpandedContactId((current) => (current === contactPendingDelete.id ? null : current));
                onDelete(contactPendingDelete.id);
                setContactPendingDelete(null);
              }}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ContactStatusHistory({ contactId }: { contactId: number }) {
  return (
    <CRMInteractionHistory
      contactId={contactId}
      queryScope="status-history"
      title="Historial de estado"
      emptyText="Sin cambios de estado todavía."
      subjectFilter="Cambio de estado"
      showCount
      maxHeightClassName="max-h-60"
      containerClassName="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-white/40 dark:bg-gray-900/30 space-y-2"
    />
  );
}

// Componente para mostrar lista de proyectos en formato card
function ProjectsList({
  data,
  loading,
  onEdit,
  onDelete,
}: {
  data: ProjectWithLinks[];
  loading: boolean;
  onEdit: (project: ProjectWithLinks) => void;
  onDelete: (id: number) => void;
}) {
  // Mapa de colores para convertir nombres a clases Tailwind (bg y text)
  const colorMap: Record<string, { bg: string; text: string }> = {
    'predeterminado': { bg: 'bg-gray-100 dark:bg-gray-900/40', text: 'text-gray-700 dark:text-gray-300' },
    'naranja': { bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-700 dark:text-orange-300' },
    'gris': { bg: 'bg-slate-100 dark:bg-slate-900/40', text: 'text-slate-700 dark:text-slate-300' },
    'marron': { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300' },
    'amarillo': { bg: 'bg-yellow-100 dark:bg-yellow-900/40', text: 'text-yellow-700 dark:text-yellow-300' },
    'verde': { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300' },
    'azul': { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300' },
    'morado': { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-300' },
    'rosa': { bg: 'bg-pink-100 dark:bg-pink-900/40', text: 'text-pink-700 dark:text-pink-300' },
    'rojo': { bg: 'bg-rose-100 dark:bg-rose-900/40', text: 'text-rose-700 dark:text-rose-300' },
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (!data.length) {
    return (
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardContent className="py-12 text-center">
          <FolderKanban className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-gray-500 dark:text-gray-400 mb-4">No hay proyectos todavía</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((item) => {
        // Obtener las categorías de estado del proyecto
        const statusCats = item.project.statusCategories && Array.isArray(item.project.statusCategories) && item.project.statusCategories.length > 0
          ? item.project.statusCategories
          : null;
        const primaryStatus = statusCats && statusCats.length > 0 ? statusCats[0] : null;
        
        return (
        <Card
          key={item.project.id}
          className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-2xl overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
          role="button"
          onClick={() => onEdit(item)}
        >
          <CardContent className="p-0">
            <div className="flex items-stretch">
              {/* Contenido principal */}
              <div className="p-4 flex flex-col gap-2 md:flex-row md:items-center md:gap-6 text-sm text-gray-700 dark:text-gray-300 flex-1 min-w-0 overflow-hidden">
                {/* Nombre y Código */}
                <div className="flex items-center gap-3 min-w-[160px] md:min-w-[180px] flex-shrink-0">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">{item.project.name}</p>
                    {item.project.code && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5 truncate">{item.project.code}</p>
                    )}
                  </div>
                </div>

                {/* Datos del proyecto - columnas fijas alineadas */}
                <div className="hidden md:grid md:grid-cols-[130px_90px_50px_1fr_1fr] items-center gap-4 flex-1 min-w-0 overflow-hidden">
                  {/* Columna Fechas */}
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3 w-3 text-gray-400 flex-shrink-0" />
                    <span className="text-xs text-gray-600 dark:text-gray-400 truncate">
                      {item.project.startDate || item.project.dueDate ? (
                        <>
                          {item.project.startDate ? new Date(item.project.startDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : ''}
                          {item.project.dueDate ? ` → ${new Date(item.project.dueDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}` : ''}
                        </>
                      ) : '-'}
                    </span>
                  </div>
                  
                  {/* Columna Presupuesto */}
                  <span className="text-xs text-gray-600 dark:text-gray-400 font-mono truncate">
                    {item.project.budget ? Number(item.project.budget).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }) : '-'}
                  </span>
                  
                  {/* Columna Progreso */}
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-blue-500 flex-shrink-0" />
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {item.project.progress !== null && item.project.progress !== undefined ? `${item.project.progress}%` : '-'}
                    </span>
                  </div>
                  
                  {/* Columna Clientes */}
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    {(item.clients || []).length > 0 ? (
                      <>
                        {(item.clients || []).slice(0, 2).map((c) => (
                          <span key={c.id} className="text-xs text-blue-600 dark:text-blue-400 truncate max-w-[70px]">
                            {c.name}
                          </span>
                        ))}
                        {(item.clients?.length || 0) > 2 && (
                          <span className="text-xs text-gray-500">+{(item.clients?.length || 0) - 2}</span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </div>
                  
                  {/* Columna Proveedores */}
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    {(item.providers || []).length > 0 ? (
                      <>
                        {(item.providers || []).slice(0, 2).map((p) => (
                          <span key={p.id} className="text-xs text-emerald-600 dark:text-emerald-400 truncate max-w-[70px]">
                            {p.name}
                          </span>
                        ))}
                        {(item.providers?.length || 0) > 2 && (
                          <span className="text-xs text-gray-500">+{(item.providers?.length || 0) - 2}</span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Botón eliminar - siempre visible, nunca salta a segunda fila */}
              <div className="flex items-center px-2 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(item.project.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Sección coloreada de estado - extremo derecho */}
              <div 
                className={`w-[110px] flex items-center justify-center flex-shrink-0 px-3 ${
                  primaryStatus?.color && colorMap[primaryStatus.color]
                    ? colorMap[primaryStatus.color].bg
                    : 'bg-gray-100 dark:bg-gray-900/40'
                }`}
              >
                <span className={`text-xs font-semibold text-center ${
                  primaryStatus?.color && colorMap[primaryStatus.color]
                    ? colorMap[primaryStatus.color].text
                    : 'text-gray-700 dark:text-gray-300'
                }`}>
                  {primaryStatus?.name || 'Sin estado'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
        );
      })}
    </div>
  );
}

function ContactsTable({
  data,
  loading,
  onEdit,
  onDelete,
  emptyLabel,
  statusCategories,
}: {
  data: Contact[];
  loading: boolean;
  onEdit: (contact: Contact) => void;
  onDelete: (id: number) => void;
  emptyLabel: string;
  statusCategories: CRMCategoryData[];
}) {
  // Mapa de colores para convertir nombres a clases Tailwind (bg y text)
  const colorMap: Record<string, { bg: string; text: string }> = {
    'predeterminado': { bg: 'bg-gray-100 dark:bg-gray-900/40', text: 'text-gray-700 dark:text-gray-300' },
    'naranja': { bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-700 dark:text-orange-300' },
    'gris': { bg: 'bg-slate-100 dark:bg-slate-900/40', text: 'text-slate-700 dark:text-slate-300' },
    'marron': { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300' },
    'amarillo': { bg: 'bg-yellow-100 dark:bg-yellow-900/40', text: 'text-yellow-700 dark:text-yellow-300' },
    'verde': { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300' },
    'azul': { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300' },
    'morado': { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-300' },
    'rosa': { bg: 'bg-pink-100 dark:bg-pink-900/40', text: 'text-pink-700 dark:text-pink-300' },
    'rojo': { bg: 'bg-rose-100 dark:bg-rose-900/40', text: 'text-rose-700 dark:text-rose-300' },
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (!data.length) {
    return (
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardContent className="py-12 text-center">
          <Users className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-gray-500 dark:text-gray-400 mb-4">{emptyLabel}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((item) => {
        // Convertir IDs de estado a objetos
        const statusCats = item.statusCategories && Array.isArray(item.statusCategories) && item.statusCategories.length > 0
          ? item.statusCategories
              .map(id => statusCategories.find(cat => cat.id === id))
              .filter((cat): cat is CRMCategoryData => cat !== undefined)
          : null;
        const primaryStatus = statusCats && statusCats.length > 0 ? statusCats[0] : null;
        
        return (
        <Card
          key={item.id}
          className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-2xl overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
          role="button"
          onClick={() => onEdit(item)}
        >
          <CardContent className="p-0">
            <div className="flex items-stretch">
              {/* Contenido principal */}
              <div className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:flex-wrap md:gap-4 text-sm text-gray-700 dark:text-gray-300 flex-1 min-w-0">
                <div className="flex items-center gap-3 min-w-[220px]">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">{item.name}</p>
                    {item.label && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">{item.label}</span>
                    )}
                  </div>
                </div>

                {item.email && (
                  <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 min-w-[200px]">
                    <span className="truncate">{item.email}</span>
                  </div>
                )}

                {item.phone && (
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    <span>{item.phone}</span>
                  </div>
                )}

                {item.city && (
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    <span>{item.city}</span>
                  </div>
                )}

                {item.categories && item.categories.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {item.categories.map((catId) => (
                      <Badge key={catId} variant="outline" className="text-xs">
                        Cat {catId}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="ml-auto">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(item.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {/* Sección coloreada de estado - extremo derecho */}
              <div 
                className={`w-[110px] flex items-center justify-center flex-shrink-0 px-3 ${
                  primaryStatus?.color && colorMap[primaryStatus.color]
                    ? colorMap[primaryStatus.color].bg
                    : 'bg-gray-100 dark:bg-gray-900/40'
                }`}
              >
                <span className={`text-xs font-semibold text-center ${
                  primaryStatus?.color && colorMap[primaryStatus.color]
                    ? colorMap[primaryStatus.color].text
                    : 'text-gray-700 dark:text-gray-300'
                }`}>
                  {primaryStatus?.name || 'Sin estado'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
        );
      })}
    </div>
  );
}

function ProjectsTable({
  data,
  loading,
  onEdit,
  onDelete,
}: {
  data: ProjectWithLinks[];
  loading: boolean;
  onEdit: (project: ProjectWithLinks) => void;
  onDelete: (id: number) => void;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 flex justify-center">
          <LoadingSpinner />
        </CardContent>
      </Card>
    );
  }

  if (!data.length) {
    return (
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>No hay proyectos todavía</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {data.map((item) => (
        <Card key={item.project.id} className="border border-gray-200 dark:border-gray-800">
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-gray-900 dark:text-white">{item.project.name}</CardTitle>
              <Badge variant={item.project.status === 'active' ? 'default' : 'secondary'}>{item.project.status}</Badge>
            </div>
            {item.project.stage && (
              <p className="text-xs text-gray-500 dark:text-gray-400">Fase: {item.project.stage}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
            {item.project.description && <p className="text-sm leading-relaxed">{item.project.description}</p>}

            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <Calendar className="h-4 w-4" />
              <span>
                {item.project.startDate ? new Date(item.project.startDate).toLocaleDateString('es-ES') : 'Sin fecha'}
                {item.project.dueDate ? ` → ${new Date(item.project.dueDate).toLocaleDateString('es-ES')}` : ''}
              </span>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-gray-500 dark:text-gray-400">Clientes</Label>
              <div className="flex flex-wrap gap-2">
                {(item.clients || []).map((c) => (
                  <Badge key={c.id} variant="outline" className="border-blue-200 text-blue-800 dark:text-blue-200 dark:border-blue-900">
                    {c.name}
                  </Badge>
                ))}
                {!item.clients?.length && <span className="text-xs text-gray-500">Sin clientes</span>}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-gray-500 dark:text-gray-400">Proveedores</Label>
              <div className="flex flex-wrap gap-2">
                {(item.providers || []).map((p) => (
                  <Badge key={p.id} variant="outline" className="border-emerald-200 text-emerald-800 dark:text-emerald-200 dark:border-emerald-900">
                    {p.name}
                  </Badge>
                ))}
                {!item.providers?.length && <span className="text-xs text-gray-500">Sin proveedores</span>}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="ghost" size="icon" onClick={() => onEdit(item)}>
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onDelete(item.project.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ContactSelectField({
  role,
  options,
  selectedIds,
  onChange,
  onCreate,
}: {
  role: ContactRole;
  options: Contact[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  onCreate: (name: string) => Promise<Contact | undefined>;
}) {
  const [query, setQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const normalize = (s: string | undefined | null) =>
    Array.from((s || '').toLowerCase().normalize('NFD'))
      .filter((ch) => {
        const code = ch.charCodeAt(0);
        return code < 0x0300 || code > 0x036f;
      })
      .join('');

  const normQuery = normalize(query);
  const filtered = options.filter((opt) => normalize(opt.name).includes(normQuery));

  const handleAdd = (id: number) => {
    if (selectedIds.includes(id)) return;
    onChange([...selectedIds, id]);
    setQuery('');
    setOpen(true);
    inputRef.current?.focus();
  };

  const handleRemove = (id: number) => {
    onChange(selectedIds.filter((x) => x !== id));
    setOpen(true);
    inputRef.current?.focus();
  };

  const handleCreate = async () => {
    const name = query.trim();
    if (!name) return;
    setIsCreating(true);
    try {
      const created = await onCreate(name);
      if (created?.id) {
        onChange([...selectedIds, created.id]);
        setQuery('');
        setOpen(false);
      }
    } finally {
      setIsCreating(false);
    }
  };

  const selectedItems = selectedIds
    .map((id) => options.find((o) => o.id === id) || { id, name: 'Nuevo contacto', role })
    .map((item) => ({ id: item.id, name: item.name || 'Contacto', role: item.role }));

  const hasQueryMatch = filtered.length > 0;

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (containerRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [open]);

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="relative flex flex-wrap items-center gap-2 p-2 border rounded-md dark:border-gray-700 bg-white dark:bg-gray-800"
        onClick={() => {
          setOpen(true);
          inputRef.current?.focus();
        }}
      >
        {selectedItems.map((item) => (
          <Badge key={item.id} variant="secondary" className="flex items-center gap-1">
            {item.name}
            <button
              type="button"
              className="ml-1 text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100"
              onClick={(e) => {
                e.stopPropagation();
                handleRemove(item.id);
              }}
              aria-label="Quitar"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className="flex-1 min-w-[140px] bg-transparent outline-none text-sm text-gray-800 dark:text-gray-100"
          placeholder={`Buscar o crear ${role === 'client' ? 'cliente' : 'proveedor'}...`}
        />

        {open && (
          <div
            ref={dropdownRef}
            className="absolute z-50 left-0 top-full mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-64 overflow-auto"
          >
            {hasQueryMatch ? (
              filtered.slice(0, 30).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between"
                  onClick={() => handleAdd(opt.id)}
                >
                  <span className="text-gray-800 dark:text-gray-100">{opt.name}</span>
                  {selectedIds.includes(opt.id) && <span className="text-xs text-blue-500">Seleccionado</span>}
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-gray-500">Sin resultados</div>
            )}

            {query.trim() && !filtered.some((opt) => normalize(opt.name) === normQuery) && (
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30"
                onClick={handleCreate}
                disabled={isCreating}
              >
                {isCreating ? 'Creando...' : `Crear ${role === 'client' ? 'cliente' : 'proveedor'} "${query.trim()}"`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
