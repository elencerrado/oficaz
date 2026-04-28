/**
 * Professional Confirmation Response Builders
 * These functions create rich, detailed confirmations for the AI chat modal
 */

interface ConfirmationItem {
  label: string;
  value: string | number;
  icon?: string;
  highlight?: boolean;
}

interface ProfessionalConfirmation {
  message: string; // Brief message for chat
  needsConfirmation: true;
  confirmationModal: {
    title: string;
    description?: string;
    icon: 'warning' | 'check' | 'info';
    items: ConfirmationItem[];
    confirmText?: string;
    cancelText?: string;
  };
  confirmationContext: {
    action: string;
    [key: string]: any;
  };
}

/**
 * Build confirmation for vacation approval
 */
export function confirmVacationApproval(
  count: number,
  details: Array<{ employeeName: string; startDate: string; endDate: string }>
): ProfessionalConfirmation {
  return {
    message: `Estoy a punto de aprobar ${count} solicitud(es) de vacaciones. ¿Confirmas?`,
    needsConfirmation: true,
    confirmationModal: {
      title: `Aprobar ${count} ${count === 1 ? 'solicitud' : 'solicitudes'} de vacaciones`,
      description: 'Se aprobarán automáticamente todas las solicitudes pendientes',
      icon: 'check',
      items: [
        {
          label: 'Total de solicitudes',
          value: count,
          icon: '📋',
          highlight: true
        },
        ...details.slice(0, 5).map(d => ({
          label: `${d.employeeName}`,
          value: `${d.startDate} → ${d.endDate}`,
          icon: '👤',
          highlight: false
        })),
        ...(count > 5 ? [{ 
          label: `... y ${count - 5} más`, 
          value: 'empleados',
          icon: '⋯'
        }] : [])
      ],
      confirmText: '✅ Aprobar todas',
      cancelText: '❌ Cancelar'
    },
    confirmationContext: {
      action: 'approveVacations',
      count,
      requestIds: 'all_pending'
    }
  };
}

/**
 * Build confirmation for schedule creation
 */
export function confirmScheduleCreation(
  employeeName: string,
  shiftCount: number,
  startDate: string,
  endDate: string,
  hours: string,
  weekDays: string[]
): ProfessionalConfirmation {
  return {
    message: `Se crearán ${shiftCount} turnos para ${employeeName} del ${startDate} al ${endDate}. ¿Confirmas?`,
    needsConfirmation: true,
    confirmationModal: {
      title: `Crear ${shiftCount} ${shiftCount === 1 ? 'turno' : 'turnos'} de trabajo`,
      description: `Para ${employeeName} - Período: ${startDate} a ${endDate}`,
      icon: 'info',
      items: [
        {
          label: 'Empleado',
          value: employeeName,
          icon: '👤',
          highlight: true
        },
        {
          label: 'Cantidad de turnos',
          value: shiftCount,
          icon: '📅',
          highlight: true
        },
        {
          label: 'Período',
          value: `${startDate} → ${endDate}`,
          icon: '📆'
        },
        {
          label: 'Horario',
          value: hours,
          icon: '⏰'
        },
        {
          label: 'Días',
          value: weekDays.join(', '),
          icon: '📋'
        }
      ],
      confirmText: '✅ Crear turnos',
      cancelText: '❌ Cancelar'
    },
    confirmationContext: {
      action: 'createSchedule',
      employeeId: 0, // Will be filled by caller
      startDate,
      endDate,
      shiftCount,
      weekDays
    }
  };
}

/**
 * Build confirmation for employee deletion
 */
export function confirmEmployeeDeletion(
  employeeName: string,
  employeeId: number,
  role: string,
  hasAssignedShifts: boolean = false
): ProfessionalConfirmation {
  return {
    message: `⚠️ Esto eliminará permanentemente a ${employeeName}. ¿Estás seguro?`,
    needsConfirmation: true,
    confirmationModal: {
      title: `⚠️ Eliminar empleado: ${employeeName}`,
      description: '⚠️ Esta acción es IRREVERSIBLE. Se eliminarán todos los datos asociados.',
      icon: 'warning',
      items: [
        {
          label: 'Empleado',
          value: employeeName,
          icon: '👤',
          highlight: true
        },
        {
          label: 'ID',
          value: employeeId,
          icon: '#'
        },
        {
          label: 'Rol',
          value: role,
          icon: '📌'
        },
        ...(hasAssignedShifts ? [{
          label: 'Turnos asignados',
          value: 'Se eliminarán todos',
          icon: '⚠️',
          highlight: true
        }] : []),
        {
          label: 'Acción',
          value: 'ELIMINACIÓN PERMANENTE',
          icon: '❌',
          highlight: true
        }
      ],
      confirmText: '🗑️ Sí, eliminar',
      cancelText: '↩️ Cancelar'
    },
    confirmationContext: {
      action: 'deleteEmployee',
      employeeId
    }
  };
}

