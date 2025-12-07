import { eq, and, or, desc, sql, lte, gte, lt, isNotNull, isNull, inArray, asc, ne } from 'drizzle-orm';
import * as schema from '@shared/schema';
import type {
  Company, User, WorkSession, BreakPeriod, VacationRequest, Document, Message, SystemNotification,
  InsertCompany, InsertUser, InsertWorkSession, InsertBreakPeriod, InsertVacationRequest, InsertDocument, InsertMessage, InsertSystemNotification,
  WorkSessionAuditLog, InsertWorkSessionAuditLog,
  WorkSessionModificationRequest, InsertWorkSessionModificationRequest,
  Reminder, InsertReminder, SuperAdmin, InsertSuperAdmin, 
  Subscription, InsertSubscription, SubscriptionPlan, InsertSubscriptionPlan,
  EmployeeActivationToken, InsertEmployeeActivationToken,
  CustomHoliday, InsertCustomHoliday,
  WorkAlarm, InsertWorkAlarm,
  WorkShift, InsertWorkShift,
  PromotionalCode, InsertPromotionalCode,
  ImageProcessingJob, InsertImageProcessingJob,
  EmailCampaign, InsertEmailCampaign,
  EmailProspect, InsertEmailProspect,
  EmailCampaignSend, InsertEmailCampaignSend,
  AbsencePolicy, InsertAbsencePolicy
} from '@shared/schema';
import Stripe from 'stripe';
import { db } from './db';

// Extended type for work sessions with audit trail information
export type WorkSessionWithAudit = WorkSession & {
  userName?: string;
  profilePicture?: string | null;
  breakPeriods?: BreakPeriod[];
  auditLogs?: Array<WorkSessionAuditLog & { modifiedByName?: string | null }>;
  lastModifiedByName?: string | null;
};

// Initialize Stripe
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY environment variable is required');
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-05-28.basil',
});

export interface IStorage {
  // Companies
  createCompany(company: InsertCompany): Promise<Company>;
  getCompany(id: number): Promise<Company | undefined>;
  getCompanyByCif?(cif: string): Promise<Company | undefined>;
  getCompanyByEmail?(email: string): Promise<Company | undefined>;
  getCompanyByAlias?(alias: string): Promise<Company | undefined>;
  getCompanyByUserId(userId: number): Promise<any | undefined>;
  getAllCompanies(): Promise<Company[]>;
  updateCompany(id: number, updates: Partial<InsertCompany>): Promise<Company | undefined>;

  // Company configuration is now part of companies table - no separate methods needed

  // Users
  createUser(user: InsertUser): Promise<User>;
  getUser(id: number): Promise<User | undefined>;
  getUserByDni(dni: string): Promise<User | undefined>;
  getUserByDniAndCompany(dni: string, companyId: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsersByCompany(companyId: number): Promise<User[]>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined>;
  updateUserSignature(userId: number, signatureUrl: string): Promise<User | undefined>;
  deleteUser(id: number): Promise<User | undefined>;

  // 🔒 SECURITY: Refresh Tokens for JWT rotation
  createRefreshToken(userId: number, hashedToken: string, expiresAt: Date): Promise<any>;
  getRefreshToken(token: string): Promise<any | undefined>;
  getRefreshTokensForUser(userId: number): Promise<any[]>;
  updateRefreshTokenUsage(hashedToken: string): Promise<void>;
  revokeRefreshToken(hashedToken: string): Promise<void>;
  revokeAllUserRefreshTokens(userId: number): Promise<void>;
  deleteExpiredRefreshTokens(): Promise<void>;

  // 🔒 SECURITY: Signed URLs for secure document downloads
  createSignedUrl(documentId: number, userId: number, companyId: number, expiresAt: Date): Promise<any>;
  consumeSignedUrl(token: string): Promise<any | undefined>; // Atomic get-and-consume
  getSignedUrl(token: string): Promise<any | undefined>;
  markSignedUrlAsUsed(token: string): Promise<void>;
  deleteExpiredSignedUrls(): Promise<void>;

  // Work Sessions
  createWorkSession(session: InsertWorkSession): Promise<WorkSession>;
  getActiveWorkSession(userId: number): Promise<WorkSession | undefined>;
  getWorkSession(id: number): Promise<WorkSession | undefined>;
  updateWorkSession(id: number, updates: Partial<InsertWorkSession>): Promise<WorkSession | undefined>;
  getWorkSessionsByUser(userId: number, limit?: number): Promise<WorkSession[]>;
  getWorkSessionsByCompany(companyId: number, limit?: number, offset?: number, filters?: {
    employeeId?: number;
    startDate?: Date;
    endDate?: Date;
    status?: 'active' | 'completed' | 'incomplete';
  }): Promise<{ sessions: WorkSessionWithAudit[]; totalCount: number }>;
  markOldSessionsAsIncomplete(userId: number): Promise<void>;

  // Break periods
  createBreakPeriod(breakPeriod: InsertBreakPeriod): Promise<BreakPeriod>;
  getActiveBreakPeriod(userId: number): Promise<BreakPeriod | undefined>;
  getBreakPeriodsByUser(userId: number): Promise<BreakPeriod[]>;
  updateBreakPeriod(id: number, updates: Partial<InsertBreakPeriod>): Promise<BreakPeriod | undefined>;
  updateWorkSessionBreakTime(workSessionId: number): Promise<void>;

  // Vacation/Absence Requests
  createVacationRequest(request: InsertVacationRequest): Promise<VacationRequest>;
  getVacationRequestsByUser(userId: number): Promise<VacationRequest[]>;
  getVacationRequestsByCompany(companyId: number): Promise<VacationRequest[]>;
  updateVacationRequest(id: number, updates: Partial<InsertVacationRequest>): Promise<VacationRequest | undefined>;

  // Absence Policies
  getAbsencePoliciesByCompany(companyId: number): Promise<AbsencePolicy[]>;
  getAbsencePolicy(id: number): Promise<AbsencePolicy | undefined>;
  createAbsencePolicy(policy: InsertAbsencePolicy): Promise<AbsencePolicy>;
  updateAbsencePolicy(id: number, updates: Partial<InsertAbsencePolicy>): Promise<AbsencePolicy | undefined>;
  deleteAbsencePolicy(id: number): Promise<boolean>;
  initializeDefaultAbsencePolicies(companyId: number): Promise<void>;

  // Documents
  createDocument(document: InsertDocument): Promise<Document>;
  getDocumentsByUser(userId: number): Promise<Document[]>;
  getDocumentsByCompany(companyId: number): Promise<any[]>;
  getDocument(id: number): Promise<Document | undefined>;
  deleteDocument(id: number): Promise<boolean>;
  deleteOrphanedDocuments(documentIds: number[]): Promise<{ deleted: number; failed: number[] }>;
  
  // Document signature methods
  markDocumentAsViewed(id: number): Promise<Document | undefined>;
  markDocumentAsAcceptedAndSigned(id: number, digitalSignature: string): Promise<Document | undefined>;

  // Messages
  createMessage(message: InsertMessage): Promise<Message>;
  getMessagesByUser(userId: number): Promise<Message[]>;
  markMessageAsRead(id: number): Promise<Message | undefined>;
  getUnreadMessageCount(userId: number): Promise<number>;

  // Unified Notifications
  getNotificationsByUser(userId: number): Promise<SystemNotification[]>;
  getNotificationsByCategory(userId: number, category: string): Promise<SystemNotification[]>;
  createNotification(notification: InsertSystemNotification): Promise<SystemNotification>;
  markNotificationRead(id: number): Promise<SystemNotification | undefined>;
  markNotificationCompleted(id: number): Promise<SystemNotification | undefined>;
  getUnreadNotificationCount(userId: number): Promise<number>;
  getUnreadNotificationCountByCategory(userId: number, category: string): Promise<number>;

  // Document Notifications using unified notifications system
  getDocumentNotificationsByUser(userId: number): Promise<SystemNotification[]>;
  getDocumentNotificationsByCompany(companyId: number): Promise<SystemNotification[]>;
  createDocumentNotification(userId: number, documentType: string, message: string, createdBy: number, priority?: string, dueDate?: Date): Promise<SystemNotification>;
  deleteNotification(id: number): Promise<boolean>;

  // Custom Holidays
  getCustomHolidaysByCompany(companyId: number): Promise<CustomHoliday[]>;
  createCustomHoliday(holiday: InsertCustomHoliday): Promise<CustomHoliday>;
  deleteCustomHoliday(id: number): Promise<boolean>;

  // Reminders
  createReminder(reminder: InsertReminder): Promise<Reminder>;
  getRemindersByUser(userId: number): Promise<Reminder[]>;
  getRemindersByCompany(companyId: number, adminUserId: number): Promise<Reminder[]>;
  getReminder(id: number): Promise<Reminder | undefined>;
  updateReminder(id: number, updates: Partial<InsertReminder>): Promise<Reminder | undefined>;
  deleteReminder(id: number): Promise<boolean>;
  getActiveReminders(userId: number): Promise<Reminder[]>;
  getDashboardReminders(userId: number): Promise<Reminder[]>;
  
  // Reminder Assignments (using array-based approach)
  assignReminderToUsers(reminderId: number, userIds: number[], assignedBy: number): Promise<any>;
  removeUserFromReminderAssignment(reminderId: number, userId: number): Promise<boolean>;
  clearReminderAssignments(reminderId: number): Promise<boolean>;
  getReminderAssignments(reminderId: number): Promise<any[]>;
  getRemindersByUserWithAssignments(userId: number): Promise<any[]>;
  
  // Reminder Notifications
  getReminderNotificationsDue(userId: number, companyId: number, currentTime: Date): Promise<Reminder[]>;
  markReminderNotificationShown(reminderId: number, userId: number): Promise<boolean>;
  
  // Individual completion
  completeReminderIndividually(reminderId: number, userId: number): Promise<Reminder | undefined>;

  // Employee Activation Tokens
  createActivationToken(token: InsertEmployeeActivationToken): Promise<EmployeeActivationToken>;
  
  // Incomplete Work Sessions Notifications
  createIncompleteSessionNotification(userId: number, workSessionId: number, createdBy: number): Promise<SystemNotification>;
  checkAndCreateIncompleteSessionNotifications(companyId: number): Promise<void>;
  getActivationToken(token: string): Promise<EmployeeActivationToken | undefined>;
  getActivationTokenByUserId(userId: number): Promise<EmployeeActivationToken | undefined>;
  markTokenAsUsed(id: number): Promise<EmployeeActivationToken | undefined>;
  deleteActivationToken(id: number): Promise<boolean>;
  cleanupExpiredTokens(): Promise<number>;

  // Super Admin operations
  getSuperAdminByEmail(email: string): Promise<SuperAdmin | undefined>;
  createSuperAdmin(admin: InsertSuperAdmin): Promise<SuperAdmin>;
  getAllCompaniesWithStats(): Promise<any[]>;
  getSuperAdminStats(): Promise<any>;
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  getSubscriptionByCompanyId(companyId: number): Promise<Subscription | undefined>;
  updateCompanySubscription(companyId: number, updates: any): Promise<any | undefined>;

  // 🔒 SECURITY: Audit logs operations
  createAuditLog(log: schema.InsertAuditLog): Promise<schema.AuditLog>;
  getAuditLogs(limit?: number, offset?: number): Promise<schema.AuditLog[]>;
  getAuditLogsByAction(action: string, limit?: number): Promise<schema.AuditLog[]>;
  getAuditLogsByEmail(email: string, limit?: number): Promise<schema.AuditLog[]>;

  // Subscription Plans operations
  getAllSubscriptionPlans(): Promise<SubscriptionPlan[]>;
  getSubscriptionPlan(id: number): Promise<SubscriptionPlan | undefined>;
  getSubscriptionPlanByName(name: string): Promise<SubscriptionPlan | undefined>;
  createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan>;
  updateSubscriptionPlan(id: number, updates: Partial<InsertSubscriptionPlan>): Promise<SubscriptionPlan | undefined>;
  deleteSubscriptionPlan(id: number): Promise<boolean>;

  // Registration Settings operations
  getRegistrationSettings(): Promise<any>;
  updateRegistrationSettings(updates: any): Promise<any>;
  
  // Invitation Links operations  
  createInvitationLink(invitation: any): Promise<any>;
  getInvitationByToken(token: string): Promise<any>;
  getActiveInvitationByEmail(email: string): Promise<any>;
  getAllInvitationLinks(): Promise<any[]>;
  deleteInvitationLink(id: number): Promise<boolean>;
  markInvitationAsUsed(id: number): Promise<boolean>;
  
  // Features operations
  
  // Account deletion operations
  scheduleCompanyDeletion(companyId: number): Promise<boolean>;
  cancelAccountDeletion(companyId: number): Promise<boolean>;
  deleteCompanyPermanently(companyId: number): Promise<boolean>;
  getCompaniesReadyForDeletion(): Promise<any[]>;
  
  // Company subscription operations
  getCompanySubscription(companyId: number): Promise<any | undefined>;
  cancelCompanyDeletion(companyId: number): Promise<boolean>;
  
  // Work Alarms operations
  createWorkAlarm(alarm: InsertWorkAlarm): Promise<WorkAlarm>;
  getWorkAlarmsByUser(userId: number): Promise<WorkAlarm[]>;
  getWorkAlarm(id: number): Promise<WorkAlarm | undefined>;
  updateWorkAlarm(id: number, updates: Partial<InsertWorkAlarm>): Promise<WorkAlarm | undefined>;
  deleteWorkAlarm(id: number): Promise<boolean>;
  getActiveWorkAlarmsByUser(userId: number): Promise<WorkAlarm[]>;

  // Work Shifts (Cuadrante) operations
  createWorkShift(shift: InsertWorkShift): Promise<WorkShift>;
  getWorkShiftsByCompany(companyId: number, startDate?: string, endDate?: string): Promise<WorkShift[]>;
  getWorkShiftsByEmployee(employeeId: number, startDate?: string, endDate?: string): Promise<WorkShift[]>;
  updateWorkShift(id: number, updates: Partial<InsertWorkShift>): Promise<WorkShift | undefined>;
  deleteWorkShift(id: number): Promise<boolean>;
  replicateWeekShifts(companyId: number, weekStart: string, offsetWeeks?: number, employeeIds?: number[]): Promise<WorkShift[]>;
  swapEmployeeShifts(employeeAId: number, employeeBId: number, startDate?: string, endDate?: string): Promise<{ success: boolean; swappedCount: number; conflicts?: string[] }>;

  // Promotional Codes
  createPromotionalCode(code: InsertPromotionalCode): Promise<PromotionalCode>;
  getPromotionalCode(id: number): Promise<PromotionalCode | undefined>;
  getPromotionalCodeByCode(code: string): Promise<PromotionalCode | undefined>;
  getAllPromotionalCodes(): Promise<PromotionalCode[]>;
  updatePromotionalCode(id: number, updates: Partial<InsertPromotionalCode>): Promise<PromotionalCode | undefined>;
  deletePromotionalCode(id: number): Promise<boolean>;
  validatePromotionalCode(code: string): Promise<{ valid: boolean; message?: string; trialDays?: number }>;
  redeemPromotionalCode(code: string): Promise<{ success: boolean; message?: string; trialDays?: number }>;
  
  // Atomic promotional code application after company creation
  redeemAndApplyPromotionalCode(companyId: number, code: string): Promise<{ success: boolean; message?: string; trialDays?: number; updatedCompany?: Company }>;

  // Image Processing Jobs
  createImageProcessingJob(job: InsertImageProcessingJob): Promise<ImageProcessingJob>;
  getImageProcessingJob(id: number): Promise<ImageProcessingJob | undefined>;
  updateImageProcessingJob(id: number, updates: Partial<InsertImageProcessingJob & Pick<ImageProcessingJob, 'status' | 'errorMessage' | 'startedAt' | 'completedAt'>>): Promise<ImageProcessingJob | undefined>;
  getPendingImageProcessingJobs(): Promise<ImageProcessingJob[]>;
  getImageProcessingJobsByUser(userId: number): Promise<ImageProcessingJob[]>;

  // Email Marketing
  getAllEmailCampaigns(): Promise<any[]>;
  getEmailCampaignById(id: number): Promise<any | undefined>;
  getAllEmailProspects(): Promise<any[]>;
  getRegisteredUsersStats(): Promise<{ total: number; active: number; trial: number; blocked: number; cancelled: number }>;
  createEmailProspect(prospect: any): Promise<any>;
  updateEmailProspect(id: number, updates: any): Promise<any>;
  createEmailCampaign(campaign: any): Promise<any>;
  updateEmailCampaign(id: number, updates: any): Promise<any>;
  deleteEmailCampaign(id: number): Promise<boolean>;
  deleteEmailProspect(id: number): Promise<boolean>;

  // Work Session Audit Log (Legal compliance RD-ley 8/2019)
  createWorkSessionAuditLog(log: InsertWorkSessionAuditLog): Promise<WorkSessionAuditLog>;
  getWorkSessionAuditLogs(workSessionId: number): Promise<WorkSessionAuditLog[]>;
  getCompanyAuditLogs(companyId: number, limit?: number): Promise<WorkSessionAuditLog[]>;

  // Work Session Modification Requests (Employee-initiated)
  createModificationRequest(request: InsertWorkSessionModificationRequest): Promise<WorkSessionModificationRequest>;
  getModificationRequest(id: number): Promise<WorkSessionModificationRequest | undefined>;
  getEmployeeModificationRequests(employeeId: number): Promise<WorkSessionModificationRequest[]>;
  getCompanyModificationRequests(companyId: number, status?: string): Promise<WorkSessionModificationRequest[]>;
  updateModificationRequest(id: number, updates: Partial<InsertWorkSessionModificationRequest>): Promise<WorkSessionModificationRequest | undefined>;
  getPendingModificationRequestsCount(companyId: number): Promise<number>;

  // Work Reports (Partes de Trabajo) - Pro feature
  createWorkReport(report: schema.InsertWorkReport & { durationMinutes: number }): Promise<schema.WorkReport>;
  getWorkReport(id: number): Promise<schema.WorkReport | undefined>;
  getWorkReportsByUser(userId: number, filters?: { startDate?: string; endDate?: string }): Promise<schema.WorkReport[]>;
  getWorkReportsByCompany(companyId: number, filters?: { employeeId?: number; startDate?: string; endDate?: string }): Promise<(schema.WorkReport & { employeeName: string; employeeSignature?: string | null })[]>;
  updateWorkReport(id: number, updates: Partial<schema.InsertWorkReport> & { durationMinutes?: number }): Promise<schema.WorkReport | undefined>;
  deleteWorkReport(id: number): Promise<boolean>;
  
  // Work Reports - Lightweight autocomplete queries (optimized)
  getWorkReportRefCodes(userId: number): Promise<string[]>;
  getWorkReportLocations(userId: number): Promise<string[]>;
  getWorkReportClients(userId: number): Promise<string[]>;
  // Admin: Company-wide autocomplete
  getCompanyWorkReportLocations(companyId: number): Promise<string[]>;
  getCompanyWorkReportClients(companyId: number): Promise<string[]>;
  getCompanyWorkReportRefCodes(companyId: number): Promise<string[]>;

  // Add-ons Store
  getAllAddons(): Promise<schema.Addon[]>;
  getActiveAddons(): Promise<schema.Addon[]>;
  getAddon(id: number): Promise<schema.Addon | undefined>;
  getAddonByKey(key: string): Promise<schema.Addon | undefined>;
  createAddon(addon: schema.InsertAddon): Promise<schema.Addon>;
  updateAddon(id: number, updates: Partial<schema.InsertAddon>): Promise<schema.Addon | undefined>;
  
  // Company Add-ons (purchases)
  getCompanyAddons(companyId: number): Promise<(schema.CompanyAddon & { addon: schema.Addon })[]>;
  getCompanyAddon(companyId: number, addonId: number): Promise<schema.CompanyAddon | undefined>;
  getCompanyAddonByKey(companyId: number, addonKey: string): Promise<(schema.CompanyAddon & { addon: schema.Addon }) | undefined>;
  createCompanyAddon(companyAddon: schema.InsertCompanyAddon): Promise<schema.CompanyAddon>;
  updateCompanyAddon(id: number, updates: Partial<schema.InsertCompanyAddon>): Promise<schema.CompanyAddon | undefined>;
  cancelCompanyAddon(companyId: number, addonId: number, effectiveDate: Date): Promise<schema.CompanyAddon | undefined>;
  hasActiveAddon(companyId: number, addonKey: string): Promise<boolean>;

  // ═══════════════════════════════════════════════════════════════════════════
  // INVENTORY MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Product Categories
  getProductCategories(companyId: number): Promise<schema.ProductCategory[]>;
  getProductCategory(id: number): Promise<schema.ProductCategory | undefined>;
  createProductCategory(category: schema.InsertProductCategory): Promise<schema.ProductCategory>;
  updateProductCategory(id: number, updates: Partial<schema.InsertProductCategory>): Promise<schema.ProductCategory | undefined>;
  deleteProductCategory(id: number): Promise<boolean>;
  
  // Warehouses
  getWarehouses(companyId: number): Promise<schema.Warehouse[]>;
  getWarehouse(id: number): Promise<schema.Warehouse | undefined>;
  createWarehouse(warehouse: schema.InsertWarehouse): Promise<schema.Warehouse>;
  updateWarehouse(id: number, updates: Partial<schema.InsertWarehouse>): Promise<schema.Warehouse | undefined>;
  deleteWarehouse(id: number): Promise<boolean>;
  
  // Products
  getProducts(companyId: number, filters?: { categoryId?: number; isActive?: boolean; isReturnable?: boolean; search?: string }): Promise<schema.Product[]>;
  getProduct(id: number): Promise<schema.Product | undefined>;
  createProduct(product: schema.InsertProduct): Promise<schema.Product>;
  updateProduct(id: number, updates: Partial<schema.InsertProduct>): Promise<schema.Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;
  
  // Warehouse Stock
  getWarehouseStock(companyId: number, warehouseId?: number): Promise<(schema.WarehouseStock & { product: schema.Product; warehouse: schema.Warehouse })[]>;
  getProductStock(productId: number): Promise<(schema.WarehouseStock & { warehouse: schema.Warehouse })[]>;
  updateWarehouseStock(warehouseId: number, productId: number, quantity: number, companyId: number): Promise<schema.WarehouseStock>;
  getLowStockProducts(companyId: number): Promise<(schema.Product & { totalStock: number })[]>;
  
  // Inventory Movements
  getInventoryMovements(companyId: number, filters?: { type?: string; status?: string; startDate?: Date; endDate?: Date; warehouseId?: number }): Promise<(schema.InventoryMovement & { createdBy: { fullName: string }; lines: schema.InventoryMovementLine[] })[]>;
  getInventoryMovement(id: number): Promise<(schema.InventoryMovement & { createdBy: { fullName: string }; lines: (schema.InventoryMovementLine & { product: schema.Product })[] }) | undefined>;
  createInventoryMovement(movement: schema.InsertInventoryMovement): Promise<schema.InventoryMovement>;
  updateInventoryMovement(id: number, updates: Partial<schema.InsertInventoryMovement>): Promise<schema.InventoryMovement | undefined>;
  deleteInventoryMovement(id: number): Promise<boolean>;
  
  // Movement Lines
  createInventoryMovementLine(line: schema.InsertInventoryMovementLine): Promise<schema.InventoryMovementLine>;
  updateInventoryMovementLine(id: number, updates: Partial<schema.InsertInventoryMovementLine>): Promise<schema.InventoryMovementLine | undefined>;
  deleteInventoryMovementLine(id: number): Promise<boolean>;
  
  // Movement Sequences (for sequential numbering)
  getNextMovementNumber(companyId: number): Promise<string>;
  
  // Tool Loans
  getToolLoans(companyId: number, filters?: { status?: string; assignedToId?: number; productId?: number }): Promise<(schema.ToolLoan & { product: schema.Product; assignedTo?: { fullName: string } })[]>;
  getToolLoan(id: number): Promise<schema.ToolLoan | undefined>;
  createToolLoan(loan: schema.InsertToolLoan): Promise<schema.ToolLoan>;
  updateToolLoan(id: number, updates: Partial<schema.InsertToolLoan>): Promise<schema.ToolLoan | undefined>;
  getOverdueToolLoans(companyId: number): Promise<(schema.ToolLoan & { product: schema.Product })[]>;
}

export class DrizzleStorage implements IStorage {
  // Companies
  async createCompany(company: InsertCompany): Promise<Company> {
    const [result] = await db.insert(schema.companies).values(company).returning();
    return result;
  }

