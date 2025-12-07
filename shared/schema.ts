import { pgTable, text, serial, integer, boolean, timestamp, decimal, varchar, jsonb, index, date, time } from "drizzle-orm/pg-core";
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
  workingHoursPerDay: decimal("working_hours_per_day", { precision: 3, scale: 1 }).default("8"),
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
  managerPermissions: jsonb("manager_permissions").default('{"canCreateDeleteEmployees":true,"canCreateDeleteManagers":false,"canBuyRemoveFeatures":false,"canBuyRemoveUsers":false,"canEditCompanyData":false,"visibleFeatures":[]}').notNull(),
  // Campos migrados desde account_info (datos de facturación)
  accountId: text("account_id"), // OFZ-2024-001234 format (nullable, not unique to allow multiple NULL values)
  billingPostalCode: text("billing_postal_code"),
  billingCountry: text("billing_country").default("ES"),
  
  // Plan y features personalizadas por empresa
  // DEPRECATED: plan field - ahora siempre es "oficaz", features se manejan via add-ons
  plan: varchar("plan", { length: 50 }).notNull().default("oficaz"), // Siempre "oficaz" en nuevo modelo
  customFeatures: jsonb("custom_features").default('{}'), // {logoUpload: true, employee_time_edit: false, etc} - settings específicos de empresa
  
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

// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ DEPRECATED: Features table - LEGACY del modelo de planes basic/pro/master
// El nuevo modelo usa la tabla 'addons' y 'companyAddons' para gestionar funcionalidades
// Mantener solo para backward compatibility - NO usar en código nuevo
// ═══════════════════════════════════════════════════════════════════════════
export const features = pgTable("features", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 50 }).notNull(),
  
  // DEPRECATED: Estas columnas ya no se usan - features ahora via addons
  basicEnabled: boolean("basic_enabled").notNull().default(false),
  proEnabled: boolean("pro_enabled").notNull().default(false),
  masterEnabled: boolean("master_enabled").notNull().default(false),
  
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ DEPRECATED: subscriptionPlans - LEGACY del modelo basic/pro/master
// El nuevo modelo usa un único plan "Oficaz" (39€/mes) + add-ons modulares
// Mantener solo para backward compatibility - NO usar en código nuevo
// ═══════════════════════════════════════════════════════════════════════════
export const subscriptionPlans = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull(), // DEPRECATED: Ahora siempre "oficaz"
  displayName: varchar("display_name", { length: 100 }).notNull(),
  monthlyPrice: decimal("monthly_price", { precision: 10, scale: 2 }).notNull(),
  maxUsers: integer("max_users"),
  storageLimitGB: integer("storage_limit_gb").default(25),
  aiTokensLimitMonthly: integer("ai_tokens_limit_monthly").default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Company subscriptions - dates are calculated from companies.created_at
