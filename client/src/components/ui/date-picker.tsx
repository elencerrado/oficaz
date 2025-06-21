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
  value?: Date;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: (date: Date) => boolean;
  className?: string;
}

export function DatePickerDay({
  value,
  onChange,
  placeholder = "Seleccionar día",
  disabled,
  className
}: DatePickerDayProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-[200px] justify-between text-left font-normal bg-white border-gray-200 hover:bg-gray-50",
            !value && "text-gray-500",
            className
          )}
        >
          <div className="flex items-center">
            <CalendarIcon className="mr-2 h-4 w-4 text-gray-400" />
            {value ? format(value, "dd 'de' MMMM, yyyy", { locale: es }) : placeholder}
          </div>
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-auto p-0 bg-white shadow-lg border border-gray-200 rounded-lg overflow-hidden z-[9999] max-h-[80vh] overflow-auto" 
        align="start"
        side="top"
        sideOffset={8}
        avoidCollisions={true}
        collisionPadding={32}
        sticky="always"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="p-3">
          <Calendar
            mode="single"
            selected={value}
            onSelect={(date) => {
              onChange(date);
              setIsOpen(false);
            }}
            disabled={disabled}
            initialFocus
            locale={es}
            className="rounded-md"
            classNames={{
              months: "flex flex-col space-y-4",
              month: "space-y-4",
              caption: "flex justify-center pt-1 relative items-center",
              caption_label: "text-sm font-medium",
              nav: "space-x-1 flex items-center",
              nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
              nav_button_previous: "absolute left-1",
              nav_button_next: "absolute right-1",
              table: "w-full border-collapse space-y-1",
              head_row: "flex",
              head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
              row: "flex w-full mt-2",
              cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
              day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100",
              day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
              day_today: "bg-accent text-accent-foreground",
              day_outside: "text-muted-foreground opacity-50",
              day_disabled: "text-muted-foreground opacity-50",
              day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
              day_hidden: "invisible",
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
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
          variant="outline"
          className={cn(
            "justify-between text-left font-normal bg-white border-gray-200 hover:bg-gray-50",
            buttonText ? "w-auto px-3" : "w-[200px]",
            className
          )}
        >
          <div className="flex items-center">
            {buttonText || (startDate && endDate
              ? `${format(startDate, 'd MMM', { locale: es })} - ${format(endDate, 'd MMM yyyy', { locale: es })}`
              : 'Seleccionar rango de fechas')
            }
          </div>
          <ChevronDown className="h-4 w-4 text-gray-400" />
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

              // Si hay un rango completo y hacemos click en una nueva fecha, iniciar nuevo rango
              if (startDate && endDate && range.from && !range.to) {
                onStartDateChange(range.from);
                onEndDateChange(undefined);
                setIsSelectingStart(false);
                return;
              }

              if (isSelectingStart && range.from) {
                // Primer click: establecer fecha de inicio
                onStartDateChange(range.from);
                onEndDateChange(undefined); // Limpiar fecha de fin
                setIsSelectingStart(false);
              } else if (!isSelectingStart && range.to) {
                // Segundo click: establecer fecha de fin
                if (startDate && range.to < startDate) {
                  // Si la fecha seleccionada es anterior al inicio, intercambiar
                  onEndDateChange(startDate);
                  onStartDateChange(range.to);
                } else {
                  onEndDateChange(range.to);
                }
                // Cerrar el modal automáticamente cuando se completa el rango
                setTimeout(() => {
                  setIsModalOpen(false);
                  setIsSelectingStart(true); // Reset para próxima vez
                }, 300);
              }
            }}
            className="rounded-md border"
            numberOfMonths={1}
            showOutsideDays={false}
            locale={es}
          />

          <div className="flex gap-3 w-full">
            <Button
              variant="outline"
              onClick={() => {
                onStartDateChange(undefined);
                onEndDateChange(undefined);
                setIsSelectingStart(true);
              }}
              className="flex-1"
            >
              Limpiar fechas
            </Button>
            <Button
              onClick={() => {
                setIsModalOpen(false);
                setIsSelectingStart(true);
              }}
              className="flex-1"
            >
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}