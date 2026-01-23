# Análisis: Estructura de IVA en Movimientos Contables

## Estado ACTUAL de los Movimientos

### ✅ Lo que SÍ existe:
```typescript
// shared/schema.ts - accountingEntries
{
  amount: decimal(10, 2)          // Importe base (sin IVA)
  vatAmount: decimal(10, 2)       // IVA calculado
  totalAmount: decimal(10, 2)     // Total (base + IVA)
  currency: varchar
  type: 'expense' | 'income'
}
```

### ❌ Lo que FALTA para cumplir fiscalidad española:

1. **vatRate** - Tasa aplicada (21%, 10%, 4%, 0%)
   - Necesario para: calcular rectificaciones, auditar, generar 303
   
2. **baseAmount** - Base imponible (sin IVA)
   - Actualmente: `amount` asume ser base, pero no está explícito
   - Problema: confusión si amount es base o total
   
3. **vatType** - Clasificación fiscal
   - `repercutido` = IVA cobrado en ventas (income)
   - `soportado` = IVA pagado en compras (expense)
   - `exento` = sin IVA (algunos servicios)
   - `no_sujeto` = fuera de IVA (exportaciones, etc)
   
4. **fiscalDeductible** - ¿Es IVA deducible?
   - Algunos gastos: no deducible (comidas, viajes, etc)
   - Importante para cálculo 303

## PROPUESTA: Migración Mínima

### Opción 1: RECOMENDADA - Ampliar tabla actual
```sql
ALTER TABLE accounting_entries ADD COLUMN IF NOT EXISTS vat_rate DECIMAL(5,2) DEFAULT 21;
ALTER TABLE accounting_entries ADD COLUMN IF NOT EXISTS base_amount DECIMAL(10,2);
ALTER TABLE accounting_entries ADD COLUMN IF NOT EXISTS vat_type VARCHAR(20) DEFAULT 'soportado';
ALTER TABLE accounting_entries ADD COLUMN IF NOT EXISTS fiscal_deductible BOOLEAN DEFAULT true;

-- Crear índice para búsquedas rápidas de liquidación
CREATE INDEX IF NOT EXISTS accounting_entries_vat_idx 
  ON accounting_entries(company_id, entry_date, vat_type, vat_rate);
```

### Opción 2: Tabla separada (más escalable)
```sql
-- Tabla de detalles fiscales por movimiento
CREATE TABLE IF NOT EXISTS accounting_entry_tax_details (
  id SERIAL PRIMARY KEY,
  entry_id INTEGER NOT NULL REFERENCES accounting_entries(id) ON DELETE CASCADE,
  vat_rate DECIMAL(5,2) NOT NULL,        -- 21.00, 10.00, 4.00, 0.00
  base_amount DECIMAL(10,2) NOT NULL,
  vat_type VARCHAR(20) NOT NULL,         -- repercutido, soportado, exento, no_sujeto
  fiscal_deductible BOOLEAN DEFAULT true,
  tax_code VARCHAR(20),                  -- Código impuesto (IGI-21, IGI-10, etc)
  created_at TIMESTAMP DEFAULT NOW()
);
```

## CAMPOS RECOMENDADOS PARA IMPLEMENTAR (FASE 1)

```typescript
// shared/schema.ts - accountingEntries
export const accountingEntries = pgTable("accounting_entries", {
  // ... campos existentes ...
  
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),        // ✅ Ya existe
  vatAmount: decimal("vat_amount", { precision: 10, scale: 2 }).notNull(), // ✅ Ya existe
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(), // ✅ Ya existe
  
  // NUEVOS - Fiscales
  vatRate: decimal("vat_rate", { precision: 5, scale: 2 })
    .default("21.00")
    .notNull(), // 21.00, 10.00, 4.00, 0.00
  
  baseAmount: decimal("base_amount", { precision: 10, scale: 2 }),
    // Igual a amount pero explícito. Importante para auditoría
    // Si NULL: calcular como amount
  
  vatType: varchar("vat_type", { length: 20 })
    .default("soportado")
    .notNull(), // 'soportado' | 'repercutido' | 'exento' | 'no_sujeto'
  
  fiscalDeductible: boolean("fiscal_deductible")
    .default(true)
    .notNull(), // ¿IVA es deducible?
});
```

## VALORES POR DEFECTO (España)

```typescript
// Según tipo de movimiento
if (type === 'income') {
  vatRate = 21.00;      // Ingresos normalmente al 21%
  vatType = 'repercutido'; // IVA cobrado
  fiscalDeductible = false; // El IVA de ingresos NO es deducible
}

if (type === 'expense') {
  vatRate = 21.00;      // Gastos normalmente al 21%
  vatType = 'soportado'; // IVA soportado
  fiscalDeductible = true; // El IVA de gastos SÍ es deducible (casi siempre)
}
```

## VALIDACIONES IMPORTANTES

```typescript
// 1. Coherencia entre amount, vatAmount, totalAmount
if (Math.abs(totalAmount - (baseAmount + vatAmount)) > 0.01) {
  throw new Error('La suma base + IVA no coincide con el total');
}

// 2. vatAmount debe coincidir con cálculo
const calculatedVat = baseAmount * (vatRate / 100);
if (Math.abs(vatAmount - calculatedVat) > 0.01) {
  throw new Error('El IVA no coincide con el cálculo');
}

// 3. Un gasto con IVA no deducible NO se usa para 303
if (type === 'expense' && !fiscalDeductible && vatType === 'soportado') {
  // No incluir en liquidación 303
}
```

## IMPACTO EN FISCALIDAD (303)

### Cálculo Liquidación Trimestral:
```
IVA REPERCUTIDO (income + vatType='repercutido'):
  SUM(vatAmount) = total IVA cobrado en ventas

IVA SOPORTADO DEDUCIBLE (expense + vatType='soportado' + fiscalDeductible=true):
  SUM(vatAmount) = total IVA pagado en compras deducible

LIQUIDACIÓN = IVA Repercutido - IVA Soportado Deducible
  └─ Si > 0: empresa paga a Hacienda
  └─ Si < 0: Hacienda devuelve (solicitud devolución)
```

## CRONOGRAMA SUGERIDO

### FASE 1 (AHORA):
- ✅ Agregar campos vatRate, baseAmount, vatType, fiscalDeductible a tabla
- ✅ Migración: asignar valores por defecto según tipo
- ✅ Validación: check de coherencia en inserts/updates
- ✅ Documentación: guía para usuarios

### FASE 2 (PRÓXIMAS SEMANAS):
- 🔨 UI: selector de IVA al crear movimiento
- 🔨 UI: mostrar desglose Base | IVA | Total
- 🔨 Reporte: Tab Fiscalidad con cálculo 303

### FASE 3 (FUTURO):
- 📅 Exportar 303 XML para Hacienda
- 📅 Historial de declaraciones
- 📅 Alertas de vencimientos

## REFERENCIAS

### IVA en España (2024):
- 21% = Tasa normal (mayoría)
- 10% = Tasa reducida (restauración, viajes, alojamiento)
- 4% = Tasa superreducida (alimentos básicos)
- 0% = Exento (exportaciones, servicios financieros)

### Modelo 303:
- Presentación: trimestral (mes siguiente a fin de trimestre)
- Último trimestre: normalmente vencimiento el 20 de febrero año siguiente
- Rectificaciones: modelo 303-R dentro de 4 años

### Modelo 390:
- Presentación: anual (enero de año siguiente)
- Resumen anual del IVA declarado en 303s
- Imprescindible para cierre fiscal
