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

  // Helper function to detect consecutive days for worm effect
  const getConsecutiveDayRanges = () => {
    const ranges: Array<{
      startDate: Date;
      endDate: Date;
      type: 'custom' | 'approved' | 'pending';
      borderColor: string;
    }> = [];

    // Process custom holidays (group by name for multi-day events like "Feria")
    const customHolidayGroups = customHolidays.reduce((groups: any, holiday) => {
      if (!groups[holiday.name]) {
        groups[holiday.name] = [];
      }
      groups[holiday.name].push(parseISO(holiday.date));
      return groups;
    }, {});

    Object.values(customHolidayGroups).forEach((dates: any) => {
      if (dates.length > 1) {
        dates.sort((a: Date, b: Date) => a.getTime() - b.getTime());
        ranges.push({
          startDate: dates[0],
          endDate: dates[dates.length - 1],
          type: 'custom',
          borderColor: 'border-orange-500'
        });
      }
    });

    // Process vacation ranges
    [...approvedVacations, ...pendingVacations].forEach(vacation => {
      const start = parseISO(vacation.startDate);
      const end = parseISO(vacation.endDate);
      
      // Only add if it's more than one day
      if (start.getTime() !== end.getTime()) {
        ranges.push({
          startDate: start,
          endDate: end,
          type: vacation.status === 'approved' ? 'approved' : 'pending',
          borderColor: vacation.status === 'approved' ? 'border-green-500' : 'border-yellow-500'
        });
      }
    });

    return ranges;
  };

  const consecutiveDayRanges = useMemo(() => getConsecutiveDayRanges(), [customHolidays, approvedVacations, pendingVacations]);

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

      {/* ⚠️ PROTECTED: Calendar Grid System - DO NOT MODIFY - Critical for perfect worm effect alignment ⚠️ */}
      {/* Week days header - with connector spaces */}
      <div className="grid mb-2" style={{ gridTemplateColumns: '2.25rem 1fr 2.25rem 1fr 2.25rem 1fr 2.25rem 1fr 2.25rem 1fr 2.25rem 1fr 2.25rem' }}>
        {weekDays.map((day, index) => (
          <>
            <div key={day} className="h-8 flex items-center justify-center text-xs font-medium text-muted-foreground uppercase">
              {day}
            </div>
            {index < 6 && <div key={`header-spacer-${index}`}></div>}
          </>
        ))}
      </div>

      {/* Calendar grid - with connector columns */}
      <div className="grid relative" style={{ gridTemplateColumns: '2.25rem 1fr 2.25rem 1fr 2.25rem 1fr 2.25rem 1fr 2.25rem 1fr 2.25rem 1fr 2.25rem' }}>


        {/* Calendar days and connectors in alternating pattern */}
        {Array.from({ length: 6 }, (_, weekIndex) => {
          const weekStart = weekIndex * 7;
          const weekDays = calendarDays.slice(weekStart, weekStart + 7);
          
          return weekDays.map((date, dayIndex) => {
            const globalIndex = weekStart + dayIndex;
            const dayStyles = getDayStyles(date);
            const dayBackground = getDayBackground(date);
            const dayBorder = getDayBorder(date);
            const isTodayDate = isToday(date);
            const holiday = getHolidayInfo(date);
            const isApproved = isApprovedVacation(date);
            const isPending = isPendingVacation(date);
            const hasSpecialEvent = holiday || isApproved || isPending;
            
            const elements = [];
            
            // ⚠️ PROTECTED: Day Button and Connector Logic - DO NOT MODIFY - Critical worm effect core ⚠️
            // Add the day button (fixed width column)
            elements.push(
              <div key={`day-wrapper-${date.toISOString()}`} className="flex items-center justify-center h-9 w-9">
                <button
                  onClick={() => onDateSelect(date)}
                  className={`relative ${dayStyles} ${dayBackground} ${dayBorder} rounded-full hover:bg-opacity-80 z-10 w-9 h-9`}
                >
                  {format(date, 'd')}
                  
                  {/* Only show event overlay if it's NOT today (today already has white background) */}
                  {!isTodayDate && (selectedDate && isSameDay(date, selectedDate)) && hasSpecialEvent && (
                    <div className={`absolute inset-0 rounded-full border-2 pointer-events-none ${
                      holiday ? (holiday.type === 'national' ? 'border-red-500' : 'border-orange-500') :
                      isApproved ? 'border-green-500' :
                      'border-yellow-500'
                    }`}></div>
                  )}
                </button>
              </div>
            );
            
            // Add connector column (except for the last day of the week)
            if (dayIndex < 6) {
              // Check if this day should have a connection line to the next day
              const shouldShowConnection = consecutiveDayRanges.some(range => {
                const rangeDates = [];
                for (let d = new Date(range.startDate); d <= range.endDate; d.setDate(d.getDate() + 1)) {
                  rangeDates.push(new Date(d));
                }
                
                const currentIndex = rangeDates.findIndex(d => isSameDay(d, date));
                if (currentIndex === -1 || currentIndex === rangeDates.length - 1) return false;
                
                const nextDate = rangeDates[currentIndex + 1];
                const nextGlobalIndex = globalIndex + 1;
                
                // Only show connection if next day exists and is consecutive
                return nextGlobalIndex < calendarDays.length && 
                       isSameDay(calendarDays[nextGlobalIndex], nextDate);
              });
              
              const connectionColor = consecutiveDayRanges.find(range => {
                const rangeDates = [];
                for (let d = new Date(range.startDate); d <= range.endDate; d.setDate(d.getDate() + 1)) {
                  rangeDates.push(new Date(d));
                }
                return rangeDates.some(d => isSameDay(d, date));
              })?.borderColor.replace('border-', 'bg-') || '';
              
              elements.push(
                <div 
                  key={`connector-${date.toISOString()}`}
                  className="flex items-center justify-center h-9"
                >
                  {shouldShowConnection && (
                    <div className={`w-full h-0.5 ${connectionColor}`}></div>
                  )}
                </div>
              );
            }
            // ⚠️ END PROTECTED SECTION ⚠️
            
            return elements;
          }).flat();
        }).flat()}
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
          
          <div className="col-span-2 flex items-center gap-2 mt-2 pt-2 border-t border-border">
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full border-2 border-orange-500"></div>
              <div className="w-2 h-0.5 bg-orange-500"></div>
              <div className="w-3 h-3 rounded-full border-2 border-orange-500"></div>
            </div>
            <span className="text-muted-foreground text-xs">Los eventos de múltiples días se conectan</span>
          </div>
        </div>
      </div>
    </div>
  );
}