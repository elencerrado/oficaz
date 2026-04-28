import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { DatePickerDay } from '@/components/ui/date-picker';
import { useToast } from '@/hooks/use-toast';
import { useStandardInfiniteScroll } from '@/hooks/use-standard-infinite-scroll';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Check, Edit2, Trash2, X } from 'lucide-react';

interface CRMInteraction {
  id: number;
  subject?: string | null;
  notes?: string | null;
  occurredAt?: string | null;
  createdByName?: string | null;
}

interface PaginatedInteractionsResponse {
  items: CRMInteraction[];
  totalCount: number;
  hasMore: boolean;
}

interface CRMInteractionHistoryProps {
  contactId: number;
  queryScope: string;
  title?: string;
  emptyText?: string;
  subjectFilter?: string;
  maxHeightClassName?: string;
  containerClassName?: string;
  showCount?: boolean;
  onInteractionChanged?: () => void;
}

const PAGE_SIZE = 20;

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

function formatDate(value?: string | null) {
  if (!value) return 'Fecha no disponible';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CRMInteractionHistory({
  contactId,
  queryScope,
  title = 'Historial',
  emptyText = 'Sin registros todavía.',
  subjectFilter,
  maxHeightClassName = 'max-h-60',
  containerClassName = 'rounded-lg border p-3 space-y-2',
  showCount = false,
  onInteractionChanged,
}: CRMInteractionHistoryProps) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingDate, setEditingDate] = useState('');
  const [editingNotes, setEditingNotes] = useState('');
  const [pendingDeleteEntry, setPendingDeleteEntry] = useState<CRMInteraction | null>(null);
  const historyListRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [hasOverflow, setHasOverflow] = useState(false);

  const {
    data: interactionsPages,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery<PaginatedInteractionsResponse>({
    queryKey: ['/api/crm/capture/interactions', contactId, queryScope],
    queryFn: ({ pageParam = 0 }) =>
      apiRequest(
        'GET',
        `/api/crm/capture/interactions/${contactId}?limit=${PAGE_SIZE}&offset=${pageParam}`
      ),
    staleTime: 15_000,
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage?.hasMore) return undefined;
      return allPages.reduce((acc, page) => acc + (page.items?.length || 0), 0);
    },
  });

  const interactions = useMemo(
    () => (interactionsPages?.pages || []).flatMap((page) => page.items || []),
    [interactionsPages]
  );

  const filteredInteractions = useMemo(
    () => subjectFilter
      ? interactions.filter((item) => item.subject === subjectFilter)
      : interactions,
    [interactions, subjectFilter]
  );

  useEffect(() => {
    const node = historyListRef.current;
    if (!node) {
      setHasOverflow(false);
      return;
    }

    const checkOverflow = () => {
      setHasOverflow(node.scrollHeight > node.clientHeight + 1);
    };

    checkOverflow();
    const timeoutId = window.setTimeout(checkOverflow, 0);
    window.addEventListener('resize', checkOverflow);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('resize', checkOverflow);
    };
  }, [filteredInteractions, editingId, editingDate, editingNotes, isLoading]);

  useStandardInfiniteScroll({
    targetRef: loadMoreRef,
    rootRef: historyListRef,
    enabled: true,
    canLoadMore: !!hasNextPage,
    isLoadingMore: isFetchingNextPage,
    onLoadMore: fetchNextPage,
    dependencyKey: filteredInteractions.length,
    rootMargin: '120px',
    threshold: 0.1,
  });

  const stageLabelMap: Record<string, string> = {
    initial_contact: 'Contacto inicial',
    info_sent: 'Info enviada',
    meeting_scheduled: 'Reunión agendada',
    negotiation: 'Negociación',
    client: 'Cliente',
    discarded: 'Descartado',
  };

  const beautifyStatusText = (value: string) => {
    let result = value;
    Object.entries(stageLabelMap).forEach(([key, label]) => {
      result = result.replace(new RegExp(`\\b${key}\\b`, 'gi'), label);
    });
    return result;
  };

  const refreshInteractions = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/crm/capture/interactions', contactId, queryScope] });
    onInteractionChanged?.();
  };

  const saveInteractionMutation = useMutation({
    mutationFn: (payload: { interactionId: number; notes: string; date: string }) =>
      apiRequest('PATCH', `/api/crm/capture/interactions/${payload.interactionId}`, {
        notes: payload.notes,
        occurredAt: payload.date || undefined,
      }),
    onSuccess: () => {
      setEditingId(null);
      setEditingDate('');
      setEditingNotes('');
      refreshInteractions();
      toast({ title: 'Registro actualizado' });
    },
    onError: (error: any) => {
      toast({
        title: 'No se pudo actualizar',
        description: error?.message || 'Error al guardar cambios del registro',
        variant: 'destructive',
      });
    },
  });

  const deleteInteractionMutation = useMutation({
    mutationFn: (interactionId: number) => apiRequest('DELETE', `/api/crm/capture/interactions/${interactionId}`),
    onSuccess: () => {
      setPendingDeleteEntry(null);
      refreshInteractions();
      toast({ title: 'Registro eliminado' });
    },
    onError: (error: any) => {
      toast({
        title: 'No se pudo eliminar',
        description: error?.message || 'Error al eliminar el registro',
        variant: 'destructive',
      });
    },
  });

  return (
    <div className={containerClassName}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        {showCount && <Badge variant="secondary" className="text-[11px] h-5 px-2">{filteredInteractions.length}</Badge>}
      </div>

      {isLoading && <p className="text-xs text-muted-foreground">Cargando...</p>}
      {!isLoading && filteredInteractions.length === 0 && (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      )}

      <div ref={historyListRef} className={`space-y-1.5 overflow-auto pr-1 ${maxHeightClassName}`}>
        {filteredInteractions.map((entry) => (
          <div key={entry.id} className="rounded-md border p-2 bg-background/80">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] text-muted-foreground">{formatDate(entry.occurredAt)}</span>
                  {entry.createdByName && (
                    <span className="text-[11px] text-muted-foreground truncate">· {entry.createdByName}</span>
                  )}
                </div>
              </div>

              {editingId !== entry.id ? (
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => {
                      setEditingId(entry.id);
                      setEditingDate(entry.occurredAt ? new Date(entry.occurredAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
                      setEditingNotes(entry.notes || '');
                    }}
                    aria-label="Editar registro"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => setPendingDeleteEntry(entry)}
                    aria-label="Eliminar registro"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-emerald-600"
                    onClick={() => {
                      if (!editingNotes.trim()) return;
                      saveInteractionMutation.mutate({
                        interactionId: entry.id,
                        notes: editingNotes.trim(),
                        date: editingDate,
                      });
                    }}
                    disabled={!editingNotes.trim() || saveInteractionMutation.isPending}
                    aria-label="Guardar registro"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => {
                      setEditingId(null);
                      setEditingDate('');
                      setEditingNotes('');
                    }}
                    aria-label="Cancelar edición"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {editingId === entry.id ? (
              <div className="space-y-2 mt-1.5">
                <DatePickerDay
                  date={parseDayString(editingDate)}
                  onDateChange={(date) => setEditingDate(formatDayString(date))}
                  placeholder="Seleccionar fecha"
                  className="w-full justify-start"
                />
                <Textarea
                  rows={3}
                  value={editingNotes}
                  onChange={(e) => setEditingNotes(e.target.value)}
                />
              </div>
            ) : (
              <p className="text-sm whitespace-pre-wrap mt-1">{beautifyStatusText(entry.notes || '(sin nota)')}</p>
            )}
          </div>
        ))}

        {!isLoading && hasNextPage && <div ref={loadMoreRef} className="h-2" />}
        {isFetchingNextPage && (
          <p className="text-xs text-muted-foreground text-center py-1">Cargando más...</p>
        )}
      </div>

      {hasOverflow && (
        <p className="text-[11px] text-muted-foreground">Mostrando historial reciente, desplaza para ver más.</p>
      )}

      <Dialog open={pendingDeleteEntry !== null} onOpenChange={(open) => !open && setPendingDeleteEntry(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar borrado</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Seguro que quieres eliminar este registro? Esta acción no se puede deshacer.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDeleteEntry(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!pendingDeleteEntry) return;
                deleteInteractionMutation.mutate(pendingDeleteEntry.id);
              }}
              disabled={deleteInteractionMutation.isPending}
            >
              {deleteInteractionMutation.isPending ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
