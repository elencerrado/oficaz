/**
 * Improved AI Confirmation Modal Integration
 * This file provides helper functions to create rich confirmation dialogs
 * for critical AI actions (approve vacations, create schedules, delete employees, etc.)
 */

import { AlertCircle, CheckCircle, Calendar, Users, Trash2, BarChart3, Clock } from "lucide-react";

export interface ConfirmationItem {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  highlight?: boolean; // Highlight important values
}

export interface AIConfirmation {
  title: string;
  description?: string;
  icon: "warning" | "check" | "info";
  items: ConfirmationItem[];
  confirmText?: string;
  cancelText?: string;
}

/**
 * Build a confirmation for vacation approvals
 * Example: "Aprobación de vacaciones" with list of employees and dates
 */
export function buildVacationApprovalConfirmation(count: number, details: Array<{name: string; dates: string}> = []): AIConfirmation {
  return {
    title: `Aprobar ${count} solicitud(es) de vacaciones`,
    description: "Esta acción aprobará automáticamente todas las solicitudes pendientes",
    icon: "check",
    items: [
      { 
        label: "Solicitudes a aprobar", 
        value: count,
        icon: <Calendar className="w-4 h-4 text-green-600" />,
        highlight: true
      },
      ...details.map(d => ({
        label: d.name,
        value: d.dates,
        icon: null
      }))
    ],
    confirmText: "Sí, aprobar todas",
    cancelText: "Cancelar"
  };
}

/**
 * Build a confirmation for schedule creation
 * Example: "Crear 15 turnos" for employee X from date1 to date2
 */
export function buildScheduleCreationConfirmation(
  employeeName: string,
  shiftCount: number,
  startDate: string,
  endDate: string,
  hours: string
): AIConfirmation {
  return {
    title: `Crear ${shiftCount} ${shiftCount === 1 ? 'turno' : 'turnos'}`,
    description: `Se crearán turnos para ${employeeName}`,
    icon: "info",
    items: [
      {
        label: "Empleado",
        value: employeeName,
        icon: <Users className="w-4 h-4 text-blue-600" />,
        highlight: true
      },
      {
        label: "Turnos a crear",
        value: shiftCount,
        icon: <Clock className="w-4 h-4 text-amber-600" />,
        highlight: true
      },
      {
        label: "Período",
        value: `${startDate} a ${endDate}`,
        icon: <Calendar className="w-4 h-4 text-blue-600" />
      },
      {
        label: "Horario",
        value: hours,
        icon: null
      }
    ],
    confirmText: "Crear turnos",
    cancelText: "Cancelar"
  };
}

/**
 * Build a confirmation for employee deletion
 * Example: "Eliminar empleado" with warning
 */
export function buildEmployeeDeletionConfirmation(
  employeeName: string,
  employeeId: number,
  role: string
): AIConfirmation {
  return {
    title: `Eliminar empleado: ${employeeName}`,
    description: "⚠️ Esta acción es irreversible. Se eliminarán todos los datos asociados.",
    icon: "warning",
    items: [
      {
        label: "Empleado",
        value: employeeName,
        icon: <Trash2 className="w-4 h-4 text-red-600" />,
        highlight: true
      },
      {
        label: "ID",
        value: employeeId,
        icon: null
      },
      {
        label: "Rol",
        value: role,
        icon: null
      },
      {
        label: "Acción",
        value: "ELIMINACIÓN PERMANENTE",
        icon: <AlertCircle className="w-4 h-4 text-red-600" />,
        highlight: true
      }
    ],
    confirmText: "Sí, eliminar empleado",
    cancelText: "No, cancelar"
  };
}

/**
 * Build a confirmation for bulk reminder creation
 */
export function buildReminderCreationConfirmation(
  names: string[],
  reminderText: string
): AIConfirmation {
  return {
    title: `Crear recordatorio para ${names.length} ${names.length === 1 ? 'persona' : 'personas'}`,
    description: "Se enviará un recordatorio a los siguientes empleados",
    icon: "info",
    items: [
      {
        label: "Destinatarios",
        value: names.length,
        icon: <Users className="w-4 h-4 text-blue-600" />,
        highlight: true
      },
      {
        label: "Mensaje",
        value: reminderText,
        icon: null
      },
      ...names.slice(0, 5).map(name => ({
        label: `→ ${name}`,
        value: "incluido",
        icon: <CheckCircle className="w-4 h-4 text-green-600" />
      })),
      ...(names.length > 5 ? [{ label: `... y ${names.length - 5} más`, value: "incluidos", icon: null }] : [])
    ],
    confirmText: "Crear recordatorio",
    cancelText: "Cancelar"
  };
}

/**
 * Build a confirmation for CRM contact bulk operations
 */
export function buildCRMContactConfirmation(
  action: "create" | "delete" | "update",
  count: number,
  contactDetails?: Array<{name: string; role: string}>
): AIConfirmation {
  const titles = {
    create: `Crear ${count} ${count === 1 ? 'contacto' : 'contactos'} CRM`,
    delete: `Eliminar ${count} ${count === 1 ? 'contacto' : 'contactos'} CRM`,
    update: `Actualizar ${count} ${count === 1 ? 'contacto' : 'contactos'} CRM`
  };

  const icons = {
    create: "info" as const,
    delete: "warning" as const,
    update: "info" as const
  };

  return {
    title: titles[action],
    description: `Se ${action === 'create' ? 'crearán' : action === 'delete' ? `eliminarán` : 'actualizarán'} ${count} contacto(s) en tu CRM`,
    icon: icons[action],
    items: [
      {
        label: "Acción",
        value: action === 'create' ? 'Crear' : action === 'delete' ? 'Eliminar' : 'Actualizar',
        icon: <Users className="w-4 h-4 text-blue-600" />,
        highlight: true
      },
      {
        label: "Cantidad",
        value: count,
        icon: <BarChart3 className="w-4 h-4 text-blue-600" />,
        highlight: true
      },
      ...(contactDetails?.slice(0, 3).map(c => ({
        label: c.name,
        value: c.role || 'contacto',
        icon: null
      })) || []),
      ...(contactDetails && contactDetails.length > 3 ? [{ label: `... y ${contactDetails.length - 3} más`, value: 'contactos', icon: null }] : [])
    ],
    confirmText: action === 'delete' ? 'Sí, eliminar' : 'Confirmar',
    cancelText: "Cancelar"
  };
}
