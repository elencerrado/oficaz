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

  // Helper function to get multi-day ranges for worm effect
  const getMultiDayRanges = () => {
    const ranges: Array<{
      dates: Date[];
      type: 'national' | 'custom' | 'approved' | 'pending';
      color: string;
    }> = [];

    // Group custom holidays by name (multi-day events)
    const customHolidayGroups = customHolidays.reduce((groups: any, holiday) => {
      if (!groups[holiday.name]) {
        groups[holiday.name] = [];
      }
      groups[holiday.name].push(parseISO(holiday.date));
      return groups;
    }, {});

    // Add custom holiday ranges
    Object.values(customHolidayGroups).forEach((dates: any) => {
      if (dates.length > 1) {
        dates.sort((a: Date, b: Date) => a.getTime() - b.getTime());
        ranges.push({
          dates,
          type: 'custom',
          color: 'bg-orange-500'
        });
      }
    });

    // Add vacation ranges
    [...approvedVacations, ...pendingVacations].forEach(vacation => {
      const start = parseISO(vacation.startDate);
      const end = parseISO(vacation.endDate);
      const dates = [];
      
      for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        dates.push(new Date(date));
      }
      
      if (dates.length > 1) {
        ranges.push({
          dates,
          type: vacation.status === 'approved' ? 'approved' : 'pending',
          color: vacation.status === 'approved' ? 'bg-green-500' : 'bg-yellow-500'
        });
      }
    });

    return ranges;
  };

  const multiDayRanges = useMemo(() => getMultiDayRanges(), [customHolidays, approvedVacations, pendingVacations]);

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
    if (isSelected) {
      baseClasses += ' text-white';
    } else if (isTodayDate) {
      baseClasses += ' text-black dark:text-black';
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

    if (isSelected) {
      return 'bg-blue-500 dark:bg-blue-600';
    }
    
    if (isTodayDate) {
      return 'bg-white dark:bg-white border-2 border-gray-400 dark:border-gray-500';
    }

    return 'bg-transparent';
  };

  const getDayBorder = (date: Date) => {
    const holiday = getHolidayInfo(date);
    const isApproved = isApprovedVacation(date);
    const isPending = isPendingVacation(date);
    const isSelected = selectedDate && isSameDay(date, selectedDate);
    const isTodayDate = isToday(date);

    // Si es día seleccionado o hoy, no mostramos borde porque usamos overlay
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

      {/* Calendar grid with worm backgrounds */}
      <div className="grid grid-cols-7 gap-1 relative">
        {/* Render worm backgrounds for multi-day events */}
        {multiDayRanges.map((range, rangeIndex) => {
          const wormElements = [];
          
          for (let i = 0; i < range.dates.length; i++) {
            const date = range.dates[i];
            const dayIndex = calendarDays.findIndex(d => isSameDay(d, date));
            
            if (dayIndex !== -1) {
              const row = Math.floor(dayIndex / 7);
              const col = dayIndex % 7;
              const isFirst = i === 0;
              const isLast = i === range.dates.length - 1;
              const nextDate = range.dates[i + 1];
              const nextDayIndex = nextDate ? calendarDays.findIndex(d => isSameDay(d, nextDate)) : -1;
              const continuesNextRow = nextDayIndex !== -1 && Math.floor(nextDayIndex / 7) !== row;
              
              wormElements.push(
                <div
                  key={`${rangeIndex}-${i}`}
                  className={`absolute ${range.color} opacity-20 pointer-events-none`}
                  style={{
                    top: `${row * 2.5 + 0.25}rem`,
                    left: `${col * 2.5 + 0.25}rem`,
                    width: isLast || continuesNextRow ? '2rem' : '4.5rem',
                    height: '2rem',
                    borderRadius: isFirst && isLast ? '1rem' :
                                isFirst ? '1rem 0.5rem 0.5rem 1rem' :
                                isLast || continuesNextRow ? '0.5rem 1rem 1rem 0.5rem' :
                                '0.5rem',
                    zIndex: 1
                  }}
                />
              );
              
              // Add connector to next row if needed
              if (continuesNextRow && col === 6) {
                wormElements.push(
                  <div
                    key={`${rangeIndex}-connector-${i}`}
                    className={`absolute ${range.color} opacity-20 pointer-events-none`}
                    style={{
                      top: `${row * 2.5 + 2.25}rem`,
                      left: `0.25rem`,
                      width: `${7 * 2.5 - 0.5}rem`,
                      height: '0.5rem',
                      zIndex: 1
                    }}
                  />
                );
              }
            }
          }
          
          return wormElements;
        })}

        {/* Calendar day buttons */}
        {calendarDays.map((date, index) => {
          const dayStyles = getDayStyles(date);
          const dayBackground = getDayBackground(date);
          const dayBorder = getDayBorder(date);
          const isTodayDate = isToday(date);
          const holiday = getHolidayInfo(date);
          const isApproved = isApprovedVacation(date);
          const isPending = isPendingVacation(date);
          const hasSpecialEvent = holiday || isApproved || isPending;
          
          // Check if this day is part of a multi-day range
          const isPartOfRange = multiDayRanges.some(range => 
            range.dates.some(rangeDate => isSameDay(rangeDate, date))
          );
          
          return (
            <button
              key={date.toISOString()}
              onClick={() => onDateSelect(date)}
              className={`relative ${dayStyles} ${dayBackground} ${isPartOfRange && !isTodayDate && !(selectedDate && isSameDay(date, selectedDate)) ? '' : dayBorder} rounded-full hover:bg-opacity-80 z-10`}
            >
              {format(date, 'd')}
              
              {/* Overlay circle for special days (today or selected) */}
              {(isTodayDate || (selectedDate && isSameDay(date, selectedDate))) && hasSpecialEvent && (
                <div className={`absolute inset-0 rounded-full border-2 pointer-events-none ${
                  holiday ? (holiday.type === 'national' ? 'border-red-500' : 'border-orange-500') :
                  isApproved ? 'border-green-500' :
                  'border-yellow-500'
                }`}></div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-white border-2 border-gray-400 flex items-center justify-center">
              <span className="text-[10px] text-black font-medium">H</span>
            </div>
            <span className="text-muted-foreground">Día de hoy</span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
              <span className="text-[10px] text-white font-medium">S</span>
            </div>
            <span className="text-muted-foreground">Día seleccionado</span>
          </div>
          
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