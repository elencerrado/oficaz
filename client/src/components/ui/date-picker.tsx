import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
        className="w-auto p-0 bg-white shadow-lg border border-gray-200 rounded-lg overflow-hidden" 
        align="start"
        side="bottom"
        sideOffset={4}
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
}

export function DatePickerPeriod({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  className
}: DatePickerPeriodProps) {
  const [isOpen, setIsOpen] = useState(false);

  const formatDateRange = () => {
    if (startDate && endDate) {
      return `${format(startDate, "d MMM", { locale: es })} - ${format(endDate, "d MMM yyyy", { locale: es })}`;
    } else if (startDate) {
      return `Desde ${format(startDate, "d MMM yyyy", { locale: es })}`;
    } else if (endDate) {
      return `Hasta ${format(endDate, "d MMM yyyy", { locale: es })}`;
    }
    return "Seleccionar rango de fechas";
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-[200px] justify-between text-left font-normal bg-white border-gray-200 hover:bg-gray-50",
            !startDate && !endDate && "text-gray-500",
            className
          )}
        >
          <div className="flex items-center">
            <CalendarIcon className="mr-2 h-4 w-4 text-gray-400" />
            <span className="truncate">{formatDateRange()}</span>
          </div>
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-auto p-0 bg-white shadow-lg border border-gray-200 rounded-lg overflow-hidden" 
        align="start"
        side="bottom"
        sideOffset={4}
      >
        <div className="p-4">
          <div className="flex flex-col items-center space-y-4">
            <Calendar
              mode="range"
              selected={{
                from: startDate || undefined,
                to: endDate || undefined,
              }}
              onSelect={(range) => {
                if (range?.from) {
                  onStartDateChange(range.from);
                }
                if (range?.to) {
                  onEndDateChange(range.to);
                  setTimeout(() => setIsOpen(false), 300);
                } else if (range?.from && !range?.to) {
                  onEndDateChange(undefined);
                }
              }}
              numberOfMonths={1}
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
                cell: "text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100",
                day_range_end: "day-range-end",
                day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                day_today: "bg-accent text-accent-foreground",
                day_outside: "day-outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
                day_disabled: "text-muted-foreground opacity-50",
                day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                day_hidden: "invisible",
              }}
            />
            
            {(startDate || endDate) && (
              <div className="flex gap-2 w-full">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onStartDateChange(undefined);
                    onEndDateChange(undefined);
                  }}
                  className="flex-1 text-gray-600 hover:text-gray-800"
                >
                  Limpiar
                </Button>
                <Button
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="flex-1"
                >
                  Cerrar
                </Button>
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}