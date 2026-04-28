import { eq, and, inArray, gte, lte, ilike, desc, sql as sqlTag } from "drizzle-orm";
import * as schema from "@shared/schema";
import type { DrizzleStorage } from "./storage.js";
import crypto from 'crypto';
import { sendEmployeeWelcomeEmail } from './email.js';
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

// Initialize database connection
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}
const connection = neon(process.env.DATABASE_URL);
const db = drizzle(connection, { schema });

// ⚠️ AI Assistant Functions - Executed by GPT-5 Nano via function calling
// These functions provide the AI assistant with capabilities to perform administrative tasks
// ARCHITECTURE: Read-only functions first (for context), then mutation functions

export interface AIFunctionContext {
  storage: DrizzleStorage;
  companyId: number;
  adminUserId: number;
}

async function logAIAuditAction(
  context: AIFunctionContext,
  action: string,
  details: string
) {
  try {
    const adminUser = await context.storage.getUser(context.adminUserId);
    await context.storage.createAuditLog({
      timestamp: new Date(),
      ip: 'ai-assistant',
      action,
      email: adminUser?.companyEmail || adminUser?.personalEmail || undefined,
      success: true,
      details,
    });
  } catch (error: any) {
    console.error('⚠️ [AI AUDIT] Could not persist audit log:', error?.message || error);
  }
}

// ========================================
// 📖 READ-ONLY FUNCTIONS (Query/Consult)
// ========================================
// These functions allow the AI to gather context before acting

// QUERY 1: List all employees in the company
export async function listEmployees(
  context: AIFunctionContext,
  params?: {
    role?: string; // Optional: filter by role (admin/employee)
    includeInactive?: boolean; // Optional: include inactive employees (default: false, only active)
  }
) {
  const { storage, companyId } = context;
  
  const allEmployees = await storage.getUsersByCompany(companyId);
  
  let filteredEmployees = allEmployees;
  
  // Filter by active status (default: only active employees)
  if (!params?.includeInactive) {
    filteredEmployees = filteredEmployees.filter(emp => emp.status === 'active');
  }
  
  // Filter by role if specified
  if (params?.role) {
    filteredEmployees = filteredEmployees.filter(emp => emp.role === params.role);
  }
  
  // Return simplified employee info for AI context
  return {
    success: true,
    totalCount: filteredEmployees.length,
    employees: filteredEmployees.map(emp => ({
      id: emp.id,
      fullName: emp.fullName,
      role: emp.role,
      status: emp.status
    }))
  };
}

// QUERY 2: Get work shifts for an employee in a date range
export async function getEmployeeShifts(
  context: AIFunctionContext,
  params: {
    employeeId: number;
    startDate?: string; // Optional: YYYY-MM-DD
    endDate?: string;   // Optional: YYYY-MM-DD
  }
) {
  const { storage, companyId } = context;
  
  const employee = await storage.getUser(params.employeeId);
  if (!employee || employee.companyId !== companyId) {
    return {
      success: false,
      error: "Empleado no encontrado o no pertenece a esta empresa"
    };
  }
  
  const shifts = await storage.getWorkShiftsByEmployee(
    params.employeeId,
    params.startDate,
    params.endDate
  );
  
  return {
    success: true,
    employeeName: employee.fullName,
    totalShifts: shifts.length,
    shifts: shifts.map(shift => ({
      id: shift.id,
      title: shift.title,
      startAt: new Date(shift.startAt).toLocaleString('es-ES'),
      endAt: new Date(shift.endAt).toLocaleString('es-ES'),
      location: shift.location || "Sin ubicación",
      color: shift.color,
      notes: shift.notes || ""
    }))
  };
}

// QUERY 3: Get company context summary (useful for understanding current state)
export async function getCompanyContext(
  context: AIFunctionContext
) {
  const { storage, companyId } = context;
  
  const employees = await storage.getUsersByCompany(companyId);
  const adminCount = employees.filter(e => e.role === 'admin').length;
  const employeeCount = employees.filter(e => e.role === 'employee').length;
  
  // Get pending requests count
  const pendingTimeRequests = await storage.getCompanyModificationRequests(companyId);
  const pendingTimeCount = pendingTimeRequests.filter(r => r.status === 'pending').length;
  
  return {
    success: true,
    context: {
      totalEmployees: employees.length,
      admins: adminCount,
      regularEmployees: employeeCount,
      pendingTimeModificationRequests: pendingTimeCount,
      employeeNames: employees.map(e => e.fullName).slice(0, 10) // First 10 for context
    }
  };
}

// QUERY 4: Get employee work hours in a date range (with navigation support)
export async function getEmployeeWorkHours(
  context: AIFunctionContext,
  params: {
    employeeName?: string; // Optional: specific employee (resolves by name)
    employeeId?: number; // Optional: specific employee (already resolved ID from routes.ts)
    period: 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom';
    startDate?: string; // Required if period = 'custom' (YYYY-MM-DD)
    endDate?: string; // Required if period = 'custom' (YYYY-MM-DD)
  }
) {
  const { storage, companyId } = context;
  
  // Calculate date range based on period
  const now = new Date();
  let startDate: Date;
  let endDate: Date;
  let periodDescription: string;
  
  switch (params.period) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      periodDescription = 'hoy';
      break;
    case 'yesterday':
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      startDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
      endDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
      periodDescription = 'ayer';
      break;
    case 'this_week':
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      periodDescription = 'esta semana';
      break;
    case 'last_week':
      const lastWeekDay = now.getDay();
      const lastMondayOffset = lastWeekDay === 0 ? -13 : -6 - lastWeekDay;
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + lastMondayOffset);
      const lastSunday = new Date(startDate);
      lastSunday.setDate(lastSunday.getDate() + 6);
      endDate = new Date(lastSunday.getFullYear(), lastSunday.getMonth(), lastSunday.getDate(), 23, 59, 59);
      periodDescription = 'la semana pasada';
      break;
    case 'this_month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      periodDescription = 'este mes';
      break;
    case 'last_month':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      periodDescription = 'el mes pasado';
      break;
    case 'custom':
      if (!params.startDate || !params.endDate) {
        return { success: false, error: "Para período personalizado necesitas especificar startDate y endDate" };
      }
      startDate = new Date(params.startDate);
      endDate = new Date(params.endDate);
      endDate.setHours(23, 59, 59);
      periodDescription = `del ${startDate.toLocaleDateString('es-ES')} al ${endDate.toLocaleDateString('es-ES')}`;
      break;
    default:
      return { success: false, error: "Período no válido" };
  }
  
  // Get company for URL building
  const company = await storage.getCompany(companyId);
  if (!company) {
    return { success: false, error: "Empresa no encontrada" };
  }
  
  // Handle employee ID - either passed directly or resolved from name
  let targetEmployeeId: number | undefined;
  let targetEmployeeName: string | undefined;
  
  // If employeeId was already resolved by routes.ts, use it directly
  if (params.employeeId) {
    targetEmployeeId = params.employeeId;
    const employee = await storage.getUser(targetEmployeeId);
    targetEmployeeName = employee?.fullName;
  }
  // Otherwise try to resolve from name
  else if (params.employeeName) {
    const resolved = await resolveEmployeeName(storage, companyId, params.employeeName);
    if ('error' in resolved) {
      return { success: false, error: resolved.error };
    }
    targetEmployeeId = resolved.employeeId;
    const employee = await storage.getUser(targetEmployeeId);
    targetEmployeeName = employee?.fullName;
  }
  
  // Get work sessions stats
  const stats = await storage.getWorkSessionsStats(companyId, startDate, endDate);
  
  // Filter by employee if specified
  let filteredStats = stats;
  if (targetEmployeeId) {
    filteredStats = stats.filter(s => s.employeeId === targetEmployeeId);
  }
  
  // Calculate totals
  const totalHours = filteredStats.reduce((sum, s) => sum + (s.totalHours - (s.totalBreakHours || 0)), 0);
  const totalSessions = filteredStats.reduce((sum, s) => sum + s.sessionCount, 0);
  
  // Build navigation URL
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];
  let navigateTo = `/${company.companyAlias}/fichajes?startDate=${startDateStr}&endDate=${endDateStr}`;
  if (targetEmployeeId) {
    navigateTo += `&employeeId=${targetEmployeeId}`;
  }
  
  // Build response message
  let message: string;
  if (targetEmployeeName) {
    message = `${targetEmployeeName} trabajó ${totalHours.toFixed(1)} horas ${periodDescription} (${totalSessions} fichaje${totalSessions !== 1 ? 's' : ''})`;
  } else {
    message = `El equipo trabajó un total de ${totalHours.toFixed(1)} horas ${periodDescription} (${totalSessions} fichaje${totalSessions !== 1 ? 's' : ''})`;
  }
  
  return {
    success: true,
    message,
    data: {
      totalHours: Number(totalHours.toFixed(2)),
      totalSessions,
      period: periodDescription,
      employeeName: targetEmployeeName || 'Todos',
      breakdown: filteredStats.map(s => ({
        employeeId: s.employeeId,
        hours: Number((s.totalHours - (s.totalBreakHours || 0)).toFixed(2)),
        sessions: s.sessionCount
      }))
    },
    navigateTo
  };
}

// QUERY 5: Get company settings/policies
export async function getCompanySettings(
  context: AIFunctionContext
) {
  const { storage, companyId } = context;
  
  const company = await storage.getCompany(companyId);
  if (!company) {
    return { success: false, error: "Empresa no encontrada" };
  }
  
  const workingHoursPerDay = Number(company.workingHoursPerDay) || 8;
  const vacationDaysPerMonth = Number(company.vacationDaysPerMonth) || 2.5;
  const vacationDaysPerYear = vacationDaysPerMonth * 12;
  
  return {
    success: true,
    settings: {
      workingHoursPerDay,
      workingHoursPerWeek: workingHoursPerDay * 5,
      vacationDaysPerMonth,
      vacationDaysPerYear: Math.round(vacationDaysPerYear),
      workingHoursStart: company.workingHoursStart || "08:00",
      workingHoursEnd: company.workingHoursEnd || "17:00",
      workingDays: company.workingDays || [1, 2, 3, 4, 5],
      timezone: company.timezone || "Europe/Madrid",
      allowManagersToGrantRoles: company.allowManagersToGrantRoles || false
    },
    navigateTo: `/${company.companyAlias}/configuracion?tab=policies`
  };
}

// QUERY 6: Get vacation balance for an employee
export async function getVacationBalance(
  context: AIFunctionContext,
  params: {
    employeeName?: string; // Optional: specific employee, if not provided returns all
    employeeId?: number; // Optional: already resolved ID from routes.ts
  }
) {
  const { storage, companyId } = context;
  
  const company = await storage.getCompany(companyId);
  if (!company) {
    return { success: false, error: "Empresa no encontrada" };
  }
  
  const employees = await storage.getUsersByCompany(companyId);
  let targetEmployees = employees.filter(e => e.status === 'active');
  let targetEmployeeId: number | undefined;
  
  // If employeeId was already resolved by routes.ts, use it directly
  if (params.employeeId) {
    targetEmployeeId = params.employeeId;
    targetEmployees = targetEmployees.filter(e => e.id === targetEmployeeId);
  }
  // Otherwise try to resolve from name
  else if (params.employeeName) {
    const resolved = await resolveEmployeeName(storage, companyId, params.employeeName);
    if ('error' in resolved) {
      return { success: false, error: resolved.error };
    }
    targetEmployeeId = resolved.employeeId;
    targetEmployees = targetEmployees.filter(e => e.id === targetEmployeeId);
  }
  
  // Get all vacation requests for the company
  const allVacationRequests = await storage.getVacationRequestsByCompany(companyId);
  
  const balances = [];
  for (const emp of targetEmployees) {
    const totalDays = await storage.calculateVacationDays(emp.id);
    
    // Calculate used and pending days from vacation requests
    const empRequests = allVacationRequests.filter((r: any) => r.userId === emp.id);
    let usedDays = 0;
    let pendingDays = 0;
    
    for (const req of empRequests) {
      const start = new Date(req.startDate);
      const end = new Date(req.endDate);
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      if (req.status === 'approved') {
        usedDays += days;
      } else if (req.status === 'pending') {
        pendingDays += days;
      }
    }
    
    const availableDays = Math.max(0, totalDays - usedDays - pendingDays);
    
    balances.push({
      employeeId: emp.id,
      employeeName: emp.fullName,
      totalDays,
      usedDays,
      pendingDays,
      availableDays
    });
  }
  
  if ((params.employeeName || params.employeeId) && balances.length === 1) {
    const b = balances[0];
    return {
      success: true,
      message: `${b.employeeName} tiene ${b.availableDays} días de ausencias disponibles (${b.usedDays} usados, ${b.pendingDays} pendientes de aprobación, de ${b.totalDays} totales)`,
      balance: b,
      navigateTo: `/${company.companyAlias}/ausencias?tab=calendar&employeeId=${b.employeeId}`
    };
  }
  
  return {
    success: true,
    message: `Resumen de ausencias para ${balances.length} empleados`,
    balances,
    navigateTo: `/${company.companyAlias}/ausencias?tab=calendar`
  };
}

// QUERY 7: Get all pending approvals (vacations, time modifications, work reports)
export async function getPendingApprovals(
  context: AIFunctionContext
) {
  const { storage, companyId } = context;
  
  const company = await storage.getCompany(companyId);
  if (!company) {
    return { success: false, error: "Empresa no encontrada" };
  }
  
  // Get pending vacation requests
  const vacationRequests = await storage.getVacationRequestsByCompany(companyId);
  const pendingVacations = vacationRequests.filter(r => r.status === 'pending');
  
  // Get pending time modification requests
  const timeRequests = await storage.getCompanyModificationRequests(companyId);
  const pendingTimeModifications = timeRequests.filter(r => r.status === 'pending');
  
  // Get pending work reports
  const workReports = await storage.getWorkReportsByCompany(companyId);
  const pendingReports = workReports.filter(r => r.status === 'pending');
  
  const totalPending = pendingVacations.length + pendingTimeModifications.length + pendingReports.length;
  
  let message = "";
  const parts = [];
  if (pendingVacations.length > 0) parts.push(`${pendingVacations.length} ausencias`);
  if (pendingTimeModifications.length > 0) parts.push(`${pendingTimeModifications.length} modificaciones de fichaje`);
  if (pendingReports.length > 0) parts.push(`${pendingReports.length} partes de trabajo`);
  
  if (totalPending === 0) {
    message = "No hay solicitudes pendientes de aprobación";
  } else {
    // Prefer friendly, concise phrasing and avoid embedding URLs in messages.
    if (pendingVacations.length > 0 && pendingVacations.length >= pendingTimeModifications.length && pendingVacations.length >= pendingReports.length) {
      message = `Sí, tienes ${pendingVacations.length} solicitud${pendingVacations.length > 1 ? 'es' : ''} de ausencias pendientes — te las muestro.`;
    } else if (pendingTimeModifications.length > 0 && pendingTimeModifications.length >= pendingReports.length) {
      message = `Sí, tienes ${pendingTimeModifications.length} modificación${pendingTimeModifications.length > 1 ? 'es' : ''} de fichaje pendientes — te las muestro.`;
    } else if (pendingReports.length > 0) {
      message = `Sí, tienes ${pendingReports.length} parte${pendingReports.length > 1 ? 's' : ''} de trabajo pendiente${pendingReports.length > 1 ? 's' : ''} — te los muestro.`;
    } else {
      message = `Tienes ${totalPending} solicitud${totalPending > 1 ? 'es' : ''} pendiente${totalPending > 1 ? 's' : ''} — te las muestro.`;
    }
  }
  
  // Determine navigation based on what has most pending
  let navigateTo = `/${company.companyAlias}/inicio`;
  if (pendingVacations.length >= pendingTimeModifications.length && pendingVacations.length >= pendingReports.length && pendingVacations.length > 0) {
    // Navigate to Ausencias (absences)
    navigateTo = `/${company.companyAlias}/ausencias?tab=requests&status=pending`;
  } else if (pendingTimeModifications.length >= pendingReports.length && pendingTimeModifications.length > 0) {
    navigateTo = `/${company.companyAlias}/fichajes?tab=requests&status=pending`;
  } else if (pendingReports.length > 0) {
    navigateTo = `/${company.companyAlias}/partes?status=pending`;
  }
  
  // Get employee names for modification requests
  const employees = await storage.getUsersByCompany(companyId);
  const employeeMap = new Map(employees.map(e => [e.id, e.fullName]));
  
  return {
    success: true,
    message,
    pending: {
      vacations: pendingVacations.length,
      timeModifications: pendingTimeModifications.length,
      workReports: pendingReports.length,
      total: totalPending
    },
    details: {
      vacations: pendingVacations.slice(0, 5).map((v: any) => ({
        id: v.id,
        employeeName: v.user?.fullName || 'Desconocido',
        startDate: new Date(v.startDate).toLocaleDateString('es-ES'),
        endDate: new Date(v.endDate).toLocaleDateString('es-ES')
      })),
      timeModifications: pendingTimeModifications.slice(0, 5).map(t => ({
        id: t.id,
        employeeName: employeeMap.get(t.employeeId) || 'Desconocido',
        type: t.requestType,
        date: new Date(t.createdAt!).toLocaleDateString('es-ES')
      }))
    },
    navigateTo
  };}

// ========================================
// ✏️ MUTATION FUNCTIONS (Actions)
// ========================================