/**
 * Build confirmation for bulk reminders
 */
export function confirmReminderCreation(
  employeeNames: string[],
  reminderText: string,
  sendTime?: string
): ProfessionalConfirmation {
  const count = employeeNames.length;
  return {
    message: `Se enviará un recordatorio a ${count} empleado(es). ¿Confirmas?`,
    needsConfirmation: true,
    confirmationModal: {
      title: `Crear recordatorio para ${count} ${count === 1 ? 'persona' : 'personas'}`,
      description: 'Se enviará el siguiente mensaje a los empleados seleccionados',
      icon: 'info',
      items: [
        {
          label: 'Destinatarios',
          value: count,
          icon: '👥',
          highlight: true
        },
        {
          label: 'Mensaje',
          value: reminderText.substring(0, 50) + (reminderText.length > 50 ? '...' : ''),
          icon: '💬'
        },
        ...(sendTime ? [{
          label: 'Hora de envío',
          value: sendTime,
          icon: '⏰'
        }] : []),
        ...employeeNames.slice(0, 3).map(name => ({
          label: `→ ${name}`,
          value: 'notificado',
          icon: '✓'
        })),
        ...(count > 3 ? [{ 
          label: `... ${count - 3} más`,
          value: 'empleados',
          icon: '⋯'
        }] : [])
      ],
      confirmText: '✅ Enviar recordatorio',
      cancelText: '❌ Cancelar'
    },
    confirmationContext: {
      action: 'createReminder',
      employeeNames,
      reminderText,
      sendTime
    }
  };
}

/**
 * Build confirmation for CRM bulk operations
 */
export function confirmCRMOperation(
  operation: 'create' | 'delete' | 'update',
  contactNames: string[],
  details?: string
): ProfessionalConfirmation {
  const count = contactNames.length;
  const titles: Record<string, string> = {
    create: `Crear ${count} contacto(s) CRM`,
    delete: `Eliminar ${count} contacto(s) CRM`,
    update: `Actualizar ${count} contacto(s) CRM`
  };
  const icons: Record<string, 'warning' | 'check' | 'info'> = {
    create: 'info',
    delete: 'warning',
    update: 'info'
  };
  const confirmTexts: Record<string, string> = {
    create: '✅ Crear contactos',
    delete: '🗑️ Eliminar contactos',
    update: '✅ Actualizar contactos'
  };

  return {
    message: `Se ${operation === 'create' ? 'crearán' : operation === 'delete' ? 'eliminarán' : 'actualizarán'} ${count} contacto(s) en el CRM. ¿Confirmas?`,
    needsConfirmation: true,
    confirmationModal: {
      title: titles[operation],
      description: `${count} contacto(s) de CRM serán ${operation === 'create' ? 'creados' : operation === 'delete' ? 'eliminados' : 'actualizados'}`,
      icon: icons[operation],
      items: [
        {
          label: 'Acción',
          value: operation.toUpperCase(),
          icon: operation === 'delete' ? '⚠️' : '📇',
          highlight: true
        },
        {
          label: 'Cantidad',
          value: count,
          icon: '📊',
          highlight: true
        },
        ...(details ? [{ label: 'Detalles', value: details, icon: 'ℹ️' }] : []),
        ...contactNames.slice(0, 3).map(name => ({
          label: `→ ${name}`,
          value: operation === 'create' ? 'nuevo' : operation === 'delete' ? 'eliminar' : 'actualizar',
          icon: '📇'
        })),
        ...(count > 3 ? [{ 
          label: `... ${count - 3} contactos más`,
          value: 'en CRM',
          icon: '⋯'
        }] : [])
      ],
      confirmText: confirmTexts[operation],
      cancelText: '❌ Cancelar'
    },
    confirmationContext: {
      action: `${operation}CRMContacts`,
      contactNames,
      count
    }
  };
}