  async getCompany(id: number): Promise<Company | undefined> {
    const [company] = await db.select().from(schema.companies).where(eq(schema.companies.id, id));
    return company;
  }

  async getAllCompanies(): Promise<Company[]> {
    return await db.select().from(schema.companies);
  }

  async updateCompany(id: number, updates: Partial<InsertCompany>): Promise<Company | undefined> {
    const [updatedCompany] = await db
      .update(schema.companies)
      .set(updates)
      .where(eq(schema.companies.id, id))
      .returning();
    return updatedCompany || undefined;
  }

  async getCompanyByCif(cif: string): Promise<Company | undefined> {
    const [company] = await db.select().from(schema.companies).where(eq(schema.companies.cif, cif));
    return company;
  }

  async getCompanyByEmail(email: string): Promise<Company | undefined> {
    const [company] = await db.select().from(schema.companies).where(eq(schema.companies.email, email));
    return company;
  }

  async getCompanyByAlias(alias: string): Promise<Company | undefined> {
    const [company] = await db.select().from(schema.companies).where(eq(schema.companies.companyAlias, alias));
    return company;
  }

  // Company configuration methods are no longer needed - configuration is now part of companies table

  // Users
  async createUser(user: InsertUser): Promise<User> {
    const [result] = await db.insert(schema.users).values(user).returning();
    return result;
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return user;
  }

  async getUserByDni(dni: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(sql`UPPER(${schema.users.dni}) = UPPER(${dni})`);
    return user;
  }

  async getUserByDniAndCompany(dni: string, companyId: number): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users)
      .where(and(sql`UPPER(${schema.users.dni}) = UPPER(${dni})`, eq(schema.users.companyId, companyId)));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    // First try company email
    let [user] = await db.select().from(schema.users).where(sql`LOWER(${schema.users.companyEmail}) = LOWER(${email})`);
    
    // If not found, try personal email
    if (!user) {
      [user] = await db.select().from(schema.users).where(sql`LOWER(${schema.users.personalEmail}) = LOWER(${email})`);
    }
    
