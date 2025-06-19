import { pgTable, text, serial, integer, boolean, timestamp, decimal, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Companies table
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  logo: text("logo"),
  workingHoursStart: text("working_hours_start").notNull().default("09:00"),
  workingHoursEnd: text("working_hours_end").notNull().default("17:00"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  role: text("role").notNull().default("employee"), // admin, manager, employee
  companyId: integer("company_id").references(() => companies.id).notNull(),
  vacationDaysTotal: integer("vacation_days_total").notNull().default(20),
  vacationDaysUsed: integer("vacation_days_used").notNull().default(0),
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
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = insertUserSchema.extend({
  confirmPassword: z.string(),
  companyName: z.string().min(1, "Company name is required"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Types
export type Company = typeof companies.$inferSelect;
export type User = typeof users.$inferSelect;
export type WorkSession = typeof workSessions.$inferSelect;
export type VacationRequest = typeof vacationRequests.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type Message = typeof messages.$inferSelect;

export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertWorkSession = z.infer<typeof insertWorkSessionSchema>;
export type InsertVacationRequest = z.infer<typeof insertVacationRequestSchema>;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type LoginData = z.infer<typeof loginSchema>;
export type RegisterData = z.infer<typeof registerSchema>;
