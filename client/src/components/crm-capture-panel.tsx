import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { DndContext, DragEndEvent, DragStartEvent, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePickerDay } from '@/components/ui/date-picker';
import { CRMInteractionHistory } from '@/components/crm-interaction-history';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { GripVertical } from 'lucide-react';

type StageKey = 'initial_contact' | 'info_sent' | 'meeting_scheduled' | 'negotiation' | 'client' | 'discarded';

interface CapturePipelineItem {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  notes?: string | null;
  stage: StageKey;
  statusCategoryId?: number | null;
  statusCategoryName?: string | null;
  lastStatusChangeAt?: string | null;
  daysSinceStatusChange?: number | null;
  lastInteractionAt?: string | null;
  daysWithoutInteraction?: number | null;
  hasStaleAlert?: boolean;
}

interface CapturePipelineResponse {
  stages: Array<{ id: StageKey; items: CapturePipelineItem[] }>;
  total: number;
}

interface ContactsResponse {
  items?: Array<{
    id: number;
    name: string;
    email?: string | null;
    phone?: string | null;
    city?: string | null;
    notes?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    statusCategories?: Array<number | string> | null;
  }>;
}

interface DashboardData {
  conversionRate: number;
  avgCloseDays: number;
  hotContacts: number;
  pipelineValue: number;
  upcomingTasks?: Array<{ id: number }>;
  totals: {
    contacts: number;
    converted: number;
  };
}

interface StatusCategory {
  id: number;
  name: string;
  color: string;
  isDefault?: boolean;
  stageKey?: string | null;
}

const STAGES: StageKey[] = [
  'initial_contact',
  'info_sent',
  'meeting_scheduled',
  'negotiation',
  'client',
  'discarded',
];

const STAGE_DEFAULT_META: Record<StageKey, { label: string; color: string }> = {
  initial_contact: { label: 'Contacto inicial', color: 'azul' },
  info_sent: { label: 'Info enviada', color: 'morado' },
  meeting_scheduled: { label: 'Reunión agendada', color: 'verde' },
  negotiation: { label: 'Negociación', color: 'amarillo' },
  client: { label: 'Cliente', color: 'verde' },
  discarded: { label: 'Descartado', color: 'rojo' },
};

const STAGE_AUTO_COMMENTS: Record<StageKey, string> = {
  initial_contact: 'Se inició el contacto con la empresa.',
  info_sent: 'Se envió información al cliente.',
  meeting_scheduled: 'Se agendó una reunión con el cliente.',
  negotiation: 'Se abrió fase de negociación.',
  client: 'El contacto se marcó como cliente.',
  discarded: 'El contacto se marcó como descartado.',
};

const COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  predeterminado: { bg: 'bg-gray-100 dark:bg-gray-900/40', text: 'text-gray-700 dark:text-gray-300', border: 'border-gray-200 dark:border-gray-700' },
  naranja: { bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800' },
  gris: { bg: 'bg-slate-100 dark:bg-slate-900/40', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-200 dark:border-slate-800' },
  marron: { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' },
  amarillo: { bg: 'bg-yellow-100 dark:bg-yellow-900/40', text: 'text-yellow-700 dark:text-yellow-300', border: 'border-yellow-200 dark:border-yellow-800' },
  verde: { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' },
  azul: { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' },
  morado: { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800' },
  rosa: { bg: 'bg-pink-100 dark:bg-pink-900/40', text: 'text-pink-700 dark:text-pink-300', border: 'border-pink-200 dark:border-pink-800' },
  rojo: { bg: 'bg-rose-100 dark:bg-rose-900/40', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-800' },
};

function formatRelativeDays(value?: string | null) {
  if (!value) return 'sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'sin fecha';

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const msPerDay = 1000 * 60 * 60 * 24;
  const diffDays = Math.floor((startOfToday.getTime() - startOfDate.getTime()) / msPerDay);

  if (diffDays <= 0) return 'hoy';
  if (diffDays === 1) return 'hace 1 día';
  return `hace ${diffDays} días`;
}

function getHistoryDate(item: CapturePipelineItem) {
  return item.lastStatusChangeAt || item.lastInteractionAt || null;
}

function parseDayString(value?: string | null): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function formatDayString(value?: Date): string {
  if (!value || Number.isNaN(value.getTime())) return '';
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function stageId(stage: StageKey) {
  return `stage-${stage}`;
}

function contactId(contactIdValue: number) {
  return `contact-${contactIdValue}`;
}

function parseContactId(value: string | number) {
  const text = String(value);
  if (!text.startsWith('contact-')) return null;
  const id = Number(text.replace('contact-', ''));
  return Number.isFinite(id) ? id : null;
}

function getStageFromDroppable(value: string | number) {
  const text = String(value);
  if (!text.startsWith('stage-')) return null;
  const stage = text.replace('stage-', '') as StageKey;
  return STAGES.includes(stage) ? stage : null;
}

function StageColumn({
  stage,
  label,
  color,
  items,
  isLoading,
  onOpen,
  suppressOpenUntil,
}: {
  stage: StageKey;
  label: string;
  color: string;
  items: CapturePipelineItem[];
  isLoading: boolean;
  onOpen: (contactId: number) => void;
  suppressOpenUntil: React.MutableRefObject<number>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stageId(stage) });
  const colors = COLOR_MAP[color] || COLOR_MAP.predeterminado;

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border p-2.5 min-h-[430px] bg-card transition-colors ${
        isOver ? 'ring-2 ring-blue-400/60' : ''
      } ${colors.border}`}
    >
      <div className={`rounded-lg px-2 py-1.5 mb-2 flex items-center justify-between ${colors.bg}`}>
        <span className={`text-xs font-semibold ${colors.text} truncate pr-2`}>{label}</span>
        <Badge variant="secondary" className="h-5 text-[11px] px-1.5">{items.length}</Badge>
      </div>

      <div className="space-y-1.5">
        {isLoading && items.length === 0 && (
          <div className="text-xs text-muted-foreground border border-dashed rounded-lg p-3 text-center">
            Cargando...
          </div>
        )}
        {items.map((item) => (
          <CaptureCard
            key={item.id}
            item={item}
            onOpen={onOpen}
            suppressOpenUntil={suppressOpenUntil}
          />
        ))}
        {!isLoading && items.length === 0 && (
          <div className="text-xs text-muted-foreground border border-dashed rounded-lg p-3 text-center">
            Suelta aquí
          </div>
        )}
      </div>
    </div>
  );
}

function CaptureCard({
  item,
  onOpen,
  suppressOpenUntil,
}: {
  item: CapturePipelineItem;
  onOpen: (contactId: number) => void;
  suppressOpenUntil: React.MutableRefObject<number>;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: contactId(item.id) });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="cursor-grab active:cursor-grabbing"
      {...listeners}
      {...attributes}
      onClick={() => {
        if (Date.now() < suppressOpenUntil.current) return;
        if (isDragging) return;
        onOpen(item.id);
      }}
    >
      <CardContent className="p-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate">{item.name}</p>
            <p className="text-[11px] text-muted-foreground">{formatRelativeDays(getHistoryDate(item))}</p>
          </div>
          <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Arrastrar">
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

export function CRMCapturePanel() {
  const { toast } = useToast();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const suppressOpenUntilRef = useRef(0);
  const [activeDragId, setActiveDragId] = useState<number | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    phone: '',
    city: '',
    notes: '',
  });
  const [newUpdateDate, setNewUpdateDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newUpdateNote, setNewUpdateNote] = useState('');
  const [globalSortOrder, setGlobalSortOrder] = useState<'oldest' | 'newest'>('oldest');
  const [pendingMove, setPendingMove] = useState<{
    contactId: number;
    contactName: string;
    fromStage: StageKey;
    toStage: StageKey;
    comment: string;
  } | null>(null);

  const { data: pipelineData, isLoading: loadingPipeline } = useQuery<CapturePipelineResponse>({
    queryKey: ['/api/crm/capture/pipeline', 'overview'],
    queryFn: () => apiRequest('GET', '/api/crm/capture/pipeline?staleDays=7'),
    staleTime: 20_000,
  });

  const { data: clientsData, isLoading: loadingClients } = useQuery<ContactsResponse>({
    queryKey: ['/api/crm/contacts', 'capture-board', 'client'],
    queryFn: () => apiRequest('GET', '/api/crm/contacts?role=client&limit=1000&offset=0'),
    staleTime: 20_000,
  });

  const { data: statusCategories = [] } = useQuery<StatusCategory[]>({
    queryKey: ['/api/crm/status-categories'],
    queryFn: () => apiRequest('GET', '/api/crm/status-categories'),
    staleTime: 60_000,
  });

  const { data: dashboardData } = useQuery<DashboardData>({
    queryKey: ['/api/crm/capture/dashboard'],
    queryFn: () => apiRequest('GET', '/api/crm/capture/dashboard'),
    staleTime: 30_000,
  });

  const moveStageMutation = useMutation({
    mutationFn: (payload: { contactId: number; stage: StageKey; comment: string }) =>
      apiRequest('PATCH', `/api/crm/capture/contacts/${payload.contactId}/pipeline`, {
        stage: payload.stage,
        comment: payload.comment,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/capture/pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/capture/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/capture/interactions'] });
    },
  });

  const clients = useMemo(() => {
    if (Array.isArray(clientsData)) return clientsData as any[];
    return Array.isArray(clientsData?.items) ? clientsData.items : [];
  }, [clientsData]);

  const stageFromStatusName = (name?: string | null): StageKey | null => {
    const normalized = (name || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

    if (!normalized) return null;
    if (normalized.includes('contacto')) return 'initial_contact';
    if (normalized.includes('info')) return 'info_sent';
    if (normalized.includes('reunion') || normalized.includes('meeting')) return 'meeting_scheduled';
    if (normalized.includes('negoci')) return 'negotiation';
    if (normalized.includes('cliente') || normalized.includes('cerrad') || normalized.includes('ganad')) return 'client';
    if (normalized.includes('descart') || normalized.includes('perdid') || normalized.includes('lost')) return 'discarded';

    return null;
  };

  const stagesMap = useMemo(() => {
    const map = new Map<StageKey, CapturePipelineItem[]>();
    STAGES.forEach((stage) => map.set(stage, []));

    const statusById = new Map(statusCategories.map((status) => [status.id, status]));
    const pipelineByContactId = new Map<number, CapturePipelineItem>();
    (pipelineData?.stages || []).forEach((group) => {
      (group.items || []).forEach((item) => {
        pipelineByContactId.set(item.id, item);
      });
    });

    for (const client of clients) {
      const normalizedStatusIds = Array.isArray(client.statusCategories)
        ? client.statusCategories
            .map((id: any) => Number(id))
            .filter((id: number) => Number.isFinite(id))
        : [];

      const mappedTag = normalizedStatusIds
        .map((id: number) => statusById.get(id))
        .find((tag: any) => Boolean(tag));

      const stageFromTag = mappedTag?.stageKey && STAGES.includes(mappedTag.stageKey as StageKey)
        ? (mappedTag.stageKey as StageKey)
        : stageFromStatusName(mappedTag?.name);

      const stageFromPipeline = pipelineByContactId.get(client.id)?.stage;
      const stage = stageFromTag || stageFromPipeline || 'initial_contact';

      const baseItem = pipelineByContactId.get(client.id);

      const item: CapturePipelineItem = {
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        city: client.city,
        notes: client.notes,
        stage,
        statusCategoryId: mappedTag?.id || baseItem?.statusCategoryId || null,
        statusCategoryName: mappedTag?.name || baseItem?.statusCategoryName || null,
        lastStatusChangeAt: baseItem?.lastStatusChangeAt || client.updatedAt || client.createdAt || null,
        daysSinceStatusChange: baseItem?.daysSinceStatusChange,
        lastInteractionAt: baseItem?.lastInteractionAt,
        daysWithoutInteraction: baseItem?.daysWithoutInteraction,
        hasStaleAlert: baseItem?.hasStaleAlert,
      };

      map.get(stage)?.push(item);
    }

    STAGES.forEach((stage) => {
      const items = map.get(stage) || [];
      items.sort((a, b) => {
        const aDate = getHistoryDate(a);
        const bDate = getHistoryDate(b);
        const aTime = aDate ? new Date(aDate).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = bDate ? new Date(bDate).getTime() : Number.MAX_SAFE_INTEGER;

        if (aTime !== bTime) {
          return globalSortOrder === 'oldest' ? aTime - bTime : bTime - aTime;
        }

        const aStale = a.daysWithoutInteraction ?? -1;
        const bStale = b.daysWithoutInteraction ?? -1;
        return bStale - aStale;
      });
    });

    return map;
  }, [clients, globalSortOrder, pipelineData?.stages, statusCategories]);

  const itemStageMap = useMemo(() => {
    const map = new Map<number, StageKey>();
    STAGES.forEach((stage) => {
      (stagesMap.get(stage) || []).forEach((item) => map.set(item.id, stage));
    });
    return map;
  }, [stagesMap]);

  const itemById = useMemo(() => {
    const map = new Map<number, CapturePipelineItem>();
    STAGES.forEach((stage) => {
      (stagesMap.get(stage) || []).forEach((item) => map.set(item.id, item));
    });
    return map;
  }, [stagesMap]);

  const stageMeta = useMemo(() => {
    const byStage = new Map<StageKey, { label: string; color: string }>();

    STAGES.forEach((stage) => {
      const matched = statusCategories.find((status) => status.stageKey === stage);
      byStage.set(stage, {
        label: matched?.name || STAGE_DEFAULT_META[stage].label,
        color: matched?.color || STAGE_DEFAULT_META[stage].color,
      });
    });

    return byStage;
  }, [statusCategories]);

  const totalContacts = clients.length || Number(pipelineData?.total || 0);

  const selectedContact = selectedContactId ? itemById.get(selectedContactId) || null : null;

  const saveContactMutation = useMutation({
    mutationFn: () => {
      if (!selectedContactId) return Promise.resolve(null);
      return apiRequest('PATCH', `/api/crm/contacts/${selectedContactId}`, {
        name: contactForm.name,
        email: contactForm.email,
        phone: contactForm.phone,
        city: contactForm.city,
        notes: contactForm.notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/capture/pipeline'] });
      toast({ title: 'Empresa actualizada' });
    },
    onError: (error: any) => {
      toast({
        title: 'No se pudo guardar',
        description: error?.message || 'Error al actualizar la empresa',
        variant: 'destructive',
      });
    },
  });

  const addInteractionMutation = useMutation({
    mutationFn: () => {
      if (!selectedContactId || !newUpdateNote.trim()) return Promise.resolve(null);
      return apiRequest('POST', '/api/crm/capture/interactions', {
        contactId: selectedContactId,
        interactionType: 'note',
        subject: 'Seguimiento',
        notes: newUpdateNote.trim(),
        occurredAt: newUpdateDate || undefined,
      });
    },
    onSuccess: () => {
      setNewUpdateNote('');
      queryClient.invalidateQueries({ queryKey: ['/api/crm/capture/interactions', selectedContactId, 'kanban-editor'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/capture/pipeline'] });
      toast({ title: 'Actualización añadida' });
    },
    onError: (error: any) => {
      toast({
        title: 'No se pudo añadir',
        description: error?.message || 'Error al crear la actualización',
        variant: 'destructive',
      });
    },
  });


  const openContactEditor = (contactIdValue: number) => {
    const item = itemById.get(contactIdValue);
    if (!item) return;
    setSelectedContactId(contactIdValue);
    setContactForm({
      name: item.name || '',
      email: item.email || '',
      phone: item.phone || '',
      city: item.city || '',
      notes: item.notes || '',
    });
    setNewUpdateDate(new Date().toISOString().slice(0, 10));
    setNewUpdateNote('');
  };

  const handleDragStart = (event: DragStartEvent) => {
    const contactValue = parseContactId(event.active.id);
    setActiveDragId(contactValue);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    suppressOpenUntilRef.current = Date.now() + 250;

    const activeContactId = parseContactId(event.active.id);
    if (!activeContactId) return;

    const fromStage = itemStageMap.get(activeContactId);
    if (!fromStage) return;

    const overId = event.over?.id;
    if (!overId) return;

    const directStage = getStageFromDroppable(overId);
    const overContactId = parseContactId(overId);
    const inferredStage = overContactId ? itemStageMap.get(overContactId) : null;
    const toStage = directStage || inferredStage;

    if (!toStage || toStage === fromStage) return;

    const item = itemById.get(activeContactId);
    if (!item) return;

    setPendingMove({
      contactId: activeContactId,
      contactName: item.name,
      fromStage,
      toStage,
      comment: STAGE_AUTO_COMMENTS[toStage],
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <MetricCard title="Conversión" value={`${dashboardData?.conversionRate ?? 0}%`} />
        <MetricCard title="Cierre promedio" value={`${dashboardData?.avgCloseDays ?? 0} días`} />
        <MetricCard title="Contactos calientes" value={String(dashboardData?.hotContacts ?? 0)} />
        <MetricCard title="Pendientes" value={String(dashboardData?.upcomingTasks?.length || 0)} />
        <MetricCard title="Pipeline value" value={`${Number(dashboardData?.pipelineValue || 0).toLocaleString('es-ES')} €`} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Captación · tablero visual</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{totalContacts} empresas</Badge>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setGlobalSortOrder((prev) => (prev === 'oldest' ? 'newest' : 'oldest'))}
              >
                Orden: {globalSortOrder === 'oldest' ? 'más antiguos' : 'más recientes'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="overflow-x-auto lg:overflow-visible">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 min-w-[980px] lg:min-w-0">
                {STAGES.map((stage) => {
                  const meta = stageMeta.get(stage) || STAGE_DEFAULT_META[stage];
                  return (
                    <StageColumn
                      key={stage}
                      stage={stage}
                      label={meta.label}
                      color={meta.color}
                      items={stagesMap.get(stage) || []}
                      isLoading={loadingPipeline || loadingClients}
                      onOpen={openContactEditor}
                      suppressOpenUntil={suppressOpenUntilRef}
                    />
                  );
                })}
              </div>
            </div>
          </DndContext>
        </CardContent>
      </Card>

      <Dialog open={!!pendingMove} onOpenChange={(open) => !open && setPendingMove(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirmar cambio de estado</DialogTitle>
          </DialogHeader>

          {pendingMove && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {pendingMove.contactName}: {stageMeta.get(pendingMove.fromStage)?.label || STAGE_DEFAULT_META[pendingMove.fromStage].label} → {stageMeta.get(pendingMove.toStage)?.label || STAGE_DEFAULT_META[pendingMove.toStage].label}
              </p>
              <div>
                <p className="text-sm font-medium mb-1">Comentario (editable)</p>
                <Textarea
                  value={pendingMove.comment}
                  onChange={(e) => setPendingMove((prev) => (prev ? { ...prev, comment: e.target.value } : prev))}
                  rows={4}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingMove(null)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!pendingMove) return;
                moveStageMutation.mutate({
                  contactId: pendingMove.contactId,
                  stage: pendingMove.toStage,
                  comment: pendingMove.comment,
                });
                setPendingMove(null);
              }}
              disabled={moveStageMutation.isPending}
            >
              {moveStageMutation.isPending ? 'Guardando...' : 'Mover'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={selectedContactId !== null} onOpenChange={(open) => !open && setSelectedContactId(null)}>
        <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Seguimiento de empresa</DialogTitle>
          </DialogHeader>

          <div className="max-h-[calc(90vh-180px)] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Nombre</Label>
                    <Input
                      value={contactForm.name}
                      onChange={(e) => setContactForm((prev) => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      value={contactForm.email}
                      onChange={(e) => setContactForm((prev) => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Teléfono</Label>
                    <Input
                      value={contactForm.phone}
                      onChange={(e) => setContactForm((prev) => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Ciudad</Label>
                    <Input
                      value={contactForm.city}
                      onChange={(e) => setContactForm((prev) => ({ ...prev, city: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <Label>Notas del cliente</Label>
                  <Textarea
                    rows={4}
                    value={contactForm.notes}
                    onChange={(e) => setContactForm((prev) => ({ ...prev, notes: e.target.value }))}
                  />
                </div>

                <div className="rounded-lg border p-3 space-y-3">
                  <p className="text-sm font-medium">Nueva actualización</p>
                  <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-2">
                    <DatePickerDay
                      date={parseDayString(newUpdateDate)}
                      onDateChange={(date) => setNewUpdateDate(formatDayString(date))}
                      placeholder="Seleccionar fecha"
                      className="w-full justify-start"
                    />
                    <Textarea
                      rows={3}
                      placeholder="Ej: 26 febrero enviada info, 28 febrero leyó la info..."
                      value={newUpdateNote}
                      onChange={(e) => setNewUpdateNote(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => addInteractionMutation.mutate()}
                      disabled={!newUpdateNote.trim() || addInteractionMutation.isPending}
                    >
                      {addInteractionMutation.isPending ? 'Guardando...' : 'Añadir actualización'}
                    </Button>
                  </div>
                </div>
              </div>

              {selectedContactId && (
                <CRMInteractionHistory
                  contactId={selectedContactId}
                  queryScope="kanban-editor"
                  title="Historial de cambios"
                  emptyText="Sin actualizaciones todavía."
                  maxHeightClassName="max-h-[calc(90vh-240px)]"
                  containerClassName="rounded-lg border p-3 space-y-2"
                  onInteractionChanged={() => {
                    queryClient.invalidateQueries({ queryKey: ['/api/crm/capture/pipeline'] });
                  }}
                />
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedContactId(null)}>Cerrar</Button>
            <Button onClick={() => saveContactMutation.mutate()} disabled={saveContactMutation.isPending || !selectedContact}>
              {saveContactMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {activeDragId !== null && (
        <div className="fixed bottom-4 right-4 text-xs text-muted-foreground bg-background/95 border rounded-lg px-3 py-2 z-50">
          Arrastrando contacto #{activeDragId}
        </div>
      )}
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="text-xl font-semibold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}
