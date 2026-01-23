# Popover Best Practices - Radix UI

## Problema: Popover Abre y Cierra Inmediatamente

### ❌ PROBLEMA - Lo Que NO Hacer

```tsx
// ❌ INCORRECTO - Causa que el popover abra y cierre al instante
const [projectSearchOpen, setProjectSearchOpen] = useState(false);

<Popover open={projectSearchOpen} onOpenChange={(open) => {
  setProjectSearchOpen(open);
  if (!open) setProjectSearchTerm('');
}}>
  <PopoverTrigger asChild>
    <Button aria-expanded={projectSearchOpen}>
      {/* ... */}
    </Button>
  </PopoverTrigger>
  <PopoverContent>
    <div onClick={(e) => {
      e.stopPropagation();
      setFilterProject('all');
      setProjectSearchOpen(false);  // ❌ Intento manual de cerrar
    }}>
      Opción
    </div>
  </PopoverContent>
</Popover>
```

**Por qué falla:**
1. Controlar manualmente el estado `open` con `onOpenChange` crea conflictos con la lógica interna de Radix UI
2. `e.stopPropagation()` no es suficiente cuando intentas controlar estado externamente
3. El re-render causado por `setProjectSearchOpen(false)` interfiere con eventos internos del Popover
4. Crear múltiples re-renders simultáneamente genera race conditions

### ✅ SOLUCIÓN - Lo Que SÍ Hacer

```tsx
// ✅ CORRECTO - Dejar que Radix UI maneje el estado internamente
const [projectSearchTerm, setProjectSearchTerm] = useState<string>('');

<Popover>
  <PopoverTrigger asChild>
    <Button>
      {/* ... */}
    </Button>
  </PopoverTrigger>
  <PopoverContent>
    <input
      value={projectSearchTerm}
      onChange={(e) => setProjectSearchTerm(e.target.value)}
    />
    <button
      type="button"
      onClick={() => {
        setFilterProject('all');
        setProjectSearchTerm('');
        // ❌ NO calls setPopoverOpen(false)
        // ✅ El popover se cierra automáticamente
      }}
    >
      Opción
    </button>
  </PopoverContent>
</Popover>
```

**Por qué funciona:**
1. Radix UI maneja automáticamente abrir/cerrar internamente
2. Los `<button>` dentro de PopoverContent cierran automáticamente el popover al hacer clic
3. No hay conflicto entre estado manual y estado interno
4. Los inputs pueden actualizar su propio estado sin interferir con el Popover

## Reglas de Oro para Popovers en Radix UI

### ✅ RECOMENDACIONES

1. **NO controles el estado `open` manualmente**
   - Deja que Radix UI lo maneje
   - Evita `open={isOpen} onOpenChange={setIsOpen}`

2. **Usa `<button type="button">` para items seleccionables**
   - Los botones cierran automáticamente el popover
   - Semánticamente correcto

3. **Manejo de estado interno del contenido**
   - Puedes tener tu propio estado para búsqueda, filtros, etc.
   - Solo no intentes controlar el estado `open` del Popover

4. **Sin `stopPropagation()` en botones**
   - No es necesario cuando usas buttons
   - Radix UI maneja la propagación correctamente

5. **Limpiar estado al cerrar**
   - Usa `onOpenChange` SOLO si necesitas reaccionar al cierre
   - Pero NO lo uses para controlar el estado `open`

```tsx
// ✅ Si necesitas limpiar algo al cerrar:
<Popover onOpenChange={(open) => {
  if (!open) {
    setSearchTerm('');  // Limpiar búsqueda
    // Pero NO sets el estado open aquí
  }
}}>
```

## Casos de Uso

### ✅ Popover con Búsqueda (CORRECTO)
```tsx
const [searchTerm, setSearchTerm] = useState('');

<Popover>
  <PopoverTrigger asChild>
    <Button>Filtrar</Button>
  </PopoverTrigger>
  <PopoverContent>
    <input
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      placeholder="Buscar..."
    />
    {items
      .filter(item => item.name.includes(searchTerm))
      .map(item => (
        <button
          key={item.id}
          onClick={() => {
            selectItem(item);
            setSearchTerm('');
          }}
        >
          {item.name}
        </button>
      ))
    }
  </PopoverContent>
</Popover>
```

### ✅ Popover Controlado (RARAMENTE NECESARIO)
Si REALMENTE necesitas controlar `open` externamente:
```tsx
// Usar un ref y trigger manual, no state
const [open, setOpen] = useState(false);

// SOLO en casos especiales donde NO tengas alternativa
// Ejemplo: cerrar popover desde outside trigger
<Popover open={open} onOpenChange={setOpen}>
  {/* Contenido simple, sin botones internos */}
</Popover>
```

## Debugging

Si el popover sigue abriendo/cerrando:

1. ✅ Asegúrate de que NO tienes `open=` prop
2. ✅ Verifica que tus elementos internos son `<button>` o tienen `role="button"`
3. ✅ Busca `stopPropagation()` innecesarios
4. ✅ Verifica que no hay múltiples `onOpenChange` handlers conflictivos
5. ✅ Usa React DevTools para inspeccionar re-renders

## Referencias

- [Radix UI Popover Docs](https://www.radix-ui.com/docs/primitives/components/popover)
- Comportamiento: Los Popovers deben cerrarse automáticamente cuando se hace clic en un button/select dentro de ellos
- El estado `open` DEBE ser controlado por Radix UI, no por el componente padre
