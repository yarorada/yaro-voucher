import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { format, parse, isValid } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DateInputProps {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
}

export const DateInput = React.forwardRef<HTMLDivElement, DateInputProps>(
  ({ value, onChange, placeholder = "DD.MM.YYYY", className }, ref) => {
    const [inputValue, setInputValue] = React.useState("");
    const [open, setOpen] = React.useState(false);

    // Update input value when date prop changes
    React.useEffect(() => {
      if (value) {
        setInputValue(format(value, "dd.MM.yyyy"));
      } else {
        setInputValue("");
      }
    }, [value]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let newValue = e.target.value;
      
      // Remove all non-digit characters for auto-formatting
      const digitsOnly = newValue.replace(/\D/g, '');
      
      // Auto-format with dots as user types
      if (digitsOnly.length > 0) {
        let formatted = digitsOnly;
        
        // Add first dot after day (2 digits)
        if (digitsOnly.length >= 3) {
          formatted = digitsOnly.slice(0, 2) + '.' + digitsOnly.slice(2);
        }
        
        // Add second dot after month (2 digits)
        if (digitsOnly.length >= 5) {
          formatted = digitsOnly.slice(0, 2) + '.' + digitsOnly.slice(2, 4) + '.' + digitsOnly.slice(4);
        }
        
        // Limit to 10 characters (DD.MM.YYYY)
        if (formatted.length > 10) {
          formatted = formatted.slice(0, 10);
        }
        
        setInputValue(formatted);
        
        // Try to parse the formatted input (only full 4-digit year)
        if (/^\d{2}\.\d{2}\.\d{4}$/.test(formatted)) {
          const parsedDate = parse(formatted, "dd.MM.yyyy", new Date());
          if (isValid(parsedDate)) {
            onChange(parsedDate);
            return;
          }
        }
      } else {
        // If input is empty, clear the date
        setInputValue("");
        onChange(undefined);
      }
    };

    const handleCalendarSelect = (date: Date | undefined) => {
      onChange(date);
      setOpen(false);
    };

    return (
      <div ref={ref} className={cn("flex gap-2", className)}>
        <Input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="flex-1"
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
            >
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={value}
              onSelect={handleCalendarSelect}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  }
);

DateInput.displayName = "DateInput";
