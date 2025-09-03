import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO, isToday, isPast } from 'date-fns';
import { es } from 'date-fns/locale';

interface Holiday {
  name: string;
  date: string;
  type: string;
  originalType?: string;
}

interface Vacation {
  startDate: string;
  endDate: string;
  status: string;
  userName?: string;
}

interface CustomCalendarProps {
  selectedDate?: Date;
  onDateSelect: (date: Date) => void;
  nationalHolidays: Holiday[];
  customHolidays: Holiday[];
  approvedVacations: Vacation[];
  pendingVacations: Vacation[];
  className?: string;
}

export function CustomCalendar({
  selectedDate,
  onDateSelect,
  nationalHolidays,
  customHolidays,
  approvedVacations,
  pendingVacations,
  className = ''
}: CustomCalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date());

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  // Helper functions to check day types
  const isHoliday = (date: Date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    return nationalHolidays.some(h => h.date === dateString) || 
           customHolidays.some(h => h.date === dateString);
  };

  const getHolidayInfo = (date: Date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    const national = nationalHolidays.find(h => h.date === dateString);
    const custom = customHolidays.find(h => h.date === dateString);
    return national || custom;
  };

  const isApprovedVacation = (date: Date) => {
    return approvedVacations.some(v => {
      const start = parseISO(v.startDate);
      const end = parseISO(v.endDate);
      return date >= start && date <= end;
    });
  };

  const isPendingVacation = (date: Date) => {
    return pendingVacations.some(v => {
      const start = parseISO(v.startDate);
      const end = parseISO(v.endDate);
      return date >= start && date <= end;
    });
  };

  const getDayStyles = (date: Date) => {
    const isCurrentMonth = isSameMonth(date, currentMonth);
    const isSelected = selectedDate && isSameDay(date, selectedDate);
    const isTodayDate = isToday(date);
    const isPastDate = isPast(date) && !isTodayDate;
    const holiday = getHolidayInfo(date);
    const isApproved = isApprovedVacation(date);
    const isPending = isPendingVacation(date);

    let baseClasses = 'relative w-9 h-9 flex items-center justify-center text-sm font-medium transition-all duration-200 cursor-pointer hover:scale-105';
    
    // Opacity for past days and out of month
    if (!isCurrentMonth || isPastDate) {
      baseClasses += ' opacity-40';
    }

    // Text color
    if (isSelected || isTodayDate) {
      baseClasses += ' text-white';
    } else if (holiday) {
      baseClasses += holiday.type === 'national' ? ' text-red-600 dark:text-red-400' : ' text-orange-600 dark:text-orange-400';
    } else if (isApproved) {
      baseClasses += ' text-green-600 dark:text-green-400';
    } else if (isPending) {
      baseClasses += ' text-yellow-600 dark:text-yellow-400';
    } else {
      baseClasses += ' text-foreground';
    }

    return baseClasses;
  };

  const getDayBackground = (date: Date) => {
    const isSelected = selectedDate && isSameDay(date, selectedDate);
    const isTodayDate = isToday(date);
    const holiday = getHolidayInfo(date);
    const isApproved = isApprovedVacation(date);
    const isPending = isPendingVacation(date);

    if (isSelected) {
      return 'bg-blue-500 dark:bg-blue-600';
    }
    
    if (isTodayDate) {
      return 'bg-blue-600 dark:bg-blue-700';
    }

    return 'bg-transparent';
  };

  const getDayBorder = (date: Date) => {
    const holiday = getHolidayInfo(date);
    const isApproved = isApprovedVacation(date);
    const isPending = isPendingVacation(date);
    const isSelected = selectedDate && isSameDay(date, selectedDate);
    const isTodayDate = isToday(date);

    if (isSelected || isTodayDate) {
      return '';
    }

    if (holiday) {
      return holiday.type === 'national' ? 'border-2 border-red-500 dark:border-red-400' : 'border-2 border-orange-500 dark:border-orange-400';
    }
    
    if (isApproved) {
      return 'border-2 border-green-500 dark:border-green-400';
    }
    
    if (isPending) {
      return 'border-2 border-yellow-500 dark:border-yellow-400';
    }

    return '';
  };

  const weekDays = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1));
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-2">
        <button
          onClick={() => navigateMonth('prev')}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        
        <h2 className="text-lg font-semibold text-foreground capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: es })}
        </h2>
        
        <button
          onClick={() => navigateMonth('next')}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Week days header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((day) => (
          <div key={day} className="h-8 flex items-center justify-center text-xs font-medium text-muted-foreground uppercase">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((date) => {
          const dayStyles = getDayStyles(date);
          const dayBackground = getDayBackground(date);
          const dayBorder = getDayBorder(date);
          
          return (
            <button
              key={date.toISOString()}
              onClick={() => onDateSelect(date)}
              className={`${dayStyles} ${dayBackground} ${dayBorder} rounded-full hover:bg-opacity-80`}
            >
              {format(date, 'd')}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full border-2 border-red-500 flex items-center justify-center">
              <span className="text-[10px] text-red-600 dark:text-red-400 font-medium">1</span>
            </div>
            <span className="text-muted-foreground">Festivo nacional</span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full border-2 border-orange-500 flex items-center justify-center">
              <span className="text-[10px] text-orange-600 dark:text-orange-400 font-medium">1</span>
            </div>
            <span className="text-muted-foreground">Festivo personalizado</span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full border-2 border-green-500 flex items-center justify-center">
              <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">1</span>
            </div>
            <span className="text-muted-foreground">Vacaciones aprobadas</span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full border-2 border-yellow-500 flex items-center justify-center">
              <span className="text-[10px] text-yellow-600 dark:text-yellow-400 font-medium">1</span>
            </div>
            <span className="text-muted-foreground">Vacaciones pendientes</span>
          </div>
        </div>
      </div>
    </div>
  );
}