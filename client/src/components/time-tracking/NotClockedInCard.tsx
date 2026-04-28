// Componente para mostrar tarjeta de empleado sin fichaje
// Mantiene la estética consistente con las tarjetas de fichajas normales

import React from 'react';
import { AlertCircle, Clock, AlertTriangle, User, ChevronDown } from 'lucide-react';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TodayClockingStatus } from '@/hooks/use-today-clocking-status';

interface NotClockedInCardProps {
  status: TodayClockingStatus;
  onClick?: () => void;
  profilePicture?: string | null;
}

export function NotClockedInCard({ status, onClick, profilePicture }: NotClockedInCardProps) {
  const isLate = (status.timeSinceExpectedMinutes || 0) > 0;
  const minutesLate = status.timeSinceExpectedMinutes || 0;

  const getStatusColor = (minutesLate: number) => {
    if (minutesLate === 0) return 'text-orange-600';
    if (minutesLate <= 15) return 'text-orange-600';
    if (minutesLate <= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  const getStatusBgColor = (minutesLate: number) => {
    if (minutesLate === 0) return 'bg-orange-50 dark:bg-orange-950/20';
    if (minutesLate <= 15) return 'bg-orange-50 dark:bg-orange-950/20';
    if (minutesLate <= 60) return 'bg-amber-50 dark:bg-amber-950/20';
    return 'bg-red-50 dark:bg-red-950/20';
  };

  const getStatusBorderColor = (minutesLate: number) => {
    if (minutesLate === 0) return 'border-orange-200 dark:border-orange-800';
    if (minutesLate <= 15) return 'border-orange-200 dark:border-orange-800';
    if (minutesLate <= 60) return 'border-amber-200 dark:border-amber-800';
    return 'border-red-200 dark:border-red-800';
  };

  if (status.status === 'not_scheduled') {
    // Empleado no trabaja hoy
    return (
      <div className="bg-card dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-all hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600">
        <div className="grid items-center px-4 py-3.5 min-h-[72px] cursor-pointer select-none transition-colors gap-3"
          style={{ gridTemplateColumns: 'minmax(220px,280px) 90px minmax(120px,1fr) 60px 36px' }}
          onClick={onClick}>
          
          {/* Col 1: Avatar + Name */}
          <div className="flex items-center gap-2 min-w-0">
            <UserAvatar 
              fullName={status.name}
              size="sm"
              profilePicture={profilePicture}
            />
            <div className="flex items-center gap-1 min-w-0 flex-1">
              <span className="font-medium text-gray-900 dark:text-gray-100 text-sm pl-[2px] pr-[2px]">
                {status.name}
              </span>
            </div>
          </div>
          
          {/* Col 2: Día */}
          <div className="text-center flex items-center justify-center h-5">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">HOY</span>
          </div>
          
          {/* Col 3: Status badge */}
          <div className="w-full">
            <Badge variant="outline" className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600">
              ⚪ No trabaja hoy
            </Badge>
          </div>
          
          {/* Col 4: Empty */}
          <div></div>
          
          {/* Col 5: Icon */}
          <div className="justify-self-end flex items-center">
            <User className="w-4 h-4 text-gray-400" />
          </div>
        </div>
      </div>
    );
  }

  // Empleado debería haber fichado pero no lo ha hecho
  const statusColor = getStatusColor(minutesLate);
  const statusBgColor = getStatusBgColor(minutesLate);
  const statusBorderColor = getStatusBorderColor(minutesLate);
  
  const minutesText = minutesLate === 0 
    ? 'Sin registrar'
    : minutesLate <= 60
      ? `Retrasado ${minutesLate}m`
      : `Retrasado ${Math.floor(minutesLate / 60)}h ${minutesLate % 60}m`;

  return (
    <div className={cn(
      "rounded-2xl shadow-sm border overflow-hidden transition-all hover:shadow-md",
      statusBgColor,
      statusBorderColor,
      "border"
    )}>
      <div className="grid items-center px-4 py-3.5 min-h-[72px] cursor-pointer select-none transition-colors gap-3"
        style={{ gridTemplateColumns: 'minmax(220px,280px) 90px minmax(120px,1fr) 60px 36px' }}
        onClick={onClick}>
        
        {/* Col 1: Avatar + Name */}
        <div className="flex items-center gap-2 min-w-0">
          <UserAvatar 
            fullName={status.name}
            size="sm"
            profilePicture={profilePicture}
          />
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <span className={cn("font-medium text-sm pl-[2px] pr-[2px]", statusColor)}>
              {status.name}
            </span>
          </div>
        </div>
        
        {/* Col 2: Día */}
        <div className="text-center flex items-center justify-center h-5">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">HOY</span>
        </div>
        
        {/* Col 3: Timeline/Status bar */}
        <div className="w-full">
          <div className={cn(
            "px-3 py-1.5 rounded-lg text-sm font-medium inline-flex items-center gap-2",
            statusColor,
            "bg-white dark:bg-gray-900 bg-opacity-60 dark:bg-opacity-40"
          )}>
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{minutesText}</span>
          </div>
        </div>
        
        {/* Col 4: Expected Time */}
        <div className="text-right">
          <div className="text-xs text-gray-500 dark:text-gray-400">Esperado</div>
          <div className={cn("font-semibold text-sm", statusColor)}>
            {status.expectedEntryTime || '--:--'}
          </div>
        </div>
        
        {/* Col 5: Alert Icon */}
        <div className="justify-self-end flex items-center">
          <AlertTriangle className={cn("w-4 h-4", statusColor)} />
        </div>
      </div>
    </div>
  );
}
