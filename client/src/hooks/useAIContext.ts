import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

/**
 * Hook to get real-time app context data for the AI assistant
 * Provides company, employee, schedule, and pending items data
 */
export function useAIContext() {
  // Get comprehensive dashboard data in a single request
  const { data: dashboardData, isLoading: isDashboardLoading } = useQuery({
    queryKey: ['/api/employee/dashboard-data'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/employee/dashboard-data');
        return response;
      } catch (error) {
        console.error('Error fetching dashboard context:', error);
        return null;
      }
    },
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  // Get company info and settings
  const { data: companySettings, isLoading: isSettingsLoading } = useQuery({
    queryKey: ['/api/settings/work-hours'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/settings/work-hours');
        return response;
      } catch (error) {
        console.error('Error fetching company settings:', error);
        return null;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
  });

  // Get employees list for AI reference
  const { data: employees, isLoading: isEmployeesLoading } = useQuery({
    queryKey: ['/api/company/employees'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/company/employees');
        return response;
      } catch (error) {
        console.error('Error fetching employees:', error);
        return [];
      }
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Build contextual summary for AI assistant
  const contextSummary = {
    company: companySettings ? {
      name: companySettings.name,
      alias: companySettings.alias,
      workingHoursPerDay: companySettings.workingHoursPerDay,
      defaultVacationDays: companySettings.defaultVacationDays,
      vacationDaysPerMonth: companySettings.vacationDaysPerMonth,
    } : null,
    
    dashboard: dashboardData ? {
      activeSession: dashboardData.activeSession,
      activeBreak: dashboardData.activeBreak,
      vacationRequests: dashboardData.vacationRequests || [],
      documentNotifications: dashboardData.documentNotifications || [],
      unreadMessages: dashboardData.unreadCount?.count || 0,
      activeReminders: dashboardData.activeReminders || [],
    } : null,

    employees: employees || [],
    
    // Convenience boolean flags for AI
    isPendingApprovals: Boolean(
      dashboardData?.vacationRequests?.some((r: any) => r.status === 'pending') ||
      dashboardData?.documentNotifications?.some((n: any) => !n.completed)
    ),
    hasActiveSession: Boolean(dashboardData?.activeSession),
    hasUnreadMessages: (dashboardData?.unreadCount?.count || 0) > 0,
  };

  return {
    context: contextSummary,
    isLoading: isDashboardLoading || isSettingsLoading || isEmployeesLoading,
  };
}

/**
 * Format AI context as a system prompt string for better assistant understanding
 */
export function formatAIContextPrompt(context: ReturnType<typeof useAIContext>['context']): string {
  const lines: string[] = [
    "## Contexto actual de la aplicación:",
  ];

  if (context.company) {
    lines.push(`- Empresa: ${context.company.name}`);
    lines.push(`- Horario laboral: ${context.company.workingHoursPerDay} horas/día`);
    lines.push(`- Días de vacaciones base: ${context.company.defaultVacationDays} días/año`);
  }

  if (context.dashboard) {
    if (context.hasActiveSession) {
      lines.push(`- ⏱️ Sesión de trabajo activa`);
    }
    
    const pendingVacations = context.dashboard.vacationRequests?.filter((r: any) => r.status === 'pending') || [];
    if (pendingVacations.length > 0) {
      lines.push(`- 📋 ${pendingVacations.length} solicitud(es) de vacaciones pendientes de aprobar`);
    }
    
    const pendingDocs = context.dashboard.documentNotifications?.filter((n: any) => !n.completed) || [];
    if (pendingDocs.length > 0) {
      lines.push(`- 📄 ${pendingDocs.length} documento(s) pendiente(s) de recibir`);
    }
    
    if (context.hasUnreadMessages) {
      lines.push(`- 💬 ${context.dashboard.unreadMessages} mensaje(s) sin leer`);
    }

    if (context.dashboard.activeReminders?.length > 0) {
      lines.push(`- ⏰ ${context.dashboard.activeReminders.length} recordatorio(s) activo(s)`);
    }
  }

  if (context.employees && context.employees.length > 0) {
    lines.push(`- 👥 ${context.employees.length} empleado(s) en tu empresa`);
  }

  return lines.join('\n');
}
