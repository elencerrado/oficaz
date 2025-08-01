import { pgTable, text, serial, integer, boolean, timestamp, decimal, varchar, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Companies table - consolidada con configuraciones y datos de facturación
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  cif: text("cif").notNull().unique(),
  email: text("email").notNull().unique(),
  contactName: text("contact_name").notNull(),
  companyAlias: text("company_alias").notNull().unique(),
  phone: text("phone"),
  address: text("address"),
  province: text("province"),
  // employeeTimeEditPermission migrado a tabla features como 'employee_time_edit_permission'
  workingHoursPerDay: integer("working_hours_per_day").default(8),
  defaultVacationDays: integer("default_vacation_days").default(30),
  vacationDaysPerMonth: decimal("vacation_days_per_month", { precision: 3, scale: 1 }).default("2.5"),
  logoUrl: text("logo_url"),
  // Campos migrados desde company_configs
  workingHoursStart: text("working_hours_start").default("08:00").notNull(),
  workingHoursEnd: text("working_hours_end").default("17:00").notNull(),
  workingDays: integer("working_days").array().default([1, 2, 3, 4, 5]).notNull(),
  payrollSendDays: text("payroll_send_days").default("1").notNull(),
  defaultVacationPolicy: decimal("default_vacation_policy", { precision: 3, scale: 1 }).default("2.5").notNull(),
  language: text("language").default("es").notNull(),
  timezone: text("timezone").default("Europe/Madrid").notNull(),
  customAiRules: text("custom_ai_rules").default(""),
  allowManagersToGrantRoles: boolean("allow_managers_to_grant_roles").default(false).notNull(),
  // Campos migrados desde account_info (datos de facturación)
  accountId: text("account_id").unique(), // OFZ-2024-001234 format
  billingPostalCode: text("billing_postal_code"),
  billingCountry: text("billing_country").default("ES"),
  
  // Plan y features personalizadas por empresa
  plan: varchar("plan", { length: 50 }).notNull().default("basic"), // basic, pro, master
  customFeatures: jsonb("custom_features").default('{}'), // {messages: true, documents: false, etc}
  
  // Datos de prueba
  hasDemoData: boolean("has_demo_data").default(false).notNull(),
  
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});



