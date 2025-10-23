import { pgTable, text, serial, integer, boolean, timestamp, decimal, varchar, jsonb, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
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
  trialDurationDays: integer("trial_duration_days").default(14).notNull(), // Días de período de prueba (por defecto 14)
  usedPromotionalCode: varchar("used_promotional_code", { length: 50 }), // Código promocional utilizado durante el registro
  
  // Email marketing conversion tracking
  emailCampaignId: integer("email_campaign_id"), // ID de la campaña de email de la que vino el registro
  registrationSource: varchar("registration_source", { length: 50 }).default("direct"), // direct, email_campaign, invitation
  marketingEmailsConsent: boolean("marketing_emails_consent").default(false).notNull(), // Consentimiento para recibir emails comerciales
  
  // Account deletion fields - 30 day grace period
  scheduledForDeletion: boolean("scheduled_for_deletion").default(false).notNull(),
  deletionScheduledAt: timestamp("deletion_scheduled_at"),
  deletionWillOccurAt: timestamp("deletion_will_occur_at"),
  isDeleted: boolean("is_deleted").default(false).notNull(),
  deletedAt: timestamp("deleted_at"),
  
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

// 🔒 SECURITY: Audit logs table for complete security tracking
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  ip: varchar("ip", { length: 100 }).notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }),
  success: boolean("success").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  timestampIdx: index("audit_logs_timestamp_idx").on(table.timestamp),
  actionIdx: index("audit_logs_action_idx").on(table.action),
  emailIdx: index("audit_logs_email_idx").on(table.email),
}));

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

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
  monthlyPrice: decimal("monthly_price", { precision: 10, scale: 2 }).notNull(), // Precio fijo mensual (ej: 29.99 euros/mes)
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
  startDate: timestamp("start_date").defaultNow().notNull(), // Company start date
  endDate: timestamp("end_date"),
  isTrialActive: boolean("is_trial_active").default(true).notNull(),
  trialStartDate: timestamp("trial_start_date").defaultNow(), // Trial start date
  trialEndDate: timestamp("trial_end_date"), // Trial end date
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  firstPaymentDate: timestamp("first_payment_date"),
  nextPaymentDate: timestamp("next_payment_date"),
  maxUsers: integer("max_users").default(5).notNull(),
  useCustomSettings: boolean("use_custom_settings").default(false).notNull(),
  customMonthlyPrice: decimal("custom_monthly_price", { precision: 10, scale: 2 }),
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

// Background Image Processing table - para trackear el procesamiento asíncrono de imágenes
export const imageProcessingJobs = pgTable("image_processing_jobs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  originalFilePath: text("original_file_path").notNull(), // Ruta del archivo original subido
  processedFilePath: text("processed_file_path"), // Ruta del archivo procesado final
  processingType: varchar("processing_type", { length: 50 }).notNull(), // 'profile_picture', 'company_logo', 'document'
  status: varchar("status", { length: 50 }).notNull().default("pending"), // 'pending', 'processing', 'completed', 'failed'
  errorMessage: text("error_message"), // Mensaje de error si falla
  targetUserId: integer("target_user_id").references(() => users.id, { onDelete: "cascade" }), // Para admins subiendo fotos de otros usuarios
  metadata: jsonb("metadata").default('{}'), // Información adicional (dimensiones, tamaño, etc.)
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  companyEmail: text("company_email").unique(), // Lo introduce admin/manager - puede ser null si solo usa email personal
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
  autoCompleted: boolean("auto_completed").notNull().default(false), // true if automatically closed due to missed clock out
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  // Performance indexes for high-concurrency clock-ins (1000+ simultaneous users)
  userStatusIdx: index("work_sessions_user_status_idx").on(table.userId, table.status),
  clockInIdx: index("work_sessions_clock_in_idx").on(table.clockIn),
  userClockInIdx: index("work_sessions_user_clock_in_idx").on(table.userId, table.clockIn),
}));

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
}, (table) => ({
  // Performance indexes for orphaned break cleanup during clock-in
  userStatusIdx: index("break_periods_user_status_idx").on(table.userId, table.status),
  sessionIdx: index("break_periods_session_idx").on(table.workSessionId),
}));

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
  // Document signature and acceptance tracking
  isViewed: boolean("is_viewed").default(false).notNull(),
  isAccepted: boolean("is_accepted").default(false).notNull(),
  acceptedAt: timestamp("accepted_at"),
  digitalSignature: text("digital_signature"), // Base64 encoded signature image
  signedAt: timestamp("signed_at"),
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
  enableNotifications: boolean("enable_notifications").default(false).notNull(), // Enable toast notifications for this reminder
  notificationShown: boolean("notification_shown").default(false).notNull(),
  showBanner: boolean("show_banner").default(false).notNull(),
  assignedUserIds: integer("assigned_user_ids").array(), // Array of user IDs for assignments
  completedByUserIds: integer("completed_by_user_ids").array(), // Array of user IDs who completed the reminder
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