// NEW MODEL: Single plan "Oficaz" with base price + add-ons + extra users
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id, { onDelete: "cascade" }).unique().notNull(),
  
  // LEGACY: Plan fields (to be deprecated - keeping for backward compatibility during migration)
  plan: varchar("plan", { length: 50 }).notNull().default("oficaz"), // Now always "oficaz"
  currentEffectivePlan: varchar("current_effective_plan", { length: 50 }), // DEPRECATED
  nextPlan: varchar("next_plan", { length: 50 }), // DEPRECATED
  planChangeDate: timestamp("plan_change_date"), // DEPRECATED
  
  // NEW MODEL V2: Flexible pricing (starts at 0€, pay for what you use)
  baseMonthlyPrice: decimal("base_monthly_price", { precision: 10, scale: 2 }).default("0.00").notNull(), // Base plan price (0€ - pay per feature/user)
  
  // NEW MODEL V2: No included users (pay for all)
  includedAdmins: integer("included_admins").default(0).notNull(), // Admins included in base (0 - pay for all)
  includedManagers: integer("included_managers").default(0).notNull(), // Managers included in base (0 - pay for all)
  includedEmployees: integer("included_employees").default(0).notNull(), // Employees included in base (0 - pay for all)
  
  // NEW MODEL V2: Legacy plan flag (for existing customers with old pricing)
  isLegacyPlan: boolean("is_legacy_plan").default(false).notNull(), // True for existing customers grandfathered in
  
  // NEW MODEL: Extra users purchased (beyond included)
  extraAdmins: integer("extra_admins").default(0).notNull(), // Extra admins purchased
  extraManagers: integer("extra_managers").default(0).notNull(), // Extra managers purchased
  extraEmployees: integer("extra_employees").default(0).notNull(), // Extra employees purchased
  
  // NEW MODEL: Stripe subscription item IDs for extra users
  stripeAdminSeatsItemId: text("stripe_admin_seats_item_id"), // Stripe item for admin seats
  stripeManagerSeatsItemId: text("stripe_manager_seats_item_id"), // Stripe item for manager seats
  stripeEmployeeSeatsItemId: text("stripe_employee_seats_item_id"), // Stripe item for employee seats
  
  // Subscription status and dates
  status: varchar("status", { length: 50 }).default("trial").notNull(), // trial, active, inactive, suspended, blocked
  startDate: timestamp("start_date").defaultNow().notNull(), // Company start date
  endDate: timestamp("end_date"),
  isTrialActive: boolean("is_trial_active").default(true).notNull(),
  trialStartDate: timestamp("trial_start_date").defaultNow(), // Trial start date
  trialEndDate: timestamp("trial_end_date"), // Trial end date
  
  // Stripe integration
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripeBasePlanItemId: text("stripe_base_plan_item_id"), // Stripe item for base plan (39€)
  firstPaymentDate: timestamp("first_payment_date"),
  nextPaymentDate: timestamp("next_payment_date"),
  
  // LEGACY: maxUsers (to be replaced by included + extra users)
  maxUsers: integer("max_users").default(12).notNull(), // DEPRECATED: Use includedX + extraX instead
  useCustomSettings: boolean("use_custom_settings").default(false).notNull(),
  customMonthlyPrice: decimal("custom_monthly_price", { precision: 10, scale: 2 }),
  
  // AI usage tracking
  aiTokensUsed: integer("ai_tokens_used").default(0), // AI tokens used this month
  aiTokensResetDate: timestamp("ai_tokens_reset_date"), // Date when tokens reset (start of billing cycle)
  
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
  
  // Firma del empleado (para partes de trabajo)
  signatureImage: text("signature_image"), // URL de la imagen de firma
  
  // Configuración de partes de obra/trabajo
  // 'disabled' = sin acceso, 'manual' = icono en dash, 'both' = icono + popup al fichar salida
  workReportMode: text("work_report_mode").default("manual"),
  
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
  
  // Geolocation fields for clock-in/clock-out verification
  clockInLatitude: decimal("clock_in_latitude", { precision: 10, scale: 7 }),
  clockInLongitude: decimal("clock_in_longitude", { precision: 10, scale: 7 }),
  clockOutLatitude: decimal("clock_out_latitude", { precision: 10, scale: 7 }),
  clockOutLongitude: decimal("clock_out_longitude", { precision: 10, scale: 7 }),
  
  // Audit fields for legal compliance (RD-ley 8/2019)
  isManuallyCreated: boolean("is_manually_created").notNull().default(false), // true if created by admin (forgotten check-in)
  lastModifiedAt: timestamp("last_modified_at"), // timestamp of last modification
  lastModifiedBy: integer("last_modified_by").references(() => users.id), // admin who made the last modification
  
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

