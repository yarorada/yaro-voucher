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
      const newValue = e.target.value;
      setInputValue(newValue);

      // Try to parse the input
      // Support formats: DD.MM.YYYY, DD.MM.YY, D.M.YYYY, D.M.YY
      const patterns = [
        { format: "dd.MM.yyyy", regex: /^\d{1,2}\.\d{1,2}\.\d{4}$/ },
        { format: "dd.MM.yy", regex: /^\d{1,2}\.\d{1,2}\.\d{2}$/ },
      ];

      for (const pattern of patterns) {
        if (pattern.regex.test(newValue)) {
          const parsedDate = parse(newValue, pattern.format, new Date());
          if (isValid(parsedDate)) {
            onChange(parsedDate);
            return;
          }
        }
      }

      // If input is empty, clear the date
      if (newValue === "") {
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
