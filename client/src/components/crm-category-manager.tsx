import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { MoreVertical, Trash2, Edit2, X as XIcon, Check } from 'lucide-react';

const COLOR_OPTIONS = [
  { name: 'Predeterminado', value: 'predeterminado', bg: 'bg-gray-100', text: 'text-gray-700', swatch: 'bg-gray-700', badge: 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300' },
  { name: 'Naranja', value: 'naranja', bg: 'bg-orange-100', text: 'text-orange-700', swatch: 'bg-orange-700', badge: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' },
  { name: 'Gris', value: 'gris', bg: 'bg-slate-100', text: 'text-slate-700', swatch: 'bg-slate-700', badge: 'bg-slate-100 dark:bg-slate-900/30 text-slate-700 dark:text-slate-300' },
  { name: 'Marrón', value: 'marron', bg: 'bg-amber-100', text: 'text-amber-700', swatch: 'bg-amber-700', badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
  { name: 'Amarillo', value: 'amarillo', bg: 'bg-yellow-100', text: 'text-yellow-700', swatch: 'bg-yellow-600', badge: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' },
  { name: 'Verde', value: 'verde', bg: 'bg-green-100', text: 'text-green-700', swatch: 'bg-green-700', badge: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' },
  { name: 'Azul', value: 'azul', bg: 'bg-blue-100', text: 'text-blue-700', swatch: 'bg-blue-700', badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
  { name: 'Morado', value: 'morado', bg: 'bg-purple-100', text: 'text-purple-700', swatch: 'bg-purple-700', badge: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' },
  { name: 'Rosa', value: 'rosa', bg: 'bg-pink-100', text: 'text-pink-700', swatch: 'bg-pink-700', badge: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300' },
  { name: 'Rojo', value: 'rojo', bg: 'bg-red-100', text: 'text-red-700', swatch: 'bg-red-700', badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' },
];

const normalizeColor = (value?: string) => {
  if (!value) return 'predeterminado';
  // Legacy mappings or English keys -> current palette keys
  if (value === 'blue') return 'azul';
  if (value === 'default') return 'predeterminado';
  return value;
};

export type CRMCategoryData = {
  id?: number;
  name: string;
  color: string;
};

interface CategoryTagProps {
  category: CRMCategoryData;
  onEdit: (category: CRMCategoryData) => void;
  onDelete: (categoryId: number) => void;
  showMenu?: boolean;
}

export function CategoryTag({ category, onEdit, onDelete, showMenu = true }: CategoryTagProps) {
  const normalizedColor = normalizeColor(category.color);
  const colorOption = COLOR_OPTIONS.find(c => c.value === normalizedColor) || COLOR_OPTIONS[0];
  
  return (
    <div className="inline-flex items-center gap-1 group">
      <Badge className={`${colorOption.badge} border-0 text-xs`}>
        {category.name}
      </Badge>
      {showMenu && category.id && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="opacity-0 group-hover:opacity-100 transition-opacity h-5 w-5 p-0 rounded hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center"
              onClick={(e) => { e.stopPropagation(); }}
              onMouseDown={(e) => { e.stopPropagation(); }}
              data-menu-trigger="true"
            >
              <MoreVertical className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => onEdit(category)}>
              <Edit2 className="h-4 w-4 mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => category.id && onDelete(category.id)}
              className="text-red-600 dark:text-red-400"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

interface CategoryEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: CRMCategoryData | null;
  onSave: (category: CRMCategoryData) => void;
}

export function CategoryEditorDialog({ open, onOpenChange, category, onSave }: CategoryEditorDialogProps) {
  const [name, setName] = useState(category?.name || '');
  const [color, setColor] = useState(normalizeColor(category?.color));

  // Prefill dialog fields whenever a different category is selected for editing
  // Ensures the name is autocompleted with the current category name
  // and color reflects the existing value
  // Matches Notion-like edit behavior
  // Note: keep defaults for new category
  useEffect(() => {
    if (category) {
      setName(category.name || '');
      setColor(normalizeColor(category.color));
    } else {
      setName('');
      setColor('predeterminado');
    }
  }, [category]);

  const handleSave = () => {
    if (name.trim()) {
      onSave({
        id: category?.id,
        name: name.trim(),
        color,
      });
      setName('');
      setColor('blue');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm dark:bg-gray-900">
        <DialogHeader>
          <DialogTitle>
            {category ? 'Editar categoría' : 'Nueva categoría'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium dark:text-gray-200 mb-2 block">
              Nombre
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: VIP, Premium, etc..."
              className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>

          <div>
            <label className="text-sm font-medium dark:text-gray-200 mb-2 block">
              Color
            </label>
            <div className="grid grid-cols-5 gap-2">
              {COLOR_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setColor(option.value)}
                  className={`h-10 rounded border-2 transition-all relative flex items-center justify-center ${
                    color === option.value
                      ? `border-gray-900 dark:border-white ${option.swatch}`
                      : `border-transparent ${option.swatch}`
                  } text-white`}
                  title={option.name}
                >
                  {color === option.value && (
                    <Check className="h-4 w-4" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CategoryMultiSelectProps {
  selectedCategories: CRMCategoryData[];
  availableCategories: CRMCategoryData[];
  onAdd: (category: CRMCategoryData) => void;
  onRemove: (categoryId: number | undefined) => void;
  onCreateNew: (name: string, color: string) => void;
  onEditCategory: (category: CRMCategoryData) => void;
  onDeleteCategory: (categoryId: number) => void;
  multiSelect?: boolean; // Si es false, solo se puede seleccionar una categoría (se reemplaza)
}

export function CategoryMultiSelect({
  selectedCategories,
  availableCategories,
  onAdd,
  onRemove,
  onCreateNew,
  onEditCategory,
  onDeleteCategory,
  multiSelect = true, // Por defecto es multi-selección
}: CategoryMultiSelectProps) {
  const [input, setInput] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CRMCategoryData | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const inputContainerRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const createColorIndexRef = useRef<number>(0);

  const handleDeleteCategory = (categoryId: number | undefined) => {
    if (!categoryId) return;
    // Remove from selected chips for the current contact to avoid lingering tags
    onRemove(categoryId);
    // Remove from available list (global delete)
    onDeleteCategory(categoryId);
    // Clear any typed text so it never appears after deleting
    setInput('');
    // Close dropdown to avoid flicker/reselect; user can reopen by clicking input
    setShowMenu(false);
    // Keep focus so reopening is one click
    inputRef.current?.focus();
  };

  // Normalize strings for case-insensitive and accent-insensitive matching
  const norm = (s: string) =>
    Array.from(s.toLowerCase().normalize('NFD'))
      .filter((ch) => {
        const code = ch.charCodeAt(0);
        return code < 0x0300 || code > 0x036f;
      })
      .join('');

  // Close dropdown on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const insideInput = inputContainerRef.current?.contains(target);
      const insideDropdown = dropdownRef.current?.contains(target);
      const insideMenuPortal = target.closest('[data-radix-popper-content]');
      const insideCategoryMenu = target.closest('[data-category-menu]');
      if (insideInput || insideDropdown || insideMenuPortal || insideCategoryMenu) return;
      setShowMenu(false);
    };
    document.addEventListener('mousedown', handleClick, true);
    return () => document.removeEventListener('mousedown', handleClick, true);
  }, [showMenu]);

  // Calculate dropdown max height dynamically to prevent overflow
  useEffect(() => {
    if (!showMenu || !dropdownRef.current || !inputContainerRef.current) return;
    
    const updateMaxHeight = () => {
      const inputRect = inputContainerRef.current?.getBoundingClientRect();
      if (!inputRect || !dropdownRef.current) return;
      
      const spaceBelow = window.innerHeight - inputRect.bottom - 10; // 10px extra margin
      const maxHeight = Math.max(150, Math.min(400, spaceBelow - 30)); // Min 150px, max 400px, with 30px margin
      dropdownRef.current.style.maxHeight = `${maxHeight}px`;
    };

    // Update immediately with a slight delay to ensure DOM is ready
    const timeoutId = setTimeout(updateMaxHeight, 0);
    updateMaxHeight();
    
    window.addEventListener('resize', updateMaxHeight);
    window.addEventListener('scroll', updateMaxHeight, true);
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', updateMaxHeight);
      window.removeEventListener('scroll', updateMaxHeight, true);
    };
  }, [showMenu]);

  const filtered = availableCategories.filter(c => 
    norm(c.name).includes(norm(input))
  );

  const handleCreateNew = () => {
    if (input.trim()) {
      const nextIndex = createColorIndexRef.current % COLOR_OPTIONS.length;
      createColorIndexRef.current += 1;
      const nextColor = COLOR_OPTIONS[nextIndex].value;
      const newCategory: CRMCategoryData = {
        name: input.trim(),
        color: nextColor,
      };
      onCreateNew(newCategory.name, newCategory.color);
      setInput('');
      setShowMenu(true);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="space-y-2">
      {/* Outer container is relative so dropdown anchors to its left edge */}
      <div className="relative flex flex-wrap gap-2 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 min-h-[40px]">
        {/* Selected chips: show only an X for removal, no 3-dots */}
        {selectedCategories.map((category) => (
          <div key={category.id} className="inline-flex items-center gap-1">
            <CategoryTag
              category={category}
              onEdit={() => {}}
              onDelete={() => {}}
              showMenu={false}
            />
            <button
              type="button"
              aria-label="Quitar"
              className="h-5 w-5 p-0 rounded hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center"
              onClick={() => {
                onRemove(category.id);
                setInput('');
                setShowMenu(true);
                inputRef.current?.focus();
              }}
            >
              <XIcon className="h-3 w-3" />
            </button>
          </div>
        ))}

        {/* Input always at the end, dropdown anchored to the left of the whole control */}
        <div
          className="flex-1 min-w-[150px]"
          ref={inputContainerRef}
          onMouseDown={() => {
            // Always reopen dropdown when clicking the input area
            setShowMenu(true);
            // Ensure input has focus to keep typing flow
            inputRef.current?.focus();
          }}
        >
          <Input
            type="text"
            placeholder={inputFocused || selectedCategories.length > 0 ? '' : 'Agregar categoría...'}
            value={input}
            onChange={(e) => { setInput(e.target.value); setShowMenu(true); }}
            onFocus={() => { setShowMenu(true); setInputFocused(true); }}
            className="border-0 p-0 bg-transparent dark:bg-transparent dark:text-white focus-visible:ring-0 focus-visible:ring-offset-0 h-auto caret-transparent"
            ref={inputRef}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setShowMenu(false);
              }
              if (e.key === 'Enter' && input.trim()) {
                e.preventDefault();
                if (filtered.length > 0) {
                  // Select first non-selected match
                  const firstAvailable = filtered.find(f => !selectedCategories.some(s => s.id === f.id));
                  if (firstAvailable) {
                    onAdd(firstAvailable);
                    setInput('');
                    setShowMenu(true);
                    inputRef.current?.focus();
                  }
                } else {
                  // No matches: create new
                  handleCreateNew();
                }
              }
            }}
            onBlur={() => setInputFocused(false)}
          />
        </div>

        {showMenu && (
          <div
            ref={dropdownRef}
            className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg z-[9999] min-w-[240px] overflow-y-auto"
          >
            {/* Existing categories with far-right 3-dots menu */}
            {filtered.length > 0 && (
              <>
                {filtered.map((category) => (
                  <div
                    key={category.id}
                    className="w-full px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between gap-2"
                    onMouseDown={(e) => {
                      // If clicking on menu trigger, do not select
                      if ((e.target as HTMLElement).closest('[data-menu-trigger]')) {
                        e.preventDefault();
                        return;
                      }
                      e.preventDefault();
                      // If already selected, do nothing
                      if (selectedCategories.some(s => s.id === category.id)) {
                        return;
                      }
                      
                      // Si es single-select y ya hay una categoría seleccionada, quitarla primero
                      if (!multiSelect && selectedCategories.length > 0) {
                        selectedCategories.forEach(cat => {
                          if (cat.id) onRemove(cat.id);
                        });
                      }
                      
                      onAdd(category);
                      setInput('');
                      // Keep dropdown open for multi-selection and editing
                      setShowMenu(true);
                      inputRef.current?.focus();
                    }}
                  >
                    {/* Left: category tag (no internal menu) */}
                    <CategoryTag
                      category={category}
                      onEdit={() => setEditingCategory(category)}
                      onDelete={onDeleteCategory}
                      showMenu={false}
                    />

                    {/* Right: far-right 3-dots menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="h-6 w-6 p-0 rounded hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center"
                          data-menu-trigger="true"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40" data-category-menu>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setEditingCategory(category);
                            setShowMenu(false);
                          }}
                        >
                          <Edit2 className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDeleteCategory(category.id);
                          }}
                          className="text-red-600 dark:text-red-400"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
                {input.trim() && (
                  <div className="border-t border-gray-200 dark:border-gray-700" />
                )}
              </>
            )}

            {/* Create new (only when no matches) */}
            {input.trim() && filtered.length === 0 && (
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/20 transition-colors"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleCreateNew();
                }}
              >
                + Crear "{input.trim()}"
              </button>
            )}

            {/* Empty hint */}
            {!input.trim() && filtered.length === 0 && availableCategories.length > 0 && (
              <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 italic">
                Escribe para filtrar o crear nueva
              </div>
            )}
          </div>
        )}
      </div>

      <CategoryEditorDialog
        open={!!editingCategory}
        onOpenChange={(open) => !open && setEditingCategory(null)}
        category={editingCategory}
        onSave={(updated) => {
          onEditCategory(updated);
          setEditingCategory(null);
        }}
      />
    </div>
  );
}