// Work session audit log - Legal compliance (RD-ley 8/2019) - Required by Spanish law
export const workSessionAuditLog = pgTable("work_session_audit_log", {
  id: serial("id").primaryKey(),
  workSessionId: integer("work_session_id").references(() => workSessions.id).notNull(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  modificationType: text("modification_type").notNull(), // created_manual, modified_clockin, modified_clockout, modified_both, deleted
  oldValue: jsonb("old_value"), // {clockIn: "2024-11-04T08:00:00Z", clockOut: "2024-11-04T17:00:00Z"}
  newValue: jsonb("new_value").notNull(), // {clockIn: "2024-11-04T08:30:00Z", clockOut: "2024-11-04T17:00:00Z"}
  reason: text("reason").notNull(), // Mandatory reason for modification
  modifiedBy: integer("modified_by").references(() => users.id).notNull(), // Admin who made the change
  modifiedAt: timestamp("modified_at").defaultNow().notNull(),
}, (table) => ({
  workSessionIdx: index("audit_log_work_session_idx").on(table.workSessionId),
  companyIdx: index("audit_log_company_idx").on(table.companyId),
  modifiedAtIdx: index("audit_log_modified_at_idx").on(table.modifiedAt),
}));

// Work session modification requests - Employees can request changes
export const workSessionModificationRequests = pgTable("work_session_modification_requests", {
  id: serial("id").primaryKey(),
  workSessionId: integer("work_session_id").references(() => workSessions.id), // nullable for new/forgotten check-ins
  employeeId: integer("employee_id").references(() => users.id).notNull(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  requestType: text("request_type").notNull(), // forgotten_checkin, modify_time
  
  // Current values (for modifications)
  currentClockIn: timestamp("current_clock_in"),
  currentClockOut: timestamp("current_clock_out"),
  
  // Requested values
  requestedDate: timestamp("requested_date").notNull(), // Date of the work session
  requestedClockIn: timestamp("requested_clock_in").notNull(),
  requestedClockOut: timestamp("requested_clock_out"),
  
  reason: text("reason").notNull(), // Employee's reason for the request
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  adminResponse: text("admin_response"), // Admin's comment when reviewing
  reviewedBy: integer("reviewed_by").references(() => users.id), // Admin who reviewed
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  employeeIdx: index("mod_requests_employee_idx").on(table.employeeId),
  companyIdx: index("mod_requests_company_idx").on(table.companyId),
  statusIdx: index("mod_requests_status_idx").on(table.status),
  companyStatusIdx: index("mod_requests_company_status_idx").on(table.companyId, table.status),
}));

// Vacation/Absence requests table
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
  // New absence type fields
  absenceType: text("absence_type").notNull().default("vacation"), // vacation, maternity_paternity, marriage, family_death, family_death_travel, family_illness, family_illness_travel, home_relocation, public_duty, temporary_disability
  attachmentPath: text("attachment_path"), // File path for supporting documents
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Absence policies table - configurable days per absence type per company
export const absencePolicies = pgTable("absence_policies", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  absenceType: text("absence_type").notNull(), // Same values as vacation_requests.absenceType
  name: text("name").notNull(), // Display name in Spanish
  maxDays: integer("max_days"), // null = unlimited (for temporary_disability, public_duty)
  requiresAttachment: boolean("requires_attachment").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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
  requiresSignature: boolean("requires_signature").default(false).notNull(), // If true, employee must sign to accept
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

// 🔒 SECURITY: Refresh tokens for JWT token rotation
// Access tokens expire in 15 minutes, refresh tokens last 30 days
export const refreshTokens = pgTable("refresh_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  token: text("token").notNull().unique(), // Hashed refresh token
  expiresAt: timestamp("expires_at").notNull(), // 30 days from creation
  revoked: boolean("revoked").default(false).notNull(), // Allow manual revocation
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at"), // Track when last used for monitoring
}, (table) => ({
  userIdIdx: index("refresh_tokens_user_id_idx").on(table.userId),
  tokenIdx: index("refresh_tokens_token_idx").on(table.token),
}));

// 🔒 SECURITY: Signed URLs Table (One-time use tokens for secure document downloads)
export const signedUrls = pgTable("signed_urls", {
  id: serial("id").primaryKey(),
  token: varchar("token", { length: 64 }).notNull().unique(), // Random token for URL
  documentId: integer("document_id").notNull().references(() => documents.id, { onDelete: 'cascade' }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  expiresAt: timestamp("expires_at").notNull(), // Short expiration (5 minutes)
  used: boolean("used").notNull().default(false), // One-time use flag
  createdAt: timestamp("created_at").defaultNow().notNull(),
  usedAt: timestamp("used_at"),
}, (table) => ({
  tokenIdx: index("signed_urls_token_idx").on(table.token),
  documentIdIdx: index("signed_urls_document_id_idx").on(table.documentId),
  expiresAtIdx: index("signed_urls_expires_at_idx").on(table.expiresAt),
}));

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

export const insertWorkSessionAuditLogSchema = createInsertSchema(workSessionAuditLog).omit({
  id: true,
  modifiedAt: true,
});

export const insertWorkSessionModificationRequestSchema = createInsertSchema(workSessionModificationRequests).omit({
  id: true,
  createdAt: true,
  reviewedBy: true,
  reviewedAt: true,
});

export const insertVacationRequestSchema = createInsertSchema(vacationRequests).omit({
  id: true,
  createdAt: true,
  reviewedBy: true,
  reviewedAt: true,
});

export const insertAbsencePolicySchema = createInsertSchema(absencePolicies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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

export const insertRefreshTokenSchema = createInsertSchema(refreshTokens).omit({
  id: true,
  createdAt: true,
  lastUsedAt: true,
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
  
  // Step 1 data - NEW MODULAR MODEL (all features are paid)
  selectedFeatures: z.array(z.string()).min(1, "Selecciona al menos 1 funcionalidad").optional(),
  teamSize: z.string().optional(), // Legacy support
  interestedFeatures: z.array(z.string()).optional(), // Legacy support
  
  // Step 2 data - NEW MODEL (all users are paid, minimum 1 admin REQUIRED)
  admins: z.number().min(1, "Mínimo 1 administrador requerido").default(1),
  managers: z.number().min(0).optional().default(0),
  employees: z.number().min(0).optional().default(0),
  // Legacy support - additional users beyond base plan
  additionalAdmins: z.number().min(0).optional().default(0),
  additionalManagers: z.number().min(0).optional().default(0),
  additionalEmployees: z.number().min(0).optional().default(0),
  
  // Marketing consent
  acceptMarketing: z.boolean().optional().default(false),
  
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
export type WorkSessionAuditLog = typeof workSessionAuditLog.$inferSelect;
export type WorkSessionModificationRequest = typeof workSessionModificationRequests.$inferSelect;
export type VacationRequest = typeof vacationRequests.$inferSelect;
export type AbsencePolicy = typeof absencePolicies.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type SystemNotification = typeof systemNotifications.$inferSelect;



export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertWorkSession = z.infer<typeof insertWorkSessionSchema>;
export type InsertBreakPeriod = z.infer<typeof insertBreakPeriodSchema>;
export type InsertWorkSessionAuditLog = z.infer<typeof insertWorkSessionAuditLogSchema>;
export type InsertWorkSessionModificationRequest = z.infer<typeof insertWorkSessionModificationRequestSchema>;
export type InsertVacationRequest = z.infer<typeof insertVacationRequestSchema>;
export type InsertAbsencePolicy = z.infer<typeof insertAbsencePolicySchema>;
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
  whatsappConversationStatusUpdatedAt: timestamp("whatsapp_conversation_status_updated_at"),
  instagramContacted: boolean("instagram_contacted").default(false).notNull(),
  instagramConversationStatus: varchar("instagram_conversation_status", { length: 50 }).default("not_contacted").notNull(), // not_contacted, no_response, in_conversation, not_interested, closed
  instagramConversationStatusUpdatedAt: timestamp("instagram_conversation_status_updated_at"),
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

// Work Reports table - Partes de Trabajo (Pro feature)
// Independent from time tracking - employees document each job/visit
export const workReports = pgTable("work_reports", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  employeeId: integer("employee_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  reportDate: date("report_date").notNull(), // Date of the work
  refCode: text("ref_code"), // Reference code for the project/work order (código de obra)
  location: text("location").notNull(), // Address or location name
  locationCoords: text("location_coords"), // Optional GPS coordinates "lat,lng"
  startTime: time("start_time").notNull(), // Time work started at location
  endTime: time("end_time").notNull(), // Time work ended at location
  durationMinutes: integer("duration_minutes").notNull(), // Computed server-side
  description: text("description").notNull(), // What work was done
  clientName: text("client_name"), // Optional client/customer name
  notes: text("notes"), // Additional notes
  signedBy: text("signed_by"), // Optional name of person who signed the report
  signatureImage: text("signature_image"), // Optional signature image URL for the report
  status: varchar("status", { length: 20 }).default('draft').notNull(), // draft, submitted
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  companyDateIdx: index("work_reports_company_date_idx").on(table.companyId, table.reportDate),
  employeeDateIdx: index("work_reports_employee_date_idx").on(table.employeeId, table.reportDate),
}));

export const insertWorkReportSchema = createInsertSchema(workReports).omit({
  id: true,
  durationMinutes: true, // Computed server-side
  createdAt: true,
  updatedAt: true,
});

export type WorkReport = typeof workReports.$inferSelect;
export type InsertWorkReport = z.infer<typeof insertWorkReportSchema>;

// Seat Pricing - Prices for additional users by role type
// NEW MODEL: Single source of truth for user seat pricing
export const seatPricing = pgTable("seat_pricing", {
  id: serial("id").primaryKey(),
  roleType: varchar("role_type", { length: 20 }).notNull().unique(), // admin, manager, employee
  displayName: varchar("display_name", { length: 50 }).notNull(), // "Administrador", "Manager", "Empleado"
  monthlyPrice: decimal("monthly_price", { precision: 10, scale: 2 }).notNull(), // Price per extra seat
  stripeProductId: text("stripe_product_id"), // Stripe product ID
  stripePriceId: text("stripe_price_id"), // Stripe recurring price ID
  description: text("description"), // Description for UI
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSeatPricingSchema = createInsertSchema(seatPricing).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SeatPricing = typeof seatPricing.$inferSelect;
export type InsertSeatPricing = z.infer<typeof insertSeatPricingSchema>;

// Add-ons Store - Available add-on modules for purchase
// NEW MODEL: Some addons are free (included in base), others are paid
export const addons = pgTable("addons", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 50 }).notNull().unique(), // ai_assistant, work_reports, messages, etc.
  name: varchar("name", { length: 100 }).notNull(), // "Asistente IA", "Partes de Trabajo"
  description: text("description"), // Detailed description
  shortDescription: varchar("short_description", { length: 200 }), // Brief tagline
  monthlyPrice: decimal("monthly_price", { precision: 10, scale: 2 }).notNull().default("0.00"), // Price in EUR/month (0 for free)
  icon: varchar("icon", { length: 50 }), // Lucide icon name (e.g., "brain", "clipboard-list")
  category: varchar("category", { length: 50 }).default("general"), // productivity, communication, etc.
  featureKey: varchar("feature_key", { length: 50 }), // Maps to features.key if applicable
  stripeProductId: text("stripe_product_id"), // Stripe product ID for billing
  stripePriceId: text("stripe_price_id"), // Stripe recurring price ID
  
  // NEW MODEL: Free vs Paid distinction
  isFreeFeature: boolean("is_free_feature").default(false).notNull(), // true = included in base plan, false = paid addon
  requiresSubscription: boolean("requires_subscription").default(true).notNull(), // Must have active subscription to use
  
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0), // Display order in store
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAddonSchema = createInsertSchema(addons).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Addon = typeof addons.$inferSelect;
export type InsertAddon = z.infer<typeof insertAddonSchema>;

// Company Add-ons - Tracks which add-ons each company has purchased
// Status: active (paid and usable), pending_cancel (active until period end), cancelled (inactive, in cooldown), inactive (payment failed)
export const companyAddons = pgTable("company_addons", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  addonId: integer("addon_id").notNull().references(() => addons.id, { onDelete: 'cascade' }),
  status: varchar("status", { length: 20 }).default("active").notNull(), // active, pending_cancel, cancelled, inactive
  stripeSubscriptionItemId: text("stripe_subscription_item_id"), // Stripe subscription item ID
  purchasedAt: timestamp("purchased_at").defaultNow().notNull(),
  activatedAt: timestamp("activated_at"), // When this addon was activated in current billing cycle
  cancelledAt: timestamp("cancelled_at"),
  cancellationEffectiveDate: timestamp("cancellation_effective_date"), // When cancellation takes effect (end of billing period)
  cooldownEndsAt: timestamp("cooldown_ends_at"), // Cannot re-purchase until this date (next billing cycle)
  lastStripeInvoiceId: text("last_stripe_invoice_id"), // Last invoice that included this addon
  proratedDays: integer("prorated_days"), // Days charged in current period (for invoice description)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  companyAddonIdx: index("company_addons_company_addon_idx").on(table.companyId, table.addonId),
  companyIdx: index("company_addons_company_idx").on(table.companyId),
}));

export const insertCompanyAddonSchema = createInsertSchema(companyAddons).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CompanyAddon = typeof companyAddons.$inferSelect;
export type InsertCompanyAddon = z.infer<typeof insertCompanyAddonSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// INVENTORY MANAGEMENT SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

// Product Categories - Organize products by type
export const productCategories = pgTable("product_categories", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 7 }).default("#3B82F6"), // Hex color for UI
  icon: varchar("icon", { length: 50 }).default("Package"), // Lucide icon name
  parentId: integer("parent_id"), // For subcategories
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("product_categories_company_idx").on(table.companyId),
}));

