import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarDay {
  date: Date;
  isToday: boolean;
  isCurrentMonth: boolean;
  isSelected: boolean;
  hasVacation?: boolean;
  vacationType?: 'approved' | 'pending';
  hasHoliday?: boolean;
  holidayType?: 'national' | 'regional' | 'custom';
  holidayName?: string;
}

interface CustomCalendarProps {
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
  vacationDays?: Date[];
  pendingVacationDays?: Date[];
  holidays?: Array<{
    date: Date;
    name: string;
    type: 'national' | 'regional' | 'custom';
  }>;
  className?: string;
}

export function CustomCalendar({
  selectedDate,
  onDateSelect,
  vacationDays = [],
  pendingVacationDays = [],
  holidays = [],
  className = ''
}: CustomCalendarProps) {
  const [currentDate, setCurrentDate] = useState(() => selectedDate || new Date());
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Obtener el primer día del mes
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  
  // Obtener el primer día de la semana (lunes)
  const startDate = new Date(firstDayOfMonth);
  const dayOfWeek = firstDayOfMonth.getDay();
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Lunes = 0
  startDate.setDate(startDate.getDate() - daysToSubtract);
  
  // Crear array de días
  const days: CalendarDay[] = [];
  const currentIterDate = new Date(startDate);
  
  // Generar 42 días (6 semanas)
  for (let i = 0; i < 42; i++) {
    const dateString = currentIterDate.toDateString();
    const isToday = currentIterDate.toDateString() === today.toDateString();
    const isCurrentMonth = currentIterDate.getMonth() === currentDate.getMonth();
    const isSelected = selectedDate ? currentIterDate.toDateString() === selectedDate.toDateString() : false;
    
    // Verificar vacaciones
    const hasApprovedVacation = vacationDays.some(vd => vd.toDateString() === dateString);
    const hasPendingVacation = pendingVacationDays.some(pd => pd.toDateString() === dateString);
    
    // Verificar feriados
    const holiday = holidays.find(h => h.date.toDateString() === dateString);
    
    days.push({
      date: new Date(currentIterDate),
      isToday,
      isCurrentMonth,
      isSelected,
      hasVacation: hasApprovedVacation || hasPendingVacation,
      vacationType: hasApprovedVacation ? 'approved' : hasPendingVacation ? 'pending' : undefined,
      hasHoliday: !!holiday,
      holidayType: holiday?.type,
      holidayName: holiday?.name
    });
    
    currentIterDate.setDate(currentIterDate.getDate() + 1);
  }
  
  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };
  
  const handleDateClick = (day: CalendarDay) => {
    if (!day.isCurrentMonth) return;
    onDateSelect?.(day.date);
  };
  
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  
  const weekDays = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  
  const getDayClasses = (day: CalendarDay) => {
    const baseClasses = [
      'w-10 h-10 flex items-center justify-center text-sm font-medium transition-all duration-200 cursor-pointer relative'
    ];
    
    if (!day.isCurrentMonth) {
      baseClasses.push('text-gray-400 dark:text-gray-600');
    } else {
      baseClasses.push('text-gray-900 dark:text-gray-100');
    }
    
    // Estado seleccionado - círculo azul sólido
    if (day.isSelected) {
      baseClasses.push('bg-blue-500 text-white rounded-full shadow-lg');
    }
    // Hoy - círculo azul con borde especial
    else if (day.isToday) {
      baseClasses.push('bg-blue-500 text-white rounded-full shadow-lg scale-110 ring-2 ring-blue-300 ring-opacity-50');
    }
    // Vacaciones aprobadas - círculo verde solo borde
    else if (day.hasVacation && day.vacationType === 'approved') {
      baseClasses.push('border-2 border-green-600 rounded-full hover:bg-green-50 dark:hover:bg-green-900');
    }
    // Vacaciones pendientes - círculo amarillo punteado
    else if (day.hasVacation && day.vacationType === 'pending') {
      baseClasses.push('border-2 border-dashed border-yellow-500 rounded-full hover:bg-yellow-50 dark:hover:bg-yellow-900');
    }
    // Feriados - círculo con borde según tipo
    else if (day.hasHoliday) {
      if (day.holidayType === 'national') {
        baseClasses.push('border-2 border-red-500 rounded-full hover:bg-red-50 dark:hover:bg-red-900');
      } else if (day.holidayType === 'regional') {
        baseClasses.push('border-2 border-purple-500 rounded-full hover:bg-purple-50 dark:hover:bg-purple-900');
      } else {
        baseClasses.push('border-2 border-orange-500 rounded-full hover:bg-orange-50 dark:hover:bg-orange-900');
      }
    }
    // Día normal
    else {
      baseClasses.push('hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full');
    }
    
    return baseClasses.join(' ');
  };
  
  return (
    <div className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 ${className}`}>
      {/* Header del calendario */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigateMonth('prev')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h2>
        
        <button
          onClick={() => navigateMonth('next')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>
      
      {/* Días de la semana */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map(day => (
          <div key={day} className="w-10 h-10 flex items-center justify-center text-sm font-medium text-gray-500 dark:text-gray-400">
            {day}
          </div>
        ))}
      </div>
      
      {/* Días del mes */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => (
          <div
            key={index}
            className={getDayClasses(day)}
            onClick={() => handleDateClick(day)}
            title={day.hasHoliday ? day.holidayName : undefined}
          >
            {day.date.getDate()}
          </div>
        ))}
      </div>
      
      {/* Leyenda */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
            <span className="text-gray-600 dark:text-gray-400">Seleccionado/Hoy</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-green-600 rounded-full"></div>
            <span className="text-gray-600 dark:text-gray-400">Vacaciones</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-dashed border-yellow-500 rounded-full"></div>
            <span className="text-gray-600 dark:text-gray-400">Pendientes</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-red-500 rounded-full"></div>
            <span className="text-gray-600 dark:text-gray-400">Feriados</span>
          </div>
        </div>
      </div>
    </div>
  );
}