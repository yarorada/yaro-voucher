import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DateRangePickerProps {
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  onDateFromChange: (date: Date | undefined) => void;
  onDateToChange: (date: Date | undefined) => void;
  className?: string;
}

export const DateRangePicker = React.forwardRef<HTMLDivElement, DateRangePickerProps>(
  ({ dateFrom, dateTo, onDateFromChange, onDateToChange, className }, ref) => {
    const [open, setOpen] = React.useState(false);

    const dateRange: DateRange | undefined = React.useMemo(() => {
      if (dateFrom || dateTo) {
        return {
          from: dateFrom,
          to: dateTo,
        };
      }
      return undefined;
    }, [dateFrom, dateTo]);

    const handleSelect = (range: DateRange | undefined) => {
      onDateFromChange(range?.from);
      onDateToChange(range?.to);
      
      // Close popover when both dates are selected
      if (range?.from && range?.to) {
        setOpen(false);
      }
    };

    return (
      <div ref={ref} className={className}>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !dateFrom && !dateTo && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateFrom ? (
                dateTo ? (
                  <>
                    {format(dateFrom, "dd.MM.yyyy")} - {format(dateTo, "dd.MM.yyyy")}
                  </>
                ) : (
                  format(dateFrom, "dd.MM.yyyy")
                )
              ) : (
                <span>Vyberte datum od - do</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={handleSelect}
              initialFocus
              numberOfMonths={2}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  }
);

DateRangePicker.displayName = "DateRangePicker";