export const insertProductCategorySchema = createInsertSchema(productCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ProductCategory = typeof productCategories.$inferSelect;
export type InsertProductCategory = z.infer<typeof insertProductCategorySchema>;

// Warehouses - Multiple storage locations
export const warehouses = pgTable("warehouses", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar("name", { length: 100 }).notNull(),
  code: varchar("code", { length: 20 }), // Short code like "ALM-01"
  address: text("address"),
  city: varchar("city", { length: 100 }),
  province: varchar("province", { length: 100 }),
  postalCode: varchar("postal_code", { length: 10 }),
  phone: varchar("phone", { length: 20 }),
  contactPerson: varchar("contact_person", { length: 100 }),
  isDefault: boolean("is_default").default(false).notNull(), // Main warehouse
  isActive: boolean("is_active").default(true).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("warehouses_company_idx").on(table.companyId),
}));

export const insertWarehouseSchema = createInsertSchema(warehouses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Warehouse = typeof warehouses.$inferSelect;
export type InsertWarehouse = z.infer<typeof insertWarehouseSchema>;

// Products - Product catalog with all professional fields
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  categoryId: integer("category_id").references(() => productCategories.id, { onDelete: 'set null' }),
  
  // Basic info
  name: varchar("name", { length: 200 }).notNull(),
  sku: varchar("sku", { length: 50 }), // Stock Keeping Unit - unique code
  barcode: varchar("barcode", { length: 50 }), // EAN/UPC barcode
  description: text("description"),
  
  // Units and measurement
  unit: varchar("unit", { length: 20 }).default("unidad").notNull(), // unidad, kg, litro, metro, caja, etc.
  unitAbbreviation: varchar("unit_abbreviation", { length: 10 }).default("ud.").notNull(),
  
  // Pricing
  costPrice: decimal("cost_price", { precision: 10, scale: 2 }).default("0.00").notNull(), // Purchase/cost price
  salePrice: decimal("sale_price", { precision: 10, scale: 2 }).default("0.00").notNull(), // Selling price
  vatRate: decimal("vat_rate", { precision: 5, scale: 2 }).default("21.00").notNull(), // IVA percentage (21%, 10%, 4%, 0%)
  
  // Stock management
  minStock: integer("min_stock").default(0).notNull(), // Alert when below this
  maxStock: integer("max_stock"), // Optional max stock level
  reorderPoint: integer("reorder_point").default(0), // When to reorder
  reorderQuantity: integer("reorder_quantity"), // Suggested order quantity
  
  // Returnable/Loanable items (tools, equipment)
  isReturnable: boolean("is_returnable").default(false).notNull(), // Can be loaned and returned
  trackingMethod: varchar("tracking_method", { length: 20 }).default("quantity").notNull(), // quantity, serial, lot
  
  // Additional info
  brand: varchar("brand", { length: 100 }),
  model: varchar("model", { length: 100 }),
  location: varchar("location", { length: 100 }), // Default storage location within warehouse
  weight: decimal("weight", { precision: 10, scale: 3 }), // Weight in kg
  dimensions: varchar("dimensions", { length: 50 }), // LxWxH in cm
  
  // Media
  imageUrl: text("image_url"),
  
  // Status
  isActive: boolean("is_active").default(true).notNull(),
  isService: boolean("is_service").default(false).notNull(), // Service (no stock) vs physical product
  
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("products_company_idx").on(table.companyId),
  categoryIdx: index("products_category_idx").on(table.categoryId),
  skuIdx: index("products_sku_idx").on(table.companyId, table.sku),
}));

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