// Helper function to normalize strings for accent-insensitive comparison
function normalizeForComparison(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// ⚠️ HELPER: Calculate UTC day boundaries from YYYY-MM-DD string
// This ensures consistent timezone handling across all date-based operations
function getUTCDayBoundaries(dateString: string) {
  // Parse as UTC midnight to avoid timezone issues
  const targetDate = new Date(`${dateString}T00:00:00Z`);
  const startOfDay = new Date(targetDate);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setUTCHours(23, 59, 59, 999);
  
  return { startOfDay, endOfDay, targetDate };
}

// Helper function to resolve employee names to IDs
export async function resolveEmployeeName(
  storage: DrizzleStorage,
  companyId: number,
  employeeName: string
): Promise<{ employeeId: number; message?: string } | { error: string }> {
  // Get all employees from the company
  const allEmployees = await storage.getUsersByCompany(companyId);

  // Search with weighted matching to reduce ambiguous partial-name collisions.
  const normalizedSearch = normalizeForComparison(employeeName).trim();
  const searchWords = normalizedSearch.split(/\s+/).filter(Boolean);

  const scoredMatches = allEmployees
    .map(emp => {
      const normalizedFullName = normalizeForComparison(emp.fullName).trim();
      const fullNameWords = normalizedFullName.split(/\s+/).filter(Boolean);

      if (normalizedFullName === normalizedSearch) {
        return { employee: emp, score: 1 };
      }

      const matchedWords = searchWords.filter(searchWord =>
        fullNameWords.some(nameWord =>
          nameWord === searchWord ||
          nameWord.startsWith(searchWord) ||
          searchWord.startsWith(nameWord)
        )
      ).length;

      const coverage = searchWords.length > 0 ? matchedWords / searchWords.length : 0;
      const containsBonus = normalizedFullName.includes(normalizedSearch) ? 0.1 : 0;
      const score = Math.min(1, coverage + containsBonus);

      return { employee: emp, score };
    })
    .filter(item => item.score >= 0.6)
    .sort((a, b) => b.score - a.score);

  const matches = scoredMatches.map(item => item.employee);
  
  if (matches.length === 0) {
    return { error: `No encontré ningún empleado con el nombre "${employeeName}". Por favor, verifica el nombre e intenta de nuevo.` };
  }

  if (matches.length === 1 || (scoredMatches[0]?.score ?? 0) >= 0.95) {
    return { employeeId: matches[0].id };
  }

  // Resolve if best match is clearly above second candidate
  if ((scoredMatches[0]?.score ?? 0) - (scoredMatches[1]?.score ?? 0) >= 0.2) {
    return {
      employeeId: scoredMatches[0].employee.id,
      message: `Interpreté "${employeeName}" como "${scoredMatches[0].employee.fullName}".`
    };
  }

  // Multiple matches - return error with list
  const matchNames = matches.slice(0, 5).map(emp => emp.fullName).join(", ");
  return { 
    error: `Encontré varios empleados con ese nombre: ${matchNames}. Por favor, especifica el nombre completo exacto.` 
  };
}

// FEATURE FLAGS BY SUBSCRIPTION TIER
// Defines which AI functions are available under each plan
export const FEATURE_FLAGS_BY_TIER = {
  "free": ["listEmployees", "getEmployeeShifts", "getEmployeeWorkHours"],
  "starter": [
    "listEmployees", "getEmployeeShifts", "getEmployeeWorkHours", "getVacationBalance",
    "getPendingApprovals", "navigateToPage"
  ],
  "professional": [
    // All starter features +
    "listEmployees", "getEmployeeShifts", "getEmployeeWorkHours", "getVacationBalance",
    "getPendingApprovals", "navigateToPage",
    "assignSchedule", "assignScheduleInRange", "updateWorkShiftTimes",
    "deleteWorkShift", "assignRotatingSchedule", "detectWorkShiftOverlaps",
    "sendMessage", "approveVacationRequests", "approveTimeModificationRequests",
    "createReminder", "requestDocument", "getCompanySettings",
    "updateEmployeeShiftsColor", "updateWorkShiftColor", "generateTimeReport"
  ],
  "enterprise": [
    // All professional features +
    "listEmployees", "getEmployeeShifts", "getEmployeeWorkHours", "getVacationBalance",
    "getPendingApprovals", "navigateToPage",
    "assignSchedule", "assignScheduleInRange", "updateWorkShiftTimes",
    "deleteWorkShift", "assignRotatingSchedule", "detectWorkShiftOverlaps",
    "sendMessage", "approveVacationRequests", "approveTimeModificationRequests",
    "createReminder", "requestDocument", "getCompanySettings",
    "updateEmployeeShiftsColor", "updateWorkShiftColor", "generateTimeReport",
    "createEmployee", "updateEmployee", "generatePayrollReport",
    "swapEmployeeShifts", "copyEmployeeShifts", "createShiftAfterEmployee",
    "updateWorkShiftDetails", "deleteWorkShiftsInRange", "updateWorkShiftsInRange",
    // CRM functions (premium)
    "getActiveWorkers", "listCRMContacts", "createCRMContact", "addCRMInteraction",
    // Work reports (premium)
    "listWorkReports", "createWorkReport",
    // Vacation requests (premium)
    "createVacationRequest",
    // Accounting (premium)
    "getAccountingSummary"
  ]
};

// Helper function to check if a feature is available for a tier
export function isFeatureAvailable(
  functionName: string,
  planName: string,
  hasAddon: boolean = false
): boolean {
  // If addon is active, premium functions available
  if (hasAddon && ["getActiveWorkers", "listCRMContacts", "createCRMContact", "addCRMInteraction",
                     "listWorkReports", "createWorkReport", "createVacationRequest",
                     "getAccountingSummary"].includes(functionName)) {
    return true;
  }

  // Normalize plan name
  const normalizedPlan = planName?.toLowerCase() || "free";
  const availableFunctions = FEATURE_FLAGS_BY_TIER[normalizedPlan as keyof typeof FEATURE_FLAGS_BY_TIER]
    || FEATURE_FLAGS_BY_TIER["free"];

  return availableFunctions.includes(functionName);
}

// CENTRALIZED RESOLUTION HELPER
// This function should be used in ALL places where employeeId needs to be resolved
// Eliminates duplicate resolution logic and reduces DB queries  
export async function resolveEmployeeIdFromParams(
  storage: DrizzleStorage,
  companyId: number,
  params: { employeeId?: number; employeeName?: string }
): Promise<{ employeeId: number; employeeName: string } | { error: string }> {
  let targetEmployeeId: number | undefined;
  
  // If employeeId was already resolved elsewhere, use it directly
  if (params.employeeId) {
    targetEmployeeId = params.employeeId;
  }
  // Otherwise try to resolve from name
  else if (params.employeeName) {
    const resolved = await resolveEmployeeName(storage, companyId, params.employeeName);
    if ('error' in resolved) {
      return { error: resolved.error };
    }
    targetEmployeeId = resolved.employeeId;
  } else {
    return { error: 'Se requiere employeeId o employeeName' };
  }
  
  // Get employee name for response
  const employee = await storage.getUser(targetEmployeeId);
  if (!employee) {
    return { error: `Empleado con ID ${targetEmployeeId} no encontrado` };
  }
  
  return {
    employeeId: targetEmployeeId,
    employeeName: employee.fullName,
  };
}

// 1. Send message/circular to employees
export async function sendMessage(
  context: AIFunctionContext,
  params: {
    employeeIds: number[] | "all";
    subject: string;
    content: string;
  }
) {
  const { storage, companyId, adminUserId } = context;

  // Get all employees from the company if "all" is specified
  let targetEmployeeIds = params.employeeIds;
  if (params.employeeIds === "all") {
    const allEmployees = await storage.getUsersByCompany(companyId);
    targetEmployeeIds = allEmployees.map((emp) => emp.id);
  }

  // Ensure we have an array
  if (!Array.isArray(targetEmployeeIds)) {
    throw new Error("employeeIds must be an array or 'all'");
  }

  // Send message to each employee
  const results = [];
  for (const employeeId of targetEmployeeIds) {
    const message = await storage.createMessage({
      senderId: adminUserId,
      receiverId: employeeId,
      subject: params.subject,
      content: params.content,
    });
    results.push(message);

    // Send push notification asynchronously
    try {
      const admin = await storage.getUser(adminUserId);
      const { sendMessageNotification } = await import("./pushNotificationScheduler.js");
      sendMessageNotification(employeeId, admin?.fullName || "Admin", params.subject, message.id);
    } catch (error) {
      // Silently fail push notification
    }
  }

  await logAIAuditAction(
    context,
    'ai_send_message',
    `recipientCount=${results.length}; recipientIds=${JSON.stringify(targetEmployeeIds)}; subject=${params.subject}`
  );

  return {
    success: true,
    messageCount: results.length,
    recipientIds: targetEmployeeIds,
  };
}

// 2. Approve time modification requests
export async function approveTimeModificationRequests(
  context: AIFunctionContext,
  params: {
    requestIds: number[] | "all_pending";
    adminResponse?: string;
  }
) {
  const { storage, companyId, adminUserId } = context;

  // Get all pending requests if "all_pending" is specified
  let targetRequestIds = params.requestIds;
  if (params.requestIds === "all_pending") {
    const pendingRequests = await db.select()
      .from(schema.workSessionModificationRequests)
      .where(
        and(
          eq(schema.workSessionModificationRequests.companyId, companyId),
          eq(schema.workSessionModificationRequests.status, "pending")
        )
      );
    targetRequestIds = pendingRequests.map((req: any) => req.id);
  }

  // Ensure we have an array
  if (!Array.isArray(targetRequestIds)) {
    throw new Error("requestIds must be an array or 'all_pending'");
  }

  // Approve each request
  const results = [];
  for (const requestId of targetRequestIds) {
    const updated = await storage.updateModificationRequest(requestId, {
      status: "approved",
      adminResponse: params.adminResponse || "Aprobado por asistente de IA",
      reviewedBy: adminUserId,
      reviewedAt: new Date(),
    } as any);
    results.push(updated);
  }

  await logAIAuditAction(
    context,
    'ai_approve_time_modification_requests',
    `approvedCount=${results.length}; requestIds=${JSON.stringify(targetRequestIds)}; adminResponse=${params.adminResponse || ''}`
  );

  return {
    success: true,
    approvedCount: results.length,
    requestIds: targetRequestIds,
  };
}

// 3-helper. Get pending vacation requests (for confirmation before bulk approve)
export async function getPendingVacationsToApprove(
  context: AIFunctionContext,
) {
  const { storage, companyId } = context;

  const companyUsers = await storage.getUsersByCompany(companyId);
  const companyUserIds = companyUsers.map(u => u.id);

  const pendingRequests = await db.select()
    .from(schema.vacationRequests)
    .where(
      and(
        inArray(schema.vacationRequests.userId, companyUserIds),
        eq(schema.vacationRequests.status, "pending")
      )
    )
    .orderBy(desc(schema.vacationRequests.createdAt));

  // Enrich with employee names
  const enriched = await Promise.all(
    pendingRequests.map(async (req: any) => {
      const user = await storage.getUser(req.userId);
      return {
        id: req.id,
        employeeName: user?.fullName || 'Unknown',
        startDate: req.startDate,
        endDate: req.endDate,
        absenceType: req.absenceType || 'vacation',
        createdAt: req.createdAt,
      };
    })
  );

  return {
    count: enriched.length,
    requests: enriched,
  };
}

// 3. Approve vacation requests
export async function approveVacationRequests(
  context: AIFunctionContext,
  params: {
    requestIds: number[] | "all_pending";
    adminComment?: string;
  }
) {
  const { storage, companyId, adminUserId } = context;

  // Get all pending requests if "all_pending" is specified
  let targetRequestIds = params.requestIds;
  if (params.requestIds === "all_pending") {
    // Get all users from company first
    const companyUsers = await storage.getUsersByCompany(companyId);
    const companyUserIds = companyUsers.map(u => u.id);
    
    const pendingRequests = await db.select()
      .from(schema.vacationRequests)
      .where(
        and(
          inArray(schema.vacationRequests.userId, companyUserIds),
          eq(schema.vacationRequests.status, "pending")
        )
      );
    targetRequestIds = pendingRequests.map((req: any) => req.id);
  }

  // Ensure we have an array
  if (!Array.isArray(targetRequestIds)) {
    throw new Error("requestIds must be an array or 'all_pending'");
  }

  // Approve each request
  const results = [];
  for (const requestId of targetRequestIds) {
    const updated = await storage.updateVacationRequest(requestId, {
      status: "approved",
      adminComment: params.adminComment || "Aprobado por asistente de IA",
      reviewedBy: adminUserId,
      reviewedAt: new Date(),
    } as any);
    
    // Send push notification
    if (updated) {
      try {
        const { sendVacationNotification } = await import("./pushNotificationScheduler.js");
        sendVacationNotification(updated.userId, "approved", {
          startDate: updated.startDate,
          endDate: updated.endDate,
        });
      } catch (error) {
        // console.error("Error sending vacation notification:", error);
      }
    }
    
    results.push(updated);
  }

  await logAIAuditAction(
    context,
    'ai_approve_vacation_requests',
    `approvedCount=${results.length}; requestIds=${JSON.stringify(targetRequestIds)}; adminComment=${params.adminComment || ''}`
  );

  return {
    success: true,
    approvedCount: results.length,
    requestIds: targetRequestIds,
  };
}

// 3b. Deny vacation requests
export async function denyVacationRequests(
  context: AIFunctionContext,
  params: {
    requestIds: number[] | "all_pending";
    adminComment?: string; // Required reason for denial
  }
) {
  const { storage, companyId, adminUserId } = context;

  // Get all pending requests if "all_pending" is specified
  let targetRequestIds = params.requestIds;
  if (params.requestIds === "all_pending") {
    const companyUsers = await storage.getUsersByCompany(companyId);
    const companyUserIds = companyUsers.map(u => u.id);
    
    const pendingRequests = await db.select()
      .from(schema.vacationRequests)
      .where(
        and(
          inArray(schema.vacationRequests.userId, companyUserIds),
          eq(schema.vacationRequests.status, "pending")
        )
      );
    targetRequestIds = pendingRequests.map((req: any) => req.id);
  }

  if (!Array.isArray(targetRequestIds)) {
    throw new Error("requestIds must be an array or 'all_pending'");
  }

  const results = [];
  for (const requestId of targetRequestIds) {
    const updated = await storage.updateVacationRequest(requestId, {
      status: "denied",
      adminComment: params.adminComment || "Denegado por asistente de IA",
      reviewedBy: adminUserId,
      reviewedAt: new Date(),
    } as any);
    
    // Send push notification
    if (updated) {
      try {
        const { sendVacationNotification } = await import("./pushNotificationScheduler.js");
        sendVacationNotification(updated.userId, "denied", {
          startDate: updated.startDate,
          endDate: updated.endDate,
        });
      } catch (error) {
        // console.error("Error sending vacation denial notification:", error);
      }
    }
    
    results.push(updated);
  }

  await logAIAuditAction(
    context,
    'ai_deny_vacation_requests',
    `deniedCount=${results.length}; requestIds=${JSON.stringify(targetRequestIds)}; adminComment=${params.adminComment || ''}`
  );

  return {
    success: true,
    deniedCount: results.length,
    requestIds: targetRequestIds,
  };
}

// 3c. Update company settings/policies
export async function updateCompanySettings(
  context: AIFunctionContext,
  params: {
    workingHoursPerDay?: number; // e.g., 8
    vacationDaysPerMonth?: number; // e.g., 2.5
    workingHoursStart?: string; // e.g., "08:00"
    workingHoursEnd?: string; // e.g., "17:00"
    allowManagersToGrantRoles?: boolean;
  }
) {
  const { storage, companyId } = context;

  // Get current company
  const company = await storage.getCompany(companyId);
  if (!company) {
    return { success: false, error: "Empresa no encontrada" };
  }

  // Build update object
  const updates: any = {};
  const changes: string[] = [];

  if (params.workingHoursPerDay !== undefined) {
    updates.workingHoursPerDay = params.workingHoursPerDay.toString();
    changes.push(`horas de trabajo/día: ${params.workingHoursPerDay}`);
  }

  if (params.vacationDaysPerMonth !== undefined) {
    updates.vacationDaysPerMonth = params.vacationDaysPerMonth.toString();
    changes.push(`días de vacaciones/mes: ${params.vacationDaysPerMonth}`);
  }

  if (params.workingHoursStart !== undefined) {
    updates.workingHoursStart = params.workingHoursStart;
    changes.push(`hora de entrada: ${params.workingHoursStart}`);
  }

  if (params.workingHoursEnd !== undefined) {
    updates.workingHoursEnd = params.workingHoursEnd;
    changes.push(`hora de salida: ${params.workingHoursEnd}`);
  }

  if (params.allowManagersToGrantRoles !== undefined) {
    updates.allowManagersToGrantRoles = params.allowManagersToGrantRoles;
    changes.push(`permitir a managers asignar roles: ${params.allowManagersToGrantRoles ? 'sí' : 'no'}`);
  }

  if (Object.keys(updates).length === 0) {
    return { success: false, error: "No se especificaron cambios" };
  }

  // Update company
  const updated = await storage.updateCompany(companyId, updates);

  // If vacation days changed, recalculate for all employees
  if (params.vacationDaysPerMonth !== undefined) {
    const employees = await storage.getUsersByCompany(companyId);
    for (const emp of employees) {
      // Clear individual override so they use company policy
      await storage.updateUser(emp.id, { vacationDaysPerMonth: null });
    }
  }

  await logAIAuditAction(
    context,
    'ai_update_company_settings',
    `companyId=${companyId}; changes=${changes.join(' | ')}`
  );

  return {
    success: true,
    message: `Configuración actualizada: ${changes.join(', ')}`,
    updatedSettings: updates,
    navigateTo: `/${company.companyAlias}/configuracion?tab=policies`
  };
}

// 4. Create reminder
export async function createReminder(
  context: AIFunctionContext,
  params: {
    title: string;
    content?: string;
    reminderDate?: string;
    priority?: "low" | "medium" | "high";
    assignToEmployeeIds?: number[] | "all";
    enableNotifications?: boolean;
  }
) {
  const { storage, companyId, adminUserId } = context;

  // Get all employees if "all" is specified
  let assignedUserIds = params.assignToEmployeeIds;
  if (params.assignToEmployeeIds === "all") {
    const allEmployees = await storage.getUsersByCompany(companyId);
    assignedUserIds = allEmployees.map((emp) => emp.id);
  }

  // Create reminder
  const reminder = await storage.createReminder({
    userId: adminUserId,
    companyId,
    title: params.title,
    content: params.content || "",
    reminderDate: params.reminderDate ? new Date(params.reminderDate) : null,
    priority: params.priority || "medium",
    assignedUserIds: Array.isArray(assignedUserIds) ? assignedUserIds : null,
    assignedBy: Array.isArray(assignedUserIds) ? adminUserId : null,
    assignedAt: Array.isArray(assignedUserIds) ? new Date() : null,
    enableNotifications: params.enableNotifications ?? true,
    createdBy: adminUserId,
  });

  await logAIAuditAction(
    context,
    'ai_create_reminder',
    `reminderId=${reminder.id}; assignedCount=${Array.isArray(assignedUserIds) ? assignedUserIds.length : 0}; title=${params.title}`
  );

  return {
    success: true,
    reminder,
  };
}

// 5. Create employee
export async function createEmployee(
  context: AIFunctionContext,
  params: {
    fullName: string;
    email: string;
    dni: string;
    role?: 'admin' | 'manager' | 'employee';
    position?: string;
    phoneNumber?: string;
    startDate?: string;
  }
) {
  const { storage, companyId, adminUserId } = context;

  // Basic required fields check
  if (!params.fullName || !params.email) {
    return { success: false, error: 'Faltan datos: necesito nombre completo y correo.' };
  }

  const allowedRoles = new Set(['admin', 'manager', 'employee']);
  const role: 'admin' | 'manager' | 'employee' = allowedRoles.has(params.role || '')
    ? (params.role as any)
    : 'employee';

  // Load company and subscription context
  const company = await storage.getCompany(companyId);
  if (!company) {
    return { success: false, error: 'Empresa no encontrada' };
  }

  const subscription = await storage.getSubscriptionByCompanyId(companyId);
  const users = await storage.getUsersByCompany(companyId);

  // Seat capacity per role (included + extra). Fallback to legacy maxUsers if needed.
  const seatsFor = (r: 'admin' | 'manager' | 'employee') => {
    if (!subscription) return undefined;
    const base =
      (r === 'admin' ? subscription.includedAdmins : r === 'manager' ? subscription.includedManagers : subscription.includedEmployees) ?? 0;
    const extra =
      (r === 'admin' ? subscription.extraAdmins : r === 'manager' ? subscription.extraManagers : subscription.extraEmployees) ?? 0;
    return base + extra;
  };

  const currentCountByRole = users.reduce<Record<string, number>>((acc, u) => {
    const key = u.role || 'employee';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const allowedSeats = seatsFor(role);
  if (typeof allowedSeats === 'number' && currentCountByRole[role] >= allowedSeats) {
    return {
      success: false,
      error: `No hay plazas disponibles para rol ${role}. Libera un cupo o amplía el plan.`
    };
  }

  if (subscription && typeof subscription.maxUsers === 'number') {
    const totalAllowed = subscription.maxUsers;
    if (users.length >= totalAllowed) {
      return {
        success: false,
        error: 'Has alcanzado el límite de usuarios de tu plan. Libera un cupo o amplía el plan.'
      };
    }
  }

  // Duplicate checks by email and name
  const normalizedEmail = params.email.trim().toLowerCase();
  const existingEmail = users.find(u => (u.personalEmail || '').toLowerCase() === normalizedEmail || (u.companyEmail || '').toLowerCase() === normalizedEmail);
  if (existingEmail) {
    return { success: false, error: `Ya existe un usuario con el correo ${normalizedEmail}. Usa otro correo.` };
  }

  const normalizedName = params.fullName.trim().toLowerCase();
  const existingName = users.find(u => (u.fullName || '').trim().toLowerCase() === normalizedName);
  if (existingName) {
    return { success: false, error: `Ya existe un empleado llamado ${existingName.fullName}. ¿Quieres modificarlo en lugar de crear otro?` };
  }

  // Do NOT invent corporate emails; if none provided, reuse the given email
  const providedCompanyEmail = (params as any).companyEmail as string | undefined;
  const companyEmail = (providedCompanyEmail || params.email).trim().toLowerCase();
  const companyEmailTaken = users.find(u => (u.companyEmail || '').toLowerCase() === companyEmail);
  if (companyEmailTaken) {
    return { success: false, error: `El correo ${companyEmail} ya está en uso. Indica otro correo corporativo o personal.` };
  }

  // Create employee without password — activation email will be sent
  const employee = await storage.createUser({
    companyId,
    personalEmail: params.email,
    companyEmail,
    password: '',
    fullName: params.fullName,
    dni: params.dni,
    role,
    position: params.position || 'Empleado',
    personalPhone: params.phoneNumber || null,
    startDate: params.startDate ? new Date(params.startDate) : new Date(),
    isActive: true,
    isPendingActivation: true,
  });

  // Generate activation token (7-day expiry)
  const activationToken = await storage.createActivationToken({
    userId: employee.id,
    email: companyEmail,
    token: crypto.randomBytes(32).toString('hex'),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdBy: context.adminUserId,
  });

  // Send welcome / activation email
  const baseUrl = process.env.REPLIT_DOMAINS
    ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
    : (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://oficaz.es');
  const activationLink = `${baseUrl}/employee-activation?token=${activationToken.token}`;

  const emailSent = await sendEmployeeWelcomeEmail(
    companyEmail,
    params.fullName,
    company?.name ?? '',
    activationToken.token,
    activationLink
  );

  if (!emailSent) {
    console.error('❌ [AI] Activation email could not be sent to:', companyEmail);
  } else {
    console.log('✅ [AI] Activation email sent to:', companyEmail);
  }

  await logAIAuditAction(
    context,
    'ai_create_employee',
    `employeeId=${employee.id}; employeeName=${employee.fullName}; role=${employee.role}; activationEmailSent=${emailSent}`
  );

  return {
    success: true,
    employee: {
      id: employee.id,
      fullName: employee.fullName,
      personalEmail: employee.personalEmail,
      companyEmail: employee.companyEmail,
      position: employee.position,
      role: employee.role,
    },
    message: `Empleado ${employee.fullName} creado como ${role}. Se ha enviado un correo a ${employee.companyEmail} para que establezca su contraseña.`
  };
}

// 5b. Update employee data
export async function updateEmployee(
  context: AIFunctionContext,
  params: {
    employeeId: number;
    // Corporate information
    companyEmail?: string;
    companyPhone?: string;
    position?: string;
    startDate?: string;
    status?: 'active' | 'inactive' | 'leave' | 'vacation';
    role?: 'admin' | 'manager' | 'employee';
    // Personal information
    personalEmail?: string;
    personalPhone?: string;
    address?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    // Vacation management
    vacationDaysAdjustment?: number; // Extra vacation days (+ or -)
  }
) {
  const { storage, companyId } = context;

  // Verify employee exists and belongs to company
  const employee = await storage.getUser(params.employeeId);
  if (!employee || employee.companyId !== companyId) {
    return {
      success: false,
      error: "Empleado no encontrado o no pertenece a esta empresa"
    };
  }

  // Build update object with only provided fields
  const updates: any = {};
  
  if (params.companyEmail !== undefined) updates.companyEmail = params.companyEmail;
  if (params.companyPhone !== undefined) updates.companyPhone = params.companyPhone;
  if (params.position !== undefined) updates.position = params.position;
  if (params.startDate !== undefined) updates.startDate = new Date(params.startDate);
  if (params.status !== undefined) updates.status = params.status;
  if (params.role !== undefined) updates.role = params.role;
  if (params.personalEmail !== undefined) updates.personalEmail = params.personalEmail;
  if (params.personalPhone !== undefined) updates.personalPhone = params.personalPhone;
  if (params.address !== undefined) updates.postalAddress = params.address;
  if (params.emergencyContactName !== undefined) updates.emergencyContactName = params.emergencyContactName;
  if (params.emergencyContactPhone !== undefined) updates.emergencyContactPhone = params.emergencyContactPhone;
  if (params.vacationDaysAdjustment !== undefined) updates.vacationDaysAdjustment = params.vacationDaysAdjustment.toString();

  // Update employee
  const updatedEmployee = await storage.updateUser(params.employeeId, updates);

  if (!updatedEmployee) {
    return {
      success: false,
      error: "No se pudo actualizar el empleado"
    };
  }

  await logAIAuditAction(
    context,
    'ai_update_employee',
    `employeeId=${params.employeeId}; updatedFields=${Object.keys(updates).join(',')}`
  );

  return {
    success: true,
    employee: {
      id: updatedEmployee.id,
      fullName: updatedEmployee.fullName,
      companyEmail: updatedEmployee.companyEmail,
      position: updatedEmployee.position,
      status: updatedEmployee.status,
      role: updatedEmployee.role,
      vacationDaysAdjustment: updatedEmployee.vacationDaysAdjustment,
    },
    message: `Empleado ${updatedEmployee.fullName} actualizado correctamente`
  };
}

// 5c. Generate time tracking report (PDF or Excel)
export async function generateTimeReport(
  context: AIFunctionContext,
  params: {
    employeeName?: string; // Optional: specific employee name (uses listEmployees to resolve)
    period: 'today' | 'this_week' | 'this_month' | 'last_week' | 'last_month' | 'this_year' | 'last_year' | 'all' | 'custom';
    startDate?: string; // For 'custom' period: YYYY-MM-DD
    endDate?: string;   // For 'custom' period: YYYY-MM-DD
    format?: 'pdf' | 'excel'; // Default: 'pdf'
  }
) {
  // console.log('📊 generateTimeReport called with params:', JSON.stringify(params, null, 2));
  const { storage, companyId } = context;

  // Resolve employee if name provided
  let employeeId: number | undefined;
  if (params.employeeName) {
    // console.log('📊 Resolving employee name:', params.employeeName);
    const resolution = await resolveEmployeeName(storage, companyId, params.employeeName);
    // console.log('📊 Resolution result:', JSON.stringify(resolution, null, 2));
    if ('error' in resolution) {
      return {
        success: false,
        error: resolution.error
      };
    }
    employeeId = resolution.employeeId;
    // console.log('📊 Resolved employeeId:', employeeId);
  }

  // Calculate date range based on period
  const now = new Date();
  let startDate: Date;
  let endDate: Date;

  switch (params.period) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      break;
    case 'this_week':
      const dayOfWeek = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      monday.setHours(0, 0, 0, 0);
      startDate = monday;
      endDate = new Date(now);
      endDate.setHours(23, 59, 59);
      break;
    case 'last_week':
      const lastWeekEnd = new Date(now);
      lastWeekEnd.setDate(now.getDate() - (now.getDay() === 0 ? 7 : now.getDay()));
      lastWeekEnd.setHours(23, 59, 59);
      const lastWeekStart = new Date(lastWeekEnd);
      lastWeekStart.setDate(lastWeekEnd.getDate() - 6);
      lastWeekStart.setHours(0, 0, 0);
      startDate = lastWeekStart;
      endDate = lastWeekEnd;
      break;
    case 'this_month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59);
      break;
    case 'last_month':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      break;
    case 'this_year':
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59);
      break;
    case 'last_year':
      startDate = new Date(now.getFullYear() - 1, 0, 1);
      endDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
      break;
    case 'custom':
      if (!params.startDate || !params.endDate) {
        return {
          success: false,
          error: "Para período 'custom' debes especificar startDate y endDate"
        };
      }
      startDate = new Date(params.startDate);
      endDate = new Date(params.endDate);
      endDate.setHours(23, 59, 59);
      break;
    case 'all':
    default:
      startDate = new Date(2020, 0, 1); // Far past date
      endDate = new Date(now);
      endDate.setHours(23, 59, 59);
      break;
  }

  // Fetch work sessions with filters
  const sessionsResult = await storage.getWorkSessionsByCompany(companyId, 10000, 0, {
    employeeId,
    startDate,
    endDate,
  });

  const sessions = sessionsResult.sessions || [];

  if (sessions.length === 0) {
    return {
      success: false,
      error: "No se encontraron fichajes para el período especificado"
    };
  }

  // Get employee info
  const employeeName = employeeId 
    ? (await storage.getUser(employeeId))?.fullName || 'Empleado'
    : 'Todos los empleados';
  
  const periodText = params.period === 'custom' 
    ? `${params.startDate} - ${params.endDate}`
    : params.period.replace('_', ' ');

  // Calculate total hours
  const totalHours = sessions.reduce((sum: number, s: any) => sum + parseFloat(s.totalHours || '0'), 0);

  // Get company for navigation URL
  const company = await storage.getCompany(companyId);
  if (!company) {
    return { success: false, error: "Empresa no encontrada" };
  }

  // Build navigation URL with filters and export trigger
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];
  const reportFormat = params.format || 'pdf';
  
  let navigateTo = `/${company.companyAlias}/fichajes?startDate=${startDateStr}&endDate=${endDateStr}&export=${reportFormat}`;
  if (employeeId) {
    navigateTo += `&employeeId=${employeeId}`;
  }

  return {
    success: true,
    employee: employeeName,
    period: periodText,
    sessionsCount: sessions.length,
    totalHours: totalHours.toFixed(1),
    format: reportFormat,
    navigateTo,
    message: `He preparado el informe de ${employeeName} (${periodText}): ${sessions.length} fichajes, ${totalHours.toFixed(1)}h totales. Te llevo a la página de fichajes con los filtros aplicados para que puedas exportar en ${reportFormat.toUpperCase()}.`
  };
}

// Helper: Generate consistent color for employee based on their ID
function getEmployeeColor(employeeId: number): string {
  const colors = [
    "#3b82f6", // Blue
    "#10b981", // Green
    "#f59e0b", // Amber
    "#8b5cf6", // Purple
    "#ef4444", // Red
    "#06b6d4", // Cyan
    "#f97316", // Orange
    "#ec4899", // Pink
  ];
  return colors[employeeId % colors.length];
}

// 6. Assign schedule/shift
export async function assignSchedule(
  context: AIFunctionContext,
  params: {
    employeeId: number;
    title: string;
    startDate: string;
    endDate: string;
    location?: string;
    notes?: string;
    color?: string;
  }
) {
  const { storage, companyId, adminUserId } = context;

  // Verify employee belongs to company
  const employee = await storage.getUser(params.employeeId);
  if (!employee || employee.companyId !== companyId) {
    throw new Error("Employee not found or doesn't belong to this company");
  }

  // Parse dates as Europe/Madrid timezone (CET/CEST)
  // When AI sends "2025-11-10T08:00:00", it means 8am in Spain, not UTC
  const startAt = new Date(params.startDate + '+01:00'); // CET offset
  const endAt = new Date(params.endDate + '+01:00');

  // Auto-assign color based on employee ID if not provided
  const shiftColor = params.color || getEmployeeColor(params.employeeId);

  // Create work shift
  const shift = await db.insert(schema.workShifts)
    .values({
      companyId,
      employeeId: params.employeeId,
      startAt,
      endAt,
      title: params.title,
      location: params.location || null,
      notes: params.notes || null,
      color: shiftColor,
      createdByUserId: adminUserId,
    })
    .returning();

  await logAIAuditAction(
    context,
    'ai_assign_schedule',
    `employeeId=${params.employeeId}; title=${params.title}; startDate=${params.startDate}; endDate=${params.endDate}`
  );

  return {
    success: true,
    shift: shift[0],
    employeeFullName: employee.fullName,
  };
}

// 6b. Assign schedule in BULK for date range (for weeks/months)
export async function assignScheduleInRange(
  context: AIFunctionContext,
  params: {
    employeeId: number;
    title: string;
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
    startTime: string; // HH:mm (e.g., "08:00")
    endTime: string; // HH:mm (e.g., "14:00")
    location?: string;
    notes?: string;
    color?: string;
    skipWeekends?: boolean; // Default: true (skip Saturdays and Sundays)
    excludedWeekdays?: number[]; // Optional: specific weekdays to exclude (0=Sun..6=Sat)
    forceOverwrite?: boolean; // Optional: if true, delete existing shifts before creating new ones
  }
) {
  const { storage, companyId, adminUserId } = context;

  // Verify employee belongs to company
  const employee = await storage.getUser(params.employeeId);
  if (!employee || employee.companyId !== companyId) {
    throw new Error("Employee not found or doesn't belong to this company");
  }

  // Check for existing shifts in the date range
  const existingShifts = await storage.getWorkShiftsByEmployee(
    params.employeeId,
    params.startDate,
    params.endDate
  );

  // If there are existing shifts and forceOverwrite is not set, ask for confirmation
  if (existingShifts.length > 0 && !params.forceOverwrite) {
    const firstName = employee.fullName.split(' ')[0];
    return {
      success: false,
      needsConfirmation: true,
      existingShiftsCount: existingShifts.length,
      message: `⚠️ ${firstName} ya tiene ${existingShifts.length} turno${existingShifts.length > 1 ? 's' : ''} en esas fechas. ¿Quieres que los elimine y cree los nuevos, o prefieres mantener los actuales?`,
      confirmationOptions: [
        { action: 'overwrite', label: 'Eliminar los antiguos y crear los nuevos' },
        { action: 'keep', label: 'Mantener los turnos actuales y no crear nada' },
        { action: 'add', label: 'Añadir los nuevos turnos (se sumarán a los existentes)' }
      ]
    };
  }

  // If forceOverwrite is true, delete existing shifts first
  if (params.forceOverwrite && existingShifts.length > 0) {
    for (const shift of existingShifts) {
      await db.delete(schema.workShifts)
        .where(eq(schema.workShifts.id, shift.id));
    }
  }

  // Auto-assign color based on employee ID if not provided
  const shiftColor = params.color || getEmployeeColor(params.employeeId);

  // Parse date range
  const start = new Date(params.startDate);
  const end = new Date(params.endDate);
  
  // Skip weekends by default
  const skipWeekends = params.skipWeekends !== false;

  // Generate all dates in range
  const dates: Date[] = [];
  let currentDate = new Date(start);
  
  while (currentDate <= end) {
    const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Skip weekends if enabled
    if (skipWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }
    // Skip explicitly excluded weekdays if provided
    if (Array.isArray(params.excludedWeekdays) && params.excludedWeekdays.includes(dayOfWeek)) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }
    
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  if (dates.length === 0) {
    return {
      success: false,
      error: `No hay fechas válidas en el rango ${params.startDate} a ${params.endDate}`,
      createdCount: 0
    };
  }

  // Create shifts for all dates
  const createdShifts = [];
  for (const date of dates) {
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const startAt = new Date(`${dateStr}T${params.startTime}:00+01:00`); // CET
    const endAt = new Date(`${dateStr}T${params.endTime}:00+01:00`);

    const shift = await db.insert(schema.workShifts)
      .values({
        companyId,
        employeeId: params.employeeId,
        startAt,
        endAt,
        title: params.title,
        location: params.location || null,
        notes: params.notes || null,
        color: shiftColor,
        createdByUserId: adminUserId,
      })
      .returning();

    createdShifts.push(shift[0]);
  }

  const firstName = employee.fullName.split(' ')[0];
  const weekdaysES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const daysCreated = createdShifts.map(s => {
    const date = new Date(s.startAt);
    return weekdaysES[date.getDay()];
  });
  const uniqueDays = Array.from(new Set(daysCreated));
  const daysText = uniqueDays.length <= 3 
    ? uniqueDays.join(', ')
    : `${uniqueDays.length} días`;

  const replacedText = params.forceOverwrite && existingShifts.length > 0
    ? ` (eliminé ${existingShifts.length} turno${existingShifts.length > 1 ? 's' : ''} antiguo${existingShifts.length > 1 ? 's' : ''})`
    : '';

  await logAIAuditAction(
    context,
    'ai_assign_schedule_in_range',
    `employeeId=${params.employeeId}; createdCount=${createdShifts.length}; startDate=${params.startDate}; endDate=${params.endDate}; forceOverwrite=${Boolean(params.forceOverwrite)}`
  );

  return {
    success: true,
    createdCount: createdShifts.length,
    employeeFullName: employee.fullName,
    dateRange: `${params.startDate} a ${params.endDate}`,
    message: `✅ Listo! He creado ${createdShifts.length} turno${createdShifts.length > 1 ? 's' : ''} para ${firstName} (${daysText}) de ${params.startTime} a ${params.endTime}${replacedText}. Te llevo al cuadrante de esa semana.`,
    shifts: createdShifts.map(s => ({
      date: new Date(s.startAt).toLocaleDateString('es-ES'),
      title: s.title
    }))
  };
}

// 6c. Assign ROTATING schedule (X days work, Y days off pattern)
// Perfect for: "3 días trabajo, 3 días descanso", "4 días trabajo, 2 días libres"
export async function assignRotatingSchedule(
  context: AIFunctionContext,
  params: {
    employeeId: number;
    title: string;
    startDate: string; // YYYY-MM-DD - First day of work
    endDate: string; // YYYY-MM-DD - Last possible work day
    startTime: string; // HH:mm (e.g., "08:00")
    endTime: string; // HH:mm (e.g., "14:00")
    workDays: number; // Number of consecutive work days (e.g., 3)
    restDays: number; // Number of consecutive rest days (e.g., 3)
    location?: string;
    notes?: string;
    color?: string;
  }
) {
  const { storage, companyId, adminUserId } = context;

  // Verify employee belongs to company
  const employee = await storage.getUser(params.employeeId);
  if (!employee || employee.companyId !== companyId) {
    throw new Error("Employee not found or doesn't belong to this company");
  }

  // Auto-assign color based on employee ID if not provided
  const shiftColor = params.color || getEmployeeColor(params.employeeId);

  // Parse date range
  const start = new Date(params.startDate);
  const end = new Date(params.endDate);
  
  const cycleLength = params.workDays + params.restDays;

  // Generate work dates following the rotation pattern
  const workDates: Date[] = [];
  let currentDate = new Date(start);
  let dayInCycle = 0; // Track position within the work/rest cycle
  
  while (currentDate <= end) {
    // If we're in a "work" phase of the cycle (first N days)
    if (dayInCycle < params.workDays) {
      workDates.push(new Date(currentDate));
    }
    // Otherwise it's a rest day, don't add to workDates
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
    dayInCycle = (dayInCycle + 1) % cycleLength;
  }

  if (workDates.length === 0) {
    return {
      success: false,
      error: `No hay fechas válidas en el rango ${params.startDate} a ${params.endDate}`,
      createdCount: 0
    };
  }

  // Create shifts for all work dates
  const createdShifts = [];
  for (const date of workDates) {
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const startAt = new Date(`${dateStr}T${params.startTime}:00+01:00`); // CET
    const endAt = new Date(`${dateStr}T${params.endTime}:00+01:00`);

    const shift = await db.insert(schema.workShifts)
      .values({
        companyId,
        employeeId: params.employeeId,
        startAt,
        endAt,
        title: params.title,
        location: params.location || null,
        notes: params.notes || null,
        color: shiftColor,
        createdByUserId: adminUserId,
      })
      .returning();

    createdShifts.push(shift[0]);
  }

  // Calculate rest day dates for summary
  const restDaysCount = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1 - workDates.length;

  await logAIAuditAction(
    context,
    'ai_assign_rotating_schedule',
    `employeeId=${params.employeeId}; createdCount=${createdShifts.length}; workDays=${params.workDays}; restDays=${params.restDays}; startDate=${params.startDate}; endDate=${params.endDate}`
  );

  return {
    success: true,
    createdCount: createdShifts.length,
    employeeFullName: employee.fullName,
    dateRange: `${params.startDate} a ${params.endDate}`,
    pattern: `${params.workDays} días trabajo, ${params.restDays} días descanso`,
    workDaysCreated: createdShifts.length,
    restDaysSkipped: restDaysCount,
    shifts: createdShifts.map(s => ({
      date: new Date(s.startAt).toLocaleDateString('es-ES'),
      title: s.title
    }))
  };
}

// 7. Request document from employee
export async function requestDocument(
  context: AIFunctionContext,
  params: {
    employeeId: number;
    fileName: string;
    description?: string;
  }
) {
  const { storage, companyId, adminUserId } = context;

  // Verify employee belongs to company
  const employee = await storage.getUser(params.employeeId);
  if (!employee || employee.companyId !== companyId) {
    throw new Error("Employee not found or doesn't belong to this company");
  }

  // Send message requesting the document
  const message = await storage.createMessage({
    senderId: adminUserId,
    receiverId: params.employeeId,
    subject: `Solicitud de documento: ${params.fileName}`,
    content: params.description ?? 
      `Por favor, sube el documento "${params.fileName}" en la sección de Documentos lo antes posible. Gracias.`,
  });

  // Send push notification
  try {
    const admin = await storage.getUser(adminUserId);
    const senderName: string = admin?.fullName || "Admin";
    const { sendMessageNotification } = await import("./pushNotificationScheduler.js");
    sendMessageNotification(
      params.employeeId, 
      senderName, 
      message.subject || "Solicitud de documento", 
      message.id
    );
  } catch (error) {
    // console.error("Error sending push notification:", error);
  }

  await logAIAuditAction(
    context,
    'ai_request_document',
    `employeeId=${params.employeeId}; fileName=${params.fileName}`
  );

  return {
    success: true,
    message,
    employeeName: employee.fullName,
  };
}

// 8. Delete work shift(s)
export async function deleteWorkShift(
  context: AIFunctionContext,
  params: {
    employeeId: number;
    date: string; // YYYY-MM-DD
  }
) {
  const { storage, companyId, adminUserId } = context;

  // Verify employee belongs to company
  const employee = await storage.getUser(params.employeeId);
  if (!employee || employee.companyId !== companyId) {
    throw new Error("Employee not found or doesn't belong to this company");
  }

  // Parse the date using UTC to avoid timezone issues
  const { startOfDay, endOfDay, targetDate } = getUTCDayBoundaries(params.date);

  // Find all shifts for this employee
  const shifts = await db.select()
    .from(schema.workShifts)
    .where(
      and(
        eq(schema.workShifts.companyId, companyId),
        eq(schema.workShifts.employeeId, params.employeeId)
      )
    );

  // Filter shifts that OVERLAP with the target date (including overnight shifts)
  // A shift overlaps if: startAt <= endOfDay AND endAt >= startOfDay
  const shiftsToDelete = shifts.filter((shift: any) => {
    const shiftStart = new Date(shift.startAt);
    const shiftEnd = new Date(shift.endAt);
    return shiftStart <= endOfDay && shiftEnd >= startOfDay;
  });

  if (shiftsToDelete.length === 0) {
    return {
      success: false,
      error: `No hay turnos para ${employee.fullName} el ${targetDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}`,
      employeeFullName: employee.fullName,
      deletedCount: 0
    };
  }

  // Delete the shifts
  for (const shift of shiftsToDelete) {
    await db.delete(schema.workShifts)
      .where(eq(schema.workShifts.id, shift.id));
  }

  await logAIAuditAction(
    context,
    'ai_delete_work_shift',
    `employeeId=${params.employeeId}; date=${params.date}; deletedCount=${shiftsToDelete.length}`
  );

  return {
    success: true,
    deletedCount: shiftsToDelete.length,
    employeeFullName: employee.fullName,
    date: targetDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  };
}

// 7. Delete work shifts in a date range (for multiple days or all employees)
export async function deleteWorkShiftsInRange(
  context: AIFunctionContext,
  params: {
    employeeId?: number; // Optional: if not provided, deletes for ALL employees
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
  }
) {
  const { storage, companyId } = context;

  // Verify employee if specified
  let employee = null;
  if (params.employeeId) {
    employee = await storage.getUser(params.employeeId);
    if (!employee || employee.companyId !== companyId) {
      throw new Error("Employee not found or doesn't belong to this company");
    }
  }

  // Parse dates
  const startBoundary = getUTCDayBoundaries(params.startDate).startOfDay;
  const endBoundary = getUTCDayBoundaries(params.endDate).endOfDay;

  // Build query
  const whereConditions = [
    eq(schema.workShifts.companyId, companyId)
  ];
  
  if (params.employeeId) {
    whereConditions.push(eq(schema.workShifts.employeeId, params.employeeId));
  }

  // Find all shifts in the range
  const shifts = await db.select()
    .from(schema.workShifts)
    .where(and(...whereConditions));

  // Filter shifts that overlap with the date range
  const shiftsToDelete = shifts.filter((shift: any) => {
    const shiftStart = new Date(shift.startAt);
    const shiftEnd = new Date(shift.endAt);
    return shiftStart <= endBoundary && shiftEnd >= startBoundary;
  });

  if (shiftsToDelete.length === 0) {
    const targetDescription = employee 
      ? `${employee.fullName}` 
      : "ningún empleado";
    return {
      success: false,
      error: `No hay turnos para ${targetDescription} entre ${params.startDate} y ${params.endDate}`,
      deletedCount: 0
    };
  }

  // Delete the shifts
  for (const shift of shiftsToDelete) {
    await db.delete(schema.workShifts)
      .where(eq(schema.workShifts.id, shift.id));
  }

  const targetDescription = employee 
    ? `de ${employee.fullName}` 
    : "de todos los empleados";

  await logAIAuditAction(
    context,
    'ai_delete_work_shifts_in_range',
    `deletedCount=${shiftsToDelete.length}; employeeId=${params.employeeId || 'all'}; startDate=${params.startDate}; endDate=${params.endDate}`
  );

  return {
    success: true,
    message: `Se eliminaron ${shiftsToDelete.length} turno(s) ${targetDescription}`,
    deletedCount: shiftsToDelete.length,
    dateRange: `${params.startDate} a ${params.endDate}`
  };
}

// 9. Update work shift times (modify hours a posteriori)
export async function updateWorkShiftTimes(
  context: AIFunctionContext,
  params: {
    employeeId: number;
    date: string; // YYYY-MM-DD
    newStartTime?: string; // HH:mm (24h format)
    newEndTime?: string; // HH:mm (24h format)
    shiftTitle?: string; // Optional: to identify specific shift if multiple on same day
  }
) {
  const { storage, companyId } = context;

  // Verify employee belongs to company
  const employee = await storage.getUser(params.employeeId);
  if (!employee || employee.companyId !== companyId) {
    throw new Error("Employee not found or doesn't belong to this company");
  }

  // Parse the date using UTC to avoid timezone issues
  const { startOfDay, endOfDay, targetDate } = getUTCDayBoundaries(params.date);

  // Find all shifts for this employee on this date
  const shifts = await db.select()
    .from(schema.workShifts)
    .where(
      and(
        eq(schema.workShifts.companyId, companyId),
        eq(schema.workShifts.employeeId, params.employeeId)
      )
    );

  // Filter shifts that overlap with target date
  let shiftsOnDate = shifts.filter((shift: any) => {
    const shiftStart = new Date(shift.startAt);
    const shiftEnd = new Date(shift.endAt);
    return shiftStart <= endOfDay && shiftEnd >= startOfDay;
  });

  // If shiftTitle provided, filter further
  if (params.shiftTitle) {
    shiftsOnDate = shiftsOnDate.filter((shift: any) => 
      shift.title?.toLowerCase().includes(params.shiftTitle!.toLowerCase())
    );
  }

  if (shiftsOnDate.length === 0) {
    return {
      success: false,
      error: `No encontré turnos para ${employee.fullName} el ${targetDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}`,
      employeeFullName: employee.fullName
    };
  }

  if (shiftsOnDate.length > 1 && !params.shiftTitle) {
    const titles = shiftsOnDate.map((s: any) => s.title).join(", ");
    return {
      success: false,
      error: `${employee.fullName} tiene múltiples turnos ese día (${titles}). Por favor, especifica cuál quieres modificar.`,
      employeeFullName: employee.fullName
    };
  }

  // Validate that at least one time is being updated
  if (!params.newStartTime && !params.newEndTime) {
    return {
      success: false,
      error: "Debes especificar al menos una hora nueva (inicio o fin)",
      employeeFullName: employee.fullName
    };
  }

  // Update the shift
  const shift = shiftsOnDate[0];
  const updates: any = {};

  if (params.newStartTime) {
    const [hours, minutes] = params.newStartTime.split(':').map(Number);
    const newStart = new Date(shift.startAt);
    newStart.setHours(hours, minutes, 0, 0);
    updates.startAt = newStart;
  }

  if (params.newEndTime) {
    const [hours, minutes] = params.newEndTime.split(':').map(Number);
    const newEnd = new Date(shift.endAt);
    newEnd.setHours(hours, minutes, 0, 0);
    updates.endAt = newEnd;
  }

  // Critical validation: ensure end time is after start time
  const finalStartAt = updates.startAt || shift.startAt;
  const finalEndAt = updates.endAt || shift.endAt;
  
  if (finalEndAt <= finalStartAt) {
    return {
      success: false,
      error: `La hora de fin (${new Date(finalEndAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}) debe ser posterior a la hora de inicio (${new Date(finalStartAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })})`,
      employeeFullName: employee.fullName
    };
  }

  await storage.updateWorkShift(shift.id, updates);

  await logAIAuditAction(
    context,
    'ai_update_work_shift_times',
    `employeeId=${params.employeeId}; date=${params.date}; shiftId=${shift.id}; newStartTime=${params.newStartTime || ''}; newEndTime=${params.newEndTime || ''}`
  );

  return {
    success: true,
    employeeFullName: employee.fullName,
    shiftTitle: shift.title,
    newTimes: {
      start: updates.startAt?.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      end: updates.endAt?.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    }
  };
}

// 10. Detect work shift overlaps for an employee
export async function detectWorkShiftOverlaps(
  context: AIFunctionContext,
  params: {
    employeeId?: number; // Optional: check specific employee, or all if not provided
    startDate?: string; // Optional: date range
    endDate?: string;
  }
) {
  const { storage, companyId } = context;

  let employeesToCheck: any[] = [];

  if (params.employeeId) {
    const employee = await storage.getUser(params.employeeId);
    if (!employee || employee.companyId !== companyId) {
      throw new Error("Employee not found or doesn't belong to this company");
    }
    employeesToCheck = [employee];
  } else {
    employeesToCheck = await storage.getUsersByCompany(companyId);
  }

  const overlaps: any[] = [];

  for (const employee of employeesToCheck) {
    const shifts = await storage.getWorkShiftsByEmployee(
      employee.id,
      params.startDate,
      params.endDate
    );

    // Sort by start time
    const sortedShifts = shifts.sort((a, b) => 
      new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    );

    // Check for overlaps
    for (let i = 0; i < sortedShifts.length - 1; i++) {
      const current = sortedShifts[i];
      const next = sortedShifts[i + 1];

      if (new Date(current.endAt) > new Date(next.startAt)) {
        overlaps.push({
          employeeName: employee.fullName,
          shift1: {
            title: current.title,
            start: new Date(current.startAt).toLocaleString('es-ES'),
            end: new Date(current.endAt).toLocaleString('es-ES')
          },
          shift2: {
            title: next.title,
            start: new Date(next.startAt).toLocaleString('es-ES'),
            end: new Date(next.endAt).toLocaleString('es-ES')
          }
        });
      }
    }
  }

  return {
    success: true,
    overlapsFound: overlaps.length,
    overlaps
  };
}

// 11. Update work shift color
export async function updateWorkShiftColor(
  context: AIFunctionContext,
  params: {
    employeeId: number;
    date: string; // YYYY-MM-DD
    newColor: string; // Hex color (e.g., "#3b82f6")
    shiftTitle?: string; // Optional: to identify specific shift
  }
) {
  const { storage, companyId } = context;

  // Validate hex color
  if (!/^#[0-9A-F]{6}$/i.test(params.newColor)) {
    return {
      success: false,
      error: `"${params.newColor}" no es un color hexadecimal válido. Usa formato #RRGGBB (ej: #3b82f6)`
    };
  }

  const employee = await storage.getUser(params.employeeId);
  if (!employee || employee.companyId !== companyId) {
    throw new Error("Employee not found or doesn't belong to this company");
  }

  // Parse the date using UTC to avoid timezone issues
  const { startOfDay, endOfDay, targetDate } = getUTCDayBoundaries(params.date);

  // console.log("🎨 UPDATE COLOR DEBUG:", {
  //   employeeName: employee.fullName,
  //   date: params.date,
  //   newColor: params.newColor,
  //   shiftTitle: params.shiftTitle,
  //   startOfDay: startOfDay.toISOString(),
  //   endOfDay: endOfDay.toISOString()
  // });

  const shifts = await db.select()
    .from(schema.workShifts)
    .where(
      and(
        eq(schema.workShifts.companyId, companyId),
        eq(schema.workShifts.employeeId, params.employeeId)
      )
    );

  // console.log("🎨 All employee shifts:", shifts.map(s => ({
  //   id: s.id,
  //   title: s.title,
  //   startAt: new Date(s.startAt).toISOString(),
  //   endAt: new Date(s.endAt).toISOString(),
  //   color: s.color
  // })));

  let shiftsOnDate = shifts.filter((shift: any) => {
    const shiftStart = new Date(shift.startAt);
    const shiftEnd = new Date(shift.endAt);
    return shiftStart <= endOfDay && shiftEnd >= startOfDay;
  });

  // console.log("🎨 Shifts on target date:", shiftsOnDate.length);

  if (params.shiftTitle) {
    shiftsOnDate = shiftsOnDate.filter((shift: any) => 
      shift.title?.toLowerCase().includes(params.shiftTitle!.toLowerCase())
    );
    // console.log("🎨 Shifts after title filter:", shiftsOnDate.length);
  }

  if (shiftsOnDate.length === 0) {
    return {
      success: false,
      error: `No encontré turnos para ${employee.fullName} el ${targetDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}`,
      employeeFullName: employee.fullName
    };
  }

  // Update color for all matching shifts
  // console.log("🎨 Updating color for shifts:", shiftsOnDate.map(s => s.id));
  for (const shift of shiftsOnDate) {
    await storage.updateWorkShift(shift.id, { color: params.newColor });
  }

  await logAIAuditAction(
    context,
    'ai_update_work_shift_color',
    `employeeId=${params.employeeId}; date=${params.date}; shiftsUpdated=${shiftsOnDate.length}; newColor=${params.newColor}`
  );
  // console.log("🎨 Color updated successfully");

  return {
    success: true,
    employeeFullName: employee.fullName,
    shiftsUpdated: shiftsOnDate.length,
    newColor: params.newColor
  };
}

// 12. Update work shift details (title, location, notes)
export async function updateWorkShiftDetails(
  context: AIFunctionContext,
  params: {
    employeeId: number;
    date: string; // YYYY-MM-DD
    newTitle?: string;
    newLocation?: string;
    newNotes?: string;
    shiftTitle?: string; // Current title to identify which shift
  }
) {
  const { storage, companyId } = context;

  const employee = await storage.getUser(params.employeeId);
  if (!employee || employee.companyId !== companyId) {
    throw new Error("Employee not found or doesn't belong to this company");
  }

  // Parse the date using UTC to avoid timezone issues
  const { startOfDay, endOfDay, targetDate } = getUTCDayBoundaries(params.date);

  const shifts = await db.select()
    .from(schema.workShifts)
    .where(
      and(
        eq(schema.workShifts.companyId, companyId),
        eq(schema.workShifts.employeeId, params.employeeId)
      )
    );

  let shiftsOnDate = shifts.filter((shift: any) => {
    const shiftStart = new Date(shift.startAt);
    const shiftEnd = new Date(shift.endAt);
    return shiftStart <= endOfDay && shiftEnd >= startOfDay;
  });

  if (params.shiftTitle) {
    shiftsOnDate = shiftsOnDate.filter((shift: any) => 
      shift.title?.toLowerCase().includes(params.shiftTitle!.toLowerCase())
    );
  }

  if (shiftsOnDate.length === 0) {
    return {
      success: false,
      error: `No encontré turnos para ${employee.fullName} el ${targetDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}`,
      employeeFullName: employee.fullName
    };
  }

  if (shiftsOnDate.length > 1 && !params.shiftTitle) {
    const titles = shiftsOnDate.map((s: any) => s.title).join(", ");
    return {
      success: false,
      error: `${employee.fullName} tiene múltiples turnos ese día (${titles}). Por favor, especifica cuál quieres modificar.`,
      employeeFullName: employee.fullName
    };
  }

  const shift = shiftsOnDate[0];
  const updates: any = {};

  if (params.newTitle) updates.title = params.newTitle;
  if (params.newLocation) updates.location = params.newLocation;
  if (params.newNotes) updates.notes = params.newNotes;

  await storage.updateWorkShift(shift.id, updates);

  await logAIAuditAction(
    context,
    'ai_update_work_shift_details',
    `employeeId=${params.employeeId}; date=${params.date}; shiftId=${shift.id}; updatedFields=${Object.keys(updates).join(',')}`
  );

  return {
    success: true,
    employeeFullName: employee.fullName,
    updatedFields: Object.keys(updates),
    shiftTitle: updates.title || shift.title
  };
}

// 12b. Update work shift times in BULK for date range
export async function updateWorkShiftsInRange(
  context: AIFunctionContext,
  params: {
    employeeId: number;
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
    newStartTime?: string; // HH:mm (e.g., "09:00")
    newEndTime?: string; // HH:mm (e.g., "17:00")
    shiftTitle?: string; // Optional: filter by title
  }
) {
  const { storage, companyId } = context;

  const employee = await storage.getUser(params.employeeId);
  if (!employee || employee.companyId !== companyId) {
    throw new Error("Employee not found or doesn't belong to this company");
  }

  // Get all shifts in the date range
  const shifts = await storage.getWorkShiftsByEmployee(
    params.employeeId,
    params.startDate,
    params.endDate
  );

  if (shifts.length === 0) {
    return {
      success: false,
      error: `${employee.fullName} no tiene turnos entre ${params.startDate} y ${params.endDate}`,
      employeeFullName: employee.fullName
    };
  }

  // Filter by title if specified
  let targetShifts = shifts;
  if (params.shiftTitle) {
    targetShifts = shifts.filter(shift =>
      shift.title?.toLowerCase().includes(params.shiftTitle!.toLowerCase())
    );

    if (targetShifts.length === 0) {
      return {
        success: false,
        error: `No encontré turnos con título "${params.shiftTitle}" para ${employee.fullName} en ese rango`,
        employeeFullName: employee.fullName
      };
    }
  }

  // Update times for all matching shifts
  let updatedCount = 0;
  for (const shift of targetShifts) {
    const updates: any = {};

    if (params.newStartTime) {
      const dateStr = new Date(shift.startAt).toISOString().split('T')[0];
      updates.startAt = new Date(`${dateStr}T${params.newStartTime}:00+01:00`);
    }

    if (params.newEndTime) {
      const dateStr = new Date(shift.endAt).toISOString().split('T')[0];
      updates.endAt = new Date(`${dateStr}T${params.newEndTime}:00+01:00`);
    }

    if (Object.keys(updates).length > 0) {
      await storage.updateWorkShift(shift.id, updates);
      updatedCount++;
    }
  }

  await logAIAuditAction(
    context,
    'ai_update_work_shifts_in_range',
    `employeeId=${params.employeeId}; startDate=${params.startDate}; endDate=${params.endDate}; shiftsUpdated=${updatedCount}; newStartTime=${params.newStartTime || ''}; newEndTime=${params.newEndTime || ''}`
  );

  return {
    success: true,
    employeeFullName: employee.fullName,
    shiftsUpdated: updatedCount,
    newStartTime: params.newStartTime,
    newEndTime: params.newEndTime,
    dateRange: `${params.startDate} a ${params.endDate}`
  };
}

// 13. Update all work shift colors for an employee in a date range
export async function updateEmployeeShiftsColor(
  context: AIFunctionContext,
  params: {
    employeeId: number;
    startDate: string; // YYYY-MM-DD
    endDate: string;   // YYYY-MM-DD  
    newColor: string;  // Hex color (e.g., "#3b82f6")
  }
) {
  const { storage, companyId } = context;

  // Validate hex color
  if (!/^#[0-9A-F]{6}$/i.test(params.newColor)) {
    return {
      success: false,
      error: `"${params.newColor}" no es un color hexadecimal válido. Usa formato #RRGGBB (ej: #3b82f6)`
    };
  }

  const employee = await storage.getUser(params.employeeId);
  if (!employee || employee.companyId !== companyId) {
    throw new Error("Employee not found or doesn't belong to this company");
  }

  // Get all shifts in the date range
  const shifts = await storage.getWorkShiftsByEmployee(
    params.employeeId,
    params.startDate,
    params.endDate
  );

  if (shifts.length === 0) {
    return {
      success: false,
      error: `${employee.fullName} no tiene turnos entre ${params.startDate} y ${params.endDate}`,
      employeeFullName: employee.fullName
    };
  }

  // Update color for all shifts
  for (const shift of shifts) {
    await storage.updateWorkShift(shift.id, { color: params.newColor });
  }

  await logAIAuditAction(
    context,
    'ai_update_employee_shifts_color',
    `employeeId=${params.employeeId}; startDate=${params.startDate}; endDate=${params.endDate}; shiftsUpdated=${shifts.length}; newColor=${params.newColor}`
  );

  return {
    success: true,
    employeeFullName: employee.fullName,
    shiftsUpdated: shifts.length,
    newColor: params.newColor,
    dateRange: `${params.startDate} a ${params.endDate}`
  };
}

// 14. Swap work shifts between two employees
export async function swapEmployeeShifts(
  context: AIFunctionContext,
  params: {
    employeeAId: number;
    employeeBId: number;
    startDate?: string; // YYYY-MM-DD - Optional start date
    endDate?: string;   // YYYY-MM-DD - Optional end date
  }
) {
  const { storage, companyId } = context;

  // Verify both employees belong to the company
  const employeeA = await storage.getUser(params.employeeAId);
  const employeeB = await storage.getUser(params.employeeBId);

  if (!employeeA || employeeA.companyId !== companyId) {
    throw new Error("Employee A not found or doesn't belong to this company");
  }

  if (!employeeB || employeeB.companyId !== companyId) {
    throw new Error("Employee B not found or doesn't belong to this company");
  }

  // Perform the swap
  const result = await storage.swapEmployeeShifts(
    params.employeeAId,
    params.employeeBId,
    params.startDate,
    params.endDate
  );

  if (!result.success) {
    return {
      success: false,
      error: result.conflicts?.[0] || "Error al intercambiar turnos",
      employeeAName: employeeA.fullName,
      employeeBName: employeeB.fullName
    };
  }

  await logAIAuditAction(
    context,
    'ai_swap_employee_shifts',
    `employeeAId=${params.employeeAId}; employeeBId=${params.employeeBId}; swappedCount=${result.swappedCount}; startDate=${params.startDate || ''}; endDate=${params.endDate || ''}`
  );

  return {
    success: true,
    employeeAName: employeeA.fullName,
    employeeBName: employeeB.fullName,
    swappedCount: result.swappedCount,
    dateRange: params.startDate && params.endDate 
      ? `${params.startDate} a ${params.endDate}`
      : "todos los turnos"
  };
}

// 14b. Create shifts for target employee "after" source employee
export async function createShiftAfterEmployee(
  context: AIFunctionContext,
  params: {
    sourceEmployeeId: number;
    targetEmployeeId: number;
    endTime: string; // HH:mm - when target shift ends (e.g., "22:00")
    startDate?: string; // YYYY-MM-DD - optional date range filter
    endDate?: string; // YYYY-MM-DD
  }
) {
  const { storage, companyId, adminUserId } = context;

  // Verify both employees belong to company
  const [sourceEmployee, targetEmployee] = await Promise.all([
    storage.getUser(params.sourceEmployeeId),
    storage.getUser(params.targetEmployeeId)
  ]);

  if (!sourceEmployee || sourceEmployee.companyId !== companyId) {
    return { success: false, error: "Empleado de referencia no encontrado" };
  }
  if (!targetEmployee || targetEmployee.companyId !== companyId) {
    return { success: false, error: "Empleado destino no encontrado" };
  }

  // Get all shifts from source employee
  const allShifts = await storage.getWorkShiftsByCompany(companyId);
  let sourceShifts = allShifts.filter(shift => shift.employeeId === params.sourceEmployeeId);

  // Filter by date range if provided
  if (params.startDate || params.endDate) {
    const startFilter = params.startDate ? new Date(params.startDate) : new Date(0);
    const endFilter = params.endDate ? new Date(params.endDate) : new Date('2100-01-01');
    
    sourceShifts = sourceShifts.filter(shift => {
      const shiftDate = new Date(shift.startAt);
      return shiftDate >= startFilter && shiftDate <= endFilter;
    });
  }

  if (sourceShifts.length === 0) {
    return { success: false, error: `${sourceEmployee.fullName} no tiene turnos en el rango especificado` };
  }

  // Parse target end time
  const [endHour, endMinute] = params.endTime.split(':').map(Number);

  // Auto-assign color based on employee ID
  const targetColor = getEmployeeColor(params.targetEmployeeId);

  // Create new shifts for target: start when source ends, end at specified time
  const createdShifts = [];
  
  for (const sourceShift of sourceShifts) {
    const sourceEnd = new Date(sourceShift.endAt);

    // Extract source shift end time
    const sourceEndHour = sourceEnd.getUTCHours();
    const sourceEndMinute = sourceEnd.getUTCMinutes();

    // Create target shift: same date, starts when source ends
    const targetStart = new Date(sourceEnd);
    targetStart.setUTCHours(sourceEndHour, sourceEndMinute, 0, 0);

    const targetEnd = new Date(sourceEnd);
    targetEnd.setUTCHours(endHour, endMinute, 0, 0);

    // Create the shift
    const newShift = await storage.createWorkShift({
      companyId,
      employeeId: params.targetEmployeeId,
      startAt: targetStart,
      endAt: targetEnd,
      title: `Turno hasta las ${params.endTime}`,
      location: sourceShift.location || 'Oficina',
      color: targetColor,
      notes: null,
      createdByUserId: adminUserId
    });

    createdShifts.push(newShift);
  }

  await logAIAuditAction(
    context,
    'ai_create_shift_after_employee',
    `sourceEmployeeId=${params.sourceEmployeeId}; targetEmployeeId=${params.targetEmployeeId}; createdCount=${createdShifts.length}; endTime=${params.endTime}`
  );

  return {
    success: true,
    sourceEmployeeName: sourceEmployee.fullName,
    targetEmployeeName: targetEmployee.fullName,
    createdCount: createdShifts.length,
    dateRange: params.startDate && params.endDate 
      ? `del ${params.startDate} al ${params.endDate}`
      : 'todos los turnos'
  };
}

// 15. Copy work shifts from one employee to another
export async function copyEmployeeShifts(
  context: AIFunctionContext,
  params: {
    fromEmployeeId: number;
    toEmployeeId: number;
    startDate?: string; // YYYY-MM-DD - Optional start date
    endDate?: string;   // YYYY-MM-DD - Optional end date
  }
) {
  const { storage, companyId, adminUserId } = context;

  // Verify both employees belong to the company
  const fromEmployee = await storage.getUser(params.fromEmployeeId);
  const toEmployee = await storage.getUser(params.toEmployeeId);

  if (!fromEmployee || fromEmployee.companyId !== companyId) {
    throw new Error("Source employee not found or doesn't belong to this company");
  }

  if (!toEmployee || toEmployee.companyId !== companyId) {
    throw new Error("Target employee not found or doesn't belong to this company");
  }

  // Get shifts from source employee
  const sourceShifts = await storage.getWorkShiftsByEmployee(
    params.fromEmployeeId,
    params.startDate,
    params.endDate
  );

  if (sourceShifts.length === 0) {
    return {
      success: false,
      error: `${fromEmployee.fullName} no tiene turnos en el rango especificado`,
      fromEmployeeName: fromEmployee.fullName,
      toEmployeeName: toEmployee.fullName
    };
  }

  // Create copies for target employee
  let copiedCount = 0;
  for (const shift of sourceShifts) {
    await db.insert(schema.workShifts).values({
      companyId,
      employeeId: params.toEmployeeId,
      startAt: shift.startAt,
      endAt: shift.endAt,
      title: shift.title,
      location: shift.location,
      notes: shift.notes,
      color: getEmployeeColor(params.toEmployeeId), // Use target employee's color
      createdByUserId: adminUserId,
    });
    copiedCount++;
  }

  await logAIAuditAction(
    context,
    'ai_copy_employee_shifts',
    `fromEmployeeId=${params.fromEmployeeId}; toEmployeeId=${params.toEmployeeId}; copiedCount=${copiedCount}; startDate=${params.startDate || ''}; endDate=${params.endDate || ''}`
  );

  return {
    success: true,
    fromEmployeeName: fromEmployee.fullName,
    toEmployeeName: toEmployee.fullName,
    copiedCount,
    dateRange: params.startDate && params.endDate 
      ? `${params.startDate} a ${params.endDate}`
      : "todos los turnos"
  };
}

// Navigation function to redirect user to specific pages with filters
export async function navigateToPage(
  context: AIFunctionContext,
  params: {
    page: "dashboard" | "vacation-requests" | "vacation-calendar" | "time-tracking" | "schedules" | "employees" | "documents" | "reminders" | "messages" | "work-reports" | "settings" | "settings-policies" | "settings-notifications" | "profile";
    filter?: "pending" | "approved" | "denied" | "all";
    employeeName?: string; // Filter by employee name
    startDate?: string; // YYYY-MM-DD
    endDate?: string; // YYYY-MM-DD
  }
) {
  const { storage, companyId } = context;
  
  // Get company alias for URL building
  const company = await storage.getCompany(companyId);
  if (!company) {
    return {
      success: false,
      error: "No se encontró la empresa"
    };
  }

  // Resolve employee name if provided
  let employeeId: number | undefined;
  let employeeFullName: string | undefined;
  if (params.employeeName) {
    const resolved = await resolveEmployeeName(storage, companyId, params.employeeName);
    if ('error' in resolved) {
      return { success: false, error: resolved.error };
    }
    employeeId = resolved.employeeId;
    const emp = await storage.getUser(employeeId);
    employeeFullName = emp?.fullName;
  }

  // Build the navigation URL based on page type
  let path = "";
  let queryParams = "";
  let description = "";

  switch (params.page) {
    case "dashboard":
      path = `/${company.companyAlias}/inicio`;
      description = "Te llevo al panel de inicio";
      break;

    case "vacation-requests":
      // 'vacation' in UI is named 'Ausencias' (absences)
      path = `/${company.companyAlias}/ausencias`;
      queryParams = `?tab=requests${params.filter ? `&status=${params.filter}` : '&status=pending'}`;
      
      const vacationRequests = await storage.getVacationRequestsByCompany(companyId);
      const pendingCount = vacationRequests.filter(r => r.status === 'pending').length;
      const approvedCount = vacationRequests.filter(r => r.status === 'approved').length;
      const deniedCount = vacationRequests.filter(r => r.status === 'denied').length;
      
      if (params.filter === 'pending' || !params.filter) {
        description = pendingCount === 0 
          ? "No hay solicitudes de ausencias pendientes"
          : `Hay ${pendingCount} solicitud${pendingCount > 1 ? 'es' : ''} de ausencias pendiente${pendingCount > 1 ? 's' : ''}`;
      } else if (params.filter === 'approved') {
        description = `Hay ${approvedCount} solicitud${approvedCount > 1 ? 'es' : ''} aprobada${approvedCount > 1 ? 's' : ''}`;
      } else if (params.filter === 'denied') {
        description = `Hay ${deniedCount} solicitud${deniedCount > 1 ? 'es' : ''} denegada${deniedCount > 1 ? 's' : ''}`;
      } else {
        description = `Hay ${vacationRequests.length} solicitud${vacationRequests.length > 1 ? 'es' : ''} en total`;
      }
      break;

    case "vacation-calendar":
      path = `/${company.companyAlias}/ausencias`;
      queryParams = "?tab=calendar";
      if (employeeId) {
        queryParams += `&employeeId=${employeeId}`;
        description = `Te llevo al calendario de ausencias de ${employeeFullName}`;
      } else {
        description = "Te llevo al calendario de ausencias";
      }
      break;
      
    case "time-tracking":
      path = `/${company.companyAlias}/fichajes`;
      const timeQueryParts: string[] = [];
      if (employeeId) {
        timeQueryParts.push(`employeeId=${employeeId}`);
      }
      if (params.startDate) {
        timeQueryParts.push(`startDate=${params.startDate}`);
      }
      if (params.endDate) {
        timeQueryParts.push(`endDate=${params.endDate}`);
      }
      queryParams = timeQueryParts.length > 0 ? `?${timeQueryParts.join('&')}` : '';
      
      if (employeeFullName && params.startDate) {
        description = `Te llevo a los fichajes de ${employeeFullName} desde ${params.startDate}`;
      } else if (employeeFullName) {
        description = `Te llevo a los fichajes de ${employeeFullName}`;
      } else if (params.startDate) {
        description = `Te llevo a los fichajes desde ${params.startDate}`;
      } else {
        description = "Te llevo a la página de fichajes";
      }
      break;
      
    case "schedules":
      path = `/${company.companyAlias}/cuadrante`;
      if (employeeId) {
        queryParams = `?employeeId=${employeeId}`;
        description = `Te llevo al cuadrante de ${employeeFullName}`;
      } else {
        description = "Te llevo al cuadrante de horarios";
      }
      break;
      
    case "employees":
      path = `/${company.companyAlias}/configuracion`;
      queryParams = "?tab=employees";
      description = "Te llevo a la gestión de empleados";
      break;
      
    case "documents":
      path = `/${company.companyAlias}/documentos`;
      if (params.filter === 'pending') {
        queryParams = "?status=pending";
        description = "Te llevo a los documentos pendientes de firma";
      } else {
        description = "Te llevo a la gestión de documentos";
      }
      break;
      
    case "reminders":
      path = `/${company.companyAlias}/recordatorios`;
      description = "Te llevo a los recordatorios";
      break;

    case "messages":
      path = `/${company.companyAlias}/mensajes`;
      if (params.filter === 'pending') {
        queryParams = "?filter=unread";
        description = "Te llevo a los mensajes sin leer";
      } else {
        description = "Te llevo a los mensajes";
      }
      break;

    case "work-reports":
      path = `/${company.companyAlias}/partes`;
      const reportsQueryParts: string[] = [];
      if (params.filter) {
        reportsQueryParts.push(`status=${params.filter}`);
      }
      if (employeeId) {
        reportsQueryParts.push(`employeeId=${employeeId}`);
      }
      if (params.startDate) {
        reportsQueryParts.push(`startDate=${params.startDate}`);
      }
      if (params.endDate) {
        reportsQueryParts.push(`endDate=${params.endDate}`);
      }
      queryParams = reportsQueryParts.length > 0 ? `?${reportsQueryParts.join('&')}` : '';
      
      if (params.filter === 'pending') {
        description = "Te llevo a los partes de trabajo pendientes";
      } else if (employeeFullName) {
        description = `Te llevo a los partes de trabajo de ${employeeFullName}`;
      } else {
        description = "Te llevo a los partes de trabajo";
      }
      break;

    case "settings":
      path = `/${company.companyAlias}/configuracion`;
      description = "Te llevo a la configuración";
      break;

    case "settings-policies":
      path = `/${company.companyAlias}/configuracion`;
      queryParams = "?tab=policies";
      description = "Te llevo a las políticas de la empresa";
      break;

    case "settings-notifications":
      path = `/${company.companyAlias}/configuracion`;
      queryParams = "?tab=notifications";
      description = "Te llevo a la configuración de notificaciones";
      break;

    case "profile":
      path = `/${company.companyAlias}/perfil`;
      description = "Te llevo a tu perfil";
      break;
      
    default:
      return {
        success: false,
        error: "Página no reconocida"
      };
  }

  return {
    success: true,
    navigateTo: path + queryParams,
    description,
    page: params.page,
    filter: params.filter,
    employeeName: employeeFullName
  };
}

// Function definitions for OpenAI function calling
// ================================================================
// ⏱️ ACTIVE WORKERS: Who's clocked in right now
// ================================================================
export async function getActiveWorkers(context: AIFunctionContext) {
  const { storage, companyId } = context;

  const employees = await storage.getUsersByCompany(companyId);
  const activeEmployees = employees.filter(e => e.status === 'active');
  const employeeIds = activeEmployees.map(e => e.id);

  if (employeeIds.length === 0) {
    return { success: true, activeCount: 0, workers: [], message: "No hay empleados activos." };
  }

  const activeSessions = await db
    .select({ userId: schema.workSessions.userId, clockIn: schema.workSessions.clockIn })
    .from(schema.workSessions)
    .where(and(inArray(schema.workSessions.userId, employeeIds), eq(schema.workSessions.status, 'active')));

  const activeIds = new Set(activeSessions.map(s => s.userId));
  const empMap = new Map(activeEmployees.map(e => [e.id, e.fullName]));

  const workers = activeSessions.map(s => {
    const hoursWorked = ((Date.now() - new Date(s.clockIn).getTime()) / 3600000).toFixed(1);
    return {
      id: s.userId,
      fullName: empMap.get(s.userId) || `ID ${s.userId}`,
      clockIn: new Date(s.clockIn).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      hoursWorked: `${hoursWorked}h`,
    };
  });

  const notWorking = activeEmployees.filter(e => !activeIds.has(e.id)).map(e => e.fullName);

  return {
    success: true,
    activeCount: workers.length,
    totalActiveEmployees: activeEmployees.length,
    workers,
    notWorking,
    navigateTo: '/time-tracking',
    message: workers.length === 0
      ? "Ningún empleado está fichado en este momento."
      : `${workers.length} de ${activeEmployees.length} empleado(s) fichado(s) ahora mismo.`,
  };
}

// ================================================================
// 📇 CRM: List contacts
// ================================================================
export async function listCRMContacts(
  context: AIFunctionContext,
  params?: { role?: 'client' | 'provider'; search?: string; limit?: number }
) {
  const { companyId } = context;
  const limit = Math.min(params?.limit || 20, 50);

  const contacts = await db
    .select({
      id: schema.businessContacts.id,
      name: schema.businessContacts.name,
      role: schema.businessContacts.role,
      email: schema.businessContacts.email,
      phone: schema.businessContacts.phone,
      city: schema.businessContacts.city,
    })
    .from(schema.businessContacts)
    .where(and(
      eq(schema.businessContacts.companyId, companyId),
      params?.role ? eq(schema.businessContacts.role, params.role) : undefined,
      params?.search ? ilike(schema.businessContacts.name, `%${params.search}%`) : undefined,
    ))
    .orderBy(desc(schema.businessContacts.createdAt))
    .limit(limit);

  return {
    success: true,
    totalCount: contacts.length,
    contacts: contacts.map(c => ({
      id: c.id,
      name: c.name,
      type: c.role === 'client' ? 'cliente' : 'proveedor',
      email: c.email || '',
      phone: c.phone || '',
      city: c.city || '',
    })),
    navigateTo: params?.role === 'provider' ? '/crm/contacts?tab=proveedores' : '/crm/contacts',
  };
}

// ================================================================
// ➕ CRM: Create contact
// ================================================================
export async function createCRMContact(
  context: AIFunctionContext,
  params: { name: string; role: 'client' | 'provider'; email?: string; phone?: string; city?: string; taxId?: string; notes?: string }
) {
  const { companyId } = context;

  const [newContact] = await db
    .insert(schema.businessContacts)
    .values({
      companyId,
      name: params.name,
      role: params.role,
      email: params.email || null,
      phone: params.phone || null,
      city: params.city || null,
      taxId: params.taxId || null,
      notes: params.notes || null,
    })
    .returning();

  await logAIAuditAction(
    context,
    'ai_create_crm_contact',
    `contactId=${newContact.id}; role=${params.role}; name=${params.name}`
  );

  return {
    success: true,
    contact: { id: newContact.id, name: newContact.name, type: params.role === 'client' ? 'cliente' : 'proveedor' },
    message: `Contacto "${params.name}" creado como ${params.role === 'client' ? 'cliente' : 'proveedor'}.`,
    navigateTo: '/crm/contacts',
  };
}

// ================================================================
// 💬 CRM: Add interaction / note to a contact
// ================================================================
export async function addCRMInteraction(
  context: AIFunctionContext,
  params: { contactId: number; interactionType: 'call' | 'email' | 'whatsapp' | 'meeting' | 'note'; subject?: string; notes: string; result?: 'interested' | 'not_interested' | 'pending' | 'won' | 'lost' }
) {
  const { companyId, adminUserId } = context;

  const [contact] = await db
    .select({ id: schema.businessContacts.id, name: schema.businessContacts.name })
    .from(schema.businessContacts)
    .where(and(eq(schema.businessContacts.id, params.contactId), eq(schema.businessContacts.companyId, companyId)));

  if (!contact) return { success: false, error: "Contacto no encontrado en esta empresa." };

  await db.insert(schema.crmContactInteractions).values({
    companyId,
    contactId: params.contactId,
    interactionType: params.interactionType,
    subject: params.subject || null,
    notes: params.notes,
    result: params.result || null,
    responded: false,
    occurredAt: new Date(),
    createdBy: adminUserId,
  });

  await logAIAuditAction(
    context,
    'ai_add_crm_interaction',
    `contactId=${params.contactId}; interactionType=${params.interactionType}; subject=${params.subject || ''}`
  );

  return {
    success: true,
    message: `Interacción (${params.interactionType}) registrada para "${contact.name}".`,
    navigateTo: `/crm/capture`,
  };
}

// ================================================================
// 📋 WORK REPORTS: List partes de trabajo
// ================================================================
export async function listWorkReports(
  context: AIFunctionContext,
  params?: { employeeId?: number; startDate?: string; endDate?: string; limit?: number }
) {
  const { storage, companyId } = context;
  const limit = Math.min(params?.limit || 20, 50);

  const conditions = [eq(schema.workReports.companyId, companyId)];
  if (params?.employeeId) conditions.push(eq(schema.workReports.employeeId, params.employeeId));
  if (params?.startDate) conditions.push(gte(schema.workReports.reportDate, params.startDate));
  if (params?.endDate) conditions.push(lte(schema.workReports.reportDate, params.endDate));

  const reports = await db
    .select()
    .from(schema.workReports)
    .where(and(...conditions))
    .orderBy(desc(schema.workReports.reportDate))
    .limit(limit);

  const employees = await storage.getUsersByCompany(companyId);
  const empMap = new Map(employees.map(e => [e.id, e.fullName]));

  return {
    success: true,
    totalCount: reports.length,
    reports: reports.map(r => ({
      id: r.id,
      employee: empMap.get(r.employeeId) || `ID ${r.employeeId}`,
      date: r.reportDate,
      location: r.location,
      client: r.clientName || '',
      refCode: r.refCode || '',
      description: r.description,
      hours: r.durationMinutes ? `${(r.durationMinutes / 60).toFixed(1)}h` : '',
      status: r.status,
    })),
    navigateTo: '/work-reports',
  };
}

// ================================================================
// 📝 WORK REPORTS: Create work report
// ================================================================
export async function createWorkReport(
  context: AIFunctionContext,
  params: { employeeId: number; reportDate: string; location: string; startTime: string; endTime: string; description: string; clientName?: string; refCode?: string; notes?: string }
) {
  const { storage, companyId } = context;

  const employee = await storage.getUser(params.employeeId);
  if (!employee || employee.companyId !== companyId) {
    return { success: false, error: "Empleado no encontrado o no pertenece a esta empresa." };
  }

  const [sh, sm] = params.startTime.split(':').map(Number);
  const [eh, em] = params.endTime.split(':').map(Number);
  const durationMinutes = (eh * 60 + em) - (sh * 60 + sm);
  if (durationMinutes <= 0) return { success: false, error: "La hora de fin debe ser posterior a la hora de inicio." };

  const report = await storage.createWorkReport({
    companyId,
    employeeId: params.employeeId,
    reportDate: params.reportDate,
    location: params.location,
    startTime: params.startTime,
    endTime: params.endTime,
    durationMinutes,
    description: params.description,
    clientName: params.clientName || null,
    refCode: params.refCode || null,
    notes: params.notes || null,
    status: 'submitted',
  } as any);

  await logAIAuditAction(
    context,
    'ai_create_work_report',
    `reportId=${report.id}; employeeId=${params.employeeId}; reportDate=${params.reportDate}; durationMinutes=${durationMinutes}`
  );

  return {
    success: true,
    report: { id: report.id, employee: employee.fullName, date: params.reportDate, location: params.location, hours: `${(durationMinutes / 60).toFixed(1)}h` },
    message: `Parte de trabajo creado para ${employee.fullName} el ${params.reportDate} (${(durationMinutes / 60).toFixed(1)}h en ${params.location}).`,
    navigateTo: '/work-reports',
  };
}

// ================================================================
// 🏖️ ABSENCES: Create a vacation/absence request (auto-approved)
// ================================================================
export async function createVacationRequest(
  context: AIFunctionContext,
  params: { employeeId: number; startDate: string; endDate: string; reason?: string; type?: 'vacation' | 'sick_leave' | 'personal_leave' }
) {
  const { storage, companyId } = context;

  const employee = await storage.getUser(params.employeeId);
  if (!employee || employee.companyId !== companyId) {
    return { success: false, error: "Empleado no encontrado o no pertenece a esta empresa." };
  }

  const absenceType = params.type || 'vacation';
  const startTs = new Date(`${params.startDate}T00:00:00`);
  const endTs = new Date(`${params.endDate}T23:59:59`);
  const daysCount = Math.ceil((endTs.getTime() - startTs.getTime()) / 86400000);

  const request = await storage.createVacationRequest({
    userId: params.employeeId,
    startDate: startTs,
    endDate: endTs,
    reason: params.reason || 'Registrado por administrador',
    absenceType,
    status: 'approved',
  } as any);

  await logAIAuditAction(
    context,
    'ai_create_vacation_request',
    `requestId=${request.id}; employeeId=${params.employeeId}; startDate=${params.startDate}; endDate=${params.endDate}; type=${absenceType}`
  );

  return {
    success: true,
    request: { id: request.id, employee: employee.fullName, startDate: params.startDate, endDate: params.endDate, days: daysCount, type: absenceType, status: 'aprobada' },
    message: `Ausencia aprobada para ${employee.fullName}: del ${params.startDate} al ${params.endDate} (${daysCount} día(s)).`,
    navigateTo: '/vacation-calendar',
  };
}

// ================================================================
// 💰 ACCOUNTING: Get income/expense summary
// ================================================================
export async function getAccountingSummary(
  context: AIFunctionContext,
  params?: { period?: 'this_month' | 'last_month' | 'this_year' | 'last_year' | 'custom'; startDate?: string; endDate?: string }
) {
  const { companyId } = context;
  const now = new Date();
  const period = params?.period || 'this_month';
  let startDate: string, endDate: string, periodLabel: string;

  if (period === 'last_month') {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    startDate = d.toISOString().split('T')[0];
    endDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
    periodLabel = 'el mes pasado';
  } else if (period === 'this_year') {
    startDate = `${now.getFullYear()}-01-01`;
    endDate = `${now.getFullYear()}-12-31`;
    periodLabel = 'este año';
  } else if (period === 'last_year') {
    startDate = `${now.getFullYear() - 1}-01-01`;
    endDate = `${now.getFullYear() - 1}-12-31`;
    periodLabel = 'el año pasado';
  } else if (period === 'custom' && params?.startDate && params?.endDate) {
    startDate = params.startDate;
    endDate = params.endDate;
    periodLabel = `del ${params.startDate} al ${params.endDate}`;
  } else {
    startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    endDate = now.toISOString().split('T')[0];
    periodLabel = 'este mes';
  }

  const entries = await db
    .select({ type: schema.accountingEntries.type, totalAmount: schema.accountingEntries.totalAmount })
    .from(schema.accountingEntries)
    .where(and(
      eq(schema.accountingEntries.companyId, companyId),
      gte(schema.accountingEntries.entryDate, startDate),
      lte(schema.accountingEntries.entryDate, endDate),
    ));

  const totalIncome = entries.filter(e => e.type === 'income').reduce((s, e) => s + parseFloat(String(e.totalAmount || 0)), 0);
  const totalExpenses = entries.filter(e => e.type === 'expense').reduce((s, e) => s + parseFloat(String(e.totalAmount || 0)), 0);
  const balance = totalIncome - totalExpenses;

  return {
    success: true,
    period: periodLabel,
    totalIncome: `${totalIncome.toFixed(2)}€`,
    totalExpenses: `${totalExpenses.toFixed(2)}€`,
    balance: `${balance >= 0 ? '+' : ''}${balance.toFixed(2)}€`,
    entryCount: entries.length,
    navigateTo: '/accounting',
    message: `Contabilidad ${periodLabel}: Ingresos ${totalIncome.toFixed(2)}€ | Gastos ${totalExpenses.toFixed(2)}€ | Balance ${balance >= 0 ? '+' : ''}${balance.toFixed(2)}€`,
  };
}

export const AI_FUNCTIONS = [
  // ========================================
  // 📖 READ-ONLY FUNCTIONS (Always available - use these to gather context!)
  // ========================================
  {
    name: "listEmployees",
    description: "📋 CONSULTA la lista de empleados de la empresa. USA ESTA FUNCIÓN PRIMERO cuando el usuario mencione empleados para verificar quiénes existen y sus nombres exactos. SIEMPRE consulta antes de actuar sobre empleados",
    parameters: {
      type: "object",
      properties: {
        role: {
          type: "string",
          enum: ["admin", "employee"],
          description: "Filtrar por rol (opcional)",
        },
      },
      required: [],
    },
  },
  {
    name: "getEmployeeShifts",
    description: "🔍 CONSULTA los turnos existentes de un empleado. USA ESTA FUNCIÓN ANTES de modificar, eliminar o cambiar colores de turnos para ver qué turnos realmente existen y sus títulos exactos. SIEMPRE consulta los turnos antes de actuar sobre ellos",
    parameters: {
      type: "object",
      properties: {
        employeeName: {
          type: "string",
          description: "Nombre del empleado",
        },
        startDate: {
          type: "string",
          description: "Fecha de inicio en formato YYYY-MM-DD (opcional)",
        },
        endDate: {
          type: "string",
          description: "Fecha de fin en formato YYYY-MM-DD (opcional)",
        },
      },
      required: ["employeeName"],
    },
  },
  {
    name: "getCompanyContext",
    description: "📊 CONSULTA un resumen del estado actual de la empresa (empleados, solicitudes pendientes, etc). Útil para entender el contexto general",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "getEmployeeWorkHours",
    description: "⏱️ CONSULTA las horas trabajadas de un empleado o del equipo en un período. Devuelve total de horas, fichajes, y NAVEGA automáticamente a la página de fichajes con los filtros aplicados. Usa para preguntas como '¿cuántas horas trabajó Juan la semana pasada?'",
    parameters: {
      type: "object",
      properties: {
        employeeName: {
          type: "string",
          description: "Nombre del empleado (opcional, si no se especifica devuelve todos)",
        },
        period: {
          type: "string",
          enum: ["today", "yesterday", "this_week", "last_week", "this_month", "last_month", "custom"],
          description: "Período de tiempo. Usa 'last_week' para 'la semana pasada', 'this_month' para 'este mes', etc.",
        },
        startDate: {
          type: "string",
          description: "Fecha inicio YYYY-MM-DD (solo si period='custom')",
        },
        endDate: {
          type: "string",
          description: "Fecha fin YYYY-MM-DD (solo si period='custom')",
        },
      },
      required: ["period"],
    },
  },
  {
    name: "getCompanySettings",
    description: "⚙️ CONSULTA la configuración y políticas actuales de la empresa (horas trabajo/día, días vacaciones/mes, horarios, etc). Usa para responder preguntas sobre políticas o antes de modificarlas.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "getVacationBalance",
    description: "🏖️ CONSULTA el balance de vacaciones de un empleado o de todos. Devuelve días totales, usados, pendientes y disponibles. NAVEGA al calendario de vacaciones.",
    parameters: {
      type: "object",
      properties: {
        employeeName: {
          type: "string",
          description: "Nombre del empleado (opcional, si no se especifica devuelve todos)",
        },
      },
      required: [],
    },
  },
  {
    name: "getPendingApprovals",
    description: "📋 CONSULTA todas las solicitudes pendientes de aprobación (vacaciones, modificaciones de fichaje, partes de trabajo). Útil para saber qué hay pendiente y navegar a la página correspondiente.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  // ========================================
  // ✏️ MUTATION FUNCTIONS (Actions - use after consulting)
  // ========================================
  {
    name: "sendMessage",
    description: "💬 ENVIAR un mensaje a uno o varios empleados. USA ESTA FUNCIÓN cuando el usuario diga 'dile a X que...', 'avisa a X...', 'manda un mensaje a X...', 'informa a X...'. IMPORTANTE: 1) Primero usa listEmployees() para obtener los IDs de los empleados, 2) Construye mensajes CORDIALES: si es UN solo empleado usa 'Hola [nombre corto]...', si son VARIOS o 'all' usa saludo neutral 'Hola,...' o 'Hola equipo,...', 3) Usa tono profesional pero cercano.",
    parameters: {
      type: "object",
      properties: {
        employeeIds: {
          oneOf: [
            { type: "array", items: { type: "number" } },
            { type: "string", enum: ["all"] }
          ],
          description: "Array de IDs de empleados (obtener de listEmployees) o 'all' para enviar a todos",
        },
        subject: {
          type: "string",
          description: "Asunto breve del mensaje (ej: 'Actualización de horario', 'Información importante')",
        },
        content: {
          type: "string",
          description: "Contenido del mensaje cordial. SI es UN empleado: 'Hola [nombre], [mensaje], un saludo.' SI son VARIOS o 'all': 'Hola, [mensaje], un saludo.' o 'Hola equipo, [mensaje], un saludo.'",
        },
      },
      required: ["employeeIds", "subject", "content"],
    },
  },
  {
    name: "approveTimeModificationRequests",
    description: "Aprobar solicitudes de modificación de horario (fichajes olvidados o correcciones)",
    parameters: {
      type: "object",
      properties: {
        requestIds: {
          oneOf: [
            { type: "array", items: { type: "number" } },
            { type: "string", enum: ["all_pending"] }
          ],
          description: "Array de IDs de solicitudes o 'all_pending' para aprobar todas las pendientes",
        },
        adminResponse: {
          type: "string",
          description: "Comentario opcional del administrador sobre la aprobación",
        },
      },
      required: ["requestIds"],
    },
  },
  {
    name: "approveVacationRequests",
    description: "Aprobar solicitudes de vacaciones pendientes",
    parameters: {
      type: "object",
      properties: {
        requestIds: {
          oneOf: [
            { type: "array", items: { type: "number" } },
            { type: "string", enum: ["all_pending"] }
          ],
          description: "Array de IDs de solicitudes o 'all_pending' para aprobar todas las pendientes",
        },
        adminComment: {
          type: "string",
          description: "Comentario opcional del administrador sobre la aprobación",
        },
      },
      required: ["requestIds"],
    },
  },
  {
    name: "denyVacationRequests",
    description: "❌ Denegar solicitudes de vacaciones pendientes. Usa cuando el usuario quiera rechazar vacaciones.",
    parameters: {
      type: "object",
      properties: {
        requestIds: {
          oneOf: [
            { type: "array", items: { type: "number" } },
            { type: "string", enum: ["all_pending"] }
          ],
          description: "Array de IDs de solicitudes o 'all_pending' para denegar todas las pendientes",
        },
        adminComment: {
          type: "string",
          description: "Motivo del rechazo (recomendado incluir explicación)",
        },
      },
      required: ["requestIds"],
    },
  },
  {
    name: "updateCompanySettings",
    description: "⚙️ Modificar la configuración y políticas de la empresa. Usa para cambiar horas de trabajo, días de vacaciones, horarios, etc. SIEMPRE usa getCompanySettings primero para ver valores actuales.",
    parameters: {
      type: "object",
      properties: {
        workingHoursPerDay: {
          type: "number",
          description: "Horas de trabajo por día (ej: 8, 7.5)",
        },
        vacationDaysPerMonth: {
          type: "number",
          description: "Días de vacaciones por mes trabajado (ej: 2.5)",
        },
        workingHoursStart: {
          type: "string",
          description: "Hora de entrada (ej: '08:00', '09:00')",
        },
        workingHoursEnd: {
          type: "string",
          description: "Hora de salida (ej: '17:00', '18:00')",
        },
        allowManagersToGrantRoles: {
          type: "boolean",
          description: "Permitir a los managers asignar roles a empleados",
        },
      },
      required: [],
    },
  },
  {
    name: "createReminder",
    description: "Crear un recordatorio, opcionalmente asignarlo a empleados específicos. Soporta nombres de empleados.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Título del recordatorio (infiere del mensaje del usuario si dice 'recuérdame...')",
        },
        content: {
          type: "string",
          description: "Descripción o contenido del recordatorio (opcional)",
        },
        reminderDate: {
          type: "string",
          description: "Fecha del recordatorio en formato ISO (YYYY-MM-DD o YYYY-MM-DDTHH:mm:ss). Interpreta fechas naturales: 'mañana', 'el lunes', 'en 2 horas', etc.",
        },
        priority: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Prioridad del recordatorio. Usa 'high' si el usuario dice 'urgente' o 'importante'",
        },
        assignToEmployeeNames: {
          type: "array",
          items: { type: "string" },
          description: "Array de NOMBRES de empleados a quienes asignar (ej: ['juan', 'maria']). La IA resolverá los nombres a IDs automáticamente",
        },
        assignToEmployeeIds: {
          oneOf: [
            { type: "array", items: { type: "number" } },
            { type: "string", enum: ["all"] }
          ],
          description: "Array de IDs de empleados o 'all' para asignar a todos. Usa assignToEmployeeNames si el usuario menciona nombres",
        },
        enableNotifications: {
          type: "boolean",
          description: "Si se deben enviar notificaciones push. true por defecto",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "createEmployee",
    description: "Crear un nuevo empleado en la empresa",
    parameters: {
      type: "object",
      properties: {
        fullName: {
          type: "string",
          description: "Nombre completo del empleado",
        },
        email: {
          type: "string",
          description: "Email personal del empleado",
        },
        dni: {
          type: "string",
          description: "DNI o documento de identidad",
        },
        position: {
          type: "string",
          description: "Cargo o posición en la empresa",
        },
        phoneNumber: {
          type: "string",
          description: "Número de teléfono",
        },
        startDate: {
          type: "string",
          description: "Fecha de incorporación en formato ISO (YYYY-MM-DD)",
        },
        role: {
          type: "string",
          enum: ["admin", "manager", "employee"],
          description: "Rol del empleado. Por defecto 'employee'. Se validará capacidad del plan antes de crear",
        },
      },
      required: ["fullName", "email", "dni"],
    },
  },
  {
    name: "updateEmployee",
    description: "Modificar datos de un empleado existente. Usa listEmployees() primero para obtener el ID del empleado. Permite modificar información corporativa, personal y días de vacaciones extra",
    parameters: {
      type: "object",
      properties: {
        employeeId: {
          type: "number",
          description: "ID del empleado a modificar (obtener de listEmployees)",
        },
        companyEmail: {
          type: "string",
          description: "Email corporativo del empleado",
        },
        companyPhone: {
          type: "string",
          description: "Teléfono corporativo",
        },
        position: {
          type: "string",
          description: "Cargo o puesto de trabajo",
        },
        startDate: {
          type: "string",
          description: "Fecha de incorporación en formato YYYY-MM-DD",
        },
        status: {
          type: "string",
          enum: ["active", "inactive", "leave", "vacation"],
          description: "Estado del empleado: active (activo), inactive (inactivo), leave (de baja), vacation (de vacaciones)",
        },
        role: {
          type: "string",
          enum: ["admin", "manager", "employee"],
          description: "Rol del empleado en el sistema",
        },
        personalEmail: {
          type: "string",
          description: "Email personal del empleado",
        },
        personalPhone: {
          type: "string",
          description: "Teléfono personal",
        },
        address: {
          type: "string",
          description: "Dirección postal completa",
        },
        emergencyContactName: {
          type: "string",
          description: "Nombre de la persona de contacto de emergencia",
        },
        emergencyContactPhone: {
          type: "string",
          description: "Teléfono de contacto de emergencia",
        },
        vacationDaysAdjustment: {
          type: "number",
          description: "Días de vacaciones extra para añadir (+) o restar (-). Ej: 5 = añadir 5 días, -3 = restar 3 días. Estos días se suman al total automático de vacaciones",
        },
      },
      required: ["employeeId"],
    },
  },
  {
    name: "generateTimeReport",
    description: "Generar informe de horas de trabajo/fichajes en PDF o Excel. Permite filtrar por empleado y período de tiempo (hoy, esta semana, mes pasado, año completo, etc.)",
    parameters: {
      type: "object",
      properties: {
        employeeName: {
          type: "string",
          description: "Nombre del empleado (opcional). Si no se especifica, genera informe de todos los empleados",
        },
        period: {
          type: "string",
          enum: ["today", "this_week", "this_month", "last_week", "last_month", "this_year", "last_year", "all", "custom"],
          description: "Período de tiempo: today (hoy), this_week (esta semana), this_month (este mes), last_week (semana pasada), last_month (mes pasado), this_year (este año), last_year (año pasado), all (todos los fichajes), custom (rango personalizado con startDate/endDate)",
        },
        startDate: {
          type: "string",
          description: "Fecha de inicio para período 'custom' en formato YYYY-MM-DD",
        },
        endDate: {
          type: "string",
          description: "Fecha de fin para período 'custom' en formato YYYY-MM-DD",
        },
        format: {
          type: "string",
          enum: ["pdf", "excel"],
          description: "Formato del informe: pdf (por defecto) o excel",
        },
      },
      required: ["period"],
    },
  },
  {
    name: "assignSchedule",
    description: "Asignar UN SOLO turno a un empleado (una fecha específica). IMPORTANTE: Usa el nombre del empleado (employeeName) cuando el usuario lo mencione en el mensaje",
    parameters: {
      type: "object",
      properties: {
        employeeName: {
          type: "string",
          description: "Nombre del empleado (usa esto cuando el usuario menciona un nombre)",
        },
        title: {
          type: "string",
          description: "Nombre del turno (ej: 'Turno mañana', 'Guardia')",
        },
        startDate: {
          type: "string",
          description: "Fecha y hora de inicio en formato ISO",
        },
        endDate: {
          type: "string",
          description: "Fecha y hora de fin en formato ISO",
        },
        location: {
          type: "string",
          description: "Ubicación del turno",
        },
        notes: {
          type: "string",
          description: "Notas adicionales sobre el turno",
        },
        color: {
          type: "string",
          description: "Color hexadecimal para el turno (ej: '#3b82f6')",
        },
      },
      required: ["employeeName", "title", "startDate", "endDate"],
    },
  },
  {
    name: "assignRotatingSchedule",
    description: "🔄 TURNOS ROTATIVOS con patrón de X días trabajo, Y días descanso. OBLIGATORIO usar cuando el usuario mencione: '3 días trabajo 3 días descanso', '4 días sí 2 días no', 'rotación de X días', 'trabaja N días y descansa M días'. El patrón se repite automáticamente hasta la fecha fin.",
    parameters: {
      type: "object",
      properties: {
        employeeName: {
          type: "string",
          description: "Nombre del empleado",
        },
        title: {
          type: "string",
          description: "Nombre del turno (ej: 'Turno 08:00-14:00')",
        },
        startDate: {
          type: "string",
          description: "Primer día de trabajo en formato YYYY-MM-DD",
        },
        endDate: {
          type: "string",
          description: "Último día posible de trabajo en formato YYYY-MM-DD",
        },
        startTime: {
          type: "string",
          description: "Hora de inicio en formato HH:mm (ej: '08:00')",
        },
        endTime: {
          type: "string",
          description: "Hora de fin en formato HH:mm (ej: '14:00')",
        },
        workDays: {
          type: "number",
          description: "Número de días CONSECUTIVOS de TRABAJO (ej: 3 para '3 días trabajo')",
        },
        restDays: {
          type: "number",
          description: "Número de días CONSECUTIVOS de DESCANSO (ej: 3 para '3 días descanso')",
        },
        location: {
          type: "string",
          description: "Ubicación del turno (opcional)",
        },
      },
      required: ["employeeName", "title", "startDate", "endDate", "startTime", "endTime", "workDays", "restDays"],
    },
  },
  {
    name: "assignScheduleInRange",
    description: "🗓️ CREAR TURNOS MASIVOS para SEMANAS/MESES completos (todos los días laborables). Usa esto cuando el usuario pida 'crear turnos toda la semana', 'asignar horario del 1 al 30', 'turnos de todo noviembre'. NO usar para patrones rotativos.",
    parameters: {
      type: "object",
      properties: {
        employeeName: {
          type: "string",
          description: "Nombre del empleado",
        },
        title: {
          type: "string",
          description: "Nombre del turno (ej: 'Turno 08:00-14:00', 'Mañana')",
        },
        startDate: {
          type: "string",
          description: "Fecha de inicio en formato YYYY-MM-DD",
        },
        endDate: {
          type: "string",
          description: "Fecha de fin en formato YYYY-MM-DD",
        },
        startTime: {
          type: "string",
          description: "Hora de inicio en formato HH:mm (ej: '08:00', '09:30')",
        },
        endTime: {
          type: "string",
          description: "Hora de fin en formato HH:mm (ej: '14:00', '17:00')",
        },
        location: {
          type: "string",
          description: "Ubicación del turno (opcional)",
        },
        notes: {
          type: "string",
          description: "Notas adicionales (opcional)",
        },
        color: {
          type: "string",
          description: "Color hexadecimal (opcional, se asigna automáticamente)",
        },
        skipWeekends: {
          type: "boolean",
          description: "Saltar sábados y domingos (default: true). Usar false si el usuario quiere incluir fines de semana",
        },
      },
      required: ["employeeName", "title", "startDate", "endDate", "startTime", "endTime"],
    },
  },
  {
    name: "requestDocument",
    description: "Solicitar un documento específico a un empleado. IMPORTANTE: Usa el nombre del empleado (employeeName) cuando el usuario lo mencione en el mensaje",
    parameters: {
      type: "object",
      properties: {
        employeeName: {
          type: "string",
          description: "Nombre del empleado (usa esto cuando el usuario menciona un nombre)",
        },
        fileName: {
          type: "string",
          description: "Nombre del documento solicitado",
        },
        description: {
          type: "string",
          description: "Descripción o instrucciones adicionales sobre el documento",
        },
      },
      required: ["employeeName", "fileName"],
    },
  },
  {
    name: "deleteWorkShift",
    description: "Eliminar turno(s) de trabajo de un empleado en una fecha específica. IMPORTANTE: Usa el nombre del empleado (employeeName) cuando el usuario lo mencione",
    parameters: {
      type: "object",
      properties: {
        employeeName: {
          type: "string",
          description: "Nombre del empleado (usa esto cuando el usuario menciona un nombre)",
        },
        date: {
          type: "string",
          description: "Fecha del turno a eliminar en formato YYYY-MM-DD. Para fechas relativas: 'hoy' = fecha actual, 'mañana' = día siguiente",
        },
      },
      required: ["employeeName", "date"],
    },
  },
  {
    name: "deleteWorkShiftsInRange",
    description: "🗑️ Eliminar TODOS los turnos en un rango de fechas. Úsalo cuando el usuario pida borrar 'todos los turnos de la semana', 'borrar turnos del lunes al viernes', etc. Puede borrar turnos de UN empleado específico o de TODOS los empleados si no se especifica employeeName",
    parameters: {
      type: "object",
      properties: {
        employeeName: {
          type: "string",
          description: "Nombre del empleado (OPCIONAL - si no se proporciona, borra turnos de TODOS los empleados)",
        },
        startDate: {
          type: "string",
          description: "Fecha de inicio en formato YYYY-MM-DD",
        },
        endDate: {
          type: "string",
          description: "Fecha de fin en formato YYYY-MM-DD",
        },
      },
      required: ["startDate", "endDate"],
    },
  },
  {
    name: "updateWorkShiftTimes",
    description: "Modificar las horas de UN turno específico (una fecha). Úsalo cuando el admin quiera modificar el horario de un día concreto",
    parameters: {
      type: "object",
      properties: {
        employeeName: {
          type: "string",
          description: "Nombre del empleado",
        },
        date: {
          type: "string",
          description: "Fecha del turno en formato YYYY-MM-DD",
        },
        newStartTime: {
          type: "string",
          description: "Nueva hora de inicio en formato HH:mm (24h), ej: '09:00'",
        },
        newEndTime: {
          type: "string",
          description: "Nueva hora de fin en formato HH:mm (24h), ej: '17:00'",
        },
        shiftTitle: {
          type: "string",
          description: "Título del turno (opcional, para identificar cuál si hay varios ese día)",
        },
      },
      required: ["employeeName", "date"],
    },
  },
  {
    name: "updateWorkShiftsInRange",
    description: "🗓️ MODIFICAR HORARIOS MASIVOS en RANGO de fechas. Usa esto cuando el admin quiera cambiar las horas de TODA la semana/mes/periodo. Ejemplo: 'cambia todos los turnos de la semana de 8-14 a 9-15'",
    parameters: {
      type: "object",
      properties: {
        employeeName: {
          type: "string",
          description: "Nombre del empleado",
        },
        startDate: {
          type: "string",
          description: "Fecha de inicio del rango en formato YYYY-MM-DD",
        },
        endDate: {
          type: "string",
          description: "Fecha de fin del rango en formato YYYY-MM-DD",
        },
        newStartTime: {
          type: "string",
          description: "Nueva hora de inicio en formato HH:mm (ej: '09:00')",
        },
        newEndTime: {
          type: "string",
          description: "Nueva hora de fin en formato HH:mm (ej: '17:00')",
        },
        shiftTitle: {
          type: "string",
          description: "Opcional: filtrar por título de turno",
        },
      },
      required: ["employeeName", "startDate", "endDate"],
    },
  },
  {
    name: "detectWorkShiftOverlaps",
    description: "Detectar solapamientos de turnos (cuando un empleado tiene turnos que se superponen en tiempo). Útil para identificar conflictos",
    parameters: {
      type: "object",
      properties: {
        employeeName: {
          type: "string",
          description: "Nombre del empleado (opcional, si no se proporciona revisa todos)",
        },
        startDate: {
          type: "string",
          description: "Fecha de inicio del rango a revisar (opcional)",
        },
        endDate: {
          type: "string",
          description: "Fecha de fin del rango a revisar (opcional)",
        },
      },
      required: [],
    },
  },
  {
    name: "updateEmployeeShiftsColor",
    description: "Cambiar el color de TODOS los turnos de un empleado en un rango de fechas. Usa esta función cuando quieras cambiar colores sin especificar turnos individuales",
    parameters: {
      type: "object",
      properties: {
        employeeName: {
          type: "string",
          description: "Nombre del empleado",
        },
        startDate: {
          type: "string",
          description: "Fecha de inicio en formato YYYY-MM-DD",
        },
        endDate: {
          type: "string",
          description: "Fecha de fin en formato YYYY-MM-DD",
        },
        newColor: {
          type: "string",
          description: "Nuevo color en formato hexadecimal (ej: '#3b82f6' para azul, '#ef4444' para rojo, '#10b981' para verde, '#f59e0b' para naranja, '#8b5cf6' para morado)",
        },
      },
      required: ["employeeName", "startDate", "endDate", "newColor"],
    },
  },
  {
    name: "updateWorkShiftColor",
    description: "Cambiar el color de un turno existente. Útil para organización visual del cuadrante",
    parameters: {
      type: "object",
      properties: {
        employeeName: {
          type: "string",
          description: "Nombre del empleado",
        },
        date: {
          type: "string",
          description: "Fecha del turno en formato YYYY-MM-DD",
        },
        newColor: {
          type: "string",
          description: "Nuevo color en formato hexadecimal (ej: '#3b82f6' para azul, '#ef4444' para rojo, '#10b981' para verde)",
        },
        shiftTitle: {
          type: "string",
          description: "Título del turno (opcional, para identificar cuál si hay varios ese día)",
        },
      },
      required: ["employeeName", "date", "newColor"],
    },
  },
  {
    name: "updateWorkShiftDetails",
    description: "Modificar detalles de un turno (título, ubicación, notas). Útil cuando el admin quiere cambiar el nombre del turno o añadir información",
    parameters: {
      type: "object",
      properties: {
        employeeName: {
          type: "string",
          description: "Nombre del empleado",
        },
        date: {
          type: "string",
          description: "Fecha del turno en formato YYYY-MM-DD",
        },
        newTitle: {
          type: "string",
          description: "Nuevo título del turno (ej: 'Turno en Cliente XYZ', 'Guardia nocturna')",
        },
        newLocation: {
          type: "string",
          description: "Nueva ubicación del turno",
        },
        newNotes: {
          type: "string",
          description: "Nuevas notas del turno",
        },
        shiftTitle: {
          type: "string",
          description: "Título actual del turno para identificarlo",
        },
      },
      required: ["employeeName", "date"],
    },
  },
  {
    name: "swapEmployeeShifts",
    description: "Intercambiar todos los turnos entre dos empleados en un rango de fechas (o todos si no se especifica). Los turnos de A pasan a B, y los de B pasan a A. Útil para 'intercambiar turnos', 'cambiar cuadrantes', etc.",
    parameters: {
      type: "object",
      properties: {
        employeeAName: {
          type: "string",
          description: "Nombre del primer empleado",
        },
        employeeBName: {
          type: "string",
          description: "Nombre del segundo empleado",
        },
        startDate: {
          type: "string",
          description: "Fecha de inicio del rango (opcional, formato YYYY-MM-DD). Si no se especifica, intercambia TODOS los turnos",
        },
        endDate: {
          type: "string",
          description: "Fecha de fin del rango (opcional, formato YYYY-MM-DD)",
        },
      },
      required: ["employeeAName", "employeeBName"],
    },
  },
  {
    name: "copyEmployeeShifts",
    description: "🔄 COPIAR/DUPLICAR turnos existentes de un empleado a otro. USA ESTA FUNCIÓN cuando el usuario diga: 'X tiene el mismo turno/horario que Y', 'X trabaja igual que Y', 'copia los turnos de Y a X', 'asigna a X los mismos turnos que Y', 'duplica los turnos'. IMPORTANTE: Esta función crea COPIAS de turnos YA EXISTENTES, NO crea turnos nuevos desde cero.",
    parameters: {
      type: "object",
      properties: {
        fromEmployeeName: {
          type: "string",
          description: "Nombre del empleado origen (de quien se copian los turnos)",
        },
        toEmployeeName: {
          type: "string",
          description: "Nombre del empleado destino (quien recibe las copias)",
        },
        startDate: {
          type: "string",
          description: "Fecha de inicio del rango (opcional, formato YYYY-MM-DD). Si no se especifica, copia TODOS los turnos",
        },
        endDate: {
          type: "string",
          description: "Fecha de fin del rango (opcional, formato YYYY-MM-DD)",
        },
      },
      required: ["fromEmployeeName", "toEmployeeName"],
    },
  },
  {
    name: "navigateToPage",
    description: "🧭 NAVEGAR a una página específica de la aplicación. USA ESTA FUNCIÓN cuando el usuario pregunte sobre solicitudes pendientes, vacaciones, fichajes, cuadrantes, CRM, contabilidad, etc. y necesite ver la página correspondiente. Por ejemplo: '¿qué solicitudes de vacaciones hay pendientes?' → navegar a vacaciones con filtro pendiente. '¿quién está fichado hoy?' → navegar a fichajes. La función lleva al usuario directamente a la página con los filtros aplicados.",
    parameters: {
      type: "object",
      properties: {
        page: {
          type: "string",
          enum: ["dashboard", "vacation-requests", "vacation-calendar", "time-tracking", "schedules", "employees", "documents", "reminders", "messages", "work-reports", "settings", "settings-policies", "settings-notifications", "profile", "crm", "crm-contacts", "crm-pipeline", "accounting", "projects"],
          description: "Página a la que navegar: dashboard (inicio), vacation-requests (solicitudes vacaciones), vacation-calendar (calendario vacaciones), time-tracking (fichajes), schedules (cuadrantes), employees (empleados), documents (documentos), reminders (recordatorios), messages (mensajes), work-reports (partes de trabajo), settings (configuración), settings-policies (políticas), settings-notifications (notificaciones), profile (perfil), crm (CRM general), crm-contacts (contactos clientes/proveedores), crm-pipeline (embudo captación), accounting (contabilidad), projects (proyectos)",
        },
        filter: {
          type: "string",
          enum: ["pending", "approved", "denied", "all"],
          description: "Filtro a aplicar: pending (pendientes), approved (aprobadas), denied (denegadas), all (todas)",
        },
        employeeName: {
          type: "string",
          description: "Nombre del empleado para filtrar (opcional, se resuelve automáticamente)",
        },
        startDate: {
          type: "string",
          description: "Fecha inicio YYYY-MM-DD para filtrar fichajes o partes (opcional)",
        },
        endDate: {
          type: "string",
          description: "Fecha fin YYYY-MM-DD para filtrar fichajes o partes (opcional)",
        },
      },
      required: ["page"],
    },
  },
  // ========================================
  // 🆕 NUEVAS HERRAMIENTAS — Control total de la app
  // ========================================
  {
    name: "getActiveWorkers",
    description: "⏱️ CONSULTA quién está fichado ahora mismo. Devuelve empleados con fichaje activo y su hora de entrada. Usa para: '¿quién está trabajando ahora?', '¿quién está fichado?', 'trabajadores en activo', 'quién está en la oficina'.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "listCRMContacts",
    description: "📇 CONSULTA la lista de contactos del CRM (clientes y proveedores). Usa para: '¿qué clientes tenemos?', 'lista de proveedores', 'busca contacto X', 'clientes CRM', '¿cuántos clientes hay?'.",
    parameters: {
      type: "object",
      properties: {
        role: { type: "string", enum: ["client", "provider"], description: "Filtrar por tipo: client (clientes) / provider (proveedores)" },
        search: { type: "string", description: "Buscar por nombre" },
        limit: { type: "number", description: "Máximo de resultados (default: 20)" },
      },
      required: [],
    },
  },
  {
    name: "createCRMContact",
    description: "➕ CREAR un nuevo contacto en el CRM. Usa para: 'añade el cliente X', 'crea el proveedor Y', 'nuevo cliente', 'agregar contact'. SIEMPRE pregunta el nombre y si es cliente o proveedor antes de crear.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nombre o razón social del contacto" },
        role: { type: "string", enum: ["client", "provider"], description: "Tipo: client (cliente) o provider (proveedor)" },
        email: { type: "string", description: "Email (opcional)" },
        phone: { type: "string", description: "Teléfono (opcional)" },
        city: { type: "string", description: "Ciudad (opcional)" },
        taxId: { type: "string", description: "CIF/NIF (opcional)" },
        notes: { type: "string", description: "Notas internas (opcional)" },
      },
      required: ["name", "role"],
    },
  },
  {
    name: "addCRMInteraction",
    description: "💬 REGISTRAR una interacción o nota en el historial de un contacto CRM. Usa para: 'anota que llamé a X', 'registra reunión con Y', 'añade nota al cliente Z', 'deja constancia de la llamada'. Primero obtén el ID del contacto con listCRMContacts.",
    parameters: {
      type: "object",
      properties: {
        contactId: { type: "number", description: "ID del contacto (obtener con listCRMContacts)" },
        interactionType: { type: "string", enum: ["call", "email", "whatsapp", "meeting", "note"], description: "Tipo: call (llamada), email, whatsapp, meeting (reunión), note (nota)" },
        subject: { type: "string", description: "Asunto de la interacción (opcional)" },
        notes: { type: "string", description: "Descripción detallada de la interacción" },
        result: { type: "string", enum: ["interested", "not_interested", "pending", "won", "lost"], description: "Resultado (opcional)" },
      },
      required: ["contactId", "interactionType", "notes"],
    },
  },
  {
    name: "listWorkReports",
    description: "📋 CONSULTA los partes de trabajo. Usa para: '¿qué partes hay?', 'partes de trabajo de X', 'partes de esta semana', 'últimos partes enviados', 'resumen de partes'.",
    parameters: {
      type: "object",
      properties: {
        employeeName: { type: "string", description: "Nombre del empleado para filtrar (opcional)" },
        startDate: { type: "string", description: "Fecha inicio YYYY-MM-DD (opcional)" },
        endDate: { type: "string", description: "Fecha fin YYYY-MM-DD (opcional)" },
        limit: { type: "number", description: "Máximo de resultados (default: 20)" },
      },
      required: [],
    },
  },
  {
    name: "createWorkReport",
    description: "📝 CREAR un parte de trabajo para un empleado. Usa para: 'crea un parte para X', 'añade parte de trabajo', 'registra el parte del día'. Requiere: empleado, fecha, lugar, horario y descripción del trabajo.",
    parameters: {
      type: "object",
      properties: {
        employeeName: { type: "string", description: "Nombre del empleado" },
        reportDate: { type: "string", description: "Fecha del trabajo en formato YYYY-MM-DD" },
        location: { type: "string", description: "Lugar donde se realizó el trabajo" },
        startTime: { type: "string", description: "Hora de inicio en formato HH:mm (ej: '08:00')" },
        endTime: { type: "string", description: "Hora de fin en formato HH:mm (ej: '16:00')" },
        description: { type: "string", description: "Descripción detallada del trabajo realizado" },
        clientName: { type: "string", description: "Nombre del cliente (opcional)" },
        refCode: { type: "string", description: "Código de obra o referencia (opcional)" },
        notes: { type: "string", description: "Notas adicionales (opcional)" },
      },
      required: ["employeeName", "reportDate", "location", "startTime", "endTime", "description"],
    },
  },
  {
    name: "createVacationRequest",
    description: "🏖️ CREAR una ausencia/vacaciones para un empleado (queda automáticamente aprobada). Usa cuando el admin quiera registrar directamente ausencias: 'pon vacaciones a X del D1 al D2', 'registra que X está de baja', 'añade ausencia para Y'. NO usar para aprobar solicitudes existentes (usa approveVacationRequests).",
    parameters: {
      type: "object",
      properties: {
        employeeName: { type: "string", description: "Nombre del empleado" },
        startDate: { type: "string", description: "Fecha de inicio en formato YYYY-MM-DD" },
        endDate: { type: "string", description: "Fecha de fin en formato YYYY-MM-DD" },
        reason: { type: "string", description: "Motivo (opcional)" },
        type: { type: "string", enum: ["vacation", "sick_leave", "personal_leave"], description: "Tipo: vacation (vacaciones), sick_leave (baja médica), personal_leave (asunto personal). Default: vacation" },
      },
      required: ["employeeName", "startDate", "endDate"],
    },
  },
  {
    name: "getAccountingSummary",
    description: "💰 CONSULTA el resumen de ingresos y gastos de contabilidad. Usa para: '¿cómo vamos de gastos?', '¿cuánto hemos facturado?', 'balance contable', 'ingresos y gastos del mes', 'resumen financiero', '¿cuánto hemos gastado este mes?'.",
    parameters: {
      type: "object",
      properties: {
        period: { type: "string", enum: ["this_month", "last_month", "this_year", "last_year", "custom"], description: "Período: this_month (este mes), last_month (mes pasado), this_year (este año), last_year (año pasado)" },
        startDate: { type: "string", description: "Fecha inicio YYYY-MM-DD (solo si period='custom')" },
        endDate: { type: "string", description: "Fecha fin YYYY-MM-DD (solo si period='custom')" },
      },
      required: [],
    },
  },

];

