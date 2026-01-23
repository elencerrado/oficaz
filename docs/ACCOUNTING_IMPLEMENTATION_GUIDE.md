# Guía de Implementación: Módulo de Contabilidad

## ✅ Completado

1. **Schema de base de datos** (`shared/schema.ts`)
   - ✅ `expenseCategories` - Categorías de gastos
   - ✅ `incomeCategories` - Categorías de ingresos
   - ✅ `expenses` - Gastos (empresa y empleados)
   - ✅ `incomes` - Ingresos
   - ✅ `expenseReceipts` - Tickets adjuntos a gastos
   - ✅ `incomeReceipts` - Tickets adjuntos a ingresos

2. **Migración SQL** (`migrations/0001_add_accounting_system.sql`)
   - ✅ Creación de tablas con índices
   - ✅ Categorías por defecto para cada empresa

3. **Addon definido** (`shared/addon-definitions.ts`)
   - ✅ Key: 'accounting'
   - ✅ Precio: 10€/mes
   - ✅ Icono: Calculator

## 📋 Pendiente de Implementar

### Tienda / Store: Catálogo, Precio y Verificación de Compra

Para que Contabilidad siga la lógica estándar de la tienda (catálogo, cálculo de precio y verificación de compra por admin), añade lo siguiente:

1. Catálogo de addons
   - Define el addon en `shared/addon-definitions.ts` (ya indicado):
     - `key: 'accounting'`
     - `priceMonthly: 10` (€/mes por admin)
     - `icon: 'Calculator'`
   - Exponer el catálogo vía API (si no existe aún):
     - `GET /api/store/addons` → devuelve lista de addons disponibles con precio y metadatos.

2. Cálculo estándar de precio (incremento por admin)
   - La tienda calcula el total mensual a partir de:
     - Plan base (si aplica) + número de admins + addons seleccionados.
   - Función recomendada en cliente (ejemplo TypeScript):
     ```ts
     type Addon = { key: string; priceMonthly: number };
     type PricingInput = { basePrice: number; adminCount: number; addons: Addon[] };
     export function calculateMonthlyPrice({ basePrice, adminCount, addons }: PricingInput) {
       const addonsTotal = addons.reduce((sum, a) => sum + a.priceMonthly * adminCount, 0);
       return Math.max(0, basePrice) + addonsTotal; // precio por mes
     }
     ```
   - Para Contabilidad: `priceMonthly = 10€ * número_de_admins` (se suma al plan base si existe).

3. Verificación de compra (admin/company)
   - Back-end: seguir patrón de `subscription.features` ya usado (ver `server/ai-handler.ts`).
     - `subscription.features.accounting === true` indica que el addon está comprado para la empresa.
     - Opcional: llevar cuenta de asientos/licencias por rol: `subscription.includedAdmins`, `extraAdmins`.
   - Middleware sugerido:
     ```ts
     function requireFeature(featureKey: string) {
       return async (req: AuthRequest, res: Response, next: NextFunction) => {
         const sub = await storage.getSubscriptionByCompanyId(req.user!.companyId);
         if (!sub || !(sub.features || {})[featureKey]) {
           return res.status(402).json({ message: 'Funcionalidad no comprada' });
         }
         next();
       };
     }
     // Ejemplo: proteger rutas de contabilidad
     app.use('/api/accounting', authenticateToken, requireRole(['admin','manager','employee']), requireFeature('accounting'));
     ```

4. Flujo de compra en tienda
   - API (ejemplo mínimo):
     - `POST /api/store/purchase` con `{ addonKey: 'accounting', seats: { admins: X } }`.
     - Back-end actualiza `subscription.features.accounting = true` y ajusta precio:
       ```ts
       await storage.updateCompanySubscription(companyId, {
         features: { ...sub.features, accounting: true },
         priceMonthly: calculateMonthlyPrice({ basePrice: sub.basePrice ?? 0, adminCount: seats.admins, addons: [...existingAddons, { key: 'accounting', priceMonthly: 10 }] })
       });
       ```
   - Respuesta: `{ success: true, subscription }`.

