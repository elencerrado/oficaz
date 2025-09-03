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
      return 'bg-white dark:bg-white';
    }

    return 'bg-transparent';
  };

  const getDayBorder = (date: Date) => {
    const holiday = getHolidayInfo(date);
    const isApproved = isApprovedVacation(date);
    const isPending = isPendingVacation(date);
    const isSelected = selectedDate && isSameDay(date, selectedDate);
    const isTodayDate = isToday(date);
    const hasSpecialEvent = holiday || isApproved || isPending;

    // Si tiene evento especial, día seleccionado o es hoy, no mostramos borde base porque usamos overlay
    if (hasSpecialEvent || isSelected || isTodayDate) {
      return '';
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
            
            // Determine position in consecutive range for worm effect
            let rangePosition = 'none'; // 'first', 'middle', 'last', 'single', 'none'
            let eventColor = '';
            
            if (hasSpecialEvent) {
              const currentRange = consecutiveDayRanges.find(range => {
                const rangeDates = [];
                for (let d = new Date(range.startDate); d <= range.endDate; d.setDate(d.getDate() + 1)) {
                  rangeDates.push(new Date(d));
                }
                return rangeDates.some(d => isSameDay(d, date));
              });
              
              if (currentRange) {
                eventColor = holiday ? (holiday.type === 'national' ? 'red-500' : 'orange-500') :
                           isApproved ? 'green-500' : 'yellow-500';
                
                const rangeDates = [];
                for (let d = new Date(currentRange.startDate); d <= currentRange.endDate; d.setDate(d.getDate() + 1)) {
                  rangeDates.push(new Date(d));
                }
                
                const currentIndex = rangeDates.findIndex(d => isSameDay(d, date));
                if (rangeDates.length === 1) {
                  rangePosition = 'single';
                } else if (currentIndex === 0) {
                  rangePosition = 'first';
                } else if (currentIndex === rangeDates.length - 1) {
                  rangePosition = 'last';
                } else {
                  rangePosition = 'middle';
                }
              }
            }
            
            elements.push(
              <div key={`day-wrapper-${date.toISOString()}`} className="flex items-center justify-center h-9 w-9 relative">
                <button
                  onClick={() => onDateSelect(date)}
                  className={`relative ${dayStyles} ${dayBackground} ${dayBorder} hover:bg-opacity-80 z-10 w-9 h-9 flex items-center justify-center
                    ${rangePosition === 'single' ? 'rounded-full' : 
                      rangePosition === 'first' ? 'rounded-l-full rounded-r-none' :
                      rangePosition === 'last' ? 'rounded-r-full rounded-l-none' :
                      rangePosition === 'middle' ? 'rounded-none' : 'rounded-full'}`}
                >
                  {format(date, 'd')}
                  
                  {/* Worm effect borders and lines */}
                  {hasSpecialEvent && rangePosition !== 'none' && (
                    <>
                      {/* Top and bottom lines for middle days */}
                      {rangePosition === 'middle' && (
                        <>
                          <div className={`absolute top-0 left-0 right-0 h-0.5 bg-${eventColor}`}></div>
                          <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-${eventColor}`}></div>
                        </>
                      )}
                      
                      {/* Border for single days (normal circle) */}
                      {rangePosition === 'single' && (
                        <div className={`absolute inset-0 rounded-full border-2 border-${eventColor} pointer-events-none`}></div>
                      )}
                      
                      {/* First day: connecting lines with border effect */}
                      {rangePosition === 'first' && (
                        <>
                          <div className={`absolute top-0 left-1/2 right-0 h-0.5 bg-${eventColor}`}></div>
                          <div className={`absolute bottom-0 left-1/2 right-0 h-0.5 bg-${eventColor}`}></div>
                          <div className={`absolute inset-0 rounded-l-full border-2 border-${eventColor} pointer-events-none`}></div>
                        </>
                      )}
                      
                      {/* Last day: connecting lines with border effect */}
                      {rangePosition === 'last' && (
                        <>
                          <div className={`absolute top-0 left-0 right-1/2 h-0.5 bg-${eventColor}`}></div>
                          <div className={`absolute bottom-0 left-0 right-1/2 h-0.5 bg-${eventColor}`}></div>
                          <div className={`absolute inset-0 rounded-r-full border-2 border-${eventColor} pointer-events-none`}></div>
                        </>
                      )}
                    </>
                  )}
                  
                  {/* Show simple overlay for non-range special days or selected days */}
                  {((selectedDate && isSameDay(date, selectedDate)) || (hasSpecialEvent && rangePosition === 'none')) && (
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
              
              const connectionColorClass = consecutiveDayRanges.find(range => {
                const rangeDates = [];
                for (let d = new Date(range.startDate); d <= range.endDate; d.setDate(d.getDate() + 1)) {
                  rangeDates.push(new Date(d));
                }
                return rangeDates.some(d => isSameDay(d, date));
              })?.borderColor.replace('border-', 'bg-') || '';
              
              const connectionColor = consecutiveDayRanges.find(range => {
                const rangeDates = [];
                for (let d = new Date(range.startDate); d <= range.endDate; d.setDate(d.getDate() + 1)) {
                  rangeDates.push(new Date(d));
                }
                return rangeDates.some(d => isSameDay(d, date));
              });
              
              let connectorEventColor = '';
              if (connectionColor) {
                // Extract color from border class
                const currentDate = date;
                const currentHoliday = getHolidayInfo(currentDate);
                const currentApproved = isApprovedVacation(currentDate);
                connectorEventColor = currentHoliday ? (currentHoliday.type === 'national' ? 'red-500' : 'orange-500') :
                                    currentApproved ? 'green-500' : 'yellow-500';
              }
              
              elements.push(
                <div 
                  key={`connector-${date.toISOString()}`}
                  className="flex items-center justify-center h-9 relative"
                >
                  {shouldShowConnection && (
                    <>
                      {/* Top and bottom connecting lines for worm effect */}
                      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-${connectorEventColor}`}></div>
                      <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-${connectorEventColor}`}></div>
                    </>
                  )}
                </div>
              );
            }
            // ⚠️ END PROTECTED SECTION ⚠️
            
            return elements;
          }).flat();
        }).flat()}
      </div>


    </div>
  );
}