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
import { usePageHeader } from '@/components/layout/page-header';
import { usePageTitle } from '@/hooks/use-page-title';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { CategoryMultiSelect, CategoryTag, type CRMCategoryData } from '@/components/crm-category-manager';
import { DatePickerDay } from '@/components/ui/date-picker';
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

type ContactRole = 'client' | 'provider';

interface ContactFormState {
  name: string;
  email: string;
  phone: string;
  taxId: string;
  city: string;
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
  name: '',
  email: '',
  phone: '',
  taxId: '',
  city: '',
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

  const [activeTab, setActiveTab] = useState<'clients' | 'providers' | 'projects'>('clients');
  const [searchTerm, setSearchTerm] = useState('');

  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [contactForm, setContactForm] = useState<ContactFormState>(emptyContactForm);
  const [editingContactId, setEditingContactId] = useState<number | null>(null);
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
    queryKey: ['/api/crm/contacts', 'client', searchTerm],
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams();
      params.set('role', 'client');
      params.set('limit', String(CONTACT_PAGE_SIZE));
      params.set('offset', String(pageParam));
      if (searchTerm) params.set('search', searchTerm);
      const response = await apiRequest('GET', `/api/crm/contacts?${params.toString()}`);
      return normalizePage<Contact>(response);
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore
        ? allPages.reduce((acc, page) => acc + (page.items?.length ?? 0), 0)
        : undefined,
    initialPageParam: 0,
  });

  const {
    data: providerPagesData,
    isLoading: loadingProviders,
    hasNextPage: providersHasNext,
    isFetchingNextPage: providersFetchingNext,
    fetchNextPage: fetchMoreProviders,
  } = useInfiniteQuery<PaginatedPage<Contact>>({
    queryKey: ['/api/crm/contacts', 'provider', searchTerm],
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams();
      params.set('role', 'provider');
      params.set('limit', String(CONTACT_PAGE_SIZE));
      params.set('offset', String(pageParam));
      if (searchTerm) params.set('search', searchTerm);
      const response = await apiRequest('GET', `/api/crm/contacts?${params.toString()}`);
      return normalizePage<Contact>(response);
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore
        ? allPages.reduce((acc, page) => acc + (page.items?.length ?? 0), 0)
        : undefined,
    initialPageParam: 0,
  });

  const {
    data: projectPagesData,
    isLoading: loadingProjects,
    hasNextPage: projectsHasNext,
    isFetchingNextPage: projectsFetchingNext,
    fetchNextPage: fetchMoreProjects,
  } = useInfiniteQuery<PaginatedPage<ProjectWithLinks>>({
    queryKey: ['/api/crm/projects', searchTerm],
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams();
      params.set('limit', String(PROJECT_PAGE_SIZE));
      params.set('offset', String(pageParam));
      if (searchTerm) params.set('search', searchTerm);
      const response = await apiRequest('GET', `/api/crm/projects?${params.toString()}`);
      return normalizePage<ProjectWithLinks>(response);
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore
        ? allPages.reduce((acc, page) => acc + (page.items?.length ?? 0), 0)
        : undefined,
    initialPageParam: 0,
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

  const normalize = (s: string | undefined | null) =>
    (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const contactMatchesTerm = (contact: Contact, term: string) => {
    if (!term) return true;
    const normTerm = normalize(term);
    const categoryNames = (contact.categories || [])
      .map((cid) => categories.find((c) => c.id === cid)?.name)
      .map(normalize)
      .join(' ');

    return [
      contact.name,
      contact.label,
      contact.email,
      contact.phone,
      contact.taxId,
      contact.city,
      contact.notes,
      categoryNames,
    ].some((field) => normalize(field).includes(normTerm));
  };

  const filteredClients = useMemo(() => {
    return clients.filter((item) => contactMatchesTerm(item, searchTerm));
  }, [clients, searchTerm, categories]);

  const filteredProviders = useMemo(() => {
    return providers.filter((item) => contactMatchesTerm(item, searchTerm));
  }, [providers, searchTerm, categories]);

  const filteredProjects = useMemo(() => {
    const term = normalize(searchTerm);
    return projects.filter((item) => normalize(item.project?.name || '').includes(term));
  }, [projects, searchTerm]);

  const contactMutation = useMutation({
    mutationFn: (payload: Partial<Contact> & { role: ContactRole }) => {
      if (editingContactId) {
        return apiRequest('PATCH', `/api/crm/contacts/${editingContactId}`, payload);
      }
      return apiRequest('POST', '/api/crm/contacts', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/contacts'] });
      setContactDialogOpen(false);
      setEditingContactId(null);
      setContactForm(emptyContactForm);
      toast({ title: 'Guardado', description: 'Contacto actualizado correctamente.' });
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
    
    // console.log('📤 Frontend - Preparing payload with statusCategories:', form.statusCategories);
    // console.log('📤 Frontend - Status category IDs:', statusCategoryIds);

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
      // console.log('💾 Mutation called with payload:', payload);
      // console.log('💾 statusCategories in payload:', payload.statusCategories);
      const body = projectPayload(payload);
      // console.log('💾 Final body to send:', body);
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

  const openContactDialog = (role: ContactRole, contact?: Contact) => {
    setContactRole(role);
    if (contact) {
      setEditingContactId(contact.id);
      // Convertir IDs de categorías a objetos
      const contactCategories = contact.categories
        ? contact.categories
            .map(catId => categories.find(c => c.id === catId))
            .filter((c): c is CRMCategoryData => c !== undefined)
        : [];
      // Convertir IDs de estados a objetos
      const contactStatusCategories = contact.statusCategories
        ? contact.statusCategories
            .map(catId => statusCategories.find(c => c.id === catId))
            .filter((c): c is CRMCategoryData => c !== undefined)
        : [];
      setContactForm({
        name: contact.name || '',
        email: contact.email || '',
        phone: contact.phone || '',
        taxId: contact.taxId || '',
        city: contact.city || '',
        notes: contact.notes || '',
        categories: contactCategories,
        statusCategories: contactStatusCategories,
      });
    } else {
      setEditingContactId(null);
      setContactForm(emptyContactForm);
    }
    setContactDialogOpen(true);
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

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some(entry => entry.isIntersecting)) return;

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
      { threshold: 0.1, rootMargin: '120px' }
    );

    const el = loadMoreRef.current;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [activeTab, clientsHasNext, providersHasNext, projectsHasNext, clientsFetchingNext, providersFetchingNext, projectsFetchingNext, fetchMoreClients, fetchMoreProviders, fetchMoreProjects]);

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
        ]}
        activeTab={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId as any)}
      />

      <div className="space-y-4">
        {/* Barra de búsqueda y acciones */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Contador de resultados - SIEMPRE a la izquierda */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg">
            <span className="text-sm font-medium text-foreground dark:text-white">
              {activeTab === 'clients' && filteredClients.length}
              {activeTab === 'providers' && filteredProviders.length}
              {activeTab === 'projects' && filteredProjects.length}
            </span>
            <span className="text-sm text-muted-foreground dark:text-gray-400">
              {activeTab === 'clients' && 'clientes'}
              {activeTab === 'providers' && 'proveedores'}
              {activeTab === 'projects' && 'proyectos'}
            </span>
          </div>
          
          {/* Input de búsqueda */}
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder={activeTab === 'projects' ? 'Buscar proyectos...' : 'Buscar por nombre...'}
              className="pl-9 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          {/* Espaciador flexible - empuja botón a la derecha */}
          <div className="hidden sm:block flex-1" />
          
          {/* Botón de acción principal - a la derecha */}
          {activeTab !== 'projects' && (
            <Button onClick={() => openContactDialog(activeTab === 'clients' ? 'client' : 'provider')}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo {activeTab === 'clients' ? 'cliente' : 'proveedor'}
            </Button>
          )}
          {activeTab === 'projects' && (
            <Button onClick={() => openProjectDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo proyecto
            </Button>
          )}
        </div>

        {/* Lists Content */}
        <div>
        {activeTab === 'clients' && (
          <>
            <ContactsList
              data={filteredClients}
              loading={loadingClients}
              onEdit={(c) => openContactDialog('client', c)}
              onDelete={(id) => deleteContactMutation.mutate(id)}
              emptyLabel="Aún no tienes clientes"
              role="client"
              categories={categories}
              statusCategories={statusCategories}
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
              onEdit={(c) => openContactDialog('provider', c)}
              onDelete={(id) => deleteContactMutation.mutate(id)}
              emptyLabel="Aún no tienes proveedores"
              role="provider"
              categories={categories}
              statusCategories={statusCategories}
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
      </div>
      </div>

      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent className="max-w-xl dark:bg-gray-900 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingContactId ? 'Editar' : 'Nuevo'} {contactRole === 'client' ? 'cliente' : 'proveedor'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="dark:text-white">Nombre *</Label>
                <Input
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  placeholder="Ej: Cliente ABC"
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div>
                <Label className="dark:text-white">Email</Label>
                <Input
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  placeholder="correo@empresa.com"
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div>
                <Label className="dark:text-white">Teléfono</Label>
                <Input
                  value={contactForm.phone}
                  onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                  placeholder="+34 600 000 000"
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div>
                <Label className="dark:text-white">CIF / NIF</Label>
                <Input
                  value={contactForm.taxId}
                  onChange={(e) => setContactForm({ ...contactForm, taxId: e.target.value })}
                  placeholder="B12345678"
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div>
                <Label className="dark:text-white">Ciudad</Label>
                <Input
                  value={contactForm.city}
                  onChange={(e) => setContactForm({ ...contactForm, city: e.target.value })}
                  placeholder="Madrid"
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
            </div>

            <div>
              <Label className="dark:text-white">Notas</Label>
              <Textarea
                value={contactForm.notes}
                onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })}
                placeholder="Información adicional"
                className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>

            {/* Estados */}
            <div>
              <Label className="dark:text-white mb-2 block">Estado</Label>
              <CategoryMultiSelect
                selectedCategories={contactForm.statusCategories}
                availableCategories={statusCategories}
                multiSelect={false}
                onAdd={(category) => {
                  // En modo single-select, reemplazar la categoría existente
                  setContactForm({
                    ...contactForm,
                    statusCategories: [category],
                  });
                }}
                onRemove={(categoryId) => {
                  setContactForm({
                    ...contactForm,
                    statusCategories: contactForm.statusCategories.filter(c => c.id !== categoryId),
                  });
                }}
                onCreateNew={(name, color) => {
                  createStatusCategoryMutation.mutate({ name, color }, {
                    onSuccess: (newCategory) => {
                      // En modo single-select, reemplazar la categoría existente
                      setContactForm({
                        ...contactForm,
                        statusCategories: [newCategory as CRMCategoryData],
                      });
                    },
                  });
                }}
                onEditCategory={(category) => {
                  if (category.id) {
                    setContactForm({
                      ...contactForm,
                      statusCategories: contactForm.statusCategories.map((c) =>
                        c.id === category.id ? { ...c, name: category.name, color: category.color } : c
                      ),
                    });
                    updateStatusCategoryMutation.mutate({
                      id: category.id,
                      name: category.name,
                      color: category.color,
                    });
                  }
                }}
                onDeleteCategory={(categoryId) => {
                  setContactForm({
                    ...contactForm,
                    statusCategories: contactForm.statusCategories.filter(c => c.id !== categoryId),
                  });
                  deleteStatusCategoryMutation.mutate(categoryId);
                }}
              />
            </div>

            {/* Categorías */}
            <div>
              <Label className="dark:text-white mb-2 block">Categorías</Label>
              <CategoryMultiSelect
                selectedCategories={contactForm.categories}
                availableCategories={categories}
                onAdd={(category) => {
                  if (!contactForm.categories.find(c => c.id === category.id)) {
                    setContactForm({
                      ...contactForm,
                      categories: [...contactForm.categories, category],
                    });
                  }
                }}
                onRemove={(categoryId) => {
                  setContactForm({
                    ...contactForm,
                    categories: contactForm.categories.filter(c => c.id !== categoryId),
                  });
                }}
                onCreateNew={(name, color) => {
                  createCategoryMutation.mutate({ name, color }, {
                    onSuccess: (newCategory) => {
                      setContactForm({
                        ...contactForm,
                        categories: [...contactForm.categories, newCategory as CRMCategoryData],
                      });
                    },
                  });
                }}
                onEditCategory={(category) => {
                  if (category.id) {
                    // Update selected categories in the form immediately so chips reflect renamed color/name
                    setContactForm({
                      ...contactForm,
                      categories: contactForm.categories.map((c) =>
                        c.id === category.id ? { ...c, name: category.name, color: category.color } : c
                      ),
                    });
                    updateCategoryMutation.mutate({
                      id: category.id,
                      name: category.name,
                      color: category.color,
                    });
                  }
                }}
                onDeleteCategory={(categoryId) => {
                  deleteCategoryMutation.mutate(categoryId);
                }}
              />
            </div>
          </div>

          <DialogFooter className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setContactDialogOpen(false);
                setEditingContactId(null);
                setContactForm(emptyContactForm);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() =>
                contactMutation.mutate({
                  ...contactForm,
                  categories: contactForm.categories
                    .map(c => c.id)
                    .filter((id): id is number => id !== undefined),
                  statusCategories: contactForm.statusCategories
                    .map(c => c.id)
                    .filter((id): id is number => id !== undefined),
                  role: contactRole,
                })
              }
              disabled={!contactForm.name || contactMutation.isPending}
            >
              {contactMutation.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  // console.log('🏷️ Adding category to project:', category);
                  // En modo single-select, reemplazar la categoría existente
                  const newStatusCategories = [category];
                  // console.log('🏷️ New statusCategories:', newStatusCategories);
                  setProjectForm({
                    ...projectForm,
                    statusCategories: newStatusCategories,
                  });
                }}
                onRemove={(categoryId) => {
                  // console.log('🗑️ Removing category from project:', categoryId);
                  const newStatusCategories = projectForm.statusCategories.filter(c => c.id !== categoryId);
                  // console.log('🏷️ New statusCategories after remove:', newStatusCategories);
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
                // console.log('💾 Guardar clicked - Current projectForm:', projectForm);
                // console.log('💾 Current statusCategories:', projectForm.statusCategories);
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
  onEdit,
  onDelete,
  emptyLabel,
  role,
  categories,
  statusCategories,
}: {
  data: Contact[];
  loading: boolean;
  onEdit: (contact: Contact) => void;
  onDelete: (id: number) => void;
  emptyLabel: string;
  role: ContactRole;
  categories: CRMCategoryData[];
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
          {role === 'client' ? <Users className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" /> : <Building2 className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />}
          <p className="text-gray-500 dark:text-gray-400 mb-4">{emptyLabel}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((contact) => {
        // Convertir IDs de estado a objetos
        const statusCats = contact.statusCategories && Array.isArray(contact.statusCategories) && contact.statusCategories.length > 0
          ? contact.statusCategories
              .map(id => statusCategories.find(cat => cat.id === id))
              .filter((cat): cat is CRMCategoryData => cat !== undefined)
          : null;
        const primaryStatus = statusCats && statusCats.length > 0 ? statusCats[0] : null;

        return (
        <Card
          key={contact.id}
          className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-2xl overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
          role="button"
          onClick={() => onEdit(contact)}
        >
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
                  {/* Email - oculto en md, visible en lg+ */}
                  <span className="text-xs text-gray-600 dark:text-gray-400 truncate w-[160px] flex-shrink-0 hidden lg:block">
                    {contact.email || '-'}
                  </span>
                  
                  {/* Teléfono */}
                  <span className="text-xs text-gray-600 dark:text-gray-400 truncate w-[100px] flex-shrink-0">
                    {contact.phone || '-'}
                  </span>
                  
                  {/* Ciudad - solo en xl+ */}
                  <span className="text-xs text-gray-600 dark:text-gray-400 truncate w-[80px] flex-shrink-0 hidden xl:block">
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
              
              {/* Botón eliminar - siempre visible, nunca salta a segunda fila */}
              <div className="flex items-center px-2 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(contact.id);
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