// Warehouse Stock - Stock levels per product per warehouse
export const warehouseStock = pgTable("warehouse_stock", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  warehouseId: integer("warehouse_id").notNull().references(() => warehouses.id, { onDelete: 'cascade' }),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: 'cascade' }),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).default("0").notNull(), // Current stock
  reservedQuantity: decimal("reserved_quantity", { precision: 10, scale: 2 }).default("0").notNull(), // Reserved for pending orders
  availableQuantity: decimal("available_quantity", { precision: 10, scale: 2 }).default("0").notNull(), // quantity - reserved
  lastCountDate: timestamp("last_count_date"), // Last physical inventory count
  lastCountQuantity: decimal("last_count_quantity", { precision: 10, scale: 2 }), // Quantity at last count
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  warehouseProductIdx: index("warehouse_stock_warehouse_product_idx").on(table.warehouseId, table.productId),
  productIdx: index("warehouse_stock_product_idx").on(table.productId),
  companyIdx: index("warehouse_stock_company_idx").on(table.companyId),
}));

export const insertWarehouseStockSchema = createInsertSchema(warehouseStock).omit({
  id: true,
  updatedAt: true,
});

export type WarehouseStock = typeof warehouseStock.$inferSelect;
export type InsertWarehouseStock = z.infer<typeof insertWarehouseStockSchema>;

