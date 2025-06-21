import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  placeholder = "Día",
  buttonText
}: DatePickerDayProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-center text-center font-normal bg-white border-gray-200 hover:bg-gray-50 w-full",
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
        <div className="flex flex-col items-center space-y-4 p-4">
          <Calendar
            mode="single"
            selected={date}
            defaultMonth={date || new Date()}
            onSelect={(selectedDate) => {
              onDateChange(selectedDate);
              if (selectedDate) {
                setTimeout(() => setIsModalOpen(false), 300);
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
                onDateChange(undefined);
              }}
              size="sm"
            >
              Limpiar fecha
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface DatePickerPeriodProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: (date: Date) => boolean;
  className?: string;
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
          variant="outline"
          className={cn(
            "justify-center text-center font-normal bg-white border-gray-200 hover:bg-gray-50 w-full",
            className
          )}
        >
          <span className="truncate text-sm">
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