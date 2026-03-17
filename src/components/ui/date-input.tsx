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
  autoSetDate?: () => Date | undefined;
  /** Called when user selects a date via calendar (not typing) */
  onCalendarSelect?: (date: Date) => void;
  /** Called when user finishes typing a valid date */
  onTextInput?: (date: Date) => void;
  /** If true, this popover is controlled externally */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const DateInput = React.forwardRef<HTMLDivElement, DateInputProps>(
  (
    {
      value,
      onChange,
      placeholder = "DD.MM.RRRR",
      className,
      autoSetDate,
      onCalendarSelect,
      onTextInput,
      open: controlledOpen,
      onOpenChange: controlledOnOpenChange,
    },
    ref
  ) => {
    const [inputValue, setInputValue] = React.useState("");
    const [internalOpen, setInternalOpen] = React.useState(false);
    const [calendarMonth, setCalendarMonth] = React.useState<Date | undefined>(value);
    // Tracks whether the user is actively typing so we don't overwrite their input
    const isTypingRef = React.useRef(false);

    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;
    const setOpen = isControlled
      ? (v: boolean) => {
          if (v) setCalendarMonth(value ?? new Date());
          controlledOnOpenChange?.(v);
        }
      : (v: boolean) => {
          if (v) setCalendarMonth(value ?? new Date());
          setInternalOpen(v);
        };

    // Update input value when date prop changes from outside (not from typing)
    React.useEffect(() => {
      if (isTypingRef.current) return;
      if (value) {
        setInputValue(format(value, "dd.MM.yyyy"));
      } else {
        setInputValue("");
      }
    }, [value]);

    React.useEffect(() => {
      if (open && !value && autoSetDate) {
        const defaultDate = autoSetDate();
        if (defaultDate) {
          onChange(defaultDate);
        }
      }
    }, [open]);

    const handleFocus = () => {
      if (!value && autoSetDate) {
        const defaultDate = autoSetDate();
        if (defaultDate) {
          onChange(defaultDate);
        }
      }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      const digitsOnly = newValue.replace(/\D/g, "");

      if (digitsOnly.length > 0) {
        let formatted = digitsOnly;

        // Add first dot after day (2 digits)
        if (digitsOnly.length >= 3) {
          formatted = digitsOnly.slice(0, 2) + "." + digitsOnly.slice(2);
        }

        // Add second dot after month (2 more digits)
        if (digitsOnly.length >= 5) {
          formatted =
            digitsOnly.slice(0, 2) +
            "." +
            digitsOnly.slice(2, 4) +
            "." +
            digitsOnly.slice(4, 8);
        }

        // Limit to 10 characters (DD.MM.YYYY)
        if (formatted.length > 10) {
          formatted = formatted.slice(0, 10);
        }

        setInputValue(formatted);

        // Try to parse full DD.MM.YYYY (8 digits)
        if (/^\d{2}\.\d{2}\.\d{4}$/.test(formatted)) {
          const parsedDate = parse(formatted, "dd.MM.yyyy", new Date());
          if (isValid(parsedDate)) {
            onChange(parsedDate);
            onTextInput?.(parsedDate);
            return;
          }
        }

        // Also try 2-digit year DD.MM.YY (6 digits)
        if (/^\d{2}\.\d{2}\.\d{2}$/.test(formatted)) {
          const parsedDate = parse(formatted, "dd.MM.yy", new Date());
          if (isValid(parsedDate)) {
            onChange(parsedDate);
            onTextInput?.(parsedDate);
            return;
          }
        }
      } else {
        setInputValue("");
        onChange(undefined);
      }
    };

    const handleCalendarSelect = (date: Date | undefined) => {
      onChange(date);
      setOpen(false);
      if (date) {
        onCalendarSelect?.(date);
      }
    };

    return (
      <div ref={ref} className={cn("flex gap-2", className)}>
        <Input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          className="flex-1"
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0">
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={value}
              onSelect={handleCalendarSelect}
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
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