// Inventory Movements - Header for all inventory transactions (delivery notes/albaranes)
export const inventoryMovements = pgTable("inventory_movements", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  
  // Movement identification
  movementNumber: varchar("movement_number", { length: 30 }).notNull(), // Sequential: ALB-2024-00001
  movementType: varchar("movement_type", { length: 20 }).notNull(), // in, out, internal, loan, return
  internalReason: varchar("internal_reason", { length: 30 }), // For 'internal' type: 'adjustment' (stock correction) or 'transfer' (warehouse move)
  adjustmentDirection: varchar("adjustment_direction", { length: 10 }), // For adjustments: 'add' (increase stock) or 'remove' (decrease stock)
  
  // Status flow: draft -> posted -> archived (or cancelled)
  status: varchar("status", { length: 20 }).default("draft").notNull(),
  
  // Warehouses involved
  sourceWarehouseId: integer("source_warehouse_id").references(() => warehouses.id), // From (for out/transfer/loan)
  destinationWarehouseId: integer("destination_warehouse_id").references(() => warehouses.id), // To (for in/transfer/return)
  
  // Related party info (client, supplier, employee for loan)
  relatedPartyType: varchar("related_party_type", { length: 20 }), // client, supplier, employee, project
  relatedPartyId: integer("related_party_id"), // ID of client/supplier/employee
  relatedPartyName: varchar("related_party_name", { length: 200 }), // Denormalized name
  relatedPartyCif: varchar("related_party_cif", { length: 20 }), // CIF/NIF for delivery notes
  relatedPartyAddress: text("related_party_address"), // Address for delivery notes
  
  // Project/Site reference (for construction companies)
  projectReference: varchar("project_reference", { length: 100 }), // Obra reference
  projectName: varchar("project_name", { length: 200 }),
  projectAddress: text("project_address"),
  
  // Dates
  movementDate: timestamp("movement_date").defaultNow().notNull(),
  expectedReturnDate: timestamp("expected_return_date"), // For loans
  actualReturnDate: timestamp("actual_return_date"), // When loaned items returned
  
  // Totals (calculated from lines)
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).default("0.00").notNull(),
  vatAmount: decimal("vat_amount", { precision: 12, scale: 2 }).default("0.00").notNull(),
  total: decimal("total", { precision: 12, scale: 2 }).default("0.00").notNull(),
  
  // User tracking
  createdById: integer("created_by_id").notNull().references(() => users.id),
  approvedById: integer("approved_by_id").references(() => users.id),
  
  // PDF document
  pdfUrl: text("pdf_url"), // Generated delivery note PDF
  pdfGeneratedAt: timestamp("pdf_generated_at"),
  
  // Signature
  signedBy: varchar("signed_by", { length: 200 }), // Name of person who signed
  signatureImage: text("signature_image"), // Base64 or URL of signature
  signedAt: timestamp("signed_at"),
  
  notes: text("notes"),
  internalNotes: text("internal_notes"), // Not shown on PDF
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("inventory_movements_company_idx").on(table.companyId),
  movementNumberIdx: index("inventory_movements_number_idx").on(table.companyId, table.movementNumber),
  dateIdx: index("inventory_movements_date_idx").on(table.companyId, table.movementDate),
  typeIdx: index("inventory_movements_type_idx").on(table.companyId, table.movementType),
}));

