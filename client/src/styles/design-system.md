# Oficaz Design System

## 🎨 Sistema de Colores

### Colores Primarios
- **Primary**: `#007AFF` (hsl(211, 100%, 50%))
- **Secondary**: `#424242` (hsl(0, 0%, 26%))

### Colores de Estado
- **Success**: `#22C55E` (hsl(122, 39%, 49%))
- **Warning**: `#F59E0B` (hsl(36, 100%, 50%))
- **Error**: `#EF4444` (hsl(4, 90%, 58%))

### Escala de Grises
- Gray 50: `#F9FAFB`
- Gray 100: `#F3F4F6`
- Gray 200: `#E5E7EB`
- Gray 300: `#D1D5DB`
- Gray 400: `#9CA3AF`
- Gray 500: `#6B7280`
- Gray 600: `#4B5563`
- Gray 700: `#374151`
- Gray 800: `#1F2937`
- Gray 900: `#111827`

## 📝 Tipografía

### Jerarquía de Encabezados
```css
.heading-1    /* text-2xl font-bold - Títulos principales */
.heading-2    /* text-xl font-semibold - Subtítulos */
.heading-3    /* text-lg font-semibold - Secciones */
.heading-4    /* text-base font-medium - Subsecciones */
```

### Texto de Contenido
```css
.body-text     /* text-sm text-gray-700 - Texto principal */
.caption-text  /* text-xs text-gray-500 - Texto secundario */
.label-text    /* text-sm font-medium - Etiquetas */
```

## 🔘 Sistema de Botones

### Botones Primarios
```css
.btn-oficaz-primary   /* Azul #007AFF - Acciones principales */
.btn-oficaz-secondary /* Gris - Acciones secundarias */
.btn-oficaz-outline   /* Borde - Acciones terciarias */
```

### Botones de Estado
```css
.btn-oficaz-success   /* Verde - Confirmaciones */
.btn-oficaz-danger    /* Rojo - Eliminaciones */
```

### Efectos de Hover Estándar
- Cambio de color suave (200ms)
- Escala activa (active:scale-95)
- Ring focus consistente

## 🎯 Iconografía

### Tamaños Estándar
```css
.icon-sm   /* 16px - Iconos pequeños */
.icon-md   /* 20px - Iconos medianos */
.icon-lg   /* 24px - Iconos grandes */
.icon-xl   /* 32px - Iconos extra grandes */
```

### Consistencia de Iconos
- Usar Lucide React para todos los iconos
- Mantener grosor consistente (stroke-width: 2)
- Colores según contexto (gray-600 por defecto)

## 📦 Componentes de Tarjeta

### Tipos de Tarjeta
```css
.card-oficaz       /* Tarjeta estática */
.card-oficaz-hover /* Tarjeta con hover */
```

### Estructura Estándar
```css
.card-header   /* Encabezado con borde inferior */
.card-content  /* Contenido con padding estándar */
```

## 📝 Sistema de Formularios

### Inputs Estándar
```css
.input-oficaz  /* Input base con focus azul */
.input-error   /* Input con estado de error */
```

### Estados de Validación
- Focus: Border azul + ring sutil
- Error: Border rojo + ring rojo
- Placeholder: text-gray-400

## 🏷️ Sistema de Badges

### Badges de Estado
```css
.badge-success  /* Verde - Estados positivos */
.badge-warning  /* Amarillo - Estados de atención */
.badge-danger   /* Rojo - Estados críticos */
.badge-info     /* Azul - Estados informativos */
.badge-neutral  /* Gris - Estados neutros */
```

## ✨ Efectos de Hover

### Animaciones Estándar
```css
.hover-lift   /* Elevación sutil (-translate-y-0.5) */
.hover-scale  /* Escala ligera (scale-105) */
.hover-bg-oficaz /* Fondo gris suave */
```

### Duración Estándar
- Todas las transiciones: 200ms
- Ease: ease-out para entradas, ease-in para salidas

## 📐 Sistema de Espaciado

### Espaciado de Secciones
```css
.section-spacing  /* space-y-6 - Entre secciones */
.form-spacing     /* space-y-4 - Entre campos de formulario */
.grid-spacing     /* gap-6 - En grids y layouts */
```

### Padding Estándar
- Tarjetas: px-6 py-4
- Botones: px-4 py-2
- Inputs: px-3 py-2

## 🎯 Reglas de Implementación

### 1. Consistencia
- Usar siempre las clases del sistema
- No crear variaciones individuales
- Mantener la jerarquía visual

### 2. Accesibilidad
- Contraste mínimo 4.5:1 para texto
- Estados de focus visibles
- Tamaños de toque mínimos 44px

### 3. Responsividad
- Mobile-first approach
- Breakpoints estándar de Tailwind
- Textos escalables

### 4. Performance
- Usar CSS variables para colores
- Minimizar animaciones complejas
- Lazy loading para componentes pesados

## 📋 Checklist de Implementación

- [ ] Aplicar clases de tipografía consistentes
- [ ] Usar botones del sistema en toda la app
- [ ] Implementar iconos con tamaños estándar
- [ ] Aplicar efectos de hover uniformes
- [ ] Usar badges para estados
- [ ] Implementar espaciado consistente
- [ ] Validar contraste de colores
- [ ] Probar en dispositivos móviles