    return user;
  }

  async getUsersByCompany(companyId: number): Promise<User[]> {
    // Looking for users by company
    const result = await db.select().from(schema.users).where(eq(schema.users.companyId, companyId));
    // Found users by company
    return result;
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(schema.users).set(updates).where(eq(schema.users.id, id)).returning();
    return user;
  }

  async updateUserSignature(userId: number, signatureUrl: string): Promise<User | undefined> {
    const [user] = await db
      .update(schema.users)
      .set({ signatureImage: signatureUrl })
      .where(eq(schema.users.id, userId))
      .returning();
    return user;
  }

  async deleteUser(id: number): Promise<User | undefined> {
    const [user] = await db.delete(schema.users).where(eq(schema.users.id, id)).returning();
    return user;
  }

  // Calculate vacation days based on Spanish labor law and company policy
  async calculateVacationDays(userId: number): Promise<number> {
    const user = await this.getUser(userId);
    if (!user) return 0;

    const company = await this.getCompany(user.companyId);
    // Use vacationDaysPerMonth as primary source, fallback to defaultVacationPolicy for backwards compatibility
    const companyDaysPerMonth = parseFloat(company?.vacationDaysPerMonth || company?.defaultVacationPolicy || '2.5');
    const userDaysPerMonth = user.vacationDaysPerMonth ? parseFloat(user.vacationDaysPerMonth) : companyDaysPerMonth;
    
    const startDate = new Date(user.startDate);
    const currentDate = new Date();
    
    // Spanish labor law: vacation period calculation
    const oneYearFromStart = new Date(startDate);
    oneYearFromStart.setFullYear(startDate.getFullYear() + 1);
    
    let calculatedDays: number;
    
    if (currentDate >= oneYearFromStart) {
      // Employee has more than 1 year: vacation period is Feb 1 - Jan 31 (12 months max)
      // Use full year allowance (12 months worth)
      calculatedDays = Math.round((12 * userDaysPerMonth) * 10) / 10;
    } else {
      // Employee has less than 1 year: from start date to Jan 31 of next year
      const nextJan31 = new Date(startDate.getFullYear() + 1, 0, 31); // Jan 31 of next year
      const endDate = currentDate > nextJan31 ? nextJan31 : currentDate;
      
      // Calculate months from start date to end date (proportional)
      const monthsWorked = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                           (endDate.getMonth() - startDate.getMonth()) + 
                           (endDate.getDate() >= startDate.getDate() ? 1 : 0);
      
      // Cap at 12 months maximum
      const cappedMonths = Math.min(12, monthsWorked);
      calculatedDays = Math.round((cappedMonths * userDaysPerMonth) * 10) / 10;
    }
    
    const adjustment = parseFloat(user.vacationDaysAdjustment || '0');
    
    return Math.max(0, calculatedDays + adjustment);
  }

  // Update user's vacation days automatically
  async updateUserVacationDays(userId: number): Promise<User | undefined> {
    const calculatedDays = await this.calculateVacationDays(userId);
    return this.updateUser(userId, { totalVacationDays: calculatedDays.toString() });
  }

  // 🔒 SECURITY: Refresh Token Management
  // Note: token parameter should already be hashed before calling this
  async createRefreshToken(userId: number, hashedToken: string, expiresAt: Date): Promise<any> {
    const [refreshToken] = await db.insert(schema.refreshTokens).values({
      userId,
      token: hashedToken, // Store hashed token
      expiresAt,
      revoked: false
    }).returning();
    return refreshToken;
  }

  // 🔒 SECURITY: Get all non-revoked tokens for a user (returns hashed tokens for comparison)
  async getRefreshTokensForUser(userId: number): Promise<any[]> {
    const tokens = await db.select().from(schema.refreshTokens)
      .where(and(
        eq(schema.refreshTokens.userId, userId),
        eq(schema.refreshTokens.revoked, false),
        gte(schema.refreshTokens.expiresAt, new Date()) // Only non-expired
      ));
    return tokens;
  }

  async getRefreshToken(token: string): Promise<any | undefined> {
    // This is now used only for updating lastUsedAt with hashed token
    const [refreshToken] = await db.select().from(schema.refreshTokens)
      .where(and(
        eq(schema.refreshTokens.token, token), // token here is already hashed
        eq(schema.refreshTokens.revoked, false)
      ));
    return refreshToken;
  }

  async updateRefreshTokenUsage(token: string): Promise<void> {
    await db.update(schema.refreshTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(schema.refreshTokens.token, token));
  }

  async revokeRefreshToken(token: string): Promise<void> {
    await db.update(schema.refreshTokens)
      .set({ revoked: true })
      .where(eq(schema.refreshTokens.token, token));
  }

  async revokeAllUserRefreshTokens(userId: number): Promise<void> {
    await db.update(schema.refreshTokens)
      .set({ revoked: true })
      .where(eq(schema.refreshTokens.userId, userId));
  }

  async deleteExpiredRefreshTokens(): Promise<void> {
    await db.delete(schema.refreshTokens)
      .where(or(
        lte(schema.refreshTokens.expiresAt, new Date()),
        eq(schema.refreshTokens.revoked, true)
      ));
  }

  // 🔒 SECURITY: Signed URLs for secure document downloads
  async createSignedUrl(documentId: number, userId: number, companyId: number, expiresAt: Date): Promise<any> {
    // Generate a random token
    const crypto = await import('crypto');
    const token = crypto.randomBytes(32).toString('hex');

    const [signedUrl] = await db.insert(schema.signedUrls).values({
      token,
      documentId,
      userId,
      companyId,
      expiresAt,
      used: false
    }).returning();
    return signedUrl;
  }

  // 🔒 SECURITY: Atomic get-and-consume to prevent TOCTOU race conditions
  async consumeSignedUrl(token: string): Promise<any | undefined> {
    // Atomic operation: Update only if not used and not expired, return the updated row
    const [signedUrl] = await db.update(schema.signedUrls)
      .set({ 
        used: true,
        usedAt: new Date()
      })
      .where(and(
        eq(schema.signedUrls.token, token),
        eq(schema.signedUrls.used, false), // Only if not already used
        gte(schema.signedUrls.expiresAt, new Date()) // Only if not expired
      ))
      .returning();
    
    // Returns undefined if token was already used, expired, or doesn't exist
    return signedUrl;
  }

  async getSignedUrl(token: string): Promise<any | undefined> {
    const [signedUrl] = await db.select().from(schema.signedUrls)
      .where(and(
        eq(schema.signedUrls.token, token),
        eq(schema.signedUrls.used, false),
        gte(schema.signedUrls.expiresAt, new Date()) // Not expired
      ));
    return signedUrl;
  }

  async markSignedUrlAsUsed(token: string): Promise<void> {
    await db.update(schema.signedUrls)
      .set({ 
        used: true,
        usedAt: new Date()
      })
      .where(eq(schema.signedUrls.token, token));
  }

  async deleteExpiredSignedUrls(): Promise<void> {
    await db.delete(schema.signedUrls)
      .where(or(
        lt(schema.signedUrls.expiresAt, new Date()),
        eq(schema.signedUrls.used, true)
      ));
  }

  // Work Sessions
  async createWorkSession(session: InsertWorkSession): Promise<WorkSession> {
    const [result] = await db.insert(schema.workSessions).values(session).returning();
    return result;
  }

  async getActiveWorkSession(userId: number): Promise<WorkSession | undefined> {
    // Check for sessions that are truly active (status 'active', not 'incomplete')
    const [activeSession] = await db.select().from(schema.workSessions)
      .where(and(
        eq(schema.workSessions.userId, userId), 
        eq(schema.workSessions.status, 'active'),
        isNull(schema.workSessions.clockOut)
      ))
      .orderBy(desc(schema.workSessions.clockIn))
      .limit(1);
    
    return activeSession;
  }

  async getWorkSession(id: number): Promise<WorkSession | undefined> {
    const [session] = await db.select().from(schema.workSessions)
      .where(eq(schema.workSessions.id, id))
      .limit(1);
    return session;
  }

  async updateWorkSession(id: number, updates: Partial<InsertWorkSession>): Promise<WorkSession | undefined> {
    const [session] = await db.update(schema.workSessions).set(updates).where(eq(schema.workSessions.id, id)).returning();
    return session;
  }

  async getWorkSessionsByUser(userId: number, limit = 1000): Promise<WorkSession[]> {
    return db.select().from(schema.workSessions)
      .where(eq(schema.workSessions.userId, userId))
      .orderBy(desc(schema.workSessions.clockIn))
      .limit(limit);
  }

  async getWorkSessionsByCompany(
    companyId: number, 
    limit: number = 50, 
    offset: number = 0,
    filters?: {
      employeeId?: number;
      startDate?: Date;
      endDate?: Date;
      status?: 'active' | 'completed' | 'incomplete';
    }
  ): Promise<{ sessions: WorkSessionWithAudit[]; totalCount: number }> {
    // Build WHERE conditions dynamically
    const conditions = [eq(schema.users.companyId, companyId)];
    
    if (filters?.employeeId) {
      conditions.push(eq(schema.workSessions.userId, filters.employeeId));
    }
    
    if (filters?.startDate) {
      conditions.push(gte(schema.workSessions.clockIn, filters.startDate));
    }
    
    if (filters?.endDate) {
      conditions.push(lte(schema.workSessions.clockIn, filters.endDate));
    }
    
    if (filters?.status) {
      conditions.push(eq(schema.workSessions.status, filters.status));
    }
    
    // Get total count first (fast indexed query)
    const [countResult] = await db.select({ 
      count: sql<number>`count(*)::int` 
    }).from(schema.workSessions)
      .innerJoin(schema.users, eq(schema.workSessions.userId, schema.users.id))
      .where(and(...conditions));
    
    const totalCount = countResult?.count || 0;
    
    // Get paginated sessions
    const sessions = await db.select({
      id: schema.workSessions.id,
      userId: schema.workSessions.userId,
      clockIn: schema.workSessions.clockIn,
      clockOut: schema.workSessions.clockOut,
      totalHours: schema.workSessions.totalHours,
      totalBreakTime: schema.workSessions.totalBreakTime,
      status: schema.workSessions.status,
      autoCompleted: schema.workSessions.autoCompleted,
      isManuallyCreated: schema.workSessions.isManuallyCreated,
      lastModifiedAt: schema.workSessions.lastModifiedAt,
      lastModifiedBy: schema.workSessions.lastModifiedBy,
      createdAt: schema.workSessions.createdAt,
      clockInLatitude: schema.workSessions.clockInLatitude,
      clockInLongitude: schema.workSessions.clockInLongitude,
      clockOutLatitude: schema.workSessions.clockOutLatitude,
      clockOutLongitude: schema.workSessions.clockOutLongitude,
      userName: schema.users.fullName,
      profilePicture: schema.users.profilePicture,
    }).from(schema.workSessions)
      .innerJoin(schema.users, eq(schema.workSessions.userId, schema.users.id))
      .where(and(...conditions))
      .orderBy(desc(schema.workSessions.clockIn))
      .limit(limit)
      .offset(offset);

    // Quick exit for empty results
    if (sessions.length === 0) {
      return { sessions: [], totalCount };
    }

    // Get all session IDs for batch break periods query
    const sessionIds = sessions.map(s => s.id);
    
    // Single optimized query for all break periods (restored functionality)
    const allBreakPeriods = await db.select().from(schema.breakPeriods)
      .where(inArray(schema.breakPeriods.workSessionId, sessionIds))
      .orderBy(schema.breakPeriods.workSessionId, schema.breakPeriods.breakStart);

    // Group break periods by session ID for O(1) lookup
    const breakPeriodsMap = new Map<number, any[]>();
    allBreakPeriods.forEach(bp => {
      if (!breakPeriodsMap.has(bp.workSessionId)) {
        breakPeriodsMap.set(bp.workSessionId, []);
      }
      breakPeriodsMap.get(bp.workSessionId)!.push(bp);
    });

    // ⚠️ PERFORMANCE OPTIMIZATION: Audit logs removed from batch loading
    // Audit logs are now loaded lazily when needed via /api/admin/work-sessions/:id/audit-log
    // This significantly reduces payload size and improves query performance

    // Get audit log counts for each session (lightweight check)
    const auditLogCounts = await db.select({
      workSessionId: schema.workSessionAuditLog.workSessionId,
      count: sql<number>`count(*)::int`,
    }).from(schema.workSessionAuditLog)
      .where(inArray(schema.workSessionAuditLog.workSessionId, sessionIds))
      .groupBy(schema.workSessionAuditLog.workSessionId);

    const auditCountMap = new Map<number, number>();
    auditLogCounts.forEach(ac => {
      auditCountMap.set(ac.workSessionId, ac.count);
    });

    // Get modifier names for lastModifiedBy field only
    const modifierIds = new Set<number>();
    sessions.forEach(s => {
      if (s.lastModifiedBy) modifierIds.add(s.lastModifiedBy);
    });

    // Get modifier user info
    const modifiersMap = new Map<number, string>();
    if (modifierIds.size > 0) {
      const modifiers = await db.select({
        id: schema.users.id,
        fullName: schema.users.fullName,
      }).from(schema.users)
        .where(inArray(schema.users.id, Array.from(modifierIds)));
      
      modifiers.forEach(m => modifiersMap.set(m.id, m.fullName));
    }

    // Combine sessions with their break periods and modifier names efficiently
    const enrichedSessions = sessions.map(session => {
      return {
        ...session,
        breakPeriods: breakPeriodsMap.get(session.id) || [],
        auditLogs: [], // Empty by default - load lazily when needed
        hasAuditLogs: (auditCountMap.get(session.id) || 0) > 0, // Lightweight indicator
        lastModifiedByName: session.lastModifiedBy ? modifiersMap.get(session.lastModifiedBy) : null,
      };
    });
    
    return { sessions: enrichedSessions, totalCount };
  }

  // Optimized aggregated stats for Summary tab (no individual sessions loaded)
  async getWorkSessionsStats(
    companyId: number,
    startDate?: Date,
    endDate?: Date,
    userId?: number // Optional: filter to specific user for self-access mode
  ): Promise<{ employeeId: number; totalHours: number; totalBreakHours: number; sessionCount: number }[]> {
    // Build conditions
    const conditions = [eq(schema.users.companyId, companyId)];
    
    // Filter to specific user if provided (self-access mode)
    if (userId) {
      conditions.push(eq(schema.workSessions.userId, userId));
    }
    
    if (startDate) {
      conditions.push(gte(schema.workSessions.clockIn, startDate));
    }
    if (endDate) {
      conditions.push(lte(schema.workSessions.clockIn, endDate));
    }
    
    // Single optimized SQL query that calculates totals per employee
    const stats = await db.select({
      employeeId: schema.workSessions.userId,
      sessionCount: sql<number>`count(*)::int`,
      // Calculate total work hours (clockOut - clockIn) in hours
      totalHours: sql<number>`
        COALESCE(
          SUM(
            CASE 
              WHEN ${schema.workSessions.clockOut} IS NOT NULL 
              THEN EXTRACT(EPOCH FROM (${schema.workSessions.clockOut} - ${schema.workSessions.clockIn})) / 3600.0
              ELSE 0 
            END
          ), 
          0
        )::float
      `,
    }).from(schema.workSessions)
      .innerJoin(schema.users, eq(schema.workSessions.userId, schema.users.id))
      .where(and(...conditions))
      .groupBy(schema.workSessions.userId);

    // Get break periods totals separately (more efficient than subquery)
    const breakStats = await db.select({
      userId: schema.breakPeriods.userId,
      totalBreakHours: sql<number>`
        COALESCE(
          SUM(
            CASE 
              WHEN ${schema.breakPeriods.breakEnd} IS NOT NULL 
              THEN EXTRACT(EPOCH FROM (${schema.breakPeriods.breakEnd} - ${schema.breakPeriods.breakStart})) / 3600.0
              ELSE 0 
            END
          ), 
          0
        )::float
      `,
    }).from(schema.breakPeriods)
      .innerJoin(schema.workSessions, eq(schema.breakPeriods.workSessionId, schema.workSessions.id))
      .innerJoin(schema.users, eq(schema.workSessions.userId, schema.users.id))
      .where(and(...conditions))
      .groupBy(schema.breakPeriods.userId);

    // Merge break stats into main stats
    const breakMap = new Map(breakStats.map(b => [b.userId, b.totalBreakHours]));
    
    return stats.map(s => ({
      employeeId: s.employeeId,
      totalHours: Number(s.totalHours) || 0,
      totalBreakHours: breakMap.get(s.employeeId) || 0,
      sessionCount: s.sessionCount,
    }));
  }

  // Break Periods
  async createBreakPeriod(breakPeriod: InsertBreakPeriod): Promise<BreakPeriod> {
    const [result] = await db.insert(schema.breakPeriods).values(breakPeriod).returning();
    return result;
  }

  async getActiveBreakPeriod(userId: number): Promise<BreakPeriod | undefined> {
    // First get the active work session for the user
    const activeSession = await this.getActiveWorkSession(userId);
    if (!activeSession) {
      return undefined; // No active session means no valid break period
    }

    // Only return break periods that belong to the current active work session
    const [breakPeriod] = await db.select().from(schema.breakPeriods)
      .where(and(
        eq(schema.breakPeriods.userId, userId), 
        eq(schema.breakPeriods.status, 'active'),
        eq(schema.breakPeriods.workSessionId, activeSession.id)
      ));
    return breakPeriod;
  }

  async updateBreakPeriod(id: number, updates: Partial<InsertBreakPeriod>): Promise<BreakPeriod | undefined> {
    const [breakPeriod] = await db.update(schema.breakPeriods).set(updates).where(eq(schema.breakPeriods.id, id)).returning();
    return breakPeriod;
  }

  // ⚠️ PROTECTED - DO NOT MODIFY - Critical function for data integrity
  async closeOrphanedBreakPeriods(userId: number): Promise<void> {
    // Find and close any active break periods that don't belong to an active session
    // This prevents break periods from lingering when sessions are closed improperly
    await db.update(schema.breakPeriods)
      .set({
        breakEnd: new Date(),
        status: 'completed'
      })
      .where(and(
        eq(schema.breakPeriods.userId, userId),
        eq(schema.breakPeriods.status, 'active')
      ));
  }

  // ⚠️ PROTECTED - Automatically mark old sessions as incomplete
  // Sessions are only marked incomplete after: workingHoursPerDay + 4 hours margin
  async markOldSessionsAsIncomplete(userId: number): Promise<void> {
    try {
      // Get user's company settings for working hours
      const user = await this.getUser(userId);
      if (!user) return;

      const company = await this.getCompany(user.companyId);
      const maxHours = Number(company?.workingHoursPerDay) || 8;
      const marginHours = 4; // 4 hours margin - CRITICAL: DO NOT REDUCE
      const totalMaxHours = maxHours + marginHours; // Total: 12 hours for 8-hour workday
      const now = new Date();
      
      // Calculate cutoff time (now - maxHours - marginHours)
      // Example: If now is 20:00 and totalMaxHours is 12, cutoff is 08:00
      // Only sessions that started BEFORE 08:00 will be marked incomplete
      const cutoffTime = new Date(now.getTime() - (totalMaxHours * 60 * 60 * 1000));

      // First, check if there are any sessions that would be affected
      const sessionsToMark = await db.select({
        id: schema.workSessions.id,
        clockIn: schema.workSessions.clockIn,
        status: schema.workSessions.status
      })
        .from(schema.workSessions)
        .where(and(
          eq(schema.workSessions.userId, userId),
          eq(schema.workSessions.status, 'active'),
          isNull(schema.workSessions.clockOut),
          sql`${schema.workSessions.clockIn} < ${cutoffTime}`
        ));

      if (sessionsToMark.length > 0) {
        console.log(`⚠️ Marking ${sessionsToMark.length} session(s) as incomplete for user ${userId}:`);
        console.log(`   Now: ${now.toISOString()}, Cutoff: ${cutoffTime.toISOString()} (${totalMaxHours}h = ${maxHours}h work + ${marginHours}h margin)`);
        sessionsToMark.forEach(s => {
          const hoursElapsed = (now.getTime() - new Date(s.clockIn).getTime()) / (1000 * 60 * 60);
          console.log(`   Session ${s.id}: started ${new Date(s.clockIn).toISOString()}, elapsed: ${hoursElapsed.toFixed(2)}h`);
        });
      }

      // Find and mark sessions that started before cutoff time as incomplete
      await db.update(schema.workSessions)
        .set({
          status: 'incomplete'
        })
        .where(and(
          eq(schema.workSessions.userId, userId),
          eq(schema.workSessions.status, 'active'),
          isNull(schema.workSessions.clockOut),
          sql`${schema.workSessions.clockIn} < ${cutoffTime}`
        ));
    } catch (error) {
      console.error('Error marking old sessions as incomplete:', error);
    }
  }

  async updateWorkSessionBreakTime(workSessionId: number): Promise<void> {
    // Calculate total break time for this work session
    const breakPeriods = await db.select().from(schema.breakPeriods)
      .where(and(
        eq(schema.breakPeriods.workSessionId, workSessionId),
        eq(schema.breakPeriods.status, 'completed')
      ));

    // Sum up all break durations
    const totalBreakTime = breakPeriods.reduce((total, period) => {
      return total + (parseFloat(period.duration || '0'));
    }, 0);

    // Update the work session with total break time
    await db.update(schema.workSessions)
      .set({ totalBreakTime: totalBreakTime.toFixed(2) })
      .where(eq(schema.workSessions.id, workSessionId));
  }

  async getBreakPeriodsByUser(userId: number): Promise<BreakPeriod[]> {
    const breakPeriods = await db.select().from(schema.breakPeriods)
      .where(eq(schema.breakPeriods.userId, userId))
      .orderBy(desc(schema.breakPeriods.breakStart));
    return breakPeriods;
  }

  // Vacation Requests
  async createVacationRequest(request: InsertVacationRequest): Promise<VacationRequest> {
    const [result] = await db.insert(schema.vacationRequests).values(request).returning();
    return result;
  }

  async getVacationRequestsByUser(userId: number): Promise<VacationRequest[]> {
    return db.select().from(schema.vacationRequests)
      .where(eq(schema.vacationRequests.userId, userId))
      .orderBy(desc(schema.vacationRequests.createdAt));
  }

  async getVacationRequestsByCompany(companyId: number): Promise<VacationRequest[]> {
    const result = await db.select({
      id: schema.vacationRequests.id,
      userId: schema.vacationRequests.userId,
      startDate: schema.vacationRequests.startDate,
      endDate: schema.vacationRequests.endDate,
      reason: schema.vacationRequests.reason,
      status: schema.vacationRequests.status,
      reviewedBy: schema.vacationRequests.reviewedBy,
      reviewedAt: schema.vacationRequests.reviewedAt,
      createdAt: schema.vacationRequests.createdAt,
      absenceType: schema.vacationRequests.absenceType,
      attachmentPath: schema.vacationRequests.attachmentPath,
      // User information
      userFullName: schema.users.fullName,
      userEmail: schema.users.companyEmail
    }).from(schema.vacationRequests)
      .innerJoin(schema.users, eq(schema.vacationRequests.userId, schema.users.id))
      .where(eq(schema.users.companyId, companyId))
      .orderBy(desc(schema.vacationRequests.createdAt));
    
    // Transform the result to include user object and handle missing fields
    return result.map(request => ({
      id: request.id,
      userId: request.userId,
      startDate: request.startDate,
      endDate: request.endDate,
      days: 0, // Calculate or default
      reason: request.reason,
      status: request.status,
      requestDate: request.createdAt || new Date().toISOString(), // Use createdAt as requestDate
      approvedBy: request.reviewedBy,
      approvedDate: request.reviewedAt,
      createdAt: request.createdAt,
      updatedAt: request.createdAt,
      absenceType: request.absenceType || 'vacation',
      attachmentPath: request.attachmentPath,
      user: {
        fullName: request.userFullName,
        email: request.userEmail
      }
    })) as any;
  }

  async updateVacationRequest(id: number, updates: Partial<InsertVacationRequest>): Promise<VacationRequest | undefined> {
    const [request] = await db.update(schema.vacationRequests).set(updates).where(eq(schema.vacationRequests.id, id)).returning();
    return request;
  }

  // Absence Policies
  async getAbsencePoliciesByCompany(companyId: number): Promise<AbsencePolicy[]> {
    return db.select().from(schema.absencePolicies)
      .where(eq(schema.absencePolicies.companyId, companyId))
      .orderBy(asc(schema.absencePolicies.id));
  }

  async getAbsencePolicy(id: number): Promise<AbsencePolicy | undefined> {
    const [policy] = await db.select().from(schema.absencePolicies)
      .where(eq(schema.absencePolicies.id, id));
    return policy;
  }

  async createAbsencePolicy(policy: InsertAbsencePolicy): Promise<AbsencePolicy> {
    const [result] = await db.insert(schema.absencePolicies).values(policy).returning();
    return result;
  }

  async updateAbsencePolicy(id: number, updates: Partial<InsertAbsencePolicy>): Promise<AbsencePolicy | undefined> {
    const [policy] = await db.update(schema.absencePolicies)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.absencePolicies.id, id))
      .returning();
    return policy;
  }

  async deleteAbsencePolicy(id: number): Promise<boolean> {
    const result = await db.delete(schema.absencePolicies)
      .where(eq(schema.absencePolicies.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Initialize default absence policies for a company (Spain labor law defaults)
  async initializeDefaultAbsencePolicies(companyId: number): Promise<void> {
    const defaultPolicies: InsertAbsencePolicy[] = [
      { companyId, absenceType: 'maternity_paternity', name: 'Maternidad / Paternidad (Nacimiento)', maxDays: 112, requiresAttachment: false, isActive: true },
      { companyId, absenceType: 'marriage', name: 'Matrimonio o registro de pareja de hecho', maxDays: 15, requiresAttachment: false, isActive: true },
      { companyId, absenceType: 'family_death', name: 'Fallecimiento de familiar hasta 2º grado', maxDays: 2, requiresAttachment: false, isActive: true },
      { companyId, absenceType: 'family_death_travel', name: 'Fallecimiento de familiar hasta 2º grado con desplazamiento', maxDays: 4, requiresAttachment: false, isActive: true },
      { companyId, absenceType: 'family_illness', name: 'Enfermedad grave, accidente u hospitalización de familiar', maxDays: 2, requiresAttachment: false, isActive: true },
      { companyId, absenceType: 'family_illness_travel', name: 'Enfermedad grave, accidente u hospitalización de familiar con desplazamiento', maxDays: 4, requiresAttachment: false, isActive: true },
      { companyId, absenceType: 'home_relocation', name: 'Traslado de domicilio habitual', maxDays: 1, requiresAttachment: false, isActive: true },
      { companyId, absenceType: 'public_duty', name: 'Deber público o personal inexcusable', maxDays: null, requiresAttachment: true, isActive: true },
      { companyId, absenceType: 'temporary_disability', name: 'Incapacidad Temporal (baja médica)', maxDays: null, requiresAttachment: false, isActive: true },
    ];

    // Check if policies already exist
    const existing = await this.getAbsencePoliciesByCompany(companyId);
    if (existing.length === 0) {
      for (const policy of defaultPolicies) {
        await this.createAbsencePolicy(policy);
      }
    }
  }

  // Documents
  async createDocument(document: InsertDocument): Promise<Document> {
    const [result] = await db.insert(schema.documents).values(document).returning();
    return result;
  }

  async getDocumentsByUser(userId: number): Promise<Document[]> {
    return db.select().from(schema.documents)
      .where(eq(schema.documents.userId, userId))
      .orderBy(desc(schema.documents.createdAt));
  }

  async getDocumentsByCompany(companyId: number): Promise<any[]> {
    // Simple query using SQL to avoid Drizzle issues
    const result = await db.execute(sql`
      SELECT 
        d.id,
        d.user_id as "userId",
        d.file_name as "fileName", 
        d.original_name as "originalName",
        d.file_size as "fileSize",
        d.created_at as "createdAt",
        d.is_viewed as "isViewed",
        d.is_accepted as "isAccepted",
        d.accepted_at as "acceptedAt",
        d.signed_at as "signedAt",
        d.requires_signature as "requiresSignature",
        u.full_name as "userFullName",
        u.profile_picture as "userProfilePicture"
      FROM documents d 
      LEFT JOIN users u ON d.user_id = u.id 
      WHERE u.company_id = ${companyId}
      ORDER BY d.created_at DESC
    `);
    
    // Transform to expected format
    return result.rows.map((row: any) => ({
      id: row.id,
      userId: row.userId,
      fileName: row.fileName,
      originalName: row.originalName,
      fileSize: row.fileSize,
      createdAt: row.createdAt,
      isViewed: row.isViewed || false,
      isAccepted: row.isAccepted || false,
      acceptedAt: row.acceptedAt,
      signedAt: row.signedAt,
      requiresSignature: row.requiresSignature || false,
      user: {
        fullName: row.userFullName || 'Usuario desconocido',
        profilePicture: row.userProfilePicture || null
      }
    }));
  }

  async getDocument(id: number): Promise<Document | undefined> {
    const [document] = await db.select().from(schema.documents).where(eq(schema.documents.id, id));
    return document;
  }

  async deleteDocument(id: number): Promise<boolean> {
    const result = await db.delete(schema.documents).where(eq(schema.documents.id, id));
    return result.rowCount > 0;
  }

  async deleteOrphanedDocuments(documentIds: number[]): Promise<{ deleted: number; failed: number[] }> {
    const failed: number[] = [];
    let deleted = 0;

    for (const id of documentIds) {
      try {
        const result = await db.delete(schema.documents).where(eq(schema.documents.id, id));
        if (result.rowCount > 0) {
          deleted++;
          console.log(`🧹 ORPHAN CLEANUP: Deleted document record ${id}`);
        } else {
          failed.push(id);
        }
      } catch (error) {
        console.error(`🧹 ORPHAN CLEANUP ERROR: Failed to delete document ${id}:`, error);
        failed.push(id);
      }
    }

    return { deleted, failed };
  }

  // Document signature methods
  async markDocumentAsViewed(id: number): Promise<Document | undefined> {
    const [document] = await db.update(schema.documents)
      .set({ isViewed: true })
      .where(eq(schema.documents.id, id))
      .returning();
    return document;
  }

  async markDocumentAsAcceptedAndSigned(id: number, digitalSignature: string): Promise<Document | undefined> {
    const now = new Date();
    const [document] = await db.update(schema.documents)
      .set({ 
        isAccepted: true,
        acceptedAt: now,
        digitalSignature: digitalSignature,
        signedAt: now
      })
      .where(eq(schema.documents.id, id))
      .returning();
    return document;
  }

  // Messages
  async createMessage(message: InsertMessage): Promise<Message> {
    const [result] = await db.insert(schema.messages).values(message).returning();
    return result;
  }

  async getMessagesByUser(userId: number): Promise<Message[]> {
    return db.select().from(schema.messages)
      .where(or(eq(schema.messages.receiverId, userId), eq(schema.messages.senderId, userId)))
      .orderBy(desc(schema.messages.createdAt));
  }

  async markMessageAsRead(id: number): Promise<Message | undefined> {
    const [message] = await db.update(schema.messages)
      .set({ isRead: true })
      .where(eq(schema.messages.id, id))
      .returning();
    return message;
  }

  async getUnreadMessageCount(userId: number): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(schema.messages)
      .where(and(
        eq(schema.messages.receiverId, userId), 
        eq(schema.messages.isRead, false),
        ne(schema.messages.senderId, userId)
      ));
    return result.count;
  }

  // Document Notifications methods using unified notifications
  async getDocumentNotificationsByUser(userId: number): Promise<SystemNotification[]> {
    return await db.select().from(schema.systemNotifications)
      .where(and(
        eq(schema.systemNotifications.userId, userId),
        eq(schema.systemNotifications.type, 'document')
      ))
      .orderBy(desc(schema.systemNotifications.createdAt));
  }

  async getDocumentNotificationsByCompany(companyId: number): Promise<SystemNotification[]> {
    const results = await db.execute(sql`
      SELECT 
        n.*,
        u.full_name as "userFullName",
        d.id as "documentId",
        d.original_name as "documentOriginalName",
        d.file_size as "documentFileSize",
        d.created_at as "documentCreatedAt"
      FROM notifications n
      LEFT JOIN users u ON n.user_id = u.id  
      LEFT JOIN documents d ON (
        d.user_id = n.user_id AND 
        d.created_at > n.created_at AND
        n.is_completed = true
      )
      WHERE u.company_id = ${companyId} AND n.type = 'document'
      ORDER BY n.created_at DESC
    `);

    return results.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      type: row.type,
      category: row.category,
      title: row.title,
      message: row.message,
      actionUrl: row.action_url,
      dueDate: row.due_date,
      priority: row.priority,
      isRead: row.is_read,
      isCompleted: row.is_completed,
      metadata: row.metadata,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      // Add user information for frontend
      user: row.userFullName ? { fullName: row.userFullName } : undefined,
      // Add document information when available
      document: row.documentId ? {
        id: row.documentId,
        originalName: row.documentOriginalName,
        fileSize: row.documentFileSize,
        createdAt: row.documentCreatedAt
      } : undefined,
      // Add documentType from metadata for frontend compatibility
      documentType: (() => {
        try {
          const metadata = row.metadata ? JSON.parse(row.metadata) : {};
          return metadata.documentType || row.title?.replace('Documento solicitado: ', '') || 'Documento';
        } catch {
          return row.title?.replace('Documento solicitado: ', '') || 'Documento';
        }
      })()
    })) as SystemNotification[];
  }

  async createDocumentNotification(userId: number, documentType: string, message: string, createdBy: number, priority: string = 'medium', dueDate?: Date): Promise<SystemNotification> {
    const notification: InsertSystemNotification = {
      userId,
      type: 'document',
      category: 'documents',
      title: `Documento solicitado: ${documentType}`,
      message,
      priority,
      dueDate,
      isRead: false,
      isCompleted: false,
      metadata: JSON.stringify({ documentType }),
      createdBy
    };
    
    const [result] = await db
      .insert(schema.systemNotifications)
      .values(notification)
      .returning();
    return result;
  }

  async markNotificationCompleted(id: number): Promise<SystemNotification | undefined> {
    const [result] = await db.update(schema.systemNotifications)
      .set({ isCompleted: true, updatedAt: new Date() })
      .where(eq(schema.systemNotifications.id, id))
      .returning();
    return result;
  }

  async deleteNotification(id: number): Promise<boolean> {
    const result = await db.delete(schema.systemNotifications)
      .where(eq(schema.systemNotifications.id, id));
    return result.rowCount > 0;
  }

  // Unified Notifications implementation
  async getNotificationsByUser(userId: number): Promise<SystemNotification[]> {
    return await db.select().from(schema.systemNotifications)
      .where(eq(schema.systemNotifications.userId, userId))
      .orderBy(desc(schema.systemNotifications.createdAt));
  }

  async getNotificationsByCategory(userId: number, category: string): Promise<SystemNotification[]> {
    return await db.select().from(schema.systemNotifications)
      .where(and(
        eq(schema.systemNotifications.userId, userId),
        eq(schema.systemNotifications.category, category)
      ))
      .orderBy(desc(schema.systemNotifications.createdAt));
  }

  async createNotification(notification: InsertSystemNotification): Promise<SystemNotification> {
    const [result] = await db.insert(schema.systemNotifications).values(notification).returning();
    return result;
  }

  async markNotificationRead(id: number): Promise<SystemNotification | undefined> {
    const [result] = await db.update(schema.systemNotifications)
      .set({ isRead: true, updatedAt: new Date() })
      .where(eq(schema.systemNotifications.id, id))
      .returning();
    return result;
  }

  async markNotificationCompletedUnified(id: number): Promise<SystemNotification | undefined> {
    const [result] = await db.update(schema.systemNotifications)
      .set({ isCompleted: true, updatedAt: new Date() })
      .where(eq(schema.systemNotifications.id, id))
      .returning();
    return result;
  }

  async getUnreadNotificationCount(userId: number): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(schema.systemNotifications)
      .where(and(
        eq(schema.systemNotifications.userId, userId),
        eq(schema.systemNotifications.isRead, false)
      ));
    return result.count;
  }

  async getUnreadNotificationCountByCategory(userId: number, category: string): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(schema.systemNotifications)
      .where(and(
        eq(schema.systemNotifications.userId, userId),
        eq(schema.systemNotifications.category, category),
        eq(schema.systemNotifications.isRead, false)
      ));
    return result.count;
  }

  // Super Admin operations
  async getSuperAdminByEmail(email: string): Promise<any | undefined> {
    const [admin] = await db.select().from(schema.superAdmins).where(eq(schema.superAdmins.email, email));
    return admin;
  }

  async createSuperAdmin(admin: any): Promise<any> {
    const [newAdmin] = await db.insert(schema.superAdmins).values(admin).returning();
    return newAdmin;
  }

  async getAllCompaniesWithStats(): Promise<any[]> {
    const result = await db
      .select({
        id: schema.companies.id,
        name: schema.companies.name,
        cif: schema.companies.cif,
        email: schema.companies.email,
        alias: schema.companies.companyAlias,
        createdAt: schema.companies.createdAt,
        trialDurationDays: schema.companies.trialDurationDays,
        scheduledForDeletion: schema.companies.scheduledForDeletion,
        deletionScheduledAt: schema.companies.deletionScheduledAt,
        isDeleted: schema.companies.isDeleted,
        userCount: sql<number>`count(${schema.users.id})`.as('userCount'),
        subscriptionPlan: schema.subscriptions.plan,
        subscriptionStatus: schema.subscriptions.status,
        subscriptionMaxUsers: schema.subscriptions.maxUsers,
        subscriptionEndDate: schema.subscriptions.endDate,
        stripeSubscriptionId: schema.subscriptions.stripeSubscriptionId,
        promoCodeId: schema.companies.usedPromotionalCode,
        promoCodeText: schema.promotionalCodes.code,
        promoCodeDescription: schema.promotionalCodes.description,
      })
      .from(schema.companies)
      .leftJoin(schema.users, eq(schema.companies.id, schema.users.companyId))
      .leftJoin(schema.subscriptions, eq(schema.companies.id, schema.subscriptions.companyId))
      .leftJoin(schema.promotionalCodes, eq(schema.companies.usedPromotionalCode, schema.promotionalCodes.code))
      .groupBy(
        schema.companies.id, 
        schema.companies.name,
        schema.companies.cif,
        schema.companies.email,
        schema.companies.companyAlias,
        schema.companies.createdAt,
        schema.companies.trialDurationDays,
        schema.companies.scheduledForDeletion,
        schema.companies.deletionScheduledAt,
        schema.companies.isDeleted,
        schema.companies.usedPromotionalCode,
        schema.subscriptions.id,
        schema.subscriptions.plan,
        schema.subscriptions.status,
        schema.subscriptions.maxUsers,
        schema.subscriptions.endDate,
        schema.subscriptions.stripeSubscriptionId,
        schema.promotionalCodes.code,
        schema.promotionalCodes.description
      );

    return result.map(row => {
      // Calculate trial info
      const trialDuration = row.trialDurationDays || 7;
      const trialStartDate = new Date(row.createdAt || new Date());
      const trialEndDate = new Date(trialStartDate);
      trialEndDate.setDate(trialEndDate.getDate() + trialDuration);
      
      const now = new Date();
      const daysRemaining = Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const isTrialActive = daysRemaining > 0;

      return {
        id: row.id,
        name: row.name,
        cif: row.cif,
        email: row.email,
        alias: row.alias,
        userCount: row.userCount || 0,
        subscription: {
          plan: row.subscriptionPlan || 'basic',
          status: row.subscriptionStatus || 'active',
          maxUsers: row.subscriptionMaxUsers || 5,
          endDate: row.subscriptionEndDate?.toISOString(),
          stripeSubscriptionId: row.stripeSubscriptionId,
        },
        promotionalCode: row.promoCodeId ? {
          code: row.promoCodeText,
          description: row.promoCodeDescription,
        } : null,
        trialInfo: {
          daysRemaining: Math.max(0, daysRemaining),
          isTrialActive,
          trialDuration,
        },
        deletionInfo: {
          scheduledForDeletion: row.scheduledForDeletion || false,
          deletionScheduledAt: row.deletionScheduledAt?.toISOString(),
          isDeleted: row.isDeleted || false,
        },
        createdAt: row.createdAt?.toISOString() || new Date().toISOString(),
      };
    });
  }

  async getSuperAdminStats(): Promise<any> {
    // Total companies registered
    const companiesCount = await db.select({ count: sql<number>`count(*)` }).from(schema.companies);
    
    // Total active users across all companies
    const usersCount = await db.select({ count: sql<number>`count(*)` }).from(schema.users);
    
    // Get all subscription stats (including trial and active)
    const allSubscriptionStats = await db
      .select({
        plan: schema.subscriptions.plan,
        count: sql<number>`count(*)`,
      })
      .from(schema.subscriptions)
      .groupBy(schema.subscriptions.plan);

    const planCounts = allSubscriptionStats.reduce((acc, row) => {
      acc[row.plan as keyof typeof acc] = row.count;
      return acc;
    }, { free: 0, basic: 0, pro: 0, master: 0 });

    // Get only active subscriptions for paid count
    const activeSubscriptionStats = await db
      .select({
        plan: schema.subscriptions.plan,
        status: schema.subscriptions.status,
        count: sql<number>`count(*)`,
      })
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.status, 'active'))
      .groupBy(schema.subscriptions.plan, schema.subscriptions.status);

    // Calculate active paid subscriptions (excluding free)
    const activePaidSubscriptions = activeSubscriptionStats.reduce((acc, row) => {
      if (row.plan !== 'free' && row.status === 'active') {
        acc += row.count;
      }
      return acc;
    }, 0);

    // Get real pricing from Stripe for accurate revenue calculation
    let monthlyRevenue = 0;
    
    // Get all active subscriptions with Stripe IDs
    const activeSubscriptions = await db
      .select({
        stripeSubscriptionId: schema.subscriptions.stripeSubscriptionId,
        plan: schema.subscriptions.plan,
      })
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.status, 'active'));

    // Fetch real prices from Stripe
    for (const sub of activeSubscriptions) {
      if (sub.stripeSubscriptionId && sub.plan !== 'free') {
        try {
          const stripeSubscription = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
          
          // Sum up all items in the subscription
          if (stripeSubscription.items?.data) {
            for (const item of stripeSubscription.items.data) {
              const priceAmount = item.price.unit_amount || 0;
              const quantity = item.quantity || 1;
              // Convert from cents to euros and calculate based on billing interval
              const itemPrice = (priceAmount / 100) * quantity;
              
              // If yearly subscription, convert to monthly equivalent
              if (item.price.recurring?.interval === 'year') {
                monthlyRevenue += itemPrice / 12;
              } else {
                monthlyRevenue += itemPrice;
              }
            }
          }
        } catch (error) {
          console.error(`Error fetching Stripe subscription ${sub.stripeSubscriptionId}:`, error);
          // Continue with other subscriptions
        }
      }
    }

    const yearlyRevenue = monthlyRevenue * 12;

    // Calculate ACTUAL accumulated revenue from all paid invoices
    let totalAccumulatedRevenue = 0;
    let currentMonthRevenue = 0;
    
    try {
      // Get current month start timestamp
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthStartTimestamp = Math.floor(monthStart.getTime() / 1000);
      
      // Get all paid invoices from Stripe
      const invoices = await stripe.invoices.list({
        limit: 100, // Get last 100 invoices
        status: 'paid',
      });
      
      // Sum up all paid amounts
      for (const invoice of invoices.data) {
        if (invoice.amount_paid) {
          // Convert from cents to euros
          const amount = invoice.amount_paid / 100;
          totalAccumulatedRevenue += amount;
          
          // Check if invoice was paid in current month
          if (invoice.status_transitions?.paid_at && invoice.status_transitions.paid_at >= monthStartTimestamp) {
            currentMonthRevenue += amount;
          }
        }
      }
    } catch (error) {
      console.error('Error fetching Stripe invoices for accumulated revenue:', error);
    }

    return {
      totalCompanies: companiesCount[0]?.count || 0,
      totalUsers: usersCount[0]?.count || 0,
      activePaidSubscriptions,
      monthlyRevenue,
      yearlyRevenue,
      totalAccumulatedRevenue,
      currentMonthRevenue,
      planDistribution: planCounts,
      // Legacy field for backward compatibility
      activeSubscriptions: activePaidSubscriptions,
      revenue: monthlyRevenue,
    };
  }

  // 🔒 SECURITY: Audit logs operations
  async createAuditLog(log: schema.InsertAuditLog): Promise<schema.AuditLog> {
    const [newLog] = await db.insert(schema.auditLogs).values(log).returning();
    return newLog;
  }

  async getAuditLogs(limit: number = 100, offset: number = 0): Promise<schema.AuditLog[]> {
    return await db.select()
      .from(schema.auditLogs)
      .orderBy(desc(schema.auditLogs.timestamp))
      .limit(limit)
      .offset(offset);
  }

  async getAuditLogsByAction(action: string, limit: number = 100): Promise<schema.AuditLog[]> {
    return await db.select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.action, action))
      .orderBy(desc(schema.auditLogs.timestamp))
      .limit(limit);
  }

  async getAuditLogsByEmail(email: string, limit: number = 100): Promise<schema.AuditLog[]> {
    return await db.select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.email, email))
      .orderBy(desc(schema.auditLogs.timestamp))
      .limit(limit);
  }

  async createSubscription(subscription: any): Promise<any> {
    const [newSubscription] = await db.insert(schema.subscriptions).values(subscription).returning();
    return newSubscription;
  }

  async getSubscriptionByCompanyId(companyId: number): Promise<any | undefined> {
    const [subscription] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.companyId, companyId));
    
    if (!subscription) {
      return undefined;
    }

    // Get company data for trial calculation and custom features
    const [company] = await db.select({
      createdAt: schema.companies.createdAt,
      trialDurationDays: schema.companies.trialDurationDays,
      customFeatures: schema.companies.customFeatures
    }).from(schema.companies).where(eq(schema.companies.id, companyId));

    if (!company?.createdAt) {
      console.warn(`Company ${companyId} has no createdAt date`);
      return subscription;
    }

    // Calculate trial dates from companies.created_at (single source of truth)
    const registrationDate = new Date(company.createdAt);
    const trialEndDate = new Date(registrationDate);
    const trialDuration = company.trialDurationDays || 7;
    trialEndDate.setDate(trialEndDate.getDate() + trialDuration);

    // ═══════════════════════════════════════════════════════════════════════════
    // NEW ADD-ON BASED MODEL - No legacy plan dependencies
    // Features are determined purely by: free add-ons + purchased add-ons + custom settings
    // ═══════════════════════════════════════════════════════════════════════════
    
    // Get all active add-ons from the addons table
    const allAddons = await db.select({ 
      key: schema.addons.key, 
      isFreeFeature: schema.addons.isFreeFeature 
    })
      .from(schema.addons)
      .where(eq(schema.addons.isActive, true));
    
    // Initialize features object
    let finalFeatures: any = {};
    
    // Set all add-ons: free ones = true, paid ones = false (until purchased)
    for (const addon of allAddons) {
      finalFeatures[addon.key] = addon.isFreeFeature;
    }

    // Apply purchased add-ons (active or pending_cancel = still has access)
    const companyAddons = await this.getCompanyAddons(companyId);
    for (const companyAddon of companyAddons) {
      if ((companyAddon.status === 'active' || companyAddon.status === 'pending_cancel') && companyAddon.addon) {
        finalFeatures[companyAddon.addon.key] = true;
      }
    }

    // Apply company-specific custom feature overrides (for special settings like employee_time_edit)
    if (company?.customFeatures && typeof company.customFeatures === 'object') {
      finalFeatures = {
        ...finalFeatures,
        ...company.customFeatures
      };
    }

    // Calculate max users based on subscription seats (NEW MODEL)
    // Base: 1 admin + 1 manager + 10 employees = 12 users
    // Plus any extra seats purchased
    const baseUsers = 12; // 1 admin + 1 manager + 10 employees included in base plan
    const extraUsers = (subscription.extraAdmins || 0) + (subscription.extraManagers || 0) + (subscription.extraEmployees || 0);
    const maxUsers = baseUsers + extraUsers;

    return {
      ...subscription,
      plan: 'oficaz', // Always return 'oficaz' as the plan name (new unified model)
      maxUsers,
      features: finalFeatures,
      startDate: registrationDate.toISOString(),
      trialStartDate: registrationDate.toISOString(),
      trialEndDate: trialEndDate.toISOString(),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DEPRECATED: buildPlanFeatures - Removed as part of legacy cleanup
  // Features are now determined by addons table (isFreeFeature) + companyAddons
  // ═══════════════════════════════════════════════════════════════════════════

  async updateCompanySubscription(companyId: number, updates: any): Promise<any | undefined> {
    const [subscription] = await db
      .update(schema.subscriptions)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(schema.subscriptions.companyId, companyId))
      .returning();
    
    return subscription;
  }

  // Subscription Plans operations
  // NEW MODEL: Single "oficaz" plan - features determined by addons table
  async getAllSubscriptionPlans(): Promise<any[]> {
    // Get all addons to build features object
    const addons = await db.select({ 
      key: schema.addons.key, 
      isFreeFeature: schema.addons.isFreeFeature 
    })
      .from(schema.addons)
      .where(eq(schema.addons.isActive, true));
    
    // Build base features: free addons = true, paid addons = false
    const baseFeatures: any = {};
    for (const addon of addons) {
      baseFeatures[addon.key] = addon.isFreeFeature;
    }

    // Return single unified plan
    return [{
      id: 1,
      name: 'oficaz',
      displayName: 'Oficaz',
      monthlyPrice: 39,
      maxUsers: 12, // 1 admin + 1 manager + 10 employees
      features: baseFeatures,
      isActive: true
    }];
  }

  async getSubscriptionPlan(id: number): Promise<any | undefined> {
    const [plan] = await db.select().from(schema.subscriptionPlans).where(eq(schema.subscriptionPlans.id, id));
    return plan;
  }

  async getSubscriptionPlanByName(name: string): Promise<any | undefined> {
    const [plan] = await db.select().from(schema.subscriptionPlans).where(eq(schema.subscriptionPlans.name, name));
    return plan;
  }

  async createSubscriptionPlan(plan: any): Promise<any> {
    const [newPlan] = await db.insert(schema.subscriptionPlans).values(plan).returning();
    return newPlan;
  }

  async updateSubscriptionPlan(id: number, updates: any): Promise<any | undefined> {
    const [plan] = await db
      .update(schema.subscriptionPlans)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.subscriptionPlans.id, id))
      .returning();
    
    // Features are now managed dynamically from features table
    
    return plan;
  }

  async deleteSubscriptionPlan(id: number): Promise<boolean> {
    const result = await db.delete(schema.subscriptionPlans).where(eq(schema.subscriptionPlans.id, id));
    return result.rowCount > 0;
  }

  // Features operations
  async getAllFeatures(): Promise<any[]> {
    try {
      const features = await db.select().from(schema.features)
        .where(eq(schema.features.isActive, true))
        .orderBy(schema.features.category, schema.features.name);
      return features || [];
    } catch (error) {
      console.error('Storage: error in getAllFeatures:', error);
      return [];
    }
  }

  async updateFeature(id: number, updates: any): Promise<any | undefined> {
    const [feature] = await db
      .update(schema.features)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.features.id, id))
      .returning();
    return feature;
  }

  // Reminders operations
  async createReminder(reminder: any): Promise<any> {
    const [newReminder] = await db.insert(schema.reminders).values({
      ...reminder,
      createdBy: reminder.userId,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    return newReminder;
  }

  async getRemindersByUser(userId: number): Promise<any[]> {
    // Get ONLY reminders created by this user (not assigned ones)
    return await db.select().from(schema.reminders)
      .where(eq(schema.reminders.userId, userId))
      .orderBy(schema.reminders.isPinned, schema.reminders.reminderDate, schema.reminders.createdAt);
  }

  // FIXED: Admin version that respects privacy - only shows admin's own reminders + ones shared with admin
  async getRemindersByCompany(companyId: number, adminUserId: number): Promise<any[]> {
    // Admin should only see:
    // 1. Reminders created by admin (createdBy = adminUserId)
    // 2. Reminders where admin is assigned (adminUserId in assignedUserIds)
    
    return await db.select({
      id: schema.reminders.id,
      userId: schema.reminders.userId,
      companyId: schema.reminders.companyId,
      title: schema.reminders.title,
      content: schema.reminders.content,
      reminderDate: schema.reminders.reminderDate,
      priority: schema.reminders.priority,
      color: schema.reminders.color,
      isCompleted: schema.reminders.isCompleted,
      isArchived: schema.reminders.isArchived,
      isPinned: schema.reminders.isPinned,
      notificationShown: schema.reminders.notificationShown,
      showBanner: schema.reminders.showBanner,
      assignedUserIds: schema.reminders.assignedUserIds,
      completedByUserIds: schema.reminders.completedByUserIds,
      assignedBy: schema.reminders.assignedBy,
      assignedAt: schema.reminders.assignedAt,
      createdBy: schema.reminders.createdBy,
      createdAt: schema.reminders.createdAt,
      updatedAt: schema.reminders.updatedAt,
      userFullName: schema.users.fullName
    })
    .from(schema.reminders)
    .leftJoin(schema.users, eq(schema.reminders.userId, schema.users.id))
    .where(
      and(
        eq(schema.reminders.companyId, companyId),
        or(
          eq(schema.reminders.createdBy, adminUserId), // Admin's own reminders
          // Check if admin is in assignedUserIds array using PostgreSQL syntax
          sql`${adminUserId} = ANY(${schema.reminders.assignedUserIds})`
        )
      )
    )
    .orderBy(schema.reminders.isPinned, schema.reminders.reminderDate, schema.reminders.createdAt);
  }

  async getReminder(id: number): Promise<any | undefined> {
    const [reminder] = await db.select().from(schema.reminders).where(eq(schema.reminders.id, id));
    return reminder;
  }

  async updateReminder(id: number, updates: any): Promise<any | undefined> {
    // Process the updates to ensure proper date handling
    const processedUpdates = { ...updates };
    
    // Handle reminder date conversion and null values
    if (processedUpdates.reminderDate !== undefined) {
      if (processedUpdates.reminderDate === null || processedUpdates.reminderDate === '') {
        processedUpdates.reminderDate = null;
      } else if (typeof processedUpdates.reminderDate === 'string') {
        processedUpdates.reminderDate = new Date(processedUpdates.reminderDate);
      }
    }
    
    // Ensure updatedAt is always a Date object
    processedUpdates.updatedAt = new Date();
    
    const [reminder] = await db
      .update(schema.reminders)
      .set(processedUpdates)
      .where(eq(schema.reminders.id, id))
      .returning();
    return reminder;
  }

  async deleteReminder(id: number): Promise<boolean> {
    try {
      // Delete the reminder (assignments are now stored in array columns, no separate table)
      const result = await db.delete(schema.reminders).where(eq(schema.reminders.id, id));
      return result.rowCount > 0;
    } catch (error) {
      console.error('Storage: error in deleteReminder:', error);
      return false;
    }
  }

  async getActiveReminders(userId: number): Promise<any[]> {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 days from now
    
    // ⚠️ PROTECTED - CRITICAL BANNER LOGIC - DO NOT MODIFY
    // Query reminders for BANNER display: includes OWN reminders + ASSIGNED reminders with showBanner=true
    const activeReminders = await db.select({
      id: schema.reminders.id,
      userId: schema.reminders.userId,
      companyId: schema.reminders.companyId,
      title: schema.reminders.title,
      content: schema.reminders.content,
      reminderDate: schema.reminders.reminderDate,
      priority: schema.reminders.priority,
      color: schema.reminders.color,
      isCompleted: schema.reminders.isCompleted,
      isArchived: schema.reminders.isArchived,
      isPinned: schema.reminders.isPinned,
      notificationShown: schema.reminders.notificationShown,
      showBanner: schema.reminders.showBanner,
      assignedUserIds: schema.reminders.assignedUserIds,
      completedByUserIds: schema.reminders.completedByUserIds,
      assignedBy: schema.reminders.assignedBy,
      assignedAt: schema.reminders.assignedAt,
      createdBy: schema.reminders.createdBy,
      createdAt: schema.reminders.createdAt,
      updatedAt: schema.reminders.updatedAt,
      creatorName: schema.users.fullName
    })
    .from(schema.reminders)
    .leftJoin(schema.users, eq(schema.reminders.createdBy, schema.users.id))
    .where(
      and(
        // Include reminders that are:
        // 1. Owned by the user OR 2. Assigned to the user (in assignedUserIds array)
        or(
          eq(schema.reminders.userId, userId), // User's own reminders
          sql`${userId} = ANY(${schema.reminders.assignedUserIds})` // Assigned to user
        ),
        eq(schema.reminders.isCompleted, false),
        eq(schema.reminders.isArchived, false),
        eq(schema.reminders.showBanner, true), // ONLY show reminders with banner enabled
        sql`${schema.reminders.reminderDate} IS NOT NULL`, // Must have a date configured
        lte(schema.reminders.reminderDate, nextWeek) // Date is within next 7 days
      )
    )
    .orderBy(schema.reminders.reminderDate);
    
    // Mark reminders as assigned or not and filter out individually completed ones
    return activeReminders
      .filter(reminder => {
        // Exclude reminders that the current user has already completed individually
        const completedByUserIds = reminder.completedByUserIds || [];
        return !completedByUserIds.includes(userId);
      })
      .map(reminder => ({
        ...reminder,
        isAssigned: reminder.userId !== userId
      }));
  }

  async getDashboardReminders(userId: number): Promise<any[]> {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 days from now
    
    // Get user to check role and company
    const user = await this.getUser(userId);
    if (!user) return [];
    
    let dashboardReminders;
    
    // If admin/manager, show all company reminders; otherwise show only user's reminders
    if (user.role === 'admin' || user.role === 'manager') {
      dashboardReminders = await db.select({
        id: schema.reminders.id,
        userId: schema.reminders.userId,
        companyId: schema.reminders.companyId,
        title: schema.reminders.title,
        content: schema.reminders.content,
        reminderDate: schema.reminders.reminderDate,
        priority: schema.reminders.priority,
        color: schema.reminders.color,
        isCompleted: schema.reminders.isCompleted,
        isArchived: schema.reminders.isArchived,
        isPinned: schema.reminders.isPinned,
        notificationShown: schema.reminders.notificationShown,
        showBanner: schema.reminders.showBanner,
        createdBy: schema.reminders.createdBy,
        createdAt: schema.reminders.createdAt,
        updatedAt: schema.reminders.updatedAt,
        userFullName: schema.users.fullName
      })
      .from(schema.reminders)
      .leftJoin(schema.users, eq(schema.reminders.userId, schema.users.id))
      .where(
        and(
          eq(schema.reminders.companyId, user.companyId),
          eq(schema.reminders.isCompleted, false),
          eq(schema.reminders.isArchived, false),
          or(
            sql`${schema.reminders.reminderDate} IS NULL`, // No date - show always
            lte(schema.reminders.reminderDate, nextWeek) // Has date within 7 days
          )
        )
      )
      .orderBy(schema.reminders.reminderDate);
    } else {
      // Regular employee - only their reminders
      dashboardReminders = await db.select().from(schema.reminders)
        .where(
          and(
            eq(schema.reminders.userId, userId),
            eq(schema.reminders.isCompleted, false),
            eq(schema.reminders.isArchived, false),
            or(
              sql`${schema.reminders.reminderDate} IS NULL`, // No date - show always
              lte(schema.reminders.reminderDate, nextWeek) // Has date within 7 days
            )
          )
        )
        .orderBy(schema.reminders.reminderDate);
    }
    
    return dashboardReminders;
  }

  // Registration Settings operations
  async getRegistrationSettings(): Promise<any> {
    const [settings] = await db.select().from(schema.registrationSettings).limit(1);
    
    // Return default settings if none exist
    if (!settings) {
      return {
        id: 1,
        publicRegistrationEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }
    
    return settings;
  }

  async updateRegistrationSettings(updates: any): Promise<any> {
    // Try to update existing settings first
    const [existing] = await db.select().from(schema.registrationSettings).limit(1);
    
    if (existing) {
      const [updated] = await db
        .update(schema.registrationSettings)
        .set(updates)
        .where(eq(schema.registrationSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new settings if none exist
      const [created] = await db
        .insert(schema.registrationSettings)
        .values({
          publicRegistrationEnabled: updates.publicRegistrationEnabled ?? true,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      return created;
    }
  }

  // Invitation Links operations
  async createInvitationLink(invitation: any): Promise<any> {
    const [result] = await db.insert(schema.invitationLinks).values(invitation).returning();
    return result;
  }

  async getInvitationByToken(token: string): Promise<any> {
    const [invitation] = await db.select().from(schema.invitationLinks)
      .where(eq(schema.invitationLinks.token, token));
    return invitation;
  }

  async getActiveInvitationByEmail(email: string): Promise<any> {
    const [invitation] = await db.select().from(schema.invitationLinks)
      .where(
        and(
          eq(schema.invitationLinks.email, email),
          eq(schema.invitationLinks.used, false),
          sql`${schema.invitationLinks.expiresAt} > NOW()`
        )
      );
    return invitation;
  }

  async getAllInvitationLinks(): Promise<any[]> {
    return db.select().from(schema.invitationLinks)
      .orderBy(desc(schema.invitationLinks.createdAt));
  }

  async deleteInvitationLink(id: number): Promise<boolean> {
    const result = await db.delete(schema.invitationLinks)
      .where(eq(schema.invitationLinks.id, id));
    return result.rowCount > 0;
  }

  async markInvitationAsUsed(id: number): Promise<boolean> {
    const result = await db
      .update(schema.invitationLinks)
      .set({ used: true, usedAt: new Date() })
      .where(eq(schema.invitationLinks.id, id));
    return result.rowCount > 0;
  }

  // Stripe payment methods
  async updateUserStripeCustomerId(userId: number, stripeCustomerId: string): Promise<User | undefined> {
    const [user] = await db
      .update(schema.users)
      .set({ stripeCustomerId })
      .where(eq(schema.users.id, userId))
      .returning();
    return user;
  }

  async updateSubscriptionStatus(subscriptionId: number, status: string): Promise<any | undefined> {
    const [subscription] = await db
      .update(schema.subscriptions)
      .set({ 
        status,
        updatedAt: new Date()
      })
      .where(eq(schema.subscriptions.id, subscriptionId))
      .returning();
    return subscription;
  }

  async getCompanyByUserId(userId: number): Promise<any | undefined> {
    // First get the user to find their company
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    // Retrieved user data
    if (!user) {
      // User not found
      return undefined;
    }

    // Get the company
    const [company] = await db.select().from(schema.companies).where(eq(schema.companies.id, user.companyId));
    // Retrieved company data
    if (!company) {
      // Company not found
      return undefined;
    }

    // Get the subscription
    const [subscription] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.companyId, company.id));
    // Retrieved subscription data
    
    const result = {
      ...company,
      subscription: subscription || null
    };
    // Company data assembled
    
    return result;
  }


  // Employee Activation Tokens operations
  async createActivationToken(token: InsertEmployeeActivationToken): Promise<EmployeeActivationToken> {
    const [result] = await db.insert(schema.employeeActivationTokens).values(token).returning();
    return result;
  }

  async getActivationToken(token: string): Promise<EmployeeActivationToken | undefined> {
    const [result] = await db.select().from(schema.employeeActivationTokens)
      .where(
        and(
          eq(schema.employeeActivationTokens.token, token),
          eq(schema.employeeActivationTokens.used, false),
          sql`${schema.employeeActivationTokens.expiresAt} > NOW()`
        )
      );
    return result;
  }

  async getActivationTokenByUserId(userId: number): Promise<EmployeeActivationToken | undefined> {
    const [result] = await db.select().from(schema.employeeActivationTokens)
      .where(
        and(
          eq(schema.employeeActivationTokens.userId, userId),
          eq(schema.employeeActivationTokens.used, false),
          sql`${schema.employeeActivationTokens.expiresAt} > NOW()`
        )
      )
      .orderBy(desc(schema.employeeActivationTokens.createdAt));
    return result;
  }

  async markTokenAsUsed(id: number): Promise<EmployeeActivationToken | undefined> {
    const [result] = await db
      .update(schema.employeeActivationTokens)
      .set({ used: true })
      .where(eq(schema.employeeActivationTokens.id, id))
      .returning();
    return result;
  }

  async deleteActivationToken(id: number): Promise<boolean> {
    const result = await db.delete(schema.employeeActivationTokens)
      .where(eq(schema.employeeActivationTokens.id, id));
    return result.rowCount > 0;
  }

  async cleanupExpiredTokens(): Promise<number> {
    const result = await db.delete(schema.employeeActivationTokens)
      .where(sql`${schema.employeeActivationTokens.expiresAt} <= NOW()`);
    return result.rowCount;
  }

  // Reminder Assignments operations - now using arrays in reminders table
  async assignReminderToUsers(reminderId: number, userIds: number[], assignedBy: number): Promise<any> {
    const [updatedReminder] = await db.update(schema.reminders)
      .set({
        assignedUserIds: userIds,
        assignedBy,
        assignedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(schema.reminders.id, reminderId))
      .returning();
    return updatedReminder;
  }

  async getReminderAssignments(reminderId: number): Promise<any[]> {
    const [reminder] = await db.select({
      assignedUserIds: schema.reminders.assignedUserIds,
      assignedBy: schema.reminders.assignedBy,
      assignedAt: schema.reminders.assignedAt
    })
    .from(schema.reminders)
    .where(eq(schema.reminders.id, reminderId));

    if (!reminder?.assignedUserIds?.length) {
      return [];
    }

    // Get user details for assigned users
    const users = await db.select({
      id: schema.users.id,
      fullName: schema.users.fullName,
      email: schema.users.companyEmail
    })
    .from(schema.users)
    .where(inArray(schema.users.id, reminder.assignedUserIds));

    return users.map(user => ({
      assignedUserId: user.id,
      userName: user.fullName,
      userEmail: user.email,
      assignedBy: reminder.assignedBy,
      assignedAt: reminder.assignedAt
    }));
  }

  async removeUserFromReminderAssignment(reminderId: number, userIdToRemove: number): Promise<boolean> {
    try {
      const [reminder] = await db.select({ assignedUserIds: schema.reminders.assignedUserIds })
        .from(schema.reminders)
        .where(eq(schema.reminders.id, reminderId));

      if (!reminder?.assignedUserIds?.length) {
        return false;
      }

      const updatedUserIds = reminder.assignedUserIds.filter(id => id !== userIdToRemove);
      
      await db.update(schema.reminders)
        .set({ 
          assignedUserIds: updatedUserIds.length > 0 ? updatedUserIds : null,
          updatedAt: new Date()
        })
        .where(eq(schema.reminders.id, reminderId));

      return true;
    } catch (error) {
      console.error('Storage: error in removeUserFromReminderAssignment:', error);
      return false;
    }
  }

  async clearReminderAssignments(reminderId: number): Promise<boolean> {
    try {
      await db.update(schema.reminders)
        .set({ 
          assignedUserIds: null,
          assignedBy: null,
          assignedAt: null,
          updatedAt: new Date()
        })
        .where(eq(schema.reminders.id, reminderId));
      return true;
    } catch (error) {
      console.error('Storage: error in clearReminderAssignments:', error);
      return false;
    }
  }

  async clearAllReminderAssignments(reminderId: number): Promise<boolean> {
    try {
      await db.update(schema.reminders)
        .set({ 
          assignedUserIds: null,
          assignedBy: null,
          assignedAt: null,
          updatedAt: new Date()
        })
        .where(eq(schema.reminders.id, reminderId));
      return true;
    } catch (error) {
      console.error('Storage: error in clearAllReminderAssignments:', error);
      return false;
    }
  }

  async getRemindersByUserWithAssignments(userId: number): Promise<any[]> {
    // Get user's own reminders
    const ownReminders = await db.select().from(schema.reminders)
      .where(eq(schema.reminders.userId, userId))
      .orderBy(schema.reminders.isPinned, schema.reminders.reminderDate, schema.reminders.createdAt);

    // FIXED: Get reminders assigned to this user (where user is in assignedUserIds)
    const assignedToUserReminders = await db.select({
      id: schema.reminders.id,
      userId: schema.reminders.userId,
      companyId: schema.reminders.companyId,
      title: schema.reminders.title,
      content: schema.reminders.content,
      reminderDate: schema.reminders.reminderDate,
      priority: schema.reminders.priority,
      color: schema.reminders.color,
      isCompleted: schema.reminders.isCompleted,
      isArchived: schema.reminders.isArchived,
      isPinned: schema.reminders.isPinned,
      notificationShown: schema.reminders.notificationShown,
      showBanner: schema.reminders.showBanner,
      assignedUserIds: schema.reminders.assignedUserIds,
      completedByUserIds: schema.reminders.completedByUserIds,
      assignedBy: schema.reminders.assignedBy,
      assignedAt: schema.reminders.assignedAt,
      createdBy: schema.reminders.createdBy,
      createdAt: schema.reminders.createdAt,
      updatedAt: schema.reminders.updatedAt,
      creatorName: schema.users.fullName
    })
    .from(schema.reminders)
    .leftJoin(schema.users, eq(schema.reminders.userId, schema.users.id))
    .where(
      and(
        ne(schema.reminders.userId, userId), // Not their own reminders (already included above)
        sql`${userId} = ANY(${schema.reminders.assignedUserIds})` // User is assigned to this reminder
      )
    )
    .orderBy(schema.reminders.isPinned, schema.reminders.reminderDate, schema.reminders.createdAt);

    // Get reminders that the user has completed (even if not their own)
    const completedByUserReminders = await db.select({
      id: schema.reminders.id,
      userId: schema.reminders.userId,
      companyId: schema.reminders.companyId,
      title: schema.reminders.title,
      content: schema.reminders.content,
      reminderDate: schema.reminders.reminderDate,
      priority: schema.reminders.priority,
      color: schema.reminders.color,
      isCompleted: schema.reminders.isCompleted,
      isArchived: schema.reminders.isArchived,
      isPinned: schema.reminders.isPinned,
      notificationShown: schema.reminders.notificationShown,
      showBanner: schema.reminders.showBanner,
      assignedUserIds: schema.reminders.assignedUserIds,
      completedByUserIds: schema.reminders.completedByUserIds,
      assignedBy: schema.reminders.assignedBy,
      assignedAt: schema.reminders.assignedAt,
      createdBy: schema.reminders.createdBy,
      createdAt: schema.reminders.createdAt,
      updatedAt: schema.reminders.updatedAt,
      creatorName: schema.users.fullName
    })
    .from(schema.reminders)
    .leftJoin(schema.users, eq(schema.reminders.createdBy, schema.users.id))
    .where(sql`${userId} = ANY(${schema.reminders.completedByUserIds})`)
    .orderBy(schema.reminders.isPinned, schema.reminders.reminderDate, schema.reminders.createdAt);

    console.log(`📋 Reminders debug for user ${userId}:`);
    console.log(`Own reminders count: ${ownReminders.length}`);
    console.log(`Assigned to user reminders count: ${assignedToUserReminders.length}`);
    console.log(`Completed by user reminders count: ${completedByUserReminders.length}`);
    console.log(`Completed reminders:`, completedByUserReminders.map(r => ({ id: r.id, title: r.title, userId: r.userId, completedBy: r.completedByUserIds })));

    // Process own reminders - include ALL own reminders (let frontend handle filtering)
    const ownRemindersWithFlag = ownReminders
      .map(reminder => ({
        ...reminder,
        isAssigned: false,
        creatorName: null
      }));

    // Process assigned reminders - reminders assigned to this user by admin/others
    const assignedRemindersWithFlag = assignedToUserReminders
      .map(reminder => ({
        ...reminder,
        isAssigned: true
      }));

    // Process completed reminders - only show ones not owned by user and not already assigned
    const completedRemindersWithFlag = completedByUserReminders
      .filter(reminder => 
        reminder.userId !== userId && // Only show completed reminders from others
        !assignedToUserReminders.some(assigned => assigned.id === reminder.id) // Avoid duplicates with assigned reminders
      )
      .map(reminder => ({
        ...reminder,
        isAssigned: true
      }));

    return [...ownRemindersWithFlag, ...assignedRemindersWithFlag, ...completedRemindersWithFlag];
  }

  async getEmployeesByCompany(companyId: number): Promise<any[]> {
    return await db.select({
      id: schema.users.id,
      fullName: schema.users.fullName,
      email: schema.users.companyEmail,
      role: schema.users.role,
      position: schema.users.position,
      profilePicture: schema.users.profilePicture
    })
    .from(schema.users)
    .where(eq(schema.users.companyId, companyId))
    .orderBy(schema.users.fullName);
  }

  // ⚠️ PROTECTED - DO NOT MODIFY - Incomplete Work Sessions Notifications
  async createIncompleteSessionNotification(userId: number, workSessionId: number, createdBy: number): Promise<SystemNotification> {
    const notification = {
      userId,
      type: 'incomplete_session',
      category: 'time-tracking',
      title: 'Fichaje Incompleto',
      message: 'Tienes una sesión de trabajo abierta que necesita ser cerrada.',
      actionUrl: '/employee/time-tracking',
      priority: 'high' as const,
      isRead: false,
      isCompleted: false,
      metadata: JSON.stringify({ workSessionId }),
      createdBy
    };
    
    return await this.createNotification(notification);
  }

  // 🔒 THROTTLE: Only check once every 5 minutes per company (prevents spam on every API call)
  private lastIncompleteSessionCheck = new Map<number, Date>();
  private readonly INCOMPLETE_SESSION_CHECK_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes

  // ⚠️ PROTECTED - DO NOT MODIFY - Check and create notifications for incomplete sessions
  async checkAndCreateIncompleteSessionNotifications(companyId: number): Promise<void> {
    try {
      // 🔒 THROTTLE: Skip if checked recently (within last 5 minutes)
      const lastCheck = this.lastIncompleteSessionCheck.get(companyId);
      const now = new Date();
      
      if (lastCheck && (now.getTime() - lastCheck.getTime()) < this.INCOMPLETE_SESSION_CHECK_THROTTLE_MS) {
        return; // Skip - checked too recently
      }
      
      // Update last check time
      this.lastIncompleteSessionCheck.set(companyId, now);
      
      // Clean up old entries (older than 1 hour)
      const oneHourAgo = now.getTime() - (60 * 60 * 1000);
      for (const [key, date] of Array.from(this.lastIncompleteSessionCheck.entries())) {
        if (date.getTime() < oneHourAgo) {
          this.lastIncompleteSessionCheck.delete(key);
        }
      }
      
      // Get company settings for working hours
      const [company] = await db.select({
        workingHoursPerDay: schema.companies.workingHoursPerDay
      })
      .from(schema.companies)
      .where(eq(schema.companies.id, companyId));

      if (!company) return;

      const maxHours = company.workingHoursPerDay || 8;
      const maxMilliseconds = maxHours * 60 * 60 * 1000;

      // Find all incomplete sessions that exceed max working hours
      const incompleteSessions = await db.select({
        id: schema.workSessions.id,
        userId: schema.workSessions.userId,
        clockIn: schema.workSessions.clockIn,
        userFullName: schema.users.fullName
      })
      .from(schema.workSessions)
      .leftJoin(schema.users, eq(schema.workSessions.userId, schema.users.id))
      .where(and(
        eq(schema.users.companyId, companyId),
        isNull(schema.workSessions.clockOut)
      ));

      for (const session of incompleteSessions) {
        const clockInTime = new Date(session.clockIn!);
        const elapsed = now.getTime() - clockInTime.getTime();

        if (elapsed > maxMilliseconds) {
          // Check if notification already exists for this session
          const existingNotification = await db.select()
            .from(schema.systemNotifications)
            .where(and(
              eq(schema.systemNotifications.userId, session.userId!),
              eq(schema.systemNotifications.type, 'incomplete_session'),
              eq(schema.systemNotifications.category, 'time-tracking'),
              eq(schema.systemNotifications.isCompleted, false),
              sql`${schema.systemNotifications.metadata}::json->>'workSessionId' = ${session.id.toString()}`
            ))
            .limit(1);

          if (existingNotification.length === 0) {
            // Create notification for this incomplete session
            await this.createIncompleteSessionNotification(
              session.userId!,
              session.id,
              1 // System-generated notification
            );
          }
        }
      }
    } catch (error) {
      console.error('Error checking incomplete session notifications:', error);
    }
  }

  // ⚠️ PROTECTED - DO NOT MODIFY - 30-day deletion system
  async scheduleCompanyDeletion(companyId: number): Promise<boolean> {
    try {
      const deletionDate = new Date();
      const deletionWillOccur = new Date();
      deletionWillOccur.setDate(deletionWillOccur.getDate() + 30); // 30 days from now

      await db.update(schema.companies)
        .set({
          scheduledForDeletion: true,
          deletionScheduledAt: deletionDate,
          deletionWillOccurAt: deletionWillOccur,
          updatedAt: new Date()
        })
        .where(eq(schema.companies.id, companyId));
      
      return true;
    } catch (error) {
      console.error('Error scheduling company deletion:', error);
      return false;
    }
  }

  async cancelAccountDeletion(companyId: number): Promise<boolean> {
    try {
      await db.update(schema.companies)
        .set({
          scheduledForDeletion: false,
          deletionScheduledAt: null,
          deletionWillOccurAt: null,
          updatedAt: new Date()
        })
        .where(eq(schema.companies.id, companyId));
      
      return true;
    } catch (error) {
      console.error('Error canceling company deletion:', error);
      return false;
    }
  }

  // ⚠️ CRITICAL: Permanently delete all company data after 30-day grace period
  async deleteCompanyPermanently(companyId: number): Promise<boolean> {
    try {
      console.log(`🗑️ PERMANENT DELETION: Starting for company ${companyId}`);
      
      // Get all user IDs for this company (needed for related tables)
      const companyUsers = await db.select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.companyId, companyId));
      const userIds = companyUsers.map(u => u.id);
      
      console.log(`🗑️ Found ${userIds.length} users to delete for company ${companyId}`);
      
      // Delete in correct order (respecting foreign keys)
      // 1. Delete refresh tokens for all users
      if (userIds.length > 0) {
        await db.delete(schema.refreshTokens)
          .where(sql`user_id = ANY(ARRAY[${sql.join(userIds.map(id => sql`${id}`), sql`, `)}]::integer[])`);
        console.log(`   ✅ Deleted refresh tokens`);
      }
      
      // 2. Delete push subscriptions
      if (userIds.length > 0) {
        await db.delete(schema.pushSubscriptions)
          .where(sql`user_id = ANY(ARRAY[${sql.join(userIds.map(id => sql`${id}`), sql`, `)}]::integer[])`);
        console.log(`   ✅ Deleted push subscriptions`);
      }
      
      // 3. Delete system notifications
      if (userIds.length > 0) {
        await db.delete(schema.systemNotifications)
          .where(sql`user_id = ANY(ARRAY[${sql.join(userIds.map(id => sql`${id}`), sql`, `)}]::integer[])`);
        console.log(`   ✅ Deleted system notifications`);
      }
      
      // 4. Delete messages
      await db.delete(schema.messages)
        .where(eq(schema.messages.companyId, companyId));
      console.log(`   ✅ Deleted messages`);
      
      // 5. Delete reminders
      await db.delete(schema.reminders)
        .where(eq(schema.reminders.companyId, companyId));
      console.log(`   ✅ Deleted reminders`);
      
      // 6. Delete work sessions (time tracking)
      await db.delete(schema.workSessions)
        .where(eq(schema.workSessions.companyId, companyId));
      console.log(`   ✅ Deleted work sessions`);
      
      // 7. Delete documents
      await db.delete(schema.documents)
        .where(eq(schema.documents.companyId, companyId));
      console.log(`   ✅ Deleted documents`);
      
      // 8. Delete vacation requests
      await db.delete(schema.vacationRequests)
        .where(eq(schema.vacationRequests.companyId, companyId));
      console.log(`   ✅ Deleted vacation requests`);
      
      // 9. Delete audit log
      await db.delete(schema.auditLog)
        .where(eq(schema.auditLog.companyId, companyId));
      console.log(`   ✅ Deleted audit log`);
      
      // 10. Delete modification requests
      await db.delete(schema.modificationRequests)
        .where(eq(schema.modificationRequests.companyId, companyId));
      console.log(`   ✅ Deleted modification requests`);
      
      // 11. Delete company addons
      await db.delete(schema.companyAddons)
        .where(eq(schema.companyAddons.companyId, companyId));
      console.log(`   ✅ Deleted company addons`);
      
      // 12. Delete vacation info
      if (userIds.length > 0) {
        await db.delete(schema.vacationInfo)
          .where(sql`user_id = ANY(ARRAY[${sql.join(userIds.map(id => sql`${id}`), sql`, `)}]::integer[])`);
        console.log(`   ✅ Deleted vacation info`);
      }
      
      // 13. Delete subscriptions
      await db.delete(schema.subscriptions)
        .where(eq(schema.subscriptions.companyId, companyId));
      console.log(`   ✅ Deleted subscriptions`);
      
      // 14. Delete users
      await db.delete(schema.users)
        .where(eq(schema.users.companyId, companyId));
      console.log(`   ✅ Deleted ${userIds.length} users`);
      
      // 15. Mark company as permanently deleted (soft delete for audit trail)
      await db.update(schema.companies)
        .set({
          isDeleted: true,
          name: `[DELETED] ${companyId}`,
          email: `deleted_${companyId}@deleted.local`,
          cif: `DELETED_${companyId}`,
          updatedAt: new Date()
        })
        .where(eq(schema.companies.id, companyId));
      console.log(`   ✅ Marked company as deleted`);
      
      console.log(`🗑️ PERMANENT DELETION COMPLETE for company ${companyId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error permanently deleting company ${companyId}:`, error);
      return false;
    }
  }

  // Get companies that have passed their 30-day grace period
  async getCompaniesReadyForDeletion(): Promise<any[]> {
    try {
      const now = new Date();
      const companies = await db.select({
        id: schema.companies.id,
        name: schema.companies.name,
        email: schema.companies.email,
        deletionWillOccurAt: schema.companies.deletionWillOccurAt
      })
      .from(schema.companies)
      .where(
        and(
          eq(schema.companies.scheduledForDeletion, true),
          eq(schema.companies.isDeleted, false),
          sql`${schema.companies.deletionWillOccurAt} <= ${now.toISOString()}`
        )
      );
      
      return companies;
    } catch (error) {
      console.error('Error getting companies ready for deletion:', error);
      return [];
    }
  }

  async getCompaniesPendingDeletion(): Promise<any[]> {
    try {
      const companies = await db.select({
        id: schema.companies.id,
        name: schema.companies.name,
        email: schema.companies.email,
        scheduledForDeletion: schema.companies.scheduledForDeletion,
        deletionScheduledAt: schema.companies.deletionScheduledAt,
        deletionWillOccurAt: schema.companies.deletionWillOccurAt,
        createdAt: schema.companies.createdAt
      })
      .from(schema.companies)
      .where(
        and(
          eq(schema.companies.scheduledForDeletion, true),
          eq(schema.companies.isDeleted, false)
        )
      );
      
      return companies;
    } catch (error) {
      console.error('Error getting companies pending deletion:', error);
      return [];
    }
  }

  async getCompanyDeletionStatus(companyId: number): Promise<any> {
    try {
      const [company] = await db.select({
        scheduledForDeletion: schema.companies.scheduledForDeletion,
        deletionScheduledAt: schema.companies.deletionScheduledAt,
        deletionWillOccurAt: schema.companies.deletionWillOccurAt,
        isDeleted: schema.companies.isDeleted
      })
      .from(schema.companies)
      .where(eq(schema.companies.id, companyId));
      
      return company || null;
    } catch (error) {
      console.error('Error getting company deletion status:', error);
      return null;
    }
  }

  // Reminder Notifications
  async getReminderNotificationsDue(userId: number, companyId: number, currentTime: Date): Promise<Reminder[]> {
    try {
      // Get all reminders for this user
      const allUserReminders = await db.select()
        .from(schema.reminders)
        .where(
          and(
            eq(schema.reminders.companyId, companyId),
            or(
              eq(schema.reminders.userId, userId),
              sql`${userId} = ANY(${schema.reminders.assignedUserIds})`
            )
          )
        );


      // Get reminders that:
      // 1. Belong to the user or are assigned to them
      // 2. Have enableNotifications = true
      // 3. Have a reminder date that has passed
      // 4. Are not completed OR not completed by this user individually
      // 5. Haven't been shown yet (notificationShown = false)
      const remindersDue = await db.select()
        .from(schema.reminders)
        .where(
          and(
            eq(schema.reminders.companyId, companyId),
            or(
              eq(schema.reminders.userId, userId),
              sql`${userId} = ANY(${schema.reminders.assignedUserIds})`
            ),
            eq(schema.reminders.enableNotifications, true),
            lte(schema.reminders.reminderDate, currentTime),
            eq(schema.reminders.isCompleted, false),
            eq(schema.reminders.isArchived, false),
            eq(schema.reminders.notificationShown, false),
            // Don't show notifications for reminders the user has completed individually
            or(
              isNull(schema.reminders.completedByUserIds),
              sql`NOT (${userId} = ANY(${schema.reminders.completedByUserIds}))`
            )
          )
        );

      return remindersDue;
    } catch (error) {
      console.error('Error getting reminder notifications due:', error);
      return [];
    }
  }

  async markReminderNotificationShown(reminderId: number, userId: number): Promise<boolean> {
    try {
      await db.update(schema.reminders)
        .set({ 
          notificationShown: true,
          updatedAt: new Date()
        })
        .where(eq(schema.reminders.id, reminderId));
      
      return true;
    } catch (error) {
      console.error('Error marking reminder notification as shown:', error);
      return false;
    }
  }

  async completeReminderIndividually(reminderId: number, userId: number): Promise<Reminder | undefined> {
    try {
      // First get the current reminder and user info
      const [reminder] = await db.select().from(schema.reminders).where(eq(schema.reminders.id, reminderId));
      if (!reminder) return undefined;

      const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
      if (!user) return undefined;

      // Get current completedByUserIds or initialize as empty array
      const currentCompletedBy = reminder.completedByUserIds || [];
      
      // Add user to completed list if not already there
      if (!currentCompletedBy.includes(userId)) {
        currentCompletedBy.push(userId);
      }

      // Check if this reminder should be globally completed
      let shouldBeGloballyCompleted = false;
      
      // For employee-created reminders: only the creator can complete them (simple personal reminders)
      if (user.role === 'employee') {
        // Employee reminders are always personal - only creator completes
        shouldBeGloballyCompleted = (userId === reminder.createdBy);
      } else {
        // For admin/manager reminders: check assignments
        if (reminder.assignedUserIds && reminder.assignedUserIds.length > 0) {
          // This is an assigned reminder - check if all assigned users + creator have completed
          const allRequiredUsers = [...reminder.assignedUserIds, reminder.createdBy];
          const uniqueRequiredUsers = Array.from(new Set(allRequiredUsers));
          shouldBeGloballyCompleted = uniqueRequiredUsers.every(reqUserId => currentCompletedBy.includes(reqUserId));
        } else {
          // This is a personal reminder - only creator needs to complete
          shouldBeGloballyCompleted = currentCompletedBy.includes(reminder.createdBy);
        }
      }

      // Update the reminder
      const [updatedReminder] = await db.update(schema.reminders)
        .set({
          completedByUserIds: currentCompletedBy,
          isCompleted: shouldBeGloballyCompleted,
          updatedAt: new Date()
        })
        .where(eq(schema.reminders.id, reminderId))
        .returning();

      return updatedReminder;
    } catch (error) {
      console.error('Error completing reminder individually:', error);
      return undefined;
    }
  }

  // Custom Holidays methods
  async getCustomHolidaysByCompany(companyId: number): Promise<CustomHoliday[]> {
    try {
      return await db.select()
        .from(schema.customHolidays)
        .where(eq(schema.customHolidays.companyId, companyId))
        .orderBy(asc(schema.customHolidays.startDate));
    } catch (error) {
      console.error('Error fetching custom holidays:', error);
      return [];
    }
  }

  async createCustomHoliday(holiday: InsertCustomHoliday): Promise<CustomHoliday> {
    const [newHoliday] = await db.insert(schema.customHolidays)
      .values({
        ...holiday,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    return newHoliday;
  }

  async deleteCustomHoliday(id: number): Promise<boolean> {
    try {
      const result = await db.delete(schema.customHolidays)
        .where(eq(schema.customHolidays.id, id))
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error('Error deleting custom holiday:', error);
      return false;
    }
  }

  // Work Alarms methods
  async createWorkAlarm(alarm: InsertWorkAlarm): Promise<WorkAlarm> {
    const [newAlarm] = await db.insert(schema.workAlarms)
      .values({
        ...alarm,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    return newAlarm;
  }

  async getWorkAlarmsByUser(userId: number): Promise<WorkAlarm[]> {
    try {
      return await db.select()
        .from(schema.workAlarms)
        .where(eq(schema.workAlarms.userId, userId))
        .orderBy(asc(schema.workAlarms.time));
    } catch (error) {
      console.error('Error fetching work alarms:', error);
      return [];
    }
  }

  async getWorkAlarm(id: number): Promise<WorkAlarm | undefined> {
    try {
      const [alarm] = await db.select()
        .from(schema.workAlarms)
        .where(eq(schema.workAlarms.id, id));
      
      return alarm;
    } catch (error) {
      console.error('Error fetching work alarm:', error);
      return undefined;
    }
  }

  async updateWorkAlarm(id: number, updates: Partial<InsertWorkAlarm>): Promise<WorkAlarm | undefined> {
    try {
      const [updatedAlarm] = await db.update(schema.workAlarms)
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(eq(schema.workAlarms.id, id))
        .returning();
      
      return updatedAlarm;
    } catch (error) {
      console.error('Error updating work alarm:', error);
      return undefined;
    }
  }

  async deleteWorkAlarm(id: number): Promise<boolean> {
    try {
      const result = await db.delete(schema.workAlarms)
        .where(eq(schema.workAlarms.id, id))
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error('Error deleting work alarm:', error);
      return false;
    }
  }

  async getActiveWorkAlarmsByUser(userId: number): Promise<WorkAlarm[]> {
    try {
      return await db.select()
        .from(schema.workAlarms)
        .where(and(
          eq(schema.workAlarms.userId, userId),
          eq(schema.workAlarms.isActive, true)
        ))
        .orderBy(asc(schema.workAlarms.time));
    } catch (error) {
      console.error('Error fetching active work alarms:', error);
      return [];
    }
  }

  // Work Shifts methods
  async createWorkShift(shift: InsertWorkShift): Promise<WorkShift> {
    const [newShift] = await db.insert(schema.workShifts)
      .values({
        ...shift,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    return newShift;
  }

  async getWorkShiftsByCompany(companyId: number, startDate?: string, endDate?: string): Promise<WorkShift[]> {
    try {
      let query = db.select()
        .from(schema.workShifts)
        .where(eq(schema.workShifts.companyId, companyId));

      // Add date filtering if provided
      const conditions = [eq(schema.workShifts.companyId, companyId)];
      
      if (startDate) {
        conditions.push(gte(schema.workShifts.startAt, new Date(startDate)));
      }
      
      if (endDate) {
        conditions.push(lte(schema.workShifts.endAt, new Date(endDate)));
      }

      return await db.select()
        .from(schema.workShifts)
        .where(and(...conditions))
        .orderBy(asc(schema.workShifts.startAt));
    } catch (error) {
      console.error('Error fetching work shifts by company:', error);
      return [];
    }
  }

  async getWorkShiftsByEmployee(employeeId: number, startDate?: string, endDate?: string): Promise<WorkShift[]> {
    try {
      const conditions = [eq(schema.workShifts.employeeId, employeeId)];
      
      if (startDate) {
        conditions.push(gte(schema.workShifts.startAt, new Date(startDate)));
      }
      
      if (endDate) {
        // Add one day to endDate to include all shifts that start on endDate
        const endDatePlusOne = new Date(endDate);
        endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
        conditions.push(lte(schema.workShifts.startAt, endDatePlusOne));
      }

      return await db.select()
        .from(schema.workShifts)
        .where(and(...conditions))
        .orderBy(asc(schema.workShifts.startAt));
    } catch (error) {
      console.error('Error fetching work shifts by employee:', error);
      return [];
    }
  }

  async updateWorkShift(id: number, updates: Partial<InsertWorkShift>): Promise<WorkShift | undefined> {
    try {
      const [result] = await db.update(schema.workShifts)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.workShifts.id, id))
        .returning();
      return result;
    } catch (error) {
      console.error('Error updating work shift:', error);
      return undefined;
    }
  }

  async deleteWorkShift(id: number): Promise<boolean> {
    try {
      const result = await db.delete(schema.workShifts)
        .where(eq(schema.workShifts.id, id))
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error('Error deleting work shift:', error);
      return false;
    }
  }

  async replicateWeekShifts(companyId: number, weekStart: string, offsetWeeks = 1, employeeIds?: number[]): Promise<WorkShift[]> {
    try {
      const weekStartDate = new Date(weekStart);
      const weekEndDate = new Date(weekStartDate);
      weekEndDate.setDate(weekStartDate.getDate() + 7);

      // Get shifts from source week
      let conditions = [
        eq(schema.workShifts.companyId, companyId),
        gte(schema.workShifts.startAt, weekStartDate),
        lt(schema.workShifts.endAt, weekEndDate)
      ];

      if (employeeIds && employeeIds.length > 0) {
        conditions.push(inArray(schema.workShifts.employeeId, employeeIds));
      }

      const sourceShifts = await db.select()
        .from(schema.workShifts)
        .where(and(...conditions));

      if (sourceShifts.length === 0) {
        return [];
      }

      // Calculate offset in milliseconds
      const offsetMs = offsetWeeks * 7 * 24 * 60 * 60 * 1000;

      // Create new shifts with date offset
      const newShifts = sourceShifts.map(shift => {
        const newStartAt = new Date(shift.startAt.getTime() + offsetMs);
        const newEndAt = new Date(shift.endAt.getTime() + offsetMs);
        
        return {
          companyId: shift.companyId,
          employeeId: shift.employeeId,
          startAt: newStartAt,
          endAt: newEndAt,
          title: shift.title,
          location: shift.location,
          notes: shift.notes,
          color: shift.color,
          createdByUserId: shift.createdByUserId,
        };
      });

      // Insert new shifts
      const insertedShifts = await db.insert(schema.workShifts)
        .values(newShifts)
        .returning();

      return insertedShifts;
    } catch (error) {
      console.error('Error replicating week shifts:', error);
      return [];
    }
  }

  async swapEmployeeShifts(
    employeeAId: number,
    employeeBId: number,
    startDate?: string,
    endDate?: string
  ): Promise<{ success: boolean; swappedCount: number; conflicts?: string[] }> {
    try {
      // Build date filter conditions
      const dateConditions: any[] = [];
      if (startDate) {
        dateConditions.push(gte(schema.workShifts.startAt, new Date(startDate)));
      }
      if (endDate) {
        dateConditions.push(lte(schema.workShifts.endAt, new Date(endDate)));
      }

      // Get all shifts for employee A
      const shiftsA = await db.select()
        .from(schema.workShifts)
        .where(and(
          eq(schema.workShifts.employeeId, employeeAId),
          ...(dateConditions.length > 0 ? dateConditions : [])
        ));

      // Get all shifts for employee B
      const shiftsB = await db.select()
        .from(schema.workShifts)
        .where(and(
          eq(schema.workShifts.employeeId, employeeBId),
          ...(dateConditions.length > 0 ? dateConditions : [])
        ));

      console.log(`🔄 SWAP DEBUG: Employee ${employeeAId} has ${shiftsA.length} shifts, Employee ${employeeBId} has ${shiftsB.length} shifts`);

      // Swap employee IDs for all shifts
      let swappedCount = 0;

      // Update all shifts from A to B
      for (const shift of shiftsA) {
        await db.update(schema.workShifts)
          .set({ employeeId: employeeBId, updatedAt: new Date() })
          .where(eq(schema.workShifts.id, shift.id));
        swappedCount++;
      }

      // Update all shifts from B to A
      for (const shift of shiftsB) {
        await db.update(schema.workShifts)
          .set({ employeeId: employeeAId, updatedAt: new Date() })
          .where(eq(schema.workShifts.id, shift.id));
        swappedCount++;
      }

      console.log(`✅ SWAP SUCCESS: Swapped ${swappedCount} shifts total`);

      return {
        success: true,
        swappedCount,
      };
    } catch (error) {
      console.error('❌ Error swapping employee shifts:', error);
      return {
        success: false,
        swappedCount: 0,
        conflicts: [(error as Error).message],
      };
    }
  }

  // Promotional Codes
  async createPromotionalCode(code: InsertPromotionalCode): Promise<PromotionalCode> {
    const [result] = await db.insert(schema.promotionalCodes).values(code).returning();
    return result;
  }

  async getPromotionalCode(id: number): Promise<PromotionalCode | undefined> {
    const [code] = await db.select().from(schema.promotionalCodes).where(eq(schema.promotionalCodes.id, id));
    return code;
  }

  async getPromotionalCodeByCode(code: string): Promise<PromotionalCode | undefined> {
    const [result] = await db.select().from(schema.promotionalCodes).where(eq(schema.promotionalCodes.code, code));
    return result;
  }

  async getAllPromotionalCodes(): Promise<PromotionalCode[]> {
    return await db.select().from(schema.promotionalCodes).orderBy(desc(schema.promotionalCodes.createdAt));
  }

  async updatePromotionalCode(id: number, updates: Partial<InsertPromotionalCode>): Promise<PromotionalCode | undefined> {
    const [result] = await db.update(schema.promotionalCodes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.promotionalCodes.id, id))
      .returning();
    return result;
  }

  async deletePromotionalCode(id: number): Promise<boolean> {
    const result = await db.delete(schema.promotionalCodes)
      .where(eq(schema.promotionalCodes.id, id))
      .returning();
    return result.length > 0;
  }

  async validatePromotionalCode(code: string): Promise<{ valid: boolean; message?: string; trialDays?: number }> {
    try {
      const promoCode = await this.getPromotionalCodeByCode(code);
      
      if (!promoCode) {
        return { valid: false, message: 'Código promocional no encontrado' };
      }

      if (!promoCode.isActive) {
        return { valid: false, message: 'Código promocional desactivado' };
      }

      // Check validity dates
      const now = new Date();
      if (promoCode.validFrom && promoCode.validFrom > now) {
        return { valid: false, message: 'Código promocional aún no válido' };
      }

      if (promoCode.validUntil && promoCode.validUntil < now) {
        return { valid: false, message: 'Código promocional expirado' };
      }

      // Check usage limits
      if (promoCode.maxUses && promoCode.currentUses >= promoCode.maxUses) {
        return { valid: false, message: 'Código promocional agotado' };
      }

      return { 
        valid: true, 
        message: `¡Código válido! Obtienes ${promoCode.trialDurationDays} días de prueba gratuitos`,
        trialDays: promoCode.trialDurationDays 
      };
    } catch (error) {
      console.error('Error validating promotional code:', error);
      return { valid: false, message: 'Error al validar el código' };
    }
  }


  // 🔄 ATOMIC PROMOTIONAL CODE APPLICATION - Race-condition safe (Neon HTTP compatible)
  async redeemAndApplyPromotionalCode(companyId: number, code: string): Promise<{ success: boolean; message?: string; trialDays?: number; updatedCompany?: Company }> {
    try {
      console.log(`🎁 Starting atomic promotional code redemption for company ${companyId} with code: ${code}`);
      
      const now = new Date();
      
      // 1. ATOMIC: Increment code usage with all validations in single WHERE clause
      // This prevents race conditions by validating and updating in one atomic operation
      const [updatedPromo] = await db.update(schema.promotionalCodes)
        .set({ 
          currentUses: sql`${schema.promotionalCodes.currentUses} + 1`,
          updatedAt: now
        })
        .where(
          and(
            eq(schema.promotionalCodes.code, code),
            eq(schema.promotionalCodes.isActive, true),
            // Date validations
            or(
              isNull(schema.promotionalCodes.validFrom),
              lte(schema.promotionalCodes.validFrom, now)
            ),
            or(
              isNull(schema.promotionalCodes.validUntil),
              gte(schema.promotionalCodes.validUntil, now)
            ),
            // Usage limit validation (only increment if under limit)
            or(
              isNull(schema.promotionalCodes.maxUses),
              lt(schema.promotionalCodes.currentUses, schema.promotionalCodes.maxUses)
            )
          )
        )
        .returning();

      if (!updatedPromo) {
        // Failed to update - could be invalid code, expired, over limit, or inactive
        const checkCode = await db.select().from(schema.promotionalCodes)
          .where(eq(schema.promotionalCodes.code, code))
          .limit(1);
        
        if (!checkCode[0]) {
          return { success: false, message: 'Código promocional no encontrado' };
        }
        
        const promo = checkCode[0];
        if (!promo.isActive) {
          return { success: false, message: 'Código promocional desactivado' };
        }
        if (promo.validFrom && promo.validFrom > now) {
          return { success: false, message: 'Código promocional aún no válido' };
        }
        if (promo.validUntil && promo.validUntil < now) {
          return { success: false, message: 'Código promocional expirado' };
        }
        if (promo.maxUses && promo.currentUses >= promo.maxUses) {
          return { success: false, message: 'Código promocional agotado' };
        }
        
        return { success: false, message: 'Error al procesar código promocional' };
      }

      // 2. Apply benefits to company (now that code is successfully redeemed)
      try {
        const [updatedCompany] = await db.update(schema.companies)
          .set({
            trialDurationDays: updatedPromo.trialDurationDays,
            usedPromotionalCode: code,
            updatedAt: now
          })
          .where(eq(schema.companies.id, companyId))
          .returning();

        if (!updatedCompany) {
          throw new Error('Company not found or could not be updated');
        }

        // 🎯 CRITICAL: Update subscription trial_end_date with promotional code days
        const newTrialEndDate = new Date();
        newTrialEndDate.setDate(newTrialEndDate.getDate() + updatedPromo.trialDurationDays);

        const [updatedSubscription] = await db.update(schema.subscriptions)
          .set({
            trialEndDate: newTrialEndDate,
            updatedAt: now
          })
          .where(eq(schema.subscriptions.companyId, companyId))
          .returning();

        if (!updatedSubscription) {
          throw new Error('Subscription not found or could not be updated');
        }

        console.log(`✅ Atomic promotional code application completed successfully:`);
        console.log(`   - Code '${code}' redeemed (${updatedPromo.currentUses}/${updatedPromo.maxUses || 'unlimited'} uses)`);
        console.log(`   - Company ${companyId} trial extended to ${updatedPromo.trialDurationDays} days`);
        console.log(`   - Subscription trial_end_date updated to: ${newTrialEndDate.toISOString()}`);

        return {
          success: true,
          message: `¡Código promocional aplicado! Obtienes ${updatedPromo.trialDurationDays} días de prueba gratuitos`,
          trialDays: updatedPromo.trialDurationDays,
          updatedCompany
        };

      } catch (companyError) {
        // If company update fails, revert the promotional code usage
        console.error('⚠️ Company update failed, reverting promotional code usage:', companyError);
        
        try {
          // Atomic rollback with safety check
          const [revertedPromo] = await db.update(schema.promotionalCodes)
            .set({ 
              currentUses: sql`${schema.promotionalCodes.currentUses} - 1`,
              updatedAt: now
            })
            .where(
              and(
                eq(schema.promotionalCodes.id, updatedPromo.id),
                sql`${schema.promotionalCodes.currentUses} > 0`
              )
            )
            .returning();
          
          if (revertedPromo) {
            console.log('✅ Successfully reverted promotional code usage');
          } else {
            console.error('⚠️ Could not revert promotional code - usage already at 0');
          }
        } catch (revertError) {
          console.error('❌ CRITICAL: Failed to revert promotional code usage:', revertError);
          // Try once more with simple decrement
          try {
            await db.update(schema.promotionalCodes)
              .set({ 
                currentUses: sql`${schema.promotionalCodes.currentUses} - 1`,
                updatedAt: now
              })
              .where(eq(schema.promotionalCodes.id, updatedPromo.id));
            console.log('✅ Successfully reverted promotional code usage on retry');
          } catch (retryError) {
            console.error('❌ CRITICAL: Failed promotional code revert on retry - manual intervention needed:', retryError);
          }
        }
        
        return { success: false, message: 'Error al aplicar beneficios a la empresa' };
      }

    } catch (error) {
      console.error('❌ Error in atomic promotional code application:', error);
      return { success: false, message: 'Error interno al procesar el código promocional' };
    }
  }

  // Company subscription operations
  async getCompanySubscription(companyId: number): Promise<any | undefined> {
    try {
      const [subscription] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.companyId, companyId));
      return subscription;
    } catch (error) {
      console.error('Error getting company subscription:', error);
      return undefined;
    }
  }

  async cancelCompanyDeletion(companyId: number): Promise<boolean> {
    // This is the same as cancelAccountDeletion - aliasing for compatibility
    return this.cancelAccountDeletion(companyId);
  }

  // ===== IMAGE PROCESSING JOBS =====
  
  async createImageProcessingJob(job: InsertImageProcessingJob): Promise<ImageProcessingJob> {
    const [created] = await db.insert(schema.imageProcessingJobs).values(job).returning();
    return created;
  }

  async getImageProcessingJob(id: number): Promise<ImageProcessingJob | undefined> {
    const result = await db.select().from(schema.imageProcessingJobs).where(eq(schema.imageProcessingJobs.id, id)).limit(1);
    return result[0];
  }

  async updateImageProcessingJob(
    id: number, 
    updates: Partial<InsertImageProcessingJob & Pick<ImageProcessingJob, 'status' | 'errorMessage' | 'startedAt' | 'completedAt'>>
  ): Promise<ImageProcessingJob | undefined> {
    const updateData: any = { ...updates, updatedAt: new Date() };
    const [updated] = await db.update(schema.imageProcessingJobs)
      .set(updateData)
      .where(eq(schema.imageProcessingJobs.id, id))
      .returning();
    return updated;
  }

  async getPendingImageProcessingJobs(): Promise<ImageProcessingJob[]> {
    return await db.select()
      .from(schema.imageProcessingJobs)
      .where(eq(schema.imageProcessingJobs.status, 'pending'))
      .orderBy(asc(schema.imageProcessingJobs.createdAt));
  }

  async getImageProcessingJobsByUser(userId: number): Promise<ImageProcessingJob[]> {
    return await db.select()
      .from(schema.imageProcessingJobs)
      .where(eq(schema.imageProcessingJobs.userId, userId))
      .orderBy(desc(schema.imageProcessingJobs.createdAt));
  }

  // ===== EMAIL MARKETING =====
  
  async getAllEmailCampaigns(): Promise<any[]> {
    const campaigns = await db.select()
      .from(schema.emailCampaigns)
      .orderBy(desc(schema.emailCampaigns.createdAt));
    
    // Calculate hasNewRecipients for each campaign
    const campaignsWithStatus = await Promise.all(
      campaigns.map(async (campaign) => {
        const selectedEmails = campaign.selectedEmails || [];
        
        if (selectedEmails.length === 0) {
          return { ...campaign, hasNewRecipients: false };
        }
        
        // Get emails already sent for this campaign with their status
        const sentRecords = await db.select({ 
          email: schema.emailCampaignSends.recipientEmail,
          status: schema.emailCampaignSends.status
        })
          .from(schema.emailCampaignSends)
          .where(eq(schema.emailCampaignSends.campaignId, campaign.id));
        
        const sentEmails = new Set(sentRecords.map(s => s.email));
        const newEmails = selectedEmails.filter((email: string) => !sentEmails.has(email));
        
        // Calculate successful sends (exclude bounced and failed from statistics)
        const successfulStatuses = ['sent', 'delivered', 'opened', 'clicked'];
        const successfulSends = sentRecords.filter(s => successfulStatuses.includes(s.status || ''));
        
        return {
          ...campaign,
          hasNewRecipients: newEmails.length > 0,
          newRecipientsCount: newEmails.length,
          sentRecipientsCount: sentEmails.size, // Total attempted (including bounces/failed)
          successfulSendCount: successfulSends.length // Only successful sends for rate calculations
        };
      })
    );
    
    return campaignsWithStatus;
  }

  async getEmailCampaignById(id: number): Promise<any | undefined> {
    const [campaign] = await db.select()
      .from(schema.emailCampaigns)
      .where(eq(schema.emailCampaigns.id, id));
    return campaign;
  }

  async getAllEmailProspects(): Promise<any[]> {
    // Get all prospects with their latest email campaign status in a single query
    // Uses LEFT JOIN with a subquery to get the latest send per email efficiently
    const prospects = await db.execute(sql`
      SELECT 
        p.id,
        p.email,
        p.name,
        p.company,
        p.phone,
        p.location,
        p.tags,
        p.status,
        p.notes,
        p.whatsapp_contacted as "whatsappContacted",
        p.whatsapp_conversation_status as "whatsappConversationStatus",
        p.whatsapp_conversation_status_updated_at as "whatsappConversationStatusUpdatedAt",
        p.instagram_contacted as "instagramContacted",
        p.instagram_conversation_status as "instagramConversationStatus",
        p.instagram_conversation_status_updated_at as "instagramConversationStatusUpdatedAt",
        p.created_at as "createdAt",
        CASE 
          WHEN latest_send.clicked_at IS NOT NULL THEN 'clicked'
          WHEN latest_send.opened_at IS NOT NULL THEN 'opened'
          WHEN latest_send.status IN ('sent', 'delivered') THEN 'sent'
          WHEN latest_send.status IN ('bounced', 'failed') THEN 'bounced'
          WHEN latest_send.status = 'pending' THEN 'pending'
          ELSE NULL
        END as "lastEmailStatus",
        latest_send.clicked_at as "lastEmailClickedAt",
        latest_send.opened_at as "lastEmailOpenedAt",
        latest_send.sent_at as "lastEmailSentAt"
      FROM email_prospects p
      LEFT JOIN LATERAL (
        SELECT status, clicked_at, opened_at, sent_at
        FROM email_campaign_sends
        WHERE recipient_email = p.email
        ORDER BY sent_at DESC NULLS LAST
        LIMIT 1
      ) latest_send ON true
      ORDER BY p.created_at DESC
    `);
    
    return prospects.rows;
  }

  async getRegisteredUsersStats(): Promise<{ total: number; active: number; trial: number; blocked: number; cancelled: number }> {
    const results = await db.select({
      total: sql<number>`count(*)`,
      active: sql<number>`count(*) filter (where ${schema.subscriptions.status} = 'active')`,
      trial: sql<number>`count(*) filter (where ${schema.subscriptions.status} = 'trial')`,
      blocked: sql<number>`count(*) filter (where ${schema.subscriptions.status} = 'blocked')`,
      cancelled: sql<number>`count(*) filter (where ${schema.subscriptions.status} = 'inactive')`
    })
    .from(schema.companies)
    .innerJoin(schema.subscriptions, eq(schema.companies.id, schema.subscriptions.companyId));

    const stats = results[0] || { total: 0, active: 0, trial: 0, blocked: 0, cancelled: 0 };
    return {
      total: Number(stats.total),
      active: Number(stats.active),
      trial: Number(stats.trial),
      blocked: Number(stats.blocked),
      cancelled: Number(stats.cancelled)
    };
  }

  async createEmailProspect(prospect: any): Promise<any> {
    const [created] = await db.insert(schema.emailProspects)
      .values(prospect)
      .returning();
    return created;
  }

  async updateEmailProspect(id: number, updates: any): Promise<any> {
    const [updated] = await db.update(schema.emailProspects)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.emailProspects.id, id))
      .returning();
    return updated;
  }

  async createEmailCampaign(campaign: any): Promise<any> {
    const [created] = await db.insert(schema.emailCampaigns)
      .values(campaign)
      .returning();
    return created;
  }

  async updateEmailCampaign(id: number, updates: any): Promise<any> {
    const [updated] = await db.update(schema.emailCampaigns)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.emailCampaigns.id, id))
      .returning();
    return updated;
  }

  async deleteEmailCampaign(id: number): Promise<boolean> {
    console.log('📦 Storage: Deleting email campaign with ID:', id);
    const result = await db.delete(schema.emailCampaigns)
      .where(eq(schema.emailCampaigns.id, id))
      .returning();
    console.log('📦 Storage: Delete result rows:', result.length);
    return result.length > 0;
  }

  async deleteEmailProspect(id: number): Promise<boolean> {
    const result = await db.delete(schema.emailProspects)
      .where(eq(schema.emailProspects.id, id))
      .returning();
    return result.length > 0;
  }

  // Work Session Audit Log Implementation
  async createWorkSessionAuditLog(log: InsertWorkSessionAuditLog): Promise<WorkSessionAuditLog> {
    const [created] = await db.insert(schema.workSessionAuditLog)
      .values(log)
      .returning();
    return created;
  }

  async getWorkSessionAuditLogs(workSessionId: number): Promise<any[]> {
    const logs = await db.select({
      id: schema.workSessionAuditLog.id,
      workSessionId: schema.workSessionAuditLog.workSessionId,
      companyId: schema.workSessionAuditLog.companyId,
      modificationType: schema.workSessionAuditLog.modificationType,
      oldValue: schema.workSessionAuditLog.oldValue,
      newValue: schema.workSessionAuditLog.newValue,
      reason: schema.workSessionAuditLog.reason,
      modifiedBy: schema.workSessionAuditLog.modifiedBy,
      modifiedAt: schema.workSessionAuditLog.modifiedAt,
      modifiedByName: schema.users.fullName,
    })
      .from(schema.workSessionAuditLog)
      .innerJoin(schema.users, eq(schema.workSessionAuditLog.modifiedBy, schema.users.id))
      .where(eq(schema.workSessionAuditLog.workSessionId, workSessionId))
      .orderBy(desc(schema.workSessionAuditLog.modifiedAt));
    
    return logs;
  }

  async getCompanyAuditLogs(companyId: number, limit: number = 100): Promise<WorkSessionAuditLog[]> {
    return db.select()
      .from(schema.workSessionAuditLog)
      .where(eq(schema.workSessionAuditLog.companyId, companyId))
      .orderBy(desc(schema.workSessionAuditLog.modifiedAt))
      .limit(limit);
  }

  // Work Session Modification Requests Implementation
  async createModificationRequest(request: InsertWorkSessionModificationRequest): Promise<WorkSessionModificationRequest> {
    const [created] = await db.insert(schema.workSessionModificationRequests)
      .values(request)
      .returning();
    return created;
  }

  async getModificationRequest(id: number): Promise<WorkSessionModificationRequest | undefined> {
    const [request] = await db.select()
      .from(schema.workSessionModificationRequests)
      .where(eq(schema.workSessionModificationRequests.id, id));
    return request;
  }

  async getEmployeeModificationRequests(employeeId: number): Promise<WorkSessionModificationRequest[]> {
    return db.select()
      .from(schema.workSessionModificationRequests)
      .where(eq(schema.workSessionModificationRequests.employeeId, employeeId))
      .orderBy(desc(schema.workSessionModificationRequests.createdAt));
  }

  async getCompanyModificationRequests(companyId: number, status?: string): Promise<WorkSessionModificationRequest[]> {
    if (status) {
      return db.select()
        .from(schema.workSessionModificationRequests)
        .where(
          and(
            eq(schema.workSessionModificationRequests.companyId, companyId),
            eq(schema.workSessionModificationRequests.status, status)
          )
        )
        .orderBy(desc(schema.workSessionModificationRequests.createdAt));
    }
    
    return db.select()
      .from(schema.workSessionModificationRequests)
      .where(eq(schema.workSessionModificationRequests.companyId, companyId))
      .orderBy(desc(schema.workSessionModificationRequests.createdAt));
  }

  async updateModificationRequest(id: number, updates: Partial<InsertWorkSessionModificationRequest>): Promise<WorkSessionModificationRequest | undefined> {
    const [updated] = await db.update(schema.workSessionModificationRequests)
      .set(updates)
      .where(eq(schema.workSessionModificationRequests.id, id))
      .returning();
    return updated;
  }

  async getPendingModificationRequestsCount(companyId: number): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(schema.workSessionModificationRequests)
      .where(
        and(
          eq(schema.workSessionModificationRequests.companyId, companyId),
          eq(schema.workSessionModificationRequests.status, 'pending')
        )
      );
    return result[0]?.count || 0;
  }

  // Work Reports (Partes de Trabajo)
  async createWorkReport(report: schema.InsertWorkReport & { durationMinutes: number }): Promise<schema.WorkReport> {
    const [result] = await db.insert(schema.workReports).values(report).returning();
    return result;
  }

  async getWorkReport(id: number): Promise<schema.WorkReport | undefined> {
    const [report] = await db.select()
      .from(schema.workReports)
      .where(eq(schema.workReports.id, id))
      .limit(1);
    return report;
  }

  async getWorkReportsByUser(userId: number, filters?: { startDate?: string; endDate?: string }): Promise<schema.WorkReport[]> {
    const conditions = [eq(schema.workReports.employeeId, userId)];
    
    if (filters?.startDate) {
      conditions.push(gte(schema.workReports.reportDate, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(schema.workReports.reportDate, filters.endDate));
    }
    
    return db.select()
      .from(schema.workReports)
      .where(and(...conditions))
      .orderBy(desc(schema.workReports.reportDate), desc(schema.workReports.startTime));
  }

  async getWorkReportsByCompany(
    companyId: number, 
    filters?: { employeeId?: number; startDate?: string; endDate?: string }
  ): Promise<(schema.WorkReport & { employeeName: string; employeeSignature?: string | null })[]> {
    const conditions = [eq(schema.workReports.companyId, companyId)];
    
    if (filters?.employeeId) {
      conditions.push(eq(schema.workReports.employeeId, filters.employeeId));
    }
    if (filters?.startDate) {
      conditions.push(gte(schema.workReports.reportDate, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(schema.workReports.reportDate, filters.endDate));
    }
    
    const reports = await db.select({
      id: schema.workReports.id,
      companyId: schema.workReports.companyId,
      employeeId: schema.workReports.employeeId,
      reportDate: schema.workReports.reportDate,
      refCode: schema.workReports.refCode,
      location: schema.workReports.location,
      locationCoords: schema.workReports.locationCoords,
      startTime: schema.workReports.startTime,
      endTime: schema.workReports.endTime,
      durationMinutes: schema.workReports.durationMinutes,
      description: schema.workReports.description,
      clientName: schema.workReports.clientName,
      notes: schema.workReports.notes,
      signedBy: schema.workReports.signedBy,
      signatureImage: schema.workReports.signatureImage,
      status: schema.workReports.status,
      createdAt: schema.workReports.createdAt,
      updatedAt: schema.workReports.updatedAt,
      employeeName: schema.users.fullName,
      employeeSignature: schema.users.signatureImage,
    })
      .from(schema.workReports)
      .innerJoin(schema.users, eq(schema.workReports.employeeId, schema.users.id))
      .where(and(...conditions))
      .orderBy(desc(schema.workReports.reportDate), desc(schema.workReports.startTime));
    
    return reports;
  }

  async updateWorkReport(id: number, updates: Partial<schema.InsertWorkReport> & { durationMinutes?: number }): Promise<schema.WorkReport | undefined> {
    const [updated] = await db.update(schema.workReports)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.workReports.id, id))
      .returning();
    return updated;
  }

  async deleteWorkReport(id: number): Promise<boolean> {
    const result = await db.delete(schema.workReports)
      .where(eq(schema.workReports.id, id))
      .returning();
    return result.length > 0;
  }

  // Optimized lightweight autocomplete queries - only fetch distinct values
  async getWorkReportRefCodes(userId: number): Promise<string[]> {
    const results = await db.selectDistinct({ refCode: schema.workReports.refCode })
      .from(schema.workReports)
      .where(and(
        eq(schema.workReports.employeeId, userId),
        isNotNull(schema.workReports.refCode)
      ))
      .orderBy(schema.workReports.refCode);
    
    return results
      .map(r => r.refCode)
      .filter((code): code is string => !!code && code.trim() !== '');
  }

  async getWorkReportLocations(userId: number): Promise<string[]> {
    const results = await db.selectDistinct({ location: schema.workReports.location })
      .from(schema.workReports)
      .where(eq(schema.workReports.employeeId, userId))
      .orderBy(schema.workReports.location);
    
    return results
      .map(r => r.location)
      .filter((loc): loc is string => !!loc && loc.trim() !== '');
  }

  async getWorkReportClients(userId: number): Promise<string[]> {
    const results = await db.selectDistinct({ clientName: schema.workReports.clientName })
      .from(schema.workReports)
      .where(and(
        eq(schema.workReports.employeeId, userId),
        isNotNull(schema.workReports.clientName)
      ))
      .orderBy(schema.workReports.clientName);
    
    return results
      .map(r => r.clientName)
      .filter((name): name is string => !!name && name.trim() !== '');
  }

  // Admin: Company-wide autocomplete queries
  async getCompanyWorkReportLocations(companyId: number): Promise<string[]> {
    const results = await db.selectDistinct({ location: schema.workReports.location })
      .from(schema.workReports)
      .where(eq(schema.workReports.companyId, companyId))
      .orderBy(schema.workReports.location);
    
    return results
      .map(r => r.location)
      .filter((loc): loc is string => !!loc && loc.trim() !== '');
  }

  async getCompanyWorkReportClients(companyId: number): Promise<string[]> {
    const results = await db.selectDistinct({ clientName: schema.workReports.clientName })
      .from(schema.workReports)
      .where(and(
        eq(schema.workReports.companyId, companyId),
        isNotNull(schema.workReports.clientName)
      ))
      .orderBy(schema.workReports.clientName);
    
    return results
      .map(r => r.clientName)
      .filter((name): name is string => !!name && name.trim() !== '');
  }

  async getCompanyWorkReportRefCodes(companyId: number): Promise<string[]> {
    const results = await db.selectDistinct({ refCode: schema.workReports.refCode })
      .from(schema.workReports)
      .where(and(
        eq(schema.workReports.companyId, companyId),
        isNotNull(schema.workReports.refCode)
      ))
      .orderBy(schema.workReports.refCode);
    
    return results
      .map(r => r.refCode)
      .filter((code): code is string => !!code && code.trim() !== '');
  }

  // Add-ons Store Methods
  async getAllAddons(): Promise<schema.Addon[]> {
    return await db.select().from(schema.addons).orderBy(schema.addons.sortOrder);
  }

  async getActiveAddons(): Promise<schema.Addon[]> {
    return await db.select()
      .from(schema.addons)
      .where(eq(schema.addons.isActive, true))
      .orderBy(schema.addons.sortOrder);
  }

  async getAddon(id: number): Promise<schema.Addon | undefined> {
    const [addon] = await db.select().from(schema.addons).where(eq(schema.addons.id, id));
    return addon;
  }

  async getAddonByKey(key: string): Promise<schema.Addon | undefined> {
    const [addon] = await db.select().from(schema.addons).where(eq(schema.addons.key, key));
    return addon;
  }

  async createAddon(addon: schema.InsertAddon): Promise<schema.Addon> {
    const [result] = await db.insert(schema.addons).values(addon).returning();
    return result;
  }

  async updateAddon(id: number, updates: Partial<schema.InsertAddon>): Promise<schema.Addon | undefined> {
    const [updated] = await db.update(schema.addons)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.addons.id, id))
      .returning();
    return updated;
  }

  // Company Add-ons Methods
  async getCompanyAddons(companyId: number): Promise<(schema.CompanyAddon & { addon: schema.Addon })[]> {
    const results = await db.select({
      id: schema.companyAddons.id,
      companyId: schema.companyAddons.companyId,
      addonId: schema.companyAddons.addonId,
      status: schema.companyAddons.status,
      stripeSubscriptionItemId: schema.companyAddons.stripeSubscriptionItemId,
      purchasedAt: schema.companyAddons.purchasedAt,
      activatedAt: schema.companyAddons.activatedAt,
      cancelledAt: schema.companyAddons.cancelledAt,
      cancellationEffectiveDate: schema.companyAddons.cancellationEffectiveDate,
      cooldownEndsAt: schema.companyAddons.cooldownEndsAt,
      lastStripeInvoiceId: schema.companyAddons.lastStripeInvoiceId,
      proratedDays: schema.companyAddons.proratedDays,
      createdAt: schema.companyAddons.createdAt,
      updatedAt: schema.companyAddons.updatedAt,
      addon: schema.addons,
    })
      .from(schema.companyAddons)
      .innerJoin(schema.addons, eq(schema.companyAddons.addonId, schema.addons.id))
      .where(eq(schema.companyAddons.companyId, companyId));
    
    return results;
  }

  async getCompanyAddon(companyId: number, addonId: number): Promise<schema.CompanyAddon | undefined> {
    const [result] = await db.select()
      .from(schema.companyAddons)
      .where(and(
        eq(schema.companyAddons.companyId, companyId),
        eq(schema.companyAddons.addonId, addonId)
      ));
    return result;
  }

  async getCompanyAddonByKey(companyId: number, addonKey: string): Promise<(schema.CompanyAddon & { addon: schema.Addon }) | undefined> {
    const results = await db.select({
      id: schema.companyAddons.id,
      companyId: schema.companyAddons.companyId,
      addonId: schema.companyAddons.addonId,
      status: schema.companyAddons.status,
      stripeSubscriptionItemId: schema.companyAddons.stripeSubscriptionItemId,
      purchasedAt: schema.companyAddons.purchasedAt,
      activatedAt: schema.companyAddons.activatedAt,
      cancelledAt: schema.companyAddons.cancelledAt,
      cancellationEffectiveDate: schema.companyAddons.cancellationEffectiveDate,
      cooldownEndsAt: schema.companyAddons.cooldownEndsAt,
      lastStripeInvoiceId: schema.companyAddons.lastStripeInvoiceId,
      proratedDays: schema.companyAddons.proratedDays,
      createdAt: schema.companyAddons.createdAt,
      updatedAt: schema.companyAddons.updatedAt,
      addon: schema.addons,
    })
      .from(schema.companyAddons)
      .innerJoin(schema.addons, eq(schema.companyAddons.addonId, schema.addons.id))
      .where(and(
        eq(schema.companyAddons.companyId, companyId),
        eq(schema.addons.key, addonKey)
      ));
    
    return results[0];
  }

  async createCompanyAddon(companyAddon: schema.InsertCompanyAddon): Promise<schema.CompanyAddon> {
    const [result] = await db.insert(schema.companyAddons).values(companyAddon).returning();
    return result;
  }

  async updateCompanyAddon(id: number, updates: Partial<schema.InsertCompanyAddon>): Promise<schema.CompanyAddon | undefined> {
    const [updated] = await db.update(schema.companyAddons)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.companyAddons.id, id))
      .returning();
    return updated;
  }

  // Mark addon as pending cancellation - user keeps access until end of billing period
  async markAddonPendingCancel(companyId: number, addonId: number, effectiveDate: Date): Promise<schema.CompanyAddon | undefined> {
    const [updated] = await db.update(schema.companyAddons)
      .set({
        status: 'pending_cancel',
        cancelledAt: new Date(),
        cancellationEffectiveDate: effectiveDate,
        cooldownEndsAt: effectiveDate, // Cannot re-add until this date
        updatedAt: new Date(),
      })
      .where(and(
        eq(schema.companyAddons.companyId, companyId),
        eq(schema.companyAddons.addonId, addonId),
        eq(schema.companyAddons.status, 'active')
      ))
      .returning();
    return updated;
  }

  // Immediately cancel addon (for trial period - no cooldown, immediate deactivation)
  async cancelAddonImmediately(companyId: number, addonId: number): Promise<schema.CompanyAddon | undefined> {
    const [updated] = await db.update(schema.companyAddons)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationEffectiveDate: new Date(),
        cooldownEndsAt: null, // NO COOLDOWN during trial
        updatedAt: new Date(),
      })
      .where(and(
        eq(schema.companyAddons.companyId, companyId),
        eq(schema.companyAddons.addonId, addonId),
        eq(schema.companyAddons.status, 'active')
      ))
      .returning();
    return updated;
  }

  // Fully cancel addon after billing period ends (called by webhook or scheduler)
  async finalizeAddonCancellation(companyId: number, addonId: number): Promise<schema.CompanyAddon | undefined> {
    const [updated] = await db.update(schema.companyAddons)
      .set({
        status: 'cancelled',
        updatedAt: new Date(),
      })
      .where(and(
        eq(schema.companyAddons.companyId, companyId),
        eq(schema.companyAddons.addonId, addonId),
        eq(schema.companyAddons.status, 'pending_cancel')
      ))
      .returning();
    return updated;
  }

  // Check if addon is in cooldown period (cannot be re-purchased)
  async isAddonInCooldown(companyId: number, addonId: number): Promise<boolean> {
    const result = await db.select({ cooldownEndsAt: schema.companyAddons.cooldownEndsAt })
      .from(schema.companyAddons)
      .where(and(
        eq(schema.companyAddons.companyId, companyId),
        eq(schema.companyAddons.addonId, addonId)
      ));
    
    if (!result[0]?.cooldownEndsAt) return false;
    return new Date() < result[0].cooldownEndsAt;
  }

  // Reactivate addon after cooldown (new purchase)
  async reactivateAddon(id: number, stripeSubscriptionItemId: string, proratedDays: number): Promise<schema.CompanyAddon | undefined> {
    const [updated] = await db.update(schema.companyAddons)
      .set({
        status: 'active',
        stripeSubscriptionItemId,
        activatedAt: new Date(),
        purchasedAt: new Date(),
        cancelledAt: null,
        cancellationEffectiveDate: null,
        cooldownEndsAt: null,
        proratedDays,
        updatedAt: new Date(),
      })
      .where(eq(schema.companyAddons.id, id))
      .returning();
    return updated;
  }

  // Legacy method for backwards compatibility
  async cancelCompanyAddon(companyId: number, addonId: number, effectiveDate: Date): Promise<schema.CompanyAddon | undefined> {
    return this.markAddonPendingCancel(companyId, addonId, effectiveDate);
  }

  // Check if user has access to addon (active OR pending_cancel - still has access until period end)
  async hasActiveAddon(companyId: number, addonKey: string): Promise<boolean> {
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(schema.companyAddons)
      .innerJoin(schema.addons, eq(schema.companyAddons.addonId, schema.addons.id))
      .where(and(
        eq(schema.companyAddons.companyId, companyId),
        eq(schema.addons.key, addonKey),
        or(
          eq(schema.companyAddons.status, 'active'),
          eq(schema.companyAddons.status, 'pending_cancel')
        )
      ));
    
    return (result[0]?.count ?? 0) > 0;
  }

  // Deactivate addon due to payment failure
  async deactivateAddonForPaymentFailure(companyId: number, addonId: number): Promise<schema.CompanyAddon | undefined> {
    const [updated] = await db.update(schema.companyAddons)
      .set({
        status: 'inactive',
        updatedAt: new Date(),
      })
      .where(and(
        eq(schema.companyAddons.companyId, companyId),
        eq(schema.companyAddons.addonId, addonId)
      ))
      .returning();
    return updated;
  }

  // ============================================================================
  // NEW MODEL: Feature Access Check (replaces plan-based feature checking)
  // ============================================================================

  /**
   * Check if a company has access to a specific feature.
   * NEW MODEL: Features are either free (included in base) or require addon purchase.
   * 
   * @param companyId - The company to check
   * @param featureKey - The feature key (e.g., 'messages', 'documents', 'time_tracking')
   * @returns true if the company has access to the feature
   */
  async hasFeatureAccess(companyId: number, featureKey: string): Promise<boolean> {
    // First, check if this feature/addon exists and if it's free
    const addon = await db.select({
      id: schema.addons.id,
      isFreeFeature: schema.addons.isFreeFeature,
      requiresSubscription: schema.addons.requiresSubscription,
    })
      .from(schema.addons)
      .where(eq(schema.addons.key, featureKey))
      .limit(1);

    // If addon doesn't exist, deny access
    if (!addon[0]) {
      return false;
    }

    // If it's a free feature (time_tracking, vacation, schedules), always grant access
    if (addon[0].isFreeFeature) {
      return true;
    }

    // For paid features, check if company has purchased and activated the addon
    return this.hasActiveAddon(companyId, featureKey);
  }

  /**
   * Get all features a company has access to (both free and purchased).
   * 
   * @param companyId - The company to check
   * @returns Array of feature keys the company has access to
   */
  async getCompanyFeatures(companyId: number): Promise<string[]> {
    // Get all free features
    const freeFeatures = await db.select({ key: schema.addons.key })
      .from(schema.addons)
      .where(and(
        eq(schema.addons.isFreeFeature, true),
        eq(schema.addons.isActive, true)
      ));

    // Get all purchased (active) addons for this company
    const purchasedAddons = await db.select({ key: schema.addons.key })
      .from(schema.companyAddons)
      .innerJoin(schema.addons, eq(schema.companyAddons.addonId, schema.addons.id))
      .where(and(
        eq(schema.companyAddons.companyId, companyId),
        or(
          eq(schema.companyAddons.status, 'active'),
          eq(schema.companyAddons.status, 'pending_cancel')
        )
      ));

    // Combine and deduplicate
    const allFeatures = new Set([
      ...freeFeatures.map(f => f.key),
      ...purchasedAddons.map(f => f.key)
    ]);

    return Array.from(allFeatures);
  }

  // ============================================================================
  // NEW MODEL: Seat/User Management
  // ============================================================================

  /**
   * Get seat pricing for a specific role type.
   */
  async getSeatPricing(roleType: string): Promise<schema.SeatPricing | undefined> {
    const [pricing] = await db.select()
      .from(schema.seatPricing)
      .where(eq(schema.seatPricing.roleType, roleType))
      .limit(1);
    return pricing;
  }

  /**
   * Get all seat pricing options.
   */
  async getAllSeatPricing(): Promise<schema.SeatPricing[]> {
    return db.select()
      .from(schema.seatPricing)
      .where(eq(schema.seatPricing.isActive, true))
      .orderBy(schema.seatPricing.sortOrder);
  }

  /**
   * Calculate the total number of users allowed for a company.
   * All seats are paid - extraXXX contains the contracted seats.
   */
  async getCompanyUserLimits(companyId: number): Promise<{
    admins: { included: number; extra: number; total: number };
    managers: { included: number; extra: number; total: number };
    employees: { included: number; extra: number; total: number };
    totalUsers: number;
  }> {
    const [subscription] = await db.select({
      extraAdmins: schema.subscriptions.extraAdmins,
      extraManagers: schema.subscriptions.extraManagers,
      extraEmployees: schema.subscriptions.extraEmployees,
    })
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.companyId, companyId))
      .limit(1);

    if (!subscription) {
      // Default limits if no subscription found - minimum 1 admin
      return {
        admins: { included: 0, extra: 1, total: 1 },
        managers: { included: 0, extra: 0, total: 0 },
        employees: { included: 0, extra: 0, total: 0 },
        totalUsers: 1,
      };
    }

    // All seats are paid - no included seats
    const admins = {
      included: 0,
      extra: subscription.extraAdmins,
      total: subscription.extraAdmins,
    };
    const managers = {
      included: 0,
      extra: subscription.extraManagers,
      total: subscription.extraManagers,
    };
    const employees = {
      included: 0,
      extra: subscription.extraEmployees,
      total: subscription.extraEmployees,
    };

    return {
      admins,
      managers,
      employees,
      totalUsers: admins.total + managers.total + employees.total,
    };
  }

  /**
   * Get current user counts by role for a company.
   */
  async getCompanyUserCounts(companyId: number): Promise<{
    admins: number;
    managers: number;
    employees: number;
    total: number;
  }> {
    const users = await db.select({
      role: schema.users.role,
      count: sql<number>`count(*)::int`,
    })
      .from(schema.users)
      .where(and(
        eq(schema.users.companyId, companyId),
        eq(schema.users.isActive, true)
      ))
      .groupBy(schema.users.role);

    const counts = {
      admins: 0,
      managers: 0,
      employees: 0,
      total: 0,
    };

    for (const row of users) {
      if (row.role === 'admin') counts.admins = row.count;
      else if (row.role === 'manager') counts.managers = row.count;
      else if (row.role === 'employee') counts.employees = row.count;
      counts.total += row.count;
    }

    return counts;
  }

  /**
   * Check if a company can add more users of a specific role.
   */
  async canAddUserOfRole(companyId: number, role: 'admin' | 'manager' | 'employee'): Promise<{
    canAdd: boolean;
    currentCount: number;
    limit: number;
    needsExtraSeat: boolean;
  }> {
    const limits = await this.getCompanyUserLimits(companyId);
    const counts = await this.getCompanyUserCounts(companyId);

    let limit: number;
    let currentCount: number;

    if (role === 'admin') {
      limit = limits.admins.total;
      currentCount = counts.admins;
    } else if (role === 'manager') {
      limit = limits.managers.total;
      currentCount = counts.managers;
    } else {
      limit = limits.employees.total;
      currentCount = counts.employees;
    }

    const canAdd = currentCount < limit;
    const needsExtraSeat = !canAdd;

    return { canAdd, currentCount, limit, needsExtraSeat };
  }

  /**
   * Update extra seats for a company.
   */
  async updateExtraSeats(
    companyId: number, 
    role: 'admin' | 'manager' | 'employee', 
    extraCount: number
  ): Promise<void> {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (role === 'admin') {
      updateData.extraAdmins = extraCount;
    } else if (role === 'manager') {
      updateData.extraManagers = extraCount;
    } else {
      updateData.extraEmployees = extraCount;
    }

    await db.update(schema.subscriptions)
      .set(updateData)
      .where(eq(schema.subscriptions.companyId, companyId));
  }

  /**
   * Update all extra user limits for a company at once.
   */
  async updateCompanyUserLimits(
    companyId: number, 
    limits: { extraEmployees: number; extraManagers: number; extraAdmins: number }
  ): Promise<void> {
    await db.update(schema.subscriptions)
      .set({
        extraEmployees: limits.extraEmployees,
        extraManagers: limits.extraManagers,
        extraAdmins: limits.extraAdmins,
        updatedAt: new Date(),
      })
      .where(eq(schema.subscriptions.companyId, companyId));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INVENTORY MANAGEMENT IMPLEMENTATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  // Product Categories
  async getProductCategories(companyId: number): Promise<schema.ProductCategory[]> {
    return await db.select().from(schema.productCategories)
      .where(eq(schema.productCategories.companyId, companyId))
      .orderBy(asc(schema.productCategories.sortOrder), asc(schema.productCategories.name));
  }

  async getProductCategory(id: number): Promise<schema.ProductCategory | undefined> {
    const [category] = await db.select().from(schema.productCategories)
      .where(eq(schema.productCategories.id, id));
    return category;
  }

  async createProductCategory(category: schema.InsertProductCategory): Promise<schema.ProductCategory> {
    const [result] = await db.insert(schema.productCategories).values(category).returning();
    return result;
  }

  async updateProductCategory(id: number, updates: Partial<schema.InsertProductCategory>): Promise<schema.ProductCategory | undefined> {
    const [result] = await db.update(schema.productCategories)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.productCategories.id, id))
      .returning();
    return result;
  }

  async deleteProductCategory(id: number): Promise<boolean> {
    const result = await db.delete(schema.productCategories)
      .where(eq(schema.productCategories.id, id));
    return true;
  }

  // Warehouses
  async getWarehouses(companyId: number): Promise<schema.Warehouse[]> {
    return await db.select().from(schema.warehouses)
      .where(eq(schema.warehouses.companyId, companyId))
      .orderBy(desc(schema.warehouses.isDefault), asc(schema.warehouses.name));
  }

  async getWarehouse(id: number): Promise<schema.Warehouse | undefined> {
    const [warehouse] = await db.select().from(schema.warehouses)
      .where(eq(schema.warehouses.id, id));
    return warehouse;
  }

  async createWarehouse(warehouse: schema.InsertWarehouse): Promise<schema.Warehouse> {
    const [result] = await db.insert(schema.warehouses).values(warehouse).returning();
    return result;
  }

  async updateWarehouse(id: number, updates: Partial<schema.InsertWarehouse>): Promise<schema.Warehouse | undefined> {
    const [result] = await db.update(schema.warehouses)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.warehouses.id, id))
      .returning();
    return result;
  }

  async deleteWarehouse(id: number): Promise<boolean> {
    await db.delete(schema.warehouses).where(eq(schema.warehouses.id, id));
    return true;
  }

  // Products
  async getProducts(companyId: number, filters?: { categoryId?: number; isActive?: boolean; isReturnable?: boolean; search?: string }): Promise<schema.Product[]> {
    let query = db.select().from(schema.products)
      .where(eq(schema.products.companyId, companyId))
      .$dynamic();
    
    const conditions = [eq(schema.products.companyId, companyId)];
    
    if (filters?.categoryId) {
      conditions.push(eq(schema.products.categoryId, filters.categoryId));
    }
    if (filters?.isActive !== undefined) {
      conditions.push(eq(schema.products.isActive, filters.isActive));
    }
    if (filters?.isReturnable !== undefined) {
      conditions.push(eq(schema.products.isReturnable, filters.isReturnable));
    }
    if (filters?.search) {
      conditions.push(
        or(
          sql`${schema.products.name} ILIKE ${'%' + filters.search + '%'}`,
          sql`${schema.products.sku} ILIKE ${'%' + filters.search + '%'}`,
          sql`${schema.products.barcode} ILIKE ${'%' + filters.search + '%'}`
        )!
      );
    }

    return await db.select().from(schema.products)
      .where(and(...conditions))
      .orderBy(asc(schema.products.name));
  }

  async getProduct(id: number): Promise<schema.Product | undefined> {
    const [product] = await db.select().from(schema.products)
      .where(eq(schema.products.id, id));
    return product;
  }

  async createProduct(product: schema.InsertProduct): Promise<schema.Product> {
    const [result] = await db.insert(schema.products).values(product).returning();
    return result;
  }

  async updateProduct(id: number, updates: Partial<schema.InsertProduct>): Promise<schema.Product | undefined> {
    const [result] = await db.update(schema.products)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.products.id, id))
      .returning();
    return result;
  }

  async deleteProduct(id: number): Promise<boolean> {
    await db.delete(schema.products).where(eq(schema.products.id, id));
    return true;
  }

  // Warehouse Stock
  async getWarehouseStock(companyId: number, warehouseId?: number): Promise<(schema.WarehouseStock & { product: schema.Product; warehouse: schema.Warehouse })[]> {
    const conditions = [eq(schema.warehouseStock.companyId, companyId)];
    if (warehouseId) {
      conditions.push(eq(schema.warehouseStock.warehouseId, warehouseId));
    }

    const results = await db.select({
      stock: schema.warehouseStock,
      product: schema.products,
      warehouse: schema.warehouses,
    })
      .from(schema.warehouseStock)
      .innerJoin(schema.products, eq(schema.warehouseStock.productId, schema.products.id))
      .innerJoin(schema.warehouses, eq(schema.warehouseStock.warehouseId, schema.warehouses.id))
      .where(and(...conditions));

    return results.map(r => ({
      ...r.stock,
      product: r.product,
      warehouse: r.warehouse,
    }));
  }

  async getProductStock(productId: number): Promise<(schema.WarehouseStock & { warehouse: schema.Warehouse })[]> {
    const results = await db.select({
      stock: schema.warehouseStock,
      warehouse: schema.warehouses,
    })
      .from(schema.warehouseStock)
      .innerJoin(schema.warehouses, eq(schema.warehouseStock.warehouseId, schema.warehouses.id))
      .where(eq(schema.warehouseStock.productId, productId));

    return results.map(r => ({
      ...r.stock,
      warehouse: r.warehouse,
    }));
  }

  async updateWarehouseStock(warehouseId: number, productId: number, quantity: number, companyId: number): Promise<schema.WarehouseStock> {
    // Upsert: create if not exists, update if exists
    const existing = await db.select().from(schema.warehouseStock)
      .where(and(
        eq(schema.warehouseStock.warehouseId, warehouseId),
        eq(schema.warehouseStock.productId, productId)
      ));

    if (existing.length > 0) {
      const [result] = await db.update(schema.warehouseStock)
        .set({ 
          quantity: String(quantity), 
          availableQuantity: String(quantity),
          updatedAt: new Date() 
        })
        .where(and(
          eq(schema.warehouseStock.warehouseId, warehouseId),
          eq(schema.warehouseStock.productId, productId)
        ))
        .returning();
      return result;
    } else {
      const [result] = await db.insert(schema.warehouseStock)
        .values({
          companyId,
          warehouseId,
          productId,
          quantity: String(quantity),
          availableQuantity: String(quantity),
          reservedQuantity: '0',
        })
        .returning();
      return result;
    }
  }

  async getLowStockProducts(companyId: number): Promise<(schema.Product & { totalStock: number })[]> {
    // Get products where total stock across all warehouses is below minStock
    const results = await db.select({
      product: schema.products,
      totalStock: sql<number>`COALESCE(SUM(${schema.warehouseStock.quantity}::numeric), 0)::int`,
    })
      .from(schema.products)
      .leftJoin(schema.warehouseStock, eq(schema.products.id, schema.warehouseStock.productId))
      .where(and(
        eq(schema.products.companyId, companyId),
        eq(schema.products.isActive, true),
        eq(schema.products.isService, false)
      ))
      .groupBy(schema.products.id)
      .having(sql`COALESCE(SUM(${schema.warehouseStock.quantity}::numeric), 0) < ${schema.products.minStock}`);

    return results.map(r => ({
      ...r.product,
      totalStock: r.totalStock,
    }));
  }

  // Inventory Movements
  async getInventoryMovements(companyId: number, filters?: { type?: string; status?: string; startDate?: Date; endDate?: Date; warehouseId?: number }): Promise<(schema.InventoryMovement & { createdBy: { fullName: string }; lines: schema.InventoryMovementLine[] })[]> {
    const conditions = [eq(schema.inventoryMovements.companyId, companyId)];
    
    if (filters?.type) {
      conditions.push(eq(schema.inventoryMovements.movementType, filters.type));
    }
    if (filters?.status) {
      conditions.push(eq(schema.inventoryMovements.status, filters.status));
    }
    if (filters?.startDate) {
      conditions.push(gte(schema.inventoryMovements.movementDate, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(schema.inventoryMovements.movementDate, filters.endDate));
    }
    if (filters?.warehouseId) {
      conditions.push(
        or(
          eq(schema.inventoryMovements.sourceWarehouseId, filters.warehouseId),
          eq(schema.inventoryMovements.destinationWarehouseId, filters.warehouseId)
        )!
      );
    }

    const movements = await db.select({
      movement: schema.inventoryMovements,
      createdByName: schema.users.fullName,
    })
      .from(schema.inventoryMovements)
      .innerJoin(schema.users, eq(schema.inventoryMovements.createdById, schema.users.id))
      .where(and(...conditions))
      .orderBy(desc(schema.inventoryMovements.movementDate));

    // Get lines for each movement
    const movementIds = movements.map(m => m.movement.id);
    const allLines = movementIds.length > 0 
      ? await db.select().from(schema.inventoryMovementLines)
          .where(inArray(schema.inventoryMovementLines.movementId, movementIds))
      : [];

    return movements.map(m => ({
      ...m.movement,
      createdBy: { fullName: m.createdByName },
      lines: allLines.filter(l => l.movementId === m.movement.id),
    }));
  }

  async getInventoryMovement(id: number): Promise<(schema.InventoryMovement & { createdBy: { fullName: string }; lines: (schema.InventoryMovementLine & { product: schema.Product })[] }) | undefined> {
    const [result] = await db.select({
      movement: schema.inventoryMovements,
      createdByName: schema.users.fullName,
    })
      .from(schema.inventoryMovements)
      .innerJoin(schema.users, eq(schema.inventoryMovements.createdById, schema.users.id))
      .where(eq(schema.inventoryMovements.id, id));

    if (!result) return undefined;

    const lines = await db.select({
      line: schema.inventoryMovementLines,
      product: schema.products,
    })
      .from(schema.inventoryMovementLines)
      .innerJoin(schema.products, eq(schema.inventoryMovementLines.productId, schema.products.id))
      .where(eq(schema.inventoryMovementLines.movementId, id))
      .orderBy(asc(schema.inventoryMovementLines.sortOrder));

    return {
      ...result.movement,
      createdBy: { fullName: result.createdByName },
      lines: lines.map(l => ({ ...l.line, product: l.product })),
    };
  }

  async createInventoryMovement(movement: schema.InsertInventoryMovement): Promise<schema.InventoryMovement> {
    const [result] = await db.insert(schema.inventoryMovements).values(movement).returning();
    return result;
  }

  async updateInventoryMovement(id: number, updates: Partial<schema.InsertInventoryMovement>): Promise<schema.InventoryMovement | undefined> {
    const [result] = await db.update(schema.inventoryMovements)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.inventoryMovements.id, id))
      .returning();
    return result;
  }

  async deleteInventoryMovement(id: number): Promise<boolean> {
    await db.delete(schema.inventoryMovements).where(eq(schema.inventoryMovements.id, id));
    return true;
  }

  // Movement Lines
  async createInventoryMovementLine(line: schema.InsertInventoryMovementLine): Promise<schema.InventoryMovementLine> {
    const [result] = await db.insert(schema.inventoryMovementLines).values(line).returning();
    return result;
  }

  async updateInventoryMovementLine(id: number, updates: Partial<schema.InsertInventoryMovementLine>): Promise<schema.InventoryMovementLine | undefined> {
    const [result] = await db.update(schema.inventoryMovementLines)
      .set(updates)
      .where(eq(schema.inventoryMovementLines.id, id))
      .returning();
    return result;
  }

  async deleteInventoryMovementLine(id: number): Promise<boolean> {
    await db.delete(schema.inventoryMovementLines).where(eq(schema.inventoryMovementLines.id, id));
    return true;
  }

  // Movement Sequences
  async getNextMovementNumber(companyId: number): Promise<string> {
    const currentYear = new Date().getFullYear();
    
    // Get or create sequence
    let [sequence] = await db.select().from(schema.movementSequences)
      .where(eq(schema.movementSequences.companyId, companyId));
    
    if (!sequence) {
      // Create new sequence
      [sequence] = await db.insert(schema.movementSequences)
        .values({
          companyId,
          prefix: 'ALB',
          currentYear,
          lastNumber: 0,
        })
        .returning();
    }
    
    // Reset counter if year changed
    if (sequence.currentYear !== currentYear) {
      await db.update(schema.movementSequences)
        .set({ currentYear, lastNumber: 0, updatedAt: new Date() })
        .where(eq(schema.movementSequences.companyId, companyId));
      sequence.lastNumber = 0;
    }
    
    // Increment and return
    const nextNumber = sequence.lastNumber + 1;
    await db.update(schema.movementSequences)
      .set({ lastNumber: nextNumber, updatedAt: new Date() })
      .where(eq(schema.movementSequences.companyId, companyId));
    
    return `${sequence.prefix}-${currentYear}-${String(nextNumber).padStart(5, '0')}`;
  }

  // Tool Loans
  async getToolLoans(companyId: number, filters?: { status?: string; assignedToId?: number; productId?: number }): Promise<(schema.ToolLoan & { product: schema.Product; assignedTo?: { fullName: string } })[]> {
    const conditions = [eq(schema.toolLoans.companyId, companyId)];
    
    if (filters?.status) {
      conditions.push(eq(schema.toolLoans.status, filters.status));
    }
    if (filters?.assignedToId) {
      conditions.push(eq(schema.toolLoans.assignedToId, filters.assignedToId));
    }
    if (filters?.productId) {
      conditions.push(eq(schema.toolLoans.productId, filters.productId));
    }

    const results = await db.select({
      loan: schema.toolLoans,
      product: schema.products,
      assignedToName: schema.users.fullName,
    })
      .from(schema.toolLoans)
      .innerJoin(schema.products, eq(schema.toolLoans.productId, schema.products.id))
      .leftJoin(schema.users, eq(schema.toolLoans.assignedToId, schema.users.id))
      .where(and(...conditions))
      .orderBy(desc(schema.toolLoans.loanDate));

    return results.map(r => ({
      ...r.loan,
      product: r.product,
      assignedTo: r.assignedToName ? { fullName: r.assignedToName } : undefined,
    }));
  }

  async getToolLoan(id: number): Promise<schema.ToolLoan | undefined> {
    const [loan] = await db.select().from(schema.toolLoans)
      .where(eq(schema.toolLoans.id, id));
    return loan;
  }

  async createToolLoan(loan: schema.InsertToolLoan): Promise<schema.ToolLoan> {
    const [result] = await db.insert(schema.toolLoans).values(loan).returning();
    return result;
  }

  async updateToolLoan(id: number, updates: Partial<schema.InsertToolLoan>): Promise<schema.ToolLoan | undefined> {
    const [result] = await db.update(schema.toolLoans)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.toolLoans.id, id))
      .returning();
    return result;
  }

  async getOverdueToolLoans(companyId: number): Promise<(schema.ToolLoan & { product: schema.Product })[]> {
    const now = new Date();
    
    const results = await db.select({
      loan: schema.toolLoans,
      product: schema.products,
    })
      .from(schema.toolLoans)
      .innerJoin(schema.products, eq(schema.toolLoans.productId, schema.products.id))
      .where(and(
        eq(schema.toolLoans.companyId, companyId),
        eq(schema.toolLoans.status, 'active'),
        isNotNull(schema.toolLoans.expectedReturnDate),
        lt(schema.toolLoans.expectedReturnDate, now)
      ));

    return results.map(r => ({
      ...r.loan,
      product: r.product,
    }));
  }
}

export const storage = new DrizzleStorage();