export const insertInventoryMovementSchema = createInsertSchema(inventoryMovements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type InsertInventoryMovement = z.infer<typeof insertInventoryMovementSchema>;

// Inventory Movement Lines - Individual product lines in a movement
export const inventoryMovementLines = pgTable("inventory_movement_lines", {
  id: serial("id").primaryKey(),
  movementId: integer("movement_id").notNull().references(() => inventoryMovements.id, { onDelete: 'cascade' }),
  productId: integer("product_id").notNull().references(() => products.id),
  
  // Quantities
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  returnedQuantity: decimal("returned_quantity", { precision: 10, scale: 2 }).default("0"), // For loans - how many returned
  
  // Pricing at time of movement (snapshot)
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(), // Price per unit
  vatRate: decimal("vat_rate", { precision: 5, scale: 2 }).notNull(), // VAT % at time of movement
  discount: decimal("discount", { precision: 5, scale: 2 }).default("0"), // Discount percentage
  
  // Line totals
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(), // quantity * unitPrice - discount
  vatAmount: decimal("vat_amount", { precision: 12, scale: 2 }).notNull(),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  
  // Serial/Lot tracking (optional)
  serialNumbers: text("serial_numbers"), // JSON array of serial numbers
  lotNumber: varchar("lot_number", { length: 50 }),
  expirationDate: date("expiration_date"),
  
  // Condition tracking (for returnable items)
  conditionOut: varchar("condition_out", { length: 50 }), // new, good, fair, needs_repair
  conditionIn: varchar("condition_in", { length: 50 }), // Condition when returned
  conditionNotes: text("condition_notes"),
  
  notes: text("notes"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  movementIdx: index("inventory_movement_lines_movement_idx").on(table.movementId),
  productIdx: index("inventory_movement_lines_product_idx").on(table.productId),
}));

export const insertInventoryMovementLineSchema = createInsertSchema(inventoryMovementLines).omit({
  id: true,
  createdAt: true,
});

export type InventoryMovementLine = typeof inventoryMovementLines.$inferSelect;
export type InsertInventoryMovementLine = z.infer<typeof insertInventoryMovementLineSchema>;

// Tool Loans - Track returnable items that are out on loan
export const toolLoans = pgTable("tool_loans", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  productId: integer("product_id").notNull().references(() => products.id),
  movementId: integer("movement_id").notNull().references(() => inventoryMovements.id), // Original loan movement
  returnMovementId: integer("return_movement_id").references(() => inventoryMovements.id), // Return movement when returned
  
  // Loan details
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  returnedQuantity: decimal("returned_quantity", { precision: 10, scale: 2 }).default("0").notNull(),
  
  // Who has the item
  assignedToId: integer("assigned_to_id").references(() => users.id), // Employee who has the item
  assignedToName: varchar("assigned_to_name", { length: 200 }), // Denormalized name
  projectReference: varchar("project_reference", { length: 100 }), // Obra/project
  projectName: varchar("project_name", { length: 200 }),
  
  // Dates
  loanDate: timestamp("loan_date").notNull(),
  expectedReturnDate: timestamp("expected_return_date"),
  actualReturnDate: timestamp("actual_return_date"),
  
  // Status: active (out), partial_return (some returned), returned, overdue
  status: varchar("status", { length: 20 }).default("active").notNull(),
  
  // Condition tracking
  conditionOut: varchar("condition_out", { length: 50 }).default("good"),
  conditionIn: varchar("condition_in", { length: 50 }),
  damageNotes: text("damage_notes"),
  
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("tool_loans_company_idx").on(table.companyId),
  productIdx: index("tool_loans_product_idx").on(table.productId),
  statusIdx: index("tool_loans_status_idx").on(table.companyId, table.status),
  assignedIdx: index("tool_loans_assigned_idx").on(table.assignedToId),
}));

export const insertToolLoanSchema = createInsertSchema(toolLoans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ToolLoan = typeof toolLoans.$inferSelect;
export type InsertToolLoan = z.infer<typeof insertToolLoanSchema>;

// Movement Number Sequence - Track sequential numbering for delivery notes
export const movementSequences = pgTable("movement_sequences", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }).unique(),
  prefix: varchar("prefix", { length: 10 }).default("ALB").notNull(), // ALB for albarán
  currentYear: integer("current_year").notNull(),
  lastNumber: integer("last_number").default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMovementSequenceSchema = createInsertSchema(movementSequences).omit({
  id: true,
  updatedAt: true,
});

export type MovementSequence = typeof movementSequences.$inferSelect;
export type InsertMovementSequence = z.infer<typeof insertMovementSequenceSchema>;
