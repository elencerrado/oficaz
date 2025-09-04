import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO, isToday, isPast } from 'date-fns';
import { es } from 'date-fns/locale';

interface Holiday {
  name: string;
  date: string;
  type: string;
  originalType?: string;
}

interface CustomHoliday {
  name: string;
  startDate: string;
  endDate: string;
  type: string;
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
  customHolidays: CustomHoliday[];
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
    const isNational = nationalHolidays.some(h => h.date === dateString);
    const isCustom = customHolidays.some(h => {
      const startDateStr = h.startDate.split('T')[0];
      const endDateStr = h.endDate.split('T')[0];
      return dateString >= startDateStr && dateString <= endDateStr;
    });
    return isNational || isCustom;
  };

  const getHolidayInfo = (date: Date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    const national = nationalHolidays.find(h => h.date === dateString);
    const custom = customHolidays.find(h => {
      // Use string comparison to avoid timezone issues
      const startDateStr = h.startDate.split('T')[0]; // Get YYYY-MM-DD part
      const endDateStr = h.endDate.split('T')[0]; // Get YYYY-MM-DD part
      const isInRange = dateString >= startDateStr && dateString <= endDateStr;
      return isInRange;
    });
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

    // Process custom holidays directly as ranges
    customHolidays.forEach(holiday => {
      const start = parseISO(holiday.startDate);
      const end = parseISO(holiday.endDate);
      
      ranges.push({
        startDate: start,
        endDate: end,
        type: 'custom',
        borderColor: 'border-orange-500'
      });
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

    let baseClasses = 'relative w-9 h-9 flex items-center justify-center text-sm font-medium cursor-pointer transition-none';
    
    // Opacity for past days and out of month
    if (!isCurrentMonth || isPastDate) {
      baseClasses += ' opacity-40';
    }

    // Text color
    if (isSelected) {
      baseClasses += ' text-white';
    } else if (isTodayDate) {
      baseClasses += ' !text-black dark:!text-black';
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
        {weekDays.flatMap((day, index) => {
          const elements = [
            <div key={`header-${day}`} className="h-8 flex items-center justify-center text-xs font-medium text-muted-foreground uppercase">
              {day}
            </div>
          ];
          if (index < 6) {
            elements.push(<div key={`header-spacer-${index}`}></div>);
          }
          return elements;
        })}
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
              // Check if this date is in any consecutive range
              const dateString = format(date, 'yyyy-MM-dd');
              const currentRange = consecutiveDayRanges.find(range => {
                const startStr = format(range.startDate, 'yyyy-MM-dd');
                const endStr = format(range.endDate, 'yyyy-MM-dd');
                return dateString >= startStr && dateString <= endStr;
              });
              
              if (currentRange) {
                // Use the same color extraction logic as connectors
                eventColor = currentRange.borderColor.includes('red') ? 'red-500' : 
                           currentRange.borderColor.includes('orange') ? 'orange-500' :
                           currentRange.borderColor.includes('green') ? 'green-500' : 'yellow-500';
                
                // Check position in range by comparing dates directly
                if (isSameDay(date, currentRange.startDate) && isSameDay(date, currentRange.endDate)) {
                  rangePosition = 'single';
                } else if (isSameDay(date, currentRange.startDate)) {
                  rangePosition = 'first';
                } else if (isSameDay(date, currentRange.endDate)) {
                  rangePosition = 'last';
                } else {
                  rangePosition = 'middle';
                }
                

              }
            }
            
            elements.push(
              <div key={`day-wrapper-${date.toISOString()}`} className="flex items-center justify-center h-10 w-9 relative">
                <button
                  onClick={() => onDateSelect(date)}
                  className={`relative ${dayStyles} ${dayBackground} ${dayBorder} hover:bg-opacity-80 z-10 w-9 h-9 flex items-center justify-center transition-none
                    ${isTodayDate || (selectedDate && isSameDay(date, selectedDate)) ? 'rounded-full' : 
                      rangePosition === 'single' ? 'rounded-full' : 
                      rangePosition === 'first' ? 'rounded-l-full rounded-r-none' :
                      rangePosition === 'last' ? 'rounded-r-full rounded-l-none' :
                      rangePosition === 'middle' ? 'rounded-none' : 'rounded-full'}`}
                >
                  <span className={`relative z-30 ${isTodayDate ? '!text-black dark:!text-black' : ''}`}>
                    {format(date, 'd')}
                  </span>
                  
                  {/* Today always gets a white circle, regardless of events - behind other elements */}
                  {isTodayDate && (
                    <div className="absolute inset-0 rounded-full bg-white dark:bg-white pointer-events-none z-0"></div>
                  )}
                  
                  {/* Worm effect borders and lines - ON TOP of today circle and picker */}
                  {hasSpecialEvent && rangePosition !== 'none' && (
                    <>
                      {/* Top and bottom lines for middle days */}
                      {rangePosition === 'middle' && (
                        <>
                          <div className={`absolute top-0 left-0 right-0 border-t-2 z-20 ${
                            eventColor === 'red-500' ? 'border-red-500' :
                            eventColor === 'orange-500' ? 'border-orange-500' :
                            eventColor === 'green-500' ? 'border-green-500' : 'border-yellow-500'
                          }`}></div>
                          <div className={`absolute bottom-0 left-0 right-0 border-b-2 z-20 ${
                            eventColor === 'red-500' ? 'border-red-500' :
                            eventColor === 'orange-500' ? 'border-orange-500' :
                            eventColor === 'green-500' ? 'border-green-500' : 'border-yellow-500'
                          }`}></div>
                        </>
                      )}
                      
                      {/* Border for single days (normal circle) */}
                      {rangePosition === 'single' && (
                        <div className={`absolute inset-0 rounded-full border-2 pointer-events-none z-20 ${
                          eventColor === 'red-500' ? 'border-red-500' :
                          eventColor === 'orange-500' ? 'border-orange-500' :
                          eventColor === 'green-500' ? 'border-green-500' : 'border-yellow-500'
                        }`}></div>
                      )}
                      
                      {/* First day: C shape with curvature but no right border */}
                      {rangePosition === 'first' && (
                        <>
                          <div className={`absolute top-0 left-1/2 right-0 border-t-2 z-20 ${
                            eventColor === 'red-500' ? 'border-red-500' :
                            eventColor === 'orange-500' ? 'border-orange-500' :
                            eventColor === 'green-500' ? 'border-green-500' : 'border-yellow-500'
                          }`}></div>
                          <div className={`absolute bottom-0 left-1/2 right-0 border-b-2 z-20 ${
                            eventColor === 'red-500' ? 'border-red-500' :
                            eventColor === 'orange-500' ? 'border-orange-500' :
                            eventColor === 'green-500' ? 'border-green-500' : 'border-yellow-500'
                          }`}></div>
                          <div className={`absolute inset-0 rounded-l-full border-l-2 border-t-2 border-b-2 pointer-events-none z-20 ${
                            eventColor === 'red-500' ? 'border-red-500' :
                            eventColor === 'orange-500' ? 'border-orange-500' :
                            eventColor === 'green-500' ? 'border-green-500' : 'border-yellow-500'
                          }`}></div>
                        </>
                      )}
                      
                      {/* Last day: Inverted C shape with curvature but no left border */}
                      {rangePosition === 'last' && (
                        <>
                          <div className={`absolute top-0 left-0 right-1/2 border-t-2 z-20 ${
                            eventColor === 'red-500' ? 'border-red-500' :
                            eventColor === 'orange-500' ? 'border-orange-500' :
                            eventColor === 'green-500' ? 'border-green-500' : 'border-yellow-500'
                          }`}></div>
                          <div className={`absolute bottom-0 left-0 right-1/2 border-b-2 z-20 ${
                            eventColor === 'red-500' ? 'border-red-500' :
                            eventColor === 'orange-500' ? 'border-orange-500' :
                            eventColor === 'green-500' ? 'border-green-500' : 'border-yellow-500'
                          }`}></div>
                          <div className={`absolute inset-0 rounded-r-full border-r-2 border-t-2 border-b-2 pointer-events-none z-20 ${
                            eventColor === 'red-500' ? 'border-red-500' :
                            eventColor === 'orange-500' ? 'border-orange-500' :
                            eventColor === 'green-500' ? 'border-green-500' : 'border-yellow-500'
                          }`}></div>
                        </>
                      )}
                    </>
                  )}
                  
                  {/* Show simple overlay for selected days or non-range special days (but not today) */}
                  {((selectedDate && isSameDay(date, selectedDate)) || (hasSpecialEvent && rangePosition === 'none' && !isTodayDate)) && (
                    <div className={`absolute inset-0 rounded-full border-2 pointer-events-none z-10 ${
                      selectedDate && isSameDay(date, selectedDate) ? 'border-blue-500' :
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
              let connectorOpacity = '';
              if (connectionColor) {
                // Use the same color extraction logic as range
                connectorEventColor = connectionColor.borderColor.includes('red') ? 'red-500' : 
                                    connectionColor.borderColor.includes('orange') ? 'orange-500' :
                                    connectionColor.borderColor.includes('green') ? 'green-500' : 'yellow-500';
                
                // Apply same opacity logic as days
                const isCurrentMonth = isSameMonth(date, currentMonth);
                const isTodayDate = isToday(date);
                const isPastDate = isPast(date) && !isTodayDate;
                
                if (!isCurrentMonth || isPastDate) {
                  connectorOpacity = ' opacity-40';
                }
              }
              
              elements.push(
                <div 
                  key={`connector-${date.toISOString()}`}
                  className="flex items-center justify-center h-10 relative"
                >
                  {shouldShowConnection && (
                    <>
                      {/* Top and bottom connecting lines for worm effect */}
                      <div className={`absolute top-0 left-0 right-0 border-t-2 border-${connectorEventColor}${connectorOpacity}`}></div>
                      <div className={`absolute bottom-0 left-0 right-0 border-b-2 border-${connectorEventColor}${connectorOpacity}`}></div>
                    </>
                  )}
                </div>
              );
            }
            // ⚠️ END PROTECTED SECTION ⚠️
            
            return elements;
          }).flat();
        }).flat().map((element, index) => React.cloneElement(element, { key: `calendar-element-${index}` }))}
      </div>


    </div>
  );
}