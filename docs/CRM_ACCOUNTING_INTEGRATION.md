# CRM Integration for Accounting Entries - Deployment Notes

## Summary
Added CRM client/supplier assignment to accounting movements. Users can now:
- Select a client (for income transactions) or supplier (for expense transactions)
- Clients/suppliers are filtered from those assigned to the selected project
- Data is persisted to the database and can be edited later

## Database Changes Required
A new migration has been created: `0028_add_crm_client_supplier_to_accounting.sql`

### Option 1: Using Drizzle Kit (Recommended - if no other schema changes pending)
```bash
npm run db:push
# or if using Drizzle Kit directly:
drizzle-kit push
```

**Note**: If Drizzle asks about truncating tables or data loss, ABORT and use Option 2 instead.

### Option 2: Manual SQL Execution (If Drizzle conflicts detected)
Execute the SQL directly in your database:

```sql
ALTER TABLE accounting_entries
ADD COLUMN crm_client_id INTEGER REFERENCES business_contacts(id) ON DELETE SET NULL,
ADD COLUMN crm_supplier_id INTEGER REFERENCES business_contacts(id) ON DELETE SET NULL;

CREATE INDEX accounting_entries_crm_client_idx ON accounting_entries(crm_client_id);
CREATE INDEX accounting_entries_crm_supplier_idx ON accounting_entries(crm_supplier_id);
```

Or use the provided Node.js script (when DATABASE_URL is available):
```bash
node run-accounting-crm-migration.js
```

## What Changed

### Frontend (client/src/pages/admin-accounting.tsx)
1. **AccountingEntry Interface**: Added optional fields:
   - `crmClientId?: number | null`
   - `crmSupplierId?: number | null`

2. **Form State**: Added field management for:
   - `crmClientId: null`
   - `crmSupplierId: null`

3. **Projects Mapping**: Enhanced to include:
   ```tsx
   clients: p.clients || []
   suppliers: p.providers || []
   ```

4. **New UI Section**: Conditional select dropdown that shows:
   - Only when CRM addon is active
   - Only when a project is selected
   - Label: "Cliente (opcional)" for income, "Proveedor (opcional)" for expense
   - Options filtered from the selected project's clients/suppliers

5. **Form Submission**: Updated `handleSubmitEntry` to include:
   - `crmClientId: entryForm.crmClientId || null`
   - `crmSupplierId: entryForm.crmSupplierId || null`

### Database Schema (shared/schema.ts)
Added two new columns to `accountingEntries` table definition:
- `crmClientId: integer("crm_client_id").references(() => businessContacts.id, { onDelete: "set null" })`
- `crmSupplierId: integer("crm_supplier_id").references(() => businessContacts.id, { onDelete: "set null" })`

### Database Migration (migrations/0028_*.sql)
Creates the two new columns with proper indexes for query performance and foreign key constraints

## User Flow
1. User opens "Nuevo Movimiento" modal
2. Selects transaction type (income/expense)
3. Selects a project
4. If CRM addon active: Client/Supplier dropdown appears with filtered options
5. User optionally selects a client (for income) or supplier (for expense)
6. On save: Data is persisted with the CRM contact reference
7. On edit: Previous selection is loaded and displayed

## Testing Checklist
- [ ] Execute migration successfully
- [ ] Create new income entry with client selection
- [ ] Create new expense entry with supplier selection
- [ ] Verify data saves correctly to database
- [ ] Edit existing entry and verify CRM data loads
- [ ] Verify dropdown only shows when:
  - CRM addon is active
  - Project is selected
  - Project has clients (for income) or suppliers (for expense)
- [ ] Verify "Sin cliente/proveedor" option works (null value)
- [ ] Test mobile view rendering

## Notes
- Fields are optional - entries can be created without selecting a client/supplier
- If a project is removed, entries retain their CRM client/supplier reference
- If a CRM contact is removed, the field is set to null (onDelete: "set null")
- Backend automatically handles the new fields (no API changes needed)
- The columns reference `business_contacts` table (CRM contacts)
