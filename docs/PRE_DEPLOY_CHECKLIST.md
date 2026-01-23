# Lista de Verificación Pre-Deploy

**IMPORTANTE**: Ejecutar SIEMPRE antes de hacer deploy a producción para evitar errores que solo aparecen en producción.

## ✅ Verificaciones Obligatorias

### 1. Compilación TypeScript
```bash
npm run check
```
**⚠️ CRÍTICO**: El build NO debe tener errores de TypeScript. Los warnings de tipo pueden causar crashes en producción.

### 2. Build de Producción Local
```bash
npm run build
```
**Verificar**: 
- El build debe completarse sin errores
- Revisar el tamaño de los bundles (no deben crecer excesivamente)
- No debe haber warnings críticos de dependencias

### 3. Tests (si existen)
```bash
npm test
```

## 🔍 Verificaciones Específicas

### PDF.js y React-PDF
- ✅ NO usar `pdfjs.disableWorker` (deprecado)
- ✅ Configurar `GlobalWorkerOptions.workerSrc` correctamente
- ✅ Usar legacy build para compatibilidad iOS: 
  ```typescript
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`;
  ```

### Manejo de Null/Undefined
- ✅ Verificar que `blobUrl`, `url`, y objetos similares se validen antes de usar
- ✅ Usar optional chaining (`?.`) y nullish coalescing (`??`)
- ✅ No asignar directamente valores que pueden ser `null` a propiedades DOM

Ejemplo incorrecto:
```typescript
a.href = blobUrl; // ❌ puede ser null
```

Ejemplo correcto:
```typescript
if (blobUrl) {
  a.href = blobUrl; // ✅ verificado antes
}
```

### Tipos TypeScript
- ✅ NO usar `any` sin justificación
- ✅ Definir tipos explícitos para queries de React Query
- ✅ Validar tipos de respuestas de API

Ejemplo correcto:
```typescript
const { data: paymentMethods = [] } = useQuery<PaymentMethod[]>({
  queryKey: ['/api/account/payment-methods'],
});
```

## 🚨 Errores Comunes que Solo Aparecen en Producción

### 1. Código que funciona en dev pero falla en prod
**Causa**: Vite hace hot reloading y manejo de errores más permisivo en desarrollo

**Solución**: Siempre probar build de producción localmente:
```bash
npm run build
npm run start
```

### 2. Importaciones dinámicas
**Causa**: Diferencias en code splitting entre desarrollo y producción

**Solución**: 
- Usar `lazy()` de React correctamente
- No usar `import()` directamente en componentes sin manejo de errores
- Proporcionar fallbacks con `<Suspense>`

### 3. Variables de entorno
**Causa**: `process.env` puede no estar disponible en cliente

**Solución**: 
- Usar `import.meta.env` en código de cliente (Vite)
- Usar `process.env` solo en código de servidor

## 📝 Archivos Críticos a Revisar

Antes de cada deploy, revisar estos archivos si fueron modificados:

1. **client/src/components/DocumentPreviewModal.tsx**
   - Manejo de `blobUrl` y null checks
   - Configuración de PDF.js worker

2. **client/src/components/DocumentViewer.tsx**
   - Similar al anterior

3. **client/src/pages/admin-accounting.tsx**
   - OCR de PDFs
   - Conversión PDF a imagen

4. **vite.config.ts**
   - Configuración de build
   - Plugins activos

5. **tsconfig.json**
   - `strict: true` SIEMPRE
   - No deshabilitar checks de null

## 🔧 Comandos de Diagnóstico

### Encontrar archivos con tipos problemáticos
```bash
# Buscar usos de 'any'
grep -r ": any" client/src --include="*.tsx" --include="*.ts"

# Buscar asignaciones potencialmente peligrosas
grep -r "\.href = " client/src --include="*.tsx" --include="*.ts"
```

### Verificar dependencias desactualizadas
```bash
npm outdated
```

## 📦 Dependencias Críticas

Versiones actuales (verificar compatibilidad antes de actualizar):

- `react-pdf`: ^10.3.0
- `pdfjs-dist`: 5.4.296 (debe coincidir con react-pdf)
- `typescript`: 5.6.3
- `vite`: ^5.4.19

**⚠️ IMPORTANTE**: Actualizar `react-pdf` puede requerir cambios en la configuración del worker.

## ✨ Checklist Final

Antes de hacer `git push` y deploy:

- [ ] `npm run check` sin errores
- [ ] `npm run build` exitoso
- [ ] Probado build de producción localmente (`npm run start`)
- [ ] Tests pasando (si existen)
- [ ] Cambios en `package.json` revisados
- [ ] Sin `console.log` innecesarios en código crítico
- [ ] Tipos TypeScript correctos (sin `any` sin justificar)
- [ ] Manejo correcto de null/undefined en código nuevo

## 🆘 Si Algo Falla en Producción

1. **Revisar logs del servidor**: Buscar stack traces específicos
2. **Probar build local**: `npm run build && npm run start`
3. **Verificar este documento**: ¿Se siguieron todos los pasos?
4. **Rollback si es crítico**: Volver a versión estable anterior
5. **Fix y verificar**: Corregir, hacer todas las verificaciones, y volver a deploy

---

**Última actualización**: 2026-01-08
**Responsable**: Mantener actualizado con cada incidente de producción
