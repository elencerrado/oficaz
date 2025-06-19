import { pgTable, text, serial, integer, boolean, timestamp, decimal, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Companies table
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  cif: text("cif").notNull().unique(),
  email: text("email").notNull().unique(),
  contactName: text("contact_name").notNull(),
  companyAlias: text("company_alias").notNull().unique(),
  phone: text("phone"),
  address: text("address"),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const companyConfigs = pgTable("company_configs", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  workingHoursStart: text("working_hours_start").notNull().default("08:00"),
  workingHoursEnd: text("working_hours_end").notNull().default("17:00"),
  workingDays: integer("working_days").array().notNull().default([1, 2, 3, 4, 5]),
  payrollSendDays: text("payroll_send_days").notNull().default("1"),
  defaultVacationPolicy: decimal("default_vacation_policy", { precision: 3, scale: 1 }).notNull().default("2.5"),
  language: text("language").notNull().default("es"),
  timezone: text("timezone").notNull().default("Europe/Madrid"),
  customAiRules: text("custom_ai_rules").default(""),
  allowManagersToGrantRoles: boolean("allow_managers_to_grant_roles").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  dni: text("dni").notNull().unique(), // DNI is required and unique
  phoneNumber: text("phone_number"),
  role: text("role").notNull().default("employee"), // admin, manager, employee
  companyId: integer("company_id").references(() => companies.id).notNull(),
  startDate: timestamp("start_date").defaultNow().notNull(),
  vacationDaysBalance: decimal("vacation_days_balance", { precision: 4, scale: 1 }).notNull().default("0.0"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Work sessions table
export const workSessions = pgTable("work_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  clockIn: timestamp("clock_in").notNull(),
  clockOut: timestamp("clock_out"),
  totalHours: decimal("total_hours", { precision: 4, scale: 2 }),
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Documents table
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),
  uploadedBy: integer("uploaded_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Messages table
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").references(() => users.id).notNull(),
  receiverId: integer("receiver_id").references(() => users.id).notNull(),
  subject: text("subject").notNull(),
  content: text("content").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas
export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
});

export const insertCompanyConfigSchema = createInsertSchema(companyConfigs).omit({
  id: true,
  createdAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertWorkSessionSchema = createInsertSchema(workSessions).omit({
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
  contactName: z.string().min(1, "Nombre de contacto requerido"),
  companyAlias: z.string().min(1, "Alias de empresa requerido").regex(/^[a-zA-Z0-9-]+$/, "Solo letras, números y guiones"),
  phone: z.string().optional(),
  address: z.string().optional(),
  logoUrl: z.string().optional(),
  
  // Admin user fields
  adminFullName: z.string().min(1, "Nombre completo requerido"),
  adminDni: z.string().min(1, "DNI/NIE requerido"),
  adminPhoneNumber: z.string().optional(),
  password: z.string().min(6, "Contraseña debe tener al menos 6 caracteres"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

// Types
export type Company = typeof companies.$inferSelect;
export type CompanyConfig = typeof companyConfigs.$inferSelect;
export type User = typeof users.$inferSelect;
export type WorkSession = typeof workSessions.$inferSelect;
export type VacationRequest = typeof vacationRequests.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type Message = typeof messages.$inferSelect;

export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type InsertCompanyConfig = z.infer<typeof insertCompanyConfigSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertWorkSession = z.infer<typeof insertWorkSessionSchema>;
export type InsertVacationRequest = z.infer<typeof insertVacationRequestSchema>;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type LoginData = z.infer<typeof loginSchema>;
export type CompanyRegistrationData = z.infer<typeof companyRegistrationSchema>;
