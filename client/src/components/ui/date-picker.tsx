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

// DatePickerPeriod eliminado por errores críticos de "frame" - usar selectores simples

// DatePickerPeriod completamente eliminado para resolver error "frame" definitivamente