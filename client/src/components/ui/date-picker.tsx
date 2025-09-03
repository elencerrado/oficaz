import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface DatePickerDayProps {
  date?: Date;
  onDateChange: (date: Date | undefined) => void;
  className?: string;
  placeholder?: string;
  buttonText?: string;
}

export function DatePickerDay({
  date,
  onDateChange,
  className,
  placeholder = "Seleccionar fecha",
  buttonText
}: DatePickerDayProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className={cn("border-0 bg-muted/50 hover:bg-muted text-left", className)}
        >
          <span className="truncate text-xs">
            {buttonText || (date 
              ? format(date, "d MMM yyyy", { locale: es })
              : placeholder
            )}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">
            Seleccionar fecha
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center space-y-4 p-4">
          <Calendar
            mode="single"
            selected={date}
            defaultMonth={date || new Date()}
            onSelect={(selectedDate) => {
              onDateChange(selectedDate);
              if (selectedDate) {
                setTimeout(() => {
                  setIsModalOpen(false);
                }, 300);
              }
            }}
            initialFocus
            locale={es}
          />
          <div className="flex gap-2 w-full">
            <Button 
              variant="outline" 
              onClick={() => setIsModalOpen(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            {date && (
              <Button 
                variant="outline" 
                onClick={() => {
                  onDateChange(undefined);
                  setIsModalOpen(false);
                }}
                className="flex-1"
              >
                Limpiar
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Componente específico para fechas de incorporación (mantenemos los selectores)
export function DatePickerDayEmployee({
  date,
  onDateChange,
  className,
  placeholder = "Seleccionar fecha",
  buttonText
}: DatePickerDayProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tempYear, setTempYear] = useState(date?.getFullYear() || new Date().getFullYear());
  const [tempMonth, setTempMonth] = useState(date?.getMonth() || new Date().getMonth());
  const [tempDay, setTempDay] = useState(date?.getDate() || new Date().getDate());

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 80 }, (_, i) => currentYear - i); // 80 años hacia atrás
  const months = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  
  // Calcular días del mes seleccionado
  const daysInMonth = new Date(tempYear, tempMonth + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const handleAccept = () => {
    // Ajustar día si es mayor al máximo del mes
    const adjustedDay = Math.min(tempDay, daysInMonth);
    const newDate = new Date(tempYear, tempMonth, adjustedDay);
    onDateChange(newDate);
    setIsModalOpen(false);
  };

  const handleCancel = () => {
    // Restaurar valores originales
    if (date) {
      setTempYear(date.getFullYear());
      setTempMonth(date.getMonth());
      setTempDay(date.getDate());
    }
    setIsModalOpen(false);
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-center text-center font-normal bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 w-full",
            className
          )}
        >
          {buttonText || (date 
            ? format(date, "d MMM yyyy", { locale: es })
            : placeholder
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">
            Seleccionar fecha
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col space-y-4 p-4">
          {/* Selector de Año */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Año
            </label>
            <Select value={tempYear.toString()} onValueChange={(value) => setTempYear(parseInt(value))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Selector de Mes */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Mes
            </label>
            <Select value={tempMonth.toString()} onValueChange={(value) => setTempMonth(parseInt(value))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((month, index) => (
                  <SelectItem key={index} value={index.toString()}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Selector de Día */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Día
            </label>
            <Select 
              value={Math.min(tempDay, daysInMonth).toString()} 
              onValueChange={(value) => setTempDay(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                {days.map((day) => (
                  <SelectItem key={day} value={day.toString()}>
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Botones */}
          <div className="flex gap-2 mt-6">
            <Button 
              variant="outline" 
              onClick={handleCancel}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleAccept}
              className="flex-1"
            >
              Aceptar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface DatePickerPeriodProps {
  startDate?: Date;
  endDate?: Date;
  onStartDateChange: (date: Date | undefined) => void;
  onEndDateChange: (date: Date | undefined) => void;
  className?: string;
  buttonText?: string;
}

export function DatePickerPeriod({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  className,
  buttonText
}: DatePickerPeriodProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSelectingStart, setIsSelectingStart] = useState(true);
  
  // Reset del estado cuando se abre el modal
  const handleModalOpen = (open: boolean) => {
    setIsModalOpen(open);
    if (open) {
      // Si ya hay un rango completo, preparar para nueva selección
      if (startDate && endDate) {
        setIsSelectingStart(true);
      } else if (startDate && !endDate) {
        // Si solo hay fecha de inicio, continuar con selección de fin
        setIsSelectingStart(false);
      } else {
        // Si no hay nada seleccionado, empezar desde el inicio
        setIsSelectingStart(true);
      }
    }
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={handleModalOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className={cn("border-0 bg-muted/50 hover:bg-muted text-left", className)}
        >
          <span className="truncate text-xs"> {/* ⚠️ NO MODIFICAR: tipografía uniforme con otros filtros */}
            {buttonText || (startDate && endDate
              ? (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()
                ? `${format(startDate, 'd', { locale: es })}-${format(endDate, 'd MMM', { locale: es })}`
                : `${format(startDate, 'd/M', { locale: es })}-${format(endDate, 'd/M', { locale: es })}`)
              : 'Rango')
            }
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">
            {isSelectingStart ? 'Seleccionar fecha de inicio' : 'Seleccionar fecha de fin'}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center space-y-4 p-4">
          <Calendar
            mode="range"
            selected={{
              from: startDate || undefined,
              to: endDate || undefined
            }}
            defaultMonth={startDate || new Date()}
            onSelect={(range) => {
              if (!range) {
                onStartDateChange(undefined);
                onEndDateChange(undefined);
                setIsSelectingStart(true);
                return;
              }

              if (range.from && range.to) {
                // Si se selecciona un rango completo de una vez
                if (startDate && endDate) {
                  // Si ya había un rango, iniciar uno nuevo
                  onStartDateChange(range.from);
                  onEndDateChange(undefined);
                  setIsSelectingStart(false);
                } else {
                  // Completar el rango
                  if (range.to < range.from) {
                    onStartDateChange(range.to);
                    onEndDateChange(range.from);
                  } else {
                    onStartDateChange(range.from);
                    onEndDateChange(range.to);
                  }
                  setTimeout(() => {
                    setIsModalOpen(false);
                    setIsSelectingStart(true);
                  }, 300);
                }
              } else if (range.from) {
                // Solo se seleccionó fecha de inicio
                onStartDateChange(range.from);
                onEndDateChange(undefined);
                setIsSelectingStart(false);
              }
            }}
            className="rounded-md border"
            numberOfMonths={1}
            showOutsideDays={false}
            locale={es}
          />

          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={() => {
                onStartDateChange(undefined);
                onEndDateChange(undefined);
                setIsSelectingStart(true);
              }}
              size="sm"
            >
              Limpiar fechas
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}