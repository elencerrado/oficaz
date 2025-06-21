import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: (date: Date) => boolean;
  className?: string;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  autoPosition?: boolean;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Seleccionar fecha",
  disabled,
  className,
  align = "start",
  side = "bottom",
  autoPosition = true
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, "dd/MM/yyyy", { locale: es }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-auto p-1 max-w-[280px] z-50" 
        align={align} 
        side={autoPosition ? undefined : side}
        sideOffset={4}
        avoidCollisions={true}
        collisionPadding={16}
        collisionBoundary={typeof window !== 'undefined' ? document.querySelector('body') : undefined}
      >
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
          className="rounded-md border-0"
          classNames={{
            months: "flex flex-col space-y-2",
            month: "space-y-2",
            caption: "flex justify-center pt-1 relative items-center",
            caption_label: "text-sm font-medium",
            nav: "space-x-1 flex items-center",
            nav_button: "h-6 w-6 bg-transparent p-0 opacity-50 hover:opacity-100 text-xs",
            nav_button_previous: "absolute left-1",
            nav_button_next: "absolute right-1",
            table: "w-full border-collapse",
            head_row: "flex",
            head_cell: "text-muted-foreground rounded-md w-7 font-normal text-[0.7rem] p-0",
            row: "flex w-full mt-1",
            cell: "text-center text-xs p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
            day: "h-7 w-7 p-0 font-normal aria-selected:opacity-100 text-xs",
            day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
            day_today: "bg-accent text-accent-foreground",
            day_outside: "text-muted-foreground opacity-50",
            day_disabled: "text-muted-foreground opacity-50",
            day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
            day_hidden: "invisible",
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

interface DateRangePickerProps {
  startDate?: Date;
  endDate?: Date;
  onStartDateChange: (date: Date | undefined) => void;
  onEndDateChange: (date: Date | undefined) => void;
  startPlaceholder?: string;
  endPlaceholder?: string;
  className?: string;
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  startPlaceholder = "Fecha inicio",
  endPlaceholder = "Fecha fin",
  className
}: DateRangePickerProps) {
  return (
    <div className={cn("flex gap-2", className)}>
      <DatePicker
        value={startDate}
        onChange={onStartDateChange}
        placeholder={startPlaceholder}
        disabled={(date) => {
          if (endDate) {
            return date > endDate;
          }
          return false;
        }}
        className="flex-1"
      />
      <DatePicker
        value={endDate}
        onChange={onEndDateChange}
        placeholder={endPlaceholder}
        disabled={(date) => {
          if (startDate) {
            return date < startDate;
          }
          return false;
        }}
        className="flex-1"
      />
    </div>
  );
}