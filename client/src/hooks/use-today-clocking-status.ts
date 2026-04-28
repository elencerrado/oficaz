// Hook para obtener el estado de fichajes con detección de patrones (soporta rangos de fechas)
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface TodayClockingStatus {
  employeeId: number;
  name: string;
  date: string;
  status: 'completed' | 'incomplete' | 'not_clocked_in' | 'not_scheduled' | 'absent';
  expectedEntryTime?: string;
  actualEntryTime?: string;
  expectedExitTime?: string;
  actualExitTime?: string;
  hoursWorked?: number;
  timeSinceExpectedMinutes?: number;
  pattern?: number; // How many days this pattern shows
  reason?: string;
}

interface UseTodayClockingStatusOptions {
  startDate?: Date;
  endDate?: Date;
  enabled?: boolean; // Controlar si el query está habilitado
}

export function useTodayClockingStatus(options?: UseTodayClockingStatusOptions) {
  const { startDate, endDate, enabled = true } = options || {};
  
  return useQuery({
    queryKey: ['todayClockingStatus', startDate?.toISOString(), endDate?.toISOString()],
    enabled: enabled, // Solo ejecutar si está habilitado
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) {
        params.append('startDate', startDate.toISOString().split('T')[0]);
      }
      if (endDate) {
        params.append('endDate', endDate.toISOString().split('T')[0]);
      }
      const url = `/api/work-sessions/today-status${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await apiRequest('GET', url);
      return response as TodayClockingStatus[];
    },
    refetchInterval: false, // No auto-refetch - solo cuando cambia el rango visible
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos (mismo rango de fechas)
    gcTime: 10 * 60 * 1000, // Mantener en cache 10 minutos
  });
}
