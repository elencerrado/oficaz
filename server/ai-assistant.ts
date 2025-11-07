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

export interface AIFunctionContext {
  storage: DrizzleStorage;
  companyId: number;
  adminUserId: number;
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

  // Create work shift
  const shift = await db.insert(schema.workShifts)
    .values({
      companyId,
      employeeId: params.employeeId,
      startAt: new Date(params.startDate),
      endAt: new Date(params.endDate),
      title: params.title,
      location: params.location || null,
      notes: params.notes || null,
      color: params.color || "#3b82f6",
      createdByUserId: adminUserId,
    })
    .returning();

  return {
    success: true,
    shift: shift[0],
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

// Function definitions for OpenAI function calling
export const AI_FUNCTIONS = [
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
    description: "Asignar un turno o cuadrante de horario a un empleado",
    parameters: {
      type: "object",
      properties: {
        employeeId: {
          type: "number",
          description: "ID del empleado",
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
      required: ["employeeId", "title", "startDate", "endDate"],
    },
  },
  {
    name: "requestDocument",
    description: "Solicitar un documento específico a un empleado",
    parameters: {
      type: "object",
      properties: {
        employeeId: {
          type: "number",
          description: "ID del empleado",
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
      required: ["employeeId", "fileName"],
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
    default:
      throw new Error(`Unknown function: ${functionName}`);
  }
}
