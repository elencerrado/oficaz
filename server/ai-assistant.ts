import { eq, and, inArray } from "drizzle-orm";
import * as schema from "@shared/schema";
import type { DrizzleStorage } from "./storage.js";
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

// ========================================
// 📖 READ-ONLY FUNCTIONS (Query/Consult)
// ========================================
// These functions allow the AI to gather context before acting

// QUERY 1: List all employees in the company
export async function listEmployees(
  context: AIFunctionContext,
  params?: {
    role?: string; // Optional: filter by role (admin/employee)
    includeInactive?: boolean; // Optional: include inactive employees
  }
) {
  const { storage, companyId } = context;
  
  const allEmployees = await storage.getUsersByCompany(companyId);
  
  let filteredEmployees = allEmployees;
  
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
      email: emp.email,
      role: emp.role,
      department: emp.department || "Sin departamento"
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

// ========================================
// ✏️ MUTATION FUNCTIONS (Actions)
// ========================================

// Helper function to normalize strings for accent-insensitive comparison
function normalizeForComparison(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
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
  
  // Search for employees with matching names (case-insensitive, accent-insensitive, partial match)
  const normalizedSearch = normalizeForComparison(employeeName);
  const matches = allEmployees.filter(emp => 
    normalizeForComparison(emp.fullName).includes(normalizedSearch)
  );
  
  if (matches.length === 0) {
    return { error: `No encontré ningún empleado con el nombre "${employeeName}". Por favor, verifica el nombre e intenta de nuevo.` };
  }
  
  if (matches.length === 1) {
    return { employeeId: matches[0].id };
  }
  
  // Multiple matches - return error with list
  const matchNames = matches.map(emp => emp.fullName).join(", ");
  return { 
    error: `Encontré varios empleados con ese nombre: ${matchNames}. Por favor, especifica el nombre completo exacto.` 
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
      console.error("Error sending push notification:", error);
    }
  }

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

  return {
    success: true,
    approvedCount: results.length,
    requestIds: targetRequestIds,
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
        console.error("Error sending vacation notification:", error);
      }
    }
    
    results.push(updated);
  }

  return {
    success: true,
    approvedCount: results.length,
    requestIds: targetRequestIds,
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
    position?: string;
    phoneNumber?: string;
    startDate?: string;
  }
) {
  const { storage, companyId, adminUserId } = context;

  // Get company to use company alias for email
  const company = await db.select()
    .from(schema.companies)
    .where(eq(schema.companies.id, companyId))
    .limit(1);

  if (!company || company.length === 0) {
    throw new Error("Company not found");
  }

  const companyAlias = company[0].companyAlias;
  const companyEmail = `${params.email.split("@")[0]}@${companyAlias}.oficaz.app`;

  // Create employee with default password
  const employee = await storage.createUser({
    companyId,
    personalEmail: params.email,
    companyEmail,
    password: "DefaultPass123!", // Will need to be changed on first login
    fullName: params.fullName,
    dni: params.dni,
    role: "employee",
    position: params.position || "Empleado",
    personalPhone: params.phoneNumber || null,
    startDate: params.startDate ? new Date(params.startDate) : new Date(),
    isActive: true,
  });

  return {
    success: true,
    employee: {
      id: employee.id,
      fullName: employee.fullName,
      personalEmail: employee.personalEmail,
      companyEmail: employee.companyEmail,
      position: employee.position,
    },
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

  return {
    success: true,
    shift: shift[0],
    employeeFullName: employee.fullName,
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
    console.error("Error sending push notification:", error);
  }

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

  return {
    success: true,
    deletedCount: shiftsToDelete.length,
    employeeFullName: employee.fullName,
    date: targetDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
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

  console.log("🎨 UPDATE COLOR DEBUG:", {
    employeeName: employee.fullName,
    date: params.date,
    newColor: params.newColor,
    shiftTitle: params.shiftTitle,
    startOfDay: startOfDay.toISOString(),
    endOfDay: endOfDay.toISOString()
  });

  const shifts = await db.select()
    .from(schema.workShifts)
    .where(
      and(
        eq(schema.workShifts.companyId, companyId),
        eq(schema.workShifts.employeeId, params.employeeId)
      )
    );

  console.log("🎨 All employee shifts:", shifts.map(s => ({
    id: s.id,
    title: s.title,
    startAt: new Date(s.startAt).toISOString(),
    endAt: new Date(s.endAt).toISOString(),
    color: s.color
  })));

  let shiftsOnDate = shifts.filter((shift: any) => {
    const shiftStart = new Date(shift.startAt);
    const shiftEnd = new Date(shift.endAt);
    return shiftStart <= endOfDay && shiftEnd >= startOfDay;
  });

  console.log("🎨 Shifts on target date:", shiftsOnDate.length);

  if (params.shiftTitle) {
    shiftsOnDate = shiftsOnDate.filter((shift: any) => 
      shift.title?.toLowerCase().includes(params.shiftTitle!.toLowerCase())
    );
    console.log("🎨 Shifts after title filter:", shiftsOnDate.length);
  }

  if (shiftsOnDate.length === 0) {
    return {
      success: false,
      error: `No encontré turnos para ${employee.fullName} el ${targetDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}`,
      employeeFullName: employee.fullName
    };
  }

  // Update color for all matching shifts
  console.log("🎨 Updating color for shifts:", shiftsOnDate.map(s => s.id));
  for (const shift of shiftsOnDate) {
    await storage.updateWorkShift(shift.id, { color: params.newColor });
  }
  console.log("🎨 Color updated successfully");

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

  return {
    success: true,
    employeeFullName: employee.fullName,
    updatedFields: Object.keys(updates),
    shiftTitle: updates.title || shift.title
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

// Function definitions for OpenAI function calling
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
  // ========================================
  // ✏️ MUTATION FUNCTIONS (Actions - use after consulting)
  // ========================================
  {
    name: "sendMessage",
    description: "Enviar un mensaje o circular a uno o varios empleados de la empresa",
    parameters: {
      type: "object",
      properties: {
        employeeIds: {
          oneOf: [
            { type: "array", items: { type: "number" } },
            { type: "string", enum: ["all"] }
          ],
          description: "Array de IDs de empleados o 'all' para enviar a todos los empleados",
        },
        subject: {
          type: "string",
          description: "Asunto del mensaje",
        },
        content: {
          type: "string",
          description: "Contenido del mensaje",
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
    name: "createReminder",
    description: "Crear un recordatorio, opcionalmente asignarlo a empleados específicos",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Título del recordatorio",
        },
        content: {
          type: "string",
          description: "Descripción o contenido del recordatorio",
        },
        reminderDate: {
          type: "string",
          description: "Fecha del recordatorio en formato ISO (YYYY-MM-DD o YYYY-MM-DDTHH:mm:ss)",
        },
        priority: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Prioridad del recordatorio",
        },
        assignToEmployeeIds: {
          oneOf: [
            { type: "array", items: { type: "number" } },
            { type: "string", enum: ["all"] }
          ],
          description: "Array de IDs de empleados o 'all' para asignar a todos",
        },
        enableNotifications: {
          type: "boolean",
          description: "Si se deben enviar notificaciones push para este recordatorio",
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
      },
      required: ["fullName", "email", "dni"],
    },
  },
  {
    name: "assignSchedule",
    description: "Asignar un turno o cuadrante de horario a un empleado. IMPORTANTE: Usa el nombre del empleado (employeeName) cuando el usuario lo mencione en el mensaje",
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
    name: "updateWorkShiftTimes",
    description: "Modificar las horas de un turno existente (cambiar hora de inicio o fin). Úsalo cuando el admin quiera modificar horarios a posteriori",
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
    description: "Cambiar el color de un turno existente. Útil para organizaci��n visual del cuadrante",
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
    description: "Copiar turnos de un empleado a otro en un rango de fechas. El empleado destino recibirá copias de los turnos del empleado origen. Útil para 'copiar turnos', 'asignar los mismos turnos que', etc.",
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
    // Action functions
    case "sendMessage":
      return sendMessage(context, params);
    case "approveTimeModificationRequests":
      return approveTimeModificationRequests(context, params);
    case "approveVacationRequests":
      return approveVacationRequests(context, params);
    case "createReminder":
      return createReminder(context, params);
    case "createEmployee":
      return createEmployee(context, params);
    case "assignSchedule":
      return assignSchedule(context, params);
    case "requestDocument":
      return requestDocument(context, params);
    case "deleteWorkShift":
      return deleteWorkShift(context, params);
    case "updateWorkShiftTimes":
      return updateWorkShiftTimes(context, params);
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
    default:
      throw new Error(`Unknown function: ${functionName}`);
  }
}