5. UI de tienda (cliente)
   - Catálogo: tarjeta del addon "Contabilidad" con precio por admin.
   - Botón dinámico:
     - Si `hasFeature('accounting')`: mostrar "Abrir Contabilidad" (navega a `/accounting`).
     - Si no: mostrar "Comprar" → abre modal de compra (selección de admins, resumen de precio) → llama a `POST /api/store/purchase`.
   - Gating de acceso (ya previsto):
     - `ProtectedRoute` con `requiresFeature="accounting"`.

6. Comprobación rápida (admin la tiene comprada)
   - Cliente: `featureCheck.hasFeature('accounting') && user?.role === 'admin'` → mostrar accesos y gestión.
   - Server: en cada endpoint del módulo, `requireFeature('accounting')` garantiza que la empresa del admin lo compró.

7. Auditoría y soporte
   - Registra compras en `subscriptionHistory` (si existe) con fecha, addon y variación de precio.
   - Expón status en `GET /api/account/trial-status` y `GET /api/store/status` para UI.

### 1. Backend - Rutas (`server/routes.ts`)

Añadir después de las rutas de inventario (línea ~18300):

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// ACCOUNTING SYSTEM ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// =============================================================================
// EXPENSE CATEGORIES
// =============================================================================

app.get('/api/accounting/expense-categories', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
  try {
    const categories = await db.select()
      .from(schema.expenseCategories)
      .where(eq(schema.expenseCategories.companyId, req.user!.companyId))
      .orderBy(schema.expenseCategories.sortOrder);
    res.json(categories);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/accounting/expense-categories', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
  try {
    const [category] = await db.insert(schema.expenseCategories)
      .values({ ...req.body, companyId: req.user!.companyId })
      .returning();
    res.json(category);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.patch('/api/accounting/expense-categories/:id', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
  try {
    const [category] = await db.update(schema.expenseCategories)
      .set({ ...req.body, updatedAt: new Date() })
      .where(and(
        eq(schema.expenseCategories.id, parseInt(req.params.id)),
        eq(schema.expenseCategories.companyId, req.user!.companyId)
      ))
      .returning();
    if (!category) return res.status(404).json({ message: 'Categoría no encontrada' });
    res.json(category);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/accounting/expense-categories/:id', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
  try {
    await db.delete(schema.expenseCategories)
      .where(and(
        eq(schema.expenseCategories.id, parseInt(req.params.id)),
        eq(schema.expenseCategories.companyId, req.user!.companyId)
      ));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// =============================================================================
// INCOME CATEGORIES (similar to expense categories)
// =============================================================================

app.get('/api/accounting/income-categories', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
  try {
    const categories = await db.select()
      .from(schema.incomeCategories)
      .where(eq(schema.incomeCategories.companyId, req.user!.companyId))
      .orderBy(schema.incomeCategories.sortOrder);
    res.json(categories);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// ... (POST, PATCH, DELETE similar to expense categories)

// =============================================================================
// EXPENSES
// =============================================================================

app.get('/api/accounting/expenses', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate, status, categoryId, employeeId } = req.query;
    const userRole = req.user!.role;
    const userId = req.user!.id;
    const companyId = req.user!.companyId;
    
    let query = db.select({
      expense: schema.expenses,
      category: schema.expenseCategories,
      submittedBy: {
        id: schema.users.id,
        fullName: schema.users.fullName,
        profilePicture: schema.users.profilePicture
      },
      employee: sql`CASE 
        WHEN ${schema.expenses.employeeId} IS NOT NULL 
        THEN json_build_object('id', emp.id, 'fullName', emp.full_name, 'profilePicture', emp.profile_picture)
        ELSE NULL 
      END`.as('employee'),
      receiptsCount: sql<number>`(
        SELECT COUNT(*)::int 
        FROM ${schema.expenseReceipts} 
        WHERE ${schema.expenseReceipts.expenseId} = ${schema.expenses.id}
      )`.as('receipts_count')
    })
    .from(schema.expenses)
    .leftJoin(schema.expenseCategories, eq(schema.expenses.categoryId, schema.expenseCategories.id))
    .leftJoin(schema.users, eq(schema.expenses.submittedBy, schema.users.id))
    .leftJoin(sql`users emp`, sql`${schema.expenses.employeeId} = emp.id`)
    .where(eq(schema.expenses.companyId, companyId));
    
    // Employees only see their own expenses
    if (userRole === 'employee') {
      query = query.where(eq(schema.expenses.employeeId, userId));
    }
    
    // Filters
    if (startDate) {
      query = query.where(gte(schema.expenses.expenseDate, startDate as string));
    }
    if (endDate) {
      query = query.where(lte(schema.expenses.expenseDate, endDate as string));
    }
    if (status) {
      query = query.where(eq(schema.expenses.status, status as string));
    }
    if (categoryId) {
      query = query.where(eq(schema.expenses.categoryId, parseInt(categoryId as string)));
    }
    if (employeeId && userRole !== 'employee') {
      query = query.where(eq(schema.expenses.employeeId, parseInt(employeeId as string)));
    }
    
    const expenses = await query.orderBy(desc(schema.expenses.expenseDate));
    res.json(expenses);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/accounting/expenses/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const expenseId = parseInt(req.params.id);
    const userRole = req.user!.role;
    const userId = req.user!.id;
    
    const [expense] = await db.select({
      expense: schema.expenses,
      category: schema.expenseCategories,
      submittedBy: schema.users,
      receipts: sql`(
        SELECT json_agg(
          json_build_object(
            'id', ${schema.expenseReceipts.id},
            'fileName', ${schema.expenseReceipts.fileName},
            'filePath', ${schema.expenseReceipts.filePath},
            'fileSize', ${schema.expenseReceipts.fileSize},
            'mimeType', ${schema.expenseReceipts.mimeType},
            'uploadedAt', ${schema.expenseReceipts.uploadedAt}
          )
        )
        FROM ${schema.expenseReceipts}
        WHERE ${schema.expenseReceipts.expenseId} = ${schema.expenses.id}
      )`.as('receipts')
    })
    .from(schema.expenses)
    .leftJoin(schema.expenseCategories, eq(schema.expenses.categoryId, schema.expenseCategories.id))
    .leftJoin(schema.users, eq(schema.expenses.submittedBy, schema.users.id))
    .where(and(
      eq(schema.expenses.id, expenseId),
      eq(schema.expenses.companyId, req.user!.companyId)
    ));
    
    if (!expense) {
      return res.status(404).json({ message: 'Gasto no encontrado' });
    }
    
    // Employees can only view their own expenses
    if (userRole === 'employee' && expense.expense.employeeId !== userId) {
      return res.status(403).json({ message: 'No tienes permiso para ver este gasto' });
    }
    
    res.json(expense);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Multer configuration for receipt uploads
const receiptUpload = multer({
  dest: uploadDir,
  limits: { 
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'image/png', 
      'image/jpeg',
      'image/jpg',
      'image/webp'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Solo PDF e imágenes.'));
    }
  }
});

app.post('/api/accounting/expenses', authenticateToken, receiptUpload.array('receipts', 5), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const companyId = req.user!.companyId;
    const data = JSON.parse(req.body.data || '{}');
    
    // Employees can only create expenses for themselves
    if (userRole === 'employee') {
      data.employeeId = userId;
    }
    
    // Calculate total amount
    const amount = parseFloat(data.amount);
    const vatAmount = parseFloat(data.vatAmount || 0);
    data.totalAmount = amount + vatAmount;
    data.submittedBy = userId;
    data.companyId = companyId;
    
    // Create expense
    const [expense] = await db.insert(schema.expenses)
      .values(data)
      .returning();
    
    // Upload receipts
    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files) {
        const receipt = await db.insert(schema.expenseReceipts)
          .values({
            expenseId: expense.id,
            fileName: file.originalname,
            filePath: `/uploads/${path.basename(file.path)}`,
            fileSize: file.size,
            mimeType: file.mimetype,
            uploadedBy: userId
          })
          .returning();
      }
    }
    
    res.json(expense);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.patch('/api/accounting/expenses/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const expenseId = parseInt(req.params.id);
    const userRole = req.user!.role;
    const userId = req.user!.id;
    
    // Check permissions
    const [existing] = await db.select()
      .from(schema.expenses)
      .where(and(
        eq(schema.expenses.id, expenseId),
        eq(schema.expenses.companyId, req.user!.companyId)
      ));
    
    if (!existing) {
      return res.status(404).json({ message: 'Gasto no encontrado' });
    }
    
    // Employees can only edit their own pending expenses
    if (userRole === 'employee' && (existing.employeeId !== userId || existing.status !== 'pending')) {
      return res.status(403).json({ message: 'No puedes editar este gasto' });
    }
    
    const [expense] = await db.update(schema.expenses)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(schema.expenses.id, expenseId))
      .returning();
    
    res.json(expense);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Approve/Reject expense (admin/manager only)
app.post('/api/accounting/expenses/:id/review', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
  try {
    const { status, reviewNotes } = req.body; // 'approved' or 'rejected'
    
    const [expense] = await db.update(schema.expenses)
      .set({
        status,
        reviewedBy: req.user!.id,
        reviewedAt: new Date(),
        reviewNotes,
        updatedAt: new Date()
      })
      .where(and(
        eq(schema.expenses.id, parseInt(req.params.id)),
        eq(schema.expenses.companyId, req.user!.companyId)
      ))
      .returning();
    
    res.json(expense);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/accounting/expenses/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const expenseId = parseInt(req.params.id);
    const userRole = req.user!.role;
    const userId = req.user!.id;
    
    // Check permissions
    const [existing] = await db.select()
      .from(schema.expenses)
      .where(and(
        eq(schema.expenses.id, expenseId),
        eq(schema.expenses.companyId, req.user!.companyId)
      ));
    
    if (!existing) {
      return res.status(404).json({ message: 'Gasto no encontrado' });
    }
    
    // Employees can only delete their own pending expenses
    if (userRole === 'employee' && (existing.employeeId !== userId || existing.status !== 'pending')) {
      return res.status(403).json({ message: 'No puedes eliminar este gasto' });
    }
    
    // Delete receipt files
    const receipts = await db.select()
      .from(schema.expenseReceipts)
      .where(eq(schema.expenseReceipts.expenseId, expenseId));
    
    for (const receipt of receipts) {
      const filePath = path.join(uploadDir, path.basename(receipt.filePath));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    await db.delete(schema.expenses)
      .where(eq(schema.expenses.id, expenseId));
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// =============================================================================
// INCOMES (similar structure to expenses but simpler - no employee tracking)
// =============================================================================

app.get('/api/accounting/incomes', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
  // Similar to expenses GET but no employee filtering
});

app.post('/api/accounting/incomes', authenticateToken, requireRole(['admin', 'manager']), receiptUpload.array('receipts', 5), async (req: AuthRequest, res) => {
  // Similar to expenses POST
});

// ... (other income routes)

// =============================================================================
// DASHBOARD & STATS
// =============================================================================

app.get('/api/accounting/dashboard', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
  try {
    const companyId = req.user!.companyId;
    const { startDate, endDate } = req.query;
    
    // Total expenses
    const [totalExpenses] = await db.select({
      total: sql<number>`COALESCE(SUM(${schema.expenses.totalAmount}), 0)`.as('total'),
      count: sql<number>`COUNT(*)::int`.as('count')
    })
    .from(schema.expenses)
    .where(and(
      eq(schema.expenses.companyId, companyId),
      startDate ? gte(schema.expenses.expenseDate, startDate as string) : undefined,
      endDate ? lte(schema.expenses.expenseDate, endDate as string) : undefined
    ));
    
    // Total incomes
    const [totalIncomes] = await db.select({
      total: sql<number>`COALESCE(SUM(${schema.incomes.totalAmount}), 0)`.as('total'),
      count: sql<number>`COUNT(*)::int`.as('count')
    })
    .from(schema.incomes)
    .where(and(
      eq(schema.incomes.companyId, companyId),
      startDate ? gte(schema.incomes.incomeDate, startDate as string) : undefined,
      endDate ? lte(schema.incomes.incomeDate, endDate as string) : undefined
    ));
    
    // Pending expenses (employee submissions)
    const [pendingExpenses] = await db.select({
      count: sql<number>`COUNT(*)::int`.as('count'),
      total: sql<number>`COALESCE(SUM(${schema.expenses.totalAmount}), 0)`.as('total')
    })
    .from(schema.expenses)
    .where(and(
      eq(schema.expenses.companyId, companyId),
      eq(schema.expenses.status, 'pending')
    ));
    
    // Expenses by category
    const expensesByCategory = await db.select({
      categoryId: schema.expenses.categoryId,
      categoryName: schema.expenseCategories.name,
      categoryColor: schema.expenseCategories.color,
      total: sql<number>`SUM(${schema.expenses.totalAmount})`.as('total'),
      count: sql<number>`COUNT(*)::int`.as('count')
    })
    .from(schema.expenses)
    .leftJoin(schema.expenseCategories, eq(schema.expenses.categoryId, schema.expenseCategories.id))
    .where(and(
      eq(schema.expenses.companyId, companyId),
      startDate ? gte(schema.expenses.expenseDate, startDate as string) : undefined,
      endDate ? lte(schema.expenses.expenseDate, endDate as string) : undefined
    ))
    .groupBy(schema.expenses.categoryId, schema.expenseCategories.name, schema.expenseCategories.color);
    
    res.json({
      totalExpenses: {
        amount: totalExpenses.total,
        count: totalExpenses.count
      },
      totalIncomes: {
        amount: totalIncomes.total,
        count: totalIncomes.count
      },
      balance: totalIncomes.total - totalExpenses.total,
      pendingExpenses: {
        count: pendingExpenses.count,
        amount: pendingExpenses.total
      },
      expensesByCategory,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});
```

### 2. Frontend - Páginas

#### Crear `client/src/pages/accounting.tsx` (Admin/Manager)

Estructura principal:
- Dashboard con gráficos (Chart.js/Recharts)
- Tabs: Dashboard | Gastos | Ingresos | Categorías
- Filtros por fecha, categoría, empleado
- Tabla de gastos/ingresos
- Dialogs para crear/editar
- Vista detalle con tickets adjuntos
- Aprobar/Rechazar gastos de empleados
- Exportar a Excel/PDF

#### Crear `client/src/pages/employee-expenses.tsx` (Employees)

Funcionalidad:
- Formulario simple para subir gasto
- Upload de foto del ticket
- Campos: fecha, importe, IVA, concepto, categoría
- Mis gastos (lista)
- Estado: pendiente, aprobado, rechazado
- No puede editar/eliminar gastos aprobados

### 3. Sidebar Navigation

Añadir en `client/src/components/layout/AppLayout.tsx`:

```tsx
{featureCheck.hasFeature('accounting') && (
  <>
    {/* Admin/Manager */}
    {(user?.role === 'admin' || user?.role === 'manager') && (
      <SidebarNavItem
        to="/accounting"
        icon={Calculator}
        label="Contabilidad"
      />
    )}
    {/* Employee */}
    {user?.role === 'employee' && (
      <SidebarNavItem
        to="/employee-expenses"
        icon={Receipt}
        label="Mis Gastos"
      />
    )}
  </>
)}
```

### 4. Rutas

Añadir en `client/src/App.tsx`:

```tsx
// Admin/Manager
<Route path="/accounting" element={
  <ProtectedRoute 
    element={<AccountingPage />} 
    requiredRoles={['admin', 'manager']}
    requiresFeature="accounting"
  />
} />

// Employee
<Route path="/employee-expenses" element={
  <ProtectedRoute 
    element={<EmployeeExpensesPage />} 
    requiredRoles={['employee']}
    requiresFeature="accounting"
  />
} />
```

### 5. Migraciones

Ejecutar migración SQL:

```bash
psql $DATABASE_URL < migrations/0001_add_accounting_system.sql
```

### 6. Feature Check

Añadir en `client/src/hooks/use-features.ts`:

```tsx
hasFeature: (key: string) => {
  // ... existing logic
  if (key === 'accounting') {
    return enabledFeatures.has('accounting');
  }
}
```

## 📊 Componentes Principales

### Dashboard Stats
- Total gastos del mes
- Total ingresos del mes
- Balance (ingresos - gastos)
- Gastos pendientes de aprobar
- Gráfico de gastos por categoría
- Gráfico de evolución temporal

### Tabla de Gastos
- Filtros: fecha inicio/fin, categoría, empleado, estado
- Columnas: Fecha, Concepto, Categoría, Empleado, Importe, Estado, Acciones
- Acciones: Ver detalle, Editar, Eliminar, Aprobar/Rechazar
- Paginación

### Formulario de Gasto/Ingreso
- Campo concepto (obligatorio)
- Descripción (opcional)
- Fecha (date picker)
- Categoría (select)
- Importe (number)
- IVA (number, default 21%)
- Total (calculado automático)
- Método de pago (select)
- Número factura (text)
- Proveedor/Cliente (text)
- Upload de tickets (drag & drop + click)
- Vista previa de imágenes
- Notas

### Gestión de Categorías
- Crear/Editar categoría
- Campos: nombre, descripción, color, icono
- Ordenar (drag & drop)
- Activar/Desactivar

## 🎨 Estética

Seguir el patrón de inventario:
- Cards con StatsCardGrid
- TabNavigation para secciones
- Dialogs de Shadcn UI
- Tablas con hover states
- Badges para estados (pending=yellow, approved=green, rejected=red)
- Loading spinners
- Toast notifications
- Responsive design

## 🔐 Permisos

### Admin/Manager
- ✅ Ver todos los gastos/ingresos
- ✅ Crear gastos/ingresos de empresa
- ✅ Aprobar/Rechazar gastos de empleados
- ✅ Editar/Eliminar cualquier registro
- ✅ Gestionar categorías
- ✅ Ver dashboard completo
- ✅ Exportar datos

### Employee
- ✅ Ver solo sus gastos
- ✅ Crear gastos propios con ticket
- ✅ Editar solo gastos pendientes
- ✅ Eliminar solo gastos pendientes
- ❌ No puede ver ingresos
- ❌ No puede aprobar gastos
- ❌ No puede ver gastos de otros

## 📱 Características Adicionales

1. **Notificaciones Push**: Cuando admin aprueba/rechaza gasto
2. **Exportar Excel**: Listado de gastos/ingresos con filtros
3. **Exportar PDF**: Informe contable con gráficos
4. **Búsqueda**: Por concepto, proveedor, número factura
5. **Filtros avanzados**: Rango de fechas, categorías múltiples
6. **Comentarios**: Admin puede dejar notas al aprobar/rechazar

## ⏱️ Estimación de Tiempo

- Backend (routes + storage): 8-10 horas
- Frontend Admin (accounting.tsx): 12-15 horas
- Frontend Employee (employee-expenses.tsx): 6-8 horas
- Componentes compartidos: 4-6 horas
- Testing y ajustes: 6-8 horas
- **Total**: ~40-50 horas de desarrollo

## 🚀 Orden de Implementación Recomendado

1. ✅ Schema + Migración (completado)
2. ✅ Addon definido (completado)
3. Backend - Expense categories
4. Backend - Income categories  
5. Backend - Expenses (sin uploads)
6. Backend - Upload receipts
7. Backend - Incomes
8. Backend - Dashboard stats
9. Frontend - Página admin (vista básica)
10. Frontend - CRUD gastos
11. Frontend - Upload de tickets
12. Frontend - Aprobación de gastos
13. Frontend - CRUD ingresos
14. Frontend - Dashboard con gráficos
15. Frontend - Página employee
16. Sidebar + Routes
17. Permisos + Feature checks
18. Testing completo
19. Refinamiento UI/UX

## 📝 Notas Importantes

- **Validación**: Todos los endpoints validan companyId
- **Security**: Employees solo ven sus datos
- **Files**: Almacenar receipts en `/uploads` con cleanup al eliminar
- **Timestamps**: Usar timezone de España para fechas
- **Currency**: Por defecto EUR, preparado para multi-moneda
- **VAT**: IVA por defecto 21% (España), editable
- **Status Flow**: 
  - Gastos: pending → approved/rejected → paid
  - Ingresos: pending → received
- **Soft Delete**: Considerar en lugar de eliminar (auditoría)
