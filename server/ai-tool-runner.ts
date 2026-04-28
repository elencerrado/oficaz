import type { AIFunctionContext } from './ai-assistant.js';

export type ToolCall = {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
};

// Run tool calls in isolation; resolve employee names using passed resolver and execute using executeAIFunction
export async function runToolCalls(
  toolCalls: ToolCall[],
  context: AIFunctionContext,
  resolveEmployeeName: (storage: any, companyId: number, name: string) => Promise<any>,
  executeAIFunction: (name: string, params: any, ctx: AIFunctionContext) => Promise<any>,
  storage: any
) {
  const toolResults: Array<{ role: string; tool_call_id: string; content: string }> = [];

  for (const toolCall of toolCalls) {
    const functionName = toolCall.function.name;
    const functionArgs = JSON.parse(toolCall.function.arguments);

    // Functions that expect employeeName resolution
    const functionsNeedingEmployeeResolution = ['getEmployeeShifts', 'getEmployeeWorkHours', 'getVacationBalance', 'assignSchedule', 'assignScheduleInRange', 'assignRotatingSchedule', 'requestDocument', 'deleteWorkShift', 'deleteWorkShiftsInRange', 'updateWorkShiftTimes', 'updateWorkShiftsInRange', 'updateEmployeeShiftsColor', 'updateWorkShiftColor', 'updateWorkShiftDetails', 'detectWorkShiftOverlaps', 'createReminder'];

    if (functionsNeedingEmployeeResolution.includes(functionName) && functionArgs.employeeName) {
      const resolution = await resolveEmployeeName(storage, context.companyId, functionArgs.employeeName);
      if ('error' in resolution) {
        toolResults.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify({ error: resolution.error }) });
        continue;
      }
      functionArgs.employeeId = resolution.employeeId;
      delete functionArgs.employeeName;
    }

    // Handle createReminder with employee names
    if (functionName === 'createReminder' && functionArgs.assignToEmployeeNames) {
      const employeeNames: string[] = functionArgs.assignToEmployeeNames;
      const resolvedIds: number[] = [];
      let hasError = false;
      for (const name of employeeNames) {
        const resolution = await resolveEmployeeName(storage, context.companyId, name);
        if ('error' in resolution) {
          toolResults.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify({ error: `Empleado \"${name}\": ${resolution.error}` }) });
          hasError = true;
          break;
        }
        resolvedIds.push(resolution.employeeId);
      }
      if (hasError) continue;
      functionArgs.assignToEmployeeIds = resolvedIds;
      delete functionArgs.assignToEmployeeNames;
    }

    try {
      const result = await executeAIFunction(functionName, functionArgs, context);
      toolResults.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result) });
    } catch (err: any) {
      toolResults.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify({ error: err.message || 'unknown' }) });
    }
  }

  return toolResults;
}

// FEATURE FLAG VALIDATION - Check if function is available for this subscription
// This prevents free/starter tier users from accessing premium functions
export function isFeatureAvailable(functionName: string, planName: string, hasAddon: boolean = false): boolean {
  // Premium addon functions (CRM, accounting, work reports, vacation creation)
  const premiumAddonFunctions = ['getActiveWorkers', 'listCRMContacts', 'createCRMContact', 'addCRMInteraction',
                                   'listWorkReports', 'createWorkReport', 'createVacationRequest', 'getAccountingSummary'];
  
  // If addon is active, premium functions are available
  if (hasAddon && premiumAddonFunctions.includes(functionName)) {
    return true;
  }
  
  // Plan-based access
  const featuresByPlan: Record<string, string[]> = {
    'free': ['listEmployees', 'getEmployeeShifts', 'getEmployeeWorkHours'],
    'starter': ['listEmployees', 'getEmployeeShifts', 'getEmployeeWorkHours', 'getVacationBalance', 'getPendingApprovals', 'navigateToPage'],
    'professional': [
      'listEmployees', 'getEmployeeShifts', 'getEmployeeWorkHours', 'getVacationBalance', 'getPendingApprovals', 'navigateToPage',
      'assignSchedule', 'assignScheduleInRange', 'updateWorkShiftTimes', 'deleteWorkShift', 'assignRotatingSchedule',
      'detectWorkShiftOverlaps', 'sendMessage', 'approveVacationRequests', 'approveTimeModificationRequests',
      'createReminder', 'requestDocument', 'getCompanySettings', 'updateEmployeeShiftsColor', 'updateWorkShiftColor', 'generateTimeReport'
    ],
    'enterprise': [
      // All professional + enterprise features
      'listEmployees', 'getEmployeeShifts', 'getEmployeeWorkHours', 'getVacationBalance', 'getPendingApprovals', 'navigateToPage',
      'assignSchedule', 'assignScheduleInRange', 'updateWorkShiftTimes', 'deleteWorkShift', 'assignRotatingSchedule',
      'detectWorkShiftOverlaps', 'sendMessage', 'approveVacationRequests', 'approveTimeModificationRequests', 'createReminder',
      'requestDocument', 'getCompanySettings', 'updateEmployeeShiftsColor', 'updateWorkShiftColor', 'generateTimeReport',
      'createEmployee', 'updateEmployee', 'generatePayrollReport', 'swapEmployeeShifts', 'copyEmployeeShifts',
      'createShiftAfterEmployee', 'updateWorkShiftDetails', 'deleteWorkShiftsInRange', 'updateWorkShiftsInRange', 'customQuery', 'deleteEmployee'
    ]
  };
  
  const normalizedPlan = (planName || 'free').toLowerCase();
  const availableFunctions = featuresByPlan[normalizedPlan] || featuresByPlan['free'];
  
  return availableFunctions.includes(functionName);
}