// Super admin table for platform owner
export const superAdmins = pgTable("super_admins", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  password: varchar("password", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Features table - cada funcionalidad es una fila independiente
export const features = pgTable("features", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 50 }).notNull().unique(), // messages, documents, vacation, etc
  name: varchar("name", { length: 100 }).notNull(), // "Mensajería interna", "Gestión de documentos", etc
  description: text("description"), // Descripción detallada de la funcionalidad
  category: varchar("category", { length: 50 }).notNull(), // "communication", "management", "admin", etc
  
  // Habilitación por plan - columnas directas para cada plan
  basicEnabled: boolean("basic_enabled").notNull().default(false),
  proEnabled: boolean("pro_enabled").notNull().default(false),
  masterEnabled: boolean("master_enabled").notNull().default(false),
  
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tabla planFeatures eliminada - ahora usamos columnas directas en features (basicEnabled, proEnabled, masterEnabled)

// Tabla company_features eliminada - ahora usamos companies.customFeatures

// Subscription plans configuration - sin columna features (movida a planFeatures)
export const subscriptionPlans = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull(), // Basic, Pro, Master
  displayName: varchar("display_name", { length: 100 }).notNull(),
  pricePerUser: decimal("price_per_user", { precision: 10, scale: 2 }).notNull(), // Precio fijo mensual (ej: 29.99 euros/mes)
  maxUsers: integer("max_users"), // null = unlimited
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Company subscriptions - dates are calculated from companies.created_at
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id, { onDelete: "cascade" }).unique().notNull(),
  plan: varchar("plan", { length: 50 }).notNull(), // free, basic, pro, master
  currentEffectivePlan: varchar("current_effective_plan", { length: 50 }), // Plan actual con características activas hasta próximo ciclo
  nextPlan: varchar("next_plan", { length: 50 }), // Plan que se activará en el próximo ciclo de facturación
  planChangeDate: timestamp("plan_change_date"), // Fecha cuando se efectuará el cambio de plan
  status: varchar("status", { length: 50 }).default("trial").notNull(), // trial, active, inactive, suspended, blocked
  endDate: timestamp("end_date"),
  isTrialActive: boolean("is_trial_active").default(true).notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  firstPaymentDate: timestamp("first_payment_date"),
  nextPaymentDate: timestamp("next_payment_date"),
  maxUsers: integer("max_users").default(5).notNull(),
  useCustomSettings: boolean("use_custom_settings").default(false).notNull(),
  customPricePerUser: decimal("custom_price_per_user", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tabla account_info eliminada - campos consolidados en companies

// Payment methods
export const paymentMethods = pgTable("payment_methods", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  stripePaymentMethodId: text("stripe_payment_method_id").notNull(),
  type: text("type").notNull(), // card, bank_transfer, etc
  cardBrand: text("card_brand"), // visa, mastercard, etc
  cardLastFour: text("card_last_four"), // last 4 digits
  cardExpMonth: integer("card_exp_month"),
  cardExpYear: integer("card_exp_year"),
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Invoices and billing history
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  invoiceNumber: text("invoice_number").notNull().unique(), // OFZ-2024-12-001
  stripeInvoiceId: text("stripe_invoice_id"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("EUR"),
  status: text("status").notNull(), // paid, pending, failed, cancelled
  dueDate: timestamp("due_date"),
  paidAt: timestamp("paid_at"),
  description: text("description"),
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  downloadUrl: text("download_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Usage statistics
export const usageStats = pgTable("usage_stats", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  month: integer("month").notNull(), // 1-12
  year: integer("year").notNull(),
  employeeCount: integer("employee_count").default(0),
  activeEmployees: integer("active_employees").default(0),
  timeEntriesCount: integer("time_entries_count").default(0),
  documentsUploaded: integer("documents_uploaded").default(0),
  storageUsedMB: decimal("storage_used_mb", { precision: 10, scale: 2 }).default("0"),
  apiCalls: integer("api_calls").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Registration settings for invitation-only mode
export const registrationSettings = pgTable("registration_settings", {
  id: serial("id").primaryKey(),
  publicRegistrationEnabled: boolean("public_registration_enabled").default(true).notNull(),
  invitationOnlyMode: boolean("invitation_only_mode").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Invitation links for restricted registration
export const invitationLinks = pgTable("invitation_links", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  used: boolean("used").default(false).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdBy: integer("created_by").references(() => superAdmins.id).notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Users table
export const users = pgTable("users", { 
  // Identificación y acceso
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  fullName: text("full_name").notNull(), // Lo escribe admin/manager
  dni: text("dni").notNull().unique(), // Lo escribe admin/manager
  role: text("role").notNull().default("employee"), // admin, manager, employee - Lo da admin/manager
  personalEmail: text("personal_email"), // Lo escribe el empleado
  companyEmail: text("company_email").notNull().unique(), // Lo introduce admin/manager
  personalPhone: text("personal_phone"), // Lo escribe el empleado
  companyPhone: text("company_phone"), // Lo introduce admin/manager
  password: text("password").notNull(), // Encriptada
  
  // Datos laborales
  position: text("position"), // Lo introduce admin/manager (cargo/puesto)
  startDate: timestamp("start_date").notNull(), // Lo introduce admin/manager
  status: text("status").notNull().default("active"), // active, inactive, on_leave, on_vacation - Lo introduce admin/manager
  isActive: boolean("is_active").notNull().default(true), // Lo introduce admin/manager
  createdBy: integer("created_by"), // Automático (admin o manager)
  
  // Activación de empleado
  isPendingActivation: boolean("is_pending_activation").notNull().default(true), // true hasta que cree contraseña
  activatedAt: timestamp("activated_at"), // Fecha de activación de la cuenta
  
  // Dirección
  postalAddress: text("postal_address"), // Lo escribe el empleado
  
  // Foto de perfil
  profilePicture: text("profile_picture"), // URL de la foto de perfil
  
  // Vacaciones
  totalVacationDays: decimal("total_vacation_days", { precision: 4, scale: 1 }).notNull().default("0.0"), // Calculado automáticamente
  usedVacationDays: decimal("used_vacation_days", { precision: 4, scale: 1 }).notNull().default("0.0"), // Auto
  vacationDaysPerMonth: decimal("vacation_days_per_month", { precision: 3, scale: 1 }).default("2.5"), // Días por mes (nullable = usa default de empresa)
  vacationDaysAdjustment: decimal("vacation_days_adjustment", { precision: 4, scale: 1 }).notNull().default("0.0"), // Ajuste manual del admin (+/-)
  
  // Contacto de emergencia
  emergencyContactName: text("emergency_contact_name"), // Lo escribe el empleado
  emergencyContactPhone: text("emergency_contact_phone"), // Lo escribe el empleado
  
  // Stripe payment integration
  stripeCustomerId: text("stripe_customer_id"), // ID del cliente en Stripe
  
  // Metadatos
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Work sessions table
export const workSessions = pgTable("work_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  clockIn: timestamp("clock_in").notNull(),
  clockOut: timestamp("clock_out"),
  totalHours: decimal("total_hours", { precision: 4, scale: 2 }),
  totalBreakTime: decimal("total_break_time", { precision: 4, scale: 2 }).default("0.00"), // Total break time in hours
  status: text("status").notNull().default("active"), // active, completed
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Break periods table - Para gestionar descansos durante jornada laboral
export const breakPeriods = pgTable("break_periods", {
  id: serial("id").primaryKey(),
  workSessionId: integer("work_session_id").references(() => workSessions.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  breakStart: timestamp("break_start").notNull(),
  breakEnd: timestamp("break_end"),
  duration: decimal("duration", { precision: 4, scale: 2 }), // Duration in hours
  status: text("status").notNull().default("active"), // active, completed
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Vacation requests table
export const vacationRequests = pgTable("vacation_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  reason: text("reason"),
  status: text("status").notNull().default("pending"), // pending, approved, denied
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  adminComment: text("admin_comment"), // Admin's comment when reviewing
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Documents table
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type"),
  filePath: text("file_path"),
  uploadedBy: integer("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Messages table
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").references(() => users.id).notNull(),
  receiverId: integer("receiver_id").references(() => users.id), // nullable for company-wide messages
  subject: text("subject"),
  content: text("content").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  isToAllEmployees: boolean("is_to_all_employees").notNull().default(false), // for company-wide messages
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Unified notifications table for all notification types
export const systemNotifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(), // 'document_request', 'message', 'vacation_approval', 'system', 'reminder', etc.
  category: text("category").notNull(), // 'documents', 'messages', 'vacations', 'system', 'reminders'
  title: text("title").notNull(),
  message: text("message").notNull(),
  actionUrl: text("action_url"), // URL to navigate when clicked
  dueDate: timestamp("due_date"),
  priority: text("priority").notNull().default('medium'), // 'low', 'medium', 'high'
  isRead: boolean("is_read").default(false).notNull(),
  isCompleted: boolean("is_completed").default(false).notNull(),
  metadata: text("metadata"), // JSON string for additional data
  createdBy: integer("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});



// Reminders table - Google Keep style reminders
export const reminders = pgTable("reminders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  title: text("title").notNull(),
  content: text("content"),
  reminderDate: timestamp("reminder_date"),
  priority: text("priority").notNull().default('medium'), // 'low', 'medium', 'high'
  color: text("color").default('#ffffff'), // Hex color for the reminder
  isCompleted: boolean("is_completed").default(false).notNull(),
  isArchived: boolean("is_archived").default(false).notNull(),
  isPinned: boolean("is_pinned").default(false).notNull(),
  notificationShown: boolean("notification_shown").default(false).notNull(),
  showBanner: boolean("show_banner").default(false).notNull(),
  assignedUserIds: integer("assigned_user_ids").array(), // Array of user IDs for assignments
  assignedBy: integer("assigned_by").references(() => users.id), // Who assigned the reminder
  assignedAt: timestamp("assigned_at"), // When it was assigned
  createdBy: integer("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Reminder assignments are now handled via assignedUserIds array in reminders table

// Employee activation tokens for password setup
export const employeeActivationTokens = pgTable("employee_activation_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  token: text("token").notNull().unique(),
  email: text("email").notNull(), // Email where the invitation was sent
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false).notNull(),
  createdBy: integer("created_by").references(() => users.id).notNull(), // Admin/Manager who created the employee
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas
export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
});



export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  usedVacationDays: true, // Auto-calculated
});

export const insertWorkSessionSchema = createInsertSchema(workSessions).omit({
  id: true,
  createdAt: true,
});

export const insertBreakPeriodSchema = createInsertSchema(breakPeriods).omit({
  id: true,
  createdAt: true,
});

export const insertVacationRequestSchema = createInsertSchema(vacationRequests).omit({
  id: true,
  createdAt: true,
  reviewedBy: true,
  reviewedAt: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationSchema = createInsertSchema(systemNotifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});



export const insertReminderSchema = createInsertSchema(reminders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Reminder assignment schema removed - now using assignedUserIds array in reminders

export const insertEmployeeActivationTokenSchema = createInsertSchema(employeeActivationTokens).omit({
  id: true,
  createdAt: true,
});

export const insertSuperAdminSchema = createInsertSchema(superAdmins).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFeatureSchema = createInsertSchema(features).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// insertPlanFeatureSchema eliminado - ahora usamos columnas directas en features

// insertCompanyFeatureSchema eliminado - ahora usamos companies.customFeatures

// Schema insertAccountInfoSchema eliminado - datos consolidados en companies

export const insertPaymentMethodSchema = createInsertSchema(paymentMethods).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUsageStatsSchema = createInsertSchema(usageStats).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRegistrationSettingsSchema = createInsertSchema(registrationSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInvitationLinkSchema = createInsertSchema(invitationLinks).omit({
  id: true,
  createdAt: true,
});

export const superAdminLoginSchema = z.object({
  email: z.string().email("Email debe ser válido"),
  password: z.string().min(1, "Password es requerido"),
});

// Auth schemas
export const loginSchema = z.object({
  dniOrEmail: z.string().min(1, "DNI/NIE o email requerido"),
  password: z.string().min(1, "Contraseña requerida"),
});

export const companyRegistrationSchema = z.object({
  // Company fields
  companyName: z.string().min(1, "Nombre de empresa requerido"),
  cif: z.string().min(1, "CIF requerido"),
  companyEmail: z.string().email("Email inválido"),
  contactName: z.string().optional(),
  companyAlias: z.string().min(1, "Alias de empresa requerido").regex(/^[a-zA-Z0-9-]+$/, "Solo letras, números y guiones"),
  phone: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().optional(),
  address: z.string().optional(),
  province: z.string().min(1, "Provincia requerida"),
  logoUrl: z.string().optional(),
  
  // Admin user fields
  adminFullName: z.string().min(1, "Nombre completo requerido"),
  adminEmail: z.string().email("Email admin requerido"),
  adminDni: z.string().min(1, "DNI/NIE requerido"),
  adminPhone: z.string().optional(),
  password: z.string().min(8, "Contraseña debe tener al menos 8 caracteres")
    .regex(/[A-Z]/, "Debe contener al menos una mayúscula")
    .regex(/[a-z]/, "Debe contener al menos una minúscula") 
    .regex(/[0-9]/, "Debe contener al menos un número")
    .regex(/[^A-Za-z0-9]/, "Debe contener al menos un carácter especial"),
  confirmPassword: z.string(),
  
  // Contact person information
  sameAsAdmin: z.boolean().optional(),
  
  // Step 1 data (for plan recommendation)
  teamSize: z.string().optional(),
  interestedFeatures: z.array(z.string()).optional(),
  
  // Step 4 data (selected plan)
  selectedPlan: z.string().min(1, "Plan de suscripción requerido"),
  
  // Optional tokens for registration
  verificationToken: z.string().optional().nullable(),
  invitationToken: z.string().optional().nullable(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
}).refine((data) => {
  if (data.sameAsAdmin === false && (!data.contactName || data.contactName.trim() === '')) {
    return false;
  }
  return true;
}, {
  message: "Nombre de contacto requerido cuando no es el mismo administrador",
  path: ["contactName"],
});

// Types
export type Company = typeof companies.$inferSelect;
export type User = typeof users.$inferSelect;
export type WorkSession = typeof workSessions.$inferSelect;
export type BreakPeriod = typeof breakPeriods.$inferSelect;
export type VacationRequest = typeof vacationRequests.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type SystemNotification = typeof systemNotifications.$inferSelect;



export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertWorkSession = z.infer<typeof insertWorkSessionSchema>;
export type InsertBreakPeriod = z.infer<typeof insertBreakPeriodSchema>;
export type InsertVacationRequest = z.infer<typeof insertVacationRequestSchema>;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type InsertSystemNotification = z.infer<typeof insertNotificationSchema>;

export type InsertSuperAdmin = z.infer<typeof insertSuperAdminSchema>;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;

export type SuperAdmin = typeof superAdmins.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type Reminder = typeof reminders.$inferSelect;
export type InsertReminder = z.infer<typeof insertReminderSchema>;
export type ReminderAssignment = typeof reminderAssignments.$inferSelect;
export type InsertReminderAssignment = z.infer<typeof insertReminderAssignmentSchema>;
export type EmployeeActivationToken = typeof employeeActivationTokens.$inferSelect;
export type InsertEmployeeActivationToken = z.infer<typeof insertEmployeeActivationTokenSchema>;

export type LoginData = z.infer<typeof loginSchema>;
export type SuperAdminLoginData = z.infer<typeof superAdminLoginSchema>;
export type CompanyRegistrationData = z.infer<typeof companyRegistrationSchema>;

// Tipos AccountInfo e InsertAccountInfo eliminados - datos consolidados en companies
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type InsertPaymentMethod = typeof paymentMethods.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;
export type UsageStats = typeof usageStats.$inferSelect;
export type InsertUsageStats = typeof usageStats.$inferInsert;