// Execute AI function by name
export async function executeAIFunction(
  functionName: string,
  params: any,
  context: AIFunctionContext
): Promise<any> {
  switch (functionName) {
    // Query functions
    case "listEmployees":
      return listEmployees(context, params);
    case "getEmployeeShifts":
      return getEmployeeShifts(context, params);
    case "getCompanyContext":
      return getCompanyContext(context);
    case "getEmployeeWorkHours":
      return getEmployeeWorkHours(context, params);
    case "getCompanySettings":
      return getCompanySettings(context);
    case "getVacationBalance":
      return getVacationBalance(context, params);
    case "getPendingApprovals":
      return getPendingApprovals(context);
    // Action functions
    case "sendMessage":
      return sendMessage(context, params);
    case "approveTimeModificationRequests":
      return approveTimeModificationRequests(context, params);
    case "approveVacationRequests":
      return approveVacationRequests(context, params);
    case "denyVacationRequests":
      return denyVacationRequests(context, params);
    case "updateCompanySettings":
      return updateCompanySettings(context, params);
    case "createReminder":
      return createReminder(context, params);
    case "createEmployee":
      return createEmployee(context, params);
    case "updateEmployee":
      return updateEmployee(context, params);
    case "generateTimeReport":
      return generateTimeReport(context, params);
    case "assignSchedule":
      return assignSchedule(context, params);
    case "assignScheduleInRange":
      return assignScheduleInRange(context, params);
    case "assignRotatingSchedule":
      return assignRotatingSchedule(context, params);
    case "requestDocument":
      return requestDocument(context, params);
    case "deleteWorkShift":
      return deleteWorkShift(context, params);
    case "deleteWorkShiftsInRange":
      return deleteWorkShiftsInRange(context, params);
    case "updateWorkShiftTimes":
      return updateWorkShiftTimes(context, params);
    case "updateWorkShiftsInRange":
      return updateWorkShiftsInRange(context, params);
    case "detectWorkShiftOverlaps":
      return detectWorkShiftOverlaps(context, params);
    case "updateEmployeeShiftsColor":
      return updateEmployeeShiftsColor(context, params);
    case "updateWorkShiftColor":
      return updateWorkShiftColor(context, params);
    case "updateWorkShiftDetails":
      return updateWorkShiftDetails(context, params);
    case "swapEmployeeShifts":
      return swapEmployeeShifts(context, params);
    case "copyEmployeeShifts":
      return copyEmployeeShifts(context, params);
    case "navigateToPage":
      return navigateToPage(context, params);
    // ========================================
    // 🆕 NUEVAS HERRAMIENTAS
    // ========================================
    case "getActiveWorkers":
      return getActiveWorkers(context);
    case "listCRMContacts":
      return listCRMContacts(context, params);
    case "createCRMContact":
      return createCRMContact(context, params);
    case "addCRMInteraction":
      return addCRMInteraction(context, params);
    case "listWorkReports":
      return listWorkReports(context, params);
    case "createWorkReport":
      return createWorkReport(context, params);
    case "createVacationRequest":
      return createVacationRequest(context, params);
    case "getAccountingSummary":
      return getAccountingSummary(context, params);
    default:
      throw new Error(`Unknown function: ${functionName}`);
  }
}