// Password reset tokens for account recovery
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false).notNull(),
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

export const insertImageProcessingJobSchema = createInsertSchema(imageProcessingJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  startedAt: true,
  completedAt: true,
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
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
  promotionalCode: z.string().optional(),
  
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

// Validation schemas for password reset
export const passwordResetRequestSchema = z.object({
  email: z.string().email("Email válido requerido"),
  companyAlias: z.string().optional(),
});

export const passwordResetSchema = z.object({
  token: z.string().min(1, "Token requerido"),
  password: z.string()
    .min(8, "Contraseña debe tener al menos 8 caracteres")
    .regex(/[A-Z]/, "Debe contener al menos una mayúscula")
    .regex(/[a-z]/, "Debe contener al menos una minúscula")
    .regex(/[0-9]/, "Debe contener al menos un número")
    .regex(/[^A-Za-z0-9]/, "Debe contener al menos un carácter especial"),
  confirmPassword: z.string().min(1, "Confirmación de contraseña requerida"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

// Contact form schema for security validation
export const contactFormSchema = z.object({
  name: z.string()
    .min(1, "El nombre es obligatorio")
    .max(100, "El nombre no puede exceder 100 caracteres")
    .regex(/^[a-zA-ZÀ-ÿ\u00f1\u00d1\s'-]+$/, "Solo se permiten letras, espacios, acentos y guiones"),
  email: z.string()
    .email("Email inválido")
    .min(5, "Email demasiado corto")
    .max(254, "Email demasiado largo"),
  phone: z.string()
    .optional()
    .refine((val) => !val || /^[+]?[0-9\s-()]+$/.test(val), {
      message: "Formato de teléfono inválido"
    }),
  subject: z.string()
    .min(5, "El asunto debe tener al menos 5 caracteres")
    .max(200, "El asunto no puede exceder 200 caracteres"),
  message: z.string()
    .min(10, "El mensaje debe tener al menos 10 caracteres")
    .max(2000, "El mensaje no puede exceder 2000 caracteres"),
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
// ReminderAssignment types temporarily removed
export type EmployeeActivationToken = typeof employeeActivationTokens.$inferSelect;
export type InsertEmployeeActivationToken = z.infer<typeof insertEmployeeActivationTokenSchema>;
export type ImageProcessingJob = typeof imageProcessingJobs.$inferSelect;
export type InsertImageProcessingJob = z.infer<typeof insertImageProcessingJobSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;

export type LoginData = z.infer<typeof loginSchema>;

export type CompanyRegistrationData = z.infer<typeof companyRegistrationSchema>;

// Tipos AccountInfo e InsertAccountInfo eliminados - datos consolidados en companies
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type InsertPaymentMethod = typeof paymentMethods.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;
export type UsageStats = typeof usageStats.$inferSelect;
export type InsertUsageStats = typeof usageStats.$inferInsert;

// Custom Holidays table - festivos personalizados por empresa
export const customHolidays = pgTable("custom_holidays", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // "Feria de Sevilla", "Día de la empresa"
  startDate: timestamp("start_date").notNull(), // Fecha de inicio del festivo
  endDate: timestamp("end_date").notNull(), // Fecha de fin del festivo (puede ser igual al inicio)
  type: varchar("type", { length: 20 }).notNull().default("local"), // national, regional, local
  region: text("region"), // Región si es regional
  description: text("description"), // Descripción opcional
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Schema for custom holidays
export const insertCustomHolidaySchema = createInsertSchema(customHolidays).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CustomHoliday = typeof customHolidays.$inferSelect;
export type InsertCustomHoliday = z.infer<typeof insertCustomHolidaySchema>;

// Work alarms table - alarmas personales para fichaje de empleados
export const workAlarms = pgTable("work_alarms", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(), // "Entrada oficina", "Salida viernes"
  type: varchar("type", { length: 20 }).notNull(), // "clock_in", "clock_out", "break_start", "break_end"
  time: varchar("time", { length: 5 }).notNull(), // "08:30", "17:00" formato HH:MM
  weekdays: integer("weekdays").array().notNull(), // [1,2,3,4,5] (1=lunes, 7=domingo)
  isActive: boolean("is_active").notNull().default(true),
  soundEnabled: boolean("sound_enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Schema for work alarms
export const insertWorkAlarmSchema = createInsertSchema(workAlarms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type WorkAlarm = typeof workAlarms.$inferSelect;
export type InsertWorkAlarm = z.infer<typeof insertWorkAlarmSchema>;

// Work Shifts table - cuadrante/horarios de trabajadores  
export const workShifts = pgTable("work_shifts", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  employeeId: integer("employee_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  startAt: timestamp("start_at").notNull(), // Fecha y hora de inicio del turno
  endAt: timestamp("end_at").notNull(), // Fecha y hora de fin del turno  
  title: varchar("title", { length: 100 }), // Título opcional del turno (ej: "Turno mañana")
  location: text("location"), // Ubicación opcional del trabajo
  notes: text("notes"), // Notas adicionales
  color: varchar("color", { length: 20 }).default("#007AFF"), // Color para visualización en timeline
  createdByUserId: integer("created_by_user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Schema for work shifts
export const insertWorkShiftSchema = createInsertSchema(workShifts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type WorkShift = typeof workShifts.$inferSelect;
export type InsertWorkShift = z.infer<typeof insertWorkShiftSchema>;

// Promotional codes table - códigos promocionales para extender período de prueba
export const promotionalCodes = pgTable("promotional_codes", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(), // Código único (ej: "PROMO2024")
  description: text("description").notNull(), // Descripción del código
  trialDurationDays: integer("trial_duration_days").notNull().default(60), // Días de prueba que otorga (por defecto 2 meses)
  isActive: boolean("is_active").notNull().default(true), // Si el código está activo
  maxUses: integer("max_uses"), // Límite de usos (null = ilimitado)
  currentUses: integer("current_uses").notNull().default(0), // Usos actuales
  validFrom: timestamp("valid_from"), // Fecha desde cuando es válido (null = siempre)
  validUntil: timestamp("valid_until"), // Fecha hasta cuando es válido (null = siempre)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Schema for promotional codes
export const insertPromotionalCodeSchema = createInsertSchema(promotionalCodes).omit({
  id: true,
  currentUses: true,
  createdAt: true,
  updatedAt: true,
});

export type PromotionalCode = typeof promotionalCodes.$inferSelect;
export type InsertPromotionalCode = z.infer<typeof insertPromotionalCodeSchema>;

// Email Marketing - Prospects table (contactos externos para captación)
export const emailProspects = pgTable("email_prospects", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  company: varchar("company", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  location: varchar("location", { length: 100 }), // Ciudad/ubicación del contacto
  tags: text("tags").array().default([]), // Etiquetas para segmentación
  status: varchar("status", { length: 50 }).default("active").notNull(), // active, unsubscribed, bounced
  notes: text("notes"),
  // Contact tracking fields - separate status for each channel
  whatsappContacted: boolean("whatsapp_contacted").default(false).notNull(),
  whatsappConversationStatus: varchar("whatsapp_conversation_status", { length: 50 }).default("not_contacted").notNull(), // not_contacted, no_response, in_conversation, not_interested, closed
  instagramContacted: boolean("instagram_contacted").default(false).notNull(),
  instagramConversationStatus: varchar("instagram_conversation_status", { length: 50 }).default("not_contacted").notNull(), // not_contacted, no_response, in_conversation, not_interested, closed
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertEmailProspectSchema = createInsertSchema(emailProspects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type EmailProspect = typeof emailProspects.$inferSelect;
export type InsertEmailProspect = z.infer<typeof insertEmailProspectSchema>;

// Email Marketing - Campaigns table
export const emailCampaigns = pgTable("email_campaigns", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  preheader: varchar("preheader", { length: 255 }), // Texto preview en inbox
  htmlContent: text("html_content").notNull(),
  status: varchar("status", { length: 50 }).default("draft").notNull(), // draft, scheduled, sending, sent, failed
  
  // Tipo de audiencia (determina si incluye footer de cancelar suscripción)
  audienceType: varchar("audience_type", { length: 50 }).default("subscribers").notNull(), // "subscribers" (con footer), "one_time" (sin footer)
  
  // Segmentación de destinatarios
  targetAudience: varchar("target_audience", { length: 50 }).notNull(), // "all_users", "registered_users", "prospects", "custom"
  
  // Filtros para usuarios registrados
  includeActiveSubscriptions: boolean("include_active_subscriptions").default(false),
  includeTrialSubscriptions: boolean("include_trial_subscriptions").default(false),
  includeBlockedSubscriptions: boolean("include_blocked_subscriptions").default(false),
  includeCancelledSubscriptions: boolean("include_cancelled_subscriptions").default(false),
  specificPlans: text("specific_plans").array(), // ["basic", "pro", "master"]
  
  // Incluir prospects
  includeProspects: boolean("include_prospects").default(false),
  prospectTags: text("prospect_tags").array(), // Filtrar prospects por tags
  
  // Emails específicos seleccionados (individual selection)
  selectedEmails: text("selected_emails").array().default([]),
  
  // Programación
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  
  // Estadísticas
  recipientsCount: integer("recipients_count").default(0),
  sentCount: integer("sent_count").default(0),
  deliveredCount: integer("delivered_count").default(0),
  openedCount: integer("opened_count").default(0),
  clickedCount: integer("clicked_count").default(0),
  bouncedCount: integer("bounced_count").default(0),
  unsubscribedCount: integer("unsubscribed_count").default(0),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertEmailCampaignSchema = createInsertSchema(emailCampaigns).omit({
  id: true,
  recipientsCount: true,
  sentCount: true,
  deliveredCount: true,
  openedCount: true,
  clickedCount: true,
  bouncedCount: true,
  unsubscribedCount: true,
  createdAt: true,
  updatedAt: true,
});

export type EmailCampaign = typeof emailCampaigns.$inferSelect;
export type InsertEmailCampaign = z.infer<typeof insertEmailCampaignSchema>;

// Email Marketing - Campaign Sends (tracking individual de envíos)
export const emailCampaignSends = pgTable("email_campaign_sends", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").references(() => emailCampaigns.id, { onDelete: "cascade" }).notNull(),
  recipientEmail: varchar("recipient_email", { length: 255 }).notNull(),
  recipientName: varchar("recipient_name", { length: 255 }),
  recipientType: varchar("recipient_type", { length: 50 }).notNull(), // "user", "prospect"
  
  // Tracking
  status: varchar("status", { length: 50 }).default("pending").notNull(), // pending, sent, delivered, opened, clicked, bounced, failed
  sendgridMessageId: varchar("sendgrid_message_id", { length: 255 }),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
  bouncedAt: timestamp("bounced_at"),
  bounceReason: text("bounce_reason"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  campaignEmailIdx: index("campaign_email_idx").on(table.campaignId, table.recipientEmail),
}));

export const insertEmailCampaignSendSchema = createInsertSchema(emailCampaignSends).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type EmailCampaignSend = typeof emailCampaignSends.$inferSelect;
export type InsertEmailCampaignSend = z.infer<typeof insertEmailCampaignSendSchema>;

// Landing Page Analytics
export const landingVisits = pgTable("landing_visits", {
  id: serial("id").primaryKey(),
  visitedAt: timestamp("visited_at").defaultNow().notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  country: varchar("country", { length: 100 }),
  city: varchar("city", { length: 100 }),
  userAgent: text("user_agent"),
  referrer: text("referrer"),
  registered: boolean("registered").default(false).notNull(),
  companyId: integer("company_id").references(() => companies.id),
}, (table) => ({
  visitedAtIdx: index("visited_at_idx").on(table.visitedAt),
  countryIdx: index("country_idx").on(table.country),
}));

export const insertLandingVisitSchema = createInsertSchema(landingVisits).omit({
  id: true,
});

export type LandingVisit = typeof landingVisits.$inferSelect;
export type InsertLandingVisit = z.infer<typeof insertLandingVisitSchema>;

// Push Subscriptions table - PWA push notifications
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  deviceId: varchar("device_id", { length: 100 }), // Stable client-generated device identifier
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("push_subscriptions_user_id_idx").on(table.userId),
  deviceIdIdx: index("push_subscriptions_device_id_idx").on(table.deviceId),
}));

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
