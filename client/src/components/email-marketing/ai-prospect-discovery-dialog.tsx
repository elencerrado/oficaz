import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Search, Sparkles, AlertTriangle, CheckCircle2, Globe } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface AiProspect {
  email: string | null;
  name: string | null;
  company: string;
  phone: string | null;
  location: string | null;
  website: string | null;
  description: string | null;
  tags: string[];
  notes: string;
}

interface AiProspectDiscoveryDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  existingProspects: any[];
}

export function AiProspectDiscoveryDialog({
  isOpen,
  onOpenChange,
  onComplete,
  existingProspects
}: AiProspectDiscoveryDialogProps) {
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(10);
  const [results, setResults] = useState<AiProspect[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [editedProspects, setEditedProspects] = useState<Map<number, Partial<AiProspect>>>(new Map());
  const { toast } = useToast();

  const searchMutation = useMutation({
    mutationFn: async ({ query, limit }: { query: string; limit: number }) => {
      const token = sessionStorage.getItem('superAdminToken');
      const response = await fetch('/api/super-admin/ai-prospect-discovery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ query, limit }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al buscar prospects');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setResults(data.prospects || []);
      setSources(data.sources || []);
      
      // Auto-select all non-duplicate prospects
      const nonDuplicates = new Set<number>();
      data.prospects.forEach((prospect: AiProspect, index: number) => {
        if (!isDuplicate(prospect)) {
          nonDuplicates.add(index);
        }
      });
      setSelectedIndices(nonDuplicates);
      
      toast({
        title: '✨ Búsqueda completada',
        description: `Se encontraron ${data.count} prospects. ${nonDuplicates.size} seleccionados automáticamente (sin duplicados).`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error en la búsqueda',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const addMutation = useMutation({
    mutationFn: async (prospects: AiProspect[]) => {
      const token = sessionStorage.getItem('superAdminToken');
      const results = await Promise.allSettled(
        prospects.map(prospect =>
          fetch('/api/super-admin/email-prospects', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(prospect),
          }).then(r => r.ok ? r.json() : Promise.reject(r))
        )
      );
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      return { successful, failed, total: prospects.length };
    },
    onSuccess: (data) => {
      toast({
        title: '✅ Prospects añadidos',
        description: `${data.successful} de ${data.total} prospects añadidos correctamente${data.failed > 0 ? ` (${data.failed} fallidos)` : ''}.`,
      });
      onComplete();
      handleReset();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al añadir prospects',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSearch = () => {
    if (!query.trim()) {
      toast({
        title: 'Query vacía',
        description: 'Por favor, introduce una búsqueda',
        variant: 'destructive',
      });
      return;
    }
    
    setResults([]);
    setSources([]);
    setSelectedIndices(new Set());
    setEditedProspects(new Map());
    
    searchMutation.mutate({ query, limit });
  };

  const handleReset = () => {
    setQuery('');
    setLimit(10);
    setResults([]);
    setSources([]);
    setSelectedIndices(new Set());
    setEditedProspects(new Map());
    onOpenChange(false);
  };

  const handleAddSelected = () => {
    const selectedProspects = Array.from(selectedIndices).map(index => {
      const original = results[index];
      const edits = editedProspects.get(index) || {};
      return { ...original, ...edits };
    });

    if (selectedProspects.length === 0) {
      toast({
        title: 'Sin selección',
        description: 'Selecciona al menos un prospect para añadir',
        variant: 'destructive',
      });
      return;
    }

    addMutation.mutate(selectedProspects);
  };

  const toggleSelection = (index: number) => {
    const newSet = new Set(selectedIndices);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setSelectedIndices(newSet);
  };

  const updateProspectField = (index: number, field: keyof AiProspect, value: any) => {
    const newEdits = new Map(editedProspects);
    const currentEdits = newEdits.get(index) || {};
    newEdits.set(index, { ...currentEdits, [field]: value });
    setEditedProspects(newEdits);
  };

  const getProspectValue = (index: number, field: keyof AiProspect) => {
    const edits = editedProspects.get(index);
    if (edits && field in edits) {
      return edits[field];
    }
    return results[index][field];
  };

  const isDuplicate = (prospect: AiProspect) => {
    const emailLower = prospect.email?.toLowerCase();
    const phoneCleaned = prospect.phone?.replace(/\s/g, '');
    
    return existingProspects.some(existing => {
      if (emailLower && existing.email?.toLowerCase() === emailLower) return true;
      if (phoneCleaned && existing.phone?.replace(/\s/g, '') === phoneCleaned) return true;
      return false;
    });
  };

  const selectAll = () => {
    const allIndices = new Set(results.map((_, i) => i));
    setSelectedIndices(allIndices);
  };

  const deselectAll = () => {
    setSelectedIndices(new Set());
  };

  const selectNonDuplicates = () => {
    const nonDuplicates = new Set<number>();
    results.forEach((prospect, index) => {
      if (!isDuplicate(prospect)) {
        nonDuplicates.add(index);
      }
    });
    setSelectedIndices(nonDuplicates);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Descubrir Prospects con IA
          </DialogTitle>
          <DialogDescription>
            Genera automáticamente prospects plausibles basados en tu sector y ubicación
          </DialogDescription>
        </DialogHeader>

        {/* Search Form */}
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="search-query">¿Qué empresas buscas?</Label>
            <div className="flex gap-2">
              <Input
                id="search-query"
                placeholder="ej: Fontaneros en Sevilla, Restaurantes en Madrid, Clínicas dentales en Barcelona..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                disabled={searchMutation.isPending}
                data-testid="input-ai-search-query"
              />
              <Input
                type="number"
                min={1}
                max={20}
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value) || 10)}
                className="w-20"
                disabled={searchMutation.isPending}
                data-testid="input-ai-search-limit"
              />
              <Button 
                onClick={handleSearch} 
                disabled={searchMutation.isPending || !query.trim()}
                data-testid="button-ai-search"
              >
                {searchMutation.isPending ? (
                  <LoadingSpinner size="sm" className="mr-2" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Buscar
              </Button>
            </div>
          </div>

          {/* Loading State */}
          {searchMutation.isPending && (
            <div className="text-center py-8 space-y-3">
              <LoadingSpinner size="lg" className="mx-auto text-purple-500" />
              <p className="text-sm text-muted-foreground">
                Generando prospects... Esto puede tardar 3-5 segundos
              </p>
              <p className="text-xs text-muted-foreground">
                La IA está creando datos realistas basados en tu búsqueda
              </p>
            </div>
          )}

          {/* Results */}
          {results.length > 0 && !searchMutation.isPending && (
            <div className="space-y-4">
              {/* Selection Controls */}
              <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">
                    {selectedIndices.size} de {results.length} seleccionados
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={selectAll}
                    data-testid="button-select-all"
                  >
                    Seleccionar todos
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={selectNonDuplicates}
                    data-testid="button-select-non-duplicates"
                  >
                    Solo nuevos
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={deselectAll}
                    data-testid="button-deselect-all"
                  >
                    Deseleccionar
                  </Button>
                </div>
              </div>

              {/* Results Table */}
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Sel.</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Ubicación</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((prospect, index) => {
                      const duplicate = isDuplicate(prospect);
                      return (
                        <TableRow 
                          key={index} 
                          className={duplicate ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}
                          data-testid={`row-prospect-${index}`}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedIndices.has(index)}
                              onCheckedChange={() => toggleSelection(index)}
                              disabled={addMutation.isPending}
                              data-testid={`checkbox-prospect-${index}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={getProspectValue(index, 'company') as string}
                              onChange={(e) => updateProspectField(index, 'company', e.target.value)}
                              className="min-w-[150px]"
                              disabled={addMutation.isPending}
                              data-testid={`input-company-${index}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={getProspectValue(index, 'name') as string || ''}
                              onChange={(e) => updateProspectField(index, 'name', e.target.value)}
                              placeholder="Nombre contacto"
                              disabled={addMutation.isPending}
                              data-testid={`input-name-${index}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={getProspectValue(index, 'email') as string || ''}
                              onChange={(e) => updateProspectField(index, 'email', e.target.value)}
                              placeholder="email@ejemplo.com"
                              disabled={addMutation.isPending}
                              data-testid={`input-email-${index}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={getProspectValue(index, 'phone') as string || ''}
                              onChange={(e) => updateProspectField(index, 'phone', e.target.value)}
                              placeholder="+34..."
                              disabled={addMutation.isPending}
                              data-testid={`input-phone-${index}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={getProspectValue(index, 'location') as string || ''}
                              onChange={(e) => updateProspectField(index, 'location', e.target.value)}
                              placeholder="Ciudad"
                              disabled={addMutation.isPending}
                              data-testid={`input-location-${index}`}
                            />
                          </TableCell>
                          <TableCell>
                            {duplicate ? (
                              <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                                <AlertTriangle className="h-4 w-4" />
                                <span className="text-xs">Duplicado</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                <CheckCircle2 className="h-4 w-4" />
                                <span className="text-xs">Nuevo</span>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Sources */}
              {sources.length > 0 && (
                <div className="text-xs text-muted-foreground space-y-1">
                  <div className="flex items-center gap-2">
                    <Globe className="h-3 w-3" />
                    <span className="font-medium">Fuentes consultadas:</span>
                  </div>
                  <ul className="list-disc list-inside pl-4 space-y-0.5">
                    {sources.slice(0, 5).map((source, i) => (
                      <li key={i} className="truncate">{source}</li>
                    ))}
                    {sources.length > 5 && <li>y {sources.length - 5} más...</li>}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={handleReset}
            disabled={searchMutation.isPending || addMutation.isPending}
            data-testid="button-cancel"
          >
            Cancelar
          </Button>
          {results.length > 0 && (
            <Button 
              onClick={handleAddSelected}
              disabled={selectedIndices.size === 0 || addMutation.isPending}
              data-testid="button-add-selected"
            >
              {addMutation.isPending ? (
                <LoadingSpinner size="sm" className="mr-2" />
              ) : null}
              Añadir seleccionados ({selectedIndices.size})
